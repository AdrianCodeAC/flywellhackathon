import { createServerFn } from "@tanstack/react-start";
import { guard } from "@/lib/request-guard";
import { trustedOrigin } from "@/lib/site-origin";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { airportLayout } from "./layout.server";

/** Public airport geometry from OpenStreetMap; contains no personal data. */
export const getAirportLayout = createServerFn({ method: "POST" })
  .middleware([guard("layout", 20)])
  .inputValidator((data) => z.object({ iata: z.string().regex(/^[A-Z]{3}$/) }).parse(data))
  .handler(({ data }) => airportLayout(data.iata, trustedOrigin(getRequest().url)));
