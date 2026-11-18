# TRIAD Studio

Schmuck entwerfen ohne 3D-Kenntnisse. Eigenständige Website (UI auf Englisch), im Look der TRIAD-Hauptseite:
Lime `#C4EF2F` als einziger Akzent, Nachtmodus (Auto/Hell/Dunkel, gleiche Einstellung wie auf der Hauptseite),
Anton · Instrument Serif · Inter Tight · JetBrains Mono, kühle, neblige Stimmung.

**Kostenlos, ohne Login, ohne Kreditkarte:** GitHub Pages + ein kleiner Cloudflare Worker (Free Plan) nur für die KI-Bilder.

```
1. What?  →  2. Adjust  →  3. Save & share
```

## Bereiche

| | |
|---|---|
| **Ring** | Größe EU/US/mm (Umrechnung live), Profil flach/rund/D/gehämmert, Breite, Stärke, Siegelplatte, TRIAD „drei Zacken“, Gravur innen/außen |
| **Pendant** | Skizze/Foto hochladen → Umriss automatisch (Regler „Outline detection“) → 3D, Öse automatisch; 6 Startformen; „Fill inside“, „Line boldness“ |
| **Earrings** | Creolen (Durchmesser, Draht, Profil, Öffnung) oder Stecker (5 Formen, Stift 0,8 mm), als Paar |
| **Bangle** | Handgelenk-Umfang → Innenmaß, offene Cuff (Öffnung) oder geschlossen, Breite, Stärke, Profil, Gravur |
| **Chain** | Glied oval/rund/eckig, Gliedgröße, Draht, Länge in cm (Glieder greifen ineinander, 0,3 mm Spiel) |
| **Draw** | Zeichenfläche (Finger/Stift mit Druck/Maus), Pinsel, Radierer, 3 Stärken, Undo/Redo, Leeren, Foto als Hintergrund. 0,8 s nach dem letzten Strich: KI-Render daneben (Handy: darunter). Stile Silver/Chrome/Gold/Lime enamel/Frost/On skin + eigenes Textfeld, Regler „How close to my sketch“, „Build as 3D pendant“ |

Für alle 3D-Teile: Materialvorschau (Silber 925, Chrom, Gold, schwarzes Silber, Lime-Emaille als Akzent), drehen, Pinch-Zoom,
Doppeltipp = Zoom, Tasten (Pfeile, +/−) und Knöpfe für Tastatur-Bedienung.

**Ausgabe:** STL (mm, für 3D-Druck/Wachsguss), Instagram-PNG 1080×1350 (optional mit TRIAD-Schriftzug), Info-Karte (PNG) mit Maßen,
Gewicht je Material und Warnung bei Wandstärke unter 0,8 mm. Teilen per Link (alle Parameter in der URL, auch hochgeladene Umrisse),
lokal speichern (localStorage), **Send to TRIAD** → Einreichung im Darkroom der Hauptseite (bestehende Upload-API `POST /darkroom/submit`, Freigabe durch euch).

## Lokal starten

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # 14 Tests: Größen, Geometrie/Gewicht, Umrisserkennung, Worker (KI gemockt)
```

Mit KI lokal: `cd worker && npx wrangler dev` und `VITE_AI_URL=http://localhost:8787 npm run dev`.

## Veröffentlichen

Einrichtung Schritt für Schritt (GitHub Pages, Cloudflare, Variablen, Darkroom): [`docs/SETUP.md`](docs/SETUP.md).

## Aufbau

```
index.html                 Kopfzeile (← TRIAD), Footer (@triad.closet)
src/main.js                Startseite (leicht, ohne three.js), Router, Nachtmodus, Service Worker
src/styles.css             Design-Tokens wie TRIAD (Lime nur als Fläche, Lime-Ink #4F6800 als Text)
src/ui/controls.js         Regler mit Hilfe-Satz, −/+ und Zahlenfeld; Chips, Schalter, Ringgröße
src/jewellery/app.js       3-Schritte-Werkzeug, Teilen-Link, Speichern, Export
src/jewellery/types/*.js   Ring, Anhänger, Ohrringe, Armreif, Kette (Parameter + Geometrie + Prüfungen)
src/jewellery/revolve.js   Profil-Sweep (Ringe/Reifen/Creolen), Hammerschlag, Gravur, Volumen
src/jewellery/outline.js   Bild → Maske → Marching Squares → Umriss; Dünnstellen-Prüfung; Link-Kodierung
src/jewellery/viewer.js    three.js-Bühne (wird erst beim Öffnen eines Werkzeugs geladen)
src/jewellery/stl.js       Binär-STL
src/draw/app.js            Zeichenfläche + Live-Render
src/lib/send.js            Send to TRIAD (Darkroom)
worker/                    Cloudflare Worker „triad-studio-ai“ (Workers AI, Bild-zu-Bild)
public/                    PWA-Manifest, Service Worker, Icons, robots.txt (kein KI-Training)
```

**Ladezeit:** Startseite ≈ 13 kB JS + 18 kB CSS (gzip ≈ 9 kB). three.js (≈ 136 kB gzip) lädt erst, wenn ein Werkzeug geöffnet wird.

**Barrierefreiheit:** Touch-Flächen ≥ 44 px, alles per Tastatur, sichtbarer Fokus, ARIA-Labels und Live-Regionen,
Kontrast WCAG AA (Lime nur als Fläche mit schwarzer Schrift), `prefers-reduced-motion` schaltet Animationen/Dämpfung ab.

**Datenschutz:** keine Cookies, kein Tracking, kein Konto. Skizzen gehen nur zum Rendern an den Worker und werden nicht gespeichert.
Cloudflare nutzt Workers-AI-Ein-/Ausgaben nicht zum Training.

Hinweis: `npm audit` meldet eine Lücke in `picomatch` (nur Build-Werkzeug Vite, landet nicht auf der Website).
