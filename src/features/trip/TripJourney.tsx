import { useTranslation } from "react-i18next";
import { useReveal } from "./useReveal";

const STAGES = [
  { key: "before", items: ["documents", "bags", "rules", "map"], tone: "journey-before" },
  { key: "during", items: ["breathe", "crew", "sick"], tone: "journey-during" },
  { key: "arrival", items: ["food", "ride", "visit"], tone: "journey-arrival" },
];

function Line({ stage, item, index }: { stage: string; item: string; index: number }) {
  const { t } = useTranslation();
  const line = useReveal<HTMLLIElement>();
  return (
    <li ref={line} className="reveal" style={{ "--i": index } as React.CSSProperties}>
      <p className="text-2xl font-semibold sm:text-3xl">{t(`landing.${stage}.${item}`)}</p>
      <p className="mt-1">{t(`landing.${stage}.${item}Detail`)}</p>
    </li>
  );
}

function Stage({ stage, items, tone }: { stage: string; items: string[]; tone: string }) {
  const { t } = useTranslation();
  const heading = useReveal<HTMLDivElement>();
  return (
    <article className={`${tone} py-20 lg:py-32`}>
      <div className="mx-auto grid max-w-6xl gap-10 px-5 sm:px-8 lg:grid-cols-2">
        <div ref={heading} className="reveal">
          <h3 className="font-poster text-6xl uppercase leading-[1.1] sm:text-7xl lg:text-8xl">
            {t(`landing.${stage}.title`)}
          </h3>
          <p className="mt-6 max-w-md text-lg">{t(`landing.${stage}.text`)}</p>
        </div>
        <ul className="grid content-start gap-8">
          {items.map((item, index) => (
            <Line key={item} stage={stage} item={item} index={index} />
          ))}
        </ul>
      </div>
    </article>
  );
}

/** What the app does on each leg of the trip; the words come from the features that really exist. */
export function TripJourney() {
  const { t } = useTranslation();
  return (
    <section aria-label={t("landing.journey")}>
      {STAGES.map((stage) => (
        <Stage key={stage.key} stage={stage.key} items={stage.items} tone={stage.tone} />
      ))}
    </section>
  );
}
