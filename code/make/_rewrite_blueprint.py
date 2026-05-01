#!/usr/bin/env python3
"""
Rewrites KISS Make blueprint v2 with two changes:
  1. Wires policy_effective_date + policy_expiration_date from extraction (module 6/7)
     into the submissions row PATCH at module 16, using if() to handle "Not found" as null.
  2. Replaces the single consumer-report GPT call (old module 8) with a Router that
     branches on policy_type — Auto prompt vs Residential prompt — each with its own
     full GPT-4o call.

Downstream references (module 13 save reports, module 14 email homeowner) are updated
to use the ifempty(<auto-out>; <residential-out>) merge pattern that's already used
elsewhere in this blueprint (see module 13's existing partner-report ifempty).

This script is idempotent — running it multiple times against the SAME source produces
identical output. It's intentionally checked in alongside the blueprint so future
sessions can see exactly how the blueprint was generated.
"""
from __future__ import annotations
import json, re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent  # KISS/
SRC = ROOT / "code" / "make" / "blueprint_v2.pre-2026-05-01.json.bak"
DST = ROOT / "code" / "make" / "blueprint_v2.json"
PROMPT_AUTO = ROOT / "code" / "prompts" / "consumer-report-auto.txt"
PROMPT_RES  = ROOT / "code" / "prompts" / "consumer-report-residential.txt"

# Module IDs for the two new branch GPT modules.
# Existing flow uses 1..16; we use 17/18 for the new auto/residential consumer-report
# GPT calls so they don't collide with anything downstream.
ID_AUTO = 17
ID_RES  = 18

def load_prompt_body(path: Path) -> str:
    """
    Strip the leading metadata header (everything up to and including the first
    `===...===` line that follows the metadata block) and return the prompt body.

    Also strips the prompt's own EXTRACTED POLICY DATA / DRIVER DETAILS context
    blocks because the prompt files were written against an older module numbering
    where {{16}} referred to extraction. In the v2 blueprint the parsed extraction
    is module {{7}} and submission fields live on {{2}}, so we strip the old
    placeholder blocks here and re-append fresh ones with correct refs in main().
    """
    text = path.read_text(encoding="utf-8")
    lines = text.splitlines()
    # Drop the file-level metadata header (PROMPT NAME / USED IN / TRIGGER / ...)
    first_div = next((i for i, ln in enumerate(lines) if re.match(r"^=+\s*$", ln)), None)
    if first_div is not None:
        lines = lines[first_div + 1:]
    body = "\n".join(lines).strip()

    # Strip the "DRIVER DETAILS" or "PROPERTY DETAILS" or "DRIVER / HOMEOWNER DETAILS" block
    # (delimited by lines of '=' chars) since the placeholders inside it ({{2.contact_name}}, etc.)
    # are correct, but our common_context block re-supplies them — so we strip to dedupe.
    body = re.sub(
        r"={5,}\s*\n(DRIVER DETAILS|PROPERTY DETAILS|DRIVER / HOMEOWNER DETAILS)\s*\n={5,}\s*\n.*?(?=\n={5,})",
        "",
        body,
        count=1,
        flags=re.DOTALL,
    )
    # Strip the "EXTRACTED POLICY DATA" block — it references {{16}} (stale numbering).
    # Our common_context block re-supplies this with correct {{7}}.
    body = re.sub(
        r"={5,}\s*\n(EXTRACTED POLICY DATA(?: \(JSON\))?)\s*\n={5,}\s*\n.*?(?=\n={5,})",
        "",
        body,
        count=1,
        flags=re.DOTALL,
    )
    # Defensive: also nuke any remaining bare {{16}} references in case the regex
    # misses a variant of the section header.
    body = body.replace("{{16}}", "")
    return body.strip()

def main() -> None:
    bp = json.loads(SRC.read_text(encoding="utf-8"))

    auto_prompt_body = load_prompt_body(PROMPT_AUTO)
    res_prompt_body  = load_prompt_body(PROMPT_RES)

    # The model needs the form context AND the extracted JSON. We append both at the end.
    # {{2.*}} = submission row from module 2; {{7}} = parsed extraction JSON from module 7.
    common_context = (
        "\n\n"
        "================================================================================\n"
        "DRIVER / HOMEOWNER DETAILS\n"
        "================================================================================\n"
        "Name: {{2.contact_name}}\n"
        "Address: {{2.property_address}}\n"
        "Square Footage: {{2.sq_footage}}\n"
        "Year Built: {{2.year_built}}\n"
        "Policy Type: {{2.policy_type}}\n\n"
        "================================================================================\n"
        "EXTRACTED POLICY DATA (JSON)\n"
        "================================================================================\n"
        "{{7}}\n"
    )
    auto_input = auto_prompt_body + common_context
    res_input  = res_prompt_body  + common_context

    flow = bp["flow"]

    # ---- 1) Update module 6 extraction prompt: dates as ISO 8601, plus policy_class classifier ----
    mod6 = next(m for m in flow if m["id"] == 6)
    mod6["mapper"]["input"] = (
        "You are an insurance policy data extraction specialist. Extract the following "
        "fields from this insurance policy and return ONLY raw JSON with no markdown, "
        "no code blocks, no explanation.\n\n"
        "Required JSON structure:\n"
        "{\n"
        '  "named_insured": "",\n'
        '  "property_address": "",\n'
        '  "policy_number": "",\n'
        '  "policy_effective_date": "",\n'
        '  "policy_expiration_date": "",\n'
        '  "insurance_company": "",\n'
        '  "policy_type": "",\n'
        '  "policy_class": "",\n'
        '  "coverages": [{"type": "", "limit": "", "deductible": ""}],\n'
        '  "exclusions": [],\n'
        '  "endorsements": [],\n'
        '  "total_annual_premium": ""\n'
        "}\n\n"
        "FORMAT RULES:\n"
        "- policy_effective_date and policy_expiration_date MUST be in ISO 8601 format "
        "(YYYY-MM-DD). If you cannot find a date, use an empty string \"\" for that field "
        "ONLY (not the string 'Not found').\n"
        "- policy_class MUST be exactly one of: \"auto\" or \"residential\". Use \"auto\" for any "
        "personal auto, PAP, PIP, motorcycle, or vehicle policy. Use \"residential\" for any "
        "homeowner (HO-3, HO-5, HO-6, HO-8, etc.), dwelling (DP-3), renter (HO-4), condo, "
        "BOP, CGL, or other property policy. If genuinely ambiguous, default to "
        "\"residential\".\n"
        "- policy_type stays the raw label from the policy document (e.g., \"HO-3\", "
        "\"Personal Auto Policy\").\n"
        "- For all OTHER fields that cannot be found, use \"Not found\" as the value.\n"
        "- Return ONLY the JSON object, nothing else.\n\n"
        "Policy document content:\n{{5.body}}"
    )

    # ---- 2) Replace single module 8 with a policy-class router ----
    # Find existing module 8 and replace it in-place (preserving order).
    idx_8 = next(i for i, m in enumerate(flow) if m["id"] == 8)

    auto_route = {
        "flow": [
            {
                "id": ID_AUTO,
                "module": "openai-gpt-3:createModelResponse",
                "version": 1,
                "parameters": {"__IMTCONN__": 6008119},
                "filter": {
                    "name": "Auto policy class",
                    "conditions": [[{
                        "a": "{{7.policy_class}}",
                        "b": "auto",
                        "o": "text:equal"
                    }]]
                },
                "mapper": {
                    "model": "gpt-4o",
                    "temperature": 0.3,
                    "input": auto_input
                },
                "metadata": {
                    "designer": {"x": 2400, "y": -200},
                    "label": "Generate consumer report (Auto)"
                }
            }
        ]
    }

    residential_route = {
        "flow": [
            {
                "id": ID_RES,
                "module": "openai-gpt-3:createModelResponse",
                "version": 1,
                "parameters": {"__IMTCONN__": 6008119},
                "filter": {
                    "name": "Residential policy class (default)",
                    "conditions": [[{
                        "a": "{{7.policy_class}}",
                        "b": "auto",
                        "o": "text:notequal"
                    }]]
                },
                "mapper": {
                    "model": "gpt-4o",
                    "temperature": 0.3,
                    "input": res_input
                },
                "metadata": {
                    "designer": {"x": 2400, "y": 200},
                    "label": "Generate consumer report (Residential)"
                }
            }
        ]
    }

    new_module_8 = {
        "id": 8,
        "module": "builtin:BasicRouter",
        "version": 1,
        "parameters": {},
        "mapper": None,
        "filter": None,
        "metadata": {
            "designer": {"x": 2100, "y": 0},
            "label": "Branch consumer report by policy class"
        },
        "routes": [auto_route, residential_route]
    }

    flow[idx_8] = new_module_8

    # ---- 3) Update module 13 (Save reports) — consumer report_body now uses ifempty merge ----
    mod13 = next(m for m in flow if m["id"] == 13)
    old_raw = mod13["mapper"]["rawContent"]
    # Replace {{8.output[].content[].text}} with ifempty(17;18)
    new_raw = old_raw.replace(
        "{{8.output[].content[].text}}",
        "{{ifempty(17.output[].content[].text;18.output[].content[].text)}}"
    )
    assert new_raw != old_raw, "module 13 rewrite failed — pattern not found"
    mod13["mapper"]["rawContent"] = new_raw

    # ---- 4) Update module 14 (Email homeowner) — same merge ----
    mod14 = next(m for m in flow if m["id"] == 14)
    old_raw14 = mod14["mapper"]["rawContent"]
    new_raw14 = old_raw14.replace(
        "{{8.output[].content[].text}}",
        "{{ifempty(17.output[].content[].text;18.output[].content[].text)}}"
    )
    assert new_raw14 != old_raw14, "module 14 rewrite failed — pattern not found"
    mod14["mapper"]["rawContent"] = new_raw14

    # ---- 5) Update module 16 (Mark completed) — add policy date columns ----
    mod16 = next(m for m in flow if m["id"] == 16)
    # Use if() to convert empty extraction date string to JSON null literal,
    # else wrap in quotes. Make's if(condition; truthy; falsy) function handles this.
    # The expression: if(7.policy_expiration_date; "\"" + 7.policy_expiration_date + "\""; "null")
    #   - truthy non-empty string → quoted ISO date
    #   - empty string → bare null
    new_body_16 = (
        '{'
        '"status":"completed",'
        '"processing_completed_at":"{{now}}",'
        '"policy_effective_date":'
            '{{if(7.policy_effective_date; "\\"" + 7.policy_effective_date + "\\""; "null")}},'
        '"policy_expiration_date":'
            '{{if(7.policy_expiration_date; "\\"" + 7.policy_expiration_date + "\\""; "null")}}'
        '}'
    )
    mod16["mapper"]["rawContent"] = new_body_16

    # ---- 6) Bump scenario name to flag the v2.2 update ----
    bp["name"] = "KISS Insurance Policy Review v2.2 - Supabase Pipeline (auto/residential + renewal tracking)"

    # ---- 7) Append change-log to setup checklist ----
    if "_SETUP_CHECKLIST" in bp:
        if not any("v2.2" in item for item in bp["_SETUP_CHECKLIST"]):
            bp["_SETUP_CHECKLIST"].append(
                "v2.2 changes: extraction prompt now outputs ISO 8601 dates; "
                "module 8 is now a policy-class router (Auto vs Residential); "
                "module 16 PATCH writes policy_effective_date + policy_expiration_date "
                "to enable the daily renewal-reminder scenario. After import, MANUALLY verify "
                "the two new GPT modules (id 17 Auto, id 18 Residential) have the OpenAI "
                "connection set to IMTCONN 6008119 — Make sometimes drops connection "
                "references on blueprint import."
            )

    DST.write_text(json.dumps(bp, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Wrote {DST} ({DST.stat().st_size} bytes)")
    print(f"Modules in flow: {[m['id'] for m in flow]}")

if __name__ == "__main__":
    main()
