# Imovi stabilization

Status: implemented locally; external release gates pending. Base: `be4087f`, `codex/vercel-release`,
upstream `origin/main`, fetched 2026-09-30, ahead/behind 0/0.

## Intent and constraints

Stabilize the public AVM and multi-organization Audit on the existing Cloudflare
deployment. Public estimates initially use an explicitly identified heuristic.
Keep user edits, existing response fields and source data. Do not deploy, charge
customers or apply migrations to external databases as part of local work.
The next-on-pages replacement is a separate future change.

## Acceptance criteria

| ID     | Observable behavior                                                                                                                                           | Verifier                                                              |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| AC-001 | Current organization membership is checked on every authorized request; removed members lose access; only owner/admin manage configuration and billing.       | Session and membership integration tests, two organizations.          |
| AC-002 | Production requires email verification and configured transactional mail/auth credentials; verified users can complete onboarding.                            | Auth configuration and onboarding tests; provider journey in staging. |
| AC-003 | Production missing Turnstile secret fails closed; invalid tokens fail; ten attempts/minute/IP default is atomic across isolates.                              | Route and database rate-limit tests.                                  |
| AC-004 | Saved result reference reproduces its estimate, inputs and source metadata; no fabricated history/comparables/precision.                                      | Estimate/result route tests and browser journey.                      |
| AC-005 | Waitlist success means the contact and consent were persisted; repeated email is idempotent.                                                                  | API and DB tests.                                                     |
| AC-006 | Billing events remain retryable after crashes; leases fence concurrency; current Stripe subscription wins over late invoices.                                 | Inbox, reconciliation, concurrency and failure tests; Stripe sandbox. |
| AC-007 | Collection preserves dated observations and all sources for shared properties; only >=20 distinct valid recent sale properties establish observed medians.    | Listing, pipeline and aggregate DB tests.                             |
| AC-008 | Training fails before artifact creation for insufficient temporal splits; property identity cannot occur on both sides; test imputation uses training values. | Python temporal split, CLI and export tests.                          |
| AC-009 | Artifacts use immutable version paths, activation occurs after upload; cache refreshes active version and retries transient failures.                         | Promotion/model cache tests and workflow checks.                      |
| AC-010 | Deployment requires checks for the same SHA and explicit production approval; readiness fails for unavailable database/configuration.                         | Workflow review, readiness tests, preview smoke.                      |
| AC-011 | Dependency advisories are remediated/triaged; normal lint/types/tests/builds work with bounded PGlite concurrency.                                            | Audit, frozen install, full checks, Pages build, Worker dry-run.      |
| AC-012 | Setup, variables, migrations, rollback and external gates are documented without secrets.                                                                     | README/runbook/evidence review.                                       |

## Parallel ownership and implementation

Coordinator owns manifests, lockfile, schemas/migrations, limiter/waitlist repos,
CI, readiness and docs. Security owns auth/session/billing. Product owns public
routes/pages/estimate storage. Data owns collection, aggregation, training and
model cache. Shared contracts are coordinated before editing.

Database changes are additive migration 0007. Billing uses recoverable inbox and
lease fencing compatible with Neon HTTP (no unsupported callback transactions).
Raw IP addresses and Turnstile tokens are not persisted. Opaque estimate results
expose only public property inputs, values and source metadata.

## Execution boundary and stop conditions

Each repair loop has at most three attempts for the same cause before reframing.
No requirement may be weakened to pass a check. Missing service credentials are
reported BLOCKED, never represented as local PASS. External migrations require a
backup and authorized staging target; production requires separate approval.

## Rollout and rollback

Back up staging, apply ordered migrations, run full auth/Stripe/AVM journeys and
restore rehearsal. Build preview from the tested SHA, check health/readiness,
public result consistency, tenant isolation and provider failures. Abort on
cross-tenant exposure, billing state regression, failed readiness or data loss.
Deploy only with approved production environment; retain the previous deployment
and immutable model version. Prefer app rollback over destructive schema rollback.
