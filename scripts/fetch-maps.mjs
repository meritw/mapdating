#!/usr/bin/env node
/**
 * One-off harvest: Library of Congress maps → src/data/maps.json
 * Tags each map with scope: "usa" | "world" | "other"
 * Run: node scripts/fetch-maps.mjs
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "../src/data/maps.json");
const PER_SCOPE = 120;
const YEAR_MIN = 1500;
const YEAR_MAX = 1950;

const DATE_RANGES = [
  "1500/1599",
  "1600/1699",
  "1700/1749",
  "1750/1799",
  "1800/1824",
  "1825/1849",
  "1850/1874",
  "1875/1899",
  "1900/1924",
  "1925/1950",
];

const UA = "MapdatingGame/1.0 (educational; local harvest script)";

const WORLD_TITLE_RE =
  /\b(world|mappemonde|mappa\s*mundi|orbis\s*terr|universalis\s*cosmo|terre\s*univers|globe|planisphere|whole\s+world|map\s+of\s+the\s+world|carte\s+du\s+monde)\b/i;

const US_STATES_RE =
  /\b(alabama|alaska|arizona|arkansas|california|colorado|connecticut|delaware|florida|georgia|hawaii|idaho|illinois|indiana|iowa|kansas|kentucky|kentucke|louisiana|maine|maryland|massachusetts|michigan|minnesota|mississippi|missouri|montana|nebraska|nevada|new\s+hampshire|new\s+jersey|new\s+mexico|new\s+york|north\s+carolina|north\s+dakota|ohio|oklahoma|oregon|pennsylvania|rhode\s+island|south\s+carolina|south\s+dakota|tennessee|texas|utah|vermont|virginia|washington|west\s+virginia|wisconsin|wyoming)\b/i;

/** Titles that clearly depict the entire United States (not a state/region). */
const WHOLE_US_TITLE_RE =
  /\b(united\s+states(\s+of\s+america)?|[eé]tats?-unis)\b/i;

const PARTIAL_US_TITLE_RE =
  /\b(southern|northern|eastern|western)\s+parts?\b|\b(county|counties|city of|town of|township|atlas of|map of the state)\b|\b(new england|pacific coast|atlantic coast|gulf coast|mississippi (river|valley)|great lakes|chesapeake|railroad map of .{0,40}(county|city))\b/i;

function isWholeUnitedStatesMap(title, subjects = []) {
  if (!WHOLE_US_TITLE_RE.test(title)) return false;
  if (PARTIAL_US_TITLE_RE.test(title)) return false;

  // Reject state- or territory-first titles that only mention the U.S. in passing
  const stateMatch = title.match(US_STATES_RE);
  if (stateMatch) {
    const lower = title.toLowerCase();
    const statePos = lower.indexOf(stateMatch[0].toLowerCase());
    const usPos = lower.search(/united\s+states|[eé]tats?-unis/);
    if (statePos >= 0 && (usPos < 0 || statePos < usPos)) return false;
  }

  const subj = subjects.map((s) => String(s).toLowerCase());
  const hasStateSubject = subj.some(
    (s) =>
      US_STATES_RE.test(s) &&
      !s.includes("united states") &&
      !s.includes("north america"),
  );
  const hasNationalSubject = subj.some(
    (s) =>
      s === "united states" ||
      s === "united states--maps" ||
      s.startsWith("united states--"),
  );
  if (hasStateSubject && !hasNationalSubject) return false;

  return true;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function parseYear(dateStr) {
  if (!dateStr || typeof dateStr !== "string") return null;
  const cleaned = dateStr.trim();
  if (/[?x]/i.test(cleaned)) return null;
  if (cleaned.includes("/") || /TO/i.test(cleaned)) return null;
  const single = cleaned.match(/^(\d{4})$/);
  if (single) return Number(single[1]);
  const month = cleaned.match(/^(\d{4})-\d{2}(-\d{2})?$/);
  if (month) return Number(month[1]);
  const bracket = cleaned.match(/^\[(\d{4})\]$/);
  if (bracket) return Number(bracket[1]);
  return null;
}

function pickImageUrl(imageUrls = []) {
  if (!imageUrls.length) return null;
  const clean = (u) => u.split("#")[0];
  const iiif25 = imageUrls.find((u) => u.includes("iiif") && u.includes("pct:25"));
  if (iiif25) return clean(iiif25);
  const iiif12 = imageUrls.find((u) => u.includes("iiif") && u.includes("pct:12.5"));
  if (iiif12) return clean(iiif12);
  const jpg = imageUrls.find((u) => /\.jpe?g/i.test(u) || u.includes("default.jpg"));
  if (jpg) return clean(jpg);
  const nonGif = imageUrls.find((u) => !/\.gif/i.test(u));
  return clean(nonGif || imageUrls[0]);
}

function isSanborn(item) {
  const hay = [
    ...(item.group || []),
    item.title || "",
    item.id || "",
    ...(item.partof || []),
  ]
    .join(" ")
    .toLowerCase();
  return hay.includes("sanborn");
}

function yearBucket(year) {
  return Math.floor(year / 25) * 25;
}

function classifyScope(item, preferred) {
  const subjects = (item.subject || []).map((s) => String(s).toLowerCase());
  const locations = [
    ...(item.location || []),
    ...(item.location_country || []),
  ].map((s) => String(s).toLowerCase());
  const title = item.title || "";

  const isWorld =
    preferred === "world" ||
    subjects.includes("world maps") ||
    locations.includes("earth (planet)") ||
    WORLD_TITLE_RE.test(title);

  if (isWorld) return "world";

  // USA scope = maps of the entire United States only
  if (isWholeUnitedStatesMap(title, subjects) || preferred === "usa") {
    if (preferred === "usa" && !isWholeUnitedStatesMap(title, subjects)) {
      return "other";
    }
    if (isWholeUnitedStatesMap(title, subjects)) return "usa";
  }

  return "other";
}

function normalizeItem(item, preferredScope) {
  if (!item.digitized) return null;
  if (isSanborn(item)) return null;
  const year = parseYear(item.date);
  if (year == null || year < YEAR_MIN || year > YEAR_MAX) return null;
  const imageUrl = pickImageUrl(item.image_url);
  if (!imageUrl) return null;
  const title = (item.title || "").trim();
  if (!title || title.length < 3) return null;
  if (/^\[?Maps of .+/i.test(title) && /--/.test(title)) return null;
  if (/^\[Maps of /i.test(title)) return null;

  const scope = classifyScope(item, preferredScope);
  // When harvesting a dedicated feed, keep only matching scope
  if (preferredScope === "world" && scope !== "world") return null;
  if (preferredScope === "usa" && scope !== "usa") return null;
  if (preferredScope === "other" && scope !== "other") return null;

  const id = (item.id || item.url || title)
    .replace(/^https?:\/\/www\.loc\.gov\/item\//, "loc-")
    .replace(/\/$/, "");

  return {
    id,
    title,
    year,
    scope,
    imageUrl,
    sourceUrl: item.url || `https://www.loc.gov/item/${id}/`,
    credit: "Library of Congress",
  };
}

async function fetchMaps(params) {
  const sp = new URLSearchParams({
    fo: "json",
    c: "100",
    sb: "date",
    ...params,
  });
  const url = `https://www.loc.gov/maps/?${sp}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`LoC ${res.status} for ${url}`);
    return res.json();
  } finally {
    clearTimeout(timer);
  }
}

function diversify(candidates, target) {
  const buckets = new Map();
  for (const m of candidates) {
    const b = yearBucket(m.year);
    if (!buckets.has(b)) buckets.set(b, []);
    buckets.get(b).push(m);
  }
  const selected = [];
  const bucketKeys = [...buckets.keys()].sort((a, b) => a - b);
  let guard = 0;
  while (selected.length < target && guard < target * 30) {
    guard++;
    let added = false;
    for (const key of bucketKeys) {
      const list = buckets.get(key);
      if (!list?.length) continue;
      selected.push(list.shift());
      added = true;
      if (selected.length >= target) break;
    }
    if (!added) break;
  }
  return selected;
}

async function fetchAllPages(buildParams, preferredScope, label, maxPages = 3) {
  const byId = new Map();
  const usedTitles = new Set();

  for (const dates of DATE_RANGES) {
    for (let page = 1; page <= maxPages; page++) {
      console.log(`[${label}] ${dates} p${page}…`);
      try {
        const data = await fetchMaps({ ...buildParams(dates), sp: String(page) });
        const results = data.results || [];
        if (!results.length) break;
        for (const item of results) {
          const mapped = normalizeItem(item, preferredScope);
          if (!mapped) continue;
          const titleKey = mapped.title.toLowerCase().replace(/\s+/g, " ");
          if (usedTitles.has(titleKey) || byId.has(mapped.id)) continue;
          usedTitles.add(titleKey);
          byId.set(mapped.id, mapped);
        }
        const total = data.pagination?.total;
        const perpage = data.pagination?.perpage || 100;
        if (total != null && page * perpage >= total) break;
        if (results.length < 50) break;
      } catch (err) {
        console.warn(`  skip ${dates} p${page}:`, err.message);
        break;
      }
      await sleep(300);
    }
  }

  const all = [...byId.values()].sort((a, b) => a.year - b.year);
  const selected = diversify(all, PER_SCOPE);
  console.log(`[${label}] candidates ${all.length} → kept ${selected.length}`);
  return selected;
}

async function harvest() {
  const worldA = await fetchAllPages(
    (dates) => ({
      dates,
      fa: "subject:world maps|online-format:image",
    }),
    "world",
    "world",
    2,
  );

  const worldB = await fetchAllPages(
    (dates) => ({
      dates,
      q: "world map",
      fa: "online-format:image",
    }),
    "world",
    "world-q",
    2,
  );

  const usaA = await fetchAllPages(
    (dates) => ({
      dates,
      q: '"map of the united states"',
      fa: "online-format:image",
    }),
    "usa",
    "usa",
    3,
  );

  const usaB = await fetchAllPages(
    (dates) => ({
      dates,
      q: '"united states of america"',
      fa: "online-format:image",
    }),
    "usa",
    "usa-usa",
    2,
  );

  const other = await fetchAllPages(
    (dates) => ({
      dates,
      fa: "online-format:image",
    }),
    "other",
    "other",
    2,
  );

  const byId = new Map();
  for (const m of other) byId.set(m.id, m);
  for (const m of usaA) byId.set(m.id, m);
  for (const m of usaB) byId.set(m.id, m);
  for (const m of worldA) byId.set(m.id, m);
  for (const m of worldB) byId.set(m.id, m);

  const selected = [...byId.values()].sort((a, b) => a.year - b.year);
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(selected, null, 2) + "\n");

  const counts = { usa: 0, world: 0, other: 0 };
  for (const m of selected) counts[m.scope] = (counts[m.scope] || 0) + 1;
  console.log(`Wrote ${selected.length} maps → ${OUT}`);
  console.log("By scope:", counts);
  console.log(
    `Year span: ${selected[0]?.year}–${selected[selected.length - 1]?.year}`,
  );
}

harvest().catch((err) => {
  console.error(err);
  process.exit(1);
});
