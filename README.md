# TRIAD — Digital Fashion & Culture Collective

Independent magazine, fashion news desk and visual archive.
**Live:** https://omarkullab59-alt.github.io/Triad-/

```
HOME · MAGAZINE · NEWS · ARCHIVE · STUDIO · ABOUT
```

## Auf dem PC ansehen / lokal starten

Voraussetzung: [Node.js](https://nodejs.org) ab Version 18. Keine weiteren Pakete nötig.

```bash
git clone https://github.com/omarkullab59-alt/Triad-.git
cd Triad-
npm run dev        # → http://localhost:4321  (baut automatisch neu bei jeder Änderung)
```

Jeder Push auf `main` baut die Seite über GitHub Actions und veröffentlicht sie auf GitHub Pages.

## Inhalte bearbeiten (ohne Code)

| Was | Wo |
| --- | --- |
| Magazin-Artikel | `content/magazine/*.md` – eine Datei pro Artikel |
| Fashion News | `content/news/*.md` – eine Datei pro Meldung |
| Archiv / Moodboard | `content/archive.json` |
| Ausgaben (Covers) | `content/issues.json` |
| Featured Creatives | `content/creatives.json` |
| Hero-Bilder, Texte, Social Links | `content/site.json` |
| Eigene Bilder | `static/uploads/` → im Text als `/uploads/datei.jpg` |

**Neuen Artikel anlegen:** auf github.com in `content/magazine/` → *Add file* → z. B. `mein-artikel.md`:

```markdown
---
title: Titel
deck: Kurzer Untertitel.
category: Streetwear
date: 2026-12-01
author: Words by …
issue: "004"
cover: /uploads/cover.jpg
featured: true
gallery:
  - /uploads/bild1.jpg
  - /uploads/bild2.jpg
---
Text. **Fett**, *kursiv*, [Link](https://…)

## Zwischenüberschrift

> Ein großes Zitat. — Name

![Bildbeschreibung](/uploads/bild.jpg "Bildunterschrift")

:::gallery
![](/uploads/a.jpg "Caption A")
![](/uploads/b.jpg "Caption B")
:::
```

Speichern (Commit) → nach ca. 1 Minute ist der Artikel live.

**News:** gleiches Prinzip. `sample: true` zeigt den Hinweis „fiktiver Beispieleintrag“ – bei echten Meldungen weglassen oder `false` setzen. Alle mitgelieferten News sind fiktive Platzhalter und so gekennzeichnet.

### Visuelle Editoren (ohne Code, auch am Handy)

- **Pages CMS:** https://app.pagescms.org → mit GitHub anmelden → Repo `Triad-` (Konfiguration: `.pages.yml`)
- **Sveltia CMS** auf der eigenen Seite: `/admin/` → „Sign in with Token“ (Konfiguration: `static/admin/config.yml`)

Schritt-für-Schritt-Anleitung: [`docs/REDAKTION.md`](docs/REDAKTION.md)

### News von anderen Magazinen („Elsewhere“)

`scripts/fetch-wire.mjs` liest alle 3 Stunden die RSS-Feeds aus `content/sources.json` (kein API-Key) und zeigt Schlagzeile + Quelle + Link. Läuft automatisch in GitHub Actions; lokal: `node scripts/fetch-wire.mjs`.

### TRIAD Studio (`/studio/`)

Eigene App im Ordner [`studio/`](studio/README.md): Schmuck, Teller, Besteck, Schränke, eigene Symbole und Schriften, Skizze → 3D,
3D-Upload, Destroy-Modus, Zeichnen mit KI-Live-Bild. Wird beim Deploy automatisch mitgebaut. Einrichtung der KI: [`studio/docs/SETUP.md`](studio/docs/SETUP.md).

### Finder mit KI- & Foto-Suche

Finder (`/finder/`) sucht auf Vinted, Grailed, eBay & Co. Optional mit Foto- und KI-Erkennung über einen Cloudflare Worker + Claude Haiku: Einrichtung in [`docs/KI-FINDER.md`](docs/KI-FINDER.md).

## Architektur

```
content/          Inhalte (Markdown + JSON)  ← hier wird gepflegt
src/css/main.css  Design-System (Farben, Typo, Raster, Animationen)
src/js/main.js    Interaktionen (Übergänge, Cursor, Filter, Lightbox …)
scripts/
  build.mjs       Static-Site-Generator (ohne Abhängigkeiten)
  lib/brand.mjs   Emblem, Plus-Glyph, Stempel, Logo-Dateien (alles SVG)
  lib/components  Wiederverwendbare Editorial-Komponenten
  lib/pages.mjs   Seiten-Templates
static/           Dateien, die 1:1 kopiert werden (Icons, Admin, Uploads)
dist/             Ergebnis des Builds (nicht im Repo)
```

- **SEO:** jede Seite eigenes HTML mit Title, Description, Canonical, Open Graph, JSON-LD, `sitemap.xml`, `feed.xml` (RSS).
- **Performance:** kein Framework, Bilder lazy mit `srcset`, ein CSS- und ein JS-File.
- **App-ready:** installierbare PWA (Manifest + Service Worker, offline lesbar). Zusätzlich JSON-API unter `/api/articles.json`, `/api/news.json`, `/api/archive.json`, `/api/site.json` – eine spätere native App (z. B. React Native / Capacitor) kann direkt darauf zugreifen.
- **Barrierefreiheit:** Skip-Link, Tastaturbedienung für Menü/Lightbox/Filter, `prefers-reduced-motion` wird respektiert.

## Qualität & Tests

```bash
pip install playwright && python3 -m playwright install chromium
npm run dev &                       # Seite lokal starten
python3 tests/usability_audit.py    # Kontrast, Klickflächen, Tastatur, Ladezeit, Nutzeraufgaben
```

Ergebnisse, Studien und Quellen: [`docs/USABILITY.md`](docs/USABILITY.md)

## Brand

Farben: Weiß `#FBFAF8` · TRIAD-Orange `#FF5A00` · Schwarz `#0A0A0A` · Wash `#EFEDE8` · Silber `#8D8F93`
Schriften: Anton (Headlines) · Instrument Serif (Editorial) · Inter Tight (Text) · JetBrains Mono (Labels)

Symbole: Drachen-Emblem (vorläufig), Plus-Dreieck-Glyph, orange Plus-Marken, Archiv-Stempel, Codes (`TRD-MAG-003-07`, `TRD-ARC-016`).

**Symbolbibliothek** (`SYMBOLS` in `scripts/lib/brand.mjs`, sichtbar auf /about/#symbols, Downloads `/assets/brand/symbol-*.svg`):
Borromäische Ringe · Feuer · Luft · Erde · Wasser (Alchemie-Dreiecke) · Sierpiński-Dreieck · Tonnetz · Dreiklang · Pyramide · Delta.
Einsatz: Navigation (Magazine = Feuer, News = Luft, Archive = Sierpiński, About = Ringe), die drei Kräfte (Form = Erde, Signal = Luft, Image = Feuer), Abschnittsmarken, Archiv.
Neues Symbol: Funktion in `brand.mjs` schreiben und in `SYMBOLS` eintragen – es erscheint automatisch in der Bibliothek und als Download.
Das Emblem steckt komplett in `scripts/lib/brand.mjs` → `emblem()` und lässt sich dort zentral austauschen. Downloads aller Logo-Dateien: `/assets/brand/*.svg`.

> Die aktuellen Fotos sind Platzhalter (picsum.photos) und werden durch eigene Shootings ersetzt.
