// Exécute un script dans l'application Web réelle et imprime son résultat.
//
// Contrairement au banc d'essai à DOM simulé (tools/test-web.mjs), ce lanceur
// charge la page dans WKWebView : les événements de pointeur, la mise en page
// et le routage s'y comportent comme dans un navigateur. C'est le seul moyen
// de vérifier des gestes — un clic sur la carte, par exemple.
//
// Compilation et usage :
//   swiftc -O -o /tmp/exejs tools/executer-js.swift
//   /tmp/exejs dist/gares-de-paris.html tools/verifier-carte.js [#/route]
//   /tmp/exejs https://exemple.github.io/site/ tools/verifier-carte.js '#/carte'
//
// La cible peut être un fichier local ou une adresse http(s) : le même script
// vérifie donc aussi bien la version de travail que le site publié.
//
// Le script peut être asynchrone : `await` y est autorisé, et sa valeur de
// retour est imprimée.
import Cocoa
import WebKit

let args = CommandLine.arguments
guard args.count >= 3 else {
    print("usage : executer-js <page.html> <script.js> [#/route]")
    exit(1)
}
let cible = args[1]
let distant = cible.hasPrefix("http://") || cible.hasPrefix("https://")
let page = distant ? URL(string: cible)! : URL(fileURLWithPath: cible)
let script = (try? String(contentsOfFile: args[2], encoding: .utf8)) ?? ""
let route = args.count > 3 ? args[3] : "#/"

let app = NSApplication.shared
app.setActivationPolicy(.accessory)

let vue = WKWebView(frame: NSRect(x: 0, y: 0, width: 1280, height: 900))
let fenetre = NSWindow(contentRect: vue.frame, styleMask: [.borderless], backing: .buffered, defer: false)
fenetre.contentView = vue
fenetre.orderFrontRegardless()

final class Delegue: NSObject, WKNavigationDelegate {
    let script: String
    init(script: String) { self.script = script }

    func webView(_ vue: WKWebView, didFinish nav: WKNavigation!) {
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.8) {
            vue.callAsyncJavaScript(self.script, arguments: [:], in: nil, in: .page) { resultat in
                switch resultat {
                case .success(let v):
                    print(v is NSNull ? "(aucune valeur retournée)" : "\(v)")
                    exit(0)
                case .failure(let e):
                    print("erreur JavaScript : \(e.localizedDescription)")
                    exit(2)
                }
            }
        }
    }

    func webView(_ vue: WKWebView, didFail nav: WKNavigation!, withError e: Error) {
        print("chargement échoué : \(e.localizedDescription)")
        exit(3)
    }
}

let delegue = Delegue(script: script)
vue.navigationDelegate = delegue
let adresse = URL(string: page.absoluteString + route)!
if distant {
    vue.load(URLRequest(url: adresse))
} else {
    vue.loadFileURL(adresse, allowingReadAccessTo: page.deletingLastPathComponent())
}
DispatchQueue.main.asyncAfter(deadline: .now() + 40) { print("délai dépassé"); exit(4) }
app.run()
