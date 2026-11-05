/* One dialog stack: focus, Escape and inert backgrounds share the same lifetime. */
const modalStack = [];
const modalInertState = new Map();
let modalSequence = 0;
const modalFocusable = 'button:not([disabled]),a[href],input:not([disabled]),textarea:not([disabled]),select:not([disabled]),summary,[tabindex="0"]';
function modalTop() {
  for (let i=modalStack.length-1;i>=0;i--) if (!modalStack[i].back.isConnected) modalStack.splice(i,1);
  return modalStack.at(-1);
}
function syncModalInert() {
  const top = modalTop();
  if (!top) {
    for (const [element, previous] of modalInertState) if (element.isConnected) element.inert = previous;
    modalInertState.clear(); return;
  }
  for (const element of [...stage.children, document.getElementById('side'), document.getElementById('side2')].filter(Boolean)) {
    if (!modalInertState.has(element)) modalInertState.set(element, element.inert);
    element.inert = element !== top.back;
  }
  top.back.inert = false;
}
function modalTargets(card) { return [...card.querySelectorAll(modalFocusable)].filter(el => !el.closest('[inert]') && el.getClientRects().length); }
function focusModal(record) {
  const heading = record.card.querySelector('h2,h1,h3');
  if (heading) heading.tabIndex = -1;
  (heading || modalTargets(record.card)[0] || record.card).focus({ preventScroll: true });
}
function openModal(html, onMount) {
  const returnFocus = document.activeElement;
  const back = document.createElement('div'); back.className = 'ob-back modal-backdrop';
  const card = document.createElement('section'); card.className = 'ob-card app-modal'; card.tabIndex = -1;
  card.setAttribute('role', 'dialog'); card.setAttribute('aria-modal', 'true');
  card.innerHTML = '<div class="modal-topline"><span class="app-modal-handle" aria-hidden="true"></span><button type="button" class="modal-dismiss" aria-label="Zamknij okno">✕</button></div><div class="modal-body">' + html + '</div>';
  back.appendChild(card); stage.appendChild(back);
  const record = { back, card, returnFocus };
  const observer = new MutationObserver(() => applyThemeTokens(card));
  observer.observe(card, { childList:true, subtree:true });
  const close = () => {
    if (card.dataset.closed) return;
    card.dataset.closed = 'true'; card.inert = true;
    observer.disconnect();
    const index = modalStack.indexOf(record); if (index >= 0) modalStack.splice(index, 1);
    syncModalInert();
    if (modalTop()) {
      if (returnFocus?.isConnected && modalTop().card.contains(returnFocus)) returnFocus.focus({ preventScroll: true });
      else focusModal(modalTop());
    } else if (returnFocus?.isConnected && !returnFocus.closest('[inert]')) returnFocus.focus({ preventScroll: true });
    else stage.querySelector('header button,header a,nav a')?.focus({ preventScroll: true });
    closeVisualModal(back, card);
  };
  card.closeModal = close;
  card.querySelector('.modal-dismiss').onclick = close;
  back.onclick = event => { if (event.target === back && modalTop() === record) close(); };
  modalStack.push(record); syncModalInert();
  card.querySelector('[data-close]')?.addEventListener('click', close);
  try {
    if (onMount) onMount(card, close);
    const heading = card.querySelector('h2,h1,h3');
    if (!card.hasAttribute('aria-labelledby')) {
      if (heading) { heading.id ||= 'modal-title-' + ++modalSequence; card.setAttribute('aria-labelledby', heading.id); }
      else card.setAttribute('aria-label', 'Okno aplikacji');
    }
    const last = card.querySelector('.modal-body').lastElementChild;
    if (last?.matches('button[data-close]')) {
      const footer = document.createElement('div'); footer.className = 'modal-footer'; footer.appendChild(last); card.appendChild(footer);
    }
    applyThemeTokens(card);
    focusModal(record);
  } catch (error) { close(); throw error; }
  return close;
}
document.addEventListener('keydown', event => {
  const top = modalTop(); if (!top) return;
  if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); top.card.closeModal(); }
  if (event.key !== 'Tab') return;
  const targets = modalTargets(top.card), first = targets[0], last = targets.at(-1);
  if (!first) { event.preventDefault(); top.card.focus(); return; }
  if (event.shiftKey && (document.activeElement === first || !targets.includes(document.activeElement))) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && (document.activeElement === last || !targets.includes(document.activeElement))) { event.preventDefault(); first.focus(); }
}, true);
document.addEventListener('focusin', event => {
  const top = modalTop(); if (top && !top.card.contains(event.target)) focusModal(top);
});
