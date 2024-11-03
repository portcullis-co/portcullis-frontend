# Portcullis - Type-Safe Embedded ETL Platform

Portcullis is a modern and type-safe embedded ETL platform that enables seamless data synchronization between various data warehouses. It currently supports:

- Clickhouse
- Snowflake
- BigQuery
- Redshift
- Databricks
- PostgreSQL
- Kafka

## Features

- **Fair Source**: Portcullis is built to be a fair source ETL platform. It does not require you to pay for a license to use the platform.
- **Embedded**: Portcullis is designed to be embedded into your product. It is a set of libraries that you can add to your product.
- **Modern**: Portcullis is built with modern technologies and architectures.

### Data Warehouse Management

- **Source**: Portcullis supports a wide range of data warehouses. You can easily add support for new data warehouses. 
- **Secure**: Portcullis encrypts all data in transit and at rest.
- **Scalable**: Portcullis is designed to be scalable. It is designed to handle large amounts of data.

### Data Synchronization

- **Type Safe**: Portcullis is designed to be type safe. It uses the Zod schema to validate the data.
- **Batch or Stream**: Portcullis supports both batch and stream data synchronization.
- **Error Handling**: Portcullis supports error handling. It will retry the data synchronization in case of an error.
- **Automated Type Mapping**: Portcullis supports automated type mapping. It will automatically map the data from the source to the destination.

### Security

- **Encrypted**: Portcullis encrypts all data in transit and at rest.
- **API Key Validation**: Portcullis supports API key validation. You can easily add API key validation to your data synchronization process.

## Technical Stack

- **Dashboard**: Next.js 14 with Tailwind CSS and Shadcn UI
- **Backend**: Node.js & TypeScript
- **Database**: Supabase
- **Background Jobs**: Trigger.dev
- **Analytics**: Twilio Segment

## Data Warehouse Adapters

We use the following libraries for each native data warehouse adapter:

- **Clickhouse**: Clickhouse and Clickhouse-web
- **Snowflake**: Snowflake SDK
- **BigQuery**: BigQuery Node.js Client
- **Redshift**: Redshift Node.js Client
- **Databricks**: Databricks Node.js Client
- **PostgreSQL**: PostgreSQL Node.js Client
- **Kafka**: KafkaJS

## Project Structure

```
app/
├── (portal)/          # Protected routes
│   ├── exports/      # Export management
│   └── warehouses/   # Warehouse management
├── api/              # API routes
├── trigger/          # Trigger.dev job definitions
└── components/       # Shared components

lib/
├── common/           # Shared utilities
│   └── types/       # Type definitions
├── supabase/        # Supabase client
└── encryption/      # Credential encryption
```

## Key Components

### Warehouse Integrations

The platform uses a unified type system for mapping between different warehouse types:

```
// Example implementation for Clickhouse to Snowflake
export const clickhouseToSnowflake: Map<string, string> = new Map([
    ['Int32', 'INTEGER'],
    ['Int64', 'INTEGER'],
    ['Int16', 'SMALLINT'],
    ['Float32', 'FLOAT'],
    ['Float64', 'DOUBLE'],
    ['String', 'VARCHAR'],
    ['UInt8', 'BOOLEAN'],
    ['Date', 'DATE'],
    ['DateTime', 'TIMESTAMP'],
    ['Decimal', 'DECIMAL'],
    ['UUID', 'VARCHAR'],
    ['JSON', 'VARIANT'],
    ['Array', 'ARRAY'],
    ['Binary', 'BINARY']
]);```

### Data Synchronization

Trigger.dev jobs handle the data synchronization:

```
export const clickhouseToSnowflakeSync = task({
  id: "clickhouse-snowflake-sync",
  // Add retry logic for resilience
  retry: {
    maxAttempts: 3,
    minTimeoutInMs: 1000,
    maxTimeoutInMs: 10000,
    factor: 2,
  },
  run: async (payload: SnowflakeSyncPayload) => {
    // Initialize Clickhouse client
    const clickhouse = createClient({
      host: payload.internal_credentials.host,
      username: payload.internal_credentials.username,
      password: payload.internal_credentials.password,
      database: payload.internal_credentials.database,
      compression: {
        response: false,
        request: false
      }
    });

    // Initialize Snowflake connection
    const snowflake = Snowflake.createConnection({
      account: payload.destination_credentials.account,
      username: payload.destination_credentials.username,
      password: payload.destination_credentials.password,
      warehouse: payload.destination_credentials.warehouse,
      database: payload.destination_credentials.database,
      schema: payload.destination_credentials.schema
    });

    try {
      // Stream data from Clickhouse
      const resultStream = await clickhouse.query({
        query: payload.query,
        format: 'JSONEachRow',
        clickhouse_settings: {
          wait_end_of_query: 1
        }
      });

      logger.info("Starting data sync", { 
        source: "Clickhouse", 
        destination: "Snowflake",
        table: payload.table 
      });
      // Process the stream in chunks
      for await (const rows of resultStream.stream()) {
        // Transform data types using the mapping
        const transformedRows = rows.map((row: any) => {
          const transformed: any = {};
          for (const [key, value] of Object.entries(row)) {
            // Get Clickhouse type and convert to Snowflake type
            const chType = typeof value; // You'd need proper type detection here
            const sfType = clickhouseToSnowflake.get(chType) || 'VARCHAR';
            transformed[key] = convertValue(value, sfType);
          }
          return transformed;
        });

        // Batch insert into Snowflake
        await new Promise((resolve, reject) => {
          snowflake.execute({
            sqlText: `INSERT INTO ${payload.table} SELECT * FROM TABLE(RESULT_SCAN(?))`,
            binds: [JSON.stringify(transformedRows)],
            complete: (err, stmt) => {
              if (err) reject(err);
              else resolve(stmt);
            }
          });
        });

        logger.info("Processed batch", { 
          rowCount: transformedRows.length 
        });
      }

      let analytics: Analytics | null = null;
      if (process.env.SEGMENT_WRITE_KEY) {
        analytics = new Analytics({ writeKey: process.env.SEGMENT_WRITE_KEY });
      } else {
        console.warn('SEGMENT_WRITE_KEY not found in environment variables');
      }
      analytics?.track({
        userId: payload.organization,
        event: "clickhouse-snowflake-sync",
        properties: {
          table: payload.table,
          revenue: 250,
          organization: payload.organization,
          destination: "Snowflake",
        }
      });

      return { success: true };
    } catch (error) {
      logger.error("Sync failed", { error });
      throw error;
    } finally {
      await clickhouse.close();
      snowflake.destroy((err: any) => {
        if (err) logger.error("Error destroying Snowflake connection", { error: err });
      });
    }
  },
});```

### Security

API routes implement authentication and authorization:

```
    headers,
  });
}
export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  const headers = corsHeaders(origin);
  
  try {
    // Log all headers for debugging
    console.log('Request headers:', Object.fromEntries(request.headers.entries()));
    
    const supabase = createClient();
    const apiKey = request.headers.get('x-api-key');
    console.log('Received API Key:', apiKey); // Be careful not to log actual keys in production
    
    const body = await request.json();
    console.log('Request body:', body);
    
    // Validate API key if present
    if (apiKey) {
      const { isValid, organizationId } = await validateApiKey(apiKey);
      console.log('API Key validation:', { isValid, organizationId }); // Debug log
      if (!isValid) {
        return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
      }
      body.organization = organizationId;
    } else {
      // Fall back to Clerk auth
      const { userId, orgId } = auth();
      console.log('Clerk auth:', { userId, orgId }); // Debug log
      if (!orgId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      body.organization = orgId;
    }

    const { 
      internal_warehouse,
      internal_credentials,
      destination_type,
      destination_name,
      table,
      credentials,
      scheduled_at 
    } = body;
    // Validate required fields
    if (!internal_warehouse || !destination_type || !destination_name || !table || !credentials || !internal_credentials) {
      return NextResponse.json({ 
        error: 'Missing required fields' 
      }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('exports')
      .insert({
        organization: body.organization,
        internal_warehouse: internal_warehouse,
        destination_type: destination_type,
        destination_name: destination_name,
        table: table,```

## Getting Started

### 1. Install dependencies

```
pnpm install
```

### 2. Setup environment variables

```
cp .env.example .env
```

### 3. Run the development server

```
pnpm run dev
```