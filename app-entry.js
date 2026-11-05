/* Short, skippable entry. No canvas loop, motion sensors or delayed sound queue. */
let activeEntry = null;
function finishEntryNow() { activeEntry?.finish(); }
window.playEntryDive = button => new Promise(resolve => {
  if (activeEntry || !motionOK() || current !== 'Splash' || !button) { resolve(false); return; }
  const screen = stage.firstElementChild;
  const overlay = document.createElement('div'); overlay.className = 'entry-dive-canvas'; overlay.setAttribute('aria-hidden','true');
  overlay.innerHTML = '<span>Głębiej niż nagłówek</span>';
  const skip = document.createElement('button'); skip.className = 'entry-skip'; skip.textContent = 'Pomiń animację';
  stage.append(overlay, skip); screen.inert = true; button.disabled = true; skip.focus();
  let finished = false, timer;
  const finish = () => {
    if (finished) return; finished = true; clearTimeout(timer);
    activeEntry = null; overlay.remove(); skip.remove(); screen.inert = false; button.disabled = false;
    if (current !== 'Splash') { resolve(false); return; }
    navMode = 'tab'; history.replaceState(null, '', '#Main'); show('Main');
    stage.querySelector('header button,header a')?.focus({preventScroll:true}); resolve(true);
  };
  activeEntry = { finish }; skip.onclick = finish;
  sfx('dive');
  if (PREFS.haptics && navigator.vibrate) navigator.vibrate(12);
  visualAnimate(overlay, [{opacity:0,transform:'translateY(16px)'},{opacity:1,transform:'none',offset:.3},{opacity:1,offset:.8},{opacity:0}], {duration:900,easing:'ease-out'});
  timer = setTimeout(finish, 900);
});
