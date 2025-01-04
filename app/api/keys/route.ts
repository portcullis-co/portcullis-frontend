import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { auth } from '@clerk/nextjs/server';
import { encrypt, decrypt } from '@/lib/encryption';
import * as crypto from "crypto";

const allowedOrigins = [
  'http://localhost:3000',
  'https://app.runportcullis.co/',
  'https://app.runportcullis.co/api/keys',
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
  const supabase = createClient(); // TODO: Maybe use RDS instead
  const { searchParams } = new URL(request.url);
  const organizationId = searchParams.get('organizationId');

  // Handle fetch by organizationId
  if (organizationId) {
    try {
      const { data: api_key, error } = await supabase // TODO: Maybe use RDS instead
        .from('organizations')
        .select('api_key')
        .eq('id', organizationId);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ warehouses: api_key });
    } catch (error) {
      console.error('Error processing warehouses:', error);
      return NextResponse.json({ error: 'Failed to process warehouses' }, { status: 500 });
    }
  }

  // If neither id nor organizationId is provided
  return NextResponse.json({ error: 'Either id or organizationId is required' }, { status: 400 });
}