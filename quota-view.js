let quotaRead = 0;
let quotaNextRefresh = 0;
let quotaRequest = null;
async function refreshAnalysisQuota() {
  const sequence = ++quotaRead;
  quotaRequest?.abort();
  const controller = new AbortController();
  quotaRequest = controller;
  const update = text => { const el = document.getElementById('analysis-quota'); if (el) el.textContent = text; };
  const session = sbSession();
  const loggedOut = 'Sesja wygasła lub została zakończona. Zaloguj się ponownie albo kontynuuj jako gość.';
  if (!session) { quotaNextRefresh = 0; update('Gość: do 2 analiz AI dziennie. Limit sprawdzimy po wejściu jako gość.'); return; }
  update('Sprawdzam pozostałe analizy AI…');
  const uid = session.uid;
  let timeout;
  try {
    const token = await sbToken();
    if (sequence !== quotaRead) return;
    if (sbSession()?.uid !== uid) { if (!sbSession()) update(loggedOut); return; }
    if (!token) throw new Error('Nie udało się odnowić sesji. Sprawdź połączenie i spróbuj ponownie.');
    timeout = setTimeout(() => controller.abort(new DOMException('Timeout', 'TimeoutError')), 15000);
    const response = await fetch('/api/quota', { headers: { Authorization: 'Bearer ' + token }, signal: controller.signal, cache: 'no-store' });
    let data;
    try { data = await response.json(); } catch (_) { throw new Error('Licznik jest niedostępny w tej wersji aplikacji (HTTP ' + response.status + '). Otwórz najnowsze wdrożenie Vercel.'); }
    if (!response.ok) throw new Error(data.error || 'Nie udało się odczytać limitu (HTTP ' + response.status + ').');
    if (![2, 5].includes(data.limit) || !Number.isInteger(data.remaining) || data.remaining < 0 || data.remaining > data.limit || !/^\d{4}-\d{2}-\d{2}$/.test(data.day)) throw new Error('Nie udało się odczytać pozostałych analiz AI. Spróbuj ponownie później.');
    if (sequence !== quotaRead || sbSession()?.uid !== uid) return;
    // Use server time, never reject a valid count because the device clock is wrong.
    const untilReset = Date.parse(data.resetsAt) - Date.parse(data.serverTime);
    quotaNextRefresh = performance.now() + (Number.isFinite(untilReset) && untilReset > 0 ? Math.min(untilReset, 86400000) : 60000);
    update('Dziś pozostało: ' + data.remaining + ' z ' + data.limit + ' analiz AI.' + (data.remaining === 0 ? ' Limit wyczerpany — po resecie możesz spróbować ponownie lub użyć analizy lokalnej.' : '') + ' Reset o północy UTC.');
  } catch (error) {
    if (sequence !== quotaRead) return;
    if (!sbSession()) { update(loggedOut); return; }
    if (sbSession().uid !== uid) return;
    update(controller.signal.reason?.name === 'TimeoutError' ? 'Odczyt licznika trwa zbyt długo. Spróbuj ponownie za chwilę.' : error.message || 'Nie udało się odczytać pozostałych analiz AI. Spróbuj ponownie później.');
    quotaNextRefresh = performance.now() + 60000;
  } finally { clearTimeout(timeout); if (quotaRequest === controller) quotaRequest = null; }
}
addEventListener('focus', () => { if (typeof current !== 'undefined' && current === 'Main') refreshAnalysisQuota(); });
setInterval(() => {
  if (typeof current !== 'undefined' && current === 'Main' && quotaNextRefresh && performance.now() >= quotaNextRefresh) refreshAnalysisQuota();
}, 60000);
