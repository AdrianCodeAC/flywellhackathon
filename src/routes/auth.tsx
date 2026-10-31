import { createFileRoute } from "@tanstack/react-router";
import { AuthPage } from "@/features/account/AuthPage";

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): { redirect?: string } =>
    typeof search["redirect"] === "string" ? { redirect: search["redirect"] } : {},
  head: () => ({
    meta: [
      { title: "Flywell — Sign in" },
      { name: "description", content: "Sign in to Flywell to keep your trips, checklists and trip chat on every device." },
      { property: "og:title", content: "Flywell — Sign in" },
      { property: "og:description", content: "Your Flywell account: saved trips, checklists and trip chat." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthRoute,
});

function AuthRoute() {
  return <AuthPage redirect={Route.useSearch().redirect ?? "/account"} />;
}
