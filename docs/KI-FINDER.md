# KI- & Foto-Suche im Finder einschalten

> **Kostenlos ohne Einrichtung (bereits live):** Kachel „Google — all shops“ (eine Google-Suche über alle Marktplätze) und Google Lens für Fotos (manuell hochladen, Ergebnis in den Finder einfügen). 0 €, kein Konto.
>
> **Kostenlose automatische Foto-Erkennung (optional):** über Cloudflare Workers AI im kostenlosen Cloudflare-Konto, ohne Kreditkarte — Umbau auf Anfrage. Die Claude-Variante unten braucht ein bezahltes Anthropic-Konto.

Der Code ist fertig und getestet. Damit er live geht, braucht es drei Zugänge, die nur ihr anlegen könnt (Konten auf euren Namen). Dauer: ca. 15 Minuten, einmalig.

## Wie es funktioniert

```
Handy/Browser ──Foto+Text──▶ Cloudflare Worker (euer kleiner Server, kostenlos)
                                 │  hält den geheimen KI-Schlüssel
                                 ▼
                           Claude Haiku 4.5 (Anthropic) erkennt Teil, Farbe, Material, Label
                                 │
Finder ◀──── Suchbegriffe DE + EN + Alternativen ──┘  → Vinted, Grailed, eBay …
```

- Fotos werden im Browser auf max. 1024 px verkleinert (~100 KB) und nur zur Erkennung gesendet, nicht gespeichert.
- Die KI beschreibt nur Kleidung, keine Personen, und rät keine Marken ohne sichtbares Label.
- Schutz: Nur eure Website darf den Worker benutzen; max. 10 KI-Suchen pro Minute pro Besucher.

## Kosten

Modell Claude Haiku 4.5: $1 pro Mio. Input-Tokens, $5 pro Mio. Output-Tokens. Ein Foto (1024 px) ≈ 1.300 Tokens.

| | ca. Kosten |
| --- | --- |
| 1 Foto-Suche | ~0,3 Cent |
| 1 Text-Suche | ~0,1 Cent |
| 1.000 Foto-Suchen | ~3 € |
| Cloudflare Worker | 0 € (Free-Plan) |

→ Im Anthropic-Konto ein **monatliches Ausgabenlimit** setzen (z. B. 10 €). Dann kann nie mehr passieren.

## Einrichtung

### 1. Anthropic (KI)
1. https://console.anthropic.com → Konto anlegen, Zahlungsmethode + Guthaben hinzufügen.
2. Unter *Limits* ein monatliches Limit setzen.
3. *API Keys* → **Create Key** → Name `triad-finder` → Schlüssel kopieren (beginnt mit `sk-ant-`).

### 2. Cloudflare (Server)
1. https://dash.cloudflare.com → kostenloses Konto.
2. Rechts in der Übersicht die **Account ID** kopieren.
3. Profil → *API Tokens* → **Create Token** → Vorlage **„Edit Cloudflare Workers“** → Token kopieren.

### 3. GitHub (Schlüssel sicher hinterlegen)
Repo `Triad-` → **Settings → Secrets and variables → Actions → New repository secret**, drei Mal:

| Name | Wert |
| --- | --- |
| `ANTHROPIC_API_KEY` | Schlüssel aus Schritt 1 |
| `CLOUDFLARE_API_TOKEN` | Token aus Schritt 2 |
| `CLOUDFLARE_ACCOUNT_ID` | Account ID aus Schritt 2 |

Schlüssel nie in Chats, Code oder Mails einfügen — nur hier.

### 4. Starten
1. Repo → **Actions → „Deploy Finder AI“ → Run workflow**.
2. Nach ~1 Minute steht in der Zusammenfassung die **Worker-URL** (z. B. `https://triad-finder-ai.<name>.workers.dev`).
3. Im Editor → **Startseite & Allgemein → KI-Finder Adresse** → URL einfügen → Speichern.
4. Nach ~1 Minute erscheinen im Finder **„Add photo“** und **„Search with AI“**.

Ausschalten: Feld „KI-Finder Adresse“ leeren.

## Rechtliches (wichtig vor dem Einschalten)

Fotos werden an Anthropic (USA) zur Verarbeitung übermittelt. Das muss in die **Datenschutzerklärung**. Außerdem braucht eine deutsche Website ein **Impressum** und eine Datenschutzerklärung. Beides fehlt noch — vor dem öffentlichen Start ergänzen (am besten mit einem Generator wie e-recht24 oder anwaltlich prüfen lassen).

## Technik

- Code: `worker/finder-ai/src/index.js`, Konfiguration `worker/finder-ai/wrangler.toml`
- Tests: `node tests/worker.test.mjs` (mit simulierter KI, laufen bei jedem Deploy)
- Modell wechseln: `MODEL` in `wrangler.toml`
