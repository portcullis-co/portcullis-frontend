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

export const clickhouseToBigQuery: Map<string, string> = new Map([
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

export const clickhouseToRedshift: Map<string, string> = new Map([
    // Integer Types
    ['UINT8', 'SMALLINT'],
    ['UINT16', 'INTEGER'],
    ['UINT32', 'BIGINT'],
    ['INT8', 'SMALLINT'],
    ['INT16', 'SMALLINT'],
    ['INT32', 'INTEGER'],
    ['INT64', 'BIGINT'],
    ['INT128', 'VARCHAR'],
    ['INT256', 'VARCHAR'],
    ['UINT64', 'VARCHAR'],
    ['UINT128', 'VARCHAR'],
    ['UINT256', 'VARCHAR'],

    // Floating Point Types
    ['FLOAT32', 'REAL'],
    ['FLOAT64', 'DOUBLE PRECISION'],

    // Decimal Types
    ['DECIMAL', 'DECIMAL'],

    // String Types
    ['STRING', 'VARCHAR'],
    ['FIXEDSTRING', 'VARCHAR'],
    ['UUID', 'VARCHAR'],
    ['IPV4', 'VARCHAR'],
    ['IPV6', 'VARCHAR'],

    // Date and Time Types
    ['DATE', 'DATE'],
    ['DATE32', 'DATE'],
    ['DATETIME', 'TIMESTAMP'],
    ['DATETIME64', 'TIMESTAMP'],

    // JSON and Semi-Structured Data
    ['JSON', 'SUPER'],
    ['MAP', 'SUPER'],
    ['OBJECT', 'SUPER'],

    // Array Types
    ['ARRAY', 'SUPER'],

    // Boolean Type
    ['BOOLEAN', 'BOOLEAN'],

    // Geographic and Geometry Types
    ['GEO', 'VARCHAR'],
    ['POINT', 'VARCHAR'],
    ['RING', 'VARCHAR'],
    ['LINESTRING', 'VARCHAR'],
    ['MULTILINESTRING', 'VARCHAR'],
    ['POLYGON', 'VARCHAR'],

    // Miscellaneous Types
    ['TUPLE', 'VARCHAR'],
    ['NOTHING', 'NULL'],
    ['BINARY', 'BYTEA'],
    ['DEFAULT', 'VARCHAR']
]);

export const clickhouseToDatabricks: Map<string, string> = new Map([
    // Integer Types
    ['UINT8', 'SMALLINT'],
    ['UINT16', 'INT'],
    ['UINT32', 'BIGINT'],
    ['INT8', 'TINYINT'],
    ['INT16', 'SMALLINT'],
    ['INT32', 'INT'],
    ['INT64', 'BIGINT'],
    ['INT128', 'STRING'],
    ['INT256', 'STRING'],
    ['UINT64', 'STRING'],
    ['UINT128', 'STRING'],
    ['UINT256', 'STRING'],

    // Floating Point Types
    ['FLOAT32', 'FLOAT'],
    ['FLOAT64', 'DOUBLE'],

    // Decimal Types
    ['DECIMAL', 'DECIMAL'],

    // String Types
    ['STRING', 'STRING'],
    ['FIXEDSTRING', 'STRING'],
    ['UUID', 'STRING'],
    ['IPV4', 'STRING'],
    ['IPV6', 'STRING'],

    // Date and Time Types
    ['DATE', 'DATE'],
    ['DATE32', 'DATE'],
    ['DATETIME', 'TIMESTAMP'],
    ['DATETIME64', 'TIMESTAMP'],

    // JSON and Semi-Structured Data
    ['JSON', 'STRING'],
    ['MAP', 'MAP'],
    ['OBJECT', 'MAP'],

    // Array Types
    ['ARRAY', 'ARRAY'],

    // Boolean Type
    ['BOOLEAN', 'BOOLEAN'],

    // Geographic and Geometry Types
    ['GEO', 'STRING'],
    ['POINT', 'STRING'],
    ['RING', 'STRING'],
    ['LINESTRING', 'STRING'],
    ['MULTILINESTRING', 'STRING'],
    ['POLYGON', 'STRING'],

    // Miscellaneous Types
    ['TUPLE', 'STRING'],
    ['NOTHING', 'NULL'],
    ['BINARY', 'BINARY'],
    ['DEFAULT', 'STRING']
]);


export const clickhouseToSQL: Map<string, string> = new Map([
    // Integer Types
    ['UINT8', 'SMALLINT'],
    ['UINT16', 'INTEGER'],
    ['UINT32', 'BIGINT'],
    ['INT8', 'SMALLINT'],
    ['INT16', 'SMALLINT'],
    ['INT32', 'INTEGER'],
    ['INT64', 'BIGINT'],
    ['INT128', 'NUMERIC(38)'],
    ['INT256', 'NUMERIC(78)'],
    ['UINT64', 'NUMERIC(38)'],
    ['UINT128', 'NUMERIC(38)'],
    ['UINT256', 'NUMERIC(78)'],

    // Floating Point Types
    ['FLOAT32', 'FLOAT'],
    ['FLOAT64', 'DOUBLE PRECISION'],

    // Decimal Types
    ['DECIMAL', 'DECIMAL'],

    // String Types
    ['STRING', 'VARCHAR'],
    ['FIXEDSTRING', 'CHAR'], 
    ['UUID', 'CHAR(36)'], 
    ['IPV4', 'VARCHAR'],
    ['IPV6', 'VARCHAR'],

    // Date and Time Types
    ['DATE', 'DATE'],
    ['DATE32', 'DATE'],
    ['DATETIME', 'TIMESTAMP'],
    ['DATETIME64', 'TIMESTAMP'],

    // JSON and Semi-Structured Data
    ['JSON', 'JSON'],
    ['MAP', 'JSON'], // Map structures are often treated as JSON
    ['OBJECT', 'JSON'],

    // Array Types
    ['ARRAY', 'VARCHAR(MAX)'], // Arrays require special handling; VARCHAR(MAX) is a fallback

    // Boolean Type
    ['BOOLEAN', 'BOOLEAN'],

    // Geographic and Geometry Types
    ['GEO', 'GEOMETRY'],
    ['POINT', 'POINT'],
    ['RING', 'GEOMETRY'],
    ['LINESTRING', 'LINESTRING'],
    ['MULTILINESTRING', 'MULTILINESTRING'],
    ['POLYGON', 'POLYGON'],

    // Miscellaneous Types
    ['TUPLE', 'VARCHAR(MAX)'], 
    ['NOTHING', 'NULL'], 
    ['BINARY', 'BLOB'], 
    ['DEFAULT', 'VARCHAR(MAX)'] // Default fallback
]);

export const clickhouseToKafka: Map<string, string> = new Map([
    // Integer Types
    ['UINT8', 'INT8'],
    ['UINT16', 'INT16'],
    ['UINT32', 'INT32'],
    ['INT8', 'INT8'],
    ['INT16', 'INT16'],
    ['INT32', 'INT32'],
    ['INT64', 'INT64'],
    ['INT128', 'STRING'],
    ['INT256', 'STRING'],
    ['UINT64', 'STRING'],
    ['UINT128', 'STRING'],
    ['UINT256', 'STRING'],

    // Floating Point Types
    ['FLOAT32', 'FLOAT'],
    ['FLOAT64', 'DOUBLE'],

    // Decimal Types
    ['DECIMAL', 'DECIMAL'],

    // String Types
    ['STRING', 'STRING'],
    ['FIXEDSTRING', 'STRING'],
    ['UUID', 'STRING'],
    ['IPV4', 'STRING'],
    ['IPV6', 'STRING'],

    // Date and Time Types
    ['DATE', 'DATE'],
    ['DATE32', 'DATE'],
    ['DATETIME', 'TIMESTAMP'],
    ['DATETIME64', 'TIMESTAMP'],

    // JSON and Semi-Structured Data
    ['JSON', 'STRING'],
    ['MAP', 'STRING'],
    ['OBJECT', 'STRING'],

    // Array Types
    ['ARRAY', 'STRING'],

    // Boolean Type
    ['BOOLEAN', 'BOOLEAN'],

    // Geographic and Geometry Types
    ['GEO', 'STRING'],
    ['POINT', 'STRING'],
    ['RING', 'STRING'],
    ['LINESTRING', 'STRING'],
    ['MULTILINESTRING', 'STRING'],
    ['POLYGON', 'STRING'],

    // Miscellaneous Types
    ['TUPLE', 'STRING'],
    ['NOTHING', 'NULL'],
    ['BINARY', 'BYTES'],
    ['DEFAULT', 'STRING']
]);


export const typeMatrix = new Map([
    [WarehouseDataType.Snowflake, clickhouseToSnowflake],
    [WarehouseDataType.BigQuery, clickhouseToBigQuery],
    [WarehouseDataType.Redshift, clickhouseToRedshift],
    [WarehouseDataType.Databricks, clickhouseToDatabricks],
    [WarehouseDataType.Kafka, clickhouseToKafka]
]);

export { WarehouseDataType };