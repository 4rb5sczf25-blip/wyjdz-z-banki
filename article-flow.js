/* URL fetching never invokes AI. Only the preview's confirm button can do so. */
const ARTICLE_TEXT_LIMIT = 12000;
function materialText(raw) {
  const text = raw.trim();
  if (text.length < 25) throw new Error('Wklej dłuższy fragment, co najmniej 25 znaków.');
  if (text.length > ARTICLE_TEXT_LIMIT) throw new Error('Tekst może mieć najwyżej 12 000 znaków. Skróć go przed analizą.');
  return text;
}
async function materialRequest(path, body) {
  const token = await sbToken();
  if (!token) throw new Error('Zaloguj się w Ustawieniach, aby pobrać artykuł lub użyć analizy AI.');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 28000);
  try {
    const response = await fetch(path, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify(body), signal: controller.signal
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Nie udało się wykonać operacji. Spróbuj ponownie.');
    return data;
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('Przekroczono czas oczekiwania. Spróbuj ponownie lub wklej tekst ręcznie.');
    throw error;
  } finally { clearTimeout(timer); }
}
function validMaterialAnalysis(d) {
  return d && Array.isArray(d.s) && d.s.length > 0 && d.s.length <= 12 &&
    d.s.every(x => Array.isArray(x) && ['fact', 'opinion', 'emotion'].includes(x[0]) && typeof x[1] === 'string' && x[1].length > 0 && x[1].length <= 300);
}
function showMaterialAnalysis(result, text, source) {
  if (current !== 'Main') return;
  const article = {
    id: 'me', name: result.ai ? 'Analiza AI' : 'Analiza lokalna', lean: 'C',
    pct: Math.max(0, Math.min(100, Math.round(Number(result.pct) || 0))),
    head: String(result.head || result.s[0][1]).slice(0, 140),
    s: result.s, raw: text, ai: Boolean(result.ai), source: source || null
  };
  setCustomArticle(article);
  select({ ev: CUSTOM_EV, src: 'me', from: 'Main' });
  dir = 1;
  if (location.hash !== '#Article') location.hash = 'Article'; else show('Article');
}
function materialBusy(button, label) {
  const original = button.innerHTML;
  button.disabled = true;
  button.setAttribute('aria-busy', 'true');
  button.classList.add('is-loading');
  button.textContent = label;
  return () => { button.disabled = false; button.removeAttribute('aria-busy'); button.classList.remove('is-loading'); button.innerHTML = original; };
}
function previewMaterial(data) {
  const close = openModal('<h2 id="article-preview-title" style="margin-top:14px">Sprawdź pobrany tekst</h2>' +
    '<p id="article-source" style="overflow-wrap:anywhere"></p><p id="article-note"></p>' +
    '<label for="article-preview" style="font-weight:800">Treść do analizy — możesz ją poprawić</label>' +
    '<textarea id="article-preview" maxlength="12000" rows="10" style="width:100%;box-sizing:border-box;margin-top:8px;padding:12px;border-radius:14px;border:1px solid rgba(255,255,255,.28);background:rgba(255,255,255,.07);color:#E8F6F8;font:500 15px/22px Manrope,system-ui,sans-serif;resize:vertical"></textarea>' +
    '<p id="article-count" style="font-size:12px"></p><div id="article-error" role="status" aria-live="polite" style="color:#FFB0A4"></div>' +
    '<button id="article-confirm" type="button" style="'+MB+';width:100%;border:0;background:#5EE6D6;color:#04202B">Zatwierdź i analizuj AI</button>' +
    '<button id="article-cancel" type="button" style="'+MB+';width:100%;margin-top:8px;border:1px solid rgba(255,255,255,.28);background:transparent;color:#E8F6F8">Anuluj</button>', (card, dismiss) => {
      card.setAttribute('aria-labelledby', 'article-preview-title');
      const field = card.querySelector('#article-preview');
      const error = card.querySelector('#article-error');
      const confirm = card.querySelector('#article-confirm');
      card.querySelector('#article-source').textContent = data.title + '\n' + data.url;
      card.querySelector('#article-note').textContent = (data.truncated ? 'Artykuł skrócono do 12 000 znaków. ' : '') + 'Sprawdź, czy tekst zawiera właściwy artykuł. Pobranie jest bezpłatne; analiza AI korzysta z limitu Twojego konta (5 dziennie).';
      field.value = data.text;
      const count = () => { card.querySelector('#article-count').textContent = field.value.length + ' / 12 000 znaków'; };
      field.addEventListener('input', count); count();
      let cancelled = false;
      card.querySelector('#article-cancel').onclick = () => { cancelled = true; dismiss(); };
      confirm.onclick = async () => {
        if (confirm.disabled) return;
        let text;
        try { text = materialText(field.value); } catch (e) { error.textContent = e.message; field.focus(); return; }
        error.textContent = '';
        const restore = materialBusy(confirm, 'Analizuję tekst...');
        field.disabled = true;
        try {
          const result = await materialRequest('/api/analyze', { text });
          if (!validMaterialAnalysis(result)) throw new Error('Otrzymano niepoprawną analizę. Spróbuj ponownie.');
          // Closing the dialog or leaving the screen discards late responses.
          if (cancelled || card.dataset.closed || !card.isConnected || current !== 'Main') return;
          dismiss();
          showMaterialAnalysis({ ...result, ai: true }, text, data.url);
        } catch (e) { if (card.isConnected) error.textContent = e.message; }
        finally { restore(); field.disabled = false; }
      };
    });
  return close;
}
async function analyzeOwnMaterial(event, say) {
  const button = event.currentTarget;
  if (button.disabled || button.getAttribute('aria-busy') === 'true') return;
  const field = document.getElementById('link');
  const raw = (field?.value || '').trim();
  if (!raw) { say('Wklej link lub tekst do analizy.', false); field?.focus(); return; }
  const isURL = classifyInput(raw) === 'link';
  let text;
  try {
    if (!isURL) text = materialText(raw);
    else if (raw.length > 2048) throw new Error('Link jest zbyt długi (maksymalnie 2048 znaków).');
  } catch (e) { say(e.message, false); return; }
  say('', true);
  const restore = materialBusy(button, isURL ? 'Pobieram artykuł...' : 'Analizuję tekst...');
  try {
    if (isURL) {
      const url = /^https?:\/\//i.test(raw) ? raw : 'https://' + raw;
      const data = await materialRequest('/api/article', { url });
      if (!data || typeof data.text !== 'string' || data.text.length > ARTICLE_TEXT_LIMIT || data.text.length < 25) throw new Error('Nie udało się odczytać artykułu. Wklej tekst ręcznie.');
      if (current === 'Main' && button.isConnected) previewMaterial(data);
    } else {
      let result;
      try {
        result = await materialRequest('/api/analyze', { text });
        if (!validMaterialAnalysis(result)) throw new Error('Niepoprawna odpowiedź AI.');
        result.ai = true;
      } catch (error) {
        // Preserve the existing manual-text fallback and clearly identify it.
        result = analyzeText(text);
        if (current === 'Main' && button.isConnected) showToast(error.message + ' Uruchomiono analizę lokalną.');
      }
      if (button.isConnected) showMaterialAnalysis(result, text);
    }
  } catch (e) { if (current === 'Main' && button.isConnected) say(e.message + ' Możesz też wkleić tekst ręcznie.', false); }
  finally { restore(); }
}
