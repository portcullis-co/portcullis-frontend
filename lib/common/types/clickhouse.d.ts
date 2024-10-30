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
    GEOJSON = "GEOJSON"
  }
  
  type DataWarehouseMapping = {
    [key in DataWarehouseDataType]: {
      redshift?: string;
      bigquery?: string;
      snowflake?: string;
      azureSynapse?: string;
      ibmDb2?: string;
      oracle?: string;
      teradata?: string;
      sapDwc?: string;
      clickhouse?: string;
      firebolt?: string;
    };
  };
  
  const dataWarehouseTypeMapping: DataWarehouseMapping = {
    [DataWarehouseDataType.INTEGER]: {
      redshift: "INTEGER",
      bigquery: "INT64",
      snowflake: "INTEGER",
      azureSynapse: "INT",
      ibmDb2: "INTEGER",
      oracle: "NUMBER",
      teradata: "INTEGER",
      sapDwc: "INT",
      clickhouse: "Int32",
      firebolt: "INTEGER"
      // TODO: Add databricks
      // TODO: Add SQL
      // TODO: Add Kafka
    },
    [DataWarehouseDataType.SMALLINT]: {
      redshift: "SMALLINT",
      bigquery: "INT64",
      snowflake: "SMALLINT",
      azureSynapse: "SMALLINT",
      ibmDb2: "SMALLINT",
      oracle: "NUMBER(5,0)",
      teradata: "BYTEINT",
      sapDwc: "SMALLINT",
      clickhouse: "Int16",
      firebolt: "SMALLINT"
      // TODO: Add databricks
      // TODO: Add SQL
      // TODO: Add Kafka
    },
    [DataWarehouseDataType.BIGINT]: {
      redshift: "BIGINT",
      bigquery: "INT64",
      snowflake: "BIGINT",
      azureSynapse: "BIGINT",
      ibmDb2: "BIGINT",
      oracle: "NUMBER(19,0)",
      teradata: "BIGINT",
      sapDwc: "BIGINT",
      clickhouse: "Int64",
      firebolt: "BIGINT", 
      // TODO: Add databricks
      // TODO: Add SQL
      // TODO: Add Kafka
    },
    [DataWarehouseDataType.FLOAT]: {
      redshift: "FLOAT4",
      bigquery: "FLOAT64",
      snowflake: "FLOAT",
      azureSynapse: "REAL",
      ibmDb2: "REAL",
      oracle: "BINARY_FLOAT",
      teradata: "FLOAT",
      sapDwc: "FLOAT",
      clickhouse: "Float32",
      firebolt: "FLOAT",
      // TODO: Add databricks
      // TODO: Add SQL
      // TODO: Add Kafka
    },
    [DataWarehouseDataType.DOUBLE]: {
      redshift: "DOUBLE PRECISION",
      bigquery: "FLOAT64",
      snowflake: "DOUBLE",
      azureSynapse: "DOUBLE PRECISION",
      ibmDb2: "DOUBLE",
      oracle: "BINARY_DOUBLE",
      teradata: "FLOAT",
      sapDwc: "DOUBLE",
      clickhouse: "Float64",
      firebolt: "DOUBLE",
      // TODO: Add databricks
      // TODO: Add SQL
      // TODO: Add Kafka
    },
    [DataWarehouseDataType.VARCHAR]: {
      redshift: "VARCHAR",
      bigquery: "STRING",
      snowflake: "VARCHAR",
      azureSynapse: "VARCHAR",
      ibmDb2: "VARCHAR",
      oracle: "VARCHAR2",
      teradata: "VARCHAR",
      sapDwc: "VARCHAR",
      clickhouse: "String",
      firebolt: "STRING",
      // TODO: Add databricks
      // TODO: Add SQL
      // TODO: Add Kafka
    },
    [DataWarehouseDataType.BOOLEAN]: {
      redshift: "BOOLEAN",
      bigquery: "BOOL",
      snowflake: "BOOLEAN",
      azureSynapse: "BIT",
      ibmDb2: "BOOLEAN",
      oracle: "NUMBER(1,0)",
      teradata: "BYTEINT",
      sapDwc: "BOOLEAN",
      clickhouse: "UInt8",
      firebolt: "BOOLEAN",
      // TODO: Add databricks
      // TODO: Add SQL
      // TODO: Add Kafka
    },
    [DataWarehouseDataType.DATE]: {
      redshift: "DATE",
      bigquery: "DATE",
      snowflake: "DATE",
      azureSynapse: "DATE",
      ibmDb2: "DATE",
      oracle: "DATE",
      teradata: "DATE",
      sapDwc: "DATE",
      clickhouse: "Date",
      firebolt: "DATE",
      // TODO: Add databricks
      // TODO: Add SQL
      // TODO: Add Kafka
    },
    [DataWarehouseDataType.TIMESTAMP]: {
      redshift: "TIMESTAMP",
      bigquery: "TIMESTAMP",
      snowflake: "TIMESTAMP",
      azureSynapse: "TIMESTAMP",
      ibmDb2: "TIMESTAMP",
      oracle: "TIMESTAMP",
      teradata: "TIMESTAMP",
      sapDwc: "TIMESTAMP",
      clickhouse: "DateTime",
      firebolt: "TIMESTAMP",
      // TODO: Add databricks
      // TODO: Add SQL
      // TODO: Add Kafka
    },
    [DataWarehouseDataType.TIME]: {
      redshift: "TIME",
      bigquery: "TIME",
      snowflake: "TIME",
      azureSynapse: "TIME",
      ibmDb2: "TIME",
      oracle: "TIMESTAMP", // Oracle often uses TIMESTAMP for time as well
      teradata: "TIME",
      sapDwc: "TIME",
      clickhouse: "DateTime",
      firebolt: "TIME",
      // TODO: Add databricks
      // TODO: Add SQL
      // TODO: Add Kafka
    },
    [DataWarehouseDataType.DECIMAL]: {
      redshift: "DECIMAL",
      bigquery: "NUMERIC",
      snowflake: "DECIMAL",
      azureSynapse: "DECIMAL",
      ibmDb2: "DECIMAL",
      oracle: "NUMBER",
      teradata: "DECIMAL",
      sapDwc: "DECIMAL",
      clickhouse: "Decimal64",
      firebolt: "DECIMAL",
      // TODO: Add databricks
      // TODO: Add SQL
      // TODO: Add Kafka
    },
    [DataWarehouseDataType.UUID]: {
      redshift: "VARCHAR", // UUID in VARCHAR format
      bigquery: "STRING", // UUID in STRING format
      snowflake: "UUID",
      azureSynapse: "UNIQUEIDENTIFIER",
      ibmDb2: "VARCHAR", // UUID in VARCHAR format
      oracle: "RAW(16)",
      teradata: "VARCHAR", // UUID in VARCHAR format
      sapDwc: "UUID",
      clickhouse: "UUID",
      firebolt: "UUID",
      // TODO: Add databricks
      // TODO: Add SQL
      // TODO: Add Kafka
    },
    [DataWarehouseDataType.JSON]: {
      redshift: "SUPER",
      bigquery: "JSON",
      snowflake: "VARIANT",
      azureSynapse: "NVARCHAR",
      ibmDb2: "JSON",
      oracle: "CLOB",
      teradata: "JSON",
      sapDwc: "JSON",
      clickhouse: "JSON",
      firebolt: "JSON",
      // TODO: Add databricks
      // TODO: Add SQL
      // TODO: Add Kafka
    },
    [DataWarehouseDataType.ARRAY]: {
      redshift: "SUPER",
      bigquery: "ARRAY",
      snowflake: "ARRAY",
      azureSynapse: NULL,
      ibmDb2: "ARRAY",
      oracle: NULL,
      teradata: "ARRAY",
      sapDwc: "ARRAY",
      clickhouse: "Array",
      firebolt: "ARRAY",
      // TODO: Add databricks
      // TODO: Add SQL
      // TODO: Add Kafka
    },
    [DataWarehouseDataType.BINARY]: {
      redshift: "BYTEA",
      bigquery: "BYTES",
      snowflake: "BINARY",
      azureSynapse: "VARBINARY",
      ibmDb2: "BLOB",
      oracle: "RAW",
      teradata: "BLOB",
      sapDwc: "BINARY",
      clickhouse: "String (base64)",
      firebolt: "BINARY",
      // TODO: Add databricks
      // TODO: Add SQL
      // TODO: Add Kafka
    },
    [DataWarehouseDataType.GEOGRAPHY]: {
      redshift: NULL,
      bigquery: "GEOGRAPHY",
      snowflake: "GEOGRAPHY",
      azureSynapse: NULL,
      ibmDb2: "ST_GEOMETRY",
      oracle: "SDO_GEOMETRY",
      teradata: "GEOGRAPHY",
      sapDwc: "GEOJSON",
      clickhouse: NULL,
      firebolt: "GEOGRAPHY",
      // TODO: Add databricks
      // TODO: Add SQL
      // TODO: Add Kafka
    }
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

export type AzureSynapseCredentials = {
    server: string
    database: string
    authentication: {
        type: 'default' | 'azure-active-directory'
        options: {
            userName?: string
            password?: string
            token?: string
        }
    }
}

export type IBMDb2Credentials = {
    database: string
    hostname: string
    port: number
    username: string
    password: string
    security?: {
        ssl: boolean
        sslServerCert?: string
    }
}

export type OracleCredentials = {
    user: string
    password: string
    connectString: string  // host:port/service_name
    privilege?: 'SYSDBA' | 'SYSOPER'
}

export type TeradataCredentials = {
    host: string
    username: string
    password: string
    database?: string
    logmech?: 'TD2' | 'LDAP' | 'KRB5'
}

export type SAPDWCCredentials = {
    host: string
    port: number
    username: string
    password: string
    schema: string
    hanaOptions?: {
        encrypt?: boolean
        sslValidateCertificate?: boolean
    }
}

export type FireboltCredentials = {
    username: string
    password: string
    database: string
    engine?: string
    account?: string
}

export type DatabricksCredentials = {
    host: string
    token: string
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
    [WarehouseType.AzureSynapse]: AzureSynapseCredentials
    [WarehouseType.IBMDb2]: IBMDb2Credentials
    [WarehouseType.Oracle]: OracleCredentials
    [WarehouseType.Teradata]: TeradataCredentials
    [WarehouseType.SAPDWC]: SAPDWCCredentials
    [WarehouseType.Firebolt]: FireboltCredentials
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

// Example implementation for Clickhouse to Snowflake
const clickhouseToSnowflake: Map<string, string> = new Map([
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

const clickhouseToBigQuery: Map<string, string> = new Map([
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

const typeMatrix: Map<WarehouseType, Map<string, string>> = new Map([
    [WarehouseType.Snowflake, clickhouseToSnowflake],
    [WarehouseType.BigQuery, clickhouseToBigQuery],
    // Add more mappings as needed
]);

export {
    WarehouseDataType,
    TypeMappings,
    typeMatrix,
    clickhouseToSnowflake,
    clickhouseToBigQuery
};