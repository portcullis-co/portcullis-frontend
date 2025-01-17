import { EventSchemas, Inngest } from "inngest";

// Define your event types for better TypeScript support
type ClickhouseToSnowflakeSync = {
  data: {
    internal_warehouse: string;
    internal_credentials: any; // Replace with proper type
    destination_credentials: any; // Replace with proper type
    organization: string;
    query: string;
    type: string;
    table: string;
    scheduled_at?: string;
  };
};

type ClickhouseToBigQuerySync = {
  data: {
    internal_warehouse: string;
    internal_credentials: any; // Replace with proper type
    destination_credentials: any; // Replace with proper type
    organization: string;
    query: string;
    type: string;
    table: string;
    scheduled_at?: string;
  };
};

type ClickhouseToRedshiftSync = {
  data: {
    internal_warehouse: string;
    internal_credentials: any; // Replace with proper type
    destination_credentials: any; // Replace with proper type
    organization: string;
    query: string;
    type: string;
    table: string;
    scheduled_at?: string;
  };
};

// Define all your events
type Events = {
  "event/clickhouse-to-snowflake-sync": ClickhouseToSnowflakeSync;
  "event/clickhouse-to-bigquery-sync": ClickhouseToBigQuerySync;
  "event/clickhouse-to-redshift-sync": ClickhouseToRedshiftSync;
};

// Create and export the Inngest client
export const inngest = new Inngest({
  id: "portcullis-app",
  eventKey: process.env.INNGEST_EVENT_KEY!,
  schemas: new EventSchemas().fromRecord<Events>(),
}); 

console.log(process.env.INNGEST_EVENT_KEY);

// Add error handling for client initialization
if (!process.env.INNGEST_EVENT_KEY) {
  throw new Error('INNGEST_EVENT_KEY environment variable is not set');
}