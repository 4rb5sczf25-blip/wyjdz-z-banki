/* Shared deterministic sampling and summaries. No network calls or model decisions. */
(() => {
  const VERSION = 2, MAX_UNITS = 12, MAX_UNIT = 300;
  const EMOTION = /skandal|katastrofaln|szok|oburz|bezwstyd|dramatycz|koszmar|afer[aęy]|wściek|hańb|sensacj|panik|zdrad|upokorz|horror|oszust|kompromit|w błoto|absurd|obaw|niepok|zaskak/i;
  const STRONG = /skandal|hańb|zdrad|koszmar|horror|oszust|kompromit|bezwstyd|upokorz/i;
  const OPINION = /moim zdaniem|naszym zdaniem|zdaniem|uważam|według mnie|powinn|należy|trzeba|niestety|na szczęście|najgorsz|najlepsz|fataln|świetn|kiepsk|wątpliw|pozorowan|wydaje się|prawdopodobnie|być może|przekonuj|twierdz|sądz|mam nadzieję|lepiej|gorzej|zbyt |absurd|rozsądn|sensown/i;
  const CHECKABLE = /\d|podał|poinformował|przyjął|uchwalił|głosowało|według danych|według raportu|wynosi|wzrosł|spadł|ogłosił|zapowiedział|przekazał|ministerstwo|sejm|senat|rząd|ustaw|raport|\bgus\b|komisj|umow/i;
  function sampleText(text, title = '') {
    const parts = [], sentences = [...new Intl.Segmenter('pl', { granularity: 'sentence' }).segment(text)];
    sentences.forEach((sentence, number) => {
      let start = sentence.index, end = start + sentence.segment.length;
      while (start < end && /\s/u.test(text[start])) start++;
      while (end > start && /\s/u.test(text[end - 1])) end--;
      while (start < end) {
        let cut = Math.min(end, start + MAX_UNIT);
        if (cut < end && /[\uDC00-\uDFFF]/.test(text[cut])) cut--;
        if (cut < end) { const space = text.lastIndexOf(' ', cut); if (space > start + MAX_UNIT / 2) cut = space; }
        const unit = text.slice(start, cut).trimEnd();
        if (unit) parts.push({ id: parts.length + 1, text: unit, start, end: start + unit.length, sentence: number + 1, kind: 'body' });
        start = cut; while (start < end && /\s/u.test(text[start])) start++;
      }
    });
    const heading = typeof title === 'string' ? title.trim().slice(0, 200) : '';
    const count = Math.min(parts.length, MAX_UNITS - (heading ? 1 : 0));
    const selected = Array.from({ length: count }, (_, i) => parts[count === 1 ? 0 : Math.round(i * (parts.length - 1) / (count - 1))]);
    return {
      units: [...(heading ? [{ id: 0, text: heading, start: null, end: null, sentence: null, kind: 'title' }] : []), ...selected],
      totalSentences: sentences.filter(s => s.segment.trim()).length, totalFragments: parts.length,
      sampledFragments: selected.length, partial: selected.length < parts.length, titleIncluded: Boolean(heading),
      method: 'evenly-spaced-v1'
    };
  }
  function groundCue(text, raw) {
    if (typeof raw !== 'string' || raw.length > 500) return null;
    let cue = raw.trim();
    const pairs = { '"':'"', "'":"'", '„':'”', '“':'”', '«':'»' };
    if (!text.includes(cue) && pairs[cue[0]] && cue.at(-1) === pairs[cue[0]]) cue = cue.slice(1, -1).trim();
    if (!cue) return '';
    if (text.includes(cue)) return cue;
    // Map collapsed whitespace back to the original literal span; never invent words.
    let normalized = ''; const starts = [], ends = [];
    for (let i = 0; i < text.length; i++) {
      if (/\s/u.test(text[i])) {
        if (normalized.endsWith(' ')) { ends[ends.length - 1] = i + 1; continue; }
        normalized += ' '; starts.push(i); ends.push(i + 1);
      } else { normalized += text[i]; starts.push(i); ends.push(i + 1); }
    }
    const wanted = cue.replace(/\s+/gu, ' '), index = normalized.indexOf(wanted);
    return index < 0 ? null : text.slice(starts[index], ends[index + wanted.length - 1]);
  }
  function validateRows(parsed, sample) {
    const invalid = code => { const error = new Error(code); error.code = code; throw error; };
    const rows = parsed?.sentences;
    if (!Array.isArray(rows) || rows.length !== sample.units.length) invalid('ROW_COUNT');
    const byId = new Map();
    for (const row of rows) {
      const unit = sample.units.find(u => u.id === row?.id);
      if (!unit || byId.has(row.id)) invalid('ROW_ID');
      if (typeof row.checkable !== 'boolean' || typeof row.opinion !== 'boolean') invalid('ROW_FLAGS');
      if (!Number.isInteger(row.emotion) || row.emotion < 0 || row.emotion > 3) invalid('ROW_INTENSITY');
      if (!['none', 'author', 'quoted', 'uncertain'].includes(row.voice)) invalid('ROW_VOICE');
      if (typeof row.reason !== 'string' || !row.reason.trim()) invalid('ROW_REASON');
      if (typeof row.cue !== 'string') invalid('ROW_CUE_TYPE');
      const literal = groundCue(unit.text, row.cue);
      if (row.emotion > 0 && (!literal || literal.length > MAX_UNIT)) invalid('ROW_CUE_MISMATCH');
      const cue = literal || '';
      // These changes affect display only, never intensity or factual/opinion flags.
      const voice = row.emotion === 0 ? 'none' : row.voice === 'none' ? 'uncertain' : row.voice;
      const reason = row.reason.trim().length > 120 ? row.reason.trim().slice(0, 119) + '…' : row.reason.trim();
      byId.set(row.id, { ...unit, checkable: row.checkable, opinion: row.opinion, emotion: row.emotion, voice, cue, reason });
    }
    return sample.units.map(unit => byId.get(unit.id));
  }
  function summarize(rows) {
    const body = rows.filter(row => row.kind === 'body');
    const emotional = body.filter(row => row.emotion > 0);
    const peak = group => Math.max(0, ...group.map(row => row.emotion));
    return {
      analyzed: body.length, emotional: emotional.length, checkable: body.filter(r => r.checkable).length,
      opinions: body.filter(r => r.opinion).length, peak: peak(body),
      authorEmotional: emotional.filter(r => r.voice === 'author').length,
      quotedEmotional: emotional.filter(r => r.voice === 'quoted').length,
      uncertainEmotional: emotional.filter(r => r.voice === 'uncertain').length,
      authorPeak: peak(emotional.filter(r => r.voice === 'author')),
      coverage: body.length ? Math.round(100 * emotional.length / body.length) : 0
    };
  }
  function result(rows, sample, text, ai) {
    const body = rows.filter(row => row.kind === 'body'), summary = summarize(rows);
    const s = body.map(row => [row.emotion ? 'emotion' : row.opinion ? 'opinion' : 'fact', row.text]);
    return { analysisVersion: VERSION, rows, sample, summary, s, pct: summary.coverage,
      id: 'me', name: ai ? 'Analiza AI' : 'Analiza lokalna', lean: 'C', head: sample.units.find(u => u.kind === 'title')?.text || body[0]?.text || '', raw: text, ai };
  }
  function analyzeLocal(text, title = '') {
    const sample = sampleText(text, title);
    const rows = sample.units.map(unit => {
      const strong = unit.text.match(STRONG), emotionWord = unit.text.match(EMOTION), loud = unit.text.match(/!|[A-ZĄĆĘŁŃÓŚŹŻ]{4,}/u);
      const emotion = strong ? 3 : emotionWord ? (/obaw|niepok|zaskak/i.test(emotionWord[0]) ? 1 : 2) : loud ? 2 : 0;
      const cue = (strong?.[0] || emotionWord?.[0] || loud?.[0] || '').slice(0, 60);
      const uncertain = /[„”"«»]|powiedział|stwierdził|według|cytuj/i.test(unit.text);
      return { ...unit, checkable: CHECKABLE.test(unit.text), opinion: OPINION.test(unit.text) || Boolean(strong), emotion,
        voice: emotion ? (uncertain ? 'uncertain' : 'author') : 'none', cue,
        reason: emotion ? 'Reguły lokalne wykryły nacechowane słowo lub zapis. Ocena jest przybliżona.' : 'Reguły lokalne nie wykryły nacechowania. Nie weryfikują prawdziwości twierdzeń.' };
    });
    return result(rows, sample, text, false);
  }
  globalThis.AnalysisMethod = Object.freeze({ VERSION, MAX_UNITS, MAX_UNIT, sampleText, validateRows, summarize, result, analyzeLocal });
})();
