'use server'
import 'server-only'
import { tasks } from "@trigger.dev/sdk/v3"
import type { pipelineTask } from '@/app/trigger/pipeline'
import { createClient } from '@supabase/supabase-js'
import { decrypt } from '@/lib/encryption'

interface Credentials {
  username?: string
  password?: string
  host?: string
  database?: string
  port?: number
  account?: string
  schema?: string
  warehouse?: string
  projectId?: string
  keyFilename?: string
}

interface PipelineRequestBody {
  organization: string
  internal_warehouse: string
  link_type: string
  link_credentials: Credentials
  internal_credentials: any
  table_name: string
}

function formatWarehouseCredentials(warehouseType: string, credentials: Credentials): Credentials {
  switch (warehouseType) {
    case 'Clickhouse':
      return {
        username: credentials.username,
        password: credentials.password,
        host: credentials.host,
        database: credentials.database,
      }
    case 'Snowflake':
      return {
        username: credentials.username,
        password: credentials.password,
        account: credentials.account,
        database: credentials.database,
        schema: credentials.schema,
        warehouse: credentials.warehouse,
      }
    case 'BigQuery':
      return {
        projectId: credentials.projectId,
        keyFilename: credentials.keyFilename,
      }
    case 'Postgres':
      return {
        username: credentials.username,
        password: credentials.password,
        host: credentials.host,
        port: credentials.port,
        database: credentials.database,
      }
    default:
      throw new Error(`Unsupported warehouse type: ${warehouseType}`)
  }
}

export async function runPipeline(
  organization: string | undefined,
  internal_warehouse: string,
  warehouseType: string,
  rawCredentials: Credentials
) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Required environment variables are missing')
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Fetch warehouse data
    const { data: internalData, error: internalError } = await supabase
      .from('warehouses')
      .select('*')
      .eq('id', internal_warehouse)
      .maybeSingle()

    if (internalError || !internalData || !internalData.credentials) {
      throw new Error('Failed to fetch warehouse data')
    }

    // Create sync record
    const { data: syncData, error: syncError } = await supabase
      .from('exports')
      .insert({
        organization: organization,
        internal_warehouse: internal_warehouse,
        table_name: internalData.table_name,
        link_type: warehouseType,
        status: 1
      })
      .select()
      .single()

    if (syncError) {
      throw new Error(`Failed to create sync record: ${syncError.message}`)
    }

    const formattedCredentials = formatWarehouseCredentials(warehouseType, rawCredentials)
    const decryptedInternalCreds = await decrypt(internalData.credentials)

    const requestBody: PipelineRequestBody = {
      organization: organization ?? '',
      internal_warehouse,
      link_type: warehouseType,
      link_credentials: formattedCredentials,
      internal_credentials: decryptedInternalCreds,
      table_name: internalData.table_name,
    }

    const handle = await tasks.trigger<typeof pipelineTask>("pipeline-etl", requestBody)

    return {
      success: true,
      message: "ETL process started",
      runId: handle.id,
      syncId: syncData.id,
      status: 200
    }
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Unknown error occurred')
  }
}
