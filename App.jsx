import { useState, useEffect } from "react";

const API_BASE = "";

const STEPS = ["Intro", "Property", "Assessment", "Evidence", "Generate", "Letter"];

const SAMPLE_LETTER = `[DATE]

Via Certified Mail — Return Receipt Requested

Board of Assessment Appeals
Town of Fairfield, Connecticut
725 Old Post Road
Fairfield, CT 06824

Re: Formal Appeal of Property Tax Assessment — 48 Maple Hill Drive, Fairfield, CT 06824
    Account / Parcel No.: 12-0847-0032
    Assessment Year: 2026

Dear Members of the Board of Assessment Appeals:

The undersigned property owner respectfully appeals the assessed value of $487,500 assigned to the above-captioned property for the 2026 assessment year. Based on a comparative market analysis of five recent arm's-length sales of comparable properties within the same neighborhood and school district, the subject property's fair market value does not exceed $410,000, resulting in an overassessment of approximately $77,500 and excess annual tax liability of $1,938.

I. BASIS FOR APPEAL

The subject property is a 1,840 square foot, three-bedroom, two-bathroom colonial constructed in 1978. A review of the assessor's field card reveals that the property is recorded with a finished basement, which in fact flooded in 2021 and has remained unfinished due to ongoing drainage issues. This factual error contributes materially to the overvaluation.

II. COMPARABLE SALES ANALYSIS

The following arm's-length sales of similar properties, all occurring within 12 months of the assessment date, support a market value not exceeding $410,000...`;

const TIPS = [
  { icon: "📊", title: "Comparable sales are your strongest evidence", body: "Find 3–5 recent sales of similar homes nearby that sold for less than what your assessment implies." },
  { icon: "🏚️", title: "Document condition issues", body: "Photos of needed repairs, flood damage, or structural issues can significantly reduce your assessed value." },
  { icon: "📋", title: "Check the assessor's field card", body: "Errors in recorded square footage, bedroom count, or features are common — and easy to win." },
  { icon: "⏰", title: "Deadlines are firm", body: "Most states allow no late filings. Check your state's deadline immediately after receiving your assessment notice." },
];

const stepFields = {
  Property: [
    { key: "address",      label: "Full Property Address",          type: "text",     placeholder: "48 Maple Hill Drive, Fairfield, CT 06824", required: true },
    { key: "parcelId",     label: "Parcel / Account Number",        type: "text",     placeholder: "e.g. 12-0847-0032", helper: "Found on your tax bill or assessment notice." },
    { key: "state",        label: "State",                          type: "text",     placeholder: "e.g. Connecticut",  required: true },
    { key: "county",       label: "County / Municipality",          type: "text",     placeholder: "e.g. Fairfield County" },
    { key: "propType",     label: "Property Type",                  type: "select",   required: true, options: ["Single-Family Home", "Condo / Townhouse", "Multi-Family (2-4 units)", "Vacant Land", "Commercial", "Other"] },
    { key: "yearBuilt",    label: "Year Built",                     type: "text",     placeholder: "e.g. 1978" },
    { key: "sqft",         label: "Square Footage (Living Area)",   type: "text",     placeholder: "e.g. 1,840 sq ft" },
    { key: "beds",         label: "Bedrooms",                       type: "text",     placeholder: "e.g. 3" },
    { key: "baths",        label: "Bathrooms",                      type: "text",     placeholder: "e.g. 2" },
    { key: "lotSize",      label: "Lot Size",                       type: "text",     placeholder: "e.g. 0.25 acres or 10,890 sq ft" },
  ],
  Assessment: [
    { key: "assessedValue",   label: "Current Assessed Value",         type: "text",     required: true,  placeholder: "e.g. $487,500", helper: "From your assessment notice or tax bill." },
    { key: "assessmentYear",  label: "Assessment Year",                type: "text",     required: true,  placeholder: "e.g. 2026" },
    { key: "currentTaxBill",  label: "Current Annual Tax Bill",        type: "text",     placeholder: "e.g. $12,187" },
    { key: "taxRate",         label: "Tax / Mill Rate",                type: "text",     placeholder: "e.g. 25.0 mills or 2.5%",  helper: "Found on your tax bill or your town's website." },
    { key: "requestedValue",  label: "What Value Are You Requesting?", type: "text",     required: true,  placeholder: "e.g. $410,000", helper: "Should be supported by your comparable sales evidence." },
    { key: "appealReasons",   label: "Reasons for Appeal (select all that apply)", type: "select", required: true, options: ["Overvalued compared to recent sales", "Errors in assessor's property record", "Property condition issues not reflected", "Unequal assessment vs. similar properties", "Recent purchase price lower than assessment", "Multiple reasons"] },
    { key: "assessorErrors",  label: "Errors in Assessor's Records (if any)", type: "textarea", placeholder: "e.g. Field card shows 4 bedrooms — property has 3. Basement is recorded as finished but flooded in 2021 and is now unfinished." },
    { key: "recentPurchase",  label: "Did You Purchase the Property Recently?", type: "select", required: true, options: ["No", "Yes — within the last 12 months", "Yes — within the last 2 years", "Yes — within the last 3 years"] },
    { key: "purchasePrice",   label: "Purchase Price (if recently purchased)", type: "text",     placeholder: "e.g. $398,000" },
  ],
  Evidence: [
    { key: "comps",           label: "Comparable Sales (Comps)",       type: "textarea", required: true,  rows: 6, placeholder: "List 3–5 recent sales of similar nearby properties:\n\n1. 52 Maple Hill Dr — sold $395,000 — Nov 2025 — 3BR/2BA 1,790 sqft\n2. 19 Birchwood Rd — sold $405,000 — Aug 2025 — 3BR/2BA 1,820 sqft\n3. 74 Oak Street — sold $388,000 — Jan 2026 — 3BR/1.5BA 1,750 sqft", helper: "Check Zillow, Redfin, or your county's public records for recent sales." },
    { key: "conditionIssues", label: "Property Condition Issues",       type: "textarea", placeholder: "Describe any condition problems not reflected in the assessment:\n\ne.g. Foundation crack requiring $18,000 repair (estimate attached). Roof is 24 years old, past useful life. Basement flooded 2021, unfinished." },
    { key: "inequity",        label: "Assessment Inequity vs. Neighbors", type: "textarea", placeholder: "If similar nearby properties are assessed lower:\n\ne.g. 52 Maple Hill Dr (identical floorplan, built same year) is assessed at $441,000 — $46,500 less than my property despite being in better condition." },
    { key: "additionalEvidence", label: "Additional Supporting Evidence", type: "textarea", placeholder: "e.g. Recent appraisal at $412,000 (March 2026). Photos of condition issues available. Contractor estimate for foundation repair: $18,000." },
    { key: "priorAppeals",    label: "Prior Appeals Filed",             type: "select",   options: ["No — first appeal", "Yes — appealed before and was reduced", "Yes — appealed before and was denied"] },
  ],
};

const requiredFields = {
  Property:   ["address", "state", "propType"],
  Assessment: ["assessedValue", "assessmentYear", "requestedValue", "appealReasons", "recentPurchase"],
  Evidence:   ["comps"],
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const colors = {
  paper:       "#f8f6f2",
  paperWarm:   "#f2ede4",
  paperDark:   "#e8e2d8",
  white:       "#ffffff",
  ink:         "#1a140a",
  inkLight:    "#3a3020",
  inkMuted:    "#6a5e4a",
  inkFaint:    "#9a8e7a",
  gold:        "#8b6010",
  goldLight:   "#b88020",
  border:      "#d0c8b8",
  borderLight: "#e8e2d8",
  blue:        "#1a3a6c",
  blueLight:   "#2a5298",
  red:         "#8b1a1a",
  errorBg:     "#fff0f0",
  errorBorder: "#ffcccc",
  errorText:   "#cc2222",
  green:       "#1a5c2a",
};

const inputStyle = (focused) => ({
  width: "100%",
  padding: "12px 15px",
  background: colors.white,
  border: `1px solid ${focused ? colors.blueLight : colors.border}`,
  borderRadius: "8px",
  color: colors.ink,
  fontSize: "15px",
  fontFamily: "'Source Serif 4', Georgia, serif",
  outline: "none",
  boxSizing: "border-box",
  transition: "border-color 0.2s",
});

const btnStyle = (active) => ({
  background: active ? `linear-gradient(135deg, ${colors.blueLight}, ${colors.blue})` : colors.paperDark,
  border: "none",
  color: active ? "#fff" : colors.inkFaint,
  padding: "13px 28px",
  borderRadius: "6px",
  cursor: active ? "pointer" : "default",
  fontSize: "15px",
  fontWeight: active ? "700" : "400",
  fontFamily: "'Source Serif 4', Georgia, serif",
  transition: "all 0.2s",
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
  boxShadow: active ? "0 2px 12px rgba(42,82,152,0.3)" : "none",
});

// ─── Sub-components ───────────────────────────────────────────────────────────
function Tooltip({ text }) {
  const [open, setOpen] = useState(false);
  return (
    <span style={{ position: "relative", display: "inline-block", marginLeft: "6px" }}>
      <span onClick={() => setOpen(o => !o)} style={{ cursor: "pointer", color: colors.blueLight, fontSize: "12px", border: `1px solid ${colors.blueLight}`, borderRadius: "50%", width: "16px", height: "16px", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>?</span>
      {open && (
        <div style={{ position: "absolute", left: "22px", top: "-4px", width: "240px", zIndex: 20, background: colors.white, border: `1px solid ${colors.border}`, borderRadius: "8px", padding: "12px 14px", fontSize: "13px", color: colors.inkLight, lineHeight: "1.6", boxShadow: "0 4px 20px rgba(0,0,0,0.12)" }}>
          {text}
          <div onClick={() => setOpen(false)} style={{ marginTop: "8px", color: colors.blueLight, cursor: "pointer", fontSize: "11px" }}>Close ×</div>
        </div>
      )}
    </span>
  );
}

function Field({ field, value, onChange }) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ marginBottom: "4px" }}>
      <label style={{ display: "block", marginBottom: "7px", fontSize: "13px", color: colors.inkMuted, letterSpacing: "0.03em" }}>
        {field.label}
        {field.required && <span style={{ color: colors.blueLight, marginLeft: "4px" }}>*</span>}
        {field.helper && <Tooltip text={field.helper} />}
      </label>
      {field.type === "select" ? (
        <select value={value || ""} onChange={e => onChange(e.target.value)} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          style={{ ...inputStyle(focused), cursor: "pointer" }}>
          <option value="">Select...</option>
          {field.options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : field.type === "textarea" ? (
        <textarea value={value || ""} onChange={e => onChange(e.target.value)} placeholder={field.placeholder}
          rows={field.rows || 4} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          style={{ ...inputStyle(focused), resize: "vertical", lineHeight: "1.7", minHeight: `${(field.rows || 4) * 28}px` }} />
      ) : (
        <input type="text" value={value || ""} onChange={e => onChange(e.target.value)}
          placeholder={field.placeholder} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          style={inputStyle(focused)} />
      )}
    </div>
  );
}

function Spinner() {
  return <span style={{ width: "16px", height: "16px", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block", animation: "spin 0.8s linear infinite" }} />;
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function TaxFight() {
  const [step, setStep]             = useState(0);
  const [formData, setFormData]     = useState({});
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
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (code) { setAccessCode(code.toUpperCase()); verifyCode(code.toUpperCase(), true); }
  }, []);

  useEffect(() => {
    try { const saved = sessionStorage.getItem("tf_form"); if (saved) setFormData(JSON.parse(saved)); } catch {}
  }, []);

  useEffect(() => {
    try { sessionStorage.setItem("tf_form", JSON.stringify(formData)); } catch {}
  }, [formData]);

  const handleChange = (key, value) => setFormData(prev => ({ ...prev, [key]: value }));

  const isStepValid = (stepName) => {
    const req = requiredFields[stepName] || [];
    return req.every(k => formData[k]?.trim());
  };

  const verifyCode = async (code, silent = false) => {
    if (!code?.trim()) { setCodeError("Please enter your access code."); return; }
    setCodeError("");
    try {
      const res = await fetch(`${API_BASE}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessCode: code, systemPrompt: "Reply: VALID", userPrompt: "check" }),
      });
      if (res.status === 401) { if (!silent) setCodeError("Invalid access code. Check your Payhip receipt email."); setCodeValid(false); }
      else { setCodeValid(true); if (!silent) setStep(1); }
    } catch { if (!silent) setCodeError("Could not verify code. Check your internet connection."); }
  };

  const callAPI = async (systemPrompt, userPrompt, reviewMode = false, draftLetter = "") => {
    const res = await fetch(`${API_BASE}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessCode, systemPrompt, userPrompt, reviewMode, draftLetter }),
    });
    if (!res.ok) { const err = await res.json(); throw new Error(err.error || "Generation failed"); }
    const data = await res.json();
    return data.text;
  };

  const systemPrompt = `You are an expert property tax attorney with 20 years of experience writing successful property tax assessment appeals. Write compelling, evidence-based appeal letters that maximize the likelihood of assessment reduction.

Rules:
- Open with the specific parcel address, account number, assessed value, and requested value
- Cite the owner's legal right to appeal under their state's general statutes (use the correct citation for the state provided)
- Address EACH basis for appeal explicitly with labeled sections
- Reference comparable sales by address, sale price, date, and key characteristics
- Cite assessor record errors specifically if provided
- Use professional business letter format addressed to the appropriate appeals board
- Include [DATE] placeholder and signature block with property owner line
- 600-850 words
- No emotional language — factual and precise throughout
- Output ONLY the letter, no preamble or commentary`;

  const buildPrompt = (tone = "standard") => {
    const savings = formData.assessedValue && formData.requestedValue && formData.taxRate
      ? `\nEstimated annual tax savings if approved: calculated from difference`
      : "";

    const base = `
PROPERTY:
- Address: ${formData.address}
- Parcel ID: ${formData.parcelId || "not provided"}
- State: ${formData.state}
- County/Municipality: ${formData.county || "not specified"}
- Property Type: ${formData.propType}
- Year Built: ${formData.yearBuilt || "not specified"}
- Square Footage: ${formData.sqft || "not specified"}
- Bedrooms/Baths: ${formData.beds || "?"}BR/${formData.baths || "?"}BA
- Lot Size: ${formData.lotSize || "not specified"}

ASSESSMENT:
- Current Assessed Value: ${formData.assessedValue}
- Assessment Year: ${formData.assessmentYear}
- Current Tax Bill: ${formData.currentTaxBill || "not specified"}
- Tax Rate: ${formData.taxRate || "not specified"}
- Requested Value: ${formData.requestedValue}
- Primary Reason for Appeal: ${formData.appealReasons}
- Assessor Record Errors: ${formData.assessorErrors || "none identified"}
- Recent Purchase: ${formData.recentPurchase}
- Purchase Price: ${formData.purchasePrice || "N/A"}

COMPARABLE SALES:
${formData.comps}

CONDITION ISSUES:
${formData.conditionIssues || "none specified"}

ASSESSMENT INEQUITY:
${formData.inequity || "not specified"}

ADDITIONAL EVIDENCE:
${formData.additionalEvidence || "none"}

PRIOR APPEALS: ${formData.priorAppeals || "No — first appeal"}`;

    if (tone === "assertive") {
      return `Write a MORE ASSERTIVE and DETAILED property tax appeal letter for this situation. Use stronger, more confident language, more technical specificity about valuation methodology, and a more forceful framing while remaining entirely professional. Different wording and structure from a standard version:\n${base}`;
    }
    return `Write a STANDARD PROFESSIONAL property tax appeal letter for this situation:\n${base}`;
  };

  const generateLetter = async () => {
    setLoading(true);
    setError("");
    setLetter("");
    setAltLetter("");
    setChecklist([]);

    try {
      setLoadingMsg("Drafting your appeal letter...");
      const draft = await callAPI(systemPrompt, buildPrompt("standard"));

      setLoadingMsg("Running quality review...");
      const reviewed = await callAPI("", "", true, draft);
      setLetter(reviewed);

      setLoadingMsg("Generating assertive version...");
      const alt = await callAPI(systemPrompt, buildPrompt("assertive"));
      setAltLetter(alt);

      setLoadingMsg("Building submission checklist...");
      const clRes = await fetch(`${API_BASE}/api/checklist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessCode,
          address: formData.address,
          state: formData.state,
          appealType: "property tax assessment appeal",
          letterExcerpt: reviewed.substring(0, 300),
        }),
      });
      if (clRes.ok) { const clData = await clRes.json(); setChecklist(clData.checklist || []); }

      setStep(STEPS.indexOf("Letter"));
      setRetryCount(0);

    } catch (e) {
      const n = retryCount + 1;
      setRetryCount(n);
      setError(n < 3 ? `Generation failed: ${e.message}. Please try again.` : "Multiple failures. Try refreshing the page or contact support@buyappsonce.com.");
    }

    setLoading(false);
    setLoadingMsg("");
  };

  const copyText = (text) => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2500); };

  const downloadPDF = (text) => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "pt", format: "letter" });
    const margin = 72;
    const usableWidth = doc.internal.pageSize.getWidth() - margin * 2;
    const lineHeight = 14;
    doc.setFont("Times", "normal");
    doc.setFontSize(11);
    const today = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    const fullText = text.replace(/\[DATE\]/g, today);
    const lines = doc.splitTextToSize(fullText, usableWidth);
    let y = margin;
    lines.forEach(line => {
      if (y + lineHeight > doc.internal.pageSize.getHeight() - margin) { doc.addPage(); y = margin; }
      doc.text(line, margin, y);
      y += lineHeight;
    });
    doc.save("TaxFight-appeal-letter.pdf");
  };

  const reset = () => {
    setStep(codeValid ? 1 : 0);
    setFormData({});
    setLetter(""); setAltLetter("");
    setError(""); setChecklist([]);
    setRetryCount(0);
    try { sessionStorage.removeItem("tf_form"); } catch {}
  };

  const currentStep = STEPS[step];
  const PAYHIP_URL = "https://payhip.com/b/PLACEHOLDER";

  const pageStyle = {
    minHeight: "100vh",
    background: colors.paper,
    fontFamily: "'Source Serif 4', Georgia, serif",
    color: colors.ink,
  };

  const containerStyle = { maxWidth: "720px", margin: "0 auto", padding: "40px 24px 80px" };

  return (
    <div style={pageStyle}>

      {/* Header */}
      <div style={{ background: colors.white, borderBottom: `1px solid ${colors.border}`, padding: "14px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 20, boxShadow: "0 2px 10px rgba(0,0,0,0.06)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ width: "34px", height: "34px", background: `linear-gradient(135deg, ${colors.blueLight}, ${colors.blue})`, borderRadius: "7px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px" }}>🏠</div>
          <div>
            <div style={{ fontSize: "18px", fontWeight: "700", fontFamily: "'Playfair Display', serif", color: colors.ink }}>TaxFight</div>
            <div style={{ fontSize: "10px", color: colors.inkFaint, letterSpacing: "0.1em", textTransform: "uppercase" }}>Property Tax Appeal Letter</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          {step > 0 && step < STEPS.indexOf("Letter") && (
            <button onClick={() => setShowSample(s => !s)} style={{ background: "transparent", border: `1px solid ${colors.border}`, color: colors.inkMuted, padding: "7px 14px", borderRadius: "6px", cursor: "pointer", fontSize: "12px", fontFamily: "'Source Serif 4', serif" }}>
              {showSample ? "Hide" : "View"} Sample
            </button>
          )}
          {letter && (
            <button onClick={reset} style={{ background: "transparent", border: `1px solid ${colors.border}`, color: colors.inkMuted, padding: "7px 14px", borderRadius: "6px", cursor: "pointer", fontSize: "12px", fontFamily: "'Source Serif 4', serif" }}>
              ← New Letter
            </button>
          )}
        </div>
      </div>

      {/* Sample drawer */}
      {showSample && (
        <div style={{ background: colors.paperWarm, borderBottom: `1px solid ${colors.border}`, padding: "24px 28px", maxHeight: "320px", overflowY: "auto" }}>
          <div style={{ fontSize: "11px", color: colors.blueLight, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "12px" }}>Example Output</div>
          <pre style={{ fontSize: "12px", color: colors.inkLight, lineHeight: "1.8", whiteSpace: "pre-wrap", fontFamily: "'Source Serif 4', Georgia, serif", margin: 0 }}>{SAMPLE_LETTER}</pre>
        </div>
      )}

      <div style={containerStyle}>

        {/* ── ACCESS CODE GATE ── */}
        {currentStep === "Intro" && (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "13px", color: colors.blueLight, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "12px" }}>🏠 TaxFight</div>
            <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(28px, 5vw, 44px)", color: colors.ink, marginBottom: "16px", fontWeight: "900" }}>
              Fight Your Property Tax Assessment
            </h1>
            <p style={{ fontSize: "17px", color: colors.inkMuted, marginBottom: "40px", maxWidth: "500px", margin: "0 auto 36px", lineHeight: "1.7" }}>
              Attorney-quality property tax appeal letter in 5 minutes. 30–60% of homes are overassessed. Yours might be one of them.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "40px", textAlign: "left" }}>
              {TIPS.map(t => (
                <div key={t.title} style={{ background: colors.white, border: `1px solid ${colors.borderLight}`, borderRadius: "10px", padding: "20px", display: "flex", gap: "14px" }}>
                  <span style={{ fontSize: "22px" }}>{t.icon}</span>
                  <div>
                    <div style={{ fontSize: "13px", fontWeight: "600", color: colors.ink, marginBottom: "4px" }}>{t.title}</div>
                    <div style={{ fontSize: "12px", color: colors.inkMuted, lineHeight: "1.6" }}>{t.body}</div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ maxWidth: "400px", margin: "0 auto", background: colors.white, border: `1px solid ${colors.border}`, borderRadius: "12px", padding: "32px", boxShadow: "0 4px 24px rgba(0,0,0,0.08)" }}>
              <div style={{ fontSize: "14px", color: colors.inkLight, marginBottom: "16px", fontWeight: "600" }}>Enter Your Access Code</div>
              <input
                type="text"
                value={accessCode}
                onChange={e => { setAccessCode(e.target.value.toUpperCase()); setCodeError(""); }}
                placeholder="From your Payhip receipt"
                style={{ ...inputStyle(false), textAlign: "center", fontSize: "16px", letterSpacing: "0.08em", marginBottom: "12px", fontWeight: "600" }}
              />
              {codeError && <div style={{ color: colors.errorText, fontSize: "13px", marginBottom: "12px" }}>{codeError}</div>}
              <button onClick={() => verifyCode(accessCode)} style={{ ...btnStyle(!!accessCode.trim()), width: "100%", justifyContent: "center", padding: "14px" }}>
                Start My Appeal →
              </button>
              <div style={{ marginTop: "16px", fontSize: "12px", color: colors.inkFaint, lineHeight: "1.6" }}>
                Don't have an access code?{" "}
                <a href={PAYHIP_URL} style={{ color: colors.blueLight, textDecoration: "none" }}>Purchase for $39 →</a>
              </div>
            </div>
          </div>
        )}

        {/* ── FORM STEPS ── */}
        {["Property", "Assessment", "Evidence"].includes(currentStep) && (
          <>
            <div style={{ marginBottom: "36px" }}>
              <div style={{ display: "flex", gap: "6px", marginBottom: "10px" }}>
                {["Property", "Assessment", "Evidence"].map((s, i) => {
                  const idx = ["Property", "Assessment", "Evidence"].indexOf(currentStep);
                  return <div key={s} style={{ flex: 1, height: "3px", borderRadius: "2px", background: i < idx ? colors.blueLight : i === idx ? colors.blue : colors.borderLight, transition: "background 0.3s" }} />;
                })}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                {["Property", "Assessment", "Evidence"].map((s, i) => {
                  const idx = ["Property", "Assessment", "Evidence"].indexOf(currentStep);
                  return <div key={s} style={{ fontSize: "10px", color: i <= idx ? colors.blueLight : colors.borderLight, letterSpacing: "0.07em", textTransform: "uppercase" }}>{s}</div>;
                })}
              </div>
            </div>

            <div style={{ marginBottom: "28px" }}>
              <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "26px", color: colors.ink, marginBottom: "6px", fontWeight: "700" }}>
                {currentStep === "Property"   && "About Your Property"}
                {currentStep === "Assessment" && "Your Assessment & What You're Requesting"}
                {currentStep === "Evidence"   && "Your Evidence"}
              </h2>
              <p style={{ fontSize: "14px", color: colors.inkMuted, lineHeight: "1.6" }}>
                {currentStep === "Property"   && "Basic property details. Approximate values are fine."}
                {currentStep === "Assessment" && "The more specific you are with numbers, the stronger your appeal."}
                {currentStep === "Evidence"   && "Comparable sales are the foundation of every successful appeal. Include at least 3."}
              </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              {stepFields[currentStep].map(f => (
                <Field key={f.key} field={f} value={formData[f.key]} onChange={v => handleChange(f.key, v)} />
              ))}
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "36px" }}>
              <button onClick={() => setStep(s => s - 1)} style={{ ...btnStyle(true), background: "transparent", border: `1px solid ${colors.border}`, color: colors.inkMuted, boxShadow: "none" }}>
                ← Back
              </button>
              <button onClick={() => setStep(s => s + 1)} disabled={!isStepValid(currentStep)} style={btnStyle(isStepValid(currentStep))}>
                Continue →
              </button>
            </div>
          </>
        )}

        {/* ── GENERATE ── */}
        {currentStep === "Generate" && (
          <div style={{ textAlign: "center" }}>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "30px", color: colors.ink, marginBottom: "12px" }}>Ready to Generate</h2>
            <p style={{ fontSize: "16px", color: colors.inkMuted, marginBottom: "36px", maxWidth: "480px", margin: "0 auto 32px", lineHeight: "1.7" }}>
              Click below and the AI will write your property tax appeal letter — two-pass quality review, Standard and Assertive versions. Takes about 20–30 seconds.
            </p>

            <div style={{ maxWidth: "420px", margin: "0 auto" }}>
              <button onClick={generateLetter} disabled={loading} style={{ ...btnStyle(!loading), width: "100%", justifyContent: "center", padding: "16px", fontSize: "17px" }}>
                {loading ? <><Spinner /> {loadingMsg || "Generating..."}</> : "Generate My Appeal Letter ✦"}
              </button>

              {error && (
                <div style={{ marginTop: "16px", padding: "13px 16px", background: colors.errorBg, border: `1px solid ${colors.errorBorder}`, borderRadius: "8px", color: colors.errorText, fontSize: "13px" }}>
                  {error}
                  {retryCount < 3 && <button onClick={generateLetter} style={{ marginLeft: "12px", background: "transparent", border: "none", color: colors.blueLight, cursor: "pointer", fontFamily: "'Source Serif 4', serif", fontSize: "13px" }}>Try again →</button>}
                </div>
              )}

              <div style={{ marginTop: "14px", fontSize: "12px", color: colors.inkFaint }}>
                Two-pass AI review · Standard + Assertive versions · Submission checklist
              </div>
            </div>

            <button onClick={() => setStep(s => s - 1)} style={{ marginTop: "28px", background: "transparent", border: "none", color: colors.inkFaint, cursor: "pointer", fontFamily: "'Source Serif 4', serif", fontSize: "13px" }}>
              ← Edit my answers
            </button>
          </div>
        )}

        {/* ── LETTER OUTPUT ── */}
        {currentStep === "Letter" && letter && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "28px" }}>
              <div>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "24px", color: colors.blue, marginBottom: "4px" }}>Your Appeal Letter is Ready</div>
                <div style={{ fontSize: "13px", color: colors.inkFaint }}>Two-pass AI reviewed · Two versions · Checklist included</div>
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <button onClick={() => copyText(activeTab === "standard" ? letter : altLetter)} style={btnStyle(true)}>
                  {copied ? "✓ Copied!" : "Copy Letter"}
                </button>
                <button onClick={() => downloadPDF(activeTab === "standard" ? letter : altLetter)} style={{ ...btnStyle(true), background: "transparent", border: `1px solid ${colors.blueLight}`, color: colors.blueLight }}>⬇ PDF</button>
              </div>
            </div>

            {altLetter && (
              <div style={{ display: "flex", gap: "2px", background: colors.paperDark, padding: "4px", borderRadius: "8px", marginBottom: "6px" }}>
                {[["standard", "Standard / Professional"], ["assertive", "Assertive / Detailed"]].map(([key, label]) => (
                  <button key={key} onClick={() => setActiveTab(key)} style={{ flex: 1, padding: "10px", borderRadius: "6px", border: "none", cursor: "pointer", fontFamily: "'Source Serif 4', serif", fontSize: "13px", transition: "all 0.2s", background: activeTab === key ? `linear-gradient(135deg, ${colors.blueLight}, ${colors.blue})` : "transparent", color: activeTab === key ? "#fff" : colors.inkMuted, fontWeight: activeTab === key ? "600" : "400" }}>
                    {label}
                  </button>
                ))}
              </div>
            )}
            <div style={{ fontSize: "12px", color: colors.inkFaint, marginBottom: "16px" }}>
              {activeTab === "standard" ? "Professional tone. Suitable for most assessment appeals." : "More assertive framing. Better when you have strong comps or documented errors."}
            </div>

            <div style={{ background: colors.white, border: `1px solid ${colors.border}`, borderRadius: "10px", padding: "40px 48px", lineHeight: "1.9", fontSize: "14px", color: colors.inkLight, whiteSpace: "pre-wrap", fontFamily: "'Source Serif 4', Georgia, serif", boxShadow: "0 4px 32px rgba(0,0,0,0.08)", marginBottom: "24px" }}>
              {activeTab === "standard" ? letter : altLetter}
            </div>

            {checklist.length > 0 && (
              <div style={{ background: colors.white, border: `1px solid ${colors.border}`, borderRadius: "10px", padding: "24px 28px", marginBottom: "20px" }}>
                <div style={{ fontSize: "12px", color: colors.blueLight, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "16px" }}>Submission Checklist</div>
                {checklist.map((item, i) => (
                  <label key={i} style={{ display: "flex", gap: "12px", marginBottom: "10px", cursor: "pointer", alignItems: "flex-start" }}>
                    <input type="checkbox" style={{ marginTop: "3px", accentColor: colors.blueLight }} />
                    <span style={{ fontSize: "14px", color: colors.inkLight, lineHeight: "1.5" }}>{item}</span>
                  </label>
                ))}
              </div>
            )}

            <div style={{ background: "#f0f4ff", border: "1px solid #c8d8f0", borderRadius: "10px", padding: "20px 24px", marginBottom: "20px" }}>
              <div style={{ display: "flex", gap: "14px" }}>
                <span style={{ fontSize: "22px" }}>💡</span>
                <div>
                  <div style={{ fontSize: "13px", color: colors.blue, fontWeight: "600", marginBottom: "6px" }}>Tips for your hearing</div>
                  <div style={{ fontSize: "12px", color: "#4a5888", lineHeight: "1.6" }}>
                    Bring printed copies of your comparable sales, photos of any condition issues, and this letter. Keep your presentation factual and brief — boards respond to data, not frustration. Most residential appeals don't require an attorney.
                  </div>
                </div>
              </div>
            </div>

            <div style={{ padding: "14px 18px", background: colors.paperWarm, borderRadius: "8px", border: `1px solid ${colors.borderLight}`, fontSize: "11px", color: colors.inkFaint, lineHeight: "1.7" }}>
              <strong>Legal Disclaimer:</strong> This letter is AI-generated and does not constitute legal advice. Review all content carefully for accuracy before submission. TaxFight makes no warranty regarding appeal outcomes. For complex commercial properties or large assessments, consult a licensed property tax attorney in your jurisdiction.
            </div>

            <div style={{ marginTop: "24px", textAlign: "center", padding: "20px", background: colors.white, borderRadius: "10px", border: `1px solid ${colors.borderLight}` }}>
              <div style={{ fontSize: "14px", color: colors.inkMuted, marginBottom: "6px" }}>Did your appeal succeed?</div>
              <div style={{ fontSize: "12px", color: colors.inkFaint }}>Share your result → <span style={{ color: colors.blueLight }}>results@taxfightletter.com</span></div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        input::placeholder, textarea::placeholder { color: #c0b8a8; }
        * { box-sizing: border-box; }
        body { margin: 0; }
        @media print {
          nav, button, .no-print { display: none !important; }
          body { background: #fff; }
          @page { margin: 0.75in; }
        }
      `}</style>

      <footer style={{ textAlign: "center", padding: "16px", fontSize: "0.72rem", color: "#888", borderTop: "1px solid #e5e0d6", marginTop: "40px" }}>
        TaxFight · © 2026 The Super Simple Software Company · support@buyappsonce.com
      </footer>
    </div>
  );
}
