const EMOTION_LEVELS = ['Brak', 'Łagodne', 'Wyraźne', 'Silne'];
function analysisRows(article) { return article.analysisVersion === 2 ? article.rows.filter(row => row.kind === 'body') : []; }
function analysisView(article) {
  const rows = analysisRows(article), summary = AnalysisMethod.summarize(rows), sample = article.sample;
  const title = article.rows?.find(row => row.kind === 'title');
  return {
    hasClickableTitle: Boolean(title), untitledAnalysis: article.analysisVersion===2&&!title,
    head: title ? [{text:title.text,css:title.emotion>0?NEWS_MARK.emotion:title.opinion?NEWS_MARK.opinion:''}] : newsHead(article),
    intensitySteps: [1,2,3].map(level=>({active:summary.peak>=level?'true':'false',color:summary.peak>=level?['#F2C94C','#FFAA7A','#FF7A66'][level-1]:'var(--line)'})),
    detailedAnalysis: article.analysisVersion === 2, legacyResult: article.analysisVersion !== 2,
    peakLevel: summary.peak,
    peakColor: ['#CFE6EC','#F5D874','#FFAA7A','#FFB0A4'][summary.peak],
    samplingShort: sample ? 'Zakres: '+summary.analyzed+' z '+sample.totalFragments+' fragmentów przesłanego tekstu.' : '',
    coverageLabel: 'Język emocjonalny: ' + summary.emotional + ' z ' + summary.analyzed + ' fragmentów',
    peakLabel: 'Najsilniejsze nacechowanie: ' + EMOTION_LEVELS[summary.peak].toLowerCase(),
    attributionLabel: 'Nacechowane fragmenty — autor: ' + summary.authorEmotional + ' · Cytaty / cudze wypowiedzi: ' + summary.quotedEmotional + ' · Niepewne przypisanie: ' + summary.uncertainEmotional,
    authorPeakLabel: 'Najsilniejsze nacechowanie przypisane autorowi: ' + EMOTION_LEVELS[summary.authorPeak].toLowerCase() + '.',
    independentCounts: 'Twierdzenia sprawdzalne: ' + summary.checkable + ' · Opinie: ' + summary.opinions + '. Oznaczenia mogą współwystępować w jednym fragmencie.',
    samplingLabel: sample ? 'Przeanalizowano ' + summary.analyzed + ' z ' + sample.totalFragments + ' fragmentów tekstu (' + sample.totalSentences + ' zdań). ' + (sample.partial ? 'Próbka obejmuje początek, środek i koniec — wynik nie opisuje całego artykułu.' : 'Dłuższe zdania mogą być podzielone na części.') : '',
    titleAnalysis: title ? 'Tytuł oceniony osobno: nacechowanie ' + EMOTION_LEVELS[title.emotion].toLowerCase() + (title.cue ? ' — „' + title.cue + '”' : '') + '. Twierdzenie sprawdzalne: ' + (title.checkable ? 'tak' : 'nie') + ', opinia: ' + (title.opinion ? 'tak' : 'nie') + '. Nie wliczamy go do statystyk treści.' : 'Tytuł nie był analizowany osobno.',
    titleText: title?.text || '', hasAnalyzedTitle: Boolean(title),
    methodCaution: article.demo ? 'Przykład edukacyjny oznaczony prostymi regułami. Nie jest wynikiem oceny modelu AI.' : article.ai ? 'Ocena GPT-4o-mini jest eksperymentalna. Intensywność i przypisanie wypowiedzi mogą być błędne; nie są miarą manipulacji ani prawdziwości.' : 'Analiza lokalna używa słów-kluczy. Intensywność jest przybliżona; cytaty oznaczamy jako niepewne, zamiast przypisywać je automatycznie autorowi.'
  };
}
function sentenceAssessment(article, index) {
  const row = analysisRows(article)[index];
  if (!row) return null;
  const flags = [];
  if (row.checkable) flags.push('Twierdzenie sprawdzalne');
  if (row.opinion) flags.push('Opinia');
  if (row.emotion) flags.push('Język emocjonalny: ' + EMOTION_LEVELS[row.emotion].toLowerCase());
  if (row.voice === 'quoted') flags.push('Cytat / cudza wypowiedź');
  if (row.voice === 'uncertain') flags.push('Niepewne przypisanie');
  return { ...row, flags: flags.join(' · ') || 'Bez wykrytego nacechowania', position: 'Zdanie ' + row.sentence + ' · fragment ' + row.id };
}
function sentenceStyle(article, index, focus) {
  const row = sentenceAssessment(article, index);
  const kind = article.s[index][0];
  const matches = row ? (!focus || (focus === 'fact' ? row.checkable : focus === 'opinion' ? row.opinion : row.emotion > 0)) : (!focus || focus === kind);
  const base = (row ? row.emotion > 0 : kind === 'emotion') ? NEWS_MARK.emotion : (row ? row.opinion : kind === 'opinion') ? NEWS_MARK.opinion : '';
  return base + (matches ? '' : 'opacity:0.4;');
}
function assessmentExplanation(article, index, fallback) {
  const row = sentenceAssessment(article, index);
  if (!row) return fallback;
  return { ...fallback, title: row.flags, body: row.reason + (row.cue ? ' Wskazany fragment: „' + row.cue + '”.' : '') + ' To ocena języka, nie weryfikacja informacji.' };
}

function explanationBadges(row, kind) {
  const labels = [];
  if (row ? row.checkable : kind === 'fact') labels.push('<span class="explanation-badge badge-claim">Twierdzenie sprawdzalne</span>');
  if (row ? row.opinion : kind === 'opinion') labels.push('<span class="explanation-badge badge-opinion">Opinia</span>');
  if (row ? row.emotion > 0 : kind === 'emotion') labels.push('<span class="explanation-badge badge-emotion">Język emocjonalny'+(row?' · '+esc(EMOTION_LEVELS[row.emotion].toLowerCase()):'')+'</span>');
  return labels.join('') || '<span class="explanation-badge badge-claim">Bez wykrytego nacechowania</span>';
}
function highlightedEvidence(text, cue, row, kind) {
  const position = cue ? text.indexOf(cue) : -1;
  if (position < 0) return esc(text);
  const classes = 'evidence-cue' + ((row ? row.opinion : kind === 'opinion') ? ' cue-opinion' : '') + ((row ? row.emotion > 0 : kind === 'emotion') ? ' cue-emotion' : '');
  return esc(text.slice(0, position)) + '<mark class="'+classes+'">'+esc(cue)+'</mark>'+esc(text.slice(position+cue.length));
}
function openSentenceExplanation(article, index, {isTitle=false}={}) {
  const row = sentenceAssessment(article, index), kind = article.s[index]?.[0];
  const fallback = { title: kind === 'emotion' ? 'Język emocjonalny' : kind === 'opinion' ? 'Opinia' : 'Twierdzenie sprawdzalne', body: 'To przybliżona klasyfikacja języka, nie weryfikacja prawdziwości informacji.' };
  const explanation = assessmentExplanation(article, index, fallback);
  const text = article.s[index]?.[1] || '', cue = row?.cue && text.includes(row.cue) ? row.cue : '';
  const color = (row ? row.emotion > 0 : kind === 'emotion') ? '#FF7A66' : (row ? row.opinion : kind === 'opinion') ? '#F2C94C' : '#A9CBD4';
  openModal('<h2 id="fragment-explanation-title" style="margin-top:14px">'+(isTitle?'Dlaczego tak oceniono nagłówek?':'Dlaczego to oznaczenie?')+'</h2>' +
    (isTitle?'<p>Nagłówek oceniamy osobno. Jego wynik nie jest wliczany do statystyk treści artykułu.</p>':'') +
    '<div class="explanation-badges">' + explanationBadges(row,kind) + '</div>' +
    '<blockquote class="explanation-quote" style="border-left-color:'+color+'">' + highlightedEvidence(text,cue,row,kind) + '</blockquote>' +
    (cue ? '<p class="evidence-label"><strong>Wskazane słowa:</strong> '+highlightedEvidence(cue,cue,row,kind)+'</p>' : '<p class="evidence-label">Nie wskazano osobnego słowa-klucza. Oznaczenie dotyczy całego fragmentu i jego kontekstu.</p>') +
    '<p id="mark-tip-body">' + esc(explanation.body) + '</p>' +
    '<p style="font-size:12px;color:#A9CBD4">' + (article.demo ? 'Przykład demonstracyjny.' : article.ai ? 'Ocena AI może być błędna.' : 'To wynik reguł lokalnych, nie ocena modelu AI.') + '</p>' +
    '<button type="button" data-close style="'+MB+';width:100%;border:0;background:#5EE6D6;color:#04202B">Zamknij</button>', card => card.setAttribute('aria-labelledby', 'fragment-explanation-title'));
}

function openTitleExplanation(article) {
  const title = article.rows?.find(row => row.kind === 'title');
  if (!title) return;
  const kind = title.emotion ? 'emotion' : title.opinion ? 'opinion' : 'fact';
  // Reuse only the explanation renderer; keep the original article and summary untouched.
  openSentenceExplanation({ ...article, rows: [{ ...title, kind: 'body' }], s: [[kind, title.text]] }, 0, { isTitle: true });
}
