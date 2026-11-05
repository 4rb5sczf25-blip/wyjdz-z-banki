/* The actual welcome content fades into Main; no opaque loading screen or static ring. */
let activeEntry = null;
function finishEntryNow() { activeEntry?.finish(); }
window.playEntryDive = button => new Promise(resolve => {
  if(activeEntry||!motionOK()||current!=='Splash'||!button){resolve(false);return}
  const screen=stage.firstElementChild;
  const status=document.createElement('div');status.className='entry-dive-canvas';status.setAttribute('role','status');status.textContent='Otwieramy Twój przegląd…';
  const skip=document.createElement('button');skip.className='entry-skip';skip.textContent='Pomiń animację';
  stage.append(status,skip);screen.inert=true;button.disabled=true;skip.focus({preventScroll:true});
  let finished=false,timer;
  const fade=visualAnimate(screen.querySelector('.welcome-layout')||screen,[{opacity:1,transform:'none'},{opacity:.25,transform:'translateY(-8px)'}],{duration:260,easing:'ease-out',fill:'forwards'});
  const finish=()=>{
    if(finished)return;finished=true;clearTimeout(timer);fade?.cancel();
    activeEntry=null;status.remove();skip.remove();screen.inert=false;button.disabled=false;
    if(current!=='Splash'){resolve(false);return}
    navMode='tab';history.replaceState(null,'','#Main');show('Main');
    resolve(true);
  };
  activeEntry={finish};skip.onclick=finish;sfx('dive');
  if(PREFS.haptics&&navigator.vibrate)navigator.vibrate(12);
  timer=setTimeout(finish,280);
});
