# TRIAD — Usability-Testläufe & Optimierung

Stand: 16.11.2026 · Test: `python3 tests/usability_audit.py http://localhost:4321`
(7 Seiten × Desktop 1440 px + Handy 390 px, plus simulierte Nutzeraufgaben)

## Ergebnis vorher → nachher

| Prüfung | Vorher | Nachher |
| --- | --- | --- |
| Inhalt sichtbar nach Laden | 650–960 ms (Lade-Vorhang wartete auf Schriften) | 65–190 ms |
| Verzögerung pro Klick (Seitenübergang) | 0,67 s | 0,38 s |
| Kontrastfehler Text (WCAG 1.4.3) | bis 48 pro Seite | 0 (außer bewusstem Scroll-Effekt + dekorativem SVG-Ring) |
| Klickflächen < 24 px (WCAG 2.5.8) | 8–12 pro Seite | 0 |
| Bewegung ohne Pause (WCAG 2.2.2) | Startseite, Artikel, About | Schalter „Motion on/off“ im Header, merkt sich die Wahl |
| `prefers-reduced-motion` | 8 laufende Animationen | 0 |
| Navigation auf dem Handy | nur hinter „Index“ versteckt | sichtbare Tab-Leiste unten + Menü |
| Hero | Auto-Karussell (3 Bilder, alle 6 s) | ein Kampagnenbild pro Besuch, kein Auto-Wechsel |
| Layout-Verschiebung (CLS) | 0 | 0 |
| JS-Fehler | 0 | 0 |
| Nutzeraufgaben | 7/7 gelöst | 7/7 gelöst, schneller |

## Grundlagen (Studien & Standards)

- **Versteckte Navigation** (Hamburger) halbiert laut NN/g-Studie mit 179 Teilnehmern fast die Auffindbarkeit von Inhalten → sichtbare Tab-Leiste auf dem Handy. https://www.nngroup.com/articles/hamburger-menus/
- **Auto-Karussells** werden übersehen (Banner-Blindheit); Notre Dame: ca. 1 % Klickrate. → kein Auto-Wechsel. https://cxl.com/blog/dont-use-automatic-image-sliders-or-carousels/
- **WCAG 2.2.2 Pause, Stop, Hide**: Bewegung > 5 s braucht eine Pause-Möglichkeit. https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide
- **WCAG 2.5.8 Target Size**: mind. 24 × 24 px. https://dequeuniversity.com/resources/wcag-2.2
- **Kontrast** 4,5:1 (normal) / 3:1 (groß); NN/g: kontrastarmer Text ist schwer lesbar. https://www.nngroup.com/articles/low-contrast/
- **Core Web Vitals**: LCP ≤ 2,5 s, INP ≤ 200 ms, CLS ≤ 0,1. https://web.dev/articles/defining-core-web-vitals-thresholds
- **Ladezeit**: Absprungwahrscheinlichkeit +32 % von 1 s auf 3 s (Google). https://thinkwithgoogle.com/data/page-load-time-statistics
- **Animationsdauer** 100–500 ms (NN/g). https://nngroup.com/articles/animation-duration
- **Zeilenlänge** 50–75 Zeichen (Baymard); auf dem Handy darf es kürzer sein. https://baymard.com/blog/line-length-readability
- **Bewegungsempfindlichkeit** (vestibuläre Störungen): Parallax und große Übergänge reduzieren. https://web.dev/prefers-reduced-motion
- **BFSG** (seit 28.06.2025): Barrierefreiheitspflicht für bestimmte Verbraucher-Websites; Kleinstunternehmen mit Dienstleistungen sind ausgenommen — sobald TRIAD verkauft (Shop), relevant.

## Farbregel (TRIAD Orange)

- `#FF5A00`: Flächen, Tape, Textmarker, Symbole, Plus-Marken; auf Schwarz auch Schrift.
- `#B83C00`: kleine farbige Schrift auf Weiß (5,5:1).
- Schwarz auf Orange: 6,3:1.
- Hintergrund und Regeln: [`BRAND-COLOR.md`](BRAND-COLOR.md)

## Offen / nächste Schritte

1. Echte Fotos: in WebP/AVIF, max. ~300 KB pro Bild → LCP mit echten Bildern messen (PageSpeed Insights nach Livegang).
2. Mit 5 echten Personen testen (NN/g: 5 Nutzer finden die meisten Probleme) — Aufgaben aus `tests/usability_audit.py` übernehmen.
3. Analyse-Tool datenschutzkonform (z. B. Plausible) für echte Nutzungsdaten.
