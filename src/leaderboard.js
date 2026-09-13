const NAME_KEY = "mapdating.name";

/**
 * @param {"usa"|"world"|"any"} scope
 * @param {"today"|"week"|"all"} period
 */
export async function fetchLeaderboard(scope, period) {
  const params = new URLSearchParams({ scope, period });
  const res = await fetch(`/api/leaderboard?${params}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || "Could not load leaderboard");
  }
  return data;
}

/**
 * @param {{ name: string, score: number, scope: "usa"|"world"|"any" }} payload
 */
export async function submitScore(payload) {
  const res = await fetch("/api/leaderboard", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || "Could not submit score");
  }
  return data;
}

export function getSavedName() {
  try {
    return localStorage.getItem(NAME_KEY) || "";
  } catch {
    return "";
  }
}

/** @param {string} name */
export function saveName(name) {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {
    /* ignore quota / private mode */
  }
}
