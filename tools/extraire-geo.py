#!/usr/bin/env python3
"""Construit shared/data/geo.json à partir de sources ouvertes.

Sources téléchargées :
  · limites des vingt arrondissements — Paris Open Data ;
  · Seine, canaux et réseau ferré — OpenStreetMap via l'API Overpass.

La géométrie est simplifiée (Douglas-Peucker) et arrondie à cinq décimales,
pour que la carte reste embarquable dans les deux applications et utilisable
hors connexion, sans requête réseau ni tuiles distantes.

Usage : python3 tools/extraire-geo.py [dossier-de-cache]
Sans cache existant, le script télécharge ; les fichiers bruts sont conservés
pour pouvoir rejouer l'extraction sans re-solliciter les serveurs.
"""
import json
import os
import subprocess
import sys
from math import hypot

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = sys.argv[1] if len(sys.argv) > 1 else os.path.join(RACINE, ".cache-geo")

ARRONDISSEMENTS = ("https://opendata.paris.fr/api/explore/v2.1/catalog/"
                   "datasets/arrondissements/exports/geojson")
OVERPASS = "https://overpass-api.de/api/interpreter"

# On prend l'axe des cours d'eau, pas leur berge : les emprises OSM traversent
# la fenêtre de requête et ne se referment pas en polygones exploitables.
REQUETE_EAU = """[out:json][timeout:90];
(
  way["waterway"="river"](48.79,2.20,48.93,2.49);
  way["waterway"="canal"](48.79,2.20,48.93,2.49);
);
out geom;"""

REQUETE_RAIL = """[out:json][timeout:90];
(
  way["railway"~"^(rail|light_rail)$"]["service"!~"."](48.795,2.21,48.925,2.48);
  way["railway"="disused"](48.795,2.21,48.925,2.48);
);
out geom;"""


def telecharger(nom, url, donnees=None):
    chemin = os.path.join(CACHE, nom)
    if os.path.exists(chemin) and os.path.getsize(chemin) > 1000:
        return json.load(open(chemin, encoding="utf-8"))
    os.makedirs(CACHE, exist_ok=True)
    cmd = ["curl", "-s", "-m", "180", "-o", chemin]
    if donnees is not None:
        cmd += ["--data-urlencode", "data=" + donnees]
    cmd.append(url)
    subprocess.run(cmd, check=True)
    return json.load(open(chemin, encoding="utf-8"))


def simplifier(points, seuil):
    """Douglas-Peucker. `seuil` est exprimé en degrés (0,0002° ≈ 20 m)."""
    if len(points) < 3:
        return points
    debut, fin = points[0], points[-1]
    dx, dy = fin[0] - debut[0], fin[1] - debut[1]
    longueur = hypot(dx, dy)
    pire, index = 0.0, 0
    for i in range(1, len(points) - 1):
        px, py = points[i]
        if longueur == 0:
            d = hypot(px - debut[0], py - debut[1])
        else:
            d = abs(dy * px - dx * py + fin[0] * debut[1] - fin[1] * debut[0]) / longueur
        if d > pire:
            pire, index = d, i
    if pire <= seuil:
        return [debut, fin]
    return simplifier(points[:index + 1], seuil)[:-1] + simplifier(points[index:], seuil)


def arrondir(points):
    return [[round(x, 5), round(y, 5)] for x, y in points]


def longueur_approx(points):
    """Longueur du tracé en mètres, suffisante à la latitude de Paris."""
    total = 0.0
    for a, b in zip(points, points[1:]):
        total += hypot((b[0] - a[0]) * 73000, (b[1] - a[1]) * 111000)
    return total


# --- Arrondissements -------------------------------------------------------
brut = telecharger("arrondissements.geojson", ARRONDISSEMENTS)
arrondissements = []
for f in brut["features"]:
    geom = f["geometry"]
    anneaux = geom["coordinates"] if geom["type"] == "Polygon" else max(
        geom["coordinates"], key=lambda p: len(p[0]))
    exterieur = anneaux[0]
    arrondissements.append({
        "n": f["properties"]["c_ar"],
        "nom": f["properties"]["l_aroff"],
        "contour": arrondir(simplifier(exterieur, 0.00018)),
    })
arrondissements.sort(key=lambda a: a["n"])

# --- Eau -------------------------------------------------------------------
eau = telecharger("osm-riv.json", OVERPASS, REQUETE_EAU)
seine, canaux = [], []
for e in eau["elements"]:
    if "geometry" not in e:
        continue
    tags = e.get("tags", {})
    nom = tags.get("name", "")
    pts = [[p["lon"], p["lat"]] for p in e["geometry"]]
    if longueur_approx(pts) < 200:
        continue
    simple = arrondir(simplifier(pts, 0.00015))
    if tags.get("waterway") == "canal" and "seine" not in nom.lower():
        canaux.append(simple)
    else:
        seine.append(simple)

# --- Réseau ferré ----------------------------------------------------------
rail = telecharger("osm-rail.json", OVERPASS, REQUETE_RAIL)
voies, ceinture = [], []
for e in rail["elements"]:
    if "geometry" not in e:
        continue
    pts = [[p["lon"], p["lat"]] for p in e["geometry"]]
    if longueur_approx(pts) < 220:          # écarte les courts raccordements
        continue
    nom = e.get("tags", {}).get("name", "")
    simple = arrondir(simplifier(pts, 0.00025))
    if "petite ceinture" in nom.lower():
        ceinture.append(simple)
    else:
        voies.append(simple)

# --- Emprise ---------------------------------------------------------------
bounds = {"minLon": 2.2470, "maxLon": 2.4235, "minLat": 48.8135, "maxLat": 48.9075}

reperes = [
    {"nom": "Tour Eiffel", "lat": 48.8584, "lon": 2.2945, "type": "monument"},
    {"nom": "Notre-Dame", "lat": 48.8530, "lon": 2.3499, "type": "monument"},
    {"nom": "Arc de Triomphe", "lat": 48.8738, "lon": 2.2950, "type": "monument"},
    {"nom": "Sacré-Cœur", "lat": 48.8867, "lon": 2.3431, "type": "monument"},
    {"nom": "Tour Montparnasse", "lat": 48.8422, "lon": 2.3220, "type": "monument"},
    {"nom": "Opéra Bastille", "lat": 48.8523, "lon": 2.3700, "type": "monument"},
    {"nom": "Louvre", "lat": 48.8606, "lon": 2.3376, "type": "monument"},
]

geo = {
    "source": ("Arrondissements : Paris Open Data. Seine, canaux et voies ferrées : "
               "OpenStreetMap (ODbL). Géométrie simplifiée pour l'embarquement."),
    "bounds": bounds,
    "arrondissements": arrondissements,
    "seine": seine,
    "canaux": canaux,
    "voiesFerrees": voies,
    "petiteCeinture": ceinture,
    "reperes": reperes,
}

sortie = os.path.join(RACINE, "shared", "data", "geo.json")
with open(sortie, "w", encoding="utf-8") as f:
    json.dump(geo, f, ensure_ascii=False, separators=(",", ":"))

pts = lambda groupe: sum(len(x) for x in groupe)
print(f"arrondissements : {len(arrondissements)} ({pts(a['contour'] for a in arrondissements)} points)")
print(f"Seine et Marne  : {len(seine)} tracés ({pts(seine)} points)")
print(f"canaux          : {len(canaux)} tracés ({pts(canaux)} points)")
print(f"voies ferrées   : {len(voies)} tracés ({pts(voies)} points)")
print(f"Petite Ceinture : {len(ceinture)} tracés ({pts(ceinture)} points)")
print(f"→ {sortie} — {os.path.getsize(sortie) / 1024:.0f} Ko")
