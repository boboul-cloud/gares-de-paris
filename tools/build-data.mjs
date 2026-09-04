#!/usr/bin/env node
// Assemble les fiches de gares en un seul corpus, puis distribue les données
// vers l'application web et le bundle Apple.
import { readdirSync, readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = join(root, 'shared', 'data');
const stationsDir = join(dataDir, 'stations');

const stations = readdirSync(stationsDir)
  .filter((f) => f.endsWith('.json'))
  .sort()
  .map((f) => JSON.parse(readFileSync(join(stationsDir, f), 'utf8')))
  .sort((a, b) => a.ordre - b.ordre);

const ids = new Set();
for (const s of stations) {
  if (ids.has(s.id)) throw new Error(`Identifiant de gare en double : ${s.id}`);
  ids.add(s.id);
  for (const key of ['id', 'nom', 'categorie', 'coord', 'recit', 'artwork']) {
    if (!s[key]) throw new Error(`${s.id} : champ « ${key} » manquant`);
  }
}

const load = (name) => JSON.parse(readFileSync(join(dataDir, name), 'utf8'));

const corpus = {
  version: 1,
  genereLe: new Date().toISOString().slice(0, 10),
  stations,
  circuits: load('circuits.json').circuits,
  traction: load('traction.json'),
  tgv: load('tgv.json'),
  glossaire: load('glossaire.json'),
  simulateur: load('simulateur.json'),
  exercices: load('exercices.json'),
  geo: load('geo.json'),
};

// Vérifie la cohérence des axes du simulateur : jalons ordonnés, origine à
// zéro, terminus à la longueur annoncée, gare de départ connue.
for (const a of corpus.simulateur.axes) {
  const pks = a.jalons.map((j) => j.pk);
  if (pks.some((v, i) => i && v <= pks[i - 1])) throw new Error(`Axe ${a.id} : jalons non ordonnés`);
  if (pks[0] !== 0 || pks[pks.length - 1] !== a.longueur) {
    throw new Error(`Axe ${a.id} : les jalons ne couvrent pas les ${a.longueur} km`);
  }
  if (a.gareId && !ids.has(a.gareId)) throw new Error(`Axe ${a.id} : gare inconnue « ${a.gareId} »`);
}
for (const e of corpus.simulateur.exemples) {
  if (!corpus.simulateur.axes.some((a) => a.id === e.axeId)) throw new Error(`Exemple « ${e.nom} » : axe inconnu`);
  for (const t of [e.a, e.b]) {
    if (!corpus.simulateur.materiels.some((m) => m.id === t.materielId)) {
      throw new Error(`Exemple « ${e.nom} » : matériel inconnu « ${t.materielId} »`);
    }
  }
}

// Vérifie que chaque étape de circuit pointe vers une gare existante.
for (const c of corpus.circuits) {
  for (const e of c.etapes) {
    if (!ids.has(e.stationId)) throw new Error(`Circuit ${c.id} : gare inconnue « ${e.stationId} »`);
  }
}

const out = JSON.stringify(corpus, null, 2);
const targets = [
  join(root, 'shared', 'data', 'corpus.json'),
  join(root, 'web', 'data', 'corpus.json'),
  join(root, 'apple', 'GaresDeParis', 'Resources', 'corpus.json'),
];
for (const t of targets) {
  mkdirSync(dirname(t), { recursive: true });
  writeFileSync(t, out, 'utf8');
}

const kb = (out.length / 1024).toFixed(0);
console.log(`corpus.json : ${stations.length} gares, ${corpus.circuits.length} circuits, ` +
  `${corpus.traction.eres.length} ères, ${corpus.tgv.chapitres.length} chapitres TGV, ` +
  `${corpus.glossaire.termes.length} termes, ${corpus.simulateur.axes.length} axes, ` +
  `${Object.keys(corpus.exercices.familles).length} familles d'exercices — ${kb} Ko`);
console.log(targets.map((t) => '  → ' + t.replace(root + '/', '')).join('\n'));
