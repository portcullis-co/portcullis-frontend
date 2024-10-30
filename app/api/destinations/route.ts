import { NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { createClient } from '@/lib/supabase/server';
import { auth } from '@clerk/nextjs/server';
import { Resend } from 'resend';
import { z } from 'zod';
import { encrypt } from '@/lib/encryption';
import { DateTimePicker } from '@/components/ui/datetime-picker';

type Destination = {
  id: string;
  url: string;
  createdAt: string; 
  imageUrl: string;
  internal_warehouse: string;
  recipient_email?: string;
  organization?: string;
  credentials?: string;
  destination_name?: string;
};

const resend = new Resend('re_CAiLvhVL_Hq6K3xEkCsqMAe77JS1m5Gdm');

export async function POST(request: Request) {
  try {
    const supabase = createClient();
    const { userId, orgId } = auth();
    
    // Add logging to debug the request body
    const body = await request.json();
    console.log('Request body:', body);

    const { 
      organization,
      internal_warehouse,
      destination_type,
      destination_name,
      credentials,
      scheduled_at 
    } = body;

    // Validate required fields
    if (!organization || !internal_warehouse || !destination_type || !destination_name) {
      console.error('Missing required fields:', { organization, internal_warehouse, destination_type, destination_name });
      return NextResponse.json({ 
        error: 'Missing required fields' 
      }, { status: 400 });
    }

    // Add logging for the insert operation
    console.log('Inserting destination:', {
      organization,
      internal_warehouse,
      destination_type,
      destination_name,
      credentials,
      scheduled_at
    });

    const { data, error } = await supabase
      .from('destinations')
      .insert({
        organization,
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

    console.log('Successfully created destination:', data);
    return NextResponse.json(data);
  } catch (error) {
    console.error('POST endpoint error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'An unexpected error occurred',
      details: error 
    }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const supabase = createClient();
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId');

    if (!organizationId) {
      return NextResponse.json({ error: 'Unauthorized: No organization ID' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('destinations')
      .select('*')  // Simplified select statement
      .eq('organization', organizationId);

    if (error) {
      console.error('Supabase query error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json([], { status: 200 }); // Return empty array if no data
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('GET endpoint error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
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
      .from('destinations')
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