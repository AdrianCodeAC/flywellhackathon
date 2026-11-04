import { useEffect,useState,type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { useServerFn } from '@tanstack/react-start';
import { Plane } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { getCityPhoto } from './discovery.functions';
import { AirportSearch } from '@/features/arrival/AirportSearch';
import type { Airport } from '@/features/arrival/types';
import type { RouteFare } from './discovery';
import { useReveal } from './useReveal';
import { nights } from './types';
export function TripRecommendations({fares,loading,origin,onOriginChange,onPick}:{fares:RouteFare[];loading:boolean;origin:Airport|null;onOriginChange:(airport:Airport|null)=>void;onPick:(fare:RouteFare)=>void}){
 const {t}=useTranslation();const heading=useReveal<HTMLHeadingElement>();
 return <section className="relative mx-auto max-w-6xl px-5 sm:px-8"><div className="mb-5 flex flex-wrap items-end justify-between gap-4"><h2 ref={heading} className="reveal font-poster text-3xl uppercase sm:text-4xl">{t('landing.recommended')}</h2><div className="w-full sm:w-80"><AirportSearch selected={origin} onSelect={onOriginChange} onClear={()=>onOriginChange(null)} label={t('trip.from')}/></div></div>{loading?<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[0,1,2,3].map(k=><Skeleton key={k} className="h-80 rounded-2xl"/>)}</div>:<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{fares.map((f,i)=><FareCard key={f.id} fare={f} index={i} onPick={()=>onPick(f)}/>)}</div>}{!loading&&!fares.length&&<p className="text-sm text-muted-foreground">{t('trip.noRecommendations')}</p>}</section>;
}
function FareCard({fare:f,index,onPick}:{fare:RouteFare;index:number;onPick:()=>void}){
 const card=useReveal<HTMLElement>();const {t,i18n}=useTranslation(),load=useServerFn(getCityPhoto);const [photo,setPhoto]=useState<string|null>(null);const lang=i18n.language==='ro'?'ro':'en';
 useEffect(()=>{let active=true;void load({data:{city:f.city,lang}}).then(url=>{if(active)setPhoto(url);}).catch(()=>{});return()=>{active=false;};},[f.city,lang,load]);
 const date=(d:string)=>new Intl.DateTimeFormat(lang,{day:'numeric',month:'short'}).format(new Date(d));
 return <article ref={card} style={{'--i':index%4} as CSSProperties} className="reveal fare-card flex gap-4 sm:flex-col sm:gap-0">{photo?<img src={photo} alt={f.city} className="fare-photo object-cover" loading="lazy"/>:<div className="fare-photo photo-fallback flex items-center justify-center"><Plane className="size-8 text-primary"/></div>}<div className="flex min-w-0 flex-1 flex-col sm:pt-4"><div className="flex items-baseline gap-2"><h3 className="font-poster text-2xl uppercase">{f.city}</h3><span className="text-xs text-muted-foreground">{f.destinationIata}</span></div><p className="mt-2 text-xs text-muted-foreground">{date(f.departure)}{f.returnDate?` → ${date(f.returnDate)} · ${t('trip.nights',{count:nights(f.departure.slice(0,10),f.returnDate.slice(0,10))})}`:` · ${t('trip.oneWay')}`}</p><p className="mt-2 text-xs">{f.airline} · {f.stops?t('trip.stops',{count:f.stops}):t('trip.directFlight')}</p><p className="mt-2 text-xs text-primary">Flywell · {t('trip.score')} {f.score}/100</p><p className="mt-3 text-xl font-semibold tabular-nums">{t('trip.fromPrice',{price:new Intl.NumberFormat(lang,{style:'currency',currency:f.currency,maximumFractionDigits:0}).format(f.price)})}</p><p className="mb-3 text-xs text-muted-foreground">{t(f.returnDate?'trip.perPerson':'trip.perPersonOneWay')}</p><Button type="button" className="mt-auto min-h-11 w-full" onClick={onPick}>{t('trip.chooseFlight')}</Button></div></article>;
}