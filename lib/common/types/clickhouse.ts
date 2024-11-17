import { WarehouseDataType, TypeMappings } from "./clickhouse.d";

export const clickhouseToSnowflake: Map<string, string> = new Map([
    // Integer types
    ['UINT8', 'NUMBER(5, 0)'],
    ['UINT16', 'NUMBER(5, 0)'],
    ['UINT32', 'NUMBER(10, 0)'],
    ['INT8', 'NUMBER(5, 0)'],
    ['INT16', 'SMALLINT'],
    ['INT32', 'INTEGER'],
    ['INT64', 'NUMBER(20, 0)'],
    ['INT128', 'NUMBER(38, 0)'],
    ['INT256', 'NUMBER(38, 0)'],
    ['UINT64', 'NUMBER(20, 0)'],
    ['UINT128', 'NUMBER(38, 0)'],
    ['UINT256', 'NUMBER(38, 0)'],

    // FLOATING-POINT TYPES
    ['FLOAT32', 'FLOAT'],
    ['FLOAT64', 'DOUBLE'],

    // DECIMAL TYPE
    ['DECIMAL', 'DECIMAL'], // DECIMAL (PRECISION, SCALE) AS NEEDED, DEFAULT HANDLED ELSEWHERE IF NECESSARY

    // STRING TYPES
    ['STRING', 'VARCHAR'],
    ['FIXEDSTRING', 'VARCHAR'],
    ['UUID', 'VARCHAR'],
    ['IPV4', 'VARCHAR'], // SNOWFLAKE LACKS DIRECT IP TYPE SUPPORT
    ['IPV6', 'VARCHAR'],

    // DATE AND TIME TYPES
    ['DATE', 'DATE'],
    ['DATE32', 'DATE'],
    ['DATETIME', 'TIMESTAMP_NTZ'],
    ['DATETIME64', 'TIMESTAMP_NTZ'],

    // JSON-LIKE AND SEMI-STRUCTURED DATA TYPES
    ['JSON', 'VARIANT'],
    ['OBJECT', 'VARIANT'], // DEPRECATED TYPE, BUT MAPPED TO VARIANT FOR SEMI-STRUCTURED DATA
    ['MAP', 'OBJECT'],

    // ARRAY TYPE
    ['ARRAY', 'ARRAY'],

    // GEOGRAPHIC AND GEOMETRY TYPES (NO DIRECT SUPPORT IN SNOWFLAKE, USING VARCHAR)
    ['GEO', 'VARCHAR'],
    ['POINT', 'VARCHAR'],
    ['RING', 'VARCHAR'],
    ['LINESTRING', 'VARCHAR'],
    ['MULTILINESTRING', 'VARCHAR'],
    ['POLYGON', 'VARCHAR'],

    // BOOLEAN TYPE (HANDLED IN CLICKHOUSE OFTEN AS UINT8)
    ['BOOLEAN', 'BOOLEAN'],

    // MISCELLANEOUS
    ['TUPLE', 'VARCHAR'], // REPRESENTED AS VARCHAR DUE TO LACK OF NATIVE SUPPORT FOR TUPLES
    ['NOTHING', 'NULL'], // MAPS TO NULL IN SNOWFLAKE
    ['BINARY', 'BINARY'],

    // DEFAULT FALLBACK TYPE
    ['DEFAULT', 'VARCHAR']
]);

export const clickhouseToBigQuery: TypeMappings = new Map([
    // Integers
    ['INT8', 'INT64'],
    ['INT16', 'INT64'],
    ['INT32', 'INT64'],
    ['INT64', 'INT64'],
    ['UINT8', 'INT64'],
    ['UINT16', 'INT64'],
    ['UINT32', 'INT64'],
    ['UINT64', 'INT64'],
    
    // Floating point
    ['FLOAT32', 'FLOAT64'],
    ['FLOAT64', 'FLOAT64'],
    
    // Strings and Binary
    ['STRING', 'STRING'],
    ['FIXEDSTRING', 'STRING'],
    ['UUID', 'STRING'],
    ['BINARY', 'BYTES'],
    
    // Date and Time
    ['DATE', 'DATE'],
    ['DATE32', 'DATE'],
    ['DATETIME', 'TIMESTAMP'],
    ['DATETIME64', 'TIMESTAMP'],
    
    // Complex types
    ['DECIMAL', 'NUMERIC'],
    ['DECIMAL32', 'NUMERIC'],
    ['DECIMAL64', 'NUMERIC'],
    ['DECIMAL128', 'NUMERIC'],
    ['JSON', 'JSON'],
    ['ARRAY', 'ARRAY']
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