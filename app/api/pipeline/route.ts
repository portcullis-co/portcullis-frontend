import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';
import { convertClickhouseToSnowflake, upsertToSnowflake, generateSnowflakeCreateTableSQL } from '@/lib/conversions';
import snowflake from 'snowflake-sdk';
import { createClient as Clickhouse } from '@clickhouse/client';

const requestSchema = z.object({
    organization: z.string().min(1),
    internal_warehouse: z.string().min(1),
    link_type: z.string().min(1),
    internal_credentials: z.record(z.any()),
    link_credentials: z.record(z.any()),
    table_name: z.string().min(1),
}).strict();

interface ColumnInfo {
    name: string;
    type: string;
}

async function getColumnTypes(clickhouse: any, tableName: string): Promise<ColumnInfo[]> {
    try {
        const result = await clickhouse.query({
            query: `DESCRIBE TABLE ${tableName}`,
            format: 'JSONStringsEachRow'
        });

        const rows = await result.json();
        console.log('Raw Column Types Result:', rows);

        // Store column info in order
        const columnInfo: ColumnInfo[] = rows.map((rows: any) => ({
            name: rows.name as string,
            type: rows.type as string
        }));
        
        console.log('Processed Column Info:', columnInfo);

        if (columnInfo.length === 0) {
            throw new Error('No columns found in table');
        }
        console.log('Column Info:', columnInfo)
        return columnInfo;
    } catch (error) {
        console.error('Error getting column types:', error);
        throw new Error(`Failed to get column types: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

function processClickhouseRow(row: any[], columnInfo: ColumnInfo[]): Record<string, any> {
    console.log('Raw ClickHouse row:', JSON.stringify(row, null, 2));
    
    const processedRow: Record<string, any> = {};
    
    try {
        // Check if row is an array of values
        if (Array.isArray(row)) {
            // Process each column based on its position in the array
            columnInfo.forEach((column, index) => {
                let value = row[index];
                
                // If the value is an object with a 'text' property, use that
                if (value && typeof value === 'object' && 'text' in value) {
                    value = value.text;
                }
                
                // If the value is a string that looks like an array, parse it
                if (typeof value === 'string' && value.startsWith('[') && value.endsWith(']')) {
                    try {
                        const parsedArray = JSON.parse(value);
                        // Use the value at the same index if it's an array
                        value = parsedArray[index] ?? null;
                    } catch (e) {
                        console.warn(`Failed to parse array string: ${value}`);
                    }
                }
                
                try {
                    // Convert the value based on ClickHouse type
                    const convertedValue = convertClickhouseToSnowflake(column.type, value);
                    processedRow[column.name] = convertedValue;
                } catch (columnError) {
                    console.error(`Error converting value for column ${column.name}:`, columnError);
                    // Store the original value if conversion fails
                    processedRow[column.name] = value;
                }
            });
        } else {
            console.error('Row is not an array:', row);
            return {};
        }
    } catch (error) {
        console.error('Error processing row:', error);
        return {};
    }

    console.log('Processed row:', processedRow);
    return processedRow;
}

// Update validate row structure function
function validateRowStructure(row: any): boolean {
    if (!Array.isArray(row)) {
        console.warn('Row is not an array:', typeof row);
        return false;
    }
    
    // Check if row length matches column info length
    if (row.length === 0) {
        console.warn('Row is an empty array');
        return false;
    }
    
    return true;
}

export async function POST(request: NextRequest) {
    const supabase = createClient();
    let syncId: string | null = null;
    let snowflakePool: any = null;
    let clickhouse: any = null;

    try {
        const rawBody = await request.json();
        const validationResult = requestSchema.safeParse(rawBody);

        if (!validationResult.success) {
            console.error('Validation errors:', validationResult.error.issues);
            return NextResponse.json({
                success: false,
                error: 'Validation failed',
                details: validationResult.error.issues
            }, { status: 400 });
        }

        const body = validationResult.data;
        const linkType = body.link_type.toLowerCase();

        // Create sync record
        const { data: syncData, error: syncError } = await supabase
            .from('syncs')
            .insert({
                organization: body.organization,
                internal_warehouse: body.internal_warehouse,
                table_name: body.table_name,
                link_type: linkType,
                internal_credentials: body.internal_credentials,
                link_credentials: body.link_credentials,
            })
            .select()
            .single();

        if (syncError || !syncData) {
            const error = syncError?.message || 'Failed to create sync record: No data returned';
            return NextResponse.json({ success: false, error }, { status: 500 });
        }

        syncId = syncData.id;
        // Create ClickHouse client
        clickhouse = Clickhouse({
            url: body.internal_credentials.host,
            username: body.internal_credentials.username,
            password: body.internal_credentials.password,
            database: body.internal_credentials.database,
        });

        // Get column info before the loop
        const columnInfo = await getColumnTypes(clickhouse, body.table_name);
        console.log('Retrieved column info:', columnInfo);

        // Create Snowflake connection pool
        snowflakePool = snowflake.createPool({
            account: body.link_credentials.account,
            username: body.link_credentials.username,
            password: body.link_credentials.password,
            database: body.link_credentials.database,
            schema: body.link_credentials.schema,
        }, {
            max: 10,
            min: 0
        });

        // Use the connection pool to create or verify table exists in Snowflake
        await snowflakePool.use(async (clientConnection: snowflake.Connection) => {
            const createTableSQL = generateSnowflakeCreateTableSQL(body.table_name, columnInfo);
            await clientConnection.execute({
                sqlText: createTableSQL,
                complete: (err: Error | undefined) => {
                    if (err) {
                        console.error('Error creating table:', err);
                        throw err;
                    }
                }
            });
        });

        // Modified query approach with better error handling
        const resultSet = await clickhouse.query({
            query: `SELECT * FROM ${body.table_name}`,
            format: 'JSONCompactEachRow',
            clickhouse_settings: {
                output_format_json_quote_64bit_integers: 0,
                output_format_json_quote_denormals: 1
            }
        });


        let processedCount = 0;
        const batchSize = 1000;
        let batch: Record<string, any>[] = [];
        let lastProcessTime = Date.now();
        const processingInterval = 30000;
        
        try {
            for await (const row of resultSet.stream()) {
                if (!validateRowStructure(row)) {
                    console.warn('Skipping invalid row structure');
                    continue;
                }
        
                try {
                    const processedRow = processClickhouseRow(row, columnInfo);
                    
                    if (Object.keys(processedRow).length > 0) {
                        batch.push(processedRow);
                        processedCount++;
                
                        const currentTime = Date.now();
                        if (batch.length >= batchSize || currentTime - lastProcessTime > processingInterval) {
                            await upsertToSnowflake(snowflakePool, body.table_name, batch);
                            console.log(`Processed batch of ${batch.length} rows`);
                            batch = [];
                            lastProcessTime = currentTime;
                        }
                    }
                } catch (rowError) {
                    console.error('Error processing individual row:', rowError);
                    continue;
                }
            }
        } catch (streamError) {
            console.error('Error in stream processing:', streamError);
            throw new Error(`Stream processing failed: ${streamError instanceof Error ? streamError.message : 'Unknown stream error'}`);
        }

        // Process any remaining rows
        if (batch.length > 0) {
            await upsertToSnowflake(snowflakePool, body.table_name, batch);
            console.log(`Processed final batch of ${batch.length} rows`);
        }

        return NextResponse.json({
            success: true,
            syncId,
            message: `ETL process completed successfully. Processed ${processedCount} rows.`
        });

    } catch (error) {
        console.error('ETL process failed:', error);
        return NextResponse.json({
            success: false,
            syncId: syncId,
            error: error instanceof Error ? error.message : 'Unknown error occurred'
        }, { status: 500 });
    } finally {
        if (snowflakePool) {
            try {
                await new Promise<void>((resolve, reject) => {
                    snowflakePool.drain((err: Error | undefined) => {
                        if (err) {
                            console.error('Error draining Snowflake connection pool:', err);
                            reject(err);
                        } else {
                            snowflakePool.clear();
                            resolve();
                        }
                    });
                });
            } catch (error) {
                console.error('Error closing Snowflake connection pool:', error);
            }
        }
        
        if (clickhouse) {
            try {
                await clickhouse.close();
            } catch (error) {
                console.error('Error closing ClickHouse connection:', error);
            }
        }
    }
}