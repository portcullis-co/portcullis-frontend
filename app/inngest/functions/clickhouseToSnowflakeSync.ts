import { inngest } from "../client";
import type { ClickhouseCredentials, SnowflakeCredentials } from '@/lib/common/types/clickhouse.d';
import { decrypt } from "@/lib/encryption";
import { createClient as createClickhouseClient } from '@clickhouse/client';
import Snowflake from 'snowflake-sdk';
import { EventSchemas, Inngest } from 'inngest';
import { Analytics } from '@segment/analytics-node';
import { clickhouseToSnowflake } from '@/lib/common/types/clickhouse';
import { url } from "inspector";
import { json } from "stream/consumers";
import { generateSnowflakeCreateTableSQL } from "@/lib/conversions";

// Add type definition
interface SnowflakeSyncPayload {
  internal_credentials: string | ClickhouseCredentials;
  destination_credentials: SnowflakeCredentials;
  query: string;
  table: string;
  organization: string;
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
    
    return await step.run("sync-data", async () => {
      try {
        // Handle credentials decryption      

        const internal_credentials = payload.internal_credentials;

        let decryptedCredentials;
        
        if (typeof payload.internal_credentials === 'string') {
          console.log('Raw internal_credentials:', payload.internal_credentials);
          // First decryption
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

        // Validate Snowflake credentials
        const { account, username, password, warehouse, database, schema } = payload.destination_credentials;
        
        if (!account || !username || !password) {
          throw new Error('Missing required Snowflake credentials');
        }

        // Add debug logging
        console.log("Initializing Snowflake connection", {
          account: payload.destination_credentials.account,
          username: payload.destination_credentials.username,
          warehouse: payload.destination_credentials.warehouse,
          database: payload.destination_credentials.database,
          schema: payload.destination_credentials.schema
        });

        // Initialize Snowflake connection with additional options
        const snowflake = Snowflake.createConnection({
          account: payload.destination_credentials.account,
          username: payload.destination_credentials.username,
          password: payload.destination_credentials.password,
          warehouse: payload.destination_credentials.warehouse,
          database: payload.destination_credentials.database,
          schema: payload.destination_credentials.schema,
        });

        // Connect to Snowflake with proper error handling
        await new Promise((resolve, reject) => {
          snowflake.connect((err, conn) => {
            if (err) {
              console.error("Snowflake connection failed", { 
                error: err,
                account: payload.destination_credentials.account 
              });
              reject(err);
            } else {
              resolve(conn);
            }
          });
        });

        try {
          // Get Clickhouse schema
          const schema = await getClickhouseTableSchema(clickhouse, payload.table);
          
          // Generate and execute CREATE TABLE statement
          const createTableSQL = generateSnowflakeCreateTableSQL(payload.table, schema);
          
          await new Promise((resolve, reject) => {
            snowflake.execute({
              sqlText: createTableSQL,
              complete: (err: any, stmt: any) => {
                if (err) {
                  console.error("Error creating table:", err);
                  reject(err);
                } else {
                  console.log("Table created or verified successfully");
                  resolve(stmt);
                }
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

          console.log("Starting data sync", { 
            source: "Clickhouse", 
            destination: "Snowflake",
            table: payload.table 
          });

          // Process the stream in batches
          const BATCH_SIZE = 1000;
          let batch: Record<string, any>[] = [];

          for await (const row of resultStream.stream()) {
            batch.push(row);
            
            if (batch.length >= BATCH_SIZE) {
              await new Promise((resolve, reject) => {
                // First, get the column names from the first row
                const columns = Object.keys(batch[0]);
                const placeholders = columns.map(() => '?').join(', ');
                const columnList = columns.map(col => `"${col}"`).join(', ');
                
                snowflake.execute({
                  sqlText: `
                    INSERT INTO ${payload.table} (${columnList})
                    SELECT ${columnList}
                    FROM (
                      SELECT * FROM (VALUES ${batch.map(() => `(${placeholders})`).join(', ')})
                      AS t(${columnList})
                    )
                  `,
                  binds: batch.flatMap(row => columns.map(col => convertValue(row[col], typeof row[col]))),
                  complete: (err, stmt, rows) => {
                    if (err) {
                      console.error("Error inserting batch:", err);
                      reject(err);
                    } else {
                      console.log(`Inserted ${batch.length} rows`);
                      resolve(rows);
                    }
                  }
                });
              });
              
              batch = [];
            }
          }

          // Insert any remaining rows
          if (batch.length > 0) {
            await new Promise((resolve, reject) => {
              const columns = Object.keys(batch[0]);
              const placeholders = columns.map(() => '?').join(', ');
              const columnList = columns.map(col => `"${col}"`).join(', ');
              
              snowflake.execute({
                sqlText: `
                  INSERT INTO ${payload.table} (${columnList})
                  SELECT ${columnList}
                  FROM (
                    SELECT * FROM (VALUES ${batch.map(() => `(${placeholders})`).join(', ')})
                    AS t(${columnList})
                  )
                `,
                binds: batch.flatMap(row => columns.map(col => convertValue(row[col], typeof row[col]))),
                complete: (err, stmt, rows) => {
                  if (err) {
                    console.error("Error inserting final batch:", err);
                    reject(err);
                  } else {
                    console.log(`Inserted final ${batch.length} rows`);
                    resolve(rows);
                  }
                }
              });
            });
          }

          let analytics: Analytics | null = null;
          if (process.env.SEGMENT_WRITE_KEY) {
            analytics = new Analytics({ writeKey: process.env.SEGMENT_WRITE_KEY });
          } else {
            console.warn('SEGMENT_WRITE_KEY not found in environment variables');
          }

          analytics?.track({
            userId: payload.organization,
            event: "clickhouse-snowflake-sync",
            properties: {
              table: payload.table,
              revenue: 250,
              organization: payload.organization,
              destination: "Snowflake",
            }
          });

          return { success: true };
        } catch (error) {
          console.error("Sync failed", { error });
          throw error;
        } finally {
          await clickhouse.close();
          await new Promise((resolve) => snowflake.destroy(resolve));
        }
      } catch (error) {
        console.error("Error in sync-data step", { 
          error,
        });
        throw error;
      }
    });
  }
);

function convertValue(value: any, destType: string): any {
  // Early return for null/undefined values
  if (value === null || value === undefined) return null;
  
  // Handle case where destType is null/undefined
  if (!destType) {
      console.warn('Destination type is undefined, defaulting to STRING');
      return String(value);
  }
  
  // Normalize the type string
  const normalizedType = destType.toString().toUpperCase();
  
  try {
      switch (normalizedType) {
          // String types
          case 'VARCHAR':
          case 'STRING':
          case 'TEXT':
          case 'CHAR':
          case 'CHARACTER':
              return String(value);
      
          // Integer types
          case 'INTEGER':
          case 'INT':
          case 'BIGINT':
          case 'SMALLINT':
              return Number.isInteger(Number(value)) ? Number(value) : Math.floor(Number(value));
      
          // Floating point types
          case 'FLOAT':
          case 'DOUBLE':
          case 'DECIMAL':
          case 'NUMERIC':
          case 'REAL':
              return Number(value);
      
          // Boolean type
          case 'BOOLEAN':
          case 'BOOL':
              return Boolean(value);
      
          // Date/Time types
          case 'TIMESTAMP':
          case 'DATETIME':
              try {
                  return value instanceof Date 
                      ? value.toISOString()
                      : new Date(value).toISOString();
              } catch (e) {
                  console.warn(`Invalid date value: ${value}, returning null`);
                  return null;
              }
          
          case 'DATE':
              try {
                  return value instanceof Date 
                      ? value.toISOString().split('T')[0]
                      : new Date(value).toISOString().split('T')[0];
              } catch (e) {
                  console.warn(`Invalid date value: ${value}, returning null`);
                  return null;
              }
      
          // Array types
          case 'ARRAY':
              return Array.isArray(value) ? value : [value];
      
          // JSON/Object types
          case 'OBJECT':
          case 'VARIANT':
          case 'JSON':
              try {
                  return typeof value === 'string' ? value : JSON.stringify(value);
              } catch (e) {
                  console.warn(`Failed to stringify value: ${value}, returning null`);
                  return null;
              }
      
          // Default case
          default:
              console.warn(`Unknown type ${normalizedType}, converting to string`);
              return String(value);
      }
  } catch (error) {
      console.error(`Error converting value: ${value} to type: ${normalizedType}`, error);
      return null;
  }
}

async function getClickhouseTableSchema(clickhouse: any, table: string) {
  try {
      console.log(`Active Table: ${table}`)
      const schemaResult = await clickhouse.query({
          query: `DESCRIBE ${table}`,
          format: 'JSONEachRow'
      });

      const columns = [];
      let hasValidRows = false; // Track if we have valid rows

      for await (const row of schemaResult.stream()) {
          hasValidRows = true; // We have at least one row
          try {
            console.log(`Schema result: ${schemaResult}`)
              // Parse the text property if it exists
              const schemaRow = row.text ? JSON.parse(row.text) : row;
              
              if (!schemaRow || !schemaRow.name || !schemaRow.type) {
                  console.warn('Invalid schema row after parsing:', schemaRow);
                  continue;
              }

              let type = schemaRow.type.toString();
              
              // Handle special types
              if (type.toLowerCase().includes('json')) {
                  type = 'JSON';
              }
              else if (type.startsWith('Array(')) {
                  type = 'ARRAY';
              }
              else if (type === 'UUID') {
                  type = 'STRING'; // Convert UUID to STRING for Snowflake compatibility
              }
              else if (type === 'DateTime') {
                  type = 'TIMESTAMP';
              }
              
              columns.push({
                  name: schemaRow.name,
                  type: type
              });
          } catch (parseError) {
              console.error('Error parsing schema row:', parseError, row);
              continue;
          }
      }

      if (!hasValidRows) {
          throw new Error(`No valid columns found for table: ${table}. Please check if the table exists and has a valid schema.`);
      }

      if (columns.length === 0) {
          throw new Error(`No valid columns found for table: ${table}. Please check if the table exists and has a valid schema.`);
      }

      console.log('Successfully parsed schema:', columns);
      return columns;
  } catch (error) {
      console.error(`Error getting schema for table ${table}:`, error);
      throw error;
  }
}