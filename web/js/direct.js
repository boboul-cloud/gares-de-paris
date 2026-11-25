// En direct : les départs et les arrivées de la gare, maintenant.
//
// Le site ne parle pas aux API de la SNCF et d'Île-de-France Mobilités : il
// interroge le relais (worker/), qui garde les clés et met les réponses en
// cache. Tant que l'adresse du relais n'est pas renseignée ci-dessous, la
// section n'existe pas : le site public reste exactement tel qu'il était.
//
// Pour essayer en local avec le relais de développement :
//   localStorage.setItem('gdp-relais', 'http://127.0.0.1:8787')
// (et removeItem pour revenir au comportement normal).
//
// Le tableau reprend les palettes du tableau de l'accueil, et les couleurs des
// écrans de gare : bleu pour les départs, vert pour les arrivées.

import { enPalettes, tournerPalette } from './departs.js';

/** Adresse du relais en ligne. Vide tant que les clés ne sont pas installées. */
export const RELAIS = null;

export function adresseRelais() {
  try { return localStorage.getItem('gdp-relais') || RELAIS; } catch { return RELAIS; }
}

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const RAFRAICHIR = 90 * 1000;
const LIGNES = 10;
const RESEAUX = { 'grandes-lignes': 'Grandes lignes', 'ile-de-france': 'RER et Transilien' };

export function blocDirect(corpus, station, relais = adresseRelais()) {
  const d = corpus.direct?.gares?.[station.id];
  if (!relais || !d) return '';
  const tete = `<div class="eyebrow">En direct</div><h2>Les trains, maintenant</h2>`;
  if (d.ferme) {
    return `<section class="section direct">${tete}
      <div class="direct-tableau est-ferme"><header><span class="direct-titre">Départs</span></header>
        <p class="direct-ferme">${esc(d.ferme)}</p></div></section>`;
  }
  return `
  <section class="section direct" data-direct="${esc(station.id)}" data-relais="${esc(relais)}">
    ${tete}
    <p class="lede">${esc(corpus.direct.avertissement)}</p>
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
        <span class="direct-heure">--:--</span>
      </header>
      <div class="direct-cols" aria-hidden="true"><span class="c-heure">Heure</span><span class="c-train">Train</span><span class="c-lieu">Destination</span><span class="c-voie">Voie</span><span class="c-info">Information</span></div>
      <ol class="direct-lignes"></ol>
      <p class="direct-etat" role="status"></p>
    </div>
    <p class="direct-note"></p>
  </section>`;
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

  function texteInfo(t) {
    if (t.etat === 'supprime') return ['Supprimé', 'est-supprime'];
    if (t.etat === 'retard') return [`Retard ${t.retard} min · ${t.reelle.replace(':', ' h ')}`, 'est-retard'];
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
      ecrire(li.querySelector('.c-lieu'), t ? (t.lieu || t.ligne.nom) : '', i * 60 + 80);
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
    const sources = d.sources.map((s) => `${s.nom}${s.ok ? '' : ` (${s.erreur})`}`).join(' · ');
    etatEl.textContent = trains.length ? (motif ? `${motif.prevue} — ${motif.message}` : '') : 'Aucun train annoncé pour le moment.';
    note.innerHTML = `${d.exemple ? '<b class="direct-exemple">Données d’exemple</b> — le relais n’a pas encore ses clés d’accès : ces trains sont fictifs, au format exact des API. ' : ''}`
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
