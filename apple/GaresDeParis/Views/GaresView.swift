import SwiftUI

struct GaresView: View {
    let corpus: Corpus
    @State private var filtre: Categorie? = nil
    @State private var recherche = ""

    private var gares: [Station] {
        corpus.stations.filter { s in
            (filtre == nil || s.categorie == filtre!.rawValue) &&
            (recherche.isEmpty || s.nom.localizedCaseInsensitiveContains(recherche)
             || (s.surnom ?? "").localizedCaseInsensitiveContains(recherche)
             || s.resume.localizedCaseInsensitiveContains(recherche))
        }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                EnteteRubrique(
                    plaque: "Le catalogue",
                    titre: "Quatorze gares",
                    chapo: "Des sept grands terminus aux gares disparues, en passant par le rail souterrain et les gares de la grande vitesse."
                )

                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        FiltreBouton(titre: "Toutes", actif: filtre == nil) { filtre = nil }
                        ForEach(Categorie.allCases) { c in
                            FiltreBouton(titre: c.labelCourt, actif: filtre == c) { filtre = c }
                        }
                    }
                    .padding(.vertical, 2)
                }

                if gares.isEmpty {
                    Text("Aucune gare ne correspond à cette recherche.")
                        .font(.system(size: 15)).foregroundStyle(Theme.ink3)
                        .frame(maxWidth: .infinity, alignment: .leading)
                } else {
                    LazyVGrid(columns: [GridItem(.adaptive(minimum: 258), spacing: 18)], spacing: 18) {
                        ForEach(gares) { s in
                            NavigationLink(value: s) { CarteGare(station: s) }
                                .buttonStyle(.plain)
                        }
                    }
                }
            }
            .padding(22)
        }
        .background(Theme.ground)
        .navigationDestination(for: Station.self) { StationDetailView(station: $0, corpus: corpus) }
        .searchable(text: $recherche, prompt: "Chercher une gare")
        #if os(iOS)
        .navigationTitle("Les gares")
        .navigationBarTitleDisplayMode(.inline)
        #endif
    }
}

struct FiltreBouton: View {
    let titre: String
    let actif: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(titre)
                .font(.system(size: 13.5))
                .foregroundStyle(actif ? Theme.emailInk : Theme.ink2)
                .padding(.horizontal, 13).padding(.vertical, 7)
                .background(actif ? Theme.email : Theme.surface, in: RoundedRectangle(cornerRadius: 4))
                .overlay(RoundedRectangle(cornerRadius: 4).strokeBorder(actif ? Theme.email : Theme.rule, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }
}

struct CarteGare: View {
    let station: Station

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            StationArtwork(station: station)
                .frame(maxWidth: .infinity)
                .background(Theme.surface2)

            VStack(alignment: .leading, spacing: 7) {
                HStack(spacing: 8) {
                    RoundedRectangle(cornerRadius: 2).fill(station.accent).frame(width: 8, height: 8)
                    Text((station.surnom ?? station.categorieLabel).uppercased())
                        .font(Theme.mono(10)).tracking(1.1).foregroundStyle(Theme.ink3)
                        .lineLimit(1)
                }
                Text(station.nom).font(Theme.display(20)).foregroundStyle(Theme.ink)
                    .fixedSize(horizontal: false, vertical: true)
                Text(station.resume)
                    .font(.system(size: 13.5)).foregroundStyle(Theme.ink2)
                    .lineLimit(4)
                    .fixedSize(horizontal: false, vertical: true)
                HStack(spacing: 14) {
                    Text(String(station.ouverture))
                    Text(station.arrondissement)
                }
                .font(Theme.mono(11)).foregroundStyle(Theme.ink3)
                .padding(.top, 3)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(15)
        }
        .background(Theme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 10))
        .overlay(RoundedRectangle(cornerRadius: 10).strokeBorder(Theme.rule, lineWidth: 1))
    }
}
