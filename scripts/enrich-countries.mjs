#!/usr/bin/env node
/**
 * Enrich maps.json with countries[] from LoC location metadata.
 * Run: node scripts/enrich-countries.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "../src/data/maps.json");
const UA = "MapdatingGame/1.0 (educational; country enrich)";

/** LoC location strings → ISO 3166-1 alpha-2 */
const NAME_TO_CODE = {
  "united states": "US",
  "united states of america": "US",
  usa: "US",
  canada: "CA",
  mexico: "MX",
  "united kingdom": "GB",
  "great britain": "GB",
  scotland: "GB",
  wales: "GB",
  ireland: "IE",
  france: "FR",
  germany: "DE",
  spain: "ES",
  portugal: "PT",
  italy: "IT",
  netherlands: "NL",
  belgium: "BE",
  luxembourg: "LU",
  switzerland: "CH",
  austria: "AT",
  poland: "PL",
  russia: "RU",
  "soviet union": "RU",
  china: "CN",
  japan: "JP",
  korea: "KR",
  "south korea": "KR",
  "north korea": "KP",
  india: "IN",
  australia: "AU",
  "new zealand": "NZ",
  brazil: "BR",
  argentina: "AR",
  chile: "CL",
  peru: "PE",
  colombia: "CO",
  venezuela: "VE",
  cuba: "CU",
  jamaica: "JM",
  haiti: "HT",
  "dominican republic": "DO",
  egypt: "EG",
  morocco: "MA",
  algeria: "DZ",
  tunisia: "TN",
  "south africa": "ZA",
  turkey: "TR",
  greece: "GR",
  sweden: "SE",
  norway: "NO",
  denmark: "DK",
  finland: "FI",
  iceland: "IS",
  hungary: "HU",
  romania: "RO",
  bulgaria: "BG",
  "czech republic": "CZ",
  czechoslovakia: "CZ",
  slovakia: "SK",
  ukraine: "UA",
  belarus: "BY",
  lithuania: "LT",
  latvia: "LV",
  estonia: "EE",
  croatia: "HR",
  serbia: "RS",
  slovenia: "SI",
  bosnia: "BA",
  "bosnia and herzegovina": "BA",
  albania: "AL",
  macedonia: "MK",
  "north macedonia": "MK",
  iran: "IR",
  persia: "IR",
  iraq: "IQ",
  syria: "SY",
  lebanon: "LB",
  israel: "IL",
  palestine: "PS",
  "saudi arabia": "SA",
  yemen: "YE",
  afghanistan: "AF",
  pakistan: "PK",
  bangladesh: "BD",
  "sri lanka": "LK",
  ceylon: "LK",
  thailand: "TH",
  siam: "TH",
  vietnam: "VN",
  "viet nam": "VN",
  cambodia: "KH",
  laos: "LA",
  myanmar: "MM",
  burma: "MM",
  indonesia: "ID",
  malaysia: "MY",
  philippines: "PH",
  singapore: "SG",
  mongolia: "MN",
  nepal: "NP",
  tibet: "CN",
  "hong kong": "HK",
  taiwan: "TW",
  "formosa": "TW",
  "south america": null,
  "north america": null,
  "central america": null,
  europe: null,
  asia: null,
  africa: null,
  "earth (planet)": "WORLD",
  world: "WORLD",
  antarctica: "AQ",
  greenland: "GL",
  "puerto rico": "PR",
  "new spain": "MX",
  "holy roman empire": "DE",
  prussia: "DE",
  bavaria: "DE",
  saxony: "DE",
  "ottoman empire": "TR",
  "austrian empire": "AT",
  "austro-hungarian empire": "AT",
  "british empire": "GB",
  "french west africa": "FR",
  "french guiana": "GF",
  "french polynesia": "PF",
  algeria: "DZ",
  libya: "LY",
  sudan: "SD",
  ethiopia: "ET",
  abyssinia: "ET",
  kenya: "KE",
  nigeria: "NG",
  ghana: "GH",
  "gold coast": "GH",
  congo: "CD",
  "democratic republic of the congo": "CD",
  angola: "AO",
  mozambique: "MZ",
  madagascar: "MG",
  zimbabwe: "ZW",
  rhodesia: "ZW",
  botswana: "BW",
  namibia: "NA",
  "panama": "PA",
  "costa rica": "CR",
  nicaragua: "NI",
  honduras: "HN",
  guatemala: "GT",
  "el salvador": "SV",
  belize: "BZ",
  ecuador: "EC",
  bolivia: "BO",
  paraguay: "PY",
  uruguay: "UY",
  guyana: "GY",
  suriname: "SR",
  "trinidad and tobago": "TT",
  barbados: "BB",
  bahamas: "BS",
  bermuda: "BM",
  fiji: "FJ",
  samoa: "WS",
  tonga: "TO",
  "papua new guinea": "PG",
  "new guinea": "PG",
  "solomon islands": "SB",
  vanuatu: "VU",
  "new hebrides": "VU",
  "marshall islands": "MH",
  micronesia: "FM",
  palau: "PW",
  guam: "GU",
  "american samoa": "AS",
  "virgin islands": "VI",
  cyprus: "CY",
  malta: "MT",
  monaco: "MC",
  andorra: "AD",
  liechtenstein: "LI",
  "san marino": "SM",
  "vatican city": "VA",
  georgia: "GE",
  armenia: "AM",
  azerbaijan: "AZ",
  kazakhstan: "KZ",
  uzbekistan: "UZ",
  turkmenistan: "TM",
  kyrgyzstan: "KG",
  tajikistan: "TJ",
  "saudi arabia": "SA",
  kuwait: "KW",
  bahrain: "BH",
  qatar: "QA",
  "united arab emirates": "AE",
  oman: "OM",
  jordan: "JO",
  "west bank": "PS",
  gaza: "PS",
};

const CODE_TO_NAME = {
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
  GF: "French Guiana",
  PF: "French Polynesia",
  LY: "Libya",
  SD: "Sudan",
  ET: "Ethiopia",
  KE: "Kenya",
  NG: "Nigeria",
  GH: "Ghana",
  CD: "DR Congo",
  AO: "Angola",
  MZ: "Mozambique",
  MG: "Madagascar",
  ZW: "Zimbabwe",
  BW: "Botswana",
  NA: "Namibia",
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
  WS: "Samoa",
  TO: "Tonga",
  PG: "Papua New Guinea",
  SB: "Solomon Islands",
  VU: "Vanuatu",
  MH: "Marshall Islands",
  FM: "Micronesia",
  PW: "Palau",
  GU: "Guam",
  AS: "American Samoa",
  VI: "Virgin Islands",
  CY: "Cyprus",
  MT: "Malta",
  MC: "Monaco",
  AD: "Andorra",
  LI: "Liechtenstein",
  SM: "San Marino",
  VA: "Vatican City",
  GE: "Georgia",
  AM: "Armenia",
  AZ: "Azerbaijan",
  KZ: "Kazakhstan",
  UZ: "Uzbekistan",
  TM: "Turkmenistan",
  KG: "Kyrgyzstan",
  TJ: "Tajikistan",
  KW: "Kuwait",
  BH: "Bahrain",
  QA: "Qatar",
  AE: "United Arab Emirates",
  OM: "Oman",
  JO: "Jordan",
};

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function normalizeName(raw) {
  return String(raw || "")
    .toLowerCase()
    .replace(/\s*\(.*?\)\s*/g, " ")
    .replace(/[,.].*$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function codesFromLabels(labels = []) {
  const codes = new Set();
  for (const label of labels) {
    const name = normalizeName(label);
    if (!name) continue;
    if (NAME_TO_CODE[name] !== undefined) {
      const code = NAME_TO_CODE[name];
      if (code) codes.add(code);
      continue;
    }
    // Try last segment: "paris, france" already split by LoC usually
    for (const [key, code] of Object.entries(NAME_TO_CODE)) {
      if (code && (name === key || name.includes(key))) {
        // Prefer exact; for includes require word boundary-ish
        if (name === key || new RegExp(`\\b${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(name)) {
          codes.add(code);
          break;
        }
      }
    }
  }
  return [...codes];
}

function countriesFromCodes(codes) {
  return codes.map((code) => ({
    code,
    name: CODE_TO_NAME[code] || code,
  }));
}

function inferFromScopeAndTitle(map) {
  const codes = new Set();
  if (map.scope === "usa") codes.add("US");
  if (map.scope === "world") codes.add("WORLD");

  const title = normalizeName(map.title);
  // Avoid false hits: "New England", continental "America", US state Georgia vs country
  const cleaned = title
    .replace(/\bnew england\b/g, " ")
    .replace(/\bnorth america\b/g, " ")
    .replace(/\bsouth america\b/g, " ")
    .replace(/\bcentral america\b/g, " ")
    .replace(/\blatin america\b/g, " ");

  for (const [key, code] of Object.entries(NAME_TO_CODE)) {
    if (!code || key === "georgia") continue;
    if (new RegExp(`\\b${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(cleaned)) {
      codes.add(code);
    }
  }
  if (/\bengland\b/.test(cleaned) && !/\bnew england\b/.test(title)) codes.add("GB");
  if (/[eé]tats?-unis/.test(title)) codes.add("US");
  if (/mappemonde|orbis|world map|carte du monde|universalis|terrae orbis/.test(title)) {
    codes.add("WORLD");
  }
  return [...codes];
}

async function fetchItem(id) {
  const locId = id.replace(/^loc-/, "");
  const url = `https://www.loc.gov/item/${locId}/?fo=json`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  } finally {
    clearTimeout(timer);
  }
}

function extractLabels(data) {
  const item = data.item || {};
  const labels = [
    ...(data.location_country || []),
    ...(item.location_country || []),
    ...(data.location || []),
    ...(item.location || []),
    ...(item.locations || []),
  ];
  // subjects like "France--Maps"
  const subjects = [...(data.subject || []), ...(item.subject || []), ...(item.subjects || [])];
  for (const s of subjects) {
    const m = String(s).match(/^([^-\n]+)--maps$/i);
    if (m) labels.push(m[1]);
  }
  return labels.map(String);
}

async function main() {
  const maps = JSON.parse(readFileSync(OUT, "utf8"));
  const fetchRemote = process.env.SKIP_FETCH !== "1";
  let updated = 0;
  let failed = 0;

  for (let i = 0; i < maps.length; i++) {
    const map = maps[i];
    if (fetchRemote) process.stdout.write(`\r[${i + 1}/${maps.length}] ${map.id}   `);
    const codes = new Set(inferFromScopeAndTitle(map));

    if (fetchRemote) {
      try {
        const data = await fetchItem(map.id);
        for (const code of codesFromLabels(extractLabels(data))) {
          codes.add(code);
        }
      } catch {
        failed++;
      }
      await sleep(120);
    }

    // World maps: keep WORLD as the primary signal; drop endless country lists
    if (codes.has("WORLD") || map.scope === "world") {
      map.countries = countriesFromCodes(["WORLD"]);
    } else {
      map.countries = countriesFromCodes([...codes].slice(0, 8));
    }

    if (map.countries.length) updated++;
  }

  writeFileSync(OUT, JSON.stringify(maps, null, 2) + "\n");
  console.log(`\nUpdated ${updated}/${maps.length}${fetchRemote ? ` (fetch failures: ${failed})` : " (title/scope only)"}`);
  const withCountries = maps.filter((m) => m.countries?.length);
  console.log("With countries:", withCountries.length);
  console.log(
    "Sample:",
    withCountries.slice(0, 5).map((m) => ({
      title: m.title.slice(0, 40),
      countries: m.countries,
    })),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
