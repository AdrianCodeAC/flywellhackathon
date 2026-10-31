import { readTripCache, writeTripCache } from './cache.server';
import { comfortScore } from './types';
import { recentFare, reachable, ROUTE_TTL, pickCommonsPhoto, pickPhotoCandidate, type CommonsPage, type Discovery, type PhotoPage, type RouteFare, type PriceDay } from './discovery';
type Row=Record<string,unknown>;
async function api(path:string,params:Record<string,string>,token:string){
 const response=await fetch(`https://api.travelpayouts.com${path}?${new URLSearchParams(params)}`,{headers:{'X-Access-Token':token},signal:AbortSignal.timeout(18000)});
 console.info(`[Trip HTTP] ${path} status=${response.status}`);
 if(!response.ok)throw new Error('Provider unavailable');const body=await response.json() as {success:boolean;data:Row[]|Record<string,Row>};if(!body.success)throw new Error('Provider unavailable');return Array.isArray(body.data)?body.data:Object.values(body.data??{});
}
async function directRoutes(origin:string){
 const key=`route-inventory-v1:${origin}`;const cached=await readTripCache<string[]>(key,ROUTE_TTL);if(cached)return new Set(cached);
 const r=await fetch('https://api.travelpayouts.com/data/routes.json',{signal:AbortSignal.timeout(25000)});console.info(`[Trip HTTP] /data/routes.json status=${r.status}`);if(!r.ok)throw new Error('Routes unavailable');
 const rows=await r.json() as {departure_airport_iata:string;arrival_airport_iata:string;transfers:number}[];
 const codes=[...new Set(rows.filter(r=>r.departure_airport_iata===origin&&r.transfers===0).map(r=>r.arrival_airport_iata))];await writeTripCache(key,codes);return new Set(codes);
}
function observed(row:Row,latest:Row[]){
 const match=latest.find(v=>v['destination']===row['destination']&&String(v['depart_date'])===String(row['departure_at']).slice(0,10)&&Number(v['number_of_changes'])===Number(row['transfers']));
 if(match&&typeof match['found_at']==='string')return match['found_at'];
 const link=String(row['link']??'');const date=new URLSearchParams(link.split('?')[1]??'').get('search_date');
 return date&&/^\d{8}$/.test(date)?`${date.slice(4)}-${date.slice(2,4)}-${date.slice(0,2)}T00:00:00Z`:'';
}
export async function discover(origin:string,lang:string,includeStop:boolean,base:string,token:string,period?:{from:string;to:string}):Promise<Discovery>{
 const key=`discovery-v5:${origin}:${lang}:${includeStop}:${JSON.stringify(period??null)}`;const cached=await readTripCache<Discovery>(key);if(cached)return cached;
 try{
  const currency=lang==='ro'?'RON':'EUR';
  const [routes,latest,rows,airports]=await Promise.all([directRoutes(origin),api('/v2/prices/latest',{origin,currency:currency.toLowerCase(),limit:'1000',sorting:'price',period_type:'year'},token).catch(()=>[]),Promise.all(['true','false'].map(one_way=>api('/aviasales/v3/prices_for_dates',{origin,currency:currency.toLowerCase(),limit:'1000',unique:'false',sorting:'price',one_way},token))).then(rows=>rows.flat()),fetch(new URL('/data/airports.json',base)).then(r=>r.json()) as Promise<[string,string,string,string,number,number][]> ,includeStop?api('/v1/city-directions',{origin,currency:currency.toLowerCase()},token).catch(()=>[]):Promise.resolve([])]);
  const fares:RouteFare[]=[];
  for(const row of rows){
   const code=String(row['destination_airport']??row['destination']),a=airports.find(a=>a[0]===code);const foundAt=observed(row,latest),price=Number(row['price']),stops=Number(row['transfers']),departure=String(row['departure_at']??'');
   if(!a||row['origin_airport']!==origin||!recentFare(foundAt)||!Number.isFinite(price)||!(price>0)||!Number.isInteger(stops)||stops<0||stops>(period?10:includeStop?1:0)||!Number.isFinite(Date.parse(departure))||departure.slice(0,10)<new Date().toISOString().slice(0,10))continue;
   const returnDate=String(row['return_at']??'');const link=String(row['link']??'');
   const f:RouteFare={id:`${code}:${departure}:${returnDate}:${price}`,destinationIata:code,city:a[2]||a[1],country:a[3],foundAt,airline:String(row['airline']??''),departure,returnDate,price,currency,stops,duration:typeof row['duration']==='number'?row['duration']:null,layover:null,arrival:null,score:0,link:link.startsWith('/')&&!link.startsWith('//')?`https://www.aviasales.com${link}`:'https://www.google.com/travel/flights'};f.score=comfortScore(f);fares.push(f);
  }
  // Legacy inventory omits current CRA routes; a recent airport-exact direct fare is stronger evidence.
  for(const fare of fares)if(fare.stops===0)routes.add(fare.destinationIata);
  const active=reachable(fares,routes,includeStop);const allowed=new Set(active.map(f=>f.destinationIata));const value:Discovery={routes:active,fares:fares.filter(f=>period?f.departure.slice(0,10)>=period.from&&f.departure.slice(0,10)<=period.to&&(!f.returnDate||f.returnDate.slice(0,10)<=period.to):allowed.has(f.destinationIata)).sort((a,b)=>a.price-b.price),unavailable:false,fetchedAt:new Date().toISOString()};await writeTripCache(key,value);return value;
 }catch{return {routes:[],fares:[],unavailable:true,fetchedAt:new Date().toISOString()};}
}
export async function priceCalendar(origin:string,destination:string,month:string,lang:string,oneWay:boolean,token:string):Promise<PriceDay[]>{
 const key=`price-days-v2:${origin}:${destination}:${month}:${lang}:${oneWay}`;const cached=await readTripCache<PriceDay[]>(key);if(cached)return cached;
 try{
  const currency=lang==='ro'?'ron':'eur';
  const rows=await api('/aviasales/v3/prices_for_dates',{origin,destination,departure_at:month,one_way:String(oneWay),currency,unique:'false',limit:'1000'},token);
  await api('/v2/prices/month-matrix',{origin,destination,month:`${month}-01`,currency},token).catch(()=>[]);
  const days=new Map<string,PriceDay>();
  for(const r of rows){const date=String(r['departure_at']).slice(0,10),price=Number(r['price']);if(r['origin_airport']!==origin||r['destination_airport']!==destination||!date.startsWith(month)||!(price>0))continue;const old=days.get(date);if(!old||price<old.price)days.set(date,{date,price,returnDate:r['return_at']?String(r['return_at']).slice(0,10):null});}
  const value=[...days.values()];await writeTripCache(key,value);return value;
 }catch{return [];}
}
const WIKI_HEADERS = { 'User-Agent': 'Flywell/1.0 (https://flywellhackathon.lovable.app) city-photo lookup/1.0', Accept: 'application/json' };
async function wikiJson(url: string, label: string) {
  try {
    const response = await fetch(url, { headers: WIKI_HEADERS, signal: AbortSignal.timeout(8000) });
    console.info(`[Trip HTTP] ${label} status=${response.status}`);
    if (!response.ok) return null;
    return await response.json() as { query?: { pages: Record<string, unknown> } };
  } catch { console.info(`[Trip HTTP] ${label} status=timeout`); return null; }
}
const pagesOf = (body: { query?: { pages: Record<string, unknown> } } | null) => Object.values(body?.query?.pages ?? {});
export async function cityPhoto(city: string, lang: string) {
  const key = `city-photo-v2:${lang}:${city}`;
  const cached = await readTripCache<string | null>(key);
  if (cached !== undefined) return cached;
  const wiki = lang === 'ro' ? 'ro' : 'en';
  const article = (host: string) => wikiJson(`https://${host}.wikipedia.org/w/api.php?${new URLSearchParams({ action: 'query', titles: city, prop: 'pageimages', piprop: 'thumbnail', pithumbsize: '640', redirects: '1', format: 'json' })}`, `wikipedia article ${host}`);
  const search = (host: string) => wikiJson(`https://${host}.wikipedia.org/w/api.php?${new URLSearchParams({ action: 'query', generator: 'search', gsrsearch: city, gsrlimit: '8', prop: 'pageimages', piprop: 'thumbnail', pithumbsize: '640', format: 'json' })}`, `wikipedia search ${host}`);
  let photo = pickPhotoCandidate(pagesOf(await article(wiki)) as PhotoPage[], city);
  // City names come from the airport list in English, so the English article is often the one that exists.
  if (!photo && wiki !== 'en') photo = pickPhotoCandidate(pagesOf(await article('en')) as PhotoPage[], city);
  if (!photo) photo = pickPhotoCandidate(pagesOf(await search('en')) as PhotoPage[], city);
  if (!photo && wiki !== 'en') photo = pickPhotoCandidate(pagesOf(await search(wiki)) as PhotoPage[], city);
  // Last resort: a photograph of the city from Wikimedia Commons.
  if (!photo) {
    const commons = await wikiJson(`https://commons.wikimedia.org/w/api.php?${new URLSearchParams({ action: 'query', generator: 'search', gsrsearch: `${city} filetype:bitmap`, gsrnamespace: '6', gsrlimit: '8', prop: 'imageinfo', iiprop: 'url|mime|size', iiurlwidth: '800', format: 'json' })}`, 'commons search');
    photo = pickCommonsPhoto(pagesOf(commons) as CommonsPage[], city);
  }

  await writeTripCache(key, photo);
  return photo;
}
