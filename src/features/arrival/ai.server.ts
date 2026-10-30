/**
 * Server-only Lovable AI Gateway calls for the Arrival Assistant.
 * Prompts, model id and credentials stay here; the browser only ever sees the
 * result returned by the server functions in *.functions.ts.
 */
import { createOpenAI } from "@ai-sdk/openai";
import { NoObjectGeneratedError, Output, streamText, type ModelMessage } from "ai";
import type { z } from "zod";
import { createLovableAiGatewayRunIdFetch } from "./run-id.ts";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1";
const MODEL = "openai/gpt-6-astra";

/** Same options block on every Responses call (see the gateway contract). */
function responsesOptions() {
  return {
    openai: {
      forceReasoning: true,
      reasoningEffort: "medium",
      reasoningSummary: "auto",
      store: false,
      include: ["reasoning.encrypted_content"],
    },
  };
}

function gatewayModel() {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("AI is not configured");
  const run = createLovableAiGatewayRunIdFetch();
  const provider = createOpenAI({
    baseURL: GATEWAY_URL,
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: run.fetch,
  });
  return provider.responses(MODEL);
}

function userTurn(prompt: string): ModelMessage[] {
  return [{ role: "user", content: prompt }];
}

/** Plain-text answer, streamed and consumed server-side. */
export async function askText(instructions: string, prompt: string): Promise<string> {
  const result = streamText({
    model: gatewayModel(),
    instructions,
    messages: userTurn(prompt),
    providerOptions: responsesOptions(),
  });
  return (await result.text) ?? "";
}

function tryParse(raw: string): unknown | undefined {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

/** Structured answer, streamed and consumed server-side. */
export async function askObject<S extends z.ZodTypeAny>(
  schema: S,
  instructions: string,
  prompt: string,
): Promise<z.infer<S>> {
  const result = streamText({
    model: gatewayModel(),
    instructions,
    messages: userTurn(prompt),
    output: Output.object({ schema }),
    providerOptions: responsesOptions(),
  });
  try {
    return await result.output;
  } catch (error) {
    // The model answered, but not in the requested shape: try the raw text once
    // before giving up. Never turn a schema failure into a billed retry.
    if (error instanceof NoObjectGeneratedError) {
      const raw = typeof error.text === "string" ? error.text : "";
      const parsed = schema.safeParse(tryParse(raw));
      if (parsed.success) return parsed.data;
    }
    throw error;
  }
}
