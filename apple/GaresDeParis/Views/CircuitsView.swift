import SwiftUI

struct CircuitsView: View {
    let corpus: Corpus

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                EnteteRubrique(
                    plaque: "Sur le terrain",
                    titre: "Quatre circuits",
                    chapo: "Des itinéraires pensés pour être suivis tels quels, avec les correspondances exactes, les durées réalistes et les endroits où s'arrêter manger."
                )

                LazyVGrid(columns: [GridItem(.adaptive(minimum: 300), spacing: 18)], spacing: 18) {
                    ForEach(corpus.circuits) { c in
                        NavigationLink(value: c) {
                            VStack(alignment: .leading, spacing: 0) {
                                ParisMapView(corpus: corpus, circuit: c, libelles: false, detail: .simple, interactif: false)
                                VStack(alignment: .leading, spacing: 7) {
                                    HStack(spacing: 8) {
                                        RoundedRectangle(cornerRadius: 2).fill(Color(hex: c.couleur)).frame(width: 8, height: 8)
                                        Text(c.duree.uppercased()).font(Theme.mono(10)).tracking(1.1).foregroundStyle(Theme.ink3)
                                    }
                                    Text(c.nom).font(Theme.display(20)).foregroundStyle(Theme.ink)
                                        .fixedSize(horizontal: false, vertical: true)
                                    Text(c.sousTitre).font(.system(size: 13.5)).foregroundStyle(Theme.ink2)
                                        .fixedSize(horizontal: false, vertical: true)
                                    HStack(spacing: 14) {
                                        Text("\(c.etapes.count) étapes")
                                        Text(c.distance)
                                    }
                                    .font(Theme.mono(11)).foregroundStyle(Theme.ink3).padding(.top, 3)
                                }
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .padding(15)
                            }
                            .background(Theme.surface)
                            .clipShape(RoundedRectangle(cornerRadius: 10))
                            .overlay(RoundedRectangle(cornerRadius: 10).strokeBorder(Theme.rule, lineWidth: 1))
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            .padding(22)
        }
        .background(Theme.ground)
        .navigationDestination(for: Circuit.self) { CircuitDetailView(circuit: $0, corpus: corpus) }
        .navigationDestination(for: Station.self) { StationDetailView(station: $0, corpus: corpus) }
        #if os(iOS)
        .navigationTitle("Circuits")
        .navigationBarTitleDisplayMode(.inline)
        #endif
    }
}

struct CircuitDetailView: View {
    let circuit: Circuit
    let corpus: Corpus

    private var teinte: Color { Color(hex: circuit.couleur) }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                VStack(alignment: .leading, spacing: 10) {
                    Plaque(texte: circuit.sousTitre, teinte: teinte)
                    Text(circuit.nom).font(Theme.display(32)).foregroundStyle(Theme.ink)
                        .fixedSize(horizontal: false, vertical: true)
                    Text(circuit.intro).font(.system(size: 16)).lineSpacing(3).foregroundStyle(Theme.ink2)
                        .fixedSize(horizontal: false, vertical: true)
                }

                BandeauChiffres(chiffres: [
                    Chiffre(valeur: "\(circuit.etapes.count)", label: "étapes", note: nil),
                    Chiffre(valeur: circuit.duree, label: "durée totale", note: circuit.dureeNote),
                    Chiffre(valeur: circuit.distance, label: "distance", note: circuit.distanceNote),
                    Chiffre(valeur: circuit.difficulte, label: "difficulté", note: circuit.difficulteNote),
                ], colonnes: 2)

                ParisMapView(corpus: corpus, circuit: circuit)

                Panneau(bordure: teinte) {
                    VStack(alignment: .leading, spacing: 8) {
                        Cartouche(texte: "Conseil pratique", teinte: Theme.ink3)
                        Text(circuit.conseil).font(.system(size: 15)).foregroundStyle(Theme.ink2)
                            .fixedSize(horizontal: false, vertical: true)
                        Text("Titre de transport conseillé : \(circuit.titreTransport)")
                            .font(Theme.mono(11.5)).foregroundStyle(Theme.ink3)
                    }
                }

                VStack(alignment: .leading, spacing: 0) {
                    ForEach(circuit.etapes) { e in
                        EtapeLigne(etape: e, teinte: teinte, station: corpus.station(e.stationId))
                        Rectangle().fill(Theme.rule).frame(height: 1)
                    }
                }
            }
            .padding(22)
        }
        .background(Theme.ground)
        .navigationTitle(circuit.nom)
        #if os(iOS)
        .navigationBarTitleDisplayMode(.inline)
        #endif
    }
}

struct EtapeLigne: View {
    let etape: Etape
    let teinte: Color
    let station: Station?

    var body: some View {
        HStack(alignment: .top, spacing: 18) {
            VStack(alignment: .leading, spacing: 5) {
                Text("\(etape.ordre)").font(Theme.display(28)).monospacedDigit().foregroundStyle(teinte)
                if let h = etape.heure {
                    Text(h).font(Theme.mono(10.5)).foregroundStyle(Theme.ink3)
                }
            }
            .frame(width: 54, alignment: .leading)

            VStack(alignment: .leading, spacing: 9) {
                if let t = etape.transport {
                    HStack(spacing: 8) {
                        Image(systemName: t.symbole).font(.system(size: 12)).foregroundStyle(Theme.ink)
                        Text(t.modeLabel + (t.ligne.map { " " + $0 } ?? ""))
                            .font(Theme.mono(11, .medium)).foregroundStyle(Theme.ink)
                        Text("\(t.detail) · \(t.duree)")
                            .font(.system(size: 12)).foregroundStyle(Theme.ink3)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    .padding(.horizontal, 11).padding(.vertical, 7)
                    .background(Theme.surface2, in: RoundedRectangle(cornerRadius: 4))
                }

                Text(etape.titre).font(Theme.display(19)).foregroundStyle(Theme.ink)
                    .fixedSize(horizontal: false, vertical: true)
                Text(etape.aFaire).font(.system(size: 14.5)).foregroundStyle(Theme.ink2)
                    .fixedSize(horizontal: false, vertical: true)

                HStack(spacing: 14) {
                    Text("Compter \(etape.duree)").font(Theme.mono(11)).foregroundStyle(Theme.ink3)
                    if let s = station {
                        NavigationLink(value: s) {
                            Text("Fiche de la gare →").font(.system(size: 12.5, weight: .medium)).foregroundStyle(teinte)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.vertical, 20)
    }
}
