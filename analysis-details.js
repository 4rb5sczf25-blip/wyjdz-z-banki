const EMOTION_LEVELS = ['Brak', 'Łagodne', 'Wyraźne', 'Silne'];
function analysisRows(article) { return article.analysisVersion === 2 ? article.rows.filter(row => row.kind === 'body') : []; }
function analysisView(article) {
  const rows = analysisRows(article), summary = AnalysisMethod.summarize(rows), sample = article.sample;
  const title = article.rows?.find(row => row.kind === 'title');
  return {
    intensitySteps: [1,2,3].map(level=>({active:summary.peak>=level?'true':'false',color:summary.peak>=level?['#F2C94C','#FFAA7A','#FF7A66'][level-1]:'rgba(255,255,255,.12)'})),
    detailedAnalysis: article.analysisVersion === 2, legacyResult: article.analysisVersion !== 2,
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

function openSentenceExplanation(article, index) {
  const row = sentenceAssessment(article, index);
  const kind = article.s[index]?.[0];
  const fallback = { title: kind === 'emotion' ? 'Język emocjonalny' : kind === 'opinion' ? 'Opinia' : 'Twierdzenie sprawdzalne', body: 'To przybliżona klasyfikacja języka, nie weryfikacja prawdziwości informacji.' };
  const explanation = assessmentExplanation(article, index, fallback);
  openModal('<h2 id="fragment-explanation-title" style="margin-top:14px">Dlaczego to oznaczenie?</h2>' +
    '<p style="color:#7FF0E0;font-weight:800">' + esc(explanation.title) + '</p>' +
    '<blockquote style="margin:16px 0;padding:12px 14px;border-left:2px solid rgba(94,230,214,.5);background:rgba(255,255,255,.05);border-radius:4px 12px 12px 4px;font-size:15px;line-height:24px;overflow-wrap:anywhere">' + esc(article.s[index]?.[1] || '') + '</blockquote>' +
    '<p id="mark-tip-body">' + esc(explanation.body) + '</p>' +
    '<p style="font-size:12px;color:#A9CBD4">' + (article.demo ? 'Przykład demonstracyjny.' : article.ai ? 'Ocena AI może być błędna.' : 'To wynik reguł lokalnych, nie ocena modelu AI.') + '</p>' +
    '<button type="button" data-close style="'+MB+';width:100%;border:0;background:#5EE6D6;color:#04202B">Zamknij</button>', card => card.setAttribute('aria-labelledby', 'fragment-explanation-title'));
}
