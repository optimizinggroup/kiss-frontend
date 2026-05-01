# KISS — Product Specification (Canonical)

This is the source of truth for what KISS is and what its output looks like. Anything in earlier docs (sales page, nurture sequences, prompts) that conflicts with this spec should be updated to match.

---

## What KISS is

**KISS** stands for **Keep Insurance Super Simple**.

KISS is a tool that helps property owners — homeowners, auto policyholders, and commercial property owners — better understand their insurance policies. It tells them, in plain English, what is covered, what is not covered, and what they should do about it.

For each policy reviewed, KISS produces a 1–3 page report that:

1. **Decodes the policy** — translates the dense legalese of declarations pages, exclusions, and endorsements into language a 5th grader can understand.
2. **Identifies the coverage status** — calls out whether the policyholder is **underinsured**, **adequately covered**, or **overinsured** in each category.
3. **Surfaces the buried risks** — exclusions and endorsements (the things hidden in the fine print) that materially affect what the policy will and won't pay at claim time.
4. **Recommends what to do** — concrete suggestions to maximize coverage value (which coverages are worth keeping/adding/dropping based on cost vs. risk).

The report is **color-coded** so the homeowner can scan it in 30 seconds:

- 🟢 **Good** — coverage is sufficient and well-priced for the risk
- 🟡 **Sufficient** — covered, but worth a closer look or upgrade discussion
- 🔴 **Needs Attention** — significant gap, exclusion exposure, or unnecessary cost

## What KISS is NOT

- KISS is **not** legal advice. The reports include this disclaimer prominently.
- KISS is **not** an insurance broker. KISS does not sell, recommend, or place policies. (When deployed under a broker's branding, the broker is the licensed party making any specific recommendations; KISS is the analysis tool.)
- KISS is **not** a public adjuster service. KISS reviews policies pre-loss as an educational tool. Keith Kravitz, the founder, is separately a Florida-licensed public adjuster — KISS is built with that domain expertise but is not itself a public adjusting service. When deployed under an attorney's branding, no claims-handling or adjusting occurs through KISS.
- KISS is **not** a guarantee of accuracy. AI-generated analysis is provided as a convenience and does not replace consultation with a licensed professional. The intake and email disclaimers state this explicitly.

## Real-world examples KISS catches

These are the kinds of buried, common, expensive problems KISS is built to surface — drawn from the founder's experience as a public adjuster reviewing claims:

**Property (residential & commercial):**

- **Hurricane deductible too high relative to liquid savings.** A 5% hurricane deductible on a $400K home is $20K out of pocket before insurance pays anything — and most homeowners learn this only when the storm hits. KISS flags this 🔴 and suggests considering a 2% deductible if the premium math supports it.
- **Flood policy with no contents coverage.** Standard NFIP flood policies cover the structure but not the contents — you have to add it separately. After a flood, the owner watches the building get repaired but has no money for furniture, appliances, or possessions. KISS flags this 🔴.
- **Sinkhole excluded entirely.** Florida policies often exclude sinkhole coverage unless specifically purchased back via endorsement. KISS flags this 🟡 with a recommendation if the property is in a known sinkhole zone.
- **Roof age limiting coverage type.** Many FL carriers convert older roofs from Replacement Cost to Actual Cash Value, which means a roof claim pays a depreciated amount. KISS surfaces the policy language and flags 🔴 with a recommendation to pursue a wind mitigation inspection or budget for re-roof.
- **Underinsured for current rebuild costs.** Florida rebuild is $200-250/sq ft in 2026. A policy still showing $150/sq ft dwelling coverage from 2020 leaves a real gap. KISS calculates the gap explicitly and flags 🔴.
- **Mold capped at $10K.** Standard policies cap mold at $5K-$10K. After water damage that goes a few weeks without repair, mold remediation can run $30K-$50K. KISS surfaces the cap and flags 🟡 with a buy-up suggestion.

**Auto:**

- **No Uninsured Motorist (UM/UIM).** About 1 in 4 Florida drivers is uninsured or underinsured. Without UM, your policy doesn't cover injuries caused by them. KISS flags 🔴 with stacking explanation.
- **PIP at $10K minimum.** Florida's no-fault PIP statute requires only $10K, which one ER visit can exhaust. KISS flags 🟡 with a buy-up suggestion.
- **Bodily Injury liability at FL minimum.** Florida technically doesn't require bodily injury liability (only PIP and PD). Many drivers carry no BI or low BI — exposing personal assets if they cause injury to others. KISS flags 🔴 with explicit asset exposure framing.
- **No MedPay coverage.** Pays for medical bills regardless of fault, on top of PIP. Cheap to add, often missing. KISS flags 🟡.
- **No rental coverage.** Two weeks in a rental can be $700-$1,400 out of pocket. KISS flags 🟡.
- **Stacked-rejected UM.** FL-specific. The owner waived stacking at signup (often without understanding) and lost out on multi-vehicle multiplied UM coverage. KISS flags 🟡.

The list above is illustrative, not exhaustive. The prompt logic should be tuned to detect any of these patterns plus others as Keith's domain expertise identifies them.

## Output format specification

### Structure

Every consumer report — auto or property — has the same skeleton:

1. **Header band** — Tenant brand color, brand logo if provided, brand name. "Insurance Policy Review for [Homeowner Name]"
2. **Executive summary box (top)** — One paragraph at 5th-grade reading level summarizing the headline finding. *"Your policy is mostly good, but there are 2 things you need to fix soon and 1 you might want to look at."*
3. **At-a-glance table** — Each major coverage line as a row: coverage type · current amount · status emoji + color badge · one-line plain-English explanation
4. **Detailed sections (one per significant finding)** — Each detail has:
   - Status pill (🟢 / 🟡 / 🔴)
   - Plain-English headline ("Your hurricane deductible is high")
   - 2-3 sentence explanation of what it means in real dollars and real life
   - Recommendation ("Talk to your agent about lowering it to 2% — your premium would go up by about $15/month, but you'd save $10K out-of-pocket if a hurricane hits.")
5. **Three concrete next steps** — Numbered. 1: most urgent fix. 2: do before peak season. 3: do at next renewal.
6. **Disclaimer footer** — Required by law (see florida-bar-compliance.md when deployed under attorney branding)

### Reading level

Target **Flesch-Kincaid Grade 5** (~10-11 year old comprehension level).

Practical rules for the prompt:
- Use words from the most common 1,500 English words. Replace "deductible" with "what you pay before insurance kicks in" the first time. After that you can use the term but in context.
- Sentences average 10-15 words.
- One idea per sentence.
- Active voice ("Your policy covers $300,000 of damage" not "Damage is covered up to $300,000 by your policy").
- Concrete dollar examples instead of abstract percentages where possible.
- Replace any multi-syllable insurance term with its plain-English explanation. Examples:
  - "endorsement" → "an add-on to your policy"
  - "exclusion" → "things your policy will not pay for"
  - "subrogation" → don't use it. Re-explain.
  - "uninsured motorist" → "if you're hit by someone with no insurance"
  - "underinsured motorist" → "if you're hit by someone whose insurance isn't enough"
  - "named insured" → "the person on the policy"
  - "loss of use" → "money to live somewhere else if your house is uninhabitable"

### Length

**1-3 pages of styled output** — roughly **800-1,400 words** depending on how many findings the policy generates. Simpler policies with fewer issues land at 1 page; more complex policies with more findings land at 2-3 pages.

The Make scenario doesn't enforce hard length; the prompt should target this range and be allowed to expand for genuinely complex policies. But cut filler — every sentence earns its place.

### Color-coding rules (precise)

Every finding gets exactly one of three statuses. The prompt should be unambiguous:

| Status | When to use | Visual |
|---|---|---|
| 🟢 **Good** | Coverage meets or exceeds typical recommendations for the property type and Florida-specific risks. No action needed. | Green pill, `#10b981` background |
| 🟡 **Sufficient** | Covered but with caveats — could be improved at next renewal, or the limit/deductible is at the edge of acceptable. Worth a conversation. | Amber pill, `#f6c66c` background |
| 🔴 **Needs Attention** | Significant gap, exposure, or buried exclusion that could cause material out-of-pocket loss at claim time. Should be addressed before next loss event. | Red pill, `#ef4444` background |

The status drives the visual prominence of the finding. The prompt must give a status to every finding it generates, and the email template renders accordingly.

### HTML structure for the report

The Make module generating this report should output HTML (not plain text) so color coding renders directly in the email. Suggested structure:

```html
<div class="kiss-report">
  <div class="kiss-summary">
    <h2>Your Insurance Policy Review</h2>
    <p>[Executive summary at 5th-grade reading level — 2-3 sentences]</p>
  </div>

  <div class="kiss-glance">
    <h3>At a glance</h3>
    <table>
      <tr><td>Dwelling Coverage</td><td>$300,000</td><td><span class="status green">🟢 Good</span></td><td>Enough to rebuild based on FL costs.</td></tr>
      <tr><td>Hurricane Deductible</td><td>5% / $20,000</td><td><span class="status red">🔴 Needs Attention</span></td><td>This is high. You'd pay $20K out of pocket before help arrives.</td></tr>
      <!-- ... -->
    </table>
  </div>

  <div class="kiss-findings">
    <div class="kiss-finding red">
      <h4>🔴 Your hurricane deductible is high</h4>
      <p>[2-3 sentences in plain English]</p>
      <p><strong>What to do:</strong> [Concrete recommendation]</p>
    </div>
    <!-- ... more findings ... -->
  </div>

  <div class="kiss-next-steps">
    <h3>What to do next</h3>
    <ol>
      <li>[Most urgent action]</li>
      <li>[Before peak season]</li>
      <li>[At next renewal]</li>
    </ol>
  </div>
</div>
```

The email template wraps this with the tenant's brand color band, brand name, contact info, compliance footer, etc.

## Domain expertise — why this works

KISS is built on real public-adjuster pattern recognition, not generic AI summarization.

Keith Kravitz, founder of Optimizing Group LLC, brings to KISS:

- **Florida-licensed public adjuster** — represents policyholders (not insurers) when claims happen
- **14,000+ property damage claims** of direct involvement, spanning residential and commercial
- **Founder of a property-damage litigation support company** — worked alongside attorneys on contested claims, depositions, and trial support; knows the attorney-side workflow from the inside

This is the kind of operating experience you can't fake with generic AI tooling. Public adjusters and litigation support specialists spend their careers seeing exactly which exclusions, endorsements, deductibles, and coverage gaps cause real out-of-pocket pain at claim time — and what gets denied, underpaid, or litigated. KISS encodes that pattern recognition.

This is the reason the prompts can be aggressive about flagging specific real-world issues rather than generic "review your policy with your agent" boilerplate. The illustrative examples in this doc come directly from that 14,000-claim experience base.

**Marketing implication:** "Built by a Florida public adjuster with 14,000+ property damage claims of experience" is the single strongest credibility line in the sales pitch. It moves KISS from "another AI tool" into "an expert system encoded by a domain expert" — completely different category in an attorney's mind. Use it.

## Accuracy validation plan

Before any branded attorney deployment goes live, KISS reports must be tested against real policies that Keith provides:

1. **Sample policies (Keith provides).** Real residential, commercial, and auto policies with known coverage gaps that Keith can identify in advance.
2. **Run each through the pipeline.** Generate the consumer report.
3. **Compare to Keith's expert assessment.** Does the report catch the gaps Keith would catch? Does it miss anything? Does it over-flag?
4. **Iterate the prompt.** Adjust based on findings. Document each iteration.
5. **Acceptance criteria:** zero false negatives on critical issues (under-insurance, missing UM, hurricane deductible too high, flood exclusions, etc.). Less than 10% false positives on lower-importance items. Reading level Flesch-Kincaid Grade ≤ 6 verified by automated check.

This is the gating step before Phase D end-to-end testing in `01-next-steps.md`. Add it as Phase D.0.

## Public adjuster compliance note

Keith's public adjuster license is governed by Florida Statutes 626.854 and DFS regulations. Important boundaries:

- **KISS is not adjusting claims.** KISS is pre-loss policy education. There is no claim being negotiated through KISS — that's specifically what a public adjuster does post-loss for compensation. KISS therefore does not require a PA license to operate.
- **Marketing positioning of Keith's PA credential** is fine and accurate ("built by a Florida-licensed public adjuster") but should not imply that KISS provides public adjusting services.
- **Cross-sell to PA services is fine** but separate. If a homeowner who used KISS later has a real claim, Keith's PA practice can take that on as a separate engagement under the standard PA compensation rules. The two businesses are clearly distinct.
- **Solicitation timing rules under 626.854(15)** — Florida prohibits public adjusters from soliciting business within certain windows after a loss. KISS's pre-loss focus is well outside this restriction. No issue.

## Renewal tracking — the lifetime relationship feature

KISS extracts the policy effective and expiration dates from every review and stores them in the `submissions` row. **30 days before expiration, an automated email goes to the client under the partner firm's brand**, reminding them to upload the renewed policy. This perpetuates the relationship year over year.

### Why this matters

Without renewal tracking, KISS is a one-shot lead-magnet — the homeowner uses it once, gets a report, and forgets. With renewal tracking, every annual policy cycle becomes a fresh touchpoint, the same email subscriber gets re-engaged organically, and the partner firm stays top-of-mind perpetually. The database compounds in value year over year because each renewed review can compare against the prior year's findings ("last year your dwelling limit was already a little behind rebuild costs — this year it's worse, here's why").

For partner firms, this changes the economics:

- Year 1: 500 tokens → 500 onboarded clients
- Year 2: same ~500 clients submit renewed policies (assuming 80%+ retention with active opt-in) → 400 tokens spent, no new lead acquisition cost
- Year 3 onward: similar; minimum-incremental token spend per client per year
- Net effect: the cost-per-client-relationship-per-year drops dramatically after Year 1

### Architecture implications

**Schema changes (additive, non-breaking):**

```sql
ALTER TABLE submissions
  ADD COLUMN policy_effective_date DATE,
  ADD COLUMN policy_expiration_date DATE,
  ADD COLUMN renewal_reminder_sent_at TIMESTAMPTZ,
  ADD COLUMN parent_submission_id UUID REFERENCES submissions(id);

CREATE INDEX idx_submissions_renewal_due
  ON submissions(policy_expiration_date)
  WHERE status = 'completed' AND renewal_reminder_sent_at IS NULL;
```

The `parent_submission_id` field links a renewed review to the prior year's submission so the report-generation prompt can do year-over-year comparison.

**Make scenario changes:**

The existing v2 Make scenario already extracts `policy_effective_date` and `policy_expiration_date` in the policy data extraction step (it's in the JSON schema the prompt produces). What's needed:

1. **Update module 13** (Supabase reports insert) to also UPDATE the parent submission row with `policy_effective_date` and `policy_expiration_date` from the extraction step.

2. **Add a new scheduled scenario** — runs daily at 9:00 AM ET. Let's call it "KISS - Renewal Reminders." Module flow:
   - Module 1: Daily timer trigger
   - Module 2: HTTP GET Supabase REST query — `submissions?status=eq.completed&consent_status=eq.active&renewal_reminder_sent_at=is.null&policy_expiration_date=gte.{today+30d}&policy_expiration_date=lte.{today+35d}`
   - Module 3: Iterator over results, joining tenant data
   - Module 4: HTTP POST to Resend with the renewal reminder email body (per-tenant branded)
   - Module 5: HTTP PATCH to Supabase setting `renewal_reminder_sent_at = NOW()`
   - Module 6: HTTP POST to `email_events` table for audit

**Email template addition:** A new template — see `KISS/code/emails/email_renewal_reminder.html` (to be created). Same branding pattern as the homeowner template, but the subject and body emphasize renewal action rather than a fresh report.

### Edge cases

- **Multi-year commercial policies** (3-year terms exist for some BOPs and CGLs). Handle correctly — the expiration date is the actual expiration, not a 12-month assumption. The schema captures the actual date so the reminder fires correctly regardless.
- **Auto policies that renew every 6 months.** Some FL auto carriers run 6-month policy terms. The renewal reminder fires 30 days before whatever the actual expiration is.
- **Failed extraction of expiration date.** If GPT-4o couldn't parse the expiration date from the policy PDF, the `policy_expiration_date` field is NULL. Those submissions never trigger a reminder. Acceptable failure mode — log for review.
- **Client unsubscribed.** The `consent_status=eq.active` filter excludes unsubscribed clients. They never get renewal reminders.
- **Client uploaded a renewal early.** When a renewed submission is created, a Make rule should mark the prior submission's `renewal_reminder_sent_at = NOW()` (even if the reminder didn't fire) so we don't double-remind.

### Year-over-year comparison in report generation

When `parent_submission_id` is set, the report-generation prompt (residential or auto) should be augmented to include the prior year's findings. Suggested prompt addition:

> "This is the same client's renewed policy. Last year's review identified: [list of last year's 🔴 and 🟡 findings]. Compare this year's policy to last year's. Note items that improved (call out as 🟢 with a "fixed since last year" badge), items that stayed the same (carry forward), and any new gaps. End the report with a short summary: 'Compared to last year, X items improved, Y stayed the same, Z are new.'"

This is what makes year-over-year valuable — the comparison is the upsell hook for year 2 onward.

## Versioning

This is product spec **v2.2** (April 30, 2026). Adds renewal-tracking architecture to v2.1. If the spec changes, bump the version here and update:

- `code/prompts/` consumer report prompt files (TBD — to be created next)
- `marketing/nurture-sequences/` Email 1 (which delivers the report) for any structural change
- `sales-page/kiss-for-attorneys.html` if any user-facing description of the output changes
- `00-current-status.md` if the architecture implications change

## Out of scope for v2.1

These are explicitly NOT in the v2.1 product:

- **Multi-language support.** English only at launch. Spanish is a logical Phase 1.5 addition for South FL market.
- **Audio/video output.** Email + PDF only. No "watch a video summary of your policy" feature.
- **Real-time policy comparison.** ("Here are 3 carriers offering better coverage for less.") That's a broker product, not a KISS feature.
- **Claim filing assistance.** KISS is pre-loss only. Post-loss claim help is Keith's PA business or a partner attorney, not KISS.
