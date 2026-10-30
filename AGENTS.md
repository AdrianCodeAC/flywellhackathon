<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Rules
- Arrival Assistant lives in src/features/arrival (types, single services.ts for all external APIs, components); route is src/routes/arrival.tsx. Why: spec requires one reusable service layer.
- Airport dataset is a compact static file at public/data/airports.json ([iata,name,city,countryISO,lat,lon]), fetched lazily. Why: keeps the JS bundle small while staying keyless/offline-friendly.
