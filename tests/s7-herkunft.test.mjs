// Kampagnen-Herkunft (A-15596, Schnittstelle Kampagnenmodell P01_CC3285): ?q=<Quellcode>&lead=<Lead-Link> der Bestellseite -> Körper von "registrierung" -> Stripe-Metadaten.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { herkunftAusUrl, registrierungKoerper, registriere } from '../signup.js';

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..');
const KONFIG = { VERTRIEB_URL: 'https://vertrieb.example.test/functions/v1/registrierung', FASSUNG: { agb: 'agb-2026-11', avv: 'avv-2026-11', bestellschein: 'bs-2026-11' } };
const F = { admin: 1, nutzer: 5, leser: 0, zahlart: 'karte', organisation: 'Beispiel Bau GmbH', email: 'chef@beispiel-bau.example.com', kurz: 'beispiel-bau',
  strasse: '', plz: '', ort: '', ust_id: '', agb: true, avv: true, bestellschein: true, unternehmer: true };
const ANGEBOT = { id: '11111111-1111-4111-8111-111111111111', hash: 'a'.repeat(64) };
const UUID = '0b6c6f38-5d0e-4c7a-9f1d-2a3b4c5d6e7f';
const LINK = `${UUID}.0123456789abcdef`;

test('Herkunft: gültiger Quellcode (5 alphanumerisch, groß normiert) und Lead-Link', () => {
  assert.deepEqual(herkunftAusUrl(`?q=wn2qd&lead=${LINK}`), { quellcode: 'WN2QD', lead: LINK });
  assert.deepEqual(herkunftAusUrl(`?lead=${LINK.toUpperCase()}`), { lead: LINK });
  assert.deepEqual(herkunftAusUrl('?q=E4K9Z'), { quellcode: 'E4K9Z' });
});
test('Herkunft: Ungültiges entfällt, nie ein Fehler', () => {
  for (const s of ['', '?q=', '?q=abcd', '?q=abcdef', '?q=ab-cd', '?q=<script>', `?lead=${UUID}`, `?lead=${UUID}.xyz`, '?lead=abc.def', `?lead=${LINK}x`, undefined])
    assert.deepEqual(herkunftAusUrl(s), {}, String(s));
  assert.deepEqual(herkunftAusUrl(`?q=bad!!&lead=${LINK}`), { lead: LINK });
});
test('Körper: ohne Herkunft kein Feld, mit Herkunft quellcode und lead', () => {
  const ohne = registrierungKoerper(F, KONFIG, ANGEBOT);
  assert.equal('quellcode' in ohne || 'lead' in ohne, false);
  assert.equal('quellcode' in registrierungKoerper(F, KONFIG, ANGEBOT, {}), false);
  const mit = registrierungKoerper(F, KONFIG, ANGEBOT, { quellcode: 'WN2QD', lead: LINK });
  assert.equal(mit.quellcode, 'WN2QD'); assert.equal(mit.lead, LINK);
  assert.equal(mit.landingpage, '/bestellen.html');
});
test('registriere reicht die Herkunft an die Funktion durch', async () => {
  let body;
  const f = async (u, o) => { body = JSON.parse(o.body); return { ok: true, status: 200, json: async () => ({ url: 'https://checkout.stripe.test/c/1' }) }; };
  const r = await registriere(f, KONFIG, F, ANGEBOT, { quellcode: 'WN2QD', lead: LINK });
  assert.equal(r.art, 'zahlung'); assert.equal(body.quellcode, 'WN2QD'); assert.equal(body.lead, LINK);
  await registriere(f, KONFIG, F, ANGEBOT);
  assert.equal('quellcode' in body, false);
});
test('Bestellseite liest Herkunft aus der Adresse, hält sie nur in der Sitzung, kein Cookie', () => {
  const t = readFileSync(join(wurzel, 'bestellen.html'), 'utf8');
  assert.match(t, /herkunftAusUrl\(location\.search\)/);
  assert.match(t, /registriere\(fetch\.bind\(window\), KONFIG, daten\(\), angebot, herkunft\)/);
  assert.match(t, /sessionStorage/); assert.doesNotMatch(t, /document\.cookie|localStorage/);
});

// Gegentest mit der echten Funktion (hcs-os/vertrieb): Eingabe, Lead-Link-Signatur, Stripe-Metadaten
const FUNKTION = process.env.HCS_REGISTRIERUNG || '/Users/hstier/git/hcs-os/vertrieb/supabase/functions/registrierung/index.ts';
test('Gegentest echte Funktion: Herkunft landet in Stripe-Metadaten, falsche Signatur entfällt', { skip: !existsSync(FUNKTION) && 'Funktion nicht vorhanden' }, async () => {
  process.env.STUB_TEST = '1';
  const m = await import(FUNKTION);
  const sig = await m.leadLinkSignatur(UUID, 'geheim');
  const link = `${UUID}.${sig}`;
  const k = registrierungKoerper(F, KONFIG, ANGEBOT, herkunftAusUrl(`?q=wn2qd&lead=${link}`));
  const e = m.eingabePruefen(k);
  assert.equal(e.ok, true, 'eingabePruefen');
  assert.equal(await m.leadLinkPruefen(e.wert.lead, 'geheim'), UUID, 'Signatur gültig');
  const h = m.herkunftFuerStripe(e.wert, UUID);
  assert.equal(h.quellcode, 'WN2QD'); assert.equal(h.lead_id, UUID);
  assert.equal(await m.leadLinkPruefen(`${UUID}.0000000000000000`, 'geheim'), null, 'falsche Signatur: kein lead_id');
  assert.equal(await m.leadLinkPruefen(link, undefined), null, 'ohne Geheimnis: kein lead_id');
});
