import CoreGraphics
import Foundation
import ImageIO
import UniformTypeIdentifiers

// Icône de l'application : une façade de terminus et un train, blanc et bleu
// émail — la palette des plaques de quai françaises.
//
// Deux contraintes imposées par Apple sont respectées ici :
//   · aucun canal alpha — le PNG est écrit en RGB 24 bits, opaque ;
//   · aucun coin arrondi — le fond couvre le carré bord à bord, le système
//     appliquant lui-même son masque.
// Les deux sont vérifiées par App Store Connect, qui refuse l'envoi sinon.

let bleu = CGColor(srgbRed: 0x0F / 255, green: 0x46 / 255, blue: 0x70 / 255, alpha: 1)
let creme = CGColor(srgbRed: 0xF6 / 255, green: 0xF8 / 255, blue: 0xFA / 255, alpha: 1)
let acier = CGColor(srgbRed: 0xC4 / 255, green: 0xD8 / 255, blue: 0xE6 / 255, alpha: 1)

/// Rend l'icône dans un contexte opaque, sans composante alpha.
func rendre(_ cotePx: Int) -> CGImage {
    // noneSkipLast : l'octet de transparence est ignoré à l'écriture, le PNG
    // produit est de type « truecolor » sans canal alpha.
    guard let ctx = CGContext(
        data: nil, width: cotePx, height: cotePx,
        bitsPerComponent: 8, bytesPerRow: 0,
        space: CGColorSpace(name: CGColorSpace.sRGB)!,
        bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue
    ) else { fatalError("contexte graphique indisponible") }

    // Repère de dessin : 512 × 512, origine en haut à gauche.
    let u = CGFloat(cotePx) / 512
    ctx.translateBy(x: 0, y: CGFloat(cotePx))
    ctx.scaleBy(x: u, y: -u)
    ctx.setShouldAntialias(true)
    ctx.interpolationQuality = .high

    func bloc(_ x: CGFloat, _ y: CGFloat, _ l: CGFloat, _ h: CGFloat, _ c: CGColor) {
        ctx.setFillColor(c)
        ctx.fill(CGRect(x: x, y: y, width: l, height: h))
    }
    func disque(_ cx: CGFloat, _ cy: CGFloat, _ r: CGFloat, _ c: CGColor) {
        ctx.setFillColor(c)
        ctx.fillEllipse(in: CGRect(x: cx - r, y: cy - r, width: r * 2, height: r * 2))
    }
    /// Baie cintrée : un rectangle surmonté d'un demi-cercle de même largeur.
    func arcade(_ cx: CGFloat, _ hautArc: CGFloat, _ bas: CGFloat, _ demiL: CGFloat, _ c: CGColor) {
        disque(cx, hautArc + demiL, demiL, c)
        bloc(cx - demiL, hautArc + demiL, demiL * 2, bas - hautArc - demiL, c)
    }
    func rectArrondi(_ r: CGRect, _ rayon: CGFloat, _ c: CGColor) {
        ctx.setFillColor(c)
        ctx.addPath(CGPath(roundedRect: r, cornerWidth: rayon, cornerHeight: rayon, transform: nil))
        ctx.fillPath()
    }

    // Fond plein, jusqu'aux bords : pas de coin arrondi, pas de marge.
    bloc(0, 0, 512, 512, bleu)

    // --- La façade -------------------------------------------------------
    bloc(196, 62, 120, 66, creme)            // pavillon central surélevé
    bloc(40, 128, 432, 28, creme)            // corniche débordante
    bloc(60, 156, 392, 156, creme)           // corps du bâtiment

    // Horloge du pavillon, évidée dans la pierre.
    disque(256, 95, 23, bleu)
    ctx.setStrokeColor(creme)
    ctx.setLineCap(.round)
    ctx.setLineWidth(5)
    ctx.move(to: CGPoint(x: 256, y: 95)); ctx.addLine(to: CGPoint(x: 256, y: 80)); ctx.strokePath()
    ctx.setLineWidth(4)
    ctx.move(to: CGPoint(x: 256, y: 95)); ctx.addLine(to: CGPoint(x: 269, y: 101)); ctx.strokePath()

    // Trois baies cintrées, évidées elles aussi.
    for cx in [CGFloat(134), 256, 378] {
        arcade(cx, 198, 312, 48, bleu)
    }

    // Quai devant la gare.
    bloc(28, 312, 456, 18, creme)

    // --- Le train --------------------------------------------------------
    rectArrondi(CGRect(x: 84, y: 350, width: 344, height: 74), 20, acier)
    for (x, l) in [(CGFloat(106), CGFloat(52)), (170, 52), (234, 52), (304, 96)] {
        rectArrondi(CGRect(x: x, y: 368, width: l, height: 32), 7, bleu)
    }
    bloc(96, 420, 320, 8, bleu)              // dégagement sous la caisse
    for cx in [CGFloat(152), 360] {          // roues et moyeux
        disque(cx, 424, 17, acier)
        disque(cx, 424, 6, bleu)
    }

    // Le rail.
    bloc(40, 448, 432, 14, creme)

    guard let image = ctx.makeImage() else { fatalError("rendu impossible") }
    return image
}

func ecrire(_ image: CGImage, _ chemin: String) {
    let url = URL(fileURLWithPath: chemin) as CFURL
    guard let dest = CGImageDestinationCreateWithURL(url, UTType.png.identifier as CFString, 1, nil) else {
        fatalError("écriture impossible : \(chemin)")
    }
    CGImageDestinationAddImage(dest, image, nil)
    guard CGImageDestinationFinalize(dest) else { fatalError("finalisation impossible : \(chemin)") }
}

guard CommandLine.arguments.count > 1 else {
    print("usage : swift generer-icone.swift <dossier AppIcon.appiconset>")
    exit(1)
}
let dossier = CommandLine.arguments[1]

let tailles: [(String, Int)] = [
    ("icon-1024", 1024),
    ("icon-16", 16), ("icon-16@2x", 32),
    ("icon-32", 32), ("icon-32@2x", 64),
    ("icon-128", 128), ("icon-128@2x", 256),
    ("icon-256", 256), ("icon-256@2x", 512),
    ("icon-512", 512), ("icon-512@2x", 1024),
]
for (nom, px) in tailles {
    ecrire(rendre(px), "\(dossier)/\(nom).png")
}
print("\(tailles.count) PNG opaques écrits — carré plein, sans canal alpha")
