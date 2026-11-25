// Carte de Paris dessinée à partir de géométrie réelle embarquée : limites des
// vingt arrondissements (Paris Open Data), Seine, canaux et réseau ferré
// (OpenStreetMap). Aucune tuile distante : la carte fonctionne hors connexion.

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function makeProjection(geo, w, h, pad = 14) {
  const { minLon, maxLon, minLat, maxLat } = geo.bounds;
  // Correction de la convergence des méridiens à la latitude de Paris.
  const kx = Math.cos(((minLat + maxLat) / 2) * Math.PI / 180);
  const spanX = (maxLon - minLon) * kx;
  const spanY = maxLat - minLat;
  const scale = Math.min((w - pad * 2) / spanX, (h - pad * 2) / spanY);
  const offX = (w - spanX * scale) / 2;
  const offY = (h - spanY * scale) / 2;
  return (lon, lat) => [
    offX + (lon - minLon) * kx * scale,
    h - offY - (lat - minLat) * scale,
  ];
}

const trace = (pts, proj, fermer) => {
  let d = '';
  for (let i = 0; i < pts.length; i++) {
    const [x, y] = proj(pts[i][0], pts[i][1]);
    d += `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
  }
  return d + (fermer ? 'Z' : '');
};

let compteurCarte = 0;
// Le dernier corpus dessiné : la bulle de survol y puise l'illustration.
let corpusCartes = null;

const capDeg = (a, b) => {
  const r = Math.PI / 180;
  const y = Math.sin((b.lon - a.lon) * r) * Math.cos(b.lat * r);
  const x = Math.cos(a.lat * r) * Math.sin(b.lat * r) - Math.sin(a.lat * r) * Math.cos(b.lat * r) * Math.cos((b.lon - a.lon) * r);
  return (Math.atan2(y, x) / r + 360) % 360;
};

export function parisMap(corpus, opts = {}) {
  const cid = 'mc' + (++compteurCarte);
  const w = opts.width || 900;
  const h = opts.height || 640;
  const geo = corpus.geo;
  const proj = makeProjection(geo, w, h);
  const highlight = opts.highlight || null;
  const circuit = opts.circuit || null;
  const showLabels = opts.labels !== false;
  // Les vignettes se passent du réseau ferré : trop dense à cette taille,
  // et coûteux à produire quatre fois sur la page des circuits.
  const complet = opts.detail !== 'simple';
  const atlas = !!opts.atlas;
  if (!opts.statique) corpusCartes = corpus;

  let fond = '';

  // Arrondissements : leur réunion dessine Paris, leurs limites internes
  // donnent à la carte sa lisibilité de plan.
  for (const a of geo.arrondissements) {
    fond += `<path d="${trace(a.contour, proj, true)}" class="map-arr"/>`;
  }

  let eau = '';
  for (const p of geo.seine) eau += trace(p, proj);
  fond += `<path d="${eau}" class="map-seine"/>`;
  let canaux = '';
  for (const c of geo.canaux) canaux += trace(c, proj);
  fond += `<path d="${canaux}" class="map-canal"/>`;

  if (complet) {
    let rails = '';
    for (const v of geo.voiesFerrees) rails += trace(v, proj);
    fond += `<path d="${rails}" class="map-rail"/>`;
  }
  let pc = '';
  for (const v of geo.petiteCeinture) pc += trace(v, proj);
  fond += `<path d="${pc}" class="map-ceinture"/>`;

  // Numéros d'arrondissement, posés au barycentre des sommets du contour.
  if (atlas) {
    let nums = '';
    for (const a of geo.arrondissements) {
      let sx = 0, sy = 0;
      for (const [lon, lat] of a.contour) { const [x, y] = proj(lon, lat); sx += x; sy += y; }
      const n = a.contour.length;
      nums += `<text x="${(sx / n).toFixed(1)}" y="${(sy / n + 6).toFixed(1)}" text-anchor="middle">${a.n === 1 ? '1er' : a.n + 'e'}</text>`;
    }
    fond += `<g class="map-arr-num">${nums}</g>`;
  }

  // --- Libellés : droite, gauche, dessus, dessous, puis abandon ------------
  const poses = [];
  const libre = (r) => !poses.some((q) => !(r.x2 < q.x1 || r.x1 > q.x2 || r.y2 < q.y1 || r.y1 > q.y2));

  function placer(texte, cx, cy, rayon, taille) {
    const lp = texte.length * taille * 0.54;
    const hp = taille * 1.25;
    const marge = rayon + 6;
    const candidats = [
      { anchor: 'start', x: cx + marge, y: cy + taille * 0.34 },
      { anchor: 'end', x: cx - marge, y: cy + taille * 0.34 },
      { anchor: 'middle', x: cx, y: cy - marge },
      { anchor: 'middle', x: cx, y: cy + marge + taille * 0.8 },
    ];
    for (const c of candidats) {
      const x1 = c.anchor === 'start' ? c.x : c.anchor === 'end' ? c.x - lp : c.x - lp / 2;
      const boite = { x1, x2: x1 + lp, y1: c.y - hp * 0.82, y2: c.y + hp * 0.28 };
      if (libre(boite)) { poses.push(boite); return c; }
    }
    return null;
  }

  for (const s of corpus.stations) {
    const [x, y] = proj(s.coord.lon, s.coord.lat);
    const r = (highlight === s.id ? 11 : s.categorie === 'grande-gare' ? 7.5 : 5.5) + 2;
    poses.push({ x1: x - r, x2: x + r, y1: y - r, y2: y + r });
  }

  let circuitTrace = '';
  if (circuit) {
    const vus = [];
    for (const e of circuit.etapes) {
      const st = corpus.stations.find((s) => s.id === e.stationId);
      if (st && vus[vus.length - 1] !== st) vus.push(st);
    }
    if (vus.length > 1) {
      const pts = vus.map((s) => proj(s.coord.lon, s.coord.lat).map((v) => +v.toFixed(1)));
      const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0]} ${p[1]}`).join('');
      circuitTrace = `<path d="${d}" class="map-circuit" style="stroke:${circuit.couleur}"/>`;
      if (opts.lecture) {
        circuitTrace += `<path d="${d}" class="map-circuit-fait" style="stroke:${circuit.couleur}" data-pts="${pts.map((p) => p.join(',')).join(';')}" data-gares="${vus.map((s) => esc(s.id)).join(';')}"/>`;
      }
    }
  }

  // Les grandes gares sont servies en premier : ce sont elles qui doivent
  // porter un libellé si la place vient à manquer.
  const ordre = [...corpus.stations].sort((a, b) => {
    const rang = (s) => (highlight === s.id ? 0 : s.categorie === 'grande-gare' ? 1 : 2);
    return rang(a) - rang(b);
  });

  let marques = '';
  for (const s of ordre) {
    const [x, y] = proj(s.coord.lon, s.coord.lat);
    const on = highlight === s.id;
    const grande = s.categorie === 'grande-gare';
    const r = on ? 11 : grande ? 7.5 : 5.5;
    const color = (s.artwork && s.artwork.palette && s.artwork.palette.accent) || '#8A5A3B';
    const nom = s.nomCourt || s.nom;
    const disparue = s.fermeture !== undefined;
    let g = `<g class="map-station${on ? ' is-on' : ''}${disparue ? ' is-disparue' : ''}" data-station="${esc(s.id)}" `
      + `data-cx="${x.toFixed(1)}" data-cy="${y.toFixed(1)}" data-ouverture="${+s.ouverture || 0}"`
      + `${disparue ? ` data-fermeture="${s.fermeture}"` : ''} tabindex="0" role="button" aria-label="${esc(s.nom)}">`;
    if (on) g += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r + 9}" fill="${color}" opacity="0.18"/>`;
    if (atlas) g += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r + 7}" class="map-halo" style="stroke:${color}"/>`;
    g += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}" fill="${color}" class="map-pin"/>`;
    if (disparue) g += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r + 3.5}" class="map-pin-fantome" style="stroke:${color}"/>`;
    if (showLabels) {
      const taille = grande ? 12.5 : 11;
      const pose = placer(nom, x, y, r, taille);
      if (pose) {
        g += `<text x="${pose.x.toFixed(1)}" y="${pose.y.toFixed(1)}" text-anchor="${pose.anchor}" ` +
          `class="map-label${grande ? ' is-major' : ''}">${esc(nom)}</text>`;
      }
    }
    marques += g + `</g>`;
  }

  let reperes = '';
  for (const rp of geo.reperes || []) {
    const [x, y] = proj(rp.lon, rp.lat);
    const pose = showLabels ? placer(rp.nom, x, y, 3, 10) : null;
    reperes += `<g class="map-repere-g" data-cx="${x.toFixed(1)}" data-cy="${y.toFixed(1)}">`;
    reperes += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.6" class="map-repere"/>`;
    if (pose) {
      reperes += `<text x="${pose.x.toFixed(1)}" y="${pose.y.toFixed(1)}" text-anchor="${pose.anchor}" class="map-repere-label">${esc(rp.nom)}</text>`;
    }
    reperes += `</g>`;
  }

  // Les sept directions : de chaque terminus, une flèche vers les villes qu'il
  // dessert, dans leur direction vraie (le cap géographique, que la
  // projection conserve à cette échelle).
  let directions = '';
  if (atlas && corpus.directions) {
    for (const dg of corpus.directions.gares) {
      const st = corpus.stations.find((x) => x.id === dg.gareId);
      if (!st) continue;
      const [x, y] = proj(st.coord.lon, st.coord.lat);
      const color = st.artwork?.palette?.accent || '#8A5A3B';
      // Cap moyen des destinations, par moyenne des vecteurs unitaires.
      let vx = 0, vy = 0;
      for (const v of dg.vers) { const c = capDeg(st.coord, v) * Math.PI / 180; vx += Math.sin(c); vy += Math.cos(c); }
      const c = Math.atan2(vx, vy);
      const lg = Math.min(w, h) * 0.2;
      const x2 = x + Math.sin(c) * lg, y2 = y - Math.cos(c) * lg;
      const pointe = (a) => [x2 - Math.sin(c + a) * 11, y2 + Math.cos(c + a) * 11];
      const [p1, p2] = [pointe(0.45), pointe(-0.45)];
      const ancre = Math.sin(c) > 0.3 ? 'start' : Math.sin(c) < -0.3 ? 'end' : 'middle';
      const tx = x2 + Math.sin(c) * 8, ty = y2 - Math.cos(c) * 8 + (Math.cos(c) < -0.3 ? 12 : Math.cos(c) > 0.3 ? -4 : 4);
      directions += `<g class="map-direction" style="--c:${color}">`
        + `<line x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"/>`
        + `<path d="M${x2.toFixed(1)} ${y2.toFixed(1)}L${p1[0].toFixed(1)} ${p1[1].toFixed(1)}L${p2[0].toFixed(1)} ${p2[1].toFixed(1)}Z"/>`
        + `<text x="${tx.toFixed(1)}" y="${ty.toFixed(1)}" text-anchor="${ancre}">${esc(dg.vers.map((v) => v.ville).join(' · '))}</text></g>`;
    }
    directions = `<g class="map-directions">${directions}</g>`;
  }

  // Le contenu est rogné au cadre : les voies ferrées et les bois débordent
  // largement de la fenêtre, et le zoom fait sortir le reste.
  const svg = `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" class="paris-map" role="img" aria-label="Carte des gares de Paris">
    <defs><clipPath id="${cid}"><rect width="${w}" height="${h}"/></clipPath></defs>
    <rect width="${w}" height="${h}" class="map-bg"/>
    <g clip-path="url(#${cid})"><g class="map-zoom">${fond}${directions}${circuitTrace}${reperes}${marques}`
    + `${opts.lecture ? '<circle r="7" class="map-mobile" style="display:none"/>' : ''}</g></g>
  </svg>`;

  if (opts.statique) return svg;

  return `<figure class="map-frame${atlas ? ' is-atlas' : ''}" data-map${atlas ? '="atlas"' : ''} style="--mz:1">
    ${svg}
    <div class="map-bulle" hidden></div>
    ${atlas ? '<div class="map-annee" aria-hidden="true"></div>' : ''}
    ${opts.lecture ? '<button type="button" class="map-lecture" data-lecture>▶ Suivre le circuit</button>' : ''}
    <div class="map-tools" role="group" aria-label="Zoom de la carte">
      <button type="button" data-zoom="out" aria-label="Dézoomer">−</button>
      <button type="button" data-zoom="in" aria-label="Zoomer">+</button>
      <button type="button" data-zoom="reset" aria-label="Revenir au cadrage initial">⤾</button>
    </div>
    <figcaption class="map-hint">Molette ou pincement pour zoomer · glisser pour déplacer · cliquer une gare pour sa fiche</figcaption>
  </figure>`;
}

// --- Zoom et déplacement ---------------------------------------------------

const MIN = 1, MAX = 8;

function appliquer(frame) {
  const etat = frame._carte;
  const g = frame.querySelector('.map-zoom');
  g.setAttribute('transform', `translate(${etat.tx} ${etat.ty}) scale(${etat.k})`);
  frame.style.setProperty('--mz', etat.k);
  // Pastilles et libellés gardent leur taille à l'écran : on annule le zoom
  // sur chaque marqueur, autour de son propre point d'ancrage.
  const inv = 1 / etat.k;
  for (const el of frame.querySelectorAll('.map-station, .map-repere-g')) {
    const cx = +el.dataset.cx, cy = +el.dataset.cy;
    el.setAttribute('transform', `translate(${(cx * (1 - inv)).toFixed(2)} ${(cy * (1 - inv)).toFixed(2)}) scale(${inv.toFixed(4)})`);
  }
  frame.classList.toggle('is-zoome', etat.k > 1.001);
}

function zoomer(frame, facteur, px, py) {
  const e = frame._carte;
  const k = Math.min(MAX, Math.max(MIN, e.k * facteur));
  if (k === e.k) return;
  // Le point visé reste sous le curseur.
  e.tx = px - (px - e.tx) * (k / e.k);
  e.ty = py - (py - e.ty) * (k / e.k);
  e.k = k;
  contenir(frame);
  appliquer(frame);
}

/** Empêche de faire sortir la carte du cadre. */
function contenir(frame) {
  const e = frame._carte;
  const { w, h } = e;
  const marge = 0;
  e.tx = Math.min(marge, Math.max(w - w * e.k - marge, e.tx));
  e.ty = Math.min(marge, Math.max(h - h * e.k - marge, e.ty));
}

function pointSvg(svg, clientX, clientY) {
  const r = svg.getBoundingClientRect();
  const vb = svg.viewBox.baseVal;
  return [
    (clientX - r.left) / r.width * vb.width,
    (clientY - r.top) / r.height * vb.height,
  ];
}

/// Seuil de déplacement, en pixels d'écran. En deçà, le geste est un clic.
/// Il était auparavant exprimé en unités du viewBox — soit une fraction de
/// pixel : le moindre tremblement de la souris annulait la sélection.
const SEUIL_GLISSE = 4;

/**
 * Arme le zoom, le déplacement et la sélection sur toutes les cartes.
 * `onGare` reçoit l'identifiant de la gare touchée ; la sélection est décidée
 * au relâchement, et non par l'événement `click`, dont la cible peut être
 * détournée par la capture du pointeur.
 */
export function initCartes(racine = document, onGare = null) {
  for (const frame of racine.querySelectorAll('[data-map]')) {
    if (frame._carte) continue;
    const svg = frame.querySelector('svg');
    const vb = svg.viewBox.baseVal;
    frame._carte = {
      k: 1, tx: 0, ty: 0, w: vb.width, h: vb.height,
      pointeurs: new Map(), ecart: 0,
      depart: null, gare: null, deplace: false, blocageClic: false,
    };

    svg.addEventListener('wheel', (ev) => {
      ev.preventDefault();
      const [px, py] = pointSvg(svg, ev.clientX, ev.clientY);
      zoomer(frame, Math.exp(-ev.deltaY * 0.0015), px, py);
    }, { passive: false });

    svg.addEventListener('pointerdown', (ev) => {
      const e = frame._carte;
      const pastille = ev.target.closest && ev.target.closest('.map-station');
      e.gare = pastille ? pastille.dataset.station : null;
      e.depart = { x: ev.clientX, y: ev.clientY };
      e.pointeurs.set(ev.pointerId, pointSvg(svg, ev.clientX, ev.clientY));
      if (e.pointeurs.size === 2) {
        const [a, b] = [...e.pointeurs.values()];
        e.ecart = Math.hypot(a[0] - b[0], a[1] - b[1]);
        e.deplace = true;                       // un pincement n'est pas un clic
      } else if (e.pointeurs.size === 1) {
        e.deplace = false;
      }
    });

    svg.addEventListener('pointermove', (ev) => {
      const e = frame._carte;
      if (!e.pointeurs.has(ev.pointerId)) return;
      const avant = e.pointeurs.get(ev.pointerId);
      const apres = pointSvg(svg, ev.clientX, ev.clientY);

      if (e.pointeurs.size === 2) {
        e.pointeurs.set(ev.pointerId, apres);
        const [a, b] = [...e.pointeurs.values()];
        const ecart = Math.hypot(a[0] - b[0], a[1] - b[1]);
        if (e.ecart > 0) zoomer(frame, ecart / e.ecart, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
        e.ecart = ecart;
        return;
      }

      // Zone morte : tant que le seuil n'est pas franchi, on suit le pointeur
      // sans déplacer la carte, pour ne pas transformer un clic en glissement.
      if (!e.deplace) {
        const d = e.depart ? Math.hypot(ev.clientX - e.depart.x, ev.clientY - e.depart.y) : 0;
        e.pointeurs.set(ev.pointerId, apres);
        if (d < SEUIL_GLISSE) return;
        e.deplace = true;
        try { svg.setPointerCapture(ev.pointerId); } catch { /* capture refusée */ }
        return;
      }

      e.pointeurs.set(ev.pointerId, apres);
      e.tx += apres[0] - avant[0];
      e.ty += apres[1] - avant[1];
      contenir(frame);
      appliquer(frame);
    });

    const relacher = (ev) => {
      const e = frame._carte;
      const gare = e.gare;
      const aDeplace = e.deplace;
      e.pointeurs.delete(ev.pointerId);
      if (e.pointeurs.size < 2) e.ecart = 0;
      if (e.pointeurs.size > 0) return;

      e.depart = null;
      e.gare = null;
      e.deplace = false;
      // Le `click` qui suit un vrai déplacement doit être ignoré ; celui qui
      // suit un simple appui ne fera que redemander la même adresse.
      e.blocageClic = aDeplace;
      if (aDeplace) setTimeout(() => { e.blocageClic = false; }, 350);
      if (!aDeplace && gare && onGare) onGare(gare, frame);
    };
    svg.addEventListener('pointerup', relacher);
    svg.addEventListener('pointercancel', relacher);

    // Bulle de survol, à la souris seulement : au doigt, l'appui ouvre déjà la fiche.
    const bulle = frame.querySelector('.map-bulle');
    if (bulle) {
      svg.addEventListener('pointerover', (ev) => {
        if (ev.pointerType !== 'mouse' || frame._carte.deplace) return;
        const pin = ev.target.closest && ev.target.closest('.map-station');
        if (!pin || bulle.dataset.pour === pin.dataset.station) return;
        montrerBulle(frame, bulle, pin);
      });
      svg.addEventListener('pointerout', (ev) => {
        const pin = ev.target.closest && ev.target.closest('.map-station');
        if (pin && !(ev.relatedTarget && pin.contains(ev.relatedTarget))) { bulle.hidden = true; bulle.dataset.pour = ''; }
      });
      svg.addEventListener('pointerdown', () => { bulle.hidden = true; bulle.dataset.pour = ''; });
    }

    frame.querySelector('.map-tools').addEventListener('click', (ev) => {
      const b = ev.target.closest('button[data-zoom]');
      if (!b) return;
      const e = frame._carte;
      if (b.dataset.zoom === 'reset') {
        e.k = 1; e.tx = 0; e.ty = 0; appliquer(frame);
      } else {
        zoomer(frame, b.dataset.zoom === 'in' ? 1.5 : 1 / 1.5, e.w / 2, e.h / 2);
      }
    });
  }
}

function montrerBulle(frame, bulle, pin) {
  const s = corpusCartes?.stations.find((x) => x.id === pin.dataset.station);
  if (!s) return;
  const art = s.artwork?.palette?.accent || 'var(--accent)';
  const an = s.fermeture ? `${s.ouverture} – ${s.fermeture}` : `depuis ${s.ouverture}`;
  bulle.innerHTML = `<div class="bulle-art">${artBulle(s)}</div>
    <div class="bulle-corps" style="--c:${art}"><em>${esc(s.surnom || '')}</em><b>${esc(s.nomCourt || s.nom)}</b>
    <span>${esc(an)}${s.fermeture ? ' · gare disparue' : ''}</span></div>`;
  bulle.dataset.pour = s.id;
  bulle.hidden = false;
  const r = pin.getBoundingClientRect(), f = frame.getBoundingClientRect();
  const bw = bulle.offsetWidth, bh = bulle.offsetHeight;
  let x = r.left - f.left + r.width / 2 - bw / 2;
  let y = r.top - f.top - bh - 12;
  if (y < 4) y = r.bottom - f.top + 12;
  bulle.style.left = Math.max(4, Math.min(f.width - bw - 4, x)) + 'px';
  bulle.style.top = y + 'px';
}

// L'illustration de la bulle est empruntée à la page : artwork.js n'est pas
// importé ici, pour que la carte reste utilisable seule.
let artBulle = () => '';
export function fournirIllustration(fn) { artBulle = fn; }

/** Vrai si la carte vient d'être déplacée : on n'ouvre alors pas de fiche. */
export function vientDeGlisser(el) {
  const frame = el.closest('[data-map]');
  return !!(frame && frame._carte && frame._carte.blocageClic);
}

// --- Remonter le temps -------------------------------------------------------
//
// Une frise de 1837 à aujourd'hui : chaque gare s'allume l'année de son
// ouverture et pâlit l'année de sa fermeture ; la Petite Ceinture paraît en
// 1852 et perd ses voyageurs en 1934. Les dates viennent des chronologies des
// fiches, elles-mêmes affichées au passage. Le réseau dessiné reste celui
// d'aujourd'hui : on le dit sous la frise.

export const ANNEE_DEBUT = 1837, ANNEE_FIN = 2026;

/** Tous les événements datés des fiches, dans l'ordre chronologique. */
export function evenementsDates(corpus) {
  const liste = [];
  for (const s of corpus.stations) {
    for (const e of s.chronologie || []) {
      const m = /^(\d{4})/.exec(e.annee);
      if (m) liste.push({ annee: +m[1], libelle: e.annee, gare: s, titre: e.titre || '', texte: e.texte || '' });
    }
  }
  return liste.sort((a, b) => a.annee - b.annee || a.gare.ordre - b.gare.ordre);
}

export function frise() {
  const grad = [1850, 1900, 1950, 2000].map((a) =>
    `<span style="left:${((a - ANNEE_DEBUT) / (ANNEE_FIN - ANNEE_DEBUT) * 100).toFixed(2)}%">${a}</span>`).join('');
  return `<div class="temps" data-temps>
    <button type="button" class="temps-jouer" data-temps-jouer aria-label="Remonter le temps">▶</button>
    <div class="temps-piste">
      <input type="range" min="${ANNEE_DEBUT}" max="${ANNEE_FIN}" step="1" value="${ANNEE_FIN}" data-temps-annee aria-label="Année">
      <div class="temps-graduations">${grad}</div>
    </div>
    <output class="temps-annee">aujourd'hui</output>
    <p class="temps-evenement" aria-live="polite">Appuyez sur ▶ : les gares s'allument l'année de leur ouverture,
    et pâlissent quand elles ferment. Le réseau dessiné reste celui d'aujourd'hui.</p>
  </div>`;
}

export function armerTemps(racine, corpus) {
  const bloc = racine.querySelector('[data-temps]');
  const frame = racine.querySelector('[data-map="atlas"]');
  if (!bloc || !frame || bloc._arme) return;
  bloc._arme = true;
  const evts = evenementsDates(corpus);
  const range = bloc.querySelector('[data-temps-annee]');
  const sortie = bloc.querySelector('.temps-annee');
  const texte = bloc.querySelector('.temps-evenement');
  const bouton = bloc.querySelector('[data-temps-jouer]');
  const grande = frame.querySelector('.map-annee');
  const ceinture = frame.querySelector('.map-ceinture');
  let minuterie = 0, joue = false;

  function appliquer(annee, annoncer) {
    const present = annee >= ANNEE_FIN;
    frame.classList.toggle('en-histoire', !present);
    for (const pin of frame.querySelectorAll('.map-station')) {
      const ouv = +pin.dataset.ouverture, ferm = pin.dataset.fermeture ? +pin.dataset.fermeture : Infinity;
      pin.classList.toggle('is-futur', !present && ouv > annee);
      pin.classList.toggle('is-fermee', !present && annee >= ferm);
    }
    if (ceinture) {
      ceinture.classList.toggle('is-futur', !present && annee < 1852);
      ceinture.classList.toggle('is-fermee', !present && annee >= 1934);
    }
    if (grande) grande.textContent = present ? '' : String(annee);
    sortie.textContent = present ? "aujourd'hui" : String(annee);
    range.value = String(annee);
    if (!annoncer) return 0;
    const ici = evts.filter((e) => e.annee === annee);
    if (!ici.length) return 0;
    texte.innerHTML = ici.slice(0, 3).map((e) => `<span><b>${esc(e.libelle)} — ${esc(e.gare.nomCourt || e.gare.nom)}</b> `
      + `${esc(e.titre ? e.titre + '. ' : '')}${esc(e.texte)}</span>`).join('');
    for (const e of ici) {
      const pin = frame.querySelector(`.map-station[data-station="${e.gare.id}"]`);
      if (pin) { pin.classList.remove('pulse'); void pin.getBoundingClientRect(); pin.classList.add('pulse'); }
    }
    return ici.length;
  }

  function arreter() { joue = false; clearTimeout(minuterie); bouton.textContent = '▶'; bouton.setAttribute('aria-label', 'Remonter le temps'); }
  function pas() {
    if (!joue || !frame.isConnected) return arreter();
    const a = +range.value + 1;
    if (a > ANNEE_FIN) return arreter();
    const n = appliquer(a, true);
    minuterie = setTimeout(pas, n ? 1500 + n * 250 : 110);
  }
  bouton.addEventListener('click', () => {
    if (joue) return arreter();
    joue = true;
    bouton.textContent = '❚❚'; bouton.setAttribute('aria-label', 'Pause');
    if (+range.value >= ANNEE_FIN) appliquer(ANNEE_DEBUT - 1, false);
    pas();
  });
  range.addEventListener('input', () => { arreter(); appliquer(+range.value, true); });
}

// --- Lecture d'un circuit ----------------------------------------------------
//
// Un jeton parcourt l'itinéraire gare après gare ; le tracé se remplit derrière
// lui, et l'étape correspondante s'éclaire dans la liste.

export function armerLecture(racine) {
  for (const frame of racine.querySelectorAll('[data-map]')) {
    const bouton = frame.querySelector('[data-lecture]');
    const fait = frame.querySelector('.map-circuit-fait');
    const jeton = frame.querySelector('.map-mobile');
    if (!bouton || !fait || !jeton || bouton._arme) continue;
    bouton._arme = true;
    const pts = fait.dataset.pts.split(';').map((p) => p.split(',').map(Number));
    const gares = fait.dataset.gares.split(';');
    const total = fait.getTotalLength ? fait.getTotalLength() : 0;
    const cumul = [0];
    for (let i = 1; i < pts.length; i++) cumul.push(cumul[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const longueur = cumul[cumul.length - 1] || 1;
    const legende = frame.querySelector('.map-hint');
    let joue = false, raf = 0, segment = 0, debut = 0, attente = 0, fini = false;
    fait.style.strokeDasharray = `${total || longueur} ${total || longueur}`;
    fait.style.strokeDashoffset = String(total || longueur);

    const etapes = () => [...document.querySelectorAll('.step[data-station]')];
    function arriver(i) {
      for (const p of frame.querySelectorAll('.map-station.is-ici')) p.classList.remove('is-ici');
      frame.querySelector(`.map-station[data-station="${gares[i]}"]`)?.classList.add('is-ici');
      const toutes = etapes();
      for (const e of toutes) e.classList.remove('is-ici');
      const ici = toutes.filter((e) => e.dataset.station === gares[i]);
      ici.forEach((e) => e.classList.add('is-ici'));
      if (legende && ici[0]) legende.textContent = `Étape ${ici[0].dataset.ordre} · ${ici[0].querySelector('h4')?.textContent || ''}`;
    }
    function placer(dist) {
      let i = 0;
      while (i < pts.length - 2 && cumul[i + 1] < dist) i++;
      const a = pts[i], b = pts[i + 1] || a;
      const t = cumul[i + 1] > cumul[i] ? (dist - cumul[i]) / (cumul[i + 1] - cumul[i]) : 0;
      jeton.setAttribute('cx', (a[0] + (b[0] - a[0]) * t).toFixed(1));
      jeton.setAttribute('cy', (a[1] + (b[1] - a[1]) * t).toFixed(1));
      jeton.setAttribute('r', (7 / (frame._carte?.k || 1)).toFixed(2));
      fait.style.strokeDashoffset = String((total || longueur) * (1 - dist / longueur));
    }
    function image(ts) {
      if (!frame.isConnected) return;
      if (!joue) return;
      if (ts < attente) { raf = requestAnimationFrame(image); return; }
      const lgSeg = cumul[segment + 1] - cumul[segment];
      const duree = Math.max(900, lgSeg * 9);
      if (!debut) debut = ts;
      const p = Math.min(1, (ts - debut) / duree);
      const e = p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2;
      placer(cumul[segment] + lgSeg * e);
      if (p >= 1) {
        segment++;
        debut = 0;
        arriver(segment);
        if (segment >= pts.length - 1) {
          joue = false; fini = true;
          bouton.textContent = '↺ Rejouer le circuit';
          return;
        }
        attente = ts + 1000;
      }
      raf = requestAnimationFrame(image);
    }
    bouton.addEventListener('click', () => {
      if (joue) { joue = false; cancelAnimationFrame(raf); bouton.textContent = '▶ Reprendre'; return; }
      if (fini || segment === 0 && !debut) {
        fini = false; segment = 0; debut = 0; attente = 0;
        jeton.style.display = '';
        placer(0); arriver(0);
      }
      joue = true;
      bouton.textContent = '❚❚ Pause';
      raf = requestAnimationFrame(image);
    });
  }
}
