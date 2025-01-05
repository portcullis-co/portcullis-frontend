import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { auth } from '@clerk/nextjs/server';
import { encrypt, decrypt } from '@/lib/encryption';

const allowedOrigins = [
  'http://localhost:3000',
  'https://app.runportcullis.co/',
  'https://app.runportcullis.co/api/instances',
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

export async function GET(request: Request) {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!); // TODO: Maybe use RDS instead
  const { searchParams } = new URL(request.url);
  const { userId, orgId } = auth();
  const organizationId = searchParams.get('organizationId');
  // Handle fetch by ID

  // Handle fetch by organizationId
  if (userId) {
    try {
      const { data: instances, error } = await supabase // TODO: Maybe use RDS instead
        .from('instances')
        .select('*')
        .eq('user', userId);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ instances: instances });
    } catch (error) {
      console.error('Error processing warehouses:', error);
      return NextResponse.json({ error: 'Failed to process warehouses' }, { status: 500 });
    }
  }

  // If neither id nor organizationId is provided
  return NextResponse.json({ error: 'Either id or organizationId is required' }, { status: 400 });
}

export async function POST(request: Request) {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { userId, orgId } = auth();
  const slug = auth().orgSlug;
  const { searchParams } = new URL(request.url);
  const organizationId = searchParams.get('organizationId');
  
  if (!userId || !orgId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    const { portal, organizationId, source, credentials } = await request.json();
    // Encrypt credentials before storing
    
    const { data, error } = await supabase
      .from('instances')
      .insert({ 
        portal: portal,
        organization: organizationId,
        source: source,
      })
      .select()
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ error: 'Failed to insert warehouse' }, { status: 500 });
    }

    // Don't decrypt here since we just encrypted it
    return NextResponse.json({ data });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!); // TODO: Maybe use RDS instead
  const { id } = await request.json();

  const { error } = await supabase
    .from('instances')
    .delete()
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}