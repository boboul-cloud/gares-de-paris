import SwiftUI

struct ExercicesView: View {
    let corpus: Corpus

    @AppStorage("gdp-ex-mode") private var modeId = "melange"
    @AppStorage("gdp-ex-numero") private var numero = 1837

    @State private var questions: [Question] = []
    @State private var index = 0
    @State private var corrections: [Int: Correction] = [:]
    @State private var saisie = ""
    @State private var indiceVu = false
    @State private var corrige: Correction?

    private var conf: Exercices { corpus.exercices }
    private var question: Question? { index < questions.count ? questions[index] : nil }
    private var termine: Bool { !questions.isEmpty && index >= questions.count }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                EnteteRubrique(plaque: "S'exercer", titre: conf.titre, chapo: conf.sousTitre)
                Text(conf.intro).font(.system(size: 16)).lineSpacing(3).foregroundStyle(Theme.ink2)
                    .fixedSize(horizontal: false, vertical: true)

                reglages

                if termine { bilan } else if let q = question { carte(q) }

                Text(conf.note).font(.system(size: 13)).foregroundStyle(Theme.ink3)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(22)
        }
        .background(Theme.ground)
        .onAppear { if questions.isEmpty { nouvelleSerie(numero) } }
        #if os(iOS)
        .navigationTitle("Exercices")
        .navigationBarTitleDisplayMode(.inline)
        #endif
    }

    // MARK: Réglages

    private var reglages: some View {
        VStack(alignment: .leading, spacing: 12) {
            Flot(espacementH: 8, espacementV: 8) {
                ForEach(conf.modes) { m in
                    Button(m.nom) { modeId = m.id; nouvelleSerie(numero) }
                        .buttonStyle(.plain)
                        .font(.system(size: 13))
                        .foregroundStyle(m.id == modeId ? Theme.emailInk : Theme.ink2)
                        .padding(.horizontal, 13).padding(.vertical, 7)
                        .background(m.id == modeId ? Theme.email : Theme.surface, in: RoundedRectangle(cornerRadius: 4))
                        .overlay(RoundedRectangle(cornerRadius: 4)
                            .strokeBorder(m.id == modeId ? Theme.email : Theme.rule, lineWidth: 1))
                        .help(m.detail)
                }
            }
            HStack(spacing: 12) {
                Text("SÉRIE").font(.system(size: 10.5, weight: .semibold)).tracking(1.1).foregroundStyle(Theme.ink3)
                Stepper(value: Binding(get: { numero }, set: { numero = $0; nouvelleSerie($0) }), in: 1...9999) {
                    Text("\(numero)").font(Theme.mono(14)).monospacedDigit().foregroundStyle(Theme.ink)
                }
                .fixedSize()
                Button("Nouvelle série") { let n = Int.random(in: 1...9000); numero = n; nouvelleSerie(n) }
                    .buttonStyle(.plain)
                    .font(.system(size: 13))
                    .foregroundStyle(Theme.ink2)
                    .padding(.horizontal, 13).padding(.vertical, 7)
                    .background(Theme.surface, in: RoundedRectangle(cornerRadius: 4))
                    .overlay(RoundedRectangle(cornerRadius: 4).strokeBorder(Theme.rule, lineWidth: 1))
            }
        }
    }

    // MARK: Question

    private func carte(_ q: Question) -> some View {
        Panneau(bordure: Theme.email) {
            VStack(alignment: .leading, spacing: 14) {
                HStack(alignment: .firstTextBaseline) {
                    Text("Question \(index + 1) / \(questions.count)")
                        .font(Theme.mono(11.5)).foregroundStyle(Theme.signal)
                    Spacer(minLength: 12)
                    Text("\(q.nomFamille) · niveau \(q.niveau)")
                        .font(Theme.mono(10.5)).foregroundStyle(Theme.ink3)
                        .multilineTextAlignment(.trailing)
                }

                Text(q.enonce).font(Theme.display(19)).lineSpacing(3).foregroundStyle(Theme.ink)
                    .fixedSize(horizontal: false, vertical: true)

                if corrige == nil {
                    saisieReponse(q)
                    Button(indiceVu ? "Masquer l'indice" : "Voir un indice") { indiceVu.toggle() }
                        .buttonStyle(.plain)
                        .font(.system(size: 13)).foregroundStyle(Theme.ink3).underline()
                    if indiceVu {
                        Text(q.indice).font(.system(size: 14)).foregroundStyle(Theme.ink2)
                            .fixedSize(horizontal: false, vertical: true)
                            .padding(12)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(Theme.surface2, in: RoundedRectangle(cornerRadius: 6))
                    }
                } else if let c = corrige {
                    corrigeVue(q, c)
                    Button(index + 1 < questions.count ? "Question suivante" : "Voir le bilan") { suivante() }
                        .buttonStyle(BoutonPlein())
                }
            }
        }
    }

    @ViewBuilder private func saisieReponse(_ q: Question) -> some View {
        if case let .choix(options, _) = q.reponse {
            VStack(spacing: 9) {
                ForEach(Array(options.enumerated()), id: \.offset) { i, texte in
                    Button { valider(choix: i) } label: {
                        HStack(alignment: .top, spacing: 12) {
                            Text(String(UnicodeScalar(65 + i)!))
                                .font(Theme.mono(12, .semibold)).foregroundStyle(Theme.ink3)
                                .frame(width: 22, height: 22)
                                .background(Theme.surface2, in: RoundedRectangle(cornerRadius: 4))
                            Text(texte).font(.system(size: 14.5)).foregroundStyle(Theme.ink2)
                                .fixedSize(horizontal: false, vertical: true)
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }
                        .padding(13)
                        .background(Theme.surface, in: RoundedRectangle(cornerRadius: 6))
                        .overlay(RoundedRectangle(cornerRadius: 6).strokeBorder(Theme.rule, lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                }
            }
        } else {
            let heure = { if case .heure = q.reponse { return true } else { return false } }()
            VStack(alignment: .leading, spacing: 9) {
                HStack(spacing: 10) {
                    TextField(heure ? "hh:mm" : q.reponse.unite, text: $saisie)
                        .textFieldStyle(.plain)
                        .font(Theme.mono(16))
                        .padding(10)
                        .frame(width: 140)
                        .background(Theme.surface2, in: RoundedRectangle(cornerRadius: 4))
                        .overlay(RoundedRectangle(cornerRadius: 4).strokeBorder(Theme.ruleStrong, lineWidth: 1))
                        .onSubmit { valider() }
                        #if os(iOS)
                        .keyboardType(.numbersAndPunctuation)
                        .autocorrectionDisabled()
                        #endif
                    if !q.reponse.unite.isEmpty {
                        Text(q.reponse.unite).font(Theme.mono(12)).foregroundStyle(Theme.ink3)
                    }
                    Button("Valider") { valider() }.buttonStyle(BoutonPlein())
                }
                Text((heure ? "Format hh:mm." : "Un nombre entier suffit.")
                     + " Tolérance : ±\(Int(q.reponse.tolerance.rounded()))"
                     + (q.reponse.unite.isEmpty ? " min" : " \(q.reponse.unite)"))
                    .font(Theme.mono(11)).foregroundStyle(Theme.ink3)
            }
        }
    }

    @ViewBuilder private func corrigeVue(_ q: Question, _ c: Correction) -> some View {
        let mots = conf.verdicts[c.juste ? "juste" : "faux"] ?? ["—"]
        let verdict = mots[(q.numero + q.enonce.count) % mots.count]
        VStack(alignment: .leading, spacing: 14) {
            Rectangle().fill(Theme.rule).frame(height: 1)
            HStack(alignment: .top, spacing: 13) {
                Text(c.juste ? "✓" : "✕")
                    .font(.system(size: 15, weight: .bold)).foregroundStyle(.white)
                    .frame(width: 30, height: 30)
                    .background(c.juste ? Color(hex: "#4F7A55") : Theme.signal, in: Circle())
                VStack(alignment: .leading, spacing: 3) {
                    Text(verdict).font(.system(size: 16, weight: .semibold)).foregroundStyle(Theme.ink)
                    Text(texteAttendu(q, c)).font(.system(size: 14)).foregroundStyle(Theme.ink2)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            Text(q.explication).font(.system(size: 15)).lineSpacing(2.5).foregroundStyle(Theme.ink2)
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

            if let id = q.lien, let gare = corpus.station(id) {
                NavigationLink(value: gare) {
                    Text("Ouvrir la fiche de \(gare.nomPourCarte) →")
                        .font(.system(size: 13.5)).foregroundStyle(Theme.email)
                }
                .buttonStyle(.plain)
            }
        }
    }

    private func texteAttendu(_ q: Question, _ c: Correction) -> String {
        var t = "Réponse attendue : \(c.exacte)"
        if !c.juste, let e = c.ecart {
            t += " — vous étiez à \(Int(e.rounded()))" + (q.reponse.unite.isEmpty ? " min" : " \(q.reponse.unite)")
        }
        return t
    }

    // MARK: Bilan

    private var bilan: some View {
        let justes = corrections.values.filter(\.juste).count
        let total = questions.count
        let pourcent = total == 0 ? 0 : Int((Double(justes) / Double(total) * 100).rounded())
        let texte = (conf.bilans.first { pourcent >= $0.seuil } ?? conf.bilans[conf.bilans.count - 1]).texte
        let rates = questions.indices.filter { !(corrections[$0]?.juste ?? false) }

        return Panneau(bordure: Theme.signal) {
            VStack(alignment: .leading, spacing: 14) {
                Plaque(texte: "Série \(numero) — terminée")
                Text("\(justes) / \(total)").font(Theme.display(42)).monospacedDigit().foregroundStyle(Theme.ink)
                Text(texte).font(.system(size: 16)).foregroundStyle(Theme.ink2)
                    .fixedSize(horizontal: false, vertical: true)
                VStack(spacing: 1) {
                    ForEach(questions.indices, id: \.self) { i in
                        HStack {
                            Text(questions[i].nomFamille).font(.system(size: 14)).foregroundStyle(Theme.ink2)
                            Spacer(minLength: 12)
                            let ok = corrections[i]?.juste ?? false
                            Text(ok ? "juste" : "manqué")
                                .font(Theme.mono(11.5))
                                .foregroundStyle(ok ? Color(hex: "#4F7A55") : Theme.signal)
                        }
                        .padding(.horizontal, 14).padding(.vertical, 10)
                        .background(Theme.surface)
                    }
                }
                .background(Theme.rule)
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .overlay(RoundedRectangle(cornerRadius: 8).strokeBorder(Theme.rule, lineWidth: 1))

                Flot(espacementH: 10, espacementV: 10) {
                    if !rates.isEmpty {
                        Button("Reprendre les \(rates.count) manquée\(rates.count > 1 ? "s" : "")") {
                            questions = rates.enumerated().map { i, j in renumeroter(questions[j], i + 1) }
                            recommencer()
                        }
                        .buttonStyle(BoutonPlein())
                    }
                    Button("Nouvelle série") { let n = Int.random(in: 1...9000); numero = n; nouvelleSerie(n) }
                        .buttonStyle(.plain)
                        .font(.system(size: 13)).foregroundStyle(Theme.ink2)
                        .padding(.horizontal, 13).padding(.vertical, 7)
                        .background(Theme.surface, in: RoundedRectangle(cornerRadius: 4))
                        .overlay(RoundedRectangle(cornerRadius: 4).strokeBorder(Theme.rule, lineWidth: 1))
                }
            }
        }
    }

    // MARK: Enchaînement

    private func nouvelleSerie(_ n: Int) {
        questions = MoteurExercices.engendrer(corpus, numero: n, mode: modeId)
        recommencer()
    }

    private func recommencer() {
        index = 0; corrections = [:]; saisie = ""; indiceVu = false; corrige = nil
    }

    private func valider(choix: Int? = nil) {
        guard let q = question else { return }
        let c = MoteurExercices.corriger(q, saisie: saisie, choix: choix)
        corrections[index] = c
        corrige = c
    }

    private func suivante() {
        index += 1; saisie = ""; indiceVu = false; corrige = nil
    }

    private func renumeroter(_ q: Question, _ n: Int) -> Question {
        Question(numero: n, famille: q.famille, nomFamille: q.nomFamille, niveau: q.niveau,
                 enonce: q.enonce, indice: q.indice, reponse: q.reponse,
                 explication: q.explication, contexte: q.contexte, lien: q.lien)
    }
}

/// Bouton d'action principal : plein, en bleu émail.
struct BoutonPlein: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: 14, weight: .semibold))
            .foregroundStyle(Theme.emailInk)
            .padding(.horizontal, 18).padding(.vertical, 10)
            .background(Theme.email, in: RoundedRectangle(cornerRadius: 4))
            .opacity(configuration.isPressed ? 0.8 : 1)
    }
}
