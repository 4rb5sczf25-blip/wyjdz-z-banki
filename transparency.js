const DEMO_TOPICS = [
  { subject: 'Nowelizacja przepisów o transporcie regionalnym', common: 'Projekt ustawy, finansowanie połączeń i skutki dla samorządów.', perspectives: 'Informacja o decyzji, koszty budżetowe oraz oceny skutków dla mieszkańców.' },
  { subject: 'Budżet szkół na przyszły rok', common: 'Finansowanie edukacji i spór o podział środków.', perspectives: 'Argumenty samorządów, potrzeby szkół i komentarze dotyczące wydatków.' },
  { subject: 'Jawność umów publicznych', common: 'Projekt przepisów o dostępie do umów instytucji publicznych.', perspectives: 'Zakres jawności, wyjątki od ujawniania umów oraz oceny skutków projektu.' }
];
function attachDemoMetadata(events) {
  const authors = ['Marta Nowicka', 'Piotr Lisowski', 'Anna Wolska', 'Jakub Brzeziński', 'Ewa Milewska'];
  events.forEach((event, eventIndex) => {
    event.demo = true;
    event.articles.forEach((article, index) => {
      article.demo = true;
      const demoResult = AnalysisMethod.analyzeLocal(article.s.map(row => row[1]).join(' '), article.head.replace(/\[\/?[eo]\]/g, ''));
      Object.assign(article, { analysisVersion: 2, rows: demoResult.rows, sample: demoResult.sample, summary: demoResult.summary, s: demoResult.s });
      article.sourceMetadata = {
        title: article.head.replace(/\[\/?[eo]\]/g, ''), author: authors[index % authors.length],
        publishedAt: '2026-11-03T' + String(8 + index).padStart(2, '0') + ':00:00+01:00',
        url: 'https://redakcja-' + article.id + '.example/material-' + (eventIndex + 1),
        truncated: true
      };
    });
  });
}
function safeSourceURL(value) {
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : ''; }
  catch (_) { return ''; }
}
function sourceDate(value) {
  if (!value || !/^\d{4}-\d{2}-\d{2}/.test(value) || !Number.isFinite(Date.parse(value))) return 'Brak danych o dacie publikacji';
  const options = { timeZone: 'Europe/Warsaw', dateStyle: 'medium' };
  if (/T\d{2}:\d{2}/.test(value)) options.timeStyle = 'short';
  return new Date(value).toLocaleString('pl-PL', options);
}
function openComparisonWhy() {
  const event = curEvent();
  const topic = event.demo ? DEMO_TOPICS[SEL.ev] : null;
  const featured = event.articles.filter(a => event.featured.includes(a.id));
  openModal('<h2 id="comparison-why-title" style="margin-top:14px">Dlaczego te artykuły?</h2>' +
    '<p><strong>' + esc(event.title) + '</strong></p>' +
    (topic ? '<p style="color:#7FF0E0">Zestaw demonstracyjny — fikcyjne media, artykuły i metadane. Zestaw przygotowano ręcznie, nie wybrał go algorytm.</p>' +
      '<h3>Wspólny temat</h3><p>' + esc(topic.subject + '. ' + topic.common) + '</p>' +
      '<h3>Różne perspektywy</h3><p>' + esc(topic.perspectives) + '</p>' : '<p>Ten materiał nie został automatycznie dopasowany do publikacji innych mediów.</p>') +
    '<h3>Dobór i kolejność</h3><p>Widoczne źródła: ' + featured.map(a => esc(a.name)).join(', ') + '.</p>' +
    '<p>W tym zestawie pokazujemy ' + featured.length + ' z ' + event.articles.length + ' materiałów. Dobór i kolejność są zapisane w makiecie, nie wynikają z Twoich poglądów ani historii użycia. Różnice w języku nie dowodzą, że stanowiska mają jednakowe oparcie w dowodach.</p>' +
    '<p>Mapa lewica–centrum–prawica i wskaźniki są ilustracją działania interfejsu. Nie są zweryfikowaną oceną rzeczywistych mediów.</p>' +
    '<p>Automatyczne wyszukiwanie i dobieranie rzeczywistych publikacji nie jest jeszcze wdrożone. Dla takiego doboru planujemy wspólne wydarzenie i czas publikacji, usuwanie duplikatów oraz ograniczenie dominacji jednego wydawcy — bez premiowania poglądów politycznych. To plan, nie obecna funkcja.</p>' +
    '<button type="button" id="comparison-report" style="'+MB+';width:100%;border:1px solid rgba(255,255,255,.28);background:transparent;color:#E8F6F8">Zgłoś problem z zestawieniem</button>' +
    '<button type="button" data-close style="'+MB+';width:100%;margin-top:8px;border:0;background:#5EE6D6;color:#04202B">Zamknij</button>', (card, close) => {
      card.setAttribute('aria-labelledby', 'comparison-why-title');
      card.querySelector('#comparison-report').onclick = () => { close(); openReport(); };
    });
}
function openSourceDetails() {
  const article = curArticle();
  const meta = article.sourceMetadata || {};
  const demo = Boolean(article.demo);
  const url = safeSourceURL(article.source || meta.url);
  const manual = !demo && !url;
  const title = meta.title || article.head.replace(/\[\/?[eo]\]/g, '');
  const scope = demo ? 'Fragment demonstracyjny, nie pełna publikacja.' : meta.truncated ? 'Pobrany artykuł skrócono do 12 000 znaków. Analizowano tekst zatwierdzony w podglądzie, z ewentualnymi zmianami użytkownika.' : manual ? 'Tekst wklejony ręcznie przez użytkownika; jego pochodzenie i kompletność nie zostały potwierdzone.' : 'Analizowano tekst zatwierdzony w podglądzie. Ekstraktor mógł pominąć część strony; użytkownik mógł poprawić lub skrócić tekst.';
  openModal('<h2 id="source-details-title" style="margin-top:14px">Źródło materiału</h2>' +
    (demo ? '<p style="color:#FFB0A4"><strong>Dane fikcyjne — przykład edukacyjny.</strong> Autor, data i adres zostały wymyślone. Nie jest to rzeczywista publikacja.</p>' : '') +
    '<h3>Tytuł</h3><p>' + esc(title) + '</p><h3>Źródło</h3><p>' + esc(demo ? article.name + ' — fikcyjne medium' : url ? new URL(url).hostname : 'Własny tekst użytkownika') + '</p>' +
    '<p><strong>Autor:</strong> ' + esc(meta.author || 'Brak danych') + (demo ? ' (postać fikcyjna)' : '') + '</p>' +
    '<p><strong>Publikacja:</strong> ' + esc(sourceDate(meta.publishedAt)) + (demo ? ' (data fikcyjna)' : '') + '</p>' +
    (url ? '<p style="overflow-wrap:anywhere">' + esc(url) + '</p>' : '') +
    (!demo && url ? '<a id="source-original" href="' + esc(url) + '" target="_blank" rel="noopener noreferrer" style="display:block;color:#7FF0E0;padding:10px 0">Otwórz oryginał ↗</a><p style="font-size:12px">Metadane pochodzą ze strony wydawcy i nie zostały niezależnie zweryfikowane.</p>' : demo ? '<p>Adres w zarezerwowanej domenie .example nie prowadzi do prawdziwego artykułu.</p>' : '<p>Nie znamy adresu oryginału — nie tworzymy go automatycznie.</p>') +
    '<h3>Zakres analizy</h3><p>' + esc(scope) + '</p><p>Klasyfikacja obejmuje maksymalnie 12 fragmentów (zdań lub części dłuższych zdań), wybranych równomiernie. Tytuł, jeśli jest dostępny, oceniamy osobno. Wynik może nie odzwierciedlać całej publikacji.</p>' +
    '<button type="button" data-close style="'+MB+';width:100%;border:0;background:#5EE6D6;color:#04202B">Zamknij</button>', card => card.setAttribute('aria-labelledby', 'source-details-title'));
}
