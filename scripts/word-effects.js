const tau = Math.PI * 2;
const transform = (x, y, rotation = 0, scale = 1) =>
  `translate(${x}px, ${y}px) rotate(${rotation}rad) scale(${scale})`;
const outward = (angle, distance, rotation, scale) =>
  transform(Math.cos(angle) * distance, Math.sin(angle) * distance, rotation, scale);

const effects = {
  rings: {
    count: 3, size: 13, duration: 570, stagger: 75,
    motion: ({ progress }) => transform(0, 0, 0, .5 + 5 * progress),
  },
  bloom: {
    count: 12, size: 4, duration: 640,
    motion: ({ angle, radius, ease, progress }) => outward(angle, radius * ease, 0, 1 - .6 * progress),
  },
  shards: {
    count: 11, size: 6, duration: 720,
    motion: ({ angle, radius, ease, progress, index }) =>
      transform(Math.cos(angle) * radius * ease, Math.sin(angle) * radius * ease + 42 * progress ** 2,
        angle + (index % 2 ? 5 : -5) * progress, 1 - .48 * progress),
  },
  comets: {
    count: 8, size: 5, duration: 630,
    motion: ({ angle, radius, ease, progress }) => {
      const direction = -Math.PI + angle / 2;
      return outward(direction, radius * ease * 1.25, direction, 1 - .5 * progress);
    },
  },
  stars: {
    count: 9, size: 9, duration: 690,
    motion: ({ angle, radius, ease, progress }) =>
      outward(angle, radius * ease * .8, progress, .4 + .65 * Math.sin(progress * Math.PI)),
  },
  petals: {
    count: 8, size: 8, duration: 900,
    motion: ({ angle, radius, ease, progress }) =>
      transform(Math.cos(angle) * radius * ease + 9 * Math.sin(progress * tau + angle) * progress,
        -27 * ease + 75 * progress ** 2, angle + progress * 4, 1 - .33 * progress),
  },
  pixels: {
    count: 12, size: 4, duration: 540, easing: 'steps(2, end)',
    motion: ({ angle, radius, ease }) =>
      transform(Math.round(Math.cos(angle) * radius * ease / 8) * 8,
        Math.round(Math.sin(angle) * radius * ease / 8) * 8),
  },
  orbit: {
    count: 10, size: 4, duration: 840,
    motion: ({ angle, ease, progress }) => outward(angle + progress * 4.2, 6 + 42 * ease, 0, 1 - .5 * progress),
  },
};

export function animateWordEffect(element, word) {
  const kind = word.dataset.wordEffect;
  const recipe = effects[kind];
  if (!recipe) return [];

  const rgb = getComputedStyle(word).color.match(/\d+(?:\.\d+)?/g).slice(0, 3).map(Number);
  // Reflect the channels around the middle of the range to rotate the hue 180 degrees.
  const range = Math.min(...rgb) + Math.max(...rgb);
  element.style.color = `rgb(${rgb.map(channel => range - channel).join(' ')})`;
  element.dataset.effect = kind;

  return Array.from({ length: recipe.count }, (_, index) => {
    const particle = document.createElement('span');
    particle.className = 'word-particle';
    particle.style.setProperty('--size', `${recipe.size}px`);
    element.append(particle);
    const angle = index * tau / recipe.count;
    const radius = 33 + (index * 17 % 31);
    const frames = [0, .18, .43, .72, 1].map(progress => ({
      offset: progress,
      opacity: Math.min(progress * 8, 1 - progress),
      transform: recipe.motion({ progress, ease: 1 - (1 - progress) ** 2, angle, radius, index }),
    }));
    return particle.animate(frames, {
      duration: recipe.duration,
      delay: index * (recipe.stagger ?? 0),
      easing: recipe.easing ?? 'linear',
    });
  });
}
