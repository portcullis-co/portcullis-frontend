import { Webhook } from 'svix'
import { headers } from 'next/headers'
import { WebhookEvent } from '@clerk/nextjs/server'
import { generateApiKey } from '@/lib/generateApiKey'
import { createClient } from '@supabase/supabase-js'
import { createClerkClient } from '@clerk/backend'

// Initialize Clerk
const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! })

// Initialize Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Type definition for Organization event data
interface OrganizationWebhookEvent {
  data: {
    id: string;
    name: string;
    created_by: string;
    domain?: string;
    email_addresses?: string[];
  };
  object: 'event';
  type: 'organization.created' | 'organization.deleted' | string;
  id: string;
}

// Function to upload logo and return URL
async function uploadLogo(domain: string) {
  const logoUrl = `https://img.logo.dev/${domain}?token=pk_Bm3yO9a1RZumHNuIQJtxqg`;
  const logoResponse = await fetch(logoUrl);
  const logoBlob = await logoResponse.blob();
  return logoBlob;
}

// Moved the createHyperlineCustomer function outside the switch case
async function createHyperlineCustomer(
  name: string,
  id: string,
  created_by: string,
  email_addresses?: string[]
) {
  const response = await fetch('https://api.hyperline.co/v1/customers', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.HYPERLINE_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: name,
      type: 'business',
      currency: 'USD',
      billing_email: email_addresses?.[0] ?? 'billing@example.com',
      available_payment_methods: ['card', 'transfer'],
      status: 'active',
      invoice_reminders_enabled: true,
      metadata: {
        clerk_organization_id: id,
        created_by: created_by,
      }
    })
  });

  return await response.json();
}

export async function POST(req: Request) {
  const SIGNING_SECRET = process.env.SIGNING_SECRET;

  if (!SIGNING_SECRET) {
    throw new Error('Error: Please add SIGNING_SECRET from Clerk Dashboard to .env or .env.local');
  }

  const wh = new Webhook(SIGNING_SECRET);

  // Get headers
  const headerPayload = headers();
  const svix_id = headerPayload.get('svix-id');
  const svix_timestamp = headerPayload.get('svix-timestamp');
  const svix_signature = headerPayload.get('svix-signature');

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response('Error: Missing Svix headers', {
      status: 400,
    });
  }

  const payload = await req.json();
  const body = JSON.stringify(payload);

  let evt: OrganizationWebhookEvent;

  try {
    evt = wh.verify(body, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    }) as OrganizationWebhookEvent;
  } catch (err) {
    console.error('Error: Could not verify webhook:', err);
    return new Response('Error: Verification error', {
      status: 400,
    });
  }

  const { id } = evt.data;
  const eventType = evt.type;
  console.log(`Received webhook with ID ${id} and event type of ${eventType}`);

  switch (eventType) {
    case 'organization.created': {
      console.log(`Organization created: ${id}`);

      const { name, created_by, email_addresses } = evt.data;

      // Generate API Key
      const apiKey = await generateApiKey(id);

      // Create Hyperline customer
      const hyperlineCustomer = await createHyperlineCustomer(
        name,
        id,
        created_by,
        email_addresses
      );

      // Insert the organization into Supabase
      const { data, error } = await supabase
        .from('organizations')
        .insert([
          {
            name,
            apiKey,
            hyperline_id: hyperlineCustomer.id,
            created_by: created_by,
            svix_id: svix_id,
          }
        ]);

      if (error) {
        console.error('Error inserting into Supabase:', error);
        return new Response('Error: Failed to insert organization into Supabase', {
          status: 500,
        });
      }

      console.log('Organization successfully created in Supabase:', data);
      break;
    }

    case 'organization.deleted':
      console.log(`Organization deleted: ${id}`);
      // Handle organization deletion
      break;

    default:
      console.log(`Unhandled event type: ${eventType}`);
      break;
  }

  return new Response('Webhook received', { status: 200 });
}