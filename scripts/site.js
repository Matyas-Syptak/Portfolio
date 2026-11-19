(() => {
  const stage = document.querySelector('main');
  const fonts = document.getElementById('portfolio-fonts');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const bursts = [];
  let latestEmber = -Infinity;
  let arriving = false;
  let layersStarted = false;

  function showFonts() { fonts.media = 'all'; }
  if (fonts.sheet) showFonts();
  else fonts.addEventListener('load', showFonts, { once: true });

  // Background decoration is painted once per resize.
  function startBackdrop() {
    const canvas = stage.querySelector('#backdrop');
    const context = canvas?.getContext('2d');
    if (!context) return;
    const styles = getComputedStyle(stage);
    const starlight = styles.getPropertyValue('--starlight').trim();
    const vineInk = styles.getPropertyValue('--vine-ink').trim();
    let seed = 14;
    function random() {
      seed = seed * 16807 % 2147483647;
      return (seed - 1) / 2147483646;
    }
    const stars = starlight ? Array.from({ length: 60 }, () => ({
      x: random(), y: random(), size: .3 + random(), opacity: .16 + .32 * random(),
    })) : [];

    new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (!width || !height) return;
      const scale = Math.min(1, Math.sqrt(580_000 / (width * height)));
      canvas.width = Math.ceil(width * scale);
      canvas.height = Math.ceil(height * scale);
      context.setTransform(scale, 0, 0, scale, 0, 0);

      if (starlight) {
        context.fillStyle = starlight;
        for (const star of stars) {
          context.globalAlpha = star.opacity;
          context.beginPath();
          context.arc(star.x * width, star.y * height, star.size, 0, Math.PI * 2);
          context.fill();
        }
      } else {
        context.strokeStyle = vineInk;
        context.globalAlpha = .11;
        context.lineWidth = 1;
        for (let i = 0; i < 4; i++) {
          const x = width * (.76 + i * .077);
          context.beginPath();
          context.moveTo(x, height * 1.05);
          context.bezierCurveTo(x - 80, height * .65, x + 56, height * .35, x - 20, height * .12);
          context.stroke();
          for (let j = 0; j < 3; j++) {
            context.beginPath();
            context.ellipse(x + (j % 2 ? 18 : -18), height * (.3 + j * .22), 16 + j * 3, 42,
              -.5 + (j % 2), 0, Math.PI * 2);
            context.stroke();
          }
        }
      }
    }).observe(canvas);
  }

  function discard(burst) {
    const index = bursts.indexOf(burst);
    if (index === -1) return;
    bursts.splice(index, 1);
    for (const animation of burst.animations) animation.cancel();
    burst.element.remove();
  }

  function burstAt(clientX, clientY, className, animate) {
    if (reducedMotion.matches || document.hidden || arriving || !Element.prototype.animate) return;
    if (bursts.length === 2) discard(bursts[0]);
    const bounds = stage.getBoundingClientRect();
    const element = document.createElement('span');
    element.className = className;
    element.setAttribute('aria-hidden', 'true');
    element.style.left = (clientX - bounds.left) + 'px';
    element.style.top = (clientY - bounds.top) + 'px';
    stage.append(element);
    const animations = animate(element);
    const burst = { element, animations };
    bursts.push(burst);
    void Promise.allSettled(animations.map(animation => animation.finished)).then(() => discard(burst));
  }

  function animateEmber(element) {
    const haze = document.createElement('span');
    haze.className = 'ember-haze';
    element.append(haze);
    const sparks = Array.from({ length: 15 }, () => {
      const spark = document.createElement('span');
      spark.className = 'ember-spark';
      spark.style.setProperty('--size', (1.3 + Math.random() * 2.3) + 'px');
      element.append(spark);
      return spark;
    });
    // Sample Ember Lift's slowing trajectories into short, one-shot keyframes.
    const animations = sparks.map(spark => {
      const life = .5 + Math.random() * .47;
      const vx = (Math.random() - .5) * 80;
      const vy = -74 - Math.random() * 102;
      const frames = [0, .12, .36, .66, 1].map(offset => {
        const distance = (1 - Math.exp(-1.5 * offset * life)) / 1.5;
        const x = vx * distance;
        const y = vy * distance;
        return {
          offset,
          opacity: Math.min(offset * 9, 1 - offset),
          transform: `translate(${x}px, ${y}px) scale(${1 - .56 * offset})`,
        };
      });
      return spark.animate(frames, { duration: life * 1000 });
    });
    animations.push(haze.animate([
      { opacity: 0, transform: 'scale(.62)' },
      { opacity: .62, offset: .2 },
      { opacity: 0, transform: 'translateY(-38px) scale(1.45)' },
    ], { duration: 880 }));
    return animations;
  }

  function clearBursts() {
    while (bursts.length) discard(bursts[0]);
  }

  function startLayers() {
    if (layersStarted || arriving || document.hidden) return;
    layersStarted = true;
    startBackdrop();
    // Render the page and its seam snapshot before initializing the two canvases.
    void Promise.allSettled([import('./ink-marbling.js'), import('./name.js')]);
  }

  function queueLayers() {
    if (layersStarted || arriving || document.hidden) return;
    requestAnimationFrame(() => {
      if ('requestIdleCallback' in window) requestIdleCallback(startLayers, { timeout: 480 });
      else setTimeout(startLayers, 0);
    });
  }

  window.addEventListener('pagereveal', event => {
    if (!event.viewTransition) return;
    arriving = true;
    // A skipped native transition still leaves an ordinary, usable navigation.
    void event.viewTransition.ready.catch(() => {});
    const ready = () => {
      arriving = false;
      queueLayers();
    };
    void event.viewTransition.finished.then(ready, ready);
  });
  window.addEventListener('pageswap', clearBursts);
  window.addEventListener('pagehide', clearBursts);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) clearBursts();
    else queueLayers();
  });
  reducedMotion.addEventListener('change', clearBursts);
  stage.addEventListener('click', event => {
    const word = event.target.closest('.effect-word');
    if (word) {
      const rect = word.getBoundingClientRect();
      const x = event.detail ? event.clientX : rect.left + rect.width / 2;
      const y = event.detail ? event.clientY : rect.top + rect.height / 2;
      void import('./word-effects.js').then(({ animateWordEffect }) => {
        burstAt(x, y, 'word-burst', element => animateWordEffect(element, word));
      });
    } else if (event.detail > 0 && !event.target.closest('a, button, summary, #hero-title-shell')) {
      const now = performance.now();
      if (now - latestEmber < 140) return;
      latestEmber = now;
      burstAt(event.clientX, event.clientY, 'ember-burst', animateEmber);
    }
  }, { passive: true });
  queueLayers();
})();
