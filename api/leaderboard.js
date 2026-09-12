import {
  getSql,
  sanitizeName,
  parseScope,
  parsePeriod,
  parseScore,
  listScores,
  insertScore,
} from "./lib/scores.js";

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 4096) {
      const err = new Error("Payload too large");
      err.status = 413;
      throw err;
    }
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    const err = new Error("Invalid JSON");
    err.status = 400;
    throw err;
  }
}

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const url = new URL(req.url || "/", "http://localhost");
      const scope = parseScope(url.searchParams.get("scope"));
      const period = parsePeriod(url.searchParams.get("period") || "all");
      if (!scope) {
        return sendJson(res, 400, { error: "Invalid scope" });
      }
      const sql = getSql();
      const rows = await listScores(sql, { scope, period });
      return sendJson(res, 200, {
        scope,
        period,
        scores: rows.map((row) => ({
          name: row.name,
          score: row.score,
          createdAt: row.created_at,
        })),
      });
    }

    if (req.method === "POST") {
      const body = await readJson(req);
      const name = sanitizeName(body.name);
      const score = parseScore(body.score);
      const scope = parseScope(body.scope);
      if (!name || score === null || !scope) {
        return sendJson(res, 400, { error: "Invalid name, score, or scope" });
      }
      const sql = getSql();
      const row = await insertScore(sql, { name, score, scope });
      return sendJson(res, 201, { ok: true, id: row.id });
    }

    res.setHeader("Allow", "GET, POST");
    return sendJson(res, 405, { error: "Method not allowed" });
  } catch (err) {
    const status = err.status || 500;
    const message =
      status === 500 ? "Server error" : err.message || "Request failed";
    if (status === 500) {
      console.error("[leaderboard]", err);
    }
    return sendJson(res, status, { error: message });
  }
}
