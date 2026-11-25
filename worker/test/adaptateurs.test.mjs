// Les adaptateurs SNCF et Île-de-France Mobilités, sur des réponses de référence
// écrites à la main au format documenté de chaque API (test/fixtures).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { lireNavitia, heureParis, parisVersInstant } from '../src/commun.js';
import { lireSncf, marquerSuppressions, autreBout, nettoyer, appelerSncf, urlSncf } from '../src/sncf.js';
import { lirePrim, valeur, appelerPrim, urlPrim } from '../src/prim.js';

const fixture = (n) => JSON.parse(readFileSync(new URL(`./fixtures/${n}`, import.meta.url), 'utf8'));
const DIRECT = JSON.parse(readFileSync(new URL('../../shared/data/direct.json', import.meta.url), 'utf8'));
const LYON = DIRECT.gares['paris-lyon'].points[0];

test('heure de Paris : hiver, été et changements d’heure', () => {
  assert.equal(new Date(lireNavitia('20261125T101500')).toISOString(), '2026-11-25T09:15:00.000Z');
  assert.equal(new Date(lireNavitia('20260715T101500')).toISOString(), '2026-07-15T08:15:00.000Z');
  // 29 mars 2026 : à 2 h il est 3 h ; 3 h 30 de Paris vaut 1 h 30 en temps universel.
  assert.equal(new Date(lireNavitia('20260329T033000')).toISOString(), '2026-03-29T01:30:00.000Z');
  // 25 octobre 2026 : 2 h 30 existe deux fois ; l'une ou l'autre réponse est acceptable.
  assert.ok(['2026-10-25T00:30:00.000Z', '2026-10-25T01:30:00.000Z'].includes(new Date(lireNavitia('20261025T023000')).toISOString()));
  assert.equal(heureParis(Date.parse('2026-11-25T09:15:00Z')), '10:15');
  assert.equal(heureParis(Date.parse('2026-07-15T22:05:00Z')), '00:05');
  assert.equal(lireNavitia('n’importe quoi'), null);
  assert.equal(parisVersInstant(2026, 1, 1, 0, 0), Date.parse('2025-12-31T23:00:00Z'));
});

test('SNCF : départs en temps réel, retards, RER écartés', () => {
  const t = lireSncf(fixture('sncf-departs-temps-reel.json'), 'departs', LYON);
  assert.deepEqual(t.map((x) => x.numero), ['6611', '17771', '7801'], 'le RER est laissé à Île-de-France Mobilités');
  const [tgv, ter, ouigo] = t;
  assert.equal(tgv.prevue, '10:10'); assert.equal(tgv.etat, 'a-l-heure'); assert.equal(tgv.lieu, 'Lyon Part-Dieu');
  assert.equal(tgv.ligne.court, 'TGV');
  assert.equal(ter.retard, 12); assert.equal(ter.etat, 'retard'); assert.equal(ter.reelle, '10:32');
  assert.equal(ter.message, 'Retard dû à un incident de signalisation.'); assert.equal(ter.ligne.court, 'TER');
  assert.equal(ouigo.ligne.court, 'OUIGO'); assert.equal(ouigo.voie, null, 'l’API SNCF ne donne pas de voie');
});

test('SNCF : un train absent du temps réel mais prévu est supprimé', () => {
  const reels = lireSncf(fixture('sncf-departs-temps-reel.json'), 'departs', LYON);
  const theo = lireSncf(fixture('sncf-departs-theorique.json'), 'departs', LYON);
  const t = marquerSuppressions(reels, theo).sort((a, b) => a.t - b.t);
  const nice = t.find((x) => x.numero === '6125');
  assert.ok(nice, 'le 6125 apparaît');
  assert.equal(nice.etat, 'supprime');
  assert.equal(nice.message, "Train supprimé en raison d'un mouvement social.");
  assert.ok(!t.some((x) => x.numero === '6205'), 'au-delà de la fenêtre du temps réel, rien n’est déclaré supprimé');
  assert.equal(t.length, 4);
});

test('SNCF : arrivées, la provenance est l’autre bout de la ligne', () => {
  const t = lireSncf(fixture('sncf-arrivees.json'), 'arrivees', LYON);
  assert.deepEqual(t.map((x) => [x.lieu, x.prevue, x.reelle, x.retard]), [['Marseille', '10:19', '10:27', 8], ['Lausanne', '10:41', '10:41', 0]]);
  assert.equal(t[1].ligne.court, 'LYRIA');
  assert.equal(autreBout('Paris - Nice', 'Paris'), 'Nice');
  assert.equal(autreBout('Lille - Lyon', 'Massy'), 'Lille - Lyon');
  assert.equal(nettoyer('Aéroport CDG 2 TGV (Tremblay-en-France)'), 'Aéroport CDG 2 TGV');
});

test('SNCF : adresse et clé', async () => {
  const u = urlSncf({}, '87686006', 'departs', Date.parse('2026-11-25T09:00:00Z'), 'realtime');
  assert.match(u.pathname, /\/v1\/coverage\/sncf\/stop_areas\/stop_area:SNCF:87686006\/departures$/);
  assert.equal(u.searchParams.get('data_freshness'), 'realtime');
  assert.equal(u.searchParams.get('from_datetime'), '20261125T095000');
  let vu = null;
  const repondre = (statut, corps) => async (url, init) => { vu = init; return new Response(JSON.stringify(corps), { status: statut }); };
  assert.deepEqual(await appelerSncf(u, 'CLE', repondre(404, { error: { id: 'no_departure_this_day' } })), { departures: [], arrivals: [] });
  assert.equal(vu.headers.Authorization, 'CLE', 'la clé brute dans Authorization, comme le documente Navitia');
  await assert.rejects(appelerSncf(u, 'CLE', repondre(401, {})), /Clé SNCF refusée/);
  await assert.rejects(appelerSncf(u, 'CLE', repondre(429, {})), /Quota SNCF/);
  await assert.rejects(appelerSncf(u, 'CLE', repondre(500, {})), /indisponible \(500\)/);
});

test('PRIM : départs, voies, missions, suppressions, TER écartés', () => {
  const t = lirePrim(fixture('prim-gare-de-lyon.json'), 'departs', DIRECT.lignes).sort((x, y) => x.t - y.t);
  assert.deepEqual(t.map((x) => x.ligne.nom), ['RER A', 'RER D', 'Transilien R'], 'le terminus et le TER sont écartés des départs');
  const [a, d, r] = t;
  assert.deepEqual([a.prevue, a.reelle, a.retard, a.etat, a.voie, a.mission, a.numero, a.lieu], ['10:05', '10:08', 3, 'retard', 'A', 'ZEUS', '154321', 'Boissy-Saint-Léger']);
  assert.deepEqual([d.numero, d.voie, d.etat], ['DUVA42', '1', 'a-l-heure']);
  assert.deepEqual([r.etat, r.voie, r.lieu, r.prevue], ['supprime', 'L', 'Montereau', '10:20'], 'valeurs non enveloppées acceptées');
  assert.equal(a.ligne.couleur, '#FF1400');
});

test('PRIM : arrivées, un train qui termine ici', () => {
  const t = lirePrim(fixture('prim-gare-de-lyon.json'), 'arrivees', DIRECT.lignes);
  const r = t.find((x) => x.ligne.court === 'R' && x.etat !== 'supprime');
  assert.deepEqual([r.prevue, r.voie, r.aQuai, r.lieu], ['10:12', '27', true, ''], 'sans provenance, le tableau montre la ligne');
  assert.equal(t.find((x) => x.ligne.court === 'A').lieu, 'vers Boissy-Saint-Léger', 'un RER qui repart : sa destination');
  const l = t.find((x) => x.ligne.court === 'L');
  assert.deepEqual([l.voie, l.retard, l.mission], [null, 2, 'PAPE'], '« unknown » n’est pas une voie');
  assert.ok(!t.some((x) => x.ligne.nom === 'Transilien R' && x.prevue === '10:20'), 'un départ sans heure d’arrivée n’est pas une arrivée');
});

test('PRIM : erreur SIRI, valeurs enveloppées, adresse et clé', async () => {
  assert.throws(() => lirePrim(fixture('prim-erreur.json'), 'departs', DIRECT.lignes), /MonitoringRef inconnu/);
  assert.equal(valeur([{ value: '' }, { value: 'B' }]), 'B');
  assert.equal(valeur({ value: { value: 'C' } }), 'C');
  assert.equal(valeur(undefined), undefined);
  const u = urlPrim({}, '470195');
  assert.equal(u.searchParams.get('MonitoringRef'), 'STIF:StopArea:SP:470195:');
  let vu = null;
  await appelerPrim(u, 'CLE', async (url, init) => { vu = init; return new Response('{}', { status: 200 }); });
  assert.equal(vu.headers.apikey, 'CLE');
  await assert.rejects(appelerPrim(u, 'CLE', async () => new Response('', { status: 429 })), /Quota Île-de-France Mobilités/);
});
