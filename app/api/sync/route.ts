import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as ClickHouseClient } from '@clickhouse/client';
import { BigQuery } from '@google-cloud/bigquery';
import { Client as PostgresClient } from 'pg';
import { createConnection } from 'snowflake-sdk';
import { tasks } from "@trigger.dev/sdk/v3";
import { sync } from "@/app/trigger/sync"; // Import the ETL task

export async function getWarehouseConnection(warehouse: string, credentials: any): Promise<any> {
  if (!warehouse) {
    throw new Error('Warehouse type is required');
  }
  switch (warehouse.toLowerCase()) {
    case 'clickhouse':
      return ClickHouseClient({
        host: credentials.host,
        database: credentials.database,
        username: credentials.username,
        password: credentials.password,
      });
    case 'bigquery':
      return new BigQuery({
        projectId: credentials.projectId,
        credentials: credentials.keyFilename,
      });
    case 'postgres':
      return new PostgresClient({
        host: credentials.host,
        database: credentials.database,
        user: credentials.username,
        password: credentials.password,
      });
    case 'snowflake':
      return createConnection({
        account: credentials.account,
        username: credentials.username,
        password: credentials.password,
        database: credentials.database,
        schema: credentials.schema,
        warehouse: credentials.warehouse,
      });
    default:
      throw new Error(`Unsupported warehouse type: ${warehouse}`);
  }
}

export async function executeQuery(client: any, query: string, warehouse: string): Promise<any[]> {
  if (!warehouse) {
    throw new Error('Warehouse type is required');
  }
  switch (warehouse.toLowerCase()) {
    case 'clickhouse':
      return (await client.query({ query }).json()).data;

    case 'bigquery':
      const [rows] = await client.query(query);
      return rows;

    case 'postgres':
      const pgResult = await client.query(query);
      return pgResult.rows;

    case 'snowflake':
      return new Promise((resolve, reject) => {
        client.execute({
          sqlText: query,
          complete: (err: any, stmt: any, rows: any) => {
            if (err) {
              reject(err);
            } else {
              resolve(rows);
            }
          }
        });
      });

    default:
      throw new Error(`Unsupported warehouse type: ${warehouse}`);
  }
}

export async function getTableNames(client: any, warehouse: string): Promise<string[]> {
  const query = warehouse.toLowerCase() === 'bigquery' 
    ? 'SELECT table_name FROM INFORMATION_SCHEMA.TABLES'
    : 'SHOW TABLES';
  
  const results = await executeQuery(client, query, warehouse);
  return results.map((row: any) => 
    warehouse.toLowerCase() === 'bigquery' ? row.table_name : Object.values(row)[0]
  );
}

export async function insertDataInBatches(client: any, tableName: string, data: any[], warehouse: string, batchSize: number = 10000) {
  if (data.length === 0) return;

  const columns = Object.keys(data[0]).join(', ');

  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize);
    const values = batch.map(row => `(${Object.values(row).map(val => JSON.stringify(val)).join(', ')})`).join(', ');
    const query = `INSERT INTO ${tableName} (${columns}) VALUES ${values}`;

    await executeQuery(client, query, warehouse);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('Received request body:', body);

    const { organization, type, link_warehouse, internal_warehouse, sync_id, link_credentials, internal_credentials } = body;

    if (!internal_warehouse || !link_credentials || !link_warehouse) {
      console.error('Missing required data');
      return NextResponse.json({ success: false, error: 'Missing required data' }, { status: 400 });
    }

    const supabase = createClient();

    // Insert import data
    const { data: syncData, error: syncError } = await supabase
      .from('syncs')
      .insert({
        organization,
        internal_warehouse,
        internal_credentials,
        link_credentials,
        link_warehouse,
        sync_id,
        type
      })
      .select()
      .single();

    if (syncError) {
      console.error('Error inserting sync data:', syncError);
      return NextResponse.json({ success: false, error: 'Failed to insert sync data' }, { status: 500 });
    }

    // Trigger the ETL task with the request body
    const handle = await tasks.trigger<typeof sync>("etl-process", body);

    return NextResponse.json({ success: true, handle });
  } catch (error) {
    console.error('ETL process failed:', error);
    return NextResponse.json({ success: false, error: 'ETL process failed' }, { status: 500 });
  }
}
// Schedule the ETL task to run periodically
tasks.trigger("etl-process", {
  cron: "0 * * * *", // Adjust the cron expression as needed for your schedule
});