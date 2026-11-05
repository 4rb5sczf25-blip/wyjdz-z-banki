# Sprawdzenie analizy — tryb bezpłatny i lokalny

To **diagnostyka reguł lokalnych**, nie wynik badania GPT-4o-mini ani niezależna walidacja naukowa. Nie wykonano żadnego wywołania OpenAI.

Zestaw: 24 fikcyjnych przykładów. Pełna zgodność z roboczą oceną: **16/24**.
Oceny oczekiwane nadal wymagają niezależnego przeglądu przez ludzi (`humanReviewComplete: false`). Nie są zatwierdzonym wzorcem.

| Obszar | Zgodne pola |
| --- | --- |
| twierdzenie sprawdzalne | 20/24 |
| opinia | 20/24 |
| siła emocji | 22/24 |
| przypisanie wypowiedzi | 20/24 |

## Rozbieżności do przeglądu

| Przykład | Tekst | Oczekiwane → uzyskane |
| --- | --- | --- |
| negative_event | W pożarze zginęły trzy osoby. | twierdzenie sprawdzalne: true → false |
| negative_disaster | W katastrofie zginęły trzy osoby. | twierdzenie sprawdzalne: true → false |
| mild_concern | Ta propozycja budzi pewien niepokój. | opinia: true → false |
| mild_surprise | Zaskakujące, że komisja zmieniła termin. | opinia: true → false |
| quoted_scandal | Radny powiedział: „To skandal i kompromitacja”. | twierdzenie sprawdzalne: true → false; przypisanie wypowiedzi: quoted → uncertain |
| quoted_criticism | Według rzeczniczki projekt jest „absurdalnym pomysłem”. | twierdzenie sprawdzalne: true → false; przypisanie wypowiedzi: quoted → uncertain |
| irony | No tak, kolejny genialny sukces urzędu. | opinia: true → false; siła emocji: 2 → 0; przypisanie wypowiedzi: author → none |
| sarcasm_with_fact | Po miesiącu opóźnienia urząd znów popisał się punktualnością. | opinia: true → false; siła emocji: 2 → 0; przypisanie wypowiedzi: author → none |

## Co sprawdzono i czego nie wiemy

- Testy automatyczne sprawdzają maksymalną próbkę 12 fragmentów, identyfikatory, dosłowność wskazanego cytatu, zakres intensywności i sposób obliczania podsumowania.
- Nagłówek jest oceniany osobno. Jego wynik nie jest dodawany do statystyk treści.
- Skrót pisany wielkimi literami nie stanowi sam w sobie podstawy do oznaczenia emocji.
- Reguły lokalne nie rozumieją niezawodnie ironii, zaprzeczeń ani kontekstu. Mogą ostrożnie pozostawić przypisanie wypowiedzi jako niepewne.
- W dłuższym tekście próbka może ominąć ważne fragmenty. Widoczna informacja o próbce jest częścią wyniku; nie przeliczamy jej na ocenę wiarygodności całego artykułu.
- Nie sprawdzono trafności rzeczywistych odpowiedzi GPT-4o-mini. Nie zwiększamy wag ani nie zmieniamy skali na podstawie tego lokalnego zestawu.

## Dalsza ocena przed szerszą publikacją

Dwie osoby powinny niezależnie ocenić przykłady, uzgodnić rozbieżności i dodać nowe, niewidziane wcześniej materiały. Następnie, po osobnej zgodzie na koszt, można porównać odpowiedzi GPT z tym wzorcem. Przegląd nie powinien utożsamiać krytyki instytucji z nierzetelnością ani trudnego tematu z emocjonalnym językiem.

Odtworzenie: `npm run audit:analysis`. Aktualizacja tego pliku: `npm run audit:analysis -- --write`.
