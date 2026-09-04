import SwiftUI

struct GlossaireView: View {
    let glossaire: Glossaire
    @State private var recherche = ""

    private var termes: [Terme] {
        guard !recherche.isEmpty else { return glossaire.termes }
        return glossaire.termes.filter {
            $0.terme.localizedCaseInsensitiveContains(recherche)
            || $0.categorie.localizedCaseInsensitiveContains(recherche)
            || $0.definition.localizedCaseInsensitiveContains(recherche)
        }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                EnteteRubrique(plaque: "Lexique", titre: glossaire.titre, chapo: glossaire.intro)

                Text("\(termes.count) terme\(termes.count > 1 ? "s" : "")")
                    .font(Theme.mono(11)).foregroundStyle(Theme.ink3)

                LazyVGrid(columns: [GridItem(.adaptive(minimum: 300), spacing: 22)], alignment: .leading, spacing: 0) {
                    ForEach(termes) { t in
                        VStack(alignment: .leading, spacing: 6) {
                            HStack(alignment: .firstTextBaseline, spacing: 9) {
                                Text(t.terme).font(Theme.display(17)).foregroundStyle(Theme.ink)
                                Cartouche(texte: t.categorie)
                            }
                            Text(t.definition).font(.system(size: 14)).foregroundStyle(Theme.ink2)
                                .fixedSize(horizontal: false, vertical: true)
                            Rectangle().fill(Theme.rule).frame(height: 1).padding(.top, 12)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.bottom, 16)
                    }
                }

                if termes.isEmpty {
                    Text("Aucun terme ne correspond.").font(.system(size: 15)).foregroundStyle(Theme.ink3)
                }
            }
            .padding(22)
        }
        .background(Theme.ground)
        .searchable(text: $recherche, prompt: "Chercher un terme")
        #if os(iOS)
        .navigationTitle("Glossaire")
        .navigationBarTitleDisplayMode(.inline)
        #endif
    }
}
