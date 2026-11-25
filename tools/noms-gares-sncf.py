#!/usr/bin/env python3
"""Produit worker/src/noms-gares.json : le nom de chaque gare desservie par la
SNCF, à partir de son code UIC.

Le flux temps réel ouvert de la SNCF (GTFS-RT) ne donne que des codes : la
provenance et la destination d'un train y sont des codes UIC. Leurs noms sont
dans les horaires théoriques publiés avec lui (GTFS, liste des arrêts), gares
étrangères comprises : Genève Cornavin, Barcelone-Sants, Frankfurt (Main) Hbf…

Source : SNCF, jeu « Réseau SNCF TGV, Intercités et TER » sur
transport.data.gouv.fr, licence ODbL. Le fichier produit en hérite.

    python3 tools/noms-gares-sncf.py
"""
import csv
import io
import json
import pathlib
import re
import urllib.request
import zipfile

SOURCE = "https://eu.ftp.opendatasoft.com/sncf/plandata/Export_OpenData_SNCF_GTFS_NewTripId.zip"
RACINE = pathlib.Path(__file__).resolve().parent.parent
SORTIE = RACINE / "worker" / "src" / "noms-gares.json"


def joli(nom: str) -> str:
    """« FIGUERES-VILAFANT » → « Figueres-Vilafant » ; un nom déjà en casse mixte reste tel quel.
    Les halls des grandes gares parisiennes (« Paris Gare de Lyon Hall 1 - 2 ») sont
    retirés : un tableau dit « Paris Gare de Lyon »."""
    nom = re.sub(r"\s+Hall\s+\d.*$", "", nom)
    if nom != nom.upper():
        return nom.strip()
    return re.sub(r"[A-Za-zÀ-ÖØ-öø-ÿ]+", lambda m: m.group(0).capitalize(), nom.lower()).strip()


def main() -> None:
    requete = urllib.request.Request(SOURCE, headers={"User-Agent": "gares-de-paris/1.0"})
    with urllib.request.urlopen(requete, timeout=300) as r:
        archive = zipfile.ZipFile(io.BytesIO(r.read()))
    noms = {}
    with archive.open("stops.txt") as f:
        for ligne in csv.DictReader(io.TextIOWrapper(f, "utf-8-sig")):
            m = re.fullmatch(r"StopArea:OCE(\d{8})", ligne["stop_id"])
            if m:
                noms[m.group(1)] = joli(ligne["stop_name"])
    SORTIE.write_text(json.dumps(dict(sorted(noms.items())), ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"{len(noms)} gares → {SORTIE.relative_to(RACINE)} ({SORTIE.stat().st_size // 1024} Ko)")


if __name__ == "__main__":
    main()
