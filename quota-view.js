let quotaRead = 0;
let quotaDay = '';
async function refreshAnalysisQuota() {
  const sequence = ++quotaRead;
  const update = text => { const el = document.getElementById('analysis-quota'); if (el) el.textContent = text; };
  if (!sbSession()) { update('Gość: do 2 analiz AI dziennie. Limit sprawdzimy po wejściu jako gość.'); return; }
  update('Sprawdzam pozostałe analizy AI…');
  const uid = sbSession().uid;
  try {
    const token = await sbToken();
    if (!token) throw new Error();
    const response = await fetch('/api/quota', { headers: { Authorization: 'Bearer ' + token }, signal: AbortSignal.timeout(15000), cache: 'no-store' });
    let data;
    try { data = await response.json(); } catch (_) { throw new Error('Licznik jest niedostępny w tej wersji aplikacji (HTTP ' + response.status + '). Otwórz najnowsze wdrożenie Vercel.'); }
    if (!response.ok) throw new Error(data.error || 'Nie udało się odczytać limitu (HTTP ' + response.status + ').');
    if (!response.ok || ![2, 5].includes(data.limit) || !Number.isInteger(data.remaining) || data.remaining < 0 || data.remaining > data.limit || data.day !== new Date().toISOString().slice(0, 10)) throw new Error();
    if (sequence !== quotaRead || sbSession()?.uid !== uid) return;
    quotaDay = data.day;
    update('Dziś pozostało: ' + data.remaining + ' z ' + data.limit + ' analiz AI.' + (data.remaining === 0 ? ' Limit wyczerpany — wróć jutro lub użyj analizy lokalnej.' : '') + ' Reset o północy UTC.');
  } catch (error) { if (sequence === quotaRead && sbSession()?.uid === uid) update(error.name === 'TimeoutError' ? 'Odczyt licznika trwa zbyt długo. Odśwież stronę za chwilę.' : error.message || 'Nie udało się odczytać pozostałych analiz AI. Spróbuj ponownie później.'); }
}
addEventListener('focus', () => { if (typeof current !== 'undefined' && current === 'Main') refreshAnalysisQuota(); });
setInterval(() => {
  if (typeof current !== 'undefined' && current === 'Main' && quotaDay && quotaDay !== new Date().toISOString().slice(0, 10)) refreshAnalysisQuota();
}, 60000);
