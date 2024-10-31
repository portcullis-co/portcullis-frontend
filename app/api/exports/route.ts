import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { auth } from '@clerk/nextjs/server';
import { validateApiKey } from '@/lib/validateApiKey';
import { client } from "@/lib/trigger";
import { clickhouseToSnowflakeSync } from "@/app/trigger/trigger-export";

export async function OPTIONS(request: Request) {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Max-Age': '86400',
    },
  });
}

export async function POST(request: Request) {
  const response = NextResponse.next();
  
  try {
    const supabase = createClient();
    const apiKey = request.headers.get('x-api-key');
    const body = await request.json();
    
    // Validate API key if present
    if (apiKey) {
      const { isValid, organizationId } = await validateApiKey(apiKey);
      if (!isValid) {
        return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
      }
      body.organization = organizationId;
    } else {
      // Fall back to Clerk auth
      const { userId, orgId } = auth();
      if (!orgId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      body.organization = orgId;
    }

    const { 
      internal_warehouse,
      destination_type,
      destination_name,
      credentials,
      scheduled_at 
    } = body;

    // Validate required fields
    if (!internal_warehouse || !destination_type || !destination_name) {
      return NextResponse.json({ 
        error: 'Missing required fields' 
      }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('exports')
      .insert({
        organization: body.organization,
        internal_warehouse,
        destination_type,
        destination_name,
        credentials,
        scheduled_at
      })
      .select()
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Trigger the export task
    if (data) {
      await client.sendEvent({
        name: "clickhouse-snowflake-sync",
        payload: {
          sourceCredentials: internal_warehouse.credentials,
          destinationCredentials: credentials,
          query: body.query || "SELECT * FROM your_table",
          tableName: destination_name
        }
      });
    }

    return NextResponse.json(data, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': '*',
      }
    });
  } catch (error) {
    console.error('POST endpoint error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'An unexpected error occurred'
    }, { status: 500 });
  }
}

export async function GET(request: Request) {
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
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': '*',
        },
      });
    }

    return new NextResponse(JSON.stringify(data || []), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': '*',
      },
    });
  } catch (error) {
    console.error('GET endpoint error:', error);
    const response = new NextResponse(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': '*',
      },
    });
    return response;
  }
}

export async function DELETE(request: Request) {
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

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
}