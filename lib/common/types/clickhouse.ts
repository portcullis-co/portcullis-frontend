import { WarehouseDataType, TypeMappings } from "./clickhouse.d";

// Move all Map implementations here
export const clickhouseToSnowflake: TypeMappings = new Map([
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
    ['JSON', 'OBJECT'],
    ['Array', 'ARRAY'],
    ['Binary', 'BINARY'],
    ['default', 'VARCHAR(16777216)']
]);

export const clickhouseToBigQuery: TypeMappings = new Map([
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

export const clickhouseToRedshift: TypeMappings = new Map([
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

export const clickhouseToDatabricks: TypeMappings = new Map([
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

export const clickhouseToSQL: TypeMappings = new Map([
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

export const clickhouseToKafka: TypeMappings = new Map<string, string>([
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
    ['Array', 'STRING'],
    ['Binary', 'BYTES']
]);

export const typeMatrix = new Map([
    [WarehouseDataType.Snowflake, clickhouseToSnowflake],
    [WarehouseDataType.BigQuery, clickhouseToBigQuery],
    [WarehouseDataType.Redshift, clickhouseToRedshift],
    [WarehouseDataType.Databricks, clickhouseToDatabricks],
    [WarehouseDataType.Kafka, clickhouseToKafka]
]);

export { WarehouseDataType };