# GHL Configuration — KISS

## Sub-account

- **Name:** Insurance Secrets
- **Location ID:** `qfI13jGQlbeVhXEEixmm`
- **Workflow ID (existing):** `2c316a95-1cd9-4b7e-b108-cee27e8d4af2`
- **Private Integration Token:** see `ghl-secrets.local.md` (gitignored — not in this folder by default; create it locally if needed)

> ⚠️ **Secret handling.** The Private Integration Token is sensitive. It's kept in a separate file you create yourself (`ghl-secrets.local.md`) so it doesn't end up in version control or AI memory. If that file isn't there, you'll find the value in the source PDF at `KISS/docs/KISS Insurance Policy Review - Pipeline Configuration.pdf` (page 3).

## What's already built in GHL (per the prior session's work)

- The "Insurance Secrets" sub-account exists.
- A workflow with ID `2c316a95-1cd9-4b7e-b108-cee27e8d4af2` is created (purpose not fully clear from the docs — could be the form-submitted → trigger Make workflow, or the report-received → email-customer workflow, or a stub).

## What still needs to be built in GHL — Phase 1 (Consumer $4.99)

### 1. Stripe product
- **Product name:** KISS Policy Review
- **Price:** $4.99 one-time
- **Status:** test/sandbox link exists at `https://buy.stripe.com/test_fZucN42T0eNgaq04w93Je03` — not yet promoted to production

### 2. Stripe ↔ GHL connection
- GHL Insurance Secrets sub-account → Settings → Integrations → Stripe → Connect

### 3. Funnel: "KISS Policy Review" — 3 steps

**Step 1: Landing page** ("Sales page")
- Headline: "Is Your Insurance Actually Protecting Your Home?"
- Subhead: "Get a plain-English review of your policy for just $4.99"
- Benefits: coverage gap analysis, savings opportunities, action items
- CTA → Step 2

**Step 2: Order form** (Stripe payment + contact info)
- Add product: KISS Policy Review ($4.99)
- Collect: Name, Email, Phone
- On submit → Step 3

**Step 3: Upload form**
GHL form with these fields:
- Property Address (text)
- Square Footage (number)
- Year Built (number)
- Policy Type (dropdown: HO-3, HO-6, DP-3, Other)
- Upload Policy Document (file upload)

Form configuration:
- **Webhook URL:** `https://hook.us2.make.com/6tvcwb2d2b7nuimiewpfe6rw1g11u97y`
- **Hidden fields to include in webhook:**
  - `tenant_persona = "consumer"`
  - `tenant_name = "KISS Policy Review"`

### 4. Form → Webhook field mapping

| Webhook field | Source |
|---|---|
| `contact_name` | Form: Full Name |
| `contact_email` | Form: Email |
| `contact_phone` | Form: Phone |
| `property_address` | Form: Property Address |
| `policy_type` | Form: Policy Type |
| `sq_footage` | Form: Square Footage |
| `year_built` | Form: Year Built |
| `file_url` | Form: Upload Policy Document (GHL provides hosted URL) |
| `tenant_persona` | Hidden: `"consumer"` |
| `tenant_name` | Hidden: `"KISS Policy Review"` |
| `ghl_contact_id` | Auto: `{{contact.id}}` |
| `ghl_webhook_url` | Hidden: `""` (empty — consumer route doesn't call back) |

## Phase 2 — White-label brokers/attorneys (later)

When you onboard the first broker or attorney, you'll create a **separate GHL sub-account** for them (cloned from the Insurance Secrets template) and:

1. Set hidden form fields to `tenant_persona = "broker"` (or `"attorney"`) and `tenant_name = "[Broker/Attorney Name]"`.
2. Provide a `ghl_webhook_url` pointing to that sub-account's inbound webhook for report delivery.
3. Build two workflows in that sub-account:
   - **Form Submitted → Trigger Make** (POST to KISS webhook)
   - **Report Received → Deliver to Consumer** (triggered by Make's POST back; updates contact, sends email)
4. Build the 30/60/90 day nurture sequence (broker version: coverage opportunities, renewal awareness, market update; attorney version: storm season, regulatory changes, soft re-engagement).

The doc `KISS/docs/Insurance Policy Review KISS App.pdf` (the original Cowork transcript) has the detailed copy and field specs for Phase 2.

## Custom fields (likely needed in any sub-account that uses KISS)

| Field Name | Type | Required |
|---|---|---|
| Policy Type | Dropdown: Residential / Commercial / Auto | Yes |
| Coverage Type | Dropdown: HO3, HO4, HO6, HO8, Renters, NFIP Flood, Windstorm, BOP, CGL | Yes |
| Property Address | Text | Yes |
| Sq Footage | Number | Yes |
| Year Built | Number | Yes |
| Policy File URL | Text | Yes |
| Tenant Persona | Dropdown: broker / attorney / consumer | Yes |
| Tenant Name | Text | Yes |
| Review Status | Dropdown: Pending / Processing / Completed | Yes |
| Report Content | Long Text | No |
