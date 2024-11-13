import { inngest } from "../client";
import { decrypt } from "@/lib/encryption";
import { createClient as createClickhouseClient } from '@clickhouse/client';
import Snowflake from 'snowflake-sdk';
import { Analytics } from '@segment/analytics-node';
import { Connection } from "snowflake-sdk";
import { TypeMappings, WarehouseDataType, ClickhouseCredentials, SnowflakeCredentials } from "@/lib/common/types/clickhouse.d";
import { clickhouseToSnowflake, typeMatrix } from "@/lib/common/types/clickhouse";
import { json } from "stream/consumers";
import { error } from "console";
import { sanitizeIdentifier } from "@/lib/queryBuilder";

// Add type definition
interface SnowflakeSyncPayload {
  internal_credentials: string | ClickhouseCredentials;
  destination_credentials: SnowflakeCredentials;
  destination_type: WarehouseDataType;
  query: string;
  table: string;
  organization: string;
}

// Function to convert value based on warehouse type
//https://clickhouse.com/docs/en/sql-reference/data-types/data-types-binary-encoding
function convertValue(value: any, clickhouseType: string): any {
  if (!clickhouseType) {
    console.error('Received undefined or null ClickHouse type.');
    return 'thisisanerrormessage_001';
}
  if (!clickhouseType) {
    console.warn(`Invalid ClickHouse type: ${clickhouseType}. Returning value as is.`);
    return value;  // Return the value as is if type is missing or invalid
  }

  const preProcessed = clickhouseToSnowflake.get(clickhouseType)?.toUpperCase() || 'VARCHAR'; // Default to 'VARCHAR' if type is invalid
  const processedType = preProcessed.startsWith('DECIMAL') ? preProcessed.slice(6) : preProcessed;

  switch (processedType) {
    case 'STRING':
    case 'FIXEDSTRING':
    case 'VARCHAR': 
      return String(value);

    case 'UINT8':
    case 'UINT16':
    case 'UINT32':
    case 'INT8':
    case 'INT16':
    case 'INT32':
    case 'INTEGER':  
      return Number(value);

    case 'INT64':
    case 'INT128':
    case 'INT256':
    case 'UINT64':
    case 'UINT128':
    case 'UINT256': 
      return BigInt(value);

    case 'FLOAT32':
    case 'FLOAT64':
    case 'FLOAT':
    case 'DOUBLE': 
    case 'DECIMAL': 
      return parseFloat(value);

    case 'BOOLEAN':
      return Boolean(value);

    case 'DATE':
    case 'DATE32':
    case 'DATETIME':
    case 'DATETIME64':
      return new Date(value); // Assuming value is in a valid format

    case 'UUID':
      return String(value); // UUIDs are typically strings

    case 'JSON':  
    case 'MAP':
    case 'OBJECT': // Deprecated
      return JSON.parse(value);

    case 'ARRAY':
      return Array.isArray(value) ? value : JSON.parse(value); // Handle array conversion

    case 'TUPLE': 
      return String(value);

    case 'IPV6':
    case 'IPV4':
      return String(value);

    case 'GEO':
    case 'POINT':
    case 'RING':
    case 'LINESTRING':
    case 'MULTILINESTRING':
    case 'POLYGON':
      return String(value);

    case 'NOTHING':
      return null;

    default:
      return value;  // Fallback to the original value for unsupported types
  }
}


function getFinalSnowflakeType(clickhouseType: string, destinationType: WarehouseDataType): string {
  if (!clickhouseType) {
    console.warn('ClickHouse type is undefined or null, defaulting to VARCHAR');
    return 'VARCHAR';  // Default fallback instead of throwing error
  }

  // Step 1: Get base Snowflake type
  const type = String(clickhouseType).trim().toUpperCase();
  const processedType = type.startsWith('DECIMAL') ? type.slice(6) : type
  const baseType = clickhouseToSnowflake.get(processedType.toUpperCase()) || clickhouseToSnowflake.get('DEFAULT')!;

  // Step 2: Convert to specific warehouse type if needed
  // TODO Handle Decimal types specially
  //do some logic here grabbing the type const and porting across scale and precision
  /*
  https://clickhouse.com/docs/en/sql-reference/data-types/decimal
  https://docs.snowflake.com/en/sql-reference/data-types-numeric
  */
  return baseType || 'VARCHAR';
}


function generateSnowflakeCreateTableSQL(
  tableName: string,
  columns: Array<{ name: string, type: string }>,
  destinationType: WarehouseDataType
): string {
  // Sanitize table name for Snowflake (uppercase)
  const sanitizedTableName = sanitizeIdentifier(tableName, true);
  
  // Build column definitions with proper quoting - no newlines
  const columnDefinitions = columns
    .map(column => {
      const sanitizedName = sanitizeIdentifier(column.name, false);
      const snowflakeType = getFinalSnowflakeType(column.type, destinationType);
      return `"${sanitizedName}" ${snowflakeType}`;
    })
    .join(', ');

  // Create single-line SQL statement
  return `CREATE TABLE IF NOT EXISTS "${sanitizedTableName}" (${columnDefinitions})`;
}

// Function to convert Clickhouse value to Snowflake-compatible value
function convertClickhouseValue(value: any, clickhouseType: string, destinationType: WarehouseDataType): any {
  if (value === null || value === undefined) return null;

  const snowflakeType = getFinalSnowflakeType(clickhouseType, destinationType);
  if (!clickhouseType) {
    console.log('No Clickhouse type provided');
    throw new Error('No Clickhouse type provided');
  }
  else {
    return convertValue(value, snowflakeType);
  }
}

// Create function with proper typing
export const clickhouseToSnowflakeSync = inngest.createFunction(
  { 
    id: "clickhouse-snowflake-sync",
    name: "Clickhouse to Snowflake Sync"
  },
  { 
    event: "event/clickhouse-to-snowflake-sync"
  },
  async ({ event, step }) => {
    const payload = event.data as SnowflakeSyncPayload;
    let clickhouse: any = null;
    let snowflakeConnection: any = null;
    
    return await step.run("sync-data", async () => {
      try {
        // Parse credentials
        let internal_credentials: ClickhouseCredentials;
        if (typeof payload.internal_credentials === 'string') {
          internal_credentials = JSON.parse(payload.internal_credentials) as ClickhouseCredentials;
        } else {
          throw new Error('Invalid internal_credentials format');
        }

        // Connect to ClickHouse
        clickhouse = createClickhouseClient({
          url: internal_credentials.host,
          username: internal_credentials.username,
          password: internal_credentials.password,
          database: internal_credentials.database,
        });

        // Test ClickHouse connection
        await clickhouse.ping();
        console.log("Successfully connected to ClickHouse");

        // Extract table name from the query
        const tableMatch = payload.query.match(/FROM\s+([^\s;]+)/i);
        if (!tableMatch) {
          throw new Error('Could not extract table name from query');
        }

        // Keep original case for ClickHouse operations
        const originalTableName = tableMatch[1].replace(/[`"]/g, '');
        const clickhouseTableName = sanitizeIdentifier(originalTableName, false);
        // Use uppercase for Snowflake operations
        const snowflakeTableName = sanitizeIdentifier(originalTableName, true);


        // Get table structure
        const describeResult = await clickhouse.query({
          query: `DESCRIBE TABLE "${clickhouseTableName}"`,
          format: 'JSONEachRow'
      });
        
        const columnTypes = new Map<string, string>();

        // Process the result as an array
        for await (const rows of describeResult.stream()) {
            // Check if rows is an array
            if (Array.isArray(rows)) {
                for (const row of rows) {
                    try {
                        if (row && typeof row.text === 'string') {
                            const columnDef = JSON.parse(row.text);
                            if (columnDef.name && columnDef.type) {
                                columnTypes.set(columnDef.name, columnDef.type);
                                console.log(`Added column: ${columnDef.name}, Type: ${columnDef.type}`);
                            }
                        }
                    } catch (parseError) {
                        console.error('Error parsing column definition:', parseError);
                        console.error('Raw row:', row);
                    }
                }
            } else {
                console.warn('Expected array of rows but got:', typeof rows);
            }
        }

        // Verify we have columns before proceeding
        if (columnTypes.size === 0) {
            throw new Error('No columns found in ClickHouse table');
        }

        // Log the collected column types
        console.log('Collected column types:', Object.fromEntries(columnTypes));

        // Connect to Snowflake
        snowflakeConnection = Snowflake.createConnection({
          account: payload.destination_credentials.account,
          username: payload.destination_credentials.username,
          password: payload.destination_credentials.password,
          database: payload.destination_credentials.database,
          warehouse: payload.destination_credentials.warehouse,
          schema: payload.destination_credentials.schema,
        });
        
        await new Promise((resolve, reject) => {
          snowflakeConnection.connect((err: Error | undefined, conn: Connection) => {
            if (err) {
              console.error("Unable to connect to Snowflake:", err);
              reject(err);
            } else {
              console.log("Successfully connected to Snowflake.");
              resolve(conn);
            }
          });
        });

        // Create table in Snowflake if it doesn't exist
        const createTableSQL = generateSnowflakeCreateTableSQL(
          snowflakeTableName,
          Array.from(columnTypes.entries()).map(([name, type]) => ({ name, type })),
          payload.destination_type
      );
        
        console.log('Generated Snowflake CREATE TABLE SQL:', createTableSQL);

        await new Promise((resolve, reject) => {
          snowflakeConnection.execute({
            sqlText: createTableSQL,
            complete: (err: any, stmt: any) => {
              if (err) {
                console.error("Failed to create table:", err);
                reject(err);
              } else {
                console.log("Table created or already exists");
                resolve(stmt);
              }
            }
          });
        });

        // Execute the query with proper settings
        const resultStream = await clickhouse.query({
          query: payload.query,
          format: 'JSONEachRow',
          clickhouse_settings: {
              wait_end_of_query: 1,
          },
      });  
      
      // Process the stream in batches
      const batchSize = 1000;
      let batch: any[] = [];
      const stream = resultStream.stream() as AsyncIterable<any>;
      
      for await (const row of stream) {
        const transformedRow: Record<string, any> = {};
    
        // Process each row and convert data types using actual ClickHouse types
        for (const [key, value] of Object.entries(row)) {
            const clickhouseType = columnTypes.get(key) || 'String'; // Default to String if type is missing
    
            // Check if value is a JSON string and parse it if needed
                try {
                    const parsedJson = JSON.parse(value.text);
    
                    // Process each key-value pair in the parsed JSON
                    for (const [jsonKey, jsonValue] of Object.entries(parsedJson)) {
                        const jsonClickhouseType = columnTypes.get(jsonKey) || 'String'; // Use type for each JSON key
                        transformedRow[jsonKey] = convertValue(jsonValue, jsonClickhouseType);
                    }
                } catch (error) {
                    console.error("Failed to parse JSON:", error);
                    // Fallback: Convert the raw JSON text if parsing fails
                    transformedRow[key] = convertValue(value.text, clickhouseType);
                }
        }
    
        batch.push(transformedRow);
    
        if (batch.length >= batchSize) {
            await processBatch(batch, snowflakeTableName, snowflakeConnection);
            batch = [];
        }
    }
    

        // Clean up connections
        await clickhouse.close();
        await new Promise<void>((resolve, reject) => {
          snowflakeConnection.destroy((err: Error | undefined) => {
            if (err) {
              console.error('Error destroying Snowflake connection:', err);
              reject(err);
            } else {
              console.log('Snowflake connection destroyed successfully');
              resolve();
            }
          });
        });

        return { success: true };
      } catch (error) {
        // Ensure connections are closed even if an error occurs
        if (clickhouse) {
          try {
            await clickhouse.close();
          } catch (closeError) {
            console.error('Error closing ClickHouse connection:', closeError);
          }
        }
        
        if (snowflakeConnection) {
          await new Promise<void>((resolve) => {
            snowflakeConnection.destroy((err: Error | undefined) => {
              if (err) {
                console.error('Error destroying Snowflake connection:', err);
              }
              resolve();
            });
          });
        }

        console.error("Sync failed", { error });
        throw error;
      }
    });
  }
);

async function processBatch(batch: any[], tableName: string, snowflakeConnection: any): Promise<void> {
  if (batch.length === 0) return;
  
  // Get column names from the first row
  const columns = Object.keys(batch[0]);
  const sanitizedTableName = sanitizeIdentifier(tableName);
  
  // Create a bulk insert statement
  const columnList = columns.join(', ');
  const valuesList = batch.map(row => 
    `(${columns.map(col => JSON.stringify(row[col])).join(', ')})`
  ).join(', ');
  
  const insertQuery = `
    INSERT INTO ${sanitizedTableName} (${columnList})
    VALUES ${valuesList}
  `;

  await new Promise((resolve, reject) => {
    snowflakeConnection.execute({
      sqlText: insertQuery,
      complete: (err: any, stmt: any) => {
        if (err) {
          console.error("Failed to execute batch insert:", err);
          reject(err);
        } else {
          console.log(`Successfully inserted ${batch.length} rows`);
          resolve(stmt);
        }
      }
    });
  });
}