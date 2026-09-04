import SwiftUI

// Moteur d'exercices — portage exact de web/js/exercices.js.
//
// Le tirage doit produire la MÊME série que la version Web pour un même numéro.
// Cela impose trois choses, qui gouvernent tout ce fichier :
//   · un générateur pseudo-aléatoire identique au bit près (mulberry32) ;
//   · une consommation du générateur dans le même ordre, appel pour appel ;
//   · le même formatage des chaînes.
// Un test de parité compare les deux sorties question par question.

/// mulberry32, reproduit sur UInt32 pour coïncider avec l'arithmétique 32 bits
/// de JavaScript (`Math.imul`, `>>>`).
struct Alea {
    private var a: UInt32
    init(_ graine: UInt32) { a = graine }

    mutating func suivant() -> Double {
        a = a &+ 0x6d2b79f5
        var t = (a ^ (a >> 15)) &* (a | 1)
        t = (t &+ ((t ^ (t >> 7)) &* (t | 61))) ^ t
        return Double(t ^ (t >> 14)) / 4294967296.0
    }

    mutating func entier(_ min: Int, _ max: Int) -> Int {
        min + Int(suivant() * Double(max - min + 1))
    }

    mutating func choisir<T>(_ liste: [T]) -> T {
        liste[Int(suivant() * Double(liste.count))]
    }

    /// Mélange de Fisher-Yates, parcouru dans le même ordre que la version Web.
    mutating func melanger<T>(_ liste: [T]) -> [T] {
        var a = liste
        var i = a.count - 1
        while i > 0 {
            let j = Int(suivant() * Double(i + 1))
            a.swapAt(i, j)
            i -= 1
        }
        return a
    }
}

enum Reponse {
    case heure(valeur: Double, tolerance: Double)
    case nombre(valeur: Double, tolerance: Double, unite: String)
    case choix(options: [String], bonne: Int)

    var estChoix: Bool { if case .choix = self { return true }; return false }
    var unite: String {
        if case let .nombre(_, _, u) = self { return u }
        return ""
    }
    var tolerance: Double {
        switch self {
        case let .heure(_, t), let .nombre(_, t, _): return t
        case .choix: return 0
        }
    }
}

struct ContexteCroisement: Hashable {
    let axeId: String
    let a: ReglagesTrain
    let b: ReglagesTrain
}

struct Question: Identifiable {
    let numero: Int
    let famille: String
    let nomFamille: String
    let niveau: Int
    let enonce: String
    let indice: String
    let reponse: Reponse
    let explication: String
    let contexte: ContexteCroisement?
    let lien: String?
    var id: Int { numero }
}

struct Correction {
    let juste: Bool
    let exacte: String
    var ecart: Double?
}

enum MoteurExercices {

    /// `Math.round` de JavaScript arrondit la moitié vers le haut ; `.rounded()`
    /// de Swift s'en éloigne de zéro. Les deux diffèrent sur les valeurs
    /// négatives — or une heure de départ calculée peut l'être.
    static func arrondiJS(_ x: Double) -> Double { (x + 0.5).rounded(.down) }

    // MARK: Outils de chaîne — mêmes règles que la version Web

    static func remplir(_ modele: String, _ vars: [String: String]) -> String {
        var out = modele
        for (k, v) in vars { out = out.replacingOccurrences(of: "{\(k)}", with: v) }
        return out
    }

    static func sansParenthese(_ s: String) -> String {
        guard let i = s.firstIndex(of: "(") else { return s.trimmingCharacters(in: .whitespaces) }
        return String(s[..<i]).trimmingCharacters(in: .whitespaces)
    }

    static func tronquer(_ s: String, _ n: Int) -> String {
        guard s.count > n else { return s }
        let coupe = String(s.prefix(n))
        if let espace = coupe.lastIndex(of: " "), coupe.distance(from: coupe.startIndex, to: espace) > Int(Double(n) * 0.6) {
            return String(coupe[..<espace]) + "…"
        }
        return coupe + "…"
    }

    // MARK: Familles

    private static func rapides(_ sim: Simulateur) -> [Materiel] {
        sim.materiels.filter { $0.vitesse >= 80 }
    }

    private static func train(_ sens: String, _ vitesse: Double, _ depart: Double) -> ReglagesTrain {
        ReglagesTrain(materielId: "libre", vitesse: vitesse, departMinutes: Int(depart.rounded()),
                      sens: sens, dessert: false, arret: 0, couleur: .blue)
    }

    private static func croisement(_ r: inout Alea, _ sim: Simulateur, _ famille: String, _ conf: Exercices) -> Question {
        let axe = r.choisir(sim.axes)
        let liste = rapides(sim)
        let mA = r.choisir(liste)
        let mB = r.choisir(liste)
        let fraction = Double(r.entier(6, 14) * 5) / 100
        let departA = Double(420 + r.entier(0, 24) * 5)

        let L = axe.longueur
        let pkVise = fraction * L
        let instant = departA + (pkVise / mA.vitesse) * 60
        let departBArrondi = arrondiJS((instant - ((L - pkVise) / mB.vitesse) * 60) / 5) * 5

        let a = train("impair", mA.vitesse, departA)
        let b = train("pair", mB.vitesse, departBArrondi)
        let croix = Croisement.chercher(axe, Croisement.construire(axe, a), Croisement.construire(axe, b))

        let vars: [String: String] = [
            "axe": axe.nom, "longueur": String(Int(L)), "origine": axe.origine, "terminus": axe.terminus,
            "materielA": mA.nom, "materielB": mB.nom,
            "vitesseA": String(Int(mA.vitesse)), "vitesseB": String(Int(mB.vitesse)),
            "departA": Croisement.enHeure(departA), "departB": Croisement.enHeure(departBArrondi),
        ]

        let surHeure = famille == "croisement-heure"
        let tol = surHeure ? conf.tolerances.heureMinutes
                           : max(conf.tolerances.pkMinimum, L * conf.tolerances.pkRatio)
        let f = conf.familles[famille]!

        let explication = surHeure
            ? "Les deux trains se rapprochent à \(Int(mA.vitesse)) + \(Int(mB.vitesse)) = \(Int(mA.vitesse + mB.vitesse)) km/h. "
              + "En partant de \(Croisement.enHeure(departA)) et \(Croisement.enHeure(departBArrondi)), ils couvrent ensemble les \(Int(L)) km de l'axe "
              + "et se rejoignent à \(Croisement.enHeure(croix.t)), au PK \(Int(arrondiJS(croix.pk))) — entre \(croix.avant?.nom ?? "") et \(croix.apres?.nom ?? "")."
            : "Le croisement a lieu à \(Croisement.enHeure(croix.t)). Le train A a alors roulé \(Croisement.duree(croix.depuisA)) à \(Int(mA.vitesse)) km/h, "
              + "soit \(Int(arrondiJS(croix.parcouruA))) km : c'est le PK \(Int(arrondiJS(croix.pk))), entre \(croix.avant?.nom ?? "") et \(croix.apres?.nom ?? "")."

        return Question(
            numero: 0, famille: famille, nomFamille: f.nom, niveau: f.niveau,
            enonce: remplir(f.enonce, vars), indice: remplir(f.indice, vars),
            reponse: surHeure ? .heure(valeur: croix.t, tolerance: tol)
                              : .nombre(valeur: croix.pk, tolerance: tol, unite: "km"),
            explication: explication,
            contexte: ContexteCroisement(axeId: axe.id, a: a, b: b), lien: nil)
    }

    private static func depart(_ r: inout Alea, _ sim: Simulateur, _ conf: Exercices) -> Question {
        let axe = r.choisir(sim.axes)
        let liste = rapides(sim)
        let mA = r.choisir(liste)
        let mB = r.choisir(liste)
        let jalon = axe.jalons[r.entier(1, axe.jalons.count - 2)]
        let departA = Double(420 + r.entier(0, 24) * 5)

        let L = axe.longueur
        let instantGare = departA + (jalon.pk / mA.vitesse) * 60
        let departB = instantGare - ((L - jalon.pk) / mB.vitesse) * 60

        let vars: [String: String] = [
            "axe": axe.nom, "longueur": String(Int(L)), "origine": axe.origine, "terminus": axe.terminus,
            "materielA": mA.nom, "materielB": mB.nom,
            "vitesseA": String(Int(mA.vitesse)), "vitesseB": String(Int(mB.vitesse)),
            "departA": Croisement.enHeure(departA), "gare": jalon.nom, "pkGare": String(Int(jalon.pk)),
        ]
        let f = conf.familles["depart-a-trouver"]!

        return Question(
            numero: 0, famille: "depart-a-trouver", nomFamille: f.nom, niveau: f.niveau,
            enonce: remplir(f.enonce, vars), indice: remplir(f.indice, vars),
            reponse: .heure(valeur: departB, tolerance: conf.tolerances.heureMinutes),
            explication:
                "Le train A parcourt les \(Int(jalon.pk)) km jusqu'à \(jalon.nom) en \(Croisement.duree((jalon.pk / mA.vitesse) * 60)) : "
                + "il y passe à \(Croisement.enHeure(instantGare)). Le second train doit y être au même instant ; il lui reste "
                + "\(Int(L - jalon.pk)) km à couvrir depuis \(axe.terminus), soit \(Croisement.duree(((L - jalon.pk) / mB.vitesse) * 60)). "
                + "Il doit donc partir à \(Croisement.enHeure(departB)).",
            contexte: ContexteCroisement(axeId: axe.id,
                                         a: train("impair", mA.vitesse, departA),
                                         b: train("pair", mB.vitesse, arrondiJS(departB))),
            lien: nil)
    }

    private static func vitesse(_ r: inout Alea, _ sim: Simulateur, _ conf: Exercices) -> Question {
        let axe = r.choisir(sim.axes)
        let liste = rapides(sim)
        let mA = r.choisir(liste)
        let jalon = axe.jalons[r.entier(1, axe.jalons.count - 2)]
        let departA = Double(420 + r.entier(0, 24) * 5)

        var vise = min(340, mA.vitesse + Double(r.entier(1, 8) * 20))
        let minutesA = (jalon.pk / mA.vitesse) * 60
        var retard = arrondiJS(minutesA - (jalon.pk / vise) * 60)
        while retard < 4 && vise < 340 {
            vise = min(340, vise + 20)
            retard = arrondiJS(minutesA - (jalon.pk / vise) * 60)
        }
        let departB = departA + retard
        let vitesseExacte = jalon.pk / ((minutesA - retard) / 60)

        let vars: [String: String] = [
            "axe": axe.nom, "origine": axe.origine, "terminus": axe.terminus,
            "materielA": mA.nom, "vitesseA": String(Int(mA.vitesse)),
            "departA": Croisement.enHeure(departA), "departB": Croisement.enHeure(departB),
            "gare": jalon.nom, "pkGare": String(Int(jalon.pk)),
        ]
        let f = conf.familles["vitesse-a-trouver"]!

        return Question(
            numero: 0, famille: "vitesse-a-trouver", nomFamille: f.nom, niveau: f.niveau,
            enonce: remplir(f.enonce, vars), indice: remplir(f.indice, vars),
            reponse: .nombre(valeur: vitesseExacte, tolerance: conf.tolerances.vitesseKmH, unite: "km/h"),
            explication:
                "Le train A atteint \(jalon.nom) (PK \(Int(jalon.pk))) à \(Croisement.enHeure(departA + minutesA)), après \(Croisement.duree(minutesA)) de marche. "
                + "Le second, parti \(Int(retard)) minutes plus tard, dispose de \(Croisement.duree(minutesA - retard)) pour couvrir les mêmes \(Int(jalon.pk)) km : "
                + "il lui faut \(Int(arrondiJS(vitesseExacte))) km/h.",
            contexte: ContexteCroisement(axeId: axe.id,
                                         a: train("impair", mA.vitesse, departA),
                                         b: train("impair", arrondiJS(vitesseExacte), departB)),
            lien: nil)
    }

    private static func choixParmi(_ r: inout Alea, _ bonne: String, _ decoys: [String], _ nb: Int = 4) -> (choix: [String], bonne: Int) {
        var uniques: [String] = []
        for d in decoys where d != bonne && !uniques.contains(d) && uniques.count < nb - 1 {
            uniques.append(d)
        }
        let options = r.melanger([bonne] + uniques)
        return (options, options.firstIndex(of: bonne) ?? 0)
    }

    private static func estAnnee(_ s: String) -> Bool {
        s.count == 4 && s.allSatisfy(\.isNumber)
    }

    private static func documentaire(_ r: inout Alea, _ corpus: Corpus, _ conf: Exercices, _ famille: String) -> Question {
        let gares = corpus.stations
        let f = conf.familles[famille]!

        switch famille {
        case "doc-date":
            let avecAnnee = gares.filter { $0.chronologie.contains { estAnnee($0.annee) } }
            let gare = r.choisir(avecAnnee)
            let faits = gare.chronologie.filter { estAnnee($0.annee) }
            let fait = r.choisir(faits)
            var toutes: [String] = []
            for g in gares { for e in g.chronologie where estAnnee(e.annee) { toutes.append(e.annee) } }
            let melangees = r.melanger(toutes)
            let (choix, bonne) = choixParmi(&r, fait.annee, melangees)
            return Question(numero: 0, famille: famille, nomFamille: f.nom, niveau: f.niveau,
                            enonce: remplir(f.enonce, ["gare": gare.nom, "fait": (fait.titre?.isEmpty == false ? fait.titre! : fait.texte)]),
                            indice: f.indice, reponse: .choix(options: choix, bonne: bonne),
                            explication: "\(fait.annee) — \(fait.texte)", contexte: nil, lien: gare.id)

        case "doc-architecte":
            let avec = gares.filter { !$0.architectes.isEmpty }
            let gare = r.choisir(avec)
            let bonneRep = sansParenthese(r.choisir(gare.architectes))
            var autres: [String] = []
            for g in gares where g.id != gare.id { for a in g.architectes { autres.append(sansParenthese(a)) } }
            let melangees = r.melanger(autres)
            let (choix, bonne) = choixParmi(&r, bonneRep, melangees)
            return Question(numero: 0, famille: famille, nomFamille: f.nom, niveau: f.niveau,
                            enonce: remplir(f.enonce, ["gare": gare.nom]),
                            indice: f.indice, reponse: .choix(options: choix, bonne: bonne),
                            explication: "\(gare.nom) — \(gare.architectes.joined(separator: ", ")). \(gare.resume)",
                            contexte: nil, lien: gare.id)

        case "doc-desserte":
            let avec = gares.filter { $0.dessertes.grandesLignes.count > 2 && $0.categorie == Categorie.grande.rawValue }
            let gare = r.choisir(avec)
            let ville = r.choisir(gare.dessertes.grandesLignes)
            let autres = gares.filter { $0.id != gare.id && $0.categorie == Categorie.grande.rawValue }.map(\.nom)
            let melangees = r.melanger(autres)
            let (choix, bonne) = choixParmi(&r, gare.nom, melangees)
            return Question(numero: 0, famille: famille, nomFamille: f.nom, niveau: f.niveau,
                            enonce: remplir(f.enonce, ["destination": sansParenthese(ville)]),
                            indice: f.indice, reponse: .choix(options: choix, bonne: bonne),
                            explication: "\(gare.nom) dessert \(gare.dessertes.grandesLignes.prefix(6).joined(separator: ", ")).",
                            contexte: nil, lien: gare.id)

        default:   // doc-glossaire
            let terme = r.choisir(corpus.glossaire.termes)
            let autres = corpus.glossaire.termes.filter { $0.terme != terme.terme }.map { tronquer($0.definition, 110) }
            let melangees = r.melanger(autres)
            let (choix, bonne) = choixParmi(&r, tronquer(terme.definition, 110), melangees)
            return Question(numero: 0, famille: famille, nomFamille: f.nom, niveau: f.niveau,
                            enonce: remplir(f.enonce, ["terme": terme.terme]),
                            indice: f.indice, reponse: .choix(options: choix, bonne: bonne),
                            explication: "\(terme.terme) — \(terme.definition)", contexte: nil, lien: nil)
        }
    }

    // MARK: Série

    static func famillesDuMode(_ conf: Exercices, _ modeId: String) -> [String] {
        let gardees = modeId == "melange" ? conf.ordreFamilles
                                          : conf.ordreFamilles.filter { conf.familles[$0]?.mode == modeId }
        return gardees.sorted { a, b in
            let na = conf.familles[a]?.niveau ?? 0, nb = conf.familles[b]?.niveau ?? 0
            return na != nb ? na < nb : a < b
        }
    }

    /// Engendre une série. Même numéro et même mode : mêmes questions qu'en Web.
    static func engendrer(_ corpus: Corpus, numero: Int, mode modeId: String) -> [Question] {
        let conf = corpus.exercices
        let sim = corpus.simulateur
        let familles = famillesDuMode(conf, modeId)
        // Reproduit `(numero >>> 0) * 2654435761 + modeId.length * 97` puis ToUint32.
        let graine = UInt32(truncatingIfNeeded: UInt64(UInt32(truncatingIfNeeded: numero)) &* 2654435761
                                              &+ UInt64(modeId.count * 97))
        var r = Alea(graine)
        var questions: [Question] = []

        for i in 0..<conf.longueurSerie {
            let famille = familles[i % familles.count]
            var q: Question
            switch famille {
            case "croisement-heure", "croisement-pk": q = croisement(&r, sim, famille, conf)
            case "depart-a-trouver": q = depart(&r, sim, conf)
            case "vitesse-a-trouver": q = vitesse(&r, sim, conf)
            default: q = documentaire(&r, corpus, conf, famille)
            }
            questions.append(Question(numero: i + 1, famille: q.famille, nomFamille: q.nomFamille,
                                      niveau: q.niveau, enonce: q.enonce, indice: q.indice,
                                      reponse: q.reponse, explication: q.explication,
                                      contexte: q.contexte, lien: q.lien))
        }
        return questions
    }

    // MARK: Correction

    static func corriger(_ q: Question, saisie: String, choix: Int? = nil) -> Correction {
        switch q.reponse {
        case let .choix(options, bonne):
            return Correction(juste: choix == bonne, exacte: options[bonne], ecart: nil)
        case let .heure(valeur, tolerance):
            guard let v = heureEnMinutes(saisie) else {
                return Correction(juste: false, exacte: Croisement.enHeure(valeur), ecart: nil)
            }
            var ecart = abs(v - valeur)
            ecart = min(ecart, 1440 - ecart)      // minuit ne piège personne
            return Correction(juste: ecart <= tolerance, exacte: Croisement.enHeure(valeur), ecart: ecart)
        case let .nombre(valeur, tolerance, unite):
            let attendue = "\(Int(arrondiJS(valeur)))" + (unite.isEmpty ? "" : " \(unite)")
            guard let v = Double(saisie.replacingOccurrences(of: ",", with: ".").trimmingCharacters(in: .whitespaces)) else {
                return Correction(juste: false, exacte: attendue, ecart: nil)
            }
            let ecart = abs(v - valeur)
            return Correction(juste: ecart <= tolerance, exacte: attendue, ecart: ecart)
        }
    }

    private static func heureEnMinutes(_ saisie: String) -> Double? {
        let parts = saisie.trimmingCharacters(in: .whitespaces).split(whereSeparator: { ":hH.".contains($0) })
        guard parts.count == 2, let h = Int(parts[0].trimmingCharacters(in: .whitespaces)),
              let m = Int(parts[1].trimmingCharacters(in: .whitespaces)) else { return nil }
        return Double((h % 24) * 60 + min(59, m))
    }
}
