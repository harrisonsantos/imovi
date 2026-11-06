# Web Imovi

Next.js App Router em Cloudflare Pages. Instruções no [README principal](../../README.md) e no [runbook](../../docs/deploy-runbook.md).

```sh
pnpm --filter @imovi/web dev
pnpm --filter @imovi/web test
pnpm --filter @imovi/web build:cf
```

Configure `apps/web/.env.local` a partir de `.env.example`. Produção/preview exigem bindings de banco, auth, e-mail e Turnstile. O estimador salva uma heurística identificada; ONNX está desativado neste runtime.
