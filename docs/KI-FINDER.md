# KI- & Foto-Suche im Finder — kostenlos

**Kosten: 0 €.** Keine Kreditkarte, keine Rechnungsadresse, kein KI-Konto. Nur ein kostenloses Cloudflare-Konto.

## Was schon ohne Einrichtung live ist
- Kachel **„Google — all shops“**: eine Google-Suche über alle Marktplätze gleichzeitig.
- **Google Lens** für Fotos: Foto dort hochladen, Ergebnis in den Finder tippen.

## Was mit Cloudflare dazukommt
Im Finder erscheinen **„Add photo“** und **„Search with AI“**: Foto hochladen → die KI erkennt Teil, Farbe, Material, sichtbare Labels → fertige Suchen auf Deutsch und Englisch + 3 Alternativen.

```
Browser ──Foto (≈100 KB)──▶ Cloudflare Worker ──▶ Workers AI · Mistral Small 3.1 (Bild + Text)
Finder ◀── Suchbegriffe DE/EN + Alternativen ──┘   → Vinted, Grailed, eBay …
```

- **Kostenlos:** Workers AI gibt jedem Konto 10.000 „Neurons“ pro Tag gratis (setzt sich täglich zurück). Grobe Schätzung: einige Dutzend bis ca. 150 Foto-Suchen pro Tag.
- **Kein Kostenrisiko:** Ohne hinterlegte Karte kann nichts berechnet werden. Ist das Tageskontingent leer, schaltet der Finder automatisch auf die normale Suche um.
- **EU-tauglich:** Mistral ist ein französisches, offen lizenziertes Modell. (Metas Llama-Bildmodelle sind in der EU nicht nutzbar, deshalb nicht verwendet.)
- **Schutz:** Nur eure Website darf den Worker nutzen; max. 10 KI-Suchen pro Minute pro Besucher.
- **Datenschutz:** Die KI beschreibt nur Kleidung, keine Personen. TRIAD speichert keine Fotos.

## Einrichtung (ca. 10 Minuten, einmalig)

### 1. Cloudflare-Konto
1. https://dash.cloudflare.com/sign-up → kostenlos registrieren (nur E-Mail, keine Karte).
2. In der Übersicht rechts die **Account ID** kopieren.
3. Oben rechts Profil → **API Tokens** → **Create Token** → Vorlage **„Edit Cloudflare Workers“** → *Continue* → *Create* → Token kopieren.

### 2. In GitHub hinterlegen
Repo `Triad-` → **Settings → Secrets and variables → Actions → New repository secret**, zwei Mal:

| Name | Wert |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | Token aus Schritt 1 |
| `CLOUDFLARE_ACCOUNT_ID` | Account ID aus Schritt 1 |

Nie in Chats, Code oder Mails einfügen — nur hier.

### 3. Starten
1. Repo → **Actions → „Deploy Finder AI“ → Run workflow**.
2. Nach ~1 Minute steht in der Zusammenfassung die **Worker-URL** (z. B. `https://triad-finder-ai.<name>.workers.dev`).
3. Editor → **Startseite & Allgemein → KI-Finder Adresse** → URL einfügen → Speichern.
4. Nach ~1 Minute sind „Add photo“ und „Search with AI“ im Finder sichtbar.

Ausschalten: Feld „KI-Finder Adresse“ leeren.

## Später: mehr Qualität (optional, kostenpflichtig)
Der Worker kann auch Claude (Anthropic) nutzen: in `worker/finder-ai/wrangler.toml` `PROVIDER = "anthropic"` setzen und das Secret `ANTHROPIC_API_KEY` hinzufügen (braucht ein Anthropic-Konto mit Zahlungsmittel, ca. 0,3 Cent pro Foto-Suche).

## Rechtliches
Fotos werden zur Erkennung an Cloudflare übermittelt → gehört in die **Datenschutzerklärung**. Impressum und Datenschutzerklärung fehlen der Website noch — vor dem öffentlichen Start ergänzen.

## Technik
- Code: `worker/finder-ai/src/index.js` · Konfiguration: `worker/finder-ai/wrangler.toml`
- Tests: `node tests/worker.test.mjs` (simulierte KI; laufen bei jedem Deploy automatisch)
