import SwiftUI

struct TractionView: View {
    let traction: Traction

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 26) {
                EnteteRubrique(plaque: "Dossier technique", titre: traction.titre, chapo: traction.sousTitre)
                Text(traction.intro)
                    .font(.system(size: 16)).lineSpacing(3).foregroundStyle(Theme.ink2)
                    .fixedSize(horizontal: false, vertical: true)

                ForEach(traction.eres) { e in
                    Separateur()
                    EreSection(ere: e)
                }

                Separateur()

                VStack(alignment: .leading, spacing: 18) {
                    EnteteRubrique(plaque: "Signalisation", titre: traction.signalisation.titre,
                                   chapo: traction.signalisation.intro)
                    LazyVGrid(columns: [GridItem(.adaptive(minimum: 240), spacing: 14)], spacing: 14) {
                        ForEach(traction.signalisation.etapes) { s in
                            Panneau {
                                VStack(alignment: .leading, spacing: 6) {
                                    Text(s.periode).font(Theme.mono(10.5)).foregroundStyle(Theme.signal)
                                    Text(s.nom).font(.system(size: 15, weight: .semibold)).foregroundStyle(Theme.ink)
                                    Text(s.detail).font(.system(size: 13.5)).foregroundStyle(Theme.ink3)
                                        .fixedSize(horizontal: false, vertical: true)
                                }
                            }
                        }
                    }
                }

                ListeSources(sources: traction.sources)
            }
            .padding(22)
        }
        .background(Theme.ground)
        #if os(iOS)
        .navigationTitle("Techniques")
        .navigationBarTitleDisplayMode(.inline)
        #endif
    }
}

struct EreSection: View {
    let ere: Ere
    private var teinte: Color { Color(hex: ere.couleur) }

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            VStack(alignment: .leading, spacing: 8) {
                Text(ere.periode).font(Theme.mono(12)).foregroundStyle(teinte)
                Text(ere.nom).font(Theme.display(26)).foregroundStyle(Theme.ink)
                Text(ere.resume).font(.system(size: 14.5)).foregroundStyle(Theme.ink3)
                    .fixedSize(horizontal: false, vertical: true)
            }

            Text(ere.recit).font(.system(size: 15.5)).lineSpacing(3.5).foregroundStyle(Theme.ink2)
                .fixedSize(horizontal: false, vertical: true)

            LazyVGrid(columns: [GridItem(.adaptive(minimum: 210), spacing: 12)], spacing: 12) {
                ForEach(ere.machines) { m in
                    VStack(alignment: .leading, spacing: 5) {
                        Text(m.annee).font(Theme.mono(10.5)).foregroundStyle(teinte)
                        Text(m.nom).font(.system(size: 14, weight: .semibold)).foregroundStyle(Theme.ink)
                        Text(m.detail).font(.system(size: 13)).foregroundStyle(Theme.ink3)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(13)
                    .background(Theme.surface, in: RoundedRectangle(cornerRadius: 8))
                    .overlay(RoundedRectangle(cornerRadius: 8).strokeBorder(Theme.rule, lineWidth: 1))
                }
            }

            Panneau(titre: "Effet sur les gares", bordure: teinte) {
                Text(ere.impactGares).font(.system(size: 14.5)).foregroundStyle(Theme.ink2)
                    .fixedSize(horizontal: false, vertical: true)
            }

            Chronologie(evenements: ere.dates, teinte: teinte)
        }
    }
}

struct ListeSources: View {
    let sources: [Source]

    var body: some View {
        VStack(alignment: .leading, spacing: 7) {
            Cartouche(texte: "Sources", teinte: Theme.ink3)
            ForEach(sources) { s in
                if let url = s.lien {
                    Link(destination: url) {
                        Text(s.titre).font(Theme.mono(11.5)).foregroundStyle(Theme.ink2)
                            .multilineTextAlignment(.leading)
                    }
                } else {
                    Text(s.titre).font(Theme.mono(11.5)).foregroundStyle(Theme.ink3)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.top, 10)
    }
}
