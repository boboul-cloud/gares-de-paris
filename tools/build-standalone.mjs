#!/usr/bin/env node
// Produit une version de l'application Web en un seul fichier HTML : styles,
// scripts et données inclus. Utile pour l'archivage, l'envoi par courriel,
// la lecture hors ligne, ou la publication en Artifact.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

// Les trois modules sont concaténés : on retire les import/export, qui n'ont
// plus de sens une fois le code réuni dans un seul <script type="module">.
const strip = (js) => js
  .replace(/^\s*import[^;]+;\s*$/gm, '')
  .replace(/^export\s+/gm, '')
  .trim();

// Chaque module garde sa propre portée grâce à un bloc : les identifiants
// internes homonymes (esc, $) ne se télescopent pas. Ce que le module exportait
// est republié sur globalThis pour rester visible des modules suivants — la
// liste est relevée dans le source, pour ne jamais se désynchroniser.
const exportes = (js) =>
  [...js.matchAll(/^export\s+(?:function|const|let|class)\s+([A-Za-z_$][\w$]*)/gm)]
    .map((m) => m[1]);

const bloc = (fichier) => {
  const js = read(fichier);
  return ['{', strip(js), ...exportes(js).map((n) => `globalThis.${n} = ${n};`), '}'].join('\n');
};

const corpus = read('shared/data/corpus.json');
const css = read('web/css/app.css');
const js = [
  bloc('web/js/artwork.js'),
  bloc('web/js/carte.js'),
  bloc('web/js/croisement.js'),
  bloc('web/js/exercices.js'),
  bloc('web/js/app.js'),
].join('\n\n');

const titre = 'Gares de Paris';
const nav = `
<header class="topbar"><div class="wrap topbar-in">
  <a class="brand" href="#/"><b>Gares de Paris</b><span>1837 — 2026</span></a>
  <nav class="nav" aria-label="Navigation principale">
    <a href="#/" data-nav="accueil">Accueil</a>
    <a href="#/gares" data-nav="gares">Les gares</a>
    <a href="#/circuits" data-nav="circuits">Circuits</a>
    <a href="#/carte" data-nav="carte">Carte</a>
    <a href="#/techniques" data-nav="techniques">Techniques</a>
    <a href="#/tgv" data-nav="tgv">TGV</a>
    <a href="#/croisement" data-nav="croisement">Croisement</a>
    <a href="#/exercices" data-nav="exercices">Exercices</a>
    <a href="#/glossaire" data-nav="glossaire">Glossaire</a>
  </nav>
  <button class="theme-btn" id="theme" type="button" title="Thème clair, sombre ou automatique" aria-label="Changer de thème">◐</button>
</div></header>

<main id="view"><div class="wrap"><section class="section"><p class="lede">Chargement…</p></section></div></main>

<footer><div class="wrap">
  <p><strong>Gares de Paris</strong> — application documentaire. Les textes s'appuient sur les notices
  encyclopédiques des gares, les publications de SNCF Gares &amp; Connexions et la presse spécialisée ;
  les sources sont citées au bas de chaque fiche.</p>
  <p>Les illustrations et les plans sont générés en vectoriel par l'application : ce sont des schémas
  d'interprétation, non des relevés d'architecte. Horaires, tarifs et travaux évoluent — vérifiez auprès
  de la SNCF avant de vous déplacer. Données à jour de septembre 2026.</p>
</div></footer>`;

const polices = '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
  + '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700'
  + '&family=Bodoni+Moda:opsz,wght@6..96,400;6..96,600;6..96,700&family=IBM+Plex+Mono:wght@400;500&display=swap">';

const tete = `<title>${titre}</title>
${polices}
<style>
${css}
</style>`;

const contenu = `${nav}
<script>window.__CORPUS__ = ${corpus};<\/script>
<script type="module">
${js}
<\/script>`;

mkdirSync(join(root, 'dist'), { recursive: true });

// 1. Fichier autonome complet, ouvrable par double-clic.
writeFileSync(join(root, 'dist/gares-de-paris.html'), `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="description" content="L'histoire des gares de Paris : origines, révolutions techniques, dessertes, commodités, circuits de visite et histoire du TGV.">
<meta name="theme-color" content="#0F4670">
${tete}
</head>
<body>
${contenu}
</body>
</html>`, 'utf8');

// 2. Variante sans squelette (l'hôte fournit doctype, html, head et body),
//    pour publication en Artifact.
writeFileSync(join(root, 'dist/artifact.html'), tete + '\n' + contenu, 'utf8');

const ko = (s) => (Buffer.byteLength(s) / 1024).toFixed(0);
console.log(`dist/gares-de-paris.html  ${ko(tete + contenu)} Ko (autonome)`);
console.log(`dist/artifact.html        ${ko(tete + contenu)} Ko (sans squelette)`);
