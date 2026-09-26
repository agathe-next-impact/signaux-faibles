# Les routes `/api/veille/*` — le déterministe du dispositif, en code

*Créées le 17 septembre 2026. Elles mettent en œuvre le premier palier de
l'audit du même jour (« passage par le portail ») **à périmètre constant** :
le portail n'écrit toujours pas dans Notion et ne lit toujours ni le registre,
ni les validations, ni les référentiels. Il ne fait que ce qui est déterministe
et qu'il sait déjà faire — parser une lettre, lire la base Éditions, lire la
base Accès — et le fait avant l'envoi plutôt qu'après.*

## Pourquoi

Jusqu'ici, à chaque run, le modèle de langage calculait la date et la semaine
ISO, appliquait la règle de cadence, retrouvait le dernier numéro de chaque
famille, et se relisait pour vérifier que les H2 portaient un suffixe et que les
dossiers portaient un compteur. Quatre familles d'incidents silencieux en huit
jours venaient de là (audit du 17 septembre, §2). Ces quatre routes retirent ces
calculs du prompt. Ce que le modèle garde : lire, scorer, rédiger.

## Authentification

Toutes les routes exigent `Authorization: Bearer <jeton>`, où le jeton est
`ACTIVATION_SECRET` (déjà connu des tâches Cowork, c'est celui de
`POST /api/acces/ouvrir`) ou `CRON_SECRET` (présenté par Vercel aux crons).
Aucun secret nouveau côté tâches. Sans aucun des deux configuré : 503, la route
est fermée. Jeton faux ou absent : 401. Le contrôle précède toute lecture de
l'environnement, comme pour l'activation.

## `POST /api/veille/lint` — valider une lettre avant l'envoi

```
POST /api/veille/lint
Authorization: Bearer <ACTIVATION_SECRET>
Content-Type: application/json

{ "page": "<page_id de la page Édition, tirets ou non, même en Brouillon>" }
```

Le portail expire le cache de la page, la relit, la passe dans **son parseur de
production** (`construireDocument`, `lireDossiersOuverts`, `mentionsDe`,
`contrôlerLeContrat`) et répond :

```json
{
  "état": "contrôlée",
  "page": "3dbfe829ce7181529c90d1a670074b3b",
  "statut": "Brouillon",
  "famille": "Écosystème",
  "numéro": 14,
  "conforme": false,
  "ruptures": [
    { "code": "axe-sans-niveau", "portée": "portail",
      "message": "l’axe « Financements » n’a pas de suffixe d’impact lisible …" }
  ],
  "avertissements": [
    { "code": "dossier-non-nommé", "message": "le dossier « Maison de santé » n’est nommé nulle part dans le corps …" }
  ],
  "aperçu": {
    "titre": "Veille … — lundi 21 septembre 2026",
    "rubriques": ["L’essentiel", "Actualités par axe", "…", "Ajustements du cadrage de cette veille", ""],
    "axes": [ { "numéro": 1, "titre": "Commande publique", "niveau": "FORT" }, … ],
    "dossiers": [ { "nom": "CADA", "compteur": 1, "précision": "rapporteurs identifiés", "nommé": true }, … ],
    "cadrage": { "présent": true, "clos": true, "phraseDeClôture": true }
  }
}
```

**Codes de rupture** (bloquent : `conforme` est faux) — `aucun-axe`,
`axe-sans-niveau`, `dossier-sans-compteur`, `cadrage-absent`,
`cadrage-non-clos`, `titre-vide` sont de portée `portail` (ce que le portail
n'affichera pas) ; `niveau-faible`, `cadrage-sans-adresse`, `essentiel-absent`
et `essentiel-trop-long` sont de portée `lettre` (règles de la page « Tâche —
Lettres de veille »).
**Avertissements** (ne bloquent pas) — `dossier-non-nommé`,
`axes-hors-rubrique`, `référence-interne`, `aucun-dossier`,
`absence-en-prose` (un axe RAS dont le corps n'est pas en encadré : le portail
le rendrait sur la page de l'axe et le citerait sur celle de chaque acteur
nommé, comme un fait ; depuis le 21 septembre 2026, le RAS motivé, les sources
non ouvertes et les notes de méthode s'écrivent en encadré),
`essentiel-ligne-longue`.

### « L'essentiel » : 8 lignes de 140 caractères au plus

*Depuis le 26 septembre 2026.* Le digest hebdomadaire de l'espace client
Next Impact reprend « L'essentiel » de chaque édition **tel quel**, sans
modèle de langage ni résumé : une édition y occupe 8 lignes au plus. La limite
est donc tenue ici, avant l'envoi.

- La rubrique est un **titre de niveau 1** (`heading_1`) « L’essentiel ».
  Apostrophe droite ou typographique, casse et accents indifférents ;
  « Essentiel » seul ou « L’essentiel de la semaine » sont reconnus,
  « Essentiellement » non.
- Elle s'étend jusqu'au titre suivant de niveau 1 **ou 2** (un H2 ouvre un
  axe : ce qui le suit n'est plus l'essentiel).
- Une **ligne** = une puce (`bulleted_list_item` ou `numbered_list_item`) ou
  un paragraphe (`paragraph`) non vide. Les autres blocs (citation, encadré,
  tableau, H3, sous-puces imbriquées) ne sont pas comptés — et ne sont pas
  repris par le digest : ne pas en mettre dans « L'essentiel ».
- `essentiel-absent` (rupture) : pas de rubrique, ou aucune ligne.
  `essentiel-trop-long` (rupture) : plus de 8 lignes — fusionner ou renvoyer
  le détail dans les axes. `essentiel-ligne-longue` (avertissement) : une ligne
  de plus de 140 caractères, que le rapport cite par son rang.

Portée `lettre` : le contrôle du soir (`/api/veille/etat`) ne les compte pas,
les éditions déjà envoyées ne sont pas rouvertes.

`404` : l'identifiant n'est pas une page de la base Éditions. `400` : corps
ou identifiant illisible.

Ce que le validateur accepte, le portail l'affiche. Il n'y a pas de troisième
lecture : `lib/portail/lint.ts` appelle les mêmes fonctions que les écrans.

## `POST /api/veille/calendrier` — la sélection du jour

```
POST /api/veille/calendrier
Authorization: Bearer <ACTIVATION_SECRET>

{ "date": "2026-09-17",
  "organisations": [
    { "slug": "hermitage", "jour": "Lundi", "cadence": "Hebdomadaire", "heure": "6 h 30" },
    { "slug": "dalious",   "jour": "Jeudi", "cadence": "Hebdomadaire", "heure": "7 h 30" }
  ] }
```

`date` est facultative (aujourd'hui à Paris sinon). `jour` et `cadence`
prennent les options exactes du registre. Réponse :

```json
{
  "état": "calculée", "fuseau": "Europe/Paris",
  "aujourdHui": { "date": "2026-09-17", "jour": "Jeudi", "quantième": 17, "semaineISO": 38, "annéeISO": 2026, "semainePaire": true },
  "demain":     { "date": "2026-09-18", "jour": "Vendredi", … },
  "parutions":  ["dalious"],
  "revuesDues": [],
  "prochaines": [ { "slug": "dalious", "date": "2026-09-24", "jour": "Jeudi" }, { "slug": "hermitage", "date": "2026-09-21", "jour": "Lundi" } ]
}
```

`parutions` est dans l'ordre de traitement (heure de parution, puis slug).
`revuesDues` sont les organisations dont la première parution du mois tombe
**demain** — la porte de la revue mensuelle. La règle est dans
`lib/domaine/calendrier.ts`, testée bord d'année compris ; les formules Notion
« Parution aujourd'hui » et « Revue mensuelle demain » doivent lui rester
conformes. Un écart connu : la page « Tâche — Revue mensuelle » écrit la
première parution du mois en arithmétique (« quinzaine → semaine paire ET
quantième ≤ 14 »), ce qui est faux en janvier 2027 — 2026 a 53 semaines ISO,
la semaine 53 et la semaine 1 sont toutes deux impaires, et une quinzaine du
vendredi paraît le 25 décembre puis le 15 janvier. Le portail **dérive** la
règle de la règle de parution (première date du mois où l'organisation
paraît) ; la page Notion est à aligner sur cette formulation.

## `GET /api/veille/contexte?organisation=<page_id>` — numéros et anti-doublon

`organisation` est le page_id de la **ligne de registre** (celui que portent
les relations). Réponse, par famille interne :

```json
{
  "état": "lu", "organisation": "3d5fe829ce71810da651f3783a725bd8", "éditions": 21,
  "familles": {
    "Écosystème":    { "éditions": 13, "dernierNuméro": 13, "prochainNuméro": 14, "dernièreDate": "2026-09-14", "veille": "Écosystème", "dernières": [ … ] },
    "Concurrentiel": { "éditions": 8,  "dernierNuméro": 8,  "prochainNuméro": 9,  "dernièreDate": "2026-09-14", "veille": "Concurrentiel", "dernières": [ … ] }
  },
  "sansFamille": []
}
```

`dernières` porte les deux dernières éditions de la famille, **tous statuts**
(un brouillon en relecture a déjà son numéro), avec `dossiers` déjà analysés,
`actionDeLaSemaine` et `amendements`. `sansFamille` liste les éditions que le
comptage ne peut rattacher à rien : une page sans `Famille` ferait repartir la
numérotation en arrière, il faut la corriger.

## `GET /api/veille/etat` — le contrôle du soir

`GET /api/veille/etat` rend l'état de tous les espaces clients ; avec
`?notifier=1` — ou quand l'appel vient du cron Vercel, reconnu à l'en-tête
`x-vercel-cron-schedule` —, envoie en plus un courriel à `RELECTEUR_EMAIL`
**seulement s'il y a au moins un défaut**. C'est l'ancienne étape 3bis de « Tâche —
Réconciliation des envois », en code. Le cron de `vercel.json` l'appelle du
lundi au vendredi à 17 h 30 UTC (19 h 30 l'été, 18 h 30 l'hiver, à Paris).

Défauts nommés, par espace : `identifiant-organisation-vide`,
`identifiant-organisation-divergent`, `identifiant-acces-vide`,
`identifiant-acces-doublon`, `email-manquant`, `aucun-acces-actif`,
`aucune-lettre-publiée` (dont le message nomme d'abord la cause la plus
fréquente, le statut Brouillon, avant l'identifiant), `contrat-rompu` (la
dernière lettre publiée passée au validateur ; seules les ruptures de portée
`portail` comptent).

## Variables d'environnement

`CRON_SECRET` (nouveau, pour Vercel) et `RELECTEUR_EMAIL` (nouveau, facultatif ;
vide, le contrôle journalise sans écrire à personne). `ACTIVATION_SECRET`
existait déjà. Voir `.env.example`.

## Depuis une tâche Cowork

Les tâches disposent d'un shell ; `curl` suffit. Le jeton est dans la tâche
comme pour l'activation.

```sh
# valider la page qu'on vient de créer
curl -sS -X POST "$PORTAIL_URL/api/veille/lint" \
  -H "Authorization: Bearer $ACTIVATION_SECRET" -H "Content-Type: application/json" \
  -d '{"page":"3dbfe829ce7181529c90d1a670074b3b"}'

# la sélection du jour
curl -sS -X POST "$PORTAIL_URL/api/veille/calendrier" \
  -H "Authorization: Bearer $ACTIVATION_SECRET" -H "Content-Type: application/json" \
  -d '{"organisations":[{"slug":"hermitage","jour":"Lundi","cadence":"Hebdomadaire","heure":"6 h 30"}]}'

# le contexte d'une organisation
curl -sS "$PORTAIL_URL/api/veille/contexte?organisation=3d5fe829ce71810da651f3783a725bd8" \
  -H "Authorization: Bearer $ACTIVATION_SECRET"
```

## Ce qu'il reste à faire dans Notion — après déploiement, pas avant

Les pages de prompts sont la source de vérité des tâches. Elles ne doivent
appeler ces routes qu'une fois la branche déployée et les variables posées,
sans quoi la lettre de lundi tenterait d'appeler une route absente. Les
amendements, à appliquer dans cet ordre, avec repli explicite :

**« Tâche — Lettres de veille », étape 0.0** — remplacer le calcul de la date
et de la cadence par : *« Appelle `POST /api/veille/calendrier` avec les lignes
de la vue Veilles actives (slug, jour, cadence, heure). La réponse donne la
date, la semaine ISO, les parutions du jour dans l'ordre et la prochaine
parution de chacun : recopie-la en tête du compte rendu et ne recalcule rien.
Si le portail ne répond pas (autre chose qu'un 200), dis-le, et applique la
règle ci-dessous à la main. »* — puis conserver l'ancienne règle comme repli.

**Étape 0.3** — remplacer la requête sur la base Éditions par : *« Appelle
`GET /api/veille/contexte?organisation=<URL de la ligne de registre, sans le
préfixe>`. `prochainNuméro` de chaque famille est le numéro à écrire ;
`dernières` porte les deux dernières éditions pour l'anti-doublon et la
continuité des dossiers. Si `sansFamille` n'est pas vide, signale-le dans le
compte rendu. Repli : la requête directe ci-dessous. »*

**Étape 4, après la création de la page** — ajouter : *« Avant l'étape 6,
appelle `POST /api/veille/lint` avec l'identifiant de la page créée. Tant que
`conforme` est faux, corrige la page (le rapport nomme chaque rupture et
l'endroit) et rappelle la route. N'envoie AUCUNE lettre dont le rapport n'est
pas conforme ; recopie les avertissements dans la notification de relecture.
Si le portail ne répond pas, envoie quand même et dis-le en tête de la
notification. »*

**« Tâche — Réconciliation des envois »** — retirer l'étape 3bis, remplacée par
le cron du portail, et retirer de l'étape 3 la mention de la colonne « Réponse »,
supprimée le 15 septembre. Ajouter en tête de la notification, s'il y a lieu,
le contenu de `GET /api/veille/etat` (les défauts), pour ne pas avoir deux
messages le même soir.

**« Tâche — Revue mensuelle »**, porte — même amendement que l'étape 0.0 :
`revuesDues` de `/api/veille/calendrier` est exactement sa porte.

**« Tâche — Lettres de veille », étape 3 (contrat de forme)** — ajouter :
*« L'essentiel » (titre de niveau 1) tient en **8 lignes au plus**, une ligne
étant une puce ou un paragraphe, et chaque ligne en **140 caractères au plus**.
Ces lignes sont reprises telles quelles dans le digest hebdomadaire des
clients : chacune doit se lire seule, sans le reste de la lettre. Pas de
citation, d'encadré, de tableau ni de sous-puce dans cette rubrique. »*

**Le contrat de forme des lettres** (page Lettres, tête de l'étape 3) reste où
il est : le validateur l'applique, il ne le remplace pas. On peut par contre y
retirer les récits d'incidents, qui n'instruisent plus rien maintenant que la
vérification est mécanique.
