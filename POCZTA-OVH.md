# Powiadomienia z OVH bez EmailJS

Aplikacja wysyła wiadomości przez SMTP OVH za pomocą funkcji Firebase w regionie `europe-west1`. Hasło skrzynki jest przechowywane w Secret Manager; nie trafia do plików strony, GitHuba ani ustawień Firestore.

## Pierwsze uruchomienie

Wymagane są Node.js 22 lub nowszy, Firebase CLI, uprawnienia do projektu `narwikpromotionapp` oraz plan Firebase Blaze. Cloud Functions i Secret Manager mogą powodować opłaty zgodnie z planem projektu.

1. W folderze repozytorium wykonaj `npm --prefix functions install`.
2. Zaloguj Firebase CLI do konta mającego dostęp do projektu: `firebase login`.
3. Zapisz hasło skrzynki interaktywnie: `firebase functions:secrets:set OVH_SMTP_PASSWORD --project narwikpromotionapp`. Wpisz hasło wyłącznie do tego bezpiecznego monitu.
4. Wdróż nowe funkcje: `firebase deploy --only functions:narwik-mail --project narwikpromotionapp`.
5. Wdróż stronę: `firebase deploy --only hosting --project narwikpromotionapp`.
6. Zaloguj się w aplikacji jako główny administrator. W panelu „Powiadomienia z poczty OVH” podaj adres skrzynki, nazwę nadawcy i serwer SMTP. Zapisz ustawienia, a następnie wybierz „Wyślij test”. Test trafia na adres zalogowanego administratora i działa także przy wyłączonych powiadomieniach.
7. Po udanym teście włącz wysyłkę i wybrane rodzaje powiadomień, a następnie ponownie zapisz ustawienia.

Dla MX Plan w Europie domyślny serwer to `smtp.mail.ovh.net`, port `465` z SSL/TLS. Obsługiwany jest też port `587` z wymuszonym STARTTLS. Dla Email Pro, Exchange lub skrzynki w innej lokalizacji użyj serwera wskazanego przez OVH dla tej skrzynki. Loginem SMTP jest pełny adres wpisanej skrzynki. Skrzynka nadawcza i konto SMTP są tym samym kontem.

Konfigurację mogą zmieniać wyłącznie główni administratorzy. Wysyłka wymaga zweryfikowanego konta i roli głównego administratora, administratora lub zarządu SM. Serwer sprawdza te uprawnienia samodzielnie, odbiorcę w zespole, rodzaj powiadomienia i limity: 80 wiadomości na godzinę na administratora, 160 łącznie na aplikację. Konta zablokowane są wykluczone. Nieudane próby również zużywają limit.

Ustawienia są przechowywane w `ustawienia/poczta_ovh`, a liczniki w `poczta_limity`. Funkcje używają Admin SDK, dlatego nie wymagają otwierania tych dokumentów dla przeglądarki. Zachowaj ograniczenia dostępu do konfiguracji i ról w istniejących regułach Firestore. `firebase.json` nie wdraża i nie zastępuje istniejących reguł bazy ani Storage.

Zmiana hasła wymaga ponownego ustawienia sekretu i wdrożenia funkcji. Wysyłka testowa i połączenie z rzeczywistą skrzynką wymagają skonfigurowanych danych; lokalne testy nie wysyłają wiadomości.

## Weryfikacja kodu

`node --test tests/*.test.mjs functions/test/*.test.cjs`

Wydarzenia w obecnym modelu mają datę bez godzin. Sekcja „Dziś — trwające wydarzenia” pokazuje wszystkie wydarzenia z dzisiejszą datą. Zadania są wykluczone. Kalendarz pokazuje dwie nazwy na dzień i liczbę pozostałych; pełną listę można otworzyć przyciskiem daty lub „więcej”.

Źródła: [konfiguracja SMTP OVH](https://github.com/ovh/ovhcloud-docs/blob/develop/docs/en/guides/web-cloud/web-hosting/email-sending-best-practices.mdx), [funkcje wywoływane z aplikacji](https://firebase.google.com/docs/functions/callable), [sekrety Firebase](https://firebase.google.com/docs/functions/config-env?gen=2nd).
