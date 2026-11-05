/* Adapt existing screens to real viewport dimensions; never scale text as an image. */
let lastFittedViewportHeight=0;
function fitAppLayout() {
  const viewport = window.visualViewport;
  const width = innerWidth, height = Math.round(viewport?.height || innerHeight);
  const active=document.activeElement,editing=active?.matches('input,textarea')&&width<1000;
  const keyboard=Boolean(editing&&innerHeight-height>120);
  document.documentElement.classList.toggle('keyboard-open',keyboard);
  document.documentElement.style.setProperty('--viewport-top',Math.round(viewport?.offsetTop||0)+'px');
  document.documentElement.style.setProperty('--viewport-height', height + 'px');
  document.documentElement.classList.toggle('desk', width >= 1000);
  stage.style.transform = 'none';
  stage.style.removeProperty('left'); stage.style.removeProperty('top');
  document.getElementById('side')?.style.removeProperty('display');
  document.getElementById('side2')?.style.removeProperty('display');
  syncDesktopComposerHint();
  const changed=Math.abs(height-lastFittedViewportHeight)>8;lastFittedViewportHeight=height;
  if(keyboard&&changed)requestAnimationFrame(()=>{if(active.isConnected)(active.closest('.desktop-composer')||active).scrollIntoView({block:active.id==='link'?'start':'nearest',inline:'nearest'});});
}
function decorateLayout(root, name) {
  const screen = root.firstElementChild; if (!screen) return;
  document.documentElement.classList.toggle('is-welcome',name==='Splash');
  screen.classList.add('app-screen'); screen.dataset.screen = name;
  const content = [...screen.children].find(el => el.style.flexGrow === '1');
  if (content) content.classList.add('screen-content');
  if (name === 'Article' && content) {
    content.querySelector(':scope > header')?.classList.add('article-header');
    content.querySelector(':scope > header + div')?.classList.add('article-meta');
    content.querySelector(':scope > h2')?.classList.add('article-heading');
    content.querySelector('[aria-label="Filtr oznaczeń w tekście"]')?.classList.add('article-filters');
    content.querySelector('.analysis-unit')?.closest('section')?.classList.add('article-text');
    content.querySelector(':scope > section:last-child')?.classList.add('article-documents');
    const main = document.createElement('div'), side = document.createElement('aside');
    main.className = 'article-main-column'; side.className = 'article-side-column'; side.setAttribute('aria-label','Podsumowanie i źródło analizy');
    [...content.children].forEach((element,index) => {
      element.style.order = index;
      if (element.matches('header')) return;
      (element.matches('#emotion-summary,#source-details,[aria-label="Sposób analizy"],.analysis-title') ? side : main).appendChild(element);
    });
    content.append(main, side);
  }
  decorateDesktopUI(screen, name, content);
  applyThemeTokens(screen);
  syncModalInert();
}
addEventListener('resize', fitAppLayout);
window.visualViewport?.addEventListener('resize', fitAppLayout);
window.visualViewport?.addEventListener('scroll', fitAppLayout,{passive:true});
document.addEventListener('focusout',()=>requestAnimationFrame(fitAppLayout));

function applyThemeTokens(container) {
  const colours = { '#e8f6f8': 'var(--text)', '#a9cbd4': 'var(--muted)', '#cfe6ec': 'var(--secondary-text)', '#8fb3be': 'var(--muted)', '#7ff0e0': 'var(--accent-text)', '#ffb0a4':'var(--error-text)' };
  for (const el of [container,...container.querySelectorAll('[style]')].filter(el=>el.hasAttribute('style'))) {
    let style = el.getAttribute('style');
    for (const [colour, token] of Object.entries(colours)) style = style.replace(new RegExp(colour, 'ig'), token);
    style = style.replace(/rgba\(255,\s*255,\s*255,\s*0\.0[3578]\)/g, 'var(--surface)');
    el.setAttribute('style', style);
  }
}
