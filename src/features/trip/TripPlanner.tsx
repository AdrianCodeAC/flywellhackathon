import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Plane, Check, LoaderCircle, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppHeader } from "@/features/arrival/AppHeader";
import cityImage from "@/assets/arrival-craiova.jpg";
import { TripSearch } from "./TripSearch";
import { TripResults } from "./TripResults";
import { tripInputSchema, type Destination, type TripEvent, type TripInput, type TripResult } from "./types";
import { useTripUser } from "./auth";
import { useServerFn } from "@tanstack/react-start";
import { loadTripConversation } from "./conversation.functions";

export function TripPlanner(){
  const {t}=useTranslation();const [input,setInput]=useState<TripInput>();const [result,setResult]=useState<TripResult>();const [busy,setBusy]=useState(false),[editing,setEditing]=useState(true),[error,setError]=useState("");const [suggestions,setSuggestions]=useState<Destination[]>([]);
  const abort=useRef<AbortController|null>(null);const resultRef=useRef<HTMLDivElement>(null);
  const user=useTripUser();const load=useServerFn(loadTripConversation);const restored=useRef<string|null>(null);
  useEffect(()=>()=>abort.current?.abort(),[]);
  const search=useCallback(async(raw:TripInput,preference?:string)=>{
    const parsed=tripInputSchema.safeParse(raw);if(!parsed.success){setError(t("trip.invalidInput"));return;}
    abort.current?.abort();const controller=new AbortController();abort.current=controller;
    setInput(raw);setError("");setBusy(true);setEditing(false);setSuggestions([]);
    try{
      const response=await fetch("/api/trip",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...raw,preference}),signal:controller.signal});
      if(!response.ok||!response.body)throw new Error(t("trip.searchError"));
      const reader=response.body.getReader(),decoder=new TextDecoder();let buffer="";
      const event=(e:TripEvent)=>{
        if(e.type==="destination")setResult(previous=>({...previous,input:{...raw,destination:e.destination.city,destinationIata:e.destination.iata},destination:e.destination}));
        if(e.type==="suggestions")setSuggestions(e.destinations);
        if(e.type==="flights")setResult(r=>r?{...r,flights:e.value}:r);
        if(e.type==="advice")setResult(r=>r?{...r,advice:e.value}:r);
        if(e.type==="extras")setResult(r=>r?{...r,extras:e.value}:r);
        if(e.type==="error"){if(e.section==="advice")setResult(r=>r?{...r,adviceError:e.message}:r);else setError(e.message.includes("Unavailable")?t("trip.searchError"):e.message);}
        if(e.type==="done"&&e.cached)setResult(r=>r?{...r,cached:true}:r);
      };
      while(true){const {value,done}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true});const lines=buffer.split("\n");buffer=lines.pop()??"";for(const line of lines)if(line.trim())event(JSON.parse(line) as TripEvent);}
    }catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:t("trip.searchError"));}
    finally{if(abort.current===controller)setBusy(false);}
  },[t]);
  useEffect(()=>{
    if(!user||restored.current===user.id)return;restored.current=user.id;
    void load().then(row=>{if(row&&!abort.current){const saved=tripInputSchema.safeParse(row.trip_input);if(saved.success)void search(saved.data);}}).catch(()=>{});
  },[user,load,search]);
  return <><AppHeader/>
    {editing&&<section className="arrival-hero trip-hero"><img src={cityImage} alt="" className="arrival-hero-image" width={1920} height={1088} fetchPriority="high"/><div className="arrival-hero-shade"/><div className="arrival-hero-content"><p className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase"><Plane className="size-4"/>{t("trip.eyebrow")}</p><h1 className="font-display text-5xl font-normal sm:text-7xl">{t("trip.title")}</h1><p className="mt-4 max-w-md leading-relaxed text-hero-foreground/90">{t("trip.subtitle")}</p></div><span className="arrival-photo-caption"><MapPin className="size-3"/>{t("design.photoLocation")}</span></section>}
    <main className="mx-auto max-w-6xl px-5 pb-[max(3rem,env(safe-area-inset-bottom))] pt-8 sm:px-8">
      {editing&&<TripSearch key={input?JSON.stringify(input):"new"} initial={input} busy={busy} onSearch={search}/>}
      {busy&&<div role="status" aria-live="polite" className="mb-8 flex flex-wrap items-center justify-between gap-3 border-b py-5"><ol className="flex flex-wrap gap-4 text-sm">{["flightProgress","stayProgress","costProgress"].map((key,i)=>{const done=i===0?Boolean(result?.flights):i===1?Boolean(result?.advice):Boolean(result?.advice&&result?.extras);return <li key={key} className="flex items-center gap-2 text-muted-foreground">{done?<Check className="size-4 text-primary"/>:<LoaderCircle className="size-4 animate-spin motion-reduce:animate-none"/>}{t(`trip.${key}`)}</li>;})}</ol><Button variant="ghost" className="min-h-11" onClick={()=>{abort.current?.abort();setBusy(false);}}>{t("trip.stop")}</Button></div>}
      {error&&<div role="alert" className="my-5 text-sm text-destructive">{error}<Button variant="ghost" className="ml-2 min-h-11" onClick={()=>setEditing(true)}>{t("trip.edit")}</Button></div>}
      {suggestions.length>0&&<section className="py-6"><h2 className="mb-5 font-display text-3xl">{t("trip.chooseDestination")}</h2><div className="grid gap-4 sm:grid-cols-3">{suggestions.map(d=><Button key={d.iata} variant="outline" className="h-auto min-h-24 whitespace-normal p-5 text-lg" onClick={()=>input&&void search({...input,destination:d.city,destinationIata:d.iata})}>{d.city} · {d.iata}</Button>)}</div></section>}
      {result&&!editing&&<div ref={resultRef}><TripResults result={result} busy={busy} onEdit={()=>setEditing(true)} onAdjust={search}/></div>}
    </main>
    <footer className="mx-auto flex max-w-6xl flex-wrap justify-between gap-3 border-t px-5 py-6 text-xs text-muted-foreground"><span>{t("design.brand")}.</span><a href="https://commons.wikimedia.org/wiki/File:Nicolae_Romanescu_Park_in_Craiova,_Romania.jpg" target="_blank" rel="noreferrer" className="underline">{t("design.photoCredit")}</a></footer>
  </>;
}