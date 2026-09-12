#!/usr/bin/env node
/**
 * Reclassify USA scope to whole-country maps only, then top up from LoC.
 * Run: node scripts/refine-usa.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "../src/data/maps.json");

// Import helpers by evaluating the harvest module's shared logic inline via dynamic import won't work
// (helpers aren't exported). Duplicate the whole-US check here to keep refine fast/standalone.

const US_STATES_RE =
  /\b(alabama|alaska|arizona|arkansas|california|colorado|connecticut|delaware|florida|georgia|hawaii|idaho|illinois|indiana|iowa|kansas|kentucky|kentucke|louisiana|maine|maryland|massachusetts|michigan|minnesota|mississippi|missouri|montana|nebraska|nevada|new\s+hampshire|new\s+jersey|new\s+mexico|new\s+york|north\s+carolina|north\s+dakota|ohio|oklahoma|oregon|pennsylvania|rhode\s+island|south\s+carolina|south\s+dakota|tennessee|texas|utah|vermont|virginia|washington|west\s+virginia|wisconsin|wyoming)\b/i;

const WHOLE_US_TITLE_RE =
  /\b(united\s+states(\s+of\s+america)?|[eé]tats?-unis)\b/i;

const PARTIAL_US_TITLE_RE =
  /\b(southern|northern|eastern|western)\s+parts?\b|\b(county|counties|city of|town of|township|atlas of|map of the state)\b|\b(new england|pacific coast|atlantic coast|gulf coast|mississippi (river|valley)|great lakes|chesapeake)\b/i;

function isWholeUnitedStatesMap(title) {
  if (!WHOLE_US_TITLE_RE.test(title)) return false;
  if (PARTIAL_US_TITLE_RE.test(title)) return false;
  const stateMatch = title.match(US_STATES_RE);
  if (stateMatch) {
    const lower = title.toLowerCase();
    const statePos = lower.indexOf(stateMatch[0].toLowerCase());
    const usPos = lower.search(/united\s+states|[eé]tats?-unis/);
    if (statePos >= 0 && (usPos < 0 || statePos < usPos)) return false;
  }
  return true;
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

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

const UA = "MapdatingGame/1.0 (educational; usa refine)";
const DATE_RANGES = [
  "1750/1799",
  "1800/1824",
  "1825/1849",
  "1850/1874",
  "1875/1899",
  "1900/1924",
  "1925/1950",
  "1700/1749",
];

async function fetchMaps(params) {
  const sp = new URLSearchParams({ fo: "json", c: "100", sb: "date", ...params });
  const url = `https://www.loc.gov/maps/?${sp}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`LoC ${res.status}`);
    return res.json();
  } finally {
    clearTimeout(timer);
  }
}

function toMap(item) {
  if (!item.digitized) return null;
  const title = (item.title || "").trim();
  if (!isWholeUnitedStatesMap(title)) return null;
  const year = parseYear(item.date);
  if (year == null || year < 1500 || year > 1950) return null;
  const imageUrl = pickImageUrl(item.image_url);
  if (!imageUrl) return null;
  if (/^\[?Maps of .+/i.test(title) && /--/.test(title)) return null;
  const id = (item.id || item.url || title)
    .replace(/^https?:\/\/www\.loc\.gov\/item\//, "loc-")
    .replace(/\/$/, "");
  return {
    id,
    title,
    year,
    scope: "usa",
    imageUrl,
    sourceUrl: item.url || `https://www.loc.gov/item/${id}/`,
    credit: "Library of Congress",
  };
}

async function harvestWholeUsa() {
  const byId = new Map();
  const queries = ['"map of the united states"', '"united states of america"', "carte des etats-unis"];
  for (const q of queries) {
    for (const dates of DATE_RANGES) {
      for (let page = 1; page <= 3; page++) {
        console.log(`[usa] ${q} ${dates} p${page}…`);
        try {
          const data = await fetchMaps({
            q,
            dates,
            fa: "online-format:image",
            sp: String(page),
          });
          const results = data.results || [];
          if (!results.length) break;
          for (const item of results) {
            const mapped = toMap(item);
            if (mapped) byId.set(mapped.id, mapped);
          }
          if (results.length < 40) break;
          const total = data.pagination?.total;
          const perpage = data.pagination?.perpage || 100;
          if (total != null && page * perpage >= total) break;
        } catch (err) {
          console.warn("  skip:", err.message);
          break;
        }
        await sleep(280);
      }
    }
  }
  return [...byId.values()];
}

async function main() {
  const existing = JSON.parse(readFileSync(OUT, "utf8"));
  let demoted = 0;
  const kept = existing.map((m) => {
    if (m.scope === "usa" && !isWholeUnitedStatesMap(m.title)) {
      demoted++;
      return { ...m, scope: "other" };
    }
    if (m.scope !== "usa" && isWholeUnitedStatesMap(m.title)) {
      return { ...m, scope: "usa" };
    }
    return m;
  });

  const fresh = await harvestWholeUsa();
  const byId = new Map(kept.map((m) => [m.id, m]));
  let added = 0;
  for (const m of fresh) {
    if (!byId.has(m.id)) {
      added++;
      byId.set(m.id, m);
    } else {
      byId.set(m.id, { ...byId.get(m.id), scope: "usa", title: m.title });
    }
  }

  const selected = [...byId.values()].sort((a, b) => a.year - b.year);
  writeFileSync(OUT, JSON.stringify(selected, null, 2) + "\n");

  const counts = { usa: 0, world: 0, other: 0 };
  for (const m of selected) counts[m.scope] = (counts[m.scope] || 0) + 1;
  console.log(`Demoted ${demoted} regional USA maps → other`);
  console.log(`Added ${added} whole-US maps`);
  console.log(`Wrote ${selected.length} maps → ${OUT}`);
  console.log("By scope:", counts);
  console.log(
    "USA samples:\n",
    selected
      .filter((m) => m.scope === "usa")
      .slice(0, 12)
      .map((m) => `${m.year} ${m.title.slice(0, 80)}`)
      .join("\n "),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
