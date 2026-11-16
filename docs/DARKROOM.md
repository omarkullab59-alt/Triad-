# Darkroom — Fotos hochladen, freigeben, reagieren

**Was es ist:** Fotograf:innen laden auf `/darkroom/` ohne Konto Fotos hoch. Nichts wird öffentlich, bevor ihr es freigebt. Freigegebene Fotos hängen „an der Wand“, und alle können mit den drei TRIAD-Zeichen reagieren: **Burns** (Feuer), **Resonates** (Dreiklang) und **Archive it** (Delta). Ab drei Meldungen wird ein Foto automatisch ausgeblendet, bis ihr es prüft.

**Kosten:** keine. Der Darkroom läuft im selben kostenlosen Cloudflare-Worker wie der KI-Finder und speichert in einer kostenlosen D1-Datenbank (5 GB, das reicht für ca. 10.000 Fotos).

## Einrichten (einmalig, nach dem KI-Finder-Setup aus KI-FINDER.md)

1. GitHub → Repo → Settings → Secrets and variables → Actions → **New repository secret**. Zwei Secrets anlegen:
   - `DARKROOM_ADMIN_TOKEN`: ein langes Passwort (mindestens 16 Zeichen, besser 30). Das ist euer Schlüssel für die Moderationsseite.
   - `DARKROOM_HASH_SALT`: beliebiger zufälliger Text. Er wird nur intern für die Spam- und Doppelabstimmungs-Sperre gebraucht.
2. Actions → **Deploy Finder AI** → Run workflow. Die Datenbank wird beim ersten Deploy automatisch angelegt.
3. Moderieren: `…/Triad-/darkroom/admin/` aufrufen und den Schlüssel eingeben.

Solange kein Server verbunden ist (CMS-Feld „KI-Finder Adresse“ leer), zeigt die Seite „The darkroom opens soon“, und das Formular ist gesperrt.

## Schutz eingebaut

- Freigabe vor Veröffentlichung, außerdem eine Melden-Funktion mit automatischem Ausblenden ab drei Meldungen.
- Höchstens 6 Uploads pro Person und Tag sowie eine Begrenzung der Anfragen pro Minute. Ein Bot-Honeypot-Feld fängt Spam ab.
- Fotos werden im Browser verkleinert (1600 px) und neu gespeichert. Dabei werden **GPS- und Kameradaten entfernt**.
- Die IP-Adresse wird nie gespeichert, nur ein gesalzener Hash für die Limits.
- Jede reagierende Person zählt pro Zeichen einmal. Ein zweites Tippen nimmt die Reaktion zurück.

## Später: Login

Die Tabelle `photos` hat schon ein Feld `account_id`. Ein Login (Google, Apple oder E-Mail-Link) kann später dazukommen. Möglich wären dann Profile, eigene Fotos löschen und eine schnellere Freigabe für bekannte Fotograf:innen, ohne dass bestehende Uploads verloren gehen.

## Lokal testen

```
node scripts/dev-worker.mjs                    # Worker + SQLite auf :8787, Admin-Key: local-admin-key-123456
AI_ENDPOINT=http://localhost:8787 npm run build && npm run serve
python3 tests/darkroom_e2e.py                  # kompletter Ablauf im Browser
node tests/darkroom.test.mjs                   # 29 Server-Checks
```
