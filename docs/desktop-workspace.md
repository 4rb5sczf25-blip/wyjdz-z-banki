# Wersja komputerowa — wygodniejsza przestrzeń pracy

Gałąź `feat/desktop-workspace`, przygotowana na bazie opublikowanej Beta 0.80. Zmiany nie są połączone z `main`. Nie zmieniają zapytań AI, limitów, Supabase ani ustawień kont.

## Zmiany dla użytkownika

- Stałe menu z wyraźnie zaznaczonym bieżącym działem. „Nowa analiza” przenosi do formularza i ustawia kursor w polu tekstowym. Konto, prywatność i ustawienia są dostępne z każdego ekranu.
- Ekran przeglądu: duże pole na link/tekst, osobny panel konta, limitu i postępów; poniżej trzy tematy do porównania z wyraźnym działaniem na każdej karcie. Krótka instrukcja jest dostępna po rozwinięciu.
- Porównanie na szerokim monitorze: mapa i uzasadnienie obok listy artykułów. Przy mniejszej szerokości wraca układ pionowy.
- Artykuł: wygodna szerokość czytania, większy nagłówek, osobny panel wyniku i pochodzenia. Przycisk powrotu ma dodatkowy podpis.
- Ustawienia na komputerze są ułożone w dwie kolumny. Lista źródeł korzysta z siatki na szerokim ekranie.
- Obsługa myszy i klawiatury, kontrast etykiet w jasnym motywie, spokojne tło oraz spójne odstępy.

## Zachowanie na mniejszych ekranach

Ulepszenia komputerowe są aktywne od 1000 px. Na laptopach 1000–1199 px karty tematów są pionowe, aby nie ściskać tekstu. Porównanie i siatka źródeł przechodzą na dwie kolumny od 1240 px. Telefon zachowuje dotychczasową kolejność: konto/limit, pole analizy, postępy i tematy; dodatkowe treści komputerowe są ukryte.

## Utrzymanie

`desktop-ui.js` nadaje strukturę istniejącym kontrolkom i zachowuje ich zdarzenia. Nie kopiuje formularza ani nie tworzy dodatkowych zapytań. Nazwa użytkownika jest wstawiana jako tekst, nie HTML. `desktop-ui.css` zawiera wyłącznie warstwę komputerową. `app-layout.js` wywołuje dekorowanie po zbudowaniu ekranu. Wspólna obsługa okien i sesji pozostaje bez zmian.

## Weryfikacja

- 60 testów automatycznych oraz 34 scenariusze przeglądarkowe Chromium przechodzą.
- Sprawdzono 13 ścieżek ekranów przy rozmiarach 320×568, 390×844, 1280×900 i 1440×900 oraz dodatkowo pulpit laptopa przy 1024×768.
- Nowe scenariusze sprawdzają konto i ustawienia z menu, poprawne oznaczenie aktywnego działu, fokus po „Nowa analiza”, układ formularza i panelu, szerokość postępów, porównanie w dwóch kolumnach i niezmienioną kolejność na telefonie.
- Ręcznie obejrzano zrzuty pulpitu w jasnym/ciemnym motywie, porównania, artykułu, źródeł i ustawień.
- Bez rzeczywistych wywołań OpenAI ani Supabase; bez zmian bazy i sekretów. Testy rozmiarów używają Chromium, nie fizycznego Safari.

Pole analizy wyróżnia turkusowa ramka i delikatna poświata, etykieta „Analiza języka z AI” oraz dwa krótkie rozświetlenia, najwyżej raz podczas otwarcia strony. Fokus i pisanie kończą rozświetlenia. Ustawienia ograniczenia ruchu wyłączają animację. Wersja telefonu zachowuje poprzedni tekst podpowiedzi.
