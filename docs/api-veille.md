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
`essentiel-ligne-longue`, et, pour l'édition n°1 seulement (19 octobre 2026),
`lettre-maigre` (moins de six paragraphes de faits hors encadrés, dans les
axes, les rubriques de signaux et l'actualité des acteurs) et `analyse-absente`
(aucune rubrique de niveau 1 dont le titre contient « analyse »). Ces deux-là
viennent du §6 du prompt de génération des référentiels : les éditions n°1 de
La petite vitrine et de Suneido comptaient 5 paragraphes de faits en moyenne,
contre 26 pour les lettres régulières, sans que rien ne le signale. Le contrôle
du soir ne passe pas le numéro et ne les émet donc jamais.

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

Les tâches disposent d'un shell ; `curl` suffit. **Aucune tâche ne porte le
jeton** depuis le 16 octobre 2026 : l'environnement « signaux-faibles-io »
l'ajoute lui-même à toute requête vers `www.signauxfaibles.io` (en-tête
`Authorization`, préfixe `Bearer`, chemins `/api/veille/` et `/api/acces/`).
Une tâche n'ajoute aucun en-tête et n'écrit jamais un jeton dans une commande.

```sh
# valider la page qu'on vient de créer
curl -sS -X POST "https://www.signauxfaibles.io/api/veille/lint" \
  -H "Content-Type: application/json" \
  -d '{"page":"3dbfe829ce7181529c90d1a670074b3b"}'

# la sélection du jour
curl -sS -X POST "https://www.signauxfaibles.io/api/veille/calendrier" \
  -H "Content-Type: application/json" \
  -d '{"organisations":[{"slug":"hermitage","jour":"Lundi","cadence":"Hebdomadaire","heure":"6 h 30"}]}'

# le contexte d'une organisation
curl -sS "https://www.signauxfaibles.io/api/veille/contexte?organisation=3d5fe829ce71810da651f3783a725bd8"
```

### Lire un 401

- **401 sur `/api/acces/` seulement** : le chemin n'est pas autorisé dans
  l'environnement. L'ajouter à côté de `/api/veille/`.
- **401 sur toutes les routes** : le secret de l'environnement n'est plus celui
  du portail, typiquement après un changement d'`ACTIVATION_SECRET` sur Vercel
  sans report dans l'environnement (constaté le 18 octobre 2026).
- **405 sur `GET /api/acces/ouvrir`** : la vérification préalable n'est pas
  encore déployée ; ce n'est pas un refus.

### Changer `ACTIVATION_SECRET`

Deux endroits, et deux seulement, doivent porter la même valeur : la variable
Vercel (puis un redéploiement, sans lequel elle n'est pas lue) et le secret de
l'environnement « signaux-faibles-io » sur claude.ai/code. Les tâches Cowork
n'ont rien à changer. Une session déjà ouverte garde l'ancien secret : vérifier
depuis une nouvelle session qu'un appel à `contexte` répond 200. Changer ce
secret n'invalide aucun lien d'accès (signés par `ACCES_SECRET_HMAC`) ni les
crons (`CRON_SECRET`). La valeur se range dans un gestionnaire de mots de passe,
jamais dans une page Notion : les tâches lisent Notion.

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

## Mise en service de la base Postgres (palier 1a, 16 octobre 2026)

Deux routes d'administration, gardées comme les autres, que la session Claude
de l'environnement « signaux-faibles-io » appelle sans manipuler de secret (le
proxy de l'environnement ajoute l'en-tête). Le portail est le seul à tenir
`DATABASE_URL` et le jeton Notion : c'est donc lui qui crée les tables et
copie la base Accès, plutôt qu'un poste où il faudrait les recopier.

- `POST /api/veille/migrer` : applique les migrations de `drizzle/`.
  Idempotente. Réponse `{ état: 'à jour' }`, ou `{ état: 'échec', message }`
  avec le seul code SQLSTATE.
  Le build de production l'applique aussi avant `next build` (18 octobre
  2026), et le contrôle du soir signale `migrations-en-attente` si le journal
  du dépôt et la base divergent : cette route reste le geste de rattrapage.
- `GET /api/acces/ouvrir` : la vérification préalable des commandes
  d'onboarding. Contrôle le seul jeton, sans corps ni envoi : 200
  `{ état: 'prêt' }`, 401, ou 503 si le secret n'est pas configuré. Un 401
  depuis une session Claude veut dire que son environnement ne porte le secret
  que sur `/api/veille/` : y autoriser aussi `/api/acces/`.
- `POST /api/veille/importer-acces?a-blanc=1` : le plan d'import, rien n'est
  écrit. Sans `a-blanc`, l'import est écrit en une transaction. Réponse :
  comptes, slugs, libellés, lignes écartées désignées par empreinte ; jamais
  d'adresse ni d'identifiant d'accès. Refuse (409) une base Notion vide.

## Entrée en essai (18 octobre 2026)

`POST /api/veille/organisations`, gardée par le jeton,
`{ "slug", "nom", "registreNotion" }` (le `page_id` de la ligne du registre,
celui que portent les éditions, avec ou sans tirets) :

- 201 `créée` : nouvelle organisation à l'état `essai`, sans J0 ;
- 200 `passée-en-essai` : une `demande`, une `generation`, ou une `abonnee`
  née d'un import rejoué pendant l'onboarding (créée après le 18/10/2026, il y
  a moins de quatorze jours, sans J0 ni abonnement) ;
- 200 `déjà-en-essai` : rejouable ; tant que J0 n'est pas posé, corrige le
  registre et le libellé ;
- 409 `registre-différent` (`registreActuel`) : J0 posé, le registre ne change
  plus ;
- 409 `état-incompatible` (`étatActuel`) : client historique, suspendu,
  écarté ou de test, jamais rétrogradé ;
- 409 `registre-pris` (`slugExistant`) : ce registre porte déjà un autre slug ;
- 409 `refusé` en `SOURCE_ACCES=notion`, 503 sans base.

Ordre attendu à l'étape B de l'onboarding : cette route, puis
`POST /api/veille/importer-acces` (en `double`), puis `POST /api/acces/ouvrir`.
J0 est fixé ensuite par `GET /api/veille/parcours` à la date de la première
lettre publiée datée de la semaine d'entrée en essai ou après ; la réponse le
dit dans `j0Fixés`.

## Réglages du parcours par l'opératrice (18 octobre 2026)

`PATCH /api/veille/organisations`, gardée par le jeton, pour ne pas couper un
client dont l'onboarding ou la souscription prend du retard, sans écrire en base
à la main :

- `{ "slug", "action": "prolonger", "semaines": 1 | 2 | 3 }` décale J0 d'autant.
  200 `prolongé` avec `ancienJ0` et `nouveauJ0` ; 409 `sans-j0` (le calendrier
  n'a pas démarré : rien à prolonger), 409 `pas-en-essai` avec `état`, 409
  `au-delà-d-aujourdhui` avec `j0Maximal` (J0 n'est jamais posé après la date
  du jour, à Paris : au plus, l'essai repart de la semaine en cours) ;
- `{ "slug", "action": "relecture", "requise": true | false }` envoie les
  courriers de fin d'essai à l'adresse de relecture (`true`) ou au client
  (`false`), sans toucher au calendrier. 200 `relecture-réglée`.

Trois réglages de plus le 19 octobre 2026, sur la même route, que le tableau de
l'opératrice (`/espaces/abonnements`) porte aussi en actions serveur :

- `{ "slug", "action": "offre", "offre": "standard" | "early_adopter" | "gratuite" }`
  pose l'offre. `gratuite` est l'accès offert : jamais de fin d'essai, étape
  « accès offert », et une organisation en essai passe `abonnee`.
  `early_adopter` ne propose et n'admet que la formule à 29 € HT par mois,
  sur son propre prix Stripe (`STRIPE_PRIX_EARLY_ADOPTER`). 200 `offre-posée`
  avec `offre` et `état` ;
- `{ "slug", "action": "parutions", "parutions": 1..8 }` règle le nombre de
  parutions complètes de l'essai (trois par défaut ; quatre pour un essai à
  J+28). 200 `parutions-réglées` ; 409 `parutions-invalides` ;
- `{ "slug", "action": "parcours", "prochaineLettre": "AAAA-MM-JJ", "restantes": n }`
  fait entrer une organisation dans le parcours à une date choisie : J0 est le
  lundi de la semaine de la prochaine lettre, reculé de `parutions − restantes`
  semaines, et la mécanique existante suit (courrier de dernière parution,
  « L'essentiel », suspension). **C'est le chemin pour un client historique
  qui devient payant** ; `ouvrirEnEssai` garde sa garde contre la
  rétrogradation. 200 `mis-en-parcours` avec `j0`, `parutions`, `restantes` ;
  409 `abonnée-stripe` (un abonnement Stripe est ouvert), 409 `pas-en-essai`
  (état hors `essai` et `abonnee`), 409 `parutions-invalides` (plus de
  restantes que de parutions), 400 `date-invalide`.

404 `inconnue` pour un slug absent. Un espace réduit à « L'essentiel » ou
suspendu par le calendrier retrouve la lecture complète si le décalage le
ramène dans l'essai. Un courrier de fin d'essai déjà parti ne repart pas : le
journal en tient un par organisation et par destinataire. Chaque réglage est
journalisé (`[veille/organisations] <slug> : prolonger, J0 … → …`).

## Écriture des lecteurs (palier 1a-bis, 16 octobre 2026)

`POST /api/veille/lecteurs`, gardée par le jeton :

- `{ "action": "creer", "slug", "nom", "email" }` → 201 `créé`, 404
  `organisation-inconnue`, 409 `déjà-inscrit` (même adresse chez ce client,
  casse ignorée) ;
- `{ "action": "revoquer" | "reactiver", "slug", "email" }` → 200 `révoqué`,
  `réactivé` ou `inchangé`, 404 `lecteur-inconnu`.

Refuse en 409 tant que `SOURCE_ACCES` n'est pas `postgres` : avant la bascule,
la base Notion « Accès » fait foi et c'est là qu'on écrit. L'identifiant
d'accès est tiré par le portail et n'apparaît ni dans la réponse ni dans les
journaux ; après une création, le lien part par `POST /api/acces/ouvrir`
`{ email }`, comme aujourd'hui.

`GET /api/veille/etat` rend désormais aussi `accès : { source, base,
lecteursActifs }`, où `base` vaut `joignable`, `injoignable` ou `non
configurée`. En mode `postgres`, une base injoignable est un défaut
(`base-injoignable`), notifié comme les autres.

## Prospection par lemlist (19 octobre 2026)

Le portail et lemlist se parlent dans les deux sens, et une tâche Cowork lit
ce que le portail en sait. Le détail, les champs lemlist et la mise en
service sont dans `docs/prospection-lemlist.md`.

### `GET /api/veille/prospection?jours=30` — l'état de la prospection

Gardée par le jeton. Une ligne par lead lemlist modifié dans la fenêtre :

```json
{
  "état": "lu", "jours": 30, "nombre": 2,
  "prospections": [{
    "id": "…", "slug": "suneido", "destinataireEmpreinte": "9f3a2c1b",
    "campagneLemlist": "cam_…", "leadLemlist": "lea_…",
    "statut": "actif", "statutLe": "2026-10-20T08:12:00.000Z",
    "séquenceArrêtéeLe": "2026-10-20T08:12:01.000Z",
    "synchroniséStatut": "actif", "erreurSynchro": null,
    "dernierÉvénementLe": "2026-10-19T07:00:00.000Z", "crééeLe": "…",
    "événements": { "emailsSent": 1, "emailsOpened": 2, "emailsClicked": 1 }
  }]
}
```

Statuts : `envoye` (lettre 1 partie), `actif` (le prospect a ouvert son
espace), `abonne`, `expire` (essai fini sans abonnement), `resilie`,
`rebondi` (adresse en erreur), `desinscrit` (**final** : à lire avant de
recontacter une adresse). Le score d'un prospect se calcule dans la tâche, à
partir des comptes d'événements ; le portail ne le calcule pas. Aucune adresse
dans la réponse : `slug` et empreinte suffisent à rapprocher la ligne d'un
contact lemlist, dont la tâche a l'adresse par le connecteur.

### `POST /api/webhooks/lemlist` — ce que lemlist dit au portail

Pas de jeton : la livraison est authentifiée par le champ `secret` que lemlist
renvoie dans chaque corps, comparé à `LEMLIST_WEBHOOK_SECRET`. 401 sans secret
ou avec un secret faux ; 500 sur une panne de la base (lemlist relivre) ; 200
pour tout le reste. Le premier événement d'un lead rattache son adresse au
lecteur actif qui la porte (en minuscules, organisation en prospection de
préférence) ; les suivants s'ajoutent au journal, une fois chacun (identifiant
d'activité `act_…`). Une désinscription (`emailsUnsubscribed`,
`entityUnsubscribed`, `emailsNotInterested`) rend le statut `desinscrit`.

### Entrée par prospection : `origine: "prospection"`

`POST /api/veille/organisations` accepte `"origine": "prospection"`. L'organisation
est créée en essai **sans date d'ouverture** : la lettre 1 est publiée et envoyée
par lemlist, mais l'essai n'ouvre qu'à la **première visite** du lecteur sur son
lien d'accès, qui pose `essai_ouvert_le`. J0 est alors la première lettre
publiée à partir de la semaine de cette visite ; une lettre publiée avant ne
compte pas. Sans visite, l'organisation reste hors parcours, en lecture
complète, et ne reçoit aucun courrier de fin d'essai. L'onboarding par
prospection **n'appelle pas** `POST /api/acces/ouvrir` : le lien ne part que
quand le prospect le demande sur « recevoir mon lien ».

### Ce que le portail dit à lemlist

- **À la première visite d'un lecteur** (`/acces/[jeton]`, hors du chemin de la
  réponse) : le lead est marqué intéressé dans sa campagne, ce qui arrête la
  séquence, et `sfStatut` passe à `actif`.
- **Chaque jour**, dans `GET /api/veille/parcours` après les courriers de fin
  d'essai : `abonne`, `expire` et `resilie` sont déduits de l'étape du parcours,
  et tout ce que lemlist ne sait pas encore lui est écrit, y compris ce qui a
  échoué la veille. La réponse du cron porte `prospection : { examinées,
  passées, synchronisées, enAttente, échecs }`.

Sans `LEMLIST_API_KEY`, rien ne part : la prospection est tenue dans Postgres
et `enAttente` compte ce qui attend. Le portail n'ajoute jamais un contact à
une campagne et ne lance rien : c'est le rôle de la tâche de prospection.
