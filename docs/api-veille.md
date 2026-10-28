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
`axe-sans-niveau`, `dossier-sans-compteur`,
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

## `POST /api/veille/courriel` — mettre un courriel client à la charte

*20 octobre 2026.* Les tâches n'écrivent plus de HTML pour un client : elles
demandent la forme au portail, qui la tire du gabarit de la charte
(`lib/email/gabarit.ts`, `docs/emails/README.md`). La route n'envoie rien et
n'écrit nulle part.

```
POST /api/veille/courriel
{ "sorte": "lettre", "page": "<page_id>", "slug": "acme", "organisation": "Acme", "objet": "Veille Acme : Concurrentiel, lundi 19 octobre" }
{ "sorte": "message", "slug": "acme", "organisation": "Acme", "objet": "…", "préheader": "…",
  "surtitre": "Point mensuel", "titre": "…", "accroche": "…", "salutation": "Bonjour,",
  "paragraphes": ["…"], "points": [{ "niveau": "MOYEN", "titre": "…", "texte": "…", "méta": "…" }],
  "action": { "libellé": "Répondre aux questions", "url": "https://…" }, "réassurance": "…" }
{ "sorte": "prospection", "étape": 1 | 2 | 3, "prénom": "Serge", "entreprise": "Suneido",
  "essentiel": "…" (étape 1), "faitMarquant": "…" (étape 2) }
```

`prospection` (20 octobre 2026) : un email de la séquence de prospection,
rempli pour Gmail (pilote sans lemlist, `docs/prospection-lemlist.md`), avec
une désinscription par réponse « STOP ».

Réponse `200` : `{ état: "composé", objet, html, texte, octets }`, et
`avertissement` au-delà de 92 Ko (Gmail masque la fin d'un message de plus de
102 Ko). La tâche pose `html` dans `htmlBody` et `texte` dans `body` de
`mcp__Gmail__create_draft`, **sans retoucher ni l'un ni l'autre**.

### Le brouillon déposé par le portail (23 octobre 2026)

Avec `"brouillon": { "à": ["lecteur@client.fr"] }` (zéro à dix adresses simples,
jamais de copie), le portail **dépose lui-même** le courriel en brouillon dans la
boîte de l'opératrice (`GMAIL_BOITE_OPERATRICE`, facultative, portée
`gmail.compose` de la délégation) et rend
`{ état: "brouillon", objet, idBrouillon, idMessage, destinataires, octets }`,
**sans `html` ni `texte`**. Rien ne part : l'opératrice relit et envoie, la
réconciliation du soir constate l'envoi dans la même boîte. Aucune adresse dans le
journal : l'empreinte de huit caractères.

Si la boîte n'est pas configurée, ou si Gmail refuse, la réponse est celle d'une
demande sans `brouillon` (`état: "composé"`, `html`, `texte`), avec
`brouillon: { état: "indisponible" }` ou `brouillon: { état: "échec", statut }` :
la tâche dépose alors le brouillon elle-même, comme avant.

Pourquoi : la tâche recopiait le HTML dans `create_draft`, 68 Ko par lettre écrits
en sortie par le modèle, puis relus à chacun de ses appels suivants. Sur la
première lettre Heritech, 210 000 caractères (`docs/cout-premiere-lettre.md`).
`tests/architecture.test.ts` tient le seul appelant de `déposerChezLOpératrice`
(cette route) et son ordre : après le contrôle de la lettre, jamais d'envoi.

`lettre` : la page est lue avec le parseur de production, tous statuts, et
contrôlée comme par le lint ; **une lettre non conforme rend `422`**
(`non-conforme`, avec les ruptures) et n'est pas mise en forme. À appeler après
un lint conforme : c'est lui qui a expiré le cache de la page. `message` : trois
points au plus, badges FORT / MOYEN / RAS seulement, adresses https ; un champ
hors règle rend `400` en le nommant. `404` : page inconnue.

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

Depuis le 26 octobre 2026 (outils stratégiques, lot 4), `étiquettes-manquantes`,
par organisation du pilote : les éditions publiées depuis la première étiquetée
qui n'ont pas d'étiquettes. Avant la première, rien n'est dû. Une lettre dont
tous les axes sont RAS n'a aucun fait à étiqueter et y figure à tort ; le
message le dit.

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

- `{ "slug", "action": "offre", "offre": "standard" | "fondateur" | "gratuite" }`
  pose l'offre. `gratuite` est l'accès offert : jamais de fin d'essai, étape
  « accès offert », et une organisation en essai passe `abonnee`.
  `fondateur` (le tarif fondateur, nommé `early_adopter` jusqu'au 27 octobre
  2026, valeur encore acceptée) ne propose et n'admet que la formule à 29 € HT
  par mois, sur son propre prix Stripe (`STRIPE_PRIX_FONDATEUR`, à défaut
  `STRIPE_PRIX_EARLY_ADOPTER`). 200 `offre-posée`
  avec `offre` et `état` ;
- `{ "slug", "action": "parutions", "parutions": 1..8 }` règle le nombre de
  parutions complètes de l'essai (deux par défaut depuis le 24 octobre 2026,
  trois auparavant ; quatre pour un essai à J+28). 200 `parutions-réglées` ; 409 `parutions-invalides` ;
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
`entityUnsubscribed`, `variableUnsubscribed`, `emailsNotInterested`) rend le
statut `desinscrit`. Depuis le 30 mars 2026, lemlist n'émet plus
`emailsUnsubscribed` pour un contact désinscrit, mais `entityUnsubscribed` (le
contact) ou `variableUnsubscribed` (une de ses adresses).

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

## Prescripteurs (24 octobre 2026)

La prospection automatisée est réservée aux clients finaux. Un prescripteur
(expert-comptable, cabinet de conseil, chambre, cluster, fédération, réseau de
l'ESS) recommande des clients et n'entre jamais dans une séquence ; ses
recommandations non plus. Le canal est décrit dans `docs/prescripteurs.md`.

### `POST /api/veille/prescripteurs` — déclarer un prescripteur

```
{ "slug": "cabinet-durand", "code": "durand", "type": "conseil" }
```

L'organisation doit déjà être ouverte dans le portail (son propre espace).
`type` : `conseil`, `expertise_comptable`, `juridique`, `chambre_consulaire`,
`developpement_economique`, `cluster_federation`, `ess_financeur`, `autre`.
Le code (3 à 40 caractères, minuscules, chiffres et tirets) est celui du lien
de recommandation, `/demo?de=<code>`. 201 `créé` ; 200 `déjà-prescripteur`
(rejeu) ; 404 `organisation-inconnue` ; 409 `code-pris` ou `en-prospection`
(organisation entrée par prospection : arrêter sa séquence d'abord). La route
ne pose pas l'accès offert : `PATCH /api/veille/organisations`
`{ "action": "offre", "offre": "gratuite" }` le fait, parce qu'un client qui
paie peut aussi devenir prescripteur.

### `GET /api/veille/prescripteurs?exclusions=1` — ce que la prospection ne contacte jamais

```
{ "état": "lu", "nombre": 2, "exclusions": [
  { "slug": "cabinet-durand", "nom": "Cabinet Durand", "registreNotion": "…", "rôle": "prescripteur" },
  { "slug": "client", "nom": "Client", "registreNotion": "…", "rôle": "recommandée" } ] }
```

La tâche de prospection la lit **avant** de constituer son lot, et écarte toute
ligne du registre qui y figure (par `registreNotion`, à défaut par le nom).

### Organisation recommandée : `prescripteur` sur `POST /api/veille/organisations`

La demande de démo porte le code du prescripteur (ligne « Recommandée par le
prescripteur » du courrier) ; l'onboarding le passe en `"prescripteur": "<code>"`.
Le premier prescripteur garde l'organisation, son essai compte quatre
parutions tant que J0 n'est pas posé, et elle sort de la prospection.
Exclusif de `"origine": "prospection"` (400). 404 `prescripteur-inconnu`
(code inconnu ou inactif) ; 409 `déjà-prospectée` (l'organisation est entrée
par prospection : elle n'est pas attribuée), `recommandée-par-elle-même`, et
`hors-prospection` quand `"origine": "prospection"` vise un prescripteur ou
une organisation recommandée.

## Outils stratégiques : les faits étiquetés (26 octobre 2026)

**Entrer dans le pilote, ou en sortir** : `PATCH /api/veille/organisations`
`{ "slug": "infralliance", "action": "outils", "actif": true }`. 200
`pilote-réglé` avec `actif`, 404 `inconnue`. Les lignes d'une organisation
sortie du pilote restent ; elle les retrouve si elle y revient.

**Étape 4ter de la tâche des lettres** (page « Tâche — Lettres de veille »,
depuis le 26 octobre 2026) : après le lint conforme, un `GET` sur la date de
l'édition sert de porte du pilote ; toute réponse autre que `lu` fait passer
l'étape sans rien construire. **Étiquetage après coup** des éditions déjà
publiées : `pnpm tache etiquetage --organisation <slug>` (workflow « Tâches
planifiées », tâche `etiquetage`), qui n'applique que cette étape, sans rien
écrire dans Notion.

Plan : `docs/plan-outils-strategiques.md` (lot 3). La route est réservée aux
organisations du pilote (`organisations.outils_strategiques`) : ailleurs, elle
répond `hors-pilote` en 200, sans aucune lecture Notion, et la tâche passe
l'étape. **Les étiquettes ne bloquent jamais l'envoi d'une lettre** : un échec
se consigne au compte rendu, et la lettre part.

### `POST /api/veille/faits` : poster les étiquettes d'une édition

```
{ "slug": "infralliance", "page": "<page_id de l'édition>", "etiquettes": [
  { "section": "axe", "axe": 4, "rang": 1,
    "titre": "Telehouse a annoncé le 20 octobre 2026 un nouveau module de 3 MW …",
    "date": "2026-10-20", "source": "https://www.telehouse.fr/actualites/…",
    "pestel": "economique", "rupture": true, "impact": "FORT", "nouveaute": "nouveau" },
  { "section": "axe", "axe": 1, "rang": 3, "titre": "CISPE a publié …", "date": "2026-10-20",
    "source": "https://www.cispe.cloud/…", "porter": "rivalite", "entite": "CISPE",
    "ansoff": "penetration", "rupture": false, "impact": "MOYEN", "nouveaute": "nouveau" } ] }
```

Une entrée par fait d'axe non RAS et de « L'actualité des acteurs »
(`section: "acteurs"`, sans `axe`). Un fait commence à sa phrase-titre en gras ;
`rang` compte les faits dans leur axe à partir de 1, et `titre` recopie la
phrase-titre telle qu'écrite (elle est vérifiée puis jetée : Postgres n'en garde
que l'empreinte). Exactement un de `pestel` (`politique`, `economique`,
`socioculturel`, `technologique`, `ecologique`, `legal`) ou `porter`
(`rivalite`, `nouveaux_entrants`, `substituts`, `pouvoir_clients`,
`pouvoir_fournisseurs`) ; `ansoff` (`penetration`, `developpement_produit`,
`developpement_marche`, `diversification`) seulement sous `rivalite` ou
`nouveaux_entrants` avec une `entite` ; `impact` `FORT` ou `MOYEN`, jamais
au-dessus du niveau de l'axe ; `nouveaute` `nouveau` ou `contexte` ; `source`
doit être une URL citée dans le fait ; `date` au plus tard le jour de l'édition.

Ordre des contrôles : organisation et pilote (Postgres), édition (lecture
cachée), relation `Organisation` de l'édition rapportée au registre de
l'organisation (règle 2), corps de la lettre (lecture cachée), porte
(`contrôlerLesÉtiquettes`), écriture. La route **n'expire aucun tag** : elle se
place après le lint (étape 4bis), qui vient de le faire.

| Réponse | Statut | Quoi faire |
|---|---|---|
| `accepté` (`faits`, `insérées`, `archivées`) | 200 | rien ; un nouveau lot de la même édition remplace celui-ci |
| `refusé` (`refus`, `message`) | 422 | corriger chaque point de `message` et renvoyer le lot **complet** ; deux reprises au plus |
| `hors-pilote` | 200 | passer l'étape |
| `organisation-inconnue`, `édition-introuvable` | 404 | vérifier le slug et l'identifiant de page |
| `organisation-différente`, `organisations-multiples` | 409 | anomalie de la relation `Organisation` de l'édition : ne pas réessayer, la signaler |
| `édition-sans-date` | 422 | renseigner « Date d'édition », puis renvoyer |
| `invalide` (`raison` nomme le champ) | 400 | corriger la forme |

Codes de refus de la porte : `section-inconnue`, `doublon`, `fait-introuvable`,
`axe-ras`, `titre-différent`, `étiquette-inconnue`, `cadre-ambigu`,
`ansoff-manquant`, `ansoff-hors-concurrent`, `entité-hors-grille` (une fois la
grille postée), `longueur`, `impact-supérieur-à-l-axe`, `date-invalide`,
`date-future`, `source-absente`, `lot-incomplet`. Un seul refus rejette le lot
entier.

### `GET /api/veille/faits?slug=<slug>&debut=AAAA-MM-JJ&fin=AAAA-MM-JJ` : les faits d'une fenêtre

```
{ "état": "lu", "organisation": "infralliance", "fenêtre": { "début": "2026-10-05", "fin": "2026-11-01" },
  "nombre": 11, "titresIntrouvables": 0, "faits": [
  { "id": "<uuid>", "édition": "<page_id>", "dateÉdition": "2026-10-21", "famille": "ecosysteme",
    "section": "axe", "axe": 4, "rang": 1, "titre": "Telehouse a annoncé …", "date": "2026-10-20",
    "source": "https://…", "pestel": "economique", "porter": null, "ansoff": null, "entite": null,
    "rupture": true, "impact": "FORT", "nouveaute": "nouveau" } ] }
```

Les faits des éditions parues dans la fenêtre, bornes comprises, cent jours au
plus. La phrase-titre est relue dans la lettre, une lecture cachée de corps par
édition ; elle vaut `null` si la lettre a changé depuis l'étiquetage ou ne se lit
plus, et `titresIntrouvables` les compte. L'`id` est celui que la synthèse cite.

## Outils stratégiques : la grille (27 octobre 2026)

La grille d'une organisation du pilote : les deux axes de la carte des groupes
stratégiques, la correspondance de chaque famille du référentiel vers une
lettre PESTEL ou une force de Porter, les entités suivies et les parties
prenantes. Elle est rédigée dans le référentiel (section « Grille
stratégique », non numérotée, après le §2), où restent les critères complets
des crans ; le portail n'en garde que les libellés courts (exception bornée de
`CLAUDE.md`, décision 2 du plan) et l'identifiant de la page. Plan :
`docs/plan-outils-strategiques.md`, lot 5. Hors du pilote, les trois méthodes
répondent `hors-pilote` en 200.

**Une fois une grille postée, la porte des étiquettes refuse une entité qui
n'y figure pas** (`entité-hors-grille`) : la grille doit nommer toutes les
entités que les lettres suivent, sans quoi l'étape 4ter échouera.

### `POST /api/veille/grille` : poster la grille

```
{ "slug": "infralliance", "referentiel": "<page_id du référentiel>", "grille": {
  "axes": [
    { "cle": "couches", "libelle": "Couches couvertes", "crans": ["usage seul", "cloud", "cloud et datacenter", "trois couches"] },
    { "cle": "production", "libelle": "Production publique", "crans": ["aucune", "occasionnelle", "régulière"] } ],
  "familles": [
    { "numero": 1, "veille": "ecosysteme", "pestel": "legal", "cadence": "hebdomadaire" },
    { "numero": 1, "veille": "concurrentiel", "porter": "rivalite", "cadence": "hebdomadaire" } ],
  "entites": [ { "nom": "Cigref", "veille": "concurrentiel", "siren": "310785985" } ],
  "partiesPrenantes": [ { "nom": "DGE" }, … ],
  "offres": null } }
```

Exactement deux axes, clé en minuscules (`[a-z][a-z0-9_]*`), 3 à 5 crans ;
libellés de 40 caractères au plus, sans « faible » ni « fort » (réservés à
l'impact) ; chaque famille (`veille` `ecosysteme` ou `concurrentiel`) avec un
seul de `pestel` ou `porter` et une `cadence` (`hebdomadaire`, `mensuelle`) ;
40 entités au plus par veille, `siren` à neuf chiffres ou `null` ; 8 à 15
parties prenantes, 80 caractères au plus ; `offres` seulement si la fiche porte
plusieurs offres (matrice GE, lot 13).

Ordre des contrôles : organisation et pilote (Postgres), porte
(`contrôlerLaGrille`), écriture. Le référentiel n'est pas lu.

| Réponse | Statut | Quoi faire |
|---|---|---|
| `créée` (`version`, `empreinte`, `trousDuPestel`, `forcesNonSuivies`) | 201 | créer les points de validation des axes de cette version |
| `inchangée` (mêmes champs) | 200 | rien : même empreinte que la dernière version, aucune version créée (l'ordre des familles, entités et parties prenantes ne compte pas) |
| `refusée` (`refus`, `message`) | 422 | corriger chaque point de `message` et renvoyer la grille **complète** ; deux reprises au plus |
| `hors-pilote` | 200 | passer l'étape |
| `organisation-inconnue` | 404 | vérifier le slug |
| `invalide` (`raison` nomme le champ) | 400 | corriger la forme |

Codes de refus de la porte : `axes-hors-bornes`, `clé-invalide`,
`libellé-hors-bornes`, `vocabulaire-interdit`, `crans-hors-bornes`,
`veille-inconnue`, `doublon`, `famille-sans-cadre`, `étiquette-inconnue`,
`cadence-inconnue`, `familles-absentes`, `entités-hors-plafond`, `longueur`,
`siren-invalide`, `parties-prenantes-hors-bornes`.

Une nouvelle version n'hérite pas de la validation de la précédente : ses axes
ont pu changer. La revue re-poste la grille au début de sa section « Synthèse
stratégique » ; si l'empreinte est la même, rien ne change.

### `GET /api/veille/grille?slug=<slug>` : la dernière version

`{ "état": "lue", "organisation", "version", "empreinte", "referentiel",
"validéeLe", "grille": { … mêmes noms que le POST … }, "trousDuPestel",
"forcesNonSuivies" }`. `trousDuPestel` liste les lettres PESTEL qu'aucune
famille ne couvre, `forcesNonSuivies` les forces qu'aucune ne porte (« non
suivi » dans la lecture des cinq forces). `aucune` (200) tant qu'aucune grille
n'est postée.

### `PATCH /api/veille/grille` : valider la dernière version

`{ "slug": "infralliance", "version": 2 }`, une fois répondus les points de
validation de ses axes. 200 `validée` ou `déjà-validée` ; 409
`version-dépassée` (une version plus récente a été postée : ses axes sont ceux
que la synthèse lira) ; 404 `aucune` ou `organisation-inconnue` ; 200
`hors-pilote`.

## Outils stratégiques : la synthèse mensuelle (27 octobre 2026)

La synthèse d'une période, bâtie sur les faits étiquetés de la fenêtre et sur la
grille en vigueur : PESTEL, SWOT, TOWS, positions sur la carte des groupes
stratégiques et sur la matrice de Mendelow. Postée par la revue mensuelle
(page « Tâche — Revue mensuelle des référentiels », section « SYNTHÈSE
STRATÉGIQUE », entre l'étape 2 et l'étape 3), relue par l'opératrice dans le
courriel « [Relecture] » ; **rien n'est montré au client pendant le pilote**.
Postgres garde les énoncés (240 caractères au plus, exception bornée de
`CLAUDE.md`) et les crans, jamais un texte de lettre. Plan :
`docs/plan-outils-strategiques.md`, lot 6. Depuis le 28 octobre 2026, la même
route porte le **trimestriel** (lots 7 et 8 : cinq forces, scénarios,
interprétations de l'indice de cycle de vie et du benchmark, chiffres calculés
par le portail), la **matrice GE** annuelle (lot 13) et la **publication** vers
l'espace client (lot 11, `PATCH`).

### `POST /api/veille/syntheses` : poster la synthèse d'une période

```
{ "slug": "infralliance", "periode": "2026-11", "fenetre": { "debut": "2026-11-04", "fin": "2026-12-01" },
  "synthese": { "mode": "mensuel", "grilleVersion": 1,
    "pestel": [{ "lettre": "legal", "enonce": "…", "faits": ["<id>"] }, { "lettre": "socioculturel", "enonce": null, "faits": [] }, …],
    "swot": [{ "id": "T1", "case": "menaces", "enonce": "…", "etat": "renforce", "origine": "faits",
               "hypothese": false, "filiation": "<id de l'élément du mois précédent>", "faits": ["<id>"] },
             { "id": "S1", "case": "forces", "enonce": "…", "etat": "nouveau", "origine": "declaratif",
               "hypothese": true, "faits": [], "referenceFiche": "fiche v2.2, §3" }, …],
    "casesInsuffisantes": ["opportunites"],
    "tows": [{ "type": "ST", "enonce": "…", "elements": ["S1", "T1"], "candidate": true }, …],
    "positions": [{ "outil": "groupes", "sujet": "CISPE", "axe": "couches", "cran": 3, "faits": ["<id>"] },
                  { "outil": "mendelow", "sujet": "DGE", "axe": "pouvoir", "cran": 3, "faits": ["<id>"] }, …] } }
```

`periode` : `AAAA-MM`, ou `AAAA-Tn` avec le mode `trimestriel` et lui seul. La
fenêtre va de première parution à première parution, cent jours au plus, dates
du calendrier. Les faits se citent par l'`id` que rend `GET /api/veille/faits`.
Les six lettres PESTEL, toujours ; un trou du PESTEL (aucune famille ne le
couvre) porte `enonce: null` et aucun fait. Trois à cinq éléments par case
SWOT, ou moins pour une case déclarée dans `casesInsuffisantes`. Un élément
`renforce`, `inchange` ou `affaibli` désigne par `filiation` l'élément de la
période précédente de même granularité qu'il prolonge, dans la même case ; un
élément déclaratif n'est qu'une force ou une faiblesse, marquée hypothèse, avec
la section de la fiche. Deux à quatre options TOWS, chacune croisant un élément
interne et un externe, **une seule candidate**. Une position cite au moins un
fait ; un cran qui bouge cite un fait de la fenêtre, qui nomme l'entité pour la
carte des groupes. Crans de Mendelow : 1 `bas`, 2 `intermediaire`, 3 `eleve`.

**Au trimestre** (`periode` `AAAA-Tn`, `mode: "trimestriel"`), la synthèse
porte en plus : les cinq forces, toutes (`outil: "forces"`, `sujet` parmi
`rivalite`, `nouveaux_entrants`, `substituts`, `pouvoir_clients`,
`pouvoir_fournisseurs`, `axe: "intensite"`, crans 1 `contenue`, 2 `marquee`,
3 `intense`, `tendance` `hausse`, `stable` ou `baisse` ; une force qu'aucune
famille ne porte est `nonSuivi: true`, cran nul, sans fait ni tendance) ; trois
`scenarios` `{ titre, enonce (400 caractères au plus), indicateurs: 2 à 4
{ famille, signal }, faits }` ; deux `interpretations` au plus
`{ outil: "indice_cycle" | "benchmark", enonce }`. Le corps peut porter
`"cycle": { "departements": ["06", "34"], "texte": "formation commerciale" }`
(1 à 12 départements, deux chiffres, 2A, 2B ou 97x ; texte de 3 à 80
caractères) : le portail calcule alors l'indice de cycle de vie **après** la
porte, et le benchmark dans tous les cas, en vingt secondes au plus (ce qui ne
répond pas vaut n.d.) ; les chiffres sont gardés dans `valeur`, à côté des
interprétations, jamais fournis par le modèle. Une synthèse refusée ne
déclenche aucun appel aux registres.

**Matrice GE**, une fois l'an : seulement pour une période `AAAA-T4` (revue de
janvier) et seulement si la grille porte au moins deux `offres`. Pour chaque
offre de la grille, deux positions `outil: "ge"`, `sujet` = nom exact de
l'offre, axes `attractivite` et `atouts`, crans 1 `bas`, 2 `intermediaire`,
3 `eleve` ; toutes les offres ou aucune.

Ordre des contrôles : organisation et pilote, grille (`grille-absente` sinon),
faits cités et synthèse précédente, porte (`contrôlerLaSynthèse`), écriture.
La route ne lit pas Notion et **n'expire aucun tag**.

| Réponse | Statut | Quoi faire |
|---|---|---|
| `enregistrée` (`éléments`, `positions`, `archivés`, `avertissements`) | 201 | relire les avertissements ; une synthèse de la même période postée plus tard remplace celle-ci |
| `refusée` (`refus`, `message`, `avertissements`) | 422 | corriger chaque point de `message` et renvoyer la synthèse **complète** ; deux reprises au plus |
| `hors-pilote` | 200 | passer la section |
| `grille-absente`, `grille-périmée` | 409 | poster la grille, ou relire sa version |
| `organisation-inconnue` | 404 | vérifier le slug |
| `invalide` (`raison`) | 400 | corriger la forme, la fenêtre ou l'accord du mode et de la période |

Codes de refus de la porte : `pestel-incomplet`, `trou-avec-faits`,
`sans-fait`, `fait-inconnu`, `fait-hors-fenêtre`, `case-hors-bornes`,
`état-inconnu`, `état-incohérent`, `filiation-inconnue`,
`filiation-incohérente`, `déclaratif-hors-forces-faiblesses`,
`hypothèse-non-marquée`, `sans-référence`, `tows-hors-bornes`,
`tows-sans-croisement`, `candidate-unique`, `élément-inconnu`,
`position-hors-grille`, `cran-hors-bornes`, `mouvement-sans-fait`,
`hors-période`, `grille-périmée`, `vocabulaire-interdit`, `longueur`,
`doublon`, `étiquette-inconnue` ; au trimestre `forces-incomplètes`,
`tendance-manquante`, `non-suivi-manquant`, `non-suivi-injustifié`,
`scénarios-hors-bornes`, `indicateurs-hors-bornes`, `famille-inconnue`, et
pour `cycle` `départements-hors-bornes`, `département-invalide`,
`texte-hors-bornes` ; pour la matrice GE `ge-incomplète`, `ge-sans-offres`. En
avertissement seulement : `spécificité` (ni nom de la grille, ni chiffre, ni
date) et `ge-absente` (revue annuelle, deux offres ou plus, pas de matrice).

### `GET /api/veille/syntheses?slug=<slug>&periode=AAAA-MM` : la synthèse d'une période

`{ "état": "lue", "organisation", "période", "fenêtre", "grilleVersion",
"éléments", "positions", "texte", "swot", "crans" }`. `texte` est la synthèse
rendue pour le courriel « [Relecture] », à recopier telle quelle ; `swot` donne
les éléments par leur `id` (que la `filiation` du mois suivant désigne) et
`crans` les positions posées. `aucune` (200) si rien n'est enregistré pour la
période.

### `PATCH /api/veille/syntheses` : publier ou retirer une période (lot 11, 28 octobre 2026)

`{ "slug": "mastora", "periode": "2026-11", "etat": "publie" }`, `etat` parmi
`publie`, `retire` et `propose`. Change l'état de publication de **tous** les
éléments et positions non archivés de la période, dans une transaction. C'est
le geste de l'opératrice après relecture : rien ne s'affiche dans l'espace
client tant qu'une période n'est pas `publie`, et l'écran ne montre que la
dernière période entièrement publiée (mois sur « Acteurs » et
« Recommandations », trimestre en dessous). Réponses : `publiée`, `retirée` ou
`proposée` (200, avec `éléments` et `positions`), `hors-pilote` (200),
`aucune` et `organisation-inconnue` (404), `invalide` (400). N'expire aucun
tag : les écrans relisent Postgres à chaque requête, bornés à 400 ms.

### `GET /api/veille/calculs?slug&fin&departements&texte` : les chiffres du trimestre (lot 7, 28 octobre 2026)

Les chiffres que la revue lit **avant** d'écrire ses deux interprétations ;
n'écrit rien. `fin` en `AAAA-MM-JJ` ; `departements` (séparés par des
virgules) et `texte` vont ensemble, ou sont omis tous deux (benchmark seul).
`calculé` (200) rend `indice` (au BODACC, créations et immatriculations contre
procédures collectives sur les douze mois qui finissent à `fin` et les douze
précédents : entrées, sorties, solde, ratio, évolutions, limites) et
`benchmark` (fiches de la Recherche d'entreprises des entités de la grille qui
portent un SIREN, l'organisation en tête, quinze au plus : chiffre d'affaires,
résultat, tranche d'effectif, médiane, rang de l'organisation, limites).
Autres réponses : `hors-pilote` (200), `organisation-inconnue` (404),
`grille-absente` (409), `refusée` (422, paramètres du cycle), `invalide` (400),
`erreur` (502).

## La file de travaux (palier 2, 21 octobre 2026)

Le palier 2 de la décision du 15 octobre (`docs/decision-portail-moteur.md`,
point 4) : le portail **décide** ce qu'il y a à faire, l'exécuteur prend,
rédige et poste. Le modèle ne calcule plus de date, ne compte plus de numéro,
ne décide plus d'un statut. Tables `travaux` et `runs` (migration 0009),
écrites par la seule orchestration `lib/portail/file.ts` ;
`tests/architecture.test.ts` le vérifie.

Deux exécuteurs, le temps de la transition (décision du 22 octobre 2026,
`docs/programme-lettre-unique.md`) :

- **le moteur en code, par Trigger.dev** : `vider-la-file` prend les travaux
  prenables toutes les heures ouvrées, `produire-la-lettre` lit le dossier du
  travail (`GET /api/veille/dossier?travail=`), produit et remet sa lettre
  Markdown à `POST /api/veille/editions` avec `travail` et `session` ; c'est la
  route `editions` qui conclut le travail. C'est le chemin de toute
  organisation dont le référentiel unique est actif et la veille `unique`
  déclarée ;
- **la tâche Cowork « Runs de veille »**, pour les clients encore sur deux
  lettres Notion : elle prend de la même file et poste une page Notion sur
  `POST /api/veille/resultat`. Ce chemin s'éteint avec la bascule
  `SOURCE_DOCUMENTS=payload`.

La table Drizzle `runs` est le **seul** journal des deux chemins. Les lettres
de filière ne passent pas par la file (tâche planifiée `lettres-de-filiere`).

### `POST /api/veille/veilles` — déclarer les veilles d'une organisation

Ce que la file a besoin de savoir pour planifier, et qui vivait dans le registre
Notion : `{ "slug", "type": "ecosysteme" | "concurrentielle", "libellé",
"jourParution": 1..7, "heureParution": "HH:MM", "cadence": "hebdomadaire" |
"bimensuelle" | "mensuelle", "referentielNotion"?, "numéroCourant"?, "état"? }`.
201 `déclarée`, 200 `mise-à-jour` (rejouable : même organisation, même type),
404 `organisation-inconnue`. `numéroCourant` est le dernier numéro attribué :
le lire **une fois** sur `GET /api/veille/contexte` (`dernierNuméro` de la
famille) à la déclaration ; ensuite le portail le tient seul. `GET
/api/veille/veilles?slug=` liste les veilles déclarées. À déclarer à
l'activation d'une organisation, et une fois pour chaque client historique.

### `GET /api/veille/travaux` — l'état de la file

Comptes par état (`a_faire`, `pris`, `accepte`, `refuse`, `abandonne`) et la
liste des travaux ouverts, plus les abandonnés des quatorze derniers jours.
`?planifier=1` (ou l'en-tête du cron Vercel) planifie d'abord la semaine qui
vient : un travail `lettre` par parution des veilles actives des organisations
en essai ou abonnées, une fois (index `travaux_ouvert_unique` : un seul travail
ouvert par veille et par type). **La planification est faite chaque matin par
`GET /api/veille/parcours`**, le passage quotidien, qui la rend dans `file`.
L'échéance d'un travail est la parution **à son heure de Paris**
(`heureParution` de la veille) : avant, il est visible dans la file mais pas
prenable.

### `POST /api/veille/travaux` — prendre, ou poser

- `{ "action": "prendre", "session": "<identifiant de la session>" }` : 200
  `pris` avec `travail` (identifiant, type, tentative, échéance, `contexte` :
  organisation, veille, **numéro à porter**, parution, prompt à appliquer) et
  `notion` (ce que `GET /api/veille/contexte` dit de la famille : dernier
  numéro, dernières éditions, dossiers ouverts ; `null` pour une veille
  `unique`, qui n'a pas de famille), ou 200 `vide`. La file donne
  le plus ancien travail dont l'échéance est passée ; le travail est réservé à
  la session, qui seule pourra poster son résultat. Un travail pris et jamais
  conclu revient dans la file après trois heures, et il est abandonné à la
  troisième tentative.
- `{ "action": "prendre", "session", "travail": "<uuid>" }` : prend **ce**
  travail, échéance ou non, s'il est `a_faire` ou `refuse` ; 409 `non-prenable`
  sinon. C'est le chemin de l'onboarding et de l'édition de découverte, qui
  posent un travail `premiere_lettre` pour aujourd'hui et le produisent dans le
  même run.
- `{ "action": "poser", "slug", "veille", "type": "lettre" | "premiere_lettre",
  "parution": "AAAA-MM-JJ" }` : un travail posé à la main, pour une première
  lettre ou une parution à rattraper. 201 `créé`, 200 `déjà-en-file`, 404
  `organisation-inconnue` | `veille-inconnue`.

### `POST /api/veille/resultat` — poster le résultat d'un travail

`{ "travail", "session", "page", "exécuteur"?, "début"?, "fin"?, "résultat"?,
"coût"? }`. Le résultat d'une lettre est **la page Notion en Brouillon** que
l'exécuteur a écrite, avec le numéro du contexte ; le portail expire son tag,
la relit, et la passe par les portes de `/api/veille/lint` **plus trois que le
lint ne peut pas connaître** : la page porte la ligne du registre de
l'organisation du travail (`organisation-différente`, règle 2), la famille
attendue (`famille-différente`) et le numéro attribué (`numéro-différent`) ;
`page-introuvable` pour une page absente ou à la corbeille.

- 200 `accepté` : le run est journalisé, le travail conclu, et
  `veilles.numéro_courant` prend le numéro, dans la même transaction. La page
  reste en Brouillon : la publication (statut `Envoyé`) et l'envoi suivent le
  chemin d'aujourd'hui tant que le palier 1b (envoi par le portail) n'est pas
  livré ;
- 200 `refusé` : `portes`, `ruptures`, `avertissements`, `aperçu` et
  `tentatives` ; le travail redevient prenable, la session reprend (nouvelle
  prise, correction de la **même** page, nouveau résultat) ;
- 200 `abandonné` : troisième refus ; l'opératrice le voit dans
  `GET /api/veille/travaux` ;
- 404 `inconnu`, 409 `pas-pris` (`étatDuTravail`), 409 `autre-session`.

Pour un travail d'un autre type (`referentiel`, `revue`), la route refuse
`type-non-pris-en-charge` : ces types attendent leur porte.

### `POST /api/veille/editions` avec `travail` et `session` — le résultat Markdown du moteur

Le second parseur que la file ne voulait pas écrire existe depuis le
22 octobre 2026 (`markdownVersBlocs`, celui des écrans en mode Payload et du
validateur) : la remise d'une édition par une tâche Trigger.dev
(`RemiseDÉdition`, `lib/moteur/remise.ts`) porte `travail` et `session`, et la
route conclut le travail **avant** d'écrire quoi que ce soit
(`recevoirUneÉdition`, `lib/portail/file.ts`) :

- portes du portail : `organisation-différente` (la clé de cloisonnement de
  l'organisation du travail est l'identifiant Payload sans tirets, règle 2),
  `numéro-différent`, `type-non-pris-en-charge` ; puis le lint en forme unique ;
  puis le verdict du moteur (`acceptee`) : le portail ne publie jamais ce que le
  moteur a refusé ;
- 200 `{ edition, statut: "publiee", travail: "accepte", courriers }` :
  édition écrite dans Payload, gel remplacé, `numéro_courant` écrit dans la
  même transaction que la conclusion, courriers partis aux lecteurs actifs ;
- 200 `{ état: "refuse" | "abandonne", tentatives, portes }` : **rien n'est
  écrit**, le travail redevient prenable (ou est abandonné) ;
- 404 `inconnu`, 409 `pas-pris` | `autre-session` ; 400 si `travail` vient sans
  `session`, ou avec une `filiere`.

Sans `travail`, la route garde son chemin hors file (lettres de filière) :
revalidation en forme unique, publiée ou brouillon, courriers aux prospects.
`GET /api/veille/dossier?travail=<uuid>` donne à la tâche le dossier du travail
pris : organisation par sa clé de cloisonnement, numéro et date de parution
décidés par la file, mode déduit du type (`premiere_lettre` → `onboarding`,
`lettre` → `parution`, `&mode=decouverte` pour la découverte).

### Depuis la tâche « Runs de veille »

```
# prendre
curl -s -X POST https://www.signauxfaibles.io/api/veille/travaux \
  -H 'content-type: application/json' -d '{"action":"prendre","session":"<session>"}'
# … rédiger la page Notion en Brouillon, avec contexte.numéro …
# poster
curl -s -X POST https://www.signauxfaibles.io/api/veille/resultat \
  -H 'content-type: application/json' \
  -d '{"travail":"<uuid>","session":"<session>","page":"<page_id>","exécuteur":"cowork:<session>"}'
```

Boucler tant que `prendre` ne rend pas `vide`, et tant qu'un résultat est
`refusé`, corriger la page puis reposter. Rien d'autre à calculer : le jeton
est posé par le secret réseau de l'environnement, comme pour les autres routes.
