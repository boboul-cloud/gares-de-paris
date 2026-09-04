// Vérifie les gestes sur la carte : appui, tremblement, glissement, zoom,
// clavier. À lancer avec tools/executer-js.swift, dans un vrai navigateur —
// un DOM simulé ne reproduit pas ces enchaînements d'événements.
const resultats = [];
const ok = (nom, cond) => resultats.push((cond ? 'OK    ' : 'ÉCHEC ') + nom);
const pause = (ms = 260) => new Promise((r) => setTimeout(r, ms));
const aller = async (hash) => { location.hash = hash; await pause(); };

const frame = () => document.querySelector('[data-map]');
const pin = (id) => document.querySelector(`.map-station[data-station="${id}"]`);
const centre = (el) => { const b = el.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; };
const pointeur = (type, x, y) => new PointerEvent(type, {
  bubbles: true, cancelable: true, clientX: x, clientY: y,
  pointerId: 1, pointerType: 'mouse', isPrimary: true, button: 0,
});

function geste(cible, depart, deplacements) {
  cible.dispatchEvent(pointeur('pointerdown', depart.x, depart.y));
  for (const [dx, dy] of deplacements) cible.dispatchEvent(pointeur('pointermove', depart.x + dx, depart.y + dy));
  const [fx, fy] = deplacements.at(-1) ?? [0, 0];
  cible.dispatchEvent(pointeur('pointerup', depart.x + fx, depart.y + fy));
}

// 1 à 3 — un appui ouvre la fiche, même avec un tremblement de la souris.
for (const [tremblement, id] of [[0, 'paris-nord'], [1, 'paris-lyon'], [3, 'paris-est']]) {
  await aller('#/carte');
  const p = pin(id);
  geste(p, centre(p), tremblement ? [[tremblement, 0]] : []);
  ok(`appui avec tremblement de ${tremblement} px ouvre la fiche`, location.hash === `#/gare/${id}`);
}

// 4 et 5 — un vrai glissement déplace la carte sans ouvrir de fiche.
// Il faut d'abord zoomer : à l'échelle 1 la carte remplit le cadre et ne peut
// pas se déplacer, c'est le rôle de la fonction qui la contient.
await aller('#/carte');
const f = frame();
f.querySelector('button[data-zoom="in"]').click();
const avantTx = f._carte.tx;
const p4 = pin('paris-nord');
geste(p4, centre(p4), [[10, 0], [25, 6], [40, 10]]);
ok('un glissement de 40 px n\'ouvre pas de fiche', location.hash === '#/carte');
ok('un glissement déplace la carte', Math.abs(f._carte.tx - avantTx) > 1);

const avant = location.hash;
p4.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
ok('le clic qui suit un glissement est ignoré', location.hash === avant);

// 6 — les commandes de zoom.
f._carte.k = 1; f._carte.tx = 0; f._carte.ty = 0;
f.querySelector('button[data-zoom="in"]').click();
ok('le bouton + zoome', f._carte.k > 1.4);
f.querySelector('button[data-zoom="reset"]').click();
ok('le bouton de recadrage réinitialise', f._carte.k === 1 && f._carte.tx === 0);

// 7 — le clavier, pour qui ne se sert pas d'une souris.
await aller('#/carte');
pin('paris-montparnasse').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
ok('Entrée au clavier ouvre la fiche', location.hash === '#/gare/paris-montparnasse');

// 8 — les vignettes des circuits sont décoratives : rien ne doit y être armé.
await aller('#/circuits');
const vignettes = document.querySelectorAll('.card .paris-map');
ok('les vignettes de circuit existent', vignettes.length === 4);
ok('les vignettes ne sont pas interactives', [...vignettes].every((v) => !v.closest('[data-map]')));

// 9 — la carte d'une fiche de gare est bien armée, elle.
await aller('#/gare/paris-lyon');
ok('la carte d\'une fiche est interactive', !!document.querySelector('[data-map]')?._carte);

const echecs = resultats.filter((l) => l.startsWith('ÉCHEC')).length;
return resultats.join('\n') + `\n\n${resultats.length - echecs}/${resultats.length} vérifications passées`
  + (echecs ? ` — ${echecs} EN ÉCHEC` : '');
