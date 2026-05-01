-- ═══════════════════════════════════════════════════════════════════════════
-- KISS — Migration: Add Renewal Tracking
-- Date: 2026-04-30
-- Adds: policy effective/expiration dates, renewal-reminder tracking,
--       parent submission link for year-over-year comparison.
-- Run AFTER the base schema (code/supabase/schema.sql).
-- Idempotent — safe to run more than once.
-- ═══════════════════════════════════════════════════════════════════════════

-- Add the four new columns
ALTER TABLE submissions
  ADD COLUMN IF NOT EXISTS policy_effective_date    DATE,
  ADD COLUMN IF NOT EXISTS policy_expiration_date   DATE,
  ADD COLUMN IF NOT EXISTS renewal_reminder_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS parent_submission_id     UUID REFERENCES submissions(id) ON DELETE SET NULL;

-- Index for the daily renewal-reminder query.
-- Filters to completed, active-consent, not-yet-reminded submissions
-- with an extracted expiration date. The Make scenario queries this nightly.
CREATE INDEX IF NOT EXISTS idx_submissions_renewal_due
  ON submissions (policy_expiration_date)
  WHERE status = 'completed'
    AND renewal_reminder_sent_at IS NULL
    AND policy_expiration_date IS NOT NULL;

-- Index for year-over-year lookups (find the prior submission for the same client + property)
CREATE INDEX IF NOT EXISTS idx_submissions_parent
  ON submissions (parent_submission_id)
  WHERE parent_submission_id IS NOT NULL;

-- Optional helper view: submissions due for a renewal reminder in the next 5 days
-- Used by the Make scheduled scenario or manual review.
CREATE OR REPLACE VIEW v_submissions_renewal_due AS
SELECT
  s.id                          AS submission_id,
  s.tenant_id,
  t.brand_name                  AS tenant_brand_name,
  t.contact_email               AS tenant_contact_email,
  t.brand_color                 AS tenant_brand_color,
  s.contact_name,
  s.contact_email,
  s.property_address,
  s.policy_type,
  s.policy_effective_date,
  s.policy_expiration_date,
  (s.policy_expiration_date - CURRENT_DATE) AS days_until_expiration
FROM submissions s
JOIN tenants t ON t.id = s.tenant_id
WHERE s.status = 'completed'
  AND s.renewal_reminder_sent_at IS NULL
  AND s.policy_expiration_date IS NOT NULL
  AND s.policy_expiration_date BETWEEN CURRENT_DATE + INTERVAL '30 days'
                                    AND CURRENT_DATE + INTERVAL '35 days'
  AND t.status = 'active';

COMMENT ON COLUMN submissions.policy_effective_date    IS 'Extracted from policy by GPT-4o; date the policy started';
COMMENT ON COLUMN submissions.policy_expiration_date   IS 'Extracted from policy by GPT-4o; date the policy expires (renewal reminder fires 30 days before)';
COMMENT ON COLUMN submissions.renewal_reminder_sent_at IS 'NULL until the renewal reminder email has been sent for this submission. Make scenario sets this when reminder fires.';
COMMENT ON COLUMN submissions.parent_submission_id     IS 'Set on a renewed submission to link it to the prior year''s submission for year-over-year comparison in the report prompt.';
COMMENT ON VIEW   v_submissions_renewal_due            IS 'Submissions whose policy expires in 30-35 days and which haven''t had a renewal reminder fired yet. Driven by daily Make scenario.';
