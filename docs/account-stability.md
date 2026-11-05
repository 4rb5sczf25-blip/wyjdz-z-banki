# Konta i synchronizacja — poprawki po audycie

Gałąź: `fix/account-sync-stability`. Zmiany nie wymagają nowego SQL ani nowych sekretów. Korzystają z istniejącej tabeli `user_data`, jej RLS i uprawnień SELECT/INSERT/UPDATE dla właściciela wiersza.

## Odpowiedzialność plików

- `account-session.js`: sesja, jej wersja, pojedyncze odnawianie tokenu, anulowanie i limity czasu transportu, potwierdzenie zapisu opinii.
- `account-data.js`: przestrzenie danych kont, migracja starego zapisu, jawne operacje zapisu, synchronizacja i konflikty.
- `auth-return.js`, `guest-session.js`, `profile.js`: poszczególne działania konta; każde sprawdza, czy sesja nadal jest aktualna.
- `quota-view.js`: odczyt licznika, zakończenie oczekiwania przy wygaśnięciu sesji; reset na podstawie czasu serwera.
- `index.html`: istniejące ekrany, formularze konta i opinie. Nie podmieniamy już `Storage.prototype.setItem`.

Nowe operacje dotyczące postępów zapisuj przez `accountWrite(key, value)`. Zastąpienie całego zbioru/reset: trzeci argument `true`. Nie zapisuj synchronizowanych kluczy bezpośrednio przez `localStorage`.

## Dane i pierwsze uruchomienie

Każde konto ma lokalną kopię pod `wzb-account:<uid>`. Sesje anonimowe też mają odrębne identyfikatory. Niezalogowane użycie lokalne ma przestrzeń `local-guest`. Klucze dawnych ekranów są tylko aktywnym widokiem danych aktualnego konta. Przy zmianie konta czyścimy również bieżący artykuł i zamykamy okna poprzedniego użytkownika. Powrót na to samo konto przywraca jego kopię. Dane gościa nie są automatycznie przenoszone na konto e-mail.

Stary zapis bez informacji o właścicielu trafia do **`wzb-legacy-data`** w tej samej przeglądarce. Nie jest automatycznie przypisywany ani wysyłany do żadnego konta. To może spowodować zniknięcie dawnych *lokalnych* postępów z ekranu; dane zapisane wcześniej na koncie wracają z Supabase. Kopię można odzyskać z narzędzi przeglądarki → pamięć lokalna → `wzb-legacy-data`. Nie ma jeszcze automatycznego importu tej kopii, ponieważ nie znamy jej właściciela.

Nowe postępy zaczynają się od zera, bez fikcyjnych 11 analiz. Reset obejmuje dane bieżącego konta i jest synchronizowany; nie usuwa konta ani serwerowego limitu AI. Ustawienia wyglądu i dźwięku pozostają ustawieniami urządzenia.

## Odporność na opóźnienia i konflikty

- Wylogowanie i zmiana konta unieważniają stare operacje, także analizę AI. Spóźniony wynik nie jest pokazywany ani zastępowany lokalną analizą w nowym koncie.
- Odnawianie tokenu i synchronizacja współdzielą bieżące zadanie w karcie. Web Locks serializują je również między kartami, jeżeli przeglądarka je udostępnia.
- Połączenia Supabase mają limit 15 s obejmujący również czytanie odpowiedzi. Błąd sieci nie usuwa ważnej sesji; odpowiedź 400/401/403 przy odnawianiu kończy tylko tę sesję, której dotyczyła.
- Synchronizacja używa poprzedniej wspólnej wersji danych: zachowuje nowe dodatki z drugiego urządzenia i uwzględnia lokalne usunięcia. Przy przeciwstawnych zmianach tego samego elementu usunięcie z urządzenia, które znało element, wygrywa nad jego niezmienioną kopią.
- PATCH porównuje `updated_at` odczytanego wiersza. Konflikt powoduje ponowny odczyt (maksymalnie trzy próby), nie ślepe nadpisanie.
- Niezatwierdzona operacja jest zapisana lokalnie. W `user_data.data.__wzbReceipts` serwerowy zapis zawiera ostatni identyfikator operacji dla losowego identyfikatora instalacji przeglądarki. To zapobiega podwójnemu naliczeniu postępów, gdy zapis się udał, ale odpowiedź zginęła. Ten znacznik służy synchronizacji, nie analityce ruchu. Nie usuwaj go przy innych zapisach do `user_data`.
- Nieudany zapis zachowuje zmiany do następnej synchronizacji. Formularz opinii pozostaje otwarty i zachowuje tekst przy błędzie. Sukces pokazujemy wyłącznie po odpowiedzi serwera; nie otwieramy dodatkowo poczty/udostępniania.

Web Locks wymagają obsługującej je przeglądarki i bezpiecznego kontekstu (HTTPS lub localhost). Bez nich pozostaje blokada w pojedynczej karcie, kontrola wersji sesji i porównanie wersji wiersza. Pełna serializacja między kartami nie jest wtedy gwarantowana.

## Weryfikacja

`npm test` oraz `npm run test:browser` działają na atrapach usług i lokalnym PostgreSQL/Chromium. Nie wywołują prawdziwego OpenAI ani Supabase. Testy obejmują zmianę konta, odnowienie po wylogowaniu, deduplikację, opóźniony odczyt, usuwanie, reset, konflikty, edycję podczas zapisu, utratę potwierdzenia po zapisie, błędy opinii i zegara oraz przeładowanie strony.

Przed publikacją warto wykonać na Preview ręczny test dwóch własnych kont oraz dwóch kart w Safari: logowanie, zapis zakładki, wylogowanie, drugie konto i powrót. Nie wymaga to analizy AI. Nie zweryfikowano tutaj konfiguracji działającego projektu Supabase ani fizycznego urządzenia Safari.
