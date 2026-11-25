# Licences

Ce dépôt réunit trois choses de statuts différents : du code, des textes
rédigés, et des données cartographiques reprises de tiers. Une licence unique
serait inexacte — voici le découpage, fichier par fichier.

Copyright © 2026 Robert Oulhen, sauf mention contraire ci-dessous.

## Le code — licence MIT

Tout le code de l'application, sur les deux plateformes, ainsi que les outils :

```
web/js/      web/css/      web/index.html    web/sw.js
apple/       tools/        worker/           .github/
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
shared/data/exercices.json     shared/data/directions.json
README.md
```

Les points de vue « immersion » des fiches (où se tenir, quoi regarder) ont été
relevés pour ce projet ; leurs coordonnées ont été vérifiées sur OpenStreetMap
(Nominatim), sans reprise de données au-delà de ces positions ponctuelles.

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

## Bibliothèque tierce — three.js (MIT)

```
web/vendor/three.module.js     web/vendor/THREE-LICENSE.txt
```

La maquette 3D utilise **three.js** r170, copié tel quel dans le dépôt pour
fonctionner hors connexion, sans dépendance à un CDN. Licence MIT,
© 2010-2024 three.js authors ; le texte est joint dans `THREE-LICENSE.txt`.

## Services ouverts depuis l'application

Les liens « Street View », « Survol en 3D réelle » et « Itinéraire » ouvrent
Google Maps et Google Earth, et « Plan du quartier » ouvre OpenStreetMap, dans
un nouvel onglet. Aucun contenu de ces services n'est repris ni embarqué dans
le dépôt, et rien ne leur est transmis tant que l'on ne clique pas.

## Données en temps réel

Le tableau « En direct » affiche des données lues à la demande :

- **SNCF, flux temps réel ouvert** (GTFS-RT), publié par la SNCF sur
  transport.data.gouv.fr sous **Open Database License** : © SNCF, ODbL ;
- **API SNCF** et **API « Prochains passages » d'Île-de-France Mobilités**, si
  leurs clés sont installées, sous les conditions d'utilisation de chacune.

Ces données ne sont ni stockées ni redistribuées par ce dépôt : le relais
(`worker/`) les garde une à cinq minutes en cache, le temps de les servir.

```
worker/src/noms-gares.json
```

Ce fichier — le nom de chaque gare desservie par la SNCF, à partir de son code
UIC — est une base dérivée des horaires théoriques de la SNCF (même jeu de
données, ODbL), produite par `tools/noms-gares-sncf.py`. Il hérite de l'ODbL.
Les codes de gares de `shared/data/direct.json` viennent des données ouvertes de
la SNCF et d'Île-de-France Mobilités.

## Les illustrations

Les façades de gare, les plans de voies, la carte, la maquette 3D, la scène
animée du croisement et les graphiques de marche ne sont pas des images : ils sont **dessinés à l'exécution** par le code, à
partir de paramètres. Ils suivent donc la licence du code, et la licence ODbL
pour ce qu'ils tirent de `geo.json`.

Aucune photographie ni aucun plan d'architecte n'est repris dans ce dépôt.
