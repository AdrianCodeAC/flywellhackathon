import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputSubmit,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import {
  askAI,
  buildAssistantContext,
  FOOD_RADIUS,
  getCityCenter,
  peekPlaces,
  SIGHTS_RADIUS,
  STATION_RADIUS,
} from "./services";
import type { Airport, Place } from "./types";

export interface ArrivalMessage {
  id: string;
  role: "user" | "assistant";
  parts: { type: "text"; text: string }[];
  places?: { name: string; lat: number; lon: number }[];
}

export function AskAI({
  airport,
  messages,
  onMessages,
  onBack,
  onShowRoute,
}: {
  airport: Airport;
  messages: ArrivalMessage[];
  onMessages: (messages: ArrivalMessage[]) => void;
  onBack: () => void;
  onShowRoute: (p: Place) => void;
}) {
  const { t, i18n } = useTranslation();
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const textarea = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    textarea.current?.focus();
  }, []);

  const send = async (question: string) => {
    if (busy || !question.trim()) return;
    const lang = i18n.language;
    const next: ArrivalMessage[] = [
      ...messages,
      { id: crypto.randomUUID(), role: "user", parts: [{ type: "text", text: question.trim() }] },
    ];
    onMessages(next);
    setInput("");
    setBusy(true);
    setError(undefined);
    try {
      const center = await getCityCenter(airport.city, airport.countryCode).catch(() => undefined);
      const food = peekPlaces("food", airport.lat, airport.lon, FOOD_RADIUS.airport)?.places ?? [];
      const centerFood = center
        ? (peekPlaces("food", center.lat, center.lon, FOOD_RADIUS.center)?.places ?? [])
        : [];
      const sights = center
        ? (peekPlaces("sights", center.lat, center.lon, SIGHTS_RADIUS)?.places ?? [])
        : [];
      const stations =
        peekPlaces("transport", airport.lat, airport.lon, STATION_RADIUS)?.places ?? [];
      const answer = await askAI(
        question.trim(),
        messages.slice(-12).map((m) => ({
          role: m.role,
          content: m.parts
            .map((p) => p.text)
            .join("\n")
            .slice(0, 4000),
        })),
        buildAssistantContext({ airport, lang, food: [...food, ...centerFood], sights, stations }),
        lang,
      );
      onMessages([
        ...next,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          parts: [{ type: "text", text: answer.text }],
          places: answer.places,
        },
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("ask.error"));
      setInput(question);
    } finally {
      setBusy(false);
      textarea.current?.focus();
    }
  };

  return (
    <section className="mt-6 pb-56">
      <h2 className="text-xl font-semibold">{t("ask.title")}</h2>
      <div className="mt-4 flex flex-wrap gap-2">
        {["dinner", "oldTown", "fourHours"].map((key) => (
          <Button
            key={key}
            variant="outline"
            disabled={busy}
            onClick={() => void send(t(`ask.${key}`))}
            className="h-auto min-h-11 whitespace-normal py-2 text-left"
          >
            {t(`ask.${key}`)}
          </Button>
        ))}
      </div>
      <Conversation className="relative mt-5 h-[48dvh] min-h-64">
        <ConversationContent className="px-0">
          {messages.map((m) => (
            <Message key={m.id} from={m.role} className="w-full">
              <MessageContent
                className={
                  m.role === "user" ? "bg-primary text-primary-foreground" : "bg-transparent"
                }
              >
                {m.parts.map((part, index) => (
                  <MessageResponse key={index}>{part.text}</MessageResponse>
                ))}
                {m.places?.map((p, index) => (
                  <article key={index} className="mt-3 rounded-lg border p-3">
                    <h3 className="font-semibold">{p.name}</h3>
                    <Button
                      variant="outline"
                      className="mt-2 min-h-11 w-full"
                      onClick={() => onShowRoute({ ...p, id: `ai-${m.id}-${index}`, kind: "ai" })}
                    >
                      <Navigation />
                      {t("common.showRoute")}
                    </Button>
                  </article>
                ))}
              </MessageContent>
            </Message>
          ))}
          {busy && (
            <div role="status">
              <Shimmer>{t("ask.thinking")}</Shimmer>
            </div>
          )}
          {error && (
            <p role="alert" className="break-words text-sm text-destructive">
              {error}
            </p>
          )}
        </ConversationContent>
        <ConversationScrollButton aria-label={t("ask.scrollDown")} className="min-h-11 min-w-11" />
      </Conversation>
      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto max-w-xl">
          <PromptInput onSubmit={({ text }) => send(text)}>
            <PromptInputTextarea
              ref={textarea}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t("ask.placeholder", { city: airport.city })}
              maxLength={500}
              className="min-h-16 text-base"
              aria-label={t("ask.title")}
            />
            <PromptInputFooter className="justify-end">
              <PromptInputSubmit
                status={busy ? "submitted" : "ready"}
                disabled={busy || !input.trim()}
                aria-label={t("ask.send")}
                className="size-11"
              />
            </PromptInputFooter>
          </PromptInput>
          <Button variant="outline" onClick={onBack} className="mt-3 min-h-12 w-full">
            <ArrowLeft />
            {t("common.back")}
          </Button>
        </div>
      </div>
    </section>
  );
}
