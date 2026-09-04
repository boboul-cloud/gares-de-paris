import SwiftUI

enum Rubrique: String, CaseIterable, Identifiable, Hashable {
    case gares, circuits, carte, techniques, tgv, croisement, exercices, glossaire

    var id: String { rawValue }
    var titre: String {
        switch self {
        case .gares: "Les gares"
        case .circuits: "Circuits"
        case .carte: "Carte"
        case .techniques: "Techniques"
        case .tgv: "TGV"
        case .croisement: "Croisement"
        case .exercices: "Exercices"
        case .glossaire: "Glossaire"
        }
    }
    var symbole: String {
        switch self {
        case .gares: "building.columns"
        case .circuits: "figure.walk.motion"
        case .carte: "map"
        case .techniques: "gearshape.2"
        case .tgv: "bolt.horizontal"
        case .croisement: "chart.xyaxis.line"
        case .exercices: "checkmark.circle"
        case .glossaire: "character.book.closed"
        }
    }
    var sousTitre: String {
        switch self {
        case .gares: "Quatorze fiches, de 1837 à aujourd'hui"
        case .circuits: "Quatre itinéraires clés en main"
        case .carte: "Toutes les gares sur le plan"
        case .techniques: "De la vapeur à l'électron"
        case .tgv: "Naissance et avenir de la grande vitesse"
        case .croisement: "Où deux trains se rencontrent-ils ?"
        case .exercices: "Des séries de huit questions tirées au sort"
        case .glossaire: "Quarante-deux mots du rail"
        }
    }
}

struct RootView: View {
    let corpus: Corpus
    // La sélection de la barre latérale est optionnelle : c'est ce qu'attend
    // `List(selection:)` sur iOS. Les onglets, eux, exigent une valeur.
    @State private var rubrique: Rubrique? = .gares
    private var choisie: Rubrique { rubrique ?? .gares }
    private var ongletSelection: Binding<Rubrique> {
        Binding(get: { choisie }, set: { rubrique = $0 })
    }

    #if os(iOS)
    @Environment(\.horizontalSizeClass) private var largeur
    #endif

    var body: some View {
        #if os(iOS)
        if largeur == .compact { onglets } else { colonnes }
        #else
        colonnes
        #endif
    }

    /// iPhone : navigation par onglets.
    private var onglets: some View {
        TabView(selection: ongletSelection) {
            ForEach(Rubrique.allCases) { r in
                NavigationStack { contenu(r) }
                    .tabItem { Label(r.titre, systemImage: r.symbole) }
                    .tag(r)
            }
        }
    }

    /// iPad et Mac : barre latérale et colonne de contenu.
    private var colonnes: some View {
        NavigationSplitView {
            List(Rubrique.allCases, selection: $rubrique) { r in
                NavigationLink(value: r) {
                    Label {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(r.titre).font(.system(size: 15, weight: .medium))
                            Text(r.sousTitre).font(.system(size: 11)).foregroundStyle(Theme.ink3)
                        }
                    } icon: {
                        Image(systemName: r.symbole)
                    }
                    .padding(.vertical, 3)
                }
            }
            .navigationTitle("Gares de Paris")
            #if os(macOS)
            .navigationSplitViewColumnWidth(min: 236, ideal: 260, max: 320)
            #endif
        } detail: {
            NavigationStack { contenu(choisie) }
        }
    }

    @ViewBuilder
    private func contenu(_ r: Rubrique) -> some View {
        switch r {
        case .gares: GaresView(corpus: corpus)
        case .circuits: CircuitsView(corpus: corpus)
        case .carte: CarteView(corpus: corpus)
        case .techniques: TractionView(traction: corpus.traction)
        case .tgv: TGVView(tgv: corpus.tgv)
        case .croisement: CroisementView(corpus: corpus)
        case .exercices: ExercicesView(corpus: corpus)
            .navigationDestination(for: Station.self) { StationDetailView(station: $0, corpus: corpus) }
        case .glossaire: GlossaireView(glossaire: corpus.glossaire)
        }
    }
}

/// En-tête commun à toutes les rubriques : plaque émaillée, titre, chapô.
struct EnteteRubrique: View {
    let plaque: String
    let titre: String
    var chapo: String? = nil

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Plaque(texte: plaque)
            Text(titre)
                .font(Theme.display(32))
                .foregroundStyle(Theme.ink)
                .fixedSize(horizontal: false, vertical: true)
            if let chapo {
                Text(chapo)
                    .font(.system(size: 16))
                    .foregroundStyle(Theme.ink2)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}
