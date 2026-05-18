# imovi — Design Implementation Task

## Context
This handoff package contains production-ready TypeScript components ported from a complete visual design.
The design uses React with inline styles + design tokens. The existing API logic is preserved.

## What to do

Copy every file in this `handoff/` folder into `apps/web/` at the matching path, then run:

```bash
cd apps/web
pnpm typecheck
pnpm build
```

No new npm dependencies are required. All fonts use `next/font/google` (built into Next.js).

---

## File map

| This handoff file | Destination in apps/web |
|---|---|
| `src/lib/tokens.ts` | `src/lib/tokens.ts` |
| `src/app/globals.css` | `src/app/globals.css` |
| `src/app/layout.tsx` | `src/app/layout.tsx` ← **replace** |
| `src/app/page.tsx` | `src/app/page.tsx` ← **replace** |
| `src/components/*.tsx` | `src/components/*.tsx` ← **new folder** |
| `src/app/metodologia/page.tsx` | `src/app/metodologia/page.tsx` ← new route |
| `src/app/precos/page.tsx` | `src/app/precos/page.tsx` ← new route |
| `src/app/resultados/page.tsx` | `src/app/resultados/page.tsx` ← new route |
| `src/app/dashboard/page.tsx` | `src/app/dashboard/page.tsx` ← new route |

---

## Important notes

### EstimateForm
`src/components/EstimateForm.tsx` is a **merge** of:
- The real API logic from the original `estimate-form.tsx` (neighborhoods fetch, /api/estimate POST, Turnstile)
- The new visual design (dark theme, split layout with result panel on the right)

Do NOT keep the old `estimate-form.tsx` — this file replaces it entirely.

### 'use client' components
These components use browser APIs (scroll, IntersectionObserver, useState):
- Nav.tsx, Hero.tsx, EstimateForm.tsx, DataViz.tsx, FAQ.tsx

Server components (no directive needed):
- Logo.tsx, HowItWorks.tsx, Footer.tsx

### Internal links
All `<a href="...">` tags have been converted to Next.js `<Link href="...">` from `next/link`.

### Fonts
`layout.tsx` uses `next/font/google` — remove any `<link>` to Google Fonts CDN if present.

### Resultados page
Currently uses representative mock data. Wire it to real estimate data by:
1. Storing the estimate result in a server-side session or URL search params after form submission
2. Reading those params in `app/resultados/page.tsx`
The component structure and visual are complete — only the data source needs wiring.

---

## After copying

1. `pnpm typecheck` — should pass with 0 errors
2. `pnpm dev` — check all 5 routes: `/`, `/metodologia`, `/precos`, `/resultados`, `/dashboard`
3. `pnpm build` — confirm edge runtime compatibility
