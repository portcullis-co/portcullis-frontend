import { logger } from "@trigger.dev/sdk/v3";
import { inngest } from "../client";
import type { ClickhouseCredentials } from '@/lib/common/types/clickhouse.d';
import { decrypt } from "@/lib/encryption";
import { createClient as createClickhouseClient } from '@clickhouse/client';
import { Client } from 'pg';
import { Analytics } from '@segment/analytics-node';
import { clickhouseToRedshift } from '@/lib/common/types/clickhouse';

// Add type definition
interface RedshiftSyncPayload {
  internal_credentials: string | ClickhouseCredentials;
  destination_credentials: {
    host: string;
    port: number;
    database: string;
    username: string;
    password: string;
  };
  query: string;
  table: string;
  organization: string;
}

export const clickhouseToRedshiftSync = inngest.createFunction(
  { 
    id: "clickhouse-redshift-sync",
    name: "Clickhouse to Redshift Sync"
  },
  { event: "event/clickhouse-to-redshift-sync" },
  async ({ event, step }) => {
    const payload = event.data as RedshiftSyncPayload;
    
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

      // Initialize Redshift connection
      const redshift = new Client({
        host: payload.destination_credentials.host,
        port: payload.destination_credentials.port,
        database: payload.destination_credentials.database,
        user: payload.destination_credentials.username,
        password: payload.destination_credentials.password
      });

      try {
        await redshift.connect();

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
          destination: "Redshift",
          table: payload.table 
        });

        // Process the stream in chunks
        for await (const rows of resultStream.stream()) {
          // Transform data types using the mapping
          const transformedRows = rows.map((row: any) => {
            const transformed: any = {};
            for (const [key, value] of Object.entries(row)) {
              const chType = typeof value;
              const rsType = clickhouseToRedshift.get(chType) || 'VARCHAR';
              transformed[key] = convertValue(value, rsType);
            }
            return transformed;
          });

          // Batch insert into Redshift using COPY command
          await redshift.query(`
            COPY ${payload.table} 
            FROM '${JSON.stringify(transformedRows)}'
            FORMAT JSON
          `);

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
          event: "clickhouse-redshift-sync",
          properties: {
            table: payload.table,
            revenue: 250,
            organization: payload.organization,
            destination: "Redshift",
          }
        });
      } catch (error) {
        logger.error("Error during data sync", { error });
        throw error;
      } finally {
        await redshift.end();
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
  