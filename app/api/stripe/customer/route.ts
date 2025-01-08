import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { auth } from '@clerk/nextjs/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia'
});

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
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { userId, orgId } = auth();

  if (!userId || !orgId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Get the organization's Stripe customer ID
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('stripe_customer_id')
      .eq('id', orgId)
      .single();

    if (orgError || !org?.stripe_customer_id) {
      console.error('Supabase error:', orgError);
      return NextResponse.json({ error: 'Failed to retrieve customer data' }, { status: 500 });
    }

    // Fetch the customer data from Stripe
    const customer = await stripe.customers.retrieve(org.stripe_customer_id);

    if (!customer || customer.deleted) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    // You can customize what customer data you want to return
    const customerData = {
      id: customer.id,
      email: customer.email,
      name: customer.name,
      metadata: customer.metadata,
      created: customer.created,
      // Add any other relevant customer fields you need
    };

    return NextResponse.json({ data: customerData });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { searchParams } = new URL(request.url);
  const organizationId = searchParams.get('organizationId');

  if (!organizationId) {
    return NextResponse.json({ error: 'OrganizationId is required' }, { status: 400 });
  }

  try {
    // Get the organization's Stripe customer ID
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('stripe_customer_id')
      .eq('id', organizationId)
      .single();

    if (orgError || !org?.stripe_customer_id) {
      console.error('Supabase error:', orgError);
      return NextResponse.json({ error: 'Failed to retrieve customer data' }, { status: 500 });
    }

    // Fetch customer's subscription data from Stripe
    const subscriptions = await stripe.subscriptions.list({
      customer: org.stripe_customer_id,
      limit: 1,
      status: 'active',
    });

    const customerData = {
      stripe_customer_id: org.stripe_customer_id,
      has_active_subscription: subscriptions.data.length > 0,
      subscription_status: subscriptions.data[0]?.status || null,
      // Add any other relevant subscription fields you need
    };

    return NextResponse.json({ data: customerData });
  } catch (error) {
    console.error('Error processing customer data:', error);
    return NextResponse.json({ error: 'Failed to process customer data' }, { status: 500 });
  }
}