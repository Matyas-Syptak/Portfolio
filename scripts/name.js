// Move the color palette through a smooth field clipped to the SVG lettering.
(() => {
  const shell = document.getElementById('hero-title-shell');
  const svg = document.getElementById('liquid-name');
  const canvas = document.getElementById('hero-shader-canvas');
  const context = canvas?.getContext('2d', { alpha: false });
  if (!shell || !svg || !context) return;

  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const { width: viewWidth, height: viewHeight } = svg.viewBox.baseVal;
  const width = 360;
  const height = 104;
  // Tune the width, strength, and fade of the local wake here.
  const radius = viewHeight * .22;
  const dragStrength = 1.08;
  const wakeLife = 1100;
  const wakeDecay = 4.8;
  const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
  const mix = (a, b, t) => a + (b - a) * t;
  const styles = getComputedStyle(shell);
  function readInk(property) {
    const hex = styles.getPropertyValue(property).trim();
    const rgb = Number.parseInt(hex.slice(1), 16);
    return [rgb >> 16, (rgb >> 8) & 255, rgb & 255].map(channel => channel / 255);
  }
  const stops = [0, .38, .70, 1].map((position, index) => [
    position, ...readInk(`--name-ink-${index + 1}`),
  ]);
  const palette = Array.from({ length: 1024 }, (_, i) => {
    const position = i / 1023;
    const index = position < .38 ? 0 : position < .70 ? 1 : 2;
    const a = stops[index];
    const b = stops[index + 1];
    const t = (position - a[0]) / (b[0] - a[0]);
    return [mix(a[1], b[1], t), mix(a[2], b[2], t), mix(a[3], b[3], t)];
  });
  const pearlInk = readInk('--name-pearl');

  canvas.width = width;
  canvas.height = height;
  const image = context.createImageData(width, height);
  const pixels = image.data;
  for (let i = 3; i < pixels.length; i += 4) pixels[i] = 255;
  const xs = Float32Array.from({ length: width }, (_, x) => (x + .5) * viewWidth / width);
  const ys = Float32Array.from({ length: height }, (_, y) => (y + .5) * viewHeight / height);
  const wakeX = new Float32Array(width * height);
  const wakeY = new Float32Array(width * height);
  const segments = [];
  let lastPoint = null;
  let lastPush = -Infinity;
  let frame = null;
  let visible = true;
  let previous = null;
  let time = 0;

  function clearWake() {
    wakeX.fill(0);
    wakeY.fill(0);
    lastPush = -Infinity;
  }

  function pushWater(from, to) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const travel = Math.hypot(dx, dy);
    if (travel < .4) return false;

    const directionX = dx / travel;
    const directionY = dy / travel;
    const strength = Math.min(travel, radius) * dragStrength;
    const left = Math.max(0, Math.floor((Math.min(from.x, to.x) - radius) * width / viewWidth));
    const right = Math.min(width - 1, Math.ceil((Math.max(from.x, to.x) + radius) * width / viewWidth));
    const top = Math.max(0, Math.floor((Math.min(from.y, to.y) - radius) * height / viewHeight));
    const bottom = Math.min(height - 1, Math.ceil((Math.max(from.y, to.y) + radius) * height / viewHeight));

    for (let y = top; y <= bottom; y++) {
      for (let x = left; x <= right; x++) {
        const relativeX = xs[x] - from.x;
        const relativeY = ys[y] - from.y;
        const along = clamp((relativeX * directionX + relativeY * directionY) / travel) * travel;
        const acrossX = relativeX - directionX * along;
        const acrossY = relativeY - directionY * along;
        const distance = (acrossX * acrossX + acrossY * acrossY) / (radius * radius);
        if (distance >= 1) continue;

        // The moving tip pulls the colors along and parts them on either side.
        const influence = (1 - distance) ** 2 * strength;
        const side = (acrossY * directionX - acrossX * directionY) / radius * .83;
        const i = y * width + x;
        wakeX[i] = clamp(wakeX[i] + influence * (directionX - directionY * side), -52, 52);
        wakeY[i] = clamp(wakeY[i] + influence * (directionY + directionX * side), -52, 52);
      }
    }
    return true;
  }

  function draw(retention = 1) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        wakeX[i] *= retention;
        wakeY[i] *= retention;
        const u = (xs[x] - wakeX[i]) / viewWidth;
        const v = 1 - (ys[y] - wakeY[i]) / viewHeight;
        const current = Math.sin(v * 6.4 + u * 5.3 + time * .22);
        const fold = Math.sin(u * 8.5 - v * 3.8 - time * .31 + current * .82);
        const phase = u * 5 + v * 2.2 - time * .34 + current * 1.08 + fold * .66;
        const gradient = .5 + .5 * Math.sin(phase);
        const color = palette[Math.round((.055 + gradient * .885) * 1023)];
        const sheen = .5 + .5 * Math.sin(phase * 1.6 + v * 3.8 + time * .20);
        const pearl = sheen ** 3 * .075;
        const brightness = mix(.88, 1.07, sheen);
        const offset = i * 4;
        for (let channel = 0; channel < 3; channel++) {
          pixels[offset + channel] = 255 * mix(color[channel] * brightness, pearlInk[channel], pearl);
        }
      }
    }
    context.putImageData(image, 0, 0);
  }

  function running() {
    return visible && !document.hidden && !motion.matches;
  }

  function render(now) {
    frame = null;
    if (!running()) return;
    const interval = now - lastPush < wakeLife ? 1000 / 60 : 1000 / 24;
    if (segments.length || previous === null || now - previous >= interval - 1) {
      const dt = previous === null ? 0 : Math.min(.08, (now - previous) / 1000);
      previous = now;
      time += dt;
      if (lastPush !== -Infinity && now - lastPush >= wakeLife) clearWake();
      for (const { from, to } of segments) {
        if (pushWater(from, to)) lastPush = now;
      }
      segments.length = 0;
      draw(Math.exp(-wakeDecay * dt));
    }
    frame = requestAnimationFrame(render);
  }

  function sync() {
    if (running()) {
      if (frame === null) frame = requestAnimationFrame(render);
      return;
    }
    if (frame !== null) cancelAnimationFrame(frame);
    frame = previous = lastPoint = null;
    segments.length = 0;
    if (lastPush !== -Infinity) {
      clearWake();
      draw();
    }
  }

  function track(event) {
    if (!running() || !event.isPrimary) return;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const point = {
      x: clamp((event.clientX - rect.left) / rect.width) * viewWidth,
      y: clamp((event.clientY - rect.top) / rect.height) * viewHeight,
    };
    // Entry and press only anchor the next move.
    if (lastPoint && event.type === 'pointermove') {
      if (segments.length === 8) segments.shift();
      segments.push({ from: lastPoint, to: point });
    }
    lastPoint = point;
  }
  shell.addEventListener('pointerenter', track, { passive: true });
  shell.addEventListener('pointermove', track, { passive: true });
  shell.addEventListener('pointerdown', track, { passive: true });
  for (const type of ['pointerleave', 'pointercancel']) {
    shell.addEventListener(type, () => { lastPoint = null; });
  }
  document.addEventListener('visibilitychange', sync);
  motion.addEventListener('change', sync);
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    sync();
  }).observe(shell);
  draw();
  shell.classList.add('name-ink-ready');
  sync();
})();
