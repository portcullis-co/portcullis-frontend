enum WarehouseType {
    Clickhouse = "Clickhouse",
    Snowflake = "Snowflake",
    BigQuery = "BigQuery",
    Redshift = "Redshift",
    AzureSynapse = "AzureSynapse",
    IBMDb2 = "IBMDb2",
    Oracle = "Oracle",
    Teradata = "Teradata",
    SAPDWC = "SAPDWC",
    Firebolt = "Firebolt"
}

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
    WarehouseType,
    TypeMappings,
    typeMatrix,
    clickhouseToSnowflake,
    clickhouseToBigQuery
};