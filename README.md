# Gares de Paris

**Site en ligne : https://boboul-cloud.github.io/gares-de-paris/**

Application documentaire sur les gares parisiennes : leur origine, l'idée qui les
a fait naître, les révolutions techniques qu'elles ont traversées, ce qu'elles
desservent, les commodités qu'on y trouve aujourd'hui, et quatre circuits pour
aller les voir. En bonus, l'histoire du TGV, de l'étude de 1966 au TGV M de 2026.

Une seule base de contenu alimente deux applications :

| Cible | Technologie | Emplacement |
|---|---|---|
| iPhone, iPad, Mac | SwiftUI, cible multiplateforme unique | `apple/` |
| Web (et installable en PWA) | HTML, CSS et modules ES, sans dépendance ni étape de compilation | `web/` |

## Ce que contient l'application

- **14 gares** — les sept grands terminus, les gares disparues ou reconverties
  (Orsay, Bastille, la Petite Ceinture, Invalides) et le rail contemporain
  (Rosa Parks, gares TGV d'Île-de-France, gares souterraines du RER E).
  Chaque fiche : récit en trois temps, chronologie, chiffres, plan de voies,
  dessertes, accès, commodités actuelles, cinq « pépites » à voir, une anecdote
  et ses sources.
- **4 circuits** — le Grand Tour des sept gares, une version courte en une
  demi-journée, les gares fantômes, et un parcours grande vitesse. Chaque étape
  indique la correspondance exacte, sa durée et ce qu'il faut regarder.
- **Une carte** de Paris construite sur de la géométrie réelle embarquée :
  limites des vingt arrondissements, Seine et Marne, canaux, réseau ferré en
  exploitation et tracé de la Petite Ceinture. Elle se zoome à la molette, au
  pincement ou aux boutons, se déplace au glisser, et chaque gare y est
  cliquable. Aucune tuile distante : elle fonctionne hors connexion.
- **Un dossier technique** en cinq âges : vapeur, électrification, diesel,
  grande vitesse, rail de demain — avec l'effet de chaque révolution sur
  l'architecture des gares, et une histoire de la signalisation.
- **Un dossier TGV** en six chapitres, et les huit générations de rames.
- **Un simulateur de croisement** : choisissez un axe, deux trains, leurs
  vitesses — au choix parmi dix matériels, du TGV M de 2026 à la Crampton de
  1849, ou **saisies librement** — et leurs heures de départ ; l'application
  trace le **graphique de marche**, le diagramme espace-temps des régulateurs,
  puis calcule l'heure, le point kilométrique et le lieu de la rencontre.
  Quatre **calculs détaillés pas à pas** accompagnent la page : croisement face
  à face, rattrapage, heure de départ à trouver, vitesse à trouver.
- **Un moteur d'exercices** : des séries de huit questions **engendrées** à
  partir des axes, des matériels et du contenu documentaire — croisements à
  calculer, heures de départ à retrouver, vitesses à déterminer, dates,
  architectes, dessertes et vocabulaire. Chaque corrigé donne le raisonnement,
  et pour les croisements le graphique de marche lui-même.
- **Un glossaire** de 42 termes, du mot « embarcadère » à l'ERTMS.

Les illustrations de gares et les plans de voies ne sont pas des images : ils
sont **dessinés à l'exécution** à partir des paramètres de chaque fiche
(`artwork`), en SVG côté Web et sur un `Canvas` SwiftUI côté Apple. Les deux
rendus suivent la même géométrie, ce qui évite d'embarquer le moindre fichier
image et garantit la netteté à toute taille.

## Le site publié

Chaque envoi sur `main` déclenche `.github/workflows/pages.yml`, qui réassemble
le corpus, rend toutes les routes dans un DOM simulé, puis publie le dossier
`web/` sur GitHub Pages. Un corpus incohérent ou une route qui échoue arrête la
publication : le site en ligne ne peut pas être cassé par un envoi.

## Lancer l'application Web

Les navigateurs refusent de lire `data/corpus.json` depuis un fichier local :
il faut un petit serveur.

```sh
node tools/build-data.mjs      # assemble web/data/corpus.json depuis shared/data
cd web && python3 -m http.server 8000
# puis ouvrir http://localhost:8000
```

`corpus.json` n'est pas versionné : c'est un fichier engendré, et le garder dans
l'historique reviendrait à réécrire trois copies d'un demi-méga-octet à chaque
retouche de contenu. La première commande le produit.

Une version **en un seul fichier**, ouvrable par double-clic et lisible hors
connexion, est produite dans `dist/` :

```sh
node tools/build-standalone.mjs
open dist/gares-de-paris.html
```

## Ouvrir l'application Apple

Le projet Xcode est généré par [XcodeGen](https://github.com/yonaskolb/XcodeGen)
à partir de `apple/project.yml`, ce qui évite de versionner un `.xcodeproj`.

```sh
brew install xcodegen        # une seule fois
node tools/build-data.mjs    # produit corpus.json dans le bundle
cd apple && xcodegen generate
open GaresDeParis.xcodeproj
```

Choisissez ensuite le schéma **GaresDeParis** et la destination voulue : « My Mac »,
un simulateur iPhone ou iPad, ou votre appareil. La cible est multiplateforme :
une même application, avec une navigation par onglets sur iPhone et une barre
latérale sur iPad et Mac.

Compilation en ligne de commande :

```sh
cd apple
xcodebuild -scheme GaresDeParis -destination 'platform=macOS' build
xcodebuild -scheme GaresDeParis -destination 'generic/platform=iOS Simulator' build
```

Pour signer et installer sur un appareil, renseignez votre équipe de
développement dans les réglages de la cible (ou ajoutez `DEVELOPMENT_TEAM` dans
`project.yml`).

## Modifier le contenu

Tout le contenu vit dans `shared/data/` et rien d'autre :

```
shared/data/
├── stations/01-saint-lazare.json … 14-gares-souterraines.json
├── circuits.json      les quatre itinéraires
├── traction.json      les cinq âges de la traction
├── tgv.json           le dossier TGV
├── glossaire.json     le lexique
├── simulateur.json    axes, matériels et exemples du simulateur de croisement
├── exercices.json     familles, formulations et tolérances du moteur d'exercices
└── geo.json           géométrie de la carte — produite par tools/extraire-geo.py
```

`geo.json` n'est pas écrit à la main : il est produit par `tools/extraire-geo.py`,
qui télécharge les limites d'arrondissement depuis **Paris Open Data** et l'eau
et les voies ferrées depuis **OpenStreetMap** (via Overpass), puis simplifie la
géométrie par l'algorithme de Douglas-Peucker et l'arrondit à cinq décimales.
Les fichiers bruts sont conservés dans `.cache-geo/` pour rejouer l'extraction
sans re-solliciter les serveurs. Le résultat pèse une soixantaine de kilo-octets
et est embarqué dans les deux applications.

Après toute modification, régénérez le corpus — le script valide les données
(identifiants uniques, champs obligatoires, étapes de circuit pointant vers des
gares existantes) et le recopie vers l'application Web et le bundle Apple :

```sh
node tools/build-data.mjs
```

## Outils

| Commande | Rôle |
|---|---|
| `node tools/build-data.mjs` | Assemble et valide `corpus.json`, le distribue aux deux applications |
| `node tools/build-standalone.mjs` | Produit `dist/gares-de-paris.html` (autonome) et `dist/artifact.html` |
| `node tools/test-web.mjs` | Rend toutes les routes de l'application Web dans un DOM simulé et vérifie le bundle |
| `swiftc -O -o /tmp/exejs tools/executer-js.swift && /tmp/exejs dist/gares-de-paris.html tools/verifier-carte.js '#/carte'` | Vérifie les **gestes** sur la carte dans un vrai navigateur : appui, tremblement, glissement, zoom, clavier. Accepte aussi une adresse `https://`, pour contrôler le site publié |
| `swiftc -O -o /tmp/verif apple/GaresDeParis/{Model/Corpus.swift,Design/*.swift,Views/*.swift} tools/verifier-largeurs.swift && /tmp/verif . /tmp/out 393` | Rend tous les écrans Apple à la largeur d'un iPhone et signale tout débordement horizontal |
| `node tools/parite-methodes.mjs /tmp/pm` | Vérifie que les démonstrations pas à pas sont identiques en JavaScript et en Swift |
| `node tools/parite-exercices.mjs /tmp/parite` | Vérifie que les moteurs d'exercices JavaScript et Swift engendrent des séries identiques |
| `python3 tools/extraire-geo.py` | Retélécharge et simplifie la géométrie de la carte vers `shared/data/geo.json` |
| `swift tools/generer-icone.swift <dossier>` | Redessine l'icône (façade de gare et train) en PNG opaques, carrés bord à bord et **sans canal alpha**, comme l'exige App Store Connect |

## Vérifier les gestes

Le banc d'essai à DOM simulé (`tools/test-web.mjs`) rend les routes mais ne
reproduit pas les enchaînements d'événements de pointeur. Or c'est là que se
logent les défauts d'interaction : un seuil de glissement mal choisi suffit à
avaler tous les clics. `tools/verifier-carte.js`, lancé par
`tools/executer-js.swift` dans un WKWebView, rejoue les gestes réels — appui,
appui tremblé, glissement, clic consécutif à un glissement, boutons de zoom,
touche Entrée — et vérifie ce que chacun doit produire.

## Le simulateur de croisement

Le calcul vit en deux exemplaires — `web/js/croisement.js` et
`apple/GaresDeParis/Design/Croisement.swift` — et les deux **doivent** rendre le
même verdict. Une batterie de neuf cas (croisement symétrique, vitesses
inégales, départs décalés, rattrapage, marches confondues, fenêtres disjointes)
les compare au millième de minute près ; toute divergence est un défaut.

Les quatre méthodes de calcul sont démontrées pas à pas sur un exemple réel.
Les nombres de ces démonstrations ne sont pas recopiés dans les données : ils
sont **recalculés par le programme**, de sorte que la leçon ne puisse pas
diverger du moteur. `tools/parite-methodes.mjs` vérifie que les deux
implémentations produisent les mêmes 63 lignes de calcul.

Le modèle est celui du graphique tracé à la règle : marche uniforme entre deux
arrêts, un arrêt se traduisant par un segment horizontal. Ni accélération, ni
ralentissement, ni aléa — utile pour comprendre, insuffisant pour faire rouler
un train, et c'est dit dans l'application.

## Le moteur d'exercices

Rien n'est stocké : les énoncés sont **engendrés** à partir d'un numéro de
série. Le tirage est déterministe, si bien qu'un même numéro redonne les mêmes
questions — et cela vaut d'une plateforme à l'autre : la série 1837 est
identique sur le téléphone et sur l'ordinateur.

Cette promesse impose que les deux implémentations consomment le générateur
pseudo-aléatoire dans le même ordre, appel pour appel, et formatent les chaînes
de la même façon. `tools/parite-exercices.mjs` le vérifie sur 75 séries, soit
600 questions, en comparant énoncé, réponse et corrigé caractère par caractère.

Les questions de croisement ne sont pas tirées puis filtrées : on choisit
d'abord *où* la rencontre doit tomber, puis on en déduit l'heure de départ du
second train. Aucun tirage n'est donc rejeté, et la question est intéressante
par construction.

## Licences

Trois statuts différents cohabitent, et le détail est dans [`LICENSES.md`](LICENSES.md) :

| Contenu | Licence |
|---|---|
| Le code — `web/js`, `apple/`, `tools/` | **MIT** — réutilisation libre, mention de copyright conservée |
| Les textes — fiches, dossiers, glossaire, exercices | **CC BY-SA 4.0** — attribution et partage à l'identique |
| `shared/data/geo.json` | **ODbL** — licence héritée d'OpenStreetMap et de Paris Open Data |

Le code est fourni **en l'état, sans garantie**. Les horaires, tarifs et
dessertes affichés sont documentaires et ne doivent pas servir à préparer un
déplacement réel.

## Sources et limites

Les textes s'appuient sur les notices encyclopédiques de chaque gare, les
publications de SNCF Gares & Connexions, SNCF Réseau et la Ville de Paris, et la
presse spécialisée. **Les sources sont citées au bas de chaque fiche** et dans
les dossiers thématiques.

Deux avertissements :

- Les illustrations et les plans de voies sont des **schémas d'interprétation**,
  pas des relevés d'architecte. La carte, elle, repose sur de la géométrie
  réelle, mais simplifiée : elle situe, elle ne guide pas.
- Données cartographiques © les contributeurs d'**OpenStreetMap** (ODbL) et
  **Ville de Paris** (Paris Open Data).
- Les distances des axes du simulateur sont des **distances de parcours
  approchées**, arrondies au kilomètre : elles suffisent au graphique de marche,
  pas à un calcul d'horaire réel.
- Horaires, tarifs, travaux et dessertes évoluent. Les données sont arrêtées à
  **septembre 2026** ; la gare d'Austerlitz en particulier est en chantier
  jusqu'en 2027, avec des correspondances partiellement fermées. Vérifiez auprès
  de la SNCF avant de vous déplacer.
