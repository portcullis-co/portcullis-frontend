import { logger } from "@trigger.dev/sdk/v3";
import { inngest } from "../client";
import type { ClickhouseCredentials, BigQueryCredentials } from '@/lib/common/types/clickhouse.d';
import { decrypt } from "@/lib/encryption";
import { createClient as createClickhouseClient } from '@clickhouse/client';
import { BigQuery } from '@google-cloud/bigquery';
import { clickhouseToBigQuery } from '@/lib/common/types/clickhouse';

interface BigQuerySyncPayload {
  internal_credentials: string | ClickhouseCredentials;
  destination_credentials: BigQueryCredentials;
  query: string;
  table: string;
  organization: string;
}

export const clickhouseToBigQuerySync = inngest.createFunction(
  { 
    id: "clickhouse-bigquery-sync",
    name: "Clickhouse to BigQuery Sync"
  },
  { 
    event: "event/clickhouse-to-bigquery-sync"
  },
  async ({ event, step }) => {
    const payload = event.data as BigQuerySyncPayload;
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

      const bigquery = new BigQuery({
        projectId: payload.destination_credentials.projectId,
        keyFilename: payload.destination_credentials.keyFilename
      });

      try {
        const resultStream = await clickhouse.query({
          query: payload.query,
          format: 'JSONEachRow',
          clickhouse_settings: { wait_end_of_query: 1 }
        });

        logger.info("Starting data sync", { 
          source: "Clickhouse", 
          destination: "BigQuery",
          table: payload.table 
        });

        for await (const rows of resultStream.stream()) {
          const transformedRows = rows.map((row: any) => {
            const transformed: any = {};
            for (const [key, value] of Object.entries(row)) {
              const chType = typeof value;
              const bqType = clickhouseToBigQuery.get(chType) || 'STRING';
              transformed[key] = convertValue(value, bqType);
            }
            return transformed;
          });

          await bigquery
            .dataset(payload.destination_credentials.dataset)
            .table(payload.table)
            .insert(transformedRows);

          logger.info("Processed batch", { rowCount: transformedRows.length });
        }

        return { success: true };
      } catch (error) {
        logger.error("Sync failed", { error });
        throw error;
      } finally {
        await clickhouse.close();
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
  