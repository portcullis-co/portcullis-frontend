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
  CreateFunctionUrlConfigCommand,
  DeleteFunctionCommand
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
  const CLERK_WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

  if (!CLERK_WEBHOOK_SECRET) {
    throw new Error('Error: Please add CLERK_WEBHOOK_SECRET from Clerk Dashboard to .env or .env.local');
  }

  const wh = new Webhook(CLERK_WEBHOOK_SECRET);

  // Get headers
  const headerPayload = await headers();
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

  let evt: WebhookEvent;

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

  const eventType = evt.type;

  try {
    switch (eventType) {
      case 'organization.created': {
        const { id, created_by, name, slug } = evt.data;

        // Process organization creation logic
        const stripeCustomer = await stripe.customers.create({
          name: name,
          metadata: { organizationId: id },
        });

        const apiKey = await generateApiKey(id);

        const functionName = `${id}-runners`;
        const lambdaParams = {
          FunctionName: functionName,
          PackageType: 'Image',
          Code: { ImageUri: '084375570866.dkr.ecr.us-east-1.amazonaws.com/portcullis/api:latest' },
          Role: "arn:aws:iam::084375570866:role/PortcullisLambdaRole",
          MemorySize: 1024,
          Timeout: 30,
          Environment: { Variables: { ORGANIZATION_ID: id } },
        };

        const createFunctionCommand = new CreateFunctionCommand(lambdaParams as CreateFunctionCommandInput);
        await lambda.send(createFunctionCommand);

        const urlConfig = new CreateFunctionUrlConfigCommand({
          FunctionName: functionName,
          AuthType: 'NONE',
          Cors: {
            AllowCredentials: true,
            AllowHeaders: ['*'],
            AllowMethods: ['*'],
            AllowOrigins: ['*'],
            MaxAge: 86400,
          },
        });

        const urlResponse = await lambda.send(urlConfig);
        const lambdaUrl = urlResponse.FunctionUrl;

        const { data: orgData, error: orgError } = await supabase
          .from('organizations')
          .insert([
            { slug, name, stripe_customer_id: stripeCustomer.id, created_by },
          ])
          .select('id')
          .single();

        if (orgError) throw orgError;

        const { error: portalError } = await supabase
          .from('portals')
          .insert([
            {
              organization: orgData.id,
              api_key: apiKey,
              company: name,
              lambda_url: lambdaUrl,
            },
          ]);

        if (portalError) throw portalError;

        return new Response('Organization created successfully', { status: 200 });
      }

      case 'organization.deleted': {
        const { id } = evt.data;
        
        // Clean up associated resources
        try {
          // Delete Lambda function
          await lambda.send(new DeleteFunctionCommand({ FunctionName: `${id}-runners` }));
          
          // Delete from Supabase
          const { error: deleteError } = await supabase
            .from('organizations')
            .delete()
            .match({ id });
            
          if (deleteError) throw deleteError;
          
          return new Response(`Organization ${id} deleted successfully`, { status: 200 });
        } catch (error) {
          console.error('Error deleting organization:', error);
          throw error;
        }
      }

      case 'user.created': {
        const { 
          id, 
          email_addresses, 
          image_url, 
          first_name, 
          last_name, 
          organization_memberships 
        } = evt.data;
      
        // Determine the organization ID (if any)
        const organizationId = organization_memberships?.[0]?.organization?.id || null;
      
        try {
          // Insert user into Supabase
          const { error: userError } = await supabase
            .from('users')
            .insert([
              {
                id,
                first_name,
                last_name,
                email: email_addresses?.[0]?.email_address || null,
                organization: organizationId, // Handles null or missing organization
                image_url,
              },
            ]);
      
          if (userError) throw userError;
      
          return new Response(`User ${id} created successfully`, { status: 200 });
        } catch (error) {
          console.error('Error inserting user:', error);
          return new Response('Error inserting user', { status: 500 });
        }
      }      

      case 'user.updated': {
        const { 
          id, 
          email_addresses, 
          image_url, 
          first_name, 
          last_name, 
          organization_memberships 
        } = evt.data;

        // Update user in Supabase
        const { error: updateError } = await supabase
          .from('users')
          .update({
            first_name,
            last_name,
            email: email_addresses[0].email_address,
            organization: organization_memberships?.[0].organization.id,
            image_url,
          })
          .match({ id });

        if (updateError) throw updateError;

        return new Response(`User ${id} updated successfully`, { status: 200 });
      }

      case 'user.deleted': {
        const { id } = evt.data;

        // Delete user from Supabase
        const { error: deleteError } = await supabase
          .from('users')
          .delete()
          .match({ id });

        if (deleteError) throw deleteError;

        return new Response(`User ${id} deleted successfully`, { status: 200 });
      }

      case 'organization.updated': {
        const { id, name, slug } = evt.data;

        // Update organization in Supabase
        const { error: updateError } = await supabase
          .from('organizations')
          .update({ name, slug })
          .match({ id });

        if (updateError) throw updateError;

        return new Response(`Organization ${id} updated successfully`, { status: 200 });
      }

      default: {
        console.log(`Unhandled event type: ${eventType}`);
        return new Response(`Unhandled webhook event type: ${eventType}`, { status: 400 });
      }
    }
  } catch (error) {
    console.error(`Error processing ${eventType} event:`, error);
    return new Response(
      `Error processing ${eventType} event`,
      { status: 500, statusText: error instanceof Error ? error.message : 'Unknown error' }
    );
  }
}