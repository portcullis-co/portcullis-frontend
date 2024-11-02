export const dynamic = "force-dynamic";
import { task } from "@trigger.dev/sdk/v3";
import { createClient } from '@clickhouse/client';
import Snowflake from 'snowflake-sdk';
import { logger } from "@trigger.dev/sdk/v3";
import Analytics from '@segment/analytics-node';
import {
  clickhouseToSnowflake,
  clickhouseToBigQuery,
  clickhouseToRedshift,
  clickhouseToDatabricks,
  clickhouseToSQL,
  clickhouseToKafka
} from '@/lib/common/types/clickhouse';
import { BigQuery } from '@google-cloud/bigquery';
import { Client } from 'pg';
import { Kafka } from 'kafkajs';
import { DBSQLClient } from "@databricks/sql";
import IDBSQLSession from '@databricks/sql/dist/contracts/IDBSQLSession';
import IOperation from '@databricks/sql/dist/contracts/IOperation';
import type { ClickhouseCredentials } from '@/lib/common/types/clickhouse.d';
import type { SnowflakeCredentials } from '@/lib/common/types/clickhouse.d';
import type { RedshiftCredentials } from '@/lib/common/types/clickhouse.d';
import type { DatabricksCredentials } from '@/lib/common/types/clickhouse.d';
import type { SQLCredentials } from '@/lib/common/types/clickhouse.d';
import type { KafkaCredentials } from '@/lib/common/types/clickhouse.d';
import type { BigQueryCredentials } from '@/lib/common/types/clickhouse.d';

// Define the task payload type
<<<<<<< HEAD
type SnowflakeSyncPayload = {
  internal_credentials: ClickhouseCredentials;
  destination_credentials: SnowflakeCredentials;
  organization: string;
=======
type SyncPayload = {
  internal_credentials: ClickhouseCredentials;
  destination_credentials: SnowflakeCredentials;
>>>>>>> f0e1bf1 (api and types)
  query: string;
  table: string;
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
  run: async (payload: SnowflakeSyncPayload) => {
    // Initialize Clickhouse client
    const clickhouse = createClient({
      host: payload.internal_credentials.host,
      username: payload.internal_credentials.username,
      password: payload.internal_credentials.password,
<<<<<<< HEAD
      database: payload.internal_credentials.database,
      compression: {
        response: false,
        request: false
      }
=======
      database: payload.internal_credentials.database
>>>>>>> f0e1bf1 (api and types)
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
});

// BigQuery sync
type BigQuerySyncPayload = {
  internal_credentials: ClickhouseCredentials;
  destination_credentials: BigQueryCredentials;
  query: string;
  table: string;
};

export const clickhouseToBigQuerySync = task({
  id: "clickhouse-bigquery-sync",
  retry: {
    maxAttempts: 3,
    minTimeoutInMs: 1000,
    maxTimeoutInMs: 10000,
    factor: 2,
  },
  run: async (payload: BigQuerySyncPayload) => {
    const clickhouse = createClient({
      host: payload.internal_credentials.host,
      username: payload.internal_credentials.username,
      password: payload.internal_credentials.password,
      database: payload.internal_credentials.database
    });

    const bigquery = new BigQuery({
      projectId: payload.destination_credentials.projectId,
      keyFilename: payload.destination_credentials.keyFilename
    });

    try {
      const resultStream = await clickhouse.query({
        query: payload.query,
        format: 'JSONEachRow',
        clickhouse_settings: { wait_end_of_query: 1 }
      });

      logger.info("Starting data sync", { 
        source: "Clickhouse", 
        destination: "BigQuery",
        table: payload.table 
      });

      for await (const rows of resultStream.stream()) {
        const transformedRows = rows.map((row: any) => {
          const transformed: any = {};
          for (const [key, value] of Object.entries(row)) {
            const chType = typeof value;
            const bqType = clickhouseToBigQuery.get(chType) || 'STRING';
            transformed[key] = convertValue(value, bqType);
          }
          return transformed;
        });

        await bigquery
          .dataset(payload.destination_credentials.dataset)
          .table(payload.table)
          .insert(transformedRows);

        logger.info("Processed batch", { rowCount: transformedRows.length });
      }

      return { success: true };
    } catch (error) {
      logger.error("Sync failed", { error });
      throw error;
    } finally {
      await clickhouse.close();
    }
  }
});

// Redshift sync
type RedshiftSyncPayload = {
  internal_credentials: ClickhouseCredentials;
  destination_credentials: RedshiftCredentials;
  query: string;
  table: string;
};

export const clickhouseToRedshiftSync = task({
  id: "clickhouse-redshift-sync",
  retry: {
    maxAttempts: 3,
    minTimeoutInMs: 1000,
    maxTimeoutInMs: 10000,
    factor: 2,
  },
  run: async (payload: RedshiftSyncPayload) => {
    const clickhouse = createClient({
      host: payload.internal_credentials.host,
      username: payload.internal_credentials.username,
      password: payload.internal_credentials.password,
      database: payload.internal_credentials.database
    });

    const redshift = new Client({
      host: payload.destination_credentials.host,
      port: payload.destination_credentials.port,
      database: payload.destination_credentials.database,
      user: payload.destination_credentials.username,
      password: payload.destination_credentials.password
    });

    try {
      await redshift.connect();
      const resultStream = await clickhouse.query({
        query: payload.query,
        format: 'JSONEachRow',
        clickhouse_settings: { wait_end_of_query: 1 }
      });

      logger.info("Starting data sync", { 
        source: "Clickhouse", 
        destination: "Redshift",
        table: payload.table 
      });

      for await (const rows of resultStream.stream()) {
        const transformedRows = rows.map((row: any) => {
          const transformed: any = {};
          for (const [key, value] of Object.entries(row)) {
            const chType = typeof value;
            const rsType = clickhouseToRedshift.get(chType) || 'VARCHAR';
            transformed[key] = convertValue(value, rsType);
          }
          return transformed;
        });

        // Using COPY command for better performance
        await redshift.query(`
          COPY ${payload.table} 
          FROM '${JSON.stringify(transformedRows)}'
          FORMAT JSON
        `);

        logger.info("Processed batch", { rowCount: transformedRows.length });
      }

      return { success: true };
    } catch (error) {
      logger.error("Sync failed", { error });
      throw error;
    } finally {
      await clickhouse.close();
      await redshift.end();
    }
  }
});

// Databricks sync
type DatabricksSyncPayload = {
  internal_credentials: ClickhouseCredentials;
  destination_credentials: DatabricksCredentials;
  query: string;
  table: string;
};

export const clickhouseToDatabricksSync = task({
  id: "clickhouse-databricks-sync",
  retry: {
    maxAttempts: 3,
    minTimeoutInMs: 1000,
    maxTimeoutInMs: 10000,
    factor: 2,
  },
  run: async (payload: DatabricksSyncPayload) => {
    const clickhouse = createClient({
      host: payload.internal_credentials.host,
      username: payload.internal_credentials.username,
      password: payload.internal_credentials.password,
      database: payload.internal_credentials.database
    });

    const client: DBSQLClient = new DBSQLClient();
    // Initialize Databricks connection using their SQL API
    const connectOptions = {
      token: payload.destination_credentials.token,
      host: payload.destination_credentials.host,
      path: payload.destination_credentials.httpPath
    };

    try {
      const resultStream = await clickhouse.query({
        query: payload.query,
        format: 'JSONEachRow',
        clickhouse_settings: { wait_end_of_query: 1 }
      });

      logger.info("Starting data sync", { 
        source: "Clickhouse", 
        destination: "Databricks",
        table: payload.table 
      });

      for await (const rows of resultStream.stream()) {
        const transformedRows = rows.map((row: any) => {
          const transformed: any = {};
          for (const [key, value] of Object.entries(row)) {
            const chType = typeof value;
            const dbType = clickhouseToDatabricks.get(chType) || 'STRING';
            transformed[key] = convertValue(value, dbType)  ;
          }
          return transformed;
        });

        await client.connect(connectOptions);
        const session: IDBSQLSession = await client.openSession();

        const queryOperation: IOperation = await session.executeStatement(
          `INSERT INTO ${payload.table} SELECT * FROM UNNEST(${JSON.stringify(transformedRows)})`,
          {
            runAsync: true,
            maxRows: 10000 // This option enables the direct results feature.
          }
        );

        const result = await queryOperation.fetchAll();
        logger.info("Processed batch", { rowCount: result.length });
      }

      return { success: true };
    } catch (error) {
      logger.error("Sync failed", { error });
      throw error;
    } finally {
      await clickhouse.close();
      await client.close();
    }
  }
});

// PostgreSQL sync
type SQLSyncPayload = {
  internal_credentials: ClickhouseCredentials;
  destination_credentials: SQLCredentials;
  query: string;
  table: string;
};

export const clickhouseToSQLSync = task({
  id: "clickhouse-sql-sync",
  retry: {
    maxAttempts: 3,
    minTimeoutInMs: 1000,
    maxTimeoutInMs: 10000,
    factor: 2,
  },
  run: async (payload: SQLSyncPayload) => {
    const clickhouse = createClient({
      host: payload.internal_credentials.host,
      username: payload.internal_credentials.username,
      password: payload.internal_credentials.password,
      database: payload.internal_credentials.database
    });

    const pg = new Client({
      host: payload.destination_credentials.host,
      port: payload.destination_credentials.port,
      database: payload.destination_credentials.database,
      user: payload.destination_credentials.username,
      password: payload.destination_credentials.password
    });

    try {
      await pg.connect();
      const resultStream = await clickhouse.query({
        query: payload.query,
        format: 'JSONEachRow',
        clickhouse_settings: { wait_end_of_query: 1 }
      });

      logger.info("Starting data sync", { 
        source: "Clickhouse", 
        destination: "PostgreSQL",
        table: payload.table 
      });

      for await (const rows of resultStream.stream()) {
        const transformedRows = rows.map((row: any) => {
          const transformed: any = {};
          for (const [key, value] of Object.entries(row)) {
            const chType = typeof value;
            const pgType = clickhouseToSQL.get(chType) || 'VARCHAR';
            transformed[key] = convertValue(value, pgType);
          }
          return transformed;
        });

        // Using COPY command for better performance
        await pg.query(`
          COPY ${payload.table} 
          FROM STDIN 
          WITH (FORMAT CSV)
        `, transformedRows);

        logger.info("Processed batch", { rowCount: transformedRows.length });
      }

      return { success: true };
    } catch (error) {
      logger.error("Sync failed", { error });
      throw error;
    } finally {
      await clickhouse.close();
      await pg.end();
    }
  }
});

// Kafka sync
type KafkaSyncPayload = {
  internal_credentials: ClickhouseCredentials;
  destination_credentials: KafkaCredentials;
  query: string;
  topic: string;
};

export const clickhouseToKafkaSync = task({
  id: "clickhouse-kafka-sync",
  retry: {
    maxAttempts: 3,
    minTimeoutInMs: 1000,
    maxTimeoutInMs: 10000,
    factor: 2,
  },
  run: async (payload: KafkaSyncPayload) => {
    const clickhouse = createClient({
      host: payload.internal_credentials.host,
      username: payload.internal_credentials.username,
      password: payload.internal_credentials.password,
      database: payload.internal_credentials.database
    });

    const kafka = new Kafka({
      clientId: 'clickhouse-sync',
      brokers: [`${payload.destination_credentials.host}:${payload.destination_credentials.port}`]
    });

    const producer = kafka.producer();

    try {
      await producer.connect();
      const resultStream = await clickhouse.query({
        query: payload.query,
        format: 'JSONEachRow',
        clickhouse_settings: { wait_end_of_query: 1 }
      });

      logger.info("Starting data sync", { 
        source: "Clickhouse", 
        destination: "Kafka",
        topic: payload.topic 
      });

      for await (const rows of resultStream.stream()) {
        const transformedRows = rows.map((row: any) => {
          const transformed: any = {};
          for (const [key, value] of Object.entries(row)) {
            const chType = typeof value;
            const kafkaType = clickhouseToKafka.get(chType) || 'STRING';
            transformed[key] = convertValue(value, kafkaType);
          }
          return transformed;
        });

        await producer.send({
          topic: payload.destination_credentials.topic,
          messages: transformedRows.map(row => ({
            value: JSON.stringify(row)
          }))
        });

        logger.info("Processed batch", { rowCount: transformedRows.length });
      }

      return { success: true };
    } catch (error) {
      logger.error("Sync failed", { error });
      throw error;
    } finally {
      await clickhouse.close();
      await producer.disconnect();
    }
  }
});

function convertValue(value: any, destType: string): any {
  if (value === null || value === undefined) return null;
  
  switch (destType.toUpperCase()) {
    // String types
    case 'VARCHAR':
    case 'STRING':
    case 'TEXT':
    case 'CHAR':
    case 'CHARACTER':
      return String(value);

    // Integer types
    case 'INTEGER':
    case 'INT':
    case 'BIGINT':
    case 'SMALLINT':
      return Number.isInteger(Number(value)) ? Number(value) : Math.floor(Number(value));

    // Floating point types
    case 'FLOAT':
    case 'DOUBLE':
    case 'DECIMAL':
    case 'NUMERIC':
    case 'REAL':
      return Number(value);

    // Boolean type
    case 'BOOLEAN':
    case 'BOOL':
      return Boolean(value);

    // Date/Time types
    case 'TIMESTAMP':
    case 'DATETIME':
      return value instanceof Date 
        ? value.toISOString()
        : new Date(value).toISOString();
    
    case 'DATE':
      return value instanceof Date 
        ? value.toISOString().split('T')[0]
        : new Date(value).toISOString().split('T')[0];

    // Array types
    case 'ARRAY':
      return Array.isArray(value) ? value : [value];

    // JSON types
    case 'JSON':
    case 'JSONB':
      return typeof value === 'string' ? JSON.parse(value) : JSON.stringify(value);

    // Default case
    default:
      return value;
  }
}

