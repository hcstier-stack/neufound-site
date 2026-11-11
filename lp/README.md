# Kampagnen-Landingpages (lp/)

Statische Seiten für Kampagnen aus Mail, WhatsApp und LinkedIn. Eine Seite je Zielgruppe, ein Formular „Gespräch anfragen", `noindex`, keine Cookies, kein Browser-Speicher, keine Fremdressourcen. Entwurf, nicht veröffentlicht.

| Pfad | Zweck |
|---|---|
| `/lp/immo/` `/lp/campus/` `/lp/verein/` `/lp/einzel/` | Zielgruppenseiten mit Formular |
| `/lp/w/` | WhatsApp-Weiche (ein Knopf, öffnet `wa.me` mit vorbelegtem Text und „(Code ABCDE)") |
| `/lp/konfig.js` | die eine Stelle für Schalter, Namen, Texte |
| `/lp/lp.js`, `/lp/lp.css` | gemeinsames Skript und Stil |
| `/lp/pruefung.mjs` | Prüfskript |

## Link-Schema

`https://neufound.ai/lp/<zielgruppe>/?q=<CODE>` und `https://neufound.ai/lp/w/?q=<CODE>`. Der Code hat fünf Zeichen aus `A-H J-N P-Z 2-9`, das erste Zeichen nennt den Kanal (`E` Mail, `W` WhatsApp, `L` LinkedIn). Schema, Vorlagen-Schlüssel und der Ablauf Formular → Lead → Bestellstrecke stehen in
`/Users/hstier/Library/CloudStorage/GoogleDrive-hc.stier@gmail.com/Meine Ablage/06_CLAUDE/Projects/P01_Digitalisierung/P01_CC3285_H0_System-Reminder-Linked_111126-2106/Kampagnenmodell-Schnittstelle-111126-HCS.md`.
Links baut der Link-Bauer, nie von Hand.

## Schalter in `konfig.js`

- `endpunkt`: Funktionen im Vertriebsprojekt (`lead-eingang`, `aufruf`). Muss mit `connect-src` in der CSP jeder Seite übereinstimmen.
- `aufrufZaehlen`: Vorgabe `false`. Erst nach Rechtsprüfung (P25) auf `true`; dann ein `POST /aufruf` je Seitenaufruf mit gültigem Code, auf der Weiche je Knopfklick.
- `whatsappNummer`: leer, bis Hans sie setzt (nur Ziffern mit Vorwahl). Leer zeigt die Weiche Mail und Telefon statt des Knopfes.
- `kontaktMail`, `kontaktTelefon` (Platzhalter), `waText["wa-c2c"]`, `begruessung` je Kanal.
- `zielgruppen`: `produkt` (Schlüssel für `lead-eingang`), `produktname`, `titel`, `direktBestellen`. Die Produktnamen außer „Neufound" sind Platzhalter; Name offen, Entscheidung Hans. Die Seiten tragen keinen Produktnamen im HTML, `lp.js` setzt ihn aus der Konfiguration.

## Verhalten

Das Formular sendet `{email, name, firma, telefon?, nachricht?, einwilligung:true, website (Honigtopf), produkt, quellcode, landingpage, referrer (nur Rechnername)}` an `${endpunkt}/lead-eingang`. Leere optionale Felder entfallen. Bei Erfolg erscheint der Danke-Zustand; nur wenn `direktBestellen` gilt und die Antwort `weiter.lead` enthält, folgt ein leiser Link „Direkt bestellen" auf `/bestellen.html?q=…&lead=…`. Einwilligungstext: Fassung `kf-2026-1` aus T4 Nr. 1, Verantwortliche ist die AINO Betriebsmedizin GmbH. Eine Fassungsnummer wird nicht mitgesendet, die Schnittstelle sieht kein Feld dafür vor.

## Testen

```
node lp/pruefung.mjs
```

Prüft je HTML-Datei `noindex`, CSP, Referrer-Policy, keine externen Adressen, kein Inline-Skript, Formularfelder, Einwilligung, Links auf Impressum und Datenschutz; je JS-Datei keinen Browser-Speicher; dazu Unit-Tests der Funktionen aus `lp.js`. Ausgabe `ok` oder `nicht ok` je Prüfung, Ausstieg 1 bei einem Fehler. Ein Server wird nicht gebraucht.
