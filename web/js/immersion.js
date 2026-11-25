// Immersion : se placer devant la gare, dans Paris réel.
//
// Chaque fiche porte un ou plusieurs points de vue (`immersion.vues`) : où se
// tenir (`regard`) et quoi regarder (`cible`). Le cap n'est pas écrit dans les
// données : il est calculé, de sorte qu'il pointe toujours vers la façade.
// Les liens ouvrent des services publics sans clé ni compte (Google Maps URLs,
// Google Earth, OpenStreetMap) ; rien n'est chargé tant qu'on ne clique pas.

import { makeProjection } from './carte.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const RAD = Math.PI / 180;

/** Cap géographique de a vers b, en degrés (0 = nord, 90 = est). */
export function cap(a, b) {
  const y = Math.sin((b.lon - a.lon) * RAD) * Math.cos(b.lat * RAD);
  const x = Math.cos(a.lat * RAD) * Math.sin(b.lat * RAD)
    - Math.sin(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.cos((b.lon - a.lon) * RAD);
  return ((Math.atan2(y, x) / RAD) + 360) % 360;
}

/** Distance à vol d'oiseau, en mètres. */
export function distanceM(a, b) {
  const dLat = (b.lat - a.lat) * RAD, dLon = (b.lon - a.lon) * RAD;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

const ROSE = ['nord', 'nord-est', 'est', 'sud-est', 'sud', 'sud-ouest', 'ouest', 'nord-ouest'];
export const pointCardinal = (deg) => ROSE[Math.round(deg / 45) % 8];

const f5 = (x) => Number(x).toFixed(5);

export function lienStreetView(v) {
  const h = Math.round(cap(v.regard, v.cible));
  return `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${f5(v.regard.lat)},${f5(v.regard.lon)}`
    + `&heading=${h}&pitch=${v.inclinaison ?? 10}&fov=90`;
}

/** Survol en 3D photoréaliste : la caméra se place du côté du point de vue. */
export function lienEarth(v) {
  const h = Math.round(cap(v.regard, v.cible));
  return `https://earth.google.com/web/@${f5(v.cible.lat)},${f5(v.cible.lon)},45a,520d,35y,${h}h,62t,0r`;
}

export const lienPlan = (c) =>
  `https://www.openstreetmap.org/?mlat=${f5(c.lat)}&mlon=${f5(c.lon)}#map=17/${f5(c.lat)}/${f5(c.lon)}`;

export const lienItineraire = (c) =>
  `https://www.google.com/maps/dir/?api=1&destination=${f5(c.lat)},${f5(c.lon)}&travelmode=transit`;

/**
 * Le viseur : un mini-plan de 500 m autour du point de vue, tiré de la même
 * géométrie que la grande carte, avec le cône de vision orienté vers la façade.
 */
export function viseur(corpus, station, vue, opts = {}) {
  const w = opts.width || 300, h = opts.height || 200;
  const geo = corpus.geo;
  const milieu = { lat: (vue.regard.lat + vue.cible.lat) / 2, lon: (vue.regard.lon + vue.cible.lon) / 2 };
  const dLat = 0.0026, dLon = dLat / Math.cos(milieu.lat * RAD) * (w / h);
  const bounds = { minLat: milieu.lat - dLat, maxLat: milieu.lat + dLat, minLon: milieu.lon - dLon, maxLon: milieu.lon + dLon };
  const proj = makeProjection({ bounds }, w, h, 0);
  const dedans = (pts) => pts.some(([lon, lat]) =>
    lon > bounds.minLon - 0.004 && lon < bounds.maxLon + 0.004 && lat > bounds.minLat - 0.003 && lat < bounds.maxLat + 0.003);
  const trace = (pts) => pts.map(([lon, lat], i) => {
    const [x, y] = proj(lon, lat);
    return `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join('');

  let out = `<rect width="${w}" height="${h}" class="vs-fond"/>`;
  for (const a of geo.arrondissements) if (dedans(a.contour)) out += `<path d="${trace(a.contour)}Z" class="vs-arr"/>`;
  const seine = geo.seine.filter(dedans).map(trace).join('');
  if (seine) out += `<path d="${seine}" class="vs-eau"/>`;
  const canaux = geo.canaux.filter(dedans).map(trace).join('');
  if (canaux) out += `<path d="${canaux}" class="vs-canal"/>`;
  const rails = geo.voiesFerrees.filter(dedans).map(trace).join('');
  if (rails) out += `<path d="${rails}" class="vs-rail"/>`;
  const pc = geo.petiteCeinture.filter(dedans).map(trace).join('');
  if (pc) out += `<path d="${pc}" class="vs-ceinture"/>`;

  // Cône de vision : 90° d'ouverture, comme le champ par défaut de Street View.
  const [rx, ry] = proj(vue.regard.lon, vue.regard.lat);
  const [cx, cy] = proj(vue.cible.lon, vue.cible.lat);
  const c = cap(vue.regard, vue.cible);
  const portee = Math.max(46, Math.hypot(cx - rx, cy - ry) + 26);
  const bord = (deg) => [rx + Math.sin(deg * RAD) * portee, ry - Math.cos(deg * RAD) * portee];
  const [ax, ay] = bord(c - 45), [bx, by] = bord(c + 45);
  const accent = station.artwork?.palette?.accent || '#0F4670';
  out += `<path d="M${rx.toFixed(1)} ${ry.toFixed(1)}L${ax.toFixed(1)} ${ay.toFixed(1)}A${portee.toFixed(1)} ${portee.toFixed(1)} 0 0 1 ${bx.toFixed(1)} ${by.toFixed(1)}Z" class="vs-cone"/>`;
  out += `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="6" fill="${esc(accent)}" class="vs-cible"/>`;
  out += `<circle cx="${rx.toFixed(1)}" cy="${ry.toFixed(1)}" r="5.5" class="vs-oeil"/>`;
  out += `<circle cx="${rx.toFixed(1)}" cy="${ry.toFixed(1)}" r="2" class="vs-oeil-c"/>`;
  // Rose des vents minimale : le nord, toujours en haut.
  out += `<g transform="translate(${w - 18} 20)" class="vs-nord"><path d="M0 -11L4.5 4L0 1.2L-4.5 4Z"/><text y="15" text-anchor="middle">N</text></g>`;
  const m = Math.round(distanceM(vue.regard, vue.cible));
  out += `<text x="8" y="${h - 9}" class="vs-echelle">${m} m jusqu'à la façade</text>`;

  return `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" class="viseur" role="img" `
    + `aria-label="Plan du point de vue : regard vers le ${pointCardinal(c)}">${out}</svg>`;
}

/** Rangée de raccourcis compacte, en tête de fiche ou dans un panneau. */
export function raccourcisImmersion(station, opts = {}) {
  const v = station.immersion?.vues?.[0];
  if (!v) return '';
  const dedansParis = opts.maquette !== false;
  return `<div class="raccourcis">
    <a class="raccourci" href="${esc(lienStreetView(v))}" target="_blank" rel="noopener"><i>◉</i>Street View<span>↗</span></a>
    ${dedansParis ? `<a class="raccourci" href="#/carte/3d/${esc(station.id)}"><i>▲</i>Maquette 3D</a>` : ''}
    <a class="raccourci" href="${esc(lienEarth(v))}" target="_blank" rel="noopener"><i>◍</i>Survol 3D réel<span>↗</span></a>
  </div>`;
}

/** La section « S'y croire » d'une fiche de gare. */
export function blocImmersion(corpus, station, opts = {}) {
  const vues = station.immersion?.vues || [];
  if (!vues.length) return '';
  const v0 = vues[0];
  return `
  <section class="section immersion">
    <div class="eyebrow">S'y croire</div>
    <h2>Entrer dans le décor</h2>
    <p class="lede">Chaque point de vue ouvre Street View à l'endroit marqué sur le plan, tourné vers la façade :
    le cap est calculé par l'application, du point de vue vers la gare. Faites glisser pour regarder autour de vous.</p>
    <div class="vues">
      ${vues.map((v) => {
        const c = cap(v.regard, v.cible);
        return `
        <article class="vue">
          <div class="vue-viseur">${viseur(corpus, station, v)}</div>
          <div class="vue-corps">
            <span class="vue-cap">Cap ${Math.round(c)}° · vers le ${pointCardinal(c)}</span>
            <h4>${esc(v.titre)}</h4>
            <a class="bouton" href="${esc(lienStreetView(v))}" target="_blank" rel="noopener">Ouvrir Street View ↗</a>
          </div>
        </article>`;
      }).join('')}
    </div>
    <div class="immersion-liens">
      <a href="${esc(lienEarth(v0))}" target="_blank" rel="noopener"><b>Survol en 3D réelle</b><span>Google Earth, bâtiments photographiés ↗</span></a>
      ${opts.maquette !== false ? `<a href="#/carte/3d/${esc(station.id)}"><b>Dans la maquette de Paris</b><span>La gare parmi les autres, en volume →</span></a>` : ''}
      <a href="${esc(lienPlan(station.coord))}" target="_blank" rel="noopener"><b>Plan du quartier</b><span>OpenStreetMap ↗</span></a>
      <a href="${esc(lienItineraire(station.coord))}" target="_blank" rel="noopener"><b>Y aller en transports</b><span>Itinéraire depuis votre position ↗</span></a>
    </div>
    <p class="immersion-note">Street View affiche le panorama le plus proche du point marqué : selon les images disponibles,
    ce peut être une photographie déposée par un visiteur. Ces services s'ouvrent dans un nouvel onglet et ne
    fonctionnent qu'en ligne ; rien ne leur est transmis tant que vous ne cliquez pas.</p>
  </section>`;
}
