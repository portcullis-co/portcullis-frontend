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
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return {
      success: false,
      message: "Missing environment configuration",
      status: 500
    }
  }

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    // Validate inputs
    if (!organization || !internal_warehouse || !warehouseType) {
      return {
        success: false,
        message: "Missing required parameters",
        status: 400
      }
    }

    // Fetch warehouse data with error handling
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

      const requestBody = {
        organization,
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
        status: 200
      }
    } catch (error) {
      console.error('Pipeline processing error:', error)
      return {
        success: false,
        message: error instanceof Error ? error.message : "Failed to process pipeline request",
        status: 500
      }
    }
  } catch (error) {
    console.error('Pipeline error:', error)
    return {
      success: false,
      message: "An unexpected error occurred",
      status: 500
    }
  }
}
