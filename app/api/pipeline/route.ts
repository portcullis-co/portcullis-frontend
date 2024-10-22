import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';
import { Client as PostgresClient } from 'pg';
import { Clickhouse as ClickhouseClient } from 'clickhouse-ts';
import snowflake from 'snowflake-sdk';
import { BigQuery } from '@google-cloud/bigquery';
import { RedshiftClient, ListRecommendationsCommand } from "@aws-sdk/client-redshift";
import { url } from 'inspector';

interface LinkCredentials {
  host: string;
  url: string;
  port?: number; // Make port optional
  database: string;
  username: string;
  password: string;
  account?: string;
  schema?: string;
  application?: string;
  keepAlive?: string;
  proxyHost?: string;
  accessUrl?: string;
  authenticator?: string;
  warehouse?: string;
  projectId?: string;
  keyFilename?: string;
  table?: string; // Add other relevant properties
}

interface InternalCredentials {
  url: string;
  database: string;
  username: string;
  password: string;
}


// Validation schema for the request body
const requestSchema = z.object({
  organization: z.string(),
  link_credentials: z.object({
    url: z.string().optional(), // Make host optional
    host: z.string().optional(), // Make host optional
    port: z.number().optional(), // Keep it optional
    database: z.string().optional(), // Keep it optional
    username: z.string().optional(), // Keep it optional
    password: z.string().optional(), // Keep it optional
    account: z.string().optional(), // Keep it optional
    schema: z.string().optional(), // Keep it optional
    application: z.string().optional(), // Keep it optional
    keepAlive: z.string().optional(), // Keep it optional
    proxyHost: z.string().optional(), // Keep it optional
    accessUrl: z.string().optional(), // Keep it optional
    authenticator: z.string().optional(), // Keep it optional
    warehouse: z.string().optional(), // Keep it optional
    projectId: z.string().optional(), // Keep it optional
    keyFilename: z.string().optional(), // Keep it optional
    table: z.string().optional(), // Keep it optional
  }),
  internal_credentials: z.object({
    url: z.string(),
    database: z.string(),
    username: z.string(),
    password: z.string()
  }),
  internal_warehouse: z.string(),
  link_type: z.enum(['clickhouse', 'snowflake', 'bigquery', 'postgres', 'redshift'])
});


async function extractDataFromInternalWarehouse(internalCredentials: InternalCredentials, internalWarehouse: string) {
  const clickhouseClient = new ClickhouseClient({
    url: internalCredentials.url,
    port: 8123, // Default port for ClickHouse
    database: internalCredentials.database,
    user: internalCredentials.username,
    password: internalCredentials.password,
  }, {
    // Additional options can be configured here
    defaultResponseFormat: 'JSON', // Ensure this option is valid in the library
  });

  // Execute a query to extract data
  const result = await clickhouseClient.query(`SELECT * FROM ${internalWarehouse}`);
  
  // Return only the data array
  return result.data; // Ensure this is an array
}

async function loadDataIntoLinkWarehouse(linkCredentials: LinkCredentials, linkType: string, data: any[]) {
  switch (linkType) {
    case 'clickhouse':
      const connection = {
        url: linkCredentials.host, // Required, should not be undefined
        port: linkCredentials.port ?? 8123, // Default port if necessary
        database: linkCredentials.database, // Required
        user: linkCredentials.username, // Required
        password: linkCredentials.password, // Required
      };
    
      const options = {
        defaultResponseFormat: 'JSON', // Adjust as necessary
      };
    
      const clickhouseClient = new ClickhouseClient(connection, options);
    
      await clickhouseClient.insert(linkCredentials.database, data);
      break;
    
      case 'snowflake':
        const snowflakeConnection = snowflake.createConnection({
          account: linkCredentials.account ?? '', // Default to empty string if undefined
          username: linkCredentials.username,
          password: linkCredentials.password,
          warehouse: linkCredentials.warehouse ?? '', // Default to empty string if undefined
          database: linkCredentials.database,
          schema: linkCredentials.schema ?? '' // Default to empty string if undefined
      });      
      
        // Connect to Snowflake using a Promise
        await new Promise((resolve, reject) => {
          snowflakeConnection.connect((err, conn) => {
            if (err) {
              return reject(new Error(`Connection failed: ${err.message}`));
            }
            resolve(conn); // Successfully connected
          });
        });
      
        // Now execute the SQL statement
        await new Promise((resolve, reject) => {
          snowflakeConnection.execute({
            sqlText: `INSERT INTO ${linkCredentials.database} VALUES (${data.map(() => '?').join(', ')})`,
            binds: data.flat(),
            complete: (err, stmt, rows) => {
              if (err) {
                return reject(new Error(`Execution failed: ${err.message}`));
              }
              resolve(rows); // Successfully executed
            }
          });
        });
        break;
        case 'bigquery':
          // Ensure required properties are defined
          if (!linkCredentials.projectId || !linkCredentials.keyFilename || !linkCredentials.database || !linkCredentials.table) {
            throw new Error("Missing required BigQuery credentials: projectId, keyFilename, database, or table.");
          }
        
          const bigqueryClient = new BigQuery({
            projectId: linkCredentials.projectId, // Now guaranteed to be a string
            keyFilename: linkCredentials.keyFilename // Now guaranteed to be a string
          });
        
          await bigqueryClient.dataset(linkCredentials.database).table(linkCredentials.table).insert(data);
          break;        
        case 'postgres':
          const postgresClient = new PostgresClient({
            host: linkCredentials.host,
            database: linkCredentials.database,
            user: linkCredentials.username,
            password: linkCredentials.password
          });
          await postgresClient.connect();
          await postgresClient.query(`INSERT INTO ${linkCredentials.database} VALUES (${data.map(() => '?').join(', ')})`, data.flat());
          await postgresClient.end();
          break;
    default:
      throw new Error('Unsupported link type');
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('Received request body:', body);
    
    body.link_type = body.link_type.toLowerCase();
    // Validate request body
    const validatedData = requestSchema.parse(body);

    const supabase = createClient();

    // Insert sync record
    const { data: syncData, error: syncError } = await supabase
      .from('syncs')
      .insert({
        organization: validatedData.organization,
        internal_warehouse: validatedData.internal_warehouse,
        link_type: validatedData.link_type,
        internal_credentials: validatedData.internal_credentials,
        link_credentials: validatedData.link_credentials,
        status: 'pending'
      })
      .select()
      .single();

    if (syncError) {
      console.error('Error inserting sync data:', syncError);
      return NextResponse.json({ success: false, error: 'Failed to insert sync data' }, { status: 500 });
    }

    // Extract data from internal warehouse
    const extractedData = await extractDataFromInternalWarehouse(body.internal_credentials, validatedData.internal_warehouse);

    // Ensure extractedData is an array before passing it
    if (!Array.isArray(extractedData)) {
      throw new Error("Extracted data is not in expected array format.");
    }

    // Load data into link warehouse
    await loadDataIntoLinkWarehouse(body.link_credentials, validatedData.link_type, extractedData);
    
    // Update sync record status to completed
    const { error: updateError } = await supabase
      .from('syncs')
      .update({ status: 'completed' })
      .eq('id', syncData.id);

    if (updateError) {
      console.error('Error updating sync data:', updateError);
      return NextResponse.json({ success: false, error: 'Failed to update sync data' }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 200 });

  } catch (error) {
    console.error('ETL process failed:', error);
    if (error instanceof Error) {
      console.error('Error stack:', error.stack);
      return NextResponse.json({ success: false, error: `ETL process failed: ${error.message}` }, { status: 500 });
    }
    return NextResponse.json({ success: false, error: 'An unknown error occurred' }, { status: 500 });
  }
}

