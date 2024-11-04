import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { auth } from '@clerk/nextjs/server';
import { validateApiKey } from '@/lib/validateApiKey';
import { encrypt, decrypt } from '@/lib/encryption';
import type { ClickhouseCredentials } from '@/lib/common/types/clickhouse.d';
import { serve } from "inngest/next";
import { clickhouseToSnowflakeSync } from "@/app/inngest/functions/clickhouseToSnowflakeSync"; // Create this file
import { inngest } from "@/app/inngest/client";


const allowedOrigins = [
  'http://localhost:3000',
  'https://portcullis-app.fly.dev',
  'https://portcullis-app.fly.dev/api/exports',
  'https://app.inngest.com/'
];

function corsHeaders(origin: string | null) {
  const headers = new Headers();
  
  if (origin && allowedOrigins.includes(origin)) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key');
    headers.set('Access-Control-Allow-Credentials', 'true');
  }
  
  return headers;
}

export async function OPTIONS(request: Request) {
  const origin = request.headers.get('origin');
  const headers = corsHeaders(origin);
  
  return new NextResponse(null, {
    status: 204,
    headers,
  });
}

export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  const headers = corsHeaders(origin);
  
  try {
    // Log all headers for debugging
    console.log('Request headers:', Object.fromEntries(request.headers.entries()));
    
    const supabase = createClient();
    const apiKey = request.headers.get('x-api-key');
    console.log('Received API Key:', apiKey); // Be careful not to log actual keys in production
    
    const body = await request.json();
    console.log('Request body:', body);
    
    // Validate API key if present
    if (apiKey) {
      const { isValid, organizationId } = await validateApiKey(apiKey);
      console.log('API Key validation:', { isValid, organizationId }); // Debug log
      if (!isValid) {
        return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
      }
      body.organization = organizationId;
    } else {
      // Fall back to Clerk auth
      const { userId, orgId } = auth();
      console.log('Clerk auth:', { userId, orgId }); // Debug log
      if (!orgId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      body.organization = orgId;
    }

    const { 
      internal_warehouse,
      internal_credentials,
      destination_type,
      tenancy_column,
      tenant_id,
      destination_name,
      table,
      credentials,
      scheduled_at 
    } = body;

    // Validate required fields
    if (!internal_warehouse || !destination_type || !destination_name || !table || !credentials || !internal_credentials) {
      return NextResponse.json({ 
        error: 'Missing required fields' 
      }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('exports')
      .insert({
        organization: body.organization,
        internal_warehouse: internal_warehouse,
        destination_type: destination_type,
        destination_name: destination_name,
        table: table,
        scheduled_at: scheduled_at
      })
      .select()
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Trigger the export task
    if (data) {
      try {
        console.log('Fetching warehouse with ID:', internal_warehouse);

        // First fetch the warehouse credentials from Supabase
        const { data: warehouseData, error: warehouseError } = await supabase
          .from('warehouses')
          .select('credentials, id')
          .eq('id', internal_warehouse)
          .single();

        if (warehouseError || !warehouseData) {
          throw new Error(`Failed to fetch warehouse credentials: ${warehouseError?.message || 'No data found'}`);
        }

        // Decrypt the internal warehouse credentials
        const decryptedCredentials = await decrypt(warehouseData.credentials);

        // Add error handling for client initialization
        if (!process.env.TRIGGER_SECRET_KEY) {
          throw new Error('TRIGGER_SECRET_KEY environment variable is not set');
        }

        const payload = {
          internal_warehouse: internal_warehouse,
          internal_credentials: decryptedCredentials,
          destination_credentials: credentials,
          organization: body.organization,
          query: `SELECT * FROM ${table} WHERE ${tenancy_column} = '${tenant_id}'`,
          destination_type: destination_type,
          table: table,
          scheduled_at: scheduled_at
        };

        // Send event to trigger Inngest function
        switch (destination_type) {
          case 'snowflake':
            await inngest.send({
              name: "event/clickhouse-to-snowflake-sync",
              data: payload,
            });
            break;
          case 'bigquery':
            await inngest.send({
              name: "event/clickhouse-to-bigquery-sync",
              data: payload,
            });
            break;
          case 'redshift':
            await inngest.send({
              name: "event/clickhouse-to-redshift-sync",
              data: payload,
            });
            break;
        }

        console.log("Successfully scheduled export task");
      } catch (error) {
        console.error('Trigger event error:', error);
        return NextResponse.json({ 
          error: 'Failed to schedule export task',
          details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500, headers });
      }
    }

    return NextResponse.json(data, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error('POST endpoint error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'An unexpected error occurred'
    }, { 
      status: 500,
      headers,
    });
  }
}

export async function GET(request: Request) {
  const origin = request.headers.get('origin');
  const headers = corsHeaders(origin);
  
  try {
    const supabase = createClient();
    const apiKey = request.headers.get('x-api-key');
    let organizationId;

    if (apiKey) {
      const { isValid, organizationId: orgId } = await validateApiKey(apiKey);
      if (!isValid) {
        return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
      }
      organizationId = orgId;
    } else {
      const { searchParams } = new URL(request.url);
      organizationId = searchParams.get('organizationId');
      
      if (!organizationId) {
        return NextResponse.json({ error: 'Unauthorized: No organization ID' }, { status: 401 });
      }
    }

    const { data, error } = await supabase
      .from('exports')
      .select('*')
      .eq('organization', organizationId);

    if (error) {
      return new NextResponse(JSON.stringify({ error: error.message }), {
        status: 500,
        headers,
      });
    }

    return new NextResponse(JSON.stringify(data || []), {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error('GET endpoint error:', error);
    const response = new NextResponse(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers,
    });
    return response;
  }
}

export async function DELETE(request: Request) {
  const origin = request.headers.get('origin');
  const headers = corsHeaders(origin);
  
  try {
    const supabase = createClient();
    const { userId, orgId } = auth();
    const { id } = await request.json();

    if (!orgId) {
      return NextResponse.json({ error: 'Unauthorized: No organization ID' }, { status: 401 });
    }

    const { error } = await supabase
      .from('exports')
      .delete()
      .match({ id, organization: orgId });

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true }, {
      headers,
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'An unexpected error occurred' }, { 
      status: 500,
      headers,
    });
  }
}