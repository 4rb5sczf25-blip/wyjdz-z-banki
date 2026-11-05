export const MIN_TEXT = 25;
export const MAX_TEXT = 12000;
export const MAX_BODY = 50000;
export const MAX_SENTENCES = 12;
export const MAX_SENTENCE = 300;
export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export function readBody(req) {
  if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || '')) {
    throw new HttpError(415, 'Wyślij dane w formacie JSON.');
  }
  let body;
  try {
    const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    if (!raw || Buffer.byteLength(raw) > MAX_BODY) throw new Error();
    body = JSON.parse(raw);
  } catch { throw new HttpError(400, 'Niepoprawne lub zbyt duże żądanie.'); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new HttpError(400, 'Niepoprawne dane.');
  return body;
}
export function textInput(value) {
  if (typeof value !== 'string' || value.length > MAX_TEXT) throw new HttpError(400, `Tekst może mieć najwyżej ${MAX_TEXT} znaków.`);
  const text = value.trim();
  if (text.length < MIN_TEXT) throw new HttpError(400, `Wklej co najmniej ${MIN_TEXT} znaków tekstu.`);
  return text;
}
export function prepare(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    throw new HttpError(405, 'Niedozwolona metoda.');
  }
}
export function fail(res, error) {
  const status = error instanceof HttpError ? error.status : 502;
  if (status === 429) res.setHeader('Retry-After', '60');
  return res.status(status).json({ error: error instanceof HttpError ? error.message : 'Usługa chwilowo niedostępna. Spróbuj ponownie później.' });
}
