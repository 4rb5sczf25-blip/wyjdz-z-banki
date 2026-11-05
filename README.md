# Wyjdź z bańki

Aplikacja HTML/JavaScript na Vercel. Konta użytkowników obsługuje Supabase.

## Analiza linku

1. Wybierz „Zaloguj się / Utwórz konto” lub „Kontynuuj jako gość” na ekranie powitalnym. Logowanie jest dostępne również na ekranie głównym i w Ustawieniach.
2. Wklej adres artykułu i wybierz „Analizuj wiadomość”. Serwer pobierze stronę i wyodrębni artykuł bez korzystania z OpenAI ani płatnego dostawcy ekstrakcji.
3. Sprawdź podgląd tekstu i ewentualnie go popraw. Jeśli artykuł był dłuższy niż 12 000 znaków, zobaczysz informację o skróceniu.
4. Dopiero „Zatwierdź i analizuj AI” wysyła tekst do GPT-4o-mini. „Anuluj” nie uruchamia AI.

Wklejanie własnego tekstu nadal działa: aplikacja próbuje analizy AI, a gdy nie jest ona dostępna, wykonuje dotychczasową analizę lokalną. Wynik lokalny jest tak oznaczony. Gość ma automatyczną sesję bez e-maila i 2 analizy AI dziennie. Analiza lokalna pozostaje dostępna bez limitu AI. Dla linku błąd AI pozostawia podgląd do edycji; nie udaje udanej analizy AI.

Pobieranie nie obsługuje paywalli, logowania do wydawcy ani stron wymagających JavaScript. Nie obchodzi zabezpieczeń serwisów; przy błędzie proponuje ręczne wklejenie tekstu. Adresy dostępne wyłącznie przez IPv6 oraz niestandardowe porty nie są obsługiwane. Samo pobranie nie kosztuje kredytów OpenAI, ale podlega limitom infrastruktury Vercel/Supabase. Analiza AI pozostaje płatna według cennika OpenAI.

## Włączenie na Vercel — po przeglądzie zmian

Zmiany przygotowano na osobnej gałęzi; nie wymagają łączenia z `main` do testowania wersji Preview.

1. W Supabase otwórz **SQL Editor** i wykonaj kolejno pliki `supabase/migrations/202611050001_analysis_quota.sql` i `supabase/migrations/202611050002_guest_quota.sql`. Jeśli pierwszy już wykonano, uruchom tylko drugi. Tworzy osobną tabelę limitów i funkcję; nie zmienia tabel kont, opinii ani postępów. Skrypt można wykonać ponownie.
2. W Vercel, **Project Settings → Environment Variables**, ustaw dla wybranego środowiska (najpierw Preview):
   - `OPENAI_API_KEY` — klucz OpenAI; jeśli już istnieje, zachowaj go.
   - `SUPABASE_URL` — `https://qvyrebelzifnwzmylgzr.supabase.co` (ten sam projekt co frontend).
   - `SUPABASE_SERVICE_ROLE_KEY` — klucz `service_role` z ustawień API tego projektu Supabase. To sekret serwera, nigdy klucz `sb_publishable_...` i nigdy wartość wklejana do `index.html` lub do rozmowy.
3. Utwórz wdrożenie Preview tej gałęzi. Vercel automatycznie obsługuje `api/article.js` i `api/analyze.js`. Repozytorium ustawia Node.js 24 i limit czasu funkcji 30 s w `vercel.json`; nie ma komendy budowania frontendu.
4. Sprawdź logowanie oraz pobranie i anulowanie podglądu na Preview. Prawdziwe kliknięcie „Zatwierdź i analizuj AI” korzysta już z płatnego API — automatyczne testy go nie wywołują.

W Supabase → Authentication → Sign In / Providers → Anonymous włącz **Allow anonymous sign-ins** i zapisz. Sesje gościnne nie wysyłają e-maili.

Bez sekretów lub migracji serwer odmawia pobierania i AI (zamiast pomijać limity). Analiza lokalna własnego tekstu nadal działa. Nie ma migracji ani wdrożenia wykonywanego automatycznie przez testy.

## Limity i zabezpieczenia

| Operacja | Na potwierdzone konto e-mail / dzień | Łącznie dla aplikacji / dzień | Odstęp na konto |
| --- | --- | --- | --- |
| Analiza AI — konto e-mail | 5 | 100 (wspólnie z gośćmi) | 30 sekund |
| Analiza AI — gość | 2 | 100 (wspólnie z kontami) | 30 sekund |
| Pobranie artykułu | 20 | 500 | 5 sekund |

Dni liczone są w UTC. Także nieudane próby po przyznaniu limitu zużywają limit, co ogranicza powtarzanie kosztownych operacji. Limity są transakcyjne i współdzielone przez instancje Vercel: wiersz globalny jest blokowany przed wierszem użytkownika. Funkcja `consume_analysis_quota_v2` odczytuje rodzaj konta z `auth.users`, a nie z danych przeglądarki. Funkcję może wywoływać wyłącznie rola serwera `service_role`. Zmianę limitów wykonuje się w migracji SQL; utrzymuj zgodność komunikatu w `article-flow.js`. W razie potrzeby można cyklicznie usuwać wiersze limitów starsze niż 30 dni. Warto także ustawić alerty kosztów OpenAI i ochronę ruchu w Vercel; limity aplikacji nie dotyczą innych aplikacji używających tego samego klucza OpenAI.

- Serwer potwierdza sesję w Supabase; nie ufa identyfikatorowi konta z przeglądarki. Awaria sprawdzania limitów blokuje wywołania, nie odblokowuje ich.
- Tekst: 25–12 000 znaków. Żądanie JSON: maksymalnie 50 000 bajtów (poza wcześniejszym limitem platformy). URL: maksymalnie 2048 znaków.
- GPT-4o-mini: jeden wynik, maksymalnie 1600 tokenów odpowiedzi, maksymalnie 12 fragmentów po 300 znaków (tytuł do 200 znaków). Limit czasu SDK: 18 s, automatyczne ponowienia wyłączone. Wynik ma ścisły schemat JSON i jest dodatkowo walidowany. Tekst artykułu trafia do wiadomości użytkownika, oddzielnie od instrukcji systemowej.
- Pobieranie: wyłącznie HTTP/HTTPS na standardowych portach, bez danych logowania, cookies, tokenów użytkownika czy dowolnych nagłówków przekazywanych wydawcy. Każde przekierowanie jest ponownie sprawdzane; maksymalnie 3, bez przejścia HTTPS → HTTP.
- Odrzucane są prywatne, lokalne, zarezerwowane i specjalne IPv4, również zapisane jako liczba lub w systemie szesnastkowym. DNS rozwiązuje tylko IPv4; wszystkie zwrócone adresy muszą być publiczne. Po walidacji połączenie jest przypięte do konkretnego IP, z zachowaniem nazwy Host/SNI i weryfikacji TLS. IPv6 jest celowo odrzucane, więc nie może służyć do obejścia kontroli.
- Pobieranie całej sekwencji ma limit 10 s, nagłówki 16 KiB, HTML 1 MiB. Przyjmowany jest wyłącznie HTML/XHTML bez kompresji; serwer prosi o `identity`, a skompresowaną odpowiedź odrzuca, aby uniknąć bomb dekompresji.
- Readability i JSDOM nie uruchamiają skryptów ani zewnętrznych zasobów strony. Ekstraktor ma limit 20 000 elementów DOM. Do klienta wraca zwykły tekst, wstawiany przez `textContent`/`value`, nigdy HTML wydawcy. Odpowiedzi API mają `Cache-Control: no-store`.

## Praca lokalna i testy

```sh
npm ci
npm test
npm run test:browser
```

Node.js 24. `npm test` uruchamia testy serwera, SSRF, ekstrakcji, atrap AI oraz migracji SQL w lokalnym PostgreSQL WASM (PGlite), bez konta i bez połączenia do produkcyjnej bazy. Testy przeglądarkowe wymagają Chromium (`CHROMIUM_BIN` pozwala podać ścieżkę); uruchamiają lokalny serwer z atrapami API i blokują połączenia do Supabase oraz Google Fonts. Testy nie wykonują prawdziwych wywołań OpenAI ani nie zapisują danych w Supabase. Testy PGlite sprawdzają logikę SQL i uprawnienia, ale nie zastępują testu obciążenia wielu rzeczywistych połączeń do wdrożonego Supabase.

Do pracy z prawdziwymi lokalnymi funkcjami Vercel użyj Vercel CLI (`vercel dev`) i wartości z `.env.example` zapisanych bezpiecznie w lokalnym, ignorowanym pliku `.env.local`. CLI nie jest wymagane do testów. Zwykły serwer statyczny (`python3 -m http.server 3000`) pozwala oglądać frontend i analizować lokalnie własny tekst, lecz nie wykonuje funkcji `api/`.

## Logowanie linkiem z e-maila

Aplikacja obsługuje standardowy link Supabase (`{{ .ConfirmationURL }}`) oraz kod jednorazowy, jeśli szablon go zawiera. Nie trzeba zmieniać szablonu wiadomości. Po kliknięciu linku aplikacja usuwa tokeny z adresu, potwierdza konto przez Supabase i zapisuje sesję. Kontynuuj pracę w karcie otwartej przez link.

W Supabase → Authentication → URL Configuration ustaw **Site URL** na adres aplikacji, a w **Redirect URLs** dodaj dokładny adres używanego wdrożenia Vercel z końcowym `/#Main` (np. `https://twoja-wersja.vercel.app/#Main`). Dla kolejnego adresu Preview trzeba dodać jego adres. Aplikacja wysyła `redirect_to` wskazujący aktualne wdrożenie. Jeżeli adres nie jest dozwolony, Supabase może wrócić do Site URL, gdzie również musi być wdrożona obsługa linków. Stare lub już użyte linki mogą wygasnąć; po zmianie ustawień poproś o nową wiadomość. Nie udostępniaj linków logowania, bo zawierają jednorazowe dane dostępu.

Sesja gościa jest zachowywana w tej przeglądarce, również po odświeżeniu i odnowieniu tokenu. Postępy gościa pozostają lokalnie; po zalogowaniu mogą zostać zsynchronizowane z kontem. Limit 2 analiz dotyczy sesji gościnnej w Supabase — usunięcie danych przeglądarki pozwala utworzyć nową tożsamość. Nadal obowiązują limity tworzenia anonimowych kont Supabase i wspólny limit 100 analiz dziennie. Nie próbujemy identyfikować urządzenia przez fingerprinting.

## Licznik i oznaczenie wyniku

Ekran główny odczytuje pozostałe analizy z serwera (`GET /api/quota`), bez zużywania limitu i bez nowej migracji SQL. Licznik odświeża się po próbie analizy, po powrocie na ekran główny, aktywacji okna i zmianie dnia UTC. Pokazuje limit osobisty; nadal obowiązuje wspólny limit aplikacji i odstęp między analizami. Przy błędzie odczytu nie pokazuje wymyślonej liczby. Nieudane próby, którym serwer wcześniej przyznał limit, również zużywają limit.

Wynik własnego tekstu ma etykietę „Analiza AI” lub „Analiza lokalna”. Przykłady są oznaczone „Materiał przykładowy”. Obok wyniku wyjaśniamy, że klasyfikacja może się mylić, a kategoria „fakt” nie jest weryfikacją prawdziwości.

Jeśli licznik zgłasza `quota_read_denied`, wykonaj `supabase/migrations/202611050003_quota_read_permission.sql` w SQL Editor. Skrypt jawnie nadaje `SELECT` wyłącznie roli `service_role`, używanej przez serwer. Nie dodaje dostępu do tabeli gościom ani użytkownikom i nie wyłącza RLS. W nowych instalacjach wykonaj wszystkie trzy migracje w kolejności.

## Nick i prywatność

Opcjonalny nick/imię (do 40 znaków) podaje się przy tworzeniu konta i można go później edytować lub wyczyścić w Ustawienia → Konto. Jest zapisany jako user_metadata.display_name w Supabase Auth, bez nowej migracji SQL. Istniejące konta zmieniają nick po zalogowaniu. Nick nie jest polem wejściowym dla modelu ani podstawą kontroli uprawnień.

Informacja o prywatności jest w Ustawieniach oraz formularzu logowania, przed wysłaniem e-maila. Administrator: Fundacja Prześwit, kontakt: prywatnosc@wyjdzzbanki.pl. Pozostaje wersją roboczą do czasu określenia podstaw prawnych, retencji oraz weryfikacji ustawień i umów z dostawcami. Publiczne dane administratora/uzupełnienia są w privacy-config.js. Przegląd rzeczywistych przepływów i proponowany opis projektu: docs/privacy-review.md. Samo dodanie informacji i nicku nie potwierdza zgodności z RODO.

## Przejrzystość porównań i źródeł

Przycisk „Dlaczego te artykuły?” wyjaśnia wspólny temat, ręczny dobór i kolejność demonstracyjnych materiałów. Zestawy nie są wynikiem automatycznego wyszukiwania rzeczywistych publikacji. Fikcyjne nazwiska autorów, daty i nieaktywne adresy w zarezerwowanej domenie `.example` są oznaczone jako demonstracyjne. Etykiety polityczne mapy nie są oceną prawdziwych redakcji.

„Źródło i oryginał” przy wyniku pokazuje metadane, adres oraz zakres analizy. Dla rzeczywistych linków ekstraktor odczytuje autora i datę publikacji ze strony, jeśli są dostępne; nie uzupełnia braków fikcyjnymi danymi. Informuje o skróceniu do 12 000 znaków, możliwości edycji podglądu i analizie maksymalnie 12 fragmentów. Przycisk otwarcia oryginału prowadzi do rzeczywistego adresu; demonstracyjne adresy są nieaktywne.

Pop-up metodologii opisuje nową metodę v2: niezależne flagi sprawdzalnego twierdzenia i opinii, intensywność języka emocjonalnego 0–3 oraz przypisanie głosu autora/cytatu/niepewności. Zamiast jednego ważonego procentu pokazujemy liczbę nacechowanych fragmentów i szczytową intensywność. Procenty na starej mapie demonstracyjnej pozostają ręcznie ustawioną makietą, nie wynikiem v2. Warianty AI, lokalny i demonstracyjny są wyraźnie rozróżniane.

## Wygląd i animacje

Efekty są w visual-polish.css i visual-polish.js. Karty pojawiają się przy wejściu w widok (dopiero po wejściu w obszar przewijania), a powrót do tego samego zestawu w danej sesji strony nie odtwarza ich ponownie. Mapa łagodnie wprowadza źródła i wyróżnia wybór. Nowy wynik ma jednoczesną animację segmentów paska. Oczekiwanie na analizę pokazuje subtelny sonar (rozchodzące się pierścienie) i opis czynności, bez symulowanego procentu ukończenia.

Pop-upy zachowują przewijanie i odstępy, z krótkim wysunięciem i płynnym zamknięciem. Efekty respektują ustawienie Animacje oraz systemowe prefers-reduced-motion. Wyłączenie animacji zatrzymuje nowe efekty WAAPI i odsłania oczekujące karty, zamiast zostawiać je niewidoczne. Testy przeglądarkowe sprawdzają jednorazowe animacje, anulowanie ruchu i statyczny sonar przy ograniczeniu ruchu; nie wywołują OpenAI.

## Eksperymentalna analiza v2

Wspólna logika próbkowania i podsumowania jest w analysis-method.js (bez usług sieciowych), prezentacja w analysis-details.js/css. Serwer dzieli tekst przez Intl.Segmenter na zdania, a zdania dłuższe niż 300 znaków na części. Do 12 jednostek wybiera równomiernie po pozycjach, uwzględniając początek i koniec, bez wybierania „najważniejszych” przez model. Osobny tytuł z podglądu zajmuje jedną jednostkę i nie wchodzi do statystyk treści. Każdy wynik ma identyfikator i pozycję w tekście. Dla krótkich tekstów analizowane są wszystkie jednostki; próbka nie gwarantuje wykrycia każdego mocnego fragmentu w pominiętej części.

GPT-4o-mini zwraca checkable i opinion jako niezależne wartości logiczne, emotion 0–3, voice (author/quoted/uncertain/none), dosłowny cue do 60 znaków oraz reason do 120 znaków. Kod odrzuca pominięte lub powtórzone ID, zmienione/zmyślone cytaty i błędne typy. Tekst w interfejsie pochodzi z oryginału, a nie z odpowiedzi modelu. Walidacja formatu i cytatu nie potwierdza poprawności interpretacji. Te same limity 12 000 znaków wejścia, 1600 tokenów wyjścia, 18 s i brak automatycznych ponowień. Nowa metoda nie wymaga migracji SQL.

Widoczne są: zasięg nacechowania (X z N fragmentów), maksimum 0–3, rozdzielenie przypisania autor/cytat/niepewne, zakres próbki, tytuł i wyjaśnienia. Sprawdzalne twierdzenia nie są wyróżniane na zielono. Kategorie mogą się nakładać, więc nie należy sumować ich do 100%. Dawny wzór 0,35 i ograniczenie 3–97% nie są używane dla nowych wyników. Pole pct pozostaje wewnętrznym adapterem zgodności i oznacza wyłącznie udział nacechowanych fragmentów próbki; nie jest prezentowane jako ocena manipulacji. Udostępnianie wyniku pokazuje nowe podsumowanie.

Tryb lokalny używa słów-kluczy i przy cytatach oznacza przypisanie jako niepewne; nie udaje oceny modelu. Fikcyjne artykuły mają etykiety demonstracyjne wyliczone tymi regułami, ale ich stara mapa procentowa jest jawnie makietą. Zestaw do oceny ludzi i ograniczenia: docs/analysis-v2.md i docs/calibration-v2.json. Nie wykonano płatnej kalibracji modelu ani nie deklarujemy trafności naukowej.

Wyjaśnienie oznaczonego fragmentu otwiera przewijane okienko nad całą aplikacją, bez przywiązania do pozycji zdania. Dzięki temu nie jest zasłaniane przez górę ekranu ani dolne menu. Zamknięcie przywraca fokus i pozycję w artykule.

Dźwięki Web Audio czekają na wznowienie kontekstu przed planowaniem sygnału, obsługują ponowny gest po przerwaniu odtwarzania i odtwarzają kontekst po jego zamknięciu. Wyłączenie Dźwięków wycisza tor główny; włączenie daje krótką próbkę. Ustawienia zawierają przycisk „Sprawdź dźwięk”. Testy w Chromium potwierdzają uruchomienie grafu dźwiękowego i wyciszanie; nie potwierdzają fizycznej słyszalności na urządzeniu użytkownika ani zachowania konkretnej wersji Safari.

Wyjaśnienie fragmentu pokazuje niezależne etykiety: neutralną dla sprawdzalnego twierdzenia, żółtą dla opinii i koralową dla emocjonalnego języka. Dosłowny cue jest podświetlany w cytacie i osobno pod nim; przy zbiegu opinii i emocji żółte tło łączy się z koralowym podkreśleniem. Brakującego cytatu nie wymyślamy. Reguły lokalne wskazują także marker opinii i opisują go jako opinię.

Głośność efektów obniżono przez SOUND_GAIN=.14. Kliknięcia reagują na pointerdown, bez czekania na puszczenie przycisku; sygnały starsze niż 100 ms są odrzucane zamiast odtwarzane po wybudzeniu. Obsługa audio ma limit oczekiwania na resume, odzyskiwanie kontekstu na kolejnym geście, czyszczenie zakończonych źródeł i zatrzymywanie dźwięków przy ukryciu karty. Ostateczna słyszalność zależy też od Safari, wyciszenia i urządzenia.

Efekt wody i bąbelków jest ponownie dostępny przy wejściu z ekranu powitalnego (przycisk gościa oraz logowanie kodem). Nie wyświetla ponownie ekranu logowania użytkownikom z zapamiętaną sesją. Pomija efekt przy ograniczeniu ruchu i usuwa płótno po zakończeniu; samouczek nie przykrywa animacji.
