import { NextRequest, NextResponse } from 'next/server';
import { tasks } from "@trigger.dev/sdk/v3";

export async function GET(
  request: NextRequest,
  { params }: { params: { runId: string } }
) {
  try {
    const runId = params.runId;
    const run = await tasks.triggerAndPoll("get-run", { runId });

    return NextResponse.json({
      status: run.status,
      error: run.output?.error
    });
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 });
  }
}
