// Le mode exemple : des réponses fabriquées au format exact de chaque API,
// calées sur l'heure qu'il est. Elles passent par les vrais adaptateurs, si
// bien que tout le chemin — lecture, retards, suppressions, voies, tri, cache,
// affichage — est éprouvé avant même que les clés n'existent.
//
// Les trains sont tirés au sort de façon reproductible : une même gare donne
// le même tableau pendant dix minutes, puis il avance avec l'heure.

import { ecrireNavitia } from './commun.js';

function hasard(graine) {
  let h = 2166136261;
  for (const c of graine) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return () => { h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0; h ^= h >>> 16; return (h >>> 0) / 4294967296; };
}

const PAS = 10 * 60000;
const tranche = (ms) => Math.floor(ms / PAS) * PAS;
const iso = (ms) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, '.000Z');

// Marques plausibles selon la destination.
function marque(destination, k) {
  if (/Londres|Bruxelles|Amsterdam|Cologne/.test(destination)) return ['EUROSTAR', 'Train grande vitesse'];
  if (/Genève|Lausanne|Zurich|Bâle/.test(destination)) return ['TGV Lyria', 'Train grande vitesse'];
  if (/Milano|Turin|Torino/.test(destination)) return ['FRECCIAROSSA', 'Train grande vitesse'];
  if (/Francfort|Stuttgart|Munich/.test(destination)) return ['ICE', 'Train grande vitesse'];
  if (/Latour|Briançon|Cerbère/.test(destination)) return ['INTERCITES de nuit', 'Train'];
  // TER et Intercités pour les villes de la région, TGV pour les grandes villes.
  if (/Dijon|Montargis|Nevers|Vichy|Moulins|Clermont|Orléans|Limoges|Brive|Amiens|Dunkerque|Rouen|Le Havre|Caen|Cherbourg|Évreux|Trouville|Reims|Metz|Nancy|Mulhouse/.test(destination)) {
    return [['TER', 'TER / Intercités'], ['INTERCITES', 'TER / Intercités']][k % 2];
  }
  return [['TGV INOUI', 'Train grande vitesse'], ['OUIGO', 'Train grande vitesse']][k % 2];
}

/**
 * Une réponse Navitia (departures ou arrivals) et sa version théorique.
 * Le troisième train a 10 à 25 minutes de retard ; le sixième est supprimé :
 * présent dans l'horaire théorique, absent du temps réel.
 */
export function exempleSncf(point, sens, maintenant) {
  const arrivee = sens === 'arrivees';
  const r = hasard(`${point.uic}|${sens}|${tranche(maintenant)}`);
  const villes = point.exemples || ['Lyon Part-Dieu'];
  const debut = tranche(maintenant) + 2 * 60000;
  const items = [], theoriques = [], disruptions = [];
  let t = debut;
  for (let k = 0; k < 11; k++) {
    t += (4 + Math.floor(r() * 9)) * 60000;
    const ville = villes[Math.floor(r() * villes.length)];
    const [commercial, physique] = marque(ville, Math.floor(r() * 4));
    const numero = String(arrivee ? 6200 + Math.floor(r() * 3700) : 6100 + Math.floor(r() * 3800));
    const retard = k === 2 ? (10 + Math.floor(r() * 16)) * 60000 : k === 7 ? 4 * 60000 : 0;
    const idPerturbation = `exemple-${numero}`;
    const libelle = arrivee ? `${ville} - ${point.ville}` : `${point.ville} - ${ville}`;
    const di = {
      direction: arrivee ? `${point.nom} (${point.ville})` : `${ville} (${ville.split(/[\s-]/)[0]})`,
      headsign: numero, trip_short_name: numero, label: libelle, name: libelle, code: '',
      network: 'SNCF', physical_mode: physique, commercial_mode: commercial, color: '000000', text_color: '',
      description: '', equipments: [],
      links: retard || k === 5 ? [{ id: idPerturbation, internal: true, rel: 'disruptions', templated: false, type: 'disruption' }] : [],
    };
    const base = ecrireNavitia(t), reel = ecrireNavitia(t + retard);
    const sdt = (b, rl) => (arrivee
      ? { arrival_date_time: rl, base_arrival_date_time: b, departure_date_time: rl, base_departure_date_time: b }
      : { departure_date_time: rl, base_departure_date_time: b, arrival_date_time: rl, base_arrival_date_time: b });
    const item = {
      display_informations: di,
      stop_date_time: { ...sdt(base, reel), additional_informations: [], links: [], data_freshness: 'realtime' },
      stop_point: { id: `stop_point:SNCF:${point.uic}:Train`, name: point.nom, label: `${point.nom} (${point.ville})` },
      route: { id: `route:SNCF:${numero}`, name: libelle, direction: { id: 'stop_area:exemple', name: arrivee ? point.nom : ville } },
      links: [],
    };
    theoriques.push({ ...item, stop_date_time: { ...sdt(base, base), additional_informations: [], links: [], data_freshness: 'base_schedule' } });
    if (k === 5) {
      disruptions.push({ id: idPerturbation, status: 'active', severity: { name: 'trip canceled', effect: 'NO_SERVICE' },
        messages: [{ text: 'Train supprimé en raison d’un incident technique.' }],
        impacted_objects: [{ pt_object: { embedded_type: 'trip', id: `exemple:${numero}`, name: numero, trip: { id: `exemple:${numero}`, name: numero } } }] });
      continue;
    }
    if (retard) {
      const hms = (s) => s.slice(9);
      disruptions.push({ id: idPerturbation, status: 'active', severity: { name: 'trip delayed', effect: 'SIGNIFICANT_DELAYS' },
        messages: [{ text: k === 2 ? 'Retard dû à une régulation du trafic.' : 'Retard dû à l’arrivée tardive du train.' }],
        impacted_objects: [{ pt_object: { embedded_type: 'trip', id: `exemple:${numero}`, name: numero, trip: { id: `exemple:${numero}`, name: numero } },
          impacted_stops: [{ stop_point: { id: `stop_point:SNCF:${point.uic}:Train`, name: point.nom },
            base_departure_time: hms(base), amended_departure_time: hms(reel), base_arrival_time: hms(base), amended_arrival_time: hms(reel),
            departure_status: 'delayed', arrival_status: 'delayed', cause: '' }] }] });
    }
    items.push(item);
  }
  // Un RER que l'API SNCF peut aussi renvoyer : l'adaptateur doit le laisser à Île-de-France Mobilités.
  items.splice(1, 0, {
    display_informations: { direction: 'Boissy-Saint-Léger (Boissy-Saint-Léger)', headsign: 'ZEUS', trip_short_name: '154321',
      label: 'A', name: 'A', network: 'RER', physical_mode: 'RER', commercial_mode: 'RER', links: [] },
    stop_date_time: { departure_date_time: ecrireNavitia(debut + 5 * 60000), base_departure_date_time: ecrireNavitia(debut + 5 * 60000),
      arrival_date_time: ecrireNavitia(debut + 5 * 60000), base_arrival_date_time: ecrireNavitia(debut + 5 * 60000), data_freshness: 'realtime' },
  });
  const contexte = { timezone: 'Europe/Paris', current_datetime: ecrireNavitia(maintenant) };
  const cle = arrivee ? 'arrivals' : 'departures';
  return {
    reel: { [cle]: items, disruptions, context: contexte, pagination: { items_on_page: items.length } },
    theo: { [cle]: theoriques, disruptions: disruptions.filter((d) => d.severity.effect === 'NO_SERVICE'), context: contexte },
  };
}

const MISSIONS = ['ZEUS', 'NOTA', 'PICO', 'EKLI', 'DEFI', 'SOSI', 'TOPA', 'BIPE', 'GOTA', 'POPI', 'KALI', 'VICK'];
const VOIES = ['A', 'B', 'C', 'D', '1', '2', '3', '4', '11', '12', '27', '29'];

/**
 * Une réponse SIRI Lite de stop-monitoring. Les RER traversent la gare (arrivée
 * et départ) ; un Transilien sur deux s'y termine (pas d'heure de départ). Un
 * TER s'y glisse, que l'adaptateur doit écarter.
 */
export function exemplePrim(point, maintenant) {
  const r = hasard(`${point.zda}|${tranche(maintenant)}`);
  const lignes = point.exemplesIdf || [];
  const visites = [];
  let t = tranche(maintenant) + 60000;
  for (let k = 0; k < 14 && lignes.length; k++) {
    t += (2 + Math.floor(r() * 5)) * 60000;
    const [ligne, destination] = lignes[Math.floor(r() * lignes.length)];
    const rer = ['C01742', 'C01743', 'C01727', 'C01728', 'C01729'].includes(ligne);
    const terminus = !rer && k % 2 === 1;
    const retard = k === 3 ? 6 * 60000 : k === 9 ? 2 * 60000 : 0;
    const statut = k === 6 ? 'cancelled' : retard ? 'delayed' : 'onTime';
    const voie = { value: VOIES[Math.floor(r() * VOIES.length)] };
    const appel = {
      StopPointName: [{ value: point.nom }], VehicleAtStop: k === 0, DestinationDisplay: [{ value: terminus ? point.nom : destination }],
      AimedArrivalTime: iso(t - 60000), ExpectedArrivalTime: iso(t - 60000 + retard), ArrivalPlatformName: voie,
      ArrivalStatus: statut,
    };
    if (!terminus) Object.assign(appel, { AimedDepartureTime: iso(t), ExpectedDepartureTime: iso(t + retard), DeparturePlatformName: voie, DepartureStatus: statut });
    visites.push({
      RecordedAtTime: iso(maintenant), ItemIdentifier: `exemple-${point.zda}-${k}`, MonitoringRef: { value: `STIF:StopArea:SP:${point.zda}:` },
      MonitoredVehicleJourney: {
        LineRef: { value: `STIF:Line::${ligne}:` }, OperatorRef: { value: 'SNCF_ACCES_CLOUD:Operator::SNCF:' },
        FramedVehicleJourneyRef: { DataFrameRef: { value: 'any' }, DatedVehicleJourneyRef: `SNCF_ACCES_CLOUD:VehicleJourney::exemple${k}:LOC` },
        DirectionName: [{ value: terminus ? point.nom : destination }], DestinationRef: { value: 'STIF:StopPoint:Q:000000:' },
        DestinationName: [{ value: terminus ? point.nom : destination }], JourneyNote: rer ? [{ value: MISSIONS[Math.floor(r() * MISSIONS.length)] }] : [],
        TrainNumbers: { TrainNumberRef: [{ value: String(100000 + Math.floor(r() * 800000)) }] },
        MonitoredCall: appel,
      },
    });
  }
  visites.push({ MonitoredVehicleJourney: { LineRef: { value: 'STIF:Line::C01745:' }, DestinationName: [{ value: 'Dijon Ville' }],
    MonitoredCall: { AimedDepartureTime: iso(tranche(maintenant) + 9 * 60000), ExpectedDepartureTime: iso(tranche(maintenant) + 9 * 60000), DepartureStatus: 'onTime' } } });
  return { Siri: { ServiceDelivery: { ResponseTimestamp: iso(maintenant), ProducerRef: 'IVTR_HUB',
    StopMonitoringDelivery: [{ ResponseTimestamp: iso(maintenant), Version: '2.0', Status: 'true', MonitoredStopVisit: visites }] } } };
}

