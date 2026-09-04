import SwiftUI

/// Illustration d'une gare, dessinée à la volée d'après sa fiche « artwork ».
/// Aucune image n'est embarquée : c'est le pendant natif du générateur SVG
/// utilisé par l'application Web, à partir des mêmes paramètres.
struct StationArtwork: View {
    let station: Station
    var ratio: CGFloat = 2

    var body: some View {
        Canvas(rendersAsynchronously: false) { ctx, size in
            dessiner(&ctx, size)
        }
        // .fit et non .fill : en mode « fill », la vue grandit dans les deux
        // axes pour remplir la proposition et finit par dépasser la largeur
        // disponible, ce qui faisait déborder les vignettes du catalogue.
        .aspectRatio(ratio, contentMode: .fit)
        .accessibilityLabel("Illustration de \(station.nom)")
    }

    // MARK: Aléatoire déterministe — une gare donne toujours le même dessin.

    private struct Graine {
        private var etat: UInt64
        init(_ texte: String) {
            var h: UInt64 = 0xcbf29ce484222325
            for o in texte.utf8 { h = (h ^ UInt64(o)) &* 0x100000001b3 }
            etat = h | 1
        }
        mutating func next() -> Double {
            etat ^= etat << 13; etat ^= etat >> 7; etat ^= etat << 17
            return Double(etat % 100_000) / 100_000
        }
    }

    // MARK: Dessin

    private func dessiner(_ ctx: inout GraphicsContext, _ size: CGSize) {
        let a = station.artwork
        let p = a.palette
        let w = size.width, h = size.height
        let sol = h * 0.86
        // Les constantes de détail ci-dessous sont écrites pour une hauteur de
        // référence de 440 points ; k les ramène à la taille réelle du canevas,
        // sans quoi les passants écrasent les vignettes du catalogue.
        let k = h / 440
        func e(_ v: CGFloat) -> CGFloat { v * k }
        var rnd = Graine(station.id)

        let pierre = Color(hex: p.stone)
        let pierreF = Color(hex: p.stoneDark)
        let toit = Color(hex: p.roof)
        let verre = Color(hex: p.glass)
        let accent = Color(hex: p.accent)
        let l = a.lumiere.lumiere
        let lumiere = Color(.sRGB, red: l.r, green: l.g, blue: l.b, opacity: 1)
        let nuit = a.lumiere == .nuit

        // Ciel
        ctx.fill(Path(CGRect(origin: .zero, size: size)), with: .linearGradient(
            Gradient(colors: [Color(hex: p.sky.first ?? "#AEBFCB"), Color(hex: p.sky.last ?? "#EFE8DA")]),
            startPoint: .zero, endPoint: CGPoint(x: 0, y: h)))

        if let astre = a.lumiere.astre {
            let ax = w * 0.76, ay = h * a.lumiere.hauteurAstre
            ctx.fill(Path(ellipseIn: CGRect(x: ax - h * 0.3, y: ay - h * 0.3, width: h * 0.6, height: h * 0.6)),
                     with: .radialGradient(Gradient(colors: [lumiere.opacity(a.lumiere.intensite), lumiere.opacity(0)]),
                                           center: CGPoint(x: ax, y: ay), startRadius: 0, endRadius: h * 0.3))
            let r: CGFloat = h * 0.045
            if astre == "lune" {
                var lune = Path(ellipseIn: CGRect(x: ax - r, y: ay - r, width: r * 2, height: r * 2))
                lune.addPath(Path(ellipseIn: CGRect(x: ax - r * 1.7, y: ay - r * 0.85, width: r * 1.7, height: r * 1.7)))
                ctx.fill(lune, with: .color(lumiere.opacity(0.9)), style: FillStyle(eoFill: true))
            } else {
                ctx.fill(Path(ellipseIn: CGRect(x: ax - r, y: ay - r, width: r * 2, height: r * 2)), with: .color(lumiere.opacity(0.9)))
            }
        }
        if nuit {
            for _ in 0..<26 {
                let x = rnd.next() * w, y = rnd.next() * h * 0.5, r = rnd.next() * 1.2 + 0.4
                ctx.fill(Path(ellipseIn: CGRect(x: x, y: y, width: r * 2, height: r * 2)),
                         with: .color(.white.opacity(0.2 + rnd.next() * 0.5)))
            }
        }

        // Toits lointains
        var ville = Path(); ville.move(to: CGPoint(x: 0, y: sol - 4))
        var x: CGFloat = 0
        while x < w {
            let bw = e(24 + rnd.next() * 52), bh = e(26 + rnd.next() * 62)
            ville.addLine(to: CGPoint(x: x, y: sol - 4 - bh))
            ville.addLine(to: CGPoint(x: x + bw, y: sol - 4 - bh))
            x += bw
        }
        ville.addLine(to: CGPoint(x: w, y: sol - 4)); ville.closeSubpath()
        ctx.fill(ville, with: .color(pierreF.opacity(0.22)))

        switch a.forme {
        case .underground:
            dessinerSouterrain(&ctx, size, sol: sol, pierre: pierre, pierreF: pierreF, toit: toit, verre: verre, accent: accent)
            return
        case .viaduct:
            dessinerViaduc(&ctx, size, sol: sol, bays: a.bays, pierre: pierre, pierreF: pierreF, toit: toit, verre: verre, accent: accent, rnd: &rnd)
            return
        default: break
        }

        let corpsL = w * 0.7
        let bx0 = (w - corpsL) / 2, bx1 = bx0 + corpsL, cx = w / 2

        let hautFacade = h * (a.forme == .shed ? 0.56 : a.forme == .modern ? 0.58 : 0.34)

        // Verrière en arrière-plan. Sa flèche est calculée à partir du haut de
        // la façade pour que la voûte dépasse toujours de façon lisible.
        if a.shed.present, a.forme != .modern {
            let span = w * a.shed.span
            let rise = (sol - hautFacade) + h * (0.04 + a.shed.rise * 0.24)
            // Une halle réelle repose sur des murs gouttereaux : on dessine le
            // flanc, puis la voûte au-dessus. Sans lui, les naissances de l'arc
            // forment deux triangles clairs de part et d'autre de la façade.
            let flanc = rise * 0.22
            let baseY = sol - flanc
            let fleche = rise - flanc
            let x0 = w / 2 - span / 2, x1 = w / 2 + span / 2

            ctx.fill(Path(CGRect(x: x0, y: baseY, width: span, height: flanc)), with: .color(toit.opacity(0.42)))

            var halle = Path()
            halle.move(to: CGPoint(x: x0, y: baseY))
            // Sur une courbe quadratique, le sommet est à mi-chemin du point de
            // contrôle : on le place à 2 × la flèche voulue.
            halle.addQuadCurve(to: CGPoint(x: x1, y: baseY), control: CGPoint(x: w / 2, y: baseY - fleche * 2))
            halle.closeSubpath()
            ctx.fill(halle, with: .linearGradient(Gradient(colors: [verre.opacity(0.95), lumiere.opacity(0.75)]),
                                                  startPoint: CGPoint(x: 0, y: baseY - fleche), endPoint: CGPoint(x: 0, y: baseY)))
            for i in 1..<9 {
                let t = CGFloat(i) / 9
                let px = x0 + span * t
                let py = baseY - fleche * sin(.pi * t)
                var c = Path(); c.move(to: CGPoint(x: px, y: baseY)); c.addLine(to: CGPoint(x: px, y: py))
                ctx.stroke(c, with: .color(toit.opacity(0.45)), lineWidth: e(1.6))
            }
            ctx.stroke(halle, with: .color(toit), lineWidth: e(3))
        }

        // Gares contemporaines : une dalle de toiture en léger porte-à-faux,
        // posée sur la façade — le geste architectural propre à ces bâtiments.
        if a.shed.present, a.forme == .modern {
            let dalleL = w * 0.7 * 1.18
            let mx = w / 2 - dalleL / 2
            let my = hautFacade - e(15)
            ctx.fill(Path(roundedRect: CGRect(x: mx, y: my, width: dalleL, height: e(15)), cornerRadius: e(3)),
                     with: .color(toit))
            ctx.fill(Path(CGRect(x: mx, y: my + e(15), width: dalleL, height: e(5))),
                     with: .color(verre.opacity(0.55)))
        }

        // Tour d'immeuble (Montparnasse)
        if a.tower.present, a.forme == .slab {
            let tw = w * 0.14
            let tx = a.tower.aGauche ? bx0 - tw * 1.15 : bx1 + tw * 0.15
            let ty = h * 0.06
            ctx.fill(Path(roundedRect: CGRect(x: tx, y: ty, width: tw, height: sol - ty), cornerRadius: e(3)), with: .color(toit))
            for r in 0..<22 {
                let y = ty + e(12) + CGFloat(r) * ((sol - ty - e(18)) / 22)
                ctx.fill(Path(CGRect(x: tx + e(5), y: y, width: tw - e(10), height: e(5))), with: .color(verre.opacity(nuit ? 0.75 : 0.35)))
            }
        }

        ctx.fill(Path(CGRect(x: bx0, y: hautFacade, width: corpsL, height: sol - hautFacade)),
                 with: .linearGradient(Gradient(colors: [pierre, pierreF]),
                                       startPoint: CGPoint(x: 0, y: hautFacade), endPoint: CGPoint(x: 0, y: sol)))
        ctx.fill(Path(CGRect(x: bx0, y: hautFacade, width: corpsL, height: e(10))), with: .color(pierreF))

        // Travées
        let travees = max(2, a.bays)
        let interieur = corpsL * 0.86
        let pas = interieur / CGFloat(travees)
        let bw = pas * 0.72
        let hautBaie = hautFacade + (sol - hautFacade) * (a.forme == .modern ? 0.2 : 0.3)
        for i in 0..<travees {
            let bx = bx0 + corpsL * 0.07 + CGFloat(i) * pas + (pas - bw) / 2
            if a.forme == .modern {
                ctx.fill(Path(CGRect(x: bx, y: hautBaie, width: bw, height: sol - hautBaie)),
                         with: .color(verre.opacity(nuit ? 0.85 : 0.7)))
            } else {
                var baie = Path()
                baie.move(to: CGPoint(x: bx, y: sol))
                baie.addLine(to: CGPoint(x: bx, y: hautBaie + bw / 2))
                baie.addArc(center: CGPoint(x: bx + bw / 2, y: hautBaie + bw / 2), radius: bw / 2,
                            startAngle: .degrees(180), endAngle: .degrees(0), clockwise: false)
                baie.addLine(to: CGPoint(x: bx + bw, y: sol))
                baie.closeSubpath()
                ctx.fill(baie, with: .color(verre.opacity(nuit ? 0.85 : 0.66)))
                ctx.stroke(baie, with: .color(pierreF), lineWidth: e(2.4))
                var meneau = Path()
                meneau.move(to: CGPoint(x: bx + bw / 2, y: hautBaie + e(4)))
                meneau.addLine(to: CGPoint(x: bx + bw / 2, y: sol))
                ctx.stroke(meneau, with: .color(pierreF.opacity(0.6)), lineWidth: e(1.4))
            }
        }

        // Fronton
        switch a.fronton {
        case .triangular:
            var f = Path()
            f.move(to: CGPoint(x: bx0 - e(12), y: hautFacade))
            f.addLine(to: CGPoint(x: cx, y: hautFacade - h * 0.13))
            f.addLine(to: CGPoint(x: bx1 + e(12), y: hautFacade))
            f.closeSubpath()
            ctx.fill(f, with: .color(pierre)); ctx.stroke(f, with: .color(pierreF), lineWidth: e(3))
        case .rose:
            let rw = corpsL * 0.46
            let cyR = hautFacade - h * 0.02
            var r = Path()
            r.move(to: CGPoint(x: cx - rw / 2, y: hautFacade + e(6)))
            r.addLine(to: CGPoint(x: cx - rw / 2, y: cyR))
            r.addArc(center: CGPoint(x: cx, y: cyR), radius: rw / 2, startAngle: .degrees(180), endAngle: .degrees(0), clockwise: false)
            r.addLine(to: CGPoint(x: cx + rw / 2, y: hautFacade + e(6)))
            r.closeSubpath()
            ctx.fill(r, with: .color(verre.opacity(0.9)))
            for i in 0...8 {
                let ang = Double.pi + Double.pi * Double(i) / 8
                var ray = Path()
                ray.move(to: CGPoint(x: cx, y: cyR))
                ray.addLine(to: CGPoint(x: cx + cos(ang) * rw / 2, y: cyR + sin(ang) * rw / 2))
                ctx.stroke(ray, with: .color(toit.opacity(0.6)), lineWidth: e(2))
            }
            ctx.stroke(r, with: .color(pierreF), lineWidth: e(3.5))
        case .flat:
            ctx.fill(Path(CGRect(x: bx0 - e(10), y: hautFacade - e(16), width: corpsL + e(20), height: e(18))), with: .color(pierre))
            ctx.fill(Path(CGRect(x: bx0 - e(10), y: hautFacade - e(16), width: corpsL + e(20), height: e(5))), with: .color(pierreF))
        }

        // Beffroi ou horloge
        if a.tower.present, a.forme == .belfry {
            let tw = w * 0.11
            let tx = a.tower.aGauche ? bx0 + corpsL * 0.04 : bx1 - tw - corpsL * 0.04
            let ty = h * (1 - (a.tower.height ?? 0.9)) * 0.5
            ctx.fill(Path(CGRect(x: tx, y: ty, width: tw, height: sol - ty)),
                     with: .linearGradient(Gradient(colors: [pierre, pierreF]),
                                           startPoint: CGPoint(x: 0, y: ty), endPoint: CGPoint(x: 0, y: sol)))
            ctx.fill(Path(CGRect(x: tx - e(6), y: ty, width: tw + e(12), height: e(10))), with: .color(pierreF))
            var flec = Path()
            flec.move(to: CGPoint(x: tx - e(8), y: ty))
            flec.addLine(to: CGPoint(x: tx + tw / 2, y: ty - h * 0.09))
            flec.addLine(to: CGPoint(x: tx + tw + e(8), y: ty))
            flec.closeSubpath()
            ctx.fill(flec, with: .color(toit))
            horloge(&ctx, CGPoint(x: tx + tw / 2, y: ty + tw * 0.62), tw * 0.34, lumiere, toit)
        } else if a.clock, a.fronton != .rose {
            let r = min(corpsL * 0.055, e(26))
            let cyH = a.fronton == .triangular ? hautFacade - h * 0.055 : hautFacade + e(34)
            horloge(&ctx, CGPoint(x: cx, y: cyH), r, lumiere, toit)
        }

        // Statues sur la corniche
        if a.statues > 0 {
            let n = min(a.statues, 9)
            for i in 0..<n {
                let t = n == 1 ? 0.5 : 0.1 + 0.8 * CGFloat(i) / CGFloat(n - 1)
                statue(&ctx, CGPoint(x: bx0 + corpsL * t, y: hautFacade - (a.fronton == .flat ? e(16) : e(2))), pierreF, k)
            }
        }

        // Drapeaux
        for i in 0..<a.flags {
            let fx = bx0 + corpsL * (0.16 + CGFloat(i) * 0.34)
            var mat = Path(); mat.move(to: CGPoint(x: fx, y: hautFacade)); mat.addLine(to: CGPoint(x: fx, y: hautFacade - h * 0.10))
            ctx.stroke(mat, with: .color(accent), lineWidth: e(2))
            var toile = Path()
            let yD = hautFacade - h * 0.10
            toile.move(to: CGPoint(x: fx, y: yD))
            toile.addQuadCurve(to: CGPoint(x: fx + e(20), y: yD + e(4)), control: CGPoint(x: fx + e(11), y: yD - e(2)))
            toile.addLine(to: CGPoint(x: fx + e(20), y: yD + e(13)))
            toile.addQuadCurve(to: CGPoint(x: fx, y: yD + e(9)), control: CGPoint(x: fx + e(11), y: yD + e(15)))
            toile.closeSubpath()
            ctx.fill(toile, with: .color(accent.opacity(0.75)))
        }

        // Sol, marquise, passants
        ctx.fill(Path(CGRect(x: 0, y: sol, width: w, height: h - sol)), with: .color(pierreF.opacity(0.5)))
        ctx.fill(Path(roundedRect: CGRect(x: cx - corpsL * 0.16, y: sol - e(46), width: corpsL * 0.32, height: e(8)), cornerRadius: e(3)), with: .color(toit))
        for (i, t) in [0.14, 0.24, 0.33, 0.68, 0.78, 0.88].enumerated() {
            passant(&ctx, CGPoint(x: w * t, y: sol + e(12)), (1.0 + CGFloat(i % 2) * 0.14) * k)
        }
    }

    // MARK: Motifs

    private func horloge(_ ctx: inout GraphicsContext, _ c: CGPoint, _ r: CGFloat, _ cadran: Color, _ aiguilles: Color) {
        let rect = CGRect(x: c.x - r, y: c.y - r, width: r * 2, height: r * 2)
        ctx.fill(Path(ellipseIn: rect), with: .color(cadran))
        ctx.stroke(Path(ellipseIn: rect), with: .color(aiguilles), lineWidth: r * 0.09)
        var h1 = Path(); h1.move(to: c); h1.addLine(to: CGPoint(x: c.x + r * 0.44, y: c.y - r * 0.3))
        ctx.stroke(h1, with: .color(aiguilles), style: StrokeStyle(lineWidth: r * 0.1, lineCap: .round))
        var h2 = Path(); h2.move(to: c); h2.addLine(to: CGPoint(x: c.x - r * 0.12, y: c.y - r * 0.62))
        ctx.stroke(h2, with: .color(aiguilles), style: StrokeStyle(lineWidth: r * 0.08, lineCap: .round))
    }

    private func statue(_ ctx: inout GraphicsContext, _ o: CGPoint, _ teinte: Color, _ k: CGFloat) {
        let s: CGFloat = 0.85 * k
        ctx.fill(Path(ellipseIn: CGRect(x: o.x - 3.6 * s, y: o.y - 22.6 * s, width: 7.2 * s, height: 7.2 * s)), with: .color(teinte.opacity(0.85)))
        var corps = Path()
        corps.move(to: CGPoint(x: o.x - 5 * s, y: o.y - 15 * s))
        corps.addQuadCurve(to: CGPoint(x: o.x + 5 * s, y: o.y - 15 * s), control: CGPoint(x: o.x, y: o.y - 18 * s))
        corps.addLine(to: CGPoint(x: o.x + 7.5 * s, y: o.y))
        corps.addLine(to: CGPoint(x: o.x - 7.5 * s, y: o.y))
        corps.closeSubpath()
        ctx.fill(corps, with: .color(teinte.opacity(0.85)))
    }

    private func passant(_ ctx: inout GraphicsContext, _ o: CGPoint, _ s: CGFloat) {
        let teinte = Color(hex: "#1B1B20").opacity(0.5)
        ctx.fill(Path(ellipseIn: CGRect(x: o.x - 4.4 * s, y: o.y - 30 * s, width: 8.8 * s, height: 8.8 * s)), with: .color(teinte))
        var c = Path()
        c.move(to: CGPoint(x: o.x - 4.6 * s, y: o.y - 21 * s))
        c.addLine(to: CGPoint(x: o.x + 4.6 * s, y: o.y - 21 * s))
        c.addLine(to: CGPoint(x: o.x + 3.4 * s, y: o.y))
        c.addLine(to: CGPoint(x: o.x - 3.4 * s, y: o.y))
        c.closeSubpath()
        ctx.fill(c, with: .color(teinte))
    }

    private func dessinerSouterrain(_ ctx: inout GraphicsContext, _ size: CGSize, sol: CGFloat,
                                    pierre: Color, pierreF: Color, toit: Color, verre: Color, accent: Color) {
        let w = size.width, h = size.height
        let k = h / 440
        func e(_ v: CGFloat) -> CGFloat { v * k }
        ctx.fill(Path(CGRect(x: 0, y: h * 0.1, width: w, height: h * 0.9)), with: .color(toit))
        var voute = Path()
        voute.move(to: CGPoint(x: w * 0.06, y: sol))
        voute.addLine(to: CGPoint(x: w * 0.06, y: h * 0.42))
        voute.addQuadCurve(to: CGPoint(x: w * 0.94, y: h * 0.42), control: CGPoint(x: w / 2, y: h * 0.08))
        voute.addLine(to: CGPoint(x: w * 0.94, y: sol)); voute.closeSubpath()
        ctx.fill(voute, with: .color(pierreF))
        for i in 0..<7 {
            let lx = w * 0.16 + CGFloat(i) * (w * 0.68) / 6
            ctx.fill(Path(ellipseIn: CGRect(x: lx - e(26), y: h * 0.3 - e(9), width: e(52), height: e(18))), with: .color(verre.opacity(0.55)))
            ctx.fill(Path(ellipseIn: CGRect(x: lx - e(10), y: h * 0.3 - e(4), width: e(20), height: e(8))), with: .color(.white.opacity(0.8)))
        }
        ctx.fill(Path(CGRect(x: 0, y: sol - e(34), width: w, height: e(34))), with: .color(pierreF.opacity(0.7)))
        ctx.fill(Path(roundedRect: CGRect(x: w * 0.08, y: sol - e(96), width: w * 0.56, height: e(62)), cornerRadius: e(8)), with: .color(accent))
        ctx.fill(Path(CGRect(x: w * 0.08, y: sol - e(84), width: w * 0.56, height: e(26))), with: .color(verre.opacity(0.85)))
        ctx.fill(Path(roundedRect: CGRect(x: w * 0.64, y: sol - e(96), width: w * 0.1, height: e(62)), cornerRadius: e(14)), with: .color(pierre.opacity(0.9)))
        for i in 0..<4 { passant(&ctx, CGPoint(x: w * 0.78 + CGFloat(i) * e(26), y: sol - e(34)), 0.95 * k) }
        ctx.fill(Path(CGRect(x: 0, y: sol, width: w, height: h - sol)), with: .color(toit))
    }

    private func dessinerViaduc(_ ctx: inout GraphicsContext, _ size: CGSize, sol: CGFloat, bays: Int,
                                pierre: Color, pierreF: Color, toit: Color, verre: Color, accent: Color,
                                rnd: inout Graine) {
        let w = size.width, h = size.height
        let k = h / 440
        func e(_ v: CGFloat) -> CGFloat { v * k }
        let arches = max(3, bays)
        let aW = w / CGFloat(arches)
        let haut = h * 0.44
        ctx.fill(Path(CGRect(x: 0, y: haut, width: w, height: sol - haut)),
                 with: .linearGradient(Gradient(colors: [pierre, pierreF]),
                                       startPoint: CGPoint(x: 0, y: haut), endPoint: CGPoint(x: 0, y: sol)))
        for i in 0..<arches {
            let x = CGFloat(i) * aW + aW * 0.16
            let aw = aW * 0.68
            var arche = Path()
            arche.move(to: CGPoint(x: x, y: sol))
            arche.addLine(to: CGPoint(x: x, y: haut + aw * 0.62))
            arche.addArc(center: CGPoint(x: x + aw / 2, y: haut + aw * 0.62), radius: aw / 2,
                         startAngle: .degrees(180), endAngle: .degrees(0), clockwise: false)
            arche.addLine(to: CGPoint(x: x + aw, y: sol)); arche.closeSubpath()
            ctx.fill(arche, with: .color(toit.opacity(0.55)))
            var vitre = Path()
            vitre.move(to: CGPoint(x: x + aw * 0.12, y: sol))
            vitre.addLine(to: CGPoint(x: x + aw * 0.12, y: haut + aw * 0.66))
            vitre.addArc(center: CGPoint(x: x + aw / 2, y: haut + aw * 0.66), radius: aw * 0.38,
                         startAngle: .degrees(180), endAngle: .degrees(0), clockwise: false)
            vitre.addLine(to: CGPoint(x: x + aw * 0.88, y: sol)); vitre.closeSubpath()
            ctx.fill(vitre, with: .color(verre.opacity(0.6)))
        }
        ctx.fill(Path(CGRect(x: 0, y: haut - e(12), width: w, height: e(14))), with: .color(pierreF))
        for _ in 0..<34 {
            let x = rnd.next() * w
            let r = e(8 + rnd.next() * 20)
            let y = haut - e(16) - e(rnd.next() * 18)
            ctx.fill(Path(ellipseIn: CGRect(x: x - r, y: y - r, width: r * 2, height: r * 2)),
                     with: .color(accent.opacity(0.25 + rnd.next() * 0.4)))
        }
        for i in 0..<3 { passant(&ctx, CGPoint(x: w * 0.2 + CGFloat(i) * w * 0.28, y: haut - e(14)), 0.85 * k) }
        ctx.fill(Path(CGRect(x: 0, y: sol, width: w, height: h - sol)), with: .color(pierreF.opacity(0.55)))
    }
}
