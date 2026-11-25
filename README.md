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
  Sur le Web, la page Carte devient un **plan vivant** : bulle illustrée au
  survol, panneau de gare, calques (voies, Petite Ceinture, monuments,
  arrondissements) et **les sept directions** — de chaque terminus, une flèche
  vers les villes qu'il dessert, dans leur direction vraie. Une frise **remonte
  le temps** de 1837 à aujourd'hui : les gares s'allument l'année de leur
  ouverture, pâlissent à leur fermeture, et les dates des fiches défilent.
- **Paris en maquette 3D** (Web) : la ville en volume, tirée de la même
  géométrie, avec ses immeubles, la Seine, les voies, sept monuments et des
  trains qui sortent des terminus. Chaque gare est **construite d'après sa
  fiche** — les paramètres qui dessinent son illustration (travées, fronton,
  horloge, beffroi, verrière, palette) donnent aussi son volume — et tourne sa
  façade vers la rue d'où on la regarde. La Bastille, démolie, n'y est plus
  qu'un fantôme, à travers lequel l'Opéra est construit. Jour et nuit, et une
  visite guidée des sept terminus. Chaque fiche montre aussi sa gare seule, en
  maquette de musée, éclairée à l'heure de son illustration.
- **S'y croire** (Web) : pour chaque gare, un ou deux points de vue placés
  devant la façade. Un viseur les situe sur un mini-plan, et un lien ouvre
  Street View **tourné vers la gare** — le cap est calculé, pas saisi. S'y
  ajoutent un survol photoréaliste dans Google Earth, le plan OpenStreetMap
  du quartier et l'itinéraire en transports.
- **Un tableau des départs** à palettes, sur l'accueil : les dates des fiches
  défilent comme sur les anciens tableaux Solari, chaque ligne menant à sa gare.
- **Un dossier technique** en cinq âges : vapeur, électrification, diesel,
  grande vitesse, rail de demain — avec l'effet de chaque révolution sur
  l'architecture des gares, et une histoire de la signalisation.
- **Un dossier TGV** en six chapitres, et les huit générations de rames.
- **Un simulateur de croisement** : choisissez un axe, deux trains, leurs
  vitesses — au choix parmi dix matériels, du TGV M de 2026 à la Crampton de
  1849, ou **saisies librement** — et leurs heures de départ ; l'application
  trace le **graphique de marche**, le diagramme espace-temps des régulateurs,
  puis calcule l'heure, le point kilométrique et le lieu de la rencontre.
  Sur le Web, **la scène** le rejoue : les trains roulent sur la ligne vue de
  côté, entre les plaques émaillées des gares de l'axe ; l'horloge de quai
  donne l'heure simulée et le ciel la suit, de l'aube à la nuit (phares
  allumés). Un curseur parcourt le graphique en même temps, et le segment entre
  les deux droites mesure la distance qui sépare les trains.
  Quatre **calculs détaillés pas à pas** accompagnent la page : croisement face
  à face, rattrapage, heure de départ à trouver, vitesse à trouver.
- **Un moteur d'exercices** : des séries de huit questions **engendrées** à
  partir des axes, des matériels et du contenu documentaire — croisements à
  calculer, heures de départ à retrouver, vitesses à déterminer, dates,
  architectes, dessertes et vocabulaire. Chaque corrigé donne le raisonnement,
  et pour les croisements le graphique de marche lui-même. Sur le Web, l'énoncé
  est illustré par la scène, figée au départ ; au corrigé, elle s'anime, et la
  réponse donnée est **mise en circulation** : un *train fantôme* part à l'heure
  ou roule à la vitesse proposée, et l'on voit où il aurait rencontré l'autre.
- **Un glossaire** de 42 termes, du mot « embarcadère » à l'ERTMS.

Les illustrations de gares et les plans de voies ne sont pas des images : ils
sont **dessinés à l'exécution** à partir des paramètres de chaque fiche
(`artwork`), en SVG côté Web et sur un `Canvas` SwiftUI côté Apple. Les deux
rendus suivent la même géométrie, ce qui évite d'embarquer le moindre fichier
image et garantit la netteté à toute taille.

### Ce que la version Web a de plus que l'app Apple

La maquette 3D, la scène animée du croisement et son train fantôme, le plan
vivant (calques, sept directions, frise du temps), la lecture animée des
circuits, la section « S'y croire » et le tableau des départs n'existent pour
l'instant que sur le Web. L'app Apple lit le même corpus et ignore simplement
les champs qu'elle n'utilise pas (`immersion`, `fermeture`, `directions`).

## En direct : les départs et arrivées en temps réel

Chaque fiche peut afficher le tableau des départs et des arrivées de la gare, en
temps réel. Le tableau reprend les palettes de l'accueil et les couleurs des
écrans de gare (bleu pour les départs, vert pour les arrivées), avec un onglet par
réseau, les retards, les trains supprimés et, pour le RER et le Transilien, les voies.

| Réseau | Source | Clé |
|---|---|---|
| TGV, OUIGO, Intercités, Lyria, ICE, TER | **Flux temps réel ouvert de la SNCF** (GTFS-RT, transport.data.gouv.fr, ODbL) | aucune |
| idem, en option | API SNCF (Navitia) : motifs de perturbation, horizon de quatre heures | `SNCF_TOKEN` |
| RER, Transilien | API « Prochains passages » d'Île-de-France Mobilités (PRIM) | `PRIM_TOKEN` |

Le flux ouvert donne l'heure qui vient (un train y figure dès qu'il roule ou
partira de son origine dans l'heure), la provenance et la destination, les
retards et les suppressions ; ni voie ni motif, et pas l'Eurostar, que la SNCF
n'exploite pas. Les noms des gares viennent des horaires théoriques de la SNCF
(`worker/src/noms-gares.json`, produit par `python3 tools/noms-gares-sncf.py`).

**État : en ligne depuis le 25 novembre 2026 pour les grandes lignes**, par le flux
ouvert de la SNCF ; le RER et le Transilien attendent la clé d'Île-de-France
Mobilités. Relais : https://gares-de-paris-direct.riskelo-salon.workers.dev
(`RELAIS` dans `web/js/direct.js`). Ouverte depuis un fichier, la page n'affiche
pas de tableau : le relais ne reconnaîtrait pas son origine.

### Le relais (`worker/`)

Un site statique ne peut pas garder de clé secrète. Un Worker Cloudflare, dans
`worker/`, la garde, interroge les sources, ramène leurs réponses à une même
forme et les met en cache : le flux national de la SNCF (un mégaoctet) est lu au
plus une fois par minute et sert toutes les gares ; une gare n'est redemandée à
Île-de-France Mobilités que toutes les deux minutes, quel que soit le nombre de
visiteurs. Le décodage du flux SNCF écarte les arrêts qui ne sont pas chez nous
sans les lire : moins de deux millisecondes, dans la limite de l'offre gratuite
de Cloudflare Workers (dix). Le relais n'accepte que les requêtes venues du site
(`ORIGINES` dans `wrangler.jsonc`).

- `GET /tableau?gare=paris-lyon&sens=departs|arrivees[&point=0][&exemple=1]` — le tableau ;
- `GET /sante` — les sources configurées (jamais les clés).

`SNCF_SOURCE` choisit les grandes lignes : `auto` (l'API si `SNCF_TOKEN` est
installé, sinon le flux ouvert), `api`, `ouvert` ou `exemple`. Pour le RER, sans
clé, `MODE_EXEMPLE` à `"1"` fabrique des **données d'exemple au format exact de
l'API**, qui passent par le vrai adaptateur ; à `"0"`, le RER est simplement tu.
Un bandeau « Exemple » signale sur le tableau tout onglet fictif.

La correspondance entre nos gares et les sources est dans
`shared/data/direct.json` : codes UIC relevés dans les données ouvertes de la
SNCF, zones d'arrêt dans le référentiel ouvert d'Île-de-France Mobilités,
couleurs officielles des lignes.

Essayer en local (les grandes lignes y sont réelles) :

```sh
cd worker && npx wrangler dev --port 8787      # le relais
cd web && python3 -m http.server 8765          # le site
# puis, dans la console du navigateur :
localStorage.setItem('gdp-relais', 'http://127.0.0.1:8787')
```

Tests : `cd worker && node --test test/*.test.mjs` — adaptateurs sur des réponses
de référence (dont un flux GTFS-RT fabriqué par un petit encodeur protobuf),
heures de Paris et changements d'heure, suppressions, trains en avance, voies,
cache partagé, origines, pannes et quotas.

### Mise à jour et clés

- Publier le relais : `cd worker && npx wrangler deploy` (tests d'abord). En ligne,
  `MODE_EXEMPLE` vaut `"0"` : aucun train fictif n'est montré au public.
- RER et Transilien : créer un jeton dans l'espace personnel de
  prim.iledefrance-mobilites.fr (gratuit), puis `npx wrangler secret put PRIM_TOKEN`
  dans `worker/`. Les onglets RER apparaissent d'eux-mêmes, sans republier le site.
- En option, quand le portail de la SNCF (numerique.sncf.com) répond de nouveau :
  `npx wrangler secret put SNCF_TOKEN`. Le relais bascule alors sur l'API, qui
  ajoute les motifs de perturbation.
- Vérifier : `…/sante` dit quelles sources sont actives.

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

Seule la maquette 3D n'y figure pas : three.js est chargé à la demande depuis
`web/vendor/`, et la version en un seul fichier renvoie alors vers le site.

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
├── directions.json    les villes vers lesquelles regarde chaque grand terminus
└── geo.json           géométrie de la carte — produite par tools/extraire-geo.py
```

`geo.json` n'est pas écrit à la main : il est produit par `tools/extraire-geo.py`,
qui télécharge les limites d'arrondissement depuis **Paris Open Data** et l'eau
et les voies ferrées depuis **OpenStreetMap** (via Overpass), puis simplifie la
géométrie par l'algorithme de Douglas-Peucker et l'arrondit à cinq décimales.
Les fichiers bruts sont conservés dans `.cache-geo/` pour rejouer l'extraction
sans re-solliciter les serveurs. Le résultat pèse une soixantaine de kilo-octets
et est embarqué dans les deux applications.

Chaque fiche porte aussi ses points de vue `immersion.vues` : `regard` (où se
tenir), `cible` (la façade) et `inclinaison`. Le cap de Street View et
l'orientation de la gare dans la maquette en sont **déduits** ; déplacer la
cible suffit à les réorienter. Une gare fermée porte `fermeture` (l'année) et
`fermetureTexte` : la frise du temps la pâlit à partir de cette année-là.

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
| `cd worker && node --test test/*.test.mjs` | Teste le relais « En direct » : flux ouvert SNCF, API SNCF et Île-de-France Mobilités, mode exemple, cache, origines, pannes |
| `python3 tools/noms-gares-sncf.py` | Retélécharge les horaires théoriques de la SNCF et en tire `worker/src/noms-gares.json` (nom de chaque gare par code UIC) |
| `node tools/test-web.mjs` | Rend toutes les routes de l'application Web dans un DOM simulé et vérifie le bundle ; contrôle aussi les liens Street View et Google Earth, la frise, et que la scène animée place les deux trains au même point à l'instant du croisement (plus de 300 scènes) |
| `swiftc -O -o /tmp/exejs tools/executer-js.swift && /tmp/exejs dist/gares-de-paris.html tools/verifier-carte.js '#/carte'` | Vérifie les **gestes** sur la carte dans un vrai navigateur : appui, tremblement, glissement, zoom, clavier, panneau du plan vivant, calques et frise du temps. Accepte aussi une adresse `https://`, pour contrôler le site publié |
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

La scène animée ne calcule rien : elle lit les positions dans les marches du
moteur (`pkA`), et `tools/test-web.mjs` vérifie qu'à l'instant du croisement
qu'il annonce, les deux trains dessinés sont bien au même point kilométrique.

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
| `web/vendor/three.module.js` | **MIT** — three.js r170, copié pour fonctionner hors connexion |

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
