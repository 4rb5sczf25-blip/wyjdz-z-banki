/* Capture the standard Supabase magic-link return before the app's hash router. */
const AUTH_RETURN = (() => {
  const hash = new URLSearchParams(location.hash.slice(1));
  if (!['access_token', 'refresh_token', 'error', 'error_description'].some(key => hash.has(key))) return null;
  const result = {
    access: hash.get('access_token'), refresh: hash.get('refresh_token'),
    expires: Number(hash.get('expires_in')), failed: hash.has('error') || hash.has('error_description')
  };
  // Never leave credentials in browser history or let the router treat them as a screen.
  history.replaceState(null, '', location.pathname + location.search + '#Main');
  return result;
})();
function sbOtpPath() {
  return '/auth/v1/otp?redirect_to=' + encodeURIComponent(location.origin + location.pathname + '#Main');
}
async function finishAuthReturn() {
  if (!AUTH_RETURN) return;
  const { access, refresh, expires, failed } = AUTH_RETURN;
  // Remove transient credentials even on failed verification.
  AUTH_RETURN.access = null; AUTH_RETURN.refresh = null;
  if (failed || !access || !refresh || !Number.isFinite(expires) || expires <= 0) {
    showToast('Link do logowania jest niepoprawny lub wygasł. Poproś o nową wiadomość w Ustawieniach → Konto.');
    return;
  }
  const version = sessionVersion();
  try {
    // Verify the token with Supabase; never trust user identity from URL parameters.
    const user = await sbReq('/auth/v1/user', { token: access });
    requireSessionVersion(version);
    if (!user || typeof user.id !== 'string' || !user.id || !user.email_confirmed_at) throw new Error('invalid');
    sbStore({ at: access, rt: refresh, exp: Date.now() + Math.min(expires, 86400) * 1000, uid: user.id, email: user.email || '', anonymous: false, displayName: profileName(user.user_metadata?.display_name) });
    showToast('Zalogowano przez link z e-maila.');
    await syncNow();
    if (current === 'Settings' || current === 'Main') render(current);
  } catch (_) {
    showToast('Nie udało się potwierdzić logowania. Poproś o nową wiadomość w Ustawieniach → Konto.');
  }
}
