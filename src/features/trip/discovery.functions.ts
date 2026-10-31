import { createServerFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import { z } from 'zod';
import { discover, priceCalendar, cityPhoto } from './discovery.server';
const input=z.object({origin:z.string().regex(/^[A-Z]{3}$/),lang:z.enum(['en','ro']),includeStop:z.boolean()});
export const getDiscovery=createServerFn({method:'POST'}).inputValidator(data=>input.parse(data)).handler(async({data})=>{
 const token=process.env['TRAVELPAYOUTS_TOKEN'];if(!token)return {routes:[],fares:[],unavailable:true,fetchedAt:new Date().toISOString()};
 return discover(data.origin,data.lang,data.includeStop,getRequest().url,token);
});
export const getPriceCalendar=createServerFn({method:'POST'}).inputValidator(data=>input.omit({includeStop:true}).extend({destination:z.string().regex(/^[A-Z]{3}$/),month:z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),oneWay:z.boolean()}).parse(data)).handler(async({data})=>{
 const token=process.env['TRAVELPAYOUTS_TOKEN'];return token?priceCalendar(data.origin,data.destination,data.month,data.lang,data.oneWay,token):[];
});
export const getCityPhoto=createServerFn({method:'POST'}).inputValidator(data=>z.object({city:z.string().max(100),lang:z.enum(['en','ro'])}).parse(data)).handler(({data})=>cityPhoto(data.city,data.lang));