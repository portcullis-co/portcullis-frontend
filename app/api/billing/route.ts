import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { auth } from '@clerk/nextjs/server';

const allowedOrigins = [
  'http://localhost:3000',
  'https://app.runportcullis.co/',
  'https://app.runportcullis.co/api/billing',
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
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { userId, orgId } = auth();
  
    if (!userId || !orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  
    const { data, error } = await supabase
      .from('organizations')
      .select('stripe_customer_id')
      .eq('id', orgId)
      .single();
  
    try {
      const stripe = {
        method: 'POST',
        headers: {
          Authorization: 'Bearer prod_e08272d6a532626b895c4673fc9133ce21115a88c66989e472b9aba8ba003259',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          customer_id: data?.stripe_customer_id
        })
      };
  
      const response = await fetch('https://api.hyperline.co/v1/integrations/components/token', stripe);
      const responseData = await response.json();
      console.log(responseData);
  
      if (error) {
        console.error('Supabase error:', error);
        return NextResponse.json({ error: 'Failed to retrieve data' }, { status: 500 });
      }
  
      return NextResponse.json({ data: responseData });
    } catch (error) {
      console.error('Unexpected error:', error);
      return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
    }
  }

export async function GET(request: Request) {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!); // TODO: Maybe use RDS instead
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId');
  
    // Handle fetch by organizationId
    if (organizationId) {
      try {
        const { data: hyperline_id, error } = await supabase // TODO: Maybe use RDS instead
          .from('organizations')
          .select('hyperline_id')
          .eq('id', organizationId);
  
        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
  
        return NextResponse.json({ data: hyperline_id });
      } catch (error) {
        console.error('Error processing warehouses:', error);
        return NextResponse.json({ error: 'Failed to process warehouses' }, { status: 500 });
      }
    }
  
    // If neither id nor organizationId is provided
    return NextResponse.json({ error: 'Either id or organizationId is required' }, { status: 400 });
  }