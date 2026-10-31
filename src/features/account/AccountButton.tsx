import { useTranslation } from "react-i18next";
import { Link, useLocation } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { LogIn } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuthReady, useTripUser } from "@/features/trip/auth";
import { loadProfile, profileQueryKey } from "./saved";

export function initials(name: string | null | undefined, email: string | null | undefined) {
  const source = (name || email || "?").trim();
  const parts = source.split(/[\s@._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "")).toUpperCase();
}

/** Header control: "Sign in" when signed out, the user's photo (links to the account) when signed in. */
export function AccountButton() {
  const { t } = useTranslation();
  const user = useTripUser();
  const ready = useAuthReady();
  const location = useLocation();
  const profile = useQuery({ queryKey: profileQueryKey(user?.id ?? ""), queryFn: () => loadProfile(user!.id), enabled: Boolean(user), staleTime: 30 * 60_000 });

  if (!ready) return <span className="size-11" aria-hidden />;
  if (!user) {
    if (location.pathname === "/auth") return null;
    return <Button asChild variant="outline" className="min-h-11 rounded-full px-3">
      <Link to="/auth" search={{ redirect: location.href.startsWith("/auth") ? "/account" : location.href }}><LogIn className="size-4" /><span className="hidden min-[400px]:inline">{t("account.signIn")}</span><span className="sr-only min-[400px]:hidden">{t("account.signIn")}</span></Link>
    </Button>;
  }
  const name = profile.data?.display_name;
  return <Link to="/account" aria-label={t("account.account")} className="flex size-11 items-center justify-center rounded-full ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
    <Avatar className="size-10 border-2 border-primary">
      {profile.data?.photo && <AvatarImage src={profile.data.photo} alt="" referrerPolicy="no-referrer" />}
      <AvatarFallback className="bg-primary text-sm font-semibold text-primary-foreground">{initials(name, user.email)}</AvatarFallback>
    </Avatar>
  </Link>;
}
