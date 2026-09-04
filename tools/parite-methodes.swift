// Contrôle de parité des démonstrations pas à pas.
//
// Les quatre calculs détaillés sont développés en double — dans
// web/js/croisement.js et apple/GaresDeParis/Design/Croisement.swift — et les
// deux doivent produire exactement les mêmes chiffres et les mêmes phrases.
// Cet outil exporte la version Swift ; tools/parite-methodes.mjs compare.
//
// Compilation :
//   swiftc -O -o /tmp/pm apple/GaresDeParis/Model/Corpus.swift \
//       apple/GaresDeParis/Design/*.swift apple/GaresDeParis/Views/*.swift \
//       tools/parite-methodes.swift
//   /tmp/pm .
import SwiftUI
import Foundation

@main
struct PariteMethodes {
    static func main() throws {
        let racine = CommandLine.arguments[1]
        let data = try Data(contentsOf: URL(fileURLWithPath: racine + "/shared/data/corpus.json"))
        let corpus = try JSONDecoder().decode(Corpus.self, from: data)
        var sortie: [String: [String: Any]] = [:]
        for me in corpus.simulateur.methodes {
            let d = Croisement.detailler(corpus.simulateur, me)
            sortie[me.id] = [
                "etapes": d.etapes.map { ["titre": $0.titre, "calcul": $0.calcul, "detail": $0.detail] },
                "resultat": d.resultat,
            ]
        }
        let json = try JSONSerialization.data(withJSONObject: sortie, options: [.sortedKeys])
        print(String(data: json, encoding: .utf8)!)
    }
}
