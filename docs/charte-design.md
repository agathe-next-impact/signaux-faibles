# Charte graphique signauxfaibles — transcription

Transcription fidèle de `docs/charte-design.pdf`, v1.0, août 2026, cinq pages.
Le PDF est en images : sans cette transcription, aucun texte n'en est
extractible. **C'est le PDF qui fait foi** ; ce fichier existe pour que les
tokens soient générés depuis la charte plutôt que réinventés, et pour que les
règles soient citables en revue.

Baseline : « Votre veille, rédigée. » Domaine porté par la charte :
`signauxfaibles.io`, contact `contact@signauxfaibles.io`. Adresse de contact
en service depuis le 23 octobre 2026 : `agathe@signauxfaibles.io`
(`ADRESSE_DE_CONTACT`, `lib/email/gabarit.ts`).

## 01 · Logo

Le logotype est un **mot-symbole** : « signauxfaibles » en bas de casse, soudé,
suivi du **curseur** — la barre qui dit que la veille est en train de s'écrire.
Composé en Lora gras ; le curseur est un trait vertical rose.

- **Version positive** sur fond clair, **version négative** sur fond encre.
- **Zone de protection** : un espace libre équivalent à la hauteur du « x »
  entoure le logotype de tous côtés. Rien ne s'y place : ni texte, ni filet,
  ni motif.
- **Taille minimale** : 120 px de large à l'écran, 30 mm en impression. En
  dessous, le curseur devient illisible : ne pas l'utiliser.

À ne pas faire :

1. inverser les couleurs du mot et du curseur ;
2. recomposer dans une autre police ;
3. mettre des capitales ou une espace dans le logotype
   (« Signaux Faibles » est le nom, pas le logo) ;
4. ajouter ombre, contour ou inclinaison.

### Verrouillages fournis le 10 septembre 2026

Trois compositions ont été transmises en complément du PDF : le motif seul, un
verrouillage horizontal (motif à gauche, mot-symbole à droite) et un
verrouillage empilé (motif au-dessus, mot-symbole, baseline en italique).

Elles sont reconstruites dans `components/marque.tsx` plutôt que posées en
images. Le motif est du vectoriel : net à toute taille, quelques centaines
d'octets, et ses couleurs viennent des tokens. Le mot-symbole reste du **texte**
composé en Lora, la police de la charte, et non une image de texte : il demeure
sélectionnable, lisible par un lecteur d'écran, et net sur tout écran. Le motif
sert aussi d'icône d'onglet, dans `app/icon.svg`.

La charte n'illustre pas de version négative du **motif**, seulement du
mot-symbole. Sur fond encre, l'ardoise et le gris ligne s'effondrent : les deux
rôles remontent donc d'un cran, l'axe prenant l'ardoise et les impulsions
secondaires le gris ligne. Le rose ne bouge pas. C'est une extrapolation, à
confirmer si un écran sombre apparaît.

## 02 · Couleurs

« Une palette sobre au service de la lecture : le blanc et l'encre portent le
texte, le rose signale, l'ardoise contextualise. **La couleur est un signal,
jamais un décor.** »

| Nom | Valeur | Rôle |
|---|---|---|
| Encre | `#111418` | texte, titres, boutons |
| Rose signal | `#dd768a` | signal fort, curseur, accents |
| Ardoise | `#5d6b7f` | signal secondaire, labels |
| Gris ligne | `#dee3e6` | filets, axes, bordures |
| Blanc | `#ffffff` | **fond unique du site** |
| Ocre | `#b07a2a` | le temps : échéances, seconde série d'un graphique (amendement du 30 octobre 2026) |

Teintes dérivées, « réservées aux fonds de cartes et surlignages, jamais pour
du texte » : `#fbeef1` fond rose, `#eef1f4` fond ardoise, `#f7f8f9` fond neutre,
`#f8efe0` fond ocre.

**Amendement du 30 octobre 2026 : l'ocre, troisième couleur de signal.**
Décision de l'opératrice, sur les propositions visuelles du même jour. La
charte n'avait que le rose et l'ardoise ; les graphiques manquaient d'une
seconde série (entrées face aux procédures) et le calendrier d'une couleur pour
le temps. L'ocre est chaude là où l'ardoise est froide : elle s'en distingue par
la teinte, sans évoquer ni une alerte ni un succès. Le bleu de Prusse (trop
proche de l'ardoise, 1,26 : 1) et le vert lichen (lu comme « favorable », donc
une quatrième graduation d'impact) ont été écartés.

- **Deux rôles seulement** : les échéances (repère et date d'une échéance du
  calendrier) et la seconde série d'un graphique. Jamais une couleur d'impact :
  la règle des trois niveaux reste entière, et un badge n'est jamais ocre.
- **Le ton marque `#b07a2a`** est réservé aux formes (barre, repère, filet).
- **Le ton foncé `#8a5a14`** porte seul du texte, et seulement une date ou une
  étiquette mono ; jamais du texte courant.

Contraste et accessibilité, tels que la charte les donne :

| | Ratio | Verdict |
|---|---|---|
| Encre sur blanc | 17,3 : 1 | AAA |
| Ardoise sur blanc | 5,3 : 1 | AA |
| Rose sur blanc | 2,9 : 1 | graphique seul |
| Ocre sur blanc | 3,71 : 1 | graphique seul |
| Ocre foncé sur blanc | 5,91 : 1 | AA (dates, labels mono) |

« Le rose ne porte jamais de texte courant : il marque, il ne raconte pas. »

Proportions d'usage visées : blanc 62 %, encre 22 %, gris 9 %, ardoise 4 %,
**rose 2 %, ocre 1 %** (rose 3 % avant l'amendement du 30 octobre 2026).

## 03 · Typographie

« Trois familles, trois rôles : la serif écrit, la sans-serif structure, la mono
date et source. C'est la typographie d'une lettre, pas d'un tableau de bord. »

| Famille | Rôle | Graisses |
|---|---|---|
| Lora | titres, éditorial, citations | 500–700, italique pour la voix |
| Public Sans | corps de texte, interface, navigation | 400–600 |
| IBM Plex Mono | dates, sources, labels, métadonnées | 400–500 |

Échelle :

| Niveau | Police | Graisse | Taille |
|---|---|---|---|
| H1 | Lora | 700 | 40 px |
| H2 | Lora | 700 | 28 px |
| H3 | Lora | 600 | 20 px |
| Corps | Public Sans | 400 | 16 px |
| Label | IBM Plex Mono | 500 | 12 px |

Deux règles encadrées, à traiter comme des interdits :

- « **Sentence case partout** : ni titres en capitales, ni Title Case. Seuls les
  labels mono passent en capitales espacées. »
- « L'**italique Lora** est réservé à la voix éditoriale : taglines, citations,
  « RAS ». Jamais pour insister. »

## 04 · Composants UI

« Les briques récurrentes du site et des lettres. Rayons de 8 à 10 px, bordures
gris ligne, **aucune ombre portée forte**. »

**Boutons.** Primaire sur fond encre, texte blanc. Secondaire en filet. Lien
avec flèche rose. « **Un seul bouton primaire par écran.** »

**Champ + action.** Focus : bordure ardoise. La mention de réassurance suit
toujours en 12 px gris.

**Carte domaine de veille.** Titre H3 Lora, texte courant, puis un lien
« Essayer → » dont la flèche est rose.

**Badges et états.** Trois pastilles mono en capitales espacées :

| Badge | Texte | Fond |
|---|---|---|
| `SIGNAL FORT` | rose | fond rose |
| `À SURVEILLER` | ardoise | fond ardoise |
| `RAS` | ardoise atténuée | fond neutre |

« **Trois niveaux, pas plus.** « RAS » est un état à part entière : il se
montre, il ne se cache pas. »

**Motif signature — la ligne de signaux.** Un axe gris horizontal, des
impulsions verticales : **rose = signal fort, ardoise = signal secondaire**.
« Toujours horizontal, jamais plus de 7 impulsions, jamais en fond de texte. »

## 05 · Mouvement (amendement du 30 octobre 2026)

Décision de l'opératrice, sur les propositions visuelles du même jour. Le
mouvement signale une arrivée, il ne décore pas. Il ne s'applique qu'aux
graphiques de l'espace (`components/graphiques-strategie.tsx`), par les classes
`anime-monte`, `anime-etire`, `anime-remplit` et `anime-decouvre` de
`app/globals.css`, seul endroit où il est écrit.

- **Une seule animation par graphique, au chargement de l'écran**, qui dit dans
  quel sens lire : les barres montent ou s'étirent de gauche à droite, comme le
  temps ; les crans des forces se remplissent un par un ; la carte de chaleur se
  découvre semaine après semaine.

| Règle | Valeur | Pourquoi |
|---|---|---|
| Durée | 400 à 700 ms | assez pour voir le sens de lecture, trop court pour faire attendre la lecture |
| Courbe | départ vif, arrivée douce (`cubic-bezier(0.2, 0.7, 0.2, 1)`) | la donnée arrive à sa valeur et s'y pose, sans rebond |
| Décalage | 45 à 180 ms par marque, plafonné | une cascade de gauche à droite suit l'ordre du temps |
| Point de départ | une marque déjà visible (6 % de sa taille, 25 % d'opacité ; un cran part du gris d'un cran vide) | une capture prise pendant l'animation reste lisible |
| Moins de mouvement | aucune animation | le réglage du système du lecteur prime toujours |
| Hors charte | ni boucle, ni rebond, ni animation au défilement ou au survol d'une donnée | |

Un chiffre ne s'anime jamais : il s'affiche à sa valeur, seule la marque bouge.

## Ce que la transcription oblige à corriger dans le portail

1. **Les libellés des badges ne sont pas ceux des niveaux.** Notion écrit le
   suffixe `FORT`, `MOYEN`, `RAS` ; la charte affiche `SIGNAL FORT`,
   `À SURVEILLER`, `RAS`. C'est une correspondance d'affichage, pas une
   conversion : les trois niveaux restent trois.
2. **Le fond du site est le blanc pur**, pas un blanc cassé.
3. **Le logotype ne se compose ni en mono, ni en capitales.** L'en-tête du
   portail doit porter le mot-symbole en Lora avec son curseur rose.
4. **L'italique est réservé à la voix éditoriale.** Un `<em>` venu du corps
   d'une note Notion reste de l'italique de citation ; il ne sert pas à
   insister, et le rendu ne doit pas en ajouter.
5. **Un seul bouton primaire par écran.**

## Un point à arbitrer

**Le domaine est tranché.** `signauxfaibles.io`, décidé le 10 septembre 2026,
conforme à la charte. Le portail ne code aucun domaine en dur : `PORTAIL_URL`
est une variable d'environnement.

**Le contraste du badge `SIGNAL FORT`.** La charte pose que le rose ne porte
jamais de texte courant, mais compose ce badge en rose sur fond rose. Mesuré,
`#dd768a` sur `#fbeef1` donne environ 2,2 : 1, sous le seuil AA même pour du
gras. La charte est cohérente avec elle-même — un label mono n'est pas du texte
courant — et c'est elle qui a été suivie. Si l'accessibilité doit primer, la
correction tient en une valeur : un rose plus sombre pour le seul texte du
badge, le fond restant identique. Cela ne se décide pas sans la personne qui a
fait la charte.
