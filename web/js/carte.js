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
      const d = vus.map((s, i) => `${i ? 'L' : 'M'}${proj(s.coord.lon, s.coord.lat).map((v) => v.toFixed(1)).join(' ')}`).join('');
      circuitTrace = `<path d="${d}" class="map-circuit" style="stroke:${circuit.couleur}"/>`;
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
    let g = `<g class="map-station${on ? ' is-on' : ''}" data-station="${esc(s.id)}" data-cx="${x.toFixed(1)}" data-cy="${y.toFixed(1)}" tabindex="0" role="button" aria-label="${esc(s.nom)}">`;
    if (on) g += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r + 9}" fill="${color}" opacity="0.18"/>`;
    g += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}" fill="${color}" class="map-pin"/>`;
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

  // Le contenu est rogné au cadre : les voies ferrées et les bois débordent
  // largement de la fenêtre, et le zoom fait sortir le reste.
  const svg = `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" class="paris-map" role="img" aria-label="Carte des gares de Paris">
    <defs><clipPath id="${cid}"><rect width="${w}" height="${h}"/></clipPath></defs>
    <rect width="${w}" height="${h}" class="map-bg"/>
    <g clip-path="url(#${cid})"><g class="map-zoom">${fond}${circuitTrace}${reperes}${marques}</g></g>
  </svg>`;

  if (opts.statique) return svg;

  return `<figure class="map-frame" data-map style="--mz:1">
    ${svg}
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
      if (!aDeplace && gare && onGare) onGare(gare);
    };
    svg.addEventListener('pointerup', relacher);
    svg.addEventListener('pointercancel', relacher);

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

/** Vrai si la carte vient d'être déplacée : on n'ouvre alors pas de fiche. */
export function vientDeGlisser(el) {
  const frame = el.closest('[data-map]');
  return !!(frame && frame._carte && frame._carte.blocageClic);
}
