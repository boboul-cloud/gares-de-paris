import SwiftUI
import Foundation

// Contrôle de parité du moteur d'exercices.
//
// Les deux implémentations — web/js/exercices.js et
// apple/GaresDeParis/Design/Exercices.swift — doivent engendrer exactement la
// même série pour un même numéro et un même mode : c'est ce qui permet de
// noter un numéro sur le téléphone et de retrouver les mêmes questions sur
// l'ordinateur. Cet outil exporte la série vue par Swift ; le script
// tools/parite-exercices.mjs exporte celle vue par JavaScript et compare.
//
// Compilation :
//   swiftc -O -o /tmp/parite apple/GaresDeParis/Model/Corpus.swift \
//       apple/GaresDeParis/Design/*.swift apple/GaresDeParis/Views/*.swift \
//       tools/parite-exercices.swift
//   /tmp/parite . 1837 melange
@main
struct PariteExercices {
    static func main() throws {
        let racine = CommandLine.arguments[1]
        let numero = Int(CommandLine.arguments[2])!
        let mode = CommandLine.arguments[3]
        let data = try Data(contentsOf: URL(fileURLWithPath: racine + "/shared/data/corpus.json"))
        let corpus = try JSONDecoder().decode(Corpus.self, from: data)

        var sortie: [[String: String]] = []
        for q in MoteurExercices.engendrer(corpus, numero: numero, mode: mode) {
            var r: String
            switch q.reponse {
            case let .choix(options, bonne): r = "choix:\(bonne)|" + options.joined(separator: "¶")
            case let .heure(v, _): r = String(format: "heure:%.4f", v)
            case let .nombre(v, _, _): r = String(format: "nombre:%.4f", v)
            }
            sortie.append(["f": q.famille, "e": q.enonce, "r": r, "x": q.explication])
        }
        let json = try JSONSerialization.data(withJSONObject: sortie, options: [])
        print(String(data: json, encoding: .utf8)!)
    }
}
