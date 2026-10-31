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

/** Free fallback for local development: Groq's OpenAI-compatible API (GROQ_API_KEY in .env.local). */
const GROQ_URL = "https://api.groq.com/openai/v1";
const GROQ_MODEL = "openai/gpt-oss-120b";

/** Lovable AI Gateway when deployed; Groq when only a Groq key is configured. */
function gatewayModel() {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) {
    const groqKey = process.env["GROQ_API_KEY"];
    if (!groqKey) throw new Error("AI is not configured");
    return {
      model: createOpenAI({ baseURL: GROQ_URL, apiKey: groqKey }).chat(GROQ_MODEL),
      providerOptions: {},
    };
  }
  const run = createLovableAiGatewayRunIdFetch();
  const provider = createOpenAI({
    baseURL: GATEWAY_URL,
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: run.fetch,
  });
  return { model: provider.responses(MODEL), providerOptions: responsesOptions() };
}

function userTurn(prompt: string): ModelMessage[] {
  return [{ role: "user", content: prompt }];
}

/** Plain-text answer, streamed and consumed server-side. */
export async function askText(instructions: string, prompt: string): Promise<string> {
  const result = streamText({
    ...gatewayModel(),
    instructions,
    messages: userTurn(prompt),
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
    ...gatewayModel(),
    instructions,
    messages: userTurn(prompt),
    output: Output.object({ schema }),
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
