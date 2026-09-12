import { neon } from "@neondatabase/serverless";

export const SCOPES = new Set(["usa", "world", "any"]);
export const PERIODS = new Set(["today", "week", "all"]);
export const MAX_SCORE = 25_000;
export const NAME_MAX = 24;
export const LIMIT = 100;

export function getSql() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not configured");
  }
  return neon(url);
}

export function sanitizeName(raw) {
  if (typeof raw !== "string") return null;
  const name = raw
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, NAME_MAX);
  return name.length >= 1 ? name : null;
}

export function parseScope(value) {
  return SCOPES.has(value) ? value : null;
}

export function parsePeriod(value) {
  return PERIODS.has(value) ? value : "all";
}

export function parseScore(value) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0 || n > MAX_SCORE) return null;
  return n;
}

/** UTC start of today or ISO week (Monday). */
export function periodCutoff(period, now = new Date()) {
  if (period === "today") {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  }
  if (period === "week") {
    const day = now.getUTCDay(); // 0 Sun .. 6 Sat
    const daysFromMonday = (day + 6) % 7;
    return new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - daysFromMonday),
    );
  }
  return null;
}

export async function listScores(sql, { scope, period }) {
  const cutoff = periodCutoff(period);
  if (cutoff) {
    return sql`
      SELECT name, score, created_at
      FROM scores
      WHERE scope = ${scope}
        AND created_at >= ${cutoff.toISOString()}
      ORDER BY score DESC, created_at DESC
      LIMIT ${LIMIT}
    `;
  }
  return sql`
    SELECT name, score, created_at
    FROM scores
    WHERE scope = ${scope}
    ORDER BY score DESC, created_at DESC
    LIMIT ${LIMIT}
  `;
}

export async function insertScore(sql, { name, score, scope }) {
  const rows = await sql`
    INSERT INTO scores (name, score, scope)
    VALUES (${name}, ${score}, ${scope})
    RETURNING id
  `;
  return rows[0];
}
