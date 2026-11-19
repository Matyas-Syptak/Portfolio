(() => {
  const tablist = document.querySelector('.game-tabs');
  const tabs = [...tablist.querySelectorAll('[role="tab"]')];
  const panels = new Map(tabs.map(tab => [tab, document.getElementById(tab.getAttribute('aria-controls'))]));
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let active = tabs.find(tab => tab.getAttribute('aria-selected') === 'true');
  let animations = [];

  function focusTab(tab) {
    for (const item of tabs) item.tabIndex = item === tab ? 0 : -1;
    tab.focus({ preventScroll: true });
  }

  function labelCenter(tab) {
    const rect = tab.firstElementChild.getBoundingClientRect();
    return rect.left + rect.width / 2;
  }

  function select(tab) {
    if (tab === active) {
      focusTab(tab);
      return;
    }
    const previous = active;
    const fromLeft = tab === tablist.firstElementChild;
    const canAnimate = !reducedMotion.matches && Element.prototype.animate;
    const start = canAnimate ? new Map(tabs.map(item => [item, labelCenter(item)])) : null;
    for (const animation of animations) animation.cancel();
    animations = [];

    active = tab;
    previous.setAttribute('aria-selected', 'false');
    tab.setAttribute('aria-selected', 'true');
    // Swap the selected category with the middle one. DOM order follows the display.
    if (fromLeft) tablist.insertBefore(previous, tab);
    else tablist.insertBefore(tab, previous);
    const oldPanel = panels.get(previous);
    oldPanel.hidden = true;
    for (const player of oldPanel.querySelectorAll('.web-game[open]')) player.open = false;
    const panel = panels.get(tab);
    panel.hidden = false;
    focusTab(tab);

    if (start) {
      const options = { duration: 320, easing: 'cubic-bezier(.22,.75,.24,1)' };
      for (const item of [previous, tab]) {
        const delta = start.get(item) - labelCenter(item);
        const lift = item === tab ? -12 : 12;
        animations.push(item.firstElementChild.animate([
          { transform: `translateX(${delta}px)` },
          { transform: `translate(${delta * .46}px, ${lift}px)`, offset: .5 },
          { transform: 'translateX(0)' },
        ], options));
      }
      animations.push(panel.animate([
        { opacity: 0, transform: 'translateY(5px)' },
        { opacity: 1, transform: 'translateY(0)' },
      ], options));
    }
  }

  tablist.addEventListener('click', event => {
    const tab = event.target.closest('[role="tab"]');
    if (tab) select(tab);
  });
  tablist.addEventListener('keydown', event => {
    const order = [...tablist.children];
    const current = order.indexOf(event.target);
    if (current < 0) return;
    const last = order.length - 1;
    const target = { ArrowLeft: (current + last) % order.length, ArrowRight: (current + 1) % order.length, Home: 0, End: last }[event.key];
    if (target === undefined) return;
    event.preventDefault();
    focusTab(order[target]);
  });
  tablist.addEventListener('focusout', event => {
    if (!tablist.contains(event.relatedTarget)) {
      for (const tab of tabs) tab.tabIndex = tab === active ? 0 : -1;
    }
  });

  for (const player of document.querySelectorAll('.web-game')) {
    const link = player.querySelector('a');
    const title = player.closest('article').querySelector('h3').textContent;
    player.addEventListener('toggle', () => {
      const existing = player.querySelector('iframe');
      if (!player.open) {
        existing?.remove();
      } else if (!existing) {
        const frame = document.createElement('iframe');
        frame.title = title;
        frame.setAttribute('sandbox', 'allow-scripts');
        frame.src = link.href;
        player.insertBefore(frame, link);
      }
    });
  }
})();
