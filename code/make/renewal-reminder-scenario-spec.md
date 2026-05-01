# Make Scenario Spec — KISS Renewal Reminders (Scheduled)

A second Make scenario that runs daily and sends renewal reminders to clients whose policies expire in 30 days. Separate from the main `KISS Insurance Policy Review - Core Pipeline` scenario.

## Scenario metadata

| Field | Value |
|---|---|
| Name | KISS - Renewal Reminders |
| Type | Scheduled (daily) |
| Trigger time | 09:00 AM ET (13:00 UTC) |
| Org / Team | 5587731 / 1524441 (us2.make.com) |
| Operations cost (est.) | ~3-5 modules per submission × ~10-50 reminders/day = manageable |

## Module-by-module

### Module 1 — Daily Timer (`builtin:BasicTrigger`)

Schedule: Daily at 09:00 ET. No filter.

### Module 2 — Fetch submissions due for renewal (`http:MakeRequest` GET)

Hits the Supabase REST endpoint for the helper view created in `migrations/2026_04_30_add_renewal_tracking.sql`:

```
GET https://<supabase-project>.supabase.co/rest/v1/v_submissions_renewal_due
Headers:
  apikey: SUPABASE_SERVICE_ROLE_KEY
  Authorization: Bearer SUPABASE_SERVICE_ROLE_KEY
  Content-Type: application/json
```

The view filters to: `status='completed'` AND `consent_status='active'` AND `renewal_reminder_sent_at IS NULL` AND `policy_expiration_date BETWEEN today+30 AND today+35` AND `tenant.status='active'`.

Returns 0-N rows with all the substitution variables for the email template.

### Module 3 — Iterator (`builtin:Iterator`)

Iterates over Module 2's array result. Each iteration processes one submission's reminder.

### Module 4 — Send renewal reminder via Resend (`http:MakeRequest` POST)

```
POST https://api.resend.com/emails
Headers:
  Authorization: Bearer RESEND_API_KEY
  Content-Type: application/json

Body (use the Iterator's current row to substitute):
{
  "from": "{{3.tenant_brand_name}} <reviews@kiss.optimizinggroup.com>",
  "to": ["{{3.contact_email}}"],
  "subject": "Your policy renews in {{3.days_until_expiration}} days, {{3.contact_name}}",
  "html": "<<contents of code/emails/email_renewal_reminder.html with {{vars}} replaced>>",
  "headers": {
    "List-Unsubscribe": "<{{3.unsubscribe_url}}>",
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click"
  }
}
```

Critical: substitute every `{{tenant_brand_color}}`, `{{contact_name}}`, etc. token in the HTML body using the Iterator's current row.

### Module 5 — Mark reminder sent in Supabase (`http:MakeRequest` PATCH)

```
PATCH https://<supabase-project>.supabase.co/rest/v1/submissions?id=eq.{{3.submission_id}}
Headers:
  apikey: SUPABASE_SERVICE_ROLE_KEY
  Authorization: Bearer SUPABASE_SERVICE_ROLE_KEY
  Content-Type: application/json
  Prefer: return=minimal

Body:
{
  "renewal_reminder_sent_at": "{{now}}"
}
```

Sets the `renewal_reminder_sent_at` column so this submission is excluded from tomorrow's query (and the day after, etc.).

### Module 6 — Audit log (`http:MakeRequest` POST to `email_events`)

```
POST https://<supabase-project>.supabase.co/rest/v1/email_events
Headers:
  apikey: SUPABASE_SERVICE_ROLE_KEY
  Authorization: Bearer SUPABASE_SERVICE_ROLE_KEY
  Content-Type: application/json

Body:
{
  "submission_id": "{{3.submission_id}}",
  "tenant_id": "{{3.tenant_id}}",
  "email_type": "renewal_reminder",
  "to_address": "{{3.contact_email}}",
  "resend_message_id": "{{4.id}}",
  "status": "sent",
  "sent_at": "{{now}}"
}
```

Captures the Resend message ID for delivery / bounce investigation.

## Error handling

Wrap Modules 4-6 in an error handler. If Module 4 (Resend) fails, log the error to `email_events` with `status='failed'` and `error_message=<resend response>` instead of marking the submission as reminded. Tomorrow's run will retry.

If Module 5 (Supabase PATCH) fails after Module 4 succeeded, the consequence is a duplicate email — bad but not catastrophic. Add a Make filter on Module 4: skip if `renewal_reminder_sent_at IS NOT NULL` (defensive double-check, since the view should already filter these out).

## Testing checklist before activating

- [ ] Insert a test submission with `policy_expiration_date = CURRENT_DATE + 32 days`, `status = 'completed'`, `consent_status = 'active'`, `renewal_reminder_sent_at IS NULL`
- [ ] Manually run the scenario (don't wait for the timer)
- [ ] Verify exactly one email arrives at the test address
- [ ] Verify the test submission's `renewal_reminder_sent_at` is set
- [ ] Verify a row was created in `email_events`
- [ ] Run the scenario again — verify the test submission is NOT re-sent (filter excludes it)
- [ ] Test the unsubscribe link end-to-end
- [ ] Test with a multi-tenant scenario: two test submissions with different tenants, verify each gets the right branding

## When this scenario fires for the first time

Day after deployment of the renewal-tracking migration. Past submissions that already have `policy_expiration_date` populated and fall within the 30-35-day window will be picked up automatically. If you want to backfill expiration dates for past submissions that don't have them, that's a separate one-time job (re-extract from the original PDFs in Storage).

## Operations notes

- **Volume estimate:** at 10 partner attorneys × 500 onboarded clients each × ~80% renewal opt-in = 4,000 reminders/year. Spread across 365 days, that's ~11/day average. Make's free tier handles this easily.
- **Cost:** Resend is free up to 100 emails/day on the free tier. Stays free at this volume.
- **Failure mode:** if the scheduled scenario fails for a day, no emails go out that day. Reminders for that day's expiring policies just shift to tomorrow (the query window is 30-35 days out, so there's a 5-day buffer). Acceptable.

## Out of scope for v1 of this scenario

- **Multiple reminder cadence** (e.g., 30 days then 7 days). Add later if open rates suggest it's worth a second reminder.
- **Auto-detection of carrier change.** If a renewed policy is from a different carrier than the prior, that's a notable event worth flagging in the renewed report. Build into the consumer report prompt as a year-over-year feature, not in this scenario.
- **SMS reminders.** Email-only at launch. SMS would need new consent capture and additional FL Bar review.
