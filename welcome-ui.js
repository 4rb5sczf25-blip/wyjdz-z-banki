/* Welcome and walkthrough reuse the existing account/guest handlers and dialog stack. */
function decorateWelcome(screen,content) {
  if(!content)return;
  const actions=[...screen.children].find(el=>el!==content&&el.querySelector?.('#start-guest'));
  if(!actions)return;
  content.classList.add('welcome-layout');actions.classList.add('welcome-actions');
  const intro=document.createElement('div');intro.className='welcome-intro';
  while(content.firstChild)intro.appendChild(content.firstChild);
  intro.querySelector('div')?.classList.add('welcome-brand');
  intro.querySelector('h1').textContent='Więcej perspektyw. Mniej pochopnych ocen.';
  intro.querySelector('p').textContent='Sprawdź język wiadomości i zobacz, jak różne źródła opisują ten sam temat. Zacznij od ciekawości.';
  const eyebrow=document.createElement('span');eyebrow.className='welcome-eyebrow';eyebrow.textContent='ZATRZYMAJ SIĘ. SPRAWDŹ. PORÓWNAJ.';
  intro.querySelector('h1').before(eyebrow);
  intro.append(actions);
  const example=document.createElement('aside');example.className='welcome-example';example.setAttribute('aria-label','Przykład edukacyjny oznaczeń języka');
  example.innerHTML='<div class="welcome-paper-heading"><span>Pod lupą</span><span>Przykład edukacyjny</span></div><h2>Nie tylko co napisano.<br>Także jak.</h2><div class="welcome-sample"><span class="welcome-sample-label">Twierdzenie sprawdzalne</span><p>Za projektem zagłosowało 231 posłów.</p><span class="welcome-sample-label sample-opinion">Opinia</span><p><mark class="cue-opinion">To najlepszy możliwy wybór.</mark></p><span class="welcome-sample-label sample-emotion">Język emocjonalny</span><p><mark class="cue-emotion">To skandal!</mark></p></div><p class="welcome-paper-note">Oznaczenia pomagają przyjrzeć się językowi. Nie potwierdzają prawdziwości informacji. AI może się mylić.</p>';
  content.append(intro,example);
}
function maybeOnboard(){
  try{if(localStorage.getItem('wzb-onboarded'))return}catch(_){}
  if(current!=='Main'||stage.querySelector('.ob-back'))return;
  const steps=[
    {label:'Porównuj perspektywy',title:'Jedno wydarzenie. Różne spojrzenia.',text:'Wybierz temat, porównaj nagłówki i otwórz artykuł. Sprawdź, skąd pochodzi materiał i dlaczego trafił do zestawienia.',example:'<div class="walkthrough-sources"><span>Pierwsze źródło</span><span>Druga perspektywa</span><span>Wspólny temat</span></div>'},
    {label:'Czytaj uważniej',title:'Sprawdź, co stoi za oznaczeniem.',text:'Kliknij zaznaczony fragment lub oceniony nagłówek. Zobaczysz wskazane słowa i wyjaśnienie. Twierdzenie sprawdzalne nie oznacza potwierdzonej prawdy.',example:'<div class="walkthrough-example"><p>Projekt trafił do komisji.</p><p><mark class="cue-opinion">To najlepsze rozwiązanie.</mark></p><p><mark class="cue-emotion">To skandal!</mark></p></div>'},
    {label:'Spróbuj samodzielnie',title:'Wklej wiadomość i przyjrzyj się językowi.',text:'Możesz wkleić link albo tekst. Tekst pobrany z linku zatwierdzisz przed analizą AI. Gość ma 2 analizy AI dziennie; konto ma 5. AI może popełniać błędy.',example:'<div class="walkthrough-example walkthrough-input">Link lub tekst → oznaczenia → wyjaśnienia</div>'}
  ];
  let step=0;
  openModal('<div id="walkthrough-step"></div>',(card,close)=>{
    card.classList.add('onboarding-dialog');card.setAttribute('aria-labelledby','walkthrough-title');
    const complete=()=>{try{localStorage.setItem('wzb-onboarded','1')}catch(_){}close()};
    card.closeModal=complete;card.querySelector('.modal-dismiss').onclick=complete;
    card.parentElement.onclick=e=>{if(e.target===card.parentElement)complete()};
    const footer=document.createElement('div');footer.className='modal-footer walkthrough-actions';
    footer.innerHTML='<button type="button" class="walkthrough-back">Pomiń</button><button type="button" class="walkthrough-next">Dalej</button>';card.append(footer);
    const draw=()=>{
      const item=steps[step],body=card.querySelector('#walkthrough-step');
      body.innerHTML='<p class="walkthrough-counter" role="status">Krok '+(step+1)+' z '+steps.length+' · '+item.label+'</p><h2 id="walkthrough-title" tabindex="-1">'+item.title+'</h2><p>'+item.text+'</p>'+item.example+'<div class="walkthrough-dots" aria-hidden="true">'+steps.map((_,index)=>'<span class="'+(index===step?'active':'')+'"></span>').join('')+'</div>';
      footer.querySelector('.walkthrough-back').textContent=step?'Wstecz':'Pomiń';
      footer.querySelector('.walkthrough-next').textContent=step===steps.length-1?'Zaczynamy':'Dalej';
      applyThemeTokens(card);body.querySelector('h2').focus({preventScroll:true});
      visualAnimate(body,[{opacity:0,transform:'translateY(6px)'},{opacity:1,transform:'none'}],{duration:180,easing:'ease-out'});
    };
    footer.querySelector('.walkthrough-back').onclick=()=>{if(!step)complete();else{step--;draw()}};
    footer.querySelector('.walkthrough-next').onclick=()=>{if(step===steps.length-1)complete();else{step++;draw()}};
    draw();
  });
}
function bindHowtoDisclosure(container){
  const list=container.querySelector('ol');
  container.innerHTML='<button type="button" class="howto-toggle" aria-expanded="false" aria-controls="howto-steps"><span>Jak korzystać z aplikacji?</span><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg></button><div class="howto-reveal" id="howto-steps" aria-hidden="true" inert><div class="howto-inner"></div></div>';
  container.querySelector('.howto-inner').append(list);
  const button=container.querySelector('button'),region=container.querySelector('.howto-reveal');
  button.onclick=()=>{const expanded=button.getAttribute('aria-expanded')!=='true';button.setAttribute('aria-expanded',String(expanded));region.inert=!expanded;region.setAttribute('aria-hidden',String(!expanded));container.classList.toggle('is-open',expanded)};
}
