# Licences

Ce dépôt réunit trois choses de statuts différents : du code, des textes
rédigés, et des données cartographiques reprises de tiers. Une licence unique
serait inexacte — voici le découpage, fichier par fichier.

Copyright © 2026 Robert Oulhen, sauf mention contraire ci-dessous.

## Le code — licence MIT

Tout le code de l'application, sur les deux plateformes, ainsi que les outils :

```
web/js/      web/css/      web/index.html    web/sw.js
apple/       tools/        .github/
```

Réutilisation libre, y compris commerciale, modification et redistribution
autorisées, à la seule condition de conserver la mention de copyright. Le texte
complet est dans [`LICENSE`](LICENSE).

**Fourni en l'état, sans garantie d'aucune sorte.** L'application affiche des
horaires, des tarifs, des dessertes et des résultats de calcul à titre
documentaire : ce ne sont pas des informations de service, et elles ne doivent
pas servir à préparer un déplacement réel. Vérifiez auprès de la SNCF.

## Les textes — Creative Commons BY-SA 4.0

Le contenu rédactionnel : les quatorze fiches de gare, les circuits, les
dossiers sur la traction et le TGV, le glossaire, les énoncés et corrigés des
exercices.

```
shared/data/stations/*.json    shared/data/circuits.json
shared/data/traction.json      shared/data/tgv.json
shared/data/glossaire.json     shared/data/simulateur.json
shared/data/exercices.json     README.md
```

Vous pouvez les reprendre, les traduire et les adapter, y compris à des fins
commerciales, à deux conditions : **citer l'auteur** et **partager vos versions
dérivées sous la même licence**. Texte complet :
<https://creativecommons.org/licenses/by-sa/4.0/deed.fr>

Ces textes s'appuient sur des sources publiques citées au bas de chaque fiche ;
la rédaction, la sélection et l'organisation sont originales.

## Les données cartographiques — ODbL

```
shared/data/geo.json
```

Ce fichier est une **base de données dérivée**, produite par
`tools/extraire-geo.py` à partir de :

- **OpenStreetMap** — Seine, canaux, réseau ferré et Petite Ceinture.
  © les contributeurs d'OpenStreetMap, sous
  [Open Database License](https://opendatacommons.org/licenses/odbl/).
- **Ville de Paris, Paris Open Data** — limites des vingt arrondissements.
  Jeu « Arrondissements », également sous Open Database License.

Cette licence n'est pas un choix : elle est **héritée** des sources. Si vous
redistribuez `geo.json` ou une version dérivée, vous devez conserver l'ODbL et
l'attribution ci-dessus. Ces obligations s'appliquent au fichier de données, pas
au code qui le produit ni à celui qui l'affiche.

Pour vous en affranchir, supprimez `shared/data/geo.json` de votre copie :
`tools/extraire-geo.py` le reconstruit depuis les sources.

## Les illustrations

Les façades de gare, les plans de voies, la carte et les graphiques de marche
ne sont pas des images : ils sont **dessinés à l'exécution** par le code, à
partir de paramètres. Ils suivent donc la licence du code, et la licence ODbL
pour ce qu'ils tirent de `geo.json`.

Aucune photographie ni aucun plan d'architecte n'est repris dans ce dépôt.
