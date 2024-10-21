import { NextRequest, NextResponse } from 'next/server';
import { Client as PostgresClient } from 'pg';
import { createClient } from '@/lib/supabase/server';
import { tasks } from "@trigger.dev/sdk/v3";

export async function getConnection(credentials: any): Promise<PostgresClient> {
  const client = new PostgresClient({
    host: credentials.host,
    database: credentials.database,
    user: credentials.username,
    password: credentials.password,
  });
  await client.connect();
  return client;
}

export async function executeQuery(client: PostgresClient, query: string): Promise<any[]> {
  const result = await client.query(query);
  return result.rows;
}

export async function getTableNames(client: PostgresClient): Promise<string[]> {
  const query = "SELECT table_name FROM information_schema.tables WHERE table_schema='public'";
  const results = await executeQuery(client, query);
  
  if (!Array.isArray(results)) {
    throw new Error(`Expected an array of results, but got: ${JSON.stringify(results)}`);
  }

  return results.map((row: any) => row.table_name);
}

export async function insertDataInBatches(client: PostgresClient, tableName: string, data: any[], batchSize: number = 10000) {
  if (data.length === 0) return;

  const columns = Object.keys(data[0]).join(', ');

  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize);
    const values = batch.map(row => `(${Object.values(row).map(val => JSON.stringify(val)).join(', ')})`).join(', ');
    const query = `INSERT INTO ${tableName} (${columns}) VALUES ${values}`;

    await executeQuery(client, query);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('Received request body:', body);

    const { organization, link_credentials, internal_warehouse, internal_type } = body;

    if (!internal_warehouse || !link_credentials) {
      console.error('Missing required data');
      return NextResponse.json({ success: false, error: 'Missing required data' }, { status: 400 });
    }

    const supabase = createClient();

    // Insert import data into Supabase
    const { data: syncData, error: syncError } = await supabase
      .from('syncs')
      .insert({
        organization,
        internal_warehouse,
        internal_type,
        link_credentials,
      })
      .select()
      .single();

    if (syncError) {
      console.error('Error inserting sync data:', syncError);
      return NextResponse.json({ success: false, error: 'Failed to insert sync data' }, { status: 500 });
    }

    const client = await getConnection(link_credentials);
    const tableNames = await getTableNames(client);
    
    for (const tableName of tableNames) {
      const query = `SELECT * FROM ${tableName}`;
      const data = await executeQuery(client, query);
      await insertDataInBatches(client, tableName, data);
      console.log(`Inserted data into ${tableName}`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('ETL process failed:', error);
    return NextResponse.json({ success: false, error: 'ETL process failed' }, { status: 500 });
  }
}