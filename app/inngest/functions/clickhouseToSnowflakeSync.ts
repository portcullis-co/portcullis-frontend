import { logger } from "@trigger.dev/sdk/v3";
import { inngest } from "../client";
import type { ClickhouseCredentials, SnowflakeCredentials } from '@/lib/common/types/clickhouse.d';
import { decrypt } from "@/lib/encryption";
import { createClient as createClickhouseClient } from '@clickhouse/client';
import Snowflake from 'snowflake-sdk';
import { EventSchemas, Inngest } from 'inngest';
import { Analytics } from '@segment/analytics-node';
import { clickhouseToSnowflake } from '@/lib/common/types/clickhouse';

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
      const decryptedCredentials = typeof payload.internal_credentials === 'string'
        ? await decrypt(payload.internal_credentials)
        : payload.internal_credentials;

      const clickhouse = createClickhouseClient({
        host: decryptedCredentials.host,
        username: decryptedCredentials.username,
        password: decryptedCredentials.password,
        database: decryptedCredentials.database,
        request_timeout: 30000,
      });

      // Validate Snowflake credentials
      if (!payload.destination_credentials.account || 
          !payload.destination_credentials.username || 
          !payload.destination_credentials.password) {
        throw new Error('Invalid Snowflake credentials');
      }

      // Initialize Snowflake connection with additional options
      const snowflake = Snowflake.createConnection({
        account: payload.destination_credentials.account,
        username: payload.destination_credentials.username,
        password: payload.destination_credentials.password,
        warehouse: payload.destination_credentials.warehouse,
        database: payload.destination_credentials.database,
        schema: payload.destination_credentials.schema,
        // Add connection options
        timeout: 30,
        validateDefaultParameters: true,
      });

      // Connect to Snowflake with proper error handling
      await new Promise((resolve, reject) => {
        snowflake.connect((err, conn) => {
          if (err) {
            logger.error("Snowflake connection failed", { 
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
        // Stream data from Clickhouse
        const resultStream = await clickhouse.query({
          query: payload.query,
          format: 'JSONEachRow',
          clickhouse_settings: {
            wait_end_of_query: 1
          }
        });

        logger.info("Starting data sync", { 
          source: "Clickhouse", 
          destination: "Snowflake",
          table: payload.table 
        });

        // Process the stream in chunks
        for await (const rows of resultStream.stream()) {
          // Transform data types using the mapping
          const transformedRows = rows.map((row: any) => {
            const transformed: any = {};
            for (const [key, value] of Object.entries(row)) {
              // Get Clickhouse type and convert to Snowflake type
              const chType = typeof value; // You'd need proper type detection here
              const sfType = clickhouseToSnowflake.get(chType) || 'VARCHAR';
              transformed[key] = convertValue(value, sfType);
            }
            return transformed;
          });

          // Batch insert into Snowflake
          await new Promise((resolve, reject) => {
            snowflake.execute({
              sqlText: `INSERT INTO ${payload.table} SELECT * FROM TABLE(RESULT_SCAN(?))`,
              binds: [JSON.stringify(transformedRows)],
              complete: (err, stmt) => {
                if (err) reject(err);
                else resolve(stmt);
              }
            });
          });

          logger.info("Processed batch", { 
            rowCount: transformedRows.length 
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
        logger.error("Sync failed", { 
          error,
          account: payload.destination_credentials.account,
          query: payload.query
        });
        throw error;
      } finally {
        await clickhouse.close();
        snowflake.destroy((err: any) => {
          if (err) logger.error("Error destroying Snowflake connection", { error: err });
        });
      }
    });
  }
);

function convertValue(value: any, destType: string): any {
    if (value === null || value === undefined) return null;
    
    switch (destType.toUpperCase()) {
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
        return value instanceof Date 
          ? value.toISOString()
          : new Date(value).toISOString();
      
      case 'DATE':
        return value instanceof Date 
          ? value.toISOString().split('T')[0]
          : new Date(value).toISOString().split('T')[0];
  
      // Array types
      case 'ARRAY':
        return Array.isArray(value) ? value : [value];
  
      // JSON types
      case 'JSON':
      case 'JSONB':
        return typeof value === 'string' ? JSON.parse(value) : JSON.stringify(value);
  
      // Default case
      default:
        return value;
    }
  }
  