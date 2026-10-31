import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "@tanstack/react-router";
import { searchAirports } from "@/features/arrival/airport-search";
import { useServerFn } from "@tanstack/react-start";
import { format, addDays, startOfDay } from "date-fns";
import type { DateRange } from "react-day-picker";
import { MapPin, CalendarDays, Users, Minus, Plus, ArrowRight, SlidersHorizontal, Plane, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { AirportSearch } from "@/features/arrival/AirportSearch";
import { loadAirports } from "@/features/arrival/services";
import type { Airport } from "@/features/arrival/types";
import { nights, type TripInput } from "./types";
import { getDiscovery } from "./discovery.functions";
import { type Discovery, type RouteFare } from "./discovery";
import { TripDates } from "./TripDates";
import { TripRecommendations } from "./TripRecommendations";

export function TripSearch({initial,busy,onSearch}:{initial?:TripInput|undefined;busy:boolean;onSearch:(input:TripInput)=>void}) {
  const {t,i18n}=useTranslation();
  const [destination,setDestination]=useState(initial?.destination??""),[iata,setIata]=useState<string|null>(initial?.destinationIata??null);
  const [range,setRange]=useState<DateRange|undefined>();const [adults,setAdults]=useState(initial?.adults??1),[children,setChildren]=useState(initial?.children??0);
  const [more,setMore]=useState(false),[flexible,setFlexible]=useState(initial?.flexible??false),[origin,setOrigin]=useState(initial?.origin??"CRA");
  const [budget,setBudget]=useState<TripInput["budget"]>(initial?.budget??"medium"),[direct,setDirect]=useState(initial?.direct??false),[bag,setBag]=useState(initial?.bag??false),[oneWay,setOneWay]=useState(initial?.oneWay??false);
  const [airports,setAirports]=useState<Airport[]>([]),[suggest,setSuggest]=useState(false),[error,setError]=useState(""),[includeStop]=useState(true),[discovery,setDiscovery]=useState<Discovery>(),[loading,setLoading]=useState(false),[selectedFare,setSelectedFare]=useState<RouteFare>();
  const navigate=useNavigate();const card=useRef<HTMLFormElement>(null);const load=useServerFn(getDiscovery);const lang=i18n.language==="ro"?"ro":"en";
  useEffect(()=>{setRange({from:initial?new Date(`${initial.departure}T12:00:00`):addDays(startOfDay(new Date()),12),to:initial&&!initial.oneWay?new Date(`${initial.returnDate}T12:00:00`):initial?undefined:addDays(startOfDay(new Date()),16)});void loadAirports().then(setAirports);if(!initial){try{const saved=localStorage.getItem('flywell:origin');if(saved&&/^[A-Z]{3}$/.test(saved))setOrigin(saved);}catch{}}},[initial]);
  useEffect(()=>{if(!origin){setDiscovery(undefined);return;}let active=true;setLoading(true);setDiscovery(undefined);void load({data:{origin,lang,includeStop}}).then(value=>{if(!active)return;setDiscovery(value);}).catch(()=>{if(active)setError(t('trip.providerUnavailable'));}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[origin,lang,includeStop,load,t]);
  
  const from=range?.from?format(range.from,"yyyy-MM-dd"):"",to=oneWay?from:range?.to?format(range.to,"yyyy-MM-dd"):"";
  const hits=searchAirports(airports,destination).slice(0,12).map(a=>({destinationIata:a.iata,city:a.city,country:a.countryCode,stops:discovery?.routes.some(r=>r.destinationIata===a.iata&&r.stops===0)?0:1}));
  function changeOrigin(a:Airport|null){setOrigin(a?.iata??'');setSelectedFare(undefined);setDestination('');setIata(null);if(a){try{localStorage.setItem('flywell:origin',a.iata);}catch{}}}
  function choose(f:RouteFare){setDestination(f.city);setIata(f.destinationIata);setSuggest(false);setSelectedFare(f);setOneWay(!f.returnDate);setRange({from:new Date(f.departure),to:f.returnDate?new Date(f.returnDate):undefined});card.current?.scrollIntoView({behavior:'smooth',block:'start'});}
  function submit(e:React.FormEvent){e.preventDefault();setError("");if(!iata||!from||!to||(!oneWay&&nights(from,to)<1)||!airports.some(a=>a.iata===origin)){setError(t("trip.invalidInput"));return;}
    onSearch({destination,destinationIata:iata,origin,departure:from,returnDate:to,adults,children,flexible,budget,direct:discovery?.routes.some(r=>r.destinationIata===iata&&r.stops===0)?direct:false,bag,oneWay,lang});
  }
  const originAirport=airports.find(a=>a.iata===origin)??null;
  return <><form ref={card} onSubmit={submit} className="trip-search rounded-lg border bg-card p-5 sm:p-7">
    <div className="grid gap-6 lg:grid-cols-2">
      <div><label className="mb-3 flex items-center gap-2 text-sm font-semibold"><Plane className="size-4 text-primary"/>{t('trip.from')}</label><AirportSearch selected={originAirport} onSelect={changeOrigin} onClear={()=>changeOrigin(null)} label={t('trip.from')}/></div>
      <div className="relative"><label htmlFor="trip-to" className="mb-3 flex items-center gap-2 text-sm font-semibold"><MapPin className="size-4 text-primary"/>{t('trip.to')}</label>
        <Input id="trip-to" autoComplete="off" required value={destination} disabled={!origin} onFocus={()=>setSuggest(true)} onChange={e=>{setDestination(e.target.value);setIata(null);setSuggest(true);setSelectedFare(undefined);}} onKeyDown={e=>{if(e.key==='Escape')setSuggest(false);if(e.key==='Enter'&&suggest){e.preventDefault();const first=hits[0];if(first){setDestination(first.city);setIata(first.destinationIata);setSuggest(false);}}}} placeholder={t('trip.toPlaceholder')} className="min-h-14 text-base" role="combobox" aria-expanded={suggest} aria-controls="trip-destinations"/>
        {loading&&<p role="status" className="mt-2 flex items-center gap-2 text-xs text-muted-foreground"><LoaderCircle className="size-4 animate-spin"/>{t('trip.loadingRoutes')}</p>}
        {suggest&&!loading&&<div id="trip-destinations" role="listbox" className="absolute z-20 mt-1 max-h-80 w-full overflow-y-auto rounded-md border bg-popover p-1 shadow-md">{hits.map(a=><Button type="button" role="option" aria-selected={iata===a.destinationIata} key={a.destinationIata} variant="ghost" className="h-auto min-h-14 w-full items-start justify-start whitespace-normal text-left" onClick={()=>{setDestination(a.city);setIata(a.destinationIata);setSuggest(false);}}><span className="min-w-0"><span className="font-semibold">{a.destinationIata} · {a.city}</span><span className="mt-1 block text-xs text-muted-foreground">{new Intl.DisplayNames([lang],{type:'region'}).of(a.country)} · {a.stops?t('trip.withStops'):t('trip.directFlight')}</span></span></Button>)}{!hits.length&&<p className="p-3 text-sm text-muted-foreground">{t('trip.noRoutes')}</p>}</div>}
        
        {!loading&&origin&&discovery&&!discovery.routes.length&&<div className="mt-2 text-sm text-muted-foreground"><p>{t(discovery.unavailable?'trip.providerUnavailable':'trip.noRoutes')}</p><Button asChild type="button" variant="link" className="min-h-11 px-0"><a href={`https://www.google.com/travel/flights?q=${encodeURIComponent(`Flights from ${origin}`)}`} target="_blank" rel="noreferrer">{t('trip.googleFlights')}</a></Button></div>}
      </div>
      <div><label className="mb-3 flex items-center gap-2 text-sm font-semibold"><CalendarDays className="size-4 text-primary"/>{t('trip.when')}</label>
        <div className="mb-2 flex min-h-11 items-center" role="group" aria-label={t('trip.tripType')}>
          <Button type="button" variant={oneWay?'outline':'default'} aria-pressed={!oneWay} className="min-h-11 rounded-r-none px-3" onClick={()=>{setOneWay(false);if(range?.from&&!range.to)setRange({from:range.from,to:addDays(range.from,4)});}}>{t('trip.roundTrip')}</Button>
          <Button type="button" variant={oneWay?'default':'outline'} aria-pressed={oneWay} className="min-h-11 rounded-l-none px-3" onClick={()=>{setOneWay(true);setRange(r=>r?{from:r.from,to:undefined}:r);setSelectedFare(undefined);}}>{t('trip.oneWay')}</Button>
        </div>
        <TripDates origin={origin} destination={iata} range={range} onChange={value=>{setRange(value);setSelectedFare(undefined);}} oneWay={oneWay} setOneWay={setOneWay} flexible={flexible} setFlexible={setFlexible}/></div>
      <div><label className="mb-3 flex items-center gap-2 text-sm font-semibold"><Users className="size-4 text-primary"/>{t('trip.who')}</label><Stepper label={t('trip.adults')} value={adults} min={1} max={9-children} onChange={setAdults}/><Stepper label={t('trip.children')} value={children} min={0} max={9-adults} onChange={setChildren}/></div>
    </div>
    {selectedFare&&<p className="mt-4 border-t pt-4 text-sm text-primary">{t('trip.selectedFlight',{city:selectedFare.city})} · {new Intl.NumberFormat(lang,{style:'currency',currency:selectedFare.currency,maximumFractionDigits:0}).format(selectedFare.price)} · {t('trip.cachedFares')}</p>}
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-4"><Button type="button" variant="ghost" className="min-h-11 px-0 text-muted-foreground" aria-expanded={more} onClick={()=>setMore(!more)}><SlidersHorizontal className="size-4"/>{t('trip.more')}</Button><Button type="button" variant="outline" className="min-h-12 w-full whitespace-normal sm:w-auto" disabled={!origin||!from||!to} onClick={()=>void navigate({to:"/flights",search:{origin,from,to,flexible,adults,children,lang}})}>{t("trip.seeAll")}</Button><Button type="submit" disabled={busy||!iata} className="min-h-12 w-full px-7 text-base sm:w-auto">{t('trip.find')}<ArrowRight className="size-4"/></Button></div>
    {more&&<div className="mt-4 grid gap-5 border-t pt-5 sm:grid-cols-2"><div><p className="mb-2 text-sm font-medium">{t('trip.budget')}</p><div className="flex" role="group" aria-label={t('trip.budget')}>{(['budget','medium','comfort'] as const).map(b=><Button type="button" key={b} variant={budget===b?'default':'outline'} aria-pressed={budget===b} className="min-h-11 flex-1 rounded-none first:rounded-l-md last:rounded-r-md px-2" onClick={()=>setBudget(b)}>{t(`trip.${b}`)}</Button>)}</div></div><label className="flex min-h-11 items-center justify-between gap-3"><span className="text-sm">{t('trip.direct')}</span><Switch checked={direct} onCheckedChange={setDirect}/></label><label className="flex min-h-11 items-center justify-between gap-3"><span className="text-sm">{t('trip.bag')}</span><Switch checked={bag} onCheckedChange={setBag}/></label></div>}
    {error&&<p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
  </form><TripRecommendations fares={discovery?.fares??[]} city={originAirport?.city??origin} loading={loading} onPick={choose}/></>;
}
function Stepper({label,value,min,max,onChange}:{label:string;value:number;min:number;max:number;onChange:(n:number)=>void}){const {t}=useTranslation();return <div className="flex min-h-12 items-center justify-between gap-2"><span className="text-sm">{label}</span><div className="flex items-center gap-1"><Button type="button" variant="ghost" size="icon" className="size-11" disabled={value<=min} aria-label={t('trip.decrease',{group:label})} onClick={()=>onChange(value-1)}><Minus className="size-4"/></Button><output className="w-6 text-center font-semibold">{value}</output><Button type="button" variant="ghost" size="icon" className="size-11" disabled={value>=max} aria-label={t('trip.increase',{group:label})} onClick={()=>onChange(value+1)}><Plus className="size-4"/></Button></div></div>;}
