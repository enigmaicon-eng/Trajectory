# Trajectory — Launch Audit

**Date:** 2026-08-17
**Auditor:** Claude Code, working from `docs/PRODUCT-ARCHITECTURE.md` (source of truth for scope and acceptance criteria) and the Enterprise Intelligence launch-readiness playbook (`workflows/pm/launch-readiness.md`), adapted below for a solo-founder v1 launch — no support org, no sales, no executive sponsor, so those sections of the upstream playbook are marked N/A rather than answered.
**Status:** **Conditional go.** No launch-blocking defect found in what could be verified from this environment. The remaining blocker is environmental, not code: nobody has run the full authenticated core loop (goal → plan → execute → adapt) against a real Supabase + Gemini backend. That must happen once, by whoever holds those credentials, before this ships.

---

## 1. What "launch" means here

v1 scope per `PRODUCT-ARCHITECTURE.md` §1.1: single-user, single-tenant, English-only, one AI provider (Gemini) live with Anthropic/OpenAI as unimplemented stubs behind the same interface. No team features, no notifications. This audit is scoped to that — not to a hypothetical multi-tenant or multi-provider launch.

## 2. Acceptance criteria status (§11 of the architecture doc)

This is the authoritative bar. Status reflects what's actually been exercised, not what the code appears to implement.

| AC | Criterion | Status | Basis |
| --- | --- | --- | --- |
| AC-1 | Goal capture, ≤4 clarifying questions, raw input preserved | **Unverified live** | `GoalInputForm` and `clarify` module exist and unit-test cleanly; never run against live Gemini + Supabase |
| AC-2 | Honest assessment (ambitious vs. unrealistic verdicts) | **Unverified live** | `assess` module has fixture coverage (12/12 pass); no live model call observed |
| AC-3 | Decomposition — 3–5 milestones, acyclic graph, fuzz-tested | **Partially verified** | Cycle-repair fuzz test runs in `pnpm test` (154/154 pass); never seen against a real generated graph |
| AC-4 | Planning — active plan, capacity budgeting, <90s p50 | **Unverified live** | No latency measurement possible without live generation |
| AC-5 | Execution — three day tiers, deterministic fallback | **Unverified live** | AC-5.19 (deterministic tiering when AI is forced to fail) is exactly the kind of claim that needs an integration run, not just a unit test, to trust |
| AC-6 | Signals after 14 days, explanations, sufficiency gating | **Unverified live** | Requires simulated multi-day execution against real data |
| AC-7 | Reflection synthesis | **Unverified live** | Same |
| AC-8 | Adaptive replanning triggers and diffs | **Unverified live** | Same — this is the product's stated differentiator (§1) and the least-tested part of the system end-to-end |
| AC-9.33 | Lighthouse a11y ≥95 on `/`, `/today`, `/week`, `/map` | **Partially verified** | axe scan (comparable but not identical to Lighthouse) is clean on `/` and `/auth/sign-in`; `/today`, `/week`, `/map` need auth + data and weren't reachable this session. Caught and fixed one real contrast bug on sign-in (2.58:1 → fixed) |
| AC-9.34 | Full keyboard traversal, visible focus | **Partially verified** | Verified on landing page (Playwright, both viewports); not on the authenticated core-loop pages |
| AC-9.35 | `/today` usable at 360px | **Unverified** | Page requires auth + an active plan; couldn't load it this session |
| AC-9.36 | No AI/prompt/token/LLM/model jargon in UI copy | **Verified** | `tests/ui/no-forbidden-language.test.ts` passes in the suite |
| AC-9.37 | Every error state has a recovery action | **Spot-checked** | `not-found.tsx`, `error.tsx` verified live (Playwright); the rest is static-code review, not exercised |
| AC-9.38 | All 12 eval fixtures pass structurally | **Verified** | `tests/ai/fixtures.ts` has exactly 12 fixtures; `tests/ai/eval.test.ts` passes |

**Bottom line:** everything that can be verified without a live backend has been verified, and one real bug was found and fixed in the process (contrast). Everything that requires a live Supabase project + Gemini key is unverified — not because it's suspected broken, but because this session has no credentials for either and didn't create any (per CLAUDE.md's guidance not to take actions with real-world side effects, like provisioning cloud resources, without asking).

## 3. Technical readiness

| Check | Result |
| --- | --- |
| `pnpm build` (production) | ✅ Compiles clean, all 15 routes generate |
| `pnpm lint` | ✅ 0 errors (4 pre-existing warnings on unused stub params in `providers/anthropic.ts` / `openai.ts` — cosmetic, not fixed here to keep this change scoped) |
| `tsc --noEmit` | ✅ Clean |
| `pnpm test` (Vitest, domain/eval/UI-copy) | ✅ 154/154 |
| `pnpm test:e2e` (new — Playwright + axe) | ✅ 14/14, desktop + 360px |
| RLS | ✅ `ENABLE ROW LEVEL SECURITY` + `owner_all` policy present for every user-owned table in the initial migration |
| Cron auth | ✅ `/api/cron/daily` behind `CRON_SECRET`; `vercel.json` registers the schedule |
| Security review of this session's diff | ✅ No findings (see below) |
| Security review of BYOK / AI-provider / cron surface | ✅ Done — found and fixed 1 real issue (see below) |
| Error monitoring / alerting | ❌ **Gap.** No Sentry/equivalent wired up. `ai_runs` gives cost/usage visibility but nothing pages anyone on an elevated error rate. Not blocking for a single-user beta, but should exist before any real user traffic beyond the founder |
| Rollback procedure | ⚠️ Implicit only. Vercel's own deploy history gives a rollback path (redeploy previous build), but it's untested and there's no written trigger criteria |

### Security review (this session's changes)

Reviewed the `<a>`→`Link` conversion, the contrast fix, and the new Playwright/axe tooling for injection, auth-bypass, secret-exposure, and data-leakage risk. **No findings.** None of it touches auth, RLS, secret handling, or AI I/O — it's navigation semantics, one CSS class, and dev-only test tooling.

**Follow-up full-surface pass (BYOK key handling, AI provider abstraction, cron endpoint), done this session:** found one real issue, now fixed. `src/lib/security/redact.ts` exports `redactSecrets()` specifically to strip API keys from provider SDK error text before persistence — its own comment names the exact scenario ("a provider SDK error message that echoes the invalid key") — but it was never called anywhere in the codebase. `src/lib/ai/run.ts` wrote a failed provider call's raw `err.message` straight into `ai_runs.error_code`. Google's Generative Language API embeds the API key in the request URL, so a BYOK user's raw key could have reached that Postgres column un-redacted on a failed call — contradicting the "metadata-only `ai_runs`" / "redaction in logs" guarantee this document's own R9 row promises. Fixed by wiring `redactSecrets()` into that write path (commit `15ff4f9`). Everything else on this surface — `byok-session.ts`'s httpOnly/encrypted/session-only cookie handling, `crypto.ts`'s AES-256-GCM with auth-tag verification, the cron route's bearer-secret gate — checked out clean.

## 4. Known, accepted gaps (per `PRODUCT-ARCHITECTURE.md` §13)

These are documented product decisions, not launch blockers: single-tenant only, English-only, Monday-start weeks, Anthropic/OpenAI as proven-but-unimplemented stubs, feasibility judged from model priors without a grounded corpus, no notifications, free-tier limits (8 heavy / 20 light) are a starting guess pending real usage data, cron lag up to 24h. Nothing here needs action before v1 ships to the founder as first user.

## 5. Go / No-Go

**Decision: Conditional go.**

**Condition:** before real users touch this, someone with a real Supabase project and Gemini key must:
1. Apply migrations (`supabase db push`) and run the actual goal → clarify → assess → decompose → plan → execute → reflect → adapt loop once, end to end, as a real signed-in user.
2. Re-run the Playwright suite against `/today`, `/week`, `/map` once authenticated (the smoke suite added this session only covers the pages reachable without a backend — extending it to the authenticated surface is the natural next step once a test Supabase project exists).
3. Confirm AC-4.14 (<90s p50 to a rendered plan) and AC-5.19 (deterministic fallback when the AI provider fails) against the real provider, since both are latency/failure-mode claims a unit test can't fully stand in for.

**If that condition is met with no critical findings:** go, with the understanding that error monitoring is a fast-follow, not a blocker, at single-user scale.

**Post-launch monitoring:** at solo-founder/single-user scale, the Enterprise Intelligence playbook's weekly-metric-review cadence is overkill. The practical equivalent: check `ai_runs` for cost/error patterns after the first week of real use, and watch for any `NEXT_REDIRECT`-style auth-gate failures in Vercel's function logs.

**Rollback trigger:** if the live end-to-end run in step 1 above surfaces a data-integrity bug (wrong plan, lost evidence, incorrect RLS boundary), do not proceed to real users until it's fixed — everything else found so far has been cosmetic (contrast) or infrastructural (missing E2E tooling), not data-integrity-affecting.

**Rollback procedure (documented here, not yet exercised — needs Vercel dashboard access this session doesn't have):**
1. Vercel → Project → Deployments → find the last known-good deployment → "Promote to Production." No rebuild needed; takes effect in seconds. This is a code-only rollback — no in-app schema-version gate exists, so it only works cleanly if the bad deploy didn't ship alongside a breaking migration.
2. If a Supabase migration shipped in the same change and needs reverting too: migrations in `supabase/migrations/` are forward-only (no generated down-migrations) — a revert means hand-writing and applying a new migration that undoes the change, not `supabase db reset`. Riskier than the code rollback, and the reason schema changes deserve more scrutiny than a UI change before shipping.
3. There is no feature-flag layer — rollback is deploy-level, not per-feature. Acceptable at single-user scale; worth revisiting if real users arrive.

## 6. Sections intentionally out of scope

Per the adaptation noted at the top: Go-to-Market Readiness (§5) and Organizational Readiness (§6) from the upstream playbook don't apply to a solo-founder v1 with no support team, sales function, or executive sponsor, and are omitted rather than answered with placeholders.
