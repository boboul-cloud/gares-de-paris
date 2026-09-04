import SwiftUI

struct StationDetailView: View {
    let station: Station
    let corpus: Corpus

    var body: some View {
        ScrollView {
            StationDetailContenu(station: station, corpus: corpus).padding(22)
        }
        .background(Theme.ground)
        #if os(iOS)
        .navigationTitle(station.nom)
        .navigationBarTitleDisplayMode(.inline)
        #else
        .navigationTitle(station.nom)
        #endif
    }
}

/// Contenu de la fiche, isolé du `ScrollView` pour pouvoir être rendu seul —
/// ce qui permet de le contrôler hors écran à la largeur d'un iPhone.
struct StationDetailContenu: View {
    let station: Station
    let corpus: Corpus

    private var teinte: Color { station.accent }

    var body: some View {
        VStack(alignment: .leading, spacing: 26) {
            entete
            StationArtwork(station: station, ratio: 2.3)
                .clipShape(RoundedRectangle(cornerRadius: 10))
                .overlay(RoundedRectangle(cornerRadius: 10).strokeBorder(Theme.rule, lineWidth: 1))

            Text(station.resume)
                .font(Theme.display(19))
                .foregroundStyle(Theme.ink)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.leading, 16)
                .overlay(alignment: .leading) { Rectangle().fill(teinte).frame(width: 4) }

            BandeauChiffres(chiffres: station.chiffres, colonnes: colonnesChiffres)

            recit
            Separateur()
            chronologie
            Separateur()
            plan
            Separateur()
            desserteEtAcces
            Separateur()
            commodites
            Separateur()
            pepites
            if let a = station.anecdote { anecdote(a) }
            situation
            sources
        }
    }

    private var colonnesChiffres: Int {
        #if os(iOS)
        return 2
        #else
        return 3
        #endif
    }

    private var entete: some View {
        VStack(alignment: .leading, spacing: 10) {
            if let s = station.surnom { Cartouche(texte: s) }
            Text(station.nom)
                .font(Theme.display(34))
                .foregroundStyle(Theme.ink)
                .fixedSize(horizontal: false, vertical: true)
            VStack(alignment: .leading, spacing: 7) {
                LigneDef(label: "Ouverture", valeur: station.ouvertureTexte ?? String(station.ouverture))
                LigneDef(label: "Compagnie", valeur: station.compagnie)
                LigneDef(label: "Architectes", valeur: station.architectes.joined(separator: ", "))
                LigneDef(label: "Adresse", valeur: station.adresse)
                if let p = station.protection, !p.isEmpty { LigneDef(label: "Protection", valeur: p) }
            }
            .padding(.top, 6)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var recit: some View {
        VStack(alignment: .leading, spacing: 22) {
            ForEach(station.recit.sections, id: \.titre) { s in
                VStack(alignment: .leading, spacing: 9) {
                    Cartouche(texte: s.titre)
                    Text(s.texte)
                        .font(.system(size: 16))
                        .lineSpacing(4)
                        .foregroundStyle(Theme.ink2)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var chronologie: some View {
        VStack(alignment: .leading, spacing: 18) {
            EnteteRubrique(plaque: "Chronologie", titre: "Les dates qui comptent")
            Chronologie(evenements: station.chronologie, teinte: teinte)
        }
    }

    private var plan: some View {
        VStack(alignment: .leading, spacing: 18) {
            EnteteRubrique(plaque: "Plan", titre: "Comment la gare est faite")
            Panneau {
                VStack(alignment: .leading, spacing: 18) {
                    TrackPlanView(station: station)
                    if let p = station.plan {
                        VStack(alignment: .leading, spacing: 9) {
                            LigneDef(label: "Orientation", valeur: p.orientation)
                            LigneDef(label: "Entrées", valeur: p.entrees.joined(separator: " · "))
                        }
                    }
                }
            }
        }
    }

    private var desserteEtAcces: some View {
        VStack(alignment: .leading, spacing: 18) {
            EnteteRubrique(plaque: "Desserte et accès", titre: "Où l'on va, comment on vient")
            Panneau(titre: "Ce qui part d'ici") {
                VStack(alignment: .leading, spacing: 11) {
                    ForEach(station.dessertes.groupes, id: \.titre) { g in
                        LigneDef(label: g.titre, valeur: g.valeurs.joined(separator: " · "))
                    }
                }
            }
            Panneau(titre: "Y accéder") {
                VStack(alignment: .leading, spacing: 12) {
                    if !station.acces.metro.isEmpty {
                        LigneDef(label: "Métro") {
                            Flot {
                                ForEach(station.acces.metro, id: \.self) { l in
                                    BadgeLigne(intitule: l, teinte: teinte)
                                }
                            }
                        }
                    }
                    if !station.acces.rer.isEmpty { LigneDef(label: "RER", valeur: station.acces.rer.joined(separator: " · ")) }
                    if !station.acces.transilien.isEmpty { LigneDef(label: "Transilien", valeur: station.acces.transilien.joined(separator: " · ")) }
                    if !station.acces.tram.isEmpty { LigneDef(label: "Tramway", valeur: station.acces.tram.joined(separator: " · ")) }
                    if !station.acces.bus.isEmpty { LigneDef(label: "Bus", valeur: station.acces.bus.joined(separator: " · ")) }
                    if let v = station.acces.velo { LigneDef(label: "Vélo", valeur: v) }
                    if let n = station.acces.note {
                        Text(n).font(.system(size: 13.5)).foregroundStyle(Theme.ink3)
                            .fixedSize(horizontal: false, vertical: true).padding(.top, 4)
                    }
                }
            }
        }
    }

    private var commodites: some View {
        VStack(alignment: .leading, spacing: 18) {
            EnteteRubrique(plaque: "Services", titre: "Les commodités aujourd'hui")
            Panneau {
                VStack(alignment: .leading, spacing: 0) {
                    ForEach(Array(station.commodites.enumerated()), id: \.element.id) { i, m in
                        VStack(alignment: .leading, spacing: 5) {
                            Cartouche(texte: m.categorie)
                            Text(m.titre).font(.system(size: 15, weight: .semibold)).foregroundStyle(Theme.ink)
                            Text(m.detail).font(.system(size: 14)).foregroundStyle(Theme.ink2)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.vertical, 13)
                        if i < station.commodites.count - 1 {
                            Rectangle().fill(Theme.rule).frame(height: 1)
                        }
                    }
                }
            }
        }
    }

    private var pepites: some View {
        VStack(alignment: .leading, spacing: 18) {
            EnteteRubrique(plaque: "À voir", titre: "Pourquoi venir, même sans train")
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 260), spacing: 16)], spacing: 16) {
                ForEach(station.pepites) { g in
                    Panneau {
                        VStack(alignment: .leading, spacing: 8) {
                            Text(g.titre).font(Theme.display(17)).foregroundStyle(Theme.ink)
                                .fixedSize(horizontal: false, vertical: true)
                            Text(g.texte).font(.system(size: 14)).foregroundStyle(Theme.ink2)
                                .fixedSize(horizontal: false, vertical: true)
                            if let ou = g.ou {
                                Label(ou, systemImage: "mappin.and.ellipse")
                                    .font(Theme.mono(11)).foregroundStyle(Theme.ink3)
                            }
                        }
                    }
                }
            }
        }
    }

    private func anecdote(_ a: Anecdote) -> some View {
        Panneau(bordure: teinte) {
            VStack(alignment: .leading, spacing: 10) {
                Plaque(texte: "L'anecdote")
                Text(a.titre).font(Theme.display(22)).foregroundStyle(Theme.ink)
                    .fixedSize(horizontal: false, vertical: true)
                Text(a.texte).font(.system(size: 15)).lineSpacing(3).foregroundStyle(Theme.ink2)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    private var situation: some View {
        VStack(alignment: .leading, spacing: 18) {
            EnteteRubrique(plaque: "Situer", titre: "Sur le plan")
            ParisMapView(corpus: corpus, enAvant: station.id, libelles: true)
        }
    }

    private var sources: some View {
        VStack(alignment: .leading, spacing: 7) {
            Cartouche(texte: "Sources", teinte: Theme.ink3)
            ForEach(station.sources) { s in
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
        .padding(.top, 8)
    }
}

struct Separateur: View {
    var body: some View { Rectangle().fill(Theme.rule).frame(height: 1).padding(.vertical, 6) }
}
