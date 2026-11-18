# TRIAD Studio

Schmuck, Geschirr, Besteck und Möbel entwerfen ohne 3D-Kenntnisse. Eigene App im TRIAD-Repo, live unter
**https://omarkullab59-alt.github.io/Triad-/studio/** (UI auf Englisch), im Look der TRIAD-Hauptseite:
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
| **Lettering** | Namen/Wörter in jeder Schrift: Japanisch, Arabisch (rechts nach links), Russisch, Chinesisch, Koreanisch, Hebräisch, Hindi, Thai, Armenisch, Georgisch; Gotik, Glitch, Schreibmaschine, Marker; **eigene Schriftdateien hochladen** (TTF/OTF/WOFF) |
| **Plate** | mit Rand / Coupe / tief, Durchmesser, Höhe, Wandstärke, Rand rund/wellig/facettiert/TRIAD-Zacken, Standring |
| **Bowl · Cup · Vase** | Schale, Tasse, Becher, Vase: Öffnung, Höhe, Bauch, Hals, Henkel, Fassungsvermögen in ml |
| **Cutlery** | Gabel, Messer, Löffel oder 3er-Set: Länge, Griffbreite, Stärke, Griffende (rund/spitz/TRIAD-Zacken), Zinken, Biegung |
| **Cabinet** | Sideboard, Schrank, Regal, Kommode: B×H×T, Böden, Türen, Schubladen, Plattenstärke, Füße/Sockel, Griffe |
| **Symbol** | Eigene Zeichen/Logos entwerfen: Pinsel, 10 Grundformen, Text (alle Schriften), Bild hochladen, Hinzufügen/Ausschneiden, Symmetrie (gespiegelt, 4×, 3× TRIAD, 6×). Eigene Bibliothek auf dem Gerät → Anhänger, Stecker, Ring-Oberseite, 3D-Objekt |
| **Sketch to 3D** | Bild/Skizze/Design → flacher Ausschnitt, Relief (dunkel = hoch) oder gedrehtes Objekt (Vase/Becher aus der Silhouette, massiv oder hohl) |
| **Upload 3D** | Eigene STL/OBJ/GLB/GLTF/PLY öffnen und weiterbearbeiten: Größe, Drehen, Material, Destroy-Modus, Export |
| **Crown · Tiara · Mask** | Krone (Muster rundum wiederholt), Tiara (vorne), Maske (Gesicht gewölbt, Riemen-Schlitze). Vorlagen, Motive (Flammen, Dornen, Totenkopf …) oder **eigene Zeichnung** aus Draw/Symbol/Upload → in 3D gebogen. Kopfumfang, Höhe, Stärke, Wiederholungen, Grundband, Öffnung nach oben |
| **Sculpture** | Figur in 10 Posen (Stehen, Kontrapost, Arme hoch, Denker, Knien, Tanzen, Gehen, Kämpfer, Meditieren, Greifen), Schlange (zusammengerollt, aufgerichtete Kobra, kriechend, Ouroboros), Drache (zusammengerollt, aufbäumend, fliegend, schlafend), Büste, Hand (6 Gesten), abstrakt (Ring, drei Ringe, Spirale, Steine, Gitterkugel, Bogen). Körperbau, Drehung, Neigung, Detail/facettiert, Sockel rund/eckig/Fels. Bronze, Marmor, Gips, Terrakotta … |
| **Draw** | Zeichenfläche (Finger/Stift mit Druck/Maus), Pinsel, Radierer, 3 Stärken, Undo/Redo, Leeren, Foto als Hintergrund. 0,8 s nach dem letzten Strich: KI-Render daneben (Handy: darunter). Stile Silver/Chrome/Gold/Lime enamel/Frost/On skin + eigenes Textfeld, Regler „How close to my sketch“, „Build as 3D pendant“ |

**Gravieren & Prägen (für alles, wie ein Stempel/Displace in Blender):** Text (alle Schriften/Sprachen), Motiv (Schlange, zusammengerollte Schlange,
Ouroboros, Kobra, Drache, TRIAD-Drachen, Totenkopf, Rose, Flammen, Blitz, Dornenranke, Stacheldraht, Flügel, Auge, Mond, Sonne, gotisches Kreuz,
TRIAD-Zeichen, Elemente, Sierpiński, drei Ringe), eigenes Symbol oder Bild. Seite vorne/hinten/oben/unten/links/rechts/rundherum, Größe, Position,
Drehung, Tiefe, eingraviert oder erhaben, optional mit Lime-Emaille gefüllt. Steckt in der STL.

**Verkaufen (Order this piece):** Preis-Schätzung nach Material, Gewicht, Gravur, Finish und Stückzahl; Anfrage per E-Mail oder Instagram-DM
mit allen Angaben und Link zum Entwurf. „Copy shop link“ erzeugt einen Link, der direkt im Bestell-Dialog landet, z. B. für Instagram-Posts.
Preise und Kontakt stehen in [`public/pricing.json`](public/pricing.json) (ohne Code änderbar).

**Destroy-Modus (für alles):** Zerstörung in % (erodiert, gerissen, abgeplatzt, geschmolzen oder alles), Schmutz & Patina in %,
„New random damage“. Steckt auch in der STL-Datei (der Schmutz nur in der Vorschau/den Bildern). Warnung, wenn die Wand zu dünn wird.

Für alle 3D-Teile: Materialvorschau (Silber 925, Chrom, Gold, schwarzes Silber, Lime-Emaille als Akzent), drehen, Pinch-Zoom,
Doppeltipp = Zoom, Tasten (Pfeile, +/−) und Knöpfe für Tastatur-Bedienung.

**Ausgabe:** STL (mm, für 3D-Druck/Wachsguss), Instagram-PNG 1080×1350 (optional mit TRIAD-Schriftzug), Info-Karte (PNG) mit Maßen,
Gewicht je Material und Warnung bei Wandstärke unter 0,8 mm. Teilen per Link (alle Parameter in der URL, auch hochgeladene Umrisse),
lokal speichern (localStorage), **Send to TRIAD** → Einreichung im Darkroom der Hauptseite (bestehende Upload-API `POST /darkroom/submit`, Freigabe durch euch).

## Lokal starten

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # 22 Tests inkl. Zufalls-Tests aller Werkzeuge, Dichtheit nach Gravur/Destroy, Worker (KI gemockt)
```

Mit KI lokal: `cd worker && npx wrangler dev` und `VITE_AI_URL=http://localhost:8787 npm run dev`.

## Veröffentlichen

Läuft automatisch mit: Der Workflow „Build & deploy TRIAD“ baut bei jedem Push auf `main` auch das Studio und legt es nach `/studio/`.
Im Menü der Hauptseite steht es unter **IV Make → Studio**. KI-Bilder und Send to TRIAD: [`docs/SETUP.md`](docs/SETUP.md).

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
src/symbol/app.js          Symbol-Designer; src/lib/symbols.js Bibliothek + Zeichnen
src/home/*.js              Teller, Gefäße, Besteck, Schrank
src/make/*.js              Sketch to 3D, 3D-Upload
src/jewellery/destroy.js   Destroy-Modus (Rauschen, Verfeinerung, Schmutz)
src/jewellery/engrave.js   Gravieren/Prägen auf jeder Seite (Projektion + Tiefenpuffer)
src/sculpt/                Skulpturen: Distanzfelder + Marching Cubes, Posen
src/lib/motifs.js          Motiv-Bibliothek; src/lib/order.js Bestellung/Preis
src/lib/fonts.js           Schriften, Sprachen, eigene Schriften (IndexedDB)
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
