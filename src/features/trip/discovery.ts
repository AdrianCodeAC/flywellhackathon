import { nights, type Flight } from './types';
export const ROUTE_TTL = 7 * 86400000;
export type RouteFare = Flight & { destinationIata:string; city:string; country:string; foundAt:string; photo?:string; usualPrice?:number };
export type Discovery = { routes:RouteFare[]; fares:RouteFare[]; unavailable:boolean; fetchedAt:string };
export type PriceDay = { date:string; price:number; returnDate:string|null };
export function recentFare(foundAt:string,now=new Date()) { const cutoff=new Date(now);cutoff.setUTCMonth(cutoff.getUTCMonth()-3);const timestamp=Date.parse(foundAt);return Number.isFinite(timestamp)&&timestamp>=cutoff.getTime()&&timestamp<=now.getTime(); }
export function reachable(fares:RouteFare[],directRoutes:Set<string>,includeStop:boolean){
  const best=new Map<string,RouteFare>();
  for(const fare of fares){if(!recentFare(fare.foundAt)||fare.stops> (includeStop?1:0)||(!fare.stops&&!directRoutes.has(fare.destinationIata)))continue;const old=best.get(fare.destinationIata);if(!old||fare.price<old.price)best.set(fare.destinationIata,fare);}
  return [...best.values()].sort((a,b)=>a.price-b.price);
}
export function recommendationGroups(fares:RouteFare[],now=new Date()){
  const weekend=(f:RouteFare)=>{const out=new Date(f.departure).getUTCDay(),back=new Date(f.returnDate).getUTCDay();return [5,6].includes(out)&&[0,1].includes(back)&&nights(f.departure.slice(0,10),f.returnDate.slice(0,10))<=4;};
  return {month:fares.filter(f=>f.departure.slice(0,7)===now.toISOString().slice(0,7)),weekend:fares.filter(weekend),direct:fares.filter(f=>f.stops===0),dropped:fares.filter(f=>f.usualPrice&&f.price<=f.usualPrice*0.8)};
}
export function pickDay(range:{from?:Date;to?:Date}|undefined,date:Date,oneWay:boolean){if(oneWay||!range?.from||range.to||date<=range.from)return {from:date,to:undefined};return {from:range.from,to:date};}