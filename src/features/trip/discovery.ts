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
export function pickDay(range:{from?:Date|undefined;to?:Date|undefined}|undefined,date:Date,oneWay:boolean){
  if(oneWay||!range?.from)return {from:date,to:undefined};
  if(!range.to)return date<=range.from?{from:date,to:undefined}:{from:range.from,to:date};
  // Complete range: tapping before the return moves only the departure; tapping on/after it restarts the range.
  return date<range.to?{from:date,to:range.to}:{from:date,to:undefined};
}

/* ---- City photo lookup: pure rules, so they can be tested without the network. ---- */
export type PhotoPage = { title?: string; thumbnail?: { source?: string } | null };
export type CommonsPage = { title?: string; imageinfo?: { mime?: string; thumburl?: string; width?: number }[] | null };

// Wikimedia serves article thumbnails from upload.wikimedia.org and thumb.wikimedia.org; both are real photos.
const PHOTO_HOST = /(^|\.)(upload|thumb)\.wikimedia\.org$/i;

export function cleanPhotoUrl(url: string) { return url.split('?')[0]; }

export function isWikimediaPhoto(url: string | undefined | null): url is string {
  if (!url || !/^https:\/\//i.test(url)) return false;
  try {
    const parsed = new URL(url);
    return PHOTO_HOST.test(parsed.hostname) && /\.(jpe?g|png|webp)$/i.test(parsed.pathname);
  } catch { return false; }
}

/** Best photo among Wikipedia search hits: the article named like the city wins over random pages that merely match. */
export function pickPhotoCandidate(pages: PhotoPage[], city: string): string | null {
  const wanted = city.trim().toLowerCase();
  const usable = pages.filter(page => isWikimediaPhoto(page.thumbnail?.source));
  if (!usable.length) return null;
  const title = (page: PhotoPage) => (page.title ?? '').trim().toLowerCase();
  const chosen = usable.find(page => title(page) === wanted)
    ?? usable.find(page => title(page).startsWith(wanted))
    ?? usable.find(page => title(page).includes(wanted))
    ?? usable[0];
  const source = chosen.thumbnail?.source;
  return source ? cleanPhotoUrl(source) : null;
}

/** Wikimedia Commons file search: only real photos, wide enough to look good on a card. */
export function pickCommonsPhoto(pages: CommonsPage[], city: string): string | null {
  const wanted = city.trim().toLowerCase();
  const usable = pages.filter(page => {
    const info = page.imageinfo?.[0];
    return info?.mime === 'image/jpeg' && (info.width ?? 0) >= 600 && isWikimediaPhoto(info.thumburl);
  });
  if (!usable.length) return null;
  const named = usable.find(page => (page.title ?? '').toLowerCase().includes(wanted)) ?? usable[0];
  const source = named.imageinfo?.[0]?.thumburl;
  return source ? cleanPhotoUrl(source) : null;
}
