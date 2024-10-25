/**
 * Converts ClickHouse data types to Snowflake data types.
 * @param clickhouseType - The ClickHouse data type to convert.
 * @returns The corresponding Snowflake data type.
 */
export function getSnowflakeDataType(clickhouseType: string): string {
    // Guard against undefined or null input
    if (!clickhouseType) {
        console.warn('Received undefined or null ClickHouse type, defaulting to VARCHAR');
        return 'VARCHAR';
    }

    // Ensure we're working with a string
    const type = String(clickhouseType).trim();

    // Handle nullable types
    if (type.startsWith('Nullable(')) {
        try {
            const innerType = type.slice(9, -1);
            return getSnowflakeDataType(innerType);
        } catch (error) {
            console.warn(`Error processing Nullable type: ${type}, defaulting to VARCHAR`);
            return 'VARCHAR';
        }
    }

    // Handle LowCardinality types
    if (type.startsWith('LowCardinality(')) {
        try {
            const innerType = type.slice(15, -1);
            return getSnowflakeDataType(innerType);
        } catch (error) {
            console.warn(`Error processing LowCardinality type: ${type}, defaulting to VARCHAR`);
            return 'VARCHAR';
        }
    }

    // Handle Enum types
    if (type.startsWith('Enum8(') || type.startsWith('Enum16(') || type === 'Enum8' || type === 'Enum16') {
        return 'VARCHAR';
    }

    // Main type conversion switch
    switch (type) {
        case 'UInt8':
        case 'UInt16':
        case 'Int8':
        case 'Int16':
            return 'NUMBER(5,0)';
            
        case 'UInt32':
        case 'Int32':
            return 'NUMBER(10,0)';
            
        case 'UInt64':
        case 'Int64':
            return 'NUMBER(20,0)';

        case 'Float32':
            return 'FLOAT';
            
        case 'Float64':
            return 'DOUBLE';

        case 'Decimal':
            return 'NUMBER(38,6)';

        case 'String':
        case 'FixedString':
            return 'VARCHAR';

        case 'Date':
        case 'Date32':
            return 'DATE';

        case 'DateTime':
        case 'DateTime64':
            return 'TIMESTAMP_NTZ';

        case 'Bool':
            return 'BOOLEAN';

        case 'UUID':
            return 'VARCHAR(36)';

        case 'IPv4':
            return 'VARCHAR(15)';
            
        case 'IPv6':
            return 'VARCHAR(45)';

        case 'Array':
            return 'ARRAY';

        case 'Tuple':
        case 'Map':
        case 'Variant':
        case 'JSON':
            return 'VARIANT';

        case 'Geo':
            return 'GEOGRAPHY';

        default:
            console.warn(`Unsupported ClickHouse type: ${type}, defaulting to VARCHAR`);
            return 'VARCHAR';
    }
}

/**
 * Converts ClickHouse data values to Snowflake-compatible values.
 * @param clickhouseType - The ClickHouse data type to convert.
 * @param value - The value to convert.
 * @returns The converted value.
 */
export function convertClickhouseToSnowflake(clickhouseType: string, value: any): any {
    // Handle null values early
    if (value === null || value === undefined) {
        return null;
    }

    // Guard against undefined or null type
    if (!clickhouseType) {
        console.warn('Received undefined or null ClickHouse type, treating value as string');
        return String(value);
    }

    // Ensure we're working with a string type
    const type = String(clickhouseType).trim();

    try {
        // Handle Nullable types
        if (type.startsWith('Nullable(')) {
            const innerType = type.slice(9, -1);
            return convertClickhouseToSnowflake(innerType, value);
        }

        // Handle LowCardinality types
        if (type.startsWith('LowCardinality(')) {
            const innerType = type.slice(15, -1);
            return convertClickhouseToSnowflake(innerType, value);
        }

        // Handle Enum types
        if (type.startsWith('Enum8(') || type.startsWith('Enum16(') || type === 'Enum8' || type === 'Enum16') {
            return String(value);
        }

        switch (type) {
            case 'UInt8':
            case 'UInt16':
            case 'UInt32':
            case 'UInt64':
            case 'Int8':
            case 'Int16':
            case 'Int32':
            case 'Int64':
                return value === '' ? null : Number(value);

            case 'Float32':
            case 'Float64':
            case 'Decimal':
                return value === '' ? null : parseFloat(value);

            case 'String':
            case 'FixedString':
                return String(value);

            case 'Date':
            case 'Date32':
            case 'DateTime':
            case 'DateTime64':
                return value ? new Date(value) : null;

            case 'Bool':
                return Boolean(value);

            case 'UUID':
            case 'IPv4':
            case 'IPv6':
                return String(value);

            case 'Array':
                if (Array.isArray(value)) return value;
                try {
                    return JSON.parse(value);
                } catch {
                    return [];
                }

            case 'Tuple':
            case 'Map':
            case 'Variant':
            case 'JSON':
            case 'Geo':
                if (typeof value === 'object') return value;
                try {
                    return JSON.parse(value);
                } catch {
                    return null;
                }

            default:
                console.warn(`Unsupported ClickHouse type: ${type}, converting to string`);
                return String(value);
        }
    } catch (error) {
        console.error(`Error converting value for type ${type}:`, error);
        return null;
    }
}

/**
 * Upserts data into Snowflake based on the link type.
 * @param snowflakePool - The Snowflake connection pool instance.
 * @param tableName - The name of the table to upsert data into.
 * @param batch - Array of records to upsert.
 */
export async function upsertToSnowflake(snowflakePool: any, tableName: string, batch: Record<string, any>[]) {
    if (batch.length === 0) return;

    const columns = Object.keys(batch[0]);
    
    const valuesSql = batch.map((_, index) => 
        `(${columns.map(() => '?').join(', ')})`
    ).join(',\n');

    const binds: any[] = batch.flatMap(record => 
        columns.map(col => record[col])
    );

    const query = `
        MERGE INTO ${tableName} AS target
        USING (
            SELECT * FROM (
                VALUES 
                ${valuesSql}
            ) as source(${columns.join(', ')})
        ) AS source
        ON target.id = source.id
        WHEN MATCHED THEN
            UPDATE SET ${columns.map(col => `target.${col} = source.${col}`).join(', ')}
        WHEN NOT MATCHED THEN
            INSERT (${columns.join(', ')}) 
            VALUES (${columns.map(col => `source.${col}`).join(', ')});
    `;

    console.log('Executing Snowflake query:', query);
    console.log('Binds array length:', binds.length);
    console.log('First few binds:', binds.slice(0, 5));

    return new Promise((resolve, reject) => {
        snowflakePool.use(async (clientConnection: any) => {
            clientConnection.execute({
                sqlText: query,
                binds: binds,
                complete: function(err: Error | undefined, stmt: any, rows: any) {
                    if (err) {
                        console.error('Error executing Snowflake query:', err);
                        reject(err);
                    } else {
                        console.log('Snowflake query executed successfully');
                        resolve(rows);
                    }
                }
            });
        });
    });
}

/**
 * Helper function to generate Snowflake CREATE TABLE SQL
 */
export function generateSnowflakeCreateTableSQL(tableName: string, columns: { name: string; type: string }[]): string {
    const columnDefinitions = columns
        .map(col => `"${col.name}" ${getSnowflakeDataType(col.type)}`)
        .join(',\n    ');

    return `
CREATE TABLE IF NOT EXISTS ${tableName} (
    ${columnDefinitions}
);`.trim();
}