import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { createClient } from "@supabase/supabase-js";
import { PDFDocument } from "pdf-lib";

const MAX_MB = 50;          // generous cap — commercial full policies are large
const HARD_PAGE_CAP = 600;  // matches api/split-policy.js; refuse beyond this
const SPLIT_THRESHOLD = 100; // > this gets processed in sections (Anthropic page limit)

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const MAKE_REVIEW_WEBHOOK_URL = import.meta.env.VITE_MAKE_REVIEW_WEBHOOK_URL;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ─── KISS STEP 2 — POLICY UPLOAD ─────────────────────────────────────────────
// Loads the lead context from sessionStorage (or DB fallback) using the
// submissionId from the URL. Uploads the PDF and fires the Policy Review
// webhook with all data inline.
// ─────────────────────────────────────────────────────────────────────────────
export default function KissStep2Upload() {
  const { slug, submissionId } = useParams();
  const navigate = useNavigate();

  const [tenant, setTenant] = useState(null);
  const [leadContext, setLeadContext] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [pdfFile, setPdfFile] = useState(null);
  const [fileNotice, setFileNotice] = useState(null); // { type: 'info'|'error', text }
  const [fileBlocked, setFileBlocked] = useState(false);

  const handleFileSelect = async (file) => {
    setFileNotice(null);
    setFileBlocked(false);
    setPdfFile(null);
    if (!file) return;
    if (file.type !== "application/pdf") {
      setFileNotice({ type: "error", text: "That's not a PDF. Please upload your policy as a PDF file." });
      setFileBlocked(true);
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setFileNotice({ type: "error", text: `This file is ${(file.size / 1024 / 1024).toFixed(0)} MB — over the ${MAX_MB} MB limit. Please upload the declarations and endorsement pages, or contact us.` });
      setFileBlocked(true);
      return;
    }
    setPdfFile(file);
    // Read page count so we can set expectations (or stop an unprocessable file).
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const pages = doc.getPageCount();
      if (pages > HARD_PAGE_CAP) {
        setFileNotice({ type: "error", text: `This policy is ${pages} pages — too large to process automatically. Please upload just the declarations and endorsement pages, or contact us and we'll help.` });
        setFileBlocked(true);
        setPdfFile(null);
      } else if (pages > SPLIT_THRESHOLD) {
        setFileNotice({ type: "info", text: `Full commercial policy detected (${pages} pages). We'll review it in sections — your report may take a few extra minutes to arrive.` });
      } else {
        setFileNotice({ type: "info", text: `${pages}-page policy ready to upload.` });
      }
    } catch {
      // Couldn't parse page count (rare) — allow upload; server-side guard still applies.
      setFileNotice({ type: "info", text: "Policy attached." });
    }
  };
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        // Try sessionStorage first (came from Step 1 in same browser session)
        const stash = sessionStorage.getItem(`kiss-lead-${submissionId}`);
        if (stash) {
          const parsed = JSON.parse(stash);
          setLeadContext(parsed.payload);
          setTenant(parsed.tenant);
          setLoading(false);
          return;
        }

        // Fallback: user came from the welcome email in a fresh browser.
        // RLS policy "anon resume lead capture by id (30 day window)"
        // permits reading status='lead_captured' submissions for 30 days
        // after creation, so we can rehydrate the lead context here.
        const { data: tenantData } = await supabase
          .from("tenants")
          .select("id, slug, persona, brand_name, brand_logo_url, brand_color, partner_tagline, partner_photo_url, partner_bio, contact_email, status")
          .eq("slug", slug)
          .eq("status", "active")
          .single();
        if (!tenantData) {
          setLoadError("This partner is no longer active. Please contact your agent for a new link.");
          setLoading(false);
          return;
        }
        setTenant(tenantData);

        const { data: submission, error: subError } = await supabase
          .from("submissions")
          .select("id, contact_name, contact_email, contact_phone, property_address, property_city, property_state, property_zip, property_county, sq_footage, year_built, policy_type, status, created_at")
          .eq("id", submissionId)
          .single();

        if (subError || !submission) {
          setLoadError("This upload link is no longer valid. It may have expired (links last 30 days) or already been used. Please start over with a new review.");
          setLoading(false);
          return;
        }
        if (submission.status === "completed") {
          setLoadError("This review has already been completed. Check your email for the report.");
          setLoading(false);
          return;
        }
        if (submission.status === "processing") {
          setLoadError("This policy is already being reviewed. You'll receive your report at " + submission.contact_email + " in the next few minutes.");
          setLoading(false);
          return;
        }

        setLeadContext({
          submission_id: submission.id,
          tenant_id: tenantData.id,
          tenant_slug: tenantData.slug,
          tenant_persona: tenantData.persona,
          tenant_brand_name: tenantData.brand_name,
          tenant_contact_email: tenantData.contact_email,
          contact_name: submission.contact_name,
          contact_email: submission.contact_email,
          contact_phone: submission.contact_phone || "",
          property_address: submission.property_address,
          property_city: submission.property_city || "",
          property_state: submission.property_state || "",
          property_zip: submission.property_zip || "",
          property_county: submission.property_county || "",
          sq_footage: submission.sq_footage || 0,
          year_built: submission.year_built || 0,
          policy_type: submission.policy_type,
        });
        setLoading(false);
      } catch (err) {
        setLoadError("Could not load your review. Please start over by visiting /" + slug + " or contact your agent.");
        setLoading(false);
      }
    })();
  }, [slug, submissionId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitting(true);

    try {
      if (!pdfFile) throw new Error("Please attach your full policy PDF.");
      if (pdfFile.type !== "application/pdf") throw new Error("File must be a PDF.");
      if (pdfFile.size > MAX_MB * 1024 * 1024) throw new Error(`PDF must be under ${MAX_MB} MB.`);

      // Upload PDF to storage. upsert: false because anon doesn't have
      // SELECT permission on storage.objects (which upsert needs to check
      // existing files). The submission UUID is unique per lead so this is
      // a fresh insert. Including a millisecond suffix lets the same lead
      // re-upload if the first attempt errored.
      const path = `policies/${tenant.id}/${submissionId}-${Date.now()}.pdf`;
      const { error: uploadError } = await supabase.storage
        .from("policies")
        .upload(path, pdfFile, { contentType: "application/pdf", upsert: false });
      if (uploadError) throw uploadError;

      // Generate a signed URL here so Make doesn't have to deal with
      // Supabase response parsing — pass the full URL ready to use.
      const { data: signed, error: signError } = await supabase.storage
        .from("policies")
        .createSignedUrl(path, 3600);
      if (signError || !signed?.signedUrl) {
        throw new Error("Could not generate signed PDF URL. Please try again.");
      }

      const payload = {
        ...leadContext,
        tenant_brand_logo_url: tenant?.brand_logo_url || "",
        tenant_brand_color: tenant?.brand_color || "",
        pdf_storage_path: path,
        signed_pdf_url: signed.signedUrl,
        consent_to_review: true,
        consent_timestamp: new Date().toISOString(),
      };

      const webhookResp = await fetch(MAKE_REVIEW_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!webhookResp.ok) {
        console.warn("Review webhook failed:", webhookResp.status);
      }

      // Clear stash
      sessionStorage.removeItem(`kiss-lead-${submissionId}`);

      setSubmitSuccess(true);
    } catch (err) {
      setSubmitError(err.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div style={styles.center}><div style={styles.spinner} />Loading…</div>;
  }
  if (loadError) {
    return <div style={styles.center}><p style={{ color: "#C0392B" }}>{loadError}</p></div>;
  }

  const accent = tenant?.brand_color || "#27AE60";
  const partnerName = tenant?.brand_name || "KISS Policy Review";
  const isWhiteLabel = !!(tenant && (tenant.partner_tagline || tenant.partner_photo_url || tenant.partner_bio || tenant.brand_logo_url));

  if (submitSuccess) {
    const isFlood = leadContext?.policy_type === "flood";
    const isAuto = leadContext?.policy_type === "auto";
    const slug = tenant?.slug;
    return (
      <div style={{ ...styles.wrap, textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>✓</div>
        <h1 style={styles.h1}>Got it, {(leadContext?.contact_name || "").split(" ")[0] || "thanks"}.</h1>
        <p style={styles.lead}>
          Your policy is being reviewed. You'll receive your report at <strong>{leadContext?.contact_email || "your email"}</strong> within
          the next 5–10 minutes.
        </p>
        {tenant?.persona !== "consumer" && (
          <p style={{ ...styles.lead, fontSize: 14, color: "#666" }}>
            A copy will also be sent to {partnerName}.
          </p>
        )}

        <div style={{ background: "#FFF8E1", border: "2px solid #F39C12", borderRadius: 12, padding: "20px 22px", margin: "28px 0 16px", textAlign: "left" }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: "#946a00", marginBottom: 8 }}>
            One review is rarely enough. Here are your next two free reviews:
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 14 }}>
            {!isFlood && (
              <a href={`/${slug}?policy_type=flood&email=${encodeURIComponent(leadContext?.contact_email || "")}`}
                 style={{ display: "block", background: "#fff", padding: "14px 16px", borderRadius: 10, border: "1px solid #F39C12", textDecoration: "none", color: "#1a2236" }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>🌊 Flood Policy (NFIP)</div>
                <div style={{ fontSize: 12, color: "#666", lineHeight: 1.4 }}>Florida flood is ALWAYS a separate policy. Upload yours →</div>
              </a>
            )}
            {!isAuto && (
              <a href={`/${slug}?policy_type=auto&email=${encodeURIComponent(leadContext?.contact_email || "")}`}
                 style={{ display: "block", background: "#fff", padding: "14px 16px", borderRadius: 10, border: "1px solid #F39C12", textDecoration: "none", color: "#1a2236" }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>🚗 Auto Policy</div>
                <div style={{ fontSize: 12, color: "#666", lineHeight: 1.4 }}>PIP, UM/UIM, stacking, rental caps — FL gaps are common. Upload →</div>
              </a>
            )}
          </div>
        </div>

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
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "8px 0 18px" }}>
            <div style={{ flex: 1, height: 1, background: "#E0E0E0" }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: "#888", letterSpacing: 1.5 }}>POWERED BY</span>
            <div style={{ flex: 1, height: 1, background: "#E0E0E0" }} />
          </div>
          <div style={{ textAlign: "center" }}>
            <img src="/assets/kiss-horizontal-logo.png" alt="KISS — Keep Insurance Super Simple" style={{ width: "100%", height: "auto", display: "block", margin: "4px 0 10px" }} />
            <p style={styles.lead}>Step 2 of 2 — Upload Your Policy</p>
          </div>
        </div>
      ) : (
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <img src="/assets/kiss-horizontal-logo.png" alt="KISS — Keep Insurance Super Simple" style={{ width: "100%", maxWidth: 420, height: "auto", display: "block", margin: "0 auto 12px" }} />
          <h1 style={{ ...styles.h1, color: accent }}>{partnerName}</h1>
          <p style={styles.lead}>Step 2 of 2 — Upload Your Policy</p>
        </div>
      )}

      {/* Coaching block */}
      <div style={{ background: "#fff5d6", border: "1px solid #f6c66c", borderLeft: "4px solid #f6c66c", borderRadius: 8, padding: "16px 18px", marginBottom: 22 }}>
        <strong style={{ color: "#946a00", fontSize: 14, display: "block", marginBottom: 8 }}>
          📄 Dec page vs. Full Policy — please upload the FULL policy
        </strong>
        <p style={{ fontSize: 13, margin: 0, lineHeight: 1.55, color: "#444" }}>
          The <strong>Declaration page</strong> (1–3 pages) only shows your limits and deductibles. The <strong>full policy</strong> (40–120+ pages) is where the exclusions, endorsements, and fine print live — that's where most claim disputes start. A review of just the Dec page misses about 80% of what matters.
        </p>
        <p style={{ fontSize: 13, margin: "10px 0 0", lineHeight: 1.55, color: "#444" }}>
          Most carriers email the full policy at start/renewal as a single PDF. If you can't find it, email your agent — they're required to send it.
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#222", marginBottom: 6 }}>
            Your full policy PDF<span style={{ color: "#C0392B" }}> *</span>
          </label>
          <input type="file" accept="application/pdf" required onChange={(e) => handleFileSelect(e.target.files[0])} style={styles.input} />
          <div style={{ fontSize: 11, color: "#888", marginTop: 4 }}>Maximum {MAX_MB} MB. Accepted: PDF only. Large commercial policies are processed in sections.</div>
          {fileNotice && (
            <div style={{
              marginTop: 8, padding: "8px 12px", borderRadius: 8, fontSize: 13,
              background: fileNotice.type === "error" ? "#FDEDEC" : "#EAF4FF",
              border: `1px solid ${fileNotice.type === "error" ? "#E74C3C" : "#9CC4F0"}`,
              color: fileNotice.type === "error" ? "#C0392B" : "#1A5276",
            }}>
              {fileNotice.text}
            </div>
          )}
        </div>

        <div style={styles.disclaimer}>
          <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 13, color: "#444" }}>
            <input type="checkbox" required checked={consent} onChange={(e) => setConsent(e.target.checked)} style={{ marginTop: 3 }} />
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

        <button type="submit" disabled={submitting || !consent || !pdfFile || fileBlocked}
                style={{ ...styles.submitBtn, background: accent, opacity: (submitting || !consent || !pdfFile || fileBlocked) ? 0.6 : 1 }}>
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

const styles = {
  wrap: { maxWidth: 560, margin: "0 auto", padding: "32px 20px", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", color: "#222" },
  h1: { fontSize: 28, fontWeight: 700, margin: "0 0 8px", lineHeight: 1.2 },
  lead: { fontSize: 16, color: "#444", margin: "0 0 4px", lineHeight: 1.5 },
  input: { width: "100%", padding: "10px 12px", fontSize: 15, border: "1px solid #DDD", borderRadius: 8, outline: "none", boxSizing: "border-box", fontFamily: "inherit" },
  submitBtn: { width: "100%", padding: "14px 20px", fontSize: 16, fontWeight: 700, color: "#FFF", border: "none", borderRadius: 8, cursor: "pointer", marginTop: 8 },
  disclaimer: { background: "#F8F9FA", border: "1px solid #E5E5E5", borderRadius: 8, padding: 14, margin: "16px 0" },
  center: { minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "-apple-system, sans-serif" },
  spinner: { width: 18, height: 18, border: "2px solid #DDD", borderTopColor: "#1A5276", borderRadius: "50%", animation: "spin 1s linear infinite", marginRight: 12 }
};
