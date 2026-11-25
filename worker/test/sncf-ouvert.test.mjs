// Le flux temps réel ouvert de la SNCF (GTFS-RT, transport.data.gouv.fr).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { extraireGtfsRt, lireSncfOuvert, lireIdentifiant, nomGare, URL_GTFS_RT } from '../src/sncf-ouvert.js';
import { repondre } from '../src/index.js';
import { fluxGtfsRt } from './gtfs-rt.mjs';

const DIRECT = JSON.parse(readFileSync(new URL('../../shared/data/direct.json', import.meta.url), 'utf8'));
const LYON = DIRECT.gares['paris-lyon'].points[0];
const CODES = new Set([87686006, 87271007]);
const s = (iso) => Date.parse(iso) / 1000;

// Un matin à la gare de Lyon (heures en temps universel : 09 h 10 Z = 10 h 10 à Paris).
const FLUX = fluxGtfsRt([
  { id: 'OCESN6611F1187_F:OUI:FR:Line::5B76AFB9-244D-4AC6-9720-8142DC7F6A91::87686006:87722025:4:1410:20261212',
    arrets: [{ stop: 'StopPoint:OCETGV INOUI-87686006', dep: { t: s('2026-11-25T09:10:00Z'), d: 0 } },
      { stop: 'StopPoint:OCETGV INOUI-87722025', arr: { t: s('2026-11-25T11:05:00Z'), d: 0 } }] },
  { id: 'OCESN7858F1187_F:OGO:FR:Line::D1E5AD07-58C1-456A-B4E2-928E91061B0B::87751008:87686006:8:1150:20261210',
    arrets: [{ stop: 'StopPoint:OCEOUIGO-87751008', dep: { t: s('2026-11-25T07:20:00Z'), d: 4200 } },
      { stop: 'StopPoint:OCEOUIGO-87686006', arr: { t: s('2026-11-25T11:00:00Z'), d: 4200 } }] },
  { id: 'OCESN6125F1187_F:OUI:FR:Line::AAAAAAAA-58C1-456A-B4E2-928E91061B0B::87686006:87756056:4:1410:20261212', annule: true,
    arrets: [{ stop: 'StopPoint:OCETGV INOUI-87686006', dep: { t: s('2026-11-25T09:35:00Z'), d: 0 }, saute: true },
      { stop: 'StopPoint:OCETGV INOUI-87756056', arr: { t: s('2026-11-25T15:20:00Z'), d: 0 }, saute: true }] },
  { id: 'OCESN17771F1187_F:TER:FR:Line::BBBBBBBB-58C1-456A-B4E2-928E91061B0B::87686006:87713040:4:1410:20261212',
    arrets: [{ stop: 'StopPoint:OCETrain TER-87686006', dep: { t: s('2026-11-25T09:19:00Z'), d: -60 } }] },
  { id: 'OCESN152839F', arrets: [{ stop: 'StopArea:OCE87686006', dep: { t: s('2026-11-25T09:15:00Z'), d: 0 } }] },
  { id: 'OCESN30001F1187_F:CAR:FR:Line::CCCCCCCC-58C1-456A-B4E2-928E91061B0B::87686006:87713040:4:1410:20261212',
    arrets: [{ stop: 'StopPoint:OCECar TER-87686006', dep: { t: s('2026-11-25T09:12:00Z'), d: 0 } }] },
  { id: 'OCESN5521F1187_F:OUI:FR:Line::DDDDDDDD-58C1-456A-B4E2-928E91061B0B::87192039:87773002:11:1252:20261212',
    arrets: [{ stop: 'StopPoint:OCETGV INOUI-87192039', dep: { t: s('2026-11-25T08:00:00Z'), d: 0 }, saute: true },
      { stop: 'StopPoint:OCETGV INOUI-87773002', arr: { t: s('2026-11-25T12:00:00Z'), d: 0 } }] },
]);

test('flux ouvert : seuls les trajets de nos gares sont gardés, tri rapide = lecture complète', () => {
  const ex = extraireGtfsRt(FLUX, CODES);
  assert.deepEqual(ex, extraireGtfsRt(FLUX, CODES, true));
  assert.equal(ex.length, 6, 'le Metz – Montpellier ne passe pas chez nous');
  assert.ok(ex.every((t) => t.arrets.every((a) => CODES.has(+a.uic))), 'seuls nos arrêts sont décodés');
  const annule = ex.find((t) => t.id.startsWith('OCESN6125'));
  assert.equal(annule.annule, true);
  assert.equal(annule.arrets[0].saute, true, 'statut lu même après l’identifiant d’arrêt');
});

test('flux ouvert : départs et arrivées, retards, suppression, avance, filtres', () => {
  const ex = extraireGtfsRt(FLUX, CODES);
  const dep = lireSncfOuvert(ex, 'departs', LYON).sort((a, b) => a.t - b.t);
  assert.deepEqual(dep.map((t) => `${t.prevue} ${t.ligne.court} ${t.numero} ${t.etat} ${t.lieu}`), [
    '10:10 TGV 6611 a-l-heure Lyon Perrache',
    '10:20 TER 17771 a-l-heure Dijon',
    '10:35 TGV 6125 supprime Nice-Ville',
  ], 'ni RER sans produit, ni autocar ; un train en avance reste « à l’heure »');
  assert.equal(dep[1].reelle, '10:19');
  const arr = lireSncfOuvert(ex, 'arrivees', LYON);
  assert.deepEqual(arr.map((t) => [t.ligne.court, t.prevue, t.reelle, t.retard, t.lieu]), [['OUIGO', '10:50', '12:00', 70, 'Marseille Saint-Charles']]);
});

test('flux ouvert : identifiants et noms', () => {
  assert.deepEqual(lireIdentifiant('OCESN5521F1187_F:OUI:FR:Line::4FA25873-A63A-4A2D-B62F-EF950E45D8A9::87192039:87773002:11:1252:20261212'),
    { numero: '5521', origine: '87192039', destination: '87773002' });
  assert.deepEqual(lireIdentifiant('OCESN6123F1187_F:OUI:OCESN-87686006-87751008:87686006:87751008:4:1410:20261212').destination, '87751008');
  assert.equal(nomGare('85010082'), 'Genève Cornavin');
  assert.equal(nomGare('00000000'), '');
});

test('relais : sans clé SNCF, le flux ouvert ; une lecture sert toutes les gares', async () => {
  let lectures = 0;
  const fetch = async (url) => {
    if (String(url) === URL_GTFS_RT) { lectures++; return new Response(FLUX); }
    throw new Error('aucune autre adresse attendue');
  };
  const cache = (() => {
    const m = new Map();
    return {
      async match(req) { const r = m.get(req.url); return r ? new Response(r.corps, { status: r.statut, headers: r.entetes }) : undefined; },
      async put(req, res) { m.set(req.url, { corps: await res.text(), statut: res.status, entetes: Object.fromEntries(res.headers) }); },
    };
  })();
  const env = { ORIGINES: '', MODE_EXEMPLE: '1' };
  const outils = { fetch, cache, maintenant: () => Date.parse('2026-11-25T09:00:00Z') };
  const r1 = await (await repondre(new Request('https://r/tableau?gare=paris-lyon'), env, null, outils)).json();
  assert.equal(r1.sources[0].nom, 'SNCF (données ouvertes)');
  assert.equal(r1.sources[0].exemple, false);
  assert.equal(r1.sources[1].exemple, true, 'Île-de-France Mobilités reste en exemple sans sa clé');
  assert.deepEqual(r1.trains.filter((t) => t.source === 'sncf').map((t) => t.numero), ['6611', '17771', '6125']);
  await repondre(new Request('https://r/tableau?gare=paris-nord'), env, null, outils);
  await repondre(new Request('https://r/tableau?gare=paris-lyon&sens=arrivees'), env, null, outils);
  assert.equal(lectures, 1, 'le flux national n’est lu qu’une fois par minute');
  const panne = await (await repondre(new Request('https://r/tableau?gare=paris-bercy'), env, null,
    { fetch: async () => new Response('', { status: 503 }), cache: null, maintenant: outils.maintenant })).json();
  assert.match(panne.sources[0].erreur, /Données ouvertes SNCF indisponibles \(503\)/);
});

test('relais : mise en ligne sans aucune clé, les grandes lignes seules', async () => {
  const env = { ORIGINES: '', MODE_EXEMPLE: '0' };
  const outils = { fetch: async () => new Response(FLUX), cache: null, maintenant: () => Date.parse('2026-11-25T09:00:00Z') };
  const lyon = await (await repondre(new Request('https://r/tableau?gare=paris-lyon'), env, null, outils)).json();
  assert.deepEqual(lyon.sources.map((s) => [s.source, s.ok, s.exemple]), [['sncf', true, false]], 'pas de RER fictif en ligne');
  assert.match(lyon.remarque, /clé d’Île-de-France Mobilités/);
  const orsay = await (await repondre(new Request('https://r/tableau?gare=gare-orsay'), env, null, outils));
  assert.equal(orsay.status, 200);
  assert.deepEqual((await orsay.json()).trains, []);
});
