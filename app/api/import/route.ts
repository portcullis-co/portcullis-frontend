import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('Received request body:', body);

    const { linkDetails, credentials, selectedWarehouse } = body;

    if (!linkDetails || !credentials || !selectedWarehouse) {
      console.error('Missing required data');
      return NextResponse.json({ success: false, error: 'Missing required data' }, { status: 400 });
    }

    const supabase = createClient();

    // Insert import data
    const { data: importData, error: importError } = await supabase
      .from('imports')
      .insert({
        organization: linkDetails.organization,
        source: linkDetails.source,
        credentials: credentials,
        dataset_name: `${linkDetails.organization}-${linkDetails.type}-dataset`
      })
      .select()
      .single();

    if (importError) {
      console.error('Error inserting import data:', importError);
      return NextResponse.json({ success: false, error: 'Failed to insert import data' }, { status: 500 });
    }

    // Fetch source credentials
    const { data: sourceData, error: sourceError } = await supabase
      .from('sources')
      .select('credentials')
      .eq('id', linkDetails.source)
      .single();

    if (sourceError) {
      console.error('Error fetching source credentials:', sourceError);
      return NextResponse.json({ success: false, error: 'Failed to fetch source credentials' }, { status: 500 });
    }

    // Prepare pipeline request body
    const pipelineRequestBody = {
      organization: linkDetails.organization,
      source: linkDetails.source,
      type: linkDetails.type,
      export_id: linkDetails.export_id,
      import_id: importData.id,
      dataset_name: `${linkDetails.organization}-${linkDetails.type}-dataset`,
      link_credentials: credentials,
      source_credentials: sourceData.credentials,
      destination: selectedWarehouse.name
    };

    // Call pipeline API
    const pipelineResponse = await fetch('http://localhost:8000/api/pipeline', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(pipelineRequestBody),
    });

    if (!pipelineResponse.ok) {
      const errorText = await pipelineResponse.text();
      console.error('Pipeline API error:', errorText);
      return NextResponse.json({ success: false, error: `Pipeline API failed with status ${pipelineResponse.status}` }, { status: pipelineResponse.status });
    }

    const pipelineResult = await pipelineResponse.json();

    return NextResponse.json({ success: true, result: pipelineResult });
  } catch (error) {
    console.error('Reverse ETL job failed:', error);
    return NextResponse.json({ success: false, error: 'Reverse ETL job failed' }, { status: 500 });
  }
}