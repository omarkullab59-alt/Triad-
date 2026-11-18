# TRIAD Studio einrichten (einmalig, alles kostenlos)

## 1. Website (GitHub Pages)

1. Repo **triad-studio** anlegen und diesen Ordner hineinlegen (Inhalt von `studio/` = Wurzel des neuen Repos).
2. GitHub → Repo → **Settings → Pages → Source: GitHub Actions**.
3. Push auf `main` → Workflow „Build & deploy TRIAD Studio“ → live unter
   `https://omarkullab59-alt.github.io/triad-studio/`.

Die 3D-Werkzeuge funktionieren ab hier vollständig. Ohne KI-Worker zeigt „Draw“ einen freundlichen Hinweis,
Zeichnen und „Build as 3D pendant“ gehen trotzdem.

## 2. KI-Bilder für „Draw“ (Cloudflare, Free Plan, ohne Kreditkarte)

1. Kostenloses Konto auf dash.cloudflare.com (nur E-Mail).
2. **My Profile → API Tokens → Create Token** → Vorlage „Edit Cloudflare Workers“, dazu Berechtigung „Workers AI: Read“ hinzufügen.
   (Wenn ihr schon den Token der TRIAD-Hauptseite habt, könnt ihr denselben nehmen.)
3. Account ID: Dashboard → Workers & Pages, rechte Spalte.
4. GitHub → triad-studio → **Settings → Secrets and variables → Actions → Secrets**:
   `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`. (Keys nur hier, nie im Code.)
5. Actions → **Deploy Studio AI** → Run workflow. In der Zusammenfassung steht die Worker-URL,
   z. B. `https://triad-studio-ai.<name>.workers.dev`.
6. **Settings → Secrets and variables → Actions → Variables**: `STUDIO_AI_URL` = diese URL.
7. Actions → **Build & deploy TRIAD Studio** → Run workflow.

**Schutz:** Der Worker antwortet nur Seiten unter `https://omarkullab59-alt.github.io/triad-studio/` (Origin + Referer,
einstellbar in `worker/wrangler.toml`), max. 8 Renders pro Minute und 120 pro Tag je IP (Cloudflare Rate-Limit + eigener Zähler).
Ist das tägliche Gratis-Kontingent von Workers AI aufgebraucht, sehen Nutzer: „Today’s free AI renders are used up. Try again tomorrow“.
Es entstehen nie Kosten: Ohne hinterlegte Zahlungsart stoppt Cloudflare einfach bis zum nächsten Tag.

Modell: `@cf/runwayml/stable-diffusion-v1-5-img2img` (änderbar in `wrangler.toml` → `MODEL`).

## 3. „Send to TRIAD“ (Darkroom der Hauptseite)

Nutzt die bestehende Darkroom-Upload-API der Hauptseite. Voraussetzung: Darkroom ist eingerichtet (siehe `docs/DARKROOM.md` im Repo Triad-).

1. In triad-studio: **Variables** → `TRIAD_DARKROOM_URL` = URL des Workers der Hauptseite (`triad-finder-ai…workers.dev`,
   dieselbe wie im CMS-Feld „KI-Finder Adresse“).
2. Build neu starten.

Die Studio-Seite liegt auf derselben Adresse `omarkullab59-alt.github.io`, die der Darkroom-Worker schon erlaubt; es ist keine Änderung an der Hauptseite nötig.
Einreichungen erscheinen in der Moderation mit „Kamera: TRIAD Studio“ und landen erst nach eurer Freigabe an der Wand.
Ohne `TRIAD_DARKROOM_URL` speichert der Knopf das Bild und öffnet die Darkroom-Seite zum Hochladen.

## Eigene Domain (später)

Domain in Settings → Pages eintragen und in `worker/wrangler.toml` bei `ALLOWED_ORIGINS`/`ALLOWED_REFERERS` ergänzen
(und in `ALLOWED_ORIGINS` des Hauptseiten-Workers, wenn „Send to TRIAD“ von dort kommen soll).
