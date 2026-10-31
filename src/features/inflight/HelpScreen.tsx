import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowLeft,
  BellRing,
  HeartHandshake,
  IdCard,
  Stethoscope,
  Vibrate,
  Wind,
  WifiOff,
  X,
  TriangleAlert,
  Pencil,
} from "lucide-react";
import { useTripUser } from "@/features/trip/auth";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BREATH, CARD_EVENT, CREW_PHRASES, hasMedicalInfo, loadCard, saveCard, type MedicalCard } from "./medical-card";

export type View = "home" | "breathe" | "crew" | "unwell" | "card";
const SYMPTOMS = ["panic", "nausea", "ears", "faint", "headache", "turbulence"] as const;

/** Keep the screen on while the help screen is open, where the browser allows it. */
function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | undefined;
    navigator.wakeLock.request("screen").then((l) => (lock = l)).catch(() => {});
    return () => void lock?.release().catch(() => {});
  }, [active]);
}

export default function HelpScreen({ open, onOpenChange, initialView = "home" }: { open: boolean; onOpenChange: (v: boolean) => void; initialView?: View }) {
  const { t } = useTranslation();
  const [view, setView] = useState<View>(initialView);
  const [card, setCard] = useState<MedicalCard>(() => loadCard());
  useWakeLock(open);
  useEffect(() => setView(initialView), [initialView]);
  // The account copy can arrive while the screen is open.
  useEffect(() => {
    const refresh = () => setCard(loadCard());
    window.addEventListener(CARD_EVENT, refresh);
    return () => window.removeEventListener(CARD_EVENT, refresh);
  }, []);
  const update = (next: MedicalCard) => {
    setCard(next);
    saveCard(next);
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Content
          className={`help-screen fixed inset-0 z-[60] flex flex-col overflow-y-auto outline-none ${view === "crew" ? "help-screen-alert" : ""}`}
          aria-describedby={undefined}
        >
          <div className="help-aurora" aria-hidden />
          <header className="sticky top-0 z-10 flex items-center justify-between gap-2 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2">
            {view === "home" ? (
              <span className="help-offline-chip">
                <WifiOff className="size-3.5" />
                {t("help.offlineReady")}
              </span>
            ) : (
              <Button variant="ghost" className="help-ghost min-h-11 gap-1.5 rounded-full" onClick={() => setView("home")}>
                <ArrowLeft className="size-4" />
                {t("help.back")}
              </Button>
            )}
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" className="help-ghost size-11 rounded-full" aria-label={t("help.close")}>
                <X />
              </Button>
            </Dialog.Close>
          </header>

          <div className="relative mx-auto w-full max-w-lg flex-1 px-5 pb-[max(2rem,env(safe-area-inset-bottom))]">
            <AnimatePresence mode="wait">
              <motion.div
                key={view}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.28, ease: "easeOut" }}
              >
                {view === "home" && <Home onPick={setView} />}
                {view === "breathe" && <Breathe />}
                {view === "crew" && <Crew card={card} onSeat={(seat) => update({ ...card, seat })} onEdit={() => setView("card")} />}
                {view === "unwell" && <Unwell onCrew={() => setView("crew")} onBreathe={() => setView("breathe")} />}
                {view === "card" && <CardView card={card} onClose={() => onOpenChange(false)} />}
              </motion.div>
            </AnimatePresence>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Home({ onPick }: { onPick: (v: View) => void }) {
  const { t } = useTranslation();
  const tiles: { view: View; icon: typeof Wind; tone: string }[] = [
    { view: "breathe", icon: Wind, tone: "help-tile-calm" },
    { view: "crew", icon: BellRing, tone: "help-tile-alert" },
    { view: "unwell", icon: Stethoscope, tone: "help-tile-care" },
    { view: "card", icon: IdCard, tone: "help-tile-card" },
  ];
  return (
    <>
      <Dialog.Title className="font-display text-4xl leading-tight sm:text-5xl">{t("help.title")}</Dialog.Title>
      <p className="help-muted mt-2 leading-relaxed">{t("help.subtitle")}</p>
      <div className="mt-6 grid gap-3">
        {tiles.map(({ view, icon: Icon, tone }, i) => (
          <motion.button
            key={view}
            type="button"
            onClick={() => onPick(view)}
            className={`help-tile ${tone}`}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.05 + i * 0.07 }}
            whileTap={{ scale: 0.97 }}
          >
            <span className="help-tile-icon">
              <Icon className="size-6" />
            </span>
            <span className="min-w-0 flex-1 text-left">
              <span className="block text-lg font-semibold">{t(`help.tile.${view}.title`)}</span>
              <span className="help-muted block text-sm leading-snug">{t(`help.tile.${view}.detail`)}</span>
            </span>
          </motion.button>
        ))}
      </div>
      <p className="help-muted mt-6 text-xs leading-relaxed">{t("help.disclaimer")}</p>
    </>
  );
}

function Breathe() {
  const { t } = useTranslation();
  const [index, setIndex] = useState(0);
  const [left, setLeft] = useState<number>(BREATH[0].seconds);
  const [cycles, setCycles] = useState(0);
  const [haptics, setHaptics] = useState(true);
  const hapticsRef = useRef(haptics);
  hapticsRef.current = haptics;
  const step = BREATH[index]!;

  useEffect(() => {
    if (hapticsRef.current && "vibrate" in navigator) navigator.vibrate(step.phase === "hold" ? 30 : [40, 60, 40]);
    setLeft(step.seconds);
    const tick = setInterval(() => setLeft((s) => Math.max(1, s - 1)), 1000);
    const next = setTimeout(() => {
      setIndex((i) => (i + 1) % BREATH.length);
      if (index === BREATH.length - 1) setCycles((c) => c + 1);
    }, step.seconds * 1000);
    return () => {
      clearInterval(tick);
      clearTimeout(next);
    };
  }, [index, step]);

  const scale = step.phase === "inhale" ? 1 : step.phase === "hold" ? 1 : 0.55;
  return (
    <div className="flex flex-col items-center text-center">
      <Dialog.Title className="font-display text-4xl">{t("help.breathe.title")}</Dialog.Title>
      <p className="help-muted mt-2 max-w-xs text-sm leading-relaxed">{t("help.breathe.intro")}</p>
      <div className="relative my-10 flex size-72 items-center justify-center" aria-live="polite">
        <motion.span
          className="breath-halo"
          animate={{ scale: scale * 1.18, opacity: step.phase === "hold" ? 0.55 : 0.35 }}
          transition={{ duration: step.seconds, ease: "easeInOut" }}
        />
        <motion.span
          className="breath-orb"
          initial={{ scale: 0.55 }}
          animate={{ scale }}
          transition={{ duration: step.phase === "hold" ? 0.4 : step.seconds, ease: "easeInOut" }}
        />
        <span className="relative z-10">
          <span className="block text-2xl font-semibold">{t(`help.breathe.${step.phase}`)}</span>
          <span className="block font-display text-6xl tabular-nums">{left}</span>
        </span>
      </div>
      <p className="help-muted min-h-5 text-sm">{cycles > 0 && t("help.breathe.cycles", { count: cycles })}</p>
      <label className="mt-4 flex min-h-11 items-center gap-3 text-sm">
        <Vibrate className="size-4" />
        {t("help.breathe.haptics")}
        <Switch checked={haptics} onCheckedChange={setHaptics} />
      </label>
      <div className="help-panel mt-6 w-full text-left">
        <p className="font-semibold">{t("help.breathe.groundTitle")}</p>
        <p className="help-muted mt-1 text-sm leading-relaxed">{t("help.breathe.ground")}</p>
      </div>
    </div>
  );
}

function Crew({ card, onSeat, onEdit }: { card: MedicalCard; onSeat: (s: string) => void; onEdit: () => void }) {
  const { t, i18n } = useTranslation();
  const first = i18n.language === "ro" ? "ro" : "en";
  const phrases = [...CREW_PHRASES].sort((a, b) => (a.lang === first ? -1 : b.lang === first ? 1 : 0));
  const [main, ...others] = phrases;
  return (
    <div>
      <Dialog.Title className="sr-only">{t("help.crew.title")}</Dialog.Title>
      <motion.div
        className="crew-card"
        initial={{ scale: 0.94 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 18 }}
      >
        <BellRing className="crew-bell size-10" />
        <p lang={main!.lang} className="mt-3 text-3xl font-bold leading-tight sm:text-4xl">
          {main!.text}
        </p>
        <label className="mt-5 flex items-center gap-3 text-lg font-semibold">
          {t("help.crew.seat")}
          <Input
            value={card.seat}
            onChange={(e) => onSeat(e.target.value.toUpperCase().slice(0, 4))}
            placeholder="14C"
            spellCheck={false}
            autoComplete="off"
            aria-label={t("help.crew.seat")}
            className="crew-seat h-14 w-28 text-center text-2xl font-bold"
          />
        </label>
      </motion.div>

      <p className="help-panel mt-4 flex items-start gap-2 text-sm leading-relaxed">
        <HeartHandshake className="mt-0.5 size-5 shrink-0" />
        {t("help.crew.callButton")}
      </p>

      {hasMedicalInfo(card) ? (
        <div className="help-panel mt-4">
          <p className="text-xs font-semibold uppercase tracking-wide">{t("help.crew.medicalTitle")}</p>
          <dl className="mt-2 grid gap-1.5 text-base">
            {card.name && <Info label={t("help.card.name")}>{card.name}</Info>}
            {card.conditions && <Info label={t("help.card.conditions")}>{card.conditions}</Info>}
            {card.allergies && <Info label={t("help.card.allergies")}>{card.allergies}</Info>}
            {card.medication && <Info label={t("help.card.medication")}>{card.medication}</Info>}
            {card.bloodType && <Info label={t("help.card.bloodType")}>{card.bloodType}</Info>}
            {(card.contactName || card.contactPhone) && (
              <Info label={t("help.card.contact")}>
                {card.contactName} {card.contactPhone}
              </Info>
            )}
          </dl>
        </div>
      ) : (
        <Button variant="outline" className="help-outline mt-4 min-h-11 w-full whitespace-normal" onClick={onEdit}>
          <IdCard />
          {t("help.crew.addCard")}
        </Button>
      )}

      <div className="mt-5 grid gap-2">
        {others.map((p) => (
          <p key={p.lang} lang={p.lang} className="help-phrase">
            <span className="text-[11px] font-semibold uppercase tracking-wide">{p.label}</span>
            <span className="block text-base leading-snug">{p.text}</span>
          </p>
        ))}
      </div>
    </div>
  );
}

function Info({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap gap-x-2">
      <dt className="help-muted">{label}:</dt>
      <dd className="font-semibold">{children}</dd>
    </div>
  );
}

function Unwell({ onCrew, onBreathe }: { onCrew: () => void; onBreathe: () => void }) {
  const { t } = useTranslation();
  return (
    <div>
      <Dialog.Title className="font-display text-4xl">{t("help.unwell.title")}</Dialog.Title>
      <motion.div
        className="help-urgent mt-5"
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        <p className="flex items-center gap-2 font-semibold">
          <TriangleAlert className="size-5 shrink-0" />
          {t("help.unwell.urgentTitle")}
        </p>
        <p className="mt-1 text-sm leading-relaxed">{t("help.unwell.urgent")}</p>
        <Button className="help-urgent-button mt-3 min-h-11 w-full" onClick={onCrew}>
          <BellRing />
          {t("help.unwell.showCrew")}
        </Button>
      </motion.div>
      <Accordion type="single" collapsible className="mt-5 grid gap-2">
        {SYMPTOMS.map((s) => (
          <AccordionItem key={s} value={s} className="help-panel border-0 py-0">
            <AccordionTrigger className="min-h-12 text-base font-semibold hover:no-underline">
              {t(`help.symptom.${s}.title`)}
            </AccordionTrigger>
            <AccordionContent>
              <ul className="grid gap-2 pb-1 text-sm leading-relaxed">
                {(t(`help.symptom.${s}.steps`, { returnObjects: true }) as string[]).map((line) => (
                  <li key={line} className="flex gap-2">
                    <span className="help-bullet" />
                    {line}
                  </li>
                ))}
              </ul>
              {s === "panic" && (
                <Button variant="outline" className="help-outline mt-3 min-h-11" onClick={onBreathe}>
                  <Wind />
                  {t("help.tile.breathe.title")}
                </Button>
              )}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
      <p className="help-muted mt-5 text-xs leading-relaxed">{t("help.disclaimer")}</p>
    </div>
  );
}

/** Read-only: the card is edited only in the account, and this copy opens in airplane mode. */
function CardView({ card, onClose }: { card: MedicalCard; onClose: () => void }) {
  const { t } = useTranslation();
  const user = useTripUser();
  const field = (key: keyof MedicalCard, multiline = false) => (
    <div className="grid gap-1.5">
      <Label htmlFor={`card-${key}`} className="text-sm">
        {t(`help.card.${key}`)}
      </Label>
      {multiline ? (
        <Textarea id={`card-${key}`} value={card[key]} readOnly className="help-input min-h-20 text-base" placeholder={t("help.card.notFilled")} />
      ) : (
        <Input id={`card-${key}`} value={card[key]} readOnly className="help-input h-12 text-base" placeholder={t("help.card.notFilled")} />
      )}
    </div>
  );
  return (
    <div>
      <Dialog.Title className="font-display text-4xl">{t("help.card.title")}</Dialog.Title>
      <p className="help-muted mt-2 text-sm leading-relaxed">{t("help.card.privacy")}</p>
      <Button asChild variant="outline" className="help-outline mt-4 min-h-11 w-full whitespace-normal">
        {user ? (
          <Link to="/account" hash="medical-card" onClick={onClose}><Pencil />{t("help.card.editInAccount")}</Link>
        ) : (
          <Link to="/auth" search={{ redirect: "/account#medical-card" }} onClick={onClose}><Pencil />{t("help.card.signInToEdit")}</Link>
        )}
      </Button>
      <div className="mt-5 grid gap-4">
        {field("name")}
        {field("conditions", true)}
        {field("allergies", true)}
        {field("medication", true)}
        {field("bloodType")}
        {field("contactName")}
        {field("contactPhone")}
      </div>
    </div>
  );
}
