# KISS — Current Status (as of 2026-05-01 16:45 UTC)

## TL;DR — Deployment Roadmap

**Phase Progress:**
- **Phase A** ✅ Complete — Supabase, Resend, PDF.co all deployed & credentials captured
- **Phase B** 🟡 In Progress — Make.com scenario 65% done; Anthropic connection setup pending
- **Phase C** 🟡 In Progress — Frontend scaffolding complete (Git repo initialized); GitHub + Vercel push next
- **Phase D** ⏳ Pending — End-to-end testing (waits for B & C)

**Estimated live date**: ~30 minutes from now (after GitHub push + Vercel deploy + DNS propagation)

## What changed 2026-05-01

| Change | File | Why |
|---|---|---|
| Extraction prompt now outputs ISO 8601 dates + `policy_class` classifier | `code/make/blueprint_v2.json` mod 6 | Renewal-reminder scenario needs queryable expiration dates; consumer report needs to know whether to use auto or residential prompt |
| Single consumer-report GPT call → Router with Auto + Residential branches | `code/make/blueprint_v2.json` mod 8 (router) → mod 17 (Auto) / mod 18 (Residential) | Auto and residential have totally different coverages, risks, and FL-specific concerns. The two prompts in `code/prompts/` are now actually wired up. |
| Module 16 PATCH writes policy dates to submissions row | `code/make/blueprint_v2.json` mod 16 | Without this, `policy_expiration_date` stays NULL forever and the daily renewal-reminder query returns zero rows |
| Generator script + pre-edit backup committed alongside blueprint | `code/make/_rewrite_blueprint.py` and `code/make/blueprint_v2.pre-2026-05-01.json.bak` | Future sessions can see exactly how the blueprint was built; backup enables clean rollback if needed |

## Why v2 exists

The prior session's v2 handoff document (`docs/KISS_v2_Technical_Handoff.md`) explains it directly: every target partner already has a CRM (Salesforce, AMS360, Clio, MyCase, HubSpot…). None of them want to migrate to GHL or maintain a parallel CRM there just to use a policy review tool. v1 used GHL as both the inbound trigger and outbound CRM — that made the product hard to sell. v2 strips GHL out entirely. KISS becomes a self-contained policy review service that delivers branded reports by email; partners use whatever CRM they already use.

## v2 build state

| Component | State | Where |
|---|---|---|
| React intake form `KissIntakeForm.jsx` | ✅ Code complete | `code/frontend/` |
| Supabase schema (5 tables, RLS, triggers, views, seed data) | ✅ Code complete | `code/supabase/schema.sql` |
| Make scenario v2 blueprint (16 modules) | ✅ Blueprint complete | `code/make/blueprint_v2.json` |
| Email templates (homeowner + partner) | ✅ Code complete | `code/emails/` |
| Technical handoff doc | ✅ Complete | `docs/KISS_v2_Technical_Handoff.docx` |
| Supabase project `kiss-prod` | ❌ Not created | Create under Optimizing Group org |
| Supabase Storage `policies` bucket | ❌ Not created | Created during Supabase setup |
| Resend account + domain verification | ❌ Not done | Verify `kiss.optimizinggroup.com` (DKIM, SPF, DMARC) |
| PDF.co account + API key | ❌ Not done | Required for module 5 |
| Vercel project | ❌ Not done | Single-page app at kiss.optimizinggroup.com |
| GitHub repo `kiss-frontend` | ❌ Not done | Under Optimizing Group org |
| DNS for `kiss.optimizinggroup.com` | ❌ Not pointed | CNAME to Vercel after deploy |
| Make scenario v2 imported | ❌ Not imported | Pause v1 first, then import v2 |
| End-to-end test | ❌ Not performed | Phase D in `01-next-steps.md` |
| Partner portal (Phase 2) | 🟡 Schema-ready | `tenant_users` table exists; UI not built |

## v1 state (for reference / rollback only)

| Component | State |
|---|---|
| Make scenario `4581471` "KISS Insurance Policy Review - Core Pipeline" | ✅ Active, never executed (0 runs) |
| Webhook URL `hook.us2.make.com/6tvcwb2d2b7nuimiewpfe6rw1g11u97y` | ✅ Live |
| OpenAI connection IMTCONN 6008119 | ✅ Live (will be reused in v2) |
| Gmail connection IMTCONN 7992256 | ✅ Live (v1 only — v2 uses Resend) |
| GHL "Insurance Secrets" sub-account | ✅ Exists (v2 doesn't use it) |
| Stripe sandbox link | ✅ Exists (v2 doesn't bake in Stripe — see note below) |
| GHL workflow `2c316a95-...` | ⚠️ Exists, purpose unclear, irrelevant for v2 |

The v1 docs are preserved in `_v1-historical/` for archaeology and rollback.

## v2 architecture — one-paragraph flow

Homeowner visits a branded URL (`kiss.optimizinggroup.com/{slug}`) or generic URL (`/start` + partner code) → React form fetches the tenant from Supabase by slug, applies branding, accepts homeowner contact info + property details + PDF upload → form INSERTs a submission row, uploads the PDF to Supabase Storage, then POSTs `{ submission_id }` to the Make webhook → Make fetches the submission + tenant from Supabase, signs a 10-min URL for the PDF, calls PDF.co for text extraction, calls GPT-4o twice (extraction + consumer report), then conditionally calls GPT-4o a third time for a partner-specific report (broker advisory or attorney pre-claim analysis), writes 1-2 report rows to Supabase, sends Resend email to homeowner with consumer report, sends Resend email to partner with both reports (homeowner CC'd), marks submission `completed`.

## Stack confirmed (v2)

| Layer | Tool |
|---|---|
| Frontend | React + Vite + React Router on Vercel |
| Domain | kiss.optimizinggroup.com |
| Storage / DB / Auth | Supabase (Postgres + Storage + RLS + Auth) |
| Orchestration | Make.com (org 5587731, team 1524441, us2 zone) |
| LLM | OpenAI gpt-4o (reuse Make connection IMTCONN 6008119) |
| PDF text extraction | PDF.co |
| Email | Resend (verified domain) |

## What was wrong about earlier conclusions in this conversation

1. **"Supabase NOT in architecture"** — Wrong. That was true for v1 only. v2 is Supabase-first. Earlier in this conversation I dismissed Supabase based on the v1 Make scenario state. The v2 handoff doc you uploaded made this obvious.
2. **"OpenAI gpt-4o is the LLM"** — Still true for v2.
3. **"Built with Qwen"** — Still incorrect. v1 and v2 both use OpenAI gpt-4o.
4. **"GHL stays in the architecture"** — Wrong for v2. GHL is removed entirely; v2's storage, auth, file handling, and email all move off GHL.

## One open product question (read this before deploying)

The v1 plan included a **$4.99 Stripe paywall** on the consumer flow. The v2 architecture removes Stripe entirely — anyone can submit a policy, no payment required. The handoff doc treats the consumer tenant as a free default.

Before deploying v2, decide:

- **Option A: Stay free.** Anyone can use the consumer flow. KISS becomes pure top-of-funnel marketing for the white-label B2B product. Partner pricing ($500–$1,000 setup + $97/mo) is the only revenue.
- **Option B: Re-add the $4.99 Stripe paywall** for the consumer flow. Add a Stripe checkout in front of the React form. Branded partner flows would skip the paywall (partner already paid). This is more code (Stripe integration in the form) but preserves the dual revenue model.

Earlier in this conversation we landed on $4.99 for consumers as Phase 1. The v2 doc moves away from that. Worth confirming which model you want before Phase A of the deployment.

## Cost estimate (per submission, per the handoff doc)

$0.10–$0.50 — dominated by OpenAI tokens. PDF.co is roughly $0.005–$0.02/page. With 10 partner clients at the soft 50/month quota = 500 submissions/month × $0.30 avg = ~$150/month variable cost. Resend is free tier through 100/day. Supabase free tier covers the data needs through the first ~5,000 submissions; after that ~$25/mo. Vercel hobby is free for the frontend until traffic grows.
