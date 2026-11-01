import { Reader } from 'protobufjs/minimal';
import { describe, expect, it } from 'vitest';
import { googleFlightState } from './flight-links';
import type { TripInput } from './types';

const input: TripInput = { origin:'OTP',destination:'Madrid',destinationIata:'MAD',departure:'2026-11-13',returnDate:'2026-11-17',adults:2,children:1,oneWay:false,flexible:false,direct:true,bag:false,budget:'medium',lang:'en' };
function decode(value: TripInput) {
  const reader=Reader.create(Uint8Array.from(atob(googleFlightState(value).replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0)));
  const passengers:number[]=[];let legs=0,trip=0;
  while(reader.pos<reader.len){const tag=reader.uint32();if(tag===26){legs++;reader.skipType(2);}else if(tag===66){const end=reader.uint32()+reader.pos;while(reader.pos<end)passengers.push(reader.int32());}else if(tag===152)trip=reader.int32();else reader.skipType(tag&7);}
  return { passengers,legs,trip };
}
describe('Google Flights search state',()=>{
  it('preserves two adults and one child separately',()=>expect(decode(input).passengers).toEqual([1,1,2]));
  it('includes both legs for a round trip',()=>expect(decode(input)).toMatchObject({legs:2,trip:1}));
  it('omits the return leg for one-way travel',()=>expect(decode({...input,oneWay:true})).toMatchObject({legs:1,trip:2}));
});