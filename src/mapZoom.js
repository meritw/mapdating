const MIN_SCALE = 1;
const MAX_SCALE = 8;
const ZOOM_STEP = 1.25;

/**
 * Attach pan/zoom to a map viewport + image.
 * @param {HTMLElement} viewport
 * @param {HTMLImageElement} img
 * @returns {{ reset: () => void, destroy: () => void }}
 */
export function attachMapZoom(viewport, img) {
  let scale = 1;
  let x = 0;
  let y = 0;
  let pointers = new Map();
  let lastPinchDist = 0;
  let dragging = false;
  let moved = false;

  const apply = () => {
    clampPan();
    img.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
    viewport.classList.toggle("is-zoomed", scale > 1.01);
    viewport.style.cursor = scale > 1.01 ? (dragging ? "grabbing" : "grab") : "zoom-in";
  };

  const clampPan = () => {
    if (scale <= 1) {
      x = 0;
      y = 0;
      return;
    }
    const rect = viewport.getBoundingClientRect();
    const maxX = ((scale - 1) * rect.width) / 2;
    const maxY = ((scale - 1) * rect.height) / 2;
    x = Math.min(maxX, Math.max(-maxX, x));
    y = Math.min(maxY, Math.max(-maxY, y));
  };

  const zoomAt = (clientX, clientY, nextScale) => {
    const rect = viewport.getBoundingClientRect();
    const cx = clientX - rect.left - rect.width / 2;
    const cy = clientY - rect.top - rect.height / 2;
    const prev = scale;
    scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, nextScale));
    if (scale === prev) return;
    const ratio = scale / prev;
    x = cx - (cx - x) * ratio;
    y = cy - (cy - y) * ratio;
    apply();
  };

  const onWheel = (e) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    zoomAt(e.clientX, e.clientY, scale * factor);
  };

  const onPointerDown = (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    viewport.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    moved = false;
    if (pointers.size === 1) {
      dragging = scale > 1;
      apply();
    } else if (pointers.size === 2) {
      dragging = false;
      const [a, b] = [...pointers.values()];
      lastPinchDist = Math.hypot(a.x - b.x, a.y - b.y);
    }
  };

  const onPointerMove = (e) => {
    if (!pointers.has(e.pointerId)) return;
    const prev = pointers.get(e.pointerId);
    const next = { x: e.clientX, y: e.clientY };
    pointers.set(e.pointerId, next);

    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (lastPinchDist > 0) {
        const midX = (a.x + b.x) / 2;
        const midY = (a.y + b.y) / 2;
        zoomAt(midX, midY, scale * (dist / lastPinchDist));
      }
      lastPinchDist = dist;
      moved = true;
      return;
    }

    if (pointers.size === 1 && scale > 1) {
      const dx = next.x - prev.x;
      const dy = next.y - prev.y;
      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) moved = true;
      x += dx;
      y += dy;
      apply();
    }
  };

  const endPointer = (e) => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) lastPinchDist = 0;
    if (pointers.size === 0) {
      dragging = false;
      apply();
    }
  };

  const onDblClick = (e) => {
    e.preventDefault();
    if (scale > 1.05) {
      scale = 1;
      x = 0;
      y = 0;
      apply();
    } else {
      zoomAt(e.clientX, e.clientY, 2.5);
    }
  };

  const zoomByButton = (factor) => {
    const rect = viewport.getBoundingClientRect();
    zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, scale * factor);
  };

  const reset = () => {
    scale = 1;
    x = 0;
    y = 0;
    apply();
  };

  viewport.addEventListener("wheel", onWheel, { passive: false });
  viewport.addEventListener("pointerdown", onPointerDown);
  viewport.addEventListener("pointermove", onPointerMove);
  viewport.addEventListener("pointerup", endPointer);
  viewport.addEventListener("pointercancel", endPointer);
  viewport.addEventListener("pointerleave", endPointer);
  viewport.addEventListener("dblclick", onDblClick);

  apply();

  return {
    reset,
    zoomIn: () => zoomByButton(ZOOM_STEP),
    zoomOut: () => zoomByButton(1 / ZOOM_STEP),
    destroy() {
      viewport.removeEventListener("wheel", onWheel);
      viewport.removeEventListener("pointerdown", onPointerDown);
      viewport.removeEventListener("pointermove", onPointerMove);
      viewport.removeEventListener("pointerup", endPointer);
      viewport.removeEventListener("pointercancel", endPointer);
      viewport.removeEventListener("pointerleave", endPointer);
      viewport.removeEventListener("dblclick", onDblClick);
    },
  };
}
