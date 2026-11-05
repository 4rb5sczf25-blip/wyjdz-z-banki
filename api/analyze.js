import OpenAI from 'openai';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Niedozwolona metoda' });
  }

  try {
    const { text } = req.body;
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const prompt = `Jesteś systemem analitycznym. Przeanalizuj poniższy polski tekst i podziel go na zdania.
Dla każdego zdania określ, czy jest to: "fact" (fakt), "opinion" (opinia), czy "emotion" (język emocjonalny).
Zwróć wynik JAKO CZYSTY JSON, w formacie tablicy tablic: [["typ", "zdanie"], ["typ", "zdanie"]]. Brak innego tekstu, sam JSON.
Maksymalnie 12 najważniejszych zdań z tekstu. Zawsze domykaj JSON.
Tekst: "${text}"`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
    });

    let content = response.choices[0].message.content;
    content = content.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(content);

    let fact = 0, opinion = 0, emotion = 0;
    parsed.forEach(p => {
       if (p[0] === 'fact') fact++;
       else if (p[0] === 'opinion') opinion++;
       else { p[0] = 'emotion'; emotion++; }
    });
    
    const n = parsed.length || 1;
    const pct = Math.max(3, Math.min(97, Math.round(100 * (emotion + opinion * 0.35) / n)));

    const articleData = {
      id: 'me',
      name: 'Analiza AI',
      lean: 'C',
      pct: pct,
      head: parsed[0] ? parsed[0][1] : 'Analiza tekstu z AI',
      s: parsed,
      raw: text
    };

    res.status(200).json(articleData);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Błąd serwera podczas analizy' });
  }
}
