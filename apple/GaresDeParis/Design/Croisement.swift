import SwiftUI

// Calcul du croisement de deux trains et tracé du graphique de marche.
// Même modèle que la version Web : marche uniforme entre deux arrêts, un arrêt
// se traduisant par un segment horizontal.

struct PointMarche: Hashable { var t: Double; var pk: Double }

struct ReglagesTrain: Hashable {
    var materielId: String
    var vitesse: Double
    var departMinutes: Int
    var sens: String            // « impair » : au départ de Paris ; « pair » : vers Paris
    var dessert: Bool
    var arret: Int
    var couleur: Color

    var montant: Bool { sens == "pair" }
}

struct Marche {
    var points: [PointMarche]
    var depart: Double
    var arrivee: Double
    var montant: Bool
    var vitesse: Double

    /// Point kilométrique à l'instant `t`, borné avant le départ et après l'arrivée.
    func pk(a t: Double) -> Double {
        guard let premier = points.first, let dernier = points.last else { return 0 }
        if t <= premier.t { return premier.pk }
        if t >= dernier.t { return dernier.pk }
        for i in 1..<points.count where t <= points[i].t {
            let a = points[i - 1], b = points[i]
            if b.t == a.t { return b.pk }
            return a.pk + (b.pk - a.pk) * ((t - a.t) / (b.t - a.t))
        }
        return dernier.pk
    }
}

enum TypeRencontre { case croisement, rattrapage, aucun }

struct Rencontre {
    var type: TypeRencontre
    var t: Double = 0
    var pk: Double = 0
    var avant: Jalon?
    var apres: Jalon?
    var depuisA: Double = 0
    var depuisB: Double = 0
    var parcouruA: Double = 0
    var parcouruB: Double = 0
    var rapprochement: Double = 0
    var raison: String?
}

enum Croisement {
    static func construire(_ axe: Axe, _ r: ReglagesTrain) -> Marche {
        let jalons = r.montant ? axe.jalons.reversed().map { $0 } : axe.jalons
        let v = max(5, r.vitesse)
        let arret = r.dessert ? Double(max(0, r.arret)) : 0
        let parcours = r.dessert ? jalons : [jalons[0], jalons[jalons.count - 1]]

        var t = Double(r.departMinutes)
        var points = [PointMarche(t: t, pk: parcours[0].pk)]
        for i in 1..<parcours.count {
            t += abs(parcours[i].pk - parcours[i - 1].pk) / v * 60
            points.append(PointMarche(t: t, pk: parcours[i].pk))
            if arret > 0, i < parcours.count - 1 {
                t += arret
                points.append(PointMarche(t: t, pk: parcours[i].pk))
            }
        }
        return Marche(points: points, depart: Double(r.departMinutes), arrivee: t,
                      montant: r.montant, vitesse: v)
    }

    static func chercher(_ axe: Axe, _ mA: Marche, _ mB: Marche) -> Rencontre {
        let memeSens = mA.montant == mB.montant

        // On ne cherche que dans la fenêtre où les deux trains roulent : hors
        // d'elle, chacun est immobile à son origine ou à son terminus, et deux
        // trains encore à quai passeraient pour se rencontrer.
        let t0 = max(mA.depart, mB.depart)
        let t1 = min(mA.arrivee, mB.arrivee)
        guard t1 > t0 else {
            return Rencontre(type: .aucun, avant: nil, apres: nil,
                             raison: "Les deux trains ne sont jamais en ligne en même temps.")
        }

        let ecart = { (t: Double) in mA.pk(a: t) - mB.pk(a: t) }
        let pas = max(0.02, (t1 - t0) / 5000)

        // Départ commun depuis le même point : on attend qu'ils se séparent.
        var debut = t0
        while debut < t1, abs(ecart(debut)) < 0.01 { debut += pas }
        guard debut < t1 else {
            return Rencontre(type: .aucun, avant: nil, apres: nil, raison: "Les deux marches sont confondues.")
        }

        var precedent = ecart(debut)
        var t = debut + pas
        while t <= t1 {
            let courant = ecart(t)
            if precedent * courant <= 0 {
                var lo = t - pas, hi = t
                for _ in 0..<60 {
                    let mid = (lo + hi) / 2
                    if (ecart(lo) < 0) == (ecart(mid) < 0) { lo = mid } else { hi = mid }
                }
                let tc = (lo + hi) / 2
                let pk = mA.pk(a: tc)
                let seg = segment(axe, pk)
                return Rencontre(
                    type: memeSens ? .rattrapage : .croisement,
                    t: tc, pk: pk, avant: seg.0, apres: seg.1,
                    depuisA: tc - mA.depart, depuisB: tc - mB.depart,
                    parcouruA: abs(pk - (mA.points.first?.pk ?? 0)),
                    parcouruB: abs(pk - (mB.points.first?.pk ?? 0)),
                    rapprochement: memeSens ? abs(mA.vitesse - mB.vitesse) : mA.vitesse + mB.vitesse
                )
            }
            precedent = courant
            t += pas
        }

        return Rencontre(type: .aucun, avant: nil, apres: nil,
                         raison: memeSens
                            ? "Le second train ne rejoint pas le premier avant la fin du parcours."
                            : "Les deux trains ne se rencontrent pas sur cet axe.")
    }

    private static func segment(_ axe: Axe, _ pk: Double) -> (Jalon, Jalon) {
        for i in 1..<axe.jalons.count where pk <= axe.jalons[i].pk {
            return (axe.jalons[i - 1], axe.jalons[i])
        }
        let n = axe.jalons.count
        return (axe.jalons[n - 2], axe.jalons[n - 1])
    }

    // MARK: Formats

    static func enHeure(_ minutes: Double) -> String {
        let t = ((Int(minutes.rounded()) % 1440) + 1440) % 1440
        return String(format: "%02d h %02d", t / 60, t % 60)
    }

    static func duree(_ minutes: Double) -> String {
        let t = max(0, Int(minutes.rounded()))
        return t >= 60 ? String(format: "%d h %02d", t / 60, t % 60) : "\(t) min"
    }

    static func minutes(_ hhmm: String) -> Int {
        let p = hhmm.split(whereSeparator: { ":hH.".contains($0) })
        guard p.count == 2, let h = Int(p[0]), let m = Int(p[1]) else { return 0 }
        return (h % 24) * 60 + min(59, m)
    }
}

// MARK: - Calculs détaillés

struct EtapeCalcul: Identifiable, Hashable {
    let titre: String
    let calcul: String
    let detail: String
    var id: String { titre + calcul }
}

struct DetailMethode {
    let axe: Axe
    let etapes: [EtapeCalcul]
    let resultat: String
    let contexte: ContexteCroisement
}

extension Croisement {
    /// Formatage à la française, identique à celui de la version Web.
    static func nb(_ x: Double, _ d: Int = 0) -> String {
        let arrondi = (x * pow(10, Double(d))).rounded() / pow(10, Double(d))
        var t = String(format: "%.\(d)f", arrondi)
        if d > 0 {
            while t.hasSuffix("0") { t.removeLast() }
            if t.hasSuffix(".") { t.removeLast() }
        }
        return t.replacingOccurrences(of: ".", with: ",")
    }

    /// Développe pas à pas le calcul d'une méthode sur son exemple. Les nombres
    /// sont recalculés ici : la démonstration ne peut pas diverger du moteur.
    static func detailler(_ sim: Simulateur, _ methode: Methode) -> DetailMethode {
        let axe = sim.axes.first { $0.id == methode.exemple.axeId } ?? sim.axes[0]
        let L = axe.longueur
        let ex = methode.exemple
        func mat(_ id: String?) -> Materiel? { sim.materiels.first { $0.id == id } }

        let vA = mat(ex.a.materielId)?.vitesse ?? 160
        let tA = Double(minutes(ex.a.depart ?? "08:00"))
        let nomA = mat(ex.a.materielId)?.nom ?? "Train A"

        var etapes: [EtapeCalcul] = []
        var trainA: ReglagesTrain
        var trainB: ReglagesTrain
        var resultat: String

        func train(_ sens: String, _ v: Double, _ t: Double, _ c: Color) -> ReglagesTrain {
            ReglagesTrain(materielId: "libre", vitesse: v, departMinutes: Int(t.rounded()),
                          sens: sens, dessert: false, arret: 0, couleur: c)
        }
        let cA = Color(hex: "#1F6F8B"), cB = Color(hex: "#BE5417")

        switch methode.id {
        case "face-a-face", "rattrapage":
            let vB = mat(ex.b.materielId)?.vitesse ?? 160
            let tB = Double(minutes(ex.b.depart ?? "08:00"))
            let nomB = mat(ex.b.materielId)?.nom ?? "Train B"
            trainA = train(ex.a.sens, vA, tA, cA)
            trainB = train(ex.b.sens, vB, tB, cB)

            etapes.append(EtapeCalcul(
                titre: "Les données",
                calcul: "L = \(Int(L)) km · v_A = \(Int(vA)) km/h à \(enHeure(tA)) · v_B = \(Int(vB)) km/h à \(enHeure(tB))",
                detail: "\(nomA) depuis \(axe.origine), \(nomB) depuis \(methode.id == "rattrapage" ? axe.origine : axe.terminus)."))

            if methode.id == "face-a-face" {
                let rappro = vA + vB
                let depart2 = max(tA, tB)
                let premierEstA = tA <= tB
                let attente = abs(tB - tA)
                let avance = (premierEstA ? vA : vB) * (attente / 60)
                let reste = L - avance
                let minutes = (reste / rappro) * 60
                let t = depart2 + minutes
                let pk = vA * ((t - tA) / 60)

                etapes.append(EtapeCalcul(titre: "Vitesse de rapprochement",
                    calcul: "\(Int(vA)) + \(Int(vB)) = \(Int(rappro)) km/h",
                    detail: "Ils roulent l'un vers l'autre : leurs vitesses s'additionnent."))
                etapes.append(EtapeCalcul(titre: attente > 0 ? "Avance du premier parti" : "Départs simultanés",
                    calcul: attente > 0 ? "\(Int(premierEstA ? vA : vB)) × \(nb(attente)) / 60 = \(nb(avance, 1)) km" : "0 km",
                    detail: attente > 0
                        ? "Le train \(premierEstA ? "A" : "B") roule seul pendant \(duree(attente)) avant que l'autre ne parte."
                        : "Les deux partent en même temps : aucune avance à retrancher."))
                etapes.append(EtapeCalcul(titre: "Distance restant à couvrir ensemble",
                    calcul: "\(Int(L)) − \(nb(avance, 1)) = \(nb(reste, 1)) km",
                    detail: "C'est ce qui les sépare à l'instant où les deux sont en ligne."))
                etapes.append(EtapeCalcul(titre: "Temps pour la couvrir",
                    calcul: "\(nb(reste, 1)) / \(Int(rappro)) × 60 = \(nb(minutes, 1)) min",
                    detail: "Soit \(duree(minutes)) après \(enHeure(depart2))."))
                etapes.append(EtapeCalcul(titre: "Heure du croisement",
                    calcul: "\(enHeure(depart2)) + \(nb(minutes, 1)) min = \(enHeure(t))",
                    detail: "Les deux droites du graphique se coupent à cet instant."))
                etapes.append(EtapeCalcul(titre: "Point kilométrique",
                    calcul: "\(Int(vA)) × \(nb(t - tA, 1)) / 60 = PK \(nb(pk))",
                    detail: "Distance parcourue par le train A depuis \(axe.origine) : il a roulé \(duree(t - tA))."))
                resultat = "Croisement à \(enHeure(t)), au PK \(nb(pk))."
            } else {
                let devant = tA <= tB ? (v: vA, t: tA, nom: "A") : (v: vB, t: tB, nom: "B")
                let derriere = tA <= tB ? (v: vB, t: tB, nom: "B") : (v: vA, t: tA, nom: "A")
                let attente = derriere.t - devant.t
                let avance = devant.v * (attente / 60)
                let rappro = derriere.v - devant.v
                let minutes = (avance / rappro) * 60
                let t = derriere.t + minutes
                let pk = derriere.v * (minutes / 60)

                etapes.append(EtapeCalcul(titre: "Avance du train \(devant.nom) au départ de \(derriere.nom)",
                    calcul: "\(Int(devant.v)) × \(nb(attente)) / 60 = \(nb(avance, 1)) km",
                    detail: "Parti \(duree(attente)) plus tôt, il a déjà pris cette avance."))
                etapes.append(EtapeCalcul(titre: "Vitesse de rapprochement",
                    calcul: "\(Int(derriere.v)) − \(Int(devant.v)) = \(Int(rappro)) km/h",
                    detail: "Même sens : les vitesses se retranchent. Le poursuivant ne gagne que la différence."))
                etapes.append(EtapeCalcul(titre: "Temps pour combler l'avance",
                    calcul: "\(nb(avance, 1)) / \(Int(rappro)) × 60 = \(nb(minutes, 1)) min",
                    detail: "Soit \(duree(minutes)) de poursuite."))
                etapes.append(EtapeCalcul(titre: "Heure du rattrapage",
                    calcul: "\(enHeure(derriere.t)) + \(nb(minutes, 1)) min = \(enHeure(t))",
                    detail: "Au PK \(nb(pk)) — \(pk > L ? "au-delà du terminus : le rattrapage n'a pas lieu sur cet axe." : "sur voie unique, il faudrait garer le premier.")"))
                resultat = pk > L
                    ? "Le rattrapage se produirait au PK \(nb(pk)), au-delà des \(Int(L)) km de l'axe : il n'a pas lieu."
                    : "Rattrapage à \(enHeure(t)), au PK \(nb(pk))."
            }

        case "depart-a-trouver":
            let vB = mat(ex.b.materielId)?.vitesse ?? 130
            let jalon = axe.jalons.first { $0.pk == (ex.jalonPk ?? -1) } ?? axe.jalons[1]
            let minutesA = (jalon.pk / vA) * 60
            let passage = tA + minutesA
            let restant = L - jalon.pk
            let minutesB = (restant / vB) * 60
            let tB = passage - minutesB
            trainA = train("impair", vA, tA, cA)
            trainB = train("pair", vB, tB.rounded(), cB)

            etapes.append(EtapeCalcul(titre: "Les données",
                calcul: "L = \(Int(L)) km · point visé : \(jalon.nom), PK \(Int(jalon.pk)) · v_A = \(Int(vA)) km/h à \(enHeure(tA)) · v_B = \(Int(vB)) km/h",
                detail: "On veut que les deux trains se croisent exactement à \(jalon.nom)."))
            etapes.append(EtapeCalcul(titre: "Quand le train A atteint-il \(jalon.nom) ?",
                calcul: "\(Int(jalon.pk)) / \(Int(vA)) × 60 = \(nb(minutesA, 1)) min, soit \(enHeure(passage))",
                detail: "Il lui faut \(duree(minutesA)) pour couvrir les \(Int(jalon.pk)) premiers kilomètres."))
            etapes.append(EtapeCalcul(titre: "Distance restant au train B",
                calcul: "\(Int(L)) − \(Int(jalon.pk)) = \(Int(restant)) km",
                detail: "C'est ce qui sépare \(axe.terminus) de \(jalon.nom)."))
            etapes.append(EtapeCalcul(titre: "Temps de parcours du train B",
                calcul: "\(Int(restant)) / \(Int(vB)) × 60 = \(nb(minutesB, 1)) min",
                detail: "Soit \(duree(minutesB)) de marche."))
            etapes.append(EtapeCalcul(titre: "Heure de départ cherchée",
                calcul: "\(enHeure(passage)) − \(nb(minutesB, 1)) min = \(enHeure(tB))",
                detail: "On remonte le temps depuis le point de rencontre."))
            resultat = "Le second train doit quitter \(axe.terminus) à \(enHeure(tB))."

        default:   // vitesse-a-trouver
            let jalon = axe.jalons.first { $0.pk == (ex.jalonPk ?? -1) } ?? axe.jalons[1]
            let tB = Double(minutes(ex.b.depart ?? "08:45"))
            let minutesA = (jalon.pk / vA) * 60
            let passage = tA + minutesA
            let dispo = passage - tB
            let vB = jalon.pk / (dispo / 60)
            trainA = train("impair", vA, tA, cA)
            trainB = train("impair", vB.rounded(), tB, cB)

            etapes.append(EtapeCalcul(titre: "Les données",
                calcul: "point visé : \(jalon.nom), PK \(Int(jalon.pk)) · v_A = \(Int(vA)) km/h à \(enHeure(tA)) · départ de B : \(enHeure(tB))",
                detail: "Le second part de \(axe.origine) après le premier et doit le rejoindre à \(jalon.nom)."))
            etapes.append(EtapeCalcul(titre: "Quand le train A atteint-il \(jalon.nom) ?",
                calcul: "\(Int(jalon.pk)) / \(Int(vA)) × 60 = \(nb(minutesA, 1)) min, soit \(enHeure(passage))",
                detail: "Il lui faut \(duree(minutesA))."))
            etapes.append(EtapeCalcul(titre: "Temps dont dispose le train B",
                calcul: "\(enHeure(passage)) − \(enHeure(tB)) = \(nb(dispo, 1)) min",
                detail: "Soit \(duree(dispo)) pour couvrir la même distance."))
            etapes.append(EtapeCalcul(titre: "Vitesse nécessaire",
                calcul: "\(Int(jalon.pk)) / (\(nb(dispo, 1)) / 60) = \(nb(vB, 1)) km/h",
                detail: "Une règle de trois : \(Int(jalon.pk)) km en \(duree(dispo))."))
            resultat = "Il faut tenir \(nb(vB)) km/h de moyenne."
        }

        return DetailMethode(axe: axe, etapes: etapes, resultat: resultat,
                             contexte: ContexteCroisement(axeId: axe.id, a: trainA, b: trainB))
    }
}

/// Graphique de marche : le temps en abscisse, les distances en ordonnée,
/// Paris en haut — la disposition des feuilles de régulation françaises.
struct GraphiqueMarcheView: View {
    let axe: Axe
    let marches: [(nom: String, couleur: Color, marche: Marche)]
    let rencontre: Rencontre

    var body: some View {
        Canvas { ctx, size in dessiner(&ctx, size) }
            // Plus haut que large sur un téléphone : sinon la graduation
            // horaire et les noms de gare se chevauchent.
            .aspectRatio(1.35, contentMode: .fit)
            .background(Theme.surface, in: RoundedRectangle(cornerRadius: 10))
            .overlay(RoundedRectangle(cornerRadius: 10).strokeBorder(Theme.rule, lineWidth: 1))
            .accessibilityLabel("Graphique de marche de l'axe \(axe.nom)")
    }

    private func dessiner(_ ctx: inout GraphicsContext, _ size: CGSize) {
        let etroit = size.width < 560
        let gauche: CGFloat = etroit ? 108 : 122
        let droite: CGFloat = etroit ? 12 : 16
        let haut: CGFloat = 16, bas: CGFloat = 34
        let corpsGare: CGFloat = etroit ? 9 : 10
        let L = axe.longueur
        let tMin = marches.map(\.marche.depart).min() ?? 0
        let tMax = marches.map(\.marche.arrivee).max() ?? 60
        let marge = max(10, (tMax - tMin) * 0.06)
        let t0 = tMin - marge, t1 = tMax + marge

        func X(_ t: Double) -> CGFloat {
            gauche + CGFloat((t - t0) / (t1 - t0)) * (size.width - gauche - droite)
        }
        func Y(_ pk: Double) -> CGFloat {
            haut + CGFloat(pk / L) * (size.height - haut - bas)
        }

        // Le trait de jalon est toujours tracé ; le libellé cède la place dès
        // qu'il empiéterait sur le précédent.
        let hauteurTrace = size.height - haut - bas
        let placeParJalon = hauteurTrace / CGFloat(max(1, axe.jalons.count - 1))
        let avecPk = placeParJalon >= 30 && !etroit
        var dernierY: CGFloat = -99
        for j in axe.jalons {
            let y = Y(j.pk)
            var l = Path(); l.move(to: CGPoint(x: gauche, y: y)); l.addLine(to: CGPoint(x: size.width - droite, y: y))
            ctx.stroke(l, with: .color(Theme.ruleStrong), lineWidth: 1)
            guard y - dernierY >= 13 else { continue }
            dernierY = y
            ctx.draw(Text(j.nom).font(.system(size: corpsGare, weight: .semibold)).foregroundColor(Theme.ink2),
                     at: CGPoint(x: gauche - 8, y: y - (avecPk ? 5 : 0)), anchor: .trailing)
            if avecPk {
                ctx.draw(Text("PK \(Int(j.pk))").font(Theme.mono(8.5)).foregroundColor(Theme.ink3),
                         at: CGPoint(x: gauche - 8, y: y + 6), anchor: .trailing)
            }
        }

        // On retient le pas le plus fin dont les libellés tiennent côte à côte.
        let largeurTrace = size.width - gauche - droite
        let pasMin = [15.0, 30, 60, 120, 180, 360, 720].first { (t1 - t0) / $0 <= Double(largeurTrace / 54) } ?? 720
        var tGrad = (t0 / pasMin).rounded(.up) * pasMin
        while tGrad <= t1 {
            let x = X(tGrad)
            var l = Path(); l.move(to: CGPoint(x: x, y: haut)); l.addLine(to: CGPoint(x: x, y: size.height - bas))
            ctx.stroke(l, with: .color(Theme.rule), lineWidth: 1)
            // Un libellé qui déborderait du cadre n'est pas tracé.
            if x >= gauche + 24, x <= size.width - droite - 24 {
                ctx.draw(Text(Croisement.enHeure(tGrad)).font(Theme.mono(9)).foregroundColor(Theme.ink3),
                         at: CGPoint(x: x, y: size.height - bas + 13), anchor: .center)
            }
            tGrad += pasMin
        }

        ctx.stroke(Path(CGRect(x: gauche, y: haut, width: size.width - gauche - droite,
                               height: size.height - haut - bas)),
                   with: .color(Theme.ruleStrong), lineWidth: 1)

        for m in marches {
            var p = Path()
            for (i, pt) in m.marche.points.enumerated() {
                let c = CGPoint(x: X(pt.t), y: Y(pt.pk))
                if i == 0 { p.move(to: c) } else { p.addLine(to: c) }
            }
            ctx.stroke(p, with: .color(m.couleur), style: StrokeStyle(lineWidth: 2.4, lineCap: .round, lineJoin: .round))
            for pt in m.marche.points {
                let c = CGPoint(x: X(pt.t), y: Y(pt.pk))
                ctx.fill(Path(ellipseIn: CGRect(x: c.x - 2.6, y: c.y - 2.6, width: 5.2, height: 5.2)),
                         with: .color(m.couleur))
            }
            if let tete = m.marche.points.first {
                ctx.draw(Text(m.nom).font(.system(size: 10.5, weight: .semibold)).foregroundColor(m.couleur),
                         at: CGPoint(x: X(tete.t) + 7, y: Y(tete.pk) + (m.marche.montant ? -10 : 12)),
                         anchor: .leading)
            }
        }

        if rencontre.type != .aucun {
            let x = X(rencontre.t), y = Y(rencontre.pk)
            let pointille = StrokeStyle(lineWidth: 1, dash: [3, 3])
            var v = Path(); v.move(to: CGPoint(x: x, y: haut)); v.addLine(to: CGPoint(x: x, y: size.height - bas))
            var h = Path(); h.move(to: CGPoint(x: gauche, y: y)); h.addLine(to: CGPoint(x: size.width - droite, y: y))
            ctx.stroke(v, with: .color(Theme.signal.opacity(0.75)), style: pointille)
            ctx.stroke(h, with: .color(Theme.signal.opacity(0.75)), style: pointille)
            ctx.stroke(Path(ellipseIn: CGRect(x: x - 7, y: y - 7, width: 14, height: 14)),
                       with: .color(Theme.signal), lineWidth: 2.5)
            // L'étiquette se place du côté où elle tient sans mordre sur la
            // gouttière des noms de gare ni sortir du cadre.
            let texte = "\(Croisement.enHeure(rencontre.t)) · PK \(Int(rencontre.pk.rounded()))"
            let lg = CGFloat(texte.count) * 6.6
            let aDroite = x + 13 + lg <= size.width - droite
            let aGauche = x - 13 - lg >= gauche
            let ancre: UnitPoint = aDroite ? .leading : (aGauche ? .trailing : .center)
            let cx = aDroite ? x + 13 : (aGauche ? x - 13 : min(size.width - droite - lg / 2, max(gauche + lg / 2, x)))
            ctx.draw(Text(texte).font(Theme.mono(11, .bold)).foregroundColor(Theme.signal),
                     at: CGPoint(x: cx, y: y - 14), anchor: ancre)
        }
    }
}
