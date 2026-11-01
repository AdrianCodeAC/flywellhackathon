import { Writer } from "protobufjs/minimal";
import type { TripInput } from "./types";

/** Google Flights structured search state (the public consumer link format). */
export function googleFlightState(input: TripInput): string {
  const writer = Writer.create();
  const leg = (date: string, from: string, to: string) => {
    writer.uint32(26).fork().uint32(18).string(date.slice(0, 10));
    if (input.direct) writer.uint32(40).int32(0);
    writer.uint32(106).fork().uint32(18).string(from).ldelim();
    writer.uint32(114).fork().uint32(18).string(to).ldelim().ldelim();
  };
  leg(input.departure, input.origin, input.destinationIata ?? input.destination);
  if (!input.oneWay) leg(input.returnDate, input.destinationIata ?? input.destination, input.origin);
  writer.uint32(66).fork();
  for (let n = 0; n < input.adults; n++) writer.int32(1);
  for (let n = 0; n < input.children; n++) writer.int32(2);
  writer.ldelim().uint32(72).int32(1).uint32(152).int32(input.oneWay ? 2 : 1);
  return btoa(String.fromCharCode(...writer.finish())).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

export function googleFlightsLink(input: TripInput): string {
  return `https://www.google.com/travel/flights/search?${new URLSearchParams({ tfs: googleFlightState(input), hl: input.lang, curr: input.lang === 'ro' ? 'RON' : 'EUR' })}`;
}