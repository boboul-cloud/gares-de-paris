// Le relais de bout en bout : routes, mode exemple, cache, origines, pannes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { repondre } from '../src/index.js';

const DIRECT = JSON.parse(readFileSync(new URL('../../shared/data/direct.json', import.meta.url), 'utf8'));
const fixture = (n) => readFileSync(new URL(`./fixtures/${n}`, import.meta.url), 'utf8');
const MAINTENANT = Date.parse('2026-11-25T09:00:00Z');
const ENV = { ORIGINES: 'https://boboul-cloud.github.io', MODE_EXEMPLE: '1', SNCF_SOURCE: 'exemple' };

/** Un cache en mémoire, à la manière de caches.default. */
function cacheMemoire() {
  const m = new Map();
  return {
    m,
    async match(req) { const r = m.get(req.url); return r ? new Response(r.corps, { status: r.statut, headers: r.entetes }) : undefined; },
    async put(req, res) { m.set(req.url, { corps: await res.text(), statut: res.status, entetes: Object.fromEntries(res.headers) }); },
  };
}

async function demander(chemin, env = ENV, outils = {}, origine = 'https://boboul-cloud.github.io') {
  const req = new Request(`https://relais.exemple${chemin}`, { headers: origine ? { Origin: origine } : {} });
  const rep = await repondre(req, env, null, { cache: cacheMemoire(), maintenant: () => MAINTENANT, ...outils });
  return { rep, corps: rep.headers.get('Content-Type')?.includes('json') ? await rep.json() : null };
}

test('mode exemple : un tableau complet, sans aucune clé', async () => {
  const { rep, corps } = await demander('/tableau?gare=paris-lyon&sens=departs');
  assert.equal(rep.status, 200);
  assert.equal(corps.exemple, true);
  assert.deepEqual(corps.sources.map((s) => [s.source, s.ok, s.exemple]), [['sncf', true, true], ['prim', true, true]]);
  assert.ok(corps.trains.length >= 10);
  const parReseau = (r) => corps.trains.filter((t) => t.reseau === r).length;
  assert.ok(parReseau('grandes-lignes') >= 8 && parReseau('grandes-lignes') <= 12, 'les grandes lignes ont leur part');
  assert.ok(parReseau('ile-de-france') >= 8 && parReseau('ile-de-france') <= 12, 'le RER et le Transilien aussi');
  assert.ok(corps.trains.every((t, i, a) => !i || a[i - 1].t <= t.t), 'trié par heure prévue');
  assert.ok(corps.trains.some((t) => t.source === 'sncf' && t.etat === 'supprime'), 'un train supprimé, repéré par comparaison');
  assert.ok(corps.trains.some((t) => t.etat === 'retard' && t.retard >= 10));
  assert.ok(corps.trains.some((t) => t.source === 'prim' && t.voie), 'des voies côté Île-de-France');
  assert.ok(!corps.trains.some((t) => t.source === 'sncf' && /RER/.test(t.ligne.nom)), 'pas de RER en double');
  assert.ok(!corps.trains.some((t) => /TER/.test(t.ligne.nom) && t.source === 'prim'), 'pas de TER en double');
  assert.ok(corps.trains.every((t) => /^\d\d:\d\d$/.test(t.prevue) && /^\d\d:\d\d$/.test(t.reelle)));
  assert.equal(corps.heure, '10:00');
});

test('mode exemple : toutes les gares, à toute heure, départs et arrivées', async () => {
  for (const [gare, fiche] of Object.entries(DIRECT.gares)) {
    for (let p = 0; p < (fiche.points?.length || 1); p++) {
      for (const sens of ['departs', 'arrivees']) {
        for (const instant of ['2026-11-25T09:00:00Z', '2026-03-29T01:10:00Z', '2026-10-25T00:40:00Z', '2026-07-14T21:55:00Z']) {
          const { rep, corps } = await demander(`/tableau?gare=${gare}&point=${p}&sens=${sens}`, ENV, { maintenant: () => Date.parse(instant) });
          assert.equal(rep.status, 200, `${gare} ${sens} ${instant}`);
          if (fiche.ferme) { assert.equal(corps.ferme, fiche.ferme); continue; }
          assert.ok(corps.trains.length > 0, `${gare} ${p} ${sens} ${instant} : des trains`);
          assert.doesNotMatch(JSON.stringify(corps), /NaN|undefined|Invalid Date/);
        }
      }
    }
  }
});

test('origines : seul le site autorisé reçoit l’en-tête CORS', async () => {
  assert.equal((await demander('/tableau?gare=paris-nord')).rep.headers.get('Access-Control-Allow-Origin'), 'https://boboul-cloud.github.io');
  assert.equal((await demander('/tableau?gare=paris-nord', ENV, {}, 'https://ailleurs.example')).rep.headers.get('Access-Control-Allow-Origin'), null);
  const pre = await repondre(new Request('https://r/tableau', { method: 'OPTIONS', headers: { Origin: 'https://boboul-cloud.github.io' } }), ENV, null, { cache: null });
  assert.equal(pre.status, 204);
});

test('routes : gare inconnue, gare fermée, santé sans fuite de clé', async () => {
  assert.equal((await demander('/tableau?gare=gare-imaginaire')).rep.status, 404);
  assert.equal((await demander('/tableau?gare=paris-lyon&point=9')).rep.status, 404);
  assert.equal((await demander('/tableau?gare=__proto__')).rep.status, 404);
  assert.equal((await demander('/ailleurs')).rep.status, 404);
  const { corps } = await demander('/tableau?gare=gare-bastille');
  assert.match(corps.ferme, /1969/);
  const s = await demander('/sante', { ...ENV, SNCF_TOKEN: 'SECRET-1', PRIM_TOKEN: 'SECRET-2' });
  assert.deepEqual(s.corps, { sncf: true, prim: true, grandesLignes: 'exemple', exemple: true });
  assert.doesNotMatch(JSON.stringify(s.corps), /SECRET/);
});

test('cache : la seconde demande ne touche plus les API', async () => {
  let appels = 0;
  const fetch = async (url) => {
    appels++;
    return new Response(String(url).includes('prim') ? fixture('prim-gare-de-lyon.json') : fixture('sncf-departs-temps-reel.json'));
  };
  const cache = cacheMemoire();
  const env = { ...ENV, SNCF_TOKEN: 'a', PRIM_TOKEN: 'b', MODE_EXEMPLE: '0', SNCF_SOURCE: 'auto' };
  const outils = { cache, fetch, maintenant: () => MAINTENANT };
  const r1 = await repondre(new Request('https://r/tableau?gare=paris-lyon'), env, null, outils);
  assert.equal(r1.headers.get('Cache-Control'), 'public, max-age=120');
  const avant = appels;
  const r2 = await repondre(new Request('https://r/tableau?gare=paris-lyon', { headers: { Origin: 'https://boboul-cloud.github.io' } }), env, null, outils);
  assert.equal(appels, avant);
  assert.equal(r2.headers.get('X-Relais-Cache'), 'oui');
  assert.equal(r2.headers.get('Access-Control-Allow-Origin'), 'https://boboul-cloud.github.io', 'l’origine est remise à chaque réponse');
});

test('avec les clés : bonnes adresses, bons en-têtes, réponses lues', async () => {
  const vus = [];
  const fetch = async (url, init) => {
    vus.push([String(url), init.headers]);
    const u = String(url);
    if (u.includes('prim')) return new Response(fixture('prim-gare-de-lyon.json'));
    return new Response(fixture(u.includes('base_schedule') ? 'sncf-departs-theorique.json' : 'sncf-departs-temps-reel.json'));
  };
  const env = { ...ENV, SNCF_TOKEN: 'cle-sncf', PRIM_TOKEN: 'cle-prim', MODE_EXEMPLE: '0', SNCF_SOURCE: 'auto' };
  const { corps } = await demander('/tableau?gare=paris-lyon&sens=departs', env, { fetch });
  assert.equal(corps.exemple, false);
  assert.ok(vus.some(([u, h]) => /stop_area:SNCF:87686006\/departures.*data_freshness=realtime/.test(u) && h.Authorization === 'cle-sncf'));
  assert.ok(vus.some(([u]) => /data_freshness=base_schedule/.test(u)));
  assert.ok(vus.some(([u, h]) => u.includes('MonitoringRef=STIF%3AStopArea%3ASP%3A470195%3A') && h.apikey === 'cle-prim'));
  assert.deepEqual(corps.trains.map((t) => `${t.prevue} ${t.ligne.court} ${t.etat}`),
    ['10:05 A retard', '10:10 TGV a-l-heure', '10:15 D a-l-heure', '10:20 R supprime', '10:20 TER retard', '10:35 TGV supprime', '10:45 OUIGO a-l-heure']);
});

test('pannes : une source tombe, l’autre reste ; tout tombe, 502 ; quota, garde longue', async () => {
  const env = { ...ENV, SNCF_TOKEN: 'a', PRIM_TOKEN: 'b', MODE_EXEMPLE: '0', SNCF_SUPPRESSIONS: '0', SNCF_SOURCE: 'auto' };
  const primQuota = async (url) => (String(url).includes('prim') ? new Response('', { status: 429 }) : new Response(fixture('sncf-departs-temps-reel.json')));
  const a = await demander('/tableau?gare=paris-lyon', env, { fetch: primQuota });
  assert.equal(a.rep.status, 200);
  assert.equal(a.rep.headers.get('Cache-Control'), 'public, max-age=300');
  assert.deepEqual(a.corps.sources.map((s) => [s.source, s.ok]), [['sncf', true], ['prim', false]]);
  assert.match(a.corps.sources[1].erreur, /Quota/);
  const tout = await demander('/tableau?gare=paris-lyon', env, { fetch: async () => new Response('', { status: 503 }) });
  assert.equal(tout.rep.status, 502);
  assert.equal(tout.rep.headers.get('Cache-Control'), 'public, max-age=30');
  const illisible = await demander('/tableau?gare=paris-bercy', env, { fetch: async () => new Response('<html>') });
  assert.match(illisible.corps.sources[0].erreur, /illisible/);
  const sansCle = await demander('/tableau?gare=paris-bercy', { ...ENV, MODE_EXEMPLE: '0', SNCF_SOURCE: 'api' });
  assert.match(sansCle.corps.sources[0].erreur, /non installée/);
});

test('plusieurs points : Massy TGV dans les gares TGV d’Île-de-France', async () => {
  const { corps } = await demander('/tableau?gare=gares-tgv-idf&point=1');
  assert.equal(corps.point, 'Massy TGV');
  assert.deepEqual(corps.sources.map((s) => s.source), ['sncf']);
});
