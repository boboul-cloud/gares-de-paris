import SwiftUI

struct CarteView: View {
    let corpus: Corpus
    @State private var choisie: Station?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                EnteteRubrique(
                    plaque: "Géographie",
                    titre: "Le plan des gares",
                    chapo: "Les sept terminus forment une couronne autour du centre : chaque compagnie du XIXᵉ siècle s'était arrêtée à la limite du Paris d'alors, là où le terrain était encore abordable. Le pointillé figure la Petite Ceinture, construite pour les relier entre elles."
                )

                ParisMapView(corpus: corpus, enAvant: choisie?.id) { choisie = $0 }

                if let s = choisie {
                    NavigationLink(value: s) {
                        Panneau(bordure: s.accent) {
                            VStack(alignment: .leading, spacing: 8) {
                                Cartouche(texte: s.surnom ?? s.categorieLabel)
                                Text(s.nom).font(Theme.display(22)).foregroundStyle(Theme.ink)
                                Text(s.resume).font(.system(size: 14)).foregroundStyle(Theme.ink2)
                                    .fixedSize(horizontal: false, vertical: true)
                                Label("Ouvrir la fiche", systemImage: "arrow.right")
                                    .font(.system(size: 13, weight: .medium))
                                    .foregroundStyle(s.accent)
                                    .padding(.top, 2)
                            }
                        }
                    }
                    .buttonStyle(.plain)
                } else {
                    Panneau {
                        Text("Touchez un point de la carte pour ouvrir la fiche de la gare.")
                            .font(.system(size: 14)).foregroundStyle(Theme.ink3)
                    }
                }

                Panneau(titre: "Lecture de la carte") {
                    VStack(alignment: .leading, spacing: 10) {
                        LegendeLigne(couleur: Theme.mapSeine, epaisseur: 5, texte: "La Seine, la Marne et les canaux")
                        LegendeLigne(couleur: Theme.mapRail, epaisseur: 1.4, texte: "Le réseau ferré en exploitation")
                        LegendeLigne(couleur: Theme.signal, epaisseur: 1.8, pointille: true, texte: "La Petite Ceinture, l'anneau de 32 km fermé en 1934")
                        LegendeLigne(couleur: Theme.ruleStrong, epaisseur: 1, texte: "Les limites des vingt arrondissements")
                        HStack(spacing: 10) {
                            Circle().fill(Theme.email).frame(width: 12, height: 12)
                            Text("Gare — le diamètre distingue les grands terminus")
                                .font(.system(size: 13)).foregroundStyle(Theme.ink2)
                        }
                        Text("Limites d'arrondissement : Paris Open Data. Eau et voies ferrées : OpenStreetMap (ODbL). Géométrie simplifiée et embarquée : la carte fonctionne sans réseau.")
                            .font(Theme.mono(10.5)).foregroundStyle(Theme.ink3)
                            .fixedSize(horizontal: false, vertical: true)
                            .padding(.top, 4)
                    }
                }
            }
            .padding(22)
        }
        .background(Theme.ground)
        .navigationDestination(for: Station.self) { StationDetailView(station: $0, corpus: corpus) }
        #if os(iOS)
        .navigationTitle("Carte")
        .navigationBarTitleDisplayMode(.inline)
        #endif
    }
}

struct LegendeLigne: View {
    let couleur: Color
    var epaisseur: CGFloat = 3
    var pointille = false
    let texte: String

    var body: some View {
        HStack(spacing: 10) {
            Canvas { ctx, size in
                var p = Path()
                p.move(to: CGPoint(x: 0, y: size.height / 2))
                p.addLine(to: CGPoint(x: size.width, y: size.height / 2))
                ctx.stroke(p, with: .color(couleur),
                           style: StrokeStyle(lineWidth: epaisseur, lineCap: .round, dash: pointille ? [4, 4] : []))
            }
            .frame(width: 26, height: 12)
            Text(texte).font(.system(size: 13)).foregroundStyle(Theme.ink2)
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}
