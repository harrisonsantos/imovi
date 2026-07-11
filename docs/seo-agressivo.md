# Revisão e estratégia de SEO agressivo — imovi

Data: 11/07/2026

## Diagnóstico executivo

O domínio tem um produto com forte potencial orgânico, porque responde a intenções de busca recorrentes e locais: “quanto vale meu imóvel”, “preço do m²”, “valor de apartamento em [bairro]” e “avaliação de imóvel em [cidade]”. Antes desta revisão, porém, quase todo esse potencial estava invisível para o Google.

Problemas confirmados na versão pública:

- `/precos`, `/metodologia`, `/dashboard` e `/resultados` herdavam título, descrição e canonical da home;
- todas essas páginas declaravam `https://imovi.app.br/` como canonical;
- o sitemap público continha somente a home;
- dashboard e resultado demonstrativo estavam liberados para indexação;
- não havia páginas de cidade/bairro, dados estruturados, manifest ou imagem Open Graph;
- respostas HTML eram dinâmicas no Cloudflare e não apresentavam uma estratégia explícita de cache;
- o menu apontava para um dashboard fictício em vez de fortalecer páginas públicas relevantes.

O canonical incorreto era o defeito mais grave: o site pedia ao buscador que consolidasse os sinais de todas as páginas na home. O Google considera canonical, redirects e sitemap sinais que podem se reforçar; eles precisam apontar para a mesma URL preferida.

## Correções técnicas implementadas

- `metadataBase`, títulos com template e descrições específicas por rota;
- canonical próprio e consistente com URLs finais que usam trailing slash;
- `noindex` por metadata e `X-Robots-Tag` para dashboard, resultados, auditoria e APIs;
- `robots.txt` concentrando crawl somente em conteúdo público;
- sitemap dinâmico com páginas estáticas, cidades e bairros elegíveis;
- `lastmod` baseado na atualização real dos dados de bairro;
- Open Graph gerado pelo Next.js e Twitter Card;
- JSON-LD de Organization, WebSite, WebApplication, WebPage e BreadcrumbList;
- manifest web e suporte a verificação do Google Search Console por ambiente;
- hub `/valor-imovel/`, páginas de cidade e páginas de bairro;
- links internos no menu e rodapé para o cluster de preço por m²;
- exclusão de bairros com menos de 10 anúncios ou sem mediana válida;
- tamanho da amostra derivado das listagens ativas, pois o campo agregado `listing_count` estava zerado em todo o catálogo;
- conteúdo local com amostra, data, exemplos de área, limitações e bairros comparáveis.

## Arquitetura de palavras-chave

### Cluster 1 — avaliação imediata

Intenção transacional e topo da conversão:

- quanto vale meu imóvel;
- calcular valor de imóvel;
- avaliação de imóvel online grátis;
- simulador de valor de apartamento;
- valor de mercado do imóvel;
- preço do meu apartamento.

Página principal: `/`. O formulário precisa continuar visível acima da dobra e entregar o resultado real antes de qualquer anúncio.

### Cluster 2 — preço local e SEO programático

Intenção informacional com alta proximidade de decisão:

- preço do m² em [cidade];
- preço do m² em [bairro];
- quanto custa um apartamento em [bairro];
- valor de imóvel em [bairro], [cidade];
- bairros mais caros de [cidade];
- onde comprar imóvel em [cidade].

Arquitetura:

```text
/valor-imovel/
├── curitiba-pr/
│   ├── agua-verde/
│   ├── batel/
│   └── ...
├── belo-horizonte-mg/
├── florianopolis-sc/
└── porto-alegre-rs/
```

Cada página deve oferecer valor próprio. Não publicar combinações de URL sem dados suficientes, nem preencher bairros com textos genéricos trocando apenas o nome. O Google classifica geração em escala sem valor original como abuso de conteúdo.

### Cluster 3 — educação e autoridade

Conteúdo editorial a criar:

1. Como calcular o valor de um imóvel sem errar;
2. Preço anunciado versus preço de venda: qual a diferença;
3. O que mais valoriza ou desvaloriza um apartamento;
4. Como comparar imóveis pelo preço do m²;
5. O que significa intervalo de confiança em uma avaliação;
6. Avaliação automática versus laudo de engenheiro;
7. Como documentação, matrícula e IPTU afetam o valor;
8. Guia trimestral do mercado de cada cidade coberta.

Cada artigo deve ligar para a calculadora, metodologia, cidade e bairros relacionados. Páginas locais devem ligar de volta para os guias relevantes.

### Cluster 4 — B2B e auditoria imobiliária

Landing pages separadas do produto B2C:

- auditoria de vendas para imobiliária;
- auditoria de CRM imobiliário;
- como identificar negócio imobiliário fora do CRM;
- controle de leads para imobiliária;
- conferência de comissão de corretores;
- integração Vista CRM para auditoria.

Não indexar o dashboard autenticado. Criar páginas comerciais públicas com exemplos anonimizados, fluxo, integrações, FAQ e CTA de trial.

## Critérios de publicação programática

O limite técnico inicial é 10 anúncios válidos, mas a meta editorial deve ser 30 ou mais. Uma página de bairro só deve entrar no sitemap quando possuir:

- mediana positiva e data de atualização;
- amostra mínima;
- explicação do que a mediana representa;
- exemplos calculados por área;
- pelo menos três links internos contextuais;
- comparação com bairros semelhantes;
- nenhuma afirmação de preço de venda quando a origem são anúncios.

Se os dados ficarem antigos, a página deve mostrar a data claramente. Se a cobertura cair abaixo do limite por período prolongado, remover do sitemap e aplicar `noindex` ou retornar 404 até a recuperação.

## Plano de conteúdo de 90 dias

### Semanas 1–2

- publicar e validar a nova fundação técnica;
- cadastrar domínio no Search Console e Bing Webmaster Tools;
- enviar sitemap e inspecionar home, hub, uma cidade e três bairros;
- corrigir o relatório fictício e retirar qualquer dado demonstrativo não rotulado;
- medir LCP, INP e CLS em mobile.

### Semanas 3–6

- publicar os seis guias fundamentais do Cluster 3;
- criar uma landing pública completa para Auditoria;
- adicionar links editoriais de cidade para guias e vice-versa;
- publicar uma página de metodologia dos dados locais, fontes, atualização e amostra.

### Semanas 7–12

- lançar relatórios mensais ou trimestrais por cidade com dados próprios;
- criar comparativos originais: maiores altas, dispersão de preço e bairros com maior amostra;
- distribuir os estudos para imprensa local, portais imobiliários, corretores e associações;
- oferecer widgets ou gráficos incorporáveis com atribuição de marca, sem exigir âncoras manipulativas;
- expandir somente cidades que já tenham cobertura suficiente.

## Aquisição de links

Priorizar ativos que mereçam citação:

- índice de preço por m² por cidade;
- relatório trimestral em HTML e CSV agregado;
- mapas e gráficos de variação entre bairros;
- estudo sobre diferença entre preço anunciado e estimado;
- ferramenta gratuita para corretores incorporarem em conteúdos próprios;
- entrevistas e dados exclusivos para imprensa local.

Evitar compra de links em massa, guest posts genéricos, PBNs e diretórios sem audiência. O crescimento agressivo deve vir da velocidade de produção de dados úteis e distribuição, não de sinais artificiais.

## Core Web Vitals e rastreamento

Metas de campo no percentil 75 mobile:

- LCP até 2,5 s;
- INP até 200 ms;
- CLS até 0,1.

O site atual marca páginas públicas com runtime Edge, o que impede geração estática no build e mantém o HTML dinâmico. Medir TTFB real por região e, depois de validar compatibilidade do Cloudflare, migrar conteúdo editorial estável para prerender/ISR ou cache HTML no edge.

Anúncios devem manter altura reservada e nunca aparecer antes do resultado principal. Acompanhar queda de conversão junto com receita por mil sessões.

## Métricas semanais

- páginas válidas indexadas versus enviadas no sitemap;
- impressões e posição por cluster, cidade e bairro;
- CTR por template de title/description;
- páginas rastreadas sem indexação e canonical escolhido pelo Google;
- crescimento de cliques não relacionados à marca;
- estimativas iniciadas e concluídas por landing page;
- cadastro, trial e receita originados do orgânico;
- Core Web Vitals por tipo de página;
- backlinks novos para ativos de dados.

## Requisitos operacionais após deploy

1. Configurar `GOOGLE_SITE_VERIFICATION` no Cloudflare.
2. Publicar e confirmar `/robots.txt`, `/sitemap.xml` e headers `X-Robots-Tag`.
3. Adicionar `https://imovi.app.br/sitemap.xml` no Search Console.
4. Usar Inspeção de URL para comparar canonical declarado e escolhido pelo Google.
5. Validar JSON-LD no Rich Results Test e no Schema Markup Validator.
6. Não liberar milhares de URLs de uma vez: começar com bairros de maior amostra, observar indexação e ampliar por lotes.

## Fontes de referência

- Google SEO Starter Guide: https://developers.google.com/search/docs/fundamentals/seo-starter-guide
- Canonicalização: https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls
- Políticas contra conteúdo em escala sem valor: https://developers.google.com/search/docs/essentials/spam-policies?hl=pt-br
- Sitemaps: https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview
- Metadata e OG no Next.js: https://nextjs.org/docs/app/getting-started/metadata-and-og-images
