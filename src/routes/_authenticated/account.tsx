import { createFileRoute } from "@tanstack/react-router";
import { AccountPage } from "@/features/account/AccountPage";

export const Route = createFileRoute("/_authenticated/account")({
  head: () => ({
    meta: [
      { title: "Flywell — Your account" },
      { name: "description", content: "Your profile, saved trips, before-you-fly checklists and trip chat." },
      { property: "og:title", content: "Flywell — Your account" },
      { property: "og:description", content: "Saved trips, checklists and trip chat in your Flywell account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AccountPage,
});
