import { inngest } from "../client";
import { decrypt } from "@/lib/encryption";
import { createClient as createClickhouseClient } from '@clickhouse/client';
import { BigQuery } from '@google-cloud/bigquery';
import { 
  TypeMappings, 
  WarehouseDataType, 
  ClickhouseCredentials, 
  BigQueryCredentials 
} from "@/lib/common/types/clickhouse.d";
import { clickhouseToBigQuery, typeMatrix } from "@/lib/common/types/clickhouse";
import { sanitizeIdentifier } from "@/lib/queryBuilder";
import { createClient } from '@/lib/supabase/server';

// Type Definitions
interface BigQuerySyncPayload {
  internal_credentials: string | ClickhouseCredentials;
  destination_credentials: BigQueryCredentials;
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

// Utility Functions
function convertValue(value: any, clickhouseType: string): any {
  if (!clickhouseType) {
    console.error('Received undefined or null ClickHouse type.');
    return null;
  }

  const preProcessed = clickhouseToBigQuery.get(clickhouseType)?.toUpperCase() || 'STRING';
  const processedType = preProcessed.startsWith('DECIMAL') ? preProcessed.slice(6) : preProcessed;

  // Handle null/undefined values
  if (value === null || value === undefined) {
    return null;
  }

  // Special handling for JSON types
  if (['JSON', 'MAP', 'OBJECT'].includes(processedType)) {
    try {
      // If value is already an object, return it directly
      if (typeof value === 'object') {
        return value;
      }
      // If it's a string, parse it
      return typeof value === 'string' ? JSON.parse(value) : value;
    } catch (error) {
      console.error(`Error parsing JSON value: ${error}`);
      return null;
    }
  }

  // Rest of the type conversions remain the same
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
      return BigInt(value).toString(); // Convert BigInt to string for BigQuery

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
      return new Date(value).toISOString();

    default:
      return String(value);
  }
}

async function insertBatch(
  bigquery: BigQuery,
  dataset: string,
  table: string,
  rows: any[],
  columnTypes: ColumnTypes
): Promise<number> {
  if (!rows.length) return 0;

  const processedRows = rows.map(row => {
    const processedRow: { [key: string]: any } = {};
    for (const [key, value] of Object.entries(row)) {
      const columnType = columnTypes.get(key);
      if (columnType) {
        processedRow[key] = convertValue(value, columnType);
      }
    }
    return processedRow;
  });

  try {
    const tableRef = bigquery.dataset(dataset).table(table);
    await tableRef.insert(processedRows, {
      // Add insertion options for better error handling
      raw: true,
      skipInvalidRows: true,
      ignoreUnknownValues: true
    });
    return processedRows.length;
  } catch (error) {
    console.error('Insert error:', error);
    // Log the first few rows for debugging
    console.error('Sample rows:', JSON.stringify(processedRows.slice(0, 2)));
    throw error;
  }
}

async function createBigQueryTable(
  bigquery: BigQuery,
  dataset: string,
  table: string,
  columnTypes: ColumnTypes
): Promise<void> {
  const schema = Array.from(columnTypes.entries()).map(([columnName, clickhouseType]) => {
    console.log('ping_clickhousetype:', clickhouseType)
    const bigqueryType = clickhouseToBigQuery.get(clickhouseType)?.toUpperCase() || 'STRING';
    console.log('pong_bigqueryType:', bigqueryType)

    return {
      name: columnName,
      type: bigqueryType,
      mode: 'NULLABLE'
    };
  });

  try {
    const tableRef = bigquery.dataset(dataset).table(table);
    const [exists] = await tableRef.exists();
    
    if (!exists) {
      const options = {
        schema: schema,
        location: 'US', // You might want to make this configurable
      };
      
      await tableRef.create(options);
      console.log(`Created table ${dataset}.${table}`);
    }
  } catch (error) {
    console.error(`Error creating table ${dataset}.${table}:`, error);
    throw error;
  }
}

// Main Function
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
    let clickhouse: any = null;
    let bigquery: BigQuery | null = null;
    let batch: any[] = [];
    const batchSize = 1000;

    return await step.run("sync-data", async () => {
      try {
        // Parse credentials and initialize connections
        let internal_credentials: ClickhouseCredentials;
        if (typeof payload.internal_credentials === 'string') {
          internal_credentials = JSON.parse(payload.internal_credentials) as ClickhouseCredentials;
        } else {
          throw new Error('Invalid internal_credentials format');
        }
        const { project_id, client_email, private_key } = payload.destination_credentials;

        // Initialize ClickHouse
        clickhouse = createClickhouseClient({
          url: internal_credentials.host,
          username: internal_credentials.username,
          password: internal_credentials.password,
          database: internal_credentials.database,
        });

        await clickhouse.ping();

        // Extract and validate table name
        const tableMatch = payload.query.match(/FROM\s+([^\s;]+)/i);
        if (!tableMatch) {
          throw new Error('Could not extract table name from query');
        }

        bigquery = new BigQuery({
          projectId: project_id,
          credentials: {
            client_email: client_email.trim(),
            private_key: private_key.replace(/\\n/g, '\n'),
          }
        });

        // Set up BigQuery dataset with creation if it doesn't exist
        const dataset = bigquery.dataset(payload.destination_credentials.dataset);
        const [datasetExists] = await dataset.exists();
        
        if (!datasetExists) {
          try {
            await dataset.create();
            console.log(`Created dataset ${payload.destination_credentials.dataset}`);
          } catch (error) {
            throw new Error(`Failed to create dataset: ${error}`);
          }
        }

        // Get ClickHouse table structure (same as before)...
        const clickhouseTableName = payload.table;
        const describeResult = await clickhouse.query({
          query: `DESCRIBE TABLE "${clickhouseTableName}"`,
          format: 'JSONEachRow'
        });

        const columnTypes = new Map<string, string>();
        
        try {
          const result = await describeResult.json();
          for (const row of result) {
            if (row.name && row.type) {
              columnTypes.set(row.name, row.type);
            }
          }

          if (columnTypes.size === 0) {
            throw new Error(`No columns found in ClickHouse table: ${clickhouseTableName}`);
          }
        } catch (error) {
          console.error('Error processing table structure:', error);
          throw error;
        }

        // Create BigQuery table if it doesn't exist
        await createBigQueryTable(
          bigquery,
          payload.destination_credentials.dataset,
          clickhouseTableName,
          columnTypes
        );

        // Initialize BigQuery
        bigquery = new BigQuery({
          projectId: project_id,
          credentials: {
            client_email: client_email.trim(),
            private_key: private_key.replace(/\\n/g, '\n'),
          }
        });

        // Set up BigQuery dataset
        try {
          const dataset = bigquery.dataset(payload.destination_credentials.dataset);
          const [datasets] = await bigquery.getDatasets();
          const existingDataset = datasets.find((d) => d.id === dataset.id);
          if (!existingDataset) {
            await dataset.create();
          }
        } catch (error) {
          throw new Error(`Failed to set up BigQuery environment: ${error}`);
        }

        // Execute query and process results
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
        const batch: any[] = [];
  
        for await (const row of stream) {
          batch.push(row);
          if (batch.length >= batchSize) {
            rowCount += await insertBatch(
              bigquery!,
              payload.destination_credentials.dataset,
              clickhouseTableName,
              batch,
              columnTypes
            );
            batch.length = 0;
          }
        }
  
        if (batch.length > 0) {
          rowCount += await insertBatch(
            bigquery!,
            payload.destination_credentials.dataset,
            clickhouseTableName,
            batch,
            columnTypes
          );
        }

        // Process tracking and logging
        if (rowCount % 1000 === 0) {
          const supabase = createClient();
          const { data: warehouseData } = await supabase
            .from('organizations')
            .select('id, hyperline_id')
            .eq('id', payload.organization)
            .single();

          if (warehouseData) {
            const trackExport = {
              method: 'POST',
              headers: {
                Authorization: 'Bearer prod_dc5eb5c34597149afc3379aee12f79437d6ed5b7b4a42d729497ecbcdbccb3ce',
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                customer_id: warehouseData.hyperline_id,
                event_type: "flexport",
                timestamp: new Date().toISOString(),
                record: {
                  id: `D32NAA8-${warehouseData.id}`,
                  durationInMs: 32,
                  isVerified: true
                }
              })
            };

            await fetch('https://ingest.hyperline.co/v1/events', trackExport)
              .then(response => response.json())
              .catch(err => console.error('Error tracking export:', err));

            await supabase
              .from('exports')
              .insert({
                organization: payload.organization,
                internal_warehouse: payload.internal_warehouse,
                type: payload.type,
                destination_name: payload.destination_name,
                table: payload.table,
                scheduled_at: payload.scheduled_at
              })
              .select()
              .single();
          }
        }

        // Cleanup and return
        await clickhouse.close();
        return { success: true, rowCount };

      } catch (error) {
        if (clickhouse) {
          try {
            await clickhouse.close();
          } catch (closeError) {
            console.error('Error closing ClickHouse connection:', closeError);
          }
        }
        console.error("Sync failed", { error });
        throw error;
      }
    });
  }
);