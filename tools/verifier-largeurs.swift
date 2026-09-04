import SwiftUI
import AppKit

// Contrôle de débordement horizontal de l'application Apple.
//
// Chaque écran est rendu hors écran dans une colonne à la largeur demandée,
// posée sur un canevas plus large dont la marge est peinte en rose. Tout pixel
// non rose dans cette marge est du contenu qui sort du cadre : le programme le
// compte et nomme l'écran fautif. Un témoin volontairement trop large vérifie
// au passage que la détection fonctionne.
//
// Compilation et exécution :
//   swiftc -O -o /tmp/verif apple/GaresDeParis/Model/Corpus.swift \
//       apple/GaresDeParis/Design/*.swift apple/GaresDeParis/Views/*.swift \
//       tools/verifier-largeurs.swift
//   /tmp/verif . /tmp/sortie 393       # 393 = iPhone 15/16, 375 = iPhone SE
@main
struct VerifierLargeurs {
    @MainActor static func main() throws {
        let racine = CommandLine.arguments[1]
        let sortie = CommandLine.arguments[2]
        let largeur = CGFloat(Double(CommandLine.arguments[3]) ?? 393)
        let data = try Data(contentsOf: URL(fileURLWithPath: racine + "/shared/data/corpus.json"))
        let corpus = try JSONDecoder().decode(Corpus.self, from: data)

        let marge: CGFloat = 90            // zone de débordement observée
        let canevas = largeur + marge

        var fautifs: [String] = []

        func controler(_ nom: String, _ hauteur: CGFloat, @ViewBuilder _ vue: () -> some View) {
            let contenu = vue()
                .frame(width: largeur, alignment: .topLeading)
                .background(Theme.ground)

            let planche = ZStack(alignment: .topLeading) {
                Color(red: 1, green: 0.93, blue: 0.93)          // fond de la zone interdite
                contenu
                Rectangle().fill(.red).frame(width: 1).offset(x: largeur)
            }
            .frame(width: canevas, height: hauteur, alignment: .topLeading)

            let r = ImageRenderer(content: planche.environment(\.colorScheme, .light))
            r.scale = 1
            guard let img = r.nsImage, let tiff = img.tiffRepresentation,
                  let rep = NSBitmapImageRep(data: tiff) else { print("échec \(nom)"); return }

            // Un pixel de la marge qui n'est plus rose : quelque chose déborde.
            var deborde = 0
            let x0 = Int(largeur) + 2
            for x in stride(from: x0, to: rep.pixelsWide, by: 1) {
                for y in stride(from: 0, to: rep.pixelsHigh, by: 2) {
                    guard let c = rep.colorAt(x: x, y: y) else { continue }
                    if abs(c.greenComponent - 0.93) > 0.05 || abs(c.blueComponent - 0.93) > 0.05 {
                        deborde += 1
                    }
                }
            }
            if deborde > 40 { fautifs.append("\(nom) — \(deborde) points hors cadre") }
            if let png = rep.representation(using: .png, properties: [:]) {
                try? png.write(to: URL(fileURLWithPath: "\(sortie)/\(nom).png"))
            }
        }

        // Témoin : un élément rigide, plus large que la colonne. S'il n'est pas
        // signalé, c'est le détecteur qui est en défaut, pas les écrans.
        controler("00-temoin-deborde", 120) {
            Rectangle().fill(.blue).frame(width: largeur + 60, height: 40)
        }

        for s in corpus.stations {
            controler("gare-\(s.id)", 5200) { StationDetailContenu(station: s, corpus: corpus) }
        }
        for c in corpus.circuits {
            controler("circuit-\(c.id)", 900) {
                VStack(alignment: .leading, spacing: 18) {
                    BandeauChiffres(chiffres: [
                        Chiffre(valeur: "\(c.etapes.count)", label: "étapes", note: nil),
                        Chiffre(valeur: c.duree, label: "durée totale", note: c.dureeNote),
                        Chiffre(valeur: c.distance, label: "distance", note: c.distanceNote),
                        Chiffre(valeur: c.difficulte, label: "difficulté", note: c.difficulteNote),
                    ], colonnes: 2)
                    ForEach(c.etapes.prefix(2)) { e in
                        EtapeLigne(etape: e, teinte: Color(hex: c.couleur), station: corpus.station(e.stationId))
                    }
                }.padding(22)
            }
        }
        for (i, ch) in corpus.tgv.chapitres.enumerated() {
            controler("tgv-chapitre-\(i + 1)", 1400) { ChapitreSection(chapitre: ch).padding(22) }
        }
        for e in corpus.traction.eres {
            controler("ere-\(e.id)", 2600) { EreSection(ere: e).padding(22) }
        }
        controler("catalogue-vignettes", 1500) {
            VStack(spacing: 16) {
                ForEach(corpus.stations.prefix(4)) { CarteGare(station: $0) }
            }.padding(22)
        }
        // Simulateur de croisement : graphique et bandeau de résultat.
        for (i, ex) in corpus.simulateur.exemples.enumerated() {
            let axe = corpus.simulateur.axes.first { $0.id == ex.axeId }!
            func regler(_ r: ReglageTrain, _ c: Color) -> ReglagesTrain {
                let m = corpus.simulateur.materiels.first { $0.id == r.materielId }
                return ReglagesTrain(materielId: r.materielId, vitesse: m?.vitesse ?? 200,
                                     departMinutes: Croisement.minutes(r.depart), sens: r.sens,
                                     dessert: r.dessert, arret: 2, couleur: c)
            }
            let ra = regler(ex.a, CroisementView.couleurA)
            let rb = regler(ex.b, CroisementView.couleurB)
            let mA = Croisement.construire(axe, ra), mB = Croisement.construire(axe, rb)
            let rc = Croisement.chercher(axe, mA, mB)
            controler("croisement-\(i + 1)", 1100) {
                VStack(alignment: .leading, spacing: 18) {
                    Plaque(texte: "Résultat")
                    Text(ex.nom).font(Theme.display(22)).foregroundStyle(Theme.ink)
                        .fixedSize(horizontal: false, vertical: true)
                    if rc.type != .aucun {
                        BandeauChiffres(chiffres: [
                            Chiffre(valeur: Croisement.enHeure(rc.t), label: "heure de la rencontre", note: nil),
                            Chiffre(valeur: "PK \(Int(rc.pk.rounded()))", label: "point kilométrique",
                                    note: "sur \(Int(axe.longueur)) km"),
                            Chiffre(valeur: "\(Int(rc.rapprochement.rounded())) km/h",
                                    label: "vitesse de rapprochement", note: nil),
                        ], colonnes: 2)
                    }
                    GraphiqueMarcheView(axe: axe, marches: [
                        (nom: "Train A", couleur: ra.couleur, marche: mA),
                        (nom: "Train B", couleur: rb.couleur, marche: mB),
                    ], rencontre: rc)
                }.padding(22)
            }
        }

        // Calculs détaillés : formules et lignes de calcul en chasse fixe.
        for me in corpus.simulateur.methodes {
            let d = Croisement.detailler(corpus.simulateur, me)
            controler("methode-\(me.id)", 1500) {
                VStack(alignment: .leading, spacing: 14) {
                    Plaque(texte: "Méthode")
                    Text(me.nom).font(Theme.display(20)).foregroundStyle(Theme.ink)
                        .fixedSize(horizontal: false, vertical: true)
                    Text(me.formule).font(Theme.mono(13)).foregroundStyle(Theme.ink)
                        .fixedSize(horizontal: false, vertical: true)
                        .padding(11)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Theme.surface2, in: RoundedRectangle(cornerRadius: 5))
                    ForEach(d.etapes) { e in
                        VStack(alignment: .leading, spacing: 5) {
                            Text(e.titre).font(.system(size: 13, weight: .semibold)).foregroundStyle(Theme.ink)
                                .fixedSize(horizontal: false, vertical: true)
                            Text(e.calcul).font(Theme.mono(13)).foregroundStyle(Theme.signal)
                                .fixedSize(horizontal: false, vertical: true)
                            Text(e.detail).font(.system(size: 13)).foregroundStyle(Theme.ink3)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(12)
                        .background(Theme.surface, in: RoundedRectangle(cornerRadius: 6))
                    }
                    Text(d.resultat).font(Theme.display(17)).foregroundStyle(Theme.ink)
                        .fixedSize(horizontal: false, vertical: true)
                }.padding(22)
            }
        }

        // Exercices : énoncés longs, options de réponse et corrigé illustré.
        for (i, mode) in ["croisements", "culture", "melange"].enumerated() {
            let qs = MoteurExercices.engendrer(corpus, numero: 1837, mode: mode)
            controler("exercices-\(mode)", 3200) {
                VStack(alignment: .leading, spacing: 20) {
                    Plaque(texte: "Mode \(mode)")
                    ForEach(qs.prefix(3)) { q in
                        VStack(alignment: .leading, spacing: 12) {
                            Text("Question \(q.numero) · \(q.nomFamille)")
                                .font(Theme.mono(11)).foregroundStyle(Theme.signal)
                            Text(q.enonce).font(Theme.display(19)).foregroundStyle(Theme.ink)
                                .fixedSize(horizontal: false, vertical: true)
                            if case let .choix(options, _) = q.reponse {
                                ForEach(Array(options.enumerated()), id: \.offset) { _, texte in
                                    Text(texte).font(.system(size: 14.5)).foregroundStyle(Theme.ink2)
                                        .fixedSize(horizontal: false, vertical: true)
                                        .frame(maxWidth: .infinity, alignment: .leading)
                                        .padding(13)
                                        .background(Theme.surface, in: RoundedRectangle(cornerRadius: 6))
                                }
                            }
                            Text(q.explication).font(.system(size: 15)).foregroundStyle(Theme.ink2)
                                .fixedSize(horizontal: false, vertical: true)
                            if let ctx = q.contexte,
                               let axe = corpus.simulateur.axes.first(where: { $0.id == ctx.axeId }) {
                                let mA = Croisement.construire(axe, ctx.a)
                                let mB = Croisement.construire(axe, ctx.b)
                                GraphiqueMarcheView(axe: axe, marches: [
                                    (nom: "Train A", couleur: CroisementView.couleurA, marche: mA),
                                    (nom: "Train B", couleur: CroisementView.couleurB, marche: mB),
                                ], rencontre: Croisement.chercher(axe, mA, mB))
                            }
                        }
                        .padding(.bottom, 10)
                    }
                }.padding(22)
            }
            _ = i
        }

        controler("glossaire", 1200) {
            VStack(alignment: .leading, spacing: 16) {
                ForEach(corpus.glossaire.termes.prefix(8)) { t in
                    VStack(alignment: .leading, spacing: 6) {
                        HStack(alignment: .firstTextBaseline, spacing: 9) {
                            Text(t.terme).font(Theme.display(17)).foregroundStyle(Theme.ink)
                            Cartouche(texte: t.categorie)
                        }
                        Text(t.definition).font(.system(size: 14)).foregroundStyle(Theme.ink2)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
            }.padding(22)
        }

        if fautifs.isEmpty {
            print("✓ aucun débordement à \(Int(largeur)) pt de large")
        } else {
            print("✗ débordements à \(Int(largeur)) pt :")
            for f in fautifs { print("   \(f)") }
        }
    }
}
