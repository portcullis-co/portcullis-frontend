/**
 * Converts ClickHouse data types to Snowflake data types.
 * @param clickhouseType - The ClickHouse data type to convert.
 * @returns The corresponding Snowflake data type.
 */

export function convertClickhouseToSnowflake(clickhouseType: string, value: any): any {
    if (clickhouseType.startsWith('Nullable(')) {
        const innerType = clickhouseType.slice(9, -1); // Extract the inner type
        if (value === null) {
            return null; // Return null for Nullable types
        }
        // Recursively call the function for the inner type
        return convertClickhouseToSnowflake(innerType, value);
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
            return Number(value); // Convert to number

        case 'Float32':
        case 'Float64':
            return parseFloat(value); // Convert to float

        case 'Decimal':
            return parseFloat(value); // Convert to decimal

        case 'String':
        case 'FixedString':
            return String(value); // Convert to string

        case 'Date':
        case 'Date32':
            return new Date(value); // Convert to date

        case 'DateTime':
        case 'DateTime64':
            return new Date(value); // Convert to timestamp

        case 'Enum':
            return String(value); // Convert to string

        case 'Bool':
            return Boolean(value); // Convert to boolean

        case 'UUID':
            return String(value); // Convert to UUID

        case 'IPv4':
        case 'IPv6':
            return String(value); // Convert to string

        case 'Array':
            return JSON.parse(value); // Convert to array

        case 'Tuple':
            return JSON.parse(value); // Convert to object

        case 'Map':
            return JSON.parse(value); // Convert to object

        case 'Variant':
            return JSON.parse(value); // Convert to variant

        case 'Geo':
            return JSON.parse(value); // Convert to geography

        case 'JSON':
            return JSON.parse(value); // Convert to JSON

        default:
            throw new Error(`Unsupported ClickHouse type: ${clickhouseType}`);
    }
}

/**
 * Upserts data into Snowflake based on the link type.
 * @param snowflakeClient - The Snowflake client instance.
 * @param tableName - The name of the table to upsert data into.
 * @param data - The data to upsert.
 */
export async function upsertToSnowflake(snowflakeClient: any, tableName: string, data: any) {
    // Implement different upsert logic based on linkType if needed
    const columns = Object.keys(data);
    const values = Object.values(data);

    const query = `
        MERGE INTO ${tableName} AS target
        USING (SELECT ${values.map((v, i) => `$${i + 1} AS value${i}`).join(', ')}) AS source
        ON target.id = source.value0
        WHEN MATCHED THEN
            UPDATE SET ${columns.map((col, i) => `target.${col} = source.value${i}`).join(', ')}
        WHEN NOT MATCHED THEN
            INSERT (${columns.join(', ')}) VALUES (${columns.map((_, i) => `source.value${i}`).join(', ')});
    `;

    await snowflakeClient.execute({
        sqlText: query,
        binds: values,
    });
}