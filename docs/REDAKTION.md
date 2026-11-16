# TRIAD — Inhalte selbst hochladen

Zwei Wege, beide kostenlos, beide funktionieren auch am Handy. Jede Änderung ist nach ca. 1–2 Minuten live.

## Weg A: Pages CMS (am einfachsten, für das ganze Team)

1. https://app.pagescms.org öffnen → **Sign in with GitHub**.
2. Zugriff auf das Repository **Triad-** erlauben (einmalig, „Install“ der Pages-CMS-App).
3. Links erscheinen: Magazin · News · Archiv · News-Quellen · Creatives · Ausgaben · Startseite.
4. **+ Add** → Felder ausfüllen → Bilder per Upload hinzufügen → **Save**.

Teammitglieder: In Pages CMS unter *Collaborators* per E-Mail einladen – sie brauchen kein eigenes GitHub-Konto.

## Weg B: Editor direkt auf der Website — `/admin/`

https://omarkullab59-alt.github.io/Triad-/admin/

Einmalig einen Schlüssel (Token) erstellen:
1. github.com → Profilbild → **Settings** → **Developer settings** → **Personal access tokens** → **Fine-grained tokens** → **Generate new token**.
2. Name: `TRIAD Redaktion`, Ablauf: z. B. 1 Jahr.
3. *Repository access*: **Only select repositories** → `Triad-`.
4. *Permissions* → *Repository permissions* → **Contents: Read and write**.
5. Token kopieren → auf `/admin/` **Sign in with Token** → einfügen.

Der Token bleibt nur in diesem Browser gespeichert. Nie teilen; bei Verlust auf GitHub löschen.

## Was wohin gehört

| Ich will … | Bereich |
| --- | --- |
| einen langen Artikel, ein Editorial, ein Interview | **Magazin** |
| eine eigene kurze Meldung | **News (eigene)** – wenn sie auf einem anderen Bericht basiert: *Quelle (Name)* + *Quelle (Link)* ausfüllen |
| Bilder fürs Moodboard | **Archiv** |
| eine neue Zeitschrift/Marke im „Elsewhere“-Feed | **News-Quellen (RSS)** → RSS-Adresse eintragen |
| Startseiten-Bilder, Social Links | **Startseite & Allgemein** |

**Entwurf**-Haken = gespeichert, aber nicht sichtbar.

## Bilder

- JPG oder PNG. Große Handyfotos sind okay – beim Veröffentlichen werden sie automatisch auf max. 2000 px verkleinert.
- Im Text ein Bild einfügen → erscheint als großes Editorial-Bild. Bildunterschrift = Bildtitel.
- **Nur eigene Fotos oder ausdrücklich freigegebenes Pressematerial.** Fremde Fotos aus dem Netz nicht hochladen.

## „Elsewhere“ — Nachrichten anderer Magazine

- Läuft automatisch alle 3 Stunden über öffentliche RSS-Feeds. Kein API-Key nötig.
- Gezeigt werden nur Schlagzeile, Quelle, Datum und Link zum Original – keine fremden Texte oder Bilder.
- Quelle hinzufügen: Bereich **News-Quellen** → Name + Feed-Adresse (meist `…/feed`, `…/rss` oder `…/rss.xml`).
- Ob ein Feed funktioniert, steht im GitHub-Protokoll: Repo → *Actions* → letzter Lauf → *Fetch news wire* (`OK` / `FAIL`).
