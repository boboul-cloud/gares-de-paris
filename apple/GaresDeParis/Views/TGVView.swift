import SwiftUI

struct TGVView: View {
    let tgv: TGV

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 26) {
                VStack(alignment: .leading, spacing: 12) {
                    Plaque(texte: "Bonus")
                    Text(tgv.titre).font(Theme.display(40)).foregroundStyle(Theme.ink)
                    Text(tgv.sousTitre).font(.system(size: 18)).foregroundStyle(Theme.ink2)
                        .fixedSize(horizontal: false, vertical: true)
                    Text(tgv.chapo).font(.system(size: 16)).lineSpacing(3).foregroundStyle(Theme.ink2)
                        .fixedSize(horizontal: false, vertical: true)
                        .padding(.top, 4)
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                BandeauChiffres(chiffres: tgv.chiffresCles, colonnes: 2)

                ForEach(tgv.chapitres) { c in
                    Separateur()
                    ChapitreSection(chapitre: c)
                }

                Separateur()

                VStack(alignment: .leading, spacing: 16) {
                    EnteteRubrique(plaque: "Filiation", titre: "Huit générations")
                    VStack(spacing: 1) {
                        ForEach(tgv.generations) { g in
                            HStack(alignment: .top, spacing: 14) {
                                RoundedRectangle(cornerRadius: 2)
                                    .fill(Color(hex: g.couleur))
                                    .frame(width: 11, height: 11)
                                    .padding(.top, 3)
                                VStack(alignment: .leading, spacing: 4) {
                                    Text(g.nom).font(.system(size: 14.5, weight: .semibold)).foregroundStyle(Theme.ink)
                                    HStack(spacing: 14) {
                                        Text(g.annees)
                                        Text(g.vitesse)
                                    }
                                    .font(Theme.mono(11)).foregroundStyle(Theme.ink3)
                                    Text(g.detail).font(.system(size: 13)).foregroundStyle(Theme.ink3)
                                        .fixedSize(horizontal: false, vertical: true)
                                }
                                Spacer(minLength: 0)
                            }
                            .padding(14)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(Theme.surface)
                        }
                    }
                    .background(Theme.rule)
                    .clipShape(RoundedRectangle(cornerRadius: 10))
                    .overlay(RoundedRectangle(cornerRadius: 10).strokeBorder(Theme.rule, lineWidth: 1))
                }

                ListeSources(sources: tgv.sources)
            }
            .padding(22)
        }
        .background(Theme.ground)
        #if os(iOS)
        .navigationTitle("TGV")
        .navigationBarTitleDisplayMode(.inline)
        #endif
    }
}

struct ChapitreSection: View {
    let chapitre: Chapitre
    private var teinte: Color { Color(hex: chapitre.couleur) }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack(alignment: .firstTextBaseline, spacing: 16) {
                Text(chapitre.numero).font(Theme.display(38)).foregroundStyle(teinte)
                VStack(alignment: .leading, spacing: 4) {
                    Text(chapitre.titre).font(Theme.display(26)).foregroundStyle(Theme.ink)
                        .fixedSize(horizontal: false, vertical: true)
                    Text(chapitre.periode).font(Theme.mono(11.5)).foregroundStyle(Theme.ink3)
                }
                Spacer(minLength: 0)
            }

            Text(chapitre.texte).font(.system(size: 16)).lineSpacing(4).foregroundStyle(Theme.ink2)
                .fixedSize(horizontal: false, vertical: true)

            VStack(spacing: 1) {
                ForEach(chapitre.faits) { f in
                    LigneDef(label: f.label, valeur: f.valeur)
                        .padding(.horizontal, 14).padding(.vertical, 11)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Theme.surface)
                }
            }
            .background(Theme.rule)
            .clipShape(RoundedRectangle(cornerRadius: 10))
            .overlay(RoundedRectangle(cornerRadius: 10).strokeBorder(Theme.rule, lineWidth: 1))
        }
    }
}
