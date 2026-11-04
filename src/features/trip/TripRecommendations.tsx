import { useEffect,useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useServerFn } from '@tanstack/react-start';
import { Plane } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { getCityPhoto } from './discovery.functions';
import { AirportSearch } from '@/features/arrival/AirportSearch';
import type { Airport } from '@/features/arrival/types';
import type { RouteFare } from './discovery';
import { nights } from './types';
export function TripRecommendations({fares,loading,origin,onOriginChange,onPick}:{fares:RouteFare[];loading:boolean;origin:Airport|null;onOriginChange:(airport:Airport|null)=>void;onPick:(fare:RouteFare)=>void}){
 const {t}=useTranslation();
 return <section className="mx-auto max-w-6xl px-5 sm:px-8"><div className="mb-5 flex flex-wrap items-end justify-between gap-4"><h2 className="font-poster text-3xl uppercase sm:text-4xl">{t('landing.recommended')}</h2><div className="w-full sm:w-80"><AirportSearch selected={origin} onSelect={onOriginChange} onClear={()=>onOriginChange(null)} label={t('trip.from')}/></div></div>{loading?<div className="flex gap-4 overflow-hidden">{[0,1,2,3].map(k=><Skeleton key={k} className="h-80 w-60 shrink-0 rounded-lg lg:flex-1"/>)}</div>:<div className="flex snap-x gap-4 overflow-x-auto pb-3 lg:grid lg:grid-cols-4 lg:overflow-visible">{fares.map(f=><FareCard key={f.id} fare={f} onPick={()=>onPick(f)}/>)}</div>}{!loading&&!fares.length&&<p className="text-sm text-muted-foreground">{t('trip.noRecommendations')}</p>}</section>;
}
function FareCard({fare:f,onPick}:{fare:RouteFare;onPick:()=>void}){
 const {t,i18n}=useTranslation(),load=useServerFn(getCityPhoto);const [photo,setPhoto]=useState<string|null>(null);const lang=i18n.language==='ro'?'ro':'en';
 useEffect(()=>{let active=true;void load({data:{city:f.city,lang}}).then(url=>{if(active)setPhoto(url);}).catch(()=>{});return()=>{active=false;};},[f.city,lang,load]);
 const date=(d:string)=>new Intl.DateTimeFormat(lang,{day:'numeric',month:'short'}).format(new Date(d));
 return <article className="fare-card w-60 shrink-0 snap-start overflow-hidden rounded-lg border bg-card p-2 lg:w-auto">{photo?<img src={photo} alt={f.city} className="fare-photo h-36 w-full object-cover" loading="lazy"/>:<div className="fare-photo photo-fallback flex h-36 items-center justify-center"><Plane className="size-8 text-primary"/></div>}<div className="p-2 pt-3"><h3 className="text-lg font-semibold">{f.city} <span className="text-xs font-normal text-muted-foreground">{f.destinationIata}</span></h3><p className="mt-2 text-xs text-muted-foreground">{date(f.departure)}{f.returnDate?` → ${date(f.returnDate)} · ${t('trip.nights',{count:nights(f.departure.slice(0,10),f.returnDate.slice(0,10))})}`:` · ${t('trip.oneWay')}`}</p><p className="mt-2 text-xs">{f.airline} · {f.stops?t('trip.stops',{count:f.stops}):t('trip.directFlight')}</p><p className="mt-2 text-xs text-primary">Flywell · {t('trip.score')} {f.score}/100</p><p className="mt-3 text-lg font-semibold">{t('trip.fromPrice',{price:new Intl.NumberFormat(lang,{style:'currency',currency:f.currency,maximumFractionDigits:0}).format(f.price)})}</p><p className="text-xs text-muted-foreground">{t(f.returnDate?'trip.perPerson':'trip.perPersonOneWay')}</p><Button type="button" className="mt-3 min-h-11 w-full" onClick={onPick}>{t('trip.chooseFlight')}</Button></div></article>;
}