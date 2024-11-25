import { Webhook } from 'svix'
import { headers } from 'next/headers'
import { WebhookEvent } from '@clerk/nextjs/server'
import { generateApiKey } from '@/lib/generateApiKey'
import { createClient } from '@supabase/supabase-js'
import { createClerkClient } from '@clerk/backend'
import axios from 'axios';

// Initialize Clerk
// Initialize Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

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
      type: 'corporate',
      currency: 'USD',
      billing_email: email_addresses?.[0] ?? 'billing@example.com',
      available_payment_methods: ['card', 'transfer'],
      status: 'inactive',
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

  let evt: WebhookEvent
  
  try {
    evt = wh.verify(body, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    }) as WebhookEvent;
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
      // Svix API endpoint and key (ensure these are set in your environment variables)
      const SVIX_API_URL = 'https://api.us.svix.com/api/v1/app/';
      const SVIX_API_KEY = process.env.SVIX_API_KEY;  // Ensure this is set in your .env
  
      console.log(`Organization created: ${evt.data.id}`);
  
      const { id, created_by, name, slug } = evt.data;
  
      // Generate API Key
      const apiKey = await generateApiKey(id);
  
      // Create Hyperline customer
      const hyperlineCustomer = await createHyperlineCustomer(
        name,
        id,
        created_by,
      );
  
      const svix_app = await axios.post(
        SVIX_API_URL,
        {
          name: `${evt.data.name}_webhook`,
          description: `App for ${evt.data.name}`,
        },
        {
          headers: {
            'Authorization': `Bearer ${SVIX_API_KEY}`,
            'Content-Type': 'application/json',
          }
        }
      );
      
      // Insert the organization into Supabase
      const { data, error } = await supabase
        .from('organizations')
        .insert([
          {
            name,
            api_key: apiKey,
            hyperline_id: hyperlineCustomer.id,
            created_by: created_by,
            svix_id: svix_app.data.id,  // Assuming `svix_app.data.id` is the correct value
          }
        ]);
  
      if (error) {
        console.error('Error inserting into Supabase:', error);
        return new Response('Error: Failed to insert organization into Supabase', {
          status: 500,
        });
      }
  
      console.log('Organization successfully created in Supabase:', data);
      
      // Only return after all the operations are completed
      return new Response('Webhook received', { status: 200 });
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