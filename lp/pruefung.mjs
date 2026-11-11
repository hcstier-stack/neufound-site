// Pruefung der Kampagnen-Landingpages unter lp/. Keine Abhaengigkeiten. Lauf: node lp/pruefung.mjs
// Ausgabe "ok" / "nicht ok" je Pruefung, Ausstieg 1 bei mindestens einem Fehler.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import vm from "node:vm";

const hier = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const lp = require("./lp.js");

let ok = 0, nok = 0;
function pruefe(bed, text) { if (bed) { ok++; console.log("ok       " + text); } else { nok++; console.log("nicht ok " + text); } }

function dateien(ordner, endung) {
  const aus = [];
  for (const n of readdirSync(ordner)) {
    const p = join(ordner, n);
    if (statSync(p).isDirectory()) { aus.push(...dateien(p, endung)); } else if (n.endsWith(endung)) { aus.push(p); }
  }
  return aus.sort();
}

// Konfiguration lesen
const sandbox = { window: {} };
vm.runInNewContext(readFileSync(join(hier, "konfig.js"), "utf8"), sandbox);
const konfig = sandbox.window.NF_KONFIG;
pruefe(konfig && typeof konfig.endpunkt === "string", "konfig.js: NF_KONFIG mit endpunkt");
const ENDPUNKT = konfig.endpunkt;
const ENDPUNKT_HOST = new URL(ENDPUNKT).origin;
pruefe(konfig.aufrufZaehlen === false, "konfig.js: aufrufZaehlen ist aus (Vorgabe bis Rechtspruefung)");
pruefe(konfig.whatsappNummer === "" || /^\d{8,15}$/.test(konfig.whatsappNummer), "konfig.js: whatsappNummer leer oder nur Ziffern");
pruefe(["immo", "campus", "verein", "einzel"].every((g) => {
  const z = konfig.zielgruppen[g];
  return z && z.produkt && z.produktname && z.titel && typeof z.direktBestellen === "boolean";
}), "konfig.js: vier Zielgruppen mit produkt, produktname, titel, direktBestellen");
pruefe(["E", "W", "L", "neutral"].every((k) => typeof konfig.begruessung[k] === "string" && konfig.begruessung[k]), "konfig.js: Begruessung fuer E, W, L, neutral");
pruefe(typeof konfig.waText["wa-c2c"] === "string" && konfig.waText["wa-c2c"].length > 0, "konfig.js: Vorbelegungstext wa-c2c");

const CSP_TEIL = ["default-src 'self'", "connect-src " + ENDPUNKT_HOST, "img-src 'self' data:", "style-src 'self'", "script-src 'self'", "form-action 'none'"];
const FELDER = ["name", "firma", "email", "telefon", "nachricht", "einwilligung", "website"];
const FORMULAR_SEITEN = ["immo", "campus", "verein", "einzel"];

const htmls = dateien(hier, ".html");
pruefe(htmls.length >= 5, `fuenf oder mehr HTML-Dateien gefunden (${htmls.length})`);

for (const datei of htmls) {
  const n = relative(hier, datei);
  const t = readFileSync(datei, "utf8");
  const csp = (t.match(/<meta http-equiv="Content-Security-Policy" content="([^"]*)"/) || [])[1] || "";
  pruefe(/<meta name="robots" content="noindex">/.test(t), `${n}: noindex`);
  pruefe(CSP_TEIL.every((d) => csp.includes(d)), `${n}: CSP mit allen sechs Direktiven`);
  pruefe(/<meta name="referrer" content="strict-origin">/.test(t), `${n}: Referrer-Policy strict-origin`);
  const ohneCsp = t.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/, "");
  const fremd = (ohneCsp.match(/https?:\/\/[^\s"'<>)]+/g) || []).filter((u) => !u.startsWith(ENDPUNKT));
  pruefe(fremd.length === 0, `${n}: keine externen http(s)-Ressourcen${fremd.length ? " " + fremd.join(" ") : ""}`);
  const skripte = [...t.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)];
  pruefe(skripte.every((s) => /\ssrc="\/lp\/[^"]+"/.test(s[1]) && s[2].trim() === ""), `${n}: kein Inline-Skript mit Inhalt`);
  pruefe(!/\son[a-z]+\s*=/i.test(ohneCsp) && !/\sstyle\s*=/i.test(ohneCsp) && !/<style\b/i.test(ohneCsp), `${n}: keine Inline-Handler, kein Inline-Stil`);
  pruefe(/<html lang="de">/.test(t) && /name="viewport"/.test(t) && /<main/.test(t), `${n}: lang, viewport, main`);
  pruefe(/href="\/impressum\.html"/.test(t) && /href="\/datenschutz\.html"/.test(t), `${n}: Links auf Impressum und Datenschutz`);
  pruefe(!/Claude|Anthropic|\bKI\b|künstliche Intelligenz|AINO OS/.test(t), `${n}: keine gesperrten Namen`);
  pruefe(!/!/.test(t.replace(/<!doctype html>/i, "").replace(/<!--[\s\S]*?-->/g, "")), `${n}: kein Ausrufezeichen im Text`);

  const gruppe = n.split("/")[0];
  if (FORMULAR_SEITEN.includes(gruppe)) {
    const form = (t.match(/<form\b[\s\S]*?<\/form>/) || [""])[0];
    pruefe(form !== "" && /id="lead-formular"/.test(form), `${n}: Formular lead-formular vorhanden`);
    pruefe(FELDER.every((f) => new RegExp(`name="${f}"`).test(form)), `${n}: alle Formularfelder ${FELDER.join(", ")}`);
    const cb = (form.match(/<label class="haken">[\s\S]*?<\/label>/) || [""])[0];
    pruefe(/type="checkbox"/.test(cb) && !/\schecked\b/.test(cb) && /name="einwilligung"/.test(cb), `${n}: Einwilligungs-Checkbox, nicht vorangekreuzt`);
    pruefe(/href="\/datenschutz\.html"/.test(cb) && /darf mich zu dieser Anfrage per E-Mail/.test(cb) && /AINO Betriebsmedizin GmbH/.test(cb), `${n}: Einwilligungstext mit Verantwortlicher und Link auf Datenschutz`);
    pruefe(/data-zielgruppe="/.test(t) && t.includes(`data-zielgruppe="${gruppe}"`) && konfig.zielgruppen[gruppe], `${n}: data-zielgruppe passt zu konfig.js`);
    pruefe(/class="honigtopf"/.test(form), `${n}: Honigtopf`);
  }
  if (gruppe === "w") {
    pruefe(/id="wa-knopf"/.test(t) && /id="wa-ohne"/.test(t) && /In WhatsApp schreiben/.test(t), `${n}: Weiche mit Knopf und Ausweichtext`);
    pruefe(/Meta/.test(t) && /href="\/datenschutz\.html"/.test(t), `${n}: Datenschutzsatz zu WhatsApp und Meta`);
  }
}

// JS und CSS
for (const datei of [...dateien(hier, ".js")].filter((f) => !f.endsWith("pruefung.mjs"))) {
  const n = relative(hier, datei);
  const t = readFileSync(datei, "utf8");
  pruefe(!/localStorage|sessionStorage|document\.cookie|indexedDB|sendBeacon|XMLHttpRequest/.test(t), `${n}: kein Browser-Speicher, kein Cookie`);
  const urls = (t.match(/https?:\/\/[^\s"'`)]+/g) || []).filter((u) => !u.startsWith(ENDPUNKT) && !u.startsWith("https://wa.me/"));
  pruefe(urls.length === 0, `${n}: nur Endpunkt und wa.me als Adressen${urls.length ? " " + urls.join(" ") : ""}`);
}
for (const datei of dateien(hier, ".css")) {
  const n = relative(hier, datei);
  const t = readFileSync(datei, "utf8");
  pruefe(!/https?:\/\//.test(t) && !/@import/.test(t), `${n}: keine externen Adressen, kein @import`);
  pruefe((t.match(/url\(([^)]+)\)/g) || []).every((u) => /url\(\/fonts\//.test(u)), `${n}: url() nur auf /fonts/`);
}

// Einheiten: Code-Pruefung und Hilfsfunktionen aus lp.js
const gut = ["ABCDE", "E7K2M", "W2345", "L9ZZZ", "HJKMN", "PQRST"];
pruefe(gut.every((c) => lp.pruefeCode(c) === c), "lp.js pruefeCode: gueltige Codes");
pruefe(lp.pruefeCode("e7k2m") === "E7K2M" && lp.pruefeCode("  abcde ") === "ABCDE", "lp.js pruefeCode: Grossschreibung und Leerraum normiert");
const schlecht = ["", "ABCD", "ABCDEF", "ABCD0", "ABCD1", "ABCDI", "ABCDO", "AB CD", "ABC-E", "ÄBCDE", "AB\nDE", "<ab>", null, undefined, 12345];
pruefe(schlecht.every((c) => lp.pruefeCode(c) === null), "lp.js pruefeCode: ungueltige Codes (0, 1, I, O, Laenge, Zeichen) abgelehnt");
pruefe(lp.codeAusAdresse("?q=e7k2m&x=1") === "E7K2M" && lp.codeAusAdresse("?q=xx") === null && lp.codeAusAdresse("") === null && lp.codeAusAdresse(undefined) === null, "lp.js codeAusAdresse");
pruefe(lp.begruessung("E7K2M", konfig) === konfig.begruessung.E && lp.begruessung("W2345", konfig) === konfig.begruessung.W
  && lp.begruessung("L9ZZZ", konfig) === konfig.begruessung.L && lp.begruessung("HJKMN", konfig) === konfig.begruessung.neutral
  && lp.begruessung(null, konfig) === konfig.begruessung.neutral, "lp.js begruessung nach erstem Zeichen");
const wa = lp.waLink("+49 151 000 000", "Hallo", "E7K2M");
pruefe(wa === "https://wa.me/49151000000?text=" + encodeURIComponent("Hallo (Code E7K2M)"), "lp.js waLink mit Nummer und Code");
pruefe(lp.waLink("", "Hallo", "E7K2M") === null && lp.waLink(undefined, "Hallo", null) === null, "lp.js waLink ohne Nummer gibt null");
pruefe(lp.waLink("49151", "Hallo", null) === "https://wa.me/49151?text=Hallo", "lp.js waLink ohne Code ohne Klammer");
pruefe(lp.bestellLink("E7K2M", "abc.def") === "/bestellen.html?q=E7K2M&lead=abc.def" && lp.bestellLink(null, "abc.def") === "/bestellen.html?lead=abc.def"
  && lp.bestellLink("E7K2M", undefined) === null && lp.bestellLink("E7K2M", "a b&c") === null, "lp.js bestellLink: Parameter nur wenn vorhanden");
pruefe(lp.referrerHost("https://www.beispiel.de/pfad?x=1") === "www.beispiel.de" && lp.referrerHost("") === null && lp.referrerHost("kaputt") === null, "lp.js referrerHost nur Rechnername");
const voll = { name: "A B", firma: "Firma", email: "a@b.de", telefon: "", nachricht: "", website: "", einwilligung: true };
pruefe(lp.pruefeEingabe(voll) === "" && lp.pruefeEingabe({ ...voll, einwilligung: false }) !== "" && lp.pruefeEingabe({ ...voll, email: "x" }) !== ""
  && lp.pruefeEingabe({ ...voll, name: " " }) !== "" && lp.pruefeEingabe({ ...voll, telefon: "abc" }) !== "", "lp.js pruefeEingabe");
const nl = lp.baueNutzlast({ ...voll, telefon: "030 123", nachricht: "Hallo" }, { produkt: "os-b", code: "E7K2M", pfad: "/lp/immo/", referrer: "https://x.de/a" });
pruefe(nl.email === "a@b.de" && nl.einwilligung === true && nl.website === "" && nl.produkt === "os-b" && nl.quellcode === "E7K2M"
  && nl.landingpage === "/lp/immo/" && nl.referrer === "x.de" && nl.telefon === "030 123" && nl.nachricht === "Hallo", "lp.js baueNutzlast: Felder der Schnittstelle");
const nl2 = lp.baueNutzlast(voll, { produkt: "os-a", code: null, pfad: "/lp/einzel/", referrer: "" });
pruefe(nl2.quellcode === null && nl2.referrer === null && !("telefon" in nl2) && !("nachricht" in nl2), "lp.js baueNutzlast: ohne Code, ohne Referrer, leere Optionalfelder entfallen");

console.log(`\n${ok} ok, ${nok} nicht ok`);
process.exit(nok === 0 ? 0 : 1);
