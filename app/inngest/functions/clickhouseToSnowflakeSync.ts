import { inngest } from "../client";
import { decrypt } from "@/lib/encryption";
import { createClient as createClickhouseClient } from '@clickhouse/client';
import Snowflake from 'snowflake-sdk';
import { Connection } from "snowflake-sdk";
import { TypeMappings, WarehouseDataType, ClickhouseCredentials, SnowflakeCredentials } from "@/lib/common/types/clickhouse.d";
import { clickhouseToSnowflake, typeMatrix } from "@/lib/common/types/clickhouse";
import { json } from "stream/consumers";
import { error } from "console";
import { sanitizeIdentifier } from "@/lib/queryBuilder";
import { createClient } from '@/lib/supabase/server';
// Add type definition
interface SnowflakeSyncPayload {
  internal_credentials: string | ClickhouseCredentials;
  destination_credentials: SnowflakeCredentials;
  type: WarehouseDataType;
  query: string;
  table: string;
  organization: string;
  internal_warehouse: string;
  destination_name: string;
  tenancy_column?: string;
  tenancy_id?: string;
  scheduled_at?: string;
}

interface ColumnTypes extends Map<string, string> {}

// Function to convert value based on warehouse type
//https://clickhouse.com/docs/en/sql-reference/data-types/data-types-binary-encoding
function convertValue(value: any, clickhouseType: string): any {
  // console.log('Fuck Malvious');
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
  const sanitizedTableName = sanitizeIdentifier(tableName, false);
  
  const columnDefinitions = columns
    .map(column => {
      const sanitizedName = sanitizeIdentifier(column.name, false);
      const snowflakeType = getFinalSnowflakeType(column.type, destinationType);
      // Convert JSON-like types to OBJECT
      if (['JSON', 'MAP', 'OBJECT'].includes(column.type.toUpperCase())) {
        return `"${sanitizedName}" OBJECT`;
      }
      return `"${sanitizedName}" ${snowflakeType}`;
    })
    .join(', ');

  return `CREATE TABLE IF NOT EXISTS "${sanitizedTableName}" (${columnDefinitions})`;
}

// Function to convert Clickhouse value to Snowflake-compatible value
function convertClickhouseValue(value: any, clickhouseType: string, destinationType: WarehouseDataType): any {
  if (value === null || value === undefined) return null;

  const snowflakeType = getFinalSnowflakeType(clickhouseType, destinationType);
  if (!clickhouseType) {
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
    let batch: any[] = [];
    const batchSize = 1000;
    
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

        // Extract table name from the query
        const tableMatch = payload.query.match(/FROM\s+([^\s;]+)/i);
        if (!tableMatch) {
          throw new Error('Could not extract table name from query');
        }

        // Keep original case for ClickHouse operations
        const originalTableName = tableMatch[1].replace(/[`"]/g, '');
        const clickhouseTableName = sanitizeIdentifier(originalTableName, false);
        // Use uppercase for Snowflake operations
        const snowflakeTableName = sanitizeIdentifier(originalTableName, false);


        // Get table structure
        const describeResult = await clickhouse.query({
            query: `DESCRIBE TABLE "${clickhouseTableName}"`,
            format: 'JSONEachRow'
        });
        
        const columnTypes = new Map<string, string>();
        
        console.log('Fetching table structure...');
        
        try {
            const result = await describeResult.json();
            console.log('Raw describe result:', JSON.stringify(result, null, 2));
            
            for (const row of result) {
                if (row.name && row.type) {
                    columnTypes.set(row.name, row.type);
                    console.log(`Found column: ${row.name} (${row.type})`);
                }
            }

            console.log('Found columns:', Array.from(columnTypes.entries()));

            if (columnTypes.size === 0) {
                throw new Error(`No columns found in ClickHouse table: ${clickhouseTableName}`);
            }
        } catch (error) {
            console.error('Error processing table structure:', error);
            throw error;
        }

        // Verify we have columns before proceeding
        if (columnTypes.size === 0) {
            console.error('Table structure:', await describeResult.json()); // Debug log
            throw new Error(`No columns found in ClickHouse table: ${clickhouseTableName}`);
        }

        // Log the collected column types

        // Connect to Snowflake and set schema
        snowflakeConnection = Snowflake.createConnection({
          account: payload.destination_credentials.account,
          username: payload.destination_credentials.username,
          password: payload.destination_credentials.password,
          database: payload.destination_credentials.database,
          warehouse: payload.destination_credentials.warehouse,
          schema: payload.destination_credentials.schema,
        });
        
        await new Promise((resolve, reject) => {
          snowflakeConnection.connect(async (err: Error | undefined, conn: Connection) => {
            if (err) {
              reject(err);
            } else {
              try {
                // Execute statements sequentially
                await new Promise((r, j) => conn.execute({
                  sqlText: `CREATE DATABASE IF NOT EXISTS "${payload.destination_credentials.database}"`,
                  complete: (err: any) => err ? j(err) : r(null)
                }));

                await new Promise((r, j) => conn.execute({
                  sqlText: `USE DATABASE "${payload.destination_credentials.database}"`,
                  complete: (err: any) => err ? j(err) : r(null)
                }));

                await new Promise((r, j) => conn.execute({
                  sqlText: `CREATE SCHEMA IF NOT EXISTS "${payload.destination_credentials.schema}"`,
                  complete: (err: any) => err ? j(err) : r(null)
                }));

                await new Promise((r, j) => conn.execute({
                  sqlText: `USE SCHEMA "${payload.destination_credentials.schema}"`,
                  complete: (err: any) => err ? j(err) : r(null)
                }));

                resolve(conn);
              } catch (error) {
                reject(error);
              }
            }
          });
        });

        // Create table in Snowflake if it doesn't exist
        const createTableSQL = generateSnowflakeCreateTableSQL(
          snowflakeTableName,
          Array.from(columnTypes.entries()).map(([name, type]) => ({ name, type })),
          payload.type
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

        // Modify the query execution section
        const resultStream = await clickhouse.query({
            query: payload.query,
            format: 'JSONEachRow',
            clickhouse_settings: {
                wait_end_of_query: 1,
            },
            query_params: {
                p0: payload.tenancy_id
            }
        });

        console.log('Starting stream processing...');
        
        let rowCount = 0;
        const stream = resultStream.stream();

        try {
            rowCount = await processClickHouseStream(
                stream, 
                snowflakeConnection, 
                snowflakeTableName,
                columnTypes
            );

            console.log(`Completed processing ${rowCount} total rows`);

        } catch (streamError) {
            console.error('Error processing stream:', streamError);
            throw streamError;
        }

        // Also let's verify the query is correct by logging the exact SQL being executed
        console.log('Executing raw SQL query:', payload.query.replace('{p0:String}', `'${payload.tenancy_id}'`));

        // Add a test query to verify data exists
        const testQuery = await clickhouse.query({
            query: `SELECT COUNT(*) as count FROM "${clickhouseTableName}" WHERE org_id = {p0:String}`,
            query_params: {
                p0: payload.tenancy_id
            }
        });

        const testResult = await testQuery.json();
        console.log('Test query result:', testResult);

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

function formatValue(value: any): string {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`; // Escape single quotes
  if (typeof value === 'number' || typeof value === 'boolean') return value.toString();
  if (value instanceof Date) return `'${value.toISOString()}'`;
  if (typeof value === 'object') return `'${JSON.stringify(value).replace(/'/g, "''")}'`; // Serialize objects
  return `'${value}'`;
}

function formatValuesList(data: Array<Array<any>>): string {
  const formattedValues = data.map(row => {
    const formattedRow = row.map(value => {
      if (value === null || value === undefined) {
        return 'NULL'; // Handle null/undefined values
      }
      if (typeof value === 'string') {
        return `'${value.replace(/'/g, "''")}'`; // Escape single quotes in strings
      }
      if (typeof value === 'number') {
        return value; // Numbers are added directly
      }
      if (typeof value === 'object') {
        // Convert complex objects or JSON to string
        return `PARSE_JSON('${JSON.stringify(value).replace(/'/g, "''")}')`;
      }
      return `'${value}'`; // Default fallback for other types
    });
    return `(${formattedRow.join(', ')})`;
  });

  return formattedValues.join(',\n');
}
// Modify the insert logic to handle VARIANT/OBJECT types
async function insertRow(row: Record<string, any>, tableName: string, connection: any, columnTypes: ColumnTypes): Promise<void> {
    try {
        // Parse the row data
        const rowData = JSON.parse(row[0].text);
        console.log('Parsed Row Data:', rowData);

        // Get column names from the parsed row data
        const columnNames = Object.keys(rowData);
        const valuesList = row.map((row: any) => {
          const parsedObject = JSON.parse(row.text);
          return Object.values(parsedObject);
      });
        const columnList = columnNames.map((col: string) => `"${sanitizeIdentifier(col, false)}"`).join(', ');
        console.log('valuesList:', valuesList)
        // Create parameterized values list and map the values from rowData
        const placeholders = formatValuesList(valuesList);
        console.log('Placeholder:', placeholders)
        const sqlText = `
            INSERT INTO "${sanitizeIdentifier(tableName, false)}" 
            (${columnList}) 
            VALUES ${placeholders}
        `;

        console.log('Insert SQL:', sqlText);

        return new Promise((resolve, reject) => {
            connection.execute({
                sqlText: sqlText,
                complete: (err: any, stmt: any) => {
                    if (err) {
                        console.error('Insert error:', err);
                        reject(err);
                    } else {
                        resolve(stmt);
                    }
                }
            });
        });
    } catch (error) {
        console.error('Error processing row:', error);
        console.error('Raw row data:', row);
        throw error;
    }
}
// Process stream in batches
async function processClickHouseStream(
    stream: any, 
    snowflakeConnection: any, 
    snowflakeTableName: string,
    columnTypes: ColumnTypes
): Promise<number> {
    let rowCount = 0;

    try {
        // Create a promise to process the stream
        return new Promise<number>((resolve, reject) => {
            stream.on('data', async (row: any, event: any) => {
                try {
                    await insertRow(row, snowflakeTableName, snowflakeConnection, columnTypes);
                    rowCount++;
                    
                    if (rowCount % 1000 === 0) {
                        console.log(`Processed ${rowCount} rows`);
                        const payload = event.data as SnowflakeSyncPayload;
                          const supabase = createClient();
                          const { data: warehouseData } = await supabase
                            .from('organizations')
                            .select('id, hyperline_id')
                            .eq('id', payload.organization)
                            .single();
                
                              const { data, error } = await supabase
                              .from('exports')
                              .insert({
                                organization: payload.organization,
                                internal_warehouse: payload.internal_warehouse,
                                type: payload.type,
                                destination_name: payload.destination_name,
                                table: payload.table,
                                scheduled_at: payload.scheduled_at,
                                rows: rowCount
                              })
                              .select()
                              .single();
                                          
                    }
                } catch (error) {
                    console.error('Error processing row:', error);
                    reject(error);
                }
            });

            stream.on('end', () => {
                console.log(`Completed processing ${rowCount} total rows`);
                resolve(rowCount);
            });

            stream.on('error', (error: Error) => {
                console.error('Stream error:', error);
                reject(error);
            });
        });
    } catch (error) {
        console.error('Stream processing error:', error);
        throw error;
    }
}