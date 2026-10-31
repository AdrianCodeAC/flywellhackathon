import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { format, addDays, startOfDay } from "date-fns";
import { ro, enGB } from "date-fns/locale";
import type { DateRange } from "react-day-picker";
import { MapPin, CalendarDays, Users, Minus, Plus, ArrowRight, SlidersHorizontal, LocateFixed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { loadAirports, distanceMeters } from "@/features/arrival/services";
import type { Airport } from "@/features/arrival/types";
import { nights, type TripInput } from "./types";

export function TripSearch({initial,busy,onSearch}:{initial?:TripInput;busy:boolean;onSearch:(input:TripInput)=>void}) {
  const {t,i18n}=useTranslation();
  const [destination,setDestination]=useState(initial?.destination??"");const [iata,setIata]=useState<string|null>(initial?.destinationIata??null);
  const [range,setRange]=useState<DateRange|undefined>();const [adults,setAdults]=useState(initial?.adults??1),[children,setChildren]=useState(initial?.children??0);
  const [more,setMore]=useState(false),[flexible,setFlexible]=useState(initial?.flexible??false),[origin,setOrigin]=useState(initial?.origin??"CRA");
  const [budget,setBudget]=useState<TripInput["budget"]>(initial?.budget??"medium"),[direct,setDirect]=useState(initial?.direct??false),[bag,setBag]=useState(initial?.bag??false);
  const [airports,setAirports]=useState<Airport[]>([]),[suggest,setSuggest]=useState(false),[error,setError]=useState("");
  useEffect(()=>{setRange({from:initial?new Date(`${initial.departure}T12:00:00`):addDays(startOfDay(new Date()),12),to:initial?new Date(`${initial.returnDate}T12:00:00`):addDays(startOfDay(new Date()),16)});},[initial]);
  useEffect(()=>{void loadAirports().then(setAirports).catch(()=>{});},[]);
  const from=range?.from?format(range.from,"yyyy-MM-dd"):"",to=range?.to?format(range.to,"yyyy-MM-dd"):"";
  const hits=destination.length>=2?airports.filter(a=>`${a.iata} ${a.city} ${a.name}`.toLowerCase().includes(destination.toLowerCase())).slice(0,5):[];
  function gps(){
    if(!navigator.geolocation){setError(t("search.locationUnsupported"));return;}
    navigator.geolocation.getCurrentPosition(({coords})=>{
      const closest=[...airports].sort((a,b)=>distanceMeters(coords.latitude,coords.longitude,a.lat,a.lon)-distanceMeters(coords.latitude,coords.longitude,b.lat,b.lon))[0];if(closest)setOrigin(closest.iata);
    },()=>setError(t("search.locationDenied")),{timeout:10000});
  }
  function submit(e:React.FormEvent){e.preventDefault();setError("");if(!from||!to||nights(from,to)<1||!airports.some(a=>a.iata===origin)){setError(t("trip.invalidInput"));return;}
    onSearch({destination,destinationIata:iata,origin,departure:from,returnDate:to,adults,children,flexible,budget,direct,bag,lang:i18n.language==="ro"?"ro":"en"});
  }
  return <form onSubmit={submit} className="trip-search rounded-lg border bg-card p-5 sm:p-7">
    <div className="grid gap-6 md:grid-cols-[1.25fr_1.1fr_1fr]">
      <div className="relative"><label htmlFor="trip-where" className="mb-3 flex items-center gap-2 text-sm font-semibold"><MapPin className="size-4 text-primary"/>{t("trip.where")}</label>
        <Input id="trip-where" autoComplete="off" required value={destination} onFocus={()=>setSuggest(true)} onChange={e=>{setDestination(e.target.value);setIata(null);setSuggest(true);}} placeholder={t("trip.wherePlaceholder")} className="min-h-12 text-base" role="combobox" aria-expanded={suggest&&hits.length>0} aria-controls="trip-destinations"/>
        {suggest&&hits.length>0&&<div id="trip-destinations" role="listbox" className="absolute top-full z-20 mt-1 w-full rounded-md border bg-popover p-1 shadow-md">{hits.map(a=><Button type="button" role="option" aria-selected={iata===a.iata} key={a.iata} variant="ghost" className="h-auto min-h-11 w-full justify-start whitespace-normal text-left" onClick={()=>{setDestination(a.city);setIata(a.iata);setSuggest(false);}}>{a.city}<span className="ml-auto pl-3 text-xs text-muted-foreground">{a.iata}</span></Button>)}</div>}
      </div>
      <div><label className="mb-3 flex items-center gap-2 text-sm font-semibold"><CalendarDays className="size-4 text-primary"/>{t("trip.when")}</label>
        <Popover><PopoverTrigger asChild><Button type="button" variant="outline" className="min-h-12 w-full justify-start text-left font-normal" aria-label={t("trip.dates")}>{range?.from&&range.to?`${format(range.from,"d MMM",{locale:i18n.language==="ro"?ro:enGB})} — ${format(range.to,"d MMM yyyy",{locale:i18n.language==="ro"?ro:enGB})}`:t("trip.dates")}</Button></PopoverTrigger>
          <PopoverContent className="w-auto max-w-[calc(100vw-24px)] p-0" align="start"><Calendar mode="range" selected={range} onSelect={setRange} min={1} max={90} defaultMonth={range?.from} disabled={{before:startOfDay(new Date())}} locale={i18n.language==="ro"?ro:enGB} className="pointer-events-auto [--cell-size:44px]"/></PopoverContent>
        </Popover>
        <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground"><span>{from&&to?t("trip.nights",{count:nights(from,to)}):""}</span><label className="flex min-h-11 items-center gap-2"><Switch checked={flexible} onCheckedChange={setFlexible} aria-label={t("trip.flexible")}/>{t("trip.flexible")}</label></div>
      </div>
      <div><label className="mb-3 flex items-center gap-2 text-sm font-semibold"><Users className="size-4 text-primary"/>{t("trip.who")}</label>
        <Stepper label={t("trip.adults")} value={adults} min={1} max={9-children} onChange={setAdults}/><Stepper label={t("trip.children")} value={children} min={0} max={9-adults} onChange={setChildren}/>
      </div>
    </div>
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-4"><Button type="button" variant="ghost" className="min-h-11 px-0 text-muted-foreground" aria-expanded={more} onClick={()=>setMore(!more)}><SlidersHorizontal className="size-4"/>{t("trip.more")}</Button>
      <Button type="submit" disabled={busy} className="min-h-12 w-full px-7 text-base sm:w-auto">{t("trip.find")}<ArrowRight className="size-4"/></Button>
    </div>
    {more&&<div className="mt-4 grid gap-5 border-t pt-5 sm:grid-cols-2">
      <div><label htmlFor="trip-origin" className="text-sm font-medium">{t("trip.origin")}</label><div className="mt-2 flex gap-2"><Input id="trip-origin" list="trip-airports" value={origin} maxLength={3} onChange={e=>setOrigin(e.target.value.toUpperCase())} className="min-h-11"/><Button type="button" variant="outline" size="icon" className="size-11 shrink-0" title={t("search.useLocation")} aria-label={t("search.useLocation")} onClick={gps}><LocateFixed/></Button></div><datalist id="trip-airports">{airports.map(a=><option key={a.iata} value={a.iata}>{a.city}</option>)}</datalist></div>
      <div><p className="mb-2 text-sm font-medium">{t("trip.budget")}</p><div className="flex" role="group" aria-label={t("trip.budget")}>{(["budget","medium","comfort"] as const).map(b=><Button type="button" key={b} variant={budget===b?"default":"outline"} aria-pressed={budget===b} className="min-h-11 flex-1 rounded-none first:rounded-l-md last:rounded-r-md px-2" onClick={()=>setBudget(b)}>{t(`trip.${b}`)}</Button>)}</div></div>
      <label className="flex min-h-11 items-center justify-between gap-3"><span className="text-sm">{t("trip.direct")}</span><Switch checked={direct} onCheckedChange={setDirect}/></label>
      <label className="flex min-h-11 items-center justify-between gap-3"><span className="text-sm">{t("trip.bag")}</span><Switch checked={bag} onCheckedChange={setBag}/></label>
    </div>}
    {error&&<p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
  </form>;
}
function Stepper({label,value,min,max,onChange}:{label:string;value:number;min:number;max:number;onChange:(n:number)=>void}){
  const {t}=useTranslation();return <div className="flex min-h-12 items-center justify-between gap-2"><span className="text-sm">{label}</span><div className="flex items-center gap-1"><Button type="button" variant="ghost" size="icon" className="size-11" disabled={value<=min} aria-label={t("trip.decrease",{group:label})} onClick={()=>onChange(value-1)}><Minus className="size-4"/></Button><output className="w-6 text-center font-semibold">{value}</output><Button type="button" variant="ghost" size="icon" className="size-11" disabled={value>=max} aria-label={t("trip.increase",{group:label})} onClick={()=>onChange(value+1)}><Plus className="size-4"/></Button></div></div>;
}