// Illustrations vectorielles des gares, dessinées à partir de la fiche « artwork »
// de chaque gare. Aucune image externe : tout est généré.

const AMBIANCES = {
  matin: { light: '#FFF3D6', glow: 0.55, haze: 0.14, astre: 'soleil', astreY: 0.34 },
  jour: { light: '#FFFFFF', glow: 0.32, haze: 0.08, astre: null, astreY: 0.2 },
  soir: { light: '#FFD9A0', glow: 0.7, haze: 0.2, astre: 'soleil', astreY: 0.52 },
  nuit: { light: '#FFE9A8', glow: 0.85, haze: 0.05, astre: 'lune', astreY: 0.24 },
};

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Petit générateur pseudo-aléatoire déterministe : la même gare donne toujours
// exactement le même dessin.
function seeded(seed) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  return () => { h += 0x6d2b79f5; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function skyline(rnd, w, ground, color) {
  let d = `M0 ${ground}`;
  let x = 0;
  while (x < w) {
    const bw = 24 + rnd() * 52;
    const bh = 26 + rnd() * 62;
    d += ` L${x.toFixed(1)} ${(ground - bh).toFixed(1)} L${(x + bw).toFixed(1)} ${(ground - bh).toFixed(1)}`;
    x += bw;
  }
  return `<path d="${d} L${w} ${ground} Z" fill="${color}" opacity="0.22"/>`;
}

function personne(x, ground, scale, color) {
  const s = scale;
  return `<g transform="translate(${x} ${ground}) scale(${s})" fill="${color}" opacity="0.5">` +
    `<circle cx="0" cy="-26" r="4.4"/>` +
    `<path d="M-4.6 -21 h9.2 l1.8 12 -3.4 0 -0.8 9 -4.4 0 -0.8 -9 -3.4 0 Z"/>` +
    `</g>`;
}

function horloge(cx, cy, r, face, hands) {
  return `<g><circle cx="${cx}" cy="${cy}" r="${r}" fill="${face}" stroke="${hands}" stroke-width="${r * 0.09}"/>` +
    `<circle cx="${cx}" cy="${cy}" r="${r * 0.06}" fill="${hands}"/>` +
    `<line x1="${cx}" y1="${cy}" x2="${cx + r * 0.44}" y2="${cy - r * 0.3}" stroke="${hands}" stroke-width="${r * 0.1}" stroke-linecap="round"/>` +
    `<line x1="${cx}" y1="${cy}" x2="${cx - r * 0.12}" y2="${cy - r * 0.62}" stroke="${hands}" stroke-width="${r * 0.08}" stroke-linecap="round"/></g>`;
}

function statue(x, y, scale, color) {
  return `<g transform="translate(${x} ${y}) scale(${scale})" fill="${color}" opacity="0.85">` +
    `<circle cx="0" cy="-19" r="3.6"/>` +
    `<path d="M-5 -15 q5 -3 10 0 l2.5 15 h-15 Z"/>` +
    `<rect x="-7" y="0" width="14" height="3.5" rx="1"/></g>`;
}

function drapeau(x, ground, h, color) {
  const y = ground - h;
  return `<g><line x1="${x}" y1="${ground}" x2="${x}" y2="${y}" stroke="${color}" stroke-width="2"/>` +
    `<path d="M${x} ${y} q11 -2 20 4 v9 q-9 6 -20 1 Z" fill="${color}" opacity="0.75"/></g>`;
}

function verriere(cx, groundY, span, rise, glass, frame, id) {
  // Une halle réelle repose sur des murs gouttereaux : on dessine le flanc,
  // puis la voûte au-dessus. Sans ce flanc, les naissances de l'arc forment
  // deux triangles clairs de part et d'autre de la façade.
  const flanc = rise * 0.22;
  const baseY = groundY - flanc;
  const fleche = rise - flanc;
  const x0 = cx - span / 2, x1 = cx + span / 2;
  const ctrl = baseY - fleche * 2;

  let ribs = '';
  const n = 9;
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const px = x0 + span * t;
    const py = baseY - fleche * Math.sin(Math.PI * t);
    ribs += `<line x1="${px.toFixed(1)}" y1="${baseY.toFixed(1)}" x2="${px.toFixed(1)}" y2="${py.toFixed(1)}" stroke="${frame}" stroke-width="1.6" opacity="0.45"/>`;
  }

  return `<g>` +
    `<rect x="${x0.toFixed(1)}" y="${baseY.toFixed(1)}" width="${span.toFixed(1)}" height="${(groundY - baseY).toFixed(1)}" fill="${frame}" opacity="0.42"/>` +
    `<path d="M${x0.toFixed(1)} ${baseY.toFixed(1)} Q${cx.toFixed(1)} ${ctrl.toFixed(1)} ${x1.toFixed(1)} ${baseY.toFixed(1)} Z" fill="url(#glass${id})"/>` +
    ribs +
    `<path d="M${x0.toFixed(1)} ${baseY.toFixed(1)} Q${cx.toFixed(1)} ${ctrl.toFixed(1)} ${x1.toFixed(1)} ${baseY.toFixed(1)}" fill="none" stroke="${frame}" stroke-width="3"/>` +
    `</g>`;
}

export function stationArtwork(station, opts = {}) {
  const art = station.artwork || {};
  const p = art.palette || {};
  const w = opts.width || 880;
  const h = opts.height || 440;
  const id = (station.id || 'x').replace(/[^a-z0-9]/gi, '');
  const amb = AMBIANCES[art.ambiance] || AMBIANCES.jour;
  const rnd = seeded(station.id || 'gare');
  const ground = h * 0.86;

  const stone = p.stone || '#DDD3C0';
  const stoneDark = p.stoneDark || '#B0A48C';
  const roof = p.roof || '#5C6B72';
  const glass = p.glass || '#A5C2CE';
  const accent = p.accent || '#8A5A3B';
  const sky0 = (p.sky && p.sky[0]) || '#AEBFCB';
  const sky1 = (p.sky && p.sky[1]) || '#EFE8DA';
  const nuit = art.ambiance === 'nuit';

  const bodyW = w * 0.7;
  const bx0 = (w - bodyW) / 2;
  const bx1 = bx0 + bodyW;
  const cx = w / 2;

  let out = '';

  // --- Ciel -------------------------------------------------------------
  out += `<defs>
    <linearGradient id="sky${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${sky0}"/><stop offset="100%" stop-color="${sky1}"/>
    </linearGradient>
    <linearGradient id="glass${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${glass}" stop-opacity="0.95"/>
      <stop offset="100%" stop-color="${amb.light}" stop-opacity="0.75"/>
    </linearGradient>
    <linearGradient id="stone${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${stone}"/><stop offset="100%" stop-color="${stoneDark}"/>
    </linearGradient>
    <radialGradient id="glow${id}" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0%" stop-color="${amb.light}" stop-opacity="${amb.glow}"/>
      <stop offset="100%" stop-color="${amb.light}" stop-opacity="0"/>
    </radialGradient>
  </defs>`;
  out += `<rect width="${w}" height="${h}" fill="url(#sky${id})"/>`;

  if (amb.astre) {
    const ax = w * 0.76, ay = h * amb.astreY;
    out += `<circle cx="${ax}" cy="${ay}" r="${h * 0.3}" fill="url(#glow${id})"/>`;
    out += amb.astre === 'lune'
      ? `<path d="M${ax + 13} ${ay - 17} a20 20 0 1 0 0 34 a16 16 0 1 1 0 -34 Z" fill="${amb.light}" opacity="0.9"/>`
      : `<circle cx="${ax}" cy="${ay}" r="19" fill="${amb.light}" opacity="0.9"/>`;
  }
  if (nuit) {
    for (let i = 0; i < 26; i++) {
      out += `<circle cx="${(rnd() * w).toFixed(0)}" cy="${(rnd() * h * 0.5).toFixed(0)}" r="${(rnd() * 1.2 + 0.4).toFixed(1)}" fill="#fff" opacity="${(0.2 + rnd() * 0.5).toFixed(2)}"/>`;
    }
  }

  out += skyline(rnd, w, ground - 4, stoneDark);

  const sil = art.silhouette || 'terminus';
  const facadeTop = h * (sil === 'shed' ? 0.56 : sil === 'modern' ? 0.58 : 0.34);

  // --- Halle vitrée en arrière-plan -------------------------------------
  // La flèche est calculée depuis le haut de la façade : la voûte doit toujours
  // dépasser, sinon la façade la masque entièrement.
  const shed = art.shed || {};
  if (shed.present && sil !== 'underground' && sil !== 'modern') {
    const rise = (ground - facadeTop) + h * (0.04 + (shed.rise || 0.3) * 0.24);
    out += verriere(cx, ground, w * (shed.span || 0.8), rise, glass, roof, id);
  }

  // Gares contemporaines : une dalle de toiture en léger porte-à-faux,
  // posée sur la façade — le geste architectural propre à ces bâtiments.
  if (shed.present && sil === 'modern') {
    const dalleL = w * 0.7 * 1.18;
    const mx = cx - dalleL / 2;
    const my = facadeTop - 15;
    out += `<rect x="${mx.toFixed(1)}" y="${my.toFixed(1)}" width="${dalleL.toFixed(1)}" height="15" rx="3" fill="${roof}"/>`;
    out += `<rect x="${mx.toFixed(1)}" y="${(my + 15).toFixed(1)}" width="${dalleL.toFixed(1)}" height="5" fill="${glass}" opacity="0.55"/>`;
  }

  // --- Corps du bâtiment ------------------------------------------------

  if (sil === 'underground') {
    // Gare enfouie : voûte, quai, rame, éclairage artificiel.
    out += `<rect x="0" y="${h * 0.1}" width="${w}" height="${h * 0.9}" fill="${roof}"/>`;
    out += `<path d="M${w * 0.06} ${ground} L${w * 0.06} ${h * 0.42} Q${cx} ${h * 0.08} ${w * 0.94} ${h * 0.42} L${w * 0.94} ${ground} Z" fill="${stoneDark}"/>`;
    out += `<path d="M${w * 0.1} ${ground} L${w * 0.1} ${h * 0.45} Q${cx} ${h * 0.16} ${w * 0.9} ${h * 0.45} L${w * 0.9} ${ground} Z" fill="${stone}" opacity="0.55"/>`;
    for (let i = 0; i < 7; i++) {
      const lx = w * 0.16 + i * (w * 0.68) / 6;
      out += `<ellipse cx="${lx.toFixed(0)}" cy="${(h * 0.3).toFixed(0)}" rx="26" ry="9" fill="${glass}" opacity="0.55"/>`;
      out += `<ellipse cx="${lx.toFixed(0)}" cy="${(h * 0.3).toFixed(0)}" rx="10" ry="4" fill="#fff" opacity="0.8"/>`;
    }
    out += `<rect x="0" y="${ground - 34}" width="${w}" height="34" fill="${stoneDark}" opacity="0.7"/>`;
    out += `<rect x="${w * 0.08}" y="${ground - 96}" width="${w * 0.56}" height="62" rx="8" fill="${accent}"/>`;
    out += `<rect x="${w * 0.08}" y="${ground - 84}" width="${w * 0.56}" height="26" fill="${glass}" opacity="0.85"/>`;
    out += `<rect x="${w * 0.64}" y="${ground - 96}" width="${w * 0.1}" height="62" rx="14" fill="${stone}" opacity="0.9"/>`;
    for (let i = 0; i < 4; i++) out += personne(w * 0.78 + i * 26, ground - 34, 1.05, '#1c1c22');
    out += `<rect x="0" y="${ground}" width="${w}" height="${h - ground}" fill="${roof}"/>`;
    return `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(station.nom)}" preserveAspectRatio="xMidYMid slice">${out}</svg>`;
  }

  if (sil === 'viaduct') {
    // Viaduc : arcade de briques, végétation sur la plateforme.
    const arches = art.bays || 8;
    const aW = w / arches;
    const topY = h * 0.44;
    out += `<rect x="0" y="${topY}" width="${w}" height="${ground - topY}" fill="url(#stone${id})"/>`;
    for (let i = 0; i < arches; i++) {
      const x = i * aW + aW * 0.16;
      const aw = aW * 0.68;
      out += `<path d="M${x} ${ground} L${x} ${topY + aw * 0.62} a${aw / 2} ${aw / 2} 0 0 1 ${aw} 0 L${x + aw} ${ground} Z" fill="${roof}" opacity="0.55"/>`;
      out += `<path d="M${x + aw * 0.12} ${ground} L${x + aw * 0.12} ${topY + aw * 0.66} a${aw * 0.38} ${aw * 0.38} 0 0 1 ${aw * 0.76} 0 L${x + aw * 0.88} ${ground} Z" fill="${glass}" opacity="0.6"/>`;
    }
    out += `<rect x="0" y="${topY - 12}" width="${w}" height="14" fill="${stoneDark}"/>`;
    for (let i = 0; i < 34; i++) {
      const x = rnd() * w, r = 8 + rnd() * 20;
      out += `<circle cx="${x.toFixed(0)}" cy="${(topY - 16 - rnd() * 18).toFixed(0)}" r="${r.toFixed(0)}" fill="${accent}" opacity="${(0.25 + rnd() * 0.4).toFixed(2)}"/>`;
    }
    for (let i = 0; i < 3; i++) out += personne(w * 0.2 + i * w * 0.28, topY - 14, 0.9, '#1c1c22');
    out += `<rect x="0" y="${ground}" width="${w}" height="${h - ground}" fill="${stoneDark}" opacity="0.55"/>`;
    return `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(station.nom)}" preserveAspectRatio="xMidYMid slice">${out}</svg>`;
  }

  // Tour d'immeuble (Montparnasse) posée avant la façade.
  const tower = art.tower || {};
  if (tower.present && sil === 'slab') {
    const tw = w * 0.14;
    const tx = tower.side === 'left' ? bx0 - tw * 1.15 : bx1 + tw * 0.15;
    const ty = h * 0.06;
    out += `<rect x="${tx}" y="${ty}" width="${tw}" height="${ground - ty}" rx="3" fill="${roof}"/>`;
    for (let r = 0; r < 22; r++) {
      out += `<rect x="${tx + 5}" y="${ty + 12 + r * ((ground - ty - 18) / 22)}" width="${tw - 10}" height="5" fill="${glass}" opacity="${nuit ? 0.75 : 0.35}"/>`;
    }
  }

  // Bloc principal
  out += `<rect x="${bx0}" y="${facadeTop}" width="${bodyW}" height="${ground - facadeTop}" fill="url(#stone${id})"/>`;
  out += `<rect x="${bx0}" y="${facadeTop}" width="${bodyW}" height="10" fill="${stoneDark}"/>`;

  // Travées : arcades ou baies vitrées
  const bays = Math.max(2, art.bays || 5);
  const inner = bodyW * 0.86;
  const gap = inner / bays;
  const bw = gap * 0.72;
  const bayTop = facadeTop + (ground - facadeTop) * (sil === 'modern' ? 0.2 : 0.3);
  for (let i = 0; i < bays; i++) {
    const x = bx0 + bodyW * 0.07 + i * gap + (gap - bw) / 2;
    if (sil === 'modern') {
      out += `<rect x="${x.toFixed(1)}" y="${bayTop.toFixed(1)}" width="${bw.toFixed(1)}" height="${(ground - bayTop).toFixed(1)}" fill="${glass}" opacity="${nuit ? 0.85 : 0.7}"/>`;
    } else {
      const bh = ground - bayTop;
      out += `<path d="M${x.toFixed(1)} ${ground} L${x.toFixed(1)} ${(bayTop + bw * 0.5).toFixed(1)} a${(bw / 2).toFixed(1)} ${(bw / 2).toFixed(1)} 0 0 1 ${bw.toFixed(1)} 0 L${(x + bw).toFixed(1)} ${ground} Z" fill="${glass}" opacity="${nuit ? 0.85 : 0.66}"/>`;
      out += `<path d="M${x.toFixed(1)} ${ground} L${x.toFixed(1)} ${(bayTop + bw * 0.5).toFixed(1)} a${(bw / 2).toFixed(1)} ${(bw / 2).toFixed(1)} 0 0 1 ${bw.toFixed(1)} 0 L${(x + bw).toFixed(1)} ${ground}" fill="none" stroke="${stoneDark}" stroke-width="2.4"/>`;
      out += `<line x1="${(x + bw / 2).toFixed(1)}" y1="${(bayTop + 4).toFixed(1)}" x2="${(x + bw / 2).toFixed(1)}" y2="${ground}" stroke="${stoneDark}" stroke-width="1.4" opacity="0.6"/>`;
      if (bh > 60) out += `<line x1="${x.toFixed(1)}" y1="${(ground - bh * 0.36).toFixed(1)}" x2="${(x + bw).toFixed(1)}" y2="${(ground - bh * 0.36).toFixed(1)}" stroke="${stoneDark}" stroke-width="1.4" opacity="0.6"/>`;
    }
  }

  // Fronton
  const ped = art.pediment || 'flat';
  if (ped === 'triangular') {
    out += `<path d="M${bx0 - 12} ${facadeTop} L${cx} ${facadeTop - h * 0.13} L${bx1 + 12} ${facadeTop} Z" fill="${stone}"/>`;
    out += `<path d="M${bx0 - 12} ${facadeTop} L${cx} ${facadeTop - h * 0.13} L${bx1 + 12} ${facadeTop}" fill="none" stroke="${stoneDark}" stroke-width="3"/>`;
  } else if (ped === 'rose') {
    const rw = bodyW * 0.46;
    out += `<path d="M${cx - rw / 2} ${facadeTop + 6} L${cx - rw / 2} ${facadeTop - h * 0.02} a${rw / 2} ${rw / 2} 0 0 1 ${rw} 0 L${cx + rw / 2} ${facadeTop + 6} Z" fill="${stone}"/>`;
    out += `<path d="M${cx - rw / 2} ${facadeTop + 6} L${cx - rw / 2} ${facadeTop - h * 0.02} a${rw / 2} ${rw / 2} 0 0 1 ${rw} 0 L${cx + rw / 2} ${facadeTop + 6} Z" fill="url(#glass${id})" opacity="0.9"/>`;
    for (let i = 0; i <= 8; i++) {
      const a = Math.PI + (Math.PI * i) / 8;
      out += `<line x1="${cx}" y1="${facadeTop - h * 0.02}" x2="${(cx + Math.cos(a) * rw / 2).toFixed(1)}" y2="${(facadeTop - h * 0.02 + Math.sin(a) * rw / 2).toFixed(1)}" stroke="${roof}" stroke-width="2" opacity="0.6"/>`;
    }
    out += `<path d="M${cx - rw / 2} ${facadeTop + 6} L${cx - rw / 2} ${facadeTop - h * 0.02} a${rw / 2} ${rw / 2} 0 0 1 ${rw} 0 L${cx + rw / 2} ${facadeTop + 6}" fill="none" stroke="${stoneDark}" stroke-width="3.5"/>`;
  } else {
    out += `<rect x="${bx0 - 10}" y="${facadeTop - 16}" width="${bodyW + 20}" height="18" fill="${stone}"/>`;
    out += `<rect x="${bx0 - 10}" y="${facadeTop - 16}" width="${bodyW + 20}" height="5" fill="${stoneDark}"/>`;
  }

  // Beffroi (gare de Lyon)
  if (tower.present && sil === 'belfry') {
    const tw = w * 0.11;
    const tx = tower.side === 'left' ? bx0 + bodyW * 0.04 : bx1 - tw - bodyW * 0.04;
    const ty = h * (1 - (tower.height || 0.9)) * 0.5;
    out += `<rect x="${tx}" y="${ty}" width="${tw}" height="${ground - ty}" fill="url(#stone${id})"/>`;
    out += `<rect x="${tx - 6}" y="${ty}" width="${tw + 12}" height="10" fill="${stoneDark}"/>`;
    out += `<path d="M${tx - 8} ${ty} L${tx + tw / 2} ${ty - h * 0.09} L${tx + tw + 8} ${ty} Z" fill="${roof}"/>`;
    out += horloge(tx + tw / 2, ty + tw * 0.62, tw * 0.34, amb.light, roof);
    for (let i = 1; i < 4; i++) {
      out += `<rect x="${tx + tw * 0.22}" y="${ty + tw * 1.1 + i * 28}" width="${tw * 0.56}" height="16" fill="${glass}" opacity="0.6"/>`;
    }
  } else if (art.clock) {
    const r = Math.min(bodyW * 0.055, 26);
    const cy = ped === 'triangular' ? facadeTop - h * 0.055 : facadeTop + (ped === 'rose' ? 0 : 34);
    if (ped !== 'rose') out += horloge(cx, cy, r, amb.light, roof);
  }

  // Statues sur la corniche
  const nStat = art.statues || 0;
  if (nStat > 0) {
    const shown = Math.min(nStat, 9);
    for (let i = 0; i < shown; i++) {
      const x = bx0 + bodyW * (0.1 + (0.8 * i) / Math.max(1, shown - 1));
      out += statue(x, facadeTop - (ped === 'flat' ? 16 : 2), 0.85, stoneDark);
    }
  }

  // Drapeaux
  for (let i = 0; i < (art.flags || 0); i++) {
    const x = bx0 + bodyW * (0.16 + i * 0.34);
    out += drapeau(x, facadeTop, h * 0.10, accent);
  }

  // Sol, marquise d'entrée, passants
  out += `<rect x="0" y="${ground}" width="${w}" height="${h - ground}" fill="${stoneDark}" opacity="0.5"/>`;
  out += `<rect x="${cx - bodyW * 0.16}" y="${ground - 46}" width="${bodyW * 0.32}" height="8" rx="3" fill="${roof}"/>`;
  const passants = [0.14, 0.24, 0.33, 0.68, 0.78, 0.88];
  passants.forEach((t, i) => { out += personne(w * t, ground + 12, 1.15 + (i % 2) * 0.16, '#1b1b20'); });

  return `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Illustration de ${esc(station.nom)}" preserveAspectRatio="xMidYMid slice">${out}</svg>`;
}

// Schéma du plan de voies, généré depuis station.plan.groupes
export function trackPlan(station) {
  const plan = station.plan;
  if (!plan || !plan.groupes || !plan.groupes.length) return '';
  const accent = (station.artwork && station.artwork.palette && station.artwork.palette.accent) || '#8A5A3B';
  const groups = plan.groupes;
  const rowH = 56;
  const w = 760;
  const h = groups.length * rowH + 46;
  const labelW = 190;
  let out = `<rect width="${w}" height="${h}" fill="none"/>`;
  out += `<text x="0" y="16" class="tp-title">${esc(plan.type)}</text>`;

  groups.forEach((g, i) => {
    const y = 44 + i * rowH;
    out += `<text x="0" y="${y - 8}" class="tp-label">${esc(g.nom)}</text>`;
    out += `<text x="${labelW + 16}" y="${y - 8}" class="tp-desc">${esc(g.desserte)}</text>`;
    // deux rails et des traverses
    for (const dy of [0, 9]) {
      out += `<line x1="0" y1="${y + dy}" x2="${w}" y2="${y + dy}" stroke="${accent}" stroke-width="2" opacity="${dy ? 0.55 : 0.85}"/>`;
    }
    for (let t = 0; t < 42; t++) {
      const x = (w / 42) * t + 4;
      out += `<line x1="${x.toFixed(0)}" y1="${y - 3}" x2="${x.toFixed(0)}" y2="${y + 12}" stroke="${accent}" stroke-width="1.2" opacity="0.28"/>`;
    }
    // heurtoir en tête de voie pour les gares en cul-de-sac
    if (/cul-de-sac|terminus/i.test(plan.type)) {
      out += `<rect x="0" y="${y - 6}" width="7" height="21" rx="2" fill="${accent}"/>`;
    }
  });
  return `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" class="track-plan" role="img" aria-label="Plan schématique des voies">${out}</svg>`;
}
