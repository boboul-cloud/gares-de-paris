#!/usr/bin/env node
// Compare les séries engendrées par les deux moteurs d'exercices.
//
// Usage :
//   swiftc -O -o /tmp/parite apple/GaresDeParis/Model/Corpus.swift \
//       apple/GaresDeParis/Design/*.swift apple/GaresDeParis/Views/*.swift \
//       tools/parite-exercices.swift
//   node tools/parite-exercices.mjs /tmp/parite [nombre-de-séries]
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { engendrerSerie } from '../web/js/exercices.js';

const binaire = process.argv[2] || '/tmp/parite';
const nb = Number(process.argv[3] || 25);
const corpus = JSON.parse(readFileSync(new URL('../shared/data/corpus.json', import.meta.url), 'utf8'));

/// Forme canonique d'une question, comparable entre les deux implémentations.
const canon = (q) => ({
  f: q.famille,
  e: q.enonce,
  r: q.reponse.type === 'choix'
    ? `choix:${q.reponse.valeur}|${q.reponse.choix.join('¶')}`
    : `${q.reponse.type}:${q.reponse.valeur.toFixed(4)}`,
  x: q.explication,
});

let questions = 0;
const ecarts = [];
for (const mode of ['croisements', 'culture', 'melange']) {
  for (let n = 1; n <= nb; n++) {
    const js = engendrerSerie(corpus, n, mode).questions.map(canon);
    const swift = JSON.parse(execFileSync(binaire, ['.', String(n), mode], { encoding: 'utf8' }));
    for (let i = 0; i < js.length; i++) {
      questions++;
      for (const cle of ['f', 'e', 'r', 'x']) {
        if (js[i][cle] !== swift[i][cle]) ecarts.push({ mode, n, q: i + 1, cle, js: js[i][cle], swift: swift[i][cle] });
      }
    }
  }
}

console.log(`${nb * 3} séries, ${questions} questions comparées`);
if (!ecarts.length) {
  console.log('Aucune divergence : les deux moteurs sont interchangeables.');
} else {
  console.log(`DIVERGENCES : ${ecarts.length}`);
  for (const e of ecarts.slice(0, 5)) {
    console.log(`  ${e.mode}/${e.n} question ${e.q}, champ ${e.cle}`);
    console.log(`    js    ${String(e.js).slice(0, 130)}`);
    console.log(`    swift ${String(e.swift).slice(0, 130)}`);
  }
  process.exitCode = 1;
}
