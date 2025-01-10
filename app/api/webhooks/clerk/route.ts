import { Webhook } from 'svix'
import { headers } from 'next/headers'
import { WebhookEvent } from '@clerk/nextjs/server'
import { generateApiKey } from '@/lib/generateApiKey'
import { createClient } from '@supabase/supabase-js'
import { createClerkClient } from '@clerk/backend'
import axios from 'axios'
import Stripe from 'stripe'
import { 
  LambdaClient, 
  CreateFunctionCommand,
  CreateFunctionCommandInput,
  CreateFunctionUrlConfigCommand
} from '@aws-sdk/client-lambda'

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia'
})

// Initialize AWS Lambda client
const lambda = new LambdaClient({ 
  region: 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
  }
})

// Initialize Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  try {
    const CLERK_WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

    if (!CLERK_WEBHOOK_SECRET) {
      throw new Error('Error: Please add CLERK_WEBHOOK_SECRET from Clerk Dashboard to .env or .env.local');
    }

    const wh = new Webhook(CLERK_WEBHOOK_SECRET);

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
    
    // Validate payload has required fields
    if (!payload || typeof payload !== 'object') {
      return new Response('Error: Invalid payload', { status: 400 });
    }

    const { eventType, data } = payload;

    if (!eventType) {
      return new Response('Error: Missing eventType in payload', { status: 400 });
    }

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

    switch (eventType) {
      case 'organization.created': {
        const { id, created_by, name, slug } = data

        if (!id || !created_by || !name || !slug) {
          return new Response('Error: Missing required fields in organization data', { 
            status: 400 
          });
        }
        
        try {
          // 1. Create Stripe customer
          const stripeCustomer = await stripe.customers.create({
            name: name,
            metadata: {
              organizationId: id
            }
          })

          // 2. Generate API Key
          const apiKey = await generateApiKey(id)

          // 3. Create AWS Lambda function
          const functionName = `${id}-runners`
          const lambdaParams = {
            FunctionName: functionName,
            PackageType: 'Image',
            Code: {
              ImageUri: '084375570866.dkr.ecr.us-east-1.amazonaws.com/portcullis/api:latest'
            },
            Role: process.env.LAMBDA_EXECUTION_ROLE!,
            MemorySize: 1024,
            Timeout: 30,
            Environment: {
              Variables: {
                ORGANIZATION_ID: id
              }
            }
          }

          // Create the Lambda function
          const createFunctionCommand = new CreateFunctionCommand(lambdaParams as CreateFunctionCommandInput)
          await lambda.send(createFunctionCommand)

          // Create function URL configuration
          const urlConfig = new CreateFunctionUrlConfigCommand({
            FunctionName: functionName,
            AuthType: 'NONE',
            Cors: {
              AllowCredentials: true,
              AllowHeaders: ['*'],
              AllowMethods: ['*'],
              AllowOrigins: ['*'],
              MaxAge: 86400
            }
          })

          // Create the function URL
          const urlResponse = await lambda.send(urlConfig)
          const lambdaUrl = urlResponse.FunctionUrl

          // 4. Insert into Supabase Organizations table
          const { data: orgData, error: orgError } = await supabase
            .from('organizations')
            .insert([
              {
                slug: slug,
                name: name,
                stripe_customer_id: stripeCustomer.id,
                created_by
              }
            ])
            .select('id')
            .single()

          if (orgError) throw orgError

          // 5. Insert into Supabase Portals table
          const { error: portalError } = await supabase
            .from('portals')
            .insert([
              {
                organization: orgData.id,
                api_key: apiKey,
                company: name,
                lambda_url: lambdaUrl
              }
            ])

          if (portalError) throw portalError

          return new Response('Organization created successfully', { status: 200 })
        } catch (error) {
          console.error('Error processing organization creation:', error)
          return new Response('Error processing organization creation', { 
            status: 500,
            statusText: error instanceof Error ? error.message : 'Unknown error'
          })
        }
      }

      case 'organization.deleted': {
        const { id } = data;
        if (!id) {
          return new Response('Error: Missing organization ID', { status: 400 });
        }
        
        try {
          // Add your organization deletion logic here
          console.log(`Organization deleted: ${id}`);
          return new Response('Organization deletion processed', { status: 200 });
        } catch (error) {
          console.error('Error processing organization deletion:', error);
          return new Response('Error processing organization deletion', { 
            status: 500,
            statusText: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      default:
        console.log(`Unhandled event type: ${eventType}`);
        return new Response(`Unhandled event type: ${eventType}`, { status: 400 });
    }
  } catch (error) {
    console.error('Unexpected error in webhook handler:', error);
    return new Response('Internal server error', { 
      status: 500,
      statusText: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}