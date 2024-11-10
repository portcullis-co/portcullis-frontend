import { inngest } from "../client";
import { decrypt } from "@/lib/encryption";
import { createClient as createClickhouseClient } from '@clickhouse/client';
import Snowflake from 'snowflake-sdk';
import { Analytics } from '@segment/analytics-node';
import { TypeMappings, WarehouseDataType, ClickhouseCredentials, SnowflakeCredentials } from "@/lib/common/types/clickhouse.d";
import { clickhouseToSnowflake, typeMatrix } from "@/lib/common/types/clickhouse";
import { generateSnowflakeCreateTableSQL } from "@/lib/conversions";
import { sanitizeIdentifier } from "@/lib/conversions";


// Add type definition
interface SnowflakeSyncPayload {
  internal_credentials: string | ClickhouseCredentials;
  destination_credentials: SnowflakeCredentials;
  destination_type: WarehouseDataType;
  query: string;
  table: string;
  organization: string;
}


function StartsWithDecimal(clickhouseType: string): boolean {
  return clickhouseType.startsWith("Decimal");
}

// Function to convert value based on warehouse type
//https://clickhouse.com/docs/en/sql-reference/data-types/data-types-binary-encoding
function convertValue(value: any, clickhouseType: string): any {
  const preProccessed = clickhouseToSnowflake.get(clickhouseType)?.toUpperCase() || 'VARCHAR'; // Default type
  const processedType = preProccessed.startsWith('DECIMAL') ? preProccessed.slice(6) : preProccessed

  switch (processedType) {
    case 'STRING':
    case 'FIXEDSTRING':
    case 'VARCHAR': //shouldn't trigger
      return String(value);

    case 'UInt8':
    case 'UInt16':
    case 'UInt32':
    case 'Int8':
    case 'Int16':
    case 'Int32':       
    case 'INTEGER': //shouldn't trigger                                                                     
      return Number(value);
    
    case 'Int64':
    case 'Int128':
    case 'Int256':
    case 'UInt64':
    case 'UInt128':
    case 'UInt256': 
      return BigInt(value); 

    case 'FLOAT32':
    case 'FLOAT64':
    case 'FLOAT': //shouldn't trigger
    case 'DOUBLE': //shouldn't trigger
    case 'DECIMAL': 
      return parseFloat(value);

    case 'BOOLEAN':
      return Boolean(value);

    case 'DATE':
    case 'DATE32':
    case 'DATETIME':
    case 'DATETIME64':
      return new Date(value); // Assuming value is in a format that can be parsed
      
    case 'UUID':
      return String(value); // UUIDs are typically strings

    case 'JSON':  
    case 'MAP':
    case 'JSON':
    case 'OBJECT': //TODO: This is Deprecated
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
      return String(value) //won't create 

    case 'NOTHING':
      return null; //I think this is right

    default: //TODO: Expression, Set, Nothing, Nested, Aggregation function types and Interval
      return value; // Fallback to original value
  }
}

// 1. Using TypeMappings
function getSnowflakeType(clickhouseType: string): string {
  const processedType = clickhouseType.startsWith('DECIMAL') ? clickhouseType.slice(6) : clickhouseType
  return clickhouseToSnowflake.get(processedType.toUpperCase()) || clickhouseToSnowflake.get('default')!;
}

function convertWarehouseType(warehouse: WarehouseDataType): WarehouseDataType {
  if ([
    WarehouseDataType.Snowflake,
    WarehouseDataType.BigQuery,
    WarehouseDataType.Databricks
  ].includes(warehouse)) {
    return warehouse; // Return the valid warehouse type
  }
  throw new Error(`Invalid warehouse type: ${warehouse}`);
}

// 3. Using TypeMatrix for dynamic warehouse mapping
function getWarehouseType(sourceType: string, targetWarehouse: WarehouseDataType): string {
  const mappings = typeMatrix.get(targetWarehouse);
  if (!mappings) {
    throw new Error(`No type mappings found for warehouse: ${targetWarehouse}`);
  }
  return mappings.get(sourceType) || 'STRING';
}

// Function to convert Clickhouse value to Snowflake-compatible value
function convertClickhouseValue(value: any, clickhouseType: string, destinationType: WarehouseDataType): any {
  if (value === null || value === undefined) return null;

  const snowflakeType = getSnowflakeType(clickhouseType);
  const targetWarehouseType = convertWarehouseType(destinationType);
  const warehouseType = getWarehouseType(snowflakeType, targetWarehouseType);
  console.log("Using warehouse type for export:", warehouseType);

  return convertValue(value, warehouseType);
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

    // Convert warehouse type
    const targetWarehouseType = convertWarehouseType(payload.destination_type);

    // Get Snowflake type for the Clickhouse type
    const snowflakeType = getSnowflakeType(payload.query); // Assuming payload.query contains the Clickhouse type

    // Get warehouse type mappings
    const warehouseType = getWarehouseType(snowflakeType, targetWarehouseType);

    // Use the warehouseType in your data export logic
    console.log("Using warehouse type for export:", warehouseType);

    return await step.run("sync-data", async () => {
      try {
        // Handle credentials decryption      
              const internal_credentials = payload.internal_credentials;
              let decryptedCredentials;
        
              if (typeof payload.internal_credentials === 'string') {
                console.log('Raw internal_credentials:', payload.internal_credentials);
                let decrypted = await decrypt(payload.internal_credentials);
          
                // Keep decrypting until we get a valid JSON or hit a limit
                let attempts = 0;
                const MAX_DECRYPT_ATTEMPTS = 3;
                
                while (attempts < MAX_DECRYPT_ATTEMPTS) {
                  try {
                    // Try to parse as JSON
                    decryptedCredentials = JSON.parse(decrypted);
                    break;
                  } catch (e) {
                    // If parsing fails, try decrypting again
                    console.log(`Decryption attempt ${attempts + 1}:`, decrypted);
                    decrypted = await decrypt(decrypted);
                    attempts++;
                  }
                }

                if (!decryptedCredentials) {
                  throw new Error(`Failed to decrypt credentials after ${MAX_DECRYPT_ATTEMPTS} attempts`);
                }
              } else {
                decryptedCredentials = {
                  host: await decrypt(payload.internal_credentials.host),
                  username: await decrypt(payload.internal_credentials.username),
                  password: await decrypt(payload.internal_credentials.password),
                  database: await decrypt(payload.internal_credentials.database),
                };
              }

              console.log("Connecting to ClickHouse", { 
                host: decryptedCredentials.host,
                username: decryptedCredentials.username,
                database: decryptedCredentials.database,
                password: decryptedCredentials.password
              });

              const clickhouse = createClickhouseClient({
                url: decryptedCredentials.host,
                username: decryptedCredentials.username,
                password: decryptedCredentials.password,
                database: decryptedCredentials.database,
                request_timeout: 30000,
              });

                          // Test the connection before proceeding
            await clickhouse.ping();
            console.log("Successfully connected to ClickHouse");

                // Create Snowflake connection
                const snowflakeConnection = Snowflake.createConnection({
                  account: payload.destination_credentials.account,
                  username: payload.destination_credentials.username,
                  password: payload.destination_credentials.password,
                  database: payload.destination_credentials.database,
                  warehouse: payload.destination_credentials.warehouse,
                  schema: payload.destination_credentials.schema,
                });
        
                // Connect to Snowflake
                await new Promise((resolve, reject) => {
                  snowflakeConnection.connect((err, conn) => {
                    if (err) {
                      console.error("Unable to connect to Snowflake:", err);
                      reject(err);
                    } else {
                      console.log("Successfully connected to Snowflake.");
                      resolve(conn);
                    }
                  });
                });

        // Stream data from Clickhouse
        const resultStream = await clickhouse.query({
          query: payload.query,
          format: 'JSONEachRow',
          clickhouse_settings: {
            wait_end_of_query: 1
          }
        });

        for await (const row of resultStream.stream()) {
          const transformedRow: Record<string, any> = {};
          for (const [key, value] of Object.entries(row)) {
            const clickhouseType = typeof value; // You may need a better way to determine the type
            transformedRow[key] = convertClickhouseValue(value, clickhouseType, targetWarehouseType);
          }
            // Validate and sanitize the table name
            const tableName = sanitizeIdentifier(payload.table);
        
            // Construct the upsert query with a sanitized table name
            const upsertQuery = `
            MERGE INTO ${tableName} AS target
            USING (SELECT ? AS id, ? AS column1, ? AS column2) AS source
            ON target.id = source.id
            WHEN MATCHED THEN
              UPDATE SET target.column1 = source.column1, target.column2 = source.column2
            WHEN NOT MATCHED THEN
              INSERT (id, column1, column2) VALUES (?, ?, ?);
            `; 

          // Execute the upsert query
          await new Promise((resolve, reject) => {
            snowflakeConnection.execute({
              sqlText: upsertQuery,
              binds: [transformedRow.id, transformedRow.column1, transformedRow.column2, transformedRow.id, transformedRow.column1, transformedRow.column2], // Adjust based on your actual columns
              complete: (err, stmt) => {
                if (err) {
                  console.error("Failed to execute upsert:", err);
                  reject(err);
                } else {
                  console.log("Upsert successful for row:", transformedRow);
                  resolve(stmt);
                }
              }
            });
          });
        }

        return { success: true };
      } catch (error) {
        console.error("Sync failed", { error });
        throw error;
      }
    });
  }
);