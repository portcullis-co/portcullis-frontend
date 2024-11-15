import { serve } from "inngest/next";
import { inngest } from "@/app/inngest/client";
import { clickhouseToSnowflakeSync } from "@/app/inngest/functions/clickhouseToSnowflakeSync";
import { clickhouseToBigQuerySync } from "@/app/inngest/functions/clickhouseToBigQuerySync";
import { clickhouseToRedshiftSync } from "@/app/inngest/functions/clickhouseToRedshiftSync";

// Export the Inngest handler functions
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    clickhouseToSnowflakeSync,
    clickhouseToBigQuerySync,
    clickhouseToRedshiftSync
  ],
  streaming: "allow",
  serveHost: process.env.INNGEST_SERVE_HOST
}); 