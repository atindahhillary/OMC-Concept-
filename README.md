# Carbon Data Gap Observatory

A live-tracked registry of the data gaps in Africa and Kenya's carbon markets, benchmarked against the [One Mara Carbon Project](https://onemaracarbon.org/) (OMCP) — a real soil-carbon and grazing-management project across Maasai Mara conservancies.

**Live site:** https://carbon-data-gap-observatory.vercel.app

## What this is

OMCP publishes real removal, area, and livelihood figures for its own project — more public disclosure than most carbon projects on the continent offer. This site uses that as a benchmark and tracks, with sources, the structural data gaps still standing between Africa's carbon markets and a trustworthy, comparable, continuously verifiable market:

- Registry fragmentation across Verra, Gold Standard, ACR, Puro, and new national registries (including Kenya's own National Carbon Registry, live but only ~70% integrated as of this review)
- Thin local MRV/verification (VVB) capacity, and a lack of direct field GHG-flux studies for restored rangeland in Kenya/East Africa
- No public price-discovery mechanism for African-origin credits
- Wide, undisclosed variance in community benefit-sharing percentages
- Poor digitisation of customary/communal land tenure against carbon rights
- Market-size figures built on models rather than disclosed transaction-level data
- No standardised co-benefit / SDG reporting format across standards

Every curated entry cites a named, dated, public source — see the Methodology section on the site itself.

## How it works

- Static frontend (`index.html`, `css/`, `js/`) — no build step, deployable as-is.
- Data layer is a real [Supabase](https://supabase.com) Postgres project:
  - `data_gaps` — the curated, research-backed registry, publicly readable, only writable via the Supabase dashboard/SQL (not from the browser).
  - `gap_submissions` — public can read and insert; this is the "community signals" board, unmoderated on write and clearly labelled `pending_review`.
- Row-level security is enabled on both tables; the anon key embedded in `js/config.js` is the public Supabase anon key, safe to expose by design (RLS is what enforces access, not key secrecy).

## Local development

```bash
npx serve .
```

Then open the printed local URL. No build step, no environment variables to set locally — the Supabase URL and anon key are already in `js/config.js`.

## Updating the data gap registry

Curated entries live in the `data_gaps` table in the `carbon-data-observatory` Supabase project. Update severity/status there as public information changes (e.g. as Kenya's National Carbon Registry moves from "improving" toward "resolved").

## Disclaimer

Independent research prototype. Not affiliated with, endorsed by, or reviewed by OMCP, MMWCA, Conservation International, or Ahueni. Figures attributed to onemaracarbon.org reflect what was publicly published on that site at time of review; verify against the live site before relying on them.
