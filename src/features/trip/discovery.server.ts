import { readTripCache, writeTripCache } from './cache.server';
import { comfortScore } from './types';
import { recentFare, reachable, ROUTE_TTL, type Discovery, type RouteFare, type PriceDay } from './discovery';
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
export async function discover(origin:string,lang:string,includeStop:boolean,base:string,token:string):Promise<Discovery>{
 const key=`discovery-v4:${origin}:${lang}:${includeStop}`;const cached=await readTripCache<Discovery>(key);if(cached)return cached;
 try{
  const currency=lang==='ro'?'RON':'EUR';
  const [routes,latest,rows,airports]=await Promise.all([directRoutes(origin),api('/v2/prices/latest',{origin,currency:currency.toLowerCase(),limit:'1000',sorting:'price',period_type:'year'},token).catch(()=>[]),Promise.all(['true','false'].map(one_way=>api('/aviasales/v3/prices_for_dates',{origin,currency:currency.toLowerCase(),limit:'1000',unique:'false',sorting:'price',one_way},token))).then(rows=>rows.flat()),fetch(new URL('/data/airports.json',base)).then(r=>r.json()) as Promise<[string,string,string,string,number,number][]> ,includeStop?api('/v1/city-directions',{origin,currency:currency.toLowerCase()},token).catch(()=>[]):Promise.resolve([])]);
  const fares:RouteFare[]=[];
  for(const row of rows){
   const code=String(row['destination_airport']??row['destination']),a=airports.find(a=>a[0]===code);const foundAt=observed(row,latest),price=Number(row['price']),stops=Number(row['transfers']),departure=String(row['departure_at']??'');
   if(!a||row['origin_airport']!==origin||!recentFare(foundAt)||!(price>0)||stops>(includeStop?1:0)||departure.slice(0,10)<new Date().toISOString().slice(0,10))continue;
   const returnDate=String(row['return_at']??'');const link=String(row['link']??'');
   const f:RouteFare={id:`${code}:${departure}:${returnDate}:${price}`,destinationIata:code,city:a[2]||a[1],country:a[3],foundAt,airline:String(row['airline']??''),departure,returnDate,price,currency,stops,duration:typeof row['duration']==='number'?row['duration']:null,layover:null,arrival:null,score:0,link:link.startsWith('/')&&!link.startsWith('//')?`https://www.aviasales.com${link}`:'https://www.google.com/travel/flights'};f.score=comfortScore(f);fares.push(f);
  }
  // Legacy inventory omits current CRA routes; a recent airport-exact direct fare is stronger evidence.
  for(const fare of fares)if(fare.stops===0)routes.add(fare.destinationIata);
  const active=reachable(fares,routes,includeStop);const allowed=new Set(active.map(f=>f.destinationIata));const value:Discovery={routes:active,fares:fares.filter(f=>allowed.has(f.destinationIata)).sort((a,b)=>a.price-b.price),unavailable:false,fetchedAt:new Date().toISOString()};await writeTripCache(key,value);return value;
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
export async function cityPhoto(city:string,lang:string){
 const key=`city-photo:${lang}:${city}`;const cached=await readTripCache<string>(key,ROUTE_TTL);if(cached)return cached;
 try{const r=await fetch(`https://${lang==='ro'?'ro':'en'}.wikipedia.org/w/api.php?${new URLSearchParams({action:'query',generator:'search',gsrsearch:city,gsrlimit:'1',prop:'pageimages',piprop:'thumbnail',pithumbsize:'480',format:'json'})}`,{signal:AbortSignal.timeout(8000)});console.info(`[Trip HTTP] Wikipedia status=${r.status}`);const d=await r.json() as {query?:{pages:Record<string,{thumbnail?:{source:string}}>}};const url=Object.values(d.query?.pages??{})[0]?.thumbnail?.source;if(url?.startsWith('https://upload.wikimedia.org/')){await writeTripCache(key,url);return url;}}catch{}return null;
}