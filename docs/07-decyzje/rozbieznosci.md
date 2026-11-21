---
wersja: 0.1.0
aktualizacja: 2026-11-21
status: dokumentacja przygotowawcza
---

# Rozbieżności COI

| Temat | Obserwacja | Działanie |
|---|---|---|
| Sekcja powtarzająca | schemat i opis pól zawierają repetingSectionGrid; fragmenty reguł używają repeatingSectionGrid | potwierdzić mapowanie |
| Sekcja zgód | opis pól ma CONSENT_SECTIOM, tabela komponentów CONSENT_SECTION | zachować oryginał, wyjaśnić kontrakt |
| Strony | opis reguł używa main/finish, opis pól MAIN/FINISH | potwierdzić wielkość liter |
| Siła schematu | JSON Schema nie koduje pełnych ograniczeń biznesowych | osobna walidacja semantyczna |
| Rozszerzenia | numeracja kryteriów nie pokrywa się w pełni z listą funkcji | potwierdzić punktację |
| Format obrazów | w paczce jest .JPE, opis wymaga JPG/JPEG/PNG | nie rozszerzać domyślnie kontraktu bez decyzji |
| Tokeny i API | tokeny do pracy nad rozwiązaniem; zakaz zależności runtime od zewnętrznych API | oddzielić development od aplikacji |

Obserwacje nie stanowią automatycznej poprawki do specyfikacji. Materiały źródłowe pozostają niezmienione.
