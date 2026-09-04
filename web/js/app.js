import { stationArtwork, trackPlan } from './artwork.js';
import { parisMap, initCartes, vientDeGlisser } from './carte.js';
import { vueSimulateur, initSimulateur, etatInitial } from './croisement.js';
import { vueExercices, initExercices, etatExercices } from './exercices.js';

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const view = $('#view');

let C = null;                                   // corpus
const byId = (id) => C.stations.find((s) => s.id === id);
const accentOf = (s) => (s.artwork && s.artwork.palette && s.artwork.palette.accent) || 'var(--accent)';

const CATEGORIES = [
  { id: 'toutes', nom: 'Toutes' },
  { id: 'grande-gare', nom: 'Les sept grandes gares' },
  { id: 'gare-patrimoine', nom: 'Patrimoine et gares disparues' },
  { id: 'gare-moderne', nom: 'Le rail contemporain' },
];

const MODES = { metro: 'Métro', rer: 'RER', marche: 'À pied', tram: 'Tramway', bus: 'Bus' };

/* ---------------------------------------------------------------- fragments */

const stationCard = (s) => `
  <a class="card" href="#/gare/${esc(s.id)}" style="--c:${accentOf(s)}">
    <div class="card-art">${stationArtwork(s, { width: 640, height: 320 })}</div>
    <div class="card-body">
      <div class="card-kicker"><i></i>${esc(s.surnom || s.categorie)}</div>
      <h3>${esc(s.nom)}</h3>
      <p>${esc(s.resume)}</p>
      <div class="card-foot"><span>${esc(s.ouverture)}</span><span>${esc(s.arrondissement)}</span></div>
    </div>
  </a>`;

const statBlock = (chiffres) => !chiffres?.length ? '' : `
  <div class="stats">${chiffres.map((c) => `
    <div class="stat"><b>${esc(c.valeur)}</b><span>${esc(c.label)}</span>${c.note ? `<i>${esc(c.note)}</i>` : ''}</div>`).join('')}
  </div>`;

const lignesTags = (arr, color) => (arr || []).map((l) => `<span class="tag line" style="--c:${color}">${esc(l)}</span>`).join('');
const tags = (arr) => (arr || []).map((t) => `<span class="tag">${esc(t)}</span>`).join('');

/* -------------------------------------------------------------------- vues */

function vueAccueil() {
  const grandes = C.stations.filter((s) => s.categorie === 'grande-gare');
  return `
  <div class="wrap">
    <section class="hero">
      <div class="eyebrow">Paris — 1837 à aujourd'hui</div>
      <h1>Les gares de Paris,<br>et ce qu'elles racontent</h1>
      <p class="lede">Quatorze lieux, cent quatre-vingt-dix ans d'histoire : l'invention de la gare,
      le passage de la vapeur à l'électricité, la naissance de la grande vitesse, et la vie quotidienne
      de bâtiments par lesquels transitent chaque jour près de deux millions de personnes.
      Avec un circuit pour les visiter, gare après gare.</p>
      <div class="hero-stats">
        <div><b>14</b><span>gares racontées</span></div>
        <div><b>4</b><span>circuits de visite</span></div>
        <div><b>1837</b><span>la première, Saint-Lazare</span></div>
        <div><b>574,8 km/h</b><span>le record du TGV</span></div>
      </div>
    </section>

    <section class="section">
      <div class="eyebrow">Le plan</div>
      <h2>Toutes les gares, d'un coup d'œil</h2>
      <p class="lede">Cliquez sur un point pour ouvrir la fiche de la gare.</p>
      <div style="margin-top:24px">${parisMap(C, { width: 940, height: 620 })}</div>
    </section>

    <section class="section">
      <div class="eyebrow">Les sept sœurs</div>
      <h2>Les grandes gares</h2>
      <p class="lede">Sept terminus, sept compagnies disparues, sept directions de la France.</p>
      <div class="grid" style="margin-top:26px">${grandes.map(stationCard).join('')}</div>
    </section>

    <section class="section">
      <div class="eyebrow">Aller plus loin</div>
      <h2>Cinq dossiers</h2>
      <div class="grid" style="margin-top:24px">
        <a class="card" href="#/circuits"><div class="card-body" style="padding:26px">
          <div class="card-kicker"><i style="background:#B03A2E"></i>Circuits</div>
          <h3>Visiter les gares</h3>
          <p>Quatre itinéraires clés en main, avec les correspondances, les horaires conseillés et ce qu'il faut voir dans chaque gare.</p>
        </div></a>
        <a class="card" href="#/techniques"><div class="card-body" style="padding:26px">
          <div class="card-kicker"><i style="background:#2E7DA8"></i>Techniques</div>
          <h3>De la vapeur à l'électron</h3>
          <p>Cinq âges de la traction, et comment chaque révolution technique a redessiné l'architecture des gares.</p>
        </div></a>
        <a class="card" href="#/tgv"><div class="card-body" style="padding:26px">
          <div class="card-kicker"><i style="background:#5D5A7D"></i>Bonus</div>
          <h3>L'histoire du TGV</h3>
          <p>L'idée de 1966, le prototype à turbine, le choc pétrolier, les records, et le TGV M attendu pour 2026.</p>
        </div></a>
        <a class="card" href="#/croisement"><div class="card-body" style="padding:26px">
          <div class="card-kicker"><i style="background:#BE5417"></i>En prime</div>
          <h3>Le croisement</h3>
          <p>Tracez un graphique de marche : deux trains, deux droites, et l'heure exacte de leur rencontre. Faites courir une Crampton de 1849 contre un TGV M.</p>
        </div></a>
        <a class="card" href="#/exercices"><div class="card-body" style="padding:26px">
          <div class="card-kicker"><i style="background:#4F7A55"></i>S'exercer</div>
          <h3>Exercices</h3>
          <p>Des séries de huit questions tirées au sort : croisements à calculer, dates, architectes, dessertes et vocabulaire. Chaque corrigé montre le raisonnement.</p>
        </div></a>
      </div>
    </section>
  </div>`;
}

function vueGares(filtre = 'toutes') {
  const list = filtre === 'toutes' ? C.stations : C.stations.filter((s) => s.categorie === filtre);
  return `
  <div class="wrap">
    <section class="section">
      <div class="eyebrow">Le catalogue</div>
      <h2>Quatorze gares</h2>
      <p class="lede">Des sept grands terminus aux gares disparues, en passant par le rail souterrain et les gares de la grande vitesse.</p>
      <div class="chips">${CATEGORIES.map((c) =>
        `<button class="chip${c.id === filtre ? ' on' : ''}" data-cat="${c.id}">${esc(c.nom)}</button>`).join('')}</div>
      <div class="grid">${list.map(stationCard).join('')}</div>
    </section>
  </div>`;
}

function vueGare(id) {
  const s = byId(id);
  if (!s) return `<div class="wrap"><section class="section"><h2>Gare introuvable</h2>
    <p class="lede"><a href="#/gares">Revenir au catalogue</a></p></section></div>`;
  const c = accentOf(s);
  const d = s.dessertes || {};
  const a = s.acces || {};

  return `
  <div class="wrap" style="--c:${c}">
    <div class="detail-head">
      <a class="back" href="#/gares">← Toutes les gares</a>
      <div class="detail-sub">${esc(s.surnom || '')}</div>
      <h1>${esc(s.nom)}</h1>
      <div class="detail-meta">
        <span><b>Ouverture</b> ${esc(s.ouvertureTexte || s.ouverture)}</span>
        <span><b>Compagnie</b> ${esc(s.compagnie)}</span>
        <span><b>Architectes</b> ${esc((s.architectes || []).join(', '))}</span>
        <span><b>Adresse</b> ${esc(s.adresse)}</span>
        ${s.protection ? `<span><b>Protection</b> ${esc(s.protection)}</span>` : ''}
      </div>
    </div>

    <div class="detail-hero">${stationArtwork(s, { width: 1180, height: 502 })}</div>

    <p class="pull" style="--c:${c}">${esc(s.resume)}</p>

    ${statBlock(s.chiffres)}

    <div class="prose">
      <h3>L'origine</h3><p>${esc(s.recit.origine)}</p>
      <h3>La révolution</h3><p>${esc(s.recit.revolution)}</p>
      <h3>Aujourd'hui</h3><p>${esc(s.recit.aujourdhui)}</p>
    </div>

    <hr class="rule">

    <section>
      <div class="eyebrow">Chronologie</div>
      <h2>Les dates qui comptent</h2>
      <div class="timeline" style="--c:${c}">
        ${(s.chronologie || []).map((e) => `
          <div class="tl-item">
            <div class="tl-year">${esc(e.annee)}</div>
            <h4>${esc(e.titre)}</h4>
            <p>${esc(e.texte)}</p>
          </div>`).join('')}
      </div>
    </section>

    <hr class="rule">

    <section>
      <div class="eyebrow">Plan</div>
      <h2>Comment la gare est faite</h2>
      <div class="panel" style="margin-top:22px">
        ${trackPlan(s)}
        <div class="deflist" style="margin-top:22px">
          <div><b>Orientation</b><span>${esc(s.plan?.orientation || '—')}</span></div>
          <div><b>Entrées</b><span>${esc((s.plan?.entrees || []).join(' · '))}</span></div>
        </div>
      </div>
    </section>

    <hr class="rule">

    <section>
      <div class="eyebrow">Desserte et accès</div>
      <h2>Où l'on va, comment on vient</h2>
      <div class="cols" style="margin-top:24px">
        <div class="panel">
          <h3>Ce qui part d'ici</h3>
          <div class="deflist">
            ${d.international?.length ? `<div><b>International</b><span>${esc(d.international.join(' · '))}</span></div>` : ''}
            ${d.grandesLignes?.length ? `<div><b>Grandes lignes</b><span>${esc(d.grandesLignes.join(' · '))}</span></div>` : ''}
            ${d.regional?.length ? `<div><b>Régional</b><span>${esc(d.regional.join(' · '))}</span></div>` : ''}
            ${d.franciliens?.length ? `<div><b>Île-de-France</b><span>${esc(d.franciliens.join(' · '))}</span></div>` : ''}
          </div>
        </div>
        <div class="panel">
          <h3>Y accéder</h3>
          <div class="deflist">
            ${a.metro?.length ? `<div><b>Métro</b><span class="tags">${lignesTags(a.metro, c)}</span></div>` : ''}
            ${a.rer?.length ? `<div><b>RER</b><span>${esc(a.rer.join(' · '))}</span></div>` : ''}
            ${a.transilien?.length ? `<div><b>Transilien</b><span>${esc(a.transilien.join(' · '))}</span></div>` : ''}
            ${a.tram?.length ? `<div><b>Tramway</b><span>${esc(a.tram.join(' · '))}</span></div>` : ''}
            ${a.bus?.length ? `<div><b>Bus</b><span class="tags">${tags(a.bus)}</span></div>` : ''}
            ${a.velo ? `<div><b>Vélo</b><span>${esc(a.velo)}</span></div>` : ''}
          </div>
          ${a.note ? `<p style="margin:16px 0 0;font-size:14.5px;color:var(--ink-3)">${esc(a.note)}</p>` : ''}
        </div>
      </div>
    </section>

    <hr class="rule">

    <section>
      <div class="eyebrow">Services</div>
      <h2>Les commodités aujourd'hui</h2>
      <div class="panel amenities" style="margin-top:22px">
        ${(s.commodites || []).map((m) => `
          <div class="amenity">
            <em>${esc(m.categorie)}</em>
            <h4>${esc(m.titre)}</h4>
            <p>${esc(m.detail)}</p>
          </div>`).join('')}
      </div>
    </section>

    <hr class="rule">

    <section>
      <div class="eyebrow">À voir</div>
      <h2>Pourquoi venir, même sans train</h2>
      <div class="gems" style="margin-top:22px">
        ${(s.pepites || []).map((g) => `
          <div class="gem">
            <h4>${esc(g.titre)}</h4>
            <p>${esc(g.texte)}</p>
            ${g.ou ? `<div class="where">◉ ${esc(g.ou)}</div>` : ''}
          </div>`).join('')}
      </div>
    </section>

    ${s.anecdote ? `
    <section class="section">
      <div class="panel" style="border-left:3px solid ${c}">
        <div class="eyebrow">L'anecdote</div>
        <h2 style="font-size:26px;margin-bottom:12px">${esc(s.anecdote.titre)}</h2>
        <p style="font-size:16.5px;line-height:1.72;color:var(--ink-2);max-width:72ch;margin:0">${esc(s.anecdote.texte)}</p>
      </div>
    </section>` : ''}

    <section class="section">
      <div class="eyebrow">Situer</div>
      <h2>Sur le plan</h2>
      <div style="margin-top:20px">${parisMap(C, { width: 940, height: 560, highlight: s.id })}</div>
    </section>

    <section class="section sources">
      <strong>Sources</strong> —
      ${(s.sources || []).map((x) => `<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.titre)}</a>`).join(' · ')}
    </section>
  </div>`;
}

function vueCircuits() {
  return `
  <div class="wrap">
    <section class="section">
      <div class="eyebrow">Sur le terrain</div>
      <h2>Quatre circuits</h2>
      <p class="lede">Des itinéraires pensés pour être suivis tels quels, avec les correspondances exactes,
      les durées réalistes et les endroits où s'arrêter manger.</p>
      <div class="grid" style="margin-top:28px">
        ${C.circuits.map((c) => `
          <a class="card" href="#/circuit/${esc(c.id)}" style="--c:${c.couleur}">
            <div class="card-art" style="aspect-ratio:2/1;background:var(--paper-3)">
              ${parisMap(C, { width: 640, height: 320, circuit: c, labels: false, statique: true, detail: 'simple' })}
            </div>
            <div class="card-body">
              <div class="card-kicker"><i></i>${esc(c.duree)}</div>
              <h3>${esc(c.nom)}</h3>
              <p>${esc(c.sousTitre)}</p>
              <div class="card-foot"><span>${esc(c.etapes.length)} étapes</span><span>${esc(c.distance)}</span></div>
            </div>
          </a>`).join('')}
      </div>
    </section>
  </div>`;
}

function vueCircuit(id) {
  const c = C.circuits.find((x) => x.id === id);
  if (!c) return `<div class="wrap"><section class="section"><h2>Circuit introuvable</h2></section></div>`;
  return `
  <div class="wrap" style="--c:${c.couleur}">
    <section class="section">
      <a class="back" href="#/circuits">← Tous les circuits</a>
      <div class="circuit-head">
        <div>
          <div class="eyebrow">${esc(c.sousTitre)}</div>
          <h2>${esc(c.nom)}</h2>
          <p class="lede" style="margin-top:14px">${esc(c.intro)}</p>
          ${statBlock([
            { valeur: String(c.etapes.length), label: 'étapes' },
            { valeur: c.duree, label: 'durée totale', note: c.dureeNote },
            { valeur: c.distance, label: 'distance', note: c.distanceNote },
            { valeur: c.difficulte, label: 'difficulté', note: c.difficulteNote },
          ])}
        </div>
        <div>${parisMap(C, { width: 620, height: 520, circuit: c })}</div>
      </div>

      <div class="panel" style="margin-top:26px;border-left:3px solid ${c.couleur}">
        <h3>Conseil pratique</h3>
        <p style="margin:0;font-size:15.5px;color:var(--ink-2)">${esc(c.conseil)}</p>
        <p style="margin:10px 0 0;font-size:13.5px;color:var(--ink-3)">Titre de transport conseillé : ${esc(c.titreTransport)}</p>
      </div>

      <div class="steps">
        ${c.etapes.map((e) => {
          const st = byId(e.stationId);
          return `
          <div class="step" style="--c:${c.couleur}">
            <div class="step-n">${esc(e.ordre)}<small>${esc(e.heure || '')}</small></div>
            <div>
              ${e.transport ? `<div class="leg" style="margin-bottom:12px">
                  <b>${esc(MODES[e.transport.mode] || e.transport.mode)}${e.transport.ligne ? ' ' + esc(e.transport.ligne) : ''}</b>
                  ${esc(e.transport.detail)} · ${esc(e.transport.duree)}
                </div>` : ''}
              <h4>${esc(e.titre)}</h4>
              <p>${esc(e.aFaire)}</p>
              <div style="display:flex;gap:14px;font-size:13px;color:var(--ink-3);align-items:center">
                <span>Compter ${esc(e.duree)}</span>
                ${st ? `<a href="#/gare/${esc(st.id)}" style="color:${c.couleur}">Fiche de la gare →</a>` : ''}
              </div>
            </div>
          </div>`;
        }).join('')}
      </div>
    </section>
  </div>`;
}

function vueTechniques() {
  const t = C.traction;
  return `
  <div class="wrap">
    <section class="section">
      <div class="eyebrow">Dossier technique</div>
      <h2>${esc(t.titre)}</h2>
      <p class="lede" style="margin-top:12px">${esc(t.sousTitre)}</p>
      <p class="lede" style="margin-top:18px">${esc(t.intro)}</p>
    </section>

    ${t.eres.map((e) => `
      <section class="era" style="--c:${e.couleur}">
        <div class="era-side">
          <div class="era-period" style="color:${e.couleur}">${esc(e.periode)}</div>
          <h3>${esc(e.nom)}</h3>
          <p>${esc(e.resume)}</p>
        </div>
        <div class="era-body">
          <p>${esc(e.recit)}</p>
          <div class="machines">
            ${e.machines.map((m) => `<div class="machine">
              <i style="color:${e.couleur}">${esc(m.annee)}</i>
              <b>${esc(m.nom)}</b>
              <p>${esc(m.detail)}</p>
            </div>`).join('')}
          </div>
          <div class="panel" style="margin-top:22px;border-left:3px solid ${e.couleur}">
            <h3>Effet sur les gares</h3>
            <p style="margin:0;font-size:15.5px;color:var(--ink-2)">${esc(e.impactGares)}</p>
          </div>
          <div class="timeline" style="--c:${e.couleur};margin-top:26px">
            ${e.dates.map((d) => `<div class="tl-item">
              <div class="tl-year" style="color:${e.couleur}">${esc(d.annee)}</div>
              <p>${esc(d.texte)}</p>
            </div>`).join('')}
          </div>
        </div>
      </section>`).join('')}

    <section class="section">
      <hr class="rule">
      <div class="eyebrow">Signalisation</div>
      <h2>${esc(t.signalisation.titre)}</h2>
      <p class="lede" style="margin-top:12px">${esc(t.signalisation.intro)}</p>
      <div class="machines" style="margin-top:24px">
        ${t.signalisation.etapes.map((s) => `<div class="machine">
          <i>${esc(s.periode)}</i><b>${esc(s.nom)}</b><p>${esc(s.detail)}</p>
        </div>`).join('')}
      </div>
      <p class="sources" style="margin-top:30px"><strong>Sources</strong> —
        ${t.sources.map((x) => `<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.titre)}</a>`).join(' · ')}</p>
    </section>
  </div>`;
}

function vueTGV() {
  const t = C.tgv;
  return `
  <div class="wrap">
    <section class="hero" style="padding-bottom:20px">
      <div class="eyebrow">Bonus</div>
      <h1>${esc(t.titre)}</h1>
      <p class="lede" style="margin-top:8px;font-size:20px">${esc(t.sousTitre)}</p>
      <p class="lede" style="margin-top:18px">${esc(t.chapo)}</p>
    </section>

    ${statBlock(t.chiffresCles)}

    ${t.chapitres.map((ch) => `
      <section class="chapter" style="--c:${ch.couleur}">
        <div class="chapter-n">${esc(ch.numero)}</div>
        <div>
          <h3>${esc(ch.titre)}</h3>
          <div class="period">${esc(ch.periode)}</div>
          <p>${esc(ch.texte)}</p>
          <div class="facts">
            ${ch.faits.map((f) => `<div class="fact"><b>${esc(f.label)}</b><span>${esc(f.valeur)}</span></div>`).join('')}
          </div>
        </div>
      </section>`).join('')}

    <section class="section">
      <hr class="rule">
      <div class="eyebrow">Filiation</div>
      <h2>Huit générations</h2>
      <div class="gen-row" style="margin-top:24px">
        ${t.generations.map((g) => `<div class="gen">
          <i style="background:${g.couleur}"></i>
          <b>${esc(g.nom)}</b>
          <span class="yr">${esc(g.annees)}</span>
          <span class="sp">${esc(g.vitesse)}</span>
          <p>${esc(g.detail)}</p>
        </div>`).join('')}
      </div>
      <p class="sources" style="margin-top:30px"><strong>Sources</strong> —
        ${t.sources.map((x) => `<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.titre)}</a>`).join(' · ')}</p>
    </section>
  </div>`;
}

function vueCarte() {
  return `
  <div class="wrap">
    <section class="section">
      <div class="eyebrow">Géographie</div>
      <h2>Le plan des gares</h2>
      <p class="lede">Les sept terminus forment une couronne autour du centre : chaque compagnie du XIXe siècle
      s'était arrêtée à la limite du Paris d'alors, là où le terrain était encore abordable.
      Le pointillé figure la Petite Ceinture, construite pour les relier entre elles.</p>
      <div style="margin-top:26px">${parisMap(C, { width: 1140, height: 760 })}</div>
    </section>
  </div>`;
}

function vueGlossaire(q = '') {
  const ql = q.trim().toLowerCase();
  const list = !ql ? C.glossaire.termes
    : C.glossaire.termes.filter((t) => (t.terme + ' ' + t.categorie + ' ' + t.definition).toLowerCase().includes(ql));
  return `
  <div class="wrap">
    <section class="section">
      <div class="eyebrow">Lexique</div>
      <h2>${esc(C.glossaire.titre)}</h2>
      <p class="lede">${esc(C.glossaire.intro)}</p>
      <div style="max-width:460px;margin:26px 0 8px">
        <input class="search" id="q" type="search" placeholder="Chercher un terme…" value="${esc(q)}" autocomplete="off">
        <div style="font-size:13px;color:var(--ink-3)">${list.length} terme${list.length > 1 ? 's' : ''}</div>
      </div>
      <div class="glossary" style="margin-top:24px">
        ${list.map((t) => `<div class="gterm">
          <b>${esc(t.terme)}</b><em>${esc(t.categorie)}</em>
          <p>${esc(t.definition)}</p>
        </div>`).join('') || '<p class="lede">Aucun terme ne correspond.</p>'}
      </div>
    </section>
  </div>`;
}

/* ------------------------------------------------------------------ routeur */

const ROUTES = [
  [/^\/?$/, () => vueAccueil(), 'accueil'],
  [/^\/gares$/, () => vueGares(state.filtre), 'gares'],
  [/^\/gare\/(.+)$/, (m) => vueGare(m[1]), 'gares'],
  [/^\/circuits$/, () => vueCircuits(), 'circuits'],
  [/^\/circuit\/(.+)$/, (m) => vueCircuit(m[1]), 'circuits'],
  [/^\/techniques$/, () => vueTechniques(), 'techniques'],
  [/^\/tgv$/, () => vueTGV(), 'tgv'],
  [/^\/carte$/, () => vueCarte(), 'carte'],
  [/^\/croisement$/, () => vueSimulateur(C, etatSim()), 'croisement'],
  [/^\/exercices$/, () => vueExercices(C, etatEx()), 'exercices'],
  [/^\/glossaire$/, () => vueGlossaire(state.q), 'glossaire'],
];

const state = { filtre: 'toutes', q: '', sim: null, ex: null };
// L'état du simulateur survit aux changements de route.
const etatSim = () => (state.sim ??= etatInitial(C.simulateur));
const etatEx = () => (state.ex ??= etatExercices(C));

function router() {
  const path = (location.hash || '#/').slice(1) || '/';
  for (const [re, render, nav] of ROUTES) {
    const m = path.match(re);
    if (m) {
      view.innerHTML = render(m);
      document.querySelectorAll('.nav a').forEach((a) => a.classList.toggle('on', a.dataset.nav === nav));
      initCartes(view, (id) => { location.hash = '#/gare/' + id; });
      initSimulateur(C, etatSim(), view);
      initExercices(C, etatEx(), view);
      if (!state.keepScroll) window.scrollTo(0, 0);
      state.keepScroll = false;
      const q = $('#q');
      if (q) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); }
      return;
    }
  }
  view.innerHTML = `<div class="wrap"><section class="section"><h2>Page introuvable</h2>
    <p class="lede"><a href="#/">Retour à l'accueil</a></p></section></div>`;
}

/* Interactions déléguées : filtres, points de la carte, recherche */
document.addEventListener('click', (e) => {
  const chip = e.target.closest('.chip[data-cat]');
  if (chip) { state.filtre = chip.dataset.cat; state.keepScroll = true; router(); return; }
  const pin = e.target.closest('.map-station');
  if (pin && !vientDeGlisser(pin)) { location.hash = '#/gare/' + pin.dataset.station; }
});
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const pin = e.target.closest && e.target.closest('.map-station');
  if (pin) { e.preventDefault(); location.hash = '#/gare/' + pin.dataset.station; }
});
document.addEventListener('input', (e) => {
  if (e.target.id === 'q') { state.q = e.target.value; state.keepScroll = true; router(); }
});

/* Thème */
const THEME_KEY = 'gdp-theme';
function applyTheme(t) {
  if (t === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', t);
  const b = $('#theme');
  if (b) b.textContent = t === 'dark' ? '☾' : t === 'light' ? '☀' : '◐';
}
try { applyTheme(localStorage.getItem(THEME_KEY) || 'auto'); } catch { applyTheme('auto'); }
$('#theme')?.addEventListener('click', () => {
  const cur = document.documentElement.getAttribute('data-theme') || 'auto';
  const next = cur === 'auto' ? 'light' : cur === 'light' ? 'dark' : 'auto';
  applyTheme(next);
  try { localStorage.setItem(THEME_KEY, next); } catch { /* stockage indisponible */ }
});

/* Démarrage */
window.addEventListener('hashchange', router);
const demarrer = (corpus) => { C = corpus; router(); };

// La version autonome en un seul fichier injecte le corpus ; sinon on le charge.
if (globalThis.__CORPUS__) { demarrer(globalThis.__CORPUS__); } else {
fetch('data/corpus.json')
  .then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
  .then(demarrer)
  .catch((err) => {
    view.innerHTML = `<div class="wrap"><section class="section">
      <h2>Les données n'ont pas pu être chargées</h2>
      <p class="lede">Cette application lit <code>data/corpus.json</code>, qui est assemblé
      depuis <code>shared/data/</code>. Deux causes possibles :</p>
      <p class="lede">1. Le fichier n'a pas encore été produit — lancez
      <code>node tools/build-data.mjs</code> à la racine du projet.<br>
      2. La page est ouverte en <code>file://</code>, ce que les navigateurs interdisent pour
      lire un fichier voisin — lancez <code>python3 -m http.server</code> depuis
      <code>web/</code>, puis ouvrez <code>http://localhost:8000</code>.</p>
      <p class="sources">Détail technique : ${esc(err.message)}</p></section></div>`;
  });
}
