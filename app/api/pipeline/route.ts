import { NextRequest, NextResponse } from 'next/server';
import { tasks } from "@trigger.dev/sdk/v3";
import type { pipelineTask } from '@/app/trigger/pipeline';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Trigger the task and get a handle to track its progress
    const handle = await tasks.trigger<typeof pipelineTask>("pipeline-etl", body);

    return NextResponse.json({
      success: true,
      message: "ETL process started",
      runId: handle.id
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 });
  }
}
