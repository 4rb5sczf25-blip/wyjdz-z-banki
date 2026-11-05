# Informacja o prywatności — stan wdrożenia i decyzje administratora

Administrator wskazany przez operatora: Fundacja Prześwit. Kontakt: prywatnosc@wyjdzzbanki.pl.

To przegląd kodu, nie potwierdzenie pełnej zgodności z RODO. Informacja w aplikacji pozostaje oznaczona jako robocza. Dane publiczne administratora są w privacy-config.js; nie umieszczać tam sekretów.

## Co wiadomo z kodu

- Konto używa e-maila oraz opcjonalnego imienia/nicku (40 znaków). Nie ma hasła. Nick jest w Supabase Auth user_metadata.display_name, dostępny w panelu własnego konta; nie jest wysyłany jako metadane do OpenAI ani używany w demonstracyjnym rankingu. User metadata nie służą do kontroli uprawnień ani limitów.
- Gość ma pseudonimowy identyfikator i sesję Supabase. Dane nie są przez to anonimowe w rozumieniu RODO.
- Sesje i ustawienia pozostają w localStorage. Postępy, seria, zapisane porównania i zgłoszenia konta synchronizują się z user_data. Liczniki analiz/quizów, lista źródeł i identyfikatory obejrzanych materiałów oznaczają rejestrowanie części aktywności.
- Limity są zapisywane w analysis_quota według UID i dnia. Nie wdrożono automatycznego usuwania starych wierszy ani anonimowych kont.
- Opinie testerów zawierają komentarz, ocenę, czas, ekran, wersję i rozmiar okna. Zgłoszenia mogą zawierać cytat i trafiać do danych konta. Wolny tekst może zawierać dane osobowe; nie należy obiecywać anonimowości wszystkich opinii/logów.
- Zatwierdzony tekst linku, a także ręcznie wklejony tekst po uruchomieniu AI, trafia do OpenAI. Backend nie zapisuje celowo pełnych analiz w osobnej tabeli. Retencja u dostawcy zależy od warunków i ustawień konta OpenAI, których nie zweryfikowano.
- Vercel, Supabase, Google Fonts oraz przy pobieraniu adresu serwis wydawcy uczestniczą w przepływie danych technicznych. Nie zweryfikowano ustawień logów, regionów i umów. Kod nie dodaje trackerów reklamowych, ale nie oznacza to braku logów infrastruktury.
- Wylogowanie/reset nie usuwa konta i wszystkich danych w chmurze. Usuwanie/eksport konta nie jest samoobsługowe. Usunięcie auth.users usuwa user_data przez istniejący FK, lecz liczniki i opinie nie mają takiej relacji — wymagają osobnej obsługi.

## Przed uznaniem informacji za kompletną

Administrator powinien potwierdzić dane identyfikacyjne/kontaktowe (w tym adres właściwy dla fundacji), cele i podstawy z art. 6 RODO, okresy retencji kont, opinii, liczników, logów i kopii zapasowych; wdrożyć rzeczywiste usuwanie według tych zasad i procedurę realizacji praw, a nie tylko deklarację w polityce. Dla bezpieczeństwa i zapobiegania nadużyciom rozważyć oraz udokumentować prawnie uzasadniony interes; dla obsługi konta/żądanej usługi ocenić podstawę umowną. Nie zastępować tego obowiązkowym ogólnym checkboxem „zgadzam się na RODO”.

Potwierdzić umowy powierzenia i rolę każdego dostawcy, podwykonawców, regiony, transfery poza EOG i właściwe zabezpieczenia. Zwrócić uwagę na prywatne treści/poglądy polityczne w wejściu AI: dane szczególnych kategorii wymagają odrębnej oceny art. 9, samo nazwanie celu edukacyjnym nie rozwiązuje tej kwestii. Ocenić potrzebę DPIA, zasady udziału dzieci/testerów i obowiązki dla pamięci przeglądarki/czcionek według właściwych przepisów. Nick jest opcjonalny, co wspiera minimalizację.

Nie testowano rzeczywistych kont/maili ani OpenAI przy wdrażaniu tych zmian. Testy używają atrap usług. Nick nie wymaga nowej tabeli ani migracji SQL.

## Proponowany opis do dokumentu projektowego

Aplikacja umożliwia korzystanie jako gość lub przez konto z adresem e-mail i opcjonalnym imieniem albo nickiem. Logowanie odbywa się linkiem lub kodem z e-maila, bez hasła. Zbieramy dane potrzebne do obsługi konta, działania analizy, zapisywania postępów oraz ograniczania nadużyć. Nie wyznaczamy profili poglądów politycznych i nie prowadzimy reklamowego śledzenia. Rejestrujemy jednak postępy oraz liczniki użycia; sesje i dane techniczne mogą być powiązane z identyfikatorem użytkownika i nie są automatycznie anonimowe. Przy analizie AI tekst przekazywany jest do OpenAI. Szczegóły celów, podstaw prawnych, retencji i praw użytkownika określa informacja o prywatności po uzupełnieniu i zatwierdzeniu przez administratora.

Punkty odniesienia: RODO art. 5 (minimalizacja i retencja), 6 (podstawy), 9 (szczególne kategorie), 12–13 (przejrzystość/informowanie), 15–22 (prawa), 28 (powierzenie), 32 (bezpieczeństwo), 44 i nast. (transfery). Oficjalny tekst: https://eur-lex.europa.eu/eli/reg/2016/679/oj?locale=pl
