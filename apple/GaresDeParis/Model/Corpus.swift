import Foundation

// Le corpus est produit par tools/build-data.mjs à partir de shared/data/.
// Les mêmes données alimentent l'application Web et cette application Apple.

struct Corpus: Decodable {
    let version: Int
    let genereLe: String
    let stations: [Station]
    let circuits: [Circuit]
    let traction: Traction
    let tgv: TGV
    let glossaire: Glossaire
    let simulateur: Simulateur
    let exercices: Exercices
    let geo: Geo

    static func charger() throws -> Corpus {
        guard let url = Bundle.main.url(forResource: "corpus", withExtension: "json") else {
            throw CorpusError.introuvable
        }
        return try JSONDecoder().decode(Corpus.self, from: Data(contentsOf: url))
    }

    func station(_ id: String) -> Station? { stations.first { $0.id == id } }
}

enum CorpusError: LocalizedError {
    case introuvable
    var errorDescription: String? {
        "Le fichier corpus.json est absent du bundle. Relancez « node tools/build-data.mjs » puis régénérez le projet."
    }
}

// MARK: - Gares

struct Station: Decodable, Identifiable, Hashable {
    let id: String
    let nom: String
    let nomCourt: String?
    let surnom: String?
    let categorie: String
    let ordre: Int
    let arrondissement: String
    let adresse: String
    let coord: Coord
    let ouverture: Int
    let ouvertureTexte: String?
    let compagnie: String
    let architectes: [String]
    let protection: String?
    let couleur: String
    let resume: String
    let recit: Recit
    let chronologie: [Evenement]
    let chiffres: [Chiffre]
    let dessertes: Dessertes
    let acces: Acces
    let commodites: [Commodite]
    let pepites: [Pepite]
    let anecdote: Anecdote?
    let artwork: Artwork
    let plan: PlanVoies?
    let sources: [Source]

    var categorieLabel: String { Categorie(rawValue: categorie)?.label ?? categorie }
    /// Nom réduit, utilisé sur la carte où la place manque.
    var nomPourCarte: String { nomCourt ?? nom }
}

enum Categorie: String, CaseIterable, Identifiable {
    case grande = "grande-gare"
    case patrimoine = "gare-patrimoine"
    case moderne = "gare-moderne"

    var id: String { rawValue }
    var label: String {
        switch self {
        case .grande: "Les sept grandes gares"
        case .patrimoine: "Patrimoine et gares disparues"
        case .moderne: "Le rail contemporain"
        }
    }
    var labelCourt: String {
        switch self {
        case .grande: "Grandes gares"
        case .patrimoine: "Patrimoine"
        case .moderne: "Contemporain"
        }
    }
}

struct Coord: Decodable, Hashable { let lat: Double; let lon: Double }

struct Recit: Decodable, Hashable {
    let origine: String
    let revolution: String
    let aujourdhui: String

    var sections: [(titre: String, texte: String)] {
        [("L'origine", origine), ("La révolution", revolution), ("Aujourd'hui", aujourdhui)]
    }
}

struct Evenement: Decodable, Hashable, Identifiable {
    let annee: String
    let titre: String?
    let texte: String
    var id: String { annee + (titre ?? "") + texte.prefix(24) }
}

struct Chiffre: Decodable, Hashable, Identifiable {
    let valeur: String
    let label: String
    let note: String?
    var id: String { valeur + label }
}

struct Dessertes: Decodable, Hashable {
    let international: [String]
    let grandesLignes: [String]
    let regional: [String]
    let franciliens: [String]

    var groupes: [(titre: String, valeurs: [String])] {
        [("International", international), ("Grandes lignes", grandesLignes),
         ("Régional", regional), ("Île-de-France", franciliens)]
            .filter { !$0.1.isEmpty }
    }
}

struct Acces: Decodable, Hashable {
    let metro: [String]
    let rer: [String]
    let transilien: [String]
    let tram: [String]
    let bus: [String]
    let velo: String?
    let note: String?
}

struct Commodite: Decodable, Hashable, Identifiable {
    let categorie: String
    let titre: String
    let detail: String
    var id: String { categorie + titre }
}

struct Pepite: Decodable, Hashable, Identifiable {
    let titre: String
    let texte: String
    let ou: String?
    var id: String { titre }
}

struct Anecdote: Decodable, Hashable { let titre: String; let texte: String }

struct Source: Decodable, Hashable, Identifiable {
    let titre: String
    let url: String
    var id: String { url }
    var lien: URL? { URL(string: url) }
}

struct PlanVoies: Decodable, Hashable {
    let type: String
    let orientation: String
    let groupes: [GroupeVoies]
    let entrees: [String]
}

struct GroupeVoies: Decodable, Hashable, Identifiable {
    let nom: String
    let desserte: String
    var id: String { nom }
}

// MARK: - Illustration

struct Artwork: Decodable, Hashable {
    let silhouette: String
    let bays: Int
    let clock: Bool
    let pediment: String
    let statues: Int
    let tower: Tour
    let shed: Halle
    let flags: Int
    let palette: Palette
    let ambiance: String

    var forme: Silhouette { Silhouette(rawValue: silhouette) ?? .terminus }
    var fronton: Fronton { Fronton(rawValue: pediment) ?? .flat }
    var lumiere: Ambiance { Ambiance(rawValue: ambiance) ?? .jour }
}

enum Silhouette: String { case terminus, arch, belfry, modern, shed, museum, viaduct, slab, underground }
enum Fronton: String { case flat, triangular, rose }
enum Ambiance: String {
    case matin, jour, soir, nuit
    /// Teinte de la lumière dominante, utilisée pour les vitrages et l'astre.
    var lumiere: (r: Double, g: Double, b: Double) {
        switch self {
        case .matin: (1.0, 0.953, 0.839)
        case .jour: (1.0, 1.0, 1.0)
        case .soir: (1.0, 0.851, 0.627)
        case .nuit: (1.0, 0.914, 0.659)
        }
    }
    var intensite: Double {
        switch self { case .matin: 0.55; case .jour: 0.32; case .soir: 0.70; case .nuit: 0.85 }
    }
    var hauteurAstre: Double {
        switch self { case .matin: 0.34; case .jour: 0.20; case .soir: 0.52; case .nuit: 0.24 }
    }
    var astre: String? {
        switch self { case .jour: nil; case .nuit: "lune"; default: "soleil" }
    }
}

struct Tour: Decodable, Hashable {
    let present: Bool
    let side: String?
    let height: Double?
    let clockFaces: Int?
    var aGauche: Bool { side == "left" }
}

struct Halle: Decodable, Hashable {
    let present: Bool
    let span: Double
    let rise: Double
}

struct Palette: Decodable, Hashable {
    let sky: [String]
    let stone: String
    let stoneDark: String
    let roof: String
    let glass: String
    let accent: String
}

// MARK: - Circuits

struct Circuit: Decodable, Identifiable, Hashable {
    let id: String
    let nom: String
    let sousTitre: String
    let duree: String
    let dureeNote: String?
    let distance: String
    let distanceNote: String?
    let difficulte: String
    let difficulteNote: String?
    let titreTransport: String
    let couleur: String
    let intro: String
    let conseil: String
    let etapes: [Etape]
}

struct Etape: Decodable, Hashable, Identifiable {
    let ordre: Int
    let stationId: String
    let titre: String
    let heure: String?
    let duree: String
    let aFaire: String
    let transport: Trajet?
    var id: Int { ordre }
}

struct Trajet: Decodable, Hashable {
    let mode: String
    let ligne: String?
    let detail: String
    let duree: String

    var modeLabel: String {
        switch mode {
        case "metro": "Métro"
        case "rer": "RER"
        case "marche": "À pied"
        case "tram": "Tramway"
        case "bus": "Bus"
        default: mode.capitalized
        }
    }
    var symbole: String {
        switch mode {
        case "metro": "tram.fill"
        case "rer": "tram.fill.tunnel"
        case "marche": "figure.walk"
        case "tram": "tram"
        case "bus": "bus"
        default: "arrow.right"
        }
    }
}

// MARK: - Dossiers

struct Traction: Decodable {
    let titre: String
    let sousTitre: String
    let intro: String
    let eres: [Ere]
    let signalisation: Signalisation
    let sources: [Source]
}

struct Ere: Decodable, Identifiable, Hashable {
    let id: String
    let nom: String
    let periode: String
    let couleur: String
    let resume: String
    let recit: String
    let machines: [Machine]
    let impactGares: String
    let dates: [Evenement]
}

struct Machine: Decodable, Hashable, Identifiable {
    let nom: String
    let annee: String
    let detail: String
    var id: String { nom + annee }
}

struct Signalisation: Decodable {
    let titre: String
    let intro: String
    let etapes: [EtapeSignal]
}

struct EtapeSignal: Decodable, Hashable, Identifiable {
    let nom: String
    let periode: String
    let detail: String
    var id: String { nom }
}

struct TGV: Decodable {
    let titre: String
    let sousTitre: String
    let chapo: String
    let chapitres: [Chapitre]
    let generations: [Generation]
    let chiffresCles: [Chiffre]
    let sources: [Source]
}

struct Chapitre: Decodable, Identifiable, Hashable {
    let id: String
    let numero: String
    let titre: String
    let periode: String
    let couleur: String
    let texte: String
    let faits: [Fait]
}

struct Fait: Decodable, Hashable, Identifiable {
    let label: String
    let valeur: String
    var id: String { label }
}

struct Generation: Decodable, Hashable, Identifiable {
    let nom: String
    let annees: String
    let vitesse: String
    let detail: String
    let couleur: String
    var id: String { nom }
}

struct Glossaire: Decodable {
    let titre: String
    let intro: String
    let termes: [Terme]
}

struct Terme: Decodable, Hashable, Identifiable {
    let terme: String
    let categorie: String
    let definition: String
    var id: String { terme }
}

// MARK: - Simulateur de croisement

struct Simulateur: Decodable {
    let titre: String
    let sousTitre: String
    let intro: String
    let modele: String
    let convention: String
    let axes: [Axe]
    let materiels: [Materiel]
    let exemples: [Exemple]
    let methodes: [Methode]
}

struct Methode: Decodable, Identifiable, Hashable {
    let id: String
    let nom: String
    let quand: String
    let formule: String
    let principe: String
    let exemple: ExempleMethode
}

struct ExempleMethode: Decodable, Hashable {
    let axeId: String
    let a: ReglageMethode
    let b: ReglageMethode
    /// Point kilométrique visé, pour les deux méthodes qui imposent le lieu.
    let jalonPk: Double?
}

struct ReglageMethode: Decodable, Hashable {
    let materielId: String?
    let depart: String?
    let sens: String
}

struct Axe: Decodable, Identifiable, Hashable {
    let id: String
    let nom: String
    let gareId: String?
    let origine: String
    let terminus: String
    let longueur: Double
    let note: String
    let jalons: [Jalon]
}

struct Jalon: Decodable, Hashable, Identifiable {
    let pk: Double
    let nom: String
    var id: String { nom }
}

struct Materiel: Decodable, Identifiable, Hashable {
    let id: String
    let nom: String
    let annee: String
    let vitesse: Double
    let couleur: String
    let note: String
}

struct Exemple: Decodable, Identifiable, Hashable {
    let nom: String
    let axeId: String
    let a: ReglageTrain
    let b: ReglageTrain
    var id: String { nom }
}

struct ReglageTrain: Decodable, Hashable {
    let materielId: String
    let depart: String
    let sens: String
    let dessert: Bool
}

// MARK: - Exercices

struct Exercices: Decodable {
    let titre: String
    let sousTitre: String
    let intro: String
    let note: String
    let longueurSerie: Int
    let tolerances: Tolerances
    let modes: [ModeExercice]
    /// L'ordre des familles est une donnée : un dictionnaire Swift n'en a pas,
    /// et la série doit être identique à celle de l'application Web.
    let ordreFamilles: [String]
    let familles: [String: FamilleExercice]
    let verdicts: [String: [String]]
    let bilans: [Bilan]
}

struct Tolerances: Decodable {
    let heureMinutes: Double
    let pkRatio: Double
    let pkMinimum: Double
    let vitesseKmH: Double
    let dureeMinutes: Double
}

struct ModeExercice: Decodable, Identifiable, Hashable {
    let id: String
    let nom: String
    let detail: String
}

struct FamilleExercice: Decodable, Hashable {
    let nom: String
    let mode: String
    let niveau: Int
    let enonce: String
    let indice: String
    let unite: String
}

struct Bilan: Decodable, Hashable {
    let seuil: Int
    let texte: String
}

// MARK: - Géographie

struct Geo: Decodable {
    let source: String?
    let bounds: Bounds
    let arrondissements: [Arrondissement]
    /// Axes de la Seine et de la Marne, tracés et non remplis : les emprises
    /// de berge d'OpenStreetMap ne se referment pas dans la fenêtre extraite.
    let seine: [[[Double]]]
    let canaux: [[[Double]]]
    let voiesFerrees: [[[Double]]]
    let petiteCeinture: [[[Double]]]
    let reperes: [Repere]
}

struct Arrondissement: Decodable, Identifiable, Hashable {
    let n: Int
    let nom: String
    let contour: [[Double]]
    var id: Int { n }
}

struct Bounds: Decodable {
    let minLon: Double
    let maxLon: Double
    let minLat: Double
    let maxLat: Double
}

struct Repere: Decodable, Hashable, Identifiable {
    let nom: String
    let lat: Double
    let lon: Double
    let type: String
    var id: String { nom }
}
