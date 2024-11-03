export enum WarehouseDataType {
    // Integer Types
    INTEGER = "INTEGER",
    SMALLINT = "SMALLINT",
    BIGINT = "BIGINT",
  
    // Floating-Point Types
    FLOAT = "FLOAT",
    DOUBLE = "DOUBLE",
    REAL = "REAL",
    FLOAT4 = "FLOAT4",
    FLOAT8 = "FLOAT8",
    
    // String Types
    VARCHAR = "VARCHAR",
    STRING = "STRING",
    TEXT = "TEXT",
  
    // Boolean Type
    BOOLEAN = "BOOLEAN",
  
    // Date and Time Types
    DATE = "DATE",
    TIME = "TIME",
    TIMESTAMP = "TIMESTAMP",
    DATETIME = "DATETIME",
  
    // Numeric/Decimal Types
    DECIMAL = "DECIMAL",
    NUMERIC = "NUMERIC",
    NUMBER = "NUMBER",
  
    // UUID Type
    UUID = "UUID",
  
    // JSON Type
    JSON = "JSON",
    VARIANT = "VARIANT",
  
    // Array Type
    ARRAY = "ARRAY",
  
    // Binary Type
    BINARY = "BINARY",
    BYTEA = "BYTEA",
    BYTES = "BYTES",
    BLOB = "BLOB",
    RAW = "RAW",
    VARBINARY = "VARBINARY",
  
    // Geospatial Types
    GEOGRAPHY = "GEOGRAPHY",
    GEOMETRY = "GEOMETRY",
    ST_GEOMETRY = "ST_GEOMETRY",
    SDO_GEOMETRY = "SDO_GEOMETRY",
    GEOJSON = "GEOJSON",
    Snowflake = "Snowflake",
    BigQuery = "BigQuery",
    Redshift = "Redshift",
    Databricks = "Databricks",
    Kafka = "Kafka"
  }
  
export type WarehouseMapping = {
    [key in WarehouseDataType]: {
      redshift?: string;
      bigquery?: string;
      snowflake?: string;
      databricks?: string;
      sql?: string;
      clickhouse?: string;
      kafka?: string;
    };
  };
  

// Credential types for each warehouse
export type ClickhouseCredentials = {
    host: string
    port: number
    database: string
    username: string
    password: string
}

export type SnowflakeCredentials = {
    account: string
    username: string
    password: string
    warehouse: string
    database: string
    schema: string
}

export type BigQueryCredentials = {
    projectId: string
    dataset: string
    keyFilename: string  // Path to service account key file
    // Or
    credentials: {
        client_email: string
        private_key: string
        project_id: string
    }
}

export type RedshiftCredentials = {
    host: string
    port: number
    database: string
    username: string
    password: string
    cluster: string
}

export type DatabricksCredentials = {
    host: string
    token: string
    httpPath: string
}

export type SQLCredentials = {
    host: string
    port: number
    database: string
    username: string
    password: string
}

export type KafkaCredentials = {
    host: string
    port: number
    topic: string
}

// Union type of all credentials
export type WarehouseCredentials = {
    [WarehouseType.Clickhouse]: ClickhouseCredentials
    [WarehouseType.Snowflake]: SnowflakeCredentials
    [WarehouseType.BigQuery]: BigQueryCredentials
    [WarehouseType.Redshift]: RedshiftCredentials
    [WarehouseType.Databricks]: DatabricksCredentials
    [WarehouseType.SQL]: SQLCredentials
    [WarehouseType.Kafka]: KafkaCredentials
}

// Helper type to get credentials type for a specific warehouse
export type CredentialsFor<T extends WarehouseType> = WarehouseCredentials[T]

// Create type mappings for each source/destination pair
type TypeMappings = {
    [K in WarehouseType]: {
        [T in WarehouseType]: {
            // Common data types
            Int32: string;
            Int64: string;
            Int16: string;
            Float32: string;
            Float64: string;
            String: string;
            UInt8: string;  // For boolean
            Date: string;
            DateTime: string;
            Decimal: string;
            UUID: string;
            JSON: string;
            Array: string;
            Binary: string;
        }
    }
}

export {
    TypeMappings,
    typeMatrix,
    clickhouseToSnowflake,
    clickhouseToBigQuery,
    clickhouseToRedshift,
    clickhouseToDatabricks, 
    clickhouseToSQL,
    clickhouseToKafka
};