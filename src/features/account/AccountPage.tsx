import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Camera, ClipboardCheck, LogOut, MessageCircle, Plane, Trash2, UserRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/features/arrival/AppHeader";
import { useTripUser } from "@/features/trip/auth";
import { loadTripConversation } from "@/features/trip/conversation.functions";
import { checklistStorageKey, preflightInputSchema } from "@/features/preflight/rules";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { initials } from "./AccountButton";
import { MedicalCardEditor } from "./MedicalCardEditor";
import { makeTrip, tripIdFor } from "@/features/trips/model";
import { getTrip, removeTrip, upsertTrip } from "@/features/trips/store";
import { CHOSEN_FLIGHT_KEY } from "./device";
import { deleteSaved, listSaved, loadProfile, profileQueryKey, savedQueryKey, updateProfile, uploadAvatar, type SavedRow } from "./saved";

type TripData = { input?: Record<string, unknown> & { departure?: string; returnDate?: string; oneWay?: boolean }; flight?: { price: number; currency: string; airline: string } | null; total?: [number, number] | null; currency?: string };
type ChecklistData = { input?: unknown; ticks?: string[]; total?: number };

export function AccountPage() {
  const { t, i18n } = useTranslation();
  const user = useTripUser();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const loadChat = useServerFn(loadTripConversation);
  const userId = user?.id ?? "";
  const profile = useQuery({ queryKey: profileQueryKey(userId), queryFn: () => loadProfile(userId), enabled: Boolean(user) });
  const saved = useQuery({ queryKey: savedQueryKey(userId), queryFn: listSaved, enabled: Boolean(user) });
  const chat = useQuery({ queryKey: ["trip-chat", userId], queryFn: () => loadChat(), enabled: Boolean(user) });
  const [name, setName] = useState("");
  const [nameState, setNameState] = useState<"idle" | "saving" | "saved">("idle");
  const [photoError, setPhotoError] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (profile.data) setName(profile.data.display_name ?? ""); }, [profile.data]);

  const today = new Date().toISOString().slice(0, 10);
  const date = (v: string) => new Intl.DateTimeFormat(i18n.language, { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${v}T12:00:00`));
  const money = (v: number, c: string) => new Intl.NumberFormat(i18n.language, { style: "currency", currency: c, maximumFractionDigits: 0 }).format(v);
  const trips = (saved.data ?? []).filter((r) => r.kind === "trip");
  const checklists = (saved.data ?? []).filter((r) => r.kind === "preflight");
  const messages = Array.isArray(chat.data?.messages) ? chat.data.messages.length : 0;
  const chatDestination = (chat.data?.trip_input as { destination?: string } | null)?.destination ?? "";

  async function saveName() {
    if (!user) return;
    setNameState("saving");
    try { await updateProfile(user.id, { display_name: name.trim().slice(0, 80) }); await queryClient.invalidateQueries({ queryKey: profileQueryKey(user.id) }); setNameState("saved"); }
    catch { setNameState("idle"); }
  }
  async function pickPhoto(file: File | undefined) {
    if (!user || !file) return;
    setUploading(true); setPhotoError(false);
    try { await uploadAvatar(user.id, file); await queryClient.invalidateQueries({ queryKey: profileQueryKey(user.id) }); }
    catch { setPhotoError(true); } finally { setUploading(false); if (fileRef.current) fileRef.current.value = ""; }
  }
  async function remove(row: SavedRow) {
    if (!window.confirm(t("account.deleteConfirm", { title: row.title }))) return;
    await deleteSaved(row.id).catch(() => {});
    if (row.kind === "preflight") {
      const parsed = preflightInputSchema.safeParse((row.data as ChecklistData).input);
      if (parsed.success) removeTrip(tripIdFor(parsed.data));
    }
    void queryClient.invalidateQueries({ queryKey: savedQueryKey(userId) });
  }
  function openTrip(row: SavedRow) {
    const d = row.data as TripData;
    sessionStorage.setItem(CHOSEN_FLIGHT_KEY, JSON.stringify(d.input));
    localStorage.setItem("flywell:tab", "plan");
    void navigate({ to: "/", search: { runTrip: true } });
  }
  function openChecklist(row: SavedRow) {
    const d = row.data as ChecklistData;
    const parsed = preflightInputSchema.safeParse(d.input);
    if (!parsed.success) return;
    localStorage.setItem(checklistStorageKey(parsed.data), JSON.stringify(d.ticks ?? []));
    const id = tripIdFor(parsed.data);
    if (!getTrip(id)) upsertTrip({ ...makeTrip(parsed.data), synced: true });
    localStorage.setItem("flywell:tab", "trips");
    void navigate({ to: "/trips/$tripId", params: { tripId: id }, search: { tab: "" } });
  }
  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    void navigate({ to: "/auth", search: { redirect: "/account" }, replace: true });
  }

  return <>
    <AppHeader />
    <main className="arrival-main mx-auto w-full max-w-3xl px-5 pt-9 pb-[max(3rem,env(safe-area-inset-bottom))] sm:px-8">
      <p className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase text-primary"><UserRound className="size-4" />{t("account.account")}</p>

      <section aria-labelledby="profile-title" className="flex flex-col gap-6 border-b pb-8 sm:flex-row sm:items-center">
        <div className="relative w-fit">
          <Avatar className="size-24 border-4 border-background shadow-md ring-2 ring-primary">
            {profile.data?.photo && <AvatarImage src={profile.data.photo} alt="" referrerPolicy="no-referrer" />}
            <AvatarFallback className="bg-primary text-2xl font-semibold text-primary-foreground">{initials(profile.data?.display_name, user?.email)}</AvatarFallback>
          </Avatar>
          <Button type="button" size="icon" variant="secondary" disabled={uploading} aria-label={t("account.changePhoto")} className="absolute -bottom-1 -right-1 size-11 rounded-full shadow" onClick={() => fileRef.current?.click()}><Camera className="size-5" /></Button>
          <input ref={fileRef} type="file" accept="image/*" className="sr-only" tabIndex={-1} onChange={(e) => void pickPhoto(e.target.files?.[0])} />
        </div>
        <div className="min-w-0 flex-1">
          <h1 id="profile-title" className="break-words font-display text-4xl leading-tight">{profile.data?.display_name || t("account.profile")}</h1>
          <p className="mt-1 break-all text-sm text-muted-foreground">{user?.email}</p>
          {photoError && <p role="alert" className="mt-2 text-sm text-destructive">{t("account.photoError")}</p>}
          <form className="mt-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); void saveName(); }}>
            <Label htmlFor="profile-name" className="sr-only">{t("account.name")}</Label>
            <Input id="profile-name" className="h-11" value={name} maxLength={80} placeholder={t("account.name")} onChange={(e) => { setName(e.target.value); setNameState("idle"); }} />
            <Button type="submit" variant="outline" className="min-h-11" disabled={nameState === "saving"}>{nameState === "saved" ? t("account.nameSaved") : t("account.saveName")}</Button>
          </form>
        </div>
      </section>

      {user && <MedicalCardEditor userId={user.id} />}

      <h2 className="mt-9 font-display text-3xl">{t("account.savedTrips")}</h2>
      {saved.isError && <p role="alert" className="mt-3 text-sm text-destructive">{t("account.loadError")}</p>}

      <Group icon={<Plane className="size-5" />} title={t("account.plannedTrips")}>
        {saved.isPending ? <Loading /> : trips.length ? trips.map((row) => {
          const d = row.data as TripData;
          const past = (row.travel_date ?? "") < today;
          return <Card key={row.id} title={row.title} past={past} pastLabel={t("account.past")}
            meta={[row.travel_date && date(row.travel_date), d.input?.oneWay ? t("trip.oneWay") : d.input?.returnDate && date(d.input.returnDate)].filter(Boolean).join(" – ")}
            detail={d.flight ? `${d.flight.airline} · ${t("account.fromPrice", { price: money(d.flight.price, d.flight.currency) })}` : d.total && d.currency ? `${t("trip.estimate")}: ${money(d.total[0], d.currency)}–${money(d.total[1], d.currency)}` : ""}
            onOpen={past ? undefined : () => openTrip(row)} onDelete={() => void remove(row)} openLabel={t("account.open")} deleteLabel={t("account.delete")} />;
        }) : <Empty>{t("account.emptyTrips")}</Empty>}
      </Group>

      <Group icon={<ClipboardCheck className="size-5" />} title={t("account.checklists")}>
        {saved.isPending ? <Loading /> : checklists.length ? checklists.map((row) => {
          const d = row.data as ChecklistData;
          const done = d.ticks?.length ?? 0, total = d.total ?? 0;
          return <Card key={row.id} title={row.title} past={(row.travel_date ?? "") < today} pastLabel={t("account.past")}
            meta={row.travel_date ? date(row.travel_date) : ""}
            detail={total ? t("account.progress", { done: Math.min(done, total), total }) : ""}
            progress={total ? (Math.min(done, total) / total) * 100 : undefined}
            onOpen={() => openChecklist(row)} onDelete={() => void remove(row)} openLabel={t("account.open")} deleteLabel={t("account.delete")} />;
        }) : <Empty>{t("account.emptyChecklists")}</Empty>}
      </Group>

      <Group icon={<MessageCircle className="size-5" />} title={t("account.tripChat")}>
        {chat.isPending ? <Loading /> : messages ? <article className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-4">
          <p className="text-sm">{t("account.chatSummary", { count: messages, destination: chatDestination })}</p>
          <Button className="min-h-11" onClick={() => { localStorage.setItem("flywell:tab", "plan"); void navigate({ to: "/" }); }}>{t("account.continueChat")}</Button>
        </article> : <Empty>{t("account.noChat")}</Empty>}
      </Group>

      <Button variant="ghost" className="mt-10 min-h-11 text-destructive" onClick={() => void signOut()}><LogOut className="size-4" />{t("trip.signOut")}</Button>
    </main>
  </>;
}

function Group({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return <section className="mt-7"><h3 className="mb-3 flex items-center gap-2 text-lg font-semibold"><span className="text-primary">{icon}</span>{title}</h3><div className="grid gap-3">{children}</div></section>;
}
function Card({ title, meta, detail, past, pastLabel, progress, onOpen, onDelete, openLabel, deleteLabel }: { title: string; meta: string; detail: string; past: boolean; pastLabel: string; progress?: number | undefined; onOpen?: (() => void) | undefined; onDelete: () => void; openLabel: string; deleteLabel: string }) {
  return <article className={`rounded-lg border bg-card p-4 ${past ? "opacity-70" : ""}`}>
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="break-words font-semibold">{title}{past && <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">{pastLabel}</span>}</p>
        {meta && <p className="mt-1 text-sm text-muted-foreground">{meta}</p>}
        {detail && <p className="mt-1 text-sm">{detail}</p>}
      </div>
      <Button variant="ghost" size="icon" className="size-11 shrink-0" aria-label={`${deleteLabel}: ${title}`} onClick={onDelete}><Trash2 className="size-4" /></Button>
    </div>
    {progress !== undefined && <Progress value={progress} className="mt-3 h-2" />}
    {onOpen && <Button variant="outline" className="mt-3 min-h-11 w-full sm:w-auto" onClick={onOpen}>{openLabel}</Button>}
  </article>;
}
function Empty({ children }: { children: ReactNode }) { return <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">{children}</p>; }
function Loading() { return <Skeleton className="h-20 w-full rounded-lg" />; }
