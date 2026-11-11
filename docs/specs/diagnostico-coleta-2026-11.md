# Diagnóstico da Coleta Parada (06/2026 → 11/2026) — Zap, VivaReal e OLX

- **Data do diagnóstico:** `2026-11-11`
- **Escopo:** Curitiba/PR (`zap`, `vivareal`, `olx`)
- **User-Agent testado:** `ImoviBR-Bot/1.0 (+https://imovi.app.br/bot)` (`packages/scrapers/src/core/scraper-setup.ts:15`)
- **Impacto acumulado:**
  - Última coleta persistida em produção: `11/06/2026` (`2.388` listings, `2.230` properties).
  - Medianas por bairro degradadas para fallback: a agregação em `packages/db/src/repositories/neighborhoods.ts:28` filtra `l.scraped_at >= NOW() - INTERVAL '90 days'`.
  - Retreino semanal de ML bloqueado: `.github/workflows/retrain.yml:45` exige `scraped_at >= NOW() - INTERVAL '14 days'`.

---

## 1. Resumo Executivo das Causas-Raiz

A interrupção total da coleta decorre da combinação de **três camadas de falha** somadas a uma **cegueira diagnóstica** no pipeline:

1. **Bloqueio WAF na borda (Cloudflare HTTP 403 Forbidden):**
   - Os três portais (Grupo OLX) operam atrás da Cloudflare (`server: cloudflare`). Requisições originadas do `Fetcher` padrão (Node `fetch`/undici sem proxy residencial ou cookies de desafio `__cf_bm` / `_cfuvid`) com `User-Agent: ImoviBR-Bot/1.0 (+https://imovi.app.br/bot)` recebem majoritariamente **HTTP 403** (`<title>Attention Required! | Cloudflare</title>`) tanto nas URLs de busca quanto em `/robots.txt`.
   - Como `Fetcher.get` (`packages/scrapers/src/core/fetcher.ts:51`) só repete em `429` e `503`, o `403` encerra imediatamente o generator.
2. **Quebra de contrato de schema/HTML mesmo quando o WAF permite passagem (HTTP 200):**
   - **Zap e VivaReal:** ambos continuam emitindo `<script type="application/ld+json">` com `@type: "ItemList"` (30 itens por página), porém **100% dos itens tiveram `@type` alterado para `"Product"`**, movendo o tipo imobiliário para `"additionalType"` (`"https://schema.org/Apartment"`, `"https://schema.org/Place"`, `"https://schema.org/House"`, `"https://schema.org/Landform"`). Os parsers `mapZapType(item['@type'])` (`packages/scrapers/src/zap/parser.ts:105`) e `mapVivaRealType(item['@type'])` (`packages/scrapers/src/vivareal/parser.ts:100`) retornam `propertyType: null` para todos os 30 itens, fazendo `normalize(raw)` (`packages/normalizer/src/normalize.ts:30`) rejeitar **100% dos anúncios** (`normalização requer propertyType: RawListing.propertyType é null`).
   - **VivaReal (endereço/bairro):** no JSON-LD do VivaReal, `item.name` passou a vir truncado logo após a preposição `"em"` (ex.: `"Casa à venda com 3 quartos, ... em"`), sem `{bairro}, Curitiba`, fazendo `extractNeighborhoodFromName` retornar `undefined`.
   - **OLX (rota + migração para Next.js App Router / RSC):**
     - A rota configurada para Curitiba (`/imoveis/venda/estado-pr/cidade-curitiba?o=1`, `location: 'pr/cidade-curitiba'` em `apps/worker/src/commands/scrape.ts:67`) responde **HTTP 308 Permanent Redirect** para `Location: /imoveis/venda?o=1` (listagem nacional sem filtro de cidade/UF). A rota canônica atual da OLX para Curitiba é `/imoveis/venda/estado-pr/curitiba?o=1` (`location: 'pr/curitiba'`).
     - O HTML 200 da OLX **não contém mais `<script id="__NEXT_DATA__">`**; o portal migrou para **Next.js App Router (React Server Components)**, serializando o array `"ads":[...]` dentro de chunks `self.__next_f.push([1, "..."])`. Como `parseOlxListingPage` (`packages/scrapers/src/olx/parser.ts:57`) busca apenas `<script id="__NEXT_DATA__">`, ele retorna sempre `0` itens (`parser_zero_items`).
3. **Descarte silencioso de telemetria diagnóstica (resolvido nesta entrega):**
   - Em `packages/scrapers/src/{zap,vivareal,olx}/index.ts`, `!policy.isAllowed(...)`, `!res.ok` e `listings.length === 0` executavam apenas `return;`, descartando `url` e `res.status`.
   - Em `apps/worker/src/pipeline/run-scrape.ts:117` e `apps/worker/src/commands/scrape.ts:122`, a tabela `scrape_errors` recebia somente `error = 'scraper_empty_result'` com `url = NULL`.

---

## 2. Evidências Empíricas por Portal (`2026-11-11`)

### 2.1. Regras atuais de `robots.txt` para `ImoviBR-Bot` e `*`

| Portal | Host | Status HTTP (`/robots.txt`) | Grupo `ImoviBR-Bot` | Regras relevantes em `User-agent: *` | Resultado em `parseRobotsTxt` (`packages/scrapers/src/core/robots.ts`) |
| --- | --- | --- | --- | --- | --- |
| **Zap** | `www.zapimoveis.com.br` | Intermitente: **HTTP 403** Cloudflare (4.577 B) / **HTTP 200** (6.850 B, 240 linhas) | Ausente (grupos: `*`, `Googlebot`, `PetalBot`) | Sem `Disallow` para `/venda/imoveis/` ou `/aluguel/imoveis/` ou `?pagina=`. Bloqueia `/Busca/`, `/*onde=*`, `/*transacao=*`, `*page=*`, `*per_page=*`. | `isAllowed(UA, '/venda/imoveis/pr+curitiba/') === true` (e `true` no fallback de 403) |
| **VivaReal** | `www.vivareal.com.br` | Intermitente: **HTTP 403** Cloudflare (4.550 B) / **HTTP 200** (2.960 B, 173 linhas) | Ausente (grupos: `*`, `PetalBot` e lista de crawlers legados com `Disallow: /` como `MJ12bot`, `HTTrack`, `wget`, `dotbot`) | `Allow: /`; `Disallow: /buy/`, `Disallow: /rent/`, `Disallow: *onde=*`, `Disallow: *tipos=*`, `Disallow: *transacao=*`. `/venda/parana/curitiba/` permitido. | `isAllowed(UA, '/venda/parana/curitiba/') === true` (e `true` no fallback de 403) |
| **OLX** | `www.olx.com.br` | Intermitente: **HTTP 403** Cloudflare (4.545 B) / **HTTP 200** (12.916 B, 636 linhas) | Ausente (apenas `User-agent: *`) | `Disallow: /*?*estado-*` (linha 8), `Disallow: /*?*o=*` (linhas 125 e 184), `Disallow: /*o=*` (linha 306), `Disallow: /search/`, `Disallow: /busca`. | `isAllowed(UA, '/imoveis/venda/estado-pr/cidade-curitiba') === true` no parser atual (que não avalia wildcards `*` nem query string `?o=1`), mas **desautorizado segundo RFC 9309 §2.2.3** quando `?o=1` está presente (`/*?*o=*`). |

---

### 2.2. Status HTTP e Headers de Bloqueio WAF / Anti-Bot

Testes realizados contra as três URLs de busca de Curitiba com `User-Agent: ImoviBR-Bot/1.0 (+https://imovi.app.br/bot)`:

| Portal | URL testada | Status HTTP observado | Headers WAF / CDN | Corpo / Assinatura de bloqueio |
| --- | --- | --- | --- | --- |
| **Zap** | `https://www.zapimoveis.com.br/venda/imoveis/pr+curitiba/?pagina=1` | **HTTP 403** (~80% das tentativas) / **HTTP 200** (~20%) | `server: cloudflare`, `cf-ray: *-GRU`, `server-timing: cfEdge;dur=1,cfOrigin;dur=0`, `set-cookie: __cf_bm=...` (`cf-mitigated: null`, `x-datadome: null`) | No 403 (5.691–6.052 B): `<title>Attention Required! \| Cloudflare</title>`, `<h1 data-translate="block_headline">Sorry, you have been blocked</h1>`. No 200 (1.393.122 B): `x-origin-gateway: proxy-zapimoveis`, `x-powered-by: Next.js`, `set-cookie: _cfuvid=...; z_user_id=...`. |
| **VivaReal** | `https://www.vivareal.com.br/venda/parana/curitiba/?pagina=1` | **HTTP 403** (~85% das tentativas) / **HTTP 200** (~15%) | `server: cloudflare`, `cf-ray: *-GIG`, `server-timing: cfEdge;dur=2,cfOrigin;dur=0`, `set-cookie: __cf_bm=...` (`cf-mitigated: null`, `x-datadome: null`) | No 403 (5.664–6.025 B): `<title>Attention Required! \| Cloudflare</title>`. No 200 (1.407.891 B): `x-powered-by: Next.js`, `set-cookie: z_user_id=...`. |
| **OLX** | `https://www.olx.com.br/imoveis/venda/estado-pr/cidade-curitiba?o=1` | **HTTP 403** (~90% das tentativas) / **HTTP 308** → `Location: /imoveis/venda?o=1` | `server: cloudflare`, `cf-ray: *-GRU`, `set-cookie: __cf_bm=...` (`cf-mitigated: null`, `x-datadome: null`) | No 403 (5.659–6.020 B): `<title>Attention Required! \| Cloudflare</title>`. Na rota canônica `/imoveis/venda/estado-pr/curitiba?o=1` em HTTP 200: 1.011.489 B (`<title>Imóveis à venda - Curitiba - PR \| OLX</title>`). |

---

### 2.3. Estrutura Atual do HTML Retornado (HTTP 200)

#### A. Zap Imóveis (`www.zapimoveis.com.br`)
- **Blocos `<script type="application/ld+json">`:** 6 blocos presentes no HTML SSR (`Organization`, `ItemList`, objeto vazio, `BreadcrumbList`, `FAQPage`, `RealEstateListing`).
- **Estrutura de `ItemList` (`Script[1]`, 30 itens):**
  ```json
  {
    "@type": "ListItem",
    "position": 1,
    "item": {
      "@type": "Product",
      "@id": "2825002459",
      "name": "Cobertura para comprar com 208 m², 3 quartos, 3 banheiros, 2 vagas em  Bigorrilho, Curitiba",
      "url": "https://www.zapimoveis.com.br/imovel/venda-cobertura-3-quartos-mobiliado-bigorrilho-curitiba-pr-208m2-id-2825002459/",
      "additionalType": "https://schema.org/Place",
      "address": {
        "@type": "PostalAddress",
        "streetAddress": "Rua Martim Afonso",
        "addressLocality": "Curitiba",
        "addressRegion": "PR"
      },
      "numberOfBedrooms": 3,
      "numberOfBathroomsTotal": 3,
      "floorSize": { "@type": "QuantitativeValue", "value": 208, "unitCode": "M2" },
      "offers": { "@type": "Offer", "price": 1490000, "priceCurrency": "BRL" }
    }
  }
  ```
- **Incompatibilidade com `parseZapListingPage` (`packages/scrapers/src/zap/parser.ts`):**
  - Todos os 30 itens possuem `"@type": "Product"` e `"additionalType"` no conjunto `{"https://schema.org/Apartment", "https://schema.org/Place", "https://schema.org/House", "https://schema.org/Landform"}`.
  - `mapZapType(item['@type'])` avalia apenas `"Product"` e retorna `null`, causando rejeição de 100% dos itens em `normalize(raw)`.
- **Seletores CSS / DOM SSR disponíveis como fallback:**
  - Cards com `data-cy="rp-property-cd"`, `data-cy="rp-cardProperty-price-txt"`, `data-cy="rp-cardProperty-propertyArea-txt"`, `data-cy="rp-cardProperty-bedroomQuantity-txt"`, `data-cy="rp-cardProperty-bathroomQuantity-txt"`, `data-cy="rp-cardProperty-parkingSpacesQuantity-txt"`, `data-cy="rp-cardProperty-location-txt"` e `data-cy="rp-cardProperty-street-txt"`.

#### B. VivaReal (`www.vivareal.com.br`)
- **Blocos `<script type="application/ld+json">`:** 6 blocos idênticos à plataforma unificada do Zap (`Script[1]` é `ItemList` com 30 itens).
- **Incompatibilidades com `parseVivaRealListingPage` (`packages/scrapers/src/vivareal/parser.ts`):**
  1. `"@type"` também passou a ser `"Product"` em 100% dos 30 itens, com o tipo real em `"additionalType"` (`"https://schema.org/House"`, `"https://schema.org/Apartment"`, `"https://schema.org/Place"`, `"https://schema.org/Landform"`). `mapVivaRealType(item['@type'])` retorna `null` em todos os itens.
  2. `item.name` vem truncado em `"em"` sem o bairro/cidade (ex.: `"Casa à venda com 3 quartos, 3 suítes, 4 banheiros, 2 vagas na garagem e condomínio com piscina e churrasqueira em"`), impedindo `extractNeighborhoodFromName(item.name, city)` de extrair o bairro a partir do título (embora o bairro conste na URL do imóvel e em `data-cy="rp-cardProperty-location-txt"`).
- **Seletores CSS / DOM SSR:** mesma árvore `data-cy="rp-property-cd"` e `data-cy="rp-cardProperty-*"` do Zap.

#### C. OLX (`www.olx.com.br`)
- **Ausência de `<script id="__NEXT_DATA__">`:** `false` em todas as páginas 200 inspecionadas.
- **Presença de RSC (`self.__next_f.push`):** `true`. Os dados de listagem estão embutidos no payload Flight do Next.js App Router (`self.__next_f.push([1, "..."])`) sob a chave serializada `"ads":[{"subject":...,"priceValue":...,"listId":...,"friendlyUrl":...,"location":...,"categoryName":...,"properties":[{"name":"category","value":"Casas"},{"name":"real_estate_type","value":"Venda - casa..."},{"name":"size","value":"80m²"},{"name":"rooms","value":"3"},{"name":"bathrooms","value":"2"}]}]`.
- **Seletores DOM observados:** `data-testid="adcard-link"`, `data-testid="ad-card-online"`, `data-testid="adcard-price-info"`, `data-ds-component="AdBadge"`.

---

## 3. Telemetria Diagnóstica Implementada nesta Entrega

Para eliminar os erros opacos `scraper_empty_result` com `url = NULL` em `scrape_errors`:

1. **`packages/scrapers/src/core/types.ts` e `packages/scrapers/src/{zap,vivareal,olx}/index.ts`:**
   - Introduzido `ScrapeDiagnosticError` (com `reason: 'robots_disallowed' | 'http_status_<code>' | 'parser_zero_items'`, `url`, `page`, `status`) e callback opcional `onDiagnostic` em `ScrapeOptions`.
   - Quando a página 1 (`page === 1`) é bloqueada por `robots.txt`, recebe HTTP `!res.ok` (ex.: `http_status_403`, `http_status_429`) ou resulta em `0` itens no parser (`parser_zero_items`), o scraper emite o diagnóstico e lança `ScrapeDiagnosticError` preservando a `url` real tentada.
   - Em páginas subsequentes (`page > 1`), o fim da paginação emite o diagnóstico via `onDiagnostic` e encerra o generator sem descartar os itens já produzidos na página 1.
2. **`apps/worker/src/pipeline/run-scrape.ts` e `apps/worker/src/commands/scrape.ts`:**
   - `runScrape` captura `err.url` (ou o último diagnóstico de `ctx.onDiagnostic`) e repassa `{ source, message, url, at }` para `repos.errors.record`.
   - `scrapeErrorRepoAdapter` persiste `url: err.url ?? null` na coluna `scrape_errors.url`.

---

## 4. Plano de Recuperação da Coleta

### Fase 1 — Correção dos Parsers e Rotas (`packages/scrapers` + `apps/worker`)
1. **Zap e VivaReal (`packages/scrapers/src/{zap,vivareal}/parser.ts`):**
   - Atualizar `mapZapType` e `mapVivaRealType` para inspecionar `item.additionalType` (extraindo o sufixo após `schema.org/`, incluindo mapeamento de `Landform` → `'land'`) e usar fallback em `item.name` / `item.url` quando `item['@type'] === 'Product'`.
   - No VivaReal, quando `extractNeighborhoodFromName(item.name, city)` retornar `undefined`, extrair o bairro como fallback do slug da URL (`/imovel/{tipo}-{quartos}-{bairro}-bairros-{cidade}-.../`) ou do seletor `data-cy="rp-cardProperty-location-txt"`.
2. **OLX (`packages/scrapers/src/olx/parser.ts` + `apps/worker/src/commands/scrape.ts`):**
   - Em `parseOlxListingPage`, manter suporte a `<script id="__NEXT_DATA__">` e adicionar extração do array `"ads":[...]` a partir dos chunks RSC `self.__next_f.push(...)` (desescapando a string Flight e extraindo os objetos `OlxAd`).
   - Atualizar o location de Curitiba na OLX de `pr/cidade-curitiba` para `pr/curitiba` (ou consultar via API/sitemap sem depender de `?o=` caso restrito por `robots.txt`).

### Fase 2 — Mitigação de Bloqueio WAF Cloudflare (`packages/scrapers/src/core/fetcher.ts`)
1. **Proxy rotativo / Egress residencial ou Cloudflare Browser Rendering:**
   - Conectar o `ProxyRotator` já existente (`packages/scrapers/src/core/proxy-rotator.js`) ao transporte HTTP do `Fetcher` no worker, ou utilizar endpoint de rendering/egress autorizado que preserve sessão TLS/cookies (`__cf_bm`, `_cfuvid`).
2. **Cache e resiliência de `robots.txt`:**
   - Persistir ou cachear `robots.txt` por host e evitar que falhas 403 no cold-start consumam rate-limit antes da página 1.

### Fase 3 — Reprocessamento e Destravamento de Medianas e ML
1. Executar `pnpm --filter @imovi/worker tsx src/cli.ts scrape --source zap,vivareal,olx` após o deploy das correções da Fase 1/2.
2. Verificar em `scrape_errors` a ausência de `http_status_403` e `parser_zero_items`, confirmar `persisted > 0` em `listings`/`properties` e a atualização de `neighborhoods.last_aggregated_at`.
3. Disparar manualmente o workflow `.github/workflows/retrain.yml` (`workflow_dispatch`) assim que a janela de 14 dias acumular `>= 100` imóveis com preço e área válidos.
