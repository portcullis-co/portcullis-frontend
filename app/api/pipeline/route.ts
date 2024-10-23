import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';
import * as pulumi from "@pulumi/pulumi";
import * as docker from "@pulumi/docker";

// Type definitions
type DestinationOptions = {
    mode?: "stream" | "batch";
    batchSize?: number;
    frequency?: number;
};

interface BulkerDestination {
    id: string;
    type: string;
    credentials: Record<string, any>;
    options?: DestinationOptions;
}

// Zod schemas for validation
const commonDbCredentialsSchema = z.object({
    host: z.string().optional(),
    port: z.number().optional(),
    database: z.string(),
    defaultSchema: z.string().optional(),
    username: z.string(),
    password: z.string(),
});

const clickhouseCredentialsSchema = z.object({
    hosts: z.array(z.string()).optional(),
    protocol: z.string().optional(),
    cluster: z.string().optional(),
    parameters: z.record(z.string()).optional(),
    database: z.string(),
    username: z.string(),
    password: z.string(),
});

const bigqueryCredentialsSchema = z.object({
    project: z.string(),
    keyFile: z.string(),
    bqDataset: z.string()
});

const requestSchema = z.object({
    organization: z.string(),
    internal_warehouse: z.string(),
    link_type: z.enum(['postgres', 'mysql', 'redshift', 'snowflake', 'clickhouse', 'bigquery']),
    internal_credentials: commonDbCredentialsSchema,
    link_credentials: z.union([
        commonDbCredentialsSchema,
        clickhouseCredentialsSchema,
        bigqueryCredentialsSchema
    ])
});

// Helper functions
function mapCredentialsToBulkerFormat(
    linkType: string,
    linkCreds: Record<string, any>,
    internalCreds: Record<string, any>
): BulkerDestination[] {
    const destinations: BulkerDestination[] = [];

    // Link destination
    const linkDestination: BulkerDestination = {
        id: 'destination',
        type: linkType,
        credentials: {}
    };

    switch (linkType) {
        case 'postgres':
        case 'mysql':
        case 'redshift':
        case 'snowflake':
            linkDestination.credentials = {
                host: linkCreds.host,
                port: 443,
                database: linkCreds.database,
                username: linkCreds.username,
                password: linkCreds.password,
                defaultSchema: linkCreds.schema || 'public'
            };
            break;

        case 'clickhouse':
            linkDestination.credentials = {
                protocol: 'https',
                hosts: linkCreds.host,
                database: linkCreds.database,
                username: linkCreds.username,
                password: linkCreds.password
            };
            break;

        case 'bigquery':
            linkDestination.credentials = {
                project: linkCreds.projectId,
                keyFile: linkCreds.keyFilename,
                bqDataset: linkCreds.database
            };
            break;

        default:
            throw new Error(`Unsupported link type: ${linkType}`);
    }

    destinations.push(linkDestination);
    return destinations;
}

async function createBulkerContainer(
    name: string,
    destinations: BulkerDestination[]
): Promise<docker.Container> {
    const envVars: Record<string, pulumi.Output<string>> = {
        'BULKER_BATCH_RUNNER_DEFAULT_BATCH_SIZE': pulumi.output('10000'),
        'BULKER_BATCH_RUNNER_DEFAULT_PERIOD_SEC': pulumi.output('300')
    };

    destinations.forEach(dest => {
        envVars[`BULKER_DESTINATION_${dest.id.toUpperCase()}`] = pulumi.output(JSON.stringify(dest));
    });

    return new docker.Container(name, {
        name,
        image: "jitsucom/bulker:latest",
        envs: pulumi.all(Object.values(envVars)).apply((values) =>
            Object.entries(envVars).map(([key, value], index) => `${key}=${values[index]}`)
        ),
        restart: "unless-stopped",
        mustRun: true,
        ports: [{
            internal: 3001,
            external: 3001
        }]
    });
}

// Main API route handler
export async function POST(request: NextRequest) {
  const supabase = createClient();
  let syncId: string | null = null;
  let container: docker.Container | null = null;

  try {
      const body = await request.json();
      const linkType = body.link_type.toLowerCase();
      const modifiedBody = { ...body, link_type: linkType };
      const validatedData = requestSchema.parse(modifiedBody);

      // Create sync record
      const { data: syncData, error: syncError } = await supabase
          .from('syncs')
          .insert({
              organization: validatedData.organization,
              internal_warehouse: validatedData.internal_warehouse,
              link_type: validatedData.link_type,
              internal_credentials: validatedData.internal_credentials,
              link_credentials: validatedData.link_credentials,
              status: 'active'
          })
          .select()
          .single();

      if (syncError) throw new Error(`Failed to create sync record: ${syncError.message}`);

      syncId = syncData.id;

      // Create and configure container
      const destinations = mapCredentialsToBulkerFormat(
          validatedData.link_type,
          validatedData.link_credentials,
          validatedData.internal_credentials
      );

      container = await createBulkerContainer(`bulker-${syncId}`, destinations);

      // Update sync record with success
      await supabase
          .from('syncs')
          .update({
              status: 'completed',
              completed_at: new Date().toISOString(),
              container_id: container.id
          })
          .eq('id', syncId);

      if (!container) {
          throw new Error('Container creation failed');
      }

      // Resolve the Pulumi output and perform fetch inside the apply function
      await pulumi.output(container.name).apply(async (name) => {
        const bulkerUrl = `http://${name}:3001/api/v1/data`;

        // Now use the resolved value in fetch
        const bulkerResponse = await fetch(bulkerUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        if (!bulkerResponse.ok) {
            throw new Error(`Failed to send data to Bulker: ${bulkerResponse.statusText}`);
        }

        return NextResponse.json({
            success: true,
            syncId,
            containerId: container!.id,
            message: 'ETL process and container provisioning completed successfully'
        });
      });

  } catch (error) {
      console.error('ETL process failed:', error);

      if (syncId) {
          await supabase
              .from('syncs')
              .update({
                  status: 'failed',
                  error_message: error instanceof Error ? error.message : 'Unknown error occurred'
              })
              .eq('id', syncId);
      }

      return NextResponse.json({
          success: false,
          syncId,
          error: error instanceof Error ? error.message : 'Unknown error occurred'
      }, { status: 500 });
  }
}
