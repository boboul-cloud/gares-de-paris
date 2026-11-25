#!/usr/bin/env node
// Rend chaque vue de l'application web dans un DOM simulé, pour vérifier
// qu'aucune route ne lève d'erreur et que le contenu attendu est produit.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';

const root = process.cwd();
const corpus = JSON.parse(readFileSync(join(root, 'web/data/corpus.json'), 'utf8'));

const listeners = {};
const el = () => ({
  innerHTML: '', textContent: '', dataset: {}, classList: { toggle() {}, contains: () => false },
  addEventListener() {}, focus() {}, setSelectionRange() {}, closest: () => null, value: '',
  // initCartes balaie le fragment rendu : sans nœud réel, il n'y a rien à armer.
  querySelectorAll: () => [], querySelector: () => null, style: { setProperty() {} },
});
const viewEl = el();

globalThis.window = {
  addEventListener: (t, f) => { listeners[t] = f; },
  scrollTo() {}, location: { hash: '#/', protocol: 'http:' },
};
globalThis.location = globalThis.window.location;
globalThis.localStorage = { getItem: () => null, setItem() {} };
globalThis.document = {
  documentElement: { removeAttribute() {}, setAttribute() {}, getAttribute: () => 'auto' },
  querySelector: (s) => (s === '#view' ? viewEl : null),
  querySelectorAll: () => [],
  addEventListener: (t, f) => { listeners['doc:' + t] = f; },
};
globalThis.fetch = async () => ({ ok: true, json: async () => corpus });

await import(pathToFileURL(join(root, 'web/js/app.js')).href);
await new Promise((r) => setTimeout(r, 60));   // laisse le fetch simulé se résoudre

const routes = [
  ['#/', 'Les gares de Paris'],
  ['#/gares', 'Quatorze gares'],
  ['#/circuits', 'Quatre circuits'],
  ['#/carte', 'Le plan des gares'],
  ['#/carte/3d', 'Paris en maquette'],
  ['#/carte/3d/paris-lyon', 'Paris en maquette'],
  ['#/techniques', 'De la vapeur'],
  ['#/tgv', 'Le TGV'],
  ['#/croisement', 'graphique de marche'],
  ['#/exercices', 'Exercices'],
  ['#/glossaire', 'vocabulaire du rail'],
  ...corpus.stations.map((s) => ['#/gare/' + s.id, s.nom]),
  ...corpus.circuits.map((c) => ['#/circuit/' + c.id, c.nom]),
  ['#/inexistant', 'introuvable', { court: true }],
];

let ok = 0, ko = 0;
for (const [hash, expect, opt = {}] of routes) {
  globalThis.location.hash = hash;
  viewEl.innerHTML = '';
  try {
    listeners.hashchange();
    const html = viewEl.innerHTML;
    if (!html.includes(expect)) throw new Error(`contenu attendu absent : « ${expect} »`);
    if (!opt.court && html.length < 400) throw new Error(`rendu trop court (${html.length} octets)`);
    if (/undefined|\[object Object\]|NaN/.test(html)) throw new Error('valeur non résolue dans le rendu');
    ok++;
  } catch (e) {
    ko++;
    console.error(`✗ ${hash} — ${e.message}`);
  }
}
console.log(`${ok}/${routes.length} routes rendues sans erreur${ko ? ` — ${ko} en échec` : ''}`);

// --- Vérifications de fond : immersion, scène animée, frise, tableau ---------
const { cap, lienStreetView, lienEarth } = await import(pathToFileURL(join(root, 'web/js/immersion.js')).href);
const { preparerScene, positionsA, cielA } = await import(pathToFileURL(join(root, 'web/js/scene-ligne.js')).href);
const { engendrerSerie, lectureCroisement } = await import(pathToFileURL(join(root, 'web/js/exercices.js')).href);
const { enMinutes } = await import(pathToFileURL(join(root, 'web/js/croisement.js')).href);
const { evenementsDates } = await import(pathToFileURL(join(root, 'web/js/carte.js')).href);
const { enPalettes } = await import(pathToFileURL(join(root, 'web/js/departs.js')).href);
const { blocDirect } = await import(pathToFileURL(join(root, 'web/js/direct.js')).href);

let fond = 0;
const echec = (m) => { fond++; console.error('✗ ' + m); };

// Chaque point de vue donne un lien Street View bien formé, et le cap pointe
// vers la cible : on le recalcule à rebours depuis le lien.
for (const s of corpus.stations) {
  for (const v of s.immersion.vues) {
    const url = lienStreetView(v);
    const m = /viewpoint=(-?[\d.]+),(-?[\d.]+)&heading=(\d+)&pitch=(-?\d+)&fov=90$/.exec(url);
    if (!m) { echec(`${s.id} : lien Street View mal formé ${url}`); continue; }
    const c = cap(v.regard, v.cible);
    if (!(c >= 0 && c < 360) || Math.abs(((+m[3] - c + 540) % 360) - 180) > 0.5) echec(`${s.id} : cap incohérent (${m[3]} contre ${c})`);
    if (!/^https:\/\/earth\.google\.com\/web\/@[\d.]+,[\d.]+,45a,520d,35y,\d+h,62t,0r$/.test(lienEarth(v))) echec(`${s.id} : lien Google Earth mal formé`);
  }
}

// La scène place les deux trains au même point à l'instant du croisement
// calculé par le moteur : sur les exemples du simulateur…
const sim = corpus.simulateur;
const instant = (d, t) => positionsA(d, t).filter((_, i) => !d.trains[i].fantome).map((p) => p.pk);
let scenes = 0;
for (const ex of sim.exemples) {
  const axe = sim.axes.find((a) => a.id === ex.axeId);
  const tr = (e, cle) => ({ cle, nom: cle, couleur: '#000000', materielId: e.materielId,
    train: { sens: e.sens, vitesse: sim.materiels.find((m) => m.id === e.materielId).vitesse, depart: enMinutes(e.depart), dessert: e.dessert, arret: 2 } });
  const d = preparerScene(axe, [tr(ex.a, 'a'), tr(ex.b, 'b')]);
  if (d.croix.type !== 'aucun') {
    const [pa, pb] = instant(d, d.croix.t);
    if (Math.abs(pa - pb) > 0.05) echec(`exemple « ${ex.nom} » : écart de ${Math.abs(pa - pb).toFixed(3)} km au croisement`);
    scenes++;
  }
}
// … et sur les questions de croisement de 75 séries, train fantôme compris.
for (let n = 1; n <= 75; n++) {
  for (const q of engendrerSerie(corpus, n * 37, 'melange').questions) {
    if (!q.contexte) continue;
    const saisie = q.reponse.type === 'heure' ? '09:30' : '140';
    const lec = lectureCroisement(corpus, q, saisie, false);
    const d = preparerScene(lec.axe, lec.trains);
    if (!d.croix || d.croix.type === 'aucun') { echec(`série ${n * 37}, ${q.famille} : pas de croisement`); continue; }
    const [pa, pb] = instant(d, d.croix.t);
    if (Math.abs(pa - pb) > 0.05) echec(`série ${n * 37}, ${q.famille} : écart de ${Math.abs(pa - pb).toFixed(3)} km`);
    if (/undefined|NaN/.test(lec.phrase)) echec(`série ${n * 37}, ${q.famille} : phrase non résolue « ${lec.phrase} »`);
    scenes++;
  }
}

if (cielA(0).nuit !== 1 || cielA(720).nuit !== 0) echec('ciel : minuit doit être la nuit, midi le jour');
const evts = evenementsDates(corpus);
if (evts.length < 100 || evts.some((e, i) => i && e.annee < evts[i - 1].annee)) echec('frise : événements absents ou désordonnés');
for (const t of ["Gare de l'Est", 'Saint-Lazare — Œuvre', 'Très, très longue phrase pour une palette étroite']) {
  if (enPalettes(t, 12).length !== 12 || /[^A-Z0-9 \-'.,:]/.test(enPalettes(t, 12))) echec(`palettes : « ${t} » mal composé`);
}
// En direct : rien sans relais (le site public reste inchangé), un tableau
// avec, et le texte de fermeture pour une gare disparue.
const lyon = corpus.stations.find((s) => s.id === 'paris-lyon');
if (blocDirect(corpus, lyon, null) !== '') echec('en direct : sans relais, la section doit être absente');
if (!blocDirect(corpus, lyon, 'https://relais.exemple').includes('data-direct="paris-lyon"')) echec('en direct : tableau absent avec un relais');
if (!blocDirect(corpus, corpus.stations.find((s) => s.id === 'gare-bastille'), 'https://relais.exemple').includes('1969')) echec('en direct : Bastille devrait dire sa fermeture');
if (blocDirect(corpus, corpus.stations.find((s) => s.id === 'gare-orsay'), 'https://r').includes('undefined')) echec('en direct : valeur non résolue');
if (enPalettes('Versailles Château Rive Gauche', 24).trim().endsWith(' .')) echec('palettes : le point doit suivre le mot coupé');
if (enPalettes('Rang-du-Fliers - Verton - Berck', 18).trim() !== 'RANG-DU-FLIERS.') echec(`palettes : tiret orphelin avant le point (« ${enPalettes('Rang-du-Fliers - Verton - Berck', 18).trim()} »)`);

console.log(`fond : ${scenes} scènes vérifiées au point de croisement, ${evts.length} dates sur la frise`
  + `${fond ? ` — ${fond} ÉCHEC(S)` : ' — OK'}`);
if (fond) ko += fond;

// Vérifie en plus que la version autonome en un seul fichier démarre bien sur
// le corpus injecté, sans passer par fetch.
import { existsSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
if (existsSync(join(root, 'dist/gares-de-paris.html'))) {
  const html = readFileSync(join(root, 'dist/gares-de-paris.html'), 'utf8');
  const m = html.match(/<script type="module">\n([\s\S]*?)\n<\/script>/);
  if (!m) { console.error('✗ bundle : script module introuvable'); process.exit(1); }
  const tmp = join(tmpdir(), `gdp-bundle-${process.pid}.mjs`);
  writeFileSync(tmp, m[1], 'utf8');
  globalThis.__CORPUS__ = corpus;
  globalThis.fetch = async () => { throw new Error('le bundle ne doit pas appeler fetch'); };
  viewEl.innerHTML = '';
  globalThis.location.hash = '#/';
  await import(pathToFileURL(tmp).href);
  if (viewEl.innerHTML.includes('Les gares de Paris')) {
    console.log('bundle autonome : démarrage sur le corpus injecté — OK');
  } else {
    console.error('✗ bundle autonome : rendu inattendu');
    process.exit(1);
  }
}

process.exit(ko ? 1 : 0);
