/* A guest is a Supabase anonymous session, created without sending any email. */
let guestRequest = null;
function isGuestSession(session = sbSession()) { return Boolean(session && session.anonymous); }
async function ensureGuestSession() {
  const existing = await sbToken();
  if (existing) return existing;
  if (sbSession()) throw new Error('Nie udało się odnowić sesji. Spróbuj ponownie lub zaloguj się.');
  if (!guestRequest) guestRequest = (async () => {
    try {
      const data = await sbReq('/auth/v1/signup', { method: 'POST', body: { data: {} } });
      if (!data?.access_token || !data.refresh_token || !data.user?.id || data.user.is_anonymous !== true) throw new Error('guest_disabled');
      sbStore(sbFromAuth(data));
      return data.access_token;
    } catch (error) {
      if (error.status === 429) throw new Error('Za dużo prób wejścia jako gość. Poczekaj chwilę. Analiza lokalna nadal działa.');
      throw new Error('Tryb gościa AI jest chwilowo niedostępny. Możesz korzystać z przykładów i analizy lokalnej.');
    } finally { guestRequest = null; }
  })();
  return guestRequest;
}
async function enterGuest(event) {
  const button = event.currentTarget;
  if (button.disabled) return;
  const restore = materialBusy(button, 'Wchodzę...');
  let notice = '';
  try { await ensureGuestSession(); } catch (error) { notice = error.message; }
  finally { restore(); }
  if (current !== 'Splash') return;
  await enterApplication(button);
  if (notice) setTimeout(() => showToast(notice), 100);
}
function startAccount() { openAccount(); }

async function enterApplication(button) {
  if (current !== 'Splash') return;
  const trigger = button?.isConnected ? button : document.getElementById('start-guest');
  if (motionOK() && typeof window.playEntryDive === 'function') {
    const entered = await window.playEntryDive(trigger);
    if (entered || current !== 'Splash') return;
  }
  if (location.hash !== '#Main') location.hash = 'Main'; else show('Main');
}
