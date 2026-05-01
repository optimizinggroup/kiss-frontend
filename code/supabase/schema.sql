-- ═══════════════════════════════════════════════════════════════════════════
-- KISS — Keep Insurance Super Simple
-- Supabase PostgreSQL Schema v2
-- Owner: Optimizing Group LLC
-- Run this in: Supabase Dashboard → SQL Editor → New Query → Run
-- ═══════════════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─────────────────────────────────────────────────────────────────────────
-- TABLE 1: tenants
-- One row per partner (broker, attorney firm, or "consumer" default tenant)
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tenants (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug            TEXT UNIQUE NOT NULL,           -- URL slug e.g. "smith-insurance"
  partner_code    TEXT UNIQUE NOT NULL,           -- short code for fallback form e.g. "SMITH123"
  persona         TEXT NOT NULL CHECK (persona IN ('broker','attorney','consumer')),
  brand_name      TEXT NOT NULL,                  -- "Smith Insurance Group"
  brand_logo_url  TEXT,                           -- public URL to logo image
  brand_color     TEXT DEFAULT '#1A5276',         -- hex color for emails / portal
  contact_name    TEXT,                           -- primary contact at partner
  contact_email   TEXT NOT NULL,                  -- partner email for report copies + notifications
  contact_phone   TEXT,
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','disabled')),
  monthly_quota   INTEGER DEFAULT 50,             -- soft cap on submissions per month
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tenants_slug ON tenants(slug);
CREATE INDEX idx_tenants_partner_code ON tenants(partner_code);
CREATE INDEX idx_tenants_status ON tenants(status);

-- ─────────────────────────────────────────────────────────────────────────
-- TABLE 2: submissions
-- One row per policy review request. Created by intake form OR mailbox.
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS submissions (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  intake_source       TEXT NOT NULL CHECK (intake_source IN ('branded_form','generic_form','email_inbox')),
  -- homeowner fields
  contact_name        TEXT NOT NULL,
  contact_email       TEXT NOT NULL,
  contact_phone       TEXT,
  property_address    TEXT NOT NULL,
  sq_footage          INTEGER,
  year_built          INTEGER,
  policy_type         TEXT,                       -- HO-3, HO-6, etc. (optional)
  -- file
  pdf_storage_path    TEXT NOT NULL,              -- e.g. "policies/{tenant_id}/{submission_id}.pdf"
  pdf_signed_url      TEXT,                       -- short-lived signed URL passed to Make
  -- processing
  status              TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','processing','completed','failed')),
  error_message       TEXT,
  processing_started_at TIMESTAMPTZ,
  processing_completed_at TIMESTAMPTZ,
  -- consent
  consent_to_review   BOOLEAN NOT NULL DEFAULT FALSE,
  consent_timestamp   TIMESTAMPTZ,
  -- audit
  ip_address          INET,
  user_agent          TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_submissions_tenant ON submissions(tenant_id);
CREATE INDEX idx_submissions_status ON submissions(status);
CREATE INDEX idx_submissions_created ON submissions(created_at DESC);
CREATE INDEX idx_submissions_email ON submissions(contact_email);

-- ─────────────────────────────────────────────────────────────────────────
-- TABLE 3: reports
-- Generated reports tied to a submission. Two reports per submission for
-- broker/attorney tenants (consumer + professional), one for consumer tenants.
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reports (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  submission_id   UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  report_type     TEXT NOT NULL CHECK (report_type IN ('consumer','broker','attorney')),
  extracted_json  JSONB,                          -- structured policy data from GPT-4o extraction
  report_body     TEXT NOT NULL,                  -- the generated narrative report
  model_used      TEXT DEFAULT 'gpt-4o',
  prompt_version  TEXT DEFAULT 'v2.0',
  token_usage     JSONB,                          -- {prompt_tokens, completion_tokens, total_tokens}
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_reports_submission ON reports(submission_id);
CREATE INDEX idx_reports_tenant ON reports(tenant_id);
CREATE INDEX idx_reports_type ON reports(report_type);

-- ─────────────────────────────────────────────────────────────────────────
-- TABLE 4: email_events
-- Log of every email sent (homeowner reports, partner notifications)
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS email_events (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  submission_id   UUID REFERENCES submissions(id) ON DELETE SET NULL,
  tenant_id       UUID REFERENCES tenants(id) ON DELETE SET NULL,
  recipient_type  TEXT NOT NULL CHECK (recipient_type IN ('homeowner','partner','admin')),
  recipient_email TEXT NOT NULL,
  subject         TEXT NOT NULL,
  template        TEXT,                           -- which template was used
  status          TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent','failed','bounced')),
  resend_id       TEXT,                           -- Resend message ID for tracking
  error_message   TEXT,
  sent_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_email_events_submission ON email_events(submission_id);
CREATE INDEX idx_email_events_tenant ON email_events(tenant_id);
CREATE INDEX idx_email_events_sent ON email_events(sent_at DESC);

-- ─────────────────────────────────────────────────────────────────────────
-- TABLE 5: tenant_users
-- For Phase 2 partner portal — partner staff logins.
-- Created now so RLS policies work cleanly.
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tenant_users (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  auth_user_id    UUID UNIQUE,                    -- Supabase auth.users.id
  email           TEXT NOT NULL,
  role            TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner','admin','member')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tenant_users_tenant ON tenant_users(tenant_id);
CREATE INDEX idx_tenant_users_auth ON tenant_users(auth_user_id);

-- ─────────────────────────────────────────────────────────────────────────
-- TRIGGERS: keep updated_at fresh
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_tenants_updated BEFORE UPDATE ON tenants
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_submissions_updated BEFORE UPDATE ON submissions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- The Make scenario uses the SERVICE_ROLE key which bypasses RLS.
-- These policies protect data from the partner portal (anon/auth keys).
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_users ENABLE ROW LEVEL SECURITY;

-- Anonymous users (intake form) can INSERT submissions but not read others
CREATE POLICY "anon can insert submissions" ON submissions
  FOR INSERT TO anon WITH CHECK (true);

-- Authenticated tenant users can read their own tenant's data
CREATE POLICY "tenant users read their submissions" ON submissions FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE auth_user_id = auth.uid()));

CREATE POLICY "tenant users read their reports" ON reports FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE auth_user_id = auth.uid()));

CREATE POLICY "tenant users read their tenant" ON tenants FOR SELECT TO authenticated
  USING (id IN (SELECT tenant_id FROM tenant_users WHERE auth_user_id = auth.uid()));

CREATE POLICY "tenant users read email events" ON email_events FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE auth_user_id = auth.uid()));

-- Public can read tenants by slug (for intake page branding lookup)
CREATE POLICY "public read tenant by slug" ON tenants FOR SELECT TO anon
  USING (status = 'active');

-- ─────────────────────────────────────────────────────────────────────────
-- STORAGE BUCKET
-- Run separately in Supabase Dashboard → Storage → New Bucket
-- Name: policies
-- Public: NO (private)
-- File size limit: 25 MB
-- Allowed MIME types: application/pdf
-- ─────────────────────────────────────────────────────────────────────────
-- Storage policies (run after creating the bucket):
-- INSERT into storage.objects: anon role allowed (intake form uploads)
-- SELECT from storage.objects: service_role only (Make uses signed URLs)

-- ─────────────────────────────────────────────────────────────────────────
-- SEED DATA — replace with your real first partners before going live
-- ─────────────────────────────────────────────────────────────────────────
INSERT INTO tenants (slug, partner_code, persona, brand_name, brand_color, contact_email)
VALUES
  ('consumer', 'CONSUMER', 'consumer', 'KISS Direct', '#27AE60', 'admin@optimizinggroup.com'),
  ('demo-broker', 'DEMOBROK', 'broker', 'Demo Broker (Test)', '#1A5276', 'admin@optimizinggroup.com'),
  ('demo-attorney', 'DEMOATTY', 'attorney', 'Demo Attorney (Test)', '#C0392B', 'admin@optimizinggroup.com')
ON CONFLICT (slug) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────
-- ADMIN VIEWS — useful queries to run after launch
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW v_submissions_summary AS
SELECT
  s.id,
  s.created_at,
  s.status,
  s.intake_source,
  t.brand_name AS partner,
  t.persona,
  s.contact_name,
  s.contact_email,
  s.property_address,
  (SELECT COUNT(*) FROM reports r WHERE r.submission_id = s.id) AS reports_generated,
  (SELECT COUNT(*) FROM email_events e WHERE e.submission_id = s.id) AS emails_sent
FROM submissions s
JOIN tenants t ON t.id = s.tenant_id
ORDER BY s.created_at DESC;

CREATE OR REPLACE VIEW v_tenant_volume AS
SELECT
  t.brand_name,
  t.persona,
  t.status,
  COUNT(s.id) AS total_submissions,
  COUNT(s.id) FILTER (WHERE s.created_at > NOW() - INTERVAL '30 days') AS submissions_30d,
  COUNT(s.id) FILTER (WHERE s.status = 'completed') AS completed,
  COUNT(s.id) FILTER (WHERE s.status = 'failed') AS failed
FROM tenants t
LEFT JOIN submissions s ON s.tenant_id = t.id
GROUP BY t.id, t.brand_name, t.persona, t.status
ORDER BY total_submissions DESC;
