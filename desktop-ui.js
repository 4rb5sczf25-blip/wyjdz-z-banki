/* Desktop workspace uses the same controls and handlers as mobile. No extra API calls. */
let composerAttentionShown = false;
const DESKTOP_ICONS = {
  plus:'<path d="M12 5v14M5 12h14"/>', settings:'<path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z"/><path d="m9 3-1 3-3 1-2 3 2 2v3l3 1 1 3h5l1-3 3-1 2-3-2-2V7l-3-1-1-3Z"/>',
  user:'<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>', arrow:'<path d="M5 12h14m-6-6 6 6-6 6"/>'
};
const desktopIcon = name => '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+DESKTOP_ICONS[name]+'</svg>';
function startDesktopAnalysis() {
  if (current !== 'Main') { navMode='tab';history.pushState(null,'','#Main');show('Main'); }
  const input = document.getElementById('link');
  input?.closest('section')?.scrollIntoView({block:'center',behavior:motionOK()?'smooth':'auto'});
  input?.focus({preventScroll:true});
}
function ensureDesktopShell() {
  const side = document.getElementById('side');
  if (!side || side.dataset.workspace) return;
  const links = [...side.querySelectorAll('nav a')];
  const labels = ['Przegląd','Porównaj źródła','Analiza tekstu','Strefa nauki'];
  side.innerHTML = '<a class="desktop-brand" href="Main.dc.html" aria-label="Wyjdź z bańki — Start"><span class="desktop-logo"><img src="logo.jpg" alt=""></span><span>Wyjdź z bańki<small>Więcej niż jedna perspektywa</small></span></a>'+
    '<button type="button" id="desktop-new-analysis" class="desktop-new-analysis">'+desktopIcon('plus')+'Nowa analiza</button>'+
    '<div class="desktop-nav-label">TWOJA PRZESTRZEŃ</div><nav class="desktop-navigation" aria-label="Menu na komputerze"></nav>'+
    '<div class="desktop-sidebar-bottom"><a href="Settings.dc.html" class="sd-link desktop-settings" data-route="Settings">'+desktopIcon('settings')+'Ustawienia</a>'+
    '<button type="button" id="desktop-account" class="desktop-account">'+desktopIcon('user')+'<span><strong></strong><small></small></span><span aria-hidden="true">'+desktopIcon('arrow')+'</span></button>'+
    '<div class="desktop-sidebar-meta"><button type="button" id="desktop-privacy">Prywatność</button><span id="sdVer"></span></div></div>';
  links.forEach((link,index) => {
    const icon=link.querySelector('svg');link.replaceChildren();if(icon)link.appendChild(icon);
    link.append(document.createTextNode(labels[index]));link.dataset.route=['Main','Compare','Article','Learn'][index];
    side.querySelector('nav').appendChild(link);
  });
  side.querySelector('#desktop-new-analysis').onclick=startDesktopAnalysis;
  side.querySelector('#desktop-account').onclick=openAccount;
  side.querySelector('#desktop-privacy').onclick=openPrivacy;
  side.dataset.workspace='true';
}
function syncDesktopNavigation(name = current) {
  const side=document.getElementById('side');if(!side?.dataset.workspace)return;
  const section=['Sources'].includes(name)?'Compare':['Quiz','QuizFeedback','Compendium','Achievements'].includes(name)?'Learn':['Report'].includes(name)?'Main':name;
  side.querySelectorAll('[data-route]').forEach(link=>{if(link.dataset.route===section)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');});
  const session=sbSession(),member=session&&!isGuestSession(session);
  const account=side.querySelector('#desktop-account');
  account.querySelector('strong').textContent=member?(session.displayName||'Twoje konto'):'Korzystasz jako gość';
  account.querySelector('small').textContent=member?'Konto · 5 analiz AI dziennie':'Zaloguj się i zapisz postępy';
  side.querySelector('#sdVer').textContent=APP_VERSION;
}
function desktopElement(tag, className, html) {
  const element=document.createElement(tag);element.className=className;if(html)element.innerHTML=html;return element;
}
function decorateDesktopMain(content) {
  [...content.children].forEach((element,index)=>{element.style.order=index;});
  const header=content.querySelector(':scope > header');header?.classList.add('desktop-main-header');
  const welcome=desktopElement('section','desktop-only desktop-welcome','<p class="desktop-eyebrow">CIEKAWOŚĆ ZAMIAST SKRÓTÓW MYŚLOWYCH</p><h1>Zobacz więcej niż nagłówek.</h1><p>Wklej wiadomość lub porównaj, jak różne media opisują ten sam temat.</p>');
  if(header)header.after(welcome);
  const analyzer=content.querySelector('[aria-label="Analiza własnego materiału"]');
  if(analyzer) {
    analyzer.classList.add('desktop-composer');
    analyzer.prepend(desktopElement('div','desktop-only desktop-composer-heading','<span class="desktop-section-icon" aria-hidden="true">'+desktopIcon('arrow')+'</span><div><h2>Sprawdź wiadomość</h2><p>Wklej link do artykułu lub własny tekst.</p></div>'));
    const field=analyzer.querySelector('#link'),wrap=field.parentElement;
    field.dataset.materialSession=sessionVersion();
    wrap.classList.add('desktop-input-wrap');
    const caption=desktopElement('div','desktop-input-caption');
    const label=desktopElement('label','desktop-input-label','Link lub tekst do analizy');label.htmlFor='link';
    const badge=desktopElement('span','desktop-ai-badge','<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" aria-hidden="true"><path d="m12 3 2.4 6.6L21 12l-6.6 2.4L12 21l-2.4-6.6L3 12l6.6-2.4Z"/></svg>Analiza języka z AI');
    caption.append(label,badge);wrap.before(caption);
    syncDesktopComposerHint(field);
    const stopAttention=()=>{wrap.classList.remove('is-inviting');wrap.classList.toggle('has-input',Boolean(field.value.trim()));};
    field.addEventListener('input',stopAttention);
    field.addEventListener('focus',stopAttention);
    stopAttention();
    if(!composerAttentionShown&&motionOK()&&!field.value.trim()){
      composerAttentionShown=true;wrap.classList.add('is-inviting');
      wrap.addEventListener('animationend',event=>{if(event.animationName==='composer-invite')wrap.classList.remove('is-inviting');},{once:true});
    }
    analyzer.append(desktopElement('p','desktop-only desktop-composer-note','Podgląd artykułu z linku zatwierdzisz przed analizą AI. AI może popełniać błędy.'));
  }
  const account=content.querySelector('#main-account')?.parentElement;
  const quota=content.querySelector('#analysis-quota');
  const progress=[...content.children].find(el=>el.matches('a[href="Report.dc.html"]'));
  const helper=desktopElement('aside','desktop-support');helper.setAttribute('aria-label','Konto, limit i postępy');
  helper.append(desktopElement('div','desktop-only desktop-support-heading','<h2>Konto i postępy</h2>'));
  if(account)helper.append(account);
  if(quota)helper.append(quota);
  if(progress){
    progress.classList.add('desktop-progress');helper.append(progress);
    const detail=[...progress.children].find(el=>el.style.flexGrow==='1');
    if(detail){
      detail.classList.add('desktop-progress-details');
      detail.lastElementChild?.classList.add('desktop-progress-legacy-note');
      detail.append(desktopElement('p','desktop-only desktop-progress-note','Postęp za czytanie i quizy.'));
    }
  }
  helper.append(desktopElement('div','desktop-only desktop-howto','<summary>Jak korzystać z aplikacji?</summary><ol><li><span>1</span><div><strong>Wybierz materiał</strong><p>Wklej link lub tekst wiadomości.</p></div></li><li><span>2</span><div><strong>Przyjrzyj się językowi</strong><p>Sprawdź wyjaśnienia opinii i emocji.</p></div></li><li><span>3</span><div><strong>Poszerz perspektywę</strong><p>Porównaj źródła i zajrzyj do oryginału.</p></div></li></ol></div>'));
  bindHowtoDisclosure(helper.querySelector('.desktop-howto'));
  const anchor=welcome.nextElementSibling;content.insertBefore(helper,anchor);
  const events=[...content.children].find(el=>el.matches('section')&&el.querySelector('a[href="Compare.dc.html"]'));
  if(events){
    events.classList.add('desktop-events');
    const grid=events.querySelector(':scope > div');grid?.classList.add('desktop-events-grid');
    grid?.querySelectorAll('a').forEach(card=>{card.querySelector('div:nth-child(2)>span:last-child')?.classList.add('desktop-event-status');card.append(desktopElement('span','desktop-only desktop-card-action','Porównaj perspektywy '+desktopIcon('arrow')));});
    events.querySelector('h2')?.insertAdjacentHTML('afterend','<p class="desktop-only desktop-demo-note">Wybierz temat i zobacz różne perspektywy. Materiały demonstracyjne, media fikcyjne.</p>');
  }
  [...content.children].filter(el=>el.matches('section')&&el!==events&&el.querySelector('a[href="Compare.dc.html"]')).forEach(el=>el.classList.add('desktop-saved'));
}
function decorateDesktopCompare(content) {
  const children=[...content.children];
  const map=content.querySelector('[aria-label="Mapa źródeł: nastawienie i emocjonalność języka"]');
  const hint=map?.querySelector('p');
  if(hint&&hint.textContent.includes('Dotknij')){const mobile=desktopElement('span','mobile-only');mobile.textContent=hint.textContent;hint.replaceChildren(mobile,desktopElement('span','desktop-only','Kliknij kółko, aby zobaczyć źródło.'));}
  const overview=desktopElement('div','desktop-comparison-overview'),articles=desktopElement('div','desktop-comparison-results');
  children.forEach((element,index)=>{
    element.style.order=index;
    if(element.matches('header')||index===1||index===2)return;
    if(element.id==='comparison-articles'||element.nextElementSibling?.id==='comparison-articles')articles.append(element);
    else overview.append(element);
  });
  content.append(overview,articles);
}
function decorateDesktopUI(screen,name,content) {
  ensureDesktopShell();syncDesktopNavigation(name);
  if(!content)return;
  content.classList.add('desktop-content');
  if(name==='Splash')decorateWelcome(screen,content);
  if(name==='Main')decorateDesktopMain(content);
  if(name==='Compare')decorateDesktopCompare(content);
  if(name==='Sources')content.lastElementChild?.classList.add('desktop-source-grid');
  if(name==='Article')content.querySelector('.article-header')?.classList.add('desktop-reading-header');
  content.querySelectorAll('header a[aria-label^="Wróć"]').forEach(link=>{link.classList.add('desktop-back-link');link.append(desktopElement('span','desktop-only','Wróć'));});
}

function syncDesktopComposerHint(field=document.getElementById('link')) {
  if(!field)return;
  field.dataset.originalPlaceholder ||= field.placeholder;
  field.placeholder='Wklej link lub tekst — przyjrzyjmy się tej wiadomości';
}
