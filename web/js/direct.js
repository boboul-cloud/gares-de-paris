// En direct : les départs et les arrivées de la gare, maintenant.
//
// Le site ne parle pas lui-même aux sources (SNCF, Île-de-France Mobilités) :
// il interroge le relais (worker/), qui garde les clés et met les réponses en
// cache. Sans adresse de relais, la section n'existe pas.
//
// Pour essayer en local avec le relais de développement :
//   localStorage.setItem('gdp-relais', 'http://127.0.0.1:8787')
// (et removeItem pour revenir au comportement normal).
//
// Le tableau reprend les palettes du tableau de l'accueil, et les couleurs des
// écrans de gare : bleu pour les départs, vert pour les arrivées.

import { enPalettes, tournerPalette } from './departs.js';

/** Adresse du relais en ligne (worker/, publié sur Cloudflare Workers). */
export const RELAIS = 'https://gares-de-paris-direct.riskelo-salon.workers.dev';

export function adresseRelais() {
  // Ouverte depuis un fichier (la version en un seul fichier de dist/), la page
  // n'a pas d'origine que le relais puisse reconnaître : pas de tableau.
  if (globalThis.location?.protocol && !/^https?:$/.test(globalThis.location.protocol)) return null;
  try { return localStorage.getItem('gdp-relais') || RELAIS; } catch { return RELAIS; }
}

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const RAFRAICHIR = 90 * 1000;
const LIGNES = 10;
const RESEAUX = { 'grandes-lignes': 'Grandes lignes', 'ile-de-france': 'RER et Transilien' };

/**
 * Le tableau d'une gare. Sur une fiche, il vient avec son titre et renvoie à
 * la page « En direct » ; sur cette page (page: true), c'est elle qui titre.
 */
export function blocDirect(corpus, station, relais = adresseRelais(), { page = false } = {}) {
  const d = corpus.direct?.gares?.[station.id];
  if (!relais || !d) return '';
  const tete = page ? '' : `<div class="eyebrow">En direct</div><h2>Les trains, maintenant</h2>`;
  const [balise, classe] = page ? ['div', 'direct'] : ['section', 'section direct'];
  if (d.ferme) {
    return `<${balise} class="${classe}">${tete}
      <div class="direct-tableau est-ferme"><header><span class="direct-titre">Départs</span></header>
        <p class="direct-ferme">${esc(d.ferme)}</p></div></${balise}>`;
  }
  return `
  <${balise} class="${classe}" data-direct="${esc(station.id)}" data-relais="${esc(relais)}">
    ${tete}
    ${page ? '' : `<p class="lede">${esc(corpus.direct.avertissement)}</p>`}
    ${d.points.length > 1 ? `<div class="chips direct-points" role="group" aria-label="Gare">${d.points.map((p, i) =>
      `<button type="button" class="chip${i ? '' : ' on'}" data-direct-point="${i}" aria-pressed="${!i}">${esc(p.nom)}</button>`).join('')}</div>` : ''}
    <div class="direct-commandes">
      <div class="onglets" role="tablist" aria-label="Sens">
        <button type="button" role="tab" class="on" aria-selected="true" data-direct-sens="departs">Départs</button>
        <button type="button" role="tab" aria-selected="false" data-direct-sens="arrivees">Arrivées</button>
      </div>
      <div class="onglets" role="tablist" aria-label="Réseau" data-direct-reseaux hidden></div>
    </div>
    <div class="direct-tableau est-departs" aria-live="off">
      <header>
        <span class="direct-titre">Départs</span>
        <span class="direct-gare">${esc(d.points[0].nom)}</span>
        <span class="direct-tag" title="Trains fictifs, en attendant la clé d’accès">Exemple</span>
        <span class="direct-heure">--:--</span>
      </header>
      <div class="direct-cols" aria-hidden="true"><span class="c-heure">Heure</span><span class="c-train">Train</span><span class="c-lieu">Destination</span><span class="c-voie">Voie</span><span class="c-info">Information</span></div>
      <ol class="direct-lignes"></ol>
      <p class="direct-etat" role="status"></p>
    </div>
    <p class="direct-note"></p>
    ${page ? '' : `<p class="direct-renvoi"><a href="#/direct/${esc(station.id)}">Toutes les gares en direct →</a></p>`}
  </${balise}>`;
}

/* ------------------------------------------------------ la page « En direct » */

const MEMOIRE = 'gdp-direct-gare';
const ADRESSE_SITE = 'https://boboul-cloud.github.io/gares-de-paris/';

/** Les gares de la page, par groupe : celles qui ont un tableau, dans l'ordre de direct.json. */
export function groupesDirect(corpus) {
  const d = corpus.direct;
  return (d?.groupes || []).map((gr) => ({ nom: gr.nom, gares: gr.gares.filter((id) => d.gares[id]?.points) }))
    .filter((gr) => gr.gares.length);
}

/** La gare montrée d'abord : la dernière choisie, sinon la première de la liste. */
function gareParDefaut(ids) {
  let memo = null;
  try { memo = localStorage.getItem(MEMOIRE); } catch { /* stockage indisponible */ }
  return ids.includes(memo) ? memo : ids[0];
}

export function vueDirect(corpus, id, relais = adresseRelais()) {
  const d = corpus.direct;
  const groupes = groupesDirect(corpus);
  const ids = groupes.flatMap((gr) => gr.gares);
  const choisie = id || gareParDefaut(ids);
  const g = Object.hasOwn(d.gares, choisie) ? d.gares[choisie] : null;
  const fiche = (x) => corpus.stations.find((s) => s.id === x);
  if (g && ids.includes(choisie)) {
    try { localStorage.setItem(MEMOIRE, choisie); } catch { /* stockage indisponible */ }
  }

  // Les boutons sont des liens : la gare choisie est dans l'adresse, qu'on
  // peut partager, et le bouton Retour du navigateur revient à la précédente.
  const choix = groupes.map((gr) => `
      <div class="direct-groupe">
        <h3>${esc(gr.nom)}</h3>
        <div class="chips">${gr.gares.map((x) => x === choisie
          ? `<a class="chip on" href="#/direct/${esc(x)}" aria-current="page">${esc(d.gares[x].court)}</a>`
          : `<a class="chip" href="#/direct/${esc(x)}" data-garder-defilement>${esc(d.gares[x].court)}</a>`).join('')}</div>
      </div>`).join('');

  let tableau;
  if (!g) {
    tableau = `<p class="direct-renvoi">Cette gare n'a pas de tableau en direct : choisissez-en une ci-dessus.</p>`;
  } else if (!relais) {
    // Ouverte depuis un fichier, la page n'a pas d'origine que le relais reconnaisse.
    tableau = `<p class="direct-renvoi">Le tableau en direct a besoin de la version en ligne :
      <a href="${ADRESSE_SITE}#/direct/${esc(choisie)}">boboul-cloud.github.io/gares-de-paris</a>.</p>`;
  } else {
    tableau = blocDirect(corpus, { id: choisie }, relais, { page: true });
  }

  // Sous le tableau, la fiche de la gare ; une gare sans fiche dit pourquoi,
  // et renvoie à celle qui lui est liée.
  const s = g && fiche(choisie), voir = g?.voir && fiche(g.voir);
  const renvoi = s ? `<p class="direct-renvoi"><a href="#/gare/${esc(s.id)}">La fiche de la gare : ${esc(s.nom)} →</a></p>`
    : g?.texte ? `<p class="direct-renvoi">${esc(g.texte)}${voir ? ` <a href="#/gare/${esc(voir.id)}">La fiche de ${esc(voir.nom)} →</a>` : ''}</p>`
    : '';

  return `
  <div class="wrap">
    <section class="section direct-page">
      <div class="eyebrow">En direct</div>
      <h2>${g ? esc(g.nom || s?.nom || d.gares[choisie].court) : 'Les trains, maintenant'}</h2>
      <p class="lede">${esc(d.avertissement)}</p>
      <nav class="direct-choix" aria-label="Choisir une gare">${choix}
      </nav>
      ${tableau}
      ${renvoi}
    </section>
  </div>`;
}

/**
 * Un nom de gare à la longueur d'un tableau : « Aéroport Charles de Gaulle 2
 * (Terminal 2) » devient « Aéroport CDG 2 », les précisions entre parenthèses tombent.
 */
export function nomCourt(nom) {
  return String(nom ?? '')
    .replace(/A[ée]roport Charles[- ]de[- ]Gaulle/i, 'Aéroport CDG')
    .replace(/\s*\([^)]*\)\s*$/, '')
    .trim();
}

/** Les cellules d'un champ à palettes : on ne les recrée pas, on les fait tourner. */
function ecrire(champ, texte, delai) {
  const cases = champ.querySelectorAll('.p');
  const t = enPalettes(texte, cases.length);
  cases.forEach((c, k) => tournerPalette(c, t[k], delai + k * 16));
}

export function armerDirect(racine) {
  const bloc = racine.querySelector('[data-direct]');
  if (!bloc || bloc._arme) return;
  bloc._arme = true;
  const gare = bloc.dataset.direct, relais = bloc.dataset.relais.replace(/\/$/, '');
  const tableau = bloc.querySelector('.direct-tableau');
  const liste = bloc.querySelector('.direct-lignes');
  const etatEl = bloc.querySelector('.direct-etat');
  const note = bloc.querySelector('.direct-note');
  const ongletsReseaux = bloc.querySelector('[data-direct-reseaux]');
  const etat = { sens: 'departs', reseau: null, point: 0, donnees: null, minuterie: 0, dernier: 0, enCours: null, largeur: 0, cases: null };

  // Le nombre de palettes de la destination suit la largeur du tableau.
  function construire() {
    const w = tableau.clientWidth;
    const etroit = w < 620;
    const cell = etroit ? 12 : 15;
    const lieu = etroit ? Math.max(12, Math.floor((w - 28) / (cell + 2))) : Math.max(12, Math.min(26, Math.floor((w - 40 - 7 * (cell + 2) - 96 - 150 - 48) / (cell + 2))));
    etat.cases = { lieu, cell, etroit };
    etat.largeur = w;
    tableau.style.setProperty('--cell', cell + 'px');
    tableau.classList.toggle('est-etroit', etroit);
    const p = (n) => '<span class="p"> </span>'.repeat(n);
    liste.innerHTML = Array.from({ length: LIGNES }, () => `<li>
      <span class="champ c-heure">${p(5)}</span>
      <span class="c-train"><b class="badge"></b><small></small></span>
      <span class="champ c-lieu">${p(lieu)}</span>
      <span class="champ c-voie">${p(2)}</span>
      <span class="c-info"></span>
      <span class="sr-only"></span>
    </li>`).join('');
  }

  // Un écart d'une à quatre minutes est fréquent au RER : on le dit sans
  // alarme ; à partir de cinq, le retard s'affiche et clignote, comme en gare.
  function texteInfo(t) {
    if (t.etat === 'supprime') return ['Supprimé', 'est-supprime'];
    if (t.etat === 'retard' && t.retard >= 5) return [`Retard ${t.retard} min · ${t.reelle.replace(':', ' h ')}`, 'est-retard'];
    if (t.etat === 'retard' && t.retard >= 1) return [`+${t.retard} min`, 'est-leger'];
    if (t.aQuai) return ['À quai', 'est-quai'];
    return [t.etat === 'a-l-heure' ? "À l'heure" : '', ''];
  }

  function afficher() {
    const d = etat.donnees;
    if (!d) return;
    const presents = Object.keys(RESEAUX).filter((r) => d.trains.some((t) => t.reseau === r));
    if (!presents.includes(etat.reseau)) etat.reseau = presents[0] || 'grandes-lignes';
    ongletsReseaux.hidden = presents.length < 2;
    ongletsReseaux.innerHTML = presents.map((r) => `<button type="button" role="tab" data-direct-reseau="${r}" class="${r === etat.reseau ? 'on' : ''}" aria-selected="${r === etat.reseau}">${RESEAUX[r]}</button>`).join('');
    const trains = d.trains.filter((t) => t.reseau === etat.reseau).slice(0, LIGNES);
    bloc.querySelector('.direct-heure').textContent = d.heure || '--:--';
    bloc.querySelector('.direct-cols .c-lieu').textContent = etat.sens === 'arrivees' ? 'Provenance' : 'Destination';
    [...liste.children].forEach((li, i) => {
      const t = trains[i];
      li.classList.toggle('est-vide', !t);
      li.classList.toggle('est-supprime', t?.etat === 'supprime');
      ecrire(li.querySelector('.c-heure'), t ? t.prevue : '', i * 60);
      ecrire(li.querySelector('.c-lieu'), t ? (nomCourt(t.lieu) || t.ligne.nom) : '', i * 60 + 80);
      ecrire(li.querySelector('.c-voie'), t?.voie ? String(t.voie).slice(-2).padStart(2, ' ') : '', i * 60 + 160);
      const badge = li.querySelector('.badge');
      badge.textContent = t ? t.ligne.court : '';
      badge.style.background = t ? t.ligne.couleur : 'transparent';
      badge.style.color = t ? t.ligne.texte : 'inherit';
      badge.title = t ? t.ligne.nom : '';
      li.querySelector('small').textContent = t ? (t.mission || t.numero) : '';
      const [info, classe] = t ? texteInfo(t) : ['', ''];
      const ci = li.querySelector('.c-info');
      ci.textContent = info;
      ci.className = `c-info ${classe}`;
      ci.title = t?.message || '';
      li.querySelector('.sr-only').textContent = t
        ? `${t.prevue}, ${t.ligne.nom} ${t.numero}, ${etat.sens === 'arrivees' ? 'en provenance de' : 'vers'} ${t.lieu || 'destination non précisée'}${t.voie ? ', voie ' + t.voie : ''}. ${info}${t.message ? '. ' + t.message : ''}`
        : '';
    });
    // Le motif de la première perturbation, comme le bandeau défilant des écrans.
    const motif = trains.find((t) => t.message);
    etatEl.textContent = trains.length ? (motif ? `${motif.prevue} — ${motif.message}` : d.remarque || '') : d.remarque || 'Aucun train annoncé pour le moment.';
    // Chaque source dit si elle est réelle : les grandes lignes peuvent être en
    // direct pendant que le RER attend encore sa clé.
    const source = etat.reseau === 'ile-de-france' ? 'prim' : 'sncf';
    const enExemple = d.sources.some((s) => s.source === source && s.exemple);
    tableau.classList.toggle('est-exemple', enExemple);
    const sources = d.sources.map((s) => `${s.nom}${s.exemple ? ' (exemple fictif)' : ''}${s.ok ? '' : ` (${s.erreur})`}`).join(' · ');
    note.innerHTML = (enExemple ? `<b class="direct-exemple">Données d’exemple</b> — en attendant la clé d’accès ${source === 'prim' ? 'd’Île-de-France Mobilités' : 'de la SNCF'}, ces trains sont fictifs, au format exact de l’API. ` : '')
      + `Mis à jour à ${esc((d.heure || '').replace(':', ' h '))} · sources : ${esc(sources)}.`;
  }

  async function charger() {
    if (!bloc.isConnected) return arreter();
    etat.enCours?.abort();
    const ctrl = new AbortController();
    etat.enCours = ctrl;
    const minuteur = setTimeout(() => ctrl.abort(), 9000);
    tableau.classList.add('est-chargement');
    try {
      const u = `${relais}/tableau?gare=${encodeURIComponent(gare)}&point=${etat.point}&sens=${etat.sens}`;
      const rep = await fetch(u, { signal: ctrl.signal });
      const corps = await rep.json();
      if (!rep.ok && !corps.trains) throw new Error(corps.erreur || `relais ${rep.status}`);
      etat.donnees = corps;
      etat.dernier = Date.now();
      afficher();
      if (!rep.ok) etatEl.textContent = 'Les sources ne répondent pas pour le moment. Nouvel essai dans une minute et demie.';
    } catch (e) {
      if (ctrl.signal.aborted && etat.enCours !== ctrl) return;
      etat.donnees = null;
      [...liste.children].forEach((li, i) => {
        ecrire(li.querySelector('.c-heure'), '', 0); ecrire(li.querySelector('.c-voie'), '', 0);
        ecrire(li.querySelector('.c-lieu'), i === 0 ? 'Information indisponible' : '', i * 40);
        li.querySelector('.badge').textContent = ''; li.querySelector('.badge').style.background = 'transparent';
        li.querySelector('small').textContent = ''; li.querySelector('.c-info').textContent = '';
      });
      etatEl.textContent = navigator.onLine === false
        ? 'Hors connexion : le tableau en direct a besoin d’internet. Le reste de l’application fonctionne.'
        : 'Le relais ne répond pas. Nouvel essai dans une minute et demie.';
      note.textContent = '';
    } finally {
      clearTimeout(minuteur);
      if (etat.enCours === ctrl) etat.enCours = null;
      tableau.classList.remove('est-chargement');
    }
  }

  function arreter() { clearInterval(etat.minuterie); etat.enCours?.abort(); document.removeEventListener('visibilitychange', visibilite); }
  function visibilite() {
    if (!bloc.isConnected) return arreter();
    if (document.visibilityState === 'visible' && Date.now() - etat.dernier > 60000) charger();
  }

  bloc.addEventListener('click', (ev) => {
    const b = ev.target.closest('button');
    if (!b) return;
    if (b.dataset.directSens) {
      etat.sens = b.dataset.directSens;
      bloc.querySelectorAll('[data-direct-sens]').forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-selected', String(x === b)); });
      tableau.classList.toggle('est-departs', etat.sens === 'departs');
      tableau.classList.toggle('est-arrivees', etat.sens === 'arrivees');
      bloc.querySelector('.direct-titre').textContent = etat.sens === 'arrivees' ? 'Arrivées' : 'Départs';
      charger();
    } else if (b.dataset.directReseau) {
      etat.reseau = b.dataset.directReseau;
      afficher();
    } else if (b.dataset.directPoint) {
      etat.point = +b.dataset.directPoint;
      bloc.querySelectorAll('[data-direct-point]').forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', String(x === b)); });
      bloc.querySelector('.direct-gare').textContent = b.textContent;
      etat.reseau = null;
      charger();
    }
  });
  document.addEventListener('visibilitychange', visibilite);
  globalThis.addEventListener?.('resize', () => {
    if (!bloc.isConnected || Math.abs(tableau.clientWidth - etat.largeur) < 40) return;
    construire(); afficher();
  });

  construire();
  charger();
  etat.minuterie = setInterval(() => {
    if (!bloc.isConnected) return arreter();
    if (document.visibilityState === 'visible') charger();
  }, RAFRAICHIR);
}
