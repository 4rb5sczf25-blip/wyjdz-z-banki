import dns from 'node:dns/promises';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import ipaddr from 'ipaddr.js';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import { HttpError, MAX_TEXT, MIN_TEXT } from './policy.js';

export const MAX_HTML = 1024 * 1024;
const REDIRECTS = new Set([301, 302, 303, 307, 308]);
export function articleURL(raw) {
  if (typeof raw !== 'string' || raw.length > 2048 || /[\s\\\u0000-\u001f\u007f]/u.test(raw)) throw new HttpError(400, 'Podaj poprawny adres HTTP lub HTTPS.');
  let url;
  try { url = new URL(raw); } catch { throw new HttpError(400, 'Podaj pełny adres, zaczynający się od https://.'); }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.port) {
    throw new HttpError(400, 'Dozwolone są tylko publiczne strony HTTP/HTTPS na standardowym porcie, bez danych logowania.');
  }
  url.hash = '';
  url.hostname = url.hostname.replace(/\.$/, '');
  // IPv6 is deliberately unsupported. Every connection below is pinned to a public IPv4.
  if (url.hostname.includes(':') || !url.hostname.includes('.') || /(?:^|\.)(localhost|local|internal|test|invalid|onion)$/.test(url.hostname)) {
    throw new HttpError(400, 'Ten adres nie wskazuje publicznej strony.');
  }
  return url;
}
export function publicIPv4(address) {
  return net.isIP(address) === 4 && ipaddr.parse(address).range() === 'unicast';
}
export async function destination(url, resolve = dns.resolve4) {
  let addresses;
  try { addresses = net.isIP(url.hostname) ? [url.hostname] : await resolve(url.hostname); }
  catch { throw new HttpError(422, 'Nie udało się odnaleźć strony.'); }
  if (!addresses.length || addresses.some(ip => !publicIPv4(ip))) throw new HttpError(400, 'Ten adres nie wskazuje publicznej strony.');
  return addresses[0];
}

export function requestHTML(url, address, signal) {
  return new Promise((resolve, reject) => {
    const transport = url.protocol === 'https:' ? https : http;
    const request = transport.request(url, {
      method: 'GET', agent: false, family: 4, autoSelectFamily: false, signal,
      // Prevent DNS rebinding: connect only to the exact IP checked above. Host/SNI
      // still use the original name; TLS certificate validation remains enabled.
      lookup: (_host, options, callback) => options.all ? callback(null, [{ address, family: 4 }]) : callback(null, address, 4),
      headers: { 'User-Agent': 'WyjdzZBanki-ArticleReader/1.0', Accept: 'text/html,application/xhtml+xml', 'Accept-Encoding': 'identity' },
      maxHeaderSize: 16384
    }, response => {
      const status = response.statusCode;
      if (REDIRECTS.has(status)) {
        const location = response.headers.location;
        response.destroy();
        resolve({ status, location });
        return;
      }
      const rejectResponse = error => { response.destroy(); reject(error); };
      if (status !== 200) return rejectResponse(new HttpError(422, 'Strona jest niedostępna lub blokuje pobieranie. Wklej tekst ręcznie.'));
      if (!/^(text\/html|application\/xhtml\+xml)(?:\s*;|$)/i.test(response.headers['content-type'] || '')) {
        return rejectResponse(new HttpError(422, 'Ten link nie prowadzi do strony HTML. Wklej treść artykułu ręcznie.'));
      }
      if ((response.headers['content-encoding'] || 'identity') !== 'identity') return rejectResponse(new HttpError(422, 'Nieobsługiwane kodowanie strony. Wklej tekst ręcznie.'));
      if (Number(response.headers['content-length']) > MAX_HTML) return rejectResponse(new HttpError(422, 'Strona jest zbyt duża. Wklej tekst ręcznie.'));
      const chunks = []; let bytes = 0;
      response.on('data', chunk => {
        bytes += chunk.length;
        if (bytes > MAX_HTML) rejectResponse(new HttpError(422, 'Strona jest zbyt duża. Wklej tekst ręcznie.'));
        else chunks.push(chunk);
      });
      response.on('error', reject);
      response.on('aborted', () => reject(new HttpError(422, 'Pobieranie strony zostało przerwane.')));
      response.on('end', () => resolve({ status, html: Buffer.concat(chunks), contentType: response.headers['content-type'] }));
    });
    request.on('error', reject);
    request.end();
  });
}
async function withAbort(promise, signal) {
  signal.throwIfAborted();
  let listener;
  try {
    return await Promise.race([promise, new Promise((_, reject) => {
      listener = () => reject(signal.reason);
      signal.addEventListener('abort', listener, { once: true });
    })]);
  } finally { signal.removeEventListener('abort', listener); }
}
export function extractArticle(html, url, contentType = 'text/html') {
  // No scripts or external resources are enabled in JSDOM. Return plain text only.
  const dom = new JSDOM(html, { url: url.href, contentType });
  try {
    const article = new Readability(dom.window.document, { charThreshold: MIN_TEXT, maxElemsToParse: 20000 }).parse();
    const full = (article?.textContent || '').replace(/[\t\r ]+/g, ' ').replace(/\n\s*\n+/g, '\n\n').trim();
    if (full.length < MIN_TEXT) throw new HttpError(422, 'Nie udało się odczytać artykułu. Strona może wymagać logowania lub JavaScript. Wklej tekst ręcznie.');
    return { title: (article.title || url.hostname).slice(0, 200), url: url.href, text: full.slice(0, MAX_TEXT), truncated: full.length > MAX_TEXT, maxLength: MAX_TEXT };
  } finally { dom.window.close(); }
}
export async function fetchArticle(raw, { resolve = dns.resolve4, request = requestHTML, timeout = 10000 } = {}) {
  let url = articleURL(raw);
  const signal = AbortSignal.timeout(timeout);
  try {
    for (let redirects = 0; redirects <= 3; redirects++) {
      const address = await withAbort(destination(url, resolve), signal);
      signal.throwIfAborted();
      const response = await withAbort(request(url, address, signal), signal);
      if (REDIRECTS.has(response.status)) {
        if (!response.location || redirects === 3) throw new HttpError(422, 'Strona ma zbyt wiele przekierowań. Wklej tekst ręcznie.');
        const next = articleURL(new URL(response.location, url).href);
        if (url.protocol === 'https:' && next.protocol !== 'https:') throw new HttpError(400, 'Odrzucono niezabezpieczone przekierowanie.');
        url = next;
        continue;
      }
      return extractArticle(response.html, url, response.contentType);
    }
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(422, 'Nie udało się pobrać artykułu w ciągu 10 sekund. Wklej tekst ręcznie.');
  }
}
