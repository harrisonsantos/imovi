# imovi

AVM (Automated Valuation Model) para imóveis no Brasil — uma "FIPE de imóveis" que ajuda corretores a estimar o valor venal de mercado.

## Stack

- **Monorepo**: pnpm workspaces + Turborepo
- **Deploy**: Cloudflare Pages (frontend) + Workers (API) — permite uso comercial no free tier
- **Banco**: Neon Postgres (com pgvector, branching)
- **Storage ML**: Cloudflare R2 (artefatos ONNX)
- **Core**: TypeScript (Next.js, scrapers, normalizer, enrichment, api)
- **ML**: Python (treino isolado em `ml-training/`) → ONNX (inferência em Node)
- **Scrapers**: GitHub Actions cron

## Estrutura (alvo)

```
imovi/
├── apps/
│   ├── web/               # Next.js (Cloudflare Pages)
│   └── worker/            # CLI de jobs (GitHub Actions)
├── packages/
│   ├── shared/            # tipos + zod schemas
│   ├── scrapers/          # Zap, OLX, VivaReal
│   ├── normalizer/        # RawListing → NormalizedListing, dedupe
│   ├── enrichment/        # IPTU (InfoSimples, GeoSampa)
│   ├── db/                # Neon client + migrations + repositórios
│   ├── ml-infer/          # ONNX Runtime Node
│   └── config/            # tsconfig, eslint, vitest presets
├── ml-training/           # Python — scikit/LightGBM, export ONNX
└── .github/workflows/     # CI + scrape crons
```

## Metodologia

TDD estrito por módulo. Testes primeiro, implementação depois.

## Setup

```bash
pnpm install
pnpm test
pnpm typecheck
```

## Status

Em construção — Fase 0 (scaffold) concluída. Ver `docs/architecture.md` e o plano vigente.
