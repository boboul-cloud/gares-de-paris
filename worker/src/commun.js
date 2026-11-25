// Outils communs du relais : l'heure de Paris, et la forme des trains renvoyés.
//
// Les deux sources ne parlent pas la même heure : la SNCF (Navitia) donne
// l'heure locale de Paris sans fuseau (« 20261125T101500 »), Île-de-France
// Mobilités (SIRI) donne l'heure universelle (« 2026-11-25T09:15:00.000Z »).
// Tout est ramené ici à un instant (millisecondes depuis 1970), puis affiché
// à l'heure de Paris, changements d'heure compris.

export const FUSEAU = 'Europe/Paris';

const format = new Intl.DateTimeFormat('en-GB', {
  timeZone: FUSEAU, hourCycle: 'h23',
  year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
});
const d2 = (n) => String(n).padStart(2, '0');

/** Composantes de l'heure de Paris à un instant donné. */
export function partiesParis(ms) {
  const p = Object.fromEntries(format.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return { an: +p.year, mois: +p.month, jour: +p.day, h: +p.hour, min: +p.minute, s: +p.second };
}

/** Avance de Paris sur l'heure universelle à cet instant, en millisecondes. */
function decalage(ms) {
  const p = partiesParis(ms);
  return Date.UTC(p.an, p.mois - 1, p.jour, p.h, p.min, p.s) - Math.floor(ms / 1000) * 1000;
}

/** Heure locale de Paris → instant. Deux passes suffisent, même un jour de changement d'heure. */
export function parisVersInstant(an, mois, jour, h, min, s = 0) {
  const naif = Date.UTC(an, mois - 1, jour, h, min, s);
  const t = naif - decalage(naif);
  return naif - decalage(t);
}

/** « 20261125T101500 » (heure locale Navitia) → instant, ou null. */
export function lireNavitia(txt) {
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})$/.exec(String(txt ?? ''));
  return m ? parisVersInstant(+m[1], +m[2], +m[3], +m[4], +m[5], +m[6]) : null;
}

/** Instant → « 20261125T101500 », pour interroger Navitia ou fabriquer un exemple. */
export function ecrireNavitia(ms) {
  const p = partiesParis(ms);
  return `${p.an}${d2(p.mois)}${d2(p.jour)}T${d2(p.h)}${d2(p.min)}${d2(p.s)}`;
}

/** « 2026-11-25T09:15:00.000Z » (SIRI) → instant, ou null. */
export function lireIso(txt) {
  if (!txt) return null;
  const t = Date.parse(txt);
  return Number.isFinite(t) ? t : null;
}

/** Instant → « 10:15 », à l'heure de Paris. */
export function heureParis(ms) {
  const p = partiesParis(ms);
  return `${d2(p.h)}:${d2(p.min)}`;
}

export const minutesEntre = (a, b) => Math.round((b - a) / 60000);

/**
 * La forme commune d'un train, quelle que soit sa source :
 *   t        instant prévu (sert à trier, comme sur les tableaux de gare)
 *   prevue   heure prévue « HH:MM » ; reelle : heure attendue « HH:MM »
 *   retard   en minutes (0 si à l'heure) ; etat : a-l-heure | retard | supprime | inconnu
 *   ligne    { nom, court, couleur, texte } ; numero ; mission (code RER à 4 lettres)
 *   lieu     destination (départs) ou provenance (arrivées), quand elle est connue
 *   voie     quand la source la donne (Île-de-France Mobilités seulement)
 *   message  le motif d'une perturbation, s'il y en a un
 */
export function train(champs) {
  return {
    source: champs.source, reseau: champs.reseau, t: champs.t,
    prevue: heureParis(champs.t), reelle: heureParis(champs.reel ?? champs.t),
    retard: Math.max(0, champs.retard ?? 0), etat: champs.etat || 'inconnu',
    ligne: champs.ligne, numero: champs.numero || '', mission: champs.mission || '',
    lieu: champs.lieu || '', voie: champs.voie || null, message: champs.message || null,
    aQuai: !!champs.aQuai,
  };
}

/** Message d'erreur lisible, sans jamais répéter une clé. */
export class ErreurSource extends Error {
  constructor(message, statut = 0) { super(message); this.statut = statut; }
}
