import { useState, useEffect } from "react";

const API_BASE = "";

const APP = {
  name: "TaxFight",
  tagline: "Your Property Is Overassessed. Fight Back.",
  icon: "🏠",
  color: "#1a3a6e",
  colorLight: "#2a5298",
  colorAccent: "#4a7fd4",
  payhip: "https://payhip.com/b/PLACEHOLDER",
  support: "support@buyappsonce.com",
  price: "$39",
  sessionKey: "tf_form",
};

const FORM_STEPS = ["Intro", "Property", "Assessment", "Evidence", "Board", "Generate", "Letter"];

const stepFields = {
  Property: [
    { key: "address",       label: "Full Property Address",             type: "text",     required: true,  placeholder: "123 Main St, Springfield, IL 62701" },
    { key: "parcelId",      label: "Parcel ID / Tax Account Number",    type: "text",     required: true,  placeholder: "e.g. 14-22-103-004",  helper: "Found on your tax bill or county assessor's website." },
    { key: "county",        label: "County",                            type: "text",     required: true,  placeholder: "e.g. Cook County" },
    { key: "state",         label: "State",                             type: "text",     required: true,  placeholder: "e.g. Illinois" },
    { key: "propertyType",  label: "Property Type",                     type: "select",   required: true,  options: ["Single-Family Home","Condominium","Multi-Family (2-4 units)","Commercial","Vacant Land","Other"] },
    { key: "yearBuilt",     label: "Year Built",                        type: "text",     placeholder: "e.g. 1987" },
    { key: "squareFeet",    label: "Livable Square Footage",            type: "text",     placeholder: "e.g. 1,850 sq ft" },
    { key: "lotSize",       label: "Lot Size",                          type: "text",     placeholder: "e.g. 0.25 acres or 10,890 sq ft" },
  ],
  Assessment: [
    { key: "assessedValue",   label: "Current Assessed Value",              type: "text",     required: true,  placeholder: "e.g. $285,000",    helper: "Found on your assessment notice or property tax bill." },
    { key: "taxableValue",    label: "Taxable Value (if different)",         type: "text",     placeholder: "e.g. $228,000 — leave blank if same as assessed value" },
    { key: "taxAmount",       label: "Annual Property Tax Bill",             type: "text",     placeholder: "e.g. $7,200 per year" },
    { key: "assessmentYear",  label: "Assessment Year Being Appealed",       type: "text",     required: true,  placeholder: "e.g. 2026" },
    { key: "fairMarketValue", label: "What You Believe the Fair Market Value Is", type: "text", required: true, placeholder: "e.g. $230,000",  helper: "Your best estimate based on what similar homes have sold for recently." },
    { key: "reasonForAppeal", label: "Primary Reason for Appeal",            type: "select",   required: true,  options: [
        "Assessed value exceeds fair market value",
        "Assessment higher than comparable properties",
        "Property condition not reflected (damage, deterioration)",
        "Factual error in assessment records (wrong size, features)",
        "Recent purchase at a lower price",
        "Double assessment / clerical error",
        "Other",
    ]},
    { key: "recentPurchase",  label: "Did You Purchase the Property Recently?", type: "select", required: true, options: ["No","Yes — within the last 1 year","Yes — within the last 2 years","Yes — within the last 3 years"] },
    { key: "purchasePrice",   label: "Purchase Price (if recently purchased)", type: "text", placeholder: "e.g. $225,000 — leave blank if not applicable" },
  ],
  Evidence: [
    { key: "comparables",     label: "Comparable Properties / Recent Sales",  type: "textarea", required: true,  rows: 5, placeholder: "List 2-4 similar homes that sold recently at lower prices:\n\n456 Oak Ave — 1,900 sqft, sold $218,000 (March 2025)\n789 Elm St — 1,750 sqft, sold $212,000 (January 2025)\n\nOr describe: 'Three comparable homes on my street sold for $210,000-$225,000 in the past 12 months.'", helper: "Check Zillow, Redfin, or your county assessor's website for recent sales." },
    { key: "propertyIssues",  label: "Property Condition Issues (if any)",    type: "textarea", placeholder: "Describe any damage, deferred maintenance, or issues that reduce value:\n\ne.g. Foundation crack requiring $15,000 repair, outdated electrical, roof needs replacement..." },
    { key: "assessmentErrors",label: "Factual Errors in Assessment Records",  type: "textarea", placeholder: "List any incorrect information in the assessor's records:\n\ne.g. Assessor records show 2,200 sqft but actual livable area is 1,850 sqft. Records show 3 bathrooms but property has 2." },
    { key: "appraisal",       label: "Do You Have a Recent Appraisal?",       type: "select",   options: ["No","Yes — completed within the last 6 months","Yes — completed within the last 12 months","Yes — older than 12 months"] },
    { key: "appraisalValue",  label: "Appraisal Value (if applicable)",        type: "text",     placeholder: "e.g. $228,000" },
    { key: "additionalEvidence", label: "Any Other Supporting Evidence",       type: "textarea", placeholder: "e.g. Neighbor at 100 Main St has identical floor plan and is assessed at $240,000 while mine is $285,000..." },
  ],
  Board: [
    { key: "boardName",       label: "Name of the Appeals Board / Authority",  type: "text",     placeholder: "e.g. Cook County Board of Review, Springfield Board of Equalization", helper: "Check your assessment notice or county website for where to file." },
    { key: "deadlineDate",    label: "Appeal Deadline Date",                   type: "text",     placeholder: "e.g. March 31, 2026",  helper: "Deadlines are strict. Check your assessment notice or county assessor's office." },
    { key: "assessorName",    label: "County Assessor Name (if known)",        type: "text",     placeholder: "e.g. Fritz Kaegi" },
    { key: "boardCriteria",   label: "Appeal Criteria / Grounds (if provided)", type: "textarea", rows: 5, placeholder: "Paste the evaluation criteria from your appeal form or county website if available.\n\nIf you don't have them, leave blank — the AI will use standard property tax appeal standards.", helper: "Optional but strengthens your letter. Check your county assessor's website or assessment notice." },
    { key: "additionalNotes", label: "Anything Else the Letter Should Address", type: "textarea", placeholder: "Any other context, prior appeals, communications with the assessor, etc." },
  ],
};

const requiredFields = {
  Property:   ["address","parcelId","county","state","propertyType"],
  Assessment: ["assessedValue","assessmentYear","fairMarketValue","reasonForAppeal","recentPurchase"],
  Evidence:   ["comparables"],
  Board:      [],
};

const SAMPLE_LETTER = `March 15, 2026

Via Certified Mail — Return Receipt Requested

Cook County Board of Review
69 W. Washington St., 22nd Floor
Chicago, IL 60602

Re: Formal Appeal of Property Tax Assessment — Parcel No. 14-22-103-004
    Property Address: 123 Main Street, Springfield, IL 62701
    Tax Year: 2026 — Assessed Value: $285,000

Dear Members of the Board of Review:

The undersigned property owner respectfully submits this formal appeal of the 2026 property tax assessment for the above-referenced parcel. The current assessed value of $285,000 materially exceeds the property's fair market value of approximately $230,000 and is inconsistent with recent arm's-length sales of comparable properties in the immediate vicinity.

I. GROUNDS FOR APPEAL

The subject property is a single-family residence of approximately 1,850 square feet constructed in 1987, situated on a 0.25-acre lot. The 2026 assessed value of $285,000 is not supported by current market data...

[Full 500-700 word letter generated based on your specific assessment details, comparable sales, and county-specific appeal standards.]`;

const TIPS = [
  { icon: "📊", title: "Comparables are your strongest evidence", body: "Recent sales of similar homes in your area carry more weight than anything else. Boards compare assessed values to market data." },
  { icon: "📋", title: "Focus on facts, not frustration", body: "Never mention your tax bill amount or that you can't afford the taxes. The appeal must be based on market value, not ability to pay." },
  { icon: "📏", title: "Check for factual errors first", body: "Assessors sometimes record wrong square footage, bedroom count, or lot size. A simple correction can reduce your assessment significantly." },
  { icon: "⏰", title: "Deadlines are absolute", body: "Miss your appeal deadline by one day and you wait another year. Check your notice immediately." },
];

// ─── Colors & Styles ─────────────────────────────────────────────────────────
const C = {
  bg:           "#f4f7fb",
  bgWarm:       "#eef2f8",
  white:        "#ffffff",
  ink:          "#0d1b2a",
  inkLight:     "#2a4060",
  inkMuted:     "#5a7090",
  inkFaint:     "#8aa0b8",
  primary:      "#1a3a6e",
  primaryLight: "#2a5298",
  accent:       "#4a7fd4",
  border:       "#c8d8e8",
  borderLight:  "#dce8f0",
  green:        "#15603a",
  red:          "#8b1a1a",
  errorBg:      "#fff0f0",
  errorBorder:  "#ffcccc",
  errorText:    "#cc2222",
};

const inputStyle = (focused) => ({
  width: "100%", padding: "12px 15px",
  background: C.white,
  border: `1px solid ${focused ? C.accent : C.border}`,
  borderRadius: "7px", color: C.ink, fontSize: "15px",
  fontFamily: "system-ui, -apple-system, sans-serif",
  outline: "none", boxSizing: "border-box", transition: "border-color 0.2s",
});

const btnStyle = (active) => ({
  background: active ? `linear-gradient(135deg, ${C.primaryLight}, ${C.primary})` : C.bgWarm,
  border: "none", color: active ? "#ffffff" : C.inkFaint,
  padding: "12px 26px", borderRadius: "6px",
  cursor: active ? "pointer" : "default", fontSize: "15px", fontWeight: active ? "700" : "400",
  fontFamily: "system-ui, sans-serif", transition: "all 0.2s",
  display: "inline-flex", alignItems: "center", gap: "8px",
  boxShadow: active ? "0 2px 12px rgba(26,58,110,0.3)" : "none",
});

// ─── Sub-components ───────────────────────────────────────────────────────────
function Tooltip({ text }) {
  const [open, setOpen] = useState(false);
  return (
    <span style={{ position: "relative", display: "inline-block", marginLeft: "6px" }}>
      <span onClick={() => setOpen(o => !o)} style={{ cursor: "pointer", color: C.accent, fontSize: "11px", border: `1px solid ${C.accent}`, borderRadius: "50%", width: "15px", height: "15px", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>?</span>
      {open && <div style={{ position: "absolute", left: "20px", top: "-4px", width: "240px", zIndex: 20, background: C.white, border: `1px solid ${C.border}`, borderRadius: "8px", padding: "12px", fontSize: "13px", color: C.inkLight, lineHeight: "1.6", boxShadow: "0 4px 20px rgba(0,0,0,0.12)" }}>
        {text}
        <div onClick={() => setOpen(false)} style={{ marginTop: "8px", color: C.accent, cursor: "pointer", fontSize: "11px" }}>Close ×</div>
      </div>}
    </span>
  );
}

function FormField({ field, value, onChange }) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ marginBottom: "4px" }}>
      <label style={{ display: "block", marginBottom: "6px", fontSize: "13px", color: C.inkMuted, letterSpacing: "0.02em" }}>
        {field.label}{field.required && <span style={{ color: C.accent, marginLeft: "4px" }}>*</span>}
        {field.helper && <Tooltip text={field.helper} />}
      </label>
      {field.type === "select" ? (
        <select value={value || ""} onChange={e => onChange(e.target.value)} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} style={{ ...inputStyle(focused), cursor: "pointer" }}>
          <option value="">Select…</option>
          {field.options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : field.type === "textarea" ? (
        <textarea value={value || ""} onChange={e => onChange(e.target.value)} placeholder={field.placeholder} rows={field.rows || 4} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} style={{ ...inputStyle(focused), resize: "vertical", lineHeight: "1.7", minHeight: `${(field.rows || 4) * 28}px` }} />
      ) : (
        <input type="text" value={value || ""} onChange={e => onChange(e.target.value)} placeholder={field.placeholder} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} style={inputStyle(focused)} />
      )}
    </div>
  );
}

function Spinner() {
  return <span style={{ width: "16px", height: "16px", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block", animation: "spin 0.8s linear infinite" }} />;
}

// ─── System Prompt ────────────────────────────────────────────────────────────
function buildSystemPrompt() {
  return `You are an expert property tax appeal attorney with 25 years of experience successfully reducing property tax assessments across all 50 states. You write formal, evidence-based appeal letters to county boards of review, boards of equalization, and assessment appeal authorities.

Your letters are professional, factual, and persuasive. They cite specific comparable sales, identify assessment inequities, highlight factual errors, and make a clear, data-supported argument for a lower assessed value. You never mention the property owner's financial situation, ability to pay, or complaints about tax rates — only market value evidence and assessment accuracy.

Write in formal legal correspondence style. Structure the letter with clear section headers. Be specific with numbers. Address the board's evaluation criteria directly when provided.`;
}

function buildUserPrompt(formData, mode) {
  const tone = mode === "assertive"
    ? "Write this in an assertive, forceful tone that makes clear the assessment is clearly incorrect and the board should immediately correct it. Cite any applicable state statutes on equal and uniform assessment."
    : "Write this in a measured, professional tone that presents the evidence clearly and respectfully requests a reassessment based on the data.";

  return `Write a ${mode === "assertive" ? "firm and assertive" : "professional and measured"} property tax appeal letter for the following situation:

PROPERTY INFORMATION:
- Address: ${formData.address || ""}
- Parcel ID: ${formData.parcelId || ""}
- County: ${formData.county || ""}
- State: ${formData.state || ""}
- Property Type: ${formData.propertyType || ""}
- Year Built: ${formData.yearBuilt || "not provided"}
- Square Footage: ${formData.squareFeet || "not provided"}
- Lot Size: ${formData.lotSize || "not provided"}

ASSESSMENT DETAILS:
- Current Assessed Value: ${formData.assessedValue || ""}
- Taxable Value: ${formData.taxableValue || "same as assessed"}
- Annual Tax Bill: ${formData.taxAmount || "not provided"}
- Assessment Year: ${formData.assessmentYear || ""}
- Claimed Fair Market Value: ${formData.fairMarketValue || ""}
- Primary Reason for Appeal: ${formData.reasonForAppeal || ""}
- Recent Purchase: ${formData.recentPurchase || "No"}
- Purchase Price: ${formData.purchasePrice || "N/A"}

EVIDENCE:
- Comparable Properties / Recent Sales: ${formData.comparables || ""}
- Property Condition Issues: ${formData.propertyIssues || "None noted"}
- Factual Errors in Records: ${formData.assessmentErrors || "None noted"}
- Recent Appraisal: ${formData.appraisal || "No"}
- Appraisal Value: ${formData.appraisalValue || "N/A"}
- Additional Evidence: ${formData.additionalEvidence || "None"}

APPEAL BOARD:
- Board Name: ${formData.boardName || "the Board of Review"}
- Appeal Deadline: ${formData.deadlineDate || ""}
- Assessor Name: ${formData.assessorName || ""}
- Board Criteria: ${formData.boardCriteria || "Use standard property tax appeal criteria for the state"}
- Additional Notes: ${formData.additionalNotes || "None"}

${tone}

Write a complete, formal appeal letter of 500-700 words. Include:
1. Formal header with date, recipient, and Re: line citing the parcel number and assessed value
2. Opening paragraph stating this is a formal appeal and the grounds
3. Evidence section with specific comparable sales and value analysis
4. Any factual errors or condition issues section if applicable
5. Conclusion with specific requested assessed value and next steps
6. Professional closing

Return ONLY the letter text, no commentary.`;
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function TaxFight() {
  const [step, setStep]           = useState(0);
  const [formData, setFormData]   = useState(() => {
    try { return JSON.parse(sessionStorage.getItem(APP.sessionKey) || "{}"); }
    catch { return {}; }
  });
  const [accessCode, setAccessCode] = useState("");
  const [codeValid, setCodeValid]   = useState(false);
  const [codeError, setCodeError]   = useState("");
  const [loading, setLoading]       = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");
  const [letter, setLetter]         = useState("");
  const [altLetter, setAltLetter]   = useState("");
  const [activeTab, setActiveTab]   = useState("standard");
  const [checklist, setChecklist]   = useState([]);
  const [copied, setCopied]         = useState(false);
  const [error, setError]           = useState("");
  const [showSample, setShowSample] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (code) setAccessCode(code.toUpperCase());
  }, []);

  useEffect(() => {
    try { sessionStorage.setItem(APP.sessionKey, JSON.stringify(formData)); }
    catch {}
  }, [formData]);

  const setField = (key, val) => setFormData(p => ({ ...p, [key]: val }));

  const currentStepName = FORM_STEPS[step];
  const fields = stepFields[currentStepName] || [];
  const required = requiredFields[currentStepName] || [];
  const allFilled = required.every(k => formData[k]?.trim?.());

  async function validateCode() {
    if (!accessCode.trim()) { setCodeError("Please enter your access code."); return; }
    setLoading(true); setCodeError("");
    try {
      const res = await fetch(`${API_BASE}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessCode: accessCode.trim(), systemPrompt: "Reply: VALID", userPrompt: "VALIDATE" }),
      });
      const data = await res.json();
      if (!res.ok) { setCodeError(data.error || "Invalid access code."); }
      else { setCodeValid(true); setStep(1); }
    } catch { setCodeError("Connection error. Please try again."); }
    setLoading(false);
  }

  async function generateLetter() {
    setLoading(true); setError(""); setLetter(""); setAltLetter(""); setChecklist([]);
    try {
      setLoadingMsg("Analyzing your assessment details…");
      const sysPrompt = buildSystemPrompt();
      const userPrompt = buildUserPrompt(formData, "standard");

      const res = await fetch(`${API_BASE}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessCode: accessCode.trim(), systemPrompt: sysPrompt, userPrompt }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");
      setLetter(data.text || "");

      setLoadingMsg("Generating assertive version…");
      const altPrompt = buildUserPrompt(formData, "assertive");
      const res2 = await fetch(`${API_BASE}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessCode: accessCode.trim(), systemPrompt: sysPrompt, userPrompt: altPrompt }),
      });
      const data2 = await res2.json();
      if (res2.ok) setAltLetter(data2.text || "");

      setLoadingMsg("Building submission checklist…");
      const res3 = await fetch(`${API_BASE}/api/checklist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formData, appType: "property-tax-appeal" }),
      });
      const data3 = await res3.json();
      if (res3.ok) setChecklist(data3.checklist || []);

      setStep(FORM_STEPS.indexOf("Letter"));
    } catch (e) { setError(e.message || "Generation failed. Please try again."); }
    setLoading(false); setLoadingMsg("");
  }

  function downloadPDF() {
    const text = activeTab === "standard" ? letter : altLetter;
    if (!text || typeof window.jsPDF === "undefined") return;
    const doc = new window.jsPDF({ unit: "in", format: "letter" });
    const margin = 1, width = 6.5, lineHeight = 0.22, fontSize = 11;
    doc.setFont("Times", "normal");
    doc.setFontSize(fontSize);
    let y = margin;
    text.split("\n").forEach(line => {
      const wrapped = doc.splitTextToSize(line || " ", width);
      wrapped.forEach(wl => {
        if (y > 10) { doc.addPage(); y = margin; }
        doc.text(wl, margin, y);
        y += lineHeight;
      });
    });
    doc.save(`TaxFight-Appeal-${activeTab}.pdf`);
  }

  function copyText() {
    const text = activeTab === "standard" ? letter : altLetter;
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  }

  // ─── Render ──────────────────────────────────────────────────────────────────
  const baseStyle = { minHeight: "100vh", background: C.bg, fontFamily: "system-ui, -apple-system, sans-serif", color: C.ink };
  const cardStyle = { background: C.white, border: `1px solid ${C.border}`, borderRadius: "12px", padding: "32px", boxShadow: "0 2px 16px rgba(26,58,110,0.06)" };

  // INTRO STEP
  if (step === 0) return (
    <div style={baseStyle}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} *{box-sizing:border-box}`}</style>
      <div style={{ maxWidth: "680px", margin: "0 auto", padding: "40px 20px" }}>
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <div style={{ fontSize: "48px", marginBottom: "12px" }}>{APP.icon}</div>
          <h1 style={{ fontSize: "28px", fontWeight: "800", color: C.primary, margin: "0 0 8px" }}>{APP.name}</h1>
          <p style={{ fontSize: "17px", color: C.inkMuted, margin: 0 }}>{APP.tagline}</p>
        </div>

        <div style={cardStyle}>
          <h2 style={{ fontSize: "17px", fontWeight: "700", color: C.ink, marginBottom: "16px" }}>Enter Your Access Code</h2>
          <p style={{ fontSize: "14px", color: C.inkMuted, marginBottom: "20px", lineHeight: "1.6" }}>
            Your access code was emailed after purchase. Enter it below to generate your property tax appeal letter.
          </p>
          <input
            type="text" value={accessCode} onChange={e => setAccessCode(e.target.value.toUpperCase())}
            placeholder="e.g. ABCD-1234-EFGH-5678"
            onKeyDown={e => e.key === "Enter" && validateCode()}
            style={{ ...inputStyle(false), marginBottom: "12px", letterSpacing: "0.05em", fontSize: "16px" }}
          />
          {codeError && <div style={{ color: C.errorText, fontSize: "13px", marginBottom: "12px" }}>{codeError}</div>}
          <button onClick={validateCode} disabled={loading} style={{ ...btnStyle(true), width: "100%", justifyContent: "center", padding: "14px" }}>
            {loading ? <><Spinner /> Validating…</> : "Validate & Start →"}
          </button>
          <p style={{ textAlign: "center", marginTop: "16px", fontSize: "13px", color: C.inkFaint }}>
            Don't have an access code? <a href={APP.payhip} style={{ color: C.accent }}>Get one for {APP.price} →</a>
          </p>
        </div>

        {/* Tips */}
        <div style={{ marginTop: "28px" }}>
          <h3 style={{ fontSize: "14px", fontWeight: "700", color: C.inkMuted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "14px" }}>Before You Start</h3>
          <div style={{ display: "grid", gap: "10px" }}>
            {TIPS.map(t => (
              <div key={t.icon} style={{ ...cardStyle, padding: "16px", display: "flex", gap: "14px", alignItems: "flex-start" }}>
                <span style={{ fontSize: "22px", flexShrink: 0 }}>{t.icon}</span>
                <div>
                  <div style={{ fontWeight: "700", fontSize: "14px", marginBottom: "4px" }}>{t.title}</div>
                  <div style={{ fontSize: "13px", color: C.inkMuted, lineHeight: "1.6" }}>{t.body}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sample */}
        <div style={{ marginTop: "20px", textAlign: "center" }}>
          <button onClick={() => setShowSample(s => !s)} style={{ background: "none", border: "none", color: C.accent, cursor: "pointer", fontSize: "14px" }}>
            {showSample ? "Hide sample letter ▲" : "See a sample letter ▼"}
          </button>
          {showSample && (
            <div style={{ ...cardStyle, marginTop: "14px", textAlign: "left", fontFamily: "Georgia, serif", fontSize: "13px", lineHeight: "1.9", whiteSpace: "pre-wrap", color: C.inkLight, maxHeight: "320px", overflowY: "auto" }}>
              {SAMPLE_LETTER}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // LETTER STEP
  if (currentStepName === "Letter") {
    const displayLetter = activeTab === "standard" ? letter : altLetter;
    return (
      <div style={baseStyle}>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}} *{box-sizing:border-box}`}</style>
        <div style={{ maxWidth: "800px", margin: "0 auto", padding: "32px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px" }}>
            <span style={{ fontSize: "28px" }}>{APP.icon}</span>
            <div>
              <h1 style={{ fontSize: "20px", fontWeight: "800", color: C.primary, margin: 0 }}>Your Appeal Letter is Ready</h1>
              <p style={{ fontSize: "13px", color: C.inkMuted, margin: 0 }}>Review, print, and submit by your deadline.</p>
            </div>
          </div>

          {/* Tab selector */}
          <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
            {["standard","assertive"].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} style={{ padding: "9px 20px", borderRadius: "6px", border: `1px solid ${activeTab === tab ? C.primary : C.border}`, background: activeTab === tab ? C.primary : C.white, color: activeTab === tab ? "#fff" : C.inkMuted, fontWeight: "600", fontSize: "14px", cursor: "pointer", transition: "all 0.15s" }}>
                {tab === "standard" ? "📄 Standard" : "⚡ Assertive"}
              </button>
            ))}
          </div>
          <p style={{ fontSize: "12px", color: C.inkFaint, marginBottom: "16px" }}>
            {activeTab === "standard" ? "Professional and measured — appropriate for most appeals." : "More forceful — appropriate when the assessment error is clear-cut or the board has been unresponsive."}
          </p>

          {/* Letter display */}
          <div style={{ ...cardStyle, fontFamily: "Georgia, serif", fontSize: "14px", lineHeight: "1.9", whiteSpace: "pre-wrap", color: C.inkLight, maxHeight: "480px", overflowY: "auto", marginBottom: "16px" }}>
            {displayLetter}
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "24px" }}>
            <button onClick={downloadPDF} style={{ ...btnStyle(true) }}>⬇ Download PDF</button>
            <button onClick={copyText} style={{ ...btnStyle(true), background: copied ? `linear-gradient(135deg, ${C.green}, #0d4a28)` : undefined }}>
              {copied ? "✓ Copied!" : "📋 Copy Text"}
            </button>
            <button onClick={() => { setStep(1); setLetter(""); setAltLetter(""); }} style={{ ...btnStyle(false), border: `1px solid ${C.border}` }}>← Edit Responses</button>
          </div>

          {/* Checklist */}
          {checklist.length > 0 && (
            <div style={{ ...cardStyle, marginBottom: "24px" }}>
              <h3 style={{ fontSize: "15px", fontWeight: "700", color: C.ink, marginBottom: "14px" }}>📋 Submission Checklist</h3>
              {checklist.map((item, i) => (
                <div key={i} style={{ display: "flex", gap: "10px", alignItems: "flex-start", marginBottom: "10px", fontSize: "14px", color: C.inkLight }}>
                  <span style={{ color: C.accent, flexShrink: 0, marginTop: "1px" }}>☐</span>
                  <span>{item}</span>
                </div>
              ))}
            </div>
          )}

          <div style={{ fontSize: "12px", color: C.inkFaint, lineHeight: "1.6" }}>
            Legal Disclaimer: This letter was generated by AI and does not constitute legal advice. Verify all deadlines, procedures, and requirements with your county assessor's office before submitting. Consider consulting a property tax professional for complex appeals.
          </div>
        </div>
      </div>
    );
  }

  // GENERATE STEP
  if (currentStepName === "Generate") return (
    <div style={baseStyle}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} *{box-sizing:border-box}`}</style>
      <div style={{ maxWidth: "600px", margin: "0 auto", padding: "60px 20px", textAlign: "center" }}>
        <div style={{ fontSize: "48px", marginBottom: "20px" }}>{APP.icon}</div>
        <h2 style={{ fontSize: "22px", fontWeight: "800", color: C.primary, marginBottom: "12px" }}>Ready to Generate Your Letter</h2>
        <p style={{ fontSize: "15px", color: C.inkMuted, lineHeight: "1.6", marginBottom: "28px" }}>
          We'll create two versions — Standard and Assertive — tailored to your specific assessment, comparable sales, and county board.
        </p>

        {/* Summary */}
        <div style={{ ...cardStyle, textAlign: "left", marginBottom: "24px" }}>
          {[["Property", formData.address], ["Assessed Value", formData.assessedValue], ["Your Claimed Value", formData.fairMarketValue], ["Assessment Year", formData.assessmentYear], ["County", formData.county + ", " + formData.state]].map(([k, v]) => v && (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: "14px", padding: "8px 0", borderBottom: `1px solid ${C.borderLight}` }}>
              <span style={{ color: C.inkMuted }}>{k}</span>
              <span style={{ fontWeight: "600", color: C.ink, maxWidth: "60%", textAlign: "right" }}>{v}</span>
            </div>
          ))}
        </div>

        {error && <div style={{ background: C.errorBg, border: `1px solid ${C.errorBorder}`, color: C.errorText, borderRadius: "8px", padding: "14px", fontSize: "14px", marginBottom: "20px" }}>{error}</div>}

        {loading ? (
          <div style={{ padding: "32px" }}>
            <Spinner />
            <p style={{ marginTop: "16px", color: C.inkMuted, fontSize: "15px" }}>{loadingMsg || "Generating your letter…"}</p>
          </div>
        ) : (
          <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
            <button onClick={() => setStep(step - 1)} style={{ ...btnStyle(false), border: `1px solid ${C.border}` }}>← Back</button>
            <button onClick={generateLetter} style={{ ...btnStyle(true), padding: "14px 32px" }}>Generate My Letter →</button>
          </div>
        )}
      </div>
    </div>
  );

  // FORM STEPS
  const isLast = step === FORM_STEPS.indexOf("Generate") - 1;
  const progress = ((step) / (FORM_STEPS.length - 2)) * 100;

  return (
    <div style={baseStyle}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} *{box-sizing:border-box}`}</style>

      {/* Progress bar */}
      <div style={{ background: C.white, borderBottom: `1px solid ${C.border}`, padding: "12px 20px" }}>
        <div style={{ maxWidth: "680px", margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "18px" }}>{APP.icon}</span>
              <span style={{ fontWeight: "700", color: C.primary, fontSize: "15px" }}>{APP.name}</span>
            </div>
            <span style={{ fontSize: "12px", color: C.inkFaint }}>Step {step} of {FORM_STEPS.length - 2}</span>
          </div>
          <div style={{ height: "4px", background: C.borderLight, borderRadius: "99px", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${progress}%`, background: `linear-gradient(90deg, ${C.accent}, ${C.primary})`, borderRadius: "99px", transition: "width 0.3s" }} />
          </div>
        </div>
      </div>

      <div style={{ maxWidth: "680px", margin: "0 auto", padding: "32px 20px" }}>
        <h2 style={{ fontSize: "20px", fontWeight: "800", color: C.primary, marginBottom: "6px" }}>
          {currentStepName === "Property" && "🏠 Property Details"}
          {currentStepName === "Assessment" && "📊 Assessment Details"}
          {currentStepName === "Evidence" && "📋 Your Evidence"}
          {currentStepName === "Board" && "🏛️ Appeals Board Information"}
        </h2>
        <p style={{ fontSize: "14px", color: C.inkMuted, marginBottom: "24px" }}>
          {currentStepName === "Property" && "Tell us about the property being appealed."}
          {currentStepName === "Assessment" && "Enter your current assessment details and what you believe the fair value should be."}
          {currentStepName === "Evidence" && "Provide comparable sales and any evidence supporting a lower value. This is the most important section."}
          {currentStepName === "Board" && "Tell us where your appeal will be submitted. Leave blank if you don't have all details."}
        </p>

        <div style={cardStyle}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "18px" }}>
            {fields.map(field => (
              <FormField key={field.key} field={field} value={formData[field.key]} onChange={val => setField(field.key, val)} />
            ))}
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", marginTop: "24px" }}>
          <button onClick={() => setStep(s => s - 1)} style={{ ...btnStyle(false), border: `1px solid ${C.border}` }}>← Back</button>
          <button onClick={() => setStep(s => s + 1)} disabled={!allFilled} style={btnStyle(allFilled)}>
            {isLast ? "Review & Generate →" : "Next →"}
          </button>
        </div>

        {!allFilled && <p style={{ textAlign: "right", fontSize: "12px", color: C.inkFaint, marginTop: "8px" }}>Complete required fields (*) to continue.</p>}
      </div>
    </div>
  );
}
