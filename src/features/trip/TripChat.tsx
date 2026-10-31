import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Conversation, ConversationContent, ConversationScrollButton } from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import { PromptInput, PromptInputTextarea, PromptInputFooter, PromptInputSubmit } from "@/components/ai-elements/prompt-input";
import { Tool, ToolContent } from "@/components/ai-elements/tool";
import { CollapsibleTrigger } from "@/components/ui/collapsible";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Plane, ChevronDown } from "lucide-react";
import { loadTripConversation } from "./conversation.functions";
import { TripSignIn, useTripUser } from "./auth";
import { tripInputSchema, type TripInput } from "./types";

export function TripChat({input,onAdjust}:{input:TripInput;onAdjust:(input:TripInput,preference?:string)=>void}) {
  const user=useTripUser();
  const {t}=useTranslation();
  return <section className="border-t pt-7"><h2 className="mb-4 flex items-center gap-2 font-display text-3xl"><Plane className="size-5 text-primary"/>{t("trip.askAgent")}</h2>
    {user?<SignedTripChat key={user.id} input={input} onAdjust={onAdjust}/>:<TripSignIn/>}
  </section>;
}
function SignedTripChat({input,onAdjust}:{input:TripInput;onAdjust:(input:TripInput,preference?:string)=>void}) {
  const {t}=useTranslation();const [text,setText]=useState("");const [loadError,setLoadError]=useState("");const ref=useRef<HTMLTextAreaElement>(null);
  const inputRef=useRef(input);inputRef.current=input;
  const seen=useRef(new Set<string>());
  const transport=useMemo(()=>new DefaultChatTransport({api:"/api/trip-chat",headers:async()=>{
    const {data}=await supabase.auth.getSession();return data.session?{Authorization:`Bearer ${data.session.access_token}`}:{Authorization:""};
  },body:()=>({input:inputRef.current})}),[]);
  const {messages,setMessages,sendMessage,status,stop,error}=useChat({transport});
  const load=useServerFn(loadTripConversation);
  const loaded=useRef(false);
  useEffect(()=>{if(loaded.current)return;let active=true;void load().then(row=>{if(active){loaded.current=true;if(row){const stored=row.messages as unknown as UIMessage[];for(const m of stored)for(const p of m.parts)if(p.type==="tool-adjustTrip"&&"toolCallId"in p)seen.current.add(p.toolCallId);setMessages(stored);}}}).catch(()=>setLoadError(t("trip.loadChatError")));return()=>{active=false;};},[load,setMessages,t]);
  useEffect(()=>{for(const m of messages)for(const part of m.parts){if(part.type==="tool-adjustTrip" && "state"in part && part.state==="output-available" && "toolCallId"in part && !seen.current.has(part.toolCallId) && "output"in part){
    seen.current.add(part.toolCallId);const output=part.output as {input:unknown;preference?:string|null};const parsed=tripInputSchema.safeParse(output.input);if(parsed.success)onAdjust(parsed.data,output.preference??undefined);
  }}},[messages,onAdjust]);
  const busy=status==="submitted"||status==="streaming";
  useEffect(()=>{if(!busy)ref.current?.focus();},[busy]);
  return <>
    <Conversation className="relative h-72"><ConversationContent className="px-0">
      {messages.map(m=><Message key={m.id} from={m.role}><MessageContent className={m.role==="user"?"bg-primary text-primary-foreground":"bg-transparent"}>
        {m.parts.map((p,i)=>p.type==="text"?<MessageResponse key={i}>{p.text}</MessageResponse>:p.type==="reasoning"?<details key={i} className="text-sm text-muted-foreground"><summary>{t("trip.reasoning")}</summary><MessageResponse>{p.text}</MessageResponse></details>:p.type==="tool-adjustTrip"?<Tool key={i} defaultOpen={false}><CollapsibleTrigger className="flex min-h-11 w-full items-center justify-between px-3 text-sm"><span>{t("trip.adjusting")} · {t(p.state==="output-error"?"common.error":p.state==="output-available"?"trip.updated":"ask.thinking")}</span><ChevronDown className="size-4"/></CollapsibleTrigger><ToolContent><p>{p.state==="output-error"?p.errorText:t("trip.updated")}</p></ToolContent></Tool>:null)}
      </MessageContent></Message>)}
      {busy&&<Shimmer>{t("ask.thinking")}</Shimmer>}
      {(error||loadError)&&<p role="alert" className="break-words text-sm text-destructive">{error?.message||loadError}</p>}
    </ConversationContent><ConversationScrollButton aria-label={t("ask.scrollDown")}/></Conversation>
    <PromptInput onSubmit={async({text})=>{if(!text.trim()||busy)return;setText("");await sendMessage({text});}}>
      <PromptInputTextarea ref={ref} value={text} onChange={e=>setText(e.target.value)} placeholder={t("trip.chatPlaceholder")} aria-label={t("trip.askAgent")} maxLength={500} className="min-h-20 text-base"/>
      <PromptInputFooter className="justify-end"><PromptInputSubmit className="size-11" status={status} onStop={stop} disabled={!busy&&!text.trim()} aria-label={busy?t("trip.stop"):t("ask.send")}/></PromptInputFooter>
    </PromptInput>
  </>;
}