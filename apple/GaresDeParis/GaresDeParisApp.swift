import SwiftUI

@main
struct GaresDeParisApp: App {
    @State private var chargement = Chargement()

    var body: some Scene {
        WindowGroup {
            Group {
                switch chargement.etat {
                case .chargement:
                    ProgressView().controlSize(.large)
                case .pret(let corpus):
                    RootView(corpus: corpus)
                case .echec(let message):
                    ErreurView(message: message)
                }
            }
            .frame(minWidth: 420, minHeight: 520)
            .background(Theme.ground)
            .tint(Theme.email)
        }
        #if os(macOS)
        .defaultSize(width: 1180, height: 820)
        .commands { SidebarCommands() }
        #endif
    }
}

@Observable
final class Chargement {
    enum Etat {
        case chargement
        case pret(Corpus)
        case echec(String)
    }
    private(set) var etat: Etat = .chargement

    init() {
        do { etat = .pret(try Corpus.charger()) }
        catch { etat = .echec(error.localizedDescription) }
    }
}

struct ErreurView: View {
    let message: String

    var body: some View {
        VStack(spacing: 14) {
            Image(systemName: "exclamationmark.triangle").font(.largeTitle).foregroundStyle(Theme.signal)
            Text("Données indisponibles").font(Theme.display(22))
            Text(message)
                .font(.system(size: 14))
                .foregroundStyle(Theme.ink2)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 420)
        }
        .padding(40)
    }
}
