import { createClient } from '@supabase/supabase-js';
import { ClickHouseClient, createClient as createClickHouseClient } from '@clickhouse/client';
import { Connection as SnowflakeConnection, createConnection as createSnowflakeConnection } from 'snowflake-sdk';
import { BigQuery } from '@google-cloud/bigquery';
import { DBSQLClient } from '@databricks/sql';

interface Credentials {
  type: string;
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  schema?: string;
  account?: string;
  projectId?: string;
  keyFilename?: string;
  path?: string;
  token?: string;
}

interface Schema {
  [tableName: string]: {
    [columnName: string]: string;
  };
}

async function performReverseETL(sourceCredentials: Credentials, importCredentials: Credentials): Promise<void> {
    const dataModel = await introspectDataModel(sourceCredentials);
    const sourceData = await extractData(sourceCredentials, dataModel);
    const transformedData = transformData(sourceData, importCredentials.type);
    await loadData(importCredentials, transformedData);
  }

async function extractData(credentials: Credentials, dataModel: Schema): Promise<Record<string, any[]>> {
  let data: Record<string, any[]> = {};

  switch (credentials.type) {
    case 'clickhouse':
      data = await extractFromClickHouse(credentials, dataModel);
      break;
    case 'snowflake':
      data = await extractFromSnowflake(credentials, dataModel);
      break;
    case 'bigquery':
      data = await extractFromBigQuery(credentials, dataModel);
      break;
    default:
      throw new Error(`Unsupported warehouse type: ${credentials.type}`);
  }

  return data;
}

function transformData(data: Record<string, any[]>, targetType: string): Record<string, any[]> {
  return data;
}

async function loadData(credentials: Credentials, data: Record<string, any[]>): Promise<void> {
  switch (credentials.type) {
    case 'clickhouse':
      await loadToClickHouse(credentials, data);
      break;
    case 'snowflake':
      await loadToSnowflake(credentials, data);
      break;
    case 'bigquery':
      await loadToBigQuery(credentials, data);
      break;
    default:
      throw new Error(`Unsupported warehouse type: ${credentials.type}`);
  }
}

async function introspectDataModel(credentials: Credentials): Promise<Schema> {
  let schema: Schema = {};

  switch (credentials.type) {
    case 'clickhouse':
      schema = await introspectClickHouse(credentials);
      break;
    case 'snowflake':
      schema = await introspectSnowflake(credentials);
      break;
    case 'bigquery':
      schema = await introspectBigQuery(credentials);
      break;
    default:
      throw new Error(`Unsupported warehouse type: ${credentials.type}`);
  }

  return schema;
}

async function introspectClickHouse(credentials: Credentials): Promise<Schema> {
    const client = createClickHouseClient({
        url: credentials.host, // Use 'url' instead of 'host'
        username: credentials.username,
        password: credentials.password,
    });

  const query = `
    SELECT 
      table_name,
      column_name,
      data_type
    FROM 
      system.columns
    WHERE 
      database = '${credentials.database}'
  `;

  const result = await client.query({
    query,
    format: 'JSONEachRow',
  });
  const rows = await result.json();
  const schema: Schema = {};

  for (const row of rows) {
    if (typeof row === 'object' && row !== null && 'table_name' in row && 'column_name' in row && 'data_type' in row) {
      const tableName = row.table_name as string;
      const columnName = row.column_name as string;
      const dataType = row.data_type as string;

      if (!schema[tableName]) {
        schema[tableName] = {};
      }
      schema[tableName][columnName] = dataType;
    }
  }

  await client.close();
  return schema;
}

async function introspectSnowflake(credentials: Credentials): Promise<Schema> {
  return new Promise((resolve, reject) => {
    const connection: SnowflakeConnection = createSnowflakeConnection({
      account: credentials.account!,
      username: credentials.username,
      password: credentials.password,
      database: credentials.database,
      schema: credentials.schema,
    });

    connection.connect((err: Error | undefined) => {
      if (err) {
        reject(err);
        return;
      }

      const query = `
        SELECT 
          table_name,
          column_name,
          data_type
        FROM 
          information_schema.columns
        WHERE 
          table_schema = '${credentials.schema}'
      `;

      connection.execute({
        sqlText: query,
        complete: (err: Error | undefined, _stmt: any, rows: any[] | undefined) => {
          if (err) {
            reject(err);
            return;
          }
          if (!rows) {
            reject(new Error('No rows returned'));
            return;
          }
          const schema: Schema = {};
          for (const row of rows) {
            if (typeof row === 'object' && row !== null) {
              const tableName = row.TABLE_NAME as string;
              const columnName = row.COLUMN_NAME as string;
              const dataType = row.DATA_TYPE as string;

              if (!schema[tableName]) {
                schema[tableName] = {};
              }
              schema[tableName][columnName] = dataType;
            }
          }

          connection.destroy((err: Error | undefined) => {
            if (err) {
              console.error('Error destroying Snowflake connection:', err);
            }
            resolve(schema);
          });
        }
      });
    });
  });
}

async function introspectBigQuery(credentials: Credentials): Promise<Schema> {
  const bigquery = new BigQuery({
    projectId: credentials.projectId,
    credentials: JSON.parse(credentials.keyFilename || '{}'),
  });

  const [datasets] = await bigquery.getDatasets();
  const schema: Schema = {};

  for (const dataset of datasets) {
    const [tables] = await dataset.getTables();
    for (const table of tables) {
      const [metadata] = await table.getMetadata();
      if (table.id) {
        schema[table.id] = {};
        for (const field of metadata.schema.fields) {
          schema[table.id][field.name] = field.type;
        }
      }
    }
  }

  return schema;
}

// async function introspectDatabricks(credentials: Credentials): Promise<Schema> {
//   const host = credentials.host;
//   const path = credentials.path;
//   const token = credentials.token;
//   const client = new DBSQLClient();
//   const connectOptions = {
//     token: token,
//     host: host,
//     path: path,
//   };

//   await client.connect(connectOptions as any);

//   const session = await client.openSession();
//   const queryOperation = await session.executeStatement(`
//     SELECT 
//       table_name,
//       column_name,
//       data_type
//     FROM 
//       information_schema.columns
//     WHERE 
//       table_schema = '${credentials.schema}'
//   `);

//   const result = await queryOperation.fetchAll();
//   const schema: Schema = {};

//   interface ColumnInfo {
//     table_name: string;
//     column_name: string;
//     data_type: string;
//   }

//   for (const row of result as ColumnInfo[]) {
//     if (!schema[row.table_name]) {
//       schema[row.table_name] = {};
//     }
//     schema[row.table_name][row.column_name] = row.data_type;
//   }

//   await client.close();
//   return schema;
// }

async function extractFromClickHouse(credentials: Credentials, dataModel: Schema): Promise<Record<string, any[]>> {
    const client = createClickHouseClient({
        url: credentials.host, // Use 'url' instead of 'host'
        username: credentials.username,
        password: credentials.password,
    });

  const data: Record<string, any[]> = {};
  for (const [tableName, columns] of Object.entries(dataModel)) {
    const columnNames = Object.keys(columns as object).join(', ');
    const query = `SELECT ${columnNames} FROM ${credentials.database}.${tableName}`;
    const result = await client.query({query});
    const jsonResult = await result.json();
    const rows = (jsonResult as any).rows ?? [];
    data[tableName] = rows;
  }

  await client.close();
  return data;
}

async function extractFromSnowflake(credentials: Credentials, dataModel: Schema): Promise<Record<string, any[]>> {
  return new Promise((resolve, reject) => {
    const connection: SnowflakeConnection = createSnowflakeConnection({
      account: credentials.account!,
      username: credentials.username,
      password: credentials.password,
      database: credentials.database,
      schema: credentials.schema,
    });

    connection.connect((err: Error | undefined) => {
      if (err) {
        reject(err);
        return;
      }

      const data: Record<string, any[]> = {};
      const promises = Object.entries(dataModel).map(([tableName, columns]) => {
        return new Promise<void>((resolveTable, rejectTable) => {
          const columnNames = Object.keys(columns as object).join(', ');
          const query = `SELECT ${columnNames} FROM ${tableName}`;
          connection.execute({
            sqlText: query,
            complete: (err: Error | undefined, _stmt: any, rows: any[] | undefined) => {
              if (err) {
                rejectTable(err);
              } else if (rows) {
                data[tableName] = rows;
                resolveTable();
              }
            }
          });
        });
      });

      Promise.all(promises)
        .then(() => {
          connection.destroy((err: Error | undefined) => {
            if (err) {
              console.error('Error destroying Snowflake connection:', err);
            }
            resolve(data);
          });
        })
        .catch(reject);
    });
  });
}

async function extractFromBigQuery(credentials: Credentials, dataModel: Schema): Promise<Record<string, any[]>> {
  const bigquery = new BigQuery({
    projectId: credentials.projectId,
    credentials: JSON.parse(credentials.keyFilename || '{}'),
  });

  const data: Record<string, any[]> = {};
  for (const [tableName, columns] of Object.entries(dataModel)) {
    const columnNames = Object.keys(columns as object).join(', ');
    const query = `SELECT ${columnNames} FROM \`${credentials.projectId}.${credentials.database}.${tableName}\``;
    const [rows] = await bigquery.query(query);
    data[tableName] = rows;
  }

  return data;
}

// async function extractFromDatabricks(credentials: Credentials, dataModel: Schema): Promise<Record<string, any[]>> {
//     const { DBSQLClient } = await import('@databricks/sql');
//     const client = new DBSQLClient();
//     const token = credentials.token;
//     const host = credentials.host;
//     const path = credentials.path;
//     const connectOptions = {
//       token: token,
//       host: host,
//       path: path,
//     };
  
//     await client.connect(connectOptions as any);
  
//     const data: Record<string, any[]> = {};
//     for (const [tableName, columns] of Object.entries(dataModel)) {
//       const columnNames = Object.keys(columns as object).join(', ');
//       const query = `SELECT ${columnNames} FROM ${tableName}`;
//       const session = await client.openSession();
//       const queryOperation = await session.executeStatement(query);
//       const rows = await queryOperation.fetchAll();
//       data[tableName] = rows;
//       await session.close();
//     }
  
//     await client.close();
//     return data;
//   }

async function loadToClickHouse(credentials: Credentials, data: Record<string, any[]>): Promise<void> {
    const client = createClickHouseClient({
        url: credentials.host, // Use 'url' instead of 'host'
        username: credentials.username,
        password: credentials.password,
    });

  for (const [tableName, rows] of Object.entries(data)) {
    if (rows.length === 0) continue;

    const columns = Object.keys(rows[0]).join(', ');
    const values = rows.map(row => `(${Object.values(row).map(v => JSON.stringify(v)).join(', ')})`).join(', ');
    const query = `INSERT INTO ${credentials.database}.${tableName} (${columns}) VALUES ${values}`;

    await client.query({query});
  }

  await client.close();
}

async function loadToSnowflake(credentials: Credentials, data: Record<string, any[]>): Promise<void> {
  return new Promise((resolve, reject) => {
    const connection: SnowflakeConnection = createSnowflakeConnection({
      account: credentials.account!,
      username: credentials.username,
      password: credentials.password,
      database: credentials.database,
      schema: credentials.schema,
    });

    connection.connect((err: Error | undefined) => {
      if (err) {
        reject(err);
        return;
      }

      const promises = Object.entries(data).map(([tableName, rows]) => {
        return new Promise<void>((resolveTable, rejectTable) => {
          if (rows.length === 0) {
            resolveTable();
            return;
          }

          const columns = Object.keys(rows[0]).join(', ');
          const placeholders = Object.keys(rows[0]).map(() => '?').join(', ');
          const query = `INSERT INTO ${tableName} (${columns}) VALUES (${placeholders})`;

          connection.execute({
            sqlText: query,
            binds: rows.flatMap(row => Object.values(row)) as any[],
            complete: (err: Error | undefined, _stmt: any, rows: any[] | undefined) => {
              if (err) {
                rejectTable(err);
              } else {
                resolveTable();
              }
            }
          });
        });
      });

      Promise.all(promises)
        .then(() => {
          connection.destroy((err: Error | undefined) => {
            if (err) {
              console.error('Error destroying Snowflake connection:', err);
            }
            resolve();
          });
        })
        .catch(reject);
    });
  });
}

async function loadToBigQuery(credentials: Credentials, data: Record<string, any[]>): Promise<void> {
  const bigquery = new BigQuery({
    projectId: credentials.projectId,
    credentials: JSON.parse(credentials.keyFilename || '{}'),
  });

  for (const [tableName, rows] of Object.entries(data)) {
    if (rows.length === 0) continue;

    const dataset = bigquery.dataset(credentials.database);
    const table = dataset.table(tableName);

    await table.insert(rows);
  }
}

// async function loadToDatabricks(credentials: Credentials, data: Record<string, any[]>): Promise<void> {
//     const client = new DBSQLClient();
//     const token = credentials.token;
//     const host = credentials.host;
//     const path = credentials.path;
//     const connectOptions = {
//       token: token,
//       host: host,
//       path: path,
//     };
  
//     if (credentials.path === undefined) {
//       throw new Error('Path is required for Databricks connection');
//     }
  
//     await client.connect(connectOptions as any);
  
//     try {
//       for (const [tableName, rows] of Object.entries(data)) {
//         if (rows.length === 0) continue;
  
//         const columns = Object.keys(rows[0]).join(', ');
//         const placeholders = Object.keys(rows[0]).map(() => '?').join(', ');
//         const query = `INSERT INTO ${tableName} (${columns}) VALUES (${placeholders})`;
  
//         const session = await client.openSession();
//         for (const row of rows) {
//           const boundQuery = query.replace(/\?/g, (_, i) => JSON.stringify(Object.values(row)[i]));
//           await session.executeStatement(boundQuery);
//         }
//         await session.close();
//       }
//     } finally {
//       await client.close();
//     }
//   }

export {
  introspectDataModel,
  performReverseETL,
};