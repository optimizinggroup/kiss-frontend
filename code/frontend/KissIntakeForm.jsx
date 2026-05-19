import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const MAKE_WEBHOOK_URL = import.meta.env.VITE_MAKE_WEBHOOK_URL;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ─── KISS INTAKE FORM ────────────────────────────────────────────────────────
// Single component handling both:
//   /:slug   → branded form, tenant resolved from URL
//   /start   → generic form, tenant resolved from partner code field
// ─────────────────────────────────────────────────────────────────────────────
export default function KissIntakeForm({ slug }) {
  const [tenant, setTenant] = useState(null);
  const [tenantLoading, setTenantLoading] = useState(!!slug);
  const [tenantError, setTenantError] = useState(null);

  const [form, setForm] = useState({
    partner_code: "",
    contact_name: "",
    contact_email: "",
    contact_phone: "",
    policy_category: "",          // homeowners | auto | commercial — chosen first
    policy_type: "",              // sub-type within category
    property_address: "",         // doubles as vehicle description for auto
    sq_footage: "",
    year_built: "",
    pdf_file: null,
    consent: false
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Resolve tenant from slug on mount (branded path only)
  useEffect(() => {
    if (!slug) return;
    (async () => {
      const { data, error } = await supabase
        .from("tenants")
        .select("id, slug, persona, brand_name, brand_logo_url, brand_color, partner_tagline, partner_photo_url, partner_bio, status")
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

  // Resolve tenant from partner code (generic path)
  const resolveTenantByCode = async (code) => {
    if (!code) return null;
    const { data } = await supabase
      .from("tenants")
      .select("id, slug, persona, brand_name, brand_logo_url, brand_color, partner_tagline, partner_photo_url, partner_bio, status")
      .eq("partner_code", code.toUpperCase())
      .eq("status", "active")
      .single();
    return data || null;
  };

  const handleChange = (e) => {
    const { name, value, type, checked, files } = e.target;
    setForm(f => {
      const next = {
        ...f,
        [name]: type === "checkbox" ? checked : type === "file" ? files[0] : value
      };
      // When category changes, reset the dependent fields
      if (name === "policy_category") {
        next.policy_type = "";
        next.property_address = "";
        next.sq_footage = "";
        next.year_built = "";
      }
      return next;
    });
  };

  // Policy type options grouped by category
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
      "Not sure — homeowners"
    ],
    auto: [
      "Personal Auto Policy (PAP)",
      "Motorcycle Policy",
      "Commercial Auto",
      "Not sure — auto"
    ],
    commercial: [
      "BOP (Business Owner Policy)",
      "Commercial Property",
      "General Liability (CGL)",
      "Not sure — commercial"
    ]
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
          // No partner code = consumer fallback
          activeTenant = await resolveTenantByCode("CONSUMER");
        } else {
          activeTenant = await resolveTenantByCode(form.partner_code);
          if (!activeTenant) {
            throw new Error("Partner code not recognized. Leave blank to continue as a direct consumer.");
          }
        }
      }

      // 2. Validate file
      if (!form.pdf_file) throw new Error("Please attach your policy PDF.");
      if (form.pdf_file.type !== "application/pdf") throw new Error("File must be a PDF.");
      if (form.pdf_file.size > 25 * 1024 * 1024) throw new Error("PDF must be under 25 MB.");

      // 3. Generate client-side UUID for the submission. We don't read it back
      //    from Supabase (anon has no SELECT on submissions), so we control the
      //    primary key ourselves and use Prefer: return=minimal on INSERT.
      const submissionId = (typeof crypto !== "undefined" && crypto.randomUUID)
        ? crypto.randomUUID()
        : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
            const r = Math.random() * 16 | 0;
            return (c === "x" ? r : (r & 0x3 | 0x8)).toString(16);
          });
      const path = `policies/${activeTenant.id}/${submissionId}.pdf`;

      // 4. Upload PDF first (storage doesn't depend on submission row existing)
      const { error: uploadError } = await supabase.storage
        .from("policies")
        .upload(path, form.pdf_file, { contentType: "application/pdf", upsert: false });
      if (uploadError) throw uploadError;

      // 5. Insert submission row with our client-generated id + real pdf path.
      //    return=minimal so PostgREST doesn't try to RETURN the row (which
      //    would require a SELECT policy anon doesn't have).
      const { error: subError } = await supabase
        .from("submissions")
        .insert({
          id: submissionId,
          tenant_id: activeTenant.id,
          intake_source: slug ? "branded_form" : "generic_form",
          contact_name: form.contact_name,
          contact_email: form.contact_email,
          contact_phone: form.contact_phone || null,
          property_address: form.property_address,
          sq_footage: form.sq_footage ? parseInt(form.sq_footage) : null,
          year_built: form.year_built ? parseInt(form.year_built) : null,
          policy_type: form.policy_type,
          pdf_storage_path: path,
          consent_to_review: form.consent,
          consent_timestamp: form.consent ? new Date().toISOString() : null,
          status: "pending"
        }, { returning: "minimal" });
      if (subError) throw subError;

      // 6. Fire Make webhook (Make signs the URL and processes)
      const webhookResp = await fetch(MAKE_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submission_id: submissionId })
      });
      if (!webhookResp.ok) {
        // Submission is in DB; Make can be retried manually. Don't block user.
        console.warn("Webhook failed but submission saved:", webhookResp.status);
      }

      setSubmitSuccess(true);
    } catch (err) {
      setSubmitError(err.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // ─── RENDER ──────────────────────────────────────────────────────────────
  if (tenantLoading) {
    return <div style={styles.center}><div style={styles.spinner} />Loading…</div>;
  }
  if (tenantError) {
    return <div style={styles.center}><p style={{ color: "#C0392B" }}>{tenantError}</p></div>;
  }

  const accent = tenant?.brand_color || "#27AE60";
  const partnerName = tenant?.brand_name || "KISS Policy Review";
  // White-label mode = tenant has at least one partner display field populated.
  // Renders the partner-branded block above a "KISS Policy Review" sub-header.
  const isWhiteLabel = !!(tenant && (tenant.partner_tagline || tenant.partner_photo_url || tenant.partner_bio || tenant.brand_logo_url));

  if (submitSuccess) {
    return (
      <div style={{ ...styles.wrap, textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>✓</div>
        <h1 style={styles.h1}>Got it, {form.contact_name.split(" ")[0]}.</h1>
        <p style={styles.lead}>
          Your policy is being reviewed. You'll receive your report at <strong>{form.contact_email}</strong> within
          the next 5–10 minutes.
        </p>
        {tenant?.persona !== "consumer" && (
          <p style={{ ...styles.lead, fontSize: 14, color: "#666" }}>
            A copy will also be sent to {partnerName}.
          </p>
        )}
        <p style={{ fontSize: 12, color: "#999", marginTop: 32 }}>
          Powered by KISS · For informational purposes only · Not legal or financial advice
        </p>
      </div>
    );
  }

  return (
    <div style={styles.wrap}>
      {/* Header */}
      {isWhiteLabel ? (
        <div style={{ marginBottom: 28 }}>
          {/* Partner block (top) */}
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
          {/* Divider */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "8px 0 18px" }}>
            <div style={{ flex: 1, height: 1, background: "#E0E0E0" }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: "#888", letterSpacing: 1.5 }}>POWERED BY</span>
            <div style={{ flex: 1, height: 1, background: "#E0E0E0" }} />
          </div>
          {/* KISS sub-header */}
          <div style={{ textAlign: "center" }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 4px", color: "#222" }}>KISS Policy Review</h2>
            <p style={styles.lead}>Free Insurance Policy Review</p>
            <p style={{ fontSize: 13, color: "#666", marginTop: 8 }}>
              Upload your insurance policy — homeowners, auto, or commercial. You'll receive a plain-English
              review of your coverage, gaps, and savings opportunities — usually within 10 minutes.
            </p>
          </div>
        </div>
      ) : (
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <h1 style={{ ...styles.h1, color: accent }}>{partnerName}</h1>
          <p style={styles.lead}>Free Insurance Policy Review</p>
          <p style={{ fontSize: 13, color: "#666", marginTop: 8 }}>
            Upload your insurance policy — homeowners, auto, or commercial. We'll send you a plain-English
            review of your coverage, gaps, and savings opportunities — usually within 10 minutes.
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Partner code only on generic form */}
        {!tenant && (
          <Field label="Partner code (optional)" hint="If a broker or attorney sent you here, enter their code. Otherwise leave blank.">
            <input
              type="text"
              name="partner_code"
              value={form.partner_code}
              onChange={handleChange}
              style={styles.input}
              placeholder="e.g. SMITH123"
            />
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

        {/* Step 1 — qualifying question */}
        <Field label="What type of policy do you want us to review today?" required>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            {[
              { value: "homeowners", label: "Homeowners", emoji: "🏠" },
              { value: "auto",       label: "Automobile", emoji: "🚗" },
              { value: "commercial", label: "Commercial", emoji: "🏢" }
            ].map(opt => {
              const active = form.policy_category === opt.value;
              return (
                <label
                  key={opt.value}
                  style={{
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                    padding: "14px 10px",
                    border: `2px solid ${active ? accent : "#DDD"}`,
                    background: active ? `${accent}10` : "#FFF",
                    borderRadius: 10,
                    cursor: "pointer",
                    transition: "all 0.15s",
                    fontWeight: active ? 700 : 500,
                    fontSize: 14
                  }}
                >
                  <input
                    type="radio"
                    name="policy_category"
                    value={opt.value}
                    checked={active}
                    onChange={handleChange}
                    style={{ position: "absolute", opacity: 0, width: 1, height: 1 }}
                  />
                  <span style={{ fontSize: 24 }}>{opt.emoji}</span>
                  <span>{opt.label}</span>
                </label>
              );
            })}
          </div>
        </Field>

        {/* Step 2 — category-specific fields */}
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
                <input
                  type="text"
                  name="property_address"
                  required
                  value={form.property_address}
                  onChange={handleChange}
                  style={styles.input}
                  placeholder="2019 Toyota Camry SE"
                />
              </Field>
            ) : (
              <>
                <Field label={form.policy_category === "commercial" ? "Business address" : "Property address"} required>
                  <input
                    type="text"
                    name="property_address"
                    required
                    value={form.property_address}
                    onChange={handleChange}
                    style={styles.input}
                    placeholder="123 Main St, Miami, FL 33101"
                  />
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

        <Field label="Your policy PDF" required hint="Maximum 25 MB. Accepted: PDF only.">
          <input type="file" name="pdf_file" accept="application/pdf" required onChange={handleChange} style={styles.input} />
        </Field>

        {/* Consent + disclaimer */}
        <div style={styles.disclaimer}>
          <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 13, color: "#444" }}>
            <input type="checkbox" name="consent" required checked={form.consent} onChange={handleChange} style={{ marginTop: 3 }} />
            <span>
              I authorize KISS to review the policy I am uploading and to send a written report to my email
              address. I understand this report is for informational purposes only and is not legal advice,
              insurance advice, or a recommendation to buy or change coverage.
            </span>
          </label>
        </div>

        {submitError && (
          <div style={{ background: "#FDEDEC", border: "1px solid #E74C3C", padding: 12, borderRadius: 8, color: "#C0392B", marginBottom: 16, fontSize: 14 }}>
            {submitError}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting || !form.consent}
          style={{ ...styles.submitBtn, background: accent, opacity: submitting || !form.consent ? 0.6 : 1 }}
        >
          {submitting ? "Uploading…" : "Submit for Review"}
        </button>

        <p style={{ fontSize: 11, color: "#999", textAlign: "center", marginTop: 24, lineHeight: 1.5 }}>
          Your policy is uploaded over an encrypted connection and stored privately. Reports are generated by
          AI and reviewed for accuracy.<br/>
          KISS — Keep Insurance Super Simple · Powered by Optimizing Group LLC
        </p>
      </form>
    </div>
  );
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────
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
  wrap: {
    maxWidth: 560,
    margin: "0 auto",
    padding: "32px 20px",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    color: "#222"
  },
  h1: { fontSize: 28, fontWeight: 700, margin: "0 0 8px", lineHeight: 1.2 },
  lead: { fontSize: 16, color: "#444", margin: "0 0 4px", lineHeight: 1.5 },
  input: {
    width: "100%",
    padding: "10px 12px",
    fontSize: 15,
    border: "1px solid #DDD",
    borderRadius: 8,
    outline: "none",
    boxSizing: "border-box",
    fontFamily: "inherit"
  },
  submitBtn: {
    width: "100%",
    padding: "14px 20px",
    fontSize: 16,
    fontWeight: 700,
    color: "#FFF",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    marginTop: 8
  },
  disclaimer: {
    background: "#F8F9FA",
    border: "1px solid #E5E5E5",
    borderRadius: 8,
    padding: 14,
    margin: "16px 0"
  },
  center: {
    minHeight: "60vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "-apple-system, sans-serif"
  },
  spinner: {
    width: 18, height: 18,
    border: "2px solid #DDD",
    borderTopColor: "#1A5276",
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
    marginRight: 12
  }
};
