import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';
import { convertClickhouseToSnowflake, upsertToSnowflake } from '@/lib/conversions';
import { createConnection } from 'snowflake-sdk';
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
            format: 'JSONEachRow'
        });

        const rows = await result.json();
        console.log('Raw Column Types Result:', rows);

        // Store column info in order
        const columnInfo: ColumnInfo[] = rows.map((row: any) => ({
            name: row.name as string,
            type: row.type as string
        }));

        console.log('Processed Column Info:', columnInfo);

        if (columnInfo.length === 0) {
            throw new Error('No columns found in table');
        }

        return columnInfo;
    } catch (error) {
        console.error('Error getting column types:', error);
        throw new Error(`Failed to get column types: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

export async function POST(request: NextRequest) {
    const supabase = createClient();
    let syncId: string | null = null;
    let snowflakeClient: any = null;
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

        if (syncError) {
            console.error('Database error:', syncError);
            return NextResponse.json({
                success: false,
                error: 'Database error',
                details: syncError.message
            }, { status: 500 });
        }

        if (!syncData) {
            return NextResponse.json({
                success: false,
                error: 'Failed to create sync record: No data returned'
            }, { status: 500 });
        }

        syncId = syncData.id;

        // Create ClickHouse client
        clickhouse = Clickhouse({
            url: body.internal_credentials.host,
            username: body.internal_credentials.username,
            password: body.internal_credentials.password,
            database: body.internal_credentials.database,
        });

        // Get column info
        const columnInfo = await getColumnTypes(clickhouse, body.table_name);
        console.log('Retrieved column info:', columnInfo);

        // Create Snowflake client
        snowflakeClient = createConnection({
            account: body.link_credentials.account,
            username: body.link_credentials.username,
            password: body.link_credentials.password,
            database: body.link_credentials.database,
            schema: body.link_credentials.schema,
            warehouse: body.link_credentials.warehouse,
        });

        // Query data from ClickHouse
        const resultSet = await clickhouse.query({
            query: `SELECT * FROM ${body.table_name}`,
            format: 'JSONEachRow'
        });

        // Process the stream of rows
        let processedCount = 0;
        const batchSize = 1000;
        let batch: Record<string, any>[] = [];

        // Process the stream
        for await (const row of resultSet.stream()) {
            const convertedRow: Record<string, any> = {};
            
            // Handle array-like or object data
            const rowEntries = Array.isArray(row) ? 
                row.map((value, index) => [index, value]) :
                Object.entries(row);

            for (const [key, value] of rowEntries) {
                const index = typeof key === 'string' ? parseInt(key) : key;
                if (Number.isInteger(index) && index >= 0 && index < columnInfo.length) {
                    const { name: columnName, type: columnType } = columnInfo[index];
                    convertedRow[columnName] = convertClickhouseToSnowflake(columnType, value);
                } else {
                    console.warn(`Invalid column index or key: ${key}, skipping`);
                }
            }
            
            batch.push(convertedRow);
            processedCount++;

            if (batch.length >= batchSize) {
                await upsertToSnowflake(snowflakeClient, body.table_name, batch);
                batch = [];
            }
        }

        // Process remaining rows
        if (batch.length > 0) {
            await upsertToSnowflake(snowflakeClient, body.table_name, batch);
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
            syncId,
            error: error instanceof Error ? error.message : 'Unknown error occurred'
        }, { status: 500 });
    } finally {
        // Clean up connections
        if (snowflakeClient) {
            try {
                await new Promise((resolve, reject) => {
                    snowflakeClient.destroy((err: Error) => {
                        if (err) reject(err);
                        else resolve(true);
                    });
                });
            } catch (error) {
                console.error('Error closing Snowflake connection:', error);
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