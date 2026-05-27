// Auto-generated extraction prompts for api/extract-policy.js. Keep schemas in sync with
// the report prompts in code/make/gold_prompts_may21/. One per policy class.

export const EXTRACTION_PROMPTS = {
  residential: `You are extracting insurance policy data for K.I.S.S. Read the entire attached PDF carefully — every page of declarations, every endorsement form, every schedule. Extract DIRECTLY from the document. Do NOT invent data. If a value is not in the document, use the string "Not found".

Return ONE JSON object with this exact structure, starting with { and ending with }. No markdown, no code fences, no prose.

{
  "policy_identity": {"named_insured":"","property_address":"","policy_number":"","carrier":"","agent":"","mortgagee":"","policy_form":"","policy_class":"residential","effective_date":"","expiration_date":"","year_built":"","construction_type":"","protection_class":"","territory":"","wind_mitigation":"","total_premium":"","hurricane_premium":""},
  "coverages": {"A_dwelling":"","B_other_structures":"","C_personal_property":"","D_loss_of_use":"","E_personal_liability":"","F_medical_payments":""},
  "valuation": {"coverage_a":"","coverage_b":"","coverage_c":"","roof":""},
  "deductibles": {"all_other_perils":"","hurricane":"","hurricane_percent":"","hurricane_dollars":"","sinkhole":"","water":"","mold":"","flood":""},
  "exclusions": [],
  "endorsements": [{"name":"","form_number":"","limit":"","notes":""}],
  "caps_and_sublimits": {"mold_property":"","mold_liability":"","jewelry_watches_furs":"","firearms":"","silverware":"","fine_art":"","electronics":"","computers":"","tools":"","wine_spirits":"","musical_instruments":"","collectibles":"","money_securities":"","business_property":"","loss_assessment":"","ordinance_or_law":"","trees_shrubs_plants":"","fire_dept_service":"","credit_card_forgery":"","debris_removal":"","matching":"","cosmetic_damage":"","water_backup":"","service_line":"","equipment_breakdown":""},
  "key_findings": {"flood_excluded":true,"sinkhole_excluded":false,"catastrophic_ground_collapse_only":false,"mold_capped":false,"matching_limited":false,"acv_roof":false,"acv_contents":false,"high_value_items_unscheduled":false,"vacancy_clause_present":false,"wind_mitigation_credit_indicated":false,"hurricane_loss_mitigation_notice":false}
}

Extraction rules:
- Flood is ALWAYS excluded on Florida homeowners policies — NFIP (the federal flood insurance program) is a separate program, not a policy on this contract. Set flood_excluded=true.
- Capture exact dollar amounts and percentages from declarations.
- For hurricane deductible: if expressed as a percentage, compute hurricane_dollars = Coverage A x percent.
- valuation.roof: check for ACV roof endorsement or roof deductible schedule. Note ACV explicitly if found, otherwise RCV.
- List ALL endorsements by form number from the schedule (e.g. HO 04 90, HC 09 DN 12 13, OIR-B1-1655, OIR-B1-1670).
- key_findings.wind_mitigation_credit_indicated=true if you see OIR-B1-1655, HC WL 05 13, or any wind mitigation discount notice.
- key_findings.hurricane_loss_mitigation_notice=true if OIR-B1-1655 is present.
- key_findings.catastrophic_ground_collapse_only=true if sinkhole is excluded but Catastrophic Ground Cover Collapse coverage is referenced.

Return ONLY the JSON.`,

  auto: `You are extracting AUTO insurance policy data for K.I.S.S. Read the entire attached PDF carefully — declarations, every vehicle, every coverage line, endorsements, discounts. Extract DIRECTLY from the document. Do NOT invent data. If a value is not in the document use the string "Not found".

Return ONE JSON object, starting with { and ending with }. No markdown, no code fences, no prose.

{
  "policy_identity": {"named_insured":"","mailing_address":"","garaging_state":"","policy_number":"","carrier":"","agent":"","policy_form":"","policy_class":"auto","effective_date":"","expiration_date":"","total_premium":"","term":""},
  "drivers": [{"name":"","age_or_dob":"","status":""}],
  "vehicles": [{"year":"","make":"","model":"","vin":"","usage":"","financed_or_leased":""}],
  "coverages": {
    "bodily_injury_liability":"",
    "property_damage_liability":"",
    "pip":"",
    "pip_deductible":"",
    "medical_payments":"",
    "uninsured_motorist":"",
    "underinsured_motorist":"",
    "um_stacked":"",
    "comprehensive_deductible":"",
    "collision_deductible":"",
    "rental_reimbursement":"",
    "towing_roadside":"",
    "gap_loan_lease":"",
    "custom_equipment":""
  },
  "premium_by_coverage": {},
  "discounts": [],
  "endorsements": [{"name":"","form_number":"","notes":""}],
  "key_findings": {
    "um_present":false,
    "um_rejected":false,
    "um_stacked":false,
    "pip_present":false,
    "pip_minimum_only":false,
    "medpay_present":false,
    "bi_below_100_300":false,
    "bi_at_state_minimum":false,
    "comp_collision_present":false,
    "financed_vehicle_without_gap":false,
    "rental_present":false
  }
}

Extraction rules:
- Florida is a no-fault state: PIP (Personal Injury Protection) is normally required at $10,000 (F.S. 627.736). If PIP shows only $10,000 with no added MedPay, set pip_minimum_only=true.
- Bodily Injury (BI) liability is shown as per-person/per-accident (e.g. 100/300 = $100,000/$300,000). If absent or below 100/300 set bi_below_100_300=true; if at 25/50 set bi_at_state_minimum=true.
- Uninsured/Underinsured Motorist (UM/UIM): if not present set um_present=false and um_rejected=true (FL requires a signed written rejection to waive UM — F.S. 627.727). Capture stacked vs non-stacked.
- Capture comprehensive and collision deductibles per the dec. If neither present, comp_collision_present=false (liability-only policy).
- List each vehicle separately. Note financed/leased vehicles (gap exposure).
- Capture exact dollar amounts and limits.

Return ONLY the JSON.
`,

  commercial: `You are extracting COMMERCIAL PROPERTY insurance policy data for K.I.S.S. Read the attached declaration pages, supplemental declarations, and endorsements carefully. Extract DIRECTLY from the document. Do NOT invent data. If a value is not in the document use the string "Not found".

Return ONE JSON object, starting with { and ending with }. No markdown, no code fences, no prose.

{
  "policy_identity": {"named_insured":"","mailing_address":"","property_location":"","producer":"","policy_class":"commercial_property","effective_date":"","expiration_date":"","total_premium":"","minimum_earned_premium":"","surplus_lines":false,"carriers":[{"name":"","policy_number":"","participation_pct":"","premium":""}]},
  "coverage_summary": {"total_insurable_value":"","coverage_parts":[],"perils_covered":"","coinsurance_pct":""},
  "coverages": {"real_property_building":"","business_personal_property":"","business_income_rents":"","extra_expense":"","monthly_limit_indemnity":"","agreed_value":"","inflation_guard":""},
  "valuation": {"real_property":"","roof":"","notes":""},
  "deductibles": {"all_other_perils":"","windstorm_hail_percent":"","windstorm_hail_dollars":"","named_storm":"","flood":"","earthquake":"","sinkhole":""},
  "sublimits": {"extra_expense":"","pilings_piers_wharves_docks":"","ordinance_or_law":"","debris_removal":"","abandoned_condemned_property":""},
  "exclusions": [],
  "warranties": [],
  "endorsements": [{"name":"","form_number":""}],
  "key_findings": {"flood_excluded":false,"named_storm_excluded":false,"earthquake_excluded":false,"sinkhole_excluded_or_warranted":false,"coinsurance_present":false,"acv_roof_condition":false,"wind_percent_deductible":false,"ordinance_law_50pct_trigger":false,"terrorism_excluded":false,"business_income_present":false,"extra_expense_sublimited":false,"eifs_warranty":false,"outstanding_damage_exclusion":false,"no_prior_losses_warranty":false}
}

Extraction rules:
- This is often a layered/subscription surplus-lines policy (multiple carriers each with a participation percentage). List each carrier with its policy number, participation %, and premium.
- surplus_lines=true if Florida Surplus Lines notices appear (no Florida Insurance Guaranty Association protection).
- Capture the coinsurance percentage exactly (e.g. 90%) — it drives a coinsurance penalty.
- Capture wind/hail deductible as BOTH percent and computed dollars (percent x total_insurable_value) when expressed as a percentage.
- valuation.roof: note any Actual Cash Value condition on roofs (e.g. ACV if installed/replaced before a given year).
- Capture all warranties (e.g. no known sinkhole activity, no EIFS construction, no prior losses, buildings with outstanding damage excluded) — breach can void coverage.
- List ALL endorsements/forms by name and form number from the Schedule of Forms and Endorsements.
- Set key_findings booleans based on what you find.

Return ONLY the JSON.
`,
};

// Map the user-selected policy_type/category to an extraction schema.
export function classifyPolicy(policyType = "", policyCategory = "") {
  const t = `${policyType} ${policyCategory}`.toLowerCase();
  if (/(auto|vehicle|car|motorcycle|pap|personal auto)/.test(t)) return "auto";
  if (/(commercial|business|bop|cgl|general liability|property coverage part|warehouse|cpp)/.test(t)) return "commercial";
  return "residential"; // HO-3/5/6, DP-3, condo, renter, flood, and default
}
