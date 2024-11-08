import { inngest } from "../client";
import { decrypt } from "@/lib/encryption";
import { createClient as createClickhouseClient } from '@clickhouse/client';
import Snowflake from 'snowflake-sdk';
import { Analytics } from '@segment/analytics-node';
import { TypeMappings, WarehouseDataType, ClickhouseCredentials, SnowflakeCredentials } from "@/lib/common/types/clickhouse.d";
import { clickhouseToSnowflake, typeMatrix } from "@/lib/common/types/clickhouse";
import { generateSnowflakeCreateTableSQL } from "@/lib/conversions";

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
function convertValue(value: any, clickhouseType: string): any {
  const snowflakeType = clickhouseToSnowflake.get(clickhouseType) || 'VARCHAR'; // Default type

  switch (snowflakeType) {
    case 'VARCHAR':
      return String(value);
    case 'INTEGER':
      return Number(value);
    case 'BOOLEAN':
      return Boolean(value);
    case 'FLOAT':
    case 'DOUBLE':
      return parseFloat(value);
    case 'SMALLINT':
      return Number(value) & 0xFFFF; // Ensure it's within SMALLINT range
    case 'BIGINT':
      return BigInt(value);
    case 'DATE':
      return new Date(value); // Assuming value is in a format that can be parsed
    case 'TIMESTAMP':
      return new Date(value); // Assuming value is in a format that can be parsed
    case 'DECIMAL':
      return parseFloat(value); // Handle decimal conversion
    case 'UUID':
      return String(value); // UUIDs are typically strings
    case 'OBJECT':
      return JSON.parse(value); // Assuming value is a JSON string
    case 'ARRAY':
      return Array.isArray(value) ? value : JSON.parse(value); // Handle array conversion
    case 'BINARY':
      return Buffer.from(value, 'base64'); // Assuming value is a base64 encoded string
    default:
      return value; // Fallback to original value
  }
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

// 1. Using TypeMappings
function getSnowflakeType(clickhouseType: string): string {
  return clickhouseToSnowflake.get(clickhouseType) || clickhouseToSnowflake.get('default')!;
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
          decryptedCredentials = await decrypt(payload.internal_credentials);
        } else {
          decryptedCredentials = {
            host: await decrypt(payload.internal_credentials.host),
            username: await decrypt(payload.internal_credentials.username),
            password: await decrypt(payload.internal_credentials.password),
            database: await decrypt(payload.internal_credentials.database),
          };
        }

        const clickhouse = createClickhouseClient({
          url: decryptedCredentials.host,
          username: decryptedCredentials.username,
          password: decryptedCredentials.password,
          database: decryptedCredentials.database,
          request_timeout: 30000,
        });

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
          const upsertQuery = `
            MERGE INTO ${payload.table} AS target
            USING (SELECT :1 AS id, :2 AS column1, :3 AS column2) AS source
            ON target.id = source.id
            WHEN MATCHED THEN
              UPDATE SET target.column1 = source.column1, target.column2 = source.column2
            WHEN NOT MATCHED THEN
              INSERT (id, column1, column2) VALUES (source.id, source.column1, source.column2);
          `;

          // Execute the upsert query
          await new Promise((resolve, reject) => {
            snowflakeConnection.execute({
              sqlText: upsertQuery,
              binds: [transformedRow.id, transformedRow.column1, transformedRow.column2], // Adjust based on your actual columns
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