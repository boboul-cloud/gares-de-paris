// Simulateur de croisement : construction des marches, recherche de
// l'intersection, et tracé du graphique de marche.
//
// Le graphique de marche est l'outil des régulateurs depuis le XIXe siècle :
// le temps en abscisse, les distances en ordonnée, chaque train une droite.
// Deux trains se croisent là où leurs droites se coupent.

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export const enMinutes = (hhmm) => {
  const m = /^(\d{1,2})[:hH.](\d{1,2})$/.exec(String(hhmm).trim());
  if (!m) return 0;
  return (+m[1] % 24) * 60 + Math.min(59, +m[2]);
};

export const enHeure = (min) => {
  const t = ((Math.round(min) % 1440) + 1440) % 1440;
  return String(Math.floor(t / 60)).padStart(2, '0') + ' h ' + String(t % 60).padStart(2, '0');
};

export const duree = (min) => {
  const t = Math.max(0, Math.round(min));
  const h = Math.floor(t / 60);
  return h ? `${h} h ${String(t % 60).padStart(2, '0')}` : `${t} min`;
};

/**
 * Construit la marche d'un train : une polyligne de sommets {t, pk}.
 * Un arrêt se traduit par un segment horizontal — le train avance dans le
 * temps sans avancer sur la ligne, exactement comme sur un vrai graphique.
 */
export function construireMarche(axe, train) {
  const montant = train.sens === 'pair';           // pair : on remonte vers Paris
  const jalons = montant ? [...axe.jalons].reverse() : axe.jalons;
  const v = Math.max(5, train.vitesse);
  const arret = train.dessert ? Math.max(0, train.arret ?? 2) : 0;

  let t = train.depart;
  const points = [{ t, pk: jalons[0].pk }];
  const etapes = [];

  const parcours = train.dessert ? jalons : [jalons[0], jalons[jalons.length - 1]];
  for (let i = 1; i < parcours.length; i++) {
    const dpk = Math.abs(parcours[i].pk - parcours[i - 1].pk);
    t += (dpk / v) * 60;
    points.push({ t, pk: parcours[i].pk });
    etapes.push({ nom: parcours[i].nom, pk: parcours[i].pk, arrivee: t });
    if (arret > 0 && i < parcours.length - 1) {
      t += arret;
      points.push({ t, pk: parcours[i].pk });
    }
  }
  return { points, depart: train.depart, arrivee: t, etapes, montant, vitesse: v };
}

/** Point kilométrique d'une marche à l'instant t, borné avant et après. */
export function pkA(marche, t) {
  const p = marche.points;
  if (t <= p[0].t) return p[0].pk;
  const dernier = p[p.length - 1];
  if (t >= dernier.t) return dernier.pk;
  for (let i = 1; i < p.length; i++) {
    if (t <= p[i].t) {
      const a = p[i - 1], b = p[i];
      if (b.t === a.t) return b.pk;
      return a.pk + (b.pk - a.pk) * ((t - a.t) / (b.t - a.t));
    }
  }
  return dernier.pk;
}

/**
 * Cherche le premier instant où les deux trains occupent le même point.
 * On balaie finement puis on affine par dichotomie : la fonction écart peut
 * n'être pas monotone dès que les deux trains vont dans le même sens.
 */
export function chercherCroisement(axe, mA, mB) {
  const memeSens = mA.montant === mB.montant;

  // On ne cherche que dans la fenêtre où les deux trains roulent réellement.
  // En dehors, chacun est immobile à son origine ou à son terminus : sans cette
  // borne, deux trains encore à quai passeraient pour se rencontrer.
  const t0 = Math.max(mA.depart, mB.depart);
  const t1 = Math.min(mA.arrivee, mB.arrivee);
  if (t1 <= t0) {
    return { type: 'aucun', memeSens, raison: 'Les deux trains ne sont jamais en ligne en même temps.' };
  }

  const ecart = (t) => pkA(mA, t) - pkA(mB, t);
  const pas = Math.max(0.02, (t1 - t0) / 5000);

  // Départ commun depuis le même point : on attend qu'ils se séparent avant
  // de guetter une rencontre, sinon l'instant zéro en tiendrait lieu.
  let debut = t0;
  while (debut < t1 && Math.abs(ecart(debut)) < 0.01) debut += pas;
  if (debut >= t1) {
    return { type: 'aucun', memeSens, raison: 'Les deux marches sont confondues.' };
  }

  let precedent = ecart(debut);
  for (let t = debut + pas; t <= t1; t += pas) {
    const courant = ecart(t);
    if (precedent * courant > 0) { precedent = courant; continue; }

    let lo = t - pas, hi = t;
    for (let i = 0; i < 60; i++) {
      const mid = (lo + hi) / 2;
      if ((ecart(lo) < 0) === (ecart(mid) < 0)) lo = mid; else hi = mid;
    }
    const tc = (lo + hi) / 2;
    const pk = pkA(mA, tc);

    return {
      type: memeSens ? 'rattrapage' : 'croisement',
      t: tc,
      pk,
      segment: segmentDe(axe, pk),
      depuisA: tc - mA.depart,
      depuisB: tc - mB.depart,
      parcouruA: Math.abs(pk - mA.points[0].pk),
      parcouruB: Math.abs(pk - mB.points[0].pk),
      rapprochement: memeSens ? Math.abs(mA.vitesse - mB.vitesse) : mA.vitesse + mB.vitesse,
      auTerminus: pk <= 0.5 || pk >= axe.longueur - 0.5,
    };
  }

  return {
    type: 'aucun',
    memeSens,
    raison: memeSens
      ? "Le second train ne rejoint pas le premier avant la fin du parcours."
      : "Les deux trains ne se rencontrent pas sur cet axe.",
  };
}

/** Les deux jalons qui encadrent un point kilométrique. */
function segmentDe(axe, pk) {
  for (let i = 1; i < axe.jalons.length; i++) {
    if (pk <= axe.jalons[i].pk) {
      return { avant: axe.jalons[i - 1], apres: axe.jalons[i] };
    }
  }
  const n = axe.jalons.length;
  return { avant: axe.jalons[n - 2], apres: axe.jalons[n - 1] };
}

/**
 * Graphique de marche. Temps en abscisse, distances en ordonnée, Paris en
 * haut — la disposition des feuilles de régulation françaises.
 */
export function graphiqueMarche(axe, trains, croix, opts = {}) {
  const w = opts.width || 900;
  const h = opts.height || 520;
  // Sur un écran étroit, la gouttière des noms de gare et la graduation
  // horaire doivent maigrir, sinon les libellés se chevauchent.
  const etroit = w < 560;
  const gauche = etroit ? 114 : 132, droite = etroit ? 14 : 20, haut = 18, bas = 38;
  const L = axe.longueur;

  const tMin = Math.min(...trains.map((t) => t.marche.depart));
  const tMax = Math.max(...trains.map((t) => t.marche.arrivee));
  const marge = Math.max(10, (tMax - tMin) * 0.06);
  const t0 = tMin - marge, t1 = tMax + marge;

  const X = (t) => gauche + ((t - t0) / (t1 - t0)) * (w - gauche - droite);
  const Y = (pk) => haut + (pk / L) * (h - haut - bas);

  let out = `<rect width="${w}" height="${h}" class="gm-fond"/>`;

  // Lignes de jalon : les gares de l'axe. Le libellé est omis quand la place
  // verticale manque — le trait, lui, reste toujours tracé.
  const hauteurTrace = h - haut - bas;
  const placeParJalon = hauteurTrace / Math.max(1, axe.jalons.length - 1);
  const avecPk = placeParJalon >= 30 && !etroit;
  let dernierY = -99;
  for (const j of axe.jalons) {
    const y = Y(j.pk);
    out += `<line x1="${gauche}" y1="${y.toFixed(1)}" x2="${w - droite}" y2="${y.toFixed(1)}" class="gm-jalon"/>`;
    if (y - dernierY < 13) continue;
    dernierY = y;
    out += `<text x="${gauche - 9}" y="${(y + (avecPk ? 0 : 3.5)).toFixed(1)}" text-anchor="end" class="gm-gare${etroit ? ' petit' : ''}">${esc(j.nom)}</text>`;
    if (avecPk) out += `<text x="${gauche - 9}" y="${(y + 12).toFixed(1)}" text-anchor="end" class="gm-pk">PK ${j.pk}</text>`;
  }

  // Graduation horaire : on choisit le pas le plus fin dont les libellés
  // tiennent encore côte à côte.
  const largeurTrace = w - gauche - droite;
  const pasMin = [15, 30, 60, 120, 180, 360, 720].find(
    (p) => ((t1 - t0) / p) * 1 <= largeurTrace / 54) || 720;
  const premier = Math.ceil(t0 / pasMin) * pasMin;
  for (let t = premier; t <= t1; t += pasMin) {
    const x = X(t);
    out += `<line x1="${x.toFixed(1)}" y1="${haut}" x2="${x.toFixed(1)}" y2="${h - bas}" class="gm-heure"/>`;
    // Un libellé qui déborderait du cadre n'est pas tracé : seul le trait reste.
    if (x >= gauche + 24 && x <= w - droite - 24) {
      out += `<text x="${x.toFixed(1)}" y="${h - bas + 17}" text-anchor="middle" class="gm-label">${enHeure(t)}</text>`;
    }
  }

  out += `<rect x="${gauche}" y="${haut}" width="${w - gauche - droite}" height="${h - haut - bas}" class="gm-cadre"/>`;

  // Les marches.
  for (const tr of trains) {
    const d = tr.marche.points.map((p, i) => `${i ? 'L' : 'M'}${X(p.t).toFixed(1)} ${Y(p.pk).toFixed(1)}`).join('');
    out += `<path d="${d}" class="gm-marche" style="stroke:${tr.couleur}"/>`;
    for (const p of tr.marche.points) {
      out += `<circle cx="${X(p.t).toFixed(1)}" cy="${Y(p.pk).toFixed(1)}" r="2.6" fill="${tr.couleur}"/>`;
    }
    const tete = tr.marche.points[0];
    out += `<text x="${(X(tete.t) + 7).toFixed(1)}" y="${(Y(tete.pk) + (tr.marche.montant ? -8 : 16)).toFixed(1)}" ` +
      `class="gm-nom" style="fill:${tr.couleur}">${esc(tr.nom)}</text>`;
  }

  // Le point de croisement.
  if (croix && croix.type !== 'aucun') {
    const x = X(croix.t), y = Y(croix.pk);
    out += `<line x1="${x.toFixed(1)}" y1="${haut}" x2="${x.toFixed(1)}" y2="${(h - bas).toFixed(1)}" class="gm-croix-axe"/>`;
    out += `<line x1="${gauche}" y1="${y.toFixed(1)}" x2="${(w - droite).toFixed(1)}" y2="${y.toFixed(1)}" class="gm-croix-axe"/>`;
    out += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="7" class="gm-croix"/>`;
    // L'étiquette se place du côté où elle tient sans mordre sur la gouttière
    // des noms de gare ni sortir du cadre.
    const texte = `${enHeure(croix.t)} · PK ${Math.round(croix.pk)}`;
    const lg = texte.length * 7.2;
    const aDroite = x + 13 + lg <= w - droite;
    const aGauche = x - 13 - lg >= gauche;
    const cote = aDroite ? 'start' : aGauche ? 'end' : 'middle';
    const cx = cote === 'start' ? x + 13 : cote === 'end' ? x - 13 : Math.min(w - droite - lg / 2, Math.max(gauche + lg / 2, x));
    out += `<text x="${cx.toFixed(1)}" y="${(y - 12).toFixed(1)}" text-anchor="${cote}" class="gm-croix-label">${esc(texte)}</text>`;
  }

  return `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" class="graphique-marche" role="img" ` +
    `aria-label="Graphique de marche de l'axe ${esc(axe.nom)}">${out}</svg>`;
}

/** Enchaîne les trois étapes : marches, croisement, graphique. */
export function simuler(axe, trainA, trainB) {
  const mA = construireMarche(axe, trainA);
  const mB = construireMarche(axe, trainB);
  const croix = chercherCroisement(axe, mA, mB);
  return { mA, mB, croix };
}

// --- Calculs détaillés ------------------------------------------------------

const nb = (x, d = 0) => Number(x.toFixed(d)).toLocaleString('fr-FR', { maximumFractionDigits: d });

/**
 * Développe pas à pas le calcul d'une méthode, sur son exemple.
 * Les nombres ne sont pas écrits dans les données : ils sont recalculés ici,
 * de sorte que la démonstration ne puisse pas diverger du simulateur.
 */
export function detaillerMethode(sim, methode) {
  const axe = sim.axes.find((a) => a.id === methode.exemple.axeId);
  const L = axe.longueur;
  const mat = (id) => sim.materiels.find((m) => m.id === id);
  const ex = methode.exemple;

  const vA = mat(ex.a.materielId).vitesse;
  const tA = enMinutes(ex.a.depart);
  const nomA = mat(ex.a.materielId).nom;

  const etapes = [];
  let trainA, trainB, resultat;

  if (methode.id === 'face-a-face' || methode.id === 'rattrapage') {
    const vB = mat(ex.b.materielId).vitesse;
    const tB = enMinutes(ex.b.depart);
    const nomB = mat(ex.b.materielId).nom;
    trainA = { sens: ex.a.sens, vitesse: vA, depart: tA, dessert: false, arret: 0 };
    trainB = { sens: ex.b.sens, vitesse: vB, depart: tB, dessert: false, arret: 0 };

    etapes.push({ titre: 'Les données',
      calcul: `L = ${L} km · v_A = ${vA} km/h à ${enHeure(tA)} · v_B = ${vB} km/h à ${enHeure(tB)}`,
      detail: `${nomA} depuis ${axe.origine}, ${nomB} depuis ${methode.id === 'rattrapage' ? axe.origine : axe.terminus}.` });

    if (methode.id === 'face-a-face') {
      const rappro = vA + vB;
      const depart2 = Math.max(tA, tB);
      const premierEstA = tA <= tB;
      const attente = Math.abs(tB - tA);
      const avance = (premierEstA ? vA : vB) * (attente / 60);
      const reste = L - avance;
      const minutes = (reste / rappro) * 60;
      const t = depart2 + minutes;
      const pk = vA * ((t - tA) / 60);

      etapes.push({ titre: 'Vitesse de rapprochement',
        calcul: `${vA} + ${vB} = ${rappro} km/h`,
        detail: "Ils roulent l'un vers l'autre : leurs vitesses s'additionnent." });
      etapes.push({ titre: attente > 0 ? "Avance du premier parti" : 'Départs simultanés',
        calcul: attente > 0 ? `${premierEstA ? vA : vB} × ${nb(attente)} / 60 = ${nb(avance, 1)} km` : '0 km',
        detail: attente > 0
          ? `Le train ${premierEstA ? 'A' : 'B'} roule seul pendant ${duree(attente)} avant que l'autre ne parte.`
          : 'Les deux partent en même temps : aucune avance à retrancher.' });
      etapes.push({ titre: 'Distance restant à couvrir ensemble',
        calcul: `${L} − ${nb(avance, 1)} = ${nb(reste, 1)} km`,
        detail: "C'est ce qui les sépare à l'instant où les deux sont en ligne." });
      etapes.push({ titre: 'Temps pour la couvrir',
        calcul: `${nb(reste, 1)} / ${rappro} × 60 = ${nb(minutes, 1)} min`,
        detail: `Soit ${duree(minutes)} après ${enHeure(depart2)}.` });
      etapes.push({ titre: 'Heure du croisement',
        calcul: `${enHeure(depart2)} + ${nb(minutes, 1)} min = ${enHeure(t)}`,
        detail: 'Les deux droites du graphique se coupent à cet instant.' });
      etapes.push({ titre: 'Point kilométrique',
        calcul: `${vA} × ${nb(t - tA, 1)} / 60 = PK ${nb(pk)}`,
        detail: `Distance parcourue par le train A depuis ${axe.origine} : il a roulé ${duree(t - tA)}.` });
      resultat = `Croisement à ${enHeure(t)}, au PK ${nb(pk)}.`;
    } else {
      const devant = tA <= tB ? { v: vA, t: tA, nom: 'A' } : { v: vB, t: tB, nom: 'B' };
      const derriere = tA <= tB ? { v: vB, t: tB, nom: 'B' } : { v: vA, t: tA, nom: 'A' };
      const attente = derriere.t - devant.t;
      const avance = devant.v * (attente / 60);
      const rappro = derriere.v - devant.v;
      const minutes = (avance / rappro) * 60;
      const t = derriere.t + minutes;
      const pk = derriere.v * (minutes / 60);

      etapes.push({ titre: `Avance du train ${devant.nom} au départ de ${derriere.nom}`,
        calcul: `${devant.v} × ${nb(attente)} / 60 = ${nb(avance, 1)} km`,
        detail: `Parti ${duree(attente)} plus tôt, il a déjà pris cette avance.` });
      etapes.push({ titre: 'Vitesse de rapprochement',
        calcul: `${derriere.v} − ${devant.v} = ${rappro} km/h`,
        detail: 'Même sens : les vitesses se retranchent. Le poursuivant ne gagne que la différence.' });
      etapes.push({ titre: "Temps pour combler l'avance",
        calcul: `${nb(avance, 1)} / ${rappro} × 60 = ${nb(minutes, 1)} min`,
        detail: `Soit ${duree(minutes)} de poursuite.` });
      etapes.push({ titre: 'Heure du rattrapage',
        calcul: `${enHeure(derriere.t)} + ${nb(minutes, 1)} min = ${enHeure(t)}`,
        detail: `Au PK ${nb(pk)} — ${pk > L ? "au-delà du terminus : le rattrapage n'a pas lieu sur cet axe." : "sur voie unique, il faudrait garer le premier."}` });
      resultat = pk > L
        ? `Le rattrapage se produirait au PK ${nb(pk)}, au-delà des ${L} km de l'axe : il n'a pas lieu.`
        : `Rattrapage à ${enHeure(t)}, au PK ${nb(pk)}.`;
    }
  } else if (methode.id === 'depart-a-trouver') {
    const vB = mat(ex.b.materielId).vitesse;
    const jalon = axe.jalons.find((j) => j.pk === ex.jalonPk) || axe.jalons[1];
    const minutesA = (jalon.pk / vA) * 60;
    const passage = tA + minutesA;
    const restant = L - jalon.pk;
    const minutesB = (restant / vB) * 60;
    const tB = passage - minutesB;
    trainA = { sens: 'impair', vitesse: vA, depart: tA, dessert: false, arret: 0 };
    trainB = { sens: 'pair', vitesse: vB, depart: Math.round(tB), dessert: false, arret: 0 };

    etapes.push({ titre: 'Les données',
      calcul: `L = ${L} km · point visé : ${jalon.nom}, PK ${jalon.pk} · v_A = ${vA} km/h à ${enHeure(tA)} · v_B = ${vB} km/h`,
      detail: `On veut que les deux trains se croisent exactement à ${jalon.nom}.` });
    etapes.push({ titre: `Quand le train A atteint-il ${jalon.nom} ?`,
      calcul: `${jalon.pk} / ${vA} × 60 = ${nb(minutesA, 1)} min, soit ${enHeure(passage)}`,
      detail: `Il lui faut ${duree(minutesA)} pour couvrir les ${jalon.pk} premiers kilomètres.` });
    etapes.push({ titre: 'Distance restant au train B',
      calcul: `${L} − ${jalon.pk} = ${restant} km`,
      detail: `C'est ce qui sépare ${axe.terminus} de ${jalon.nom}.` });
    etapes.push({ titre: 'Temps de parcours du train B',
      calcul: `${restant} / ${vB} × 60 = ${nb(minutesB, 1)} min`,
      detail: `Soit ${duree(minutesB)} de marche.` });
    etapes.push({ titre: 'Heure de départ cherchée',
      calcul: `${enHeure(passage)} − ${nb(minutesB, 1)} min = ${enHeure(tB)}`,
      detail: 'On remonte le temps depuis le point de rencontre.' });
    resultat = `Le second train doit quitter ${axe.terminus} à ${enHeure(tB)}.`;
  } else {
    const jalon = axe.jalons.find((j) => j.pk === ex.jalonPk) || axe.jalons[1];
    const tB = enMinutes(ex.b.depart);
    const minutesA = (jalon.pk / vA) * 60;
    const passage = tA + minutesA;
    const dispo = passage - tB;
    const vB = jalon.pk / (dispo / 60);
    trainA = { sens: 'impair', vitesse: vA, depart: tA, dessert: false, arret: 0 };
    trainB = { sens: 'impair', vitesse: Math.round(vB), depart: tB, dessert: false, arret: 0 };

    etapes.push({ titre: 'Les données',
      calcul: `point visé : ${jalon.nom}, PK ${jalon.pk} · v_A = ${vA} km/h à ${enHeure(tA)} · départ de B : ${enHeure(tB)}`,
      detail: `Le second part de ${axe.origine} après le premier et doit le rejoindre à ${jalon.nom}.` });
    etapes.push({ titre: `Quand le train A atteint-il ${jalon.nom} ?`,
      calcul: `${jalon.pk} / ${vA} × 60 = ${nb(minutesA, 1)} min, soit ${enHeure(passage)}`,
      detail: `Il lui faut ${duree(minutesA)}.` });
    etapes.push({ titre: 'Temps dont dispose le train B',
      calcul: `${enHeure(passage)} − ${enHeure(tB)} = ${nb(dispo, 1)} min`,
      detail: `Soit ${duree(dispo)} pour couvrir la même distance.` });
    etapes.push({ titre: 'Vitesse nécessaire',
      calcul: `${jalon.pk} / (${nb(dispo, 1)} / 60) = ${nb(vB, 1)} km/h`,
      detail: `Une règle de trois : ${jalon.pk} km en ${duree(dispo)}.` });
    resultat = `Il faut tenir ${nb(vB)} km/h de moyenne.`;
  }

  return { axe, etapes, resultat, contexte: { axeId: axe.id, a: trainA, b: trainB } };
}

// --- Interface -------------------------------------------------------------

const MATERIEL_LIBRE = 'libre';

/** Minutes vers « hh:mm », format attendu par un champ de type time. */
const gabaritHeure = (minutes) => {
  const t = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0');
};

const optionsMateriels = (materiels, choisi) =>
  materiels.map((m) => `<option value="${esc(m.id)}"${m.id === choisi ? ' selected' : ''}>${esc(m.nom)} — ${m.vitesse} km/h</option>`).join('') +
  `<option value="${MATERIEL_LIBRE}"${choisi === MATERIEL_LIBRE ? ' selected' : ''}>Vitesse libre…</option>`;

function champsTrain(sim, cle, etat) {
  const t = etat[cle];
  const titre = cle === 'a' ? 'Train A' : 'Train B';
  return `
  <fieldset class="sim-train" style="--c:${esc(t.couleur)}">
    <legend>${titre}</legend>
    <label>Matériel
      <select data-sim="${cle}.materielId">${optionsMateriels(sim.materiels, t.materielId)}</select>
    </label>
    <label>Vitesse moyenne
      <span class="sim-nombre">
        <input type="number" min="20" max="360" step="5" value="${t.vitesse}" data-sim="${cle}.vitesse"><i>km/h</i>
      </span>
    </label>
    <label>Départ
      <input type="time" value="${esc(t.departTexte)}" data-sim="${cle}.departTexte">
    </label>
    <label>Sens
      <select data-sim="${cle}.sens">
        <option value="impair"${t.sens === 'impair' ? ' selected' : ''}>Impair — au départ de Paris</option>
        <option value="pair"${t.sens === 'pair' ? ' selected' : ''}>Pair — vers Paris</option>
      </select>
    </label>
    <label class="sim-case">
      <input type="checkbox" data-sim="${cle}.dessert"${t.dessert ? ' checked' : ''}>
      Dessert toutes les gares de l'axe
    </label>
    <label>Arrêt par gare
      <span class="sim-nombre">
        <input type="number" min="0" max="20" step="1" value="${t.arret}" data-sim="${cle}.arret"${t.dessert ? '' : ' disabled'}><i>min</i>
      </span>
    </label>
  </fieldset>`;
}

// Chaque train tient sa couleur de son rôle, non de son matériel : deux TGV
// identiques donneraient sinon deux droites de la même teinte, indistinguables.
export const COULEUR_A = '#1F6F8B';
export const COULEUR_B = '#BE5417';

function depuisExemple(sim, e, couleur) {
  const m = sim.materiels.find((x) => x.id === e.materielId);
  return { materielId: e.materielId, vitesse: m.vitesse, couleur,
           departTexte: e.depart, sens: e.sens, dessert: e.dessert, arret: 2 };
}

export function etatInitial(sim) {
  const ex = sim.exemples[0];
  return { axeId: ex.axeId, a: depuisExemple(sim, ex.a, COULEUR_A), b: depuisExemple(sim, ex.b, COULEUR_B) };
}

export function vueSimulateur(corpus, etat) {
  const sim = corpus.simulateur;
  const axe = sim.axes.find((a) => a.id === etat.axeId) || sim.axes[0];
  return `
  <div class="wrap">
    <section class="section">
      <div class="eyebrow">En prime</div>
      <h2>${esc(sim.titre)}</h2>
      <p class="lede" style="margin-top:10px">${esc(sim.sousTitre)}</p>
      <p class="lede" style="margin-top:16px">${esc(sim.intro)}</p>

      <div class="sim-exemples">
        ${sim.exemples.map((e, i) => `<button type="button" class="chip" data-exemple="${i}">${esc(e.nom)}</button>`).join('')}
      </div>

      <form class="sim-form" id="sim" autocomplete="off">
        <label class="sim-axe">Axe
          <select data-sim="axeId">
            ${sim.axes.map((a) => `<option value="${esc(a.id)}"${a.id === axe.id ? ' selected' : ''}>${esc(a.nom)} — ${a.longueur} km</option>`).join('')}
          </select>
        </label>
        <div class="sim-trains">
          ${champsTrain(sim, 'a', etat)}
          ${champsTrain(sim, 'b', etat)}
        </div>
      </form>

      <p class="sim-note" id="sim-axe-note">${esc(axe.note)}</p>

      <div id="sim-verdict"></div>
      <div id="sim-graphique" style="margin-top:22px"></div>

      <hr class="rule">

      <div class="eyebrow">Méthode</div>
      <h2>Les quatre calculs, pas à pas</h2>
      <p class="lede" style="margin-top:10px">Chaque démonstration est chiffrée par le programme lui-même, sur un exemple réel : les nombres affichés sont ceux du moteur, pas des valeurs recopiées. Le bouton charge l'exemple dans le simulateur, au-dessus.</p>
      <div class="methodes">
        ${sim.methodes.map((me, i) => bloqueMethode(sim, me, i)).join('')}
      </div>

      <div class="cols" style="margin-top:26px">
        <div class="panel">
          <h3>Le modèle</h3>
          <p style="margin:0;font-size:14.5px;color:var(--ink-2)">${esc(sim.modele)}</p>
        </div>
        <div class="panel">
          <h3>Pair et impair</h3>
          <p style="margin:0;font-size:14.5px;color:var(--ink-2)">${esc(sim.convention)}</p>
        </div>
      </div>
    </section>
  </div>`;
}

function bloqueMethode(sim, methode, i) {
  const d = detaillerMethode(sim, methode);
  return `
  <article class="methode">
    <div class="methode-tete">
      <span class="methode-n">${i + 1}</span>
      <div>
        <h3>${esc(methode.nom)}</h3>
        <p class="methode-quand">${esc(methode.quand)}</p>
      </div>
    </div>
    <p class="methode-formule">${esc(methode.formule)}</p>
    <p class="methode-principe">${esc(methode.principe)}</p>
    <ol class="methode-etapes">
      ${d.etapes.map((e) => `
        <li>
          <b>${esc(e.titre)}</b>
          <code>${esc(e.calcul)}</code>
          <span>${esc(e.detail)}</span>
        </li>`).join('')}
    </ol>
    <p class="methode-resultat">${esc(d.resultat)}</p>
    <button type="button" class="chip" data-methode="${esc(methode.id)}">Charger cet exemple dans le simulateur</button>
  </article>`;
}

function verdict(axe, etat, r) {
  const { mA, mB, croix } = r;
  const ligne = (t, m, cle) => `
    <div class="sim-bilan-train" style="--c:${esc(etat[cle].couleur)}">
      <b>Train ${cle.toUpperCase()}</b>
      <span>${esc(t.montant ? axe.terminus : axe.origine)} → ${esc(t.montant ? axe.origine : axe.terminus)}</span>
      <span>Départ ${enHeure(t.depart)} · arrivée ${enHeure(t.arrivee)} · ${duree(t.arrivee - t.depart)}</span>
      <span>${t.vitesse} km/h${etat[cle].dessert ? `, ${etat[cle].arret} min d'arrêt par gare` : ', sans arrêt'}</span>
    </div>`;

  if (croix.type === 'aucun') {
    return `<div class="panel sim-verdict" style="margin-top:24px">
      <div class="eyebrow">Résultat</div>
      <h3 class="sim-titre">Pas de rencontre</h3>
      <p class="sim-phrase">${esc(croix.raison)}</p>
      <div class="sim-bilan">${ligne(mA, etat.a, 'a')}${ligne(mB, etat.b, 'b')}</div>
    </div>`;
  }

  const rattrapage = croix.type === 'rattrapage';
  const phrase = rattrapage
    ? `Le train B rejoint le train A à <b>${enHeure(croix.t)}</b>, au <b>PK ${Math.round(croix.pk)}</b>, entre ${esc(croix.segment.avant.nom)} et ${esc(croix.segment.apres.nom)}. Sur une ligne à double voie il le double ; sur voie unique, il faudrait garer le premier.`
    : `Les deux trains se croisent à <b>${enHeure(croix.t)}</b>, au <b>PK ${Math.round(croix.pk)}</b>, entre ${esc(croix.segment.avant.nom)} et ${esc(croix.segment.apres.nom)}.`;

  return `<div class="panel sim-verdict" style="margin-top:24px">
    <div class="eyebrow">Résultat</div>
    <h3 class="sim-titre">${rattrapage ? 'Rattrapage' : 'Croisement'} à ${enHeure(croix.t)}</h3>
    <p class="sim-phrase">${phrase}</p>
    <div class="stats" style="margin:18px 0 4px">
      <div class="stat"><b>${enHeure(croix.t)}</b><span>heure de la rencontre</span></div>
      <div class="stat"><b>PK ${Math.round(croix.pk)}</b><span>point kilométrique</span><i>sur ${axe.longueur} km</i></div>
      <div class="stat"><b>${Math.round(croix.parcouruA)} km</b><span>parcourus par A</span><i>en ${duree(croix.depuisA)}</i></div>
      <div class="stat"><b>${Math.round(croix.parcouruB)} km</b><span>parcourus par B</span><i>en ${duree(croix.depuisB)}</i></div>
      <div class="stat"><b>${Math.round(croix.rapprochement)} km/h</b><span>vitesse de rapprochement</span><i>${rattrapage ? 'écart des vitesses' : 'somme des vitesses'}</i></div>
    </div>
    <div class="sim-bilan">${ligne(mA, etat.a, 'a')}${ligne(mB, etat.b, 'b')}</div>
  </div>`;
}

/** Recalcule et réaffiche le résultat sans reconstruire le formulaire. */
export function majSimulateur(corpus, etat, racine = document) {
  const sim = corpus.simulateur;
  const axe = sim.axes.find((a) => a.id === etat.axeId) || sim.axes[0];
  const train = (t) => ({ sens: t.sens, vitesse: +t.vitesse || 5, depart: enMinutes(t.departTexte),
                          dessert: t.dessert, arret: +t.arret || 0 });
  const r = simuler(axe, train(etat.a), train(etat.b));

  const note = racine.querySelector('#sim-axe-note');
  if (note) note.textContent = axe.note;
  const v = racine.querySelector('#sim-verdict');
  if (v) v.innerHTML = verdict(axe, etat, r);
  const g = racine.querySelector('#sim-graphique');
  if (g) {
    const dispo = Math.max(360, Math.min(900, (globalThis.innerWidth || 900) - 60));
    g.innerHTML = graphiqueMarche(axe, [
      { nom: 'Train A', couleur: etat.a.couleur, marche: r.mA },
      { nom: 'Train B', couleur: etat.b.couleur, marche: r.mB },
    ], r.croix, { width: dispo, height: Math.round(dispo / (dispo < 560 ? 1.05 : 1.62)) });
  }
}

/** Branche le formulaire. Le résultat se met à jour, le formulaire non. */
export function initSimulateur(corpus, etat, racine = document) {
  const form = racine.querySelector('#sim');
  if (!form || form._arme) return;
  form._arme = true;
  const sim = corpus.simulateur;

  const appliquer = () => majSimulateur(corpus, etat, racine);

  form.addEventListener('input', (ev) => {
    const champ = ev.target.dataset.sim;
    if (!champ) return;
    const [cle, prop] = champ.includes('.') ? champ.split('.') : [null, champ];
    const val = ev.target.type === 'checkbox' ? ev.target.checked : ev.target.value;
    if (cle) etat[cle][prop] = val; else etat[prop] = val;

    // Choisir un matériel impose sa vitesse et sa couleur ; passer en vitesse
    // libre laisse la main à l'utilisateur.
    if (prop === 'materielId' && val !== MATERIEL_LIBRE) {
      const m = sim.materiels.find((x) => x.id === val);
      if (m) {
        etat[cle].vitesse = m.vitesse;
        const champVitesse = form.querySelector(`[data-sim="${cle}.vitesse"]`);
        if (champVitesse) champVitesse.value = m.vitesse;
      }
    }
    if (prop === 'vitesse') {
      etat[cle].materielId = MATERIEL_LIBRE;
      const s = form.querySelector(`[data-sim="${cle}.materielId"]`);
      if (s) s.value = MATERIEL_LIBRE;
    }
    if (prop === 'dessert') {
      const a = form.querySelector(`[data-sim="${cle}.arret"]`);
      if (a) a.disabled = !val;
    }
    appliquer();
  });

  racine.querySelectorAll('[data-methode]').forEach((b) => {
    b.addEventListener('click', () => {
      const methode = sim.methodes.find((m) => m.id === b.dataset.methode);
      const d = detaillerMethode(sim, methode);
      const depuis = (t, couleur) => ({
        materielId: MATERIEL_LIBRE, vitesse: Math.round(t.vitesse), couleur,
        departTexte: gabaritHeure(t.depart), sens: t.sens, dessert: false, arret: 2,
      });
      etat.axeId = d.contexte.axeId;
      etat.a = depuis(d.contexte.a, COULEUR_A);
      etat.b = depuis(d.contexte.b, COULEUR_B);
      const conteneur = racine.querySelector('.sim-trains');
      if (conteneur) conteneur.innerHTML = champsTrain(sim, 'a', etat) + champsTrain(sim, 'b', etat);
      const selAxe = form.querySelector('[data-sim="axeId"]');
      if (selAxe) selAxe.value = etat.axeId;
      appliquer();
      racine.querySelector('#sim-graphique')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  });

  racine.querySelectorAll('[data-exemple]').forEach((b) => {
    b.addEventListener('click', () => {
      const ex = sim.exemples[+b.dataset.exemple];
      etat.axeId = ex.axeId;
      etat.a = depuisExemple(sim, ex.a, COULEUR_A);
      etat.b = depuisExemple(sim, ex.b, COULEUR_B);
      // Le formulaire est reconstruit : c'est le seul cas où on le réécrit.
      const conteneur = racine.querySelector('.sim-trains');
      if (conteneur) conteneur.innerHTML = champsTrain(sim, 'a', etat) + champsTrain(sim, 'b', etat);
      const selAxe = form.querySelector('[data-sim="axeId"]');
      if (selAxe) selAxe.value = etat.axeId;
      appliquer();
    });
  });

  appliquer();
}
