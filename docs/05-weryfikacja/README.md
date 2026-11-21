---
wersja: 0.1.0
aktualizacja: 2026-11-21
status: dokumentacja przygotowawcza
---

# Plan weryfikacji COI

Stan: brak implementacji i pomiarów jakości.

1. Użyj dwóch referencji JSON do budowy mapowania. Zachowaj ich status jako znanych przykładów.
2. Testuj osobno treść, strukturę, reguły biznesowe i wygląd wygenerowanej e-usługi.
3. Różne formaty tego samego formularza trzymaj w jednej grupie testowej. Unikaj przenikania treści pomiędzy zbiorem rozwojowym i kontrolnym.
4. Sprawdź każdy wymagany format, także stary DOC i skan.
5. Sprawdź przepływ, sekcje, wymagane pola, słowniki, stany JSONata i stronę końcową.
6. Sprawdź MIME, rozszerzenie, nazwę, rozmiar, czas przetwarzania i usunięcie pliku po błędzie.
7. Uruchom aplikację z przygotowanymi zasobami przy wyłączonym dostępie do Internetu.
8. Sprawdź nowy formularz bez ręcznej zmiany wyniku przez autorów.

Schemat JSON z paczki jest zbyt ogólny, by sam potwierdzał zgodność z regułami. Podgląd ma wynikać z wygenerowanego JSON, nie z osobno zakodowanego przykładu.

`python3 scripts/verify_docs.py` kontroluje wyłącznie dokumentację i materiały.
