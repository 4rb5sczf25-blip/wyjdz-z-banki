/* Account transport and session lifetime. No UI or progress merging here. */
const SB_URL = 'https://qvyrebelzifnwzmylgzr.supabase.co';
const SB_KEY = 'sb_publishable_MV2hjLvyEq-i-WEdYbgPhQ_A9Evz8NK';
const SB_SESSION = 'wzb-session';
let accountEpoch = 0;
let tokenRefresh = null;
const accountRequests = new Set();
function sbSession() {
  try { const s = JSON.parse(localStorage.getItem(SB_SESSION) || 'null'); return s?.at && s.rt && s.uid ? s : null; } catch (_) { return null; }
}
function sessionVersion() { return accountEpoch + ':' + (sbSession()?.uid || ''); }
function requireSessionVersion(version) {
  if (version !== sessionVersion()) { const error = new Error('Sesja zmieniła się. Spróbuj ponownie.'); error.code = 'session_changed'; throw error; }
}
function invalidateAccountRequests() {
  accountEpoch++;
  tokenRefresh = null;
  for (const controller of accountRequests) controller.abort();
  accountRequests.clear();
}
function sbStore(session) {
  const previous = sbSession();
  const changed = previous?.uid !== session?.uid || !session;
  if (changed) {
    invalidateAccountRequests();
    accountActivate(session?.uid || null);
  }
  if (session) localStorage.setItem(SB_SESSION, JSON.stringify(session));
  else localStorage.removeItem(SB_SESSION);
  if (changed && typeof onAccountSessionChange === 'function') onAccountSessionChange(previous, session);
}
async function sbReq(path, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new DOMException('Upłynął czas oczekiwania.', 'TimeoutError')), options.timeout || 15000);
  accountRequests.add(controller);
  const headers = { apikey: SB_KEY, 'Content-Type': 'application/json' };
  if (options.token) headers.Authorization = 'Bearer ' + options.token;
  if (options.prefer) headers.Prefer = options.prefer;
  try {
    const response = await fetch(SB_URL + path, { method: options.method || 'GET', headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body), signal: controller.signal, cache: 'no-store' });
    let data = null;
    try {
      const text = await response.text();
      if (text) data = JSON.parse(text);
      else if (response.ok && response.status !== 204 && !options.prefer?.includes('return=minimal')) throw new Error('empty_response');
    } catch (error) { if (controller.signal.aborted) throw controller.signal.reason; if (response.ok) throw new Error('Serwer zwrócił niepoprawną odpowiedź. Spróbuj ponownie.'); }
    if (!response.ok) {
      const error = new Error(data?.msg || data?.message || data?.error_description || data?.error || 'HTTP ' + response.status);
      error.status = response.status; error.code = data?.error_code || data?.code || ''; throw error;
    }
    return data;
  } catch (error) { if (controller.signal.aborted) throw controller.signal.reason || error; throw error; }
  finally { clearTimeout(timer); accountRequests.delete(controller); }
}
function sbFromAuth(data) {
  const user = data.user || {};
  return { at: data.access_token, rt: data.refresh_token, exp: Date.now() + (data.expires_in || 3600) * 1000,
    uid: user.id, email: user.email || '', anonymous: user.is_anonymous === true, displayName: profileName(user.user_metadata?.display_name) };
}
async function sbToken() {
  const session = sbSession();
  if (!session) return null;
  if (session.exp - 60000 > Date.now()) return session.at;
  const version = sessionVersion();
  if (tokenRefresh?.version === version) return tokenRefresh.promise;
  const pending = { version };
  const refresh = async () => {
    try {
      requireSessionVersion(version);
      const current = sbSession();
      if (current.exp - 60000 > Date.now()) return current.at;
      const data = await sbReq('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: current.rt } });
      requireSessionVersion(version);
      const refreshed = sbFromAuth(data);
      if (refreshed.uid !== session.uid || !refreshed.at || !refreshed.rt) throw new Error('Niepoprawna odpowiedź logowania.');
      sbStore({ ...session, ...refreshed });
      return refreshed.at;
    } catch (error) {
      if (version === sessionVersion() && sbSession()?.rt === session.rt && [400, 401, 403].includes(error.status)) sbStore(null);
      return null;
    }
  };
  pending.promise = (async () => {
    try { return navigator.locks ? await navigator.locks.request('wzb-refresh', refresh) : await refresh(); }
    finally { if (tokenRefresh === pending) tokenRefresh = null; }
  })();
  tokenRefresh = pending;
  return pending.promise;
}
function sbErr(error) {
  const message = String(error?.message || '').toLowerCase(), code = String(error?.code || '');
  if (error?.name === 'TimeoutError') return 'Serwer nie odpowiedział na czas. Spróbuj ponownie.';
  if (error?.name === 'AbortError') return 'Działanie przerwano po zmianie sesji. Spróbuj ponownie.';
  if (!navigator.onLine || error instanceof TypeError) return 'Brak połączenia. Sprawdź internet i spróbuj ponownie.';
  if (error.status === 429 || code.includes('rate_limit') || message.includes('rate limit') || message.includes('security purposes')) return 'Za dużo prób. Poczekaj chwilę i spróbuj ponownie.';
  if (code === 'otp_expired' || message.includes('expired') || message.includes('invalid')) return 'Kod jest niepoprawny lub wygasł. Poproś o nowy.';
  if (code.includes('email') && message.includes('valid')) return 'Podaj poprawny adres e-mail.';
  return 'Nie udało się wykonać działania. Spróbuj ponownie.';
}
async function sbFeedback(payload) {
  await sbReq('/rest/v1/feedback', { method: 'POST', prefer: 'return=minimal', body: { payload } });
}
