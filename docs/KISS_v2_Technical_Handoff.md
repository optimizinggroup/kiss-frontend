KISS — Keep Insurance Super Simple
Technical Handoff Document — v2.0
Supabase Architecture · No CRM Lock-In · April 30, 2026
Field
Value
Document owner
Keith Kravitz (keith@optimizinggroup.com)
Operating entity
Optimizing Group LLC
Version
v2.0 — replaces v1 GHL-based architecture
Build status
Code complete. Not yet deployed. End-to-end test required before live partner onboarding.
Repository
Files attached separately. No GitHub repo yet — recommend creating one before deploy.
Primary platforms
Supabase (data + storage + auth) · Make.com (orchestration) · Vercel (frontend) · Resend (email) · OpenAI GPT-4o (extraction + report generation) · PDF.co (PDF text extraction)

1. Why This Rebuild
KISS v1 was built around GoHighLevel as both the inbound trigger and outbound CRM destination. In production conversations with target partners (insurance brokers and property attorneys), one constraint became clear: every partner already has their own CRM — Salesforce, AMS360, Clio, MyCase, HubSpot, etc. — and none of them want to migrate or maintain a parallel CRM in GHL just to use a policy review tool.
v2 strips GHL out entirely. KISS is now a self-contained policy review service that delivers branded reports by email. The partner&apos;s existing CRM is left alone. This makes the product easier to sell, easier to operate, and removes the upgrade-fee pressure on the GHL plan.
Architectural changes from v1 to v2:
Trigger: GHL form submission → React intake form on Vercel
Storage: GHL contact records → Supabase (tenants, submissions, reports, email_events tables)
File handling: GHL file URLs → Supabase Storage with signed URLs
Outbound: GHL inbound webhook → Resend email to homeowner + partner
Multi-tenancy: implicit (per GHL location) → explicit (tenants table with persona, branding, contact)
Partner contact: managed in GHL → a contact_email field on each tenant row
2. Current State
Component
Status
React intake form (KissIntakeForm.jsx)
Code complete. Handles both branded slug and generic+code paths.
Supabase schema (supabase_schema.sql)
Code complete. Includes 5 tables, RLS policies, triggers, views, seed data.
Supabase project
NOT created yet. Coworker creates new project under Optimizing Group org.
Supabase Storage &apos;policies&apos; bucket
NOT created yet. Created during Supabase setup.
Make.com scenario v2 (make_blueprint_v2.json)
Blueprint complete. NOT yet imported.
Make.com scenario v1 (id 4581471)
Live but never executed. PAUSE on v2 cutover; do not delete.
Email templates (email_homeowner.html, email_partner.html)
Code complete. Use {{variable}} substitution at Make level.
Resend account + domain verification
NOT done yet. Coworker verifies kiss.optimizinggroup.com DNS.
PDF.co account
NOT done yet. Required for PDF-to-text step (see §7).
Frontend hosting (Vercel)
NOT done yet. Single-page app deployed to kiss.optimizinggroup.com.
DNS (kiss.optimizinggroup.com)
NOT pointed yet. Add CNAME to Vercel after deploy.
Partner portal (Phase 2)
Schema-ready (tenant_users table exists) but UI not built. Out of scope for MVP.
End-to-end test
Not performed.

3. Architecture
3.1 High-level flow
Homeowner → Branded form (kiss.optimizinggroup.com/{slug})
        OR Generic form (kiss.optimizinggroup.com/start) + partner code
        OR Email policy PDF to policies@kiss.optimizinggroup.com
 → React form uploads PDF to Supabase Storage
 → React form inserts row into Supabase &apos;submissions&apos;
 → React fires webhook to Make scenario
 → Make: fetch submission + tenant, sign PDF URL
 → Make: PDF.co text extraction
 → Make: GPT-4o extract structured policy JSON
 → Make: GPT-4o generate consumer report (always)
 → Make: GPT-4o generate broker OR attorney report (if partner)
 → Make: write reports to Supabase &apos;reports&apos; table
 → Make: Resend email to homeowner (consumer report)
 → Make: Resend email to partner with both reports (homeowner CC&apos;d)
 → Make: mark submission &apos;completed&apos;

3.2 Why this architecture
Supabase as single source of truth means we own the data and can grow into a partner portal without migrating.
Tenants are explicit rows — adding a new broker or attorney is one INSERT, no Make scenario changes.
Two intake routes (branded slug, generic+code) cover both partner-driven and self-driven traffic. Same downstream pipeline.
Two reports per partner submission (consumer + professional) means homeowner gets a friendly version they can act on, and the partner gets a tactical version with talking points.
Email-only delivery = no CRM pressure. Partners CC&apos;d on the homeowner email, plus their own copy. They forward, log, or import into whatever CRM they already use.
4. Data Model
Five tables. RLS enabled on all. Make.com uses the SERVICE_ROLE key, which bypasses RLS. The intake form uses ANON key with one INSERT-only policy on submissions and SELECT-by-slug on tenants.
4.1 tenants
One row per partner. Includes branding fields used by both the React form and the email templates.
Column
Purpose
id (uuid PK)
Primary key
slug (text unique)
URL slug for branded form, e.g. &quot;smith-insurance&quot;
partner_code (text unique)
Short code for fallback form, e.g. &quot;SMITH123&quot;
persona
broker | attorney | consumer
brand_name
Display name shown to homeowner
brand_logo_url, brand_color
Branding for form + emails
contact_email
Where partner reports are sent
status
active | paused | disabled
monthly_quota
Soft cap (enforce in Make if needed)

4.2 submissions
One row per intake. Created by the React form (ANON key) before PDF upload. Updated by Make as it progresses.
Column
Purpose
intake_source
branded_form | generic_form | email_inbox
contact_*
Homeowner name, email, phone
property_address, sq_footage, year_built, policy_type
Property metadata used in prompts
pdf_storage_path
Path within &apos;policies&apos; bucket
status
pending → processing → completed | failed
consent_to_review, consent_timestamp
Audit trail for legal disclaimer acceptance

4.3 reports
One or two rows per submission. Consumer tenant: 1 row (consumer report). Broker/attorney tenant: 2 rows (consumer report + professional report). Stores the extracted JSON, the report body, and token usage for cost analysis.
4.4 email_events
Append-only audit log of every email sent, with Resend message ID for bounce / delivery investigation.
4.5 tenant_users
Reserved for Phase 2 partner portal. Not used in MVP. Schema is in place so RLS policies work without modification when the portal is built.
5. React Intake Form
Single component (KissIntakeForm.jsx) handles both routes. Must be deployed under a router that calls the component with the slug prop populated for branded URLs and null for the generic URL.
5.1 Required env vars
VITE_SUPABASE_URL=https://&lt;project-ref&gt;.supabase.co
VITE_SUPABASE_ANON_KEY=&lt;anon key from Supabase Settings → API&gt;
VITE_MAKE_WEBHOOK_URL=&lt;webhook URL from Make scenario module 1&gt;
5.2 Routing setup
Recommended: Vite + React Router. Two routes:
&lt;Route path=&quot;/start&quot; element={&lt;KissIntakeForm /&gt;} /&gt;
&lt;Route path=&quot;/:slug&quot; element={&lt;KissIntakeForm slug={useParams().slug} /&gt;} /&gt;

5.3 What the form does, in order
If slug is provided, fetch tenant by slug and apply branding (logo, color, name).
If no slug, show partner code field; resolve tenant on submit, falling back to &apos;consumer&apos; tenant if blank.
Validate: PDF only, under 25 MB, consent checkbox required.
INSERT into submissions with pdf_storage_path = &apos;pending&apos;.
Upload PDF to Supabase Storage at policies/{tenant_id}/{submission_id}.pdf.
UPDATE submission with the real storage path.
POST to Make webhook with { submission_id }.
Show success screen with personalized timing message.
6. Email Forwarding Path (third intake option)
Some partners prefer to email PDFs rather than using the form. Setup:
Create policies@kiss.optimizinggroup.com as a Google Workspace alias under Optimizing Group.
In Make, create a SECOND scenario triggered by Gmail &quot;Watch Emails&quot; on this inbox.
That scenario: parse sender → resolve tenant by sender email match against tenants.contact_email → upload attachment to Supabase Storage → INSERT submission with intake_source=&apos;email_inbox&apos; → fire the SAME v2 webhook with the new submission_id.
This is a Phase 1.5 build — get the form live first, add the inbox after the first partner is running clean.
7. PDF-to-Text Extraction
This was the single largest gap in v1 and remains the most fragile part of v2. PDFs cannot be fed directly into GPT-4o as raw bytes — they must be converted to text first.
Option
Pros / Cons
PDF.co (recommended for v2)
Pros: simple REST API, handles scanned + native PDFs, Make module exists. Cons: ~$0.005-0.02/page, third-party dependency.
CloudConvert
Pros: alternative provider, similar API. Cons: same cost profile.
Self-host (pdftotext / pdfplumber)
Pros: zero per-extraction cost. Cons: requires a small Node/Python service hosted on Railway or Vercel functions; doesn&apos;t handle scanned PDFs without OCR.
GPT-4o native PDF input
Pros: simplest. Cons: requires using the Files API + vision; not available via Make&apos;s openai-gpt-3 module today, would need direct HTTP.

Recommendation for MVP: PDF.co. Switch to self-hosted extraction once volume justifies it (&gt;500/mo).
8. Make.com Scenario (v2)
Field
Value
Blueprint file
make_blueprint_v2.json (attached)
Trigger
Custom webhook, body: { submission_id: &lt;uuid&gt; }
Modules
16 (vs 18 in v1)
Org / Team
Org 5587731, Team 1524441 (us2.make.com)
v1 scenario disposition
Pause scenario id 4581471. Do not delete (rollback insurance).
OpenAI connection
Reuse existing IMTCONN 6008119
Estimated cost per submission
$0.10–0.50 (OpenAI tokens dominate)

8.1 Module-by-module
#
Module
Purpose
1
gateway:CustomWebHook
Receive { submission_id }
2
http:MakeRequest GET
Fetch submission row + joined tenant from Supabase REST
3
http:MakeRequest PATCH
Mark submission status=&apos;processing&apos;
4
http:MakeRequest POST /storage/v1/object/sign
Generate 10-min signed URL for the PDF
5
http:MakeRequest POST pdf.co
Convert PDF to plain text
6
openai:createModelResponse (gpt-4o, t=0.1)
Extract structured policy JSON
7
json:ParseJSON
Validate JSON
8
openai:createModelResponse (gpt-4o, t=0.3)
Generate consumer report (always runs)
9
builtin:BasicRouter
Branch by tenants.persona
10
openai:createModelResponse (broker filter)
Generate broker advisory (5 sections)
11
openai:createModelResponse (attorney filter)
Generate attorney pre-claim analysis (5 sections + disclaimer)
12
util:SetVariables (consumer filter)
Skip partner email path
13
http:MakeRequest POST /rest/v1/reports
Bulk insert 1-2 report rows
14
http:MakeRequest POST resend.com/emails
Email homeowner with consumer report
15
http:MakeRequest POST resend.com/emails (filter: persona != consumer)
Email partner with both reports, homeowner CC&apos;d
16
http:MakeRequest PATCH submission
Mark status=&apos;completed&apos;

9. Email Templates
Two HTML templates in /home/claude/kiss-v2 (attached):
email_homeowner.html — sent to the homeowner. Uses tenant brand_color in the header band; brand_name in the header text. Includes the consumer report and a partner-CTA box.
email_partner.html — sent to broker/attorney with the homeowner CC&apos;d. Includes a submission summary block, the partner-specific report, the consumer report (so the partner knows what the homeowner saw), and a suggested-next-step framing.
Variable substitution happens in the Make module 14 / 15 &apos;rawContent&apos; field via {{tenant.brand_color}}, {{contact_name}}, {{report_body}}, etc. Do not store templates in Resend&apos;s UI — keep them in the Make modules so they version-control with the rest of the scenario.
10. Environment &amp; Credentials
Service
Identifier
Make Org / Team
5587731 / 1524441 (us2.make.com)
Make Owner Email
keith@optimizinggroup.com
Make AI Dev Email
AIdeveloper@optimizinggroup.com
OpenAI Make connection (IMTCONN)
6008119 (reuse)
Supabase Project
TO BE CREATED — under Optimizing Group org, name &apos;kiss-prod&apos;
Supabase URL
Filled after creation: https://&lt;project-ref&gt;.supabase.co
Supabase ANON key
Filled after creation
Supabase SERVICE_ROLE key
Filled after creation (NEVER expose to frontend)
Resend account
TO BE CREATED — verify kiss.optimizinggroup.com domain (DKIM, SPF, DMARC)
PDF.co account
TO BE CREATED — copy API key into Make
Vercel project
TO BE CREATED — connect to GitHub repo (also TBD)
Domain
kiss.optimizinggroup.com — CNAME to Vercel after deploy

11. Deployment Steps (in order)
Phase A — Backend (Supabase + Resend + PDF.co)
Create Supabase project under Optimizing Group org. Region: US East.
In SQL Editor, run supabase_schema.sql in full. Verify 5 tables + 2 views created.
In Storage, create &apos;policies&apos; bucket. Private, 25 MB limit, application/pdf only.
In Storage policies: ANON role can INSERT; only SERVICE_ROLE can SELECT (the form needs INSERT, Make signs URLs server-side).
Copy Project URL, ANON key, SERVICE_ROLE key from Settings → API.
Create Resend account. Add kiss.optimizinggroup.com domain. Add the 3 DNS records (DKIM, SPF, DMARC) at the registrar. Wait for verification (usually &lt;1 hour).
Create PDF.co account. Copy API key.

Phase B — Make scenario
In Make, pause v1 scenario id 4581471 (do not delete).
Create new scenario. Import make_blueprint_v2.json.
Replace the 4 placeholders: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, PDFCO_API_KEY.
Reuse existing OpenAI connection (IMTCONN 6008119).
Copy the webhook URL from module 1.
Activate the scenario but leave it &apos;sequential: false&apos; (parallel processing OK for this workload).

Phase C — Frontend
Create GitHub repo &apos;kiss-frontend&apos; under Optimizing Group org.
Initialize Vite + React + React Router project. Drop in KissIntakeForm.jsx.
Add /start and /:slug routes (see §5.2).
Add @supabase/supabase-js dependency.
Connect repo to Vercel. Set the 3 env vars in Vercel project settings.
Deploy. Add custom domain kiss.optimizinggroup.com — point CNAME at registrar.

Phase D — Test
Visit kiss.optimizinggroup.com/consumer (uses seeded consumer tenant).
Submit a real homeowners policy PDF with your own email.
Verify: submission row created, PDF in Storage, Make scenario fired, both Make and Supabase show &apos;completed&apos;, email arrives within 5 minutes.
Visit kiss.optimizinggroup.com/demo-broker. Submit again. Verify TWO reports stored, partner email lands at admin@optimizinggroup.com with homeowner CC&apos;d.
Repeat for kiss.optimizinggroup.com/demo-attorney.
Only after all three test paths work end-to-end: insert real broker/attorney tenant rows and start partner onboarding.
12. Onboarding a New Partner
Once live, adding a partner is a single SQL insert plus a quick communication:
INSERT INTO tenants (slug, partner_code, persona, brand_name, brand_color, contact_email)
VALUES (&apos;smith-insurance&apos;, &apos;SMITH123&apos;, &apos;broker&apos;, &apos;Smith Insurance Group&apos;, &apos;#1A5276&apos;, &apos;john@smith-insurance.com&apos;);
Then send the partner:
Their branded URL: kiss.optimizinggroup.com/smith-insurance
Their partner code: SMITH123 (for the generic form fallback)
A QR code generated from the branded URL (free QR generators are fine)
A short instructions PDF: &quot;Send this URL or QR to clients. They upload their policy. You and they both get reports by email within 10 minutes.&quot;
13. Known Gaps &amp; Risks
Critical (must address before going live):
End-to-end test has not happened. Run Phase D before any real partner traffic.
PDF.co is a third-party dependency with its own outages. Add an error route in Make that emails admin@optimizinggroup.com on extraction failure.
No rate limiting on the intake form. A malicious actor could spam-submit. Mitigation: add Cloudflare Turnstile to the form before launch.

High priority (within first month of operation):
Email forwarding intake (§6) is described but not built. Form-only is fine for MVP.
No partner portal. Partners can&apos;t see history or download past reports — they only have what&apos;s in their email. Build Phase 2 portal once 5+ partners are live.
Monthly quota field exists but isn&apos;t enforced. Add a Make filter on the v2 scenario to fail fast if a tenant is over quota.
Prompts are inline in Make. Move to a &apos;prompts&apos; Supabase table with versioning before doing any meaningful prompt iteration.

Medium priority:
PII handling: policy PDFs contain SSNs / DOBs in some carrier formats. Confirm storage retention policy. Recommend a scheduled Make scenario that deletes Storage objects 90 days after submission.completed_at.
Cost monitoring: no cap. Add a daily Make scenario that queries SUM(token_usage-&gt;&gt;&apos;total_tokens&apos;) and alerts if over budget.
Email deliverability: Resend is good but bounces can climb if partners enter typo&apos;d contact emails. Watch the email_events.status field.
14. Rollback Plan
If v2 fails in production:
Pause Make v2 scenario.
Re-activate Make v1 scenario id 4581471.
Take the React form offline (set Vercel deployment to maintenance page) — v1 expects GHL form submission, not a Supabase webhook.
Manually email any pending homeowner from the Supabase submissions table (status=&apos;pending&apos;).
v1 is functional but untested. Treat rollback as last resort, not a clean fallback.
15. Appendix — Files Attached
File
Purpose
supabase_schema.sql
Run in Supabase SQL Editor. Creates all tables, indexes, RLS, views, seed data.
KissIntakeForm.jsx
React component. Drop into a Vite + React Router project under /pages or /components.
make_blueprint_v2.json
Make scenario blueprint. Import via Make → New Scenario → Import Blueprint.
email_homeowner.html
Reference template for homeowner email. Substitute via Make module 14.
email_partner.html
Reference template for partner email. Substitute via Make module 15.

Document generated 2026-04-30 from architecture decisions made on the same date. If the Supabase schema or Make blueprint is edited after this date, this document is the historical record — re-fetch the live versions before relying on the module-by-module section.
