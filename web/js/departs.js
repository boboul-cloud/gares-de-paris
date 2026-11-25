// Le tableau des départs : celui des halls de gare, à palettes qui claquent.
//
// Les « trains » affichés sont les dates des fiches : chaque ligne part d'une
// gare, à une année, vers un événement. Les pages défilent dans l'ordre
// chronologique, de l'embarcadère de 1837 aux chantiers d'aujourd'hui, et
// chaque ligne ouvre la fiche de sa gare. Les lettres tournent comme sur les
// anciens tableaux Solari : chaque palette passe par les caractères
// intermédiaires avant de s'arrêter.

import { evenementsDates } from './carte.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ALPHABET = " ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-'.,:";
const LIGNES = 6;

/** Majuscules sans accents, comme sur les palettes d'origine. */
export function enPalettes(texte, n) {
  const t = String(texte).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase()
    .replace(/[«»"]/g, '').replace(/[—–]/g, '-').replace(/Œ/g, 'OE').replace(/Æ/g, 'AE')
    .replace(/[^A-Z0-9 \-'.,:]/g, ' ').replace(/\s+/g, ' ').trim();
  if (t.length <= n) return t.padEnd(n, ' ');
  // Trop long : on coupe au dernier mot entier, et le point suit le mot.
  const coupe = t.slice(0, n - 1);
  const esp = coupe.lastIndexOf(' ');
  // Un tiret ou une virgule orphelins ne précèdent pas le point (« RANG-DU-FLIERS. »).
  return ((esp > n * 0.6 ? coupe.slice(0, esp) : coupe).replace(/[\s\-',.:]+$/, '') + '.').padEnd(n, ' ');
}

/**
 * Fait tourner une palette jusqu'au caractère voulu, en passant par au plus
 * neuf caractères intermédiaires, comme un vrai volet qui rattrape son retard.
 * Partagée avec le tableau en direct des fiches (direct.js).
 */
export function tournerPalette(caseEl, cible, delai = 0) {
  // Chaque appel porte un numéro : si un nouvel affichage arrive pendant que
  // la palette tourne encore, l'ancienne rotation s'arrête d'elle-même, sans
  // quoi elle écraserait le nouveau caractère (deux gares mélangées).
  const tour = (caseEl._tour = (caseEl._tour || 0) + 1);
  const fin = Math.max(0, ALPHABET.indexOf(cible));
  const depart = Math.max(0, ALPHABET.indexOf(caseEl.textContent));
  if (depart === fin) { caseEl.textContent = ALPHABET[fin]; return; }
  if (globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { caseEl.textContent = ALPHABET[fin]; return; }
  const pas = (fin - depart + ALPHABET.length) % ALPHABET.length;
  const sauts = Math.min(pas, 6 + Math.floor(Math.random() * 4));
  let i = 0;
  setTimeout(function un() {
    if (!caseEl.isConnected || caseEl._tour !== tour) return;
    i++;
    caseEl.textContent = ALPHABET[i >= sauts ? fin : (depart + Math.round((pas * i) / sauts)) % ALPHABET.length];
    caseEl.classList.remove('flap'); void caseEl.offsetWidth; caseEl.classList.add('flap');
    if (i < sauts) setTimeout(un, 55 + Math.random() * 25);
  }, delai);
}

const nomGare = (s) => (s.nomCourt || s.nom).replace(/^Gare (du |de l'|de )/, '');
const arr = (s) => { const m = /^(\d+)/.exec(s.arrondissement || ''); return m ? (m[1] === '1' ? '1ER' : m[1] + 'E') : '--'; };

export function tableauDeparts() {
  return `<section class="solari" data-solari aria-label="Tableau des départs : les grandes dates des gares de Paris">
    <header class="solari-tete">
      <span class="solari-titre">Départs</span>
      <span class="solari-sous">Grandes lignes de l'histoire</span>
      <span class="solari-heure" data-solari-heure aria-hidden="true">--:--</span>
    </header>
    <div class="solari-cols" aria-hidden="true"><span>Année</span><span>Gare</span><span>Événement</span><span>Arr.</span></div>
    <ol class="solari-lignes"></ol>
    <footer class="solari-pied"><span data-solari-page></span><span>Une ligne ouvre la fiche de sa gare</span></footer>
  </section>`;
}

export function armerTableau(racine, corpus) {
  const bloc = racine.querySelector('[data-solari]');
  if (!bloc || bloc._arme) return;
  bloc._arme = true;
  const evts = evenementsDates(corpus);
  const pages = [];
  for (let i = 0; i < evts.length; i += LIGNES) pages.push(evts.slice(i, i + LIGNES));
  const liste = bloc.querySelector('.solari-lignes');
  const pied = bloc.querySelector('[data-solari-page]');
  const heure = bloc.querySelector('[data-solari-heure]');
  let page = 0, minuterie = 0, survol = false, largeurs = null;

  // Le nombre de palettes suit la largeur du tableau. Sur un écran étroit, un
  // départ tient sur deux lignes : année, gare et arrondissement, puis l'événement.
  function mesurer() {
    const w = bloc.clientWidth;
    const etroit = w < 560;
    const cell = etroit ? 12 : 17, pas = cell + 2;
    const interieur = w - (etroit ? 20 : 36) - 12;
    if (etroit) {
      const n = Math.floor(interieur / pas);
      return { etroit, cell, an: 4, gare: Math.max(6, n - 4 - 3 - 2), arr: 3, evt: Math.max(10, n) };
    }
    const n = Math.floor((interieur - 3 * 12 - (4 + 13 + 3) * pas) / pas);
    return { etroit, cell, an: 4, gare: 13, arr: 3, evt: Math.max(10, Math.min(30, n)) };
  }

  function construire() {
    largeurs = mesurer();
    bloc.style.setProperty('--cell', largeurs.cell + 'px');
    bloc.classList.toggle('est-etroit', largeurs.etroit);
    // Les intitulés prennent exactement la largeur de leurs palettes (2 px d'écart entre deux).
    const cols = bloc.querySelectorAll('.solari-cols span');
    [largeurs.an, largeurs.gare, largeurs.evt, largeurs.arr].forEach((n, i) => {
      cols[i].style.width = `${n * (largeurs.cell + 2) - 2}px`;
    });
    const cases = (n) => '<span class="p"> </span>'.repeat(n);
    liste.innerHTML = Array.from({ length: LIGNES }, () => `<li><a href="#/">
      <span class="champ an">${cases(largeurs.an)}</span>
      <span class="champ gare">${cases(largeurs.gare)}</span>
      <span class="champ evt">${cases(largeurs.evt)}</span>
      <span class="champ arr">${cases(largeurs.arr)}</span>
      <span class="sr-only"></span></a></li>`).join('');
  }

  function afficher(n) {
    const p = pages[n % pages.length];
    pied.textContent = `Page ${(n % pages.length) + 1} / ${pages.length} · ${p[0].annee} — ${p[p.length - 1].annee}`;
    [...liste.children].forEach((li, i) => {
      const e = p[i];
      const a = li.querySelector('a');
      const champs = e
        ? { an: String(e.annee), gare: nomGare(e.gare), evt: e.titre || e.texte, arr: arr(e.gare) }
        : { an: '', gare: '', evt: '', arr: '' };
      a.href = e ? '#/gare/' + e.gare.id : '#/';
      a.tabIndex = e ? 0 : -1;
      a.querySelector('.sr-only').textContent = e ? `${e.libelle}, ${e.gare.nom} : ${e.titre}` : '';
      for (const [cle, val] of Object.entries(champs)) {
        const cases = li.querySelectorAll(`.${cle} .p`);
        const txt = enPalettes(val, cases.length);
        cases.forEach((c, k) => tournerPalette(c, txt[k], i * 70 + k * 18));
      }
    });
  }

  function suivant() {
    if (!bloc.isConnected) return;
    if (!survol && !document.hidden) afficher(++page);
    minuterie = setTimeout(suivant, 7000);
  }
  function horloge() {
    if (!bloc.isConnected) return;
    const d = new Date();
    heure.textContent = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    setTimeout(horloge, 15000);
  }

  bloc.addEventListener('pointerenter', () => { survol = true; });
  bloc.addEventListener('pointerleave', () => { survol = false; });
  bloc.addEventListener('focusin', () => { survol = true; });
  bloc.addEventListener('focusout', () => { survol = false; });
  let largeurAvant = bloc.clientWidth;
  globalThis.addEventListener?.('resize', () => {
    if (!bloc.isConnected || Math.abs(bloc.clientWidth - largeurAvant) < 30) return;
    largeurAvant = bloc.clientWidth;
    construire(); afficher(page);
  });

  construire();
  afficher(page);
  horloge();
  clearTimeout(minuterie);
  minuterie = setTimeout(suivant, 7000);
}
