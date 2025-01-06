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

interface QueryParams {
    table: string;
    conditions?: { [column: string]: any };
    columns?: string[];
}

function StartsWithDecimal(clickhouseType: string): boolean {
    return clickhouseType.startsWith("Decimal");
  }

export function buildClickHouseQuery({
    table,
    conditions = {},
    columns = ['*']
}: {
    table: string;
    conditions?: Record<string, any>;
    columns?: string[];
}) {
    // Sanitize table name and column names
    const sanitizedTable = `"${table}"`;
    const sanitizedColumns = columns.map(col => col === '*' ? '*' : `"${col}"`).join(', ');

    // Build the base query
    let query = `SELECT ${sanitizedColumns} FROM ${sanitizedTable}`;
    const params: Record<string, any> = {};

    // Add WHERE clause if conditions exist
    if (Object.keys(conditions).length > 0) {
        const whereConditions = Object.entries(conditions).map(([key, value], index) => {
            const paramName = `p${index}`;
            params[paramName] = value;
            return `"${key}" = {${paramName}:String}`; // Use consistent String type for parameters
        });
        query += ` WHERE ${whereConditions.join(' AND ')}`;
    }

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
    if (value transferof Date) {
        return 'DateTime';
    }
    // Default to String for other types
    return 'String';
}