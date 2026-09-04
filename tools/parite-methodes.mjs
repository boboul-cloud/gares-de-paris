#!/usr/bin/env node
// Compare les démonstrations pas à pas des deux implémentations.
// Usage : node tools/parite-methodes.mjs /tmp/pm
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { detaillerMethode } from '../web/js/croisement.js';

const binaire = process.argv[2] || '/tmp/pm';
const corpus = JSON.parse(readFileSync(new URL('../shared/data/corpus.json', import.meta.url), 'utf8'));
const swift = JSON.parse(execFileSync(binaire, ['.'], { encoding: 'utf8' }));

let comparees = 0;
const ecarts = [];
for (const me of corpus.simulateur.methodes) {
  const d = detaillerMethode(corpus.simulateur, me);
  const s = swift[me.id];
  if (!s) { ecarts.push({ id: me.id, champ: 'méthode absente côté Swift' }); continue; }
  if (d.resultat !== s.resultat) ecarts.push({ id: me.id, champ: 'resultat', js: d.resultat, swift: s.resultat });
  if (d.etapes.length !== s.etapes.length) {
    ecarts.push({ id: me.id, champ: `nombre d'étapes (${d.etapes.length} vs ${s.etapes.length})` });
    continue;
  }
  for (let i = 0; i < d.etapes.length; i++) {
    for (const cle of ['titre', 'calcul', 'detail']) {
      comparees++;
      if (d.etapes[i][cle] !== s.etapes[i][cle]) {
        ecarts.push({ id: me.id, champ: `étape ${i + 1} · ${cle}`, js: d.etapes[i][cle], swift: s.etapes[i][cle] });
      }
    }
  }
}

console.log(`${corpus.simulateur.methodes.length} méthodes, ${comparees} lignes comparées`);
if (!ecarts.length) {
  console.log('Aucune divergence : les démonstrations sont identiques.');
} else {
  console.log(`DIVERGENCES : ${ecarts.length}`);
  for (const e of ecarts.slice(0, 6)) {
    console.log(`  ${e.id} — ${e.champ}`);
    if (e.js !== undefined) { console.log(`    js    ${e.js}`); console.log(`    swift ${e.swift}`); }
  }
  process.exitCode = 1;
}
