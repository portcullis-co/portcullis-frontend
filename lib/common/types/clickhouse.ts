import { WarehouseDataType, WarehouseMapping } from "./clickhouse.d";

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
]);

export const clickhouseToBigQuery: Map<string, string> = new Map([
    ['Int32', 'INT64'],
    ['Int64', 'INT64'],
    ['Int16', 'INT64'],
    ['Float32', 'FLOAT64'],
    ['Float64', 'FLOAT64'],
    ['String', 'STRING'],
    ['UInt8', 'BOOL'],
    ['Date', 'DATE'],
    ['DateTime', 'TIMESTAMP'],
    ['Decimal', 'NUMERIC'],
    ['UUID', 'STRING'],
    ['JSON', 'JSON'],
    ['Array', 'ARRAY'],
    ['Binary', 'BYTES']
]);

export const clickhouseToRedshift: Map<string, string> = new Map([
    ['Int32', 'INTEGER'],
    ['Int64', 'BIGINT'],
    ['Int16', 'SMALLINT'],
    ['Float32', 'FLOAT4'],
    ['Float64', 'DOUBLE PRECISION'],
    ['String', 'VARCHAR'],
    ['UInt8', 'BOOLEAN'],
    ['Date', 'DATE'],
    ['DateTime', 'TIMESTAMP'],
    ['Decimal', 'DECIMAL'],
    ['UUID', 'VARCHAR'],
    ['JSON', 'SUPER'],
    ['Array', 'SUPER'],
    ['Binary', 'BYTEA']
]);

export const clickhouseToDatabricks: Map<string, string> = new Map([
    ['Int32', 'INT'],
    ['Int64', 'BIGINT'],
    ['Int16', 'SMALLINT'],
    ['Float32', 'FLOAT'],
    ['Float64', 'DOUBLE'],
    ['String', 'STRING'],
    ['UInt8', 'BOOLEAN'],
    ['Date', 'DATE'],
    ['DateTime', 'TIMESTAMP'],
    ['Decimal', 'DECIMAL'],
    ['UUID', 'STRING'],
    ['JSON', 'STRING'],
    ['Array', 'ARRAY'],
    ['Binary', 'BINARY']
]);

export const clickhouseToSQL: Map<string, string> = new Map([
    ['Int32', 'INTEGER'],
    ['Int64', 'BIGINT'],
    ['Int16', 'SMALLINT'],
    ['Float32', 'REAL'],
    ['Float64', 'DOUBLE PRECISION'],
    ['String', 'VARCHAR'],
    ['UInt8', 'BOOLEAN'],
    ['Date', 'DATE'],
    ['DateTime', 'TIMESTAMP'],
    ['Decimal', 'DECIMAL'],
    ['UUID', 'UUID'],
    ['JSON', 'JSONB'],
    ['Array', 'ARRAY'],
    ['Binary', 'BYTEA']
]);

export const clickhouseToKafka: Map<string, string | null> = new Map([
    ['Int32', 'INT32'],
    ['Int64', 'INT64'],
    ['Int16', 'INT16'],
    ['Float32', 'FLOAT'],
    ['Float64', 'DOUBLE'],
    ['String', 'STRING'],
    ['UInt8', 'BOOLEAN'],
    ['Date', 'DATE'],
    ['DateTime', 'TIMESTAMP'],
    ['Decimal', 'DECIMAL'],
    ['UUID', 'STRING'],
    ['JSON', 'STRING'],
    ['Array', null],
    ['Binary', 'BYTES']
]);

const warehouseTypeMapping: Partial<WarehouseMapping> = {
    [WarehouseDataType.INTEGER]: {
      redshift: "INTEGER",
      bigquery: "INT64",
      snowflake: "INTEGER",
      databricks: "INT",
      sql: "INTEGER",
      clickhouse: "Int32",
      kafka: "INT32"
    },
    [WarehouseDataType.SMALLINT]: {
      redshift: "SMALLINT", 
      bigquery: "INT64",
      snowflake: "SMALLINT",
      databricks: "SMALLINT",
      sql: "SMALLINT",
      clickhouse: "Int16",
      kafka: "INT16"
    },
    [WarehouseDataType.BIGINT]: {
      redshift: "BIGINT",
      bigquery: "INT64", 
      snowflake: "BIGINT",
      databricks: "BIGINT",
      sql: "BIGINT",
      clickhouse: "Int64",
      kafka: "INT64"
    },
    [WarehouseDataType.FLOAT]: {
      redshift: "FLOAT4",
      bigquery: "FLOAT64",
      snowflake: "FLOAT",
      databricks: "FLOAT",
      sql: "REAL",
      clickhouse: "Float32",
      kafka: "FLOAT"
    },
    [WarehouseDataType.DOUBLE]: {
      redshift: "DOUBLE PRECISION",
      bigquery: "FLOAT64",
      snowflake: "DOUBLE",
      databricks: "DOUBLE",
      sql: "DOUBLE PRECISION",
      clickhouse: "Float64",
      kafka: "DOUBLE"
    },
    [WarehouseDataType.VARCHAR]: {
      redshift: "VARCHAR",
      bigquery: "STRING",
      snowflake: "VARCHAR",
      databricks: "STRING",
      sql: "VARCHAR",
      clickhouse: "String",
      kafka: "STRING"
    },
    [WarehouseDataType.BOOLEAN]: {
      redshift: "BOOLEAN",
      bigquery: "BOOL",
      snowflake: "BOOLEAN",
      databricks: "BOOLEAN",
      sql: "BOOLEAN",
      clickhouse: "UInt8",
      kafka: "BOOLEAN"
    },
    [WarehouseDataType.DATE]: {
      redshift: "DATE",
      bigquery: "DATE",
      snowflake: "DATE", 
      databricks: "DATE",
      sql: "DATE",
      clickhouse: "Date",
      kafka: "DATE"
    },
    [WarehouseDataType.TIMESTAMP]: {
      redshift: "TIMESTAMP",
      bigquery: "TIMESTAMP",
      snowflake: "TIMESTAMP",
      databricks: "TIMESTAMP",
      sql: "TIMESTAMP",
      clickhouse: "DateTime",
      kafka: "TIMESTAMP"
    },
    [WarehouseDataType.DECIMAL]: {
      redshift: "DECIMAL",
      bigquery: "NUMERIC",
      snowflake: "DECIMAL",
      databricks: "DECIMAL",
      sql: "DECIMAL",
      clickhouse: "Decimal64",
      kafka: "DECIMAL"
    },
    [WarehouseDataType.UUID]: {
      redshift: "VARCHAR",
      bigquery: "STRING",
      snowflake: "UUID",
      databricks: "STRING",
      sql: "UUID",
      clickhouse: "UUID",
      kafka: "STRING"
    },
    [WarehouseDataType.JSON]: {
      redshift: "SUPER",
      bigquery: "JSON",
      snowflake: "VARIANT",
      databricks: "STRING",
      sql: "JSONB",
      clickhouse: "JSON",
      kafka: "STRING"
    },
    [WarehouseDataType.ARRAY]: {
      redshift: "SUPER",
      bigquery: "ARRAY",
      snowflake: "ARRAY",
      databricks: "ARRAY",
      sql: "ARRAY",
      clickhouse: "Array",
      kafka: "STRING"
    },
    [WarehouseDataType.BINARY]: {
      redshift: "BYTEA", 
      bigquery: "BYTES",
      snowflake: "BINARY",
      databricks: "BINARY",
      sql: "BYTEA",
      clickhouse: "String",
      kafka: "BYTES"
    },
    [WarehouseDataType.GEOGRAPHY]: {
      redshift: undefined,
      bigquery: "GEOGRAPHY", 
      snowflake: "GEOGRAPHY",
      databricks: undefined,
      sql: undefined,
      clickhouse: "GEOMETRIC",
      kafka: undefined
    }
  };

export const typeMatrix: Map<WarehouseDataType, Map<string, string | null>> = new Map([
    [WarehouseDataType.Snowflake, clickhouseToSnowflake],
    [WarehouseDataType.BigQuery, clickhouseToBigQuery], 
    [WarehouseDataType.Redshift, clickhouseToRedshift],
    [WarehouseDataType.Databricks, clickhouseToDatabricks],
    [WarehouseDataType.Kafka, clickhouseToKafka]
]);

export { WarehouseDataType };