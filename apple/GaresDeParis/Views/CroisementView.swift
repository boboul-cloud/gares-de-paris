import SwiftUI

struct CroisementView: View {
    let corpus: Corpus

    // Couleurs de rôle et non de matériel : deux TGV identiques donneraient
    // sinon deux droites de la même teinte, indistinguables sur le graphique.
    static let couleurA = Color(hex: "#1F6F8B")
    static let couleurB = Color(hex: "#BE5417")

    @State private var axeId: String = ""
    @State private var a = ReglagesTrain(materielId: "", vitesse: 300, departMinutes: 480,
                                         sens: "impair", dessert: false, arret: 2, couleur: couleurA)
    @State private var b = ReglagesTrain(materielId: "", vitesse: 300, departMinutes: 480,
                                         sens: "pair", dessert: false, arret: 2, couleur: couleurB)

    private var sim: Simulateur { corpus.simulateur }
    private var axe: Axe { sim.axes.first { $0.id == axeId } ?? sim.axes[0] }
    private var mA: Marche { Croisement.construire(axe, a) }
    private var mB: Marche { Croisement.construire(axe, b) }
    private var rencontre: Rencontre { Croisement.chercher(axe, mA, mB) }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                EnteteRubrique(plaque: "En prime", titre: sim.titre, chapo: sim.sousTitre)
                Text(sim.intro)
                    .font(.system(size: 16)).lineSpacing(3).foregroundStyle(Theme.ink2)
                    .fixedSize(horizontal: false, vertical: true)

                exemples
                choixAxe
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 280), spacing: 18)], spacing: 18) {
                    reglages(titre: "Train A", train: $a)
                    reglages(titre: "Train B", train: $b)
                }
                Text(axe.note).font(.system(size: 13.5)).foregroundStyle(Theme.ink3)
                    .fixedSize(horizontal: false, vertical: true)

                resultat
                GraphiqueMarcheView(axe: axe, marches: [
                    (nom: "Train A", couleur: a.couleur, marche: mA),
                    (nom: "Train B", couleur: b.couleur, marche: mB),
                ], rencontre: rencontre)

                Separateur()

                VStack(alignment: .leading, spacing: 16) {
                    EnteteRubrique(plaque: "Méthode", titre: "Les quatre calculs, pas à pas",
                                   chapo: "Chaque démonstration est chiffrée par le programme lui-même, sur un exemple réel : les nombres affichés sont ceux du moteur, pas des valeurs recopiées. Le bouton charge l'exemple dans le simulateur, au-dessus.")
                    ForEach(Array(sim.methodes.enumerated()), id: \.element.id) { i, me in
                        blocMethode(i + 1, me)
                    }
                }

                Separateur()

                LazyVGrid(columns: [GridItem(.adaptive(minimum: 280), spacing: 18)], spacing: 18) {
                    Panneau(titre: "Le modèle") {
                        Text(sim.modele).font(.system(size: 14.5)).foregroundStyle(Theme.ink2)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    Panneau(titre: "Pair et impair") {
                        Text(sim.convention).font(.system(size: 14.5)).foregroundStyle(Theme.ink2)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
            }
            .padding(22)
        }
        .background(Theme.ground)
        .onAppear { if axeId.isEmpty { charger(sim.exemples[0]) } }
        #if os(iOS)
        .navigationTitle("Croisement")
        .navigationBarTitleDisplayMode(.inline)
        #endif
    }

    // MARK: Commandes

    private var exemples: some View {
        Flot(espacementH: 8, espacementV: 8) {
            ForEach(sim.exemples) { e in
                Button(e.nom) { charger(e) }
                    .buttonStyle(.plain)
                    .font(.system(size: 13))
                    .foregroundStyle(Theme.ink2)
                    .padding(.horizontal, 13).padding(.vertical, 7)
                    .background(Theme.surface, in: RoundedRectangle(cornerRadius: 4))
                    .overlay(RoundedRectangle(cornerRadius: 4).strokeBorder(Theme.rule, lineWidth: 1))
            }
        }
    }

    private var choixAxe: some View {
        LigneDef(label: "Axe") {
            Picker("Axe", selection: $axeId) {
                ForEach(sim.axes) { Text("\($0.nom) — \(Int($0.longueur)) km").tag($0.id) }
            }
            .labelsHidden()
            .pickerStyle(.menu)
        }
    }

    private func reglages(titre: String, train: Binding<ReglagesTrain>) -> some View {
        ReglagesTrainVue(titre: titre, train: train, materiels: sim.materiels)
    }

    /// L'heure de départ est stockée en minutes ; `DatePicker` veut une date.
    private func heure(_ train: Binding<ReglagesTrain>) -> Binding<Date> {
        Binding(
            get: {
                let m = train.wrappedValue.departMinutes
                return Calendar.current.date(bySettingHour: m / 60, minute: m % 60, second: 0, of: Date()) ?? Date()
            },
            set: { d in
                let c = Calendar.current.dateComponents([.hour, .minute], from: d)
                train.wrappedValue.departMinutes = (c.hour ?? 0) * 60 + (c.minute ?? 0)
            }
        )
    }

    // MARK: Méthodes de calcul

    private func blocMethode(_ n: Int, _ me: Methode) -> some View {
        let d = Croisement.detailler(sim, me)
        return Panneau(bordure: Theme.signal) {
            VStack(alignment: .leading, spacing: 14) {
                HStack(alignment: .top, spacing: 14) {
                    Text("\(n)").font(Theme.display(26)).foregroundStyle(Theme.signal)
                    VStack(alignment: .leading, spacing: 6) {
                        Text(me.nom).font(Theme.display(20)).foregroundStyle(Theme.ink)
                            .fixedSize(horizontal: false, vertical: true)
                        Text(me.quand).font(.system(size: 14)).foregroundStyle(Theme.ink3)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }

                Text(me.formule)
                    .font(Theme.mono(13))
                    .foregroundStyle(Theme.ink)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(11)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Theme.surface2, in: RoundedRectangle(cornerRadius: 5))

                Text(me.principe).font(.system(size: 14.5)).foregroundStyle(Theme.ink2)
                    .fixedSize(horizontal: false, vertical: true)

                VStack(spacing: 1) {
                    ForEach(Array(d.etapes.enumerated()), id: \.element.id) { i, e in
                        VStack(alignment: .leading, spacing: 5) {
                            Text("\(i + 1). \(e.titre)")
                                .font(.system(size: 13, weight: .semibold)).foregroundStyle(Theme.ink)
                                .fixedSize(horizontal: false, vertical: true)
                            Text(e.calcul).font(Theme.mono(13)).foregroundStyle(Theme.signal)
                                .fixedSize(horizontal: false, vertical: true)
                            Text(e.detail).font(.system(size: 13)).foregroundStyle(Theme.ink3)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(13)
                        .background(Theme.surface)
                    }
                }
                .background(Theme.rule)
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .overlay(RoundedRectangle(cornerRadius: 8).strokeBorder(Theme.rule, lineWidth: 1))

                Text(d.resultat).font(Theme.display(17)).foregroundStyle(Theme.ink)
                    .fixedSize(horizontal: false, vertical: true)

                Button("Charger cet exemple dans le simulateur") {
                    axeId = d.contexte.axeId
                    a = d.contexte.a
                    b = d.contexte.b
                    a.couleur = Self.couleurA
                    b.couleur = Self.couleurB
                }
                .buttonStyle(.plain)
                .font(.system(size: 13))
                .foregroundStyle(Theme.ink2)
                .padding(.horizontal, 13).padding(.vertical, 7)
                .background(Theme.surface, in: RoundedRectangle(cornerRadius: 4))
                .overlay(RoundedRectangle(cornerRadius: 4).strokeBorder(Theme.rule, lineWidth: 1))
            }
        }
    }

    // MARK: Résultat

    @ViewBuilder private var resultat: some View {
        let r = rencontre
        Panneau(bordure: Theme.signal) {
            VStack(alignment: .leading, spacing: 12) {
                Plaque(texte: "Résultat")
                if r.type == .aucun {
                    Text("Pas de rencontre").font(Theme.display(24)).foregroundStyle(Theme.ink)
                    Text(r.raison ?? "").font(.system(size: 15.5)).foregroundStyle(Theme.ink2)
                        .fixedSize(horizontal: false, vertical: true)
                } else {
                    Text("\(r.type == .rattrapage ? "Rattrapage" : "Croisement") à \(Croisement.enHeure(r.t))")
                        .font(Theme.display(24)).foregroundStyle(Theme.ink)
                        .fixedSize(horizontal: false, vertical: true)
                    Text(phrase(r)).font(.system(size: 15.5)).lineSpacing(2).foregroundStyle(Theme.ink2)
                        .fixedSize(horizontal: false, vertical: true)
                    BandeauChiffres(chiffres: [
                        Chiffre(valeur: Croisement.enHeure(r.t), label: "heure de la rencontre", note: nil),
                        Chiffre(valeur: "PK \(Int(r.pk.rounded()))", label: "point kilométrique",
                                note: "sur \(Int(axe.longueur)) km"),
                        Chiffre(valeur: "\(Int(r.parcouruA.rounded())) km", label: "parcourus par A",
                                note: "en \(Croisement.duree(r.depuisA))"),
                        Chiffre(valeur: "\(Int(r.parcouruB.rounded())) km", label: "parcourus par B",
                                note: "en \(Croisement.duree(r.depuisB))"),
                        Chiffre(valeur: "\(Int(r.rapprochement.rounded())) km/h", label: "vitesse de rapprochement",
                                note: r.type == .rattrapage ? "écart des vitesses" : "somme des vitesses"),
                    ], colonnes: 2)
                }
                bilan("Train A", mA, a)
                bilan("Train B", mB, b)
            }
        }
    }

    private func phrase(_ r: Rencontre) -> String {
        let entre = "entre \(r.avant?.nom ?? "") et \(r.apres?.nom ?? "")"
        if r.type == .rattrapage {
            return "Le train B rejoint le train A au PK \(Int(r.pk.rounded())), \(entre). "
                 + "Sur une ligne à double voie il le double ; sur voie unique, il faudrait garer le premier."
        }
        return "Les deux trains se croisent au PK \(Int(r.pk.rounded())), \(entre)."
    }

    private func bilan(_ titre: String, _ m: Marche, _ r: ReglagesTrain) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(titre).font(Theme.mono(11, .medium)).tracking(1).foregroundStyle(Theme.ink)
            Text("\(m.montant ? axe.terminus : axe.origine) → \(m.montant ? axe.origine : axe.terminus)")
                .font(.system(size: 13)).foregroundStyle(Theme.ink3)
            Text("Départ \(Croisement.enHeure(m.depart)) · arrivée \(Croisement.enHeure(m.arrivee)) · \(Croisement.duree(m.arrivee - m.depart))")
                .font(.system(size: 13)).foregroundStyle(Theme.ink3)
            Text("\(Int(m.vitesse)) km/h" + (r.dessert ? ", \(r.arret) min d'arrêt par gare" : ", sans arrêt"))
                .font(.system(size: 13)).foregroundStyle(Theme.ink3)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.leading, 12)
        .overlay(alignment: .leading) { Rectangle().fill(r.couleur).frame(width: 3) }
    }

    private func charger(_ e: Exemple) {
        axeId = e.axeId
        a = depuis(e.a, Self.couleurA)
        b = depuis(e.b, Self.couleurB)
    }

    private func depuis(_ r: ReglageTrain, _ couleur: Color) -> ReglagesTrain {
        let m = sim.materiels.first { $0.id == r.materielId }
        return ReglagesTrain(materielId: r.materielId, vitesse: m?.vitesse ?? 200,
                             departMinutes: Croisement.minutes(r.depart), sens: r.sens,
                             dessert: r.dessert, arret: 2, couleur: couleur)
    }
}

/// Panneau de réglage d'un train. Vue autonome pour pouvoir être rendue seule
/// par l'outil de contrôle des largeurs.
struct ReglagesTrainVue: View {
    let titre: String
    @Binding var train: ReglagesTrain
    let materiels: [Materiel]

    var body: some View {
        Panneau(bordure: train.couleur) {
            VStack(alignment: .leading, spacing: 13) {
                Text(titre).font(Theme.display(18)).foregroundStyle(Theme.ink)

                LigneDef(label: "Matériel") {
                    Picker("Matériel", selection: $train.materielId) {
                        ForEach(materiels) { Text("\($0.nom) — \(Int($0.vitesse)) km/h").tag($0.id) }
                        Text("Vitesse libre…").tag("libre")
                    }
                    .labelsHidden().pickerStyle(.menu)
                    .onChange(of: train.materielId) { _, nouveau in
                        if let m = materiels.first(where: { $0.id == nouveau }) {
                            train.vitesse = m.vitesse
                        }
                    }
                }

                // La vitesse se tape autant qu'elle se règle : le curseur seul
                // ne permettait pas d'entrer une valeur précise.
                LigneDef(label: "Vitesse") {
                    VStack(alignment: .leading, spacing: 9) {
                        HStack(spacing: 8) {
                            TextField("km/h", value: $train.vitesse, format: .number)
                                .textFieldStyle(.plain)
                                .font(Theme.mono(15))
                                .monospacedDigit()
                                .multilineTextAlignment(.trailing)
                                .padding(.horizontal, 10).padding(.vertical, 8)
                                .frame(width: 78)
                                .background(Theme.surface2, in: RoundedRectangle(cornerRadius: 4))
                                .overlay(RoundedRectangle(cornerRadius: 4).strokeBorder(Theme.ruleStrong, lineWidth: 1))
                                #if os(iOS)
                                .keyboardType(.numberPad)
                                #endif
                            Text("km/h").font(Theme.mono(12)).foregroundStyle(Theme.ink3)
                            Stepper("", value: $train.vitesse, in: 20...360, step: 5).labelsHidden()
                            Spacer(minLength: 0)
                        }
                        Slider(value: $train.vitesse, in: 20...360, step: 5)
                    }
                    .onChange(of: train.vitesse) { _, v in
                        // Toute saisie fait basculer en vitesse libre, et reste
                        // dans les bornes plausibles d'un train.
                        let borne = min(360, max(20, v))
                        if borne != v { train.vitesse = borne }
                        train.materielId = "libre"
                    }
                }

                LigneDef(label: "Départ") {
                    DatePicker("Départ", selection: heure, displayedComponents: .hourAndMinute)
                        .labelsHidden()
                }

                LigneDef(label: "Sens") {
                    Picker("Sens", selection: $train.sens) {
                        Text("Impair — au départ de Paris").tag("impair")
                        Text("Pair — vers Paris").tag("pair")
                    }
                    .labelsHidden().pickerStyle(.menu)
                }

                Toggle(isOn: $train.dessert) {
                    Text("Dessert toutes les gares de l'axe").font(.system(size: 13)).foregroundStyle(Theme.ink2)
                }
                .toggleStyle(.switch)

                if train.dessert {
                    LigneDef(label: "Arrêt / gare") {
                        Stepper("\(train.arret) min", value: $train.arret, in: 0...20)
                            .font(Theme.mono(12))
                    }
                }
            }
        }
    }


    /// L'heure de départ est stockée en minutes ; `DatePicker` veut une date.
    private var heure: Binding<Date> {
        Binding(
            get: {
                let m = train.departMinutes
                return Calendar.current.date(bySettingHour: m / 60, minute: m % 60, second: 0, of: Date()) ?? Date()
            },
            set: { d in
                let c = Calendar.current.dateComponents([.hour, .minute], from: d)
                train.departMinutes = (c.hour ?? 0) * 60 + (c.minute ?? 0)
            }
        )
    }
}
