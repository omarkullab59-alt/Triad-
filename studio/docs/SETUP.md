# TRIAD Studio einrichten (einmalig, alles kostenlos)

## 1. Website

Nichts zu tun: Das Studio wird mit der TRIAD-Seite gebaut („Build & deploy TRIAD“) und liegt unter
`https://omarkullab59-alt.github.io/Triad-/studio/`. Die 3D-Werkzeuge, Symbol, Lettering, Destroy-Modus und Upload funktionieren sofort.
Ohne KI-Worker zeigt „Draw“ einen freundlichen Hinweis; Zeichnen und „Make 3D“ gehen trotzdem.

## 2. KI-Bilder für „Draw“ (Cloudflare, Free Plan, ohne Kreditkarte)

1. Kostenloses Konto auf dash.cloudflare.com (nur E-Mail).
2. **My Profile → API Tokens → Create Token** → Vorlage „Edit Cloudflare Workers“, dazu Berechtigung „Workers AI: Read“ hinzufügen.
   (Wenn ihr schon den Token der TRIAD-Hauptseite habt, könnt ihr denselben nehmen.)
3. Account ID: Dashboard → Workers & Pages, rechte Spalte.
4. GitHub → Triad- → **Settings → Secrets and variables → Actions → Secrets**:
   `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` (dieselben wie für den KI-Finder; wenn schon da, nichts tun). Keys nur hier, nie im Code.
5. Actions → **Deploy Studio AI** → Run workflow. In der Zusammenfassung steht die Worker-URL,
   z. B. `https://triad-studio-ai.<name>.workers.dev`.
6. **Settings → Secrets and variables → Actions → Variables**: `STUDIO_AI_URL` = diese URL.
7. Actions → **Build & deploy TRIAD** → Run workflow.

**Schutz:** Der Worker antwortet nur Seiten unter `https://omarkullab59-alt.github.io/Triad-/studio/` (Origin + Referer,
einstellbar in `worker/wrangler.toml`), max. 8 Renders pro Minute und 120 pro Tag je IP (Cloudflare Rate-Limit + eigener Zähler).
Ist das tägliche Gratis-Kontingent von Workers AI aufgebraucht, sehen Nutzer: „Today’s free AI renders are used up. Try again tomorrow“.
Es entstehen nie Kosten: Ohne hinterlegte Zahlungsart stoppt Cloudflare einfach bis zum nächsten Tag.

Modell: `@cf/runwayml/stable-diffusion-v1-5-img2img` (änderbar in `wrangler.toml` → `MODEL`).

## 3. „Send to TRIAD“ (Darkroom der Hauptseite)

Automatisch: Das Studio nimmt beim Bauen die Worker-Adresse aus `content/site.json` (CMS-Feld „KI-Finder Adresse“) und schickt
Einreichungen an die bestehende Darkroom-Upload-API. Sie erscheinen in der Moderation mit „Kamera: TRIAD Studio“ und sind erst nach
eurer Freigabe sichtbar. Solange das Feld leer ist, speichert der Knopf das Bild und öffnet die Darkroom-Seite zum Hochladen.

## Eigene Domain (später)

Domain in Settings → Pages eintragen und in `worker/wrangler.toml` bei `ALLOWED_ORIGINS`/`ALLOWED_REFERERS` ergänzen
(und in `ALLOWED_ORIGINS` des Hauptseiten-Workers, wenn „Send to TRIAD“ von dort kommen soll).

