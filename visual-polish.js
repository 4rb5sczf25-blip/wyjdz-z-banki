const visualEntries = new Set();
const visualAnimations = new Set();
const revealObservers = new Set();
const pendingCards = new Set();
function visualAnimate(element, frames, options) {
  if (!motionOK() || !element?.animate) return null;
  const animation = element.animate(frames, options);
  visualAnimations.add(animation);
  const done = () => visualAnimations.delete(animation);
  animation.finished.then(done, done);
  return animation;
}
function clearCardReveals() {
  revealObservers.forEach(observer => observer.disconnect()); revealObservers.clear();
  pendingCards.forEach(card => card.classList.remove('reveal-pending')); pendingCards.clear();
}
function stopVisualMotion() {
  clearCardReveals();
  visualAnimations.forEach(animation => animation.cancel()); visualAnimations.clear();
}
function captureVisualState(root) {
  return { selected: root.querySelector('.map-point[aria-pressed="true"]')?.getAttribute('aria-label') };
}
function decorateVisuals(root, name, previous = {}) {
  clearCardReveals();
  const screen = root.firstElementChild;
  if (!screen) return;
  screen.classList.add('app-screen'); screen.dataset.screen = name;
  screen.querySelectorAll('[data-card],a[href="Compare.dc.html"],a[href="Article.dc.html"]').forEach(card => {
    if (!card.closest('nav,header') && card.querySelector('div')) card.classList.add('story-card');
  });
  screen.querySelector('[aria-label="Sposób analizy"]')?.classList.add('analysis-method-note');
  screen.querySelectorAll('.src-dot').forEach(dot => dot.parentElement.classList.add('map-point'));
  const selected = screen.querySelector('.map-point[aria-pressed="true"]');
  if (selected && previous.selected !== selected.getAttribute('aria-label')) {
    visualAnimate(selected, [{ filter: 'brightness(1.25)' }, { filter: 'brightness(1)' }], { duration: 350 });
  }
}
function playVisualEntry(name) {
  clearCardReveals();
  if (!motionOK()) return;
  const screen = stage.firstElementChild;
  const article = name === 'Article' ? curArticle() : null;
  const context = ['Compare', 'Sources', 'Article'].includes(name) ? SEL.ev : '';
  const key = name + ':' + context + ':' + (article ? article.uid || article.id : '');
  if (visualEntries.has(key)) return;
  visualEntries.add(key);
  const cards = [...screen.querySelectorAll('.story-card')];
  const scroller = screen.querySelector('.compare-scroll,.article-scroll') || cards[0]?.parentElement;
  if (cards.length && typeof IntersectionObserver !== 'undefined') {
    let sequence = 0;
    const observer = new IntersectionObserver(entries => {
      entries.filter(entry => entry.isIntersecting).forEach(({ target }) => {
        target.classList.remove('reveal-pending'); pendingCards.delete(target); observer.unobserve(target);
        visualAnimate(target, [{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'translateY(0)' }], {
          duration: 360, delay: Math.min(sequence++, 4) * 55, easing: 'cubic-bezier(.22,.8,.24,1)', fill: 'backwards'
        });
      });
    }, { root: scroller, threshold: .08 });
    revealObservers.add(observer);
    cards.forEach(card => { card.classList.add('reveal-pending'); pendingCards.add(card); observer.observe(card); });
  }
  screen.querySelectorAll('.map-point').forEach((point, index) => {
    visualAnimate(point, [{ opacity: 0, transform: 'translateY(18px) scale(.85)' }, { opacity: 1, transform: 'translateY(0) scale(1)' }], {
      duration: 420, delay: index * 55, easing: 'cubic-bezier(.22,.8,.24,1)', fill: 'backwards'
    });
  });
  const distribution = screen.querySelector('.result-distribution');
  if (distribution) visualAnimate(distribution, [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], {
    duration: 520, delay: 100, easing: 'cubic-bezier(.22,.8,.24,1)', fill: 'backwards'
  });
}
function closeVisualModal(back, card) {
  back.style.pointerEvents = 'none';
  if (!motionOK() || !back.animate) { back.remove(); return; }
  const style = getComputedStyle(card);
  visualAnimate(card, [{ opacity: style.opacity, transform: style.transform }, { opacity: 0, transform: 'translateY(24px)' }], {
    duration: 200, easing: 'cubic-bezier(.4,0,.6,1)', fill: 'forwards'
  });
  const fade = visualAnimate(back, [{ opacity: getComputedStyle(back).opacity }, { opacity: 0 }], { duration: 200, fill: 'forwards' });
  if (fade) fade.finished.then(() => back.remove(), () => back.remove()); else back.remove();
}
matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', () => {
  if (!motionOK()) stopVisualMotion();
});
