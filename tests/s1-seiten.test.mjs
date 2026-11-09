// Abnahme S1 (Web-Soll-Neufound): Textprüfung über alle Seiten. Aufruf: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..');
const seiten = readdirSync(wurzel).filter((f) => f.endsWith('.html'));
const text = Object.fromEntries(seiten.map((f) => [f, readFileSync(join(wurzel, f), 'utf8')]));
const alle = Object.values(text).join('\n');
const zaehle = (re) => (alle.match(re) || []).length;

test('sechs Seiten vorhanden', () => assert.equal(seiten.length, 6));
test('Einrichtung 1.900 mindestens einmal', () => assert.ok(zaehle(/1\.900/g) >= 1));
for (const p of ['490', '129', '79', '29'])
  test(`Preis ${p} vorhanden`, () => assert.ok(zaehle(new RegExp(`${p} €`, 'g')) >= 1));
for (const v of [/Enablement/i, /25\.000/, /ab Jahr 2/i, /Claude/i, /Anthropic/i, /MREI/, /Wespen/i, /DocuSign/i])
  test(`verboten: ${v}`, () => assert.equal(zaehle(new RegExp(v.source, v.flags.includes('i') ? 'gi' : 'g')), 0));
test('Fremdleistungen zusätzlich, Selbstkosten + 30 %', () => {
  assert.match(text['index.html'], /Selbstkosten \+ 30 %/);
  assert.doesNotMatch(alle, /im Preis|im Entgelt enthalten/);
});
test('Kanalreihenfolge WhatsApp vor Web-App vor SMS', () => {
  const t = text['index.html'];
  const a = t.indexOf('<span>1</span> WhatsApp'), b = t.indexOf('<span>2</span> Web-App'), c = t.indexOf('<span>3</span> SMS');
  assert.ok(a > 0 && b > a && c > b);
});
test('Effizienzanzeige Werkzeug 0 € gegen Modell', () => assert.match(text['index.html'], /Werkzeug 0 €, Modell in €/));
test('Datenschutz: Abschnitt WhatsApp, Nummern lückenlos', () => {
  const nr = [...text['datenschutz.html'].matchAll(/<h2>(\d+)\./g)].map((m) => +m[1]);
  assert.deepEqual(nr, [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.match(text['datenschutz.html'], /Nutzung über WhatsApp/);
});
test('Sign-up-Einstieg verlinkt bestellen.html', () => assert.match(text['index.html'], /href="bestellen\.html">Organisation anmelden/));
test('lokale Anker gültig', () => {
  const t = text['index.html'];
  for (const m of t.matchAll(/href="#([a-z]+)"/g)) assert.ok(t.includes(`id="${m[1]}"`) || m[1] === 'top', m[1]);
});
test('keine Cookies, keine Fremd-Skripte', () => assert.equal(zaehle(/<script[^>]+src=|document\.cookie/g), 0));
