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
    property_address: "",
    sq_footage: "",
    year_built: "",
    policy_type: "HO-3",
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
        .select("id, slug, persona, brand_name, brand_logo_url, brand_color, status")
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
      .select("id, slug, persona, brand_name, brand_logo_url, brand_color, status")
      .eq("partner_code", code.toUpperCase())
      .eq("status", "active")
      .single();
    return data || null;
  };

  const handleChange = (e) => {
    const { name, value, type, checked, files } = e.target;
    setForm(f => ({
      ...f,
      [name]: type === "checkbox" ? checked : type === "file" ? files[0] : value
    }));
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

      // 3. Create submission row first (so we have an ID for the storage path)
      const { data: submission, error: subError } = await supabase
        .from("submissions")
        .insert({
          tenant_id: activeTenant.id,
          intake_source: slug ? "branded_form" : "generic_form",
          contact_name: form.contact_name,
          contact_email: form.contact_email,
          contact_phone: form.contact_phone || null,
          property_address: form.property_address,
          sq_footage: form.sq_footage ? parseInt(form.sq_footage) : null,
          year_built: form.year_built ? parseInt(form.year_built) : null,
          policy_type: form.policy_type,
          pdf_storage_path: "pending", // updated after upload
          consent_to_review: form.consent,
          consent_timestamp: form.consent ? new Date().toISOString() : null,
          status: "pending"
        })
        .select()
        .single();
      if (subError) throw subError;

      // 4. Upload PDF
      const path = `policies/${activeTenant.id}/${submission.id}.pdf`;
      const { error: uploadError } = await supabase.storage
        .from("policies")
        .upload(path, form.pdf_file, { contentType: "application/pdf", upsert: false });
      if (uploadError) throw uploadError;

      // 5. Update submission with the real storage path
      await supabase.from("submissions")
        .update({ pdf_storage_path: path })
        .eq("id", submission.id);

      // 6. Fire Make webhook (Make signs the URL and processes)
      const webhookResp = await fetch(MAKE_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submission_id: submission.id })
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
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        {tenant?.brand_logo_url && (
          <img src={tenant.brand_logo_url} alt={partnerName} style={{ maxHeight: 56, marginBottom: 12 }} />
        )}
        <h1 style={{ ...styles.h1, color: accent }}>{partnerName}</h1>
        <p style={styles.lead}>Free Insurance Policy Review</p>
        <p style={{ fontSize: 13, color: "#666", marginTop: 8 }}>
          Upload your homeowner's insurance policy. We'll send you a plain-English review of your coverage,
          gaps, and savings opportunities — usually within 10 minutes.
        </p>
      </div>

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

        <Field label="Property address" required>
          <input type="text" name="property_address" required value={form.property_address} onChange={handleChange} style={styles.input} placeholder="123 Main St, Miami, FL 33101" />
        </Field>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Square footage">
            <input type="number" name="sq_footage" value={form.sq_footage} onChange={handleChange} style={styles.input} placeholder="2400" />
          </Field>
          <Field label="Year built">
            <input type="number" name="year_built" value={form.year_built} onChange={handleChange} style={styles.input} placeholder="1998" />
          </Field>
        </div>

        <Field label="Policy type">
          <select name="policy_type" value={form.policy_type} onChange={handleChange} style={styles.input}>
            <option>HO-3 (most common)</option>
            <option>HO-5</option>
            <option>HO-6 (condo)</option>
            <option>HO-8</option>
            <option>DP-3 (rental property)</option>
            <option>Not sure</option>
          </select>
        </Field>

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
