// Adaptateur « données ouvertes » de la SNCF : le flux temps réel GTFS-RT
// (TripUpdates) que la SNCF publie sur transport.data.gouv.fr, sous licence
// ODbL, sans clé ni compte. Il couvre TGV INOUI, OUIGO, Intercités, Lyria, ICE
// et TER — pas l'Eurostar, que la SNCF n'exploite pas.
//
// Ce qu'on y a constaté en l'examinant (25 novembre 2026), et dont dépend ce code :
//  · environ 1 Mo de protobuf pour toute la France ; un train y figure dès
//    qu'il roule ou partira de son origine dans l'heure — l'horizon d'un
//    tableau de gare ;
//  · identifiant de trajet « OCESN6613F…::87686006:87722025:4:1410:20261212 » :
//    le numéro (6613), puis les codes UIC de l'origine et de la destination ;
//  · arrêt « StopPoint:OCETGV INOUI-87686006 » : le produit, puis le code UIC ;
//  · heures en secondes depuis 1970 (attendues), retard en secondes ;
//  · train supprimé : trajet CANCELED, horaires conservés, arrêts SKIPPED.
// Le flux ne donne ni voie ni motif de perturbation ; les noms des gares
// viennent des horaires théoriques (noms-gares.json, tools/noms-gares-sncf.py).
//
// Le décodage parcourt tout le fichier mais ne lit en détail que les arrêts de
// nos gares : quelques millisecondes, sous la limite de l'offre gratuite de
// Cloudflare Workers.

import NOMS from './noms-gares.json' with { type: 'json' };
import { train, ErreurSource } from './commun.js';
import { ligneSncf } from './sncf.js';

export const URL_GTFS_RT = 'https://proxy.transport.data.gouv.fr/resource/sncf-gtfs-rt-trip-updates';

// --- Protobuf minimal ---------------------------------------------------------
// Un curseur global évite d'allouer à chaque champ : le décodage est d'un seul tenant.
let p = 0;
function vi(b) {                       // entier non signé (longueurs, clés)
  let v = 0, m = 1, x;
  do { x = b[p++]; v += (x & 0x7f) * m; m *= 128; } while (x & 0x80);
  return v;
}
function vi32(b) {                     // int32 signé (un retard négatif tient sur dix octets)
  let v = 0, s = 0, x;
  do { x = b[p++]; if (s < 32) v |= (x & 0x7f) << s; s += 7; } while (x & 0x80);
  return v | 0;
}
function sauter(b, type) {
  if (type === 0) vi(b);
  else if (type === 1) p += 8;
  // Pas « p += vi(b) » : p serait lu avant que vi() ne l'avance d'un octet.
  else if (type === 2) { const n = vi(b); p += n; }
  else if (type === 5) p += 4;
  else throw new ErreurSource('Flux SNCF illisible');
}
const texte = new TextDecoder();

/** Les huit derniers octets d'un identifiant d'arrêt, lus comme un code UIC. */
function uicFinal(b, a, z) {
  if (z - a < 8) return -1;
  let v = 0;
  for (let i = z - 8; i < z; i++) { const c = b[i] - 48; if (c < 0 || c > 9) return -1; v = v * 10 + c; }
  return v;
}

function evenement(b, a, z) {           // StopTimeEvent : delay (1), time (2)
  const e = { t: null, d: 0 };
  p = a;
  while (p < z) {
    const cle = vi(b), no = Math.floor(cle / 8), type = cle & 7;
    if (no === 1 && type === 0) e.d = vi32(b);
    else if (no === 2 && type === 0) e.t = vi(b);
    else sauter(b, type);
  }
  return e;
}

/** Un StopTimeUpdate, s'il concerne une de nos gares. */
function arret(b, a, z, codes) {
  let arr = null, dep = null, stop = null, statut = 0;
  p = a;
  while (p < z) {
    const cle = vi(b), no = Math.floor(cle / 8), type = cle & 7;
    if (type === 2) {
      const n = vi(b), s = p; p += n;
      if (no === 2) arr = [s, p]; else if (no === 3) dep = [s, p]; else if (no === 4) stop = [s, p];
    } else if (no === 5 && type === 0) statut = vi(b);
    else sauter(b, type);
  }
  if (!stop) return null;
  const uic = uicFinal(b, stop[0], stop[1]);
  if (!codes.has(uic)) return null;
  const id = texte.decode(b.subarray(stop[0], stop[1]));
  return {
    uic: String(uic), produit: /^StopPoint:OCE(.+)-\d{8}$/.exec(id)?.[1] || '', saute: statut === 1,
    arr: arr ? evenement(b, arr[0], arr[1]) : null, dep: dep ? evenement(b, dep[0], dep[1]) : null,
  };
}

/** Les trajets qui touchent nos gares, avec leurs seuls arrêts chez nous. */
export function extraireGtfsRt(octets, codes, lecturePleine = false) {
  const b = octets, sortie = [];
  p = 0;
  while (p < b.length) {
    const cle = vi(b), no = Math.floor(cle / 8), type = cle & 7;
    if (type !== 2) { sauter(b, type); continue; }
    const n = vi(b), debutEntite = p, finEntite = p + n;
    p = finEntite;
    if (no !== 2) continue;                                    // FeedMessage.entity
    // FeedEntity : on cherche le trip_update (3).
    let tu = null;
    p = debutEntite;
    while (p < finEntite) {
      const c = vi(b), t = c & 7;
      if (t === 2) { const m = vi(b); if (Math.floor(c / 8) === 3) tu = [p, p + m]; p += m; } else sauter(b, t);
    }
    p = finEntite;
    if (!tu) continue;
    // TripUpdate : trip (1), stop_time_update (2, répété).
    let trip = null;
    const arrets = [];
    let q = tu[0];
    while (q < tu[1]) {
      p = q;
      const c = vi(b), t = c & 7, no2 = Math.floor(c / 8);
      if (t !== 2) { sauter(b, t); q = p; continue; }
      const m = vi(b), s = p, z = p + m;
      q = z;
      if (no2 === 1) trip = [s, z];
      else if (no2 === 2) {
        // Tri rapide : l'identifiant d'arrêt termine l'enregistrement (suivi au
        // plus de son statut, deux octets). Un arrêt qui n'est pas chez nous est
        // écarté sans être décodé — c'est l'immense majorité.
        if (!codes.has(uicFinal(b, s, z)) && !codes.has(uicFinal(b, s, z - 2)) && !lecturePleine) continue;
        const a = arret(b, s, z, codes);
        if (a) arrets.push(a);
      }
    }
    p = finEntite;
    if (!arrets.length || !trip) continue;
    // TripDescriptor : trip_id (1), schedule_relationship (4).
    let id = '', annule = false;
    p = trip[0];
    while (p < trip[1]) {
      const c = vi(b), t = c & 7, no3 = Math.floor(c / 8);
      if (no3 === 1 && t === 2) { const m = vi(b); id = texte.decode(b.subarray(p, p + m)); p += m; }
      else if (no3 === 4 && t === 0) annule = vi(b) === 3;
      else sauter(b, t);
    }
    p = finEntite;
    sortie.push({ id, annule, arrets });
  }
  return sortie;
}

/** « OCESN6613F…::87686006:87722025:4:1410:20261212 » → numéro, origine, destination. */
export function lireIdentifiant(id) {
  const fin = /(\d{8}):(\d{8}):\d+:\d+:\d{8}$/.exec(id);
  return { numero: /^OCESN(\d+)/.exec(id)?.[1] || '', origine: fin?.[1] || '', destination: fin?.[2] || '' };
}

export const nomGare = (uic) => NOMS[uic] || '';

/** Les trains d'une gare, dans la forme commune, depuis l'extrait. */
export function lireSncfOuvert(trajets, sens, point) {
  const arrivee = sens === 'arrivees';
  const trains = [];
  for (const tr of trajets) {
    const a = tr.arrets.find((x) => x.uic === point.uic);
    // Sans produit, ce sont des RER et des Transilien (identifiant court, zone
    // d'arrêt sans type de train) : Île-de-France Mobilités les donne déjà. Les
    // autocars, eux, partent de la gare routière.
    if (!a || !a.produit || /^Car/i.test(a.produit)) continue;
    const ev = arrivee ? a.arr : a.dep;
    if (!ev || ev.t === null) continue;                   // pas de départ au terminus, pas d'arrivée à l'origine
    const { numero, origine, destination } = lireIdentifiant(tr.id);
    const reel = ev.t * 1000, prevu = reel - ev.d * 1000;
    const retard = Math.max(0, Math.round(ev.d / 60));
    trains.push(train({
      source: 'sncf', reseau: 'grandes-lignes', t: prevu, reel, retard,
      etat: tr.annule || a.saute ? 'supprime' : retard >= 1 ? 'retard' : 'a-l-heure',
      ligne: ligneSncf({ commercial_mode: a.produit }), numero,
      lieu: nomGare(arrivee ? origine : destination),
    }));
  }
  return trains;
}

export async function appelerSncfOuvert(fetchFn = fetch) {
  const rep = await fetchFn(URL_GTFS_RT, { headers: { Accept: 'application/x-protobuf' }, signal: AbortSignal.timeout(10000) });
  if (!rep.ok) throw new ErreurSource(`Données ouvertes SNCF indisponibles (${rep.status})`, rep.status);
  return new Uint8Array(await rep.arrayBuffer());
}
