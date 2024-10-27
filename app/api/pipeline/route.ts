import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';
import { convertClickhouseToSnowflake, upsertToSnowflake, generateSnowflakeCreateTableSQL } from '@/lib/conversions';
import snowflake from 'snowflake-sdk';
import { createClient as Clickhouse } from '@clickhouse/client';
import { decrypt } from '@/lib/encryption';

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
    isPrimaryKey: boolean;  // Add this line
}

interface TableMetadata {
    name: string;
    type: string;
    isPrimaryKey: boolean;
}

async function getColumnTypes(clickhouse: any, tableName: string): Promise<ColumnInfo[]> {
    try {
        // First, get the primary key information
        const pkResult = await clickhouse.query({
            query: `SELECT * FROM system.columns WHERE table='${tableName}' AND is_in_primary_key=1`,
            format: 'JSONEachRow'
        });
        const pkColumns = new Set((await pkResult.json()).map((col: any) => col.name));

        const result = await clickhouse.query({
            query: `DESCRIBE TABLE ${tableName}`,
            format: 'JSONStringsEachRow'
        });

        const rows = await result.json();
        console.log('Raw Column Types Result:', rows);

        if (rows.length === 0) {
            throw new Error('No columns found in table');
        }

        const columnInfo = rows.map((row: any) => ({
            name: row.name as string,
            type: row.type as string,
            isPrimaryKey: pkColumns.has(row.name)
        }));
        
        console.log('Processed Column Info:', columnInfo);
        return columnInfo;
    } catch (error) {
        console.error('Error getting column types:', error);
        throw new Error(`Failed to get column types: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

function processClickhouseRow(row: any[], columnInfo: ColumnInfo[]): Record<string, any> {
    console.log('Raw ClickHouse row:', JSON.stringify(row, null, 2));
        
    const processedRow: Record<string, any> = {
        __metadata: {
            primaryKeys: columnInfo.filter(col => col.isPrimaryKey).map(col => col.name)
        }
    };
    
    try {
        if (Array.isArray(row)) {
            columnInfo.forEach((column, index) => {
                const value = row[index];
                const convertedValue = convertClickhouseToSnowflake(column.type, value);
                processedRow[column.name] = convertedValue;
            });
        }
    } catch (error) {
        console.error('Error processing row:', error);
        return {};
    }

    console.log('Processed row with metadata:', processedRow);
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

        const decryptedInternalCreds = typeof body.internal_credentials === 'string' 
        ? await decrypt(body.internal_credentials)
        : body.internal_credentials;
        
      const decryptedLinkCreds = typeof body.link_credentials === 'string'
            ? await decrypt(body.link_credentials)
            : body.link_credentials;

        // Create sync record
        const { data: syncData, error: syncError } = await supabase
            .from('syncs')
            .insert({
                organization: body.organization,
                internal_warehouse: body.internal_warehouse,
                table_name: body.table_name,
                link_type: linkType,
                internal_credentials: decryptedInternalCreds,
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
        // Create ClickHouse client
        clickhouse = await Clickhouse({
            url: decryptedInternalCreds.host,
            username: decryptedInternalCreds.username,
            password: decryptedInternalCreds.password,
            database: decryptedInternalCreds.database,
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