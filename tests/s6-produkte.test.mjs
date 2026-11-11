// Abnahme Produktseiten, Warteliste und Übergabe nach Zahlung (P01_CC3284). Aufruf: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { PRODUKTE, wartelistePruefe, wartelisteKoerper, wartelisteSenden } from '../warteliste.js';

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..');
const lies = (f) => readFileSync(join(wurzel, f), 'utf8');
const OS_SEITEN = { 'os-b.html': 'bestellbar', 'kalle-os.html': 'warteliste', 'vereinsmeierei-os.html': 'warteliste', 'persoenliches-os.html': 'warteliste' };

test('jedes vorhandene OS hat eine Produktseite', () => { for (const f of Object.keys(OS_SEITEN)) assert.ok(existsSync(join(wurzel, f)), f); });
test('Übersicht verweist auf alle vier Produktseiten', () => {
  const t = lies('produkte.html');
  for (const f of Object.keys(OS_SEITEN)) assert.match(t, new RegExp(`href="${f}"`), f);
});
test('Bestellbar nur OS-B: Einstieg in die Bestellstrecke dort, nirgends sonst', () => {
  assert.match(lies('os-b.html'), /href="bestellen\.html"/);
  assert.match(lies('os-b.html'), /class="status">Bestellbar/);
  for (const f of ['kalle-os.html', 'vereinsmeierei-os.html', 'persoenliches-os.html', 'produkte.html']) assert.doesNotMatch(lies(f), /href="bestellen\.html"/, f);
});
test('Warteliste-Produkte: Status Warteliste, Formular mit Kennung, standardmäßig aus', () => {
  for (const [f, art] of Object.entries(OS_SEITEN)) {
    if (art !== 'warteliste') continue;
    const t = lies(f);
    assert.match(t, /class="status offen">Warteliste/, f);
    assert.match(t, /<form id="wl" class="warteliste" data-produkt="[a-z-]+" hidden>/, f);
    assert.match(t, /name="einwilligung"[^>]*required/, f);
    assert.match(t, /name="website" tabindex="-1"/, f);
    assert.match(t, /href="datenschutz\.html"/, f);
  }
});
test('Warteliste nennt weder Preis noch Starttermin (Kapitel 06 legt sie nicht fest)', () => {
  for (const f of ['kalle-os.html', 'vereinsmeierei-os.html', 'persoenliches-os.html']) {
    const t = lies(f);
    assert.doesNotMatch(t, /\d[\d.]*\s?€/, f);
    assert.match(t, /Preis und Starttermin sind noch nicht festgelegt/, f);
  }
});
test('Produktseiten: noindex, keine verbotenen Wörter, keine Fremdskripte', () => {
  for (const f of [...Object.keys(OS_SEITEN), 'produkte.html', 'erste-schritte.html']) {
    const t = lies(f);
    assert.match(t, /name="robots" content="noindex"/, f);
    for (const v of [/Claude/i, /Anthropic/i, /MREI/, /Wespen/i, /DocuSign/i, /AI-Team/, /FTE/, /Enablement/i]) assert.doesNotMatch(t, v, `${f} ${v}`);
    assert.doesNotMatch(t, /<script[^>]+src=|document\.cookie/, f);
  }
});
test('Warteliste-Körper: Produktkennung nach vertrieb.produkt, Kampagne, Quelle', () => {
  const f = { firma: ' Musterverein e. V. ', email: 'a@musterverein.example', einwilligung: true, nachricht: '', name: '' };
  const k = wartelisteKoerper('vereinsmeierei-os', f, '/vereinsmeierei-os.html', 'abc');
  assert.deepEqual(k, { firma: 'Musterverein e. V.', email: 'a@musterverein.example', einwilligung: true, website: '', quelle: 'website_formular', kampagne: 'warteliste-vereinsmeierei-os', landingpage: '/vereinsmeierei-os.html', produkt: 'vereinsmeierei-os', quellcode: 'abc' });
  assert.equal(wartelisteKoerper('kalle-os', f, '/kalle-os.html').produkt, 'kalle-os');
});
test('persönliches OS: keine Produktkennung (noch kein vertrieb.produkt), Hinweis in der Nachricht', () => {
  const k = wartelisteKoerper('os-a', { firma: 'Muster GmbH', email: 'a@muster.example', einwilligung: true, nachricht: 'Bitte melden' }, '/persoenliches-os.html');
  assert.equal(k.produkt, undefined);
  assert.equal(k.nachricht, 'Warteliste Persönliches OS: Bitte melden');
  assert.equal(k.kampagne, 'warteliste-os-a');
});
test('Warteliste-Prüfung spiegelt lead-eingang: Firma, E-Mail, Einwilligung', () => {
  assert.equal(wartelistePruefe({ firma: 'M', email: 'a@b.de', einwilligung: true }).ok, false);
  assert.equal(wartelistePruefe({ firma: 'Muster', email: 'kein-at', einwilligung: true }).ok, false);
  assert.equal(wartelistePruefe({ firma: 'Muster', email: 'a@b.de', einwilligung: false }).ok, false);
  assert.equal(wartelistePruefe({ firma: 'Muster', email: 'a@b.de', einwilligung: true }).ok, true);
});
test('Warteliste senden: Erfolg, Serverfehler, ungültige Eingabe ohne Aufruf', async () => {
  let aufrufe = 0, letzte;
  const ok = async (url, o) => { aufrufe++; letzte = { url, body: JSON.parse(o.body) }; return { ok: true, json: async () => ({ ok: true }) }; };
  const fehler = async () => ({ ok: false, json: async () => ({ fehler: 'Das Produkt ist unbekannt.' }) });
  const konfig = { LEAD_URL: 'https://lead.example/functions/v1/lead-eingang' };
  const gut = { firma: 'Muster GmbH', email: 'a@muster.example', einwilligung: true };
  assert.deepEqual(await wartelisteSenden(ok, konfig, 'kalle-os', gut, '/kalle-os.html'), { ok: true });
  assert.equal(letzte.url, konfig.LEAD_URL); assert.equal(letzte.body.produkt, 'kalle-os');
  assert.deepEqual(await wartelisteSenden(fehler, konfig, 'kalle-os', gut, '/kalle-os.html'), { fehler: 'Das Produkt ist unbekannt.' });
  const vorher = aufrufe;
  assert.ok((await wartelisteSenden(ok, konfig, 'kalle-os', { ...gut, einwilligung: false }, '/kalle-os.html')).fehler);
  assert.equal(aufrufe, vorher);
});
test('PRODUKTE deckt genau die drei Warteliste-OS ab', () => assert.deepEqual(Object.keys(PRODUKTE).sort(), ['kalle-os', 'os-a', 'vereinsmeierei-os']));

// Übergabe nach Zahlung
test('Danke-Seite verweist auf Erste Schritte, sagt keine Mail zu', () => {
  const t = lies('danke.html');
  assert.match(t, /href="erste-schritte\.html"/);
  assert.doesNotMatch(t, /kommen per E-Mail an die Adresse/);
});
test('Erste Schritte: Reihenfolge Zahlung, Projekt, Einladung, Einrichtung, erste Frage; drei Kacheln', () => {
  const t = lies('erste-schritte.html');
  const pos = ['<b>Zahlung</b>', '<b>Ihr Projekt</b>', '<b>Einladung</b>', '<b>Einrichtung in vier Schritten</b>', '<b>Erste Frage</b>'].map((s) => t.indexOf(s));
  assert.ok(pos.every((p, i) => p > 0 && (i === 0 || p > pos[i - 1])), pos.join(','));
  for (const k of ['Team einladen', 'Quellen verbinden', 'Ablage einrichten']) assert.match(t, new RegExp(`<b>${k}</b>`));
  assert.match(t, /Neufound liest nur und schreibt nie zurück/);
});
test('Datenschutz nennt die Warteliste samt Einwilligung', () => assert.match(lies('datenschutz.html'), /Warteliste[^<]*Art\. 6 Abs\. 1 Buchst\. a DSGVO/));
