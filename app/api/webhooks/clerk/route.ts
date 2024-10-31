import { Webhook } from 'svix'
import { headers } from 'next/headers'
import { WebhookEvent } from '@clerk/nextjs/server'
import { createClient } from '@/lib/supabase/server'
import crypto from 'crypto'
import { clerkClient } from '@clerk/nextjs/server'

const supabase = createClient()

export async function POST(req: Request) {
  // You can find this in the Clerk Dashboard -> Webhooks -> choose the endpoint
  const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET

  if (!WEBHOOK_SECRET) {
    throw new Error('Please add WEBHOOK_SECRET from Clerk Dashboard to .env or .env.local')
  }

  // Get the headers
  const headerPayload = headers()
  const svix_id = headerPayload.get('svix-id')
  const svix_timestamp = headerPayload.get('svix-timestamp')
  const svix_signature = headerPayload.get('svix-signature')

  // If there are no headers, error out
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response('Error occured -- no svix headers', {
      status: 400,
    })
  }

  // Get the body
  const payload = await req.json()
  const body = JSON.stringify(payload)

  // Create a new Svix instance with your secret.
  const wh = new Webhook(WEBHOOK_SECRET)

  let evt: WebhookEvent

  // Verify the payload with the headers
  try {
    evt = wh.verify(body, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    }) as WebhookEvent
  } catch (err) {
    console.error('Error verifying webhook:', err)
    return new Response('Error occured', {
      status: 400,
    })
  }

  // Handle different webhook events
  switch (evt.type) {
    case 'organization.created':
      const org = evt.data;
      const apiKey = crypto.randomUUID();
      
      await supabase.from('organizations').upsert({
        id: org.id,
        name: org.name,
        created_at: org.created_at,
        api_key: apiKey,
        slug: org.slug,
        logo: org.image_url,
      });

      // Using Clerk SDK instead of fetch
      await clerkClient.organizations.updateOrganizationMetadata(org.id, {
        publicMetadata: {
          api_key: apiKey,
        },
      });
      break;

    case 'user.created':
      const user = evt.data;
      await supabase.from('users').insert({
        id: user.id,
        email: user.email_addresses[0]?.email_address,
        first_name: user.first_name,
        last_name: user.last_name,
        created_at: user.created_at,
        // Add any other fields you want to store
      });
      break;
  }

  return new Response('', { status: 200 })
}