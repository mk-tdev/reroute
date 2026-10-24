/* Camera coordinates share the SVG's world space. Gestures never mutate route geometry. */
const islandCamera = (() => {
  const svg = document.querySelector("#island");
  const map = document.querySelector("#map");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const points = new Map();
  let x = 400,
    y = 435,
    zoom = 1,
    targetX = x,
    targetY = y,
    targetZoom = zoom;
  let baseW = 600,
    baseH = 570,
    frame = 0,
    lastTime = 0,
    gesture = null,
    moved = false,
    suppressUntil = 0,
    following = true;
  let actor = { x: 400, y: 568 };
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  function limits() {
    // Keep some land in view even at the furthest edge.
    targetX = clamp(targetX, 150, 650);
    targetY = clamp(targetY, 210, 650);
    targetZoom = clamp(targetZoom, 1, 2.8);
  }
  function paint() {
    const w = baseW / zoom,
      h = baseH / zoom;
    svg.setAttribute("viewBox", `${x - w / 2} ${y - h / 2} ${w} ${h}`);
    map.dataset.zoom = zoom.toFixed(2);
    document.querySelector("#camera-follow").setAttribute("aria-pressed", String(following));
    document
      .querySelector("#camera-follow")
      .setAttribute("aria-label", following ? "Camera following your character" : "Follow your character");
    document.querySelector("#camera-out").disabled = targetZoom <= 1.001;
    document.querySelector("#camera-in").disabled = targetZoom >= 2.799;
  }
  function step(time) {
    const dt = Math.min(50, lastTime ? time - lastTime : 16);
    lastTime = time;
    const a = 1 - Math.exp(-dt / 150);
    x += (targetX - x) * a;
    y += (targetY - y) * a;
    zoom += (targetZoom - zoom) * a;
    paint();
    if (Math.abs(x - targetX) + Math.abs(y - targetY) + Math.abs(zoom - targetZoom) > 0.02)
      frame = requestAnimationFrame(step);
    else {
      x = targetX;
      y = targetY;
      zoom = targetZoom;
      paint();
      frame = 0;
      lastTime = 0;
    }
  }
  function update(immediate = false) {
    limits();
    if (immediate || reduced.matches) {
      cancelAnimationFrame(frame);
      frame = 0;
      lastTime = 0;
      x = targetX;
      y = targetY;
      zoom = targetZoom;
      paint();
    } else if (!frame) frame = requestAnimationFrame(step);
  }
  function resize() {
    const r = svg.getBoundingClientRect();
    if (!r.width || !r.height) return;
    baseW = Math.max(600, (570 * r.width) / r.height);
    baseH = (baseW * r.height) / r.width;
    update(true);
  }
  function world(clientX, clientY) {
    const r = svg.getBoundingClientRect();
    return {
      x: x + ((clientX - r.left - r.width / 2) * baseW) / zoom / r.width,
      y: y + ((clientY - r.top - r.height / 2) * baseH) / zoom / r.height,
    };
  }
  function userControl() {
    following = false;
    map.classList.add("exploring");
  }
  function baseline() {
    const p = [...points.values()];
    if (!p.length) {
      gesture = null;
      return;
    }
    const mid = p.length > 1 ? { x: (p[0].x + p[1].x) / 2, y: (p[0].y + p[1].y) / 2 } : p[0];
    gesture = {
      mid,
      anchor: world(mid.x, mid.y),
      distance: p.length > 1 ? Math.hypot(p[1].x - p[0].x, p[1].y - p[0].y) : 0,
      zoom,
    };
  }
  svg.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || document.querySelector("#sheet").open) return;
    points.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (points.size === 1) moved = false;
    if (points.size > 1) {
      moved = true;
      userControl();
    }
    baseline();
  });
  // Listen on window so a drag that starts on a route can leave the SVG safely.
  window.addEventListener(
    "pointermove",
    (e) => {
      if (!points.has(e.pointerId) || !gesture) return;
      points.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const p = [...points.values()];
      const mid = p.length > 1 ? { x: (p[0].x + p[1].x) / 2, y: (p[0].y + p[1].y) / 2 } : p[0];
      if (!moved && Math.hypot(mid.x - gesture.mid.x, mid.y - gesture.mid.y) < 7) return;
      moved = true;
      userControl();
      e.preventDefault();
      const r = svg.getBoundingClientRect();
      targetZoom =
        p.length > 1
          ? clamp(
              (gesture.zoom * Math.hypot(p[1].x - p[0].x, p[1].y - p[0].y)) / Math.max(1, gesture.distance),
              1,
              2.8,
            )
          : zoom;
      targetX = gesture.anchor.x - ((mid.x - r.left - r.width / 2) * baseW) / targetZoom / r.width;
      targetY = gesture.anchor.y - ((mid.y - r.top - r.height / 2) * baseH) / targetZoom / r.height;
      map.classList.add("dragging");
      update(true);
    },
    { passive: false },
  );
  function release(e) {
    if (!points.has(e.pointerId)) return;
    points.delete(e.pointerId);
    if (moved) suppressUntil = performance.now() + 400;
    baseline();
    if (!points.size) map.classList.remove("dragging");
  }
  window.addEventListener("pointerup", release);
  window.addEventListener("pointercancel", release);
  window.addEventListener("blur", () => {
    points.clear();
    gesture = null;
    map.classList.remove("dragging");
  });
  svg.addEventListener(
    "click",
    (e) => {
      if (performance.now() < suppressUntil) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    },
    true,
  );
  function zoomAt(value, cx, cy) {
    const r = svg.getBoundingClientRect();
    cx ??= r.left + r.width / 2;
    cy ??= r.top + r.height / 2;
    const anchor = world(cx, cy);
    userControl();
    targetZoom = clamp(value, 1, 2.8);
    targetX = anchor.x - ((cx - r.left - r.width / 2) * baseW) / targetZoom / r.width;
    targetY = anchor.y - ((cy - r.top - r.height / 2) * baseH) / targetZoom / r.height;
    update();
  }
  svg.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      zoomAt(targetZoom * Math.exp(-e.deltaY * 0.002), e.clientX, e.clientY);
    },
    { passive: false },
  );
  function follow() {
    following = true;
    map.classList.remove("exploring");
    targetZoom = Math.max(targetZoom, 1.45);
    targetX = actor.x;
    targetY = actor.y - 55;
    update();
  }
  function reset() {
    following = true;
    map.classList.remove("exploring");
    targetX = 400;
    targetY = 435;
    targetZoom = 1;
    update();
  }
  function track(point) {
    actor = point;
    if (following && !points.size) {
      targetX = point.x;
      targetY = point.y - 55;
      update();
    }
  }
  document.querySelector("#camera-in").onclick = () => zoomAt(targetZoom * 1.25);
  document.querySelector("#camera-out").onclick = () => zoomAt(targetZoom / 1.25);
  document.querySelector("#camera-home").onclick = reset;
  document.querySelector("#camera-follow").onclick = follow;
  svg.addEventListener("keydown", (e) => {
    if (e.target !== svg) return;
    const keys = { ArrowLeft: [-45, 0], ArrowRight: [45, 0], ArrowUp: [0, -45], ArrowDown: [0, 45] };
    if (keys[e.key]) {
      e.preventDefault();
      userControl();
      targetX += keys[e.key][0] / zoom;
      targetY += keys[e.key][1] / zoom;
      update();
    } else if (e.key === "+" || e.key === "=") {
      e.preventDefault();
      zoomAt(targetZoom * 1.25);
    } else if (e.key === "-") {
      e.preventDefault();
      zoomAt(targetZoom / 1.25);
    } else if (e.key.toLowerCase() === "r") {
      reset();
    }
  });
  reduced.addEventListener("change", () => update(true));
  new ResizeObserver(resize).observe(svg);
  resize();
  function reveal(index) {
    const locations = [
      { x: 235, y: 380 },
      { x: 565, y: 410 },
      { x: 400, y: 260 },
    ];
    const place = locations[index];
    if (!place) return;
    targetX = place.x;
    targetY = place.y;
    targetZoom = 1.3;
    update();
  }
  return { track, follow, reset, reveal };
})();
