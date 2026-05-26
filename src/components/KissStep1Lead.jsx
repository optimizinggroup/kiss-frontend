import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createClient } from "@supabase/supabase-js";

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const MAKE_LEAD_WEBHOOK_URL = import.meta.env.VITE_MAKE_LEAD_WEBHOOK_URL;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ─── KISS STEP 1 — LEAD CAPTURE ──────────────────────────────────────────────
// Captures contact + property/vehicle/business info. No PDF.
// On submit: fires lead-capture webhook → redirects to /:slug/upload/:id
// for the actual policy PDF upload.
// ─────────────────────────────────────────────────────────────────────────────
export default function KissStep1Lead({ slug }) {
  const navigate = useNavigate();
  const [tenant, setTenant] = useState(null);
  const [tenantLoading, setTenantLoading] = useState(!!slug);
  const [tenantError, setTenantError] = useState(null);

  const [form, setForm] = useState({
    partner_code: "",
    contact_name: "",
    contact_email: "",
    contact_phone: "",
    policy_category: "",
    policy_type: "",
    property_address: "",
    property_city: "",
    property_state: "FL",
    property_zip: "",
    property_county: "",
    sq_footage: "",
    year_built: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  useEffect(() => {
    if (!slug) return;
    (async () => {
      const { data, error } = await supabase
        .from("tenants")
        .select("id, slug, persona, brand_name, brand_logo_url, brand_color, partner_tagline, partner_photo_url, partner_bio, contact_email, status")
        .eq("slug", slug)
        .eq("status", "active")
        .single();
      if (error || !data) {
        setTenantError("Partner not found or inactive.");
      } else {
        setTenant(data);
      }
      setTenantLoading(false);
    })();
  }, [slug]);

  // Pre-fill from URL params (used by flood / auto upsell links after a review).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const policyType = params.get("policy_type");
    const email = params.get("email");
    if (!policyType && !email) return;
    setForm((prev) => {
      const next = { ...prev };
      if (email && !prev.contact_email) next.contact_email = email;
      if (policyType === "flood") {
        next.policy_category = "homeowners";
        next.policy_type = "flood_nfip";
      } else if (policyType === "auto") {
        next.policy_category = "auto";
        next.policy_type = "auto_personal";
      }
      return next;
    });
  }, []);

  const resolveTenantByCode = async (code) => {
    if (!code) return null;
    const { data } = await supabase
      .from("tenants")
      .select("id, slug, persona, brand_name, brand_logo_url, brand_color, partner_tagline, partner_photo_url, partner_bio, contact_email, status")
      .eq("partner_code", code.toUpperCase())
      .eq("status", "active")
      .single();
    return data || null;
  };

  const lookupZip = async (zip) => {
    const clean = String(zip || "").trim();
    if (!/^\d{5}$/.test(clean)) return;
    try {
      const zipResp = await fetch(`https://api.zippopotam.us/us/${clean}`);
      if (!zipResp.ok) return;
      const zipData = await zipResp.json();
      const place = zipData?.places?.[0];
      if (!place) return;
      const city  = place["place name"];
      const state = place["state abbreviation"];
      const lat   = parseFloat(place["latitude"]);
      const lon   = parseFloat(place["longitude"]);

      let county = "";
      try {
        const fccResp = await fetch(`https://geo.fcc.gov/api/census/area?lat=${lat}&lon=${lon}&format=json`);
        if (fccResp.ok) {
          const fccData = await fccResp.json();
          county = fccData?.results?.[0]?.county_name || "";
        }
      } catch (_) { /* county is optional */ }

      setForm(f => ({
        ...f,
        property_city:   f.property_city   || city,
        property_state:  f.property_state  || state,
        property_county: f.property_county || county
      }));
    } catch (_) { /* leave blank */ }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(f => {
      const next = { ...f, [name]: type === "checkbox" ? checked : value };
      if (name === "policy_category") {
        next.policy_type = "";
        next.property_address = "";
        next.sq_footage = "";
        next.year_built = "";
      }
      return next;
    });
  };

  const POLICY_TYPES_BY_CATEGORY = {
    homeowners: [
      "HO-3 (standard homeowners)",
      "HO-5 (premium homeowners)",
      "HO-6 (condo)",
      "HO-8 (older home)",
      "DP-3 (rental property)",
      "NFIP Flood Insurance (Dwelling Form)",
      "NFIP Flood Insurance (General Property)",
      "Private Flood Insurance",
      "Not sure — homeowners",
    ],
    auto: [
      "Personal Auto Policy (PAP)",
      "Motorcycle Policy",
      "Commercial Auto",
      "Not sure — auto",
    ],
    commercial: [
      "BOP (Business Owner Policy)",
      "Commercial Property",
      "General Liability (CGL)",
      "Not sure — commercial",
    ],
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitting(true);

    try {
      // 1. Resolve tenant
      let activeTenant = tenant;
      if (!activeTenant) {
        if (!form.partner_code) {
          activeTenant = await resolveTenantByCode("CONSUMER");
        } else {
          activeTenant = await resolveTenantByCode(form.partner_code);
          if (!activeTenant) {
            throw new Error("Partner code not recognized. Leave blank to continue as a direct consumer.");
          }
        }
      }

      // 2. Generate submission_id client-side
      const submissionId = (typeof crypto !== "undefined" && crypto.randomUUID)
        ? crypto.randomUUID()
        : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
            const r = Math.random() * 16 | 0;
            return (c === "x" ? r : (r & 0x3 | 0x8)).toString(16);
          });

      // 3. Fire lead capture webhook with full payload.
      //    Make's scenario 1 inserts the Supabase row + sends welcome email.
      const step2Url = `${window.location.origin}/${activeTenant.slug}/upload/${submissionId}`;
      const payload = {
        submission_id: submissionId,
        tenant_id: activeTenant.id,
        tenant_slug: activeTenant.slug,
        tenant_persona: activeTenant.persona,
        tenant_brand_name: activeTenant.brand_name,
        tenant_contact_email: activeTenant.contact_email,
        contact_name: form.contact_name,
        contact_email: form.contact_email,
        contact_phone: form.contact_phone || "",
        property_address: form.property_address,
        property_city: form.property_city || "",
        property_state: form.property_state || "",
        property_zip: form.property_zip || "",
        property_county: form.property_county || "",
        sq_footage: form.sq_footage ? parseInt(form.sq_footage) : 0,
        year_built: form.year_built ? parseInt(form.year_built) : 0,
        policy_category: form.policy_category,
        policy_type: form.policy_type,
        step2_url: step2Url,
      };

      const webhookResp = await fetch(MAKE_LEAD_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!webhookResp.ok) {
        console.warn("Lead webhook failed:", webhookResp.status);
        // Continue anyway — user can still proceed to step 2.
        // The submission row will be created by Step 2 webhook as a fallback.
      }

      // 4. Stash all the lead data in sessionStorage so Step 2 can fire the
      //    review webhook without re-collecting it.
      sessionStorage.setItem(`kiss-lead-${submissionId}`, JSON.stringify({ payload, tenant: activeTenant }));

      // 5. Redirect to Step 2
      navigate(`/${activeTenant.slug}/upload/${submissionId}`);
    } catch (err) {
      setSubmitError(err.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (tenantLoading) {
    return <div style={styles.center}><div style={styles.spinner} />Loading…</div>;
  }
  if (tenantError) {
    return <div style={styles.center}><p style={{ color: "#C0392B" }}>{tenantError}</p></div>;
  }

  const accent = tenant?.brand_color || "#27AE60";
  const partnerName = tenant?.brand_name || "KISS Policy Review";
  const isWhiteLabel = !!(tenant && (tenant.partner_tagline || tenant.partner_photo_url || tenant.partner_bio || tenant.brand_logo_url));

  return (
    <div style={styles.wrap}>
      {/* Header */}
      {isWhiteLabel ? (
        <div style={{ marginBottom: 28 }}>
          <div style={{ textAlign: "center", padding: "8px 0 20px" }}>
            {tenant.brand_logo_url && (
              <img src={tenant.brand_logo_url} alt={partnerName} style={{ maxHeight: 72, marginBottom: 14 }} />
            )}
            <h1 style={{ ...styles.h1, color: accent, fontSize: 30 }}>{partnerName}</h1>
            {tenant.partner_tagline && (
              <p style={{ fontSize: 14, color: "#555", fontWeight: 600, margin: "6px 0 0", letterSpacing: 0.2 }}>
                {tenant.partner_tagline}
              </p>
            )}
            {(tenant.partner_photo_url || tenant.partner_bio) && (
              <div style={{ display: "flex", gap: 14, alignItems: "center", marginTop: 18, padding: "14px 16px", background: "#F8F9FA", border: "1px solid #E5E5E5", borderRadius: 10, textAlign: "left" }}>
                {tenant.partner_photo_url && (
                  <img src={tenant.partner_photo_url} alt="" style={{ width: 64, height: 64, borderRadius: "50%", objectFit: "cover", flexShrink: 0, border: `2px solid ${accent}` }} />
                )}
                {tenant.partner_bio && (
                  <p style={{ fontSize: 13, color: "#444", margin: 0, lineHeight: 1.5 }}>{tenant.partner_bio}</p>
                )}
              </div>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "8px 0 18px" }}>
            <div style={{ flex: 1, height: 1, background: "#E0E0E0" }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: "#888", letterSpacing: 1.5 }}>POWERED BY</span>
            <div style={{ flex: 1, height: 1, background: "#E0E0E0" }} />
          </div>
          <div style={{ textAlign: "center" }}>
            <img src="/assets/kiss-horizontal-logo.png" alt="KISS Policy Review" style={{ width: "100%", height: "auto", display: "block", margin: "4px 0 10px" }} />
            <p style={styles.lead}>Start Your Free Policy Review</p>
            <p style={{ fontSize: 13, color: "#666", marginTop: 8 }}>
              Step 1 of 2 — tell us a bit about you and your policy. Next step you'll upload the document.
            </p>
          </div>
        </div>
      ) : (
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <h1 style={{ ...styles.h1, color: accent }}>{partnerName}</h1>
          <p style={styles.lead}>Free Insurance Policy Review</p>
          <p style={{ fontSize: 13, color: "#666", marginTop: 8 }}>
            Step 1 of 2 — tell us a bit about you and your policy. Next step you'll upload the document.
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {!tenant && (
          <Field label="Partner code (optional)" hint="If a broker or attorney sent you here, enter their code. Otherwise leave blank.">
            <input type="text" name="partner_code" value={form.partner_code} onChange={handleChange} style={styles.input} placeholder="e.g. SMITH123" />
          </Field>
        )}

        <Field label="Your name" required>
          <input type="text" name="contact_name" required value={form.contact_name} onChange={handleChange} style={styles.input} />
        </Field>

        <Field label="Email" required>
          <input type="email" name="contact_email" required value={form.contact_email} onChange={handleChange} style={styles.input} />
        </Field>

        <Field label="Phone (optional)">
          <input type="tel" name="contact_phone" value={form.contact_phone} onChange={handleChange} style={styles.input} />
        </Field>

        {/* Qualifying question */}
        <Field label="What type of policy do you want us to review today?" required>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            {[
              { value: "homeowners", label: "Homeowners", emoji: "🏠" },
              { value: "auto",       label: "Automobile", emoji: "🚗" },
              { value: "commercial", label: "Commercial", emoji: "🏢" }
            ].map(opt => {
              const active = form.policy_category === opt.value;
              return (
                <label key={opt.value} style={{
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                  padding: "14px 10px",
                  border: `2px solid ${active ? accent : "#DDD"}`,
                  background: active ? `${accent}10` : "#FFF",
                  borderRadius: 10, cursor: "pointer", transition: "all 0.15s",
                  fontWeight: active ? 700 : 500, fontSize: 14
                }}>
                  <input type="radio" name="policy_category" value={opt.value} checked={active} onChange={handleChange}
                         style={{ position: "absolute", opacity: 0, width: 1, height: 1 }} />
                  <span style={{ fontSize: 24 }}>{opt.emoji}</span>
                  <span>{opt.label}</span>
                </label>
              );
            })}
          </div>
        </Field>

        {form.policy_category && (
          <>
            <Field label="Policy type" required>
              <select name="policy_type" required value={form.policy_type} onChange={handleChange} style={styles.input}>
                <option value="" disabled>Select your policy type…</option>
                {POLICY_TYPES_BY_CATEGORY[form.policy_category].map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </Field>

            {form.policy_category === "auto" ? (
              <Field label="Vehicle (year / make / model)" required hint="Example: 2019 Toyota Camry SE">
                <input type="text" name="property_address" required value={form.property_address} onChange={handleChange} style={styles.input} placeholder="2019 Toyota Camry SE" />
              </Field>
            ) : (
              <>
                <Field label={form.policy_category === "commercial" ? "Business street address" : "Street address"} required>
                  <input type="text" name="property_address" required value={form.property_address} onChange={handleChange} style={styles.input} placeholder="123 Main St" />
                </Field>
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 12 }}>
                  <Field label="City" required>
                    <input type="text" name="property_city" required value={form.property_city} onChange={handleChange} style={styles.input} placeholder="Miami" />
                  </Field>
                  <Field label="State" required>
                    <input type="text" name="property_state" required maxLength={2} value={form.property_state}
                           onChange={(e) => handleChange({ target: { name: "property_state", value: e.target.value.toUpperCase() } })}
                           style={styles.input} placeholder="FL" />
                  </Field>
                  <Field label="ZIP" required hint="Auto-fills city/county">
                    <input type="text" name="property_zip" required inputMode="numeric" maxLength={5} value={form.property_zip}
                           onChange={handleChange} onBlur={(e) => lookupZip(e.target.value)}
                           style={styles.input} placeholder="33101" />
                  </Field>
                </div>
                <Field label="County" hint="Auto-derived from ZIP — edit if wrong">
                  <input type="text" name="property_county" value={form.property_county} onChange={handleChange} style={styles.input} placeholder="Miami-Dade County" />
                </Field>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <Field label={form.policy_category === "commercial" ? "Square footage (optional)" : "Square footage"}>
                    <input type="number" name="sq_footage" value={form.sq_footage} onChange={handleChange} style={styles.input} placeholder="2400" />
                  </Field>
                  <Field label={form.policy_category === "commercial" ? "Year built (optional)" : "Year built"}>
                    <input type="number" name="year_built" value={form.year_built} onChange={handleChange} style={styles.input} placeholder="1998" />
                  </Field>
                </div>
              </>
            )}
          </>
        )}

        {submitError && (
          <div style={{ background: "#FDEDEC", border: "1px solid #E74C3C", padding: 12, borderRadius: 8, color: "#C0392B", marginBottom: 16, fontSize: 14 }}>
            {submitError}
          </div>
        )}

        <button type="submit" disabled={submitting || !form.policy_category || !form.policy_type}
                style={{ ...styles.submitBtn, background: accent, opacity: (submitting || !form.policy_category || !form.policy_type) ? 0.6 : 1 }}>
          {submitting ? "Saving…" : "Continue to Step 2 → Upload Policy"}
        </button>

        <p style={{ fontSize: 11, color: "#999", textAlign: "center", marginTop: 24, lineHeight: 1.5 }}>
          We'll save your info and send you instructions for the next step. No spam.<br/>
          KISS — Keep Insurance Super Simple · Powered by Optimizing Group LLC
        </p>
      </form>
    </div>
  );
}

function Field({ label, hint, required, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#222", marginBottom: 6 }}>
        {label}{required && <span style={{ color: "#C0392B" }}> *</span>}
      </label>
      {children}
      {hint && <div style={{ fontSize: 11, color: "#888", marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

const styles = {
  wrap: { maxWidth: 560, margin: "0 auto", padding: "32px 20px", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", color: "#222" },
  h1: { fontSize: 28, fontWeight: 700, margin: "0 0 8px", lineHeight: 1.2 },
  lead: { fontSize: 16, color: "#444", margin: "0 0 4px", lineHeight: 1.5 },
  input: { width: "100%", padding: "10px 12px", fontSize: 15, border: "1px solid #DDD", borderRadius: 8, outline: "none", boxSizing: "border-box", fontFamily: "inherit" },
  submitBtn: { width: "100%", padding: "14px 20px", fontSize: 16, fontWeight: 700, color: "#FFF", border: "none", borderRadius: 8, cursor: "pointer", marginTop: 8 },
  center: { minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "-apple-system, sans-serif" },
  spinner: { width: 18, height: 18, border: "2px solid #DDD", borderTopColor: "#1A5276", borderRadius: "50%", animation: "spin 1s linear infinite", marginRight: 12 }
};
