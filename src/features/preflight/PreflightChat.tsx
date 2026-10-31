import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ExternalLink, MessageCircleQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { askPreflight } from "./ai.functions";
import { SOURCES, describeTrip, type PreflightInput, type SourceId } from "./rules";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  sources?: SourceId[];
}

/** "Ask the pre-flight agent": works with or without a trip filled in. */
export function PreflightChat({ input }: { input: PreflightInput | null }) {
  const { t, i18n } = useTranslation();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const send = async (question: string) => {
    const q = question.trim();
    if (busy || !q) return;
    const next: ChatMessage[] = [...messages, { id: crypto.randomUUID(), role: "user", text: q }];
    setMessages(next);
    setDraft("");
    setBusy(true);
    setError("");
    try {
      const answer = await askPreflight({
        data: {
          question: q,
          history: messages
            .slice(-12)
            .map((m) => ({ role: m.role, content: m.text.slice(0, 4000) })),
          trip: input ? describeTrip(input) : "",
          lang: i18n.language === "ro" ? "ro" : "en",
        },
      });
      setMessages([
        ...next,
        { id: crypto.randomUUID(), role: "assistant", text: answer.text, sources: answer.sources },
      ]);
    } catch {
      setError(t("preflight.chatError"));
      setDraft(q);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mt-12 border-t pt-8" aria-labelledby="preflight-chat">
      <h2 id="preflight-chat" className="flex items-center gap-2 font-display text-3xl">
        <MessageCircleQuestion className="size-6 text-primary" />
        {t("preflight.chatTitle")}
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">{t("preflight.chatIntro")}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {(["q1", "q2", "q3", "q4"] as const).map((key) => (
          <Button
            key={key}
            variant="outline"
            disabled={busy}
            onClick={() => void send(t(`preflight.examples.${key}`))}
            className="h-auto min-h-11 whitespace-normal py-2 text-left"
          >
            {t(`preflight.examples.${key}`)}
          </Button>
        ))}
      </div>
      {(messages.length > 0 || busy) && (
        <Conversation className="relative mt-5 max-h-[60dvh] min-h-48">
          <ConversationContent className="px-0">
            {messages.map((m) => (
              <Message key={m.id} from={m.role} className="w-full">
                <MessageContent
                  className={
                    m.role === "user" ? "bg-primary text-primary-foreground" : "bg-transparent"
                  }
                >
                  <MessageResponse>{m.text}</MessageResponse>
                  {m.sources?.map((s) => (
                    <a
                      key={s}
                      href={SOURCES[s].url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 flex min-h-11 items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline"
                    >
                      {SOURCES[s].name}
                      <ExternalLink className="size-3.5" />
                    </a>
                  ))}
                </MessageContent>
              </Message>
            ))}
            {busy && (
              <div role="status">
                <Shimmer>{t("ask.thinking")}</Shimmer>
              </div>
            )}
          </ConversationContent>
          <ConversationScrollButton
            aria-label={t("ask.scrollDown")}
            className="min-h-11 min-w-11"
          />
        </Conversation>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      )}
      <PromptInput onSubmit={({ text }) => send(text)} className="mt-5">
        <PromptInputTextarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t("preflight.chatPlaceholder")}
          maxLength={500}
          className="min-h-16 text-base"
          aria-label={t("preflight.chatTitle")}
        />
        <PromptInputFooter className="justify-end">
          <PromptInputSubmit
            status={busy ? "submitted" : "ready"}
            disabled={busy || !draft.trim()}
            aria-label={t("ask.send")}
            className="size-11"
          />
        </PromptInputFooter>
      </PromptInput>
    </section>
  );
}
