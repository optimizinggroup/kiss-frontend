# KISS Attorney Personas

KISS supports two distinct attorney verticals at launch, plus a Phase 2 broker vertical. Each persona has different policy types, different report angles, different nurture content, and different conversion timing.

## Vertical 1 — Personal Injury / Auto

**Who they are.** Plaintiff-side personal injury attorneys. They represent injured people in motor vehicle accident cases, slip-and-falls, etc. They do NOT represent insurance companies. Their typical case is a client injured in an auto accident who needs help navigating their own insurance plus the at-fault driver's insurance.

**What they care about in a policy.** Auto insurance policies — specifically the gaps that come up at claim time:

- Bodily Injury liability limits (high enough?)
- Property Damage limits
- Uninsured Motorist (UM) and Underinsured Motorist (UIM) — the silent killer; clients often discover they have low or no UM at the worst moment
- Medical Payments (MedPay) coverage
- Personal Injury Protection (PIP) — Florida is a no-fault state so this is critical
- Rental car coverage
- Stacking provisions (Florida-specific; UM stacking matters)
- Exclusions (intentional acts, racing, business use, etc.)

**Marketing angle for the homeowner-equivalent (auto policy holder).** Most drivers have no idea what they're buying. They picked a price, signed up, and never looked again. A free policy review is genuinely valuable. The hook: "Did you know that 1 in 4 Florida drivers carries minimum-only PIP and no UM? If you're hit by one of them, your policy may be the only thing that protects you."

**Conversion event.** Auto accident. Could happen tomorrow, could happen in 5 years. Different from property — there's no seasonal trigger like hurricane season, but accidents are constant. Nurture cadence should keep the firm top-of-mind for the everyday "I just got into a fender bender, who do I call?" moment.

**Typical case value.** $5,000–$50,000 in attorney fees on a typical PI case (33% of recovery, recovery often $15K–$150K). Big bodily injury cases can be much higher.

**Florida specifics.**
- No-fault state with PIP requirement
- Stacking is a unique FL concept that creates massive coverage differences
- Sinkhole exclusions (less relevant for auto but worth knowing for cross-sell)
- Florida has high uninsured driver rates — UM/UIM is critical

## Vertical 2 — Property Insurance Attorney

**Who they are.** Plaintiff-side property insurance attorneys. They represent homeowners and business owners with denied or underpaid claims against their insurer. They do NOT represent carriers. Their case typically arrives after a storm event, water damage, fire, or vandalism — when the insurer denies, delays, or lowballs.

**What they care about in a policy.** Both residential and commercial property policies:

- Residential: HO-3, HO-5, HO-6 (condo), HO-8 (older homes), DP-3 (rental dwelling), HO-4 (renters)
- Commercial: BOP (Business Owner's Policy), CGL (Commercial General Liability), Special Form Property
- Wind/hurricane deductibles (separate, higher than standard)
- Flood (almost always EXCLUDED — needs separate NFIP or private flood)
- Sinkhole coverage (Florida-specific carve-out, often expensive add-on)
- Mold limits (typically capped low, e.g., $10K)
- Ordinance & Law coverage
- Loss of Use / Additional Living Expenses
- Replacement Cost vs Actual Cash Value (huge dollar difference at claim time)
- Endorsements that change coverage (CG-2147, etc.)

**Marketing angle for the homeowner.** Most policyholders don't read their declarations page. A free review surfaces the gaps BEFORE a storm hits. The hook: "If a hurricane hit tomorrow, would your policy actually rebuild your home?" Plus the rebuild-cost-vs-coverage gap analysis ($200-250/sq ft Florida rebuild rate vs. dwelling coverage shown on the policy).

**Conversion event.** Storm season, water damage, fire, vandalism, theft. In Florida, the conversion-trigger calendar is heavily weighted toward June–November (hurricane season). The nurture sequence should crescendo around storm-prep timing.

**Typical case value.** $5,000–$100,000+ in attorney fees on residential first-party claims; commercial cases can be much larger ($250K-$1M+ in fees on big BI/CGL cases). Florida's recent legislative changes around AOB and one-way attorney fees have shifted economics — verify current state with FL property insurance counsel.

**Florida specifics.**
- Hurricane deductibles (separate from regular deductible)
- Mandatory wind mitigation discounts (most homeowners don't know they qualify)
- Sinkhole as an excluded risk requiring buy-back
- Florida's recent insurance reform changes (SB 2A and related) — affects how attorneys can pursue first-party claims; **must be referenced by current FL counsel before going live with any positioning**

## Vertical 3 — Insurance Brokers (Phase 2, not for launch)

Brokers use the same KISS engine but with a flipped value proposition:

- They want to **identify gaps in the prospect's existing policy** so they can offer a better one
- Report frames coverage as "your current policy may not protect you fully — here's how a better policy from us would"
- Different email sequence: renewal reminders, market update emails, broker-specific positioning
- Different conversion trigger: renewal date approaches, or storm event

Build Phase 1 attorney verticals first. Add brokers once you have a few attorney clients live.

## Architectural implications for the Make scenario

Today's v2 Make blueprint has three routes (consumer / broker / attorney) where "attorney" assumes property/storm context. With two attorney verticals at launch, the architecture needs one of:

**Option A (recommended): One attorney route, prompt branches on policy_type.**
The attorney report prompt receives both `tenant.persona` and `submission.policy_type`. The prompt has conditional logic: if policy_type starts with "AUTO" or matches PIP/UM patterns → generate PI/auto report; if policy_type starts with HO/DP/BOP/CGL → generate property report. Pros: simpler scenario, fewer routes. Cons: longer prompt, harder to iterate per-vertical.

**Option B: Two attorney routes (broker, pi-attorney, property-attorney, consumer = 4 routes total).**
Adds a `tenant.persona` value: `pi_attorney` and `property_attorney` instead of generic `attorney`. Each has its own prompt module and email module. Pros: cleaner separation, easier to iterate one vertical at a time. Cons: more modules, slightly more cost.

**Recommendation: Option B.** Cleaner separation pays off in prompt iteration speed and email content separation. The sequencing folder structure already mirrors this (`pi-auto-attorney-sequence.md` and `property-attorney-sequence.md`).

The `tenants` table in the Supabase schema already supports this — just add `pi_attorney` and `property_attorney` to the persona CHECK constraint, replacing or augmenting the generic `attorney`. Update the v2 Make blueprint to add a fourth route after deploy.

## Consumer report variants

The "consumer report" (which always runs) also needs to branch by policy type. Today's v2 prompt is residential-property-focused (rebuild-cost gap analysis at $200-250/sq ft). For an auto policy, that math is meaningless.

**Recommendation:** Two consumer prompts, selected by `submission.policy_type`:

- **Residential property consumer prompt:** What you currently have (the v2 default). Hurricane/wind, rebuild cost gap, exclusions for FL homeowners.
- **Auto consumer prompt:** UM/UIM gap, PIP coverage, MedPay, rental, stacking, exclusions for FL drivers.

The Make scenario can branch the consumer report module by policy_type before sending. Or use one prompt with internal conditional logic. Same architectural choice as above — Option B is cleaner.

## File map for nurture sequences

```
KISS/marketing/
├── attorney-personas.md              ← this file
├── florida-bar-compliance.md         ← FL Bar advertising rules + checklist
└── nurture-sequences/
    ├── pi-auto-attorney-sequence.md  ← 5 emails for PI/auto firms
    └── property-attorney-sequence.md ← 5 emails for property firms
```
