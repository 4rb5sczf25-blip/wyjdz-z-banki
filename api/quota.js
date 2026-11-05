import { identify } from '../server/access.js';
import { HttpError, fail } from '../server/policy.js';

export function makeHandler({ identity = identify, fetcher = fetch, now = () => new Date() } = {}) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    try {
      if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); throw new HttpError(405, 'Niedozwolona metoda.'); }
      const { user, url, key } = await identity(req);
      const serverTime = now().toISOString();
      const day = serverTime.slice(0, 10);
      const resetsAt = new Date(Date.parse(day + 'T00:00:00Z') + 86400000).toISOString();
      const query = new URLSearchParams({ select: 'used', day: 'eq.' + day, kind: 'eq.analyze', subject: 'eq.' + user.id });
      const response = await fetcher(url + '/rest/v1/analysis_quota?' + query, {
        headers: { apikey: key, Authorization: 'Bearer ' + key }, signal: AbortSignal.timeout(5000), redirect: 'error'
      });
      if (!response.ok) {
        // Log only safe diagnostic codes, never keys, tokens, request headers or rows.
        let code = 'unknown';
        try { const body = await response.json(); if (/^[A-Za-z0-9_]{1,40}$/.test(body?.code || '')) code = body.code; } catch (_) {}
        console.warn('quota_read_failed', { status: response.status, code });
        throw new HttpError(503, code === '42501'
          ? 'Serwer nie ma uprawnień do odczytu licznika w Supabase. Kod: quota_read_denied.'
          : 'Nie udało się odczytać limitu analiz w Supabase. Kod: quota_read_failed.');
      }
      const rows = await response.json();
      if (!Array.isArray(rows) || rows.length > 1 || (rows.length && (!Number.isInteger(rows[0].used) || rows[0].used < 0))) throw new HttpError(503, 'Nie udało się odczytać limitu analiz.');
      const limit = user.is_anonymous === true ? 2 : 5;
      return res.status(200).json({ day, serverTime, resetsAt, limit, remaining: Math.max(0, limit - (rows[0]?.used || 0)) });
    } catch (error) { return fail(res, error); }
  };
}
export default makeHandler();
