// The catalog's Ink Marbling field, with a bounded canvas and site palettes.
(() => {
  const surface = document.querySelector('.hero');
  const canvas = surface?.querySelector('.ink-marbling');
  const context = canvas?.getContext('2d', { alpha: false });
  if (!context) return;

  const styles = getComputedStyle(surface);
  const colors = ['--pigment-dark', '--pigment-mid', '--pigment-light'].map(property => {
    const value = Number.parseInt(styles.getPropertyValue(property).trim().slice(1), 16);
    return [value >> 16, (value >> 8) & 255, value & 255];
  });
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const tau = Math.PI * 2;
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const mix = (a, b, t) => a + (b - a) * t;
  const pointer = { x: 0, y: 0, clientX: 0, clientY: 0, inside: false, pending: false };
  const lut = Array.from({ length: 256 }, (_, i) => {
    const t = i / 255 * 2;
    const stop = Math.min(1, Math.floor(t));
    return colors[stop].map((value, c) => mix(value, colors[stop + 1][c], t - stop));
  });

  let width, height, ink, next, seed, pixels, baseFlow, horizontal, vertical, drift;
  let time = 0;
  let spin = 0;
  let frame = null;
  let previous = null;
  let visible = true;

  function sample(x, y) {
    x = clamp(x, 0, width - 1.001);
    y = clamp(y, 0, height - 1.001);
    const ix = x | 0;
    const iy = y | 0;
    const offset = iy * width + ix;
    return mix(mix(ink[offset], ink[offset + 1], x - ix),
      mix(ink[offset + width], ink[offset + width + 1], x - ix), y - iy);
  }

  function initialize() {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const aspect = rect.width / rect.height;
    const columns = clamp(Math.round(Math.sqrt(15_000 * aspect)), 45, 210);
    const rows = clamp(Math.round(15_000 / columns), 52, 245);
    if (columns === width && rows === height) return;
    width = columns;
    height = rows;
    canvas.width = width;
    canvas.height = height;
    const count = width * height;
    seed = new Float32Array(count);
    next = new Float32Array(count);
    baseFlow = new Float32Array(count);
    pixels = context.createImageData(width, height);
    horizontal = new Float32Array(height);
    vertical = new Float32Array(width);
    drift = Float32Array.from({ length: height }, (_, y) => -3 * Math.cos(y / height * tau));
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        const nx = x / width;
        const ny = y / height;
        seed[i] = .5 + .48 * Math.sin(ny * 12 + nx * 5 + Math.sin(nx * 6.6 - ny * 2) * 5.8 + Math.cos(ny * 2.5 + nx * 3.4) * 3.4);
        baseFlow[i] = 4 * Math.cos(nx * tau + ny * 4);
        pixels.data[i * 4 + 3] = 255;
      }
    }
    ink = seed.slice();
    draw();
    canvas.classList.add('is-ready');
  }

  function advect(dt) {
    time += dt;
    spin *= Math.exp(-1.45 * dt);
    const px = pointer.x * width;
    const py = pointer.y * height;
    for (let y = 0; y < height; y++) horizontal[y] = 6 * Math.sin(y / height * tau + time * .13);
    for (let x = 0; x < width; x++) vertical[x] = 6 * Math.sin(x / width * tau - time * .17);
    for (let y = 0; y < height; y++) {
      const dy = y - py;
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        const dx = x - px;
        const vortex = pointer.inside ? spin / (dx * dx + dy * dy + 70) : 0;
        const vx = horizontal[y] + baseFlow[i] - dy * vortex;
        const vy = vertical[x] + drift[y] + dx * vortex;
        // Feed in a little fresh pigment to keep the field from diffusing away.
        next[i] = mix(sample(x - vx * dt, y - vy * dt), seed[i], dt * .028);
      }
    }
    const old = ink;
    ink = next;
    next = old;
  }

  function draw() {
    for (let i = 0; i < ink.length; i++) {
      const rgb = lut[clamp(Math.round(ink[i] * 255), 0, 255)];
      const j = i * 4;
      pixels.data[j] = rgb[0];
      pixels.data[j + 1] = rgb[1];
      pixels.data[j + 2] = rgb[2];
    }
    context.putImageData(pixels, 0, 0);
  }

  function active() {
    return visible && !document.hidden && !reducedMotion.matches;
  }

  function tick(now) {
    frame = null;
    if (!active() || !ink) return;
    const interval = 1000 / (pointer.pending || (pointer.inside && spin > 5) ? 30 : 18);
    if (previous === null || now - previous >= interval - 1) {
      if (pointer.pending) updatePointer();
      advect(previous === null ? 0 : Math.min((now - previous) / 1000, .085));
      draw();
      previous = now;
    }
    frame = requestAnimationFrame(tick);
  }

  function sync() {
    if (active()) {
      if (frame === null) frame = requestAnimationFrame(tick);
    } else {
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
      previous = null;
    }
  }

  function updatePointer() {
    pointer.pending = false;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const x = clamp((pointer.clientX - rect.left) / rect.width, 0, 1);
    const y = clamp((pointer.clientY - rect.top) / rect.height, 0, 1);
    if (pointer.inside) spin = Math.min(340, spin + Math.hypot(x - pointer.x, y - pointer.y) * 1050);
    pointer.x = x;
    pointer.y = y;
    pointer.inside = true;
  }

  function clearPointer() {
    pointer.inside = false;
    pointer.pending = false;
  }

  function move(event) {
    if (!active() || event.target.closest('.page-link')) {
      clearPointer();
      return;
    }
    pointer.clientX = event.clientX;
    pointer.clientY = event.clientY;
    pointer.pending = true;
  }

  surface.addEventListener('pointermove', move, { passive: true });
  surface.addEventListener('pointerdown', (event) => {
    if (event.target.closest('#hero-title-shell')) return;
    move(event);
    if (pointer.pending) spin = Math.min(340, spin + 145);
  }, { passive: true });
  for (const event of ['pointerleave', 'pointercancel']) {
    surface.addEventListener(event, clearPointer);
  }

  new ResizeObserver(() => {
    initialize();
    sync();
  }).observe(surface);
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    sync();
  }).observe(surface);
  document.addEventListener('visibilitychange', sync);
  reducedMotion.addEventListener('change', sync);
  initialize();
  sync();
})();
