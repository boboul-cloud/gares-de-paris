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
