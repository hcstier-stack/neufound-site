# neufound-site

Statische Website von Neufound (neufound.ai): eine Seite plus Impressum und Datenschutz.
Kein Build, kein Script, keine externen Anfragen; die Schrift IBM Plex (SIL Open Font License 1.1) liegt in `fonts/`.

| Datei | Zweck |
|---|---|
| `index.html` | Startseite |
| `impressum.html`, `datenschutz.html` | Pflichtseiten; Angaben in eckigen Klammern sind vor der Veröffentlichung zu füllen |
| `recht.css` | Stil der beiden Pflichtseiten |
| `fonts/` | IBM Plex lokal, damit kein Aufruf bei Google nötig ist |
| `CNAME` | Domain für GitHub Pages: `neufound.ai` |
| `.nojekyll` | schaltet Jekyll auf GitHub Pages ab |

Hosting: GitHub Pages, Branch `main`, Wurzelordner. Lokal ansehen: `python3 -m http.server 8000` in diesem Ordner, dann http://localhost:8000.
