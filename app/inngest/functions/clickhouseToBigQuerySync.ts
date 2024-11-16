import { inngest } from "../client";
import { decrypt } from "@/lib/encryption";
import { createClient as createClickhouseClient } from '@clickhouse/client';
import { BigQuery } from '@google-cloud/bigquery';
import { sanitizeIdentifier } from "@/lib/queryBuilder";
import { createClient } from '@/lib/supabase/server';
import { TypeMappings, WarehouseDataType, ClickhouseCredentials, SnowflakeCredentials } from "@/lib/common/types/clickhouse.d";

// Add type definitions
interface BigQueryCredentials {
  projectId: string;
  clientEmail: string;
  privateKey: string;
  dataset: string;
}

interface ClickhouseToBigQueryPayload {
  internal_credentials: string | ClickhouseCredentials;
  destination_credentials: BigQueryCredentials;
  destination_type: WarehouseDataType;
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

// BigQuery type mapping
const clickhouseToBigQuery = new Map<string, string>([
  ['String', 'STRING'],
  ['FixedString', 'STRING'],
  ['UUID', 'STRING'],
  ['Date', 'DATE'],
  ['Date32', 'DATE'],
  ['DateTime', 'TIMESTAMP'],
  ['DateTime64', 'TIMESTAMP'],
  ['Int8', 'INT64'],
  ['Int16', 'INT64'],
  ['Int32', 'INT64'],
  ['Int64', 'INT64'],
  ['Int128', 'NUMERIC'],
  ['Int256', 'NUMERIC'],
  ['UInt8', 'INT64'],
  ['UInt16', 'INT64'],
  ['UInt32', 'INT64'],
  ['UInt64', 'INT64'],
  ['UInt128', 'NUMERIC'],
  ['UInt256', 'NUMERIC'],
  ['Float32', 'FLOAT64'],
  ['Float64', 'FLOAT64'],
  ['Decimal', 'NUMERIC'],
  ['Boolean', 'BOOLEAN'],
  ['Array', 'ARRAY'],
  ['JSON', 'JSON'],
  ['Map', 'JSON'],
  ['Tuple', 'STRING'],
  ['IPv4', 'STRING'],
  ['IPv6', 'STRING'],
  ['DEFAULT', 'STRING']
]);

// Function to convert value based on BigQuery type
function convertValue(value: any, clickhouseType: string): any {
  if (!clickhouseType) {
    console.error('Received undefined or null ClickHouse type.');
    return null;
  }

  const bigQueryType = clickhouseToBigQuery.get(clickhouseType.toUpperCase()) || 'STRING';

  switch (bigQueryType) {
    case 'STRING':
      return String(value);

    case 'INT64':
      return Number(value);

    case 'NUMERIC':
      return value.toString(); // BigQuery handles numeric strings

    case 'FLOAT64':
      return Number(value);

    case 'BOOLEAN':
      return Boolean(value);

    case 'DATE':
      return value ? new Date(value).toISOString().split('T')[0] : null;

    case 'TIMESTAMP':
      return value ? new Date(value).toISOString() : null;

    case 'JSON':
      return typeof value === 'string' ? value : JSON.stringify(value);

    case 'ARRAY':
      return Array.isArray(value) ? value : JSON.parse(value);

    default:
      return String(value);
  }
}

function getFinalBigQueryType(clickhouseType: string): string {
  if (!clickhouseType) {
    console.warn('ClickHouse type is undefined or null, defaulting to STRING');
    return 'STRING';
  }

  const type = String(clickhouseType).trim().toUpperCase();
  return clickhouseToBigQuery.get(type) || 'STRING';
}

function generateBigQuerySchema(columns: Array<{ name: string, type: string }>) {
  return columns.map(column => ({
    name: sanitizeIdentifier(column.name, false),
    type: getFinalBigQueryType(column.type),
    mode: 'NULLABLE'
  }));
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
    const payload = event.data as ClickhouseToBigQueryPayload;
    let clickhouse: any = null;
    let bigquery: BigQuery | null = null;
    
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

        // Initialize BigQuery client
        bigquery = new BigQuery({
          projectId: payload.destination_credentials.projectId,
          credentials: {
            client_email: payload.destination_credentials.clientEmail,
            private_key: payload.destination_credentials.privateKey,
          }
        });

        // Extract and sanitize table names
        const tableMatch = payload.query.match(/FROM\s+([^\s;]+)/i);
        if (!tableMatch) {
          throw new Error('Could not extract table name from query');
        }

        const originalTableName = tableMatch[1].replace(/[`"]/g, '');
        const clickhouseTableName = sanitizeIdentifier(originalTableName, false);
        const bigqueryTableName = sanitizeIdentifier(originalTableName, false);

        // Get table structure
        const describeResult = await clickhouse.query({
          query: `DESCRIBE TABLE "${clickhouseTableName}"`,
          format: 'JSONEachRow'
        });

        const columnTypes = new Map<string, string>();
        const result = await describeResult.json();
        
        for (const row of result) {
          if (row.name && row.type) {
            columnTypes.set(row.name, row.type);
          }
        }

        if (columnTypes.size === 0) {
          throw new Error(`No columns found in ClickHouse table: ${clickhouseTableName}`);
        }

        // Create dataset if it doesn't exist
        const dataset = bigquery.dataset(payload.destination_credentials.dataset);
        const [datasetExists] = await dataset.exists();
        if (!datasetExists) {
          await dataset.create();
        }

        // Create table if it doesn't exist
        const table = dataset.table(bigqueryTableName);
        const [tableExists] = await table.exists();
        
        if (!tableExists) {
          const schema = generateBigQuerySchema(
            Array.from(columnTypes.entries()).map(([name, type]) => ({ name, type }))
          );
          
          await table.create({
            schema: schema,
            timePartitioning: {
              type: 'DAY'
            }
          });
        }

        // Stream data from ClickHouse to BigQuery
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

        let rowCount = 0;
        const stream = resultStream.stream();

        // Process the stream in chunks
        const processStream = async () => {
          const rows: any[] = [];
          
          return new Promise((resolve, reject) => {
            stream.on('data', async (row: any) => {
              try {
                const parsedRow = JSON.parse(row[0].text);
                const transformedRow: Record<string, any> = {};
                
                for (const [key, value] of Object.entries(parsedRow)) {
                  const columnType = columnTypes.get(key);
                  transformedRow[sanitizeIdentifier(key, false)] = convertValue(value, columnType || 'STRING');
                }
                
                rows.push(transformedRow);
                rowCount++;

                if (rows.length >= 1000) {
                  await table.insert(rows);
                  rows.length = 0;
                }
              } catch (error) {
                reject(error);
              }
            });

            stream.on('end', async () => {
              if (rows.length > 0) {
                await table.insert(rows);
              }
              resolve(rowCount);
            });

            stream.on('error', (error: Error) => {
              reject(error);
            });
          });
        };

        await processStream();

        // Clean up connections
        await clickhouse.close();

        return { success: true, rowCount };
      } catch (error) {
        if (clickhouse) {
          await clickhouse.close();
        }
        
        console.error("Sync failed", { error });
        throw error;
      }
    });
  }
);