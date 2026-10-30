/**
 * The "Ask anything" backend. The question, the conversation so far and the data
 * already on screen go to the AI function; the browser never sees a credential.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const askInput = z.object({
  question: z.string().min(1).max(500),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(4000) }))
    .max(12)
    .default([]),
  lang: z.enum(["en", "ro"]),
  /** Airport, city, local time and the places already loaded, as plain text. */
  context: z.string().max(12_000),
});

const answerSchema = z.object({
  text: z.string(),
  places: z.array(z.object({ name: z.string(), lat: z.number(), lon: z.number() })),
});

export interface AssistantAnswer {
  text: string;
  places: { name: string; lat: number; lon: number }[];
}

function instructions(lang: "en" | "ro"): string {
  const language = lang === "ro" ? "Romanian" : "English";
  return (
    "You are a travel assistant for someone who just landed at an airport. " +
    "Be concise and practical: short sentences, no more than about 120 words, bullet points where useful. " +
    "When recommending specific places, prefer places from the provided data; only add a place you are confident about " +
    "when the data does not cover the question. " +
    `Always respond in ${language}.` +
    (lang === "ro"
      ? " Use correct Romanian diacritics (ă, â, î, ș, ț with comma below)."
      : "") +
    " Return an object with: text — your answer; places — up to 5 recommended places, each with name, lat and lon " +
    "taken from the provided data, or an empty list when you are not recommending a specific location."
  );
}

function prompt(data: z.infer<typeof askInput>): string {
  const turns = data.history.map((h) => `${h.role === "user" ? "Traveller" : "Assistant"}: ${h.content}`).join("\n");
  return [
    "Context:",
    data.context,
    "",
    turns ? `Earlier in this conversation:\n${turns}` : "",
    "",
    `Traveller: ${data.question}`,
  ].join("\n");
}

/** Ask the assistant. Returns answer text plus up to 5 tappable places. */
export const askAssistant = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => askInput.parse(d))
  .handler(async ({ data }): Promise<AssistantAnswer> => {
    const { askObject } = await import("./ai.server");
    const answer = await askObject(answerSchema, instructions(data.lang), prompt(data));
    const places = answer.places
      .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon) && Math.abs(p.lat) <= 90 && Math.abs(p.lon) <= 180)
      .slice(0, 5);
    return { text: answer.text.trim(), places };
  });
