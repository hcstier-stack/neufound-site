/* Kampagnen-Landingpages: die eine Stelle fuer alle Schalter und Namen.
   Schnittstelle und Link-Schema: Kampagnenmodell-Schnittstelle-111126-HCS.md (Chat P01_CC3285). */
window.NF_KONFIG = {
  // Adresse der Funktionen im Vertriebsprojekt (Supabase, ohne Schraegstrich am Ende).
  endpunkt: "https://parlvnbghyzktutrarza.supabase.co/functions/v1",

  // Aufrufzaehler (POST /aufruf). Vorgabe AUS, bis die Rechtspruefung (P25) ihn freigibt.
  aufrufZaehlen: false,

  // WhatsApp-Nummer fuer die Weiche /lp/w/, mit Laendervorwahl, nur Ziffern (zum Beispiel 49...).
  // Leer = die Weiche zeigt Mail und Telefon statt des Knopfes. Nummer setzt Hans.
  whatsappNummer: "",

  // Kontakt fuer die Weiche ohne Nummer und fuer Fehlermeldungen.
  kontaktMail: "kontakt@neufound.ai",
  kontaktTelefon: "[Telefonnummer]",

  // Vorbelegter Text der Weiche, Schluessel wa-c2c der Vorlagen. Der Code wird als "(Code ABCDE)" angehaengt.
  waText: {
    "wa-c2c": "Guten Tag, ich komme über Ihren Link und möchte gern 15 Minuten sprechen."
  },

  // Begruessungszeile nach dem ersten Zeichen des Codes: E Mail, W WhatsApp, L LinkedIn, sonst neutral.
  begruessung: {
    E: "Sie kommen aus meiner E-Mail.",
    W: "Sie kommen aus meiner WhatsApp-Nachricht.",
    L: "Sie kommen von LinkedIn.",
    neutral: "Schön, dass Sie vorbeischauen."
  },

  // Zielgruppen. Schluessel = Ordner unter /lp/.
  // produkt = Produktschluessel fuer lead-eingang; produktname/titel erscheinen auf der Seite.
  // Name offen, Entscheidung Hans (alle vier Namen sind Platzhalter).
  // direktBestellen: nur wenn die Bestellstrecke den Lead annimmt (laut Schnittstelle nur immo).
  zielgruppen: {
    immo:   { produkt: "os-b",              produktname: "Neufound",                         titel: "Für Bauherren und Bestandshalter",           direktBestellen: true  },
    campus: { produkt: "kalle-os",          produktname: "Neufound für Campus und Quartier", titel: "Für Betreiber von Campus und Quartier",      direktBestellen: false },
    verein: { produkt: "vereinsmeierei-os", produktname: "Neufound für Vereine",             titel: "Für eingetragene Vereine und Verbände",      direktBestellen: false },
    einzel: { produkt: "os-a",              produktname: "Neufound persönlich",              titel: "Für Selbstständige und Unternehmer",         direktBestellen: false }
  }
};
