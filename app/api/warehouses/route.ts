import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { auth } from '@clerk/nextjs/server';
import { encrypt, decrypt } from '@/lib/encryption';

export async function GET(request: Request) {
  const supabase = createClient();
  const { searchParams } = new URL(request.url);
  const organizationId = searchParams.get('organizationId');

  if (!organizationId) {
    return NextResponse.json({ error: 'Organization ID is required' }, { status: 400 });
  }

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