import { task } from "@trigger.dev/sdk/v3";
import { getWarehouseConnection, executeQuery, getTableNames, insertDataInBatches } from "@/app/api/sync/route"; // Adjust the import paths as necessary
import { ClickHouseClient } from '@clickhouse/client';
import { BigQuery } from '@google-cloud/bigquery';
import { Client as PostgresClient } from 'pg';
import { Connection as SnowflakeConnection } from 'snowflake-sdk';

type WarehouseClient = ClickHouseClient | BigQuery | PostgresClient | SnowflakeConnection;

export const sync = task({
  id: "etl-process",
  run: async (payload: any) => {
    const { organization, type, link_warehouse, internal_warehouse, link_credentials, internal_credentials } = payload;

    // Initialize warehouse connections
    const sourceConnection: WarehouseClient = await getWarehouseConnection(internal_warehouse, internal_credentials);
    const destConnection: WarehouseClient = await getWarehouseConnection(link_warehouse, link_credentials);

    // Close connections
    // Fetch table names from the source warehouse
    const tableNames = await getTableNames(sourceConnection, link_warehouse);

    // Perform ETL for each table
    for (const tableName of tableNames) {
      // Modify the query to filter by organization
      const data = await executeQuery(sourceConnection, `SELECT * FROM ${tableName} WHERE organization = '${organization}'`, internal_warehouse);
      await insertDataInBatches(destConnection, tableName, data, link_warehouse, 10000);
    }
    // Type guard to check if the connection has 'end' or 'close' methods
    function canCloseConnection(client: any): client is { end?: () => void; close?: () => void } {
        return typeof client.end === 'function' || typeof client.close === 'function';
    }

    // Close connections
    if (canCloseConnection(sourceConnection)) {
        if (typeof sourceConnection.end === 'function') {
            sourceConnection.end();
        } else if (typeof sourceConnection.close === 'function') {
            sourceConnection.close();
        }
    }

    if (canCloseConnection(destConnection)) {
        if (typeof destConnection.end === 'function') {
            destConnection.end();
        } else if (typeof destConnection.close === 'function') {
            destConnection.close();
        }
    }

    return { success: true, message: 'ETL process completed successfully' };
  },
});