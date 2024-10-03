import { NextRequest, NextResponse } from 'next/server';
import { performReverseETL } from '@/lib/warehouse-utils';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('Received request body:', body);

    const { sourceCredentials, importCredentials } = body;

    if (!sourceCredentials || !importCredentials) {
      console.error('Missing sourceCredentials or importCredentials');
      return NextResponse.json({ success: false, error: 'Missing required credentials' }, { status: 400 });
    }

    if (!sourceCredentials.type || !importCredentials.type) {
      console.error('Missing type in sourceCredentials or importCredentials');
      return NextResponse.json({ success: false, error: 'Missing type in credentials' }, { status: 400 });
    }

    const result = await performReverseETL(sourceCredentials, importCredentials);
        
    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error('Reverse ETL job failed:', error);
    return NextResponse.json({ success: false, error: 'Reverse ETL job failed' }, { status: 500 });
  }
}