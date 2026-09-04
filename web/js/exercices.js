// Moteur d'exercices : engendre des énoncés à partir des axes réels, des
// matériels et du contenu documentaire, corrige les réponses et suit la série.
//
// Le tirage est déterministe : un même numéro de série redonne les mêmes
// questions, ici comme dans l'application Apple. Les deux implémentations
// consomment donc le générateur aléatoire dans le même ordre — c'est la
// contrainte qui gouverne l'écriture de tout ce fichier.

import { construireMarche, chercherCroisement, enHeure, duree } from './croisement.js';

/** Générateur mulberry32 : reproductible à l'identique en Swift. */
export function alea(graine) {
  let a = graine >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const entier = (r, min, max) => min + Math.floor(r() * (max - min + 1));
const choisir = (r, arr) => arr[Math.floor(r() * arr.length)];

/** Mélange de Fisher-Yates, parcouru dans le même ordre des deux côtés. */
function melanger(r, arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const remplir = (modele, vars) =>
  modele.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? String(vars[k]) : `{${k}}`));

const sansParenthese = (s) => s.replace(/\s*\(.*$/, '').trim();

const tronquer = (s, n) => {
  if (s.length <= n) return s;
  const coupe = s.slice(0, n);
  const espace = coupe.lastIndexOf(' ');
  return (espace > n * 0.6 ? coupe.slice(0, espace) : coupe) + '…';
};

// --- Fabrication d'un énoncé ----------------------------------------------

const RAPIDES = (materiels) => materiels.filter((m) => m.vitesse >= 80);

function trainSimple(sens, vitesse, depart) {
  return { sens, vitesse, depart, dessert: false, arret: 0 };
}

/** Familles « croisement » : on choisit d'abord où l'on veut que la
 *  rencontre tombe, puis on en déduit l'heure de départ du second train.
 *  Aucun tirage n'est rejeté : la question est valide par construction. */
function fabriquerCroisement(r, sim, famille, conf) {
  const axe = choisir(r, sim.axes);
  const rapides = RAPIDES(sim.materiels);
  const mA = choisir(r, rapides);
  const mB = choisir(r, rapides);
  const fraction = (entier(r, 6, 14) * 5) / 100;       // 0,30 à 0,70
  const departA = 420 + entier(r, 0, 24) * 5;          // 07 h 00 à 09 h 00

  const L = axe.longueur;
  const pkVise = fraction * L;
  const instant = departA + (pkVise / mA.vitesse) * 60;
  const departB = Math.round((instant - ((L - pkVise) / mB.vitesse) * 60) / 5) * 5;

  const a = trainSimple('impair', mA.vitesse, departA);
  const b = trainSimple('pair', mB.vitesse, departB);
  const marcheA = construireMarche(axe, a);
  const marcheB = construireMarche(axe, b);
  const croix = chercherCroisement(axe, marcheA, marcheB);

  const vars = {
    axe: axe.nom, longueur: L, origine: axe.origine, terminus: axe.terminus,
    materielA: mA.nom, materielB: mB.nom, vitesseA: mA.vitesse, vitesseB: mB.vitesse,
    departA: enHeure(departA), departB: enHeure(departB),
  };

  const surHeure = famille === 'croisement-heure';
  const tol = surHeure ? conf.tolerances.heureMinutes
                       : Math.max(conf.tolerances.pkMinimum, L * conf.tolerances.pkRatio);

  const explication = surHeure
    ? `Les deux trains se rapprochent à ${mA.vitesse} + ${mB.vitesse} = ${mA.vitesse + mB.vitesse} km/h. `
      + `En partant de ${enHeure(departA)} et ${enHeure(departB)}, ils couvrent ensemble les ${L} km de l'axe `
      + `et se rejoignent à ${enHeure(croix.t)}, au PK ${Math.round(croix.pk)} — entre ${croix.segment.avant.nom} et ${croix.segment.apres.nom}.`
    : `Le croisement a lieu à ${enHeure(croix.t)}. Le train A a alors roulé ${duree(croix.depuisA)} à ${mA.vitesse} km/h, `
      + `soit ${Math.round(croix.parcouruA)} km : c'est le PK ${Math.round(croix.pk)}, entre ${croix.segment.avant.nom} et ${croix.segment.apres.nom}.`;

  return {
    famille,
    enonce: remplir(conf.familles[famille].enonce, vars),
    indice: remplir(conf.familles[famille].indice, vars),
    reponse: { type: surHeure ? 'heure' : 'nombre', valeur: surHeure ? croix.t : croix.pk, tolerance: tol, unite: surHeure ? '' : 'km' },
    explication,
    contexte: { axeId: axe.id, a, b },
  };
}

function fabriquerDepart(r, sim, conf) {
  const axe = choisir(r, sim.axes);
  const rapides = RAPIDES(sim.materiels);
  const mA = choisir(r, rapides);
  const mB = choisir(r, rapides);
  const jalon = axe.jalons[entier(r, 1, axe.jalons.length - 2)];
  const departA = 420 + entier(r, 0, 24) * 5;

  const L = axe.longueur;
  const instantGare = departA + (jalon.pk / mA.vitesse) * 60;
  const departB = instantGare - ((L - jalon.pk) / mB.vitesse) * 60;

  const vars = {
    axe: axe.nom, longueur: L, origine: axe.origine, terminus: axe.terminus,
    materielA: mA.nom, materielB: mB.nom, vitesseA: mA.vitesse, vitesseB: mB.vitesse,
    departA: enHeure(departA), gare: jalon.nom, pkGare: jalon.pk,
  };

  return {
    famille: 'depart-a-trouver',
    enonce: remplir(conf.familles['depart-a-trouver'].enonce, vars),
    indice: remplir(conf.familles['depart-a-trouver'].indice, vars),
    reponse: { type: 'heure', valeur: departB, tolerance: conf.tolerances.heureMinutes, unite: '' },
    explication:
      `Le train A parcourt les ${jalon.pk} km jusqu'à ${jalon.nom} en ${duree((jalon.pk / mA.vitesse) * 60)} : `
      + `il y passe à ${enHeure(instantGare)}. Le second train doit y être au même instant ; il lui reste `
      + `${L - jalon.pk} km à couvrir depuis ${axe.terminus}, soit ${duree(((L - jalon.pk) / mB.vitesse) * 60)}. `
      + `Il doit donc partir à ${enHeure(departB)}.`,
    contexte: {
      axeId: axe.id,
      a: trainSimple('impair', mA.vitesse, departA),
      b: trainSimple('pair', mB.vitesse, Math.round(departB)),
    },
  };
}

function fabriquerVitesse(r, sim, conf) {
  const axe = choisir(r, sim.axes);
  const rapides = RAPIDES(sim.materiels);
  const mA = choisir(r, rapides);
  const jalon = axe.jalons[entier(r, 1, axe.jalons.length - 2)];
  const departA = 420 + entier(r, 0, 24) * 5;

  // On vise d'abord une vitesse de poursuite, puis on en déduit le retard au
  // départ : le retard tombe ainsi toujours dans une plage plausible.
  let vise = Math.min(340, mA.vitesse + entier(r, 1, 8) * 20);
  const minutesA = (jalon.pk / mA.vitesse) * 60;
  let retard = Math.round(minutesA - (jalon.pk / vise) * 60);
  while (retard < 4 && vise < 340) {
    vise = Math.min(340, vise + 20);
    retard = Math.round(minutesA - (jalon.pk / vise) * 60);
  }
  const departB = departA + retard;
  const vitesseExacte = jalon.pk / ((minutesA - retard) / 60);

  const vars = {
    axe: axe.nom, origine: axe.origine, terminus: axe.terminus,
    materielA: mA.nom, vitesseA: mA.vitesse,
    departA: enHeure(departA), departB: enHeure(departB),
    gare: jalon.nom, pkGare: jalon.pk,
  };

  return {
    famille: 'vitesse-a-trouver',
    enonce: remplir(conf.familles['vitesse-a-trouver'].enonce, vars),
    indice: remplir(conf.familles['vitesse-a-trouver'].indice, vars),
    reponse: { type: 'nombre', valeur: vitesseExacte, tolerance: conf.tolerances.vitesseKmH, unite: 'km/h' },
    explication:
      `Le train A atteint ${jalon.nom} (PK ${jalon.pk}) à ${enHeure(departA + minutesA)}, après ${duree(minutesA)} de marche. `
      + `Le second, parti ${retard} minutes plus tard, dispose de ${duree(minutesA - retard)} pour couvrir les mêmes ${jalon.pk} km : `
      + `il lui faut ${Math.round(vitesseExacte)} km/h.`,
    contexte: {
      axeId: axe.id,
      a: trainSimple('impair', mA.vitesse, departA),
      b: trainSimple('impair', Math.round(vitesseExacte), departB),
    },
  };
}

// --- Familles documentaires ------------------------------------------------

function choixParmi(r, bonne, decoys, nb = 4) {
  const uniques = [];
  for (const d of decoys) {
    if (d !== bonne && !uniques.includes(d) && uniques.length < nb - 1) uniques.push(d);
  }
  const options = melanger(r, [bonne, ...uniques]);
  return { choix: options, bonne: options.indexOf(bonne) };
}

function fabriquerDoc(r, corpus, conf, famille) {
  const gares = corpus.stations;
  const modele = conf.familles[famille];

  if (famille === 'doc-date') {
    const avecAnnee = gares.filter((g) => g.chronologie.some((e) => /^\d{4}$/.test(e.annee)));
    const gare = choisir(r, avecAnnee);
    const faits = gare.chronologie.filter((e) => /^\d{4}$/.test(e.annee));
    const fait = choisir(r, faits);
    const toutes = [];
    for (const g of gares) for (const e of g.chronologie) if (/^\d{4}$/.test(e.annee)) toutes.push(e.annee);
    const { choix, bonne } = choixParmi(r, fait.annee, melanger(r, toutes));
    return {
      famille,
      enonce: remplir(modele.enonce, { gare: gare.nom, fait: fait.titre || fait.texte }),
      indice: modele.indice,
      reponse: { type: 'choix', valeur: bonne, choix },
      explication: `${fait.annee} — ${fait.texte}`,
      lien: gare.id,
    };
  }

  if (famille === 'doc-architecte') {
    const avec = gares.filter((g) => g.architectes.length > 0);
    const gare = choisir(r, avec);
    const bonneRep = sansParenthese(choisir(r, gare.architectes));
    const autres = [];
    for (const g of gares) if (g.id !== gare.id) for (const a of g.architectes) autres.push(sansParenthese(a));
    const { choix, bonne } = choixParmi(r, bonneRep, melanger(r, autres));
    return {
      famille,
      enonce: remplir(modele.enonce, { gare: gare.nom }),
      indice: modele.indice,
      reponse: { type: 'choix', valeur: bonne, choix },
      explication: `${gare.nom} — ${gare.architectes.join(', ')}. ${gare.resume}`,
      lien: gare.id,
    };
  }

  if (famille === 'doc-desserte') {
    const avec = gares.filter((g) => g.dessertes.grandesLignes.length > 2 && g.categorie === 'grande-gare');
    const gare = choisir(r, avec);
    const ville = choisir(r, gare.dessertes.grandesLignes);
    const autres = gares.filter((g) => g.id !== gare.id && g.categorie === 'grande-gare').map((g) => g.nom);
    const { choix, bonne } = choixParmi(r, gare.nom, melanger(r, autres));
    return {
      famille,
      enonce: remplir(modele.enonce, { destination: sansParenthese(ville) }),
      indice: modele.indice,
      reponse: { type: 'choix', valeur: bonne, choix },
      explication: `${gare.nom} dessert ${gare.dessertes.grandesLignes.slice(0, 6).join(', ')}.`,
      lien: gare.id,
    };
  }

  // doc-glossaire
  const terme = choisir(r, corpus.glossaire.termes);
  const autres = corpus.glossaire.termes.filter((t) => t.terme !== terme.terme).map((t) => tronquer(t.definition, 110));
  const { choix, bonne } = choixParmi(r, tronquer(terme.definition, 110), melanger(r, autres));
  return {
    famille,
    enonce: remplir(modele.enonce, { terme: terme.terme }),
    indice: modele.indice,
    reponse: { type: 'choix', valeur: bonne, choix },
    explication: `${terme.terme} — ${terme.definition}`,
  };
}

// --- Série -----------------------------------------------------------------

export function famillesDuMode(conf, modeId) {
  // L'ordre vient du fichier de configuration, pas de l'ordre des clés : c'est
  // la seule façon d'obtenir la même série en JavaScript et en Swift.
  const noms = conf.ordreFamilles;
  const gardees = modeId === 'melange' ? [...noms] : noms.filter((f) => conf.familles[f].mode === modeId);
  return gardees.sort((a, b) => conf.familles[a].niveau - conf.familles[b].niveau || (a < b ? -1 : a > b ? 1 : 0));
}

/** Engendre une série complète. Même numéro et même mode : mêmes questions. */
export function engendrerSerie(corpus, numero, modeId) {
  const conf = corpus.exercices;
  const sim = corpus.simulateur;
  const familles = famillesDuMode(conf, modeId);
  const r = alea((numero >>> 0) * 2654435761 + modeId.length * 97);
  const questions = [];

  for (let i = 0; i < conf.longueurSerie; i++) {
    // Les familles se succèdent par difficulté croissante, en boucle.
    const famille = familles[i % familles.length];
    let q;
    if (famille === 'croisement-heure' || famille === 'croisement-pk') q = fabriquerCroisement(r, sim, famille, conf);
    else if (famille === 'depart-a-trouver') q = fabriquerDepart(r, sim, conf);
    else if (famille === 'vitesse-a-trouver') q = fabriquerVitesse(r, sim, conf);
    else q = fabriquerDoc(r, corpus, conf, famille);
    questions.push({ ...q, numero: i + 1, niveau: conf.familles[famille].niveau, nomFamille: conf.familles[famille].nom });
  }
  return { numero, modeId, questions };
}

/** Corrige une réponse. `saisie` est une chaîne (heure ou nombre) ou un index. */
export function corriger(question, saisie) {
  const rep = question.reponse;
  if (rep.type === 'choix') {
    return { juste: saisie === rep.valeur, exacte: rep.choix[rep.valeur] };
  }
  const valeur = rep.type === 'heure' ? heureEnMinutes(saisie) : Number(String(saisie).replace(',', '.'));
  if (valeur === null || Number.isNaN(valeur)) return { juste: false, vide: true, exacte: formater(rep) };
  let ecart = Math.abs(valeur - rep.valeur);
  if (rep.type === 'heure') ecart = Math.min(ecart, 1440 - ecart);   // minuit ne piège personne
  return { juste: ecart <= rep.tolerance, ecart, exacte: formater(rep) };
}

function heureEnMinutes(saisie) {
  const m = /^(\d{1,2})\s*[:hH.]\s*(\d{1,2})$/.exec(String(saisie).trim());
  if (!m) return null;
  return (+m[1] % 24) * 60 + Math.min(59, +m[2]);
}

export function formater(rep) {
  if (rep.type === 'heure') return enHeure(rep.valeur);
  const v = Math.round(rep.valeur);
  return rep.unite ? `${v} ${rep.unite}` : String(v);
}

// --- Interface -------------------------------------------------------------

import { graphiqueMarche } from './croisement.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function etatExercices(corpus) {
  return { modeId: 'melange', numero: 1837, serie: null, index: 0, reponses: [], saisie: '', indiceVu: false, corrige: null };
}

export function vueExercices(corpus, etat) {
  const conf = corpus.exercices;
  return `
  <div class="wrap">
    <section class="section">
      <div class="eyebrow">S'exercer</div>
      <h2>${esc(conf.titre)}</h2>
      <p class="lede" style="margin-top:10px">${esc(conf.sousTitre)}</p>
      <p class="lede" style="margin-top:16px">${esc(conf.intro)}</p>
      <div id="ex"></div>
      <p class="sim-note" style="margin-top:22px">${esc(conf.note)}</p>
    </section>
  </div>`;
}

function barreReglages(conf, etat) {
  return `
  <div class="ex-reglages">
    <div class="chips" style="margin:0">
      ${conf.modes.map((m) => `<button type="button" class="chip${m.id === etat.modeId ? ' on' : ''}" data-ex-mode="${esc(m.id)}" title="${esc(m.detail)}">${esc(m.nom)}</button>`).join('')}
    </div>
    <div class="ex-serie">
      <label>Série
        <input type="number" min="1" max="9999" value="${etat.numero}" data-ex-numero>
      </label>
      <button type="button" class="chip" data-ex-nouvelle>Nouvelle série</button>
    </div>
  </div>`;
}

function champReponse(q, etat) {
  if (q.reponse.type === 'choix') {
    return `<div class="ex-choix">
      ${q.reponse.choix.map((c, i) => `
        <button type="button" class="ex-option" data-ex-choix="${i}">
          <span class="ex-puce">${String.fromCharCode(65 + i)}</span><span>${esc(c)}</span>
        </button>`).join('')}
    </div>`;
  }
  const heure = q.reponse.type === 'heure';
  return `<div class="ex-saisie">
    <input type="${heure ? 'text' : 'number'}" ${heure ? 'inputmode="numeric" placeholder="hh:mm"' : 'step="1" placeholder="' + esc(q.reponse.unite || '') + '"'}
      value="${esc(etat.saisie)}" data-ex-saisie aria-label="Votre réponse">
    ${q.reponse.unite ? `<i>${esc(q.reponse.unite)}</i>` : ''}
    <button type="button" class="ex-valider" data-ex-valider>Valider</button>
  </div>
  <p class="ex-aide">${heure ? 'Format hh:mm.' : 'Un nombre entier suffit.'} Tolérance : ±${Math.round(q.reponse.tolerance)}${q.reponse.unite ? ' ' + esc(q.reponse.unite) : ' min'}.</p>`;
}

function corrigeHtml(corpus, q, corrige) {
  const conf = corpus.exercices;
  const r = corrige.juste ? 'juste' : 'faux';
  const mots = conf.verdicts[r];
  const verdict = mots[(q.numero + q.enonce.length) % mots.length];

  let graphique = '';
  if (q.contexte) {
    const axe = corpus.simulateur.axes.find((a) => a.id === q.contexte.axeId);
    const mA = construireMarche(axe, q.contexte.a);
    const mB = construireMarche(axe, q.contexte.b);
    const croix = chercherCroisement(axe, mA, mB);
    const dispo = Math.max(360, Math.min(860, (globalThis.innerWidth || 860) - 80));
    graphique = `<div class="ex-graphique">${graphiqueMarche(axe, [
      { nom: 'Train A', couleur: '#1F6F8B', marche: mA },
      { nom: 'Train B', couleur: '#BE5417', marche: mB },
    ], croix, { width: dispo, height: Math.round(dispo / (dispo < 560 ? 1.05 : 1.62)) })}</div>`;
  }

  return `
  <div class="ex-corrige ${corrige.juste ? 'est-juste' : 'est-faux'}">
    <div class="ex-verdict">
      <span class="ex-pastille">${corrige.juste ? '✓' : '✕'}</span>
      <div>
        <b>${esc(verdict)}</b>
        <span>Réponse attendue : <b>${esc(corrige.exacte)}</b>${!corrige.juste && corrige.ecart !== undefined ? ` — vous étiez à ${Math.round(corrige.ecart)}${q.reponse.unite ? ' ' + esc(q.reponse.unite) : ' min'}` : ''}</span>
      </div>
    </div>
    <p class="ex-explication">${esc(q.explication)}</p>
    ${graphique}
    ${q.lien ? `<a class="ex-lien" href="#/gare/${esc(q.lien)}">Ouvrir la fiche de la gare →</a>` : ''}
  </div>`;
}

function bilanHtml(corpus, etat) {
  const conf = corpus.exercices;
  const justes = etat.reponses.filter((r) => r.juste).length;
  const total = etat.serie.questions.length;
  const pourcent = Math.round((justes / total) * 100);
  const bilan = conf.bilans.find((b) => pourcent >= b.seuil) || conf.bilans[conf.bilans.length - 1];
  const rates = etat.reponses.map((r, i) => (r.juste ? null : i)).filter((i) => i !== null);

  return `
  <div class="panel ex-bilan">
    <div class="eyebrow">Série ${etat.numero} — terminée</div>
    <h3 class="ex-score">${justes} / ${total}</h3>
    <p class="ex-bilan-texte">${esc(bilan.texte)}</p>
    <ol class="ex-recap">
      ${etat.serie.questions.map((q, i) => `
        <li class="${etat.reponses[i] && etat.reponses[i].juste ? 'ok' : 'ko'}">
          <span>${esc(q.nomFamille)}</span>
          <b>${etat.reponses[i] && etat.reponses[i].juste ? 'juste' : 'manqué'}</b>
        </li>`).join('')}
    </ol>
    <div class="ex-actions">
      ${rates.length ? `<button type="button" class="ex-valider" data-ex-rejouer>Reprendre les ${rates.length} question${rates.length > 1 ? 's' : ''} manquée${rates.length > 1 ? 's' : ''}</button>` : ''}
      <button type="button" class="chip" data-ex-nouvelle>Nouvelle série</button>
    </div>
  </div>`;
}

export function majExercices(corpus, etat, racine = document) {
  const zone = racine.querySelector('#ex');
  if (!zone) return;
  const conf = corpus.exercices;
  if (!etat.serie) etat.serie = engendrerSerie(corpus, etat.numero, etat.modeId);

  const fini = etat.index >= etat.serie.questions.length;
  if (fini) {
    zone.innerHTML = barreReglages(conf, etat) + bilanHtml(corpus, etat);
    return;
  }

  const q = etat.serie.questions[etat.index];
  const total = etat.serie.questions.length;
  zone.innerHTML = barreReglages(conf, etat) + `
    <div class="panel ex-question">
      <div class="ex-tete">
        <span class="ex-compteur">Question ${etat.index + 1} / ${total}</span>
        <span class="ex-famille">${esc(q.nomFamille)} · niveau ${q.niveau}</span>
      </div>
      <p class="ex-enonce">${esc(q.enonce)}</p>
      ${etat.corrige ? '' : champReponse(q, etat)}
      ${etat.corrige ? '' : `<button type="button" class="ex-indice-btn" data-ex-indice>${etat.indiceVu ? "Masquer l'indice" : "Voir un indice"}</button>`}
      ${etat.indiceVu && !etat.corrige ? `<p class="ex-indice">${esc(q.indice)}</p>` : ''}
      ${etat.corrige ? corrigeHtml(corpus, q, etat.corrige) : ''}
      ${etat.corrige ? `<button type="button" class="ex-valider" data-ex-suivant>${etat.index + 1 < total ? 'Question suivante' : 'Voir le bilan'}</button>` : ''}
    </div>`;
}

export function initExercices(corpus, etat, racine = document) {
  const zone = racine.querySelector('#ex');
  if (!zone || zone._arme) return;
  zone._arme = true;

  const nouvelle = (numero) => {
    etat.numero = numero;
    etat.serie = engendrerSerie(corpus, etat.numero, etat.modeId);
    etat.index = 0; etat.reponses = []; etat.saisie = ''; etat.indiceVu = false; etat.corrige = null;
  };

  const valider = (saisie) => {
    const q = etat.serie.questions[etat.index];
    etat.corrige = corriger(q, saisie);
    etat.reponses[etat.index] = etat.corrige;
    try { localStorage.setItem('gdp-ex', JSON.stringify({ modeId: etat.modeId, numero: etat.numero })); } catch { /* stockage indisponible */ }
    majExercices(corpus, etat, racine);
  };

  zone.addEventListener('click', (ev) => {
    const c = ev.target.closest.bind(ev.target);
    const mode = c('[data-ex-mode]');
    if (mode) { etat.modeId = mode.dataset.exMode; nouvelle(etat.numero); return majExercices(corpus, etat, racine); }
    if (c('[data-ex-nouvelle]')) { nouvelle(1 + Math.floor(Math.random() * 9000)); return majExercices(corpus, etat, racine); }
    if (c('[data-ex-indice]')) { etat.indiceVu = !etat.indiceVu; return majExercices(corpus, etat, racine); }
    if (c('[data-ex-valider]')) { return valider(etat.saisie); }
    const choix = c('[data-ex-choix]');
    if (choix) { return valider(+choix.dataset.exChoix); }
    if (c('[data-ex-suivant]')) {
      etat.index++; etat.saisie = ''; etat.indiceVu = false; etat.corrige = null;
      return majExercices(corpus, etat, racine);
    }
    if (c('[data-ex-rejouer]')) {
      const rates = etat.serie.questions.filter((_, i) => !(etat.reponses[i] && etat.reponses[i].juste));
      etat.serie = { ...etat.serie, questions: rates.map((q, i) => ({ ...q, numero: i + 1 })) };
      etat.index = 0; etat.reponses = []; etat.saisie = ''; etat.indiceVu = false; etat.corrige = null;
      return majExercices(corpus, etat, racine);
    }
  });

  zone.addEventListener('input', (ev) => {
    if (ev.target.hasAttribute('data-ex-saisie')) etat.saisie = ev.target.value;
    if (ev.target.hasAttribute('data-ex-numero')) {
      const n = Math.max(1, Math.min(9999, +ev.target.value || 1));
      nouvelle(n);
      // On ne réécrit pas le champ en cours de frappe : seul le reste change.
      const focus = document.activeElement;
      majExercices(corpus, etat, racine);
      const champ = zone.querySelector('[data-ex-numero]');
      if (champ && focus !== champ) champ.value = n;
      if (champ) champ.focus();
    }
  });

  zone.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' && ev.target.hasAttribute('data-ex-saisie')) { ev.preventDefault(); valider(etat.saisie); }
  });

  try {
    const garde = JSON.parse(localStorage.getItem('gdp-ex') || 'null');
    if (garde && garde.modeId) { etat.modeId = garde.modeId; etat.numero = garde.numero || etat.numero; }
  } catch { /* stockage indisponible */ }
  nouvelle(etat.numero);
  majExercices(corpus, etat, racine);
}
