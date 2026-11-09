// Abnahme S2–S5, S9 (Web-Soll-Neufound): Bestellstrecke gegen die Funktion "registrierung" (eingespeiste Datenbank, Stripe nur als Stub, Testmodus).
// Aufruf: node --test tests/      Der Gegentest mit der echten Funktion läuft, wenn HCS_REGISTRIERUNG auf deren index.ts zeigt (sonst übersprungen).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { PREIS, lizenzMonat, pruefe, vorschauKoerper, registrierungKoerper, holeVorschau, registriere, bereit, dankeArt } from '../signup.js';

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..');
const KONFIG = { VERTRIEB_URL: 'https://vertrieb.example.test/functions/v1/registrierung', FASSUNG: { agb: 'agb-2026-11', avv: 'avv-2026-11', bestellschein: 'bs-2026-11' } };
const GUELTIG = { admin: 1, nutzer: 5, leser: 0, zahlart: 'karte', organisation: 'Beispiel Bau GmbH', email: 'chef@beispiel-bau.example.com', kurz: 'beispiel-bau',
  strasse: '', plz: '', ort: '', ust_id: '', agb: true, avv: true, bestellschein: true, unternehmer: true };
const ANGEBOT = { id: '11111111-1111-4111-8111-111111111111', hash: 'a'.repeat(64) };

// S2: Vorschau
test('S2 Lizenz 1 Admin + 5 Nutzer = 1.014 € je Monat', () => assert.equal(lizenzMonat({ admin: 1, nutzer: 5, leser: 0 }), 490 + 129 + 5 * 79));
test('S2 Preise stimmen mit Kapitel 06', () => assert.deepEqual(PREIS, { grund: 490, admin: 129, nutzer: 79, leser: 29 }));
test('S2 Vorschau-Körper trägt Plätze und kein Vertragsfeld', () => {
  const k = vorschauKoerper(GUELTIG);
  assert.deepEqual(k, { vorschau: true, produkt: 'os-b', plaetze: 5, plaetze_admin: 1, plaetze_leser: 0 });
});
test('S2 Seite zeigt dieselbe Rechnung wie die Preisliste (Abweichung 0)', () => {
  const html = readFileSync(join(wurzel, 'bestellen.html'), 'utf8');
  for (const p of ['129 €', '79 €', '29 €', '490 €', '1.900,00 €']) assert.ok(html.includes(p), p);
});
test('S2 holeVorschau reicht Angebot und Summen durch', async () => {
  const f = async () => ({ ok: true, status: 200, json: async () => ({ angebot: ANGEBOT, vorschau: { summen: { faellig_jetzt: { brutto_eur: 1 } } } }) });
  const v = await holeVorschau(f, KONFIG, GUELTIG);
  assert.equal(v.angebot.id, ANGEBOT.id); assert.equal(v.summen.faellig_jetzt.brutto_eur, 1);
});
test('S2 holeVorschau meldet Serverfehler deutsch', async () => {
  const f = async () => ({ ok: false, status: 400, json: async () => ({ fehler: 'Das Produkt ist unbekannt.' }) });
  assert.equal((await holeVorschau(f, KONFIG, GUELTIG)).fehler, 'Das Produkt ist unbekannt.');
});

// S3: Registrierung
test('S3 gültige Eingabe', () => assert.equal(pruefe(GUELTIG).ok, true));
test('S3 Freemail abgelehnt', () => assert.equal(pruefe({ ...GUELTIG, email: 'privat@gmail.com' }).ok, false));
test('S3 Admin 0 abgelehnt', () => assert.equal(pruefe({ ...GUELTIG, admin: 0 }).ok, false));
test('S3 Summe über 500 abgelehnt', () => assert.equal(pruefe({ ...GUELTIG, admin: 1, nutzer: 500 }).ok, false));
test('S3 Kurzname mit Großbuchstaben/Leerzeichen abgelehnt', () => assert.equal(pruefe({ ...GUELTIG, kurz: 'Bei spiel' }).ok, false));
test('S3 Rechnung ohne Anschrift abgelehnt', () => assert.equal(pruefe({ ...GUELTIG, zahlart: 'rechnung' }).ok, false));
test('S3 Rechnung mit Anschrift angenommen', () => assert.equal(pruefe({ ...GUELTIG, zahlart: 'rechnung', strasse: 'Teststr. 1', plz: '10115', ort: 'Berlin' }).ok, true));

// S4: Vertrag per Klick
for (const feld of ['agb', 'avv', 'bestellschein', 'unternehmer'])
  test(`S4 ohne Haken ${feld} keine Anfrage`, async () => {
    let aufrufe = 0;
    const r = await registriere(async () => { aufrufe++; return { ok: true, json: async () => ({}) }; }, KONFIG, { ...GUELTIG, [feld]: false }, ANGEBOT);
    assert.ok(r.fehler); assert.equal(aufrufe, 0);
  });
test('S4 Körper trägt alle drei Fassungen, Unternehmer-Haken und das Angebot', () => {
  const k = registrierungKoerper(GUELTIG, KONFIG, ANGEBOT);
  assert.deepEqual(k.vertrag, { agb: 'agb-2026-11', avv: 'avv-2026-11', bestellschein: 'bs-2026-11', unternehmer: true });
  assert.deepEqual(k.angebot, ANGEBOT); assert.equal(k.zahlart, 'karte'); assert.equal(k.anschrift, undefined);
});
test('S4 kein Signaturdienst im Code der Seite', () => {
  for (const f of ['bestellen.html', 'signup.js', 'danke.html', 'konfig.js']) assert.doesNotMatch(readFileSync(join(wurzel, f), 'utf8'), /docusign/i);
});
test('S4 Online-Bestellung ist aus, solange Adresse oder Fassung fehlt', () => {
  assert.equal(bereit({ VERTRIEB_URL: '', FASSUNG: { agb: '', avv: '', bestellschein: '' } }), false);
  assert.equal(bereit({ ...KONFIG, FASSUNG: { ...KONFIG.FASSUNG, avv: '' } }), false);
  assert.equal(bereit(KONFIG), true);
});
test('S4 ausgelieferte konfig.js enthält keine Zugangsdaten', () => {
  assert.doesNotMatch(readFileSync(join(wurzel, 'konfig.js'), 'utf8'), /sk_|eyJ|service_role|secret/i);
});

// S5: Zahlung
for (const z of ['karte', 'sepa']) test(`S5a ${z}: Antwort mit url führt zur Zahlungsseite`, async () => {
  let gesehen;
  const f = async (u, o) => { gesehen = JSON.parse(o.body); return { ok: true, status: 200, json: async () => ({ url: 'https://checkout.stripe.example/c/pay_1' }) }; };
  const r = await registriere(f, KONFIG, { ...GUELTIG, zahlart: z }, ANGEBOT);
  assert.deepEqual([r.art, r.weiter], ['zahlung', 'https://checkout.stripe.example/c/pay_1']); assert.equal(gesehen.zahlart, z);
});
test('S5b Rechnung: rechnung_url, Anschrift im Körper, kein Checkout', async () => {
  let gesehen;
  const f = async (u, o) => { gesehen = JSON.parse(o.body); return { ok: true, status: 200, json: async () => ({ rechnung_url: 'https://invoice.stripe.example/i/1' }) }; };
  const r = await registriere(f, KONFIG, { ...GUELTIG, zahlart: 'rechnung', strasse: 'Teststr. 1', plz: '10115', ort: 'Berlin', ust_id: 'DE123456789' }, ANGEBOT);
  assert.equal(r.art, 'rechnung'); assert.equal(gesehen.anschrift.ort, 'Berlin'); assert.equal(gesehen.ust_id, 'DE123456789');
});
test('S5 Serverfehler "Fassung veraltet" erreicht den Nutzer', async () => {
  const f = async () => ({ ok: false, status: 400, json: async () => ({ fehler: 'Die Vertragsfassung ist veraltet. Bitte Seite neu laden.' }) });
  assert.match((await registriere(f, KONFIG, GUELTIG, ANGEBOT)).fehler, /veraltet/);
});

// S9: Danke-Seite
test('S9 Danke-Seite unterscheidet bezahlt und Rechnung offen', () => {
  assert.equal(dankeArt('?session=cs_test_1'), 'bezahlt'); assert.equal(dankeArt('?rechnung=1'), 'rechnung'); assert.equal(dankeArt(''), 'unbekannt');
  const t = readFileSync(join(wurzel, 'danke.html'), 'utf8');
  assert.match(t, /id="art-bezahlt"/); assert.match(t, /id="art-rechnung"/); assert.match(t, /Zahlungseingang/);
});
test('Rückkehradressen der Funktion (registrieren/danke, registrieren) führen auf Danke- und Bestellseite', () => {
  assert.match(readFileSync(join(wurzel, 'registrieren/danke/index.html'), 'utf8'), /\/danke\.html/);
  assert.match(readFileSync(join(wurzel, 'registrieren/index.html'), 'utf8'), /\/bestellen\.html/);
});

// Gegentest mit der echten Funktion (Datenbank und Stripe eingespeist)
const FUNKTION = process.env.HCS_REGISTRIERUNG || '/Users/hstier/git/hcs-os/vertrieb/supabase/functions/registrierung/index.ts';
test('Gegentest echte Funktion: Körper der Seite besteht Prüfung und Vertragsfassung', { skip: !existsSync(FUNKTION) && 'Funktion nicht vorhanden' }, async () => {
  process.env.STUB_TEST = '1';
  const m = await import(FUNKTION);
  const k = registrierungKoerper(GUELTIG, KONFIG, ANGEBOT);
  assert.equal(m.eingabePruefen(k).ok, true, 'eingabePruefen');
  assert.equal(m.vertragPruefen(k.vertrag).ok, true, 'vertragPruefen');
  assert.equal(m.angebotPruefen(k.angebot).ok, true, 'angebotPruefen');
  const re = registrierungKoerper({ ...GUELTIG, zahlart: 'rechnung', strasse: 'Teststr. 1', plz: '10115', ort: 'Berlin' }, KONFIG, ANGEBOT);
  assert.equal(m.eingabePruefen(re).ok, true, 'eingabePruefen Rechnung');
  const falsch = { ...k, email: 'x@gmail.com' };
  assert.equal(m.eingabePruefen(falsch).ok, true); // Freemail prüft die Datenbank (registrierung_beginnen), nicht die Eingabe: Seite fängt es vorab ab
  assert.equal(pruefe({ ...GUELTIG, email: 'x@gmail.com' }).ok, false);
});
