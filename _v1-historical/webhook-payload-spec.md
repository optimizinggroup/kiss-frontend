# KISS Webhook — Payload Specification

The Make scenario fires when GHL (or any source) POSTs JSON to:

```
https://hook.us2.make.com/6tvcwb2d2b7nuimiewpfe6rw1g11u97y
```

## Required JSON payload

All 12 fields are expected. Missing fields will resolve to `undefined` downstream and may break the OpenAI calls or the email send.

```json
{
  "contact_name": "John Doe",
  "contact_email": "john@example.com",
  "contact_phone": "+15551234567",
  "property_address": "123 Main St, Wellington, FL 33414",
  "policy_type": "HO-3",
  "sq_footage": "2500",
  "year_built": "2005",
  "file_url": "https://example.com/policy.pdf",
  "tenant_persona": "consumer",
  "tenant_name": "KISS Policy Review",
  "ghl_contact_id": "abc123",
  "ghl_webhook_url": ""
}
```

## Field reference

| Field | Type | Notes |
|---|---|---|
| `contact_name` | string | Full name of the homeowner submitting the policy |
| `contact_email` | string | Where the report email gets sent |
| `contact_phone` | string | Stored, not currently used in the report |
| `property_address` | string | Goes into the report body |
| `policy_type` | string | Used for record-keeping (Make doesn't branch on it currently) |
| `sq_footage` | string | Drives the rebuild-cost gap analysis |
| `year_built` | string | Currently echoed in the report; could drive age-of-home risk later |
| `file_url` | string | **Must be publicly accessible.** Make does an unauthenticated HTTP GET. |
| `tenant_persona` | string | **Critical.** One of `consumer`, `broker`, `attorney` — exact match, lowercase |
| `tenant_name` | string | The displayed brand on the report (`"KISS Policy Review"` for Phase 1; broker/attorney name for Phase 2) |
| `ghl_contact_id` | string | Echoed in callback payload for broker/attorney routes; safe to leave empty for consumer |
| `ghl_webhook_url` | string | The GHL inbound webhook URL the broker/attorney callback POSTs to. **Leave empty for consumer route** — that route doesn't call back, only emails. |

## tenant_persona values

| Value | Phase | What runs | Output |
|---|---|---|---|
| `consumer` | Phase 1 (active) | 6-section plain-English report | Email only |
| `broker` | Phase 2 | 5-section broker advisory report | Email + POST to `ghl_webhook_url` |
| `attorney` | Phase 2 | 5-section pre-claim analysis report | Email + POST to `ghl_webhook_url` |

## Quick test (consumer path)

Drop this in a terminal — just replace `file_url` with a real public PDF link:

```bash
curl -X POST https://hook.us2.make.com/6tvcwb2d2b7nuimiewpfe6rw1g11u97y \
  -H "Content-Type: application/json" \
  -d '{
    "contact_name": "Test User",
    "contact_email": "keith@optimizinggroup.com",
    "contact_phone": "+19544776161",
    "property_address": "11777 Greenbriar Circle, Wellington, FL 33414",
    "policy_type": "HO-3",
    "sq_footage": "2500",
    "year_built": "2005",
    "file_url": "https://YOUR_PUBLIC_PDF_URL_HERE",
    "tenant_persona": "consumer",
    "tenant_name": "KISS Policy Review",
    "ghl_contact_id": "test-123",
    "ghl_webhook_url": ""
  }'
```

If the scenario fires correctly, you'll see one execution in Make's history within ~30 seconds and the email arrives shortly after.

## Common issues to watch for

1. **PDF URL behind auth.** If GHL stores the upload behind a private URL, the HTTP GET in module 3 will fail. Easiest workaround: GHL's media URLs are typically public — but verify before going live.
2. **`file_url` is missing/null.** The scenario will fail on module 3. Make sure the GHL form actually maps the file upload field to `file_url` in the webhook body.
3. **`tenant_persona` casing.** Must be lowercase exactly: `consumer` not `Consumer`. The router filter is case-sensitive.
4. **OpenAI returns text outside the JSON block.** The extraction prompt is emphatic about RAW JSON, but if GPT-4o slips a "Here is the JSON:" preamble, the ParseJSON step (module 6/10/16) will throw. Easy fix: re-run with the same input — the prompt usually self-corrects.
