// Adaptateur Île-de-France Mobilités : l'API « Prochains passages » de PRIM
// (stop-monitoring, SIRI Lite en JSON), pour le RER et le Transilien.
//
// Les pages de documentation de PRIM refusent les lectures automatiques ; ce
// qui suit a été recoupé sur deux clients open source indépendants et sur une
// note de référence qui cite la documentation officielle :
//  · GET …/marketplace/stop-monitoring?MonitoringRef=STIF:StopArea:SP:<zone>:,
//    clé dans l'en-tête « apikey » ; depuis mars 2025, les trains SNCF (RER,
//    Transilien) ne sont donnés qu'à la zone d'arrêt ;
//  · les textes sont enveloppés : {"value": …} ou [{"value": …}] ;
//  · heures ISO en temps universel ; DepartureStatus / ArrivalStatus valent
//    onTime, delayed, cancelled, missed, notExpected, departed, arrived… ;
//  · un train au terminus n'a pas d'heure de départ ; la voie est dans
//    DeparturePlatformName / ArrivalPlatformName ; le numéro dans
//    TrainNumbers.TrainNumberRef, le code mission dans JourneyNote.
// La provenance d'un train qui arrive n'est pas documentée : OriginName est lu
// s'il existe, sinon la ligne et sa mission en tiennent lieu.

import { lireIso, minutesEntre, train, ErreurSource } from './commun.js';

export function urlPrim(env, zda) {
  const u = new URL(env.PRIM_BASE || 'https://prim.iledefrance-mobilites.fr/marketplace/stop-monitoring');
  u.searchParams.set('MonitoringRef', `STIF:StopArea:SP:${zda}:`);
  return u;
}

/** Déballe "x", {value: "x"} et [{value: "x"}]. */
export function valeur(x) {
  if (x === undefined || x === null) return undefined;
  if (typeof x === 'string') return x || undefined;
  if (typeof x === 'number' || typeof x === 'boolean') return String(x);
  if (Array.isArray(x)) {
    for (const i of x) { const v = valeur(i); if (v) return v; }
    return undefined;
  }
  return valeur(x.value);
}

const tableau = (x) => (x === undefined || x === null ? [] : Array.isArray(x) ? x : [x]);

/**
 * Ce qu'on peut dire d'un train qui arrive : sa provenance si la réponse la
 * donne (elle ne la donne pas, constaté le 25 novembre 2026) ; sinon, s'il
 * repart, sa destination (« vers … ») ; sinon rien, et le tableau montre sa ligne.
 */
function provenance(mvj, appel) {
  const origine = valeur(mvj.OriginName);
  if (origine) return origine;
  const repart = appel.AimedDepartureTime || appel.ExpectedDepartureTime;
  const destination = valeur(mvj.DestinationName) || valeur(appel.DestinationDisplay);
  return repart && destination ? `vers ${destination}` : '';
}

/** Une voie connue, ou null : la source écrit « unknown » tant qu'elle ne l'est pas. */
const voieConnue = (v) => (v && !/^(unknown|inconnue?|-+|\?)$/i.test(v.trim()) ? v.trim() : null);

/** Les trains d'une réponse SIRI, dans la forme commune. Les TER sont laissés à la SNCF. */
export function lirePrim(json, sens, lignes) {
  const arrivee = sens === 'arrivees';
  const livraisons = tableau(json?.Siri?.ServiceDelivery?.StopMonitoringDelivery);
  const erreur = livraisons.map((l) => l.ErrorCondition).find(Boolean);
  if (erreur && !livraisons.some((l) => tableau(l.MonitoredStopVisit).length)) {
    throw new ErreurSource(`Zone d'arrêt refusée par Île-de-France Mobilités : ${valeur(erreur.Description) || valeur(erreur.ErrorText) || 'erreur SIRI'}`);
  }
  const trains = [];
  for (const visite of livraisons.flatMap((l) => tableau(l.MonitoredStopVisit))) {
    const mvj = visite?.MonitoredVehicleJourney;
    if (!mvj) continue;
    const appel = mvj.MonitoredCall || {};
    const id = /::(C\d+):?/.exec(valeur(mvj.LineRef) || '')?.[1];
    const ligne = lignes[id];
    if (!ligne) continue;
    // Un départ a une heure de départ ; un train qui termine ici n'en a pas.
    const prevu = lireIso(arrivee ? appel.AimedArrivalTime : appel.AimedDepartureTime);
    const attendu = lireIso(arrivee ? appel.ExpectedArrivalTime : appel.ExpectedDepartureTime);
    if (prevu === null && attendu === null) continue;
    const statut = String(valeur(arrivee ? appel.ArrivalStatus : appel.DepartureStatus)
      || valeur(appel.DepartureStatus) || valeur(appel.ArrivalStatus) || '').toLowerCase();
    const retard = prevu !== null && attendu !== null ? Math.max(0, minutesEntre(prevu, attendu)) : 0;
    const etat = /cancel|missed|notexpected/.test(statut) ? 'supprime'
      : statut === 'delayed' || retard >= 1 ? 'retard'
        : statut || prevu !== null ? 'a-l-heure' : 'inconnu';
    trains.push(train({
      source: 'prim', reseau: 'ile-de-france', t: prevu ?? attendu, reel: attendu ?? prevu, retard, etat,
      ligne: { ...ligne }, numero: valeur(mvj.TrainNumbers?.TrainNumberRef) || valeur(mvj.VehicleJourneyName) || '',
      mission: valeur(mvj.JourneyNote) || '',
      lieu: arrivee ? provenance(mvj, appel) : valeur(mvj.DestinationName) || valeur(appel.DestinationDisplay) || '',
      voie: voieConnue(valeur(arrivee ? appel.ArrivalPlatformName : appel.DeparturePlatformName))
        || voieConnue(valeur(appel.ArrivalPlatformName)) || voieConnue(valeur(appel.DeparturePlatformName)),
      aQuai: appel.VehicleAtStop === true || appel.VehicleAtStop === 'true',
    }));
  }
  return trains;
}

export async function appelerPrim(url, cle, fetchFn = fetch) {
  const rep = await fetchFn(url, { headers: { apikey: cle, Accept: 'application/json' }, signal: AbortSignal.timeout(8000) });
  if (rep.status === 401 || rep.status === 403) throw new ErreurSource('Clé Île-de-France Mobilités refusée', rep.status);
  if (rep.status === 429) throw new ErreurSource('Quota Île-de-France Mobilités atteint', 429);
  if (!rep.ok) throw new ErreurSource(`API Île-de-France Mobilités indisponible (${rep.status})`, rep.status);
  return rep.json();
}
