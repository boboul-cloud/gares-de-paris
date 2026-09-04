import SwiftUI

/// Carte de Paris dessinée à partir de géométrie réelle embarquée : limites des
/// vingt arrondissements (Paris Open Data), Seine, canaux et réseau ferré
/// (OpenStreetMap). Aucune tuile distante — la carte fonctionne hors connexion.
///
/// Le zoom n'agrandit pas la vue rendue : il modifie la projection. Traits,
/// pastilles et libellés gardent donc leur épaisseur à l'écran, et les libellés
/// sont replacés à chaque échelle, si bien qu'en zoomant on en découvre.
struct ParisMapView: View {
    let corpus: Corpus
    var enAvant: String? = nil
    var circuit: Circuit? = nil
    var libelles = true
    var detail: Detail = .complet
    var interactif = true
    var onSelection: ((Station) -> Void)? = nil

    enum Detail { case complet, simple }

    @State private var echelle: CGFloat = 1
    @State private var decalage: CGSize = .zero
    @State private var echelleDebut: CGFloat = 1
    @State private var decalageDebut: CGSize = .zero
    @State private var enDeplacement = false
    @State private var enZoom = false
    @State private var taille: CGSize = .zero

    private let echelleMin: CGFloat = 1
    private let echelleMax: CGFloat = 8

    var body: some View {
        GeometryReader { geo in
            Canvas { ctx, size in dessiner(&ctx, size) }
                .onAppear { taille = geo.size }
                .onChange(of: geo.size) { _, nouvelle in taille = nouvelle; contenir() }
                .contentShape(Rectangle())
                .gesture(interactif ? deplacement : nil)
                .simultaneousGesture(interactif ? pincement : nil)
                .onTapGesture { point in selectionner(point, geo.size) }
        }
        .aspectRatio(1.45, contentMode: .fit)
        .background(Theme.mapBg, in: RoundedRectangle(cornerRadius: 12))
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(Theme.rule, lineWidth: 1))
        .overlay(alignment: .topTrailing) { if interactif { outils } }
        .accessibilityLabel("Carte des gares de Paris")
    }

    // MARK: Commandes

    private var outils: some View {
        VStack(spacing: 1) {
            bouton("minus", "Dézoomer") { zoomer(1.5) }
            bouton("plus", "Zoomer") { zoomer(1 / 1.5) }
            bouton("arrow.counterclockwise", "Cadrage initial") {
                withAnimation(.easeOut(duration: 0.2)) { echelle = 1; decalage = .zero }
            }
        }
        .background(Theme.rule)
        .clipShape(RoundedRectangle(cornerRadius: 5))
        .overlay(RoundedRectangle(cornerRadius: 5).strokeBorder(Theme.rule, lineWidth: 1))
        .padding(10)
    }

    private func bouton(_ symbole: String, _ titre: String, _ action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: symbole)
                .font(.system(size: 11, weight: .semibold))
                .frame(width: 28, height: 28)
                .background(Theme.surface)
                .foregroundStyle(Theme.ink2)
        }
        .buttonStyle(.plain)
        .help(titre)
        .accessibilityLabel(titre)
    }

    // MARK: Gestes

    private var deplacement: some Gesture {
        // Seuil confortable : à 2 points, le moindre tremblement du doigt ou du
        // trackpad était pris pour un déplacement et volait la sélection.
        DragGesture(minimumDistance: 6)
            .onChanged { v in
                if !enDeplacement { enDeplacement = true; decalageDebut = decalage }
                decalage = CGSize(width: decalageDebut.width + v.translation.width,
                                  height: decalageDebut.height + v.translation.height)
                contenir()
            }
            .onEnded { _ in enDeplacement = false }
    }

    private var pincement: some Gesture {
        MagnificationGesture()
            .onChanged { m in
                if !enZoom { enZoom = true; echelleDebut = echelle; decalageDebut = decalage }
                appliquer(echelle: echelleDebut * m, depuis: echelleDebut, base: decalageDebut)
            }
            .onEnded { _ in enZoom = false }
    }

    /// Zoom centré sur le milieu de la vue. `facteur` > 1 dézoome.
    private func zoomer(_ facteur: CGFloat) {
        withAnimation(.easeOut(duration: 0.18)) {
            appliquer(echelle: echelle / facteur, depuis: echelle, base: decalage)
        }
    }

    private func appliquer(echelle nouvelle: CGFloat, depuis ancienne: CGFloat, base: CGSize) {
        let k = min(echelleMax, max(echelleMin, nouvelle))
        guard taille != .zero else { echelle = k; return }
        // Le centre de la vue reste sur le même point de la carte.
        let cx = taille.width / 2, cy = taille.height / 2
        decalage = CGSize(width: cx - (cx - base.width) * (k / ancienne),
                          height: cy - (cy - base.height) * (k / ancienne))
        echelle = k
        contenir()
    }

    /// Empêche la carte de sortir du cadre.
    private func contenir() {
        guard taille != .zero else { return }
        let l = taille.width, h = taille.height
        decalage.width = min(0, max(l - l * echelle, decalage.width))
        decalage.height = min(0, max(h - h * echelle, decalage.height))
    }

    private func selectionner(_ point: CGPoint, _ size: CGSize) {
        guard let onSelection, !enDeplacement else { return }
        let proj = projection(size)
        var meilleure: (Station, CGFloat)?
        for s in corpus.stations {
            let c = proj(s.coord.lon, s.coord.lat)
            let d = hypot(c.x - point.x, c.y - point.y)
            if d < 24, meilleure == nil || d < meilleure!.1 { meilleure = (s, d) }
        }
        if let m = meilleure { onSelection(m.0) }
    }

    // MARK: Projection

    /// Projection équirectangulaire corrigée de la convergence des méridiens,
    /// composée avec le zoom et le déplacement courants.
    private func projection(_ size: CGSize, marge: CGFloat = 14) -> (Double, Double) -> CGPoint {
        let b = corpus.geo.bounds
        let kx = cos((b.minLat + b.maxLat) / 2 * .pi / 180)
        let spanX = (b.maxLon - b.minLon) * kx
        let spanY = b.maxLat - b.minLat
        let e = min((size.width - marge * 2) / spanX, (size.height - marge * 2) / spanY)
        let offX = (size.width - spanX * e) / 2
        let offY = (size.height - spanY * e) / 2
        let k = echelle, dx = decalage.width, dy = decalage.height
        return { lon, lat in
            let x = offX + (lon - b.minLon) * kx * e
            let y = size.height - offY - (lat - b.minLat) * e
            return CGPoint(x: x * k + dx, y: y * k + dy)
        }
    }

    private func chemin(_ lignes: [[[Double]]], _ proj: (Double, Double) -> CGPoint, fermer: Bool = false) -> Path {
        var p = Path()
        for ligne in lignes {
            for (i, pt) in ligne.enumerated() {
                let c = proj(pt[0], pt[1])
                if i == 0 { p.move(to: c) } else { p.addLine(to: c) }
            }
            if fermer { p.closeSubpath() }
        }
        return p
    }

    // MARK: Dessin

    private func dessiner(_ ctx: inout GraphicsContext, _ size: CGSize) {
        let geo = corpus.geo
        let proj = projection(size)

        // Arrondissements : leur réunion dessine Paris, leurs limites internes
        // donnent à la carte sa lisibilité de plan.
        let arr = chemin(geo.arrondissements.map { $0.contour }, proj, fermer: true)
        ctx.fill(arr, with: .color(Theme.mapParis))
        ctx.stroke(arr, with: .color(Theme.ruleStrong), lineWidth: 0.8)

        ctx.stroke(chemin(geo.seine, proj), with: .color(Theme.mapSeine),
                   style: StrokeStyle(lineWidth: 5, lineCap: .round, lineJoin: .round))
        ctx.stroke(chemin(geo.canaux, proj), with: .color(Theme.mapSeine),
                   style: StrokeStyle(lineWidth: 2.4, lineCap: .round))

        if detail == .complet {
            ctx.stroke(chemin(geo.voiesFerrees, proj), with: .color(Theme.mapRail), lineWidth: 0.9)
        }
        ctx.stroke(chemin(geo.petiteCeinture, proj), with: .color(Theme.signal.opacity(0.85)),
                   style: StrokeStyle(lineWidth: 1.5, dash: [5, 4]))

        if let circuit {
            var vus: [Station] = []
            for e in circuit.etapes {
                if let s = corpus.station(e.stationId), vus.last?.id != s.id { vus.append(s) }
            }
            if vus.count > 1 {
                var trace = Path()
                for (i, s) in vus.enumerated() {
                    let c = proj(s.coord.lon, s.coord.lat)
                    if i == 0 { trace.move(to: c) } else { trace.addLine(to: c) }
                }
                ctx.stroke(trace, with: .color(Color(hex: circuit.couleur)),
                           style: StrokeStyle(lineWidth: 3, lineCap: .round, lineJoin: .round, dash: [1, 7]))
            }
        }

        // Placement des libellés : droite, gauche, dessus, dessous, puis abandon
        // si rien n'est libre. Le calcul est refait à chaque échelle, donc le
        // zoom fait apparaître les noms qui ne tenaient pas.
        var poses: [CGRect] = []
        func placer(_ texte: String, _ c: CGPoint, _ rayon: CGFloat, _ t: CGFloat) -> (point: CGPoint, ancre: UnitPoint)? {
            let lp = CGFloat(texte.count) * t * 0.54
            let hp = t * 1.25
            let marge = rayon + 6
            let candidats: [(CGPoint, UnitPoint)] = [
                (CGPoint(x: c.x + marge, y: c.y), .leading),
                (CGPoint(x: c.x - marge, y: c.y), .trailing),
                (CGPoint(x: c.x, y: c.y - marge - hp * 0.5), .center),
                (CGPoint(x: c.x, y: c.y + marge + hp * 0.5), .center),
            ]
            for (pt, ancre) in candidats {
                let x0: CGFloat = ancre == .leading ? pt.x : ancre == .trailing ? pt.x - lp : pt.x - lp / 2
                let boite = CGRect(x: x0, y: pt.y - hp * 0.55, width: lp, height: hp)
                guard boite.minX > -20, boite.maxX < size.width + 20 else { continue }
                if !poses.contains(where: { $0.intersects(boite) }) {
                    poses.append(boite)
                    return (pt, ancre)
                }
            }
            return nil
        }

        for s in corpus.stations {
            let c = proj(s.coord.lon, s.coord.lat)
            let r: CGFloat = (enAvant == s.id ? 10 : s.categorie == Categorie.grande.rawValue ? 7 : 5) + 2
            poses.append(CGRect(x: c.x - r, y: c.y - r, width: r * 2, height: r * 2))
        }

        let ordre = corpus.stations.sorted { a, b in
            func rang(_ s: Station) -> Int {
                enAvant == s.id ? 0 : (s.categorie == Categorie.grande.rawValue ? 1 : 2)
            }
            return rang(a) < rang(b)
        }

        for s in ordre {
            let c = proj(s.coord.lon, s.coord.lat)
            let actif = enAvant == s.id
            let grande = s.categorie == Categorie.grande.rawValue
            let r: CGFloat = actif ? 10 : grande ? 7 : 5
            if actif {
                ctx.fill(Path(ellipseIn: CGRect(x: c.x - r - 9, y: c.y - r - 9, width: (r + 9) * 2, height: (r + 9) * 2)),
                         with: .color(s.accent.opacity(0.18)))
            }
            let d = Path(ellipseIn: CGRect(x: c.x - r, y: c.y - r, width: r * 2, height: r * 2))
            ctx.fill(d, with: .color(s.accent))
            ctx.stroke(d, with: .color(Theme.surface), lineWidth: 2)

            if libelles {
                let t: CGFloat = grande ? 11.5 : 10
                if let pose = placer(s.nomPourCarte, c, r, t) {
                    ctx.draw(Text(s.nomPourCarte)
                        .font(.system(size: t, weight: grande ? .semibold : .regular))
                        .foregroundColor(grande ? Theme.ink : Theme.ink2),
                             at: pose.point, anchor: pose.ancre)
                }
            }
        }

        for rp in geo.reperes {
            let c = proj(rp.lon, rp.lat)
            ctx.fill(Path(ellipseIn: CGRect(x: c.x - 2.6, y: c.y - 2.6, width: 5.2, height: 5.2)),
                     with: .color(Theme.ink3.opacity(0.55)))
            if libelles, let pose = placer(rp.nom, c, 3, 9) {
                ctx.draw(Text(rp.nom).font(Theme.mono(9)).foregroundColor(Theme.ink3.opacity(0.85)),
                         at: pose.point, anchor: pose.ancre)
            }
        }
    }
}

/// Schéma du plan de voies : une ligne par groupe de quais, heurtoir compris.
struct TrackPlanView: View {
    let station: Station

    var body: some View {
        if let plan = station.plan {
            VStack(alignment: .leading, spacing: 18) {
                Cartouche(texte: plan.type, teinte: Theme.ink3)
                ForEach(plan.groupes) { g in
                    VStack(alignment: .leading, spacing: 7) {
                        Text(g.nom).font(.system(size: 13.5, weight: .semibold)).foregroundStyle(Theme.ink)
                        Text(g.desserte).font(.system(size: 13)).foregroundStyle(Theme.ink3)
                            .fixedSize(horizontal: false, vertical: true)
                        Canvas { ctx, size in voie(&ctx, size, terminus: plan.type.localizedCaseInsensitiveContains("cul-de-sac")) }
                            .frame(height: 16)
                    }
                }
            }
        }
    }

    private func voie(_ ctx: inout GraphicsContext, _ size: CGSize, terminus: Bool) {
        let c = station.accent
        for (i, y) in [CGFloat(3), CGFloat(12)].enumerated() {
            var r = Path(); r.move(to: CGPoint(x: 0, y: y)); r.addLine(to: CGPoint(x: size.width, y: y))
            ctx.stroke(r, with: .color(c.opacity(i == 0 ? 0.85 : 0.55)), lineWidth: 2)
        }
        let n = max(12, Int(size.width / 18))
        for t in 0..<n {
            let x = size.width / CGFloat(n) * CGFloat(t) + 4
            var tr = Path(); tr.move(to: CGPoint(x: x, y: 0)); tr.addLine(to: CGPoint(x: x, y: 15))
            ctx.stroke(tr, with: .color(c.opacity(0.28)), lineWidth: 1.2)
        }
        if terminus {
            ctx.fill(Path(roundedRect: CGRect(x: 0, y: 0, width: 7, height: 16), cornerRadius: 2), with: .color(c))
        }
    }
}
