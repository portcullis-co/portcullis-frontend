import { NextRequest, NextResponse } from 'next/server';
import { createConnection } from 'snowflake-sdk';
import { createClient } from '@/lib/supabase/server';

export async function getConnection(credentials: any) {
  const connection = createConnection({
    account: credentials.account,
    username: credentials.username,
    password: credentials.password,
    database: credentials.database,
    schema: credentials.schema,
    warehouse: credentials.warehouse,
  });
  
  return new Promise((resolve, reject) => {
    connection.connect((err, conn) => {
      if (err) {
        reject(err);
      } else {
        resolve(conn);
      }
    });
  });
}

export async function executeQuery(connection: any, query: string): Promise<any[]> {
  return new Promise((resolve, reject) => {
    connection.execute({
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
}

export async function getTableNames(connection: any): Promise<string[]> {
  const query = "SHOW TABLES";
  const results = await executeQuery(connection, query);
  
  if (!Array.isArray(results)) {
    throw new Error(`Expected an array of results, but got: ${JSON.stringify(results)}`);
  }

  return results.map((row: any) => row.name);
}

export async function insertDataInBatches(connection: any, tableName: string, data: any[], batchSize: number = 10000) {
  if (data.length === 0) return;

  const columns = Object.keys(data[0]).join(', ');

  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize);
    const values = batch.map(row => `(${Object.values(row).map(val => JSON.stringify(val)).join(', ')})`).join(', ');
    const query = `INSERT INTO ${tableName} (${columns}) VALUES ${values}`;

    await executeQuery(connection, query);
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

    const connection = await getConnection(link_credentials);
    const tableNames = await getTableNames(connection);
    
    for (const tableName of tableNames) {
      const query = `SELECT * FROM ${tableName}`;
      const data = await executeQuery(connection, query);
      await insertDataInBatches(connection, tableName, data);
      console.log(`Inserted data into ${tableName}`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('ETL process failed:', error);
    return NextResponse.json({ success: false, error: 'ETL process failed' }, { status: 500 });
  }
}