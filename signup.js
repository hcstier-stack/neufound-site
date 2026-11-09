// Bestellstrecke Neufound: reine Funktionen (ohne DOM), von bestellen.html und den Tests genutzt.
// Schritte: Kostenvorschau (registrierung {vorschau:true}) -> Vertragsklick mit Angebot -> Zahlung (Checkout-Adresse) oder Rechnung (Vorkasse).
export const PREIS = { grund: 490, admin: 129, nutzer: 79, leser: 29 };
export const ZAHLARTEN = ["karte", "sepa", "rechnung"];
const FREEMAIL = /@(gmail|googlemail|gmx|web|t-online|outlook|hotmail|live|yahoo|icloud|me|freenet|posteo|proton|protonmail)\.[a-z.]+$/i;
const KURZ = /^[a-z0-9][a-z0-9-]{1,30}$/;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Lizenz je Monat netto aus den Platzzahlen (Anzeige; maßgeblich bleibt die Vorschau des Servers). */
export function lizenzMonat(w) {
  return PREIS.grund + w.admin * PREIS.admin + w.nutzer * PREIS.nutzer + w.leser * PREIS.leser;
}

/** Prüft die Eingabe der Seite; liefert {ok:true} oder {ok:false, fehler}. Spiegelt die Regeln der Funktion registrierung. */
export function pruefe(f) {
  const plaetze = [f.admin, f.nutzer, f.leser];
  if (!plaetze.every((n) => Number.isInteger(n) && n >= 0 && n <= 500) || f.admin < 1 || f.admin + f.nutzer + f.leser > 500)
    return { ok: false, fehler: "Mindestens ein Admin-Platz, je Platzart 0 bis 500, zusammen höchstens 500." };
  if (!ZAHLARTEN.includes(f.zahlart)) return { ok: false, fehler: "Bitte eine Zahlart wählen." };
  if (!f.organisation || f.organisation.trim().length < 2) return { ok: false, fehler: "Bitte den Namen der Organisation angeben." };
  if (!EMAIL.test((f.email || "").trim())) return { ok: false, fehler: "Die E-Mail-Adresse ist ungültig." };
  if (FREEMAIL.test(f.email.trim())) return { ok: false, fehler: "Bitte eine Firmenadresse verwenden, keine private E-Mail-Adresse (nur Unternehmen)." };
  if (!KURZ.test((f.kurz || "").trim().toLowerCase()))
    return { ok: false, fehler: "Der Kurzname darf nur Kleinbuchstaben, Ziffern und Bindestriche enthalten (2 bis 31 Zeichen)." };
  if (f.zahlart === "rechnung" && !(f.strasse && f.plz && f.ort))
    return { ok: false, fehler: "Für die Zahlung auf Rechnung brauchen wir Straße, Postleitzahl und Ort." };
  if (!(f.agb && f.avv && f.bestellschein && f.unternehmer))
    return { ok: false, fehler: "Bitte Bedingungen, Auftragsverarbeitung, Bestellschein und die Unternehmereigenschaft bestätigen." };
  return { ok: true };
}

/** Körper für Schritt 1 (Kostenvorschau). */
export function vorschauKoerper(f) {
  return { vorschau: true, produkt: "os-b", plaetze: f.nutzer, plaetze_admin: f.admin, plaetze_leser: f.leser };
}

/** Körper für Schritt 2 (Registrierung mit Vertragsklick und angenommenem Angebot). */
export function registrierungKoerper(f, konfig, angebot) {
  const k = {
    produkt: "os-b",
    email: f.email.trim(), organisation: f.organisation.trim(), kurz: f.kurz.trim().toLowerCase(),
    plaetze: f.nutzer, plaetze_admin: f.admin, plaetze_leser: f.leser,
    zahlart: f.zahlart,
    vertrag: { agb: konfig.FASSUNG.agb, avv: konfig.FASSUNG.avv, bestellschein: konfig.FASSUNG.bestellschein, unternehmer: true },
    angebot: { id: angebot.id, hash: angebot.hash },
    landingpage: "/bestellen.html",
  };
  if (f.zahlart === "rechnung") {
    k.anschrift = { strasse: f.strasse.trim(), plz: f.plz.trim(), ort: f.ort.trim(), land: "DE" };
    if (f.ust_id && f.ust_id.trim()) k.ust_id = f.ust_id.trim();
  }
  return k;
}

async function post(fetchFn, url, koerper) {
  const r = await fetchFn(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(koerper) });
  let j = {};
  try { j = await r.json(); } catch { /* leere Antwort */ }
  return { ok: r.ok, status: r.status, j };
}

/** Schritt 1: Vorschau holen. Liefert {angebot, summen} oder {fehler}. */
export async function holeVorschau(fetchFn, konfig, f) {
  const a = await post(fetchFn, konfig.VERTRIEB_URL, vorschauKoerper(f));
  if (!a.ok || !a.j.angebot) return { fehler: a.j.fehler || "Die Kostenübersicht ließ sich nicht laden." };
  return { angebot: a.j.angebot, summen: (a.j.vorschau && a.j.vorschau.summen) || {} };
}

/** Schritt 2: Registrierung. Liefert {weiter: <Adresse>, art: "zahlung"|"rechnung"} oder {fehler}. */
export async function registriere(fetchFn, konfig, f, angebot) {
  const g = pruefe(f);
  if (!g.ok) return { fehler: g.fehler };
  const a = await post(fetchFn, konfig.VERTRIEB_URL, registrierungKoerper(f, konfig, angebot));
  if (!a.ok) return { fehler: a.j.fehler || "Die Anmeldung ließ sich nicht abschließen." };
  if (a.j.url) return { weiter: a.j.url, art: "zahlung" };
  if (a.j.rechnung_url) return { weiter: a.j.rechnung_url, art: "rechnung", fremdkosten: a.j.fremdkosten_rechnung || null };
  return { fehler: "Die Antwort enthielt keine Zahlungsadresse." };
}

/** Online-Bestellung nur, wenn Adresse und alle drei Fassungen gesetzt sind. */
export function bereit(konfig) {
  return Boolean(konfig.VERTRIEB_URL && konfig.FASSUNG.agb && konfig.FASSUNG.avv && konfig.FASSUNG.bestellschein);
}

/** Welche Variante der Danke-Seite: "bezahlt" (Rückkehr aus dem Checkout, ?session=) oder "rechnung" (?rechnung=1). */
export function dankeArt(suche) {
  if (/[?&]rechnung=1/.test(suche)) return "rechnung";
  if (/[?&]session=/.test(suche)) return "bezahlt";
  return "unbekannt";
}
