# Wyjdź z bańki

Aplikacja HTML/JavaScript na Vercel. Konta użytkowników obsługuje Supabase.

## Analiza linku

1. Zaloguj się w aplikacji (Ustawienia → Konto).
2. Wklej adres artykułu i wybierz „Analizuj wiadomość”. Serwer pobierze stronę i wyodrębni artykuł bez korzystania z OpenAI ani płatnego dostawcy ekstrakcji.
3. Sprawdź podgląd tekstu i ewentualnie go popraw. Jeśli artykuł był dłuższy niż 12 000 znaków, zobaczysz informację o skróceniu.
4. Dopiero „Zatwierdź i analizuj AI” wysyła tekst do GPT-4o-mini. „Anuluj” nie uruchamia AI.

Wklejanie własnego tekstu nadal działa: aplikacja próbuje analizy AI, a gdy nie jest ona dostępna, wykonuje dotychczasową analizę lokalną. Wynik lokalny jest tak oznaczony. Bez logowania dostępna jest analiza lokalna. Dla linku błąd AI pozostawia podgląd do edycji; nie udaje udanej analizy AI.

Pobieranie nie obsługuje paywalli, logowania do wydawcy ani stron wymagających JavaScript. Nie obchodzi zabezpieczeń serwisów; przy błędzie proponuje ręczne wklejenie tekstu. Adresy dostępne wyłącznie przez IPv6 oraz niestandardowe porty nie są obsługiwane. Samo pobranie nie kosztuje kredytów OpenAI, ale podlega limitom infrastruktury Vercel/Supabase. Analiza AI pozostaje płatna według cennika OpenAI.

## Włączenie na Vercel — po przeglądzie zmian

Zmiany przygotowano na osobnej gałęzi; nie wymagają łączenia z `main` do testowania wersji Preview.

1. W Supabase otwórz **SQL Editor** i wykonaj plik `supabase/migrations/202611050001_analysis_quota.sql`. Tworzy osobną tabelę limitów i funkcję; nie zmienia tabel kont, opinii ani postępów. Skrypt można wykonać ponownie.
2. W Vercel, **Project Settings → Environment Variables**, ustaw dla wybranego środowiska (najpierw Preview):
   - `OPENAI_API_KEY` — klucz OpenAI; jeśli już istnieje, zachowaj go.
   - `SUPABASE_URL` — `https://qvyrebelzifnwzmylgzr.supabase.co` (ten sam projekt co frontend).
   - `SUPABASE_SERVICE_ROLE_KEY` — klucz `service_role` z ustawień API tego projektu Supabase. To sekret serwera, nigdy klucz `sb_publishable_...` i nigdy wartość wklejana do `index.html` lub do rozmowy.
3. Utwórz wdrożenie Preview tej gałęzi. Vercel automatycznie obsługuje `api/article.js` i `api/analyze.js`. Repozytorium ustawia Node.js 24 i limit czasu funkcji 30 s w `vercel.json`; nie ma komendy budowania frontendu.
4. Sprawdź logowanie oraz pobranie i anulowanie podglądu na Preview. Prawdziwe kliknięcie „Zatwierdź i analizuj AI” korzysta już z płatnego API — automatyczne testy go nie wywołują.

Bez sekretów lub migracji serwer odmawia pobierania i AI (zamiast pomijać limity). Analiza lokalna własnego tekstu nadal działa. Nie ma migracji ani wdrożenia wykonywanego automatycznie przez testy.

## Limity i zabezpieczenia

| Operacja | Na potwierdzone konto e-mail / dzień | Łącznie dla aplikacji / dzień | Odstęp na konto |
| --- | --- | --- | --- |
| Analiza AI | 5 | 100 | 30 sekund |
| Pobranie artykułu | 20 | 500 | 5 sekund |

Dni liczone są w UTC. Także nieudane próby po przyznaniu limitu zużywają limit, co ogranicza powtarzanie kosztownych operacji. Limity są transakcyjne i współdzielone przez instancje Vercel: wiersz globalny jest blokowany przed wierszem użytkownika. Funkcję może wywoływać wyłącznie rola serwera `service_role`. Zmianę limitów wykonuje się w migracji SQL; utrzymuj zgodność komunikatu w `article-flow.js`. W razie potrzeby można cyklicznie usuwać wiersze limitów starsze niż 30 dni. Warto także ustawić alerty kosztów OpenAI i ochronę ruchu w Vercel; limity aplikacji nie dotyczą innych aplikacji używających tego samego klucza OpenAI.

- Serwer potwierdza sesję w Supabase; nie ufa identyfikatorowi konta z przeglądarki. Awaria sprawdzania limitów blokuje wywołania, nie odblokowuje ich.
- Tekst: 25–12 000 znaków. Żądanie JSON: maksymalnie 50 000 bajtów (poza wcześniejszym limitem platformy). URL: maksymalnie 2048 znaków.
- GPT-4o-mini: jeden wynik, maksymalnie 1600 tokenów odpowiedzi, maksymalnie 12 zdań po 300 znaków. Limit czasu SDK: 18 s, automatyczne ponowienia wyłączone. Wynik ma ścisły schemat JSON i jest dodatkowo walidowany. Tekst artykułu trafia do wiadomości użytkownika, oddzielnie od instrukcji systemowej.
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
