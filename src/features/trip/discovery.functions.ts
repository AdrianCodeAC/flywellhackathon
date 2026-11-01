import { createServerFn } from '@tanstack/react-start';
import { guard } from '@/lib/request-guard';
import { trustedOrigin } from '@/lib/site-origin';
import { getRequest } from '@tanstack/react-start/server';
import { z } from 'zod';
import { discover, priceCalendar, cityPhoto } from './discovery.server';
const input=z.object({origin:z.string().regex(/^[A-Z]{3}$/),lang:z.enum(['en','ro']),includeStop:z.boolean()});
export const getDiscovery=createServerFn({method:'POST'}).middleware([guard('flights',30)]).inputValidator(data=>input.parse(data)).handler(async({data})=>{
 const token=process.env['TRAVELPAYOUTS_TOKEN'];if(!token)return {routes:[],fares:[],unavailable:true,fetchedAt:new Date().toISOString()};
 return discover(data.origin,data.lang,data.includeStop,trustedOrigin(getRequest().url),token);
});
export const getPriceCalendar=createServerFn({method:'POST'}).middleware([guard('flights',30)]).inputValidator(data=>input.omit({includeStop:true}).extend({destination:z.string().regex(/^[A-Z]{3}$/),month:z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),oneWay:z.boolean()}).parse(data)).handler(async({data})=>{
 const token=process.env['TRAVELPAYOUTS_TOKEN'];return token?priceCalendar(data.origin,data.destination,data.month,data.lang,data.oneWay,token):[];
});
export const getCityPhoto=createServerFn({method:'POST'}).middleware([guard('photos',60)]).inputValidator(data=>z.object({city:z.string().max(100),lang:z.enum(['en','ro'])}).parse(data)).handler(({data})=>cityPhoto(data.city,data.lang));
export const getAllFlights=createServerFn({method:'POST'}).middleware([guard('flights',30)]).inputValidator(data=>z.object({origin:z.string().regex(/^[A-Z]{3}$/),from:z.string().date(),to:z.string().date(),flexible:z.boolean(),lang:z.enum(['en','ro'])}).parse(data)).handler(async({data})=>{
 const token=process.env['TRAVELPAYOUTS_TOKEN'];if(!token)return {routes:[],fares:[],unavailable:true,fetchedAt:new Date().toISOString()};
 const shift=(date:string,days:number)=>new Date(Date.parse(date)+days*86400000).toISOString().slice(0,10);
 return discover(data.origin,data.lang,true,trustedOrigin(getRequest().url),token,{from:shift(data.from,data.flexible?-3:0),to:shift(data.to,data.flexible?3:0)});
});