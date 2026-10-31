import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { Link, useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { SocialButtons } from "@/features/account/SignInOptions";
import { AFTER_LOGIN_KEY, safeRedirect } from "@/features/account/device";
import "@lovable.dev/cloud-auth-js/styles.css";

const AuthContext = createContext<User | null>(null);
const ReadyContext = createContext(false);

/** The single app-wide session listener: keeps the user in context and refreshes routes/queries on identity changes. */
export function TripAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const router = useRouter();
  const queryClient = useQueryClient();
  useEffect(() => {
    let changed = false, active = true;
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (["INITIAL_SESSION", "SIGNED_IN", "SIGNED_OUT", "USER_UPDATED"].includes(event)) {
        changed = true;
        setUser(session?.user ?? null);
        setReady(true);
      }
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      void router.invalidate();
      if (event !== "SIGNED_OUT") void queryClient.invalidateQueries();
      if (event === "SIGNED_IN") {
        // After a full-page OAuth round trip the browser lands on "/"; continue where the user left off.
        const target = sessionStorage.getItem(AFTER_LOGIN_KEY);
        if (target) {
          sessionStorage.removeItem(AFTER_LOGIN_KEY);
          const path = safeRedirect(target);
          if (path !== window.location.pathname + window.location.search) router.history.push(path);
        }
      }
    });
    void supabase.auth.getUser().then(({ data }) => {
      if (active && !changed) { setUser(data.user); setReady(true); }
    });
    return () => { active = false; data.subscription.unsubscribe(); };
  }, [router, queryClient]);
  return <ReadyContext.Provider value={ready}><AuthContext.Provider value={user}>{children}</AuthContext.Provider></ReadyContext.Provider>;
}
export const useTripUser = () => useContext(AuthContext);
export const useAuthReady = () => useContext(ReadyContext);

/** Inline sign-in used inside the trip chat. */
export function TripSignIn() {
  const { t } = useTranslation();
  const user = useTripUser();
  const [error, setError] = useState("");
  if (user) return <div className="flex flex-wrap items-center gap-2"><span className="text-sm text-muted-foreground">{t("trip.accountSaved")}</span><Button variant="ghost" className="min-h-11" onClick={() => void supabase.auth.signOut()}>{t("trip.signOut")}</Button></div>;
  return <div className="space-y-2">
    <SocialButtons returnTo="/" onError={() => setError(t("trip.authError"))} />
    <Button asChild variant="link" className="min-h-11 px-0"><Link to="/auth" search={{ redirect: "/" }}>{t("account.moreOptions")}</Link></Button>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </div>;
}
