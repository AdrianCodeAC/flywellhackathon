import { z } from "zod";

export const answerSchema = z.object({
  text: z.string(),
  places: z.array(z.object({ name: z.string(), lat: z.number(), lon: z.number() })),
});

export type AssistantAnswer = z.infer<typeof answerSchema>;

export function parseAssistantAnswer(value: unknown): AssistantAnswer {
  const answer = answerSchema.parse(value);
  return {
    text: answer.text.trim(),
    places: answer.places.filter((p) => p.name.trim() && Number.isFinite(p.lat) && Number.isFinite(p.lon) && Math.abs(p.lat) <= 90 && Math.abs(p.lon) <= 180).slice(0, 5),
  };
}