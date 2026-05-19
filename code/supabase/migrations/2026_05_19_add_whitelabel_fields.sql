-- ─────────────────────────────────────────────────────────────────────────
-- 2026-05-19 — White-label header fields for partner demos
-- Adds optional partner display fields so a tenant slug can render a
-- "partner-branded block above the KISS header" (e.g. for attorney demos).
-- All fields are optional; when null, the form falls back to the
-- standard KISS-only header.
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS partner_tagline   TEXT,
  ADD COLUMN IF NOT EXISTS partner_photo_url TEXT,
  ADD COLUMN IF NOT EXISTS partner_bio       TEXT;

-- Demo white-label tenant for sales calls with attorneys.
-- URL: kiss.optimizinggroup.com/great-law-firm
INSERT INTO tenants (
  slug, partner_code, persona, brand_name, brand_color, brand_logo_url,
  partner_tagline, partner_photo_url, partner_bio,
  contact_name, contact_email
) VALUES (
  'great-law-firm',
  'GREATLAW',
  'attorney',
  'Great Law Firm',
  '#0F2A52',
  'https://placehold.co/240x72/0F2A52/FFFFFF/png?text=GREAT+LAW+FIRM',
  'Florida Property Insurance Attorneys · Trusted by 2,000+ homeowners',
  'https://i.pravatar.cc/256?img=68',
  'When your insurance company denies, delays, or underpays a claim, you need an attorney on your side. We review your policy before disaster strikes — for free — so you know exactly what you''re entitled to.',
  'Demo Attorney',
  'admin@optimizinggroup.com'
) ON CONFLICT (slug) DO UPDATE SET
  partner_tagline   = EXCLUDED.partner_tagline,
  partner_photo_url = EXCLUDED.partner_photo_url,
  partner_bio       = EXCLUDED.partner_bio,
  brand_name        = EXCLUDED.brand_name,
  brand_color       = EXCLUDED.brand_color,
  persona           = EXCLUDED.persona;
