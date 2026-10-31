import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { KeyRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/features/arrival/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Flywell — New password" },
      { name: "description", content: "Choose a new password for your Flywell account." },
      { property: "og:title", content: "Flywell — New password" },
      { property: "og:description", content: "Reset the password of your Flywell account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [ready, setReady] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const recovery = window.location.hash.includes("type=recovery");
    const { data } = supabase.auth.onAuthStateChange((event) => { if (event === "PASSWORD_RECOVERY") setReady(true); });
    void supabase.auth.getSession().then(({ data }) => setReady((r) => r ?? (recovery || Boolean(data.session))));
    return () => data.subscription.unsubscribe();
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) { setError(t("account.weakPassword")); return; }
    void navigate({ to: "/account", replace: true });
  }

  return <>
    <AppHeader />
    <main className="arrival-main mx-auto w-full max-w-md px-5 pt-9 pb-[max(3rem,env(safe-area-inset-bottom))]">
      <p className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase text-primary"><KeyRound className="size-4" />{t("account.account")}</p>
      <h1 className="font-display text-4xl">{t("account.newPasswordTitle")}</h1>
      {ready === false && <p role="alert" className="mt-5 text-sm text-destructive">{t("account.resetInvalid")}</p>}
      {ready && <form onSubmit={submit} className="mt-6 grid gap-4">
        <div className="grid gap-1.5"><Label htmlFor="new-password">{t("account.newPassword")}</Label><Input id="new-password" className="h-12" type="password" required minLength={8} maxLength={72} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} /><p className="text-xs text-muted-foreground">{t("account.passwordHint")}</p></div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button type="submit" disabled={busy} className="min-h-12 text-base">{t("account.savePassword")}</Button>
      </form>}
    </main>
  </>;
}
