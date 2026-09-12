/** Country flag helpers (emoji + labels). */

const CODE_NAMES = {
  WORLD: "World",
  US: "United States",
  CA: "Canada",
  MX: "Mexico",
  GB: "United Kingdom",
  IE: "Ireland",
  FR: "France",
  DE: "Germany",
  ES: "Spain",
  PT: "Portugal",
  IT: "Italy",
  NL: "Netherlands",
  BE: "Belgium",
  LU: "Luxembourg",
  CH: "Switzerland",
  AT: "Austria",
  PL: "Poland",
  RU: "Russia",
  CN: "China",
  JP: "Japan",
  KR: "South Korea",
  KP: "North Korea",
  IN: "India",
  AU: "Australia",
  NZ: "New Zealand",
  BR: "Brazil",
  AR: "Argentina",
  CL: "Chile",
  PE: "Peru",
  CO: "Colombia",
  VE: "Venezuela",
  CU: "Cuba",
  JM: "Jamaica",
  HT: "Haiti",
  DO: "Dominican Republic",
  EG: "Egypt",
  MA: "Morocco",
  DZ: "Algeria",
  TN: "Tunisia",
  ZA: "South Africa",
  TR: "Turkey",
  GR: "Greece",
  SE: "Sweden",
  NO: "Norway",
  DK: "Denmark",
  FI: "Finland",
  IS: "Iceland",
  HU: "Hungary",
  RO: "Romania",
  BG: "Bulgaria",
  CZ: "Czechia",
  SK: "Slovakia",
  UA: "Ukraine",
  BY: "Belarus",
  LT: "Lithuania",
  LV: "Latvia",
  EE: "Estonia",
  HR: "Croatia",
  RS: "Serbia",
  SI: "Slovenia",
  BA: "Bosnia",
  AL: "Albania",
  MK: "North Macedonia",
  IR: "Iran",
  IQ: "Iraq",
  SY: "Syria",
  LB: "Lebanon",
  IL: "Israel",
  PS: "Palestine",
  SA: "Saudi Arabia",
  YE: "Yemen",
  AF: "Afghanistan",
  PK: "Pakistan",
  BD: "Bangladesh",
  LK: "Sri Lanka",
  TH: "Thailand",
  VN: "Vietnam",
  KH: "Cambodia",
  LA: "Laos",
  MM: "Myanmar",
  ID: "Indonesia",
  MY: "Malaysia",
  PH: "Philippines",
  SG: "Singapore",
  MN: "Mongolia",
  NP: "Nepal",
  HK: "Hong Kong",
  TW: "Taiwan",
  AQ: "Antarctica",
  GL: "Greenland",
  PR: "Puerto Rico",
  PA: "Panama",
  CR: "Costa Rica",
  NI: "Nicaragua",
  HN: "Honduras",
  GT: "Guatemala",
  SV: "El Salvador",
  BZ: "Belize",
  EC: "Ecuador",
  BO: "Bolivia",
  PY: "Paraguay",
  UY: "Uruguay",
  GY: "Guyana",
  SR: "Suriname",
  TT: "Trinidad and Tobago",
  BB: "Barbados",
  BS: "Bahamas",
  BM: "Bermuda",
  FJ: "Fiji",
  PG: "Papua New Guinea",
  CY: "Cyprus",
  MT: "Malta",
  GE: "Georgia",
  AM: "Armenia",
  AZ: "Azerbaijan",
  KZ: "Kazakhstan",
  AE: "United Arab Emirates",
  JO: "Jordan",
  CD: "DR Congo",
  ET: "Ethiopia",
  KE: "Kenya",
  NG: "Nigeria",
  GH: "Ghana",
  LY: "Libya",
  SD: "Sudan",
};

/**
 * @param {string} code ISO 3166-1 alpha-2, or WORLD
 */
export function flagEmoji(code) {
  if (!code || code === "WORLD") return "🌐";
  if (!/^[A-Za-z]{2}$/.test(code)) return "🏳️";
  const cc = code.toUpperCase();
  return String.fromCodePoint(...[...cc].map((c) => 127397 + c.charCodeAt(0)));
}

export function countryName(code, fallback) {
  const cc = String(code || "").toUpperCase();
  return CODE_NAMES[cc] || fallback || cc;
}

/**
 * @param {{code:string,name?:string}[]} countries
 * @param {{max?:number}} [opts]
 */
export function renderFlags(countries = [], opts = {}) {
  const max = opts.max ?? 6;
  if (!countries.length) return "";
  const shown = countries.slice(0, max);
  const extra = countries.length - shown.length;
  const items = shown
    .map((c) => {
      const name = escapeHtml(countryName(c.code, c.name));
      const emoji = flagEmoji(c.code);
      return `<span class="flag-chip" title="${name}" aria-label="${name}"><span class="flag-emoji" aria-hidden="true">${emoji}</span><span class="flag-name">${name}</span></span>`;
    })
    .join("");
  const more =
    extra > 0
      ? `<span class="flag-chip flag-more" title="${extra} more">+${extra}</span>`
      : "";
  return `<div class="flag-strip" role="list" aria-label="Countries shown on this map">${items}${more}</div>`;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
