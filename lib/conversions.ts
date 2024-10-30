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

    // Handle Decimal types with precision and scale
    if (type.startsWith('Decimal')) {
        const match = type.match(/Decimal\((\d+),\s*(\d+)\)/);
        if (match) {
            const [, precision, scale] = match;
            return `NUMBER(${precision},${scale})`;
        }
        return 'NUMBER(38,6)'; // Default if no precision/scale specified
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
    console.log(`Converting: type=${clickhouseType}, value=${value}`);
    if (value === null || value === undefined) {
        return null;
    }

    // If value is an object with a 'text' property, use that
    if (typeof value === 'object' && value !== null && 'text' in value) {
        console.log('Value is an object with text property, using text value');
        value = value.text;
    }

    // Handle Nullable types
    if (clickhouseType.includes('Nullable')) {
        const innerType = clickhouseType.slice(9, -1);
        console.log(`Handling Nullable type, inner type: ${innerType}`);
        return convertClickhouseToSnowflake(innerType, value);
    }

    // Handle LowCardinality types
    if (clickhouseType.startsWith('LowCardinality(')) {
        const innerType = clickhouseType.slice(15, -1);
        return convertClickhouseToSnowflake(innerType, value);
    }

    if (clickhouseType.startsWith('Enum8(') || clickhouseType.startsWith('Enum16(') || clickhouseType === 'Enum8' || clickhouseType === 'Enum16') {
        return value === '' ? null : String(value);
    }

    // Guard against undefined or null type
    if (!clickhouseType) {
        console.warn('Received undefined or null ClickHouse type, treating value as string');
        return String(value);
    }

    // Ensure we're working with a string type
    const type = String(clickhouseType).replace(/^Nullable\((.+)\)$/, '$1').trim();

    try {

        switch (type) {
            case 'UInt8':
            case 'UInt16':
            case 'UInt32':
            case 'UInt64':
            case 'Int8':
            case 'Int16':
            case 'Int32':
            case 'Int64':
                const numValue = value === '' ? null : Number(value);
                console.log(`Converting to number: ${numValue}`);
                return numValue === null || isNaN(numValue) ? null : numValue;
            case 'Float32':
                case 'Float64':
                    const floatValue = value === '' ? null : Number(value);
                    return floatValue === null || isNaN(floatValue) ? null : floatValue;
                case 'Decimal':
                    const decimalValue = value === '' ? null : parseFloat(value);
                    return decimalValue === null || isNaN(decimalValue) ? null : decimalValue;

            case 'String':
            case 'FixedString':
                return value === null ? null : String(value);

            case 'Date':
            case 'Date32':
                if (value === '') return null;
                return new Date(value).toISOString().split('T')[0];
            case 'DateTime':
                case 'DateTime64':
                    if (value === '') return null;
                    try {
                        const date = new Date(value);
                        if (isNaN(date.getTime())) {
                            console.warn(`Invalid DateTime value: ${value}, returning null`);
                            return null;
                        }
                        return date.toISOString().replace('T', ' ').split('.')[0];
                    } catch (error) {
                        console.warn(`Error converting DateTime value: ${value}, returning null`);
                        return null;
                    }
            case 'Bool':
                return value === '' ? null : Boolean(value);
            case 'UUID':
            case 'IPv4':
            case 'IPv6':
                return value === '' ? null : String(value);
            case 'Array':
                if (typeof value === 'string') {
                    try {
                        return JSON.parse(value);
                    } catch {
                        return null;
                    }
                }
                return Array.isArray(value) ? value : null;

            case 'Tuple':
            case 'Map':
            case 'Variant':
            case 'JSON':
            case 'Geo':
                if (typeof value === 'string') {
                    try {
                        return JSON.parse(value);
                    } catch {
                        return null;
                    }
                }
                return Array.isArray(value) ? value : null;

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

    // Get all columns except metadata
    const columns = Object.keys(batch[0]).filter(key => key !== '__metadata');
    
    // Get primary keys from metadata, fallback to first column if none found
    const primaryKeys = batch[0].__metadata?.primaryKeys || [columns[0]];
    console.log('Primary keys:', primaryKeys);
    console.log('All columns:', columns);

    // First, try to deduplicate the batch based on primary keys
    const deduplicatedBatch = batch.reduce((acc: Record<string, any>[], curr: Record<string, any>) => {
        const key = primaryKeys.map((pk: string) => curr[pk]).join('|');
        const existing = acc.findIndex(item => 
            primaryKeys.map((pk: string) => item[pk]).join('|') === key
        );
        
        if (existing === -1) {
            acc.push(curr);
        } else {
            // Update existing record with new values
            acc[existing] = { ...acc[existing], ...curr };
        }
        return acc;
    }, []);

    console.log(`Reduced batch from ${batch.length} to ${deduplicatedBatch.length} records after deduplication`);

    const valuesSql = deduplicatedBatch.map(() => `(${columns.map(() => '?').join(', ')})`).join(',\n');
    const binds: any[] = deduplicatedBatch.flatMap(record => columns.map(col => record[col]));

    // Build ON clause using all primary keys
    const onConditions = primaryKeys
        .map((key: string) => `target."${key}" = source."${key}"`)
        .join(' AND ');

    // Only update non-primary key columns
    const updateColumns = columns
        .filter(col => !primaryKeys.includes(col))
        .map(col => `target."${col}" = source."${col}"`);

    const query = `
        MERGE INTO ${tableName} AS target
        USING (
            SELECT DISTINCT ${columns.map(col => `source."${col}"`).join(', ')}
            FROM (
                SELECT * FROM (
                    VALUES 
                    ${valuesSql}
                )
            ) as source(${columns.map(col => `"${col}"`).join(', ')})
        ) AS source
        ON ${onConditions}
        WHEN MATCHED THEN
            UPDATE SET ${updateColumns.join(', ')}
        WHEN NOT MATCHED THEN
            INSERT (${columns.map(col => `"${col}"`).join(', ')}) 
            VALUES (${columns.map(col => `source."${col}"`).join(', ')});
    `;

    console.log('Executing MERGE query:', query);
    console.log('With binds:', binds);

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