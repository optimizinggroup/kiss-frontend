# KISS — 3 Manual Steps to Go Live

Everything else is done. These 3 actions need your hands on a UI.
Total time: ~5 minutes.

---

## ✅ What's already done (autonomously)

1. White-label form code written and pushed to GitHub
2. Schema migration SQL written (file ready to paste)
3. `great-law-firm` demo tenant seeded in migration with placeholder logo + attorney photo
4. GitHub repo `optimizinggroup/kiss-frontend` — updated, committed, pushed
5. Vercel project `kiss-app` — deployed to production
   - Live deployment URL: **https://kiss-app-optimizing-group.vercel.app**
   - Custom domain added: `kiss.optimizinggroup.com` (DNS pending — Step 2 below)
6. All 3 Vercel env vars confirmed set (Supabase URL/anon key + Make webhook)

---

## Step 1 — Apply Supabase migration (30 seconds)

Without this, the form will throw "column does not exist" errors when it tries
to load tenant branding.

1. Open: **https://supabase.com/dashboard/project/diyctwdqmqwemswekyvb/sql/new**
2. Open this file in any text editor:
   `code/supabase/migrations/2026_05_19_add_whitelabel_fields.sql`
3. Copy the entire file, paste into the SQL Editor
4. Click **Run**
5. Verify: in the **Table Editor → tenants**, you should see 4 rows:
   `consumer`, `demo-broker`, `demo-attorney`, **`great-law-firm`** (new)

---

## Step 2 — Point DNS in GoDaddy (1 minute)

Vercel needs a CNAME or A record so `kiss.optimizinggroup.com` resolves to
your deployment.

1. Open: **https://dcc.godaddy.com/control/portfolio** → click `optimizinggroup.com` → DNS
2. Add a new record:
   - **Type:** `A`
   - **Name:** `kiss`
   - **Value:** `76.76.21.21`
   - **TTL:** 1 Hour (default)
3. Save.
4. Wait 5–15 minutes for DNS to propagate.
5. Visit: `https://kiss.optimizinggroup.com/great-law-firm` — should show the
   white-label demo. (Vercel auto-provisions SSL once DNS resolves.)

In the meantime, the form is live and you can demo it at:
**https://kiss-app-optimizing-group.vercel.app/great-law-firm**

---

## Step 3 — (Optional) Swap to Claude 3.5 Sonnet in Make

Right now the Make scenario (`4926552 — KISS v2.2 Supabase Pipeline`) is built
with OpenAI GPT-4o modules. It is **not yet active**. Two paths:

### Path A — Ship today with GPT-4o (recommended for demo speed)
1. Open: **https://www.make.com/en/scenarios/4926552**
2. Toggle the scenario from `OFF` → `ON` (top-left of the scenario editor)
3. Test by submitting a sample policy at `/great-law-firm`
4. Done. You can swap to Claude later for cost savings.

### Path B — Swap to Claude now
1. Add Anthropic connection in Make:
   - Open: **https://www.make.com** → **Admin Settings → Connections → New Connection**
   - Select **Anthropic Claude**
   - Name: `Anthropic-KISS`
   - API Key: copy from `KISS/.env.local` line `ANTHROPIC_API_KEY=...`
   - Save
2. Open scenarios → Import Blueprint → upload `code/make/blueprint_v2_CLAUDE_SONNET.json`
3. Make will prompt you to map connections — point all Claude modules at the
   `Anthropic-KISS` connection you just created
4. Activate the new scenario
5. **Important:** copy the new webhook URL from module 1 → update Vercel env var
   `VITE_MAKE_WEBHOOK_URL` (Vercel dashboard → kiss-app → Settings → Env Vars)
6. Redeploy from Vercel dashboard, or push any commit

---

## After all 3 steps — verify end-to-end

1. Visit `https://kiss.optimizinggroup.com/great-law-firm`
2. Fill in a test submission (your email + a real policy PDF — your own works)
3. Within 5 minutes, you should receive:
   - The consumer report at your email
   - A partner notification at `admin@optimizinggroup.com` with both reports
4. In Supabase, the `submissions` row should be `completed`, and the `reports`
   table should have 2 rows for that submission

If anything errors: check Make scenario execution history for the failed module.

---

## Files changed in this session

| File | Purpose |
|---|---|
| `src/components/KissIntakeForm.jsx` | White-label header logic |
| `code/frontend/KissIntakeForm.jsx` | Synced archive copy |
| `code/supabase/migrations/2026_05_19_add_whitelabel_fields.sql` | DB changes — **needs to be applied (Step 1)** |
| `vercel.json` | Removed legacy `@secret` env refs, added SPA rewrite |
| `KEITH_3_MANUAL_STEPS.md` | This file |

All committed and pushed to `main` as of 2026-05-19.
