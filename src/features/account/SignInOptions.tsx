import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { AFTER_LOGIN_KEY, isAppleMobile, providerOrder, safeRedirect, type Provider } from "./device";

function AppleLogo() {
  return <svg viewBox="0 0 17 20" aria-hidden className="size-5 fill-current"><path d="M14.1 10.6c0-2.6 2.1-3.8 2.2-3.9-1.2-1.8-3.1-2-3.7-2-1.6-.2-3.1.9-3.9.9-.8 0-2-.9-3.4-.9-1.7 0-3.3 1-4.2 2.6-1.8 3.1-.5 7.7 1.3 10.2.9 1.2 1.9 2.6 3.2 2.6 1.3-.1 1.8-.8 3.3-.8 1.6 0 2 .8 3.4.8 1.4 0 2.3-1.3 3.1-2.5 1-1.4 1.4-2.8 1.4-2.9 0 0-2.7-1-2.7-4.1ZM11.6 3c.7-.9 1.2-2 1-3.2-1 0-2.3.7-3 1.6-.7.8-1.2 2-1.1 3.1 1.2.1 2.3-.6 3.1-1.5Z"/></svg>;
}
function GoogleLogo() {
  return <svg viewBox="0 0 24 24" aria-hidden className="size-5 fill-current"><path d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.9h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.4Z"/><path d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22Z" opacity=".75"/><path d="M6.4 14c-.2-.6-.3-1.3-.3-2s.1-1.4.3-2V7.4H3.1a10 10 0 0 0 0 9.2L6.4 14Z" opacity=".55"/><path d="M12 6c1.5 0 2.8.5 3.8 1.5l2.9-2.9A10 10 0 0 0 3.1 7.4L6.4 10C7.2 7.7 9.4 6 12 6Z" opacity=".9"/></svg>;
}

/** Apple, Google and Lovable buttons. On iPhone/iPad, Apple ID is shown first and highlighted. */
export function SocialButtons({ returnTo, onError }: { returnTo: string; onError: () => void }) {
  const { t } = useTranslation();
  const [apple, setApple] = useState(false);
  const [busy, setBusy] = useState<Provider | null>(null);
  useEffect(() => setApple(isAppleMobile(navigator.userAgent, navigator.maxTouchPoints)), []);

  async function signIn(provider: Provider) {
    setBusy(provider);
    sessionStorage.setItem(AFTER_LOGIN_KEY, safeRedirect(returnTo));
    const result = await lovable.auth.signInWithOAuth(provider, { redirect_uri: window.location.origin });
    if (result.redirected) return;
    setBusy(null);
    if (result.error) { sessionStorage.removeItem(AFTER_LOGIN_KEY); onError(); }
  }

  return <div className="grid gap-2">
    {providerOrder(apple).map((p, i) => {
      const lead = i === 0;
      const label = p === "apple" ? t("account.apple") : p === "google" ? t("account.google") : t("account.lovable");
      return <Button key={p} type="button" variant={lead ? "default" : "outline"} disabled={busy !== null}
        className={`min-h-12 w-full justify-center gap-3 text-base ${p === "apple" && lead ? "bg-foreground text-background hover:bg-foreground/90" : ""} ${p === "lovable" ? "lovable-auth-button" : ""}`}
        onClick={() => void signIn(p)}>
        {p === "apple" ? <AppleLogo /> : p === "google" ? <GoogleLogo /> : null}
        {label}
        {p === "apple" && apple && <span className="sr-only"> · {t("account.appleHint")}</span>}
      </Button>;
    })}
  </div>;
}
