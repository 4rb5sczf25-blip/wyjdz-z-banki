# Wersja do oceny po audycie — punkty 4–6

Gałąź `feat/responsive-ui-polish` zawiera również wcześniejsze poprawki kont i synchronizacji (commit bazowy `ab24379`). Operator zatwierdził publikację tych zmian jako **Beta 0.80**. Publikacja odbywa się przez gałąź `main` powiązaną z Vercel; zakończenie wdrożenia wymaga sprawdzenia statusu Vercel. Nie wymaga nowej migracji SQL, sekretów ani płatnych usług.

## Co zmieniło się dla użytkownika

- Tekst i przyciski mają rzeczywiste rozmiary: aplikacja nie skaluje całej ramki telefonu. Telefon wykorzystuje szerokość ekranu; komputer ma menu boczne i szerszy obszar czytania. Analiza na komputerze ma osobną kolumnę podsumowania i źródła.
- Na telefonie szczegóły źródła są za tekstem. Najpierw widać nagłówek, krótkie podsumowanie, filtry i materiał. Rozwinięcie „Zakres próbki i oznaczenia” zawiera dokładniejsze liczby i ocenę tytułu.
- Okna mają etykiety dla czytników ekranu, widoczny krzyżyk zamknięcia, przewijaną treść i stały przycisk zamknięcia w dłuższych informacjach. Tab pozostaje wewnątrz; Escape zamyka najwyższe okno, a fokus wraca do otwierającego przycisku. Tło i wcześniejsze okno są nieaktywne.
- Tryb jasny używa własnych kolorów. Nie odwraca zdjęć, mapy ani kolorów opinii/emocji. Zachowano turkusową identyfikację, żółte opinie i koralowe emocje.
- Przejścia trwają około 180–280 ms. Wejście trwa 900 ms i można je pominąć; wyłączenie ruchu kończy je od razu. Usunięto pętlę rysowania fal, ruch tła i prośbę o dostęp do czujników orientacji telefonu.
- Dźwięki są cichsze, a dla nowej instalacji domyślnie wyłączone. Istniejące preferencje pozostają zachowane. Dźwięk nadal można włączyć i sprawdzić w Ustawieniach.

## Organizacja kodu

- `app-design.css`: wspólne kolory, odstępy i układ.
- `app-layout.js`: dopasowanie istniejących ekranów oraz warstwa zgodności starszych kolorów z motywami.
- `modal.js`: jedna obsługa stosu okien, fokusu i klawiatury.
- `app-entry.js`: krótka, przerywalna animacja wejścia.
- `scripts/audit-analysis.mjs`: powtarzalny raport lokalnej analizy bez połączeń sieciowych.

Starsze szablony ekranów nadal są w `index.html`. Ta zmiana nie jest pełnym przepisaniem aplikacji; dalsze wyodrębnianie ekranów można robić stopniowo.

## Weryfikacja wykonana w środowisku roboczym

- `npm test`: 60 testów, bez błędów.
- `npm run test:browser`: 31 scenariuszy Chromium, bez błędów.
- Wszystkie 13 ścieżek ekranów (w tym dawny Sheet otwierający obecnie okno) przy 320×568, 390×844, 1280×900 i 1440×900: brak poziomego przepełnienia głównego obszaru; brak skalowania tekstu przez transformację.
- Długie okno prywatności przy 320×360 (mało miejsca jak przy otwartej klawiaturze): treść przewijana, zamknięcie widoczne.
- Rzeczywiste zdarzenia Tab, Shift+Tab i Escape w zagnieżdżonych oknach, przywrócenie fokusu, odblokowanie tła.
- Włączenie/wyłączenie ruchu, pominięcie wejścia, motyw jasny i ciemny, formularz konta w motywie jasnym.
- Wszystkie wcześniejsze scenariusze kont, limitów, URL, podglądu i analizy nadal przechodzą. Zewnętrzne usługi zastąpiono atrapami. Nie wykonano rzeczywistych zapytań do OpenAI ani Supabase.
- Obejrzano zrzuty ekranu na telefonie i komputerze, w obu motywach. Są to emulowane rozmiary Chromium, nie test fizycznego telefonu.

## Analiza języka

[Raport lokalnej diagnostyki](analysis-quality-report.md) zawiera wszystkie rozbieżności. Naprawiono fałszywe oznaczanie skrótów wielkimi literami jako emocji. Zgodność wszystkich czterech pól z roboczymi ocenami wzrosła z 15/24 do 16/24 przypadków. To nie pomiar trafności GPT i nie niezależna walidacja metody. Pozostałe przypadki, zwłaszcza ironia i przypisanie cytatu, wymagają oceny ludzi; nie dopasowujemy reguł do kilku przykładów, żeby uzyskać pozornie idealny wynik.

Nie zmieniono limitu próbki 12 fragmentów ani wag wyniku. Widoczny opis informuje, gdy wynik dotyczy tylko próbki. Oznaczenia nie potwierdzają prawdziwości informacji. Procenty na demonstracyjnej mapie fikcyjnych mediów pozostają makietą, a nie wynikiem nowej metody.

## Prywatność — stan przeglądu

Uzupełniono opis rozdzielenia danych kont, kopii starszych danych oraz technicznego identyfikatora służącego bezpiecznej synchronizacji. Administrator i kontakt pozostają zgodne z informacją operatora: Fundacja Prześwit, prywatnosc@wyjdzzbanki.pl.

Nadal nie znamy zatwierdzonych podstaw prawnych, okresów przechowywania i warunków transferów u dostawców. Pola `legalBases`, `retention`, `transfers` w `privacy-config.js` pozostały puste, a użytkownik widzi oznaczenie wersji roboczej. Nie wymyślono danych do dokumentu prawnego. Nie sprawdzono konfiguracji rzeczywistego Supabase/Vercel ani umów z dostawcami.

## Ostatnie sprawdzenie przed publikacją produkcyjną

1. Na wdrożeniu Preview sprawdzić własne dwa konta i dwie karty: zapis, usunięcie zakładki, wylogowanie i powrót. Nie wymaga użycia AI.
2. W Safari na rzeczywistym telefonie sprawdzić otwieranie klawiatury, przewijanie, powiększanie tekstu, okna oraz opcjonalny dźwięk po powrocie z tła. W tym środowisku dostępny był Chromium, nie fizyczne Safari.
3. Administrator potwierdza brakujące informacje o przetwarzaniu danych; niezależni oceniający przeglądają zestaw przykładów. Płatne sprawdzenie GPT wymaga odrębnej zgody na koszt.
4. Po ocenie wersji Preview i zgodzie operatora połączyć wybrane zmiany z `main`, obserwować błędy logowania i synchronizacji. W razie problemu przywrócić poprzednie wdrożenie w Vercel; nie usuwać kopii lokalnych ani tabel.
