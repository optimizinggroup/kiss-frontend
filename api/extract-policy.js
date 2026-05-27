import { PDFDocument } from "pdf-lib";
import { EXTRACTION_PROMPTS, classifyPolicy } from "./_extraction-prompts.js";

// ─── KISS — POLICY EXTRACTION (split + parallel extract + merge) ─────────────
// Make calls this once after upload with the signed PDF URL and the user's
// selected policy_type. Returns the merged structured policy data as JSON so
// Make can go straight to report generation.
//   • Fetches the PDF from the signed URL (no Supabase creds needed here).
//   • ≤100 pages → one Claude extraction call.
//   • >100 pages → splits into ≤90-page chunks, extracts each IN PARALLEL,
//                  then deep-merges the JSON (real values beat "Not found",
//                  lists unioned, key_findings booleans OR'd).
// Anthropic caps PDF documents at 100 pages; parallel calls keep total latency
// near a single call so we stay inside the serverless time limit. The long
// report-generation step stays in Make (no tight timeout there).
//
// Only secret required: ANTHROPIC_API_KEY (Vercel env var).
// ─────────────────────────────────────────────────────────────────────────────

export const config = { maxDuration: 300 };

const CHUNK_PAGES = 90;
const MAX_DIRECT = 100;
const HARD_PAGE_CAP = 600;
const MODEL = "claude-sonnet-4-6";

async function extractChunk(pdfBytes, prompt, partLabel) {
  const b64 = Buffer.from(pdfBytes).toString("base64");
  const text = partLabel
    ? `(This is ${partLabel} of a larger policy that was split into sections. Extract only what is present in THIS section; leave anything not in this section as "Not found" or empty.)\n\n${prompt}`
    : prompt;
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4096,
      temperature: 0,
      messages: [{
        role: "user",
        content: [
          { type: "document", source: { type: "base64", media_type: "application/pdf", data: b64 } },
          { type: "text", text },
        ],
      }],
    }),
  });
  if (!resp.ok) throw new Error(`Anthropic ${resp.status}: ${(await resp.text()).slice(0, 300)}`);
  const data = await resp.json();
  let raw = data.content?.[0]?.text || "";
  raw = raw.replace(/```json/g, "").replace(/```/g, "").trim();
  return JSON.parse(raw);
}

const isEmpty = (v) => v === null || v === undefined || v === "" || v === "Not found" ||
  (Array.isArray(v) && v.length === 0) || (typeof v === "object" && !Array.isArray(v) && Object.keys(v).length === 0);

function deepMerge(a, b) {
  if (Array.isArray(a) || Array.isArray(b)) {
    const seen = new Set();
    const out = [];
    for (const item of [...(a || []), ...(b || [])]) {
      const key = JSON.stringify(item);
      if (!seen.has(key)) { seen.add(key); out.push(item); }
    }
    return out;
  }
  if (typeof a === "boolean" || typeof b === "boolean") return Boolean(a) || Boolean(b);
  if (a && typeof a === "object" && b && typeof b === "object") {
    const out = {};
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) out[k] = deepMerge(a[k], b[k]);
    return out;
  }
  return isEmpty(a) ? b : a;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const { signed_pdf_url, policy_type } = req.body || {};
  if (!signed_pdf_url) return res.status(400).json({ error: "Missing signed_pdf_url." });

  try {
    const policy_class = classifyPolicy(policy_type || "");
    const prompt = EXTRACTION_PROMPTS[policy_class];

    const pdfResp = await fetch(signed_pdf_url);
    if (!pdfResp.ok) throw new Error(`PDF fetch failed: ${pdfResp.status}`);
    const srcBytes = new Uint8Array(await pdfResp.arrayBuffer());

    const srcDoc = await PDFDocument.load(srcBytes, { ignoreEncryption: true });
    const pageCount = srcDoc.getPageCount();
    if (pageCount > HARD_PAGE_CAP) {
      return res.status(413).json({ error: "too_large", page_count: pageCount });
    }

    let extracted;
    let chunkCount = 1;

    if (pageCount <= MAX_DIRECT) {
      extracted = await extractChunk(srcBytes, prompt, null);
    } else {
      const ranges = [];
      for (let s = 0; s < pageCount; s += CHUNK_PAGES) ranges.push([s, Math.min(s + CHUNK_PAGES, pageCount)]);
      chunkCount = ranges.length;
      const chunkBytes = await Promise.all(ranges.map(async ([s, e]) => {
        const d = await PDFDocument.create();
        const pages = await d.copyPages(srcDoc, Array.from({ length: e - s }, (_, i) => s + i));
        pages.forEach((p) => d.addPage(p));
        return d.save();
      }));
      const parts = await Promise.all(
        chunkBytes.map((bytes, i) => extractChunk(bytes, prompt, `part ${i + 1} of ${ranges.length}`))
      );
      extracted = parts.reduce((acc, p) => deepMerge(acc, p));
    }

    return res.status(200).json({
      policy_class,
      page_count: pageCount,
      chunk_count: chunkCount,
      extracted,
      extracted_json: JSON.stringify(extracted),
    });
  } catch (err) {
    return res.status(500).json({ error: "extract_failed", message: err.message });
  }
}
