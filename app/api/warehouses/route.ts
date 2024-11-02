import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { auth } from '@clerk/nextjs/server';
import { encrypt, decrypt } from '@/lib/encryption';

const allowedOrigins = [
  'http://localhost:3000',
  'https://portcullis-app.fly.dev',
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
  const supabase = createClient();
  const { searchParams } = new URL(request.url);
  const organizationId = searchParams.get('organizationId');
  const id = searchParams.get('id');

  // Handle fetch by ID
  if (id) {
    try {
      const { data, error } = await supabase
        .from('warehouses')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      if (!data) {
        return NextResponse.json({ error: 'Warehouse not found' }, { status: 404 });
      }

      // Decrypt credentials before sending response
      const decryptedWarehouse = {
        ...data,
        credentials: data.credentials ? await decrypt(data.credentials) : null
      };

      return NextResponse.json({ warehouse: decryptedWarehouse });
    } catch (error) {
      console.error('Error fetching warehouse:', error);
      return NextResponse.json({ error: 'Failed to fetch warehouse' }, { status: 500 });
    }
  }

  // Handle fetch by organizationId
  if (organizationId) {
    try {
      const { data: warehouses, error } = await supabase
        .from('warehouses')
        .select('*')
        .eq('organization', organizationId);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      // Decrypt credentials for each warehouse
      const decryptedWarehouses = await Promise.all(
        warehouses.map(async (warehouse) => ({
          ...warehouse,
          credentials: warehouse.credentials ? await decrypt(warehouse.credentials) : null
        }))
      );

      return NextResponse.json({ warehouses: decryptedWarehouses });
    } catch (error) {
      console.error('Error processing warehouses:', error);
      return NextResponse.json({ error: 'Failed to process warehouses' }, { status: 500 });
    }
  }

  // If neither id nor organizationId is provided
  return NextResponse.json({ error: 'Either id or organizationId is required' }, { status: 400 });
}

export async function POST(request: Request) {
  const supabase = createClient();
  const { userId, orgId } = auth();
  const slug = auth().orgSlug;
  
  if (!userId || !orgId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    const { credentials, table_name } = await request.json();
    
    // Encrypt credentials before storing
    const encryptedCredentials = await encrypt(credentials);
    
    const { data, error } = await supabase
      .from('warehouses')
      .insert({ 
        credentials: encryptedCredentials, 
        organization: orgId, 
        slug, 
        table_name 
      })
      .select()
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ error: 'Failed to insert warehouse' }, { status: 500 });
    }

    // Decrypt credentials before sending response
    const decryptedData = { 
      ...data, 
      credentials: await decrypt(data.credentials) 
    };

    return NextResponse.json({ data: decryptedData });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const supabase = createClient();
  const { id } = await request.json();

  const { error } = await supabase
    .from('warehouses')
    .delete()
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}