# Preisalarm — „Tell me when it drops“

Im Finder lässt sich zu jeder Suche ein Alarm einschalten. Der TRIAD-Server prüft eBay etwa einmal pro Stunde und schickt eine Push-Benachrichtigung aufs Handy, sobald ein **neues** passendes Angebot auftaucht. Ein Höchstpreis ist optional.

- **Kosten: 0 €.** Cloudflare-Gratisplan: ein Zeitplan alle 10 Minuten, je 12 Alarme pro Durchlauf. eBay-Schnittstelle gratis: 5.000 Abrufe pro Tag.
- **Kapazität:** etwa 200 Alarme bei stündlicher Prüfung.
- **Benachrichtigungen:** Web-Push, verschlüsselt (RFC 8291/8292). Es braucht kein Konto bei einem Drittanbieter, die Schlüssel erzeugt der Server selbst. Auf dem iPhone funktioniert das erst, wenn TRIAD zum Home-Bildschirm hinzugefügt wurde (iOS 16.4 oder neuer).
- **Vinted, Kleinanzeigen, Grailed:** Diese Plattformen haben keine öffentliche Such-Schnittstelle und verbieten Bots. Der Finder verlinkt deshalb auf deren eigene „Suche speichern“-Alarme. Es wird nichts gescrapt.

## eBay-Schlüssel einrichten (einmalig, kostenlos)

1. Auf developer.ebay.com registrieren. Das kostenlose Developer-Konto reicht.
2. Unter **Application Keysets** einen **Production**-Keyset erstellen.
3. Bei „Marketplace Account Deletion“ die **Ausnahme** wählen („I do not persist eBay data“). TRIAD speichert keine eBay-Nutzerdaten, nur Angebots-IDs zum Abgleich.
4. Die **App ID (Client ID)** und die **Cert ID (Client Secret)** in GitHub als Secrets anlegen: Settings → Secrets and variables → Actions:
   - `EBAY_CLIENT_ID`
   - `EBAY_CLIENT_SECRET`
5. Unter Actions den Workflow **Deploy Finder AI** starten. Danach sind die Alarme aktiv.

Solange keine eBay-Schlüssel hinterlegt sind, werden Alarme zwar gespeichert, aber noch nicht geprüft. Die Seite sagt das auch so an.

## Tests
- `node tests/alerts.test.mjs`: 29 Checks. Darunter: Die Verschlüsselung wird wie im Browser entschlüsselt, die VAPID-Signatur geprüft, der erste Durchlauf ist eine Grundlinie ohne Spam, ein neues Angebot löst genau eine Push-Nachricht aus, kein doppelter Alarm, abgemeldete Handys werden abgeschaltet.
- `python3 tests/alerts_e2e.py`: Ablauf im Browser gegen `scripts/dev-worker.mjs`.
