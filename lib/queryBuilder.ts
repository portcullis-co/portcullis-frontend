// Utility function to sanitize the table name
export function sanitizeIdentifier(identifier: string, toUpperCase: boolean = false): string {
    // Remove any invalid characters and spaces
    const sanitized = identifier
        .replace(/[^\w\d_]/g, '_')  // Replace invalid chars with underscore
        .replace(/^[\d]/, '_$&');   // Prefix with underscore if starts with number
    
    // Only convert to uppercase if explicitly requested (for Snowflake)
    return toUpperCase ? sanitized.toUpperCase() : sanitized;
}

interface QueryParams {
    table: string;
    conditions?: { [column: string]: any };
    columns?: string[];
}

// Generalized query builder function

interface QueryParams {
    table: string;
    conditions?: { [column: string]: any };
    columns?: string[];
}

export function buildClickHouseQuery({
    table,
    conditions = {},
    columns = ['*'],
}: QueryParams): { query: string; params: Record<string, any> } {
    // Sanitize table name and column names
    const sanitizedTable = sanitizeIdentifier(table);
    const sanitizedColumns = columns.map(col => (col === '*' ? col : sanitizeIdentifier(col)));
    
    // Build the SELECT clause
    const selectClause = `SELECT ${sanitizedColumns.join(', ')} FROM ${sanitizedTable}`;

    // Initialize parameters object for named parameters
    const params: Record<string, any> = {};

    // Build the WHERE clause if there are conditions
    let whereClause = '';
    if (Object.keys(conditions).length > 0) {
        const conditionsList = Object.entries(conditions).map(([column, value], index) => {
            const sanitizedColumn = sanitizeIdentifier(column);
            const paramName = `p${index}`; // Create unique parameter name
            params[paramName] = value; // Add value to params object
            return `${sanitizedColumn} = {${paramName}:${getClickHouseParamType(value)}}`; // Use ClickHouse parameter syntax
        });
        whereClause = ` WHERE ${conditionsList.join(' AND ')}`;
    }

    // Combine the SELECT and WHERE clauses
    const query = `${selectClause}${whereClause}`;

    return { query, params };
}

// Helper function to determine ClickHouse parameter type
function getClickHouseParamType(value: any): string {
    if (typeof value === 'number') {
        // Check if it's an integer
        return Number.isInteger(value) ? 'Int64' : 'Float64';
    }
    if (typeof value === 'boolean') {
        return 'Bool';
    }
    if (value instanceof Date) {
        return 'DateTime';
    }
    // Default to String for other types
    return 'String';
}