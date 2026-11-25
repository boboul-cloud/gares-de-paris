// Gares de Paris — relais « En direct ».
//
// Le site est statique (GitHub Pages) : il ne peut pas garder de clé secrète.
// Ce Worker Cloudflare la garde pour lui, interroge l'API de la SNCF (grandes
// lignes) et celle d'Île-de-France Mobilités (RER, Transilien), ramène les deux
// réponses à une même forme, et les met en cache : une gare n'est redemandée
// aux API qu'une fois par minute (deux avec Île-de-France Mobilités, dont le
// quota des comptes récents est bas), quel que soit le nombre de visiteurs.
//
//   GET /tableau?gare=paris-lyon&sens=departs|arrivees[&point=0][&exemple=1]
//   GET /sante      quelles sources sont configurées (jamais les clés)
//
// Grandes lignes : l'API SNCF si une clé est installée, sinon le flux temps réel
// ouvert que la SNCF publie sur transport.data.gouv.fr (src/sncf-ouvert.js).
// RER et Transilien : sans clé, et tant que MODE_EXEMPLE vaut "1", des données
// d'exemple fabriquées au format exact de l'API (src/exemple.js).

import DIRECT from '../../shared/data/direct.json' with { type: 'json' };
import { heureParis, ErreurSource } from './commun.js';
import { urlSncf, lireSncf, marquerSuppressions, appelerSncf } from './sncf.js';
import { urlPrim, lirePrim, appelerPrim } from './prim.js';
import { exempleSncf, exemplePrim } from './exemple.js';
import { extraireGtfsRt, lireSncfOuvert, appelerSncfOuvert } from './sncf-ouvert.js';

const NOMS = { sncf: 'SNCF', prim: 'Île-de-France Mobilités', ouvert: 'SNCF (données ouvertes)' };
// Les codes UIC de toutes nos gares : l'extrait du flux ouvert les sert toutes.
const CODES_SNCF = new Set(Object.values(DIRECT.gares).flatMap((g) => (g.points || []).map((p) => +p.uic).filter(Boolean)));
const PAR_RESEAU = 12;

export default {
  fetch: (requete, env, ctx) => repondre(requete, env, ctx),
};

function entetesCors(requete, env) {
  const origine = requete.headers.get('Origin');
  const permises = String(env.ORIGINES || '').split(',').map((s) => s.trim()).filter(Boolean);
  const h = { Vary: 'Origin' };
  if (origine && permises.includes(origine)) {
    h['Access-Control-Allow-Origin'] = origine;
    h['Access-Control-Allow-Methods'] = 'GET, OPTIONS';
  }
  return h;
}

const enJson = (corps, statut, entetes) => new Response(JSON.stringify(corps), {
  status: statut, headers: { 'Content-Type': 'application/json; charset=utf-8', ...entetes },
});

const modeExemple = (env) => String(env.MODE_EXEMPLE ?? '1') !== '0';

/**
 * Le flux ouvert de la SNCF pèse un mégaoctet pour toute la France : il est lu
 * au plus une fois par minute, et l'extrait de nos gares sert à toutes.
 */
async function extraitOuvert(outils) {
  const { cache, fetchFn, ctx } = outils;
  const cle = new Request('https://relais.gares-de-paris/sncf-ouvert');
  const garde = cache ? await cache.match(cle) : null;
  if (garde) return garde.json();
  const extrait = extraireGtfsRt(await appelerSncfOuvert(fetchFn), CODES_SNCF);
  if (cache) {
    const promesse = cache.put(cle, new Response(JSON.stringify(extrait), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=60' } }));
    if (ctx?.waitUntil) ctx.waitUntil(promesse); else await promesse;
  }
  return extrait;
}

/**
 * D'où viennent les grandes lignes : SNCF_SOURCE vaut « auto » (l'API si une
 * clé est installée, sinon le flux ouvert), « api », « ouvert » ou « exemple ».
 */
function modeSncf(env, forcerExemple) {
  const choix = forcerExemple ? 'exemple' : String(env.SNCF_SOURCE || 'auto');
  if (choix === 'auto') return env.SNCF_TOKEN ? 'api' : 'ouvert';
  return choix;
}

/** Une source : ses trains, et son état (pour dire au visiteur d'où viennent les données). */
async function interroger(source, env, point, sens, maintenant, forcerExemple, outils) {
  const { fetchFn } = outils;
  const mode = source === 'sncf' ? modeSncf(env, forcerExemple)
    : forcerExemple || (!env.PRIM_TOKEN && modeExemple(env)) ? 'exemple' : 'api';
  const cle = source === 'sncf' ? env.SNCF_TOKEN : env.PRIM_TOKEN;
  const etat = { source, nom: mode === 'ouvert' ? NOMS.ouvert : NOMS[source], exemple: mode === 'exemple' };
  if (mode === 'api' && !cle) return { trains: [], etat: { ...etat, ok: false, erreur: `Clé ${NOMS[source]} non installée` } };
  try {
    let trains;
    if (source === 'sncf' && mode === 'ouvert') {
      trains = lireSncfOuvert(await extraitOuvert(outils), sens, point);
    } else if (source === 'sncf') {
      let reel, theo = null;
      if (mode === 'exemple') ({ reel, theo } = exempleSncf(point, sens, maintenant));
      else {
        [reel, theo] = await Promise.all([
          appelerSncf(urlSncf(env, point.uic, sens, maintenant, 'realtime'), cle, fetchFn),
          String(env.SNCF_SUPPRESSIONS ?? '1') === '0' ? null
            : appelerSncf(urlSncf(env, point.uic, sens, maintenant, 'base_schedule'), cle, fetchFn).catch(() => null),
        ]);
      }
      trains = lireSncf(reel, sens, point);
      if (theo) trains = marquerSuppressions(trains, lireSncf(theo, sens, point));
    } else {
      const json = mode === 'exemple' ? exemplePrim(point, maintenant) : await appelerPrim(urlPrim(env, point.zda), cle, fetchFn);
      trains = lirePrim(json, sens, DIRECT.lignes);
    }
    return { trains, etat: { ...etat, ok: true } };
  } catch (e) {
    const message = e instanceof ErreurSource ? e.message
      : e?.name === 'TimeoutError' ? `${etat.nom} ne répond pas` : `${etat.nom} : réponse illisible`;
    return { trains: [], etat: { ...etat, ok: false, erreur: message, quota: e?.statut === 429 } };
  }
}

export async function repondre(requete, env, ctx, outils = {}) {
  const url = new URL(requete.url);
  const cors = entetesCors(requete, env);
  if (requete.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (requete.method !== 'GET') return enJson({ erreur: 'Méthode non prise en charge' }, 405, cors);

  if (url.pathname === '/sante') {
    return enJson({ sncf: !!env.SNCF_TOKEN, prim: !!env.PRIM_TOKEN, grandesLignes: modeSncf(env, false), exemple: modeExemple(env) }, 200, cors);
  }
  if (url.pathname !== '/tableau') return enJson({ erreur: 'Adresse inconnue' }, 404, cors);

  const gare = url.searchParams.get('gare') || '';
  const sens = url.searchParams.get('sens') === 'arrivees' ? 'arrivees' : 'departs';
  const iPoint = Math.max(0, parseInt(url.searchParams.get('point') || '0', 10) || 0);
  const forcerExemple = url.searchParams.get('exemple') === '1';
  const fiche = Object.hasOwn(DIRECT.gares, gare) ? DIRECT.gares[gare] : null;
  if (!fiche) return enJson({ erreur: 'Gare inconnue' }, 404, cors);
  if (fiche.ferme) return enJson({ gare, ferme: fiche.ferme, trains: [], sources: [] }, 200, cors);
  const point = fiche.points[iPoint];
  if (!point) return enJson({ erreur: 'Point d’arrêt inconnu' }, 404, cors);

  // Le cache est partagé par tous les visiteurs : c'est lui qui protège les quotas.
  const cache = outils.cache !== undefined ? outils.cache : globalThis.caches?.default;
  const cle = new Request(`https://relais.gares-de-paris/${gare}/${iPoint}/${sens}${forcerExemple ? '/exemple' : ''}`);
  const garde = cache ? await cache.match(cle) : null;
  if (garde) {
    const h = new Headers(garde.headers);
    for (const [k, v] of Object.entries(cors)) h.set(k, v);
    h.set('X-Relais-Cache', 'oui');
    return new Response(garde.body, { status: garde.status, headers: h });
  }

  const maintenant = outils.maintenant ? outils.maintenant() : Date.now();
  const sous = { fetchFn: outils.fetch || fetch, cache, ctx };
  const resultats = await Promise.all([
    point.uic ? interroger('sncf', env, point, sens, maintenant, forcerExemple, sous) : null,
    // Sans clé Île-de-France Mobilités et hors mode exemple, le RER est tu
    // plutôt qu'en panne : le site peut vivre avec les seules grandes lignes.
    point.zda && (env.PRIM_TOKEN || forcerExemple || modeExemple(env)) ? interroger('prim', env, point, sens, maintenant, forcerExemple, sous) : null,
  ].filter(Boolean));
  const enAttente = point.zda && !env.PRIM_TOKEN && !forcerExemple && !modeExemple(env)
    ? 'Les RER et les Transilien s’afficheront ici dès que la clé d’Île-de-France Mobilités sera installée.' : null;

  // On garde les trains à venir (et ceux partis depuis moins d'une minute),
  // dans l'ordre de l'horaire prévu, comme sur les tableaux de gare. Chaque
  // réseau a sa part : un RER toutes les quatre minutes chasserait sinon les
  // grandes lignes du tableau — en gare, ce sont d'ailleurs deux écrans.
  const aVenir = resultats.flatMap((r) => r.trains)
    .filter((t) => Math.max(t.t, t.t + t.retard * 60000) >= maintenant - 60000)
    .sort((a, b) => a.t - b.t || a.numero.localeCompare(b.numero));
  const trains = ['grandes-lignes', 'ile-de-france']
    .flatMap((r) => aVenir.filter((t) => t.reseau === r).slice(0, PAR_RESEAU))
    .sort((a, b) => a.t - b.t || a.numero.localeCompare(b.numero));
  const sources = resultats.map((r) => r.etat);
  const corps = {
    gare, point: point.nom, sens, heure: heureParis(maintenant), a: new Date(maintenant).toISOString(),
    exemple: sources.some((s) => s.exemple), sources, trains, ...(enAttente ? { remarque: enAttente } : {}),
  };

  // Durée de garde : une minute, deux si Île-de-France Mobilités est de la
  // partie ; une panne est gardée trente secondes, un quota épuisé cinq minutes.
  const panne = sources.length && sources.every((s) => !s.ok);
  const duree = sources.some((s) => s.quota) ? 300 : panne ? 30 : point.zda ? 120 : 60;
  const reponse = enJson(corps, panne ? 502 : 200, { ...cors, 'Cache-Control': `public, max-age=${duree}` });
  if (cache) {
    const aGarder = enJson(corps, panne ? 502 : 200, { 'Cache-Control': `public, max-age=${duree}` });
    const promesse = cache.put(cle, aGarder);
    if (ctx?.waitUntil) ctx.waitUntil(promesse); else await promesse;
  }
  return reponse;
}
