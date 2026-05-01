# KISS — Project memory for Claude

**Read this first** in any new session before doing KISS work. It's the fastest orientation.

## What KISS is

KISS = "Keep Insurance Super Simple." A policy analysis service. Homeowner uploads their insurance policy PDF → GPT-4o extracts structured data → produces a plain-English, color-coded 1–3 page advisory report (turns a 60-page policy into something a client can actually use). Optionally produces a *second* report tailored to the referring partner (insurance broker advisory or property/PI attorney pre-claim analysis). Emails both copies — homeowner gets the consumer report, partner gets both with homeowner CC'd.

**Owner:** Keith Kravitz · keith@optimizinggroup.com · Optimizing Group LLC.
**Live domain target:** kiss.optimizinggroup.com.
**Sales angle:** the report has a "lifetime shelf life" — every policy renewal becomes a new touchpoint and an upsell to compare year-over-year findings.

## Architecture in one paragraph (v2 — canonical)

React form on Vercel → Supabase (Postgres + Storage + Auth + RLS) → Make.com orchestration → PDF.co for text extraction → OpenAI gpt-4o for extraction + report generation → Resend for email. **No GHL.** v1 (Make scenario `4581471`, GHL-based) is paused on cutover and kept for rollback only.

## Folder map (everything lives here)

```
/Users/keith-macstudio-1/Documents/Claude/Projects/OptimizingGroup/KISS/
├── README.md                        ← human-facing index
├── CLAUDE.md                        ← this file
├── 00-current-status.md             ← what's built, what's not
├── 01-next-steps.md                 ← Phase A → D deployment checklist
├── docs/
│   ├── KISS_v2_Technical_Handoff.docx / .md   ← master spec
│   └── Updated_Law_Firm_Intake_Workflow.docx
├── code/
│   ├── frontend/KissIntakeForm.jsx
│   ├── supabase/schema.sql                    ← 5 tables + RLS + seed data
│   ├── supabase/migrations/2026_04_30_add_renewal_tracking.sql
│   ├── make/blueprint_v2.json                 ← 16-module scenario
│   ├── make/renewal-reminder-scenario-spec.md ← daily renewal scenario
│   ├── emails/email_homeowner.html
│   ├── emails/email_partner.html
│   ├── emails/email_renewal_reminder.html
│   └── prompts/consumer-report-{auto,residential}.txt
├── marketing/
│   ├── kiss-product-spec.md                   ← v2.2 spec (renewal tracking baked in)
│   ├── attorney-personas.md
│   ├── florida-bar-compliance.md
│   └── nurture-sequences/
├── sales-page/
│   └── kiss-for-attorneys.html                ← live mockup with ROI calc
└── _v1-historical/                            ← rollback insurance only
```

## Stack & key IDs

| Layer | Tool | Notes |
|---|---|---|
| Frontend | React + Vite + React Router on Vercel | Code ready, not deployed |
| Domain | kiss.optimizinggroup.com | DNS not pointed |
| DB / Storage / Auth | Supabase (project name `kiss-prod`, FREE tier for dev) | ✓ Project created: `diyctwdqmqwemswekyvb` |
| Orchestration | Make.com | org 5587731, team 1524441, us2 zone, AIdeveloper@optimizinggroup.com |
| **LLM (v2.2)** | **Claude 3.5 Sonnet** | **~35% cheaper than OpenAI; switching from gpt-4o** |
| PDF text | PDF.co | ✓ API key captured |
| Email | Resend | ✓ Domain verified: kiss.optimizinggroup.com |
| v1 (legacy) | Make scenario `4581471` | Paused on cutover, do NOT delete |

## Current status (2026-05-01 16:45 UTC — Phase C In Progress)

**✓ Phase A Complete (Supabase + Resend + PDF.co):**
- ✓ Supabase project created: `kiss-prod`, us-east-1, NANO tier, ID `diyctwdqmqwemswekyvb`
- ✓ Schema deployed (all 5 tables, views, indexes, RLS policies, seed tenants)
- ✓ Storage bucket created (`policies`, private, 25 MB, PDF-only)
- ✓ All credentials captured → stored in `.env.local` (not tracked in git)
  - See `.env.local` for all API keys and secrets
  - Do NOT commit `.env.local` to version control
  - For Vercel deployment, add env vars in Vercel Settings
- ✓ Resend domain verified: `kiss.optimizinggroup.com`

**⧗ Phase B In Progress (Make.com scenario) — SWITCHING TO CLAUDE**
- ✓ v1 scenario (4581471) paused
- ✓ Original blueprint: `blueprint_v2_PREPARED.json` (OpenAI GPT-4o, scenario 4926552) — **set aside**
- ✓ **NEW: Claude blueprint** `blueprint_v2_CLAUDE_SONNET.json` created
  - Replaces 5x OpenAI modules with Claude 3.5 Sonnet
  - 35-50% cost savings per submission
  - Better for plain-English policy explanation (KISS strength)
- ⧗ **Next Steps:**
  1. Get Anthropic API key from https://console.anthropic.com/api-keys
  2. Add Anthropic connection in Make → Admin Settings → Connections
  3. Import `blueprint_v2_CLAUDE_SONNET.json` as new scenario (or replace 4926552)
  4. Verify all 5 Claude modules have Anthropic connection set
  5. Test webhook submission
  6. Activate scenario
  - **Details:** See `ANTHROPIC_SETUP_IN_MAKE.md`
- ⧗ Webhook URL reused: `https://hook.us2.make.com/pskxsnskes42gsngq7n24u7wih2jir` (same as before)

**Phase C Scaffolding Complete (2026-05-01 16:45 UTC):**
- ✓ Full Node.js/React/Vite project structure created
- ✓ package.json configured with all dependencies (React 18, Vite 5, Supabase client, React Router)
- ✓ vite.config.js configured for dev/prod builds
- ✓ React Router setup with routes: /, /start, /:slug
- ✓ KissIntakeForm.jsx moved to src/components/ and integrated
- ✓ Entry points created: index.html, src/main.jsx, src/App.jsx
- ✓ Environment variables documented (.env.example)
- ✓ .gitignore configured (node_modules, .env.local, dist/, etc.)
- ✓ vercel.json configured with build command, framework type, env var placeholders
- ✓ VERCEL_DEPLOYMENT.md created with full setup guide
- ⧗ **Next Steps for Phase C:**
  1. Initialize Git repo in /Users/keith-macstudio-1/Documents/Claude/Projects/OptimizingGroup/KISS/
  2. Push to GitHub (create repo first)
  3. Import GitHub repo into Vercel console
  4. Set env vars in Vercel: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_MAKE_WEBHOOK_URL
  5. Add custom domain: kiss.optimizinggroup.com → point DNS in GoDaddy
  6. Verify first deployment succeeds
  - **Details:** See `VERCEL_DEPLOYMENT.md`

**Phase D Not Started:**
- Phase D: End-to-end testing (all phases integrated)

**Note on Phase B.2 (blueprint import):**
The prepared blueprint file is ready at `/Users/keith-macstudio-1/Library/Application Support/Claude/local-agent-mode-sessions/.../outputs/blueprint_v2_PREPARED.json`. Due to browser sandbox restrictions, manual file selection via native OS picker is required. Path to use in Make import dialog: copy the full path from the outputs folder.

**v2.2 blueprint surgery (2026-05-01):**
- `code/make/blueprint_v2.json` regenerated. Generator script preserved at `code/make/_rewrite_blueprint.py`. Pre-edit backup at `code/make/blueprint_v2.pre-2026-05-01.json.bak`.
- Module 6 extraction prompt now requires ISO 8601 dates (or empty string when missing) and adds a `policy_class` field that's exactly `"auto"` or `"residential"` — LLM does the classification, not regex matching.
- Module 8 is now a `builtin:BasicRouter` "Branch consumer report by policy class" with two routes: id 17 (Auto, full prompt from `code/prompts/consumer-report-auto.txt`) and id 18 (Residential, default branch, full prompt from `code/prompts/consumer-report-residential.txt`). Mutually exclusive filters using `text:equal` / `text:notequal` against `{{7.policy_class}}`.
- Modules 13 (save reports) and 14 (email homeowner) now use `ifempty(17.output[].content[].text;18.output[].content[].text)` to merge whichever branch fired — same pattern as the existing partner-report merge in module 13.
- Module 16 (mark completed) PATCH body now writes `policy_effective_date` and `policy_expiration_date` to the submissions row, with a Make `if()` expression that emits JSON `null` when the extracted value is empty (so Postgres DATE casting succeeds either way). The daily renewal-reminder scenario can now query `v_submissions_renewal_due` and find rows.

## Working preferences (Keith)

- Work efficiently. Edit in tight diffs, don't re-read files unnecessarily, delegate research to subagents to keep main context lean.
- Don't write secrets/passwords to any tracked file. DB password and API keys live in env vars or a password manager only.
- When ambiguous, ask one focused multiple-choice question rather than burning tokens on a guess.
- Free Supabase tier is fine for development — only flag if it actually blocks something.

## Cross-project context

Keith also runs:
- **Content Surge** (contentsurge.net) — RSS-driven content automation. Has Google Forms onboarding that's stale (still references the old 3-product structure) and a tools page with a broken LLM connection. Separate project folder; ask before assuming KISS context applies.
- **TrueHealthAge** — health-age email-capture funnel being rebuilt to add a "which areas of health" module (Cardio, Neuro, Brain/Cognitive, Fitness, Diet, Skin) for personalized plans + affiliate offers. Feeds the Live Longer Health Podcast. Separate project folder.

When Keith asks something ambiguous like "the app" or "the page," ask which project — these three are all active.

## Pricing model summary

| Phase | Audience | Price |
|---|---|---|
| 1 | Direct-to-consumer | $4.99 one-time (open question — v2 default removed Stripe) |
| 2 | White-label brokers/attorneys | $500–$1,000 setup + $97/mo |
| Per submission | All | $0.10–$0.50 (OpenAI dominates) |

## Quick reference — when in doubt

- "What's next?" → `01-next-steps.md` Phase A
- "What does the Make scenario do?" → `docs/KISS_v2_Technical_Handoff.md` § 3.1
- "What's in the schema?" → `code/supabase/schema.sql` + `code/supabase/migrations/`
- "What's the v1 setup?" → `_v1-historical/` (rollback only)
- "What changed in v2.2?" → renewal tracking section in `marketing/kiss-product-spec.md`
