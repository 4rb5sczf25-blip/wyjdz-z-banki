// Offline diagnostic only. No SDK, secrets, HTTP or paid model calls.
import '../analysis-method.js';
import { readFile, writeFile } from 'node:fs/promises';
const fixture = JSON.parse(await readFile(new URL('../docs/calibration-v2.json', import.meta.url), 'utf8'));
const fields = ['checkable', 'opinion', 'emotion', 'voice'];
const labels = {checkable:'twierdzenie sprawdzalne',opinion:'opinia',emotion:'siła emocji',voice:'przypisanie wypowiedzi'};
const cases = fixture.cases.map(item => {
  const analysis = item.kind === 'title' ? AnalysisMethod.analyzeLocal('Materiał do testu nagłówka.', item.text) : AnalysisMethod.analyzeLocal(item.text);
  const actual = analysis.rows.find(row => row.kind === item.kind);
  return {id:item.id,text:item.text,expected:item.draftExpected,actual:Object.fromEntries(fields.map(field=>[field,actual[field]])),mismatches:fields.filter(field=>actual[field]!==item.draftExpected[field])};
});
const full = cases.filter(item=>!item.mismatches.length).length;
const escapeCell = text => String(text).replaceAll('|','\\|').replaceAll('\n',' ');
const lines = ['# Sprawdzenie analizy — tryb bezpłatny i lokalny','',
 'To **diagnostyka reguł lokalnych**, nie wynik badania GPT-4o-mini ani niezależna walidacja naukowa. Nie wykonano żadnego wywołania OpenAI.',
 '',`Zestaw: ${cases.length} fikcyjnych przykładów. Pełna zgodność z roboczą oceną: **${full}/${cases.length}**.`,
 'Oceny oczekiwane nadal wymagają niezależnego przeglądu przez ludzi (`humanReviewComplete: false`). Nie są zatwierdzonym wzorcem.',
 '', '| Obszar | Zgodne pola |','| --- | --- |',...fields.map(field=>`| ${labels[field]} | ${cases.filter(item=>!item.mismatches.includes(field)).length}/${cases.length} |`),
 '', '## Rozbieżności do przeglądu','', '| Przykład | Tekst | Oczekiwane → uzyskane |','| --- | --- | --- |',
 ...cases.filter(item=>item.mismatches.length).map(item=>`| ${item.id} | ${escapeCell(item.text)} | ${item.mismatches.map(field=>`${labels[field]}: ${item.expected[field]} → ${item.actual[field]}`).join('; ')} |`),
 '', '## Co sprawdzono i czego nie wiemy','',
 '- Testy automatyczne sprawdzają maksymalną próbkę 12 fragmentów, identyfikatory, dosłowność wskazanego cytatu, zakres intensywności i sposób obliczania podsumowania.',
 '- Nagłówek jest oceniany osobno. Jego wynik nie jest dodawany do statystyk treści.',
 '- Skrót pisany wielkimi literami nie stanowi sam w sobie podstawy do oznaczenia emocji.',
 '- Reguły lokalne nie rozumieją niezawodnie ironii, zaprzeczeń ani kontekstu. Mogą ostrożnie pozostawić przypisanie wypowiedzi jako niepewne.',
 '- W dłuższym tekście próbka może ominąć ważne fragmenty. Widoczna informacja o próbce jest częścią wyniku; nie przeliczamy jej na ocenę wiarygodności całego artykułu.',
 '- Nie sprawdzono trafności rzeczywistych odpowiedzi GPT-4o-mini. Nie zwiększamy wag ani nie zmieniamy skali na podstawie tego lokalnego zestawu.',
 '', '## Dalsza ocena przed szerszą publikacją','',
 'Dwie osoby powinny niezależnie ocenić przykłady, uzgodnić rozbieżności i dodać nowe, niewidziane wcześniej materiały. Następnie, po osobnej zgodzie na koszt, można porównać odpowiedzi GPT z tym wzorcem. Przegląd nie powinien utożsamiać krytyki instytucji z nierzetelnością ani trudnego tematu z emocjonalnym językiem.',
 '', 'Odtworzenie: `npm run audit:analysis`. Aktualizacja tego pliku: `npm run audit:analysis -- --write`.',''];
const report=lines.join('\n');
if(process.argv.includes('--write')) await writeFile(new URL('../docs/analysis-quality-report.md',import.meta.url),report);
process.stdout.write(report);
