// Warteliste der Produktseiten (Kalle-OS, Vereinsmeierei-OS, persönliches OS): reine Funktionen, von den Seiten und den Tests genutzt.
// Ziel ist die Funktion "lead-eingang" im Vertriebsprojekt (nur lesen, gehört dem Vertriebsprojekt). Kein Cookie, kein Fremdskript.
// Produkt-Kennung: kalle-os und vereinsmeierei-os kennt vertrieb.produkt; ein persönliches OS (OS-A) ist dort noch kein Produkt (Lücke),
// darum geht es ohne Kennung ein und trägt die Kampagne "warteliste-os-a".
export const PRODUKTE = {
  "kalle-os": { name: "Kalle-OS", kennung: "kalle-os", kampagne: "warteliste-kalle-os" },
  "vereinsmeierei-os": { name: "Vereinsmeierei-OS", kennung: "vereinsmeierei-os", kampagne: "warteliste-vereinsmeierei-os" },
  "os-a": { name: "Persönliches OS", kennung: null, kampagne: "warteliste-os-a" },
};

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Prüft die Eingabe der Wartelisten-Seite; {ok:true} oder {ok:false, fehler}. Spiegelt die Regeln von lead-eingang. */
export function wartelistePruefe(f) {
  if (!f.firma || f.firma.trim().length < 2) return { ok: false, fehler: "Bitte nennen Sie Ihre Organisation." };
  if (!EMAIL.test((f.email || "").trim())) return { ok: false, fehler: "Die E-Mail-Adresse ist ungültig." };
  if (f.einwilligung !== true) return { ok: false, fehler: "Bitte stimmen Sie der Verarbeitung Ihrer Angaben zu." };
  return { ok: true };
}

/** Körper für lead-eingang. `produkt` ist ein Schlüssel aus PRODUKTE; `code` der Wert von ?q= (höchstens 16 Zeichen). */
export function wartelisteKoerper(produkt, f, pfad, code) {
  const p = PRODUKTE[produkt];
  if (!p) throw new Error("unbekanntes Produkt: " + produkt);
  const k = {
    firma: f.firma.trim(), name: (f.name || "").trim() || undefined, email: f.email.trim(),
    nachricht: (f.nachricht || "").trim() || undefined,
    einwilligung: f.einwilligung === true, website: f.website || "",
    quelle: "website_formular", kampagne: p.kampagne, landingpage: pfad,
  };
  if (p.kennung) k.produkt = p.kennung;
  else k.nachricht = ("Warteliste " + p.name + (k.nachricht ? ": " + k.nachricht : "")).slice(0, 4000);
  if (code) k.quellcode = String(code).slice(0, 16);
  for (const key of Object.keys(k)) if (k[key] === undefined) delete k[key];
  return k;
}

/** Sendet die Eintragung. Liefert {ok:true} oder {fehler}. */
export async function wartelisteSenden(fetchFn, konfig, produkt, f, pfad, code) {
  const g = wartelistePruefe(f);
  if (!g.ok) return { fehler: g.fehler };
  const r = await fetchFn(konfig.LEAD_URL, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(wartelisteKoerper(produkt, f, pfad, code)) });
  let j = {};
  try { j = await r.json(); } catch { /* leere Antwort */ }
  if (r.ok && j.ok) return { ok: true };
  return { fehler: j.fehler || "Das hat nicht geklappt. Bitte schreiben Sie an kontakt@neufound.ai." };
}
