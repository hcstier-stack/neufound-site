// Einstellungen der Bestellstrecke. Leer = Online-Bestellung aus, die Seite zeigt den Weg über kontakt@neufound.ai.
// VERTRIEB_URL: Adresse der Funktion "registrierung" im Vertriebsprojekt (…/functions/v1/registrierung).
// FASSUNG: muss den Umgebungswerten VERTRAG_FASSUNG_AGB / _AVV / _BESTELLSCHEIN der Funktion entsprechen, sonst antwortet sie 400 "veraltet".
export const KONFIG = {
  VERTRIEB_URL: "",
  FASSUNG: { agb: "", avv: "", bestellschein: "" },
};
