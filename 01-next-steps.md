# KISS — Next Steps (v2 Deployment Plan)

This is the punch list to take v2 from "code complete" to "first real partner running through it." Follows the four phases (A → D) from the technical handoff document.

**Time estimate end-to-end:** 4–8 hours of focused work, plus DNS propagation wait time.

---

## ⚠️ Before you start: one decision

The v2 architecture removes the $4.99 Stripe paywall that was in v1. Decide which model you want:

- **Free consumer flow** (v2 default) — anyone can submit, $0 friction, KISS is pure marketing for the B2B side
- **Restore $4.99 paywall** — adds Stripe checkout in front of the React form for the consumer tenant; branded partner flows skip it

This drives whether Phase C includes a Stripe step. Default is free per the v2 handoff. **If you want the paywall back, flag it now.**

---

## Phase A — Backend (Supabase + Resend + PDF.co) · ~90 min

### A1 — Create Supabase project

1. supabase.com → New Project under Optimizing Group org.
2. Project name: `kiss-prod`. Region: US East. Strong DB password.
3. Wait for provisioning (~2 min).

### A2 — Run the schema

1. Supabase Dashboard → SQL Editor → New Query.
2. Open `code/supabase/schema.sql` from this folder, paste the entire file.
3. Click Run.
4. **Verify:** Database → Tables — should see `tenants`, `submissions`, `reports`, `email_events`, `tenant_users`, plus 2 views.
5. Quick test: `SELECT * FROM tenants;` should return the seed rows (`consumer`, `demo-broker`, `demo-attorney`).

### A3 — Create the Storage bucket

1. Supabase → Storage → New Bucket.
2. Name: `policies`. **Private** (NOT public).
3. File size limit: 25 MB.
4. Allowed MIME types: `application/pdf`.
5. Storage Policies tab:
   - Allow `anon` role to INSERT (so the form can upload without login).
   - Allow only `service_role` to SELECT (Make signs URLs server-side; nobody else needs direct read).

### A4 — Capture credentials

Settings → API. Copy these into a password manager (don't put them in this folder):

- Project URL → `https://<project-ref>.supabase.co`
- ANON key (the public one — frontend uses this)
- SERVICE_ROLE key (NEVER expose to frontend; Make uses this)

### A5 — Create Resend account + verify domain

1. resend.com → Sign up.
2. Domains → Add → `kiss.optimizinggroup.com`.
3. Resend gives you 3 DNS records (DKIM, SPF, DMARC). Add them at your domain registrar.
4. Click Verify in Resend. Usually verifies within 1 hour. Don't proceed until this is green.
5. Resend → API Keys → create one with "Send emails" scope. Copy the key.

### A6 — Create PDF.co account

1. pdf.co → Sign up.
2. Dashboard → API Keys → copy your key.
3. Note your monthly quota — Free tier is small, may need to bump to a paid plan once volume grows.

---

## Phase B — Make scenario · ~45 min

### B1 — Pause v1 (don't delete)

1. make.com → Scenarios → `KISS Insurance Policy Review - Core Pipeline` (id 4581471).
2. Toggle from Active → Paused.
3. Leave it. Rollback insurance per the handoff doc.

### B2 — Import v2 blueprint

1. Make → Create Scenario → ⋯ menu → Import Blueprint.
2. Upload `code/make/blueprint_v2.json`.
3. The scenario imports with placeholder values for the 4 secrets.

### B3 — Replace placeholders

Find and replace these in the imported scenario (search the modules' Body/Headers fields):

| Placeholder | Replace with |
|---|---|
| `SUPABASE_URL` | Your Supabase project URL from A4 |
| `SUPABASE_SERVICE_ROLE_KEY` | Your SERVICE_ROLE key from A4 |
| `RESEND_API_KEY` | Your Resend API key from A5 |
| `PDFCO_API_KEY` | Your PDF.co API key from A6 |

### B4 — Verify connections (v2.2 — important)

The v2.2 blueprint adds two new GPT-4o modules inside the consumer-report router (id 17 Auto, id 18 Residential). Make sometimes drops connection refs on blueprint import.

- Modules 6, 10, 11, **17, 18** (OpenAI calls) — should all point to existing IMTCONN `6008119`. Open each and re-set the connection if blank.
- All HTTP modules — verify auth type is "No Auth" (Supabase/Resend/PDF.co are all keyed via headers in the request).
- Module 8 is a Router. Click into its routes and verify: route 0 has filter `{{7.policy_class}} text:equal "auto"`; route 1 has filter `{{7.policy_class}} text:notequal "auto"`. (Make's filter UI sometimes drops conditions on import — re-enter them by hand if missing.)

### B5 — Activate the scenario

1. Toggle from Paused → Active.
2. **Copy the webhook URL from module 1.** You'll need this for the React form's env var.

---

## Phase C — Frontend (Vercel + GitHub + DNS) · ~60 min

### C1 — Create GitHub repo

1. github.com → Optimizing Group org → New Repository → `kiss-frontend`. Private.
2. Locally:
   ```bash
   mkdir kiss-frontend && cd kiss-frontend
   npm create vite@latest . -- --template react
   npm install
   npm install react-router-dom @supabase/supabase-js
   ```

### C2 — Drop in the React component

1. Copy `code/frontend/KissIntakeForm.jsx` from this project folder into the new project at `src/components/KissIntakeForm.jsx`.
2. Set up routes in `src/App.jsx`:
   ```jsx
   import { BrowserRouter, Routes, Route, useParams } from 'react-router-dom';
   import KissIntakeForm from './components/KissIntakeForm';

   const Branded = () => {
     const { slug } = useParams();
     return <KissIntakeForm slug={slug} />;
   };

   export default function App() {
     return (
       <BrowserRouter>
         <Routes>
           <Route path="/start" element={<KissIntakeForm />} />
           <Route path="/:slug" element={<Branded />} />
         </Routes>
       </BrowserRouter>
     );
   }
   ```
3. `git init && git add . && git commit -m "Initial KISS frontend" && git remote add origin … && git push`.

### C3 — Connect to Vercel

1. vercel.com → Add New Project → Import from GitHub → `kiss-frontend`.
2. Framework preset: Vite.
3. Environment variables (Settings → Environment Variables):
   - `VITE_SUPABASE_URL` → from A4
   - `VITE_SUPABASE_ANON_KEY` → from A4 (the ANON key, not service role)
   - `VITE_MAKE_WEBHOOK_URL` → from B5
4. Deploy. Verify the deploy succeeds.

### C4 — Point DNS

1. Vercel → Project → Settings → Domains → Add `kiss.optimizinggroup.com`.
2. Vercel will give you a CNAME or A record. Add it at your registrar (whoever hosts optimizinggroup.com DNS).
3. Wait for SSL provisioning (~5 min after DNS propagates).

---

## Phase D — End-to-end test · ~30 min

### D1 — Test the consumer route (uses seeded `consumer` tenant)

1. Visit `https://kiss.optimizinggroup.com/consumer` (the seeded slug from `schema.sql`).
2. Fill out the form with your real email + a real homeowners policy PDF (your own works).
3. Check the consent box, submit.

**Verify within 5 minutes:**

- [ ] Supabase → Tables → `submissions` — new row exists with status `completed`
- [ ] Supabase → Storage → `policies` — your PDF is there
- [ ] Make → scenario history — one execution, no errors
- [ ] Supabase → Tables → `reports` — 1 row (consumer report only) for this submission
- [ ] Email arrives at the homeowner email address with the consumer report
- [ ] No partner email (consumer tenant has no partner)

### D2 — Test the broker route

1. Visit `https://kiss.optimizinggroup.com/demo-broker` (seeded broker tenant).
2. Submit again with same/another PDF.

**Verify:**

- [ ] Branding: form shows the demo-broker brand_name and color
- [ ] After submit: 1 submission row, `processing` → `completed`
- [ ] **2** report rows for this submission (consumer + broker)
- [ ] Homeowner gets the consumer email
- [ ] Partner gets a separate email at the demo-broker contact_email, with homeowner CC'd, containing both reports

### D3 — Test the attorney route

1. Visit `https://kiss.optimizinggroup.com/demo-attorney`.
2. Submit again.

**Verify:**

- [ ] Same as broker, but the partner report is the 5-section pre-claim analysis with HIGH/MEDIUM/LOW risk ratings and the legal disclaimer at the end

### D4 — Smoke-check failure modes

Submit one of these intentionally to verify graceful failure:

- A non-PDF file → form should reject before upload
- A 30 MB PDF → form should reject before upload (limit is 25 MB)
- A scanned-image PDF (no extractable text) → Make should fail at module 5 (PDF.co) and ideally email admin@optimizinggroup.com — **if it doesn't, add error handling per § 13 of the handoff doc**

If all of D1–D4 pass: **v2 is production-ready.** If any fail: identify which module errored in Make's history, fix, repeat.

---

## After Phase D — onboarding the first real partner

Per the handoff doc § 12, adding a partner is one SQL insert:

```sql
INSERT INTO tenants (slug, partner_code, persona, brand_name, brand_color, contact_email)
VALUES ('smith-insurance', 'SMITH123', 'broker', 'Smith Insurance Group', '#1A5276', 'john@smith-insurance.com');
```

Then send the partner:

- Their branded URL: `https://kiss.optimizinggroup.com/smith-insurance`
- Their partner code: `SMITH123` (for the generic form fallback)
- A QR code generated from their URL
- A 1-page PDF: "Send this URL or QR to clients. They upload their policy. You and they both get reports by email within 10 minutes."

You mentioned earlier having one Insurance Broker and one Property Attorney already lined up — these become tenants 1 and 2 once Phase D passes.

---

## Critical gaps to address before going live (per § 13 of handoff doc)

These are documented in the handoff but worth flagging here:

1. **No rate limiting on the form.** A bot could spam-submit. **Add Cloudflare Turnstile** to the form before public launch.
2. **PDF.co is a third-party dependency** with its own outages. **Add an error route in Make** that emails admin@optimizinggroup.com when extraction fails so you don't silently lose submissions.
3. **PII handling.** Policy PDFs sometimes contain SSNs, DOBs, dates of birth. **Add a scheduled Make scenario** that deletes Storage objects 90 days after `submission.completed_at`. (Bonus: add a privacy notice on the form's consent checkbox.)
4. **Cost monitoring.** No daily cap. **Add a daily Make scenario** that sums token usage and alerts if over a budget threshold.
5. **Email forwarding intake** (§ 6 of handoff) is described but not built. Form-only is fine for MVP — add this in Phase 1.5.

---

## Don't do these yet (out of scope until first 5 partners are live)

- **Partner portal** (Phase 2). The `tenant_users` table is already in the schema, RLS policies are ready, but no UI exists. Build this once 5+ partners are live and asking for it.
- **Move prompts to a Supabase `prompts` table.** Currently inlined in Make modules. Refactor when you start iterating prompts seriously.
- **Self-hosted PDF extraction** (replacing PDF.co). Not worth the engineering until volume is 500+/month.
- **Switch OpenAI gpt-4o → Claude** for cost. Make has an Anthropic Claude module already used in your Content Surge scenarios — drop-in replaceable when you want to A/B test or save tokens.
