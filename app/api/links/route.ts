import { NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { createClient } from '@/lib/supabase/server';
import { auth } from '@clerk/nextjs/server';

export async function POST(request: Request) {
  try {
    const supabase = createClient();
    const { userId, orgId } = auth();
    const { type, logo, redirectUrl, internal_warehouse } = await request.json();

    const invite_token = nanoid(10);

    const { data, error } = await supabase
      .from('links')
      .insert({ 
        invite_token: invite_token, 
        internal_warehouse: internal_warehouse, 
        type: type, 
        logo: logo, 
        redirect_url: redirectUrl, 
        organization: orgId // This will now work with Clerk's organization ID format
      })

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
}

export async function GET() {
  const supabase = createClient();
  

  const { data, error } = await supabase
    .from('links')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function DELETE(request: Request) {
  try {
    const supabase = createClient();
    const { id } = await request.json();

    const { error } = await supabase
      .from('links')
      .delete()
      .match({ id });

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