# Metoda analizy v2 — prototyp do oceny

Celem jest pokazanie, gdzie występuje nacechowany język i jak silny może być, bez pojedynczej liczby sugerującej prawdę, obiektywizm czy manipulację. Twierdzenie sprawdzalne, opinia i emocjonalny język mogą współwystępować. Używamy skali 0 brak, 1 łagodne nacechowanie, 2 wyraźne wzmocnienie emocji, 3 silna deprecjacja/oburzenie/agresywna retoryka. To robocza rubryka, nie obiektywny pomiar.

Przykład: 10 fragmentów, w tym 2 bardzo mocne i 8 neutralnych, daje „2 z 10 fragmentów; najsilniejsze nacechowanie: silne”. Nie przeliczamy tego na 27% lub 60% manipulacji. Gdy dwa mocne fragmenty są cytatami, raportujemy je jako cytaty, a nie automatycznie jako język autora. Niepewne przypisanie jest oddzielną kategorią. Negatywne zdarzenie nie jest samo w sobie emocjonalnym językiem.

Próbka jest wybierana przez kod, równomiernie po pozycjach. Model otrzymuje wszystkie wybrane ID i ma ocenić każde z nich. Cytaty uzasadniające muszą dosłownie występować w jednostce. Tytuł jest opcjonalny i liczony osobno. Oryginalny tekst nie jest przepisywany przez AI. Fragmentowanie długich zdań i pomijanie części tekstu może usuwać ważny kontekst; model powinien wtedy używać przypisania uncertain. Nie można zakładać reprezentatywności ani pełnego wykrycia emocji dla całego artykułu.

## Jak oceniać prototyp

1. W docs/calibration-v2.json jest 24 fikcyjnych przykładów do przeglądu. Oczekiwania są roboczymi ocenami autora pliku, nie uzgodnionym standardem. Plik nie jest wynikiem modelu.
2. Co najmniej dwie osoby niezależnie oznaczają twierdzenie, opinię, intensywność i przypisanie wypowiedzi; sporne przypadki zostają zachowane i omówione. Osobno ocenić cytaty, ironię, nagłówki i neutralne relacje o negatywnych zdarzeniach.
3. Dopiero po uzyskaniu zgody na płatne testy porównać model z ocenami ludzi, w kilku powtórzeniach tych samych wejść. Dotychczasowe testy automatyczne używają atrap i nie mierzą jakości GPT-4o-mini.
4. Oceniać osobno zasięg emocji, intensywność i przypisanie autora. Notować fałszywe alarmy, pominięcia i rozbieżności osób; bez zbiorczej „trafności” na kilku przykładach.
5. Sprawdzić dłuższe artykuły z pominiętymi mocnymi fragmentami i opisać utratę kontekstu. Bez takiej oceny nie obiecywać pomiaru całej publikacji ani neutralności politycznej.

Limity kosztów i zabezpieczenia URL bez zmian. Nie wykonano rzeczywistych wywołań OpenAI podczas implementacji. Metoda jest na gałęzi testowej; stare procenty porównania fikcyjnych mediów pozostają jawnie oznaczoną makietą.

## Obsługa formatu odpowiedzi

Odpowiedź modelu jest obiektem z wymaganym kluczem dla każdego wskazanego ID, co ogranicza pomijanie fragmentów. Kod nadal sprawdza kompletność i poprawność typów. Drobne różnice prezentacyjne nie muszą kończyć całej analizy błędem: uzasadnienia są skracane do 120 znaków, zewnętrzne cudzysłowy i różnice białych znaków w cytacie są dopasowywane do dosłownego fragmentu źródła. Model proszony jest o cue do 60 znaków; dłuższy cytat może zostać zachowany tylko wtedy, gdy jest dosłownym fragmentem jednostki (maksymalnie 300 znaków). Nie wymyślamy cytatów. Przy dodatniej intensywności i voice=none stosujemy uncertain, nie author; przy zerowej intensywności voice nie ma zastosowania i jest none. Brakujące ID, niewłaściwe typy, intensywność poza 0–3 oraz nieobecne w tekście dowody nacechowania nadal są odrzucane.

W razie odrzucenia log zawiera wyłącznie kod walidacji, bez tekstu artykułu i odpowiedzi modelu. Nie wykonujemy automatycznych ponowień. Podgląd ma osobny przycisk „Analizuj lokalnie — bez AI”, który nie wywołuje endpointu płatnej analizy. Testy tej obsługi korzystają z atrap; bez rzeczywistej odpowiedzi modelu nie można stwierdzić, które pole spowodowało wcześniejszy ogólny komunikat.
