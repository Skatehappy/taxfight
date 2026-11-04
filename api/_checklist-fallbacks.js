// api/_checklist-fallbacks.js - per-dispute-type checklist content (no network, no imports).
// Verified-content-only: plain action steps. No statute/rule/case/publication citations, no dollar amounts,
// percentages, day counts or deadlines, and no digits at all, so nothing here needs a VERIFICATION_LOG entry.
// Each type has a `focus` phrase (used to build the model prompt) and 4-6 `steps` of fallback content.
export const START = ['Gather the notice you received from the assessor or taxing authority, and confirm the filing method and cutoff date with the local office'];
export const END = [
  'Send everything by certified mail with return receipt requested, or file in person and get a stamped copy',
  'Keep a complete copy of everything you file, and log the date of each filing and every contact with the office',
  'Consider asking a property tax attorney or tax professional to review your filing before you send it',
];

export const TYPES = {
  'property-tax-assessment-appeal': {
    focus: 'a property tax assessment appeal',
    steps: [
      'Complete the appeal or protest form from your county assessor or board of review',
      'Print recent sales of similar nearby properties, with addresses, sale prices and sale dates',
      'Request a copy of the assessor property record card and check it for errors in size, age or features',
      'Take dated photos of any condition problems that lower your property value',
      'State the value you believe is correct and attach the evidence that supports it',
    ],
  },
  'over-assessed-property-value': {
    focus: 'an over-assessed property value',
    steps: [
      'Complete the appeal form and state the value you believe is fair',
      'Compare your assessment per square foot with similar nearby properties and print the comparison',
      'Check the property record card for wrong square footage, room counts, or features you do not have',
      'Gather recent sale prices of similar homes that sold for less than your assessed value',
      'Attach an appraisal if you have one, and photos that show the true condition of the property',
    ],
  },
  'homestead-exemption-denial': {
    focus: 'a denied homestead exemption',
    steps: [
      'Copy the denial notice and note the reason the office gave for refusing the exemption',
      'Gather proof that the property is your primary residence, such as a driver license, voter registration and utility bills',
      'Include the deed or other proof of your ownership and the date you moved in',
      'Complete the homestead exemption application or appeal form and answer every question',
      'Ask the office in writing which document it found missing, so you can supply exactly that',
    ],
  },
  'senior-tax-exemption-appeal': {
    focus: 'a denied senior property tax exemption',
    steps: [
      'Copy the denial notice and note the reason given for refusing the senior exemption',
      'Gather proof of your age, such as a birth certificate or government photo identification',
      'Gather proof of ownership and primary residence, such as the deed and recent utility bills',
      'Collect household income records for the required year if the exemption has an income limit',
      'Complete the application or appeal form and attach every supporting document',
    ],
  },
  'veteran-tax-exemption-appeal': {
    focus: 'a denied veteran property tax exemption',
    steps: [
      'Copy the denial notice and note the reason given for refusing the veteran exemption',
      'Attach your discharge papers or other proof of military service',
      'Attach any rating or eligibility letter from the Department of Veterans Affairs if your exemption depends on it',
      'Gather proof of ownership and residence, such as the deed and recent utility bills',
      'Complete the application or appeal form and attach every supporting document',
    ],
  },
  'disability-tax-exemption-appeal': {
    focus: 'a denied disability property tax exemption',
    steps: [
      'Copy the denial notice and note the reason given for refusing the disability exemption',
      'Gather a physician statement or agency determination that documents the disability',
      'Gather proof of ownership and primary residence, such as the deed and recent utility bills',
      'Collect household income records if the exemption has an income requirement',
      'Complete the application or appeal form and attach every supporting document',
    ],
  },
  'agricultural-use-valuation-appeal': {
    focus: 'an agricultural use valuation appeal',
    steps: [
      'Copy the notice that removed or denied the agricultural use classification',
      'Document the farming or agricultural use with dated photos, crop or livestock records and sales receipts',
      'Gather tax returns or income records that show the land is used for agricultural production',
      'Include maps or a survey showing the acreage actually in agricultural use',
      'Complete the agricultural classification application or appeal form and attach every supporting document',
    ],
  },
  'commercial-property-tax-appeal': {
    focus: 'a commercial property tax appeal',
    steps: [
      'Complete the appeal form for commercial property and state the value you believe is correct',
      'Gather income and expense statements and the current rent roll for the property',
      'Print sales of comparable commercial properties, with addresses, prices and sale dates',
      'Attach a commercial appraisal if you have one, and note any vacancy or deferred maintenance',
      'Request the assessor record for the property and check it for errors in size, use or features',
    ],
  },
  'property-tax-abatement-request': {
    focus: 'a property tax abatement request',
    steps: [
      'Confirm which abatement or relief program applies to your property and obtain its application form',
      'Complete the application and explain clearly why the abatement is warranted',
      'Gather the documents that prove you meet the program requirements, such as ownership records and financial hardship evidence',
      'Attach your current tax bill or assessment notice',
      'Ask the office in writing how and when you will be told of its decision',
    ],
  },
  'reassessment-after-damage': {
    focus: 'a reassessment request after property damage',
    steps: [
      'Take dated photos and video of the damage to the structure and the land',
      'Gather repair estimates, contractor reports and insurance claim records',
      'Obtain any fire, flood or building department report that documents the event and the date it happened',
      'Complete the reassessment or appeal form and state how the damage lowers the value of the property',
      'Ask the assessor to inspect the property, and keep a record of the request',
    ],
  },
};

export const NEUTRAL = {
  focus: 'a property tax assessment dispute',
  steps: [
    'Complete the appeal or request form from your county assessor or appeals board',
    'Attach a copy of the notice you are disputing',
    'Gather the records that support your position, such as property records, photos and sales of similar properties',
    'Write down clearly what you are asking the office to change',
  ],
};

const slug = v => String(v || '').trim().toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '');
export const typeInfo = type => TYPES[slug(type)] || NEUTRAL;
export const fallbackFor = type => [...START, ...typeInfo(type).steps, ...END];
