import { describe,it,expect } from 'vitest';
import { pickDay,recentFare,reachable,ROUTE_TTL,recommendationGroups,type RouteFare } from './discovery';
import { tripInputSchema,bookingLinks } from './types';
const fare:RouteFare={id:'a',destinationIata:'BGY',city:'Bergamo',country:'IT',foundAt:new Date().toISOString(),airline:'W4',departure:'2027-01-08',returnDate:'2027-01-11',price:196,currency:'RON',stops:0,duration:250,layover:null,arrival:null,score:98,link:'https://www.aviasales.com'};
describe('Requested flight discovery rules',()=>{
 it('caches route inventory for 7 days',()=>expect(ROUTE_TTL).toBe(604800000));
 it('hides prices older than three months',()=>{expect(recentFare('2026-07-30',new Date('2026-10-31'))).toBe(false);expect(recentFare('2026-08-01',new Date('2026-10-31'))).toBe(true);});
 it('only includes direct destinations in the selected airport route inventory',()=>expect(reachable([fare,{...fare,id:'b',destinationIata:'BCN'}],new Set(['BGY']),false).map(f=>f.destinationIata)).toEqual(['BGY']));
 it('one-stop toggle includes at most one stop',()=>expect(reachable([fare,{...fare,id:'c',destinationIata:'FCO',stops:1},{...fare,id:'d',destinationIata:'LIS',stops:2}],new Set(['BGY']),true).map(f=>f.destinationIata)).toEqual(['BGY','FCO']));
 it('restarts range when tapping before departure',()=>expect(pickDay({from:new Date('2027-01-12')},new Date('2027-01-10'),false)).toEqual({from:new Date('2027-01-10'),to:undefined}));
 it('moves only the departure when a complete range exists and the tap is before the return',()=>expect(pickDay({from:new Date('2027-01-12'),to:new Date('2027-01-16')},new Date('2027-01-14'),false)).toEqual({from:new Date('2027-01-14'),to:new Date('2027-01-16')}));
 it('restarts the range when the tap is on or after the current return',()=>expect(pickDay({from:new Date('2027-01-12'),to:new Date('2027-01-16')},new Date('2027-01-20'),false)).toEqual({from:new Date('2027-01-20'),to:undefined}));
 it('one-way selects a single date',()=>expect(pickDay({from:new Date('2027-01-12')},new Date('2027-01-16'),true).to).toBeUndefined());
 it('requires a real baseline to claim a 20 percent price drop',()=>{expect(recommendationGroups([fare]).dropped).toEqual([]);expect(recommendationGroups([{...fare,usualPrice:250}]).dropped.length).toBe(1);});
 it('validates one-way without adding a return leg to flight links',()=>{const input={destination:'Bergamo',destinationIata:'BGY',origin:'CRA',departure:'2027-01-08',returnDate:'2027-01-08',adults:1,children:0,flexible:false,budget:'medium',direct:false,bag:false,oneWay:true,lang:'ro'};const parsed=tripInputSchema.parse(input);expect(bookingLinks(parsed,'Bergamo').google).not.toContain('return');});
});