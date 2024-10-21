import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { Etl, Transformer } from 'proc-that';
import { JsonExtractor } from 'proc-that';
import { ConsoleLoader } from 'proc-that';
import { Observable } from 'rxjs';

type WarehouseType = 'Snowflake' | 'ClickHouse' | 'Postgres' | 'Redshift';

interface WarehouseData {
  type: WarehouseType;
  data: Record<string, any>;
}

class WarehouseDataTransformer implements Transformer {
  private flattenObject(obj: Record<string, any>, prefix = ''): Record<string, any> {
    return Object.keys(obj).reduce((acc: Record<string, any>, k: string) => {
      const pre = prefix.length ? prefix + '.' : '';
      if (typeof obj[k] === 'object' && obj[k] !== null && !Array.isArray(obj[k])) {
        Object.assign(acc, this.flattenObject(obj[k], pre + k));
      } else {
        acc[pre + k] = obj[k];
      }
      return acc;
    }, {});
  }

  private transformSnowflake(data: Record<string, any>): Record<string, any> {
    // Snowflake-specific transformations
    return this.flattenObject(data);
  }

  private transformClickHouse(data: Record<string, any>): Record<string, any> {
    // ClickHouse-specific transformations
    return this.flattenObject(data);
  }

  private transformPostgres(data: Record<string, any>): Record<string, any> {
    // Postgres-specific transformations
    return this.flattenObject(data);
  }

  private transformRedshift(data: Record<string, any>): Record<string, any> {
    // Redshift-specific transformations
    return this.flattenObject(data);
  }

  process(data: WarehouseData): Observable<Record<string, any>> {
    return new Observable<Record<string, any>>(subscriber => {
      try {
        let result: Record<string, any>;
        switch (data.type) {
          case 'Snowflake':
            result = this.transformSnowflake(data.data);
            break;
          case 'ClickHouse':
            result = this.transformClickHouse(data.data);
            break;
          case 'Postgres':
            result = this.transformPostgres(data.data);
            break;
          case 'Redshift':
            result = this.transformRedshift(data.data);
            break;
          default:
            throw new Error(`Unsupported warehouse type: ${data.type}`);
        }
        subscriber.next(result);
        subscriber.complete();
      } catch (error) {
        subscriber.error(error);
      }
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('Received request body:', body);

    const { organization, link_credentials, internal_warehouse, internal_type } = body;

    if (!internal_warehouse || !link_credentials) {
      console.error('Missing required data');
      return NextResponse.json({ success: false, error: 'Missing required data' }, { status: 400 });
    }

    const supabase = createClient();

    // Insert import data
    const { data: syncData, error: syncError } = await supabase
      .from('syncs')
      .insert({
        organization,
        internal_warehouse,
        internal_type,
        link_credentials,
      })
      .select()
      .single();

    if (syncError) {
      console.error('Error inserting sync data:', syncError);
      return NextResponse.json({ success: false, error: 'Failed to insert sync data' }, { status: 500 });
    }

    // Create ETL pipeline
    const etl = new Etl();

    // Add extractor, transformer, and loader
    etl
      .addExtractor(new JsonExtractor(internal_warehouse))
      .addTransformer(new WarehouseDataTransformer())
      .addLoader(new ConsoleLoader()); // Replace with your actual loader

    // Start the ETL process
    await new Promise<void>((resolve, reject) => {
      etl.start().subscribe({
        next: (progress) => console.log('ETL Progress:', progress),
        error: (error) => {
          console.error('ETL Error:', error);
          reject(error);
        },
        complete: () => {
          console.log('ETL process completed successfully');
          resolve();
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('ETL process failed:', error);
    if (error instanceof Error) {
      console.error('Error stack:', error.stack);
      return NextResponse.json({ success: false, error: `ETL process failed: ${error.message}` }, { status: 500 });
    }
    return NextResponse.json({ success: false, error: 'An unknown error occurred' }, { status: 500 });
  }
}