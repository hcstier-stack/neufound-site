/* Kampagnen-Landingpages: Code aus der Adresse, Begruessung, Formular an lead-eingang, optional Aufrufzaehler.
   Kein Cookie, kein Browser-Speicher, keine Fremdskripte. Der Code lebt nur in der Adresse.
   Schnittstelle: Kampagnenmodell-Schnittstelle-111126-HCS.md, Abschnitt 4.
   Die reinen Funktionen sind ueber module.exports testbar (lp/pruefung.mjs) und brechen im Browser nicht. */
(function (root) {
  "use strict";

  var CODE = /^[A-HJ-NP-Z2-9]{5}$/;                 // 5 Zeichen, ohne I, O, 0, 1
  var EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
  var TELEFON = /^[0-9+()\/\s.-]{3,50}$/;
  var LEAD = /^[A-Za-z0-9._~-]{1,200}$/;

  /** Prueft einen Code; gibt ihn in Grossschreibung zurueck oder null. */
  function pruefeCode(roh) {
    if (typeof roh !== "string") { return null; }
    var c = roh.trim().toUpperCase();
    return CODE.test(c) ? c : null;
  }

  /** Liest q aus der Adresse (search-Teil). */
  function codeAusAdresse(search) {
    try { return pruefeCode(new URLSearchParams(search || "").get("q")); } catch (e) { return null; }
  }

  /** Begruessungszeile nach dem ersten Zeichen des Codes; ohne Code und bei fremdem Zeichen neutral. */
  function begruessung(code, konfig) {
    var b = (konfig && konfig.begruessung) || {};
    var z = code ? code.charAt(0) : "";
    return b[z] || b.neutral || "";
  }

  /** Nur der Rechnername der verweisenden Seite, nie die volle Adresse. */
  function referrerHost(referrer) {
    try { return referrer ? new URL(referrer).hostname : null; } catch (e) { return null; }
  }

  /** wa.me-Link mit vorbelegtem Text und "(Code ABCDE)"; null ohne Nummer. */
  function waLink(nummer, text, code) {
    var ziffern = String(nummer || "").replace(/\D/g, "");
    if (!ziffern) { return null; }
    var voll = String(text || "") + (code ? " (Code " + code + ")" : "");
    return "https://wa.me/" + ziffern + "?text=" + encodeURIComponent(voll.trim());
  }

  /** Link "Direkt bestellen": Parameter nur, wenn vorhanden; ohne Lead gibt es keinen Link. */
  function bestellLink(code, lead) {
    if (typeof lead !== "string" || !LEAD.test(lead)) { return null; }
    var teile = [];
    if (code) { teile.push("q=" + encodeURIComponent(code)); }
    teile.push("lead=" + encodeURIComponent(lead));
    return "/bestellen.html?" + teile.join("&");
  }

  /** Prueft die Eingaben; gibt eine Fehlermeldung oder "" zurueck. */
  function pruefeEingabe(f) {
    if (!f.name || !f.name.trim()) { return "Bitte nennen Sie Ihren Namen."; }
    if (!f.firma || f.firma.trim().length < 2) { return "Bitte nennen Sie Ihre Firma oder Organisation."; }
    if (!f.email || !EMAIL.test(f.email.trim())) { return "Bitte geben Sie eine gültige E-Mail-Adresse an."; }
    if (f.telefon && f.telefon.trim() && !TELEFON.test(f.telefon.trim())) { return "Bitte prüfen Sie die Telefonnummer."; }
    if (f.einwilligung !== true) { return "Bitte bestätigen Sie den Hinweis zum Datenschutz, damit wir Sie kontaktieren dürfen."; }
    return "";
  }

  /** Baut die Nutzlast fuer lead-eingang. Leere optionale Felder entfallen. */
  function baueNutzlast(f, ctx) {
    var n = {
      email: String(f.email || "").trim(),
      name: String(f.name || "").trim(),
      firma: String(f.firma || "").trim(),
      einwilligung: true,
      website: String(f.website || ""),
      produkt: ctx.produkt,
      quellcode: ctx.code || null,
      landingpage: ctx.pfad,
      referrer: referrerHost(ctx.referrer)
    };
    if (f.telefon && f.telefon.trim()) { n.telefon = f.telefon.trim(); }
    if (f.nachricht && f.nachricht.trim()) { n.nachricht = f.nachricht.trim(); }
    return n;
  }

  /** Aufrufzaehler: fire-and-forget, Fehler still. Nur mit eingeschaltetem Schalter und gueltigem Code. */
  function zaehle(win, konfig, art, code, pfad) {
    if (!konfig || konfig.aufrufZaehlen !== true || !code || typeof win.fetch !== "function") { return; }
    try {
      win.fetch(konfig.endpunkt + "/aufruf", {
        method: "POST", credentials: "omit", keepalive: true,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ art: art, q: code, pfad: pfad })
      }).catch(function () { /* still */ });
    } catch (e) { /* still */ }
  }

  function el(doc, tag, klasse, text) {
    var e = doc.createElement(tag);
    if (klasse) { e.className = klasse; }
    if (text) { e.textContent = text; }
    return e;
  }

  function initSeite(win, doc) {
    var konfig = win.NF_KONFIG || {};
    var gruppe = doc.body.getAttribute("data-zielgruppe");
    var z = (konfig.zielgruppen || {})[gruppe] || null;
    var code = codeAusAdresse(win.location.search);
    var pfad = win.location.pathname;

    // Namen aus der Konfiguration, nicht aus dem HTML
    if (z) {
      Array.prototype.forEach.call(doc.querySelectorAll("[data-produktname]"), function (e) { e.textContent = z.produktname; });
      Array.prototype.forEach.call(doc.querySelectorAll("[data-titel]"), function (e) { e.textContent = z.titel; });
      doc.title = z.produktname + " – Gespräch anfragen";
    }

    var gruss = doc.getElementById("begruessung");
    if (gruss) {
      var t = begruessung(code, konfig);
      if (t) { gruss.textContent = t; gruss.hidden = false; }
    }

    // WhatsApp-Weiche
    var knopf = doc.getElementById("wa-knopf");
    if (knopf) {
      var link = waLink(konfig.whatsappNummer, (konfig.waText || {})["wa-c2c"], code);
      var ohne = doc.getElementById("wa-ohne");
      if (link) {
        knopf.setAttribute("href", link);
        knopf.hidden = false;
        if (ohne) { ohne.hidden = true; }
        knopf.addEventListener("click", function () { zaehle(win, konfig, "whatsapp", code, pfad); });
      } else {
        knopf.hidden = true;
        if (ohne) { ohne.hidden = false; }
        var m = doc.getElementById("wa-mail");
        if (m && konfig.kontaktMail) { m.textContent = konfig.kontaktMail; m.setAttribute("href", "mailto:" + konfig.kontaktMail); }
        var tel = doc.getElementById("wa-telefon");
        if (tel) { tel.textContent = konfig.kontaktTelefon || "[Telefonnummer]"; }
      }
      return;
    }

    zaehle(win, konfig, "aufruf", code, pfad);

    var form = doc.getElementById("lead-formular");
    if (!form || !z) { return; }
    var meldung = doc.getElementById("lead-meldung");
    var senden = form.querySelector("button[type=submit]");

    function zeige(text, fehler) {
      meldung.textContent = text;
      meldung.className = "meldung" + (fehler ? " fehler" : "");
      meldung.hidden = false;
      meldung.focus();
    }

    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      function feld(n) { return form.elements.namedItem(n); }
      var f = {
        name: feld("name").value, firma: feld("firma").value, email: feld("email").value,
        telefon: feld("telefon").value, nachricht: feld("nachricht").value,
        website: feld("website").value, einwilligung: feld("einwilligung").checked
      };
      var fehler = pruefeEingabe(f);
      if (fehler) { zeige(fehler, true); return; }
      var nutzlast = baueNutzlast(f, { produkt: z.produkt, code: code, pfad: pfad, referrer: doc.referrer });
      senden.disabled = true;
      meldung.hidden = true;
      win.fetch(konfig.endpunkt + "/lead-eingang", {
        method: "POST", credentials: "omit",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nutzlast)
      }).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, j: j || {} }; });
      }).then(function (a) {
        if (a.ok && a.j.ok) { erfolg(a.j); return; }
        senden.disabled = false;
        zeige(typeof a.j.fehler === "string" && a.j.fehler ? a.j.fehler
          : "Das hat leider nicht geklappt. Bitte versuchen Sie es noch einmal oder schreiben Sie an " + (konfig.kontaktMail || "uns") + ".", true);
      }).catch(function () {
        senden.disabled = false;
        zeige("Die Verbindung hat nicht geklappt. Bitte versuchen Sie es noch einmal oder schreiben Sie an " + (konfig.kontaktMail || "uns") + ".", true);
      });
    });

    function erfolg(antwort) {
      var box = doc.getElementById("lead-danke");
      form.hidden = true;
      meldung.hidden = true;
      box.appendChild(el(doc, "h3", "", "Danke für Ihre Anfrage."));
      box.appendChild(el(doc, "p", "", "Ich melde mich innerhalb eines Werktags."));
      var weiter = antwort && antwort.weiter;
      var b = z.direktBestellen === true && weiter ? bestellLink(code, weiter.lead) : null;
      if (b) {
        var p = el(doc, "p", "leise", "Sie möchten nicht warten? ");
        var a = el(doc, "a", "", "Direkt bestellen");
        a.setAttribute("href", b);
        p.appendChild(a);
        box.appendChild(p);
      }
      box.hidden = false;
      box.setAttribute("tabindex", "-1");
      box.focus();
    }
  }

  var api = {
    pruefeCode: pruefeCode, codeAusAdresse: codeAusAdresse, begruessung: begruessung, referrerHost: referrerHost,
    waLink: waLink, bestellLink: bestellLink, pruefeEingabe: pruefeEingabe, baueNutzlast: baueNutzlast
  };

  if (typeof module !== "undefined" && module.exports) { module.exports = api; }
  root.NFLP = api;
  if (typeof document !== "undefined" && root.window === root) {
    if (document.readyState === "loading") { document.addEventListener("DOMContentLoaded", function () { initSeite(root, document); }); }
    else { initSeite(root, document); }
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
