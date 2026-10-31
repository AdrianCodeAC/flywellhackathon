import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { TransformComponent, TransformWrapper, type ReactZoomPanPinchContentRef } from "react-zoom-pan-pinch";
import {
  Banknote,
  Bus,
  Coffee,
  DoorOpen,
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
  const { width, height, project } = useProjection(layout, steps);
  const wrapper = useRef<ReactZoomPanPinchContentRef>(null);
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const frame = useRef(0);
  // Markers keep their on-screen size while the map zooms.
  const unit = Math.max(width, height * 0.75) / 26 / scale;

  const placed = steps
    .map((s, i) => ({ ...s, index: i, xy: s.at ? project(s.at) : undefined }))
    .filter((s): s is typeof s & { xy: [number, number] } => Boolean(s.xy));

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
      api.setTransform(cw / 2 - px * zoom, ch / 2 - py * zoom, zoom, 500, "easeOut");
    },
    [placed, width, height],
  );

  useEffect(() => {
    if (active >= 0) focus(active);
    // only when the selected step changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const gates = layout.pois.filter((p) => p.kind === "gate");
  const services = layout.pois.filter((p) => p.kind !== "gate" && LAYER_OF[p.kind] && layers.has(LAYER_OF[p.kind]!));

  return (
    <div className="airport-map relative overflow-hidden rounded-xl border" ref={box}>
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
            className="h-full w-full"
            role="img"
            aria-label={t("airportGuide.mapLabel", { airport: layout.iata })}
          >
            <rect width={width} height={height} className="map-ground" />
            {layout.aprons.map((r, i) => (
              <path key={`a${i}`} d={path(r.map(project), true)} className="map-apron" />
            ))}
            {layout.taxiways.map((r, i) => (
              <path key={`t${i}`} d={path(r.map(project))} className="map-taxiway" />
            ))}
            {layout.runways.map((r, i) => (
              <g key={`r${i}`}>
                <path d={path(r.map(project))} className="map-runway" />
                <path d={path(r.map(project))} className="map-runway-line" />
              </g>
            ))}
            {layout.terminals.map((term, i) => (
              <path
                key={`b${i}`}
                d={term.rings.map((r) => path(r.map(project), true)).join(" ")}
                className={`map-terminal map-terminal-${term.role}`}
                fillRule="evenodd"
              />
            ))}
            {layout.terminals
              .filter((term) => term.name)
              .map((term, i) => {
                const [x, y] = project(term.center);
                return (
                  <text key={`l${i}`} x={x} y={y} className="map-terminal-label" fontSize={unit * 0.62} textAnchor="middle">
                    {term.role === "departures"
                      ? t("airportGuide.departuresHall")
                      : term.role === "arrivals"
                        ? t("airportGuide.arrivalsHall")
                        : (term.name ?? "").slice(0, 32)}
                  </text>
                );
              })}

            {layers.has("gates") &&
              gates.map((g, i) => {
                const [x, y] = project(g.at);
                const mine = gate ? gateMatches(g.label, gate) : false;
                return (
                  <g key={`g${i}`} transform={`translate(${x},${y})`} className={mine ? "map-gate map-gate-mine" : "map-gate"}>
                    <circle r={unit * (mine ? 0.55 : 0.36)} />
                    <text fontSize={unit * (mine ? 0.42 : 0.3)} textAnchor="middle" dy="0.35em">
                      {(g.label ?? "").slice(0, 5)}
                    </text>
                  </g>
                );
              })}

            {services.map((p, i) => {
              const [x, y] = project(p.at);
              const Icon = ICON[p.kind] ?? DoorOpen;
              const s = unit * 0.62;
              return (
                <g key={`p${i}`} className={`map-poi map-poi-${LAYER_OF[p.kind]}`}>
                  <title>{p.label ?? t(`airportGuide.poi.${p.kind}`)}</title>
                  <circle cx={x} cy={y} r={s * 0.62} />
                  <Icon x={x - s * 0.36} y={y - s * 0.36} width={s * 0.72} height={s * 0.72} strokeWidth={2.4} />
                </g>
              );
            })}

            {placed.length > 1 && (
              <path d={path(placed.map((s) => s.xy))} className="map-journey" strokeWidth={unit * 0.16} strokeDasharray={`${unit * 0.5} ${unit * 0.35}`} />
            )}

            {placed.map((s) => {
              const [x, y] = s.xy;
              const on = s.index === active;
              const r = unit * (on ? 0.72 : 0.58);
              return (
                <g
                  key={s.id}
                  transform={`translate(${x},${y})`}
                  className={`map-step ${on ? "map-step-active" : ""} ${s.exact ? "" : "map-step-approx"}`}
                  onClick={() => onSelect(s.index)}
                  role="button"
                  aria-label={t(`airportGuide.step.${s.id}.title`)}
                >
                  {on && <circle r={r} className="map-step-pulse" />}
                  <circle r={r} className="map-step-dot" strokeWidth={unit * 0.12} strokeDasharray={s.exact ? undefined : `${unit * 0.22} ${unit * 0.14}`} />
                  <text fontSize={r * 1.05} textAnchor="middle" dy="0.36em" className="map-step-number">
                    {s.index + 1}
                  </text>
                </g>
              );
            })}
          </svg>
        </TransformComponent>
      </TransformWrapper>

      <div className="absolute right-2 top-2 flex flex-col gap-1.5">
        <Button size="icon" variant="secondary" className="size-11 shadow" aria-label={t("airportGuide.zoomIn")} onClick={() => wrapper.current?.zoomIn(0.6)}>
          <Plus />
        </Button>
        <Button size="icon" variant="secondary" className="size-11 shadow" aria-label={t("airportGuide.zoomOut")} onClick={() => wrapper.current?.zoomOut(0.6)}>
          <Minus />
        </Button>
        <Button size="icon" variant="secondary" className="size-11 shadow" aria-label={t("airportGuide.resetView")} onClick={() => wrapper.current?.resetTransform(400)}>
          <LocateFixed />
        </Button>
      </div>
      <p className="map-attribution absolute bottom-1 left-2 text-[10px]">© OpenStreetMap</p>
    </div>
  );
}
