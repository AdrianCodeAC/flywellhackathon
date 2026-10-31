import { useEffect,useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useServerFn } from '@tanstack/react-start';
import { Plane } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { getCityPhoto } from './discovery.functions';
import { recommendationGroups,type RouteFare } from './discovery';
import { nights } from './types';
export function TripRecommendations({fares,city,loading,onPick}:{fares:RouteFare[];city:string;loading:boolean;onPick:(fare:RouteFare)=>void}){
 const {t}=useTranslation();const groups=recommendationGroups(fares);
 return <section className="mt-9"><h2 className="mb-5 font-display text-3xl">{t('trip.recommended',{city})}</h2>{loading?<div className="flex gap-4 overflow-hidden">{[0,1,2].map(k=><Skeleton key={k} className="h-64 w-60 shrink-0 rounded-lg"/>)}</div>:Object.entries(groups).map(([key,rows])=>rows.length>0&&<div key={key} className="mb-7"><h3 className="mb-3 text-sm font-semibold">{t(`trip.group_${key}`)}</h3><div className="flex snap-x gap-4 overflow-x-auto pb-3">{rows.slice(0,12).map(f=><FareCard key={f.id} fare={f} onPick={()=>onPick(f)}/>)}</div></div>)}{!loading&&!fares.length&&<p className="text-sm text-muted-foreground">{t('trip.noRecommendations')}</p>}</section>;
}
function FareCard({fare:f,onPick}:{fare:RouteFare;onPick:()=>void}){
 const {t,i18n}=useTranslation(),load=useServerFn(getCityPhoto);const [photo,setPhoto]=useState<string|null>(null);const lang=i18n.language==='ro'?'ro':'en';
 useEffect(()=>{let active=true;void load({data:{city:f.city,lang}}).then(url=>{if(active)setPhoto(url);});return()=>{active=false;};},[f.city,lang,load]);
 const date=(d:string)=>new Intl.DateTimeFormat(lang,{day:'numeric',month:'short'}).format(new Date(d));
 return <article className="w-60 shrink-0 snap-start overflow-hidden rounded-lg border bg-card">{photo?<img src={photo} alt={f.city} className="h-32 w-full object-cover" loading="lazy"/>:<div className="photo-fallback flex h-32 items-center justify-center"><Plane className="size-8 text-primary"/></div>}<div className="p-4"><h4 className="text-lg font-semibold">{f.city} <span className="text-xs font-normal text-muted-foreground">{f.destinationIata}</span></h4><p className="mt-2 text-xs text-muted-foreground">{date(f.departure)}{f.returnDate?` → ${date(f.returnDate)} · ${t('trip.nights',{count:nights(f.departure.slice(0,10),f.returnDate.slice(0,10))})}`:` · ${t('trip.oneWay')}`}</p><p className="mt-2 text-xs">{f.airline} · {f.stops?t('trip.stops',{count:f.stops}):t('trip.directFlight')}</p><p className="mt-2 text-xs text-primary">Flywell · {t('trip.score')} {f.score}/100</p><p className="mt-3 text-lg font-semibold">{t('trip.fromPrice',{price:new Intl.NumberFormat(lang,{style:'currency',currency:f.currency,maximumFractionDigits:0}).format(f.price)})}</p><p className="text-xs text-muted-foreground">{t(f.returnDate?'trip.perPerson':'trip.perPersonOneWay')}</p><Button type="button" variant="outline" className="mt-3 min-h-11 w-full" onClick={onPick}>{t('trip.chooseFlight')}</Button></div></article>;
}