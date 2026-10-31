import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { motion, useReducedMotion } from "motion/react";
import { TransformComponent, TransformWrapper, type ReactZoomPanPinchContentRef } from "react-zoom-pan-pinch";
import {
  Banknote,
  Bus,
  ChevronLeft,
  ChevronRight,
  Coffee,
  DoorOpen,
  Footprints,
  Info,
  LocateFixed,
  Minus,
  Pill,
  Plus,
  Sofa,
  Toilet,
  TrainFront,
  CarTaxiFront,
  Cross,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { gateMatches, type AirportLayout, type LatLon, type PoiKind } from "./layout";
import type { PlacedStep } from "./journey";

export type Layer = "gates" | "food" | "toilets" | "transport" | "money" | "services";

const LAYER_OF: Partial<Record<PoiKind, Layer>> = {
  gate: "gates",
  food: "food",
  toilets: "toilets",
  bus: "transport",
  train: "transport",
  taxi: "transport",
  atm: "money",
  exchange: "money",
  pharmacy: "services",
  medical: "services",
  info: "services",
  lounge: "services",
};

const ICON: Partial<Record<PoiKind, LucideIcon>> = {
  food: Coffee,
  toilets: Toilet,
  bus: Bus,
  train: TrainFront,
  taxi: CarTaxiFront,
  atm: Banknote,
  exchange: Banknote,
  pharmacy: Pill,
  medical: Cross,
  info: Info,
  lounge: Sofa,
};

/** Top-down airliner pointing along +x, drawn in a 24×24 box centred on (12,12). */
const PLANE =
  "M22 12c0-.8-.7-1.4-1.5-1.4H15L10.2 3H8.3l2.3 7.6H6L4.2 8H2.6l1.1 4-1.1 4h1.6L6 13.4h4.6L8.3 21h1.9l4.8-7.6h5.5c.8 0 1.5-.6 1.5-1.4Z";

const K = 100_000; // projected units per degree of latitude (~1.1 m each)

function useProjection(layout: AirportLayout, steps: PlacedStep[]) {
  return useMemo(() => {
    const pts: LatLon[] = [
      ...layout.terminals.flatMap((t) => t.rings.flat()),
      ...steps.flatMap((s) => (s.at ? [s.at] : [])),
      ...layout.pois.filter((p) => p.kind === "gate").map((p) => p.at),
    ];
    if (pts.length < 2) {
      const [s, w, n, e] = layout.bounds;
      pts.push([s, w], [n, e]);
    }
    let s = Math.min(...pts.map((p) => p[0]));
    let n = Math.max(...pts.map((p) => p[0]));
    let w = Math.min(...pts.map((p) => p[1]));
    let e = Math.max(...pts.map((p) => p[1]));
    const padLat = Math.max((n - s) * 0.18, 0.0008);
    const padLon = Math.max((e - w) * 0.12, 0.0011);
    s -= padLat;
    n += padLat;
    w -= padLon;
    e += padLon;
    const cos = Math.cos((((s + n) / 2) * Math.PI) / 180);
    const width = (e - w) * cos * K;
    const height = (n - s) * K;
    const project = ([lat, lon]: LatLon): [number, number] => [(lon - w) * cos * K, (n - lat) * K];
    return { width, height, project };
  }, [layout, steps]);
}

const path = (pts: [number, number][], close = false) =>
  pts.length ? `M${pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join("L")}${close ? "Z" : ""}` : "";

/** Teardrop map pin whose tip sits on (0,0); the round head is centred at (0, -1.9r). */
const pin = (r: number) =>
  `M0,0 C${-r * 0.35},${-r * 0.75} ${-r},${-r * 1.2} ${-r},${-r * 1.9} A${r},${r} 0 1 1 ${r},${-r * 1.9} C${r},${-r * 1.2} ${r * 0.35},${-r * 0.75} 0,0Z`;

interface Runway {
  d: string;
  a: [number, number];
  b: [number, number];
  angle: number;
  ends: string;
}

/** Runway centre line, the take-off direction and the white "piano key" stripes at both ends. */
function runwayShapes(rings: [number, number][][]): Runway[] {
  return rings
    .filter((r) => r.length >= 2)
    .map((r) => {
      const a = r[0]!;
      const b = r[r.length - 1]!;
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      const ux = (b[0] - a[0]) / len;
      const uy = (b[1] - a[1]) / len;
      const half = 20; // stripes span most of the 50-unit runway width
      const across = (p: [number, number], inward: number) => {
        const cx = p[0] + ux * inward;
        const cy = p[1] + uy * inward;
        return `M${(cx - uy * half).toFixed(1)},${(cy + ux * half).toFixed(1)}L${(cx + uy * half).toFixed(1)},${(cy - ux * half).toFixed(1)}`;
      };
      return {
        d: path(r),
        a,
        b,
        angle: (Math.atan2(uy, ux) * 180) / Math.PI,
        ends: `${across(a, 30)}${across(b, -30)}`,
      };
    });
}

export function AirportMap({
  layout,
  steps,
  active,
  onSelect,
  gate,
  layers,
}: {
  layout: AirportLayout;
  steps: PlacedStep[];
  active: number;
  onSelect: (index: number) => void;
  gate: string;
  layers: Set<Layer>;
}) {
  const { t } = useTranslation();
  const reduce = useReducedMotion() ?? false;
  const uid = useId().replace(/:/g, "");
  const { width, height, project } = useProjection(layout, steps);
  const wrapper = useRef<ReactZoomPanPinchContentRef>(null);
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const frame = useRef(0);
  // Markers keep their on-screen size while the map zooms.
  const unit = Math.max(width, height * 0.75) / 26 / scale;
  // Fixed, real-world-ish sizes for buildings and planes (they zoom with the map).
  const depth = Math.max(width, height) / 160;

  // Steps that share a spot (e.g. two "follow the signs" steps in one hall) are fanned out.
  const placed = steps
    .map((s, i) => ({ ...s, index: i, xy: s.at ? project(s.at) : undefined }))
    .filter((s): s is typeof s & { xy: [number, number] } => Boolean(s.xy))
    .map((s, i, all) => {
      const before = all.slice(0, i).filter((o) => Math.hypot(o.xy[0] - s.xy[0], o.xy[1] - s.xy[1]) < unit * 1.2).length;
      return before ? { ...s, xy: [s.xy[0] + unit * 1.5 * before, s.xy[1] + unit * 0.4 * before] as [number, number] } : s;
    });
  const detailed = scale >= 1.8;
  const activePos = placed.findIndex((s) => s.index === active);
  const done = activePos >= 0 ? placed.slice(0, activePos + 1) : [];
  const from = activePos > 0 ? placed[activePos - 1]!.xy : undefined;
  const to = activePos >= 0 ? placed[activePos]!.xy : undefined;

  const runways = useMemo(() => runwayShapes(layout.runways.map((r) => r.map(project))), [layout, project]);

  const focus = useCallback(
    (index: number, zoom = 2.6) => {
      const step = placed.find((s) => s.index === index);
      const el = box.current;
      const api = wrapper.current;
      if (!step || !el || !api) return;
      const cw = el.clientWidth;
      const ch = el.clientHeight;
      const fit = Math.min(cw / width, ch / height);
      const px = (cw - width * fit) / 2 + step.xy[0] * fit;
      const py = (ch - height * fit) / 2 + step.xy[1] * fit;
      api.setTransform(cw / 2 - px * zoom, ch / 2 - py * zoom, zoom, 700, "easeOut");
    },
    [placed, width, height],
  );

  // Start on the whole airport; zoom to a step only after the passenger picks one.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (active >= 0) focus(active);
    // only when the selected step changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const gates = layout.pois.filter((p) => p.kind === "gate");
  // Decorative airliners parked nose-in at the first gates, pointing at their terminal.
  const parked = useMemo(() => {
    const size = Math.max(width, height) / 40;
    const centres = layout.terminals.map((term) => project(term.center));
    if (!centres.length) return [];
    const main = centres[0]!;
    return layout.pois
      .filter((p) => p.kind === "gate")
      .map((g) => project(g.at))
      .sort((a, b) => Math.hypot(a[0] - main[0], a[1] - main[1]) - Math.hypot(b[0] - main[0], b[1] - main[1]))
      .slice(0, 16)
      .map(([x, y]) => {
        const c = centres.reduce((best, p) => (Math.hypot(p[0] - x, p[1] - y) < Math.hypot(best[0] - x, best[1] - y) ? p : best));
        const len = Math.hypot(x - c[0], y - c[1]) || 1;
        const ux = (x - c[0]) / len;
        const uy = (y - c[1]) / len;
        return { x: x + ux * size * 0.75, y: y + uy * size * 0.75, angle: (Math.atan2(-uy, -ux) * 180) / Math.PI, size };
      });
  }, [layout, project, width, height]);
  const services = layout.pois.filter((p) => p.kind !== "gate" && LAYER_OF[p.kind] && layers.has(LAYER_OF[p.kind]!));
  const current = steps[active];
  const title = (s: PlacedStep | undefined) => (s ? t(`airportGuide.step.${s.id}.title`, s.params ?? {}) : "");

  return (
    <div className="airport-map relative overflow-hidden rounded-2xl border" ref={box}>
      <TransformWrapper
        ref={wrapper}
        minScale={1}
        maxScale={10}
        centerOnInit
        doubleClick={{ mode: "zoomIn", step: 0.8 }}
        wheel={{ step: 0.12 }}
        onTransform={(_, state) => {
          cancelAnimationFrame(frame.current);
          frame.current = requestAnimationFrame(() => setScale(state.scale));
        }}
      >
        <TransformComponent wrapperClass="!h-full !w-full" contentClass="!h-full !w-full">
          <svg
            viewBox={`0 0 ${width.toFixed(0)} ${height.toFixed(0)}`}
            className="map-canvas h-full w-full"
            role="img"
            aria-label={t("airportGuide.mapLabel", { airport: layout.iata })}
          >
            <defs>
              <pattern id={`${uid}-grass`} width={depth * 5} height={depth * 5} patternUnits="userSpaceOnUse">
                <circle cx={depth} cy={depth} r={depth * 0.35} className="map-grass-dot" />
                <circle cx={depth * 3.5} cy={depth * 3.2} r={depth * 0.25} className="map-grass-dot" />
              </pattern>
              <pattern id={`${uid}-skylight`} width={depth * 3} height={depth * 3} patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
                <rect width={depth * 0.9} height={depth * 3} className="map-skylight" />
              </pattern>
              {(["departures", "arrivals", "mixed"] as const).map((role) => (
                <linearGradient key={role} id={`${uid}-roof-${role}`} x1="0" y1="0" x2="0.4" y2="1">
                  <stop offset="0" className={`map-roof-top map-roof-top-${role}`} />
                  <stop offset="1" className={`map-roof-bottom map-roof-bottom-${role}`} />
                </linearGradient>
              ))}
              <radialGradient id={`${uid}-glow`}>
                <stop offset="0" className="map-glow-in" />
                <stop offset="1" className="map-glow-out" />
              </radialGradient>
              <filter id={`${uid}-soft`} x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation={depth * 0.9} />
              </filter>
            </defs>

            <rect width={width} height={height} className="map-ground" />
            <rect width={width} height={height} fill={`url(#${uid}-grass)`} />

            {layout.aprons.map((r, i) => (
              <path key={`a${i}`} d={path(r.map(project), true)} className="map-apron" />
            ))}
            {layout.taxiways.map((r, i) => (
              <g key={`t${i}`}>
                <path d={path(r.map(project))} className="map-taxiway" />
                <path d={path(r.map(project))} className="map-taxiway-line" />
              </g>
            ))}
            {runways.map((r, i) => (
              <g key={`r${i}`}>
                <path d={r.d} className="map-runway" />
                <path d={r.ends} className="map-runway-keys" />
                <path d={r.d} className="map-runway-line" />
              </g>
            ))}

            {/* Buildings: soft shadow, side wall, then the roof with skylights. */}
            {layout.terminals.map((term, i) => {
              const d = term.rings.map((r) => path(r.map(project), true)).join(" ");
              return (
                <motion.g
                  key={`b${i}`}
                  initial={reduce ? false : { opacity: 0, y: -depth * 3 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: i * 0.08, ease: "easeOut" }}
                >
                  <path d={d} transform={`translate(${depth * 1.4},${depth * 2.2})`} className="map-building-shadow" filter={`url(#${uid}-soft)`} fillRule="evenodd" />
                  <path d={d} transform={`translate(0,${depth})`} className="map-building-wall" fillRule="evenodd" />
                  <path d={d} fill={`url(#${uid}-roof-${term.role})`} className="map-terminal" fillRule="evenodd" />
                  <path d={d} fill={`url(#${uid}-skylight)`} className="map-roof-pattern" fillRule="evenodd" />
                </motion.g>
              );
            })}

            {/* Planes taking off, one per runway, staggered. */}
            {!reduce &&
              runways.slice(0, 2).map((r, i) => (
                <motion.g
                  key={`plane${i}`}
                  className="map-plane"
                  initial={{ x: r.a[0], y: r.a[1], opacity: 0 }}
                  animate={{ x: [r.a[0], r.b[0]], y: [r.a[1], r.b[1]], opacity: [0, 1, 1, 0] }}
                  transition={{ duration: 9, ease: "easeIn", repeat: Infinity, repeatDelay: 5 + i * 4, delay: 1.5 + i * 6 }}
                >
                  <g transform={`rotate(${r.angle}) scale(${depth * 0.4}) translate(-12,-12)`}>
                    <path d={PLANE} className="map-plane-shadow" transform="translate(1.5,2.5)" />
                    <path d={PLANE} className="map-plane-body" />
                  </g>
                </motion.g>
              ))}

            {layout.terminals
              .filter((term) => term.name || term.role !== "mixed")
              .map((term, i) => {
                const rings = term.rings.flat().map(project);
                const [cx] = project(term.center);
                const top = Math.min(...rings.map((p) => p[1]));
                const text =
                  term.role === "departures"
                    ? t("airportGuide.departuresHall")
                    : term.role === "arrivals"
                      ? t("airportGuide.arrivalsHall")
                      : (term.name ?? "").length > 24 ? `${(term.name ?? "").slice(0, 23)}…` : (term.name ?? "");
                const fs = unit * 0.5;
                const w = text.length * fs * 0.64 + fs * 1.6;
                return (
                  <g key={`l${i}`} transform={`translate(${cx},${top - fs * 0.6})`} className={`map-hall-tag map-hall-tag-${term.role}`}>
                    <rect x={-w / 2} y={-fs * 0.85} width={w} height={fs * 1.7} rx={fs * 0.85} />
                    <text fontSize={fs} textAnchor="middle" dy="0.35em">
                      {text}
                    </text>
                  </g>
                );
              })}

            {layers.has("gates") &&
              parked.map((pl, i) => (
                <motion.g
                  key={`parked${i}`}
                  className="map-plane"
                  initial={reduce ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 + i * 0.04 }}
                >
                  <g transform={`translate(${pl.x},${pl.y}) rotate(${pl.angle}) scale(${pl.size / 24}) translate(-12,-12)`}>
                    <path d={PLANE} className="map-plane-shadow" transform="translate(1,1.6)" />
                    <path d={PLANE} className="map-plane-body" />
                  </g>
                </motion.g>
              ))}
            {layers.has("gates") &&
              gates.map((g, i) => {
                const [x, y] = project(g.at);
                const mine = gate ? gateMatches(g.label, gate) : false;
                const label = (g.label ?? "").slice(0, 5);
                const fs = unit * (mine ? 0.46 : 0.3);
                const w = Math.max(label.length * fs * 0.66 + fs * 0.9, fs * 1.6);
                return (
                  <g key={`g${i}`} transform={`translate(${x},${y})`} className={mine ? "map-gate map-gate-mine" : "map-gate"}>
                    {mine && <circle r={fs * 1.6} className="map-gate-halo" />}
                    <rect x={-w / 2} y={-fs * 0.8} width={w} height={fs * 1.6} rx={fs * 0.5} />
                    <text fontSize={fs} textAnchor="middle" dy="0.36em">
                      {label}
                    </text>
                  </g>
                );
              })}

            {services.map((p, i) => {
              const [x, y] = project(p.at);
              const Icon = ICON[p.kind] ?? DoorOpen;
              const s = unit * (detailed ? 0.95 : 0.72);
              return (
                <motion.g
                  key={`p${p.kind}${i}`}
                  className={`map-poi map-poi-${LAYER_OF[p.kind]}`}
                  initial={reduce ? false : { y: -s, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 380, damping: 18, delay: Math.min(i * 0.02, 0.5) }}
                >
                  <title>{p.label ?? t(`airportGuide.poi.${p.kind}`)}</title>
                  <circle cx={x} cy={y + s * 0.12} r={s * 0.62} className="map-poi-shadow" />
                  <circle cx={x} cy={y} r={s * 0.62} />
                  <Icon x={x - s * 0.34} y={y - s * 0.34} width={s * 0.68} height={s * 0.68} strokeWidth={2.4} />
                </motion.g>
              );
            })}

            {/* The passenger's route: faint for what is ahead, drawn in for what is done. */}
            {placed.length > 1 && (
              <>
                <path d={path(placed.map((s) => s.xy))} className="map-route-ahead" strokeWidth={unit * 0.14} strokeDasharray={`${unit * 0.3} ${unit * 0.3}`} />
                {done.length > 1 && (
                  <>
                    <path d={path(done.map((s) => s.xy))} className="map-route-glow" strokeWidth={unit * 0.55} />
                    <motion.path
                      key={`done-${active}`}
                      d={path(done.map((s) => s.xy))}
                      className="map-route-done"
                      strokeWidth={unit * 0.2}
                      initial={reduce ? false : { pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 0.9, ease: "easeInOut" }}
                    />
                  </>
                )}
              </>
            )}

            {placed.map((s, n) => {
              const [x, y] = s.xy;
              const on = s.index === active;
              const passed = activePos >= 0 && n < activePos;
              const r = unit * (on ? 0.85 : 0.66);
              return (
                <g
                  key={s.id}
                  transform={`translate(${x},${y})`}
                  className={`map-step ${on ? "map-step-active" : ""} ${passed ? "map-step-passed" : ""} ${s.exact ? "" : "map-step-approx"}`}
                  onClick={() => onSelect(s.index)}
                  role="button"
                  aria-label={title(s)}
                >
                  <ellipse rx={r * 0.7} ry={r * 0.25} className="map-pin-shadow" />
                  {on && <circle r={r * 1.1} className="map-step-pulse" />}
                  <motion.g
                    initial={reduce ? false : { y: -unit * 2.5, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 420, damping: 16, delay: reduce ? 0 : 0.25 + n * 0.12 }}
                  >
                    <path d={pin(r)} className="map-pin" strokeWidth={unit * 0.08} strokeDasharray={s.exact ? undefined : `${unit * 0.18} ${unit * 0.12}`} />
                    <text y={-r * 1.9} fontSize={r * 1.1} textAnchor="middle" dy="0.36em" className="map-step-number">
                      {s.index + 1}
                    </text>
                  </motion.g>
                </g>
              );
            })}

            {/* A walking passenger moves from the previous step to the chosen one. */}
            {to && (
              <motion.g
                key={`walker-${active}`}
                initial={reduce || !from ? { x: to[0], y: to[1], opacity: 0 } : { x: from[0], y: from[1], opacity: 1 }}
                animate={{ x: to[0], y: to[1], opacity: [1, 1, 0] }}
                transition={{ duration: reduce ? 0 : 1.1, ease: "easeInOut", opacity: { duration: reduce ? 0 : 1.6, times: [0, 0.75, 1] } }}
                className="map-walker"
                pointerEvents="none"
              >
                <circle r={unit * 0.42} />
                <Footprints x={-unit * 0.26} y={-unit * 0.26} width={unit * 0.52} height={unit * 0.52} strokeWidth={2.4} />
              </motion.g>
            )}
          </svg>
        </TransformComponent>
      </TransformWrapper>

      <div className="absolute right-2 top-2 flex flex-col gap-1.5">
        <Button size="icon" variant="secondary" className="map-control size-11" aria-label={t("airportGuide.zoomIn")} onClick={() => wrapper.current?.zoomIn(0.6)}>
          <Plus />
        </Button>
        <Button size="icon" variant="secondary" className="map-control size-11" aria-label={t("airportGuide.zoomOut")} onClick={() => wrapper.current?.zoomOut(0.6)}>
          <Minus />
        </Button>
        <Button size="icon" variant="secondary" className="map-control size-11" aria-label={t("airportGuide.resetView")} onClick={() => wrapper.current?.resetTransform(500)}>
          <LocateFixed />
        </Button>
      </div>
      <div className="map-compass pointer-events-none absolute left-2 top-2" aria-hidden>
        <span>N</span>
      </div>

      {current && (
        <motion.div
          key={`card-${active}`}
          initial={reduce ? false : { y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="map-step-card absolute inset-x-2 bottom-2 flex items-center gap-2 rounded-xl p-1.5"
          aria-live="polite"
        >
          <Button size="icon" variant="ghost" className="size-11 shrink-0" disabled={active <= 0} aria-label={t("airportGuide.prevStep")} onClick={() => onSelect(active - 1)}>
            <ChevronLeft />
          </Button>
          <span className="journey-number shrink-0">{active + 1}</span>
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block text-[11px] font-semibold uppercase text-muted-foreground">{t("airportGuide.stepOf", { n: active + 1, total: steps.length })}</span>
            <span className="block truncate text-sm font-semibold">{title(current)}</span>
          </span>
          <Button size="icon" variant="ghost" className="size-11 shrink-0" disabled={active >= steps.length - 1} aria-label={t("airportGuide.nextStep")} onClick={() => onSelect(active + 1)}>
            <ChevronRight />
          </Button>
        </motion.div>
      )}
      <p className="map-attribution absolute left-2 top-[3.4rem] text-[10px]">© OSM</p>
    </div>
  );
}
