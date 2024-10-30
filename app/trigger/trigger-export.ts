export const dynamic = "force-dynamic";
import { task } from "@trigger.dev/sdk/v3";
import { createClient } from '@clickhouse/client';
import Snowflake from 'snowflake-sdk';
import { logger } from "@trigger.dev/sdk/v3";
import { 
  ClickhouseCredentials, 
  SnowflakeCredentials,
  clickhouseToSnowflake 
} from '../../lib/common/types/clickhouse';

// Define the task payload type
type SyncPayload = {
  sourceCredentials: ClickhouseCredentials;
  destinationCredentials: SnowflakeCredentials;
  query: string;
  tableName: string;
};

export const clickhouseToSnowflakeSync = task({
  id: "clickhouse-snowflake-sync",
  // Add retry logic for resilience
  retry: {
    maxAttempts: 3,
    minTimeoutInMs: 1000,
    maxTimeoutInMs: 10000,
    factor: 2,
  },
  run: async (payload: SyncPayload) => {
    // Initialize Clickhouse client
    const clickhouse = createClient({
      host: payload.sourceCredentials.host,
      username: payload.sourceCredentials.username,
      password: payload.sourceCredentials.password,
      database: payload.sourceCredentials.database
    });

    // Initialize Snowflake connection
    const snowflake = Snowflake.createConnection({
      account: payload.destinationCredentials.account,
      username: payload.destinationCredentials.username,
      password: payload.destinationCredentials.password,
      warehouse: payload.destinationCredentials.warehouse,
      database: payload.destinationCredentials.database,
      schema: payload.destinationCredentials.schema
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
        table: payload.tableName 
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
            transformed[key] = value;
          }
          return transformed;
        });

        // Batch insert into Snowflake
        await new Promise((resolve, reject) => {
          snowflake.execute({
            sqlText: `INSERT INTO ${payload.tableName} SELECT * FROM TABLE(RESULT_SCAN(?))`,
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
});