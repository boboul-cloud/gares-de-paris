// La scène du croisement : la ligne vue de côté, et les trains qui y roulent.
//
// Le graphique de marche dit tout, mais il le dit en géomètre. La scène le
// redit en cheminot : deux trains partent, la distance qui les sépare fond à
// la vitesse de rapprochement, et ils se croisent à l'heure que le calcul
// annonçait. L'horloge de quai donne l'heure simulée, le ciel la suit (aube,
// plein jour, crépuscule, nuit), et un curseur parcourt le graphique en même
// temps : l'écart vertical entre les deux droites, c'est la distance entre les
// deux trains — on le voit se refermer.
//
// Aucun nombre n'est calculé ici : positions et instant de rencontre viennent
// du moteur (croisement.js). La scène ne fait que les montrer.
//
// Ce module ne touche au DOM que dans monterScene : les outils de parité
// l'importent sous Node, par l'intermédiaire d'exercices.js.

import { construireMarche, chercherCroisement, pkA, enHeure } from './croisement.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const NS = 'http://www.w3.org/2000/svg';
const f1 = (x) => (Math.round(x * 10) / 10).toString();
const borner = (x, a, b) => Math.min(b, Math.max(a, x));
const lisser = (a, b, x) => { const t = borner((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// --- Matériels -------------------------------------------------------------

const PAR_MATERIEL = {
  'tgv-m': 'tgv', 'tgv-inoui': 'tgv', ouigo: 'tgv', intercites: 'classique', nuit: 'classique',
  ter: 'automotrice', fret: 'fret', '141r': 'vapeur', 231: 'vapeur', crampton: 'crampton',
};

/** Famille de silhouette d'un matériel ; une vitesse libre choisit d'elle-même. */
export function silhouetteDe(materielId, vitesse) {
  if (PAR_MATERIEL[materielId]) return PAR_MATERIEL[materielId];
  return vitesse >= 200 ? 'tgv' : vitesse >= 140 ? 'classique' : vitesse >= 100 ? 'automotrice' : 'vapeur';
}

const GABARIT = {
  tgv: { l: 96, h: 15 }, classique: { l: 92, h: 16 }, automotrice: { l: 72, h: 16 },
  fret: { l: 104, h: 15 }, vapeur: { l: 70, h: 20 }, crampton: { l: 62, h: 20 },
};
const A_VAPEUR = (s) => s === 'vapeur' || s === 'crampton';

/** Dessin d'un train tourné vers la droite : nez en x = 0, roues sur y = 0. */
function dessinTrain(type, couleur) {
  const { l: L, h } = GABARIT[type];
  const roue = (x, r = 2.3) => `<circle cx="${x}" cy="${-r + 0.4}" r="${r}" class="sc-roue"/>`;
  const fen = (x, y, w, hh, rx = 1) => `<rect x="${x}" y="${y}" width="${w}" height="${hh}" rx="${rx}" class="sc-fenetre"/>`;
  const feu = `<circle cx="-1.6" cy="-5" r="1.5" class="sc-feu"/>`;
  let s = '';
  if (type === 'tgv') {
    s += `<path d="M${-L} -2.6V${-h + 2}Q${-L} ${-h} ${-L + 3} ${-h}H-27C-12 ${-h} -3 -9.5 0 -4.2V-2.6Z" fill="${couleur}"/>`;
    s += `<path d="M${-L} ${-h + 1.2}H-30" class="sc-toit"/>`;
    s += fen(-L + 6, -h + 4.2, L - 38, 3.4);
    s += `<path d="M-25 ${-h + 3.6}C-15 ${-h + 3.6} -9 -9.6 -6.6 -8H-15Z" class="sc-fenetre"/>`;
    s += `<rect x="${-L}" y="-5.2" width="${L - 2}" height="1.5" class="sc-filet"/>`;
    for (const x of [-L * 0.66, -L * 0.33]) s += `<path d="M${f1(x)} ${-h + 1}V-3" class="sc-joint"/>`;
    for (const x of [-L + 7, -L + 12, -L * 0.66, -L * 0.33, -17, -11]) s += roue(f1(x), 2);
  } else if (type === 'classique') {
    s += `<path d="M-26 -2.6V${-h}H-6L0 -8V-2.6Z" fill="${couleur}"/>`;
    s += fen(-22, -h + 3.5, 6, 4) + fen(-14, -h + 3.5, 5, 4);
    for (const x0 of [-59, -92]) {
      s += `<rect x="${x0}" y="${-h + 1}" width="31" height="${h - 3.6}" rx="1.4" fill="${couleur}" opacity=".88"/>`;
      for (let i = 0; i < 5; i++) s += fen(x0 + 3 + i * 5.6, -h + 4.5, 3.6, 4);
    }
    for (const x of [-23, -9, -56, -32, -89, -65]) s += roue(x);
  } else if (type === 'automotrice') {
    s += `<path d="M${-L} -2.6V${-h + 2}Q${-L} ${-h} ${-L + 3} ${-h}H-14C-5 ${-h} 0 -10 0 -6V-2.6Z" fill="${couleur}"/>`;
    s += fen(-L + 5, -h + 4, L - 26, 4.6, 1.2);
    s += `<path d="M-12 ${-h + 3.6}C-6 ${-h + 3.6} -3 -11 -2.4 -9H-10Z" class="sc-fenetre"/>`;
    s += `<path d="M${-L / 2} ${-h + 1}V-3" class="sc-joint"/>`;
    for (const x of [-L + 8, -L / 2, -9]) s += roue(x);
  } else if (type === 'fret') {
    s += `<path d="M-24 -2.6V${-h}H-5L0 -7V-2.6Z" fill="${couleur}"/>` + fen(-20, -h + 3.5, 8, 4);
    const caisses = ['#B03A2E', '#4F7A55', '#C08A2E'];
    caisses.forEach((c, i) => {
      const x0 = -50 - i * 27;
      s += `<rect x="${x0}" y="-4.6" width="25" height="2" fill="#3A3A40"/>`;
      s += `<rect x="${x0 + 1}" y="${-h + 2}" width="23" height="${h - 6.6}" fill="${c}"/>`;
      s += `<path d="M${x0 + 6} ${-h + 2.6}V-5M${x0 + 12} ${-h + 2.6}V-5M${x0 + 18} ${-h + 2.6}V-5" class="sc-joint"/>`;
      s += roue(x0 + 4) + roue(x0 + 21);
    });
    s += roue(-21) + roue(-7);
  } else if (type === 'vapeur') {
    s += `<rect x="-70" y="-12" width="15" height="9.4" rx="1.2" fill="${couleur}" opacity=".85"/>`;
    s += `<path d="M-55 -3V-20H-44V-13H-6Q-2 -13 -2 -9V-3Z" fill="${couleur}"/>`;
    s += `<rect x="-44" y="-13.4" width="38" height="2" class="sc-toit"/>`;
    s += `<rect x="-12" y="-20" width="4.6" height="7" rx=".8" fill="${couleur}"/>`;
    s += `<rect x="-30" y="-16" width="6" height="3" rx="1.5" fill="${couleur}"/>`;
    s += fen(-53, -18, 7, 4.4);
    for (const x of [-38, -29, -20]) s += roue(x, 3.6);
    s += roue(-8, 2) + roue(-50, 2.4) + roue(-66) + roue(-59);
  } else {
    s += `<rect x="-62" y="-12" width="14" height="9.4" rx="1.2" fill="${couleur}" opacity=".85"/>`;
    s += `<path d="M-48 -3V-20H-38V-12H-7Q-2 -12 -2 -8.5V-3Z" fill="${couleur}"/>`;
    s += `<rect x="-12" y="-21" width="4" height="9" rx=".8" fill="${couleur}"/>`;
    s += fen(-46, -18, 6, 4.4);
    s += `<circle cx="-30" cy="-7.4" r="7.2" class="sc-roue-grande"/>`;
    s += roue(-11, 2.4) + roue(-19, 2.4) + roue(-58) + roue(-52);
  }
  return s + feu;
}

/** Point de départ des fumées, dans le repère du dessin. */
const CHEMINEE = { vapeur: [-9.7, -21], crampton: [-10, -22] };

// --- Ciel ------------------------------------------------------------------

const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const hex = (c) => '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
const melange = (a, b, t) => { const x = rgb(a), y = rgb(b); return hex(x.map((v, i) => v + (y[i] - v) * t)); };

// Clés du ciel : minute du jour, haut, bas, collines lointaines, proches, nuit.
const CIELS = [
  [0, '#08111F', '#182540', '#0F1A2A', '#0B131E', 1],
  [300, '#0E1830', '#26365A', '#121D2E', '#0D1622', 1],
  [380, '#33416E', '#E59A6C', '#3A4659', '#2A3443', 0.55],
  [470, '#7EADD6', '#F2E2C4', '#8C9FA0', '#6C8577', 0],
  [720, '#5C9ED8', '#D5E8F4', '#91ADA3', '#6B8E75', 0],
  [1050, '#6C9ACA', '#F0D9AE', '#8C9C97', '#68816F', 0],
  [1160, '#36406C', '#EB8C5B', '#3B4357', '#2B3342', 0.45],
  [1270, '#0C1630', '#25355A', '#111B2C', '#0C1520', 1],
  [1440, '#08111F', '#182540', '#0F1A2A', '#0B131E', 1],
];

/** Couleurs du ciel et degré de nuit à une minute donnée. */
export function cielA(minute) {
  const m = ((minute % 1440) + 1440) % 1440;
  let i = 0;
  while (i < CIELS.length - 2 && CIELS[i + 1][0] <= m) i++;
  const a = CIELS[i], b = CIELS[i + 1];
  const t = (m - a[0]) / (b[0] - a[0]);
  return {
    haut: melange(a[1], b[1], t), bas: melange(a[2], b[2], t),
    loin: melange(a[3], b[3], t), pres: melange(a[4], b[4], t),
    nuit: a[5] + (b[5] - a[5]) * t,
  };
}

// --- Décors de terminus ------------------------------------------------------

/** Silhouettes posées sur l'horizon : Paris à gauche, l'arrivée à droite. */
function decor(type, x, y) {
  const P = (d) => `<path d="${d}" transform="translate(${f1(x)} ${f1(y)})" class="sc-decor"/>`;
  switch (type) {
    case 'eiffel':
      return P('M-11 0L-3.2 -30L-2 -44L-.6 -60H.6L2 -44L3.2 -30L11 0H7.4Q0 -11 -7.4 0Z M-6 -14H6V-12H-6Z M-3.4 -31H3.4V-29.6H-3.4Z');
    case 'colline':
      return P('M-80 0Q-50 -30 -18 -34Q0 -36 30 -18Q50 -6 70 0Z M-4 -34V-50H-1V-58H1V-50H4V-34Z M-.4 -58L0 -63L.4 -58Z');
    case 'cathedrale':
      return P('M-22 0V-26L-14 -34L-6 -26V-30H-2V-64L0 -72L2 -64V-30H6V-26L14 -34L22 -26V0Z');
    case 'beffroi':
      return P('M-8 0V-38H-6V-46Q0 -56 6 -46V-38H8V0Z M-24 0V-14L-17 -20L-10 -14V0Z M10 0V-16L17 -22L24 -16V0Z');
    case 'grues':
      return P('M-40 0V-36H-38V0Z M-60 -34H-6V-32H-60Z M-22 0V-44H-20V0Z M-34 -42H10V-40H-34Z M6 0V-12H40V0Z');
    case 'pont':
      return P('M-70 0V-10H70V0H58A10 10 0 0 0 38 0H22A10 10 0 0 0 2 0H-14A10 10 0 0 0 -34 0H-50A10 10 0 0 0 -70 0Z M-30 -10V-22H30V-10Z');
    case 'clocher':
      return P('M-12 0V-14H12V0Z M-9 -14V-24H9V-14Z M-6.5 -24V-33H6.5V-24Z M-4.5 -33V-40H4.5V-33Z M-3 -40L0 -54L3 -40Z');
    default: return '';
  }
}

const DECOR_AXE = {
  'sud-est': { types: ['colline'], mer: true }, normandie: { types: ['grues'], mer: true },
  est: { types: ['cathedrale'] }, nord: { types: ['beffroi'] },
  atlantique: { types: ['pont'] }, polt: { types: ['clocher'] },
};

/** Collines déterministes : le même axe donne toujours le même paysage. */
function collines(graine, w, base, amp, pas) {
  let h = 2166136261;
  for (const c of graine) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  const r = () => { h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h >>> 0) % 1000) / 1000; };
  const p1 = r() * 6, p2 = r() * 6;
  let d = `M0 ${f1(base + 40)}V${f1(base)}`;
  for (let x = 0; x <= w + pas; x += pas) {
    const y = base - amp * (0.55 + 0.45 * Math.sin(x / 97 + p1) * Math.sin(x / 41 + p2)) - r() * amp * 0.18;
    d += `L${f1(x)} ${f1(y)}`;
  }
  return d + `L${f1(w + pas)} ${f1(base + 400)}H0Z`;
}

/** Nom de gare réduit à un mot parlant : Creusot, Mâcon, St-Pierre… */
export function abreger(nom) {
  const n = nom.replace(/ TGV$/, '').replace(/^Paris-Gare de /, 'Paris-');
  const saint = /^(Saint|Sainte)-([^-\s]+)/.exec(n);
  if (saint) return (saint[1] === 'Saint' ? 'St-' : 'Ste-') + saint[2];
  const mots = n.split(/[-\s]/).filter((m) => m.length > 2 && !/^(Les?|La|des?|du|en|sur)$/i.test(m));
  return mots[0] || n;
}

// --- Préparation -----------------------------------------------------------

/**
 * Prépare les données d'une scène. `trains` : [{ cle, nom, couleur, train,
 * materielId, materielNom, fantome }], où `train` est l'objet accepté par
 * construireMarche. Les deux premiers non fantômes forment la paire dont on
 * guette le croisement.
 */
export function preparerScene(axe, trains, opts = {}) {
  const liste = trains.map((t) => {
    const marche = construireMarche(axe, t.train);
    return { ...t, marche, silhouette: silhouetteDe(t.materielId, marche.vitesse) };
  });
  const vrais = liste.filter((t) => !t.fantome);
  const croix = vrais.length >= 2 ? chercherCroisement(axe, vrais[0].marche, vrais[1].marche) : null;
  const fantome = liste.find((t) => t.fantome);
  const croixFantome = fantome && vrais[0] ? chercherCroisement(axe, vrais[0].marche, fantome.marche) : null;
  const deps = liste.map((t) => t.marche.depart), arrs = liste.map((t) => t.marche.arrivee);
  const tDebut = Math.min(...deps) - 4;
  const tFin = Math.max(...arrs) + 4;
  return { axe, trains: liste, croix, croixFantome, tDebut, tFin, ...opts };
}

/** Positions de chaque train à l'instant t : ce que la scène dessine. */
export function positionsA(d, t) {
  return d.trains.map((tr) => {
    const m = tr.marche;
    const pk = pkA(m, t);
    const avance = Math.abs(pkA(m, t + 0.25) - pkA(m, t - 0.25)) > 1e-4;
    const etat = t < m.depart ? 'avant' : t > m.arrivee ? 'arrive' : avance ? 'roule' : 'quai';
    return { pk, etat };
  });
}

// --- Son ----------------------------------------------------------------------

let audio = null;
function sonner(type) {
  try {
    audio ??= new (globalThis.AudioContext || globalThis.webkitAudioContext)();
    if (audio.state === 'suspended') audio.resume();
    const t0 = audio.currentTime;
    const sortie = audio.createGain();
    sortie.gain.value = 0.18;
    sortie.connect(audio.destination);
    if (type === 'croisement') {
      // Souffle : un bruit blanc filtré dont la fréquence balaie, effet Doppler.
      const n = audio.sampleRate * 1.1;
      const buf = audio.createBuffer(1, n, audio.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * Math.sin(Math.PI * i / n) ** 2;
      const src = audio.createBufferSource(); src.buffer = buf;
      const filtre = audio.createBiquadFilter(); filtre.type = 'bandpass'; filtre.Q.value = 0.9;
      filtre.frequency.setValueAtTime(1800, t0); filtre.frequency.exponentialRampToValueAtTime(380, t0 + 1.05);
      src.connect(filtre).connect(sortie); src.start(t0);
    }
    // Avertisseur à deux tons, ou sifflet pour la vapeur.
    const notes = type === 'sifflet' ? [[1046, 0, 0.55]] : [[392, 0.05, 0.28], [523, 0.36, 0.42]];
    for (const [f, d, du] of notes) {
      const o = audio.createOscillator(); o.type = type === 'sifflet' ? 'sine' : 'sawtooth';
      o.frequency.value = f;
      const g = audio.createGain();
      g.gain.setValueAtTime(0, t0 + d); g.gain.linearRampToValueAtTime(type === 'sifflet' ? 0.5 : 0.22, t0 + d + 0.03);
      g.gain.setValueAtTime(type === 'sifflet' ? 0.5 : 0.22, t0 + d + du - 0.05); g.gain.linearRampToValueAtTime(0, t0 + d + du);
      const lp = audio.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200;
      o.connect(lp).connect(g).connect(sortie); o.start(t0 + d); o.stop(t0 + d + du + 0.02);
    }
  } catch { /* pas de son disponible : la scène reste muette */ }
}

// --- Montage ------------------------------------------------------------------

const VITESSES = [1, 2, 5, 10, 20, 40];
const reduit = () => !!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Dessine la scène dans `conteneur` et l'anime. Renvoie une télécommande :
 * { aller(t), jouer(), pause(), detruire() }.
 *
 * Options de `d` : mode ('complet' | 'enonce' | 'corrige'), auto (lecture
 * automatique), arretCroisement (arrêt sur image à la rencontre), depart
 * (instant initial), graphique (le SVG du graphique de marche à synchroniser),
 * reponse ({ type: 'heure' | 'pk', valeur }), masque ({ cle, champ }) pour ne
 * pas trahir la réponse dans l'énoncé, legendeFin (texte affiché en fin).
 */
export function monterScene(conteneur, d) {
  if (!conteneur || typeof document === 'undefined') return null;
  conteneur._scene?.detruire();

  const axe = d.axe, L = axe.longueur;
  const W = Math.max(320, Math.round(conteneur.clientWidth || 860));
  const H = Math.round(borner(W * 0.34, 236, 300));
  const mG = Math.max(54, W * 0.06), mD = Math.max(54, W * 0.06);
  const X = (pk) => mG + (pk / L) * (W - mG - mD);
  const yHorizon = H * 0.5, yLoin = H * 0.6, yPres = H * 0.725;
  // Les trains grandissent avec la scène, sans dépasser l'écartement des voies.
  const ech = borner(W / 800, 1, 1.4);
  // Sous la voie du bas, trois rangs qui ne se recouvrent jamais : les étiquettes
  // des trains, la réglette de l'écart (où se pose le losange du croisement),
  // puis une seule ligne de lecture qui dit l'écart et, une fois passé, le croisement.
  const yRang1 = yPres + 9, yRegle = yPres + 36, yLecture = yPres + 54;
  // Largeur estimée d'un texte : les polices à chasse fixe de l'iPhone sont un
  // peu plus larges que celles de Chrome, on compte large.
  const largeurMono = (t, taille = 11.5) => t.length * taille * 0.62;
  const enonce = d.mode === 'enonce';
  const id = 'sc' + Math.random().toString(36).slice(2, 8);

  // Plaques émaillées des gares de l'axe, placées sur trois étages sans chevauchement.
  // Les plaques se tiennent au-dessus de l'étiquette du plus haut des trains.
  const hMax = Math.max(...d.trains.map((tr) => GABARIT[silhouetteDe(tr.materielId, tr.marche.vitesse)]?.h || 16));
  const yPlaques = yLoin - hMax * ech - 31;
  // L'horloge et l'heure affichée occupent le coin supérieur gauche.
  const boites = [{ x1: 0, x2: 190, y1: 0, y2: 58 }];
  const libre = (b) => !boites.some((q) => !(b.x2 < q.x1 || b.x1 > q.x2 || b.y2 < q.y1 || b.y1 > q.y2));
  let plaques = '';
  for (const j of axe.jalons) {
    const x = X(j.pk);
    const essais = [j.nom, j.nom.replace(/ TGV$/, '').replace(/^Paris-Gare de /, 'Paris-'), abreger(j.nom)];
    let pose = null;
    for (const nom of essais) {
      const lp = nom.length * 6.1 + 14;
      for (const niveau of [0, 1, 2]) {
        const y = yPlaques - niveau * 24;
        const b = { x1: borner(x - lp / 2, 4, W - lp - 4), y1: y - 14, y2: y + 4 };
        b.x2 = b.x1 + lp;
        if (libre(b)) { pose = { nom, b, y }; break; }
      }
      if (pose) break;
    }
    plaques += `<line x1="${f1(x)}" y1="${f1(pose ? pose.y + 4 : yLoin - 30)}" x2="${f1(x)}" y2="${f1(yLoin - 1)}" class="sc-poteau"/>`;
    plaques += `<rect x="${f1(x - 9)}" y="${f1(yPres + 7)}" width="18" height="3" class="sc-quai"/>`;
    if (pose) {
      boites.push(pose.b);
      plaques += `<g class="sc-plaque"><rect x="${f1(pose.b.x1)}" y="${f1(pose.b.y1)}" width="${f1(pose.b.x2 - pose.b.x1)}" height="18" rx="2.5"/>`
        + `<rect x="${f1(pose.b.x1 + 2)}" y="${f1(pose.b.y1 + 2)}" width="${f1(pose.b.x2 - pose.b.x1 - 4)}" height="14" rx="1.6" class="sc-plaque-filet"/>`
        + `<text x="${f1((pose.b.x1 + pose.b.x2) / 2)}" y="${f1(pose.y - 1.5)}" text-anchor="middle">${esc(pose.nom)}</text></g>`;
    }
  }

  const dec = DECOR_AXE[axe.id] || { types: [] };
  let decors = decor('eiffel', mG * 0.42, yHorizon + 3);
  dec.types.forEach((t, i) => { decors += decor(t, W - mD * 0.7 - i * 60, yHorizon + 3); });
  const mer = dec.mer ? `<rect x="${f1(X(L * 0.9))}" y="${f1(yHorizon - 1)}" width="${f1(W)}" height="7" class="sc-mer"/>` : '';

  let etoiles = '';
  for (let i = 0; i < 46; i++) {
    const x = (i * 97.3 + (i % 7) * 31) % W, y = (i * 53.7 + (i % 5) * 19) % (yHorizon - 20);
    etoiles += `<circle cx="${f1(x)}" cy="${f1(y + 4)}" r="${(0.5 + (i % 3) * 0.35).toFixed(2)}"/>`;
  }

  const trainsSvg = d.trains.map((tr, i) => `
    <g class="sc-train${tr.fantome ? ' est-fantome' : ''}" data-i="${i}">
      <path class="sc-phare" d="M0 -8L120 -24V10L0 -3Z" fill="url(#${id}-phare)"/>
      <g class="sc-corps">${dessinTrain(tr.silhouette, tr.couleur)}</g>
    </g>`).join('');
  const etiquettes = d.trains.map((tr, i) => `
    <g class="sc-etiquette${tr.fantome ? ' est-fantome' : ''}" data-i="${i}" style="--c:${esc(tr.couleur)}">
      <rect rx="9" height="18"/><text y="12.6"></text>
    </g>`).join('');
  const fumees = d.trains.map((tr, i) => A_VAPEUR(tr.silhouette)
    ? `<g class="sc-fumees" data-i="${i}">${'<circle r="0"/>'.repeat(9)}</g>` : '').join('');

  // Le drapeau de la réponse : planté entre les deux voies, son étiquette
  // occupe le premier rang, que les étiquettes des trains contournent.
  const xDrapeau = d.reponse?.type === 'pk' && Number.isFinite(d.reponse.valeur) ? X(borner(d.reponse.valeur, 0, L)) : null;
  const reponsePk = xDrapeau !== null
    ? `<g class="sc-drapeau" transform="translate(${f1(xDrapeau)} 0)">
         <line y1="${f1(yRang1)}" y2="${f1(yPres - 27)}"/><path d="M0 ${f1(yPres - 27)}l13 4.5l-13 4.5Z"/>
         <rect x="-29" y="${f1(yRang1)}" width="58" height="18" rx="9"/><text y="${f1(yRang1 + 12.6)}" text-anchor="middle">votre PK</text></g>` : '';

  conteneur.innerHTML = `
  <figure class="scene${enonce ? ' est-enonce' : ''}">
    <svg class="scene-svg" viewBox="0 0 ${W} ${H}" xmlns="${NS}" role="img"
      aria-label="Animation de la ligne ${esc(axe.nom)} : les trains roulent selon le graphique de marche">
      <defs>
        <linearGradient id="${id}-ciel" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" class="sc-ciel-haut"/><stop offset="1" class="sc-ciel-bas"/>
        </linearGradient>
        <linearGradient id="${id}-phare" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="#FFF4C8" stop-opacity=".85"/><stop offset="1" stop-color="#FFF4C8" stop-opacity="0"/>
        </linearGradient>
        <radialGradient id="${id}-astre"><stop offset="0" stop-color="#FFF6DC" stop-opacity=".9"/><stop offset="1" stop-color="#FFF6DC" stop-opacity="0"/></radialGradient>
        <pattern id="${id}-traverses" width="7" height="8" patternUnits="userSpaceOnUse"><rect width="3.4" height="8" class="sc-traverse"/></pattern>
      </defs>
      <rect width="${W}" height="${H}" fill="url(#${id}-ciel)"/>
      <g class="sc-etoiles">${etoiles}</g>
      <g class="sc-astre"><circle r="38" fill="url(#${id}-astre)"/><circle r="10" class="sc-disque"/></g>
      <path d="${collines(axe.id, W, yHorizon + 4, 34, 18)}" class="sc-loin"/>
      ${mer}
      <g class="sc-decors">${decors}</g>
      <path d="${collines(axe.id + '+', W, yLoin + 6, 16, 26)}" class="sc-pres"/>
      <rect x="0" y="${f1(yLoin - 5)}" width="${W}" height="${f1(yPres - yLoin + 14)}" class="sc-ballast"/>
      <rect x="0" y="${f1(yLoin - 3)}" width="${W}" height="7" fill="url(#${id}-traverses)"/>
      <rect x="0" y="${f1(yPres - 3)}" width="${W}" height="7" fill="url(#${id}-traverses)"/>
      <path d="M0 ${f1(yLoin - 3)}H${W}M0 ${f1(yLoin + 3)}H${W}M0 ${f1(yPres - 3)}H${W}M0 ${f1(yPres + 3)}H${W}" class="sc-rail"/>
      <g class="sc-jalons">${plaques}</g>
      <g class="sc-croix" opacity="0">
        <line y1="${f1(yLoin - 30)}" y2="${f1(yRegle - 6)}"/>
        <path d="M0 ${f1(yRegle - 6)}l6 6l-6 6l-6 -6Z"/>
      </g>
      <g class="sc-croix-fantome" opacity="0"><line y1="${f1(yLoin - 26)}" y2="${f1(yRegle)}"/></g>
      ${reponsePk}
      ${fumees}
      ${trainsSvg}
      ${etiquettes}
      <g class="sc-ecart" opacity="0">
        <path class="sc-ecart-trait"/><text text-anchor="middle"></text>
      </g>
      <circle class="sc-onde" r="0"/>
      <rect width="${W}" height="${H}" class="sc-flash" opacity="0"/>
      <g class="sc-horloge" transform="translate(32 31)">
        <circle r="22" class="sc-cadran"/>
        ${Array.from({ length: 12 }, (_, i) => `<line y1="-19" y2="${i % 3 ? -17 : -15.5}" transform="rotate(${i * 30})"/>`).join('')}
        <line class="sc-aiguille-h" y1="2" y2="-10"/><line class="sc-aiguille-m" y1="3" y2="-16.5"/><circle r="1.8"/>
      </g>
      <text x="62" y="30" class="sc-heure"></text>
      <text x="62" y="47" class="sc-sous-heure"></text>
      <g class="sc-bandeau" opacity="0"><rect rx="5" height="30"/><text y="20" text-anchor="middle"></text></g>
    </svg>
    ${enonce ? '' : `
    <div class="scene-ctrl">
      <button type="button" class="sc-btn sc-jouer" data-sc="jouer" aria-label="Lecture">▶</button>
      <button type="button" class="sc-btn" data-sc="debut" aria-label="Revenir au départ" title="Revenir au départ">⟲</button>
      <div class="sc-temps">
        <input type="range" data-sc="temps" min="${d.tDebut}" max="${d.tFin}" step="0.25" aria-label="Heure simulée">
        <div class="sc-reperes"></div>
      </div>
      <button type="button" class="sc-btn sc-texte" data-sc="croix">Au croisement</button>
      <label class="sc-vitesse">Cadence
        <select data-sc="vitesse">${VITESSES.map((v) => `<option value="${v}">${v} min / s</option>`).join('')}</select>
      </label>
      <button type="button" class="sc-btn sc-texte" data-sc="son" aria-pressed="false" title="Avertisseur au croisement">Son</button>
    </div>`}
    <figcaption class="scene-legende" aria-live="polite"></figcaption>
  </figure>`;

  const svg = conteneur.querySelector('.scene-svg');
  const $ = (s) => svg.querySelector(s);
  const legende = conteneur.querySelector('.scene-legende');
  const curseur = d.graphique ? armerGraphique(d) : null;

  const els = d.trains.map((tr, i) => ({
    g: svg.querySelector(`.sc-train[data-i="${i}"]`),
    et: svg.querySelector(`.sc-etiquette[data-i="${i}"]`),
    fum: svg.querySelector(`.sc-fumees[data-i="${i}"]`),
    puffs: [], dernierPuff: 0,
  }));

  // Repères sur la réglette : départs, croisement, réponse.
  const reperes = conteneur.querySelector('.sc-reperes');
  if (reperes) {
    const pos = (t) => `${(100 * (t - d.tDebut) / (d.tFin - d.tDebut)).toFixed(2)}%`;
    let r = d.trains.filter((t) => !t.fantome).map((t) => `<i style="left:${pos(t.marche.depart)};--c:${esc(t.couleur)}" title="Départ"></i>`).join('');
    if (d.croix && d.croix.type !== 'aucun') r += `<b style="left:${pos(d.croix.t)}" title="Croisement"></b>`;
    if (d.reponse?.type === 'heure' && Number.isFinite(d.reponse.valeur)) r += `<u style="left:${pos(borner(d.reponse.valeur, d.tDebut, d.tFin))}" title="Votre réponse"></u>`;
    reperes.innerHTML = r;
  }

  const etat = {
    t: d.depart ?? d.tDebut, joue: false, dernier: 0, pauseJusqua: 0,
    vitesse: VITESSES.reduce((a, b) => (Math.abs(b - (d.tFin - d.tDebut) / 16) < Math.abs(a - (d.tFin - d.tDebut) / 16) ? b : a)),
    son: false, vuCroix: false, vuFantome: false, vuReponse: false, raf: 0, fini: false,
  };

  const range = conteneur.querySelector('[data-sc="temps"]');
  const selVitesse = conteneur.querySelector('[data-sc="vitesse"]');
  if (selVitesse) selVitesse.value = String(etat.vitesse);
  const btnJouer = conteneur.querySelector('[data-sc="jouer"]');

  const vrais = d.trains.map((t, i) => (t.fantome ? -1 : i)).filter((i) => i >= 0);
  const enCroisement = d.croix && d.croix.type !== 'aucun';

  function bandeau(texte, couleur) {
    const g = $('.sc-bandeau');
    g.querySelector('text').textContent = texte;
    const lg = texte.length * 7.6 + 28;
    g.querySelector('rect').setAttribute('width', f1(lg));
    g.querySelector('rect').setAttribute('x', f1(-lg / 2));
    g.setAttribute('transform', `translate(${f1(W / 2)} 10)`);
    g.style.setProperty('--c', couleur || 'var(--signal)');
    g.setAttribute('opacity', '1');
    clearTimeout(etat.tBandeau);
    etat.tBandeau = setTimeout(() => g.setAttribute('opacity', '0'), 2600);
  }

  function onde(x, y, couleur) {
    if (reduit()) return;
    const c = $('.sc-onde');
    c.setAttribute('cx', f1(x)); c.setAttribute('cy', f1(y));
    c.style.stroke = couleur;
    c.animate?.([{ r: 4, opacity: 1 }, { r: 90, opacity: 0 }], { duration: 900, easing: 'ease-out' });
    $('.sc-flash').animate?.([{ opacity: 0.55 }, { opacity: 0 }], { duration: 420, easing: 'ease-out' });
  }

  function dire(texte) { if (legende) legende.textContent = texte; }

  function dessiner() {
    const t = etat.t;
    const ciel = cielA(t);
    svg.querySelector('.sc-ciel-haut').setAttribute('stop-color', ciel.haut);
    svg.querySelector('.sc-ciel-bas').setAttribute('stop-color', ciel.bas);
    $('.sc-loin').style.fill = ciel.loin;
    $('.sc-pres').style.fill = ciel.pres;
    $('.sc-decors').style.fill = melange(ciel.loin, '#000000', 0.18);
    $('.sc-etoiles').setAttribute('opacity', (ciel.nuit * 0.95).toFixed(2));
    svg.style.setProperty('--fenetre', melange('#DCE8EF', '#FFD98A', ciel.nuit));
    svg.style.setProperty('--phare', (ciel.nuit * 0.95).toFixed(2));

    // Soleil de 6 h 20 à 19 h 40, lune le reste du temps.
    const m = ((t % 1440) + 1440) % 1440;
    const jour = m >= 380 && m <= 1180;
    const p = jour ? (m - 380) / 800 : ((m - 1180 + 1440) % 1440) / 640;
    const astre = $('.sc-astre');
    astre.setAttribute('transform', `translate(${f1(W * (0.08 + 0.84 * borner(p, 0, 1)))} ${f1(yHorizon - Math.sin(Math.PI * borner(p, 0, 1)) * (yHorizon - 30) + 6)})`);
    astre.classList.toggle('est-lune', !jour);

    // Horloge de quai.
    const mm = ((Math.round(t) % 1440) + 1440) % 1440;
    $('.sc-aiguille-h').setAttribute('transform', `rotate(${((mm % 720) / 2).toFixed(1)})`);
    $('.sc-aiguille-m').setAttribute('transform', `rotate(${((mm % 60) * 6).toFixed(1)})`);
    $('.sc-heure').textContent = enHeure(t);
    $('.sc-sous-heure').textContent = enonce ? 'heure de départ' : `${etat.joue ? '▶' : '❚❚'} ${etat.vitesse} min / s`;

    // Dans un énoncé, chaque train attend à son origine : sa position à
    // l'instant affiché trahirait une heure de départ qu'on demande de trouver.
    const pos = enonce
      ? d.trains.map((tr) => ({ pk: tr.marche.points[0].pk, etat: 'avant' }))
      : positionsA(d, t);
    const xs = pos.map((p) => X(p.pk));
    const etiquettes = [];

    d.trains.forEach((tr, i) => {
      const e = els[i], p = pos[i];
      const sens = tr.marche.montant ? -1 : 1;
      const yVoie = tr.marche.montant ? yPres : yLoin;
      // Dépassement : le plus rapide de deux trains de même sens glisse sur
      // la voie contiguë quand il rattrape l'autre.
      let decal = 0;
      d.trains.forEach((au, j) => {
        if (j === i || au.marche.montant !== tr.marche.montant || tr.marche.vitesse <= au.marche.vitesse) return;
        const gab = GABARIT[tr.silhouette].l * ech;
        decal = Math.max(decal, 1 - lisser(gab * 1.25, gab * 2.6, Math.abs(xs[i] - xs[j])));
      });
      const y = yVoie + (tr.marche.montant ? -1 : 1) * decal * (yPres - yLoin);
      e.g.setAttribute('transform', `translate(${f1(xs[i])} ${f1(y + 1.6)}) scale(${(sens * ech).toFixed(3)} ${ech.toFixed(3)})`);
      e.g.classList.toggle('roule', p.etat === 'roule' && etat.joue);

      const gab = { l: GABARIT[tr.silhouette].l * ech, h: GABARIT[tr.silhouette].h * ech };
      let texte;
      if (enonce && d.masque?.cle === tr.cle) texte = `${tr.nom} · ${d.masque.champ === 'vitesse' ? '? km/h' : 'départ ?'}`;
      else if (p.etat === 'avant') texte = `${tr.nom} · départ ${enHeure(tr.marche.depart)}`;
      else if (p.etat === 'arrive') texte = `${tr.nom} · arrivé ${enHeure(tr.marche.arrivee)}`;
      else if (p.etat === 'quai') texte = `${tr.nom} · à quai`;
      else texte = `${tr.nom} · ${Math.round(tr.marche.vitesse)} km/h`;
      const txt = e.et.querySelector('text');
      if (txt.textContent !== texte) txt.textContent = texte;
      const lg = texte.length * 6.6 + 16;
      // Un train de la voie du haut porte son étiquette au-dessus de lui ; celui
      // de la voie du bas, au premier rang sous les rails.
      etiquettes.push({ e, lg, cx: xs[i] - sens * gab.l / 2, ye: tr.marche.montant ? yRang1 : y - gab.h - 23, fantome: !!tr.fantome });
      e.et.querySelector('rect').setAttribute('width', f1(lg));
      e.et.querySelector('rect').setAttribute('x', f1(-lg / 2));
      txt.setAttribute('x', '0');
      txt.setAttribute('text-anchor', 'middle');

      // Fumée : des bouffées qui montent et se dissipent, seulement en marche.
      if (e.fum) {
        const [cxh, cyh] = CHEMINEE[tr.silhouette];
        const now = performance.now();
        if (p.etat === 'roule' && etat.joue && !reduit() && now - e.dernierPuff > 140) {
          e.puffs.push({ x: xs[i] + sens * cxh * ech, y: y + cyh * ech, n: now });
          e.dernierPuff = now;
          if (e.puffs.length > 9) e.puffs.shift();
        }
        const cercles = e.fum.children;
        for (let k = 0; k < cercles.length; k++) {
          const pf = e.puffs[k];
          if (!pf) { cercles[k].setAttribute('r', '0'); continue; }
          const age = (now - pf.n) / 1300;
          cercles[k].setAttribute('cx', f1(pf.x - sens * age * 18));
          cercles[k].setAttribute('cy', f1(pf.y - age * 22));
          cercles[k].setAttribute('r', f1(2.5 + age * 7));
          cercles[k].setAttribute('opacity', Math.max(0, 0.7 - age * 0.7).toFixed(2));
        }
      }
    });

    placerEtiquettes(etiquettes);

    // L'écart : la distance qui sépare les deux trains, et sa vitesse de fonte.
    // Une fois la rencontre passée, la même ligne dit aussi où et quand elle a eu lieu.
    const ecart = $('.sc-ecart');
    const croisementPasse = enCroisement && t >= d.croix.t - 0.01 && !enonce;
    const texteCroix = croisementPasse
      ? `${d.croix.type === 'rattrapage' ? 'Rejoint' : 'Croisés'} à ${enHeure(d.croix.t)}, PK ${Math.round(d.croix.pk)}` : '';
    if (vrais.length >= 2 && !enonce) {
      const [a, b] = vrais;
      const roulent = pos[a].etat !== 'avant' || pos[b].etat !== 'avant';
      const dist = Math.abs(pos[a].pk - pos[b].pk);
      const passe = enCroisement && t > d.croix.t;
      const tx = ecart.querySelector('text');
      const trait = ecart.querySelector('path');
      let texte = '', centre = W / 2;
      if (roulent && dist > 0.5) {
        const x1 = Math.min(xs[a], xs[b]), x2 = Math.max(xs[a], xs[b]);
        const y = yRegle;
        trait.setAttribute('d', `M${f1(x1)} ${f1(y - 5)}V${f1(y + 5)}M${f1(x1)} ${f1(y)}H${f1(x2)}M${f1(x2)} ${f1(y - 5)}V${f1(y + 5)}`);
        const memeSens = d.trains[a].marche.montant === d.trains[b].marche.montant;
        const v = memeSens ? Math.abs(d.trains[a].marche.vitesse - d.trains[b].marche.vitesse) : d.trains[a].marche.vitesse + d.trains[b].marche.vitesse;
        const km = `${Math.round(dist)} km`;
        texte = passe
          ? `${texteCroix} · ${km} ${memeSens ? "d'écart" : 'entre eux'}`
          : `${km}${pos[a].etat === 'roule' && pos[b].etat === 'roule' ? ` · se referment à ${Math.round(v)} km/h` : ''}`;
        // Trop long pour l'écran : on garde l'essentiel.
        if (largeurMono(texte) > W - 12) texte = passe ? texteCroix : km;
        centre = (x1 + x2) / 2;
      } else {
        trait.setAttribute('d', '');
        texte = texteCroix;
        centre = croisementPasse ? X(d.croix.pk) : W / 2;
      }
      tx.textContent = texte;
      const lg = largeurMono(texte);
      tx.setAttribute('x', f1(borner(centre, lg / 2 + 4, W - lg / 2 - 4)));
      tx.setAttribute('y', f1(yLecture));
      ecart.setAttribute('opacity', texte ? '1' : '0');
    } else ecart.setAttribute('opacity', '0');

    // Le point de rencontre reste marqué une fois franchi : un losange sur la réglette.
    const croix = $('.sc-croix');
    if (croisementPasse) {
      croix.setAttribute('opacity', '1');
      croix.setAttribute('transform', `translate(${f1(X(d.croix.pk))} 0)`);
    } else croix.setAttribute('opacity', '0');
    const cf = $('.sc-croix-fantome');
    if (d.croixFantome && d.croixFantome.type !== 'aucun' && t >= d.croixFantome.t && !enonce) {
      cf.setAttribute('opacity', '1');
      cf.setAttribute('transform', `translate(${f1(X(d.croixFantome.pk))} 0)`);
    } else cf.setAttribute('opacity', '0');

    if (range && document.activeElement !== range) range.value = String(t);
    if (btnJouer) { btnJouer.textContent = etat.joue ? '❚❚' : '▶'; btnJouer.setAttribute('aria-label', etat.joue ? 'Pause' : 'Lecture'); }
    curseur?.(t, pos);
  }

  /**
   * Pose les étiquettes des trains sans qu'elles se recouvrent : les vrais
   * trains d'abord, le fantôme ensuite. Une étiquette gênée se décale à côté
   * de celle qui la gêne ; au-dessus des voies, elle peut aussi monter d'un cran.
   */
  function placerEtiquettes(liste) {
    const posees = [];
    if (xDrapeau !== null) posees.push({ x1: xDrapeau - 33, x2: xDrapeau + 33, y: yRang1 });
    const libre = (x1, x2, y) => x1 >= 2 && x2 <= W - 2
      && !posees.some((b) => Math.abs(b.y - y) < 19 && x1 < b.x2 + 4 && x2 > b.x1 - 4);
    for (const et of [...liste].sort((p, q) => p.fantome - q.fantome)) {
      const demi = et.lg / 2;
      const cx0 = borner(et.cx, demi + 2, W - demi - 2);
      // Candidats : la place voulue, puis accolée à chaque étiquette déjà posée,
      // puis par pas d'une largeur ; au-dessus des voies, on peut aussi monter.
      const etages = et.ye < yLoin ? [0, -21, -42] : [0];
      const essais = [];
      for (const dy of etages) {
        const y = et.ye + dy;
        essais.push([cx0, y]);
        for (const b of posees) essais.push([b.x2 + 5 + demi, y], [b.x1 - 5 - demi, y]);
        for (const k of [1, -1, 2, -2, 3, -3]) essais.push([cx0 + k * (et.lg + 6), y]);
      }
      essais.sort((a, b) => Math.hypot(a[0] - cx0, (a[1] - et.ye) * 3) - Math.hypot(b[0] - cx0, (b[1] - et.ye) * 3));
      const trouve = essais.find(([x, y]) => libre(x - demi, x + demi, y));
      // Rien ne tient : un vrai train garde son étiquette, le fantôme se tait
      // (sa couleur, le graphique et la légende le désignent déjà).
      if (!trouve && et.fantome) { et.e.et.setAttribute('opacity', '0'); continue; }
      const [cx, ye] = trouve || [cx0, et.ye];
      posees.push({ x1: cx - demi, x2: cx + demi, y: ye });
      et.e.et.setAttribute('opacity', '1');
      et.e.et.setAttribute('transform', `translate(${f1(cx)} ${f1(ye)})`);
    }
  }

  /** Événements franchis entre deux instants : rencontre, fantôme, réponse. */
  function evenements(t0, t1) {
    if (t1 <= t0) return;
    if (enCroisement && !etat.vuCroix && t0 < d.croix.t && t1 >= d.croix.t) {
      etat.vuCroix = true;
      const rattr = d.croix.type === 'rattrapage';
      bandeau(`${rattr ? 'Rattrapage' : 'Croisement'} à ${enHeure(d.croix.t)} !`, 'var(--signal)');
      onde(X(d.croix.pk), (yLoin + yPres) / 2, 'var(--signal)');
      dire(`${enHeure(d.croix.t)} : ${rattr ? 'le train B rejoint le train A' : 'les deux trains se croisent'} au PK ${Math.round(d.croix.pk)}, entre ${d.croix.segment.avant.nom} et ${d.croix.segment.apres.nom}.`);
      if (etat.son) sonner('croisement');
      if (d.arretCroisement !== false) { etat.t = d.croix.t; etat.pauseJusqua = performance.now() + (reduit() ? 0 : 1500); }
    }
    if (d.croixFantome && d.croixFantome.type !== 'aucun' && !etat.vuFantome && t0 < d.croixFantome.t && t1 >= d.croixFantome.t) {
      etat.vuFantome = true;
      onde(X(d.croixFantome.pk), (yLoin + yPres) / 2, '#8C7BD8');
      if (d.legendeFantome) setTimeout(() => dire(d.legendeFantome), enCroisement && Math.abs(d.croix.t - d.croixFantome.t) < 3 ? 2200 : 0);
    }
    if (d.reponse?.type === 'heure' && !etat.vuReponse && t0 < d.reponse.valeur && t1 >= d.reponse.valeur) {
      etat.vuReponse = true;
      bandeau(`Votre réponse : ${enHeure(d.reponse.valeur)}`, '#8C7BD8');
      if (d.legendeReponse) dire(d.legendeReponse);
      if (d.arretCroisement !== false) etat.pauseJusqua = performance.now() + (reduit() ? 0 : 1300);
    }
  }

  function boucle(ts) {
    if (!conteneur.isConnected) { detruire(); return; }
    if (!etat.joue) return;
    const dt = etat.dernier ? Math.min(0.1, (ts - etat.dernier) / 1000) : 0;
    etat.dernier = ts;
    if (ts >= etat.pauseJusqua) {
      const avant = etat.t;
      etat.t = Math.min(d.tFin, etat.t + dt * etat.vitesse);
      evenements(avant, etat.t);
      if (etat.t >= d.tFin) {
        etat.joue = false; etat.fini = true;
        if (d.legendeFin) dire(d.legendeFin);
      }
    }
    dessiner();
    if (etat.joue) etat.raf = requestAnimationFrame(boucle);
  }

  function jouer() {
    if (etat.t >= d.tFin - 0.01) aller(d.tDebut);
    etat.joue = true; etat.dernier = 0;
    if (etat.son) {
      const premier = d.trains.find((x) => !x.fantome);
      if (premier && etat.t <= premier.marche.depart) sonner(A_VAPEUR(premier.silhouette) ? 'sifflet' : 'depart');
    }
    cancelAnimationFrame(etat.raf);
    etat.raf = requestAnimationFrame(boucle);
  }
  function pause() { etat.joue = false; cancelAnimationFrame(etat.raf); dessiner(); }
  function aller(t) {
    etat.t = borner(t, d.tDebut, d.tFin);
    // Revenir en arrière réarme les événements qu'on n'a pas encore revus.
    if (enCroisement && etat.t < d.croix.t) etat.vuCroix = false;
    if (d.croixFantome && etat.t < d.croixFantome.t) etat.vuFantome = false;
    if (d.reponse?.type === 'heure' && etat.t < d.reponse.valeur) etat.vuReponse = false;
    dessiner();
  }
  function detruire() {
    cancelAnimationFrame(etat.raf);
    clearTimeout(etat.tBandeau);
    etat.joue = false;
    if (conteneur._scene === tele) conteneur._scene = null;
  }

  conteneur.querySelector('.scene-ctrl')?.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-sc]');
    if (!b) return;
    const quoi = b.dataset.sc;
    if (quoi === 'jouer') { etat.joue ? pause() : jouer(); }
    else if (quoi === 'debut') { pause(); aller(d.tDebut); dire(''); }
    else if (quoi === 'croix' && enCroisement) { pause(); aller(d.croix.t - 0.001); evenements(d.croix.t - 0.002, d.croix.t); etat.pauseJusqua = 0; dessiner(); }
    else if (quoi === 'son') {
      etat.son = !etat.son;
      b.setAttribute('aria-pressed', String(etat.son));
      if (etat.son) sonner('depart');
    }
  });
  // On lit la valeur avant la pause : la pause redessine la scène et remettrait
  // la réglette à l'ancienne heure. Safari sur iPhone ne donne pas le focus à
  // une réglette qu'on fait glisser, et le glissement y restait sans effet.
  range?.addEventListener('input', () => { const v = +range.value; pause(); aller(v); });
  selVitesse?.addEventListener('change', () => { etat.vitesse = +selVitesse.value; dessiner(); });

  // Le graphique de marche sert aussi de réglette : on y fait glisser le temps.
  if (d.graphique) {
    const g = d.graphique, ds = g.dataset;
    const versT = (ev) => {
      const r = g.getBoundingClientRect();
      const x = (ev.clientX - r.left) / r.width * (+ds.gmW);
      return +ds.gmT0 + (x - +ds.gmGauche) / (+ds.gmW - +ds.gmGauche - +ds.gmDroite) * (+ds.gmT1 - +ds.gmT0);
    };
    let tire = false;
    g.addEventListener('pointerdown', (ev) => { tire = true; pause(); aller(versT(ev)); try { g.setPointerCapture(ev.pointerId); } catch { /* refus */ } });
    g.addEventListener('pointermove', (ev) => { if (tire) aller(versT(ev)); });
    const fin = () => { tire = false; };
    g.addEventListener('pointerup', fin);
    g.addEventListener('pointercancel', fin);
    g.classList.add('est-pilotable');
  }

  const tele = { aller, jouer, pause, detruire, etat };
  conteneur._scene = tele;
  dessiner();
  if (d.legendeDepart) dire(d.legendeDepart);
  if (d.auto && !reduit()) setTimeout(() => { if (conteneur.isConnected && conteneur._scene === tele) jouer(); }, 450);
  return tele;
}

/**
 * Greffe un curseur sur le graphique de marche : une verticale à l'heure
 * simulée, un point sur chaque marche, et entre les deux points le segment
 * qui mesure leur écart — la distance entre les trains, lue sur la feuille.
 */
function armerGraphique(d) {
  const g = d.graphique, ds = g.dataset;
  if (!ds.gmW) return null;
  const W = +ds.gmW, gauche = +ds.gmGauche, droite = +ds.gmDroite, haut = +ds.gmHaut, bas = +ds.gmBas, H = +ds.gmH;
  const t0 = +ds.gmT0, t1 = +ds.gmT1, L = +ds.gmL;
  const X = (t) => gauche + ((t - t0) / (t1 - t0)) * (W - gauche - droite);
  const Y = (pk) => haut + (pk / L) * (H - haut - bas);

  g.querySelector('.gm-curseur')?.remove();
  const c = document.createElementNS(NS, 'g');
  c.setAttribute('class', 'gm-curseur');
  const vrais = d.trains.map((t, i) => (t.fantome ? -1 : i)).filter((i) => i >= 0);
  c.innerHTML = `<line class="gm-curseur-t" y1="${haut}" y2="${H - bas}"/>`
    + `<line class="gm-curseur-ecart"/>`
    + `<text class="gm-curseur-txt"></text>`
    + d.trains.map((tr, i) => `<circle r="5" data-i="${i}" style="fill:${esc(tr.couleur)}" class="${tr.fantome ? 'est-fantome' : ''}"/>`).join('');
  // Réponse en heure : une verticale violette ; en PK : une horizontale.
  if (d.reponse?.type === 'heure' && Number.isFinite(d.reponse.valeur) && d.reponse.valeur > t0 && d.reponse.valeur < t1) {
    c.insertAdjacentHTML('afterbegin', `<line class="gm-reponse" x1="${f1(X(d.reponse.valeur))}" x2="${f1(X(d.reponse.valeur))}" y1="${haut}" y2="${H - bas}"/>`);
  }
  if (d.reponse?.type === 'pk' && Number.isFinite(d.reponse.valeur)) {
    const y = Y(borner(d.reponse.valeur, 0, L));
    c.insertAdjacentHTML('afterbegin', `<line class="gm-reponse" x1="${gauche}" x2="${W - droite}" y1="${f1(y)}" y2="${f1(y)}"/>`);
  }
  g.appendChild(c);
  const ligne = c.querySelector('.gm-curseur-t');
  const ec = c.querySelector('.gm-curseur-ecart');
  const tx = c.querySelector('.gm-curseur-txt');
  const pts = [...c.querySelectorAll('circle')];

  return (t, pos) => {
    const x = X(t);
    ligne.setAttribute('x1', f1(x)); ligne.setAttribute('x2', f1(x));
    pts.forEach((p, i) => { p.setAttribute('cx', f1(x)); p.setAttribute('cy', f1(Y(pos[i].pk))); });
    if (vrais.length >= 2) {
      const ya = Y(pos[vrais[0]].pk), yb = Y(pos[vrais[1]].pk);
      const dist = Math.abs(pos[vrais[0]].pk - pos[vrais[1]].pk);
      ec.setAttribute('x1', f1(x)); ec.setAttribute('x2', f1(x));
      ec.setAttribute('y1', f1(ya)); ec.setAttribute('y2', f1(yb));
      ec.setAttribute('opacity', dist > 1 ? '1' : '0');
      tx.textContent = dist > 1 ? `${Math.round(dist)} km` : '';
      const aGauche = x > W - droite - 70;
      tx.setAttribute('x', f1(x + (aGauche ? -8 : 8)));
      tx.setAttribute('text-anchor', aGauche ? 'end' : 'start');
      tx.setAttribute('y', f1((ya + yb) / 2 + 4));
    }
  };
}

/**
 * Phrases du train fantôme : ce que la réponse donnée aurait produit.
 * `jalon` est la gare visée par l'énoncé (le point de rencontre attendu).
 */
export function phraseFantome(famille, valeur, croixF, jalon) {
  if (!croixF || croixF.type === 'aucun') {
    return famille === 'vitesse-a-trouver'
      ? `À ${Math.round(valeur)} km/h, le train fantôme ne rejoint jamais le premier sur l'axe.`
      : `Parti à ${enHeure(valeur)}, le train fantôme ne croise pas le premier sur l'axe.`;
  }
  const ecart = croixF.pk - jalon.pk;
  const ou = Math.abs(ecart) < 1.5 ? `exactement à ${jalon.nom}`
    : `à ${Math.round(Math.abs(ecart))} km ${ecart < 0 ? 'avant' : 'après'} ${jalon.nom}, en venant de Paris`;
  return famille === 'vitesse-a-trouver'
    ? `Le train fantôme roule à votre vitesse, ${Math.round(valeur)} km/h : il rejoint le premier à ${enHeure(croixF.t)}, ${ou}.`
    : `Le train fantôme part à votre heure, ${enHeure(valeur)} : il croise le premier à ${enHeure(croixF.t)}, ${ou}.`;
}
