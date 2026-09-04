import SwiftUI

/// Disposition en flot : les éléments s'alignent horizontalement et passent à
/// la ligne quand la largeur manque. Sans elle, une simple `HStack` de badges
/// déborde du cadre dès qu'une gare cumule sept lignes de métro.
struct Flot: Layout {
    var espacementH: CGFloat = 12
    var espacementV: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout Void) -> CGSize {
        let largeurMax = proposal.width ?? .infinity
        var x: CGFloat = 0, y: CGFloat = 0, hauteurLigne: CGFloat = 0, largeurAtteinte: CGFloat = 0
        for v in subviews {
            let t = v.sizeThatFits(.unspecified)
            if x > 0, x + t.width > largeurMax {
                largeurAtteinte = max(largeurAtteinte, x - espacementH)
                x = 0; y += hauteurLigne + espacementV; hauteurLigne = 0
            }
            x += t.width + espacementH
            hauteurLigne = max(hauteurLigne, t.height)
        }
        largeurAtteinte = max(largeurAtteinte, x - espacementH)
        return CGSize(width: proposal.width ?? largeurAtteinte, height: y + hauteurLigne)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout Void) {
        var x = bounds.minX, y = bounds.minY, hauteurLigne: CGFloat = 0
        for v in subviews {
            let t = v.sizeThatFits(.unspecified)
            if x > bounds.minX, x + t.width > bounds.maxX {
                x = bounds.minX; y += hauteurLigne + espacementV; hauteurLigne = 0
            }
            v.place(at: CGPoint(x: x, y: y), anchor: .topLeading, proposal: ProposedViewSize(t))
            x += t.width + espacementH
            hauteurLigne = max(hauteurLigne, t.height)
        }
    }
}

/// Ligne « intitulé / valeur ». La disposition est choisie d'après la largeur
/// disponible, et non d'après le contenu : ainsi toutes les lignes d'un même
/// panneau s'accordent, au lieu que certaines s'alignent en colonnes pendant
/// que d'autres s'empilent.
struct DispositionLigneDef: Layout {
    var largeurIntitule: CGFloat = 108
    var espacementH: CGFloat = 14
    var espacementV: CGFloat = 4
    /// En deçà de ce seuil, l'intitulé passe au-dessus de la valeur. La valeur
    /// retenue laisse les iPhone empiler et les iPad afficher deux colonnes.
    var seuil: CGFloat = 360

    private func enColonnes(_ proposal: ProposedViewSize) -> Bool {
        (proposal.width ?? .infinity) >= seuil
    }

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout Void) -> CGSize {
        guard subviews.count == 2 else { return .zero }
        let l = proposal.width ?? 320
        if enColonnes(proposal) {
            let dispo = l - largeurIntitule - espacementH
            let h1 = subviews[0].sizeThatFits(ProposedViewSize(width: largeurIntitule, height: nil)).height
            let h2 = subviews[1].sizeThatFits(ProposedViewSize(width: dispo, height: nil)).height
            return CGSize(width: l, height: max(h1, h2))
        }
        let h1 = subviews[0].sizeThatFits(ProposedViewSize(width: l, height: nil)).height
        let h2 = subviews[1].sizeThatFits(ProposedViewSize(width: l, height: nil)).height
        return CGSize(width: l, height: h1 + espacementV + h2)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout Void) {
        guard subviews.count == 2 else { return }
        if enColonnes(proposal) {
            let dispo = bounds.width - largeurIntitule - espacementH
            subviews[0].place(at: CGPoint(x: bounds.minX, y: bounds.minY), anchor: .topLeading,
                              proposal: ProposedViewSize(width: largeurIntitule, height: nil))
            subviews[1].place(at: CGPoint(x: bounds.minX + largeurIntitule + espacementH, y: bounds.minY),
                              anchor: .topLeading, proposal: ProposedViewSize(width: dispo, height: nil))
        } else {
            let h1 = subviews[0].sizeThatFits(ProposedViewSize(width: bounds.width, height: nil)).height
            subviews[0].place(at: CGPoint(x: bounds.minX, y: bounds.minY), anchor: .topLeading,
                              proposal: ProposedViewSize(width: bounds.width, height: nil))
            subviews[1].place(at: CGPoint(x: bounds.minX, y: bounds.minY + h1 + espacementV),
                              anchor: .topLeading, proposal: ProposedViewSize(width: bounds.width, height: nil))
        }
    }
}

struct LigneDef<Valeur: View>: View {
    let label: String
    @ViewBuilder var valeur: Valeur

    init(label: String, @ViewBuilder valeur: () -> Valeur) {
        self.label = label
        self.valeur = valeur()
    }

    var body: some View {
        DispositionLigneDef {
            Text(label.uppercased())
                .font(.system(size: 10.5, weight: .semibold))
                .tracking(1.1)
                .foregroundStyle(Theme.ink3)
                .fixedSize(horizontal: false, vertical: true)
            valeur
        }
    }
}

/// Valeur textuelle d'une `LigneDef` : un type nommé plutôt qu'une fermeture,
/// pour que l'initialiseur de commodité ci-dessous ait une signature concrète.
struct ValeurTexte: View {
    let texte: String
    var body: some View {
        Text(texte)
            .font(.system(size: 14.5))
            .foregroundStyle(Theme.ink2)
            .fixedSize(horizontal: false, vertical: true)
    }
}

extension LigneDef where Valeur == ValeurTexte {
    init(label: String, valeur: String) {
        self.init(label: label) { ValeurTexte(texte: valeur) }
    }
}

/// Badge de ligne de transport. Les fiches notent parfois la station de
/// correspondance entre parenthèses : le numéro seul garde la pastille, la
/// précision passe en texte secondaire.
struct BadgeLigne: View {
    let intitule: String
    var teinte: Color

    private var parts: (numero: String, precision: String?) {
        guard let i = intitule.firstIndex(of: "(") else { return (intitule, nil) }
        let numero = intitule[..<i].trimmingCharacters(in: .whitespaces)
        let precision = intitule[i...].trimmingCharacters(in: .whitespaces)
        return (numero.isEmpty ? intitule : numero, precision)
    }

    var body: some View {
        HStack(spacing: 5) {
            Text(parts.numero)
                .font(Theme.mono(12, .medium))
                .foregroundStyle(.white)
                .frame(minWidth: 22)
                .padding(.horizontal, 6)
                .padding(.vertical, 3)
                .background(teinte, in: RoundedRectangle(cornerRadius: 3))
            if let p = parts.precision {
                Text(p)
                    .font(.system(size: 12))
                    .foregroundStyle(Theme.ink3)
                    .lineLimit(1)
            }
        }
        .accessibilityElement(children: .combine)
    }
}
