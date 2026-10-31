import { useState } from "react";
import { useTranslation } from "react-i18next";
import { motion, useReducedMotion } from "motion/react";
import { Armchair, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PreflightInput } from "./rules";
import {
  EXIT_ROWS,
  ROWS,
  SEAT_SOURCES,
  SITUATIONS,
  WING_ROWS,
  adviceFor,
  defaultSituation,
  inRanges,
  type Column,
  type Situation,
} from "./seats";

const LETTERS: { letter: string; column: Column }[] = [
  { letter: "A", column: "window" },
  { letter: "B", column: "middle" },
  { letter: "C", column: "aisle" },
  { letter: "D", column: "aisle" },
  { letter: "E", column: "middle" },
  { letter: "F", column: "window" },
];

// Cabin drawing geometry (nose on the left).
const X0 = 62;
const PITCH = 10.6;
const SEAT = 8;
const rowX = (row: number) => X0 + (row - 1) * PITCH;
const seatY = (i: number) => 38 + i * 11 + (i >= 3 ? 10 : 0);

/** "Where to sit": situation chips, an animated cabin map and sourced safety statistics. */
export function SeatAdvice({ input }: { input: PreflightInput }) {
  const { t } = useTranslation();
  const reduce = useReducedMotion() ?? false;
  const [situation, setSituation] = useState<Situation>(() => defaultSituation(input));
  const advice = adviceFor(situation);
  const ranges = (r: [number, number][]) => r.map(([a, b]) => (a === b ? `${a}` : `${a}–${b}`)).join(", ");

  return (
    <section className="mt-10" aria-labelledby="seat-advice-title">
      <p className="section-index flex items-center gap-1.5">
        <Armchair className="size-3.5" />
        {t("seats.eyebrow")}
      </p>
      <h3 id="seat-advice-title" className="font-display text-3xl sm:text-4xl">
        {t("seats.title")}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t("seats.subtitle")}</p>

      <div className="mt-4 flex gap-2 overflow-x-auto pb-1" role="radiogroup" aria-label={t("seats.situations")}>
        {SITUATIONS.map(({ situation: s }) => (
          <Button
            key={s}
            type="button"
            role="radio"
            aria-checked={situation === s}
            variant={situation === s ? "default" : "outline"}
            className="min-h-11 shrink-0 rounded-full px-4 text-sm"
            onClick={() => setSituation(s)}
          >
            {t(`seats.situation.${s}`)}
          </Button>
        ))}
      </div>

      <div className="seat-cabin mt-4 rounded-2xl border p-3">
        <svg viewBox="0 0 400 140" className="w-full" role="img" aria-label={t(`seats.summary.${situation}`)}>
          {/* Wings under the fuselage */}
          <path d={`M${rowX(WING_ROWS[0])},34 L${rowX(WING_ROWS[0]) + 30},2 L${rowX(WING_ROWS[1]) + 6},2 L${rowX(WING_ROWS[1]) + 8},34 Z`} className="seat-wing" />
          <path d={`M${rowX(WING_ROWS[0])},106 L${rowX(WING_ROWS[0]) + 30},138 L${rowX(WING_ROWS[1]) + 6},138 L${rowX(WING_ROWS[1]) + 8},106 Z`} className="seat-wing" />
          {/* Tail */}
          <path d="M372,50 L398,28 L398,112 L372,90 Z" className="seat-wing" />
          {/* Fuselage */}
          <path d="M44,30 L378,30 Q392,30 392,70 Q392,110 378,110 L44,110 Q6,110 6,70 Q6,30 44,30 Z" className="seat-body" />
          <path d="M20,58 Q24,50 34,50 L34,90 Q24,90 20,82 Z" className="seat-cockpit" />

          {EXIT_ROWS.map((row) => (
            <g key={row}>
              <rect x={rowX(row) - 3} y={27} width={SEAT + 6} height={4} rx={2} className="seat-exit" />
              <rect x={rowX(row) - 3} y={109} width={SEAT + 6} height={4} rx={2} className="seat-exit" />
            </g>
          ))}

          {Array.from({ length: ROWS }, (_, i) => i + 1).map((row) => {
            const good = inRanges(row, advice.rows);
            const bad = inRanges(row, advice.avoid);
            return (
              <g key={row}>
                {LETTERS.map(({ letter, column }, i) => {
                  const best = good && advice.columns.includes(column);
                  const tone = best ? "seat-best" : good ? "seat-good" : bad ? "seat-avoid" : "seat-plain";
                  return (
                    <rect
                      key={letter}
                      x={rowX(row)}
                      y={seatY(i)}
                      width={SEAT}
                      height={9}
                      rx={2}
                      className={`seat ${tone}`}
                      style={reduce ? undefined : { transitionDelay: `${row * 14}ms` }}
                    >
                      <title>{`${row}${letter}`}</title>
                    </rect>
                  );
                })}
                {(row === 1 || row % 5 === 0) && (
                  <text x={rowX(row) + SEAT / 2} y={75} textAnchor="middle" className="seat-row-number">
                    {row}
                  </text>
                )}
              </g>
            );
          })}
          <text x={40} y={136} className="seat-axis">{t("seats.front")}</text>
          <text x={392} y={136} textAnchor="end" className="seat-axis">{t("seats.rear")}</text>
        </svg>

        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <Legend tone="seat-best" label={t("seats.legendBest")} />
          <Legend tone="seat-good" label={t("seats.legendGood")} />
          <Legend tone="seat-avoid" label={t("seats.legendAvoid")} />
          <Legend tone="seat-exit" label={t("seats.legendExit")} />
          <Legend tone="seat-wing" label={t("seats.legendWing")} />
        </div>
      </div>

      <motion.div
        key={situation}
        initial={reduce ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mt-4 rounded-lg border bg-card p-4"
        aria-live="polite"
      >
        <p className="font-semibold">{t(`seats.summary.${situation}`)}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("seats.rows", { list: ranges(advice.rows) })} · {t("seats.columns", { list: [...new Set(advice.columns)].map((c) => t(`seats.col.${c}`)).join(", ") })}
          {advice.avoid.length > 0 && ` · ${t("seats.avoidRows", { list: ranges(advice.avoid) })}`}
        </p>
        <ul className="mt-3 grid gap-2 text-sm leading-relaxed">
          {Array.from({ length: advice.tips }, (_, n) => (
            <li key={n} className="flex gap-2">
              <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
              {t(`seats.tip.${situation}.${n + 1}`)}
            </li>
          ))}
        </ul>
        {advice.sources.length ? (
          <div className="mt-3 flex flex-wrap gap-x-4">
            {advice.sources.map((id) => (
              <SourceLink key={id} id={id} />
            ))}
          </div>
        ) : (
          <p className="mt-3 text-xs text-muted-foreground">{t("seats.comfortOnly")}</p>
        )}
      </motion.div>

      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{t("seats.aircraftNote")}</p>
    </section>
  );
}

function Legend({ tone, label }: { tone: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`seat-legend ${tone}`} />
      {label}
    </span>
  );
}

function SourceLink({ id }: { id: keyof typeof SEAT_SOURCES }) {
  const s = SEAT_SOURCES[id];
  return (
    <a href={s.url} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline">
      {s.name}
      <ExternalLink className="size-3.5 shrink-0" />
    </a>
  );
}
