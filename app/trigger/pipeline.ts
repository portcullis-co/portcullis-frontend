import { task, retry } from "@trigger.dev/sdk/v3";
import { createClient } from '@/lib/supabase/server';
import { convertClickhouseToSnowflake, upsertToSnowflake, generateSnowflakeCreateTableSQL } from '@/lib/conversions';
import snowflake from 'snowflake-sdk';
import { createClient as Clickhouse } from '@clickhouse/client';
import { decrypt } from '@/lib/encryption';
import { z } from 'zod';
import { logger } from "@trigger.dev/sdk/v3";

// Schema and interfaces
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
    isPrimaryKey: boolean;
}

async function getColumnTypes(clickhouse: any, tableName: string): Promise<ColumnInfo[]> {
    try {
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
        logger.info('Raw Column Types Result:', { rows });

        if (rows.length === 0) {
            throw new Error('No columns found in table');
        }

        const columnInfo = rows.map((row: any) => ({
            name: row.name as string,
            type: row.type as string,
            isPrimaryKey: pkColumns.has(row.name)
        }));
        
        logger.info('Processed Column Info:', { columnInfo });
        return columnInfo;
    } catch (error) {
        logger.error('Error getting column types:', { error });
        throw error;
    }
}

function processClickhouseRow(row: any[], columnInfo: ColumnInfo[]): Record<string, any> {
    logger.info('Processing ClickHouse row:', { row });
        
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
        logger.error('Error processing row:', { error });
        return {};
    }

    logger.info('Processed row with metadata:', { processedRow });
    return processedRow;
}

function validateRowStructure(row: any): boolean {
    if (!Array.isArray(row)) {
        logger.warn('Row is not an array:', { type: typeof row });
        return false;
    }
    
    if (row.length === 0) {
        logger.warn('Row is an empty array');
        return false;
    }
    
    return true;
}

export const pipelineTask = task({
    id: "pipeline-etl",
    retry: {
        maxAttempts: 3,
        minTimeoutInMs: 1000,
        maxTimeoutInMs: 10000,
        factor: 2,
    },
    run: async (payload: z.infer<typeof requestSchema>) => {
        // Create an idempotency key based on unique attributes
        const idempotencyKey = `${payload.organization}-${payload.table_name}-${Date.now()}`;
        
        const supabase = createClient();
        let syncId: string | null = null;
        let snowflakePool: any = null;
        let clickhouse: any = null;

        try {
            const validationResult = requestSchema.safeParse(payload);
            if (!validationResult.success) {
                throw new Error(`Validation failed: ${JSON.stringify(validationResult.error.issues)}`);
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
            const { data: syncData } = await retry.onThrow(
                async () => {
                    const { data, error } = await supabase
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
                        
                    if (error) throw error;
                    return data;
                },
                { maxAttempts: 3 }
            );

            if (!syncData) {
                throw new Error('Failed to create sync record: No data returned');
            }

            syncId = syncData.id;

            // Create ClickHouse client with retry
            clickhouse = await retry.onThrow(
                async () => {
                    const client = await Clickhouse({
                        url: decryptedInternalCreds.host,
                        username: decryptedInternalCreds.username,
                        password: decryptedInternalCreds.password,
                        database: decryptedInternalCreds.database,
                    });
                    // Test connection
                    await client.ping();
                    return client;
                },
                { maxAttempts: 3 }
            );

            // Get column info with retry
            const columnInfo = await retry.onThrow(
                async () => {
                    return await getColumnTypes(clickhouse, body.table_name);
                },
                { maxAttempts: 3 }
            );
            logger.info('Retrieved column info:', { columnInfo });

            // Create Snowflake connection pool with retry
            snowflakePool = await retry.onThrow(
                async () => {
                    const pool = snowflake.createPool({
                        account: body.link_credentials.account,
                        username: body.link_credentials.username,
                        password: body.link_credentials.password,
                        database: body.link_credentials.database,
                        schema: body.link_credentials.schema,
                    }, {
                        max: 10,
                        min: 0
                    });

                    // Test connection by executing a simple query
                    await new Promise((resolve, reject) => {
                        pool.use(async (conn: snowflake.Connection) => {
                            await conn.execute({
                                sqlText: 'SELECT 1',
                                complete: (err: Error | undefined) => {
                                    if (err) reject(err);
                                    else resolve(true);
                                }
                            });
                        });
                    });

                    return pool;
                },
                { maxAttempts: 3 }
            );

            // Create or verify table exists in Snowflake with retry
            await retry.onThrow(
                async () => {
                    await snowflakePool.use(async (clientConnection: snowflake.Connection) => {
                        const createTableSQL = generateSnowflakeCreateTableSQL(body.table_name, columnInfo);
                        await clientConnection.execute({
                            sqlText: createTableSQL,
                            complete: (err: Error | undefined) => {
                                if (err) throw err;
                            }
                        });
                    });
                },
                { maxAttempts: 3 }
            );

            // Query ClickHouse data with retry
            const resultSet = await retry.onThrow(
                async () => {
                    return await clickhouse.query({
                        query: `SELECT * FROM ${body.table_name}`,
                        format: 'JSONCompactEachRow',
                        clickhouse_settings: {
                            output_format_json_quote_64bit_integers: 0,
                            output_format_json_quote_denormals: 1
                        }
                    });
                },
                { maxAttempts: 3 }
            );

            let processedCount = 0;
            const batchSize = 1000;
            let batch: Record<string, any>[] = [];
            let lastProcessTime = Date.now();
            const processingInterval = 30000;
            
            try {
                for await (const row of resultSet.stream()) {
                    if (!validateRowStructure(row)) {
                        logger.warn('Skipping invalid row structure');
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
                                logger.info(`Processed batch`, { count: batch.length });
                                batch = [];
                                lastProcessTime = currentTime;
                            }
                        }
                    } catch (rowError) {
                        logger.error('Error processing individual row:', { error: rowError });
                        continue;
                    }
                }
            } catch (streamError) {
                logger.error('Error in stream processing:', { error: streamError });
                throw streamError;
            }

            // Process any remaining rows
            if (batch.length > 0) {
                await upsertToSnowflake(snowflakePool, body.table_name, batch);
                logger.info(`Processed final batch`, { count: batch.length });
            }

            return {
                success: true,
                syncId,
                processedCount,
                message: `ETL process completed successfully. Processed ${processedCount} rows.`
            };

        } catch (error) {
            logger.error('ETL process failed:', { error });
            throw error;
        } finally {
            if (snowflakePool) {
                try {
                    await new Promise<void>((resolve, reject) => {
                        snowflakePool.drain((err: Error | undefined) => {
                            if (err) {
                                logger.error('Error draining Snowflake connection pool:', { error: err });
                                reject(err);
                            } else {
                                snowflakePool.clear();
                                resolve();
                            }
                        });
                    });
                } catch (error) {
                    logger.error('Error closing Snowflake connection pool:', { error });
                }
            }
            
            if (clickhouse) {
                try {
                    await clickhouse.close();
                } catch (error) {
                    logger.error('Error closing ClickHouse connection:', { error });
                }
            }
        }
    },
});
