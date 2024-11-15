export type TypeMappings = Map<string, string>;

export enum WarehouseDataType {
  Snowflake = "snowflake",
  BigQuery = "bigQuery",
  Redshift = "redshift",
  Databricks = "databricks",
  SQL = "SQL",
  Clickhouse = "clickhouse",
  Kafka = "kafka"
}

export interface WarehouseMapping {
  redshift: string;
  bigquery: string;
  snowflake: string;
  databricks: string;
  sql: string;
  clickhouse: string;
  kafka: string;
}

// Only declare the types, not the implementations
export type TypeMatrix = Map<WarehouseDataType, TypeMappings>;

export type ClickhouseCredentials = {
  host: string;
  username: string;
  password: string;
  database: string;
}

export type SnowflakeCredentials = {
  account: string;
  username: string;
  password: string;
  warehouse: string;
  database: string;
  schema: string;
}

export type BigQueryCredentials = {
  projectId: string;
  keyFilename: string;
  dataset: string;
}

export type ClickhouseToSnowflakeFunc = (params: any) => Promise<void>;
export type ClickhouseToBigQueryFunc = (params: any) => Promise<void>;
export type ClickhouseToRedshiftFunc = (params: any) => Promise<void>;