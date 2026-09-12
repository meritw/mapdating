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

const app = document.querySelector("#app");

/** @type {ReturnType<typeof createSession> | null} */
let session = null;
let guessYear = 1750;
/** @type {"any"|"usa"|"world"} */
let selectedScope = "any";

const SCOPE_OPTIONS = [
  {
    id: "usa",
    label: "USA maps",
    hint: "United States only",
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
  if (!session) {
    app.append(renderStart());
    return;
  }
  if (session.phase === "done") {
    app.append(renderEnd());
    return;
  }
  app.append(renderPlay());
}

function startGame() {
  const pool = filterMaps(maps, selectedScope);
  if (pool.length < 1) return;
  session = createSession(maps, selectedScope);
  guessYear = 1750;
  render();
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
        <button type="button" class="btn btn-primary" data-action="start" ${canPlay ? "" : "disabled"}>Play</button>
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
  return root;
}

function renderEnd() {
  const root = el(`
    <div class="screen screen-end">
      <div class="start-atmosphere" aria-hidden="true"></div>
      <div class="start-content">
        <p class="eyebrow">Session complete</p>
        <h1 class="brand">Mapdating</h1>
        <p class="final-score">${session.totalScore.toLocaleString()}</p>
        <p class="tagline">points across ${session.deck.length} maps</p>
        <button type="button" class="btn btn-primary" data-action="again">Play again</button>
        <button type="button" class="btn btn-ghost" data-action="settings">Change map set</button>
      </div>
    </div>
  `);
  root.querySelector('[data-action="again"]').addEventListener("click", () => {
    startGame();
  });
  root.querySelector('[data-action="settings"]').addEventListener("click", () => {
    session = null;
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
      <div class="map-stage is-loading">
        <div class="map-loading" role="status" aria-live="polite">
          <div class="map-loading-spinner" aria-hidden="true"></div>
          <p class="map-loading-title">Unrolling the map…</p>
          <p class="map-loading-hint">Large archive images can take a moment</p>
        </div>
        <div class="map-viewport" tabindex="0" aria-label="Map. Scroll or pinch to zoom, drag to pan.">
          <img
            class="map-image"
            src="${map.imageUrl}"
            alt="Historical map to date"
            decoding="async"
            draggable="false"
          />
        </div>
        <div class="map-vignette" aria-hidden="true"></div>
        <div class="zoom-controls">
          <button type="button" class="zoom-btn" data-zoom="in" aria-label="Zoom in" disabled>+</button>
          <button type="button" class="zoom-btn" data-zoom="out" aria-label="Zoom out" disabled>−</button>
          <button type="button" class="zoom-btn zoom-btn-text" data-zoom="reset" aria-label="Reset zoom" disabled>Reset</button>
        </div>
      </div>

      <header class="chrome-top">
        <span class="brand-mini">Mapdating</span>
        <span class="round-meta">Round ${session.roundIndex + 1} / ${session.deck.length}</span>
        <span class="score-meta">${session.totalScore.toLocaleString()} pts</span>
      </header>

      <footer class="chrome-bottom">
        ${
          revealing
            ? `
          <div class="reveal-panel" role="status">
            <p class="reveal-year">${result.map.year}</p>
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
            <label class="year-readout" for="year-slider">
              <span class="year-label">Your guess</span>
              <span class="year-value" data-year>${guessYear}</span>
            </label>
            <input
              id="year-slider"
              class="year-slider"
              type="range"
              min="${YEAR_MIN}"
              max="${YEAR_MAX}"
              step="1"
              value="${guessYear}"
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

  const markLoaded = () => {
    img.classList.add("is-loaded");
    stage.classList.remove("is-loading", "is-error");
    stage.classList.add("is-ready");
    if (guessBtn) guessBtn.disabled = false;
    enableZoom();
  };

  const markError = () => {
    stage.classList.remove("is-loading");
    stage.classList.add("is-error");
    const loading = stage.querySelector(".map-loading");
    if (loading) {
      loading.innerHTML = `
        <p class="map-loading-title">Couldn’t load this map</p>
        <p class="map-loading-hint">Check your connection, then try the next round</p>
        <button type="button" class="btn btn-primary btn-compact" data-action="retry-map">Retry</button>
      `;
      loading.querySelector('[data-action="retry-map"]')?.addEventListener("click", () => {
        stage.classList.remove("is-error");
        stage.classList.add("is-loading");
        loading.innerHTML = `
          <div class="map-loading-spinner" aria-hidden="true"></div>
          <p class="map-loading-title">Unrolling the map…</p>
          <p class="map-loading-hint">Large archive images can take a moment</p>
        `;
        img.src = `${map.imageUrl}${map.imageUrl.includes("?") ? "&" : "?"}_=${Date.now()}`;
      });
    }
    if (guessBtn) guessBtn.disabled = true;
  };

  img.addEventListener("load", markLoaded);
  img.addEventListener("error", markError);
  if (img.complete && img.naturalWidth > 0) markLoaded();
  else if (img.complete) markError();

  root.querySelector('[data-zoom="in"]').addEventListener("click", () => zoom?.zoomIn());
  root.querySelector('[data-zoom="out"]').addEventListener("click", () => zoom?.zoomOut());
  root.querySelector('[data-zoom="reset"]').addEventListener("click", () => zoom?.reset());

  if (!revealing) {
    const slider = root.querySelector("#year-slider");
    const yearEl = root.querySelector("[data-year]");
    slider.addEventListener("input", () => {
      guessYear = Number(slider.value);
      yearEl.textContent = String(guessYear);
      yearEl.classList.remove("tick");
      void yearEl.offsetWidth;
      yearEl.classList.add("tick");
    });
    guessBtn.addEventListener("click", () => {
      if (guessBtn.disabled) return;
      zoom?.destroy();
      session = submitGuess(session, guessYear);
      render();
    });
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
