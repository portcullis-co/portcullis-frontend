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
  AddPermissionCommand,
  CreateFunctionUrlConfigCommand 
} from '@aws-sdk/client-lambda'

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia'
})

// Initialize AWS Lambda client
const lambdaClient = new LambdaClient({ 
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

async function deployLambdaFunction(orgId: string, orgName: string) {
  // Create Lambda function
  const createFunctionCommand = new CreateFunctionCommand({
    FunctionName: `portal-${orgId}`,
    PackageType: 'Image',
    Code: {
      ImageUri: '084375570866.dkr.ecr.us-east-1.amazonaws.com/portcullis/api:latest'
    },
    Role: process.env.LAMBDA_EXECUTION_ROLE!,
    MemorySize: 1024,
    Timeout: 30
  })

  await lambdaClient.send(createFunctionCommand)

  // Create function URL
  const createUrlCommand = new CreateFunctionUrlConfigCommand({
    FunctionName: `portal-${orgId}`,
    AuthType: 'NONE'
  })

  const urlConfig = await lambdaClient.send(createUrlCommand)

  // Add permission for function URL
  const addPermissionCommand = new AddPermissionCommand({
    FunctionName: `portal-${orgId}`,
    StatementId: 'FunctionURLAllowPublicAccess',
    Action: 'lambda:InvokeFunctionUrl',
    Principal: '*',
    FunctionUrlAuthType: 'NONE'
  })

  await lambdaClient.send(addPermissionCommand)

  return urlConfig.FunctionUrl
}

async function createStripeCustomer(name: string, email?: string) {
  const customer = await stripe.customers.create({
    name,
    email,
    metadata: {
      source: 'portcullis'
    }
  })
  return customer
}

export async function POST(req: Request) {
  const SIGNING_SECRET = process.env.SIGNING_SECRET

  if (!SIGNING_SECRET) {
    throw new Error('Error: Please add SIGNING_SECRET from Clerk Dashboard to .env or .env.local')
  }

  const wh = new Webhook(SIGNING_SECRET)

  // Get headers
  const headerPayload = headers()
  const svix_id = headerPayload.get('svix-id')
  const svix_timestamp = headerPayload.get('svix-timestamp')
  const svix_signature = headerPayload.get('svix-signature')

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response('Error: Missing Svix headers', {
      status: 400,
    })
  }

  const payload = await req.json()
  const body = JSON.stringify(payload)

  let evt: WebhookEvent
  
  try {
    evt = wh.verify(body, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    }) as WebhookEvent
  } catch (err) {
    console.error('Error: Could not verify webhook:', err)
    return new Response('Error: Verification error', {
      status: 400,
    })
  }

  const { id } = evt.data
  const eventType = evt.type
  console.log(`Received webhook with ID ${id} and event type of ${eventType}`)

  switch (eventType) {
    case 'organization.created': {
  
      console.log(`Organization created: ${evt.data.id}`)
  
      const { id, created_by, name, slug } = evt.data
  
      // Generate API Key
      const apiKey = await generateApiKey(id)
  
      // Create Stripe customer
      const stripeCustomer = await createStripeCustomer(name)

      // Deploy Lambda function and get URL
      const lambdaUrl = await deployLambdaFunction(id, name)
      
      // Insert the organization into Supabase
      const { data: orgData, error: orgError } = await supabase
        .from('organizations')
        .insert([
          {
            name,
            api_key: apiKey,
            stripe_customer_id: stripeCustomer.id,
            created_by: created_by,
          }
        ])

      if (orgError) {
        console.error('Error inserting into Supabase:', orgError)
        return new Response('Error: Failed to insert organization into Supabase', {
          status: 500,
        })
      }

      // Insert portal into Supabase
      const { data: portalData, error: portalError } = await supabase
        .from('portals')
        .insert([
          {
            organization: id,
            slug: slug,
            company: name,
            lambda_url: lambdaUrl
          }
        ])

      if (portalError) {
        console.error('Error inserting portal into Supabase:', portalError)
        return new Response('Error: Failed to insert portal into Supabase', {
          status: 500,
        })
      }
  
      console.log('Organization and portal successfully created in Supabase:', orgData)
      
      return new Response('Webhook received', { status: 200 })
    }

    case 'organization.deleted':
      console.log(`Organization deleted: ${id}`)
      // Handle organization deletion
      break

    default:
      console.log(`Unhandled event type: ${eventType}`)
      break
  }

  return new Response('Webhook received', { status: 200 })
}