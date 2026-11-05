import { HttpError } from './policy.js';

// All budget decisions live in Postgres, never in instance-local memory.
export async function authorize(req, kind, { fetcher = fetch, env = process.env } = {}) {
  const token = /^Bearer ([A-Za-z0-9._-]+)$/.exec(req.headers.authorization || '')?.[1];
  if (!token || token.length > 8192) throw new HttpError(401, 'Zaloguj się, aby pobrać artykuł lub użyć analizy AI.');
  const base = env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key || !/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(base)) {
    throw new HttpError(503, 'Analiza AI i pobieranie linków nie są jeszcze skonfigurowane. Możesz wkleić tekst i użyć analizy lokalnej.');
  }
  const url = base.replace(/\/$/, '');
  let userResponse;
  try {
    userResponse = await fetcher(url + '/auth/v1/user', {
      headers: { apikey: key, Authorization: 'Bearer ' + token }, signal: AbortSignal.timeout(5000), redirect: 'error'
    });
  } catch { throw new HttpError(503, 'Nie udało się sprawdzić konta. Spróbuj później.'); }
  if (userResponse.status === 401 || userResponse.status === 403) throw new HttpError(401, 'Sesja wygasła. Zaloguj się ponownie.');
  if (!userResponse.ok) throw new HttpError(503, 'Nie udało się sprawdzić konta.');
  const user = await userResponse.json();
  if (!/^[0-9a-f-]{36}$/i.test(user.id || '') || !user.email_confirmed_at || user.is_anonymous) {
    throw new HttpError(401, 'Zaloguj się na potwierdzone konto e-mail.');
  }
  let quota;
  try {
    quota = await fetcher(url + '/rest/v1/rpc/consume_analysis_quota', {
      method: 'POST',
      headers: { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_user: user.id, p_kind: kind }),
      signal: AbortSignal.timeout(5000), redirect: 'error'
    });
    if (!quota.ok) throw new Error();
    const allowed = await quota.json();
    if (allowed === false) throw new HttpError(429, 'Osiągnięto limit lub analizujesz zbyt szybko. Odczekaj minutę; limit dzienny odnawia się o północy UTC.');
    if (allowed !== true) throw new Error();
  } catch (error) {
    if (error instanceof HttpError) throw error;
    // Fail closed: a missing migration/outage must never allow unmetered calls.
    throw new HttpError(503, 'Limit analiz jest chwilowo niedostępny. Użyj analizy lokalnej.');
  }
}
