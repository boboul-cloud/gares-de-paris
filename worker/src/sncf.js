// Adaptateur SNCF : l'API de la SNCF (api.sncf.com), construite sur Navitia.
//
// Ce qu'en dit la documentation Navitia (doc.navitia.io), et dont dépend ce code :
//  · /coverage/{région}/stop_areas/{zone}/departures (ou /arrivals), clé brute
//    dans l'en-tête Authorization ;
//  · heures « AAAAMMJJTHHMMSS » en heure locale ; en temps réel, departure_date_time
//    intègre le retard et base_departure_date_time garde l'horaire prévu ;
//  · un train supprimé n'apparaît tout simplement plus en temps réel : on le
//    retrouve en comparant avec l'horaire théorique (data_freshness=base_schedule) ;
//  · les perturbations sont à la racine (disruptions), reliées à chaque départ
//    par display_informations.links ; aucune voie n'est donnée ;
//  · pour une arrivée, aucun champ ne donne la provenance : on prend l'autre
//    bout du nom de la ligne (« Marseille - Paris »), faute de mieux.

import { lireNavitia, ecrireNavitia, minutesEntre, train, ErreurSource } from './commun.js';

export function urlSncf(env, uic, sens, depuis, fraicheur) {
  const base = (env.SNCF_BASE || 'https://api.sncf.com/v1/coverage/sncf').replace(/\/$/, '');
  const zone = (env.SNCF_PREFIXE || 'stop_area:SNCF:') + uic;
  const u = new URL(`${base}/stop_areas/${zone}/${sens === 'arrivees' ? 'arrivals' : 'departures'}`);
  u.searchParams.set('from_datetime', ecrireNavitia(depuis - 10 * 60000));
  u.searchParams.set('duration', String(4 * 3600));
  u.searchParams.set('count', '16');
  u.searchParams.set('data_freshness', fraicheur);
  return u;
}

// Les badges des grandes lignes : un nom court, une couleur reconnaissable.
const MARQUES = [
  [/OUIGO/i, 'OUIGO', '#E2007A', '#FFFFFF'],
  [/LYRIA/i, 'LYRIA', '#B4004E', '#FFFFFF'],
  [/EUROSTAR|THALYS/i, 'EUROSTAR', '#1F2F5C', '#FFFFFF'],
  [/ICE/, 'ICE', '#5E6670', '#FFFFFF'],
  [/FRECCIA/i, 'FRECCIA', '#B0001E', '#FFFFFF'],
  [/RENFE|AVE/i, 'RENFE', '#6B2C91', '#FFFFFF'],
  [/NUIT/i, 'NUIT', '#2E2A5C', '#FFFFFF'],
  [/INTERCIT/i, 'IC', '#00507D', '#FFFFFF'],
  [/TRAM-?TRAIN/i, 'T-TRAIN', '#2F6DB5', '#FFFFFF'],
  [/TER/i, 'TER', '#2F6DB5', '#FFFFFF'],
  [/TGV|INOUI/i, 'TGV', '#7A1E5E', '#FFFFFF'],
];

export function ligneSncf(di) {
  const nom = (di.commercial_mode || di.physical_mode || 'Train').trim();
  const m = MARQUES.find(([re]) => re.test(`${di.commercial_mode || ''} ${di.network || ''}`));
  return m ? { nom, court: m[1], couleur: m[2], texte: m[3] } : { nom, court: nom.slice(0, 8).toUpperCase(), couleur: '#4A5560', texte: '#FFFFFF' };
}

/** Un RER ou un Transilien : Île-de-France Mobilités le donne déjà, avec sa voie. */
export const estFrancilien = (di) => /\bRER\b|TRANSILIEN/i.test(`${di.commercial_mode || ''} ${di.network || ''} ${di.physical_mode || ''}`);

/** « Marseille Saint-Charles (Marseille) » → « Marseille Saint-Charles ». */
export const nettoyer = (s) => String(s ?? '').replace(/\s*\([^)]*\)\s*$/, '').trim();

/** L'autre bout d'une ligne « A - B », vu depuis la ville où l'on est. */
export function autreBout(libelle, ville) {
  const parts = String(libelle ?? '').split(/\s+-\s+/);
  if (parts.length === 2 && ville) {
    const [a, b] = parts;
    if (a.includes(ville) && !b.includes(ville)) return b.trim();
    if (b.includes(ville) && !a.includes(ville)) return a.trim();
  }
  return String(libelle ?? '').trim();
}

/** Les trains d'une réponse Navitia, dans la forme commune. */
export function lireSncf(json, sens, point) {
  const arrivee = sens === 'arrivees';
  const items = (json && json[arrivee ? 'arrivals' : 'departures']) || [];
  const perturbations = new Map((json?.disruptions || []).map((d) => [d.id, d]));
  const trains = [];
  for (const it of items) {
    const di = it.display_informations || {};
    const sdt = it.stop_date_time || {};
    if (estFrancilien(di)) continue;
    const reel = lireNavitia(arrivee ? sdt.arrival_date_time : sdt.departure_date_time);
    const prevu = lireNavitia(arrivee ? sdt.base_arrival_date_time : sdt.base_departure_date_time) ?? reel;
    if (reel === null && prevu === null) continue;
    const liees = (di.links || []).filter((l) => l.type === 'disruption' || l.rel === 'disruptions')
      .map((l) => perturbations.get(l.id)).filter(Boolean);
    const effets = liees.map((d) => d.severity?.effect);
    const retard = reel !== null && prevu !== null ? Math.max(0, minutesEntre(prevu, reel)) : 0;
    const etat = effets.includes('NO_SERVICE') ? 'supprime' : retard >= 1 ? 'retard' : 'a-l-heure';
    trains.push(train({
      source: 'sncf', reseau: 'grandes-lignes', t: prevu ?? reel, reel: reel ?? prevu, retard, etat,
      ligne: ligneSncf(di), numero: di.trip_short_name || di.headsign || '',
      lieu: arrivee ? nettoyer(autreBout(di.label || di.name, point.ville)) : nettoyer(di.direction),
      message: liees.map((d) => d.messages?.[0]?.text).find(Boolean) || null,
    }));
  }
  return trains;
}

/**
 * Les trains supprimés : présents dans l'horaire théorique, absents du temps
 * réel, dans la même fenêtre de temps. Ils rejoignent la liste, barrés.
 */
export function marquerSuppressions(reels, theoriques) {
  if (!theoriques.length) return reels;
  const vus = new Set(reels.map((t) => t.numero));
  const fin = reels.length ? Math.max(...reels.map((t) => t.t)) : Infinity;
  const supprimes = theoriques
    .filter((t) => t.numero && !vus.has(t.numero) && t.t <= fin)
    .map((t) => ({ ...t, etat: 'supprime', retard: 0, reelle: t.prevue }));
  return [...reels, ...supprimes];
}

/** Codes d'absence de Navitia : un horaire vide, pas une panne. */
const VIDE = new Set(['no_departure_this_day', 'no_active_circulation_this_day', 'terminus', 'partial_terminus', 'active_disruption']);

export async function appelerSncf(url, cle, fetchFn = fetch) {
  const rep = await fetchFn(url, { headers: { Authorization: cle, Accept: 'application/json' }, signal: AbortSignal.timeout(8000) });
  if (rep.status === 404) {
    const corps = await rep.json().catch(() => ({}));
    if (VIDE.has(corps?.error?.id)) return { departures: [], arrivals: [] };
    throw new ErreurSource('Gare inconnue de l’API SNCF', 404);
  }
  if (rep.status === 401 || rep.status === 403) throw new ErreurSource('Clé SNCF refusée', rep.status);
  if (rep.status === 429) throw new ErreurSource('Quota SNCF atteint', 429);
  if (!rep.ok) throw new ErreurSource(`API SNCF indisponible (${rep.status})`, rep.status);
  return rep.json();
}
