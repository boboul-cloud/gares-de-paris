import SwiftUI

// Identité visuelle commune à l'application Web et à l'application Apple :
// le bleu émail des plaques de quai, le zinc des verrières, l'ambre des feux.

enum Theme {
    static let email = adaptatif("#0F4670", "#79B0DC")       // plaque émaillée
    static let emailInk = adaptatif("#FFFFFF", "#0D1217")
    static let signal = adaptatif("#BE5417", "#E08B4C")      // feu de signalisation
    static let ground = adaptatif("#E7EBEE", "#0D1217")
    static let surface = adaptatif("#F6F8FA", "#151C23")
    static let surface2 = adaptatif("#DCE2E7", "#1D262E")
    static let ink = adaptatif("#0F161C", "#E2E9EE")
    static let ink2 = adaptatif("#3E4952", "#A6B3BD")
    static let ink3 = adaptatif("#6C7985", "#74818C")
    static let rule = adaptatif("#C6CFD6", "#28323B")
    static let ruleStrong = adaptatif("#A3B0B9", "#3A4753")
    static let mapBg = adaptatif("#DCE2E7", "#151C23")
    static let mapParis = adaptatif("#CFD8DE", "#1E2830")
    static let mapSeine = adaptatif("#7FA6BE", "#3A5F79")
    static let mapRail = adaptatif("#93A2AD", "#566672")   // le réseau ferré, fond de carte du sujet

    // New York (design .serif) tient ici le rôle de la Didone des affiches ;
    // SF Pro celui de la grotesque de labeur, SF Mono celui des chiffres.
    static func display(_ size: CGFloat, _ weight: Font.Weight = .semibold) -> Font {
        .system(size: size, weight: weight, design: .serif)
    }
    static func mono(_ size: CGFloat, _ weight: Font.Weight = .regular) -> Font {
        .system(size: size, weight: weight, design: .monospaced)
    }

    private static func adaptatif(_ clair: String, _ sombre: String) -> Color {
        #if canImport(UIKit)
        return Color(UIColor { trait in
            UIColor(Color(hex: trait.userInterfaceStyle == .dark ? sombre : clair))
        })
        #elseif canImport(AppKit)
        return Color(NSColor(name: nil) { apparence in
            let sombreActif = apparence.bestMatch(from: [.aqua, .darkAqua]) == .darkAqua
            return NSColor(Color(hex: sombreActif ? sombre : clair))
        })
        #else
        return Color(hex: clair)
        #endif
    }
}

extension Color {
    /// Accepte « #RRGGBB », « RRGGBB » et « #RGB ».
    init(hex: String) {
        var s = hex.trimmingCharacters(in: .whitespacesAndNewlines)
        if s.hasPrefix("#") { s.removeFirst() }
        if s.count == 3 { s = s.map { "\($0)\($0)" }.joined() }
        let v = UInt64(s, radix: 16) ?? 0x888888
        self.init(
            .sRGB,
            red: Double((v >> 16) & 0xFF) / 255,
            green: Double((v >> 8) & 0xFF) / 255,
            blue: Double(v & 0xFF) / 255,
            opacity: 1
        )
    }
}

extension Station {
    var accent: Color { Color(hex: artwork.palette.accent) }
}

// MARK: - Composants partagés

/// La plaque émaillée : intitulé de section, blanc sur bleu, filet clair.
struct Plaque: View {
    let texte: String
    var teinte: Color = Theme.email

    var body: some View {
        Text(texte.uppercased())
            .font(.system(size: 11, weight: .semibold))
            .tracking(1.4)
            .foregroundStyle(Theme.emailInk)
            .padding(.horizontal, 11)
            .padding(.vertical, 5)
            .background(
                RoundedRectangle(cornerRadius: 3)
                    .fill(teinte)
                    .overlay(RoundedRectangle(cornerRadius: 3).strokeBorder(Theme.emailInk.opacity(0.4), lineWidth: 1))
            )
            .accessibilityAddTraits(.isHeader)
    }
}

/// Intitulé technique en capitales espacées, à la manière d'un cartouche.
struct Cartouche: View {
    let texte: String
    var teinte: Color = Theme.signal

    var body: some View {
        Text(texte.uppercased())
            .font(Theme.mono(10.5))
            .tracking(1.5)
            .foregroundStyle(teinte)
    }
}

struct Panneau<Contenu: View>: View {
    var titre: String?
    var bordure: Color?
    @ViewBuilder var contenu: Contenu

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            if let titre { Cartouche(texte: titre, teinte: Theme.ink3) }
            contenu
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(18)
        .background(Theme.surface, in: RoundedRectangle(cornerRadius: 10))
        .overlay(RoundedRectangle(cornerRadius: 10).strokeBorder(Theme.rule, lineWidth: 1))
        .overlay(alignment: .leading) {
            if let bordure {
                Rectangle().fill(bordure).frame(width: 3)
                    .clipShape(RoundedRectangle(cornerRadius: 10))
            }
        }
    }
}

/// Bandeau de chiffres, à la façon d'une ligne d'affichage des départs.
struct BandeauChiffres: View {
    let chiffres: [Chiffre]
    var colonnes: Int = 3

    private var comblement: Int {
        let reste = chiffres.count % colonnes
        return reste == 0 ? 0 : colonnes - reste
    }

    var body: some View {
        LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 1), count: colonnes), spacing: 1) {
            ForEach(chiffres) { c in
                VStack(alignment: .leading, spacing: 4) {
                    Text(c.valeur)
                        .font(Theme.display(23))
                        .monospacedDigit()
                        .foregroundStyle(Theme.ink)
                        .lineLimit(2)
                        .minimumScaleFactor(0.7)
                    Text(c.label).font(.system(size: 12)).foregroundStyle(Theme.ink2)
                    if let n = c.note {
                        Text(n).font(Theme.mono(10)).foregroundStyle(Theme.ink3)
                    }
                }
                .frame(maxWidth: .infinity, minHeight: 84, alignment: .topLeading)
                .padding(14)
                .background(Theme.surface)
            }
            // La grille complète sa dernière rangée : sans cela, les cases
            // manquantes laissent voir le fond de séparation et se lisent
            // comme une erreur de mise en page.
            ForEach(0..<comblement, id: \.self) { _ in
                Color.clear
                    .frame(maxWidth: .infinity, minHeight: 84)
                    .background(Theme.surface)
            }
        }
        .background(Theme.rule)
        .clipShape(RoundedRectangle(cornerRadius: 10))
        .overlay(RoundedRectangle(cornerRadius: 10).strokeBorder(Theme.rule, lineWidth: 1))
    }
}

/// Chronologie dessinée comme une voie jalonnée de feux.
struct Chronologie: View {
    let evenements: [Evenement]
    var teinte: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            ForEach(Array(evenements.enumerated()), id: \.element.id) { index, e in
                HStack(alignment: .top, spacing: 16) {
                    // Le filet doit courir sur toute la hauteur de l'étape,
                    // sans quoi il se réduit au diamètre de la pastille et la
                    // voie apparaît hachée.
                    ZStack(alignment: .top) {
                        Rectangle()
                            .fill(Theme.ruleStrong)
                            .frame(width: 2)
                            .frame(maxHeight: .infinity)
                            .padding(.top, 10)
                            .opacity(index == evenements.count - 1 ? 0 : 1)
                        Circle()
                            .fill(teinte)
                            .frame(width: 10, height: 10)
                            .overlay(Circle().strokeBorder(Theme.ground, lineWidth: 3))
                            .offset(y: 5)
                    }
                    .frame(width: 12)
                    .frame(maxHeight: .infinity)

                    VStack(alignment: .leading, spacing: 4) {
                        Text(e.annee)
                            .font(Theme.mono(11.5))
                            .tracking(0.6)
                            .foregroundStyle(Theme.signal)
                        if let t = e.titre, !t.isEmpty {
                            Text(t).font(Theme.display(17)).foregroundStyle(Theme.ink)
                        }
                        Text(e.texte).font(.system(size: 14.5)).foregroundStyle(Theme.ink2)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    .padding(.bottom, 22)
                }
            }
        }
    }
}

struct Etiquette: View {
    let texte: String
    var fond: Color = Theme.surface2
    var teinte: Color = Theme.ink2
    var mono = false

    var body: some View {
        Text(texte)
            .font(mono ? Theme.mono(11.5, .medium) : .system(size: 12.5))
            .foregroundStyle(teinte)
            .padding(.horizontal, 9)
            .padding(.vertical, 4)
            .background(fond, in: RoundedRectangle(cornerRadius: 3))
    }
}
