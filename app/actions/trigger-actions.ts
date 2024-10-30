'use server'

import { TriggerClient } from "@trigger.dev/sdk";

export async function sendTriggerEvent(eventName: string, payload: any) {
  const trigger = new TriggerClient({
    id: process.env.NEXT_PUBLIC_TRIGGER_API_KEY || "",
  });

  return trigger.sendEvent({
    name: eventName,
    payload: payload,
  });
} 