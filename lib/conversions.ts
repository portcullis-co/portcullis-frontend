/**
 * Converts ClickHouse data types to Snowflake data types.
 * @param clickhouseType - The ClickHouse data type to convert.
 * @returns The corresponding Snowflake data type.
 */

export function getSnowflakeDataType(clickhouseType: string): string {
    if (clickhouseType.startsWith('Nullable(')) {
        const innerType = clickhouseType.slice(9, -1);
        return getSnowflakeDataType(innerType);
    }

    // Explicitly match Enum8 and Enum16 types
    if (clickhouseType === 'Enum8' || clickhouseType === 'Enum16') {
        return 'VARCHAR'; // Map Enum types to VARCHAR
    }

    // Handle LowCardinality types
    if (clickhouseType.startsWith('LowCardinality(')) {
        const innerType = clickhouseType.slice(15, -1); // Extract the inner type
        return getSnowflakeDataType(innerType); // Map to the inner type
    }

    // Handle Enum types with specific definitions
    if (clickhouseType.startsWith('Enum8(') || clickhouseType.startsWith('Enum16(')) {
        return 'VARCHAR'; // Map Enum types to VARCHAR
    }

    switch (clickhouseType) {
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
            throw new Error(`Unsupported ClickHouse type: ${clickhouseType}`);
    }
}

/**
 * Parse enum value from ClickHouse enum definition
 * @param value - The numeric enum value
 * @param enumType - The full enum type definition
 * @returns The string representation of the enum value
 */
function parseEnumValue(value: number, enumType: string): string {
    const enumRegex = /'([^']+)'\s*=\s*(\d+)/g;
    let match;

    while ((match = enumRegex.exec(enumType)) !== null) {
        if (Number(match[2]) === value) {
            return match[1]; // Return the string representation of the enum
        }
    }

    return String(value); // Fallback to string representation of number
}

/**
 * Converts ClickHouse data types to Snowflake data types.
 * @param clickhouseType - The ClickHouse data type to convert.
 * @param value - The value to convert.
 * @returns The converted value.
 */
export function convertClickhouseToSnowflake(clickhouseType: string, value: any): any {
    if (value === null) return null;

    // Handle Nullable types
    if (clickhouseType.startsWith('Nullable(')) {
        const innerType = clickhouseType.slice(9, -1);
        return convertClickhouseToSnowflake(innerType, value);
    }

    // Handle LowCardinality types
    if (clickhouseType.startsWith('LowCardinality(')) {
        const innerType = clickhouseType.slice(15, -1); // Extract the inner type
        return convertClickhouseToSnowflake(innerType, value); // Map to the inner type
    }

    // Explicitly match Enum8 and Enum16 types
    if (clickhouseType === 'Enum8' || clickhouseType === 'Enum16') {
        return parseEnumValue(value, clickhouseType); // Convert numeric value to string representation
    }

    // Handle Enum types with specific definitions
    if (clickhouseType.startsWith('Enum8(') || clickhouseType.startsWith('Enum16(')) {
        return parseEnumValue(value, clickhouseType); // Convert numeric value to string representation
    }

    switch (clickhouseType) {
        case 'UInt8':
        case 'UInt16':
        case 'UInt32':
        case 'UInt64':
        case 'Int8':
        case 'Int16':
        case 'Int32':
        case 'Int64':
            return Number(value);

        case 'Float32':
        case 'Float64':
            return parseFloat(value);

        case 'Decimal':
            return parseFloat(value);

        case 'String':
        case 'FixedString':
            return String(value);

        case 'Date':
        case 'Date32':
            return new Date(value);

        case 'DateTime':
        case 'DateTime64':
            return new Date(value);

        case 'Bool':
            return Boolean(value);

        case 'UUID':
            return String(value);

        case 'IPv4':
        case 'IPv6':
            return String(value);

        case 'Array':
            return Array.isArray(value) ? value : JSON.parse(value);

        case 'Tuple':
        case 'Map':
        case 'Variant':
        case 'JSON':
            return typeof value === 'object' ? value : JSON.parse(value);

        case 'Geo':
            return typeof value === 'object' ? value : JSON.parse(value);

        default:
            throw new Error(`Unsupported ClickHouse type: ${clickhouseType}`);
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

    // Get columns from the first record
    const columns = Object.keys(batch[0]);
    
    // Create VALUES part of the query for each row in the batch
    const valuesSql = batch.map((_, index) => 
        `(${columns.map((_, colIndex) => `$${index * columns.length + colIndex + 1}`).join(', ')})`
    ).join(',\n');

    // Flatten all values for binding
    const values = batch.flatMap(record => columns.map(col => {
        const value = record[col];
        if (value === undefined) {
            console.warn(`Undefined value for column ${col} in record:`, record);
        }
        return value; // Return the value, which may be undefined
    }));

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

    return new Promise((resolve, reject) => {
        snowflakePool.use(async (clientConnection: any) => {
            clientConnection.execute({
                sqlText: query,
                binds: values,
                complete: function(err: Error | undefined, stmt: any, rows: any) {
                    if (err) {
                        reject(err);
                    } else {
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