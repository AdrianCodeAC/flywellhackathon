import { describe,it,expect } from 'vitest';
import { pickDay,recentFare,reachable,ROUTE_TTL,recommendationGroups,isWikimediaPhoto,pickCommonsPhoto,pickPhotoCandidate,type RouteFare } from './discovery';
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
describe('City photo lookup',()=>{
 const thumb='https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e7/Kathedrale_von_Palma.jpg/500px-Kathedrale_von_Palma.jpg?utm_source=en.wikipedia.org&utm_campaign=api';
 it('accepts thumbnails served from thumb.wikimedia.org',()=>expect(isWikimediaPhoto(thumb)).toBe(true));
 it('drops tracking parameters from the stored photo address',()=>expect(pickPhotoCandidate([{title:'Palma',thumbnail:{source:thumb}}],'Palma')).toBe('https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e7/Kathedrale_von_Palma.jpg/500px-Kathedrale_von_Palma.jpg'));
 it('rejects pictures that are not hosted by Wikimedia',()=>{expect(isWikimediaPhoto('https://example.com/a.jpg')).toBe(false);expect(isWikimediaPhoto('https://upload.wikimedia.org/wikipedia/commons/8/8a/Logo.svg')).toBe(false);expect(isWikimediaPhoto(undefined)).toBe(false);});
 it('prefers the article named like the city over a random search hit',()=>{const person='https://upload.wikimedia.org/wikipedia/commons/1/11/Brian.jpg',city='https://upload.wikimedia.org/wikipedia/commons/2/22/Palma.jpg';expect(pickPhotoCandidate([{title:'Brian De Palma',thumbnail:{source:person}},{title:'Palma de Mallorca',thumbnail:{source:city}}],'Palma')).toBe(city);});
 it('takes a wide Commons photo when no article has one',()=>{const good='https://upload.wikimedia.org/wikipedia/commons/thumb/3/35/Craiova.jpg/800px-Craiova.jpg';const pages=[{title:'File:Small.jpg',imageinfo:[{mime:'image/jpeg',width:300,thumburl:'https://upload.wikimedia.org/wikipedia/commons/thumb/1/11/Small.jpg/200px-Small.jpg'}]},{title:'File:Craiova seen from above.jpg',imageinfo:[{mime:'image/jpeg',width:3000,thumburl:good}]}];expect(pickCommonsPhoto(pages,'Craiova')).toBe(good);});
 it('refuses a Commons drawing or a picture too small for a card',()=>{expect(pickCommonsPhoto([{title:'File:Craiova map.svg',imageinfo:[{mime:'image/svg+xml',width:900,thumburl:'https://upload.wikimedia.org/wikipedia/commons/1/11/Craiova_map.svg'}]}],'Craiova')).toBeNull();expect(pickCommonsPhoto([{title:'File:Craiova.jpg',imageinfo:[{mime:'image/jpeg',width:300,thumburl:'https://upload.wikimedia.org/wikipedia/commons/thumb/1/11/Craiova.jpg/200px-Craiova.jpg'}]}],'Craiova')).toBeNull();});
});
