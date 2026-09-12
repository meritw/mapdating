/** Game state: shuffle, rounds, scoring */

export const ROUNDS = 5;
export const YEAR_MIN = 1500;
export const YEAR_MAX = 2000;
export const MAX_ROUND_SCORE = 5000;
export const PENALTY_PER_YEAR = 10;

export function shuffle(list) {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function scoreGuess(guess, actual) {
  const error = Math.abs(guess - actual);
  const points = Math.max(0, MAX_ROUND_SCORE - error * PENALTY_PER_YEAR);
  return { error, points };
}

/**
 * @param {Array<{id:string,title:string,year:number,scope?:string,imageUrl:string,sourceUrl:string,credit:string}>} maps
 * @param {"any"|"usa"|"world"} [scope]
 */
export function filterMaps(maps, scope = "any") {
  if (scope === "usa") return maps.filter((m) => m.scope === "usa");
  if (scope === "world") return maps.filter((m) => m.scope === "world");
  return maps;
}

/**
 * @param {Array<{id:string,title:string,year:number,scope?:string,imageUrl:string,sourceUrl:string,credit:string}>} maps
 * @param {"any"|"usa"|"world"} [scope]
 */
export function createSession(maps, scope = "any") {
  const pool = filterMaps(maps, scope);
  const deck = shuffle(pool).slice(0, Math.min(ROUNDS, pool.length));
  return {
    deck,
    scope,
    roundIndex: 0,
    totalScore: 0,
    phase: "playing", // playing | reveal | done
    lastResult: null,
  };
}

export function currentMap(session) {
  return session.deck[session.roundIndex] ?? null;
}

export function submitGuess(session, guess) {
  const map = currentMap(session);
  if (!map || session.phase !== "playing") return session;
  const { error, points } = scoreGuess(guess, map.year);
  return {
    ...session,
    phase: "reveal",
    totalScore: session.totalScore + points,
    lastResult: { guess, error, points, map },
  };
}

export function advance(session) {
  if (session.phase !== "reveal") return session;
  const next = session.roundIndex + 1;
  if (next >= session.deck.length) {
    return { ...session, phase: "done", roundIndex: next };
  }
  return {
    ...session,
    phase: "playing",
    roundIndex: next,
    lastResult: null,
  };
}
