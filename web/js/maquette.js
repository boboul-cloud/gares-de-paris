// La maquette : Paris en volume, et chaque gare construite d'après sa fiche.
//
// Tout vient du corpus, comme pour la carte : limites d'arrondissement, Seine,
// canaux et voies ferrées (OpenStreetMap, Paris Open Data), repères, et pour
// chaque gare les paramètres qui dessinent déjà son illustration (`artwork`) —
// silhouette, travées, fronton, horloge, beffroi, verrière, palette. La même
// fiche donne ainsi une façade en SVG et un bâtiment en trois dimensions.
//
// Les gares regardent dans la bonne direction : la façade est tournée vers le
// point de vue « immersion » de la fiche, celui d'où l'on ouvre Street View.
// Une gare démolie (Bastille) apparaît en fantôme, à l'endroit exact où elle
// se tenait — l'Opéra est construit au travers.
//
// three.js (r170, MIT) est copié dans web/vendor et chargé à la demande :
// le reste de l'application ne paie rien tant qu'on n'ouvre pas la maquette.

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const RAD = Math.PI / 180;

let THREE = null;
async function chargerThree() {
  if (THREE) return THREE;
  const url = new URL('../vendor/three.module.js', import.meta.url).href;
  THREE = await import(url);
  return THREE;
}

// --- Projection : un kilomètre par unité, x vers l'est, z vers le sud --------

const LON0 = 2.33525, LAT0 = 48.8605;
const KX = 111.32 * Math.cos(LAT0 * RAD), KZ = 110.574;
const P = (lon, lat) => [(lon - LON0) * KX, -(lat - LAT0) * KZ];
const SOCLE = 0.012;                       // épaisseur de la plaque de Paris

/** Angle de la façade : elle regarde le point de vue de la fiche. */
function angleFacade(s) {
  const v = s.immersion?.vues?.[0];
  if (!v) return 0;
  const [rx, rz] = P(v.regard.lon, v.regard.lat), [cx, cz] = P(v.cible.lon, v.cible.lat);
  return Math.atan2(rx - cx, rz - cz);
}

// Une gare fermée dont le bâtiment a disparu : Bastille. Montparnasse a aussi
// perdu sa gare de 1852, mais elle n'a jamais cessé de fonctionner.
const estDemolie = (s) => s.fermeture !== undefined && /démoli/i.test(s.protection || '');

// --- Ambiances ------------------------------------------------------------------

const AMB = {
  jour: {
    ciel: '#CBD9E3', brume: [16, 46], sol: '#D7D0BF', paris: '#ECE5D5', eau: '#6FA3C4', parc: '#A9C38A',
    rail: '#8E877B', hemi: ['#FFF8EC', '#9C9078', 1.25], soleil: ['#FFF0D8', 2.4], fenetres: 0, verre: 0.08, expo: 1.0,
  },
  nuit: {
    ciel: '#0B1322', brume: [12, 40], sol: '#1A1F29', paris: '#262C38', eau: '#1F4A6B', parc: '#20352A',
    rail: '#4A4C55', hemi: ['#8FA2D8', '#1A1420', 0.55], soleil: ['#9DB0FF', 0.45], fenetres: 1, verre: 1.3, expo: 1.15,
  },
};

const AMB_GARE = {
  matin: { hemi: ['#FFF1DC', '#8A7A62', 1.1], soleil: ['#FFD9A8', 2.4], dir: [-1, 0.55, 0.6], verre: 0.15, fenetres: 0 },
  jour: { hemi: ['#FFFFFF', '#9A927F', 1.25], soleil: ['#FFF8EE', 2.5], dir: [0.4, 1, 0.7], verre: 0.05, fenetres: 0 },
  soir: { hemi: ['#FFD7B0', '#5A4A50', 0.95], soleil: ['#FF9E5E', 2.6], dir: [1, 0.4, 0.5], verre: 0.45, fenetres: 0.5 },
  nuit: { hemi: ['#8EA0D6', '#141826', 0.5], soleil: ['#A8B8FF', 0.5], dir: [0.3, 1, 0.4], verre: 1.5, fenetres: 1 },
};

// --- Géométries utilitaires ---------------------------------------------------

/** Ruban plat le long de plusieurs polylignes, fusionnées en une géométrie. */
function rubans(T, polylignes, largeur, y, uvEchelle = 1) {
  const pos = [], uv = [], idx = [];
  for (const pts of polylignes) {
    if (pts.length < 2) continue;
    const base = pos.length / 3;
    let L = 0;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
      let dx = b[0] - a[0], dz = b[1] - a[1];
      const n = Math.hypot(dx, dz) || 1; dx /= n; dz /= n;
      if (i) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      pos.push(pts[i][0] - dz * largeur / 2, y, pts[i][1] + dx * largeur / 2, pts[i][0] + dz * largeur / 2, y, pts[i][1] - dx * largeur / 2);
      uv.push(L * uvEchelle, 0, L * uvEchelle, 1);
      // Sens direct vu d'en haut : sinon les faces sont tournées vers le sol, et invisibles.
      if (i) { const k = base + i * 2; idx.push(k - 2, k, k - 1, k - 1, k, k + 1); }
    }
  }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

const enKm = (pts) => pts.map(([lon, lat]) => P(lon, lat));

function forme(T, ptsKm) {
  return new T.Shape(ptsKm.map(([x, z]) => new T.Vector2(x, -z)));
}

function dansPolygone(x, z, poly) {
  let dedans = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i], [xj, zj] = poly[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) dedans = !dedans;
  }
  return dedans;
}

function texture(T, w, h, dessin, repeter) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  dessin(c.getContext('2d'), w, h);
  const t = new T.CanvasTexture(c);
  t.colorSpace = T.SRGBColorSpace;
  if (repeter) { t.wrapS = t.wrapT = T.RepeatWrapping; }
  t.anisotropy = 4;
  return t;
}

/** Hasard reproductible : la maquette est toujours la même. */
function hasard(graine) {
  let a = graine >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// Grands espaces verts, tracés à grands traits : ils évitent d'y bâtir.
const PARCS = [
  { nom: 'Bois de Boulogne', poly: [[2.2525, 48.879], [2.262, 48.8775], [2.2685, 48.8705], [2.2725, 48.861], [2.2705, 48.848], [2.262, 48.8448], [2.2525, 48.8478], [2.2455, 48.856], [2.2468, 48.868], [2.2482, 48.876]] },
  { nom: 'Bois de Vincennes', poly: [[2.4135, 48.8458], [2.4335, 48.8462], [2.4605, 48.8405], [2.4705, 48.8305], [2.4625, 48.8222], [2.4405, 48.8205], [2.4195, 48.8278], [2.4118, 48.8362]] },
  { nom: 'Jardin du Luxembourg', poly: [[2.3318, 48.8492], [2.3405, 48.8494], [2.3412, 48.8446], [2.3355, 48.8441], [2.3322, 48.8452]] },
  { nom: 'Tuileries', poly: [[2.3212, 48.8657], [2.3328, 48.8622], [2.3318, 48.8607], [2.3201, 48.8642]] },
  { nom: 'Champ-de-Mars', poly: [[2.2928, 48.8592], [2.2962, 48.8604], [2.3045, 48.8543], [2.3008, 48.8526]] },
  { nom: 'Buttes-Chaumont', c: [2.3826, 48.8809], r: 0.24 },
  { nom: 'Père-Lachaise', c: [2.3933, 48.8614], r: 0.36 },
  { nom: 'Parc Montsouris', c: [2.3378, 48.8222], r: 0.2 },
  { nom: 'Jardin des Plantes', c: [2.3596, 48.8438], r: 0.22 },
  { nom: 'La Villette', c: [2.3906, 48.8938], r: 0.28 },
  { nom: 'Parc Monceau', c: [2.3088, 48.8797], r: 0.14 },
  { nom: 'Cimetière du Montparnasse', c: [2.3268, 48.8384], r: 0.2 },
  { nom: 'Invalides', c: [2.3127, 48.8565], r: 0.16 },
];
const parcEnKm = (p) => (p.poly ? { poly: enKm(p.poly) } : { c: P(p.c[0], p.c[1]), r: p.r });
const dansParc = (x, z, p) => (p.poly ? dansPolygone(x, z, p.poly) : Math.hypot(x - p.c[0], z - p.c[1]) < p.r);
function polyParc(p, n = 28) {
  if (p.poly) return p.poly;
  return Array.from({ length: n }, (_, i) => [p.c[0] + Math.cos(i / n * 2 * Math.PI) * p.r, p.c[1] + Math.sin(i / n * 2 * Math.PI) * p.r * 0.8]);
}

// --- Matériaux ----------------------------------------------------------------

function materiaux(T) {
  const fenetresJour = texture(T, 64, 64, (g, w, h) => {
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#b9b2a3';
    for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) g.fillRect(4 + c * 12, 6 + r * 11, 6, 7);
  });
  const rnd = hasard(7);
  const fenetresNuit = texture(T, 64, 64, (g, w, h) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) {
      if (rnd() < 0.45) { g.fillStyle = rnd() < 0.7 ? '#FFD38A' : '#FFF1C9'; g.fillRect(4 + c * 12, 6 + r * 11, 6, 7); }
    }
  });
  const ceinture = texture(T, 64, 8, (g, w, h) => {
    g.clearRect(0, 0, w, h); g.fillStyle = '#C8692E'; g.fillRect(0, 0, w * 0.55, h);
  }, true);
  return {
    sol: new T.MeshStandardMaterial({ color: AMB.jour.sol, roughness: 1 }),
    paris: new T.MeshStandardMaterial({ color: AMB.jour.paris, roughness: 0.95 }),
    eau: new T.MeshStandardMaterial({ color: AMB.jour.eau, roughness: 0.25, metalness: 0.15 }),
    parc: new T.MeshStandardMaterial({ color: AMB.jour.parc, roughness: 1 }),
    rail: new T.MeshStandardMaterial({ color: AMB.jour.rail, roughness: 1 }),
    ceinture: new T.MeshStandardMaterial({ map: ceinture, transparent: true, roughness: 0.9, emissive: '#C8692E', emissiveIntensity: 0 }),
    limite: new T.LineBasicMaterial({ color: '#B9AE97', transparent: true, opacity: 0.6 }),
    facade: new T.MeshStandardMaterial({ color: '#ffffff', map: fenetresJour, roughness: 0.92, emissive: '#ffffff', emissiveMap: fenetresNuit, emissiveIntensity: 0 }),
    toit: new T.MeshStandardMaterial({ color: '#ffffff', roughness: 0.6, metalness: 0.25 }),
    fantome: new T.MeshBasicMaterial({ color: '#4F8FDA', transparent: true, opacity: 0.3, depthWrite: false, side: T.DoubleSide }),
    fantomeTrait: new T.LineBasicMaterial({ color: '#1F5FB0', transparent: true, opacity: 0.9 }),
  };
}

// --- Les gares ----------------------------------------------------------------

/**
 * Construit une gare d'après sa fiche. Repère local : façade tournée vers +z,
 * en z = 0 ; le bâtiment s'étend vers -z ; le sol est en y = 0.
 * Renvoie { groupe, verres } — les verres s'illuminent la nuit.
 */
export function construireGare(T, s, opts = {}) {
  const art = s.artwork || {};
  const pal = art.palette || {};
  const sil = art.silhouette || 'terminus';
  const k = s.categorie === 'grande-gare' ? 1 : s.categorie === 'gare-patrimoine' ? 0.8 : 0.72;
  const W = 0.16 * k, Hf = 0.05 * k, Dp = 0.04 * k;
  const g = new T.Group();
  const verres = [];

  const M = (c, o = {}) => new T.MeshStandardMaterial({ color: c, roughness: 0.85, ...o });
  const pierre = M(pal.stone || '#DDD3C0');
  const pierreF = M(pal.stoneDark || '#B0A48C');
  const toit = M(pal.roof || '#5C6B72', { roughness: 0.55, metalness: 0.3 });
  const verre = M(pal.glass || '#A5C2CE', { roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.78, emissive: '#FFD9A0', emissiveIntensity: 0 });
  const accent = M(pal.accent || '#8A5A3B');
  verres.push(verre);

  const boite = (w, h, d, mat, x = 0, y = 0, z = 0) => {
    const m = new T.Mesh(new T.BoxGeometry(w, h, d), mat);
    m.position.set(x, y + h / 2, z); m.castShadow = m.receiveShadow = true; g.add(m); return m;
  };
  const disque = (r, mat, x, y, z, ry = 0) => {
    const m = new T.Mesh(new T.CircleGeometry(r, 28), mat);
    m.position.set(x, y, z); m.rotation.y = ry; g.add(m); return m;
  };
  const horloge = (r, x, y, z, ry = 0) => {
    const c = new T.Group(); c.position.set(x, y, z); c.rotation.y = ry; g.add(c);
    const face = new T.Mesh(new T.CircleGeometry(r, 28), M('#F6F1E4', { emissive: '#FFF3D0', emissiveIntensity: 0 }));
    c.add(face); verres.push(face.material);
    const aig = M('#1E2328');
    for (const [lg, ep, a] of [[0.55, 0.1, -2.1], [0.82, 0.07, 0.35]]) {
      const geo = new T.BoxGeometry(r * ep, r * lg, r * 0.04); geo.translate(0, r * lg / 2, 0);
      const m = new T.Mesh(geo, aig); m.position.z = 0.0005; m.rotation.z = a; c.add(m);
    }
  };
  // Baies cintrées sur la façade : un rectangle et un demi-cercle vitrés.
  const baies = (n, largeur, y0, hBaie, z, cintre = true) => {
    const pas = largeur / n, bw = pas * 0.62;
    for (let i = 0; i < n; i++) {
      const x = -largeur / 2 + pas * (i + 0.5);
      const sh = new T.Shape();
      sh.moveTo(-bw / 2, 0); sh.lineTo(bw / 2, 0); sh.lineTo(bw / 2, hBaie - (cintre ? bw / 2 : 0));
      if (cintre) sh.absarc(0, hBaie - bw / 2, bw / 2, 0, Math.PI, false); else sh.lineTo(-bw / 2, hBaie);
      sh.lineTo(-bw / 2, 0);
      const m = new T.Mesh(new T.ShapeGeometry(sh, 10), verre);
      m.position.set(x, y0, z + 0.0006); g.add(m);
    }
  };
  // Verrière : demi-cylindre aplati, posé sur deux murs gouttereaux.
  const verriere = (portee, longueur, fleche, zc, yBase, axeX = false) => {
    const r = portee / 2;
    const geo = new T.CylinderGeometry(r, r, longueur, 28, 1, true, -Math.PI / 2, Math.PI);
    const vm = new T.Mesh(geo, verre);
    vm.rotation.x = -Math.PI / 2;
    const porteur = new T.Group();
    porteur.add(vm);
    for (let i = 0; i <= 6; i++) {
      const arc = new T.Mesh(new T.TorusGeometry(r, 0.0012, 4, 20, Math.PI), toit);
      arc.position.z = -longueur / 2 + (longueur * i) / 6;
      arc.rotation.x = 0;
      porteur.add(arc);
    }
    porteur.scale.y = fleche / r;
    const ancre = new T.Group();
    ancre.add(porteur);
    if (axeX) ancre.rotation.y = Math.PI / 2;
    ancre.position.set(0, yBase, zc);
    vm.castShadow = true;
    g.add(ancre);
    const murs = new T.Group();
    for (const sx of [-1, 1]) {
      const m = new T.Mesh(new T.BoxGeometry(0.004, yBase, longueur), pierreF);
      m.position.set(sx * r, yBase / 2, 0); m.castShadow = true; murs.add(m);
    }
    if (axeX) murs.rotation.y = Math.PI / 2;
    murs.position.z = zc;
    g.add(murs);
  };

  const shed = art.shed || {};
  const tour = art.tower || {};

  if (sil === 'underground') {
    // Gare enfouie : un édicule vitré, et la lueur du quai sous la chaussée.
    boite(W * 0.55, 0.002, W * 0.35, M('#20262E', { roughness: 1 }), 0, 0, -W * 0.18);
    const lueur = new T.Mesh(new T.BoxGeometry(W * 0.5, 0.0025, 0.012), M('#FFE2A6', { emissive: '#FFD27A', emissiveIntensity: 0.6 }));
    lueur.position.set(0, 0.0022, -W * 0.18); g.add(lueur); verres.push(lueur.material);
    boite(W * 0.16, Hf * 0.32, W * 0.1, verre, W * 0.12, 0, W * 0.02);
    boite(W * 0.2, 0.003, W * 0.14, toit, W * 0.12, Hf * 0.32, W * 0.02);
    return { groupe: g, verres };
  }

  if (sil === 'viaduct') {
    // Viaduc : arcade de briques, plateforme plantée.
    const n = Math.max(5, art.bays || 7), long = W * 1.5, hV = Hf * 0.75, pas = long / n;
    for (let i = 0; i <= n; i++) boite(pas * 0.26, hV, Dp * 0.9, pierreF, -long / 2 + i * pas, 0, -Dp / 2);
    boite(long + pas * 0.3, hV * 0.22, Dp, pierre, 0, hV, -Dp / 2);
    const vert = M(pal.accent || '#4F7A55', { roughness: 1 });
    const rnd = hasard(s.id.length * 31);
    for (let i = 0; i < 14; i++) {
      const b = new T.Mesh(new T.SphereGeometry(0.006 + rnd() * 0.006, 8, 6), vert);
      b.position.set(-long / 2 + rnd() * long, hV * 1.22 + 0.004, -Dp / 2 + (rnd() - 0.5) * Dp * 0.7);
      b.castShadow = true; g.add(b);
    }
    return { groupe: g, verres };
  }

  if (sil === 'modern') {
    // Gare contemporaine : boîte de verre et dalle de toiture en porte-à-faux.
    boite(W * 0.8, Hf * 0.75, Dp * 1.6, verre, 0, 0, -Dp * 0.8);
    boite(W * 0.98, Hf * 0.08, Dp * 2.1, toit, 0, Hf * 0.75, -Dp * 0.8);
    for (const x of [-0.45, -0.15, 0.15, 0.45]) boite(0.0025, Hf * 0.75, 0.0025, pierreF, x * W, 0, Dp * 0.15);
    if (shed.present) boite(W * 0.7, 0.004, W * 1.2, toit, 0, Hf * 0.5, -Dp * 1.6 - W * 0.6);
    return { groupe: g, verres };
  }

  if (sil === 'slab') {
    // Montparnasse : la dalle de 1969, son mur-rideau, et le jardin posé sur les voies.
    boite(W * 1.25, Hf * 1.15, Dp * 1.5, M(pal.stone || '#C9CDD2'), 0, 0, -Dp * 0.75);
    for (let i = 0; i < 4; i++) boite(W * 1.22, Hf * 0.12, 0.002, verre, 0, Hf * (0.18 + i * 0.24), 0.0008);
    boite(W * 1.25, 0.008, W * 1.6, M('#8DB57A', { roughness: 1 }), 0, Hf * 0.85, -Dp * 1.5 - W * 0.8);
    if (opts.tour && tour.present) {
      const tw = W * 0.34;
      const t = boite(tw, 0.21, tw * 0.62, M('#2E3742', { roughness: 0.35, metalness: 0.5, emissive: '#FFD38A', emissiveIntensity: 0 }), W * 0.95, 0, Dp * 0.4);
      verres.push(t.material);
    }
    return { groupe: g, verres };
  }

  if (sil === 'museum') {
    // Orsay : la nef parallèle à la Seine, deux pavillons d'horloge.
    const long = W * 1.55;
    boite(long, Hf, Dp * 2.2, pierre, 0, 0, -Dp * 1.1);
    boite(long * 1.02, Hf * 0.07, Dp * 2.3, pierreF, 0, Hf, -Dp * 1.1);
    baies(7, long * 0.7, Hf * 0.12, Hf * 0.62, 0);
    for (const sx of [-1, 1]) {
      boite(W * 0.2, Hf * 1.25, Dp * 2.3, pierre, sx * long * 0.42, 0, -Dp * 1.1);
      horloge(W * 0.055, sx * long * 0.42, Hf * 0.95, 0.0012);
    }
    verriere(Dp * 2, long * 0.62, Hf * 0.55, -Dp * 1.1, Hf * 1.05, true);
    return { groupe: g, verres };
  }

  // --- Terminus classique : façade, pavillons, fronton, horloge, verrière ---
  const shedPres = shed.present;
  const hFac = sil === 'shed' ? Hf * 0.72 : Hf;
  boite(W, hFac, Dp, pierre, 0, 0, -Dp / 2);
  boite(W * 1.03, hFac * 0.07, Dp * 1.12, pierreF, 0, hFac, -Dp / 2);
  baies(Math.max(2, art.bays || 5), W * 0.78, hFac * 0.1, hFac * 0.66, 0);
  for (const sx of [-1, 1]) {
    boite(W * 0.13, hFac * 1.16, Dp * 1.1, pierre, sx * (W / 2 - W * 0.065), 0, -Dp / 2);
    boite(W * 0.14, hFac * 0.06, Dp * 1.16, pierreF, sx * (W / 2 - W * 0.065), hFac * 1.16, -Dp / 2);
  }
  const ped = art.pediment || 'flat';
  if (ped === 'triangular') {
    const sh = new T.Shape(); sh.moveTo(-W * 0.36, 0); sh.lineTo(W * 0.36, 0); sh.lineTo(0, Hf * 0.32); sh.lineTo(-W * 0.36, 0);
    const m = new T.Mesh(new T.ExtrudeGeometry(sh, { depth: Dp * 0.7, bevelEnabled: false }), pierre);
    m.position.set(0, hFac * 1.07, -Dp * 0.75); m.castShadow = true; g.add(m);
  } else if (ped === 'rose') {
    const rw = W * 0.24;
    const arc = new T.Mesh(new T.CylinderGeometry(rw, rw, Dp * 0.5, 24, 1, false, -Math.PI / 2, Math.PI), pierre);
    arc.rotation.x = -Math.PI / 2;
    arc.position.set(0, hFac * 1.05, -Dp * 0.25); arc.castShadow = true; g.add(arc);
    const rosace = new T.Mesh(new T.CircleGeometry(rw * 0.86, 24, 0, Math.PI), verre);
    rosace.position.set(0, hFac * 1.05, 0.0012); g.add(rosace);
  } else {
    boite(W * 0.6, Hf * 0.14, Dp * 0.8, pierre, 0, hFac * 1.07, -Dp * 0.45);
  }
  if (sil === 'belfry' && tour.present) {
    // Le beffroi de la gare de Lyon : quatre cadrans, toit en pavillon.
    const tw = W * 0.14, th = Hf * 2.6 * (tour.height || 0.9);
    const tx = (tour.side === 'left' ? -1 : 1) * (W / 2 - tw * 0.4);
    boite(tw, th, tw, pierre, tx, 0, -tw * 0.3);
    boite(tw * 1.16, th * 0.04, tw * 1.16, pierreF, tx, th, -tw * 0.3);
    const pav = new T.Mesh(new T.ConeGeometry(tw * 0.82, th * 0.22, 4), toit);
    pav.rotation.y = Math.PI / 4; pav.position.set(tx, th * 1.15, -tw * 0.3); pav.castShadow = true; g.add(pav);
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2;
      horloge(tw * 0.36, tx + Math.sin(a) * (tw / 2 + 0.0008), th * 0.82, -tw * 0.3 + Math.cos(a) * (tw / 2 + 0.0008), a);
    }
  } else if (art.clock && ped !== 'rose') {
    horloge(Math.min(W * 0.05, 0.009), 0, hFac * (ped === 'triangular' ? 1.18 : 0.88), 0.001);
  }
  const nStat = Math.min(art.statues || 0, 9);
  for (let i = 0; i < nStat; i++) {
    const st = new T.Mesh(new T.CapsuleGeometry(0.0018, 0.005, 3, 6), pierreF);
    st.position.set(-W * 0.4 + (W * 0.8 * i) / Math.max(1, nStat - 1), hFac * 1.07 + 0.005, 0.0);
    st.castShadow = true; g.add(st);
  }
  for (let i = 0; i < (art.flags || 0); i++) {
    const x = -W * 0.34 + i * W * 0.34;
    boite(0.0008, Hf * 0.32, 0.0008, pierreF, x, hFac * 1.07, -Dp * 0.2);
    const f = new T.Mesh(new T.PlaneGeometry(0.012, 0.007), M(pal.accent || '#8A5A3B', { side: T.DoubleSide }));
    f.position.set(x + 0.006, hFac * 1.07 + Hf * 0.27, -Dp * 0.2); g.add(f);
  }
  if (shedPres) {
    const portee = W * (shed.span || 0.8) * (sil === 'shed' ? 1.15 : 1);
    const longueur = sil === 'shed' ? W * 1.9 : W * 1.45;
    verriere(portee, longueur, Hf * (0.35 + (shed.rise || 0.3) * 0.9), -Dp - longueur / 2, hFac * 0.32);
  }
  if (tour.present && sil !== 'belfry' && opts.tour) {
    const t = boite(W * 0.3, 0.21, W * 0.2, M('#2E3742', { roughness: 0.35, metalness: 0.5 }), W * 0.9, 0, 0);
    verres.push(t.material);
  }
  return { groupe: g, verres };
}

/** Remplace les matériaux par ceux d'un fantôme, contours lumineux compris. */
function enFantome(T, groupe, mat) {
  const traits = [];
  groupe.traverse((o) => {
    if (o.isMesh) {
      o.material = mat.fantome; o.castShadow = false; o.receiveShadow = false;
      const l = new T.LineSegments(new T.EdgesGeometry(o.geometry, 25), mat.fantomeTrait);
      traits.push([o, l]);
    }
  });
  for (const [o, l] of traits) o.add(l);
}

// --- Monuments ------------------------------------------------------------------

function monument(T, nom) {
  const g = new T.Group();
  const M = (c, o = {}) => new T.MeshStandardMaterial({ color: c, roughness: 0.8, ...o });
  const add = (geo, mat, x, y, z, ry = 0) => { const m = new T.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.y = ry; m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };
  const lumiere = [];
  if (nom === 'Tour Eiffel') {
    const fer = M('#6E5A46', { metalness: 0.4, roughness: 0.6, emissive: '#C88A3A', emissiveIntensity: 0 });
    lumiere.push(fer);
    for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const a = new T.Vector3(sx * 0.062, 0, sz * 0.062), b = new T.Vector3(sx * 0.014, 0.125, sz * 0.014);
      const pied = add(new T.BoxGeometry(0.012, a.distanceTo(b), 0.012), fer, (a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
      pied.lookAt(b); pied.rotateX(Math.PI / 2);
    }
    add(new T.BoxGeometry(0.1, 0.007, 0.1), fer, 0, 0.058, 0);
    add(new T.BoxGeometry(0.05, 0.006, 0.05), fer, 0, 0.125, 0);
    add(new T.CylinderGeometry(0.004, 0.024, 0.17, 4), fer, 0, 0.21, 0, Math.PI / 4);
    add(new T.CylinderGeometry(0.0012, 0.0025, 0.04, 6), fer, 0, 0.315, 0);
  } else if (nom === 'Notre-Dame') {
    const p = M('#D9CFB9');
    add(new T.BoxGeometry(0.13, 0.034, 0.042), p, 0, 0.017, 0);
    const tt = add(new T.CylinderGeometry(0.0001, 0.03, 0.018, 4), M('#6B7681'), 0, 0.043, 0, Math.PI / 4); tt.scale.set(1.9, 1, 0.9);
    for (const sz of [-1, 1]) add(new T.BoxGeometry(0.02, 0.07, 0.016), p, -0.062, 0.035, sz * 0.012);
    add(new T.ConeGeometry(0.004, 0.06, 6), M('#4F5963'), 0.02, 0.064, 0);
  } else if (nom === 'Arc de Triomphe') {
    const p = M('#E2D9C4');
    add(new T.BoxGeometry(0.045, 0.05, 0.022), p, 0, 0.025, 0);
    add(new T.BoxGeometry(0.014, 0.03, 0.024), M('#3A3530'), 0, 0.015, 0);
  } else if (nom === 'Sacré-Cœur') {
    const blanc = M('#F4F1EA', { roughness: 0.6 });
    add(new T.CylinderGeometry(0.1, 0.13, 0.03, 24), M('#B5C49A', { roughness: 1 }), 0, 0.015, 0);
    add(new T.BoxGeometry(0.06, 0.03, 0.05), blanc, 0, 0.045, 0);
    const dome = add(new T.SphereGeometry(0.016, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2), blanc, 0, 0.06, 0); dome.scale.y = 1.6;
    add(new T.CylinderGeometry(0.009, 0.009, 0.018, 12), blanc, 0, 0.069, 0);
    for (const sx of [-1, 1]) add(new T.SphereGeometry(0.008, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), blanc, sx * 0.022, 0.06, 0.012);
    add(new T.BoxGeometry(0.01, 0.05, 0.01), blanc, 0, 0.07, -0.024);
  } else if (nom === 'Tour Montparnasse') {
    const t = add(new T.BoxGeometry(0.05, 0.21, 0.032), M('#2E3742', { roughness: 0.3, metalness: 0.55, emissive: '#FFD38A', emissiveIntensity: 0 }), 0, 0.105, 0, 0.35);
    lumiere.push(t.material);
  } else if (nom === 'Opéra Bastille') {
    const v = M('#9FB3C0', { roughness: 0.25, metalness: 0.3, emissive: '#FFE1A8', emissiveIntensity: 0 });
    lumiere.push(v);
    add(new T.BoxGeometry(0.11, 0.04, 0.08), v, 0, 0.02, 0, -0.5);
    add(new T.CylinderGeometry(0.035, 0.035, 0.05, 20, 1, false, 0, Math.PI), v, -0.03, 0.025, 0.03, -0.5);
  } else if (nom === 'Louvre') {
    const p = M('#E1D6BD');
    const ry = -0.06;
    const aile = (w, d, x, z) => add(new T.BoxGeometry(w, 0.026, d), p, x, 0.013, z, ry);
    aile(0.52, 0.03, 0, -0.07); aile(0.52, 0.03, 0, 0.07); aile(0.03, 0.17, -0.17, 0);
    add(new T.ConeGeometry(0.03, 0.025, 4), M('#A9C8D8', { roughness: 0.1, metalness: 0.4, transparent: true, opacity: 0.85, emissive: '#FFE7B0', emissiveIntensity: 0 }), 0.05, 0.0125, 0, Math.PI / 4 + ry);
    lumiere.push(g.children[g.children.length - 1].material);
  }
  return { groupe: g, lumiere };
}

// --- Itinéraires des trains -----------------------------------------------------
//
// Les voies sont des tronçons OpenStreetMap ; on les enchaîne bout à bout en
// partant d'un terminus, en choisissant à chaque jonction le tronçon qui
// prolonge le mieux la direction suivie. On obtient la voie de sortie de la
// gare, que des trains parcourent à l'aller et au retour.

function itineraires(corpus, gares) {
  const lignes = corpus.geo.voiesFerrees.map(enKm);
  const cle = (p) => p[0].toFixed(4) + ',' + p[1].toFixed(4);
  const bouts = new Map();
  lignes.forEach((l, i) => {
    for (const [p, fin] of [[l[0], false], [l[l.length - 1], true]]) {
      const k = cle(p);
      if (!bouts.has(k)) bouts.set(k, []);
      bouts.get(k).push({ i, fin });
    }
  });
  const longueur = (l) => l.reduce((s, p, j) => (j ? s + Math.hypot(p[0] - l[j - 1][0], p[1] - l[j - 1][1]) : 0), 0);
  const routes = [];
  for (const s of gares) {
    const [sx, sz] = P(s.coord.lon, s.coord.lat);
    const departs = [];
    lignes.forEach((l, i) => {
      const d0 = Math.hypot(l[0][0] - sx, l[0][1] - sz), d1 = Math.hypot(l[l.length - 1][0] - sx, l[l.length - 1][1] - sz);
      if (Math.min(d0, d1) < 0.3) departs.push(d0 <= d1 ? l : [...l].reverse());
    });
    const trouvees = [];
    for (const dep of departs) {
      const pts = [...dep];
      const pris = new Set();
      let total = longueur(pts);
      for (let n = 0; n < 60 && total < 7; n++) {
        const a = pts[pts.length - 2], b = pts[pts.length - 1];
        const dir = Math.atan2(b[0] - a[0], b[1] - a[1]);
        let meilleur = null, ecart = 0.9;
        for (const { i, fin } of bouts.get(cle(b)) || []) {
          if (pris.has(i)) continue;
          const l = fin ? [...lignes[i]].reverse() : lignes[i];
          if (l.length < 2 || (l[1][0] === a[0] && l[1][1] === a[1])) continue;
          const d2 = Math.atan2(l[1][0] - l[0][0], l[1][1] - l[0][1]);
          const e = Math.abs(Math.atan2(Math.sin(d2 - dir), Math.cos(d2 - dir)));
          if (e < ecart) { ecart = e; meilleur = { i, l }; }
        }
        if (!meilleur) break;
        pris.add(meilleur.i);
        pts.push(...meilleur.l.slice(1));
        total = longueur(pts);
      }
      // On garde la voie si elle s'éloigne vraiment de la gare.
      const fin = pts[pts.length - 1];
      if (total > 2.2 && Math.hypot(fin[0] - sx, fin[1] - sz) > 1.6) trouvees.push({ pts, total });
    }
    trouvees.sort((a, b) => b.total - a.total);
    const gardees = [];
    for (const r of trouvees) {
      const f = r.pts[r.pts.length - 1];
      if (gardees.every((q) => { const g2 = q.pts[q.pts.length - 1]; return Math.hypot(f[0] - g2[0], f[1] - g2[1]) > 1; })) gardees.push(r);
      if (gardees.length >= 2) break;
    }
    for (const r of gardees) routes.push({ gare: s, ...r });
  }
  return routes;
}

function echantillonner(route, d) {
  const p = route.pts;
  route.cumul ??= p.reduce((acc, q, j) => (acc.push(j ? acc[j - 1] + Math.hypot(q[0] - p[j - 1][0], q[1] - p[j - 1][1]) : 0), acc), []);
  const c = route.cumul;
  d = Math.max(0, Math.min(c[c.length - 1], d));
  let lo = 0, hi = c.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (c[m] <= d) lo = m; else hi = m; }
  const t = c[hi] > c[lo] ? (d - c[lo]) / (c[hi] - c[lo]) : 0;
  const x = p[lo][0] + (p[hi][0] - p[lo][0]) * t, z = p[lo][1] + (p[hi][1] - p[lo][1]) * t;
  return { x, z, a: Math.atan2(p[hi][0] - p[lo][0], p[hi][1] - p[lo][1]) };
}

// --- Caméra en orbite -------------------------------------------------------------

function orbite(T, camera, dom, opts) {
  const o = {
    cible: new T.Vector3(...(opts.cible || [0, 0, 0])), r: opts.r ?? 9, theta: opts.theta ?? 0.2, phi: opts.phi ?? 0.85,
    vt: 0, vp: 0, rMin: opts.rMin ?? 0.18, rMax: opts.rMax ?? 26, phiMin: 0.12, phiMax: opts.phiMax ?? 1.42,
    zoom: opts.zoom !== false, pan: opts.pan !== false, bouge: false, dernierGeste: 0, vol: null,
  };
  const pointeurs = new Map();
  let ecart = 0, depart = null, deplacement = 0;
  const maj = () => {
    o.phi = Math.min(o.phiMax, Math.max(o.phiMin, o.phi));
    o.r = Math.min(o.rMax, Math.max(o.rMin, o.r));
    const s = Math.sin(o.phi);
    camera.position.set(o.cible.x + o.r * s * Math.sin(o.theta), o.cible.y + o.r * Math.cos(o.phi), o.cible.z + o.r * s * Math.cos(o.theta));
    camera.lookAt(o.cible);
  };
  // Glisser déplace le sol avec le doigt : la cible part à l'opposé du geste,
  // dans le repère horizontal de la caméra (droite, et avant).
  const deplacer = (dx, dy) => {
    const f = o.r * 0.0016;
    const cs = Math.cos(o.theta), sn = Math.sin(o.theta);
    o.cible.x += (-cs * dx - sn * dy) * f;
    o.cible.z += (sn * dx - cs * dy) * f;
    o.cible.x = Math.max(-14, Math.min(14, o.cible.x));
    o.cible.z = Math.max(-12, Math.min(12, o.cible.z));
  };
  dom.addEventListener('contextmenu', (e) => e.preventDefault());
  dom.addEventListener('pointerdown', (e) => {
    dom.setPointerCapture?.(e.pointerId);
    pointeurs.set(e.pointerId, { x: e.clientX, y: e.clientY, bouton: e.button, maj: e.shiftKey });
    depart = { x: e.clientX, y: e.clientY }; deplacement = 0; o.vol = null; o.dernierGeste = performance.now();
    if (pointeurs.size === 2) { const [a, b] = [...pointeurs.values()]; ecart = Math.hypot(a.x - b.x, a.y - b.y); }
  });
  dom.addEventListener('pointermove', (e) => {
    const p = pointeurs.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    deplacement += Math.abs(dx) + Math.abs(dy);
    o.dernierGeste = performance.now();
    if (pointeurs.size === 2) {
      p.x = e.clientX; p.y = e.clientY;
      const [a, b] = [...pointeurs.values()];
      const n = Math.hypot(a.x - b.x, a.y - b.y);
      if (ecart > 0 && o.zoom) o.r *= ecart / n;
      ecart = n;
      if (o.pan) deplacer(dx / 2, dy / 2);
    } else if ((p.bouton === 2 || p.maj) && o.pan) {
      deplacer(dx, dy);
      p.x = e.clientX; p.y = e.clientY;
    } else {
      o.vt = -dx * 0.0055; o.vp = -dy * 0.0045;
      o.theta += o.vt; o.phi += o.vp;
      p.x = e.clientX; p.y = e.clientY;
    }
    o.bouge = true;
    maj();
  });
  const fin = (e) => {
    pointeurs.delete(e.pointerId);
    if (pointeurs.size < 2) ecart = 0;
    if (!pointeurs.size && deplacement < 6 && depart && opts.clic) opts.clic(e);
    if (!pointeurs.size) depart = null;
  };
  dom.addEventListener('pointerup', fin);
  dom.addEventListener('pointercancel', fin);
  if (o.zoom) {
    dom.addEventListener('wheel', (e) => {
      e.preventDefault(); o.vol = null; o.dernierGeste = performance.now();
      o.r *= Math.exp(e.deltaY * 0.0012); maj();
    }, { passive: false });
  }
  dom.addEventListener('keydown', (e) => {
    const k = e.key;
    if (k === 'ArrowLeft') o.theta += 0.08; else if (k === 'ArrowRight') o.theta -= 0.08;
    else if (k === 'ArrowUp') o.phi -= 0.06; else if (k === 'ArrowDown') o.phi += 0.06;
    else if ((k === '+' || k === '=') && o.zoom) o.r *= 0.85; else if (k === '-' && o.zoom) o.r /= 0.85;
    else return;
    e.preventDefault(); o.vol = null; o.dernierGeste = performance.now(); maj();
  });

  /** Vol de caméra vers une nouvelle pose, en 1,4 s, avec un ralenti aux deux bouts. */
  o.voler = (pose, duree = 1400) => {
    const de = { cible: o.cible.clone(), r: o.r, theta: o.theta, phi: o.phi };
    let dTheta = pose.theta - de.theta;
    dTheta = Math.atan2(Math.sin(dTheta), Math.cos(dTheta));
    o.vol = { de, vers: { ...pose, theta: de.theta + dTheta }, t0: performance.now(), duree };
  };
  o.animer = (now, dt) => {
    if (o.vol) {
      const v = o.vol;
      const p = Math.min(1, (now - v.t0) / v.duree);
      const e = p < 0.5 ? 4 * p * p * p : 1 - (-2 * p + 2) ** 3 / 2;
      // On prend de la hauteur au milieu du vol : la ville défile dessous.
      const bosse = Math.sin(Math.PI * p) * Math.min(4, v.de.cible.distanceTo(new T.Vector3(...v.vers.cible)) * 0.5);
      o.cible.set(...[0, 1, 2].map((i) => v.de.cible.getComponent(i) + (v.vers.cible[i] - v.de.cible.getComponent(i)) * e));
      o.r = v.de.r + (v.vers.r - v.de.r) * e + bosse;
      o.theta = v.de.theta + (v.vers.theta - v.de.theta) * e;
      o.phi = v.de.phi + (v.vers.phi - v.de.phi) * e;
      if (p >= 1) o.vol = null;
      maj();
      return true;
    }
    if (!pointeurs.size && (Math.abs(o.vt) > 1e-4 || Math.abs(o.vp) > 1e-4)) {
      o.vt *= 0.9; o.vp *= 0.9; o.theta += o.vt; o.phi += o.vp; maj(); return true;
    }
    if (opts.tourne && now - o.dernierGeste > (opts.repos ?? 9000)) { o.theta += dt * opts.tourne; maj(); return true; }
    return false;
  };
  o.maj = maj;
  maj();
  return o;
}

// --- La maquette de Paris -------------------------------------------------------

/**
 * Monte la maquette de Paris dans `conteneur`. Options : focus (identifiant
 * de gare à survoler d'emblée), fiche(station) → HTML du panneau de gare,
 * surSelection(station).
 */
export async function monterMaquette(conteneur, corpus, opts = {}) {
  if (!conteneur || typeof document === 'undefined') return null;
  conteneur.innerHTML = `
    <div class="m3d">
      <canvas class="m3d-canvas" tabindex="0" aria-label="Maquette de Paris en trois dimensions : faites glisser pour tourner, cliquez une gare"></canvas>
      <div class="m3d-etiquettes" aria-hidden="true"></div>
      <div class="m3d-barre">
        <div class="m3d-groupe" role="group" aria-label="Ambiance">
          <button type="button" data-m3d-amb="jour" class="on">Jour</button><button type="button" data-m3d-amb="nuit">Nuit</button>
        </div>
        <button type="button" data-m3d="visite">▶ Visite des sept gares</button>
        <button type="button" data-m3d="ensemble">⤾ Vue d'ensemble</button>
      </div>
      <div class="m3d-legende" aria-live="polite"></div>
      <aside class="m3d-fiche" hidden></aside>
      <p class="m3d-aide">Glisser pour tourner · molette ou pincement pour zoomer · clic droit, Maj ou deux doigts pour déplacer · cliquer une gare</p>
      <div class="m3d-attente">Construction de la maquette…</div>
    </div>`;
  const racine = conteneur.querySelector('.m3d');
  const attente = racine.querySelector('.m3d-attente');

  let T;
  try { T = await chargerThree(); } catch {
    attente.innerHTML = `La maquette 3D a besoin de son moteur (three.js), qui n'a pas pu être chargé.
      <br>Ouvrez la version en ligne : <a href="https://boboul-cloud.github.io/gares-de-paris/#/carte/3d">boboul-cloud.github.io/gares-de-paris</a>.`;
    return null;
  }
  const canvas = racine.querySelector('canvas');
  let renderer;
  try {
    renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  } catch {
    attente.textContent = "Ce navigateur n'affiche pas la 3D (WebGL indisponible). Le plan, lui, reste consultable.";
    return null;
  }
  const tactile = globalThis.matchMedia?.('(pointer: coarse)').matches;
  renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, tactile ? 1.75 : 2));
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;

  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(38, 1, 0.02, 120);
  const mat = materiaux(T);
  const geo = corpus.geo;

  // Sol, plaque de Paris, limites d'arrondissement.
  const sol = new T.Mesh(new T.PlaneGeometry(90, 90), mat.sol);
  sol.rotation.x = -Math.PI / 2; sol.receiveShadow = true; scene.add(sol);
  const contours = geo.arrondissements.map((a) => enKm(a.contour));
  const plaque = new T.Mesh(new T.ExtrudeGeometry(contours.map((c) => forme(T, c)), { depth: SOCLE, bevelEnabled: false }), mat.paris);
  plaque.rotation.x = -Math.PI / 2; plaque.receiveShadow = true; scene.add(plaque);
  const lim = [];
  for (const c of contours) for (let i = 0; i < c.length; i++) {
    const a = c[i], b = c[(i + 1) % c.length];
    lim.push(a[0], SOCLE + 0.0015, a[1], b[0], SOCLE + 0.0015, b[1]);
  }
  const lgLim = new T.BufferGeometry(); lgLim.setAttribute('position', new T.Float32BufferAttribute(lim, 3));
  scene.add(new T.LineSegments(lgLim, mat.limite));

  const parcs = PARCS.map(parcEnKm);
  const plParcs = new T.Mesh(new T.ShapeGeometry(parcs.map((p) => forme(T, polyParc(p)))), mat.parc);
  plParcs.rotation.x = -Math.PI / 2; plParcs.position.y = SOCLE + 0.001; plParcs.receiveShadow = true; scene.add(plParcs);

  const seine = geo.seine.map(enKm), canaux = geo.canaux.map(enKm), rails = geo.voiesFerrees.map(enKm), pc = geo.petiteCeinture.map(enKm);
  const eau = new T.Mesh(rubans(T, seine, 0.13, SOCLE + 0.002), mat.eau); eau.receiveShadow = true; scene.add(eau);
  scene.add(new T.Mesh(rubans(T, canaux, 0.03, SOCLE + 0.002), mat.eau));
  const voies = new T.Mesh(rubans(T, rails, 0.013, SOCLE + 0.0025), mat.rail); voies.receiveShadow = true; scene.add(voies);
  scene.add(new T.Mesh(rubans(T, pc, 0.02, SOCLE + 0.003, 30), mat.ceinture));

  // Gares et monuments à placer ; ils réservent leur emplacement dans la ville.
  const { minLon, maxLon, minLat, maxLat } = geo.bounds;
  const dansLePlan = (c) => c.lon >= minLon && c.lon <= maxLon && c.lat >= minLat && c.lat <= maxLat;
  const garesVilles = corpus.stations.filter((s) => dansLePlan(s.coord));
  const reserves = [
    ...garesVilles.map((s) => ({ p: P(s.coord.lon, s.coord.lat), r: s.categorie === 'grande-gare' ? 0.2 : 0.14 })),
    ...(geo.reperes || []).map((m) => ({ p: P(m.lon, m.lat), r: m.nom === 'Louvre' ? 0.3 : m.nom === 'Sacré-Cœur' ? 0.16 : 0.11 })),
  ];

  // --- La ville : des immeubles haussmanniens, tirés sur une grille ----------
  const masque = new Map();
  const cell = 0.04, cleM = (x, z) => Math.round(x / cell) + ',' + Math.round(z / cell);
  const marquer = (lignes, rayon) => {
    const n = Math.ceil(rayon / cell);
    for (const l of lignes) for (let i = 1; i < l.length; i++) {
      const [ax, az] = l[i - 1], [bx, bz] = l[i];
      const pas = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / (cell * 0.5)));
      for (let k = 0; k <= pas; k++) {
        const x = ax + (bx - ax) * (k / pas), z = az + (bz - az) * (k / pas);
        for (let dx = -n; dx <= n; dx++) for (let dz = -n; dz <= n; dz++) masque.set(cleM(x + dx * cell, z + dz * cell), 1);
      }
    }
  };
  marquer(seine, 0.11); marquer(canaux, 0.04); marquer(rails, 0.035); marquer(pc, 0.03);
  const boites = contours.map((c) => {
    let x1 = Infinity, x2 = -Infinity, z1 = Infinity, z2 = -Infinity;
    for (const [x, z] of c) { x1 = Math.min(x1, x); x2 = Math.max(x2, x); z1 = Math.min(z1, z); z2 = Math.max(z2, z); }
    return { c, x1, x2, z1, z2 };
  });
  const dansParis = (x, z) => boites.some((b) => x > b.x1 && x < b.x2 && z > b.z1 && z < b.z2 && dansPolygone(x, z, b.c));
  const rnd = hasard(1837);
  const lots = [];
  const pasV = 0.112;
  for (let x = -6.6; x < 6.6; x += pasV) for (let z = -5.4; z < 5.4; z += pasV) {
    const jx = x + (rnd() - 0.5) * 0.04, jz = z + (rnd() - 0.5) * 0.04;
    const r1 = rnd(), r2 = rnd(), r3 = rnd(), r4 = rnd(), r5 = rnd();
    if (masque.has(cleM(jx, jz)) || !dansParis(jx, jz)) continue;
    if (parcs.some((p) => dansParc(jx, jz, p))) continue;
    if (reserves.some((q) => Math.hypot(jx - q.p[0], jz - q.p[1]) < q.r)) continue;
    // La banlieue proche du périphérique est un peu plus basse que le centre.
    const centre = Math.hypot(jx, jz);
    lots.push({ x: jx, z: jz, sx: 0.06 + r1 * 0.026, sz: 0.054 + r2 * 0.024, h: (0.026 + r3 * 0.016) * (centre > 4.6 ? 0.85 : 1), a: (r4 - 0.5) * 0.5, c: r5 });
  }
  const FACADES = ['#EFE6D3', '#E8DCC4', '#F3ECDF', '#E2D6BF', '#ECE1CC', '#DED3BC'].map((c) => new T.Color(c));
  const TOITS = ['#8E9AA6', '#85919D', '#98A3AE', '#7E8A96', '#9A9DA2'].map((c) => new T.Color(c));
  const geoImm = new T.BoxGeometry(1, 1, 1); geoImm.translate(0, 0.5, 0);
  const geoToit = new T.CylinderGeometry(0.707 * 0.7, 0.707, 1, 4, 1); geoToit.rotateY(Math.PI / 4); geoToit.translate(0, 0.5, 0);
  const imm = new T.InstancedMesh(geoImm, mat.facade, lots.length);
  const toits = new T.InstancedMesh(geoToit, mat.toit, lots.length);
  imm.castShadow = imm.receiveShadow = true; toits.castShadow = true;
  const m4 = new T.Matrix4(), q = new T.Quaternion(), e3 = new T.Euler(), v3 = new T.Vector3(), s3 = new T.Vector3();
  lots.forEach((b, i) => {
    q.setFromEuler(e3.set(0, b.a, 0));
    imm.setMatrixAt(i, m4.compose(v3.set(b.x, SOCLE, b.z), q, s3.set(b.sx, b.h, b.sz)));
    imm.setColorAt(i, FACADES[Math.floor(b.c * FACADES.length)]);
    toits.setMatrixAt(i, m4.compose(v3.set(b.x, SOCLE + b.h, b.z), q, s3.set(b.sx, b.h * 0.24, b.sz)));
    toits.setColorAt(i, TOITS[Math.floor(b.c * 7) % TOITS.length]);
  });
  scene.add(imm, toits);

  // --- Monuments ---
  const lumieres = [];
  const etiquettes = [];
  for (const m of geo.reperes || []) {
    const { groupe, lumiere } = monument(T, m.nom);
    const [x, z] = P(m.lon, m.lat);
    groupe.position.set(x, SOCLE, z);
    if (m.nom === 'Notre-Dame') groupe.rotation.y = -0.4;
    scene.add(groupe);
    lumieres.push(...lumiere);
    etiquettes.push({ texte: m.nom, pos: new T.Vector3(x, SOCLE + (m.nom === 'Tour Eiffel' ? 0.36 : 0.09), z), monument: true });
  }

  // Scintillement de la tour Eiffel, la nuit : des éclats qui s'allument au hasard.
  const eiffel = (geo.reperes || []).find((m) => m.nom === 'Tour Eiffel');
  let eclats = null;
  if (eiffel) {
    const [ex, ez] = P(eiffel.lon, eiffel.lat);
    const n = 180, pos = new Float32Array(n * 3);
    const rr = hasard(1889);
    for (let i = 0; i < n; i++) {
      const y = rr() * 0.3, larg = 0.062 * (1 - y / 0.33) ** 1.6 + 0.004;
      const cote = Math.floor(rr() * 4), t = rr() * 2 - 1;
      const px = cote < 2 ? (cote ? 1 : -1) * larg : t * larg, pz = cote >= 2 ? (cote === 3 ? 1 : -1) * larg : t * larg;
      pos.set([ex + px, SOCLE + y, ez + pz], i * 3);
    }
    const gp = new T.BufferGeometry(); gp.setAttribute('position', new T.BufferAttribute(pos, 3));
    eclats = new T.Points(gp, new T.PointsMaterial({ color: '#FFFFFF', size: 0.006, transparent: true, opacity: 0, depthWrite: false }));
    eclats.visible = false;
    scene.add(eclats);
  }

  // --- Les gares ---
  const gares = new Map();
  const cibles = [];
  const fantomes = [];
  let verresGares = [];
  for (const s of garesVilles) {
    const { groupe, verres } = construireGare(T, s, { tour: false });
    const [x, z] = P(s.coord.lon, s.coord.lat);
    const angle = angleFacade(s);
    groupe.position.set(x, SOCLE, z);
    groupe.rotation.y = angle;
    groupe.scale.setScalar(s.categorie === 'grande-gare' ? 1.25 : 1.15);
    if (estDemolie(s)) { enFantome(T, groupe, mat); fantomes.push(groupe); } else verresGares.push(...verres);
    scene.add(groupe);
    const boiteGare = new T.Box3().setFromObject(groupe);
    const taille = boiteGare.getSize(new T.Vector3());
    const hit = new T.Mesh(new T.BoxGeometry(Math.max(0.16, taille.x), Math.max(0.12, taille.y + 0.04), Math.max(0.16, taille.z)), new T.MeshBasicMaterial());
    hit.visible = false;
    hit.position.copy(boiteGare.getCenter(new T.Vector3()));
    hit.userData.gare = s.id;
    scene.add(hit); cibles.push(hit);
    gares.set(s.id, { s, x, z, angle, haut: taille.y });
    etiquettes.push({ texte: s.nomCourt || s.nom, pos: new T.Vector3(x, SOCLE + taille.y + 0.035, z), gare: s.id, grande: s.categorie === 'grande-gare', fantome: estDemolie(s) });
  }

  // --- Trains qui sortent des terminus ---
  const routes = itineraires(corpus, garesVilles.filter((s) => s.categorie === 'grande-gare'));
  const trains = routes.map((r, i) => {
    const groupe = new T.Group();
    const couleur = r.gare.artwork?.palette?.accent || '#1F6F8B';
    const caisse = new T.MeshStandardMaterial({ color: '#E7EBEF', roughness: 0.5, metalness: 0.2 });
    const tete = new T.MeshStandardMaterial({ color: couleur, roughness: 0.5, metalness: 0.2 });
    const phare = new T.MeshStandardMaterial({ color: '#FFF4D0', emissive: '#FFE9A8', emissiveIntensity: 0 });
    lumieres.push(phare);
    const voitures = [];
    for (let k = 0; k < 5; k++) {
      const v = new T.Mesh(new T.BoxGeometry(0.011, 0.011, 0.044), k === 0 || k === 4 ? tete : caisse);
      v.castShadow = true;
      groupe.add(v); voitures.push(v);
    }
    const ph = new T.Mesh(new T.BoxGeometry(0.008, 0.004, 0.002), phare);
    voitures[0].add(ph); ph.position.set(0, 0.002, 0.0225);
    scene.add(groupe);
    return { r, groupe, voitures, phase: i * 3.7, vitesse: 0.85 + (i % 3) * 0.15 };
  });

  // --- Lumières ---
  const hemi = new T.HemisphereLight('#FFF8EC', '#9C9078', 1.2);
  const soleil = new T.DirectionalLight('#FFF0D8', 2.4);
  soleil.position.set(-8, 14, 6);
  soleil.castShadow = true;
  soleil.shadow.mapSize.set(tactile ? 1024 : 2048, tactile ? 1024 : 2048);
  Object.assign(soleil.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 40 });
  soleil.shadow.bias = -0.0004; soleil.shadow.normalBias = 0.015;
  scene.add(hemi, soleil, soleil.target);

  let ambiance = 'jour';
  function appliquerAmbiance(nom) {
    ambiance = nom;
    const a = AMB[nom];
    scene.background = new T.Color(a.ciel);
    scene.fog = new T.Fog(a.ciel, a.brume[0], a.brume[1]);
    mat.sol.color.set(a.sol); mat.paris.color.set(a.paris); mat.eau.color.set(a.eau); mat.parc.color.set(a.parc); mat.rail.color.set(a.rail);
    hemi.color.set(a.hemi[0]); hemi.groundColor.set(a.hemi[1]); hemi.intensity = a.hemi[2];
    soleil.color.set(a.soleil[0]); soleil.intensity = a.soleil[1];
    mat.facade.emissiveIntensity = a.fenetres * 0.85;
    mat.facade.color.set(nom === 'nuit' ? '#7A7E8A' : '#FFFFFF');
    mat.ceinture.emissiveIntensity = nom === 'nuit' ? 0.5 : 0;
    // Le fantôme : bleu soutenu sur le papier du jour, lueur pâle la nuit.
    mat.fantome.color.set(nom === 'nuit' ? '#7FB6F2' : '#4F8FDA');
    mat.fantomeTrait.color.set(nom === 'nuit' ? '#CFE6FF' : '#1F5FB0');
    for (const v of verresGares) v.emissiveIntensity = a.verre;
    for (const l of lumieres) l.emissiveIntensity = nom === 'nuit' ? 1.4 : 0;
    if (eclats) eclats.visible = nom === 'nuit';
    renderer.toneMappingExposure = a.expo;
    racine.querySelectorAll('[data-m3d-amb]').forEach((b) => b.classList.toggle('on', b.dataset.m3dAmb === nom));
    racine.classList.toggle('est-nuit', nom === 'nuit');
  }
  // La maquette s'ouvre à l'heure du thème : nuit si l'application est en sombre,
  // que ce soit par choix ou par réglage de l'appareil.
  const theme = document.documentElement.getAttribute('data-theme');
  const sombre = theme === 'dark' || (theme !== 'light' && !!globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches);
  appliquerAmbiance(sombre ? 'nuit' : 'jour');

  // --- Étiquettes HTML ---
  const calque = racine.querySelector('.m3d-etiquettes');
  for (const e of etiquettes) {
    const el = document.createElement(e.gare ? 'button' : 'span');
    el.className = 'm3d-etiquette' + (e.monument ? ' est-monument' : '') + (e.grande ? ' est-grande' : '') + (e.fantome ? ' est-fantome' : '');
    el.textContent = e.texte;
    if (e.gare) { el.type = 'button'; el.dataset.gare = e.gare; el.tabIndex = -1; }
    calque.appendChild(el);
    e.el = el;
  }

  // --- Sélection, fiche, vols ---
  const fiche = racine.querySelector('.m3d-fiche');
  const legende = racine.querySelector('.m3d-legende');
  const ray = new T.Raycaster(), ndc = new T.Vector2();
  let selection = null, visite = null;
  const poseGare = (g, r = 0.62) => ({ cible: [g.x, SOCLE + 0.03, g.z], r, theta: g.angle + 0.35, phi: 1.02 });
  const poseEnsemble = { cible: [0, 0, 0.4], r: 10.5, theta: 0.2, phi: 0.86 };

  function choisir(id, voler = true) {
    const g = gares.get(id);
    if (!g) return;
    selection = id;
    for (const e of etiquettes) e.el.classList.toggle('est-choisie', e.gare === id);
    if (voler) cam.voler(poseGare(g));
    if (opts.fiche) { fiche.innerHTML = opts.fiche(g.s); fiche.hidden = false; }
    opts.surSelection?.(g.s);
  }
  function deselectionner() {
    selection = null; fiche.hidden = true;
    for (const e of etiquettes) e.el.classList.remove('est-choisie');
  }
  fiche.addEventListener('click', (ev) => { if (ev.target.closest('[data-fermer]')) deselectionner(); });

  const cam = orbite(T, camera, canvas, {
    ...poseEnsemble, cible: poseEnsemble.cible, tourne: 0.025,
    clic: (ev) => {
      const r = canvas.getBoundingClientRect();
      ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      const hit = ray.intersectObjects(cibles, false)[0];
      arreterVisite();
      if (hit) choisir(hit.object.userData.gare); else if (selection) deselectionner();
    },
  });
  calque.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-gare]');
    if (b) { arreterVisite(); choisir(b.dataset.gare); }
  });

  // La visite guidée : les sept grands terminus, dans l'ordre du Grand Tour.
  const ordreVisite = (corpus.circuits.find((c) => c.id === 'grand-tour')?.etapes.map((e) => e.stationId) || [])
    .filter((id, i, t) => t.indexOf(id) === i && gares.get(id)?.s.categorie === 'grande-gare');
  const btnVisite = racine.querySelector('[data-m3d="visite"]');
  function etapeVisite() {
    if (!visite) return;
    if (visite.i >= ordreVisite.length) { arreterVisite(); cam.voler(poseEnsemble, 2200); legende.textContent = ''; return; }
    const id = ordreVisite[visite.i++];
    const g = gares.get(id);
    choisir(id, false);
    cam.voler(poseGare(g, 0.75), 2300);
    const phrase = g.s.resume.split('. ')[0].replace(/[.\s]+$/, '');
    legende.innerHTML = `<b>${esc(g.s.nomCourt || g.s.nom)}</b> — ${esc(g.s.surnom || '')}. ${esc(phrase)}.`;
    visite.minuterie = setTimeout(etapeVisite, 6200);
  }
  function arreterVisite() {
    if (!visite) return;
    clearTimeout(visite.minuterie); visite = null;
    btnVisite.textContent = '▶ Visite des sept gares';
  }
  racine.querySelector('.m3d-barre').addEventListener('click', (ev) => {
    const b = ev.target.closest('button');
    if (!b) return;
    if (b.dataset.m3dAmb) appliquerAmbiance(b.dataset.m3dAmb);
    else if (b.dataset.m3d === 'ensemble') { arreterVisite(); deselectionner(); legende.textContent = ''; cam.voler(poseEnsemble); }
    else if (b.dataset.m3d === 'visite') {
      if (visite) { arreterVisite(); return; }
      visite = { i: 0 }; b.textContent = '❚❚ Arrêter la visite';
      etapeVisite();
    }
  });
  canvas.addEventListener('pointerdown', () => arreterVisite());

  // --- Boucle de rendu ---
  let largeur = 0, hauteur = 0, raf = 0, avant = performance.now(), visible = true;
  const vp = new T.Vector3();
  function redimensionner() {
    const w = racine.clientWidth, h = racine.clientHeight;
    if (w === largeur && h === hauteur) return;
    largeur = w; hauteur = h;
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
  }
  function placerEtiquettes() {
    for (const e of etiquettes) {
      vp.copy(e.pos).project(camera);
      const derriere = vp.z > 1;
      const x = (vp.x * 0.5 + 0.5) * largeur, y = (-vp.y * 0.5 + 0.5) * hauteur;
      const dist = camera.position.distanceTo(e.pos);
      const montre = !derriere && x > -40 && x < largeur + 40 && y > -20 && y < hauteur + 20
        && (e.grande || e.gare === selection || dist < (e.monument ? 5 : 8.5));
      e.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`;
      e.el.classList.toggle('est-cache', !montre);
    }
  }
  function image(now) {
    if (!conteneur.isConnected) { detruire(); return; }
    raf = requestAnimationFrame(image);
    if (!visible || document.hidden) return;
    const dt = Math.min(0.05, (now - avant) / 1000);
    avant = now;
    redimensionner();
    cam.animer(now, dt);
    const t = now / 1000;
    for (const tr of trains) {
      // Aller, arrêt, retour, arrêt : un cycle de 2 × (trajet + 2 s).
      const L = tr.r.total, dureeTrajet = L / tr.vitesse;
      const cycle = 2 * (dureeTrajet + 2), u = (t + tr.phase) % cycle;
      let d, sens;
      if (u < dureeTrajet) { const p = u / dureeTrajet; d = L * (p * p * (3 - 2 * p)); sens = 1; }
      else if (u < dureeTrajet + 2) { d = L; sens = 1; }
      else if (u < 2 * dureeTrajet + 2) { const p = (u - dureeTrajet - 2) / dureeTrajet; d = L * (1 - p * p * (3 - 2 * p)); sens = -1; }
      else { d = 0; sens = -1; }
      tr.voitures.forEach((v, k) => {
        const e = echantillonner(tr.r, d - sens * k * 0.047);
        v.position.set(e.x, SOCLE + 0.0085, e.z);
        v.rotation.y = e.a + (sens < 0 ? Math.PI : 0);
      });
      tr.groupe.visible = d > 0.05 && d < L - 0.05;
    }
    for (const f of fantomes) {
      mat.fantome.opacity = 0.26 + 0.1 * Math.sin(t * 2.2);
      mat.fantomeTrait.opacity = 0.7 + 0.25 * Math.sin(t * 2.2);
      f.position.y = SOCLE + 0.004 * Math.sin(t * 1.3);
    }
    if (eclats && eclats.visible) {
      // Cinq secondes d'éclats toutes les quinze, comme au début de chaque heure.
      const phase = t % 15;
      eclats.material.opacity = phase < 5 ? 0.6 + 0.4 * Math.sin(t * 40) : 0;
    }
    placerEtiquettes();
    renderer.render(scene, camera);
  }
  const io = new IntersectionObserver((e) => { visible = e[0].isIntersecting; });
  io.observe(racine);
  function detruire() {
    cancelAnimationFrame(raf); io.disconnect(); arreterVisite();
    renderer.dispose();
    scene.traverse((o) => { o.geometry?.dispose?.(); });
  }

  attente.remove();
  redimensionner();
  if (opts.focus && gares.has(opts.focus)) {
    choisir(opts.focus, false);
    const g = gares.get(opts.focus);
    Object.assign(cam, { r: 6 });
    cam.maj();
    cam.voler(poseGare(g), 2400);
  }
  raf = requestAnimationFrame(image);
  // `etat` sert aux bancs d'essai : il dit si la caméra vole et si la vue est rendue.
  const tele = { choisir, detruire, camera: cam, etat: () => ({ visible, cache: document.hidden, vol: !!cam.vol, r: cam.r, theta: cam.theta }), hors: corpus.stations.filter((s) => !dansLePlan(s.coord)) };
  conteneur._maquette = tele;
  return tele;
}

// --- La vitrine : une gare seule, sur son socle ---------------------------------

/**
 * Une maquette de musée : la gare posée sur un socle, sous la lumière de son
 * illustration (matin, jour, soir ou nuit), qui tourne lentement. On la fait
 * pivoter au doigt ; la page, elle, continue de défiler normalement.
 */
export async function monterVitrine(conteneur, station) {
  if (!conteneur || typeof document === 'undefined') return null;
  const pal = station.artwork?.palette || {};
  const ciel = pal.sky || ['#AEBFCB', '#EFE8DA'];
  conteneur.innerHTML = `<div class="vitrine" style="--ciel0:${esc(ciel[0])};--ciel1:${esc(ciel[1])}">
    <canvas class="vitrine-canvas" tabindex="0" aria-label="Maquette de ${esc(station.nom)} : faites glisser pour la tourner"></canvas>
    <div class="m3d-attente">Construction de la maquette…</div>
    <p class="vitrine-aide">Faites glisser pour tourner autour de la gare</p>
  </div>`;
  const racine = conteneur.querySelector('.vitrine');
  const attente = racine.querySelector('.m3d-attente');
  let T;
  try { T = await chargerThree(); } catch { attente.textContent = 'La maquette 3D se consulte dans la version en ligne.'; return null; }
  const canvas = racine.querySelector('canvas');
  let renderer;
  try { renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true }); } catch { attente.textContent = 'La 3D (WebGL) est indisponible sur ce navigateur.'; return null; }
  renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(32, 1, 0.01, 20);

  const amb = AMB_GARE[station.artwork?.ambiance] || AMB_GARE.jour;
  const { groupe, verres } = construireGare(T, station, { tour: true });
  const demolie = estDemolie(station);
  if (demolie) enFantome(T, groupe, materiaux(T));
  // Mise à l'échelle : la gare tient sur un socle de rayon 1.
  const b0 = new T.Box3().setFromObject(groupe);
  const taille = b0.getSize(new T.Vector3()), centre = b0.getCenter(new T.Vector3());
  const ech = 1.75 / Math.max(taille.x, taille.z, taille.y * 1.6);
  groupe.scale.setScalar(ech);
  groupe.position.set(-centre.x * ech, 0, -centre.z * ech);
  scene.add(groupe);

  const socle = new T.Mesh(new T.CylinderGeometry(1.08, 1.12, 0.06, 72), new T.MeshStandardMaterial({ color: '#BFAE8E', roughness: 0.8 }));
  socle.position.y = -0.03; socle.receiveShadow = true; scene.add(socle);
  const dessus = new T.Mesh(new T.CircleGeometry(1.06, 72), new T.MeshStandardMaterial({ color: pal.stone ? new T.Color(pal.stone).lerp(new T.Color('#9A9384'), 0.35) : '#C9C1AE', roughness: 1 }));
  dessus.rotation.x = -Math.PI / 2; dessus.position.y = 0.001; dessus.receiveShadow = true; scene.add(dessus);
  // Le faisceau de voies derrière la gare, jusqu'au bord du socle.
  const rail = new T.MeshStandardMaterial({ color: '#6E665A', roughness: 1 });
  const fondZ = -taille.z * ech / 2;
  if (!['viaduct', 'museum', 'underground'].includes(station.artwork?.silhouette)) {
    for (let i = -3; i <= 3; i++) {
      const lg = 1.0 + fondZ;
      if (lg <= 0.05) continue;
      const v = new T.Mesh(new T.BoxGeometry(0.035, 0.004, lg), rail);
      v.position.set(i * 0.075, 0.003, fondZ - lg / 2 + 0.02); v.receiveShadow = true; scene.add(v);
    }
  }
  const hemi = new T.HemisphereLight(amb.hemi[0], amb.hemi[1], amb.hemi[2]);
  const soleil = new T.DirectionalLight(amb.soleil[0], amb.soleil[1]);
  soleil.position.set(amb.dir[0] * 4, amb.dir[1] * 4, amb.dir[2] * 4);
  soleil.castShadow = true; soleil.shadow.mapSize.set(1024, 1024);
  Object.assign(soleil.shadow.camera, { left: -1.4, right: 1.4, top: 1.4, bottom: -1.4, near: 0.5, far: 12 });
  soleil.shadow.bias = -0.0006;
  scene.add(hemi, soleil);
  for (const v of verres) v.emissiveIntensity = amb.verre;

  // On commence de trois quarts face, et le plateau tourne lentement vers l'autre trois-quarts.
  const cam = orbite(T, camera, canvas, { cible: [0, 0.1, 0], r: 2.9, theta: -0.55, phi: 1.1, zoom: false, pan: false, phiMax: 1.35, tourne: 0.14, repos: 3500 });
  let raf = 0, avant = performance.now(), visible = false, l = 0, h = 0;
  const io = new IntersectionObserver((e) => { visible = e[0].isIntersecting; });
  io.observe(racine);
  function image(now) {
    if (!conteneur.isConnected) { cancelAnimationFrame(raf); io.disconnect(); renderer.dispose(); return; }
    raf = requestAnimationFrame(image);
    if (!visible || document.hidden) { avant = now; return; }
    const dt = Math.min(0.05, (now - avant) / 1000); avant = now;
    const w = racine.clientWidth, hh = racine.clientHeight;
    if (w !== l || hh !== h) {
      l = w; h = hh; renderer.setSize(w, hh, false); camera.aspect = w / Math.max(1, hh); camera.updateProjectionMatrix();
      // Un cadre presque carré (téléphone) : on recule, sinon la gare déborde sur les côtés.
      cam.r = 2.9 * Math.max(1, 1.6 / camera.aspect); cam.maj();
    }
    cam.animer(now, dt);
    if (demolie) groupe.traverse((o) => { if (o.material?.opacity !== undefined && o.material.transparent) o.material.opacity = (o.isLineSegments ? 0.7 : 0.28) + 0.12 * Math.sin(now / 400); });
    renderer.render(scene, camera);
  }
  attente.remove();
  raf = requestAnimationFrame(image);
  return { detruire: () => { cancelAnimationFrame(raf); io.disconnect(); renderer.dispose(); } };
}
