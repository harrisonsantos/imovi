# Exclusão de conta por anonimização

Base: `harrisonsantos/conta-anonimizacao`, `3a21864`, alinhada com
`origin/harrisonsantos/integracao` após fetch. Escopo autorizado: implementação,
validação e commit local; sem deploy ou aplicação em banco externo.

## Contrato e verificadores

- Migration 0010 idempotente, variantes idênticas em LF e schema com
  `anonymizedAt`: teste existente `packages/db/tests/account-anonymization.test.ts`.
- Transação substitui cadastro, remove credenciais, sessões, vínculos, tokens e
  convites; preserva integralmente `terms_acceptances`; repetição é idempotente.
  Mesmo teste, preservado sem alterações.
- Único owner de qualquer organização `active` ou `past_due` com assinatura
  Stripe impede a operação inteira. Cobertura adicional para `past_due`, ausência
  de assinatura e rollback em falha durante a remoção.
- POST `/api/conta/excluir` exige origem confiável, sessão e confirmação literal
  `EXCLUIR`; retorna 400 para corpo inválido, 409 para owner impedido e 200 com
  a data persistida. Usuário inexistente retorna 401. Verificador:
  `apps/web/tests/account-anonymization.test.ts`.
- A rota usa conexão Neon WebSocket dedicada, compatível com transações de
  callback, encerrada também em caso de erro; demais rotas mantêm Neon HTTP.
- Política explica anonimização e preservação do aceite pelo prazo prescricional;
  versão `2026-11-11`, verificada por `apps/web/tests/terms-acceptance.test.ts`.

## Limites e conclusão

Não alterar manifests, lockfile ou `.github/`. Não reescrever o teste fornecido.
Executar `pnpm lint`, `pnpm typecheck`, `pnpm test` e revisar o diff antes do commit.
Até três tentativas por causa de falha; reformular diagnóstico se persistir.
Validação PGlite e mocks não equivalem a validação em Neon/produção.

## Evidência local (2026-11-11)

- Teste fornecido preservado byte a byte (SHA256
  `0EE8FCA5886C1EBC10A4F1AC6982C79243AA59A1CF2A98CC03BE53E1DBD7E115`).
- As duas migrations 0010 são idênticas em bytes e usam LF.
- O primeiro `pnpm test` encontrou CRLF nas migrations antigas do checkout;
  normalização para LF conforme `.gitattributes` corrigiu o teste existente,
  sem diff nas migrations antigas.
- `pnpm lint`: PASS, com 12 avisos em arquivos não alterados.
- `pnpm typecheck`: PASS.
- `pnpm test`: PASS, 557 testes aprovados e 12 já configurados como ignorados
  nos scrapers; 112 testes de banco e 162 de web aprovados. Turbo informa apenas
  ausência de arquivos de cobertura configurados como outputs.
- Aplicação de migration e execução contra Neon externo: NOT RUN.
