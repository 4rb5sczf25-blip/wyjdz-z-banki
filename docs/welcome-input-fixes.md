# Poprawki po zgłoszeniu z Beta 0.81

Gałąź `fix/welcome-and-composer`. Bez zmian modeli, limitów, bazy i kluczy. Nie opublikowano na produkcji.

1. **Pisanie w polu:** usunięto nakładające się obrysy. Wspólna ramka i subtelna poświata otaczają pole na telefonie i komputerze. Wielowierszowy tekst przewija się pionowo. Na telefonie pole ma 112–168 px wysokości; na komputerze dopasowuje się do panelu. Wyróżnienie AI i dwa delikatne rozświetlenia są dostępne także na telefonie. Fokus, pisanie i ograniczenie ruchu wyłączają rozświetlenia.
2. **Ekran powitalny i wejście:** nowa, ograniczona szerokością kompozycja z wyraźnymi przyciskami i oznaczonym przykładem edukacyjnym. Na komputerze menu boczne nie konkuruje z powitaniem. Wejście wygasza rzeczywistą treść przez 260 ms, po czym odsłania przegląd. Nie wyświetla nieprzezroczystego ekranu z pierścieniem.
3. **Rozwijana instrukcja:** przycisk z `aria-expanded` i sterowanym regionem; animowane otwarcie/zamknięcie i obrót strzałki. Zawartość zwinięta jest nieaktywna. Ograniczenie ruchu wyłącza przejście.
4. **Samouczek:** zastąpiono dawną pełnoszeroką kartę wspólnym oknem (do 540 px). Trzy kroki, widoczne przyciski, przewijana treść, fokus, Escape, zamknięcie i zapamiętanie ukończenia. Przykłady nie sugerują potwierdzenia prawdziwości informacji.
5. **Wyrównanie:** pole analizy i panel konta mają wspólne górne i dolne krawędzie również po rozwinięciu instrukcji.

Usunięto również kopie całych ekranów używane do przejść. Powodowały chwilowe nakładanie starego pola/placeholdera na nowe, co było szczególnie widoczne podczas szybkiego pisania. Odświeżenie danych na ekranie Main zachowuje teraz tekst, kursor i fokus w ramach tej samej sesji; zmiana konta nie przenosi szkicu.

Przy otwartej klawiaturze mobilny układ uwzględnia wysokość i przesunięcie `visualViewport`, ukrywa dolną nawigację oraz przewija formularz w widoczne miejsce. Nie zmniejsza czcionki poniżej 16 px.

## Sprawdzenie

- 60 testów automatycznych i 40 scenariuszy Chromium.
- Testy poprzednich funkcji oraz nowe: powitanie, wejście bez pełnoekranowej pauzy, otwieranie/zamykanie instrukcji, zgodność krawędzi paneli, ukończenie samouczka, jego wersja mobilna, mobilna etykieta AI, długi tekst, zachowanie szkicu/kursora, brak kopii pól podczas przejść.
- Symulacja klawiatury: widoczny obszar 390×360 z przesunięciem 32 px; pole i przycisk analizy mieszczą się w obszarze, dolna nawigacja nie zasłania formularza.
- Zrzuty powitania, paneli, samouczka i wpisanego tekstu przejrzano wizualnie. Testy używają atrap OpenAI/Supabase.
- To symulacja Chromium, nie test fizycznego iPhone’a/Safari. Zachowanie pasków systemowych Safari wymaga porównania na urządzeniu.

Kod powitania i samouczka: `welcome-ui.js`; wspólne style interakcji: `interaction-ui.css`; dopasowanie klawiatury: `app-layout.js`.
