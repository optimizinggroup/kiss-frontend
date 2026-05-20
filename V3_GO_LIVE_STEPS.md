# KISS v3 — Go-Live Steps (Two-Scenario Architecture)

This refactor splits the broken single-scenario flow into two independent
Make scenarios. Done correctly, this is the **last** import dance.

**Total time for Keith: ~10 minutes.**

---

## What changed (architecture)

- **Step 1 form** (`/:slug`) captures the lead's contact + property info.
  Fires the **Lead Capture** webhook → inserts row to Supabase →
  Resend welcome email with a Step 2 link → redirects user to Step 2.
- **Step 2 form** (`/:slug/upload/:submissionId`) uploads the actual
  policy PDF. Fires the **Policy Review** webhook → PDF.co extracts text
  → Claude generates consumer + partner reports → emails delivered.
- Each scenario gets its data via the webhook payload — no Supabase
  fetch + parse step. That's what was failing for hours yesterday.

---

## Step 1 — Create the new Lead Capture scenario in Make (3 min)

1. Open https://us2.make.com/1524441/scenarios
2. Click **Create a new scenario** (top right)
3. In the empty canvas, click **⋯** (top right) → **Import blueprint**
4. Choose file: **`~/Downloads/kiss_lead_capture.json`**
5. The scenario imports with **3 modules**: Webhook → Supabase insert →
   Resend email
6. Click **Save** (disk icon, bottom-left toolbar)
7. Toggle the scheduling to **"Immediately as data arrives"** (toggle
   left of "Run once" button)
8. **Click into module 1** (the webhook) → **copy the webhook URL** —
   it'll look like `https://hook.us2.make.com/<something>`
9. **Paste that URL back to me in chat** — I'll set it in Vercel and
   redeploy. (Don't share it publicly; it's safe to paste in our
   private chat.)
10. **Toggle scenario ON** (top right of the scenario detail page)

---

## Step 2 — Re-import the Policy Review scenario (3 min)

This reuses your existing scenario **4926552** so the webhook URL stays
the same — no Vercel change needed for this one.

1. Open https://us2.make.com/1524441/scenarios/4926552/edit
2. ⋯ → **Import blueprint** → **`~/Downloads/kiss_policy_review.json`**
3. **Save** (disk icon)
4. Toggle scheduling to **"Immediately as data arrives"** if it isn't
   already
5. **Don't click into any modules** — just save and toggle ON
6. **Toggle scenario ON** (top right)

---

## Step 3 — Test (3 min)

Wait until I confirm the Lead Capture webhook URL is set in Vercel and
the form is redeployed. Then:

1. Visit `https://kiss-app-optimizing-group.vercel.app/great-law-firm`
2. Fill in Step 1: your info + select policy type
3. Click **Continue to Step 2**
4. You should receive a **welcome email** within 30 seconds
5. On Step 2, upload any homeowners policy PDF, click Submit
6. Within 5 minutes you should receive the **full review email**
7. A partner copy goes to `admin@optimizinggroup.com`

---

## Why this is reliable for white-label clients

- **Two failure surfaces.** If the heavy pipeline (Claude / PDF.co)
  goes down for any reason, leads still get captured by Scenario 1.
  No outage that loses business.
- **No Make HTTP-parsing bug.** Both scenarios pull data from the
  webhook payload directly, not from a Supabase fetch step. The
  `application/vnd.pgrst.object+json` Content-Type that broke yesterday
  is no longer in the flow.
- **Email nurture is possible.** Submissions with `status='lead_captured'`
  are eligible for follow-up emails ("Hey, you started a review and
  never uploaded — here's how to get your full policy").
- **Each scenario is small.** Lead Capture is 3 modules. Policy Review
  is 16 modules but with no router branches that depend on response
  parsing. Easier to debug if anything ever breaks.

---

## Files

- Lead Capture blueprint: `~/Downloads/kiss_lead_capture.json`
- Policy Review blueprint: `~/Downloads/kiss_policy_review.json`
- This doc: committed at `KISS/V3_GO_LIVE_STEPS.md`
- Updated form: deployed to https://kiss-app-optimizing-group.vercel.app
