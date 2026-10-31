import { useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useRouter } from "@tanstack/react-router";
import { MailCheck, UserRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/features/arrival/AppHeader";
import { useTripUser } from "@/features/trip/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SocialButtons } from "./SignInOptions";
import { safeRedirect } from "./device";

type Mode = "signin" | "signup" | "forgot";

function errorKey(message: string) {
  const m = message.toLowerCase();
  if (m.includes("invalid login")) return "account.wrongCredentials";
  if (m.includes("email address") && (m.includes("not allowed") || m.includes("invalid"))) return "account.invalidEmail";
  if (m.includes("not confirmed")) return "account.notConfirmed";
  if (m.includes("already registered") || m.includes("already exists")) return "account.exists";
  if (m.includes("password") && (m.includes("weak") || m.includes("at least") || m.includes("pwned"))) return "account.weakPassword";
  return "account.genericError";
}

export function AuthPage({ redirect }: { redirect: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const user = useTripUser();
  const target = safeRedirect(redirect);
  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => { if (user) router.history.replace(target); }, [user, router, target]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError(""); setNotice("");
    try {
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/reset-password` });
        if (error) throw error;
        setNotice(t("account.resetSent"));
      } else if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(), password,
          options: { emailRedirectTo: `${window.location.origin}${target}`, data: { display_name: name.trim().slice(0, 80) } },
        });
        if (error) throw error;
        if (data.user && !data.user.identities?.length) throw new Error("already registered");
        if (!data.session) setNotice(t("account.confirmSent", { email: email.trim() }));
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      }
    } catch (err) {
      setError(t(errorKey(err instanceof Error ? err.message : "")));
    } finally { setBusy(false); }
  }

  return <>
    <AppHeader />
    <main className="arrival-main mx-auto w-full max-w-md px-5 pt-9 pb-[max(3rem,env(safe-area-inset-bottom))]">
      <p className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase text-primary"><UserRound className="size-4" />{t("account.account")}</p>
      <h1 className="font-display text-4xl leading-tight sm:text-5xl">{t("account.authTitle")}</h1>
      <p className="mt-3 leading-relaxed text-muted-foreground">{t("account.authSubtitle")}</p>

      <div className="mt-8"><SocialButtons returnTo={target} onError={() => setError(t("account.genericError"))} /></div>

      <div className="my-7 flex items-center gap-3 text-xs uppercase text-muted-foreground"><span className="h-px flex-1 bg-border" />{t("account.or")}<span className="h-px flex-1 bg-border" /></div>

      {mode !== "forgot" && <Tabs value={mode} onValueChange={(v) => { setMode(v as Mode); setError(""); setNotice(""); }}>
        <TabsList className="grid h-12 w-full grid-cols-2">
          <TabsTrigger value="signin" className="min-h-10">{t("account.signInTab")}</TabsTrigger>
          <TabsTrigger value="signup" className="min-h-10">{t("account.signUpTab")}</TabsTrigger>
        </TabsList>
      </Tabs>}
      {mode === "forgot" && <h2 className="text-lg font-semibold">{t("account.forgot")}</h2>}

      {notice ? <div role="status" className="mt-5 flex gap-3 rounded-lg border bg-card p-4 text-sm"><MailCheck className="size-5 shrink-0 text-primary" /><p>{notice}</p></div> :
      <form onSubmit={submit} className="mt-5 grid gap-4">
        {mode === "signup" && <div className="grid gap-1.5"><Label htmlFor="auth-name">{t("account.name")}</Label><Input id="auth-name" className="h-12" autoComplete="name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} /></div>}
        <div className="grid gap-1.5"><Label htmlFor="auth-email">{t("account.email")}</Label><Input id="auth-email" className="h-12" type="email" inputMode="email" autoComplete="email" required value={email} maxLength={255} onChange={(e) => setEmail(e.target.value)} /></div>
        {mode !== "forgot" && <div className="grid gap-1.5"><Label htmlFor="auth-password">{t("account.password")}</Label><Input id="auth-password" className="h-12" type="password" required minLength={8} maxLength={72} autoComplete={mode === "signup" ? "new-password" : "current-password"} value={password} onChange={(e) => setPassword(e.target.value)} />{mode === "signup" && <p className="text-xs text-muted-foreground">{t("account.passwordHint")}</p>}</div>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button type="submit" disabled={busy} className="min-h-12 text-base">{t(mode === "signup" ? "account.signUpAction" : mode === "forgot" ? "account.sendReset" : "account.signInAction")}</Button>
      </form>}
      {mode === "signin" && !notice && <Button variant="link" className="mt-2 min-h-11 px-0" onClick={() => { setMode("forgot"); setError(""); }}>{t("account.forgot")}</Button>}
      {(mode === "forgot" || notice) && <Button variant="link" className="mt-2 min-h-11 px-0" onClick={() => { setMode("signin"); setNotice(""); setError(""); }}>{t("account.backToSignIn")}</Button>}
    </main>
  </>;
}
