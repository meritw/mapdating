import "./style.css";
import maps from "./data/maps.json";
import {
  ROUNDS,
  YEAR_MIN,
  YEAR_MAX,
  createSession,
  currentMap,
  submitGuess,
  advance,
  filterMaps,
} from "./game.js";
import { attachMapZoom } from "./mapZoom.js";
import { renderFlags } from "./flags.js";
import {
  fetchLeaderboard,
  submitScore,
  getSavedName,
  saveName,
} from "./leaderboard.js";

const app = document.querySelector("#app");

/** @type {ReturnType<typeof createSession> | null} */
let session = null;
let guessYear = 1750;
/** @type {"any"|"usa"|"world"} */
let selectedScope = "any";
/** @type {"home"|"board"} */
let screen = "home";
/** @type {"usa"|"world"|"any"} */
let boardScope = "any";
/** @type {"today"|"week"|"all"} */
let boardPeriod = "all";
let scoreSubmitted = false;
let submitMessage = "";

const SCOPE_OPTIONS = [
  {
    id: "usa",
    label: "USA maps",
    hint: "The entire United States",
  },
  {
    id: "world",
    label: "World maps",
    hint: "The whole world",
  },
  {
    id: "any",
    label: "Any maps",
    hint: "Everything in the deck",
  },
];

const SCOPE_TAB_LABELS = {
  usa: "USA",
  world: "World",
  any: "Any",
};

const PERIOD_TABS = [
  { id: "today", label: "Top Today" },
  { id: "week", label: "Top This Week" },
  { id: "all", label: "Top All Time" },
];

function poolCount(scope) {
  return filterMaps(maps, scope).length;
}

function el(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

function render() {
  app.replaceChildren();
  if (session && session.phase === "done") {
    app.append(renderEnd());
    return;
  }
  if (session) {
    app.append(renderPlay());
    return;
  }
  if (screen === "board") {
    app.append(renderBoardScreen());
    return;
  }
  app.append(renderStart());
}

function startGame() {
  const pool = filterMaps(maps, selectedScope);
  if (pool.length < 1) return;
  session = createSession(maps, selectedScope);
  guessYear = 1750;
  scoreSubmitted = false;
  submitMessage = "";
  screen = "home";
  render();
}

function openBoard(scope = selectedScope) {
  boardScope = scope;
  boardPeriod = "all";
  screen = "board";
  session = null;
  render();
}

function formatWhen(iso) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return "";
  }
}

/**
 * @param {HTMLElement} host
 * @param {{
 *   scope: "usa"|"world"|"any",
 *   period: "today"|"week"|"all",
 *   onScope: (scope: "usa"|"world"|"any") => void,
 *   onPeriod: (period: "today"|"week"|"all") => void,
 * }} opts
 */
function mountBoard(host, opts) {
  const scopeTabs = ["usa", "world", "any"]
    .map(
      (id) => `
      <button type="button" class="board-tab ${opts.scope === id ? "is-active" : ""}" data-scope="${id}">
        ${SCOPE_TAB_LABELS[id]}
      </button>`,
    )
    .join("");
  const periodTabs = PERIOD_TABS.map(
    (tab) => `
      <button type="button" class="board-tab board-tab-period ${opts.period === tab.id ? "is-active" : ""}" data-period="${tab.id}">
        ${tab.label}
      </button>`,
  ).join("");

  host.replaceChildren(
    el(`
      <div class="board-panel">
        <div class="board-tabs" role="tablist" aria-label="Map set">
          ${scopeTabs}
        </div>
        <div class="board-tabs board-tabs-period" role="tablist" aria-label="Time period">
          ${periodTabs}
        </div>
        <div class="board-list" role="list" aria-live="polite">
          <p class="board-status">Loading…</p>
        </div>
      </div>
    `),
  );

  const panel = host.firstElementChild;
  const list = panel.querySelector(".board-list");
  panel.querySelectorAll("[data-scope]").forEach((btn) => {
    btn.addEventListener("click", () => {
      opts.onScope(/** @type {"usa"|"world"|"any"} */ (btn.getAttribute("data-scope")));
    });
  });
  panel.querySelectorAll("[data-period]").forEach((btn) => {
    btn.addEventListener("click", () => {
      opts.onPeriod(/** @type {"today"|"week"|"all"} */ (btn.getAttribute("data-period")));
    });
  });

  const reqScope = opts.scope;
  const reqPeriod = opts.period;
  fetchLeaderboard(reqScope, reqPeriod)
    .then((data) => {
      if (boardScope !== reqScope || boardPeriod !== reqPeriod) return;
      const scores = data.scores || [];
      if (!scores.length) {
        list.innerHTML = `<p class="board-status">No scores yet — be the first.</p>`;
        return;
      }
      list.innerHTML = scores
        .map(
          (row, i) => `
          <div class="board-row" role="listitem">
            <span class="board-rank">${i + 1}</span>
            <span class="board-name">${escapeHtml(row.name)}</span>
            <span class="board-score">${Number(row.score).toLocaleString()}</span>
            <time class="board-when" datetime="${escapeHtml(row.createdAt)}">${escapeHtml(formatWhen(row.createdAt))}</time>
          </div>`,
        )
        .join("");
    })
    .catch((err) => {
      if (boardScope !== reqScope || boardPeriod !== reqPeriod) return;
      list.innerHTML = `<p class="board-status is-error">${escapeHtml(err.message || "Could not load")}</p>`;
    });
}

function renderBoardScreen() {
  const root = el(`
    <div class="screen screen-board">
      <div class="start-atmosphere" aria-hidden="true"></div>
      <div class="board-shell">
        <p class="eyebrow">Standings</p>
        <h1 class="brand">Leaderboard</h1>
        <p class="tagline">Top 100 by map set — browse anytime.</p>
        <div class="board-host"></div>
        <button type="button" class="btn btn-ghost" data-action="back">Back</button>
      </div>
    </div>
  `);
  const host = root.querySelector(".board-host");
  const refresh = () => {
    mountBoard(host, {
      scope: boardScope,
      period: boardPeriod,
      onScope: (scope) => {
        boardScope = scope;
        refresh();
      },
      onPeriod: (period) => {
        boardPeriod = period;
        refresh();
      },
    });
  };
  refresh();
  root.querySelector('[data-action="back"]').addEventListener("click", () => {
    screen = "home";
    render();
  });
  return root;
}

function renderStart() {
  const optionsHtml = SCOPE_OPTIONS.map((opt) => {
    const count = poolCount(opt.id);
    const checked = selectedScope === opt.id ? "checked" : "";
    const disabled = count < ROUNDS ? "disabled" : "";
    return `
      <label class="scope-option ${disabled ? "is-disabled" : ""}">
        <input type="radio" name="scope" value="${opt.id}" ${checked} ${disabled} />
        <span class="scope-copy">
          <span class="scope-label">${opt.label}</span>
          <span class="scope-hint">${opt.hint} · ${count} maps</span>
        </span>
      </label>
    `;
  }).join("");

  const canPlay = poolCount(selectedScope) >= 1;

  const root = el(`
    <div class="screen screen-start">
      <div class="start-atmosphere" aria-hidden="true"></div>
      <div class="start-content">
        <p class="eyebrow">A cartographic challenge</p>
        <h1 class="brand">Mapdating</h1>
        <p class="tagline">Study the map. Guess the year. How close can you get?</p>
        <fieldset class="scope-fieldset">
          <legend class="scope-legend">Map set</legend>
          <div class="scope-list" role="radiogroup" aria-label="Map set">
            ${optionsHtml}
          </div>
        </fieldset>
        <div class="start-actions">
          <button type="button" class="btn btn-primary" data-action="start" ${canPlay ? "" : "disabled"}>Play</button>
          <button type="button" class="btn btn-ghost" data-action="leaderboard">Leaderboard</button>
        </div>
        <p class="meta">${ROUNDS} rounds</p>
      </div>
    </div>
  `);

  root.querySelectorAll('input[name="scope"]').forEach((input) => {
    input.addEventListener("change", () => {
      if (input.disabled) return;
      selectedScope = /** @type {"any"|"usa"|"world"} */ (input.value);
      render();
    });
  });

  root.querySelector('[data-action="start"]').addEventListener("click", () => {
    startGame();
  });
  root.querySelector('[data-action="leaderboard"]').addEventListener("click", () => {
    openBoard(selectedScope);
  });
  return root;
}

function renderEnd() {
  const saved = escapeHtml(getSavedName());
  const scopeLabel = SCOPE_TAB_LABELS[session.scope] || session.scope;
  boardScope = session.scope;

  const root = el(`
    <div class="screen screen-end">
      <div class="start-atmosphere" aria-hidden="true"></div>
      <div class="end-layout">
        <div class="start-content end-score-block">
          <p class="eyebrow">Session complete</p>
          <h1 class="brand">Mapdating</h1>
          <p class="final-score">${session.totalScore.toLocaleString()}</p>
          <p class="tagline">points across ${session.deck.length} maps · ${scopeLabel}</p>
          ${
            scoreSubmitted
              ? `<p class="submit-status is-ok">${escapeHtml(submitMessage || "Score submitted!")}</p>`
              : `
            <form class="name-form" data-form="score">
              <label class="name-label" for="player-name">Your name</label>
              <div class="name-row">
                <input
                  id="player-name"
                  class="name-input"
                  type="text"
                  maxlength="24"
                  autocomplete="nickname"
                  placeholder="Cartographer"
                  value="${saved}"
                  required
                />
                <button type="submit" class="btn btn-primary" data-action="submit-score">Submit score</button>
              </div>
              <p class="submit-status" data-role="status" hidden></p>
            </form>
          `
          }
          <div class="end-actions">
            <button type="button" class="btn btn-primary" data-action="again">Play again</button>
            <button type="button" class="btn btn-ghost" data-action="settings">Change map set</button>
          </div>
        </div>
        <div class="board-host end-board"></div>
      </div>
    </div>
  `);

  const host = root.querySelector(".board-host");
  const refresh = () => {
    mountBoard(host, {
      scope: boardScope,
      period: boardPeriod,
      onScope: (scope) => {
        boardScope = scope;
        refresh();
      },
      onPeriod: (period) => {
        boardPeriod = period;
        refresh();
      },
    });
  };
  refresh();

  const form = root.querySelector('[data-form="score"]');
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const input = /** @type {HTMLInputElement} */ (root.querySelector("#player-name"));
      const statusEl = root.querySelector('[data-role="status"]');
      const btn = /** @type {HTMLButtonElement} */ (root.querySelector('[data-action="submit-score"]'));
      const name = input.value.trim();
      if (!name) {
        statusEl.hidden = false;
        statusEl.textContent = "Enter a name to submit.";
        statusEl.classList.add("is-error");
        return;
      }
      btn.disabled = true;
      statusEl.hidden = false;
      statusEl.classList.remove("is-error", "is-ok");
      statusEl.textContent = "Submitting…";
      try {
        await submitScore({
          name,
          score: session.totalScore,
          scope: session.scope,
        });
        saveName(name);
        scoreSubmitted = true;
        submitMessage = "Score submitted!";
        boardScope = session.scope;
        boardPeriod = "all";
        render();
      } catch (err) {
        statusEl.classList.add("is-error");
        statusEl.textContent = err.message || "Submit failed";
        btn.disabled = false;
      }
    });
  }

  root.querySelector('[data-action="again"]').addEventListener("click", () => {
    startGame();
  });
  root.querySelector('[data-action="settings"]').addEventListener("click", () => {
    session = null;
    scoreSubmitted = false;
    submitMessage = "";
    screen = "home";
    render();
  });
  return root;
}

function renderPlay() {
  const map = currentMap(session);
  const revealing = session.phase === "reveal";
  const result = session.lastResult;

  const root = el(`
    <div class="screen screen-play ${revealing ? "is-reveal" : ""}">
      <header class="chrome-top">
        <span class="brand-mini">Mapdating</span>
        <span class="round-meta">Round ${session.roundIndex + 1} / ${session.deck.length}</span>
        <span class="score-meta">${session.totalScore.toLocaleString()} pts</span>
      </header>

      <div class="map-stage is-loading">
        <div class="map-loading" role="status" aria-live="polite">
          <div class="map-loading-spinner" aria-hidden="true"></div>
          <p class="map-loading-title">Unrolling the map…</p>
          <p class="map-loading-hint">Large archive images can take a moment</p>
        </div>
        <div class="map-viewport" tabindex="0" aria-label="Map. Scroll or pinch to zoom, drag to pan.">
          <img
            class="map-image"
            alt="Historical map to date"
            decoding="async"
            draggable="false"
            referrerpolicy="no-referrer"
          />
        </div>
        <div class="map-vignette" aria-hidden="true"></div>
        <div class="map-meta">
          ${renderFlags(map.countries || [])}
        </div>
        <div class="zoom-controls">
          <button type="button" class="zoom-btn" data-zoom="in" aria-label="Zoom in" disabled>+</button>
          <button type="button" class="zoom-btn" data-zoom="out" aria-label="Zoom out" disabled>−</button>
          <button type="button" class="zoom-btn zoom-btn-text" data-zoom="reset" aria-label="Reset zoom" disabled>Reset</button>
        </div>
      </div>

      <footer class="chrome-bottom">
        ${
          revealing
            ? `
          <div class="reveal-panel" role="status">
            <p class="reveal-year">${result.map.year}</p>
            ${renderFlags(result.map.countries || [])}
            <p class="reveal-title">${escapeHtml(result.map.title)}</p>
            <p class="reveal-stats">
              You guessed <strong>${result.guess}</strong>
              · ${result.error === 0 ? "Exact!" : `${result.error} year${result.error === 1 ? "" : "s"} off`}
              · <span class="points-pop">+${result.points.toLocaleString()}</span>
            </p>
            <a class="credit" href="${result.map.sourceUrl}" target="_blank" rel="noopener noreferrer">${escapeHtml(result.map.credit)}</a>
            <button type="button" class="btn btn-primary" data-action="next">
              ${session.roundIndex + 1 >= session.deck.length ? "See results" : "Next map"}
            </button>
          </div>
        `
            : `
          <div class="guess-panel">
            <div class="year-readout">
              <label class="year-label" for="year-input">Your guess</label>
              <input
                id="year-input"
                class="year-value year-input"
                type="number"
                inputmode="numeric"
                min="${YEAR_MIN}"
                max="${YEAR_MAX}"
                step="1"
                value="${guessYear}"
                aria-label="Guess year"
              />
            </div>
            <input
              id="year-slider"
              class="year-slider"
              type="range"
              min="${YEAR_MIN}"
              max="${YEAR_MAX}"
              step="1"
              value="${guessYear}"
              aria-label="Year slider"
            />
            <div class="slider-ends" aria-hidden="true">
              <span>${YEAR_MIN}</span>
              <span>${YEAR_MAX}</span>
            </div>
            <button type="button" class="btn btn-primary" data-action="guess" disabled>Guess</button>
          </div>
        `
        }
      </footer>
    </div>
  `);

  const stage = root.querySelector(".map-stage");
  const viewport = root.querySelector(".map-viewport");
  const img = root.querySelector(".map-image");
  const guessBtn = root.querySelector('[data-action="guess"]');
  const zoomBtns = [...root.querySelectorAll(".zoom-btn")];
  /** @type {ReturnType<typeof attachMapZoom> | null} */
  let zoom = null;

  const enableZoom = () => {
    zoomBtns.forEach((b) => {
      b.disabled = false;
    });
    if (!zoom) zoom = attachMapZoom(viewport, img);
  };

  let autoRetried = false;

  const showLoadingUi = () => {
    stage.classList.remove("is-error", "is-ready");
    stage.classList.add("is-loading");
    const loading = stage.querySelector(".map-loading");
    if (loading && !loading.querySelector(".map-loading-spinner")) {
      loading.innerHTML = `
        <div class="map-loading-spinner" aria-hidden="true"></div>
        <p class="map-loading-title">Unrolling the map…</p>
        <p class="map-loading-hint">Large archive images can take a moment</p>
      `;
    }
    if (guessBtn) guessBtn.disabled = true;
  };

  const markLoaded = () => {
    if (!img.naturalWidth) return;
    img.classList.add("is-loaded");
    stage.classList.remove("is-loading", "is-error");
    stage.classList.add("is-ready");
    if (guessBtn) guessBtn.disabled = false;
    enableZoom();
  };

  const showErrorUi = () => {
    stage.classList.remove("is-loading");
    stage.classList.add("is-error");
    const loading = stage.querySelector(".map-loading");
    if (loading) {
      loading.innerHTML = `
        <p class="map-loading-title">Couldn’t load this map</p>
        <p class="map-loading-hint">Archive images sometimes flake — try again</p>
        <button type="button" class="btn btn-primary btn-compact" data-action="retry-map">Retry</button>
      `;
      loading.querySelector('[data-action="retry-map"]')?.addEventListener("click", () => {
        autoRetried = false;
        const fallback = map.imageUrl.includes("pct:25")
          ? map.imageUrl.replace("pct:25", "pct:12.5")
          : map.imageUrl;
        loadMap(`${fallback}${fallback.includes("?") ? "&" : "?"}_=${Date.now()}`);
      });
    }
    if (guessBtn) guessBtn.disabled = true;
  };

  const loadMap = (url) => {
    showLoadingUi();
    img.classList.remove("is-loaded");
    img.referrerPolicy = "no-referrer";
    img.src = url;
    // Cached success may not fire load again
    if (img.complete && img.naturalWidth > 0) markLoaded();
  };

  img.addEventListener("load", markLoaded);
  img.addEventListener("error", () => {
    if (img.naturalWidth > 0) return;
    if (!autoRetried) {
      autoRetried = true;
      const fallback = map.imageUrl.includes("pct:25")
        ? map.imageUrl.replace("pct:25", "pct:12.5")
        : map.imageUrl;
      loadMap(`${fallback}${fallback.includes("?") ? "&" : "?"}_=${Date.now()}`);
      return;
    }
    showErrorUi();
  });
  loadMap(map.imageUrl);

  root.querySelector('[data-zoom="in"]').addEventListener("click", () => zoom?.zoomIn());
  root.querySelector('[data-zoom="out"]').addEventListener("click", () => zoom?.zoomOut());
  root.querySelector('[data-zoom="reset"]').addEventListener("click", () => zoom?.reset());

  if (!revealing) {
    const slider = root.querySelector("#year-slider");
    const yearInput = root.querySelector("#year-input");

    const clampYear = (value) => {
      const n = Number.parseInt(String(value), 10);
      if (!Number.isFinite(n)) return guessYear;
      return Math.min(YEAR_MAX, Math.max(YEAR_MIN, n));
    };

    const setYear = (value) => {
      guessYear = clampYear(value);
      slider.value = String(guessYear);
      yearInput.value = String(guessYear);
      yearInput.classList.remove("tick");
      void yearInput.offsetWidth;
      yearInput.classList.add("tick");
    };

    slider.addEventListener("input", () => {
      setYear(slider.value);
    });

    yearInput.addEventListener("input", () => {
      if (yearInput.value === "" || yearInput.value === "-") return;
      const n = Number.parseInt(yearInput.value, 10);
      if (!Number.isFinite(n)) return;
      // Live-sync slider while typing; clamp on blur/submit
      if (n >= YEAR_MIN && n <= YEAR_MAX) {
        guessYear = n;
        slider.value = String(n);
      }
    });

    yearInput.addEventListener("change", () => setYear(yearInput.value));
    yearInput.addEventListener("blur", () => setYear(yearInput.value));

    const submit = () => {
      if (guessBtn.disabled) return;
      setYear(yearInput.value || slider.value);
      zoom?.destroy();
      session = submitGuess(session, guessYear);
      render();
    };

    yearInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        submit();
      }
    });

    guessBtn.addEventListener("click", submit);
  } else {
    root.querySelector('[data-action="next"]').addEventListener("click", () => {
      zoom?.destroy();
      session = advance(session);
      guessYear = 1750;
      render();
    });
  }

  return root;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

if (!maps.length) {
  app.innerHTML = `<p class="boot-error">No maps loaded. Run <code>node scripts/fetch-maps.mjs</code> first.</p>`;
} else {
  render();
}
