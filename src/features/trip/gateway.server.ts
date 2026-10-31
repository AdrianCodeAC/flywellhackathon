import { createOpenAI } from "@ai-sdk/openai";
import { Output, streamText } from "ai";
import type { z } from "zod";
import { createLovableAiGatewayRunIdFetch } from "./run-id.server.ts";

export function tripGateway(signal: AbortSignal, initialRunId?: string) {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("AI configuration missing");
  const run = createLovableAiGatewayRunIdFetch(initialRunId);
  const provider = createOpenAI({apiKey:key,baseURL:"https://ai.gateway.lovable.dev/v1",headers:{"Lovable-API-Key":key,"X-Lovable-AIG-SDK":"vercel-ai-sdk"},fetch:run.fetch});
  const options = {openai:{forceReasoning:true,reasoningEffort:"low",reasoningSummary:"auto",store:false,include:["reasoning.encrypted_content"]}};
  async function object<S extends z.ZodTypeAny>(schema:S,instructions:string,prompt:string):Promise<z.infer<S>> {
    let failure:unknown;
    const result = streamText({model:provider.responses("openai/gpt-6-astra"),instructions,messages:[{role:"user",content:prompt}],output:Output.object({schema}),providerOptions:options,abortSignal:signal,maxRetries:0,onError:({error})=>{failure=error;}});
    try { return await result.output; } catch(error) { throw failure ?? error; }
  }
  return {object,provider,options,run};
}