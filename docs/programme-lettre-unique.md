# Programme du 22 octobre 2026 : lettre unique, moteur en code, Payload et Trigger.dev, quatre paliers commerciaux

*Décision de la propriétaire du 22 octobre 2026, après l'analyse des stacks
(`docs/analyse-stacks-alternatives.md`) et la première série d'évaluation
(`docs/evaluation-modeles.md`). Ce document est le contrat des quatre chantiers
ouverts sur la branche `claude/lettre-unique-payload-trigger`. Il décrit la
cible, l'état livré et ce qui reste à faire hors du dépôt. Il prime sur les
paragraphes de `CLAUDE.md` qu'il contredit, lesquels décrivent le dispositif en
service jusqu'à la bascule.*

## 1. Les quatre décisions

1. **Une seule lettre par organisation et par parution**, qui intègre les
   données Écosystème et Concurrence : dix à quinze axes, chacun étant un thème
   de l'écosystème (réglementation, marché, financement, technologie,
   territoire, etc.) ou un sujet d'offre commerciale (prix, formules,
   positionnement). Un axe est une thématique, jamais une organisation ; les
   organisations se suivent dans les dossiers (décision du 22 octobre 2026, voir
   le §2). Très synthétique,
   couvrant le spectre au maximum, sans manquer une information essentielle,
   lisible en cinq minutes et très fiable. La propriété `Famille` et la double
   numérotation disparaissent ; une organisation a un référentiel et une suite
   d'éditions.
2. **Maximisation du non-recours à l'agent.** Tout ce qui peut être fait en code
   l'est : sélection du jour, numérotation, ouverture des sources, détection de
   ce qui a changé, extraction des dates et des passages nouveaux, mesure de la
   couverture, comptage des faits, validation de forme, publication, envoi. Le
   modèle n'intervient qu'une fois par lettre, pour rédiger à partir d'extraits
   que le code a réunis, par une sortie structurée que le code transforme en
   lettre. Pas d'agent qui cherche, pas de sous-agent, pas de boucle d'outils.
3. **Aucune validation humaine dans le processus.** Les portes sont mécaniques
   (contrat de forme, couverture des sources, faits datés, citations ouvertes,
   vocabulaire) ; une lettre qui ne les franchit pas est reprise par le code
   avec un message de correction précis, deux fois au plus, puis publiée telle
   quelle avec un signalement à l'opératrice. La relecture existe toujours,
   mais après coup et hors du chemin critique.
4. **Payload CMS 3 dans le Next.js existant, Trigger.dev pour les runs**, Notion
   retiré à terme. Payload tient le registre et les documents (organisations,
   filières, référentiels, éditions, prospects, journal des runs) dans un
   schéma Postgres à part ; Trigger.dev exécute la collecte, la rédaction et les
   portes dans des tâches durables, puis remet le résultat au portail par les
   routes `/api/veille/*`. Le portail reste le seul écrivain de sa base.
5. **Un dispositif commercial en quatre paliers**, du moins cher au plus cher,
   chacun déclenché par un geste du prospect : la lettre de filière avec un
   bloc personnalisé (lettre 1 de la séquence), l'édition de découverte à la
   première visite, l'onboarding complet à l'entrée en essai.

## 2. Le contrat de la lettre unique

La lettre reste un document Markdown converti en blocs (`lib/domaine/markdown.ts`),
lu par le même parseur que les lettres actuelles (`construireDocument`), pour que
les sept écrans de l'espace client ne changent pas. Ce qui change est la forme
exigée, vérifiée par `contrôlerLaLettre({ forme: 'unique' })`.

| Élément | Règle | Code du validateur |
|---|---|---|
| Titre | non vide, fixé par le code : « Veille <organisation>, édition n° N du <date> » | `titre-vide` |
| « L'essentiel » | titre H1, huit lignes au plus, 140 caractères par ligne ; chaque ligne se lit seule | `essentiel-absent`, `essentiel-trop-long`, `essentiel-ligne-longue` |
| « Actualités par axe » | titre H1, suivi des axes | `axes-hors-rubrique` |
| Axes | **dix à quinze** titres H2 « ① Nom — FORT / MOYEN / RAS », numérotés dans l'ordre du référentiel unique ; trois niveaux et trois seulement | `axes-trop-peu`, `axes-trop-nombreux`, `axe-sans-niveau`, `niveau-faible` |
| Corps d'un axe FORT ou MOYEN | **deux faits**, ni un ni trois, un paragraphe par fait, **deux phrases au plus et 220 caractères au plus** par fait (l'information seule, sans commentaire), chaque fait daté et suivi de sa ou de ses sources entre parenthèses (un ou deux liens vers des URL ouvertes pendant le run) | `fait-trop-long`, `axe-peu-fourni`, `axe-trop-fourni`, `fait-sans-date`, `fait-sans-source` |
| Corps d'un axe RAS | un seul encadré qui dit « RAS » et rien d'autre : aucune phrase sur ce qui a été vérifié | `ras-trop-long`, `absence-en-prose` (rupture en forme unique) |
| Axes et acteurs | un axe est une thématique, un acteur est une organisation et ne se suit que dans « Dossiers suivis » ; un axe qui porte le nom d'un dossier est refusé | `axe-est-un-acteur` |
| Recommandations de contenu | aucune rubrique d'idées ou de recommandations de posts | `recommandation-de-post` |
| « Dossiers suivis » | titre H1 du pied, un paragraphe par dossier ouvert, qui le nomme exactement comme la propriété ; la propriété `Dossiers ouverts suivis` garde le format `nom (compteur, précision)` | `dossier-sans-compteur`, `dossier-non-nommé` |
| Sources non consultées | seule trace de la collecte admise : une rubrique H1 « Sources non consultées », **une liste de liens et rien d'autre**, écrite par le code d'après les lectures qui n'ont pas abouti (jamais par le modèle) ; une phrase ou une puce qui ajoute du texte au lien la fait refuser | `collecte-dans-la-lettre` |
| Ce qui n'y figure jamais | rapport de collecte, note de méthode, sources non ouvertes, requêtes non lancées, réserves, ajustements du cadrage, références internes au référentiel | `collecte-dans-la-lettre` et `cadrage-présent` (ruptures en forme unique), `référence-interne` |
| Longueur | 1 400 mots au plus, lettre entière | `lettre-trop-longue` |

Les trois niveaux d'impact, la pastille de fraîcheur, les mentions d'acteurs et
le regroupement par semaine restent ce qu'ils sont. Une édition unique porte
`Veille = « Veille »` ; le portail n'a jamais raisonné sur ce libellé.

**Le référentiel unique** fusionne les deux référentiels d'une organisation :
une fiche courte, la liste ordonnée des dix à quinze axes avec pour chacun ses
sources nommées (URL), ses requêtes types, ses acteurs suivis et ses critères
d'impact, puis les dossiers ouverts. Le §6 n'existe plus : la richesse est fixée
par le contrat ci-dessus, pas par le référentiel. Pour les organisations
existantes, `lib/moteur/referentiel.ts` dérive ce référentiel unique des deux
référentiels Notion exportés (les axes de l'écosystème puis les types de
concurrents) ; pour une nouvelle organisation, il est produit à l'onboarding.

## 3. Le moteur en code (`lib/moteur/`)

Une parution est une fonction, `produireLaLettre`, qui enchaîne cinq étapes et
n'appelle le modèle qu'à la troisième.

1. **Sélection** (`selection.ts`) : l'organisation, son référentiel, le numéro
   suivant, la période (du lendemain de l'édition précédente à la veille de la
   date d'édition, sept jours au moins, quatorze au plus), les dossiers ouverts
   de l'édition précédente avec leurs compteurs. Tout vient de la base, rien du
   modèle.
2. **Collecte** (`collecte.ts`) : chaque source nommée du référentiel est ouverte
   par le code (HTTP, puis navigateur Chromium pour celles qui répondent 403,
   503 ou vide), le texte utile est extrait, l'empreinte comparée au gel
   précédent ; les passages nouveaux sont isolés par différence de phrases, les
   dates reconnues, les URL d'articles relevées. Les requêtes types du
   référentiel sont lancées par l'outil de recherche côté API dans un appel
   séparé, court, qui ne rédige rien. Le résultat est un dossier de collecte :
   par axe, les extraits nouveaux, les extraits inchangés, les sources fermées
   avec leur raison.
3. **Rédaction** (`redaction.ts`) : un appel à Opus 5.5 avec une sortie
   structurée (schéma JSON : essentiel, axes avec niveau et faits datés et
   sourcés, dossiers suivis, action de la semaine), prompt système en cache une
   heure, effort élevé, aucun outil. Le modèle ne peut citer qu'une URL présente
   dans le dossier de collecte : le schéma le dit, et la porte le vérifie.
4. **Portes** (`portes.ts`) : la sortie est assemblée en Markdown
   (`assemblage.ts`), convertie en blocs, passée au validateur en forme unique ;
   s'y ajoutent la couverture des sources nommées (ouvertes par le code, donc
   connue avant même la rédaction), les citations (toute URL de la lettre est
   dans le dossier), les dates (tout fait porte une date dans la période ou
   marquée « contexte »), le vocabulaire interdit. Un manquement produit un
   message de correction précis renvoyé au modèle, dans la même conversation,
   deux fois au plus.
5. **Remise** : le résultat (Markdown, blocs, propriétés, grille, mesures, coût)
   est remis au portail par `POST /api/veille/editions`, qui revalide, écrit
   l'édition dans Payload, journalise le run et déclenche les courriers. Le
   moteur n'écrit jamais lui-même dans la base.

Le script d'évaluation garde ses conceptions de mesure et gagne la conception
`unique`, qui est le moteur lui-même appliqué aux exports Notion : c'est ainsi
que la lettre unique de Konica et d'Infralliance se mesure avant la bascule.

Coût visé par lettre : la collecte en code ne coûte rien ; l'appel de recherche
des requêtes types 0,3 à 0,8 $ ; la rédaction 0,8 à 1,5 $ (60 000 à 100 000
jetons d'extraits en entrée, 6 000 en sortie) ; une reprise 0,5 $. Soit **1,5 à
3 $ par lettre unique**, 13 à 26 $ par organisation et par mois, contre 52 à
87 $ pour deux lettres agentiques.

## 4. Payload et Trigger.dev

### Payload

- `payload.config.ts` à la racine, adaptateur Postgres sur la même base Neon,
  **schéma `payload`** à part et `push` désactivé : les tables du portail
  (`lib/base/schema.ts`, migrations `drizzle/`) ne sont jamais touchées par
  Payload, et les migrations Payload (`payload-migrations/`) sont relues et
  commitées comme les autres. `PAYLOAD_SECRET` dans l'environnement.
- Collections : `utilisateurs` (l'opératrice, authentification Payload),
  `organisations` (le registre : nom, slug, site, filière, contact, état
  d'onboarding), `filieres`, `referentiels` (Markdown, version, organisation ou
  filière), `editions` (Markdown, blocs dérivés en `beforeChange` par
  `markdownVersBlocs`, propriétés, statut `brouillon`, `publiee`, `retiree`,
  organisation ou filière, numéro, date d'édition), `prospects` (organisation
  prospectée, filière, contact, statut), `runs` (journal : type, organisation,
  tâche Trigger.dev, portes, coût, accepté).
- Le portail lit les documents par une façade, `lib/documents/`, aiguillée par
  `SOURCE_DOCUMENTS` : `notion` (défaut, comportement actuel), `payload`
  (bascule). La clé de cloisonnement est `organisations.registre` : aujourd'hui
  l'identifiant de la ligne du registre Notion, demain l'identifiant Payload de
  l'organisation, que portent les éditions. Même règle 2, même filtre porté par
  la requête, mêmes tags de cache ; l'invalidation se fait par le crochet
  `afterChange` des éditions au lieu du webhook Notion.
- Un crochet `afterChange` sur `organisations` qui passe à l'état « à
  onboarder » déclenche la tâche Trigger.dev d'onboarding ; un crochet sur
  `prospects` déclenche le bloc personnalisé. Payload ne porte jamais un run
  long.
- L'admin est sous `/admin`, hors des sept écrans et hors du cloisonnement
  client : il est réservé aux utilisateurs Payload.

### Trigger.dev

- `trigger.config.ts` (projet `signaux-faibles`, Node 22, extension Playwright
  pour le navigateur de collecte), tâches dans `trigger/` :
  `vider-la-file` (planifiée, toutes les heures ouvrées Europe/Paris : prend
  les travaux prenables de la file du portail et confie chacun à
  `produire-la-lettre`), `produire-la-lettre` (le dossier du travail, le
  moteur, puis la remise au portail avec `travail` et `session`), `onboarding`
  (fiche, référentiel unique, travail `premiere_lettre` posé et pris, lettre,
  remise, puis ouverture de l'espace par `/api/acces/ouvrir` selon la règle du
  20 octobre), `lettres-de-filiere` (planifiée, le lundi 6 h : une
  `produire-la-lettre-de-filiere` par filière active, hors file),
  `bloc-personnalise` (un prospect), `edition-de-decouverte` (déclenchée par la
  première visite, même chemin que l'onboarding par la file).
- **La file de travaux du portail est le seul point de décision des lettres
  d'organisation** (décision du 22 octobre 2026, après examen de la branche
  `claude/sharp-fermat-lafthr`) : quelle lettre, quel numéro, quelle parution.
  Trigger.dev est un exécuteur ; la tâche Cowork « Runs de veille » en est un
  autre, pour les clients encore sur deux lettres Notion, jusqu'à la bascule.
  La table Drizzle `runs` est le seul journal : la collection Payload `runs` a
  été retirée. Les lettres de filière restent hors de la file ; les y faire
  entrer (option C de l'examen) est la cible quand les filières dépasseront
  cinq ou que Cowork sera retiré. L'opératrice suit la file sur `/espaces/file`.
- Les tâches lisent ce dont elles ont besoin par `GET /api/veille/dossier`
  (jeton `ACTIVATION_SECRET`) et remettent leurs résultats par
  `POST /api/veille/editions` et `POST /api/veille/referentiels`. Elles n'ont ni
  `DATABASE_URL`, ni le secret Payload, ni le secret HMAC : seulement le jeton
  d'activation et `ANTHROPIC_API_KEY` de production.
- Le portail déclenche une tâche par `tasks.trigger` avec `TRIGGER_SECRET_KEY`
  (`lib/moteur/declencher.ts`, seul endroit) ; sans la clé, rien ne part et le
  contrôle du soir le signale.

### Ce qui reste de Notion

Jusqu'à la bascule `SOURCE_DOCUMENTS=payload`, Notion reste lu par les écrans.
L'import de l'archive (éditions publiées, référentiels) vers Payload est un
script `pnpm documents:importer` à écrire à la bascule, à partir des exports déjà
faits pour l'évaluation. Les tâches Cowork de génération s'arrêtent le jour où
`parution-hebdomadaire` tourne.

## 5. Les quatre paliers commerciaux

| Palier | Déclencheur | Ce qui est produit | Coût | Automatisation |
|---|---|---|---|---|
| 1. Lettre de filière | aucun : c'est la lettre 1 de la séquence de prospection | la lettre unique de la filière (référentiel de filière), avec un bloc « pour <organisation> » de quatre à huit lignes par prospect | moins de 1 $ par prospect (lettre partagée, bloc 0,5 à 1,5 $) | `lettre-de-filiere` planifiée, `bloc-personnalise` au moment de l'envoi, courriels par le gabarit de la charte |
| 2. Suivi | une semaine plus tard, sans geste du prospect | la lettre de filière suivante, où le dossier ouvert de la lettre 1 a avancé | partagé | même tâche, séquence tenue par `prospections` |
| 3. Édition de découverte | la première visite (`/acces/[jeton]`), qui ouvre l'essai | une édition unique de l'organisation, à partir d'un référentiel dérivé de la filière et du gel du site du prospect, publiée dans son espace | 2 à 4 $ | `edition-de-decouverte` déclenchée dans `after()` de la première visite, à côté de l'arrêt lemlist |
| 4. Onboarding complet | l'entrée en essai confirmée (deuxième visite ou souscription), ou la demande d'un prospect chaud | fiche, référentiel unique, première lettre complète, ouverture de l'espace | 8 à 15 $ en moteur (référentiel 5 à 10 $, lettre 1,5 à 3 $, fiche 1 à 2 $) | `onboarding` déclenchée par le crochet Payload ou par le passage quotidien du parcours |

Les lettres de filière ne sont jamais publiées dans un espace : une édition ne
porte qu'une organisation. Elles partent par courriel, un point c'est tout. Une
filière est une collection Payload avec son référentiel ; un prospect y est
rattaché à la saisie.

## 6. État livré sur la branche et ce qui reste

Voir le journal en fin de document, tenu à chaque commit. Ce qui ne peut pas se
faire dans le dépôt : créer le projet Trigger.dev et poser `TRIGGER_SECRET_KEY`
et `TRIGGER_PROJECT_REF` ; poser `PAYLOAD_SECRET` ; appliquer les migrations
Payload sur Neon (`pnpm payload:migrer`) ; créer le premier utilisateur Payload ;
poser `ANTHROPIC_API_KEY` dans l'environnement Trigger.dev ; écrire les
référentiels de filière.

### Payload : ce qui est en place

- `payload.config.ts` à la racine, alias `@payload-config` (tsconfig et
  vitest). Collections dans `lib/payload/collections/`, une par fichier, noms
  de champs sans accents (compatibles SQL), libellés accentués. Types générés
  dans `lib/payload/types.ts` par `pnpm payload:generer-types` (fichier généré,
  ignoré par ESLint, à régénérer après tout changement de collection).
- Routes Next : `app/(payload)/` porte le layout racine de Payload, l'admin
  (`/admin`) et l'API REST (`/payload-api`), recopiés du gabarit officiel
  `templates/blank` de Payload 3.91.0 ; `custom.css` (vide) remplace le
  `custom.scss` du gabarit, le dépôt n'embarquant pas sass. Le reste de
  l'application vit dans le groupe de routes `app/(portail)/`, avec son propre
  layout racine : les deux layouts ne peuvent pas s'imbriquer. Restent à la
  racine de `app/`, parce que Next.js les y exige : `globals.css` (importé
  par les deux groupes), `api/` (les routes du dispositif), `global-error.tsx`
  (résolu à la racine de `app` par le chargeur de Next, pour tous les groupes),
  `manifest.ts` et `icon.svg` (fichiers de métadonnées, propres à la racine et
  listés par le proxy et le service worker sous leur adresse exacte).
  `not-found.tsx` a suivi le portail dans `(portail)` : à la racine, il
  exigerait un layout racine qui n'existe plus. Conséquence à connaître : une
  adresse qui ne correspond à **aucune** route (par exemple trois segments
  inconnus) reçoit désormais la page 404 par défaut de Next.js, hors charte ;
  `notFound()` levé dans le portail (slug inconnu, lettre inconnue) rend
  toujours la page de secours. Le drapeau expérimental
  `experimental.globalNotFound` de Next 16 permettrait de rendre la page de la
  charte dans ce cas ; il n'est pas posé.
- `proxy.ts` laisse passer `/admin` et `/payload-api` (dans le `matcher` et
  dans `estUneAdressePayload`, pour qu'un slug qui commencerait par « admin »
  reste un slug). `next.config.ts` est enveloppé par `withPayload` ; la
  politique de contenu ne s'applique plus à ces deux chemins (l'admin charge
  ses propres scripts et styles), les autres en-têtes (HSTS, Referrer-Policy,
  X-Frame-Options) y restent.
- Façade `lib/documents/` : `listerÉditionsPubliées`, `lireBlocsDePage` et
  `lireMédiaDeBloc`, mêmes signatures et même type `Édition` que
  `lib/notion/editions.ts`, aiguillées par `SOURCE_DOCUMENTS`. Les écrans,
  `lib/portail/` et les composants importent d'ici ; `lib/notion/travail.ts`
  et les routes `/api/veille/*` restent sur Notion. En mode `payload`, la
  liste est demandée avec `organisation = <id>` et `statut = publiee` dans la
  requête, revérifiés en mémoire, triée par date décroissante ; le corps est
  le champ `blocs`, dérivé du Markdown par le crochet `beforeChange` ; aucune
  image n'est servie (`lireMédiaDeBloc` rend `null`). La date d'édition est
  le jour des dix premiers caractères de la date Payload : le sélecteur
  `dayOnly` de l'admin pose 12 h UTC, une écriture par l'API doit faire de
  même. `Veille` vaut toujours « Veille ». L'invalidation du cache
  (`lib/documents/invalidation.ts`, tags `page:<id>` et `liste:<organisation>`)
  est appelée par les crochets `afterChange` et `afterDelete` de la collection
  `editions` ; c'est le cinquième endroit qui invalide un tag, et
  `tests/architecture.test.ts` le tient.
- `lib/moteur/declencher.ts` : le seul endroit qui importe `@trigger.dev/sdk`
  côté portail (import à la demande). Sans `TRIGGER_SECRET_KEY`, chaque appel
  journalise `[moteur] déclenchement ignoré : TRIGGER_SECRET_KEY absente` et
  rend `{ déclenché: false }` ; les crochets Payload (`organisations` passant à
  `a_onboarder`, création d'un `prospects`) n'échouent jamais pour autant.
- Contrôle d'accès : tout est réservé aux utilisateurs Payload authentifiés ;
  `runs` est en lecture seule dans l'admin (le portail écrit par l'API locale,
  qui passe outre) ; `editions.blocs` est en lecture seule et recalculé à
  chaque enregistrement, quoi qu'on envoie.

### Variables d'environnement

- `PAYLOAD_SECRET` : chaîne longue et aléatoire (`openssl rand -hex 32`),
  obligatoire pour que l'admin démarre. Elle ne quitte jamais le portail ; les
  tâches Trigger.dev ne l'ont pas.
- `DATABASE_URL` : la même base Neon que le portail ; Payload n'y écrit que
  dans le schéma `payload`.
- `SOURCE_DOCUMENTS` : `notion` (défaut, comportement actuel) ou `payload`
  (les écrans lisent les éditions Payload). Toute autre valeur retombe sur
  `notion` et le journalise une fois. La bascule suppose l'import de l'archive
  (`pnpm documents:importer`, à écrire) et que `organisations.registre_notion`
  porte l'identifiant Payload de l'organisation pour chaque client.
- `TRIGGER_SECRET_KEY` : voir ci-dessus ; absente, rien ne part.

### Migrations Payload

La migration initiale est **générée et commitée** sur la branche
(`payload-migrations/20261021_105110_initiale.ts`, schéma `payload`, sept
tables de collections, index composé `(organisation, statut, dateEdition)`).
`pnpm payload:migration <nom>` (`payload migrate:create`) la génère sans base,
à partir de l'instantané JSON du dossier ; `pnpm payload:migrer` (`payload
migrate`) l'applique à `DATABASE_URL`. Deux points d'attention : Payload écrit
`import { MigrateUpArgs, MigrateDownArgs, sql }`, que `verbatimModuleSyntax`
refuse, il faut passer les deux types en `import type` à la main dans chaque
migration générée ; et le build de production n'applique pas encore les
migrations Payload (seul `scripts/base-migrer.ts` tourne), à ajouter quand la
bascule approchera, comme le contrôle du soir pour l'écart entre le dossier et
la base.

### Premier utilisateur

Une fois `PAYLOAD_SECRET` posé et la migration appliquée, ouvrir `/admin` :
Payload propose de créer le premier utilisateur (adresse, mot de passe, nom),
hors de tout contrôle d'accès. Les suivants se créent depuis la collection
« Utilisateurs », par un utilisateur connecté. Les lecteurs du portail n'y
figurent jamais : ils n'ont ni compte Payload ni mot de passe.

### Moteur, routes et paliers : ce qui est en place

- **Validateur** : `contrôlerLaLettre({ forme: 'unique' })`, seuils dans
  `LETTRE_UNIQUE` (`lib/portail/lint.ts`), tests `tests/portail.lint-unique.test.ts`.
- **Moteur** `lib/moteur/` : `referentiel.ts` (format du référentiel unique,
  lecteur, écrivain, conversion des deux référentiels Notion en un appel),
  `collecte.ts` (HTTP puis navigateur, phrases nouvelles depuis le gel),
  `recherche.ts` (requêtes types, un appel avec les outils serveur),
  `redaction.ts` (sortie structurée, cache d'une heure), `assemblage.ts`,
  `portes.ts`, `produire.ts` (deux reprises au plus), `selection.ts`
  (numéro, période : du jour de l'édition précédente à la veille, sept jours au
  moins, quatorze au plus), `cout.ts`, `remise.ts` (le contrat avec les routes),
  `declencher.ts` (le seul appel à Trigger.dev côté portail).
- **Routes du dispositif** (jeton d'activation) : `GET /api/veille/dossier`
  (`travail=<uuid>` pour le dossier d'un travail de la file ; modes
  `selection` (filières seules), `parution`, `decouverte`, `onboarding`,
  `filiere`, `onboarding-complet`, `prospect`), `POST /api/veille/editions`
  (avec `travail` et `session` : conclusion du travail par `recevoirUneÉdition`
  avant toute écriture, édition Payload publiée et courriers si acceptée, rien
  sinon ; sans travail : revalidation en forme unique, publiée ou brouillon,
  courriers aux prospects de la filière ; gel des sources dans la collection
  `gels` ; journal dans la table Drizzle `runs`), `POST /api/veille/travaux`
  (`prendre`, aussi par identifiant de travail ; `poser`),
  `POST /api/veille/referentiels` (relu par le lecteur du moteur avant
  d'être actif ; l'ancien est désactivé, jamais effacé), `POST /api/veille/prospects`
  (le bloc personnalisé). Toute la logique Payload est dans
  `lib/payload/dispositif.ts` ; l'envoi dans `lib/portail/parution.ts`
  (sortes de courrier `lettre` et `lettre_filiere`, migration Drizzle 0007).
- **Registre vers portail** (`lib/payload/portail.ts`) : passer une organisation
  « à onboarder », ou créer un prospect, ouvre sa ligne `organisations` dans le
  portail (`ouvrirEnEssai`, clé de cloisonnement = identifiant Payload sans
  tirets), déclare sa veille `unique` (lundi 6 h, hebdomadaire, numéro courant
  zéro : c'est elle que la file planifie) et crée le lecteur du contact quand
  Postgres fait foi ; puis la tâche Trigger.dev part. La première visite d'une organisation entrée par
  prospection déclenche l'édition de découverte quand `SOURCE_DOCUMENTS=payload`
  (`lib/portail/prospection.ts`).
- **Trigger.dev** : `trigger.config.ts` (extension Playwright), `trigger/portail.ts`
  (client des routes, dont `prendreUnTravail`, `poserUnTravail` et
  `lireLeDossierDuTravail`), `trigger/moteur.ts`, `trigger/parution.ts`
  (`vider-la-file` toutes les heures ouvrées, `produire-la-lettre` sans reprise
  Trigger.dev : la file tient les tentatives, `lettres-de-filiere` le lundi 6 h,
  `produire-la-lettre-de-filiere`), `trigger/onboarding.ts` (`onboarding`,
  `edition-de-decouverte`, `bloc-personnalise`). Variables de l'environnement
  Trigger.dev : `PORTAIL_URL`, `ACTIVATION_SECRET`, `ANTHROPIC_API_KEY`.
- **Évaluation** : `pnpm evaluation:unique convertir` puis `generer`, sur les
  exports Notion de Konica et d'Infralliance, dès que les crédits sont
  rechargés : c'est la mesure de coût et de qualité de la lettre unique avant
  toute bascule.
- **Le schéma `payload` est créé par la migration initiale elle-même**
  (`CREATE SCHEMA IF NOT EXISTS`) : généré sans base, le fichier ne le
  portait pas, et le premier build de production du 22 octobre 2026 a échoué sur
  « schema payload does not exist ». Toute migration Payload générée à
  l'avenir est à relire sous cet angle. Second piège, même jour : pour
  retirer une collection, le générateur écrit `DROP TABLE … CASCADE` **puis**
  `DROP CONSTRAINT` sur la clé étrangère que le `CASCADE` vient d'emporter ;
  la migration `retrait_runs` a fait tomber le build de production, et a été
  réécrite en `IF EXISTS` à chaque geste.
- **Migrations à appliquer au déploiement** : Drizzle 0008
  (`lettres_du_moteur`, deux valeurs d'énumération, appliquée par le build de
  production du 22 octobre) et 0009 (`file_de_travaux` : `travaux`, `runs`,
  leurs énumérations) ; Payload `20261021_105110_initiale`,
  `20261021_111008_ajout_gels_fiche_bloc` et `20261021_124849_retrait_runs`
  (`pnpm payload:migrer`, ou le build de production, `PAYLOAD_SECRET` et
  `DATABASE_URL` étant posées).

### Ce qui reste

- L'import de l'archive Notion vers Payload (`pnpm documents:importer`) et la
  bascule `SOURCE_DOCUMENTS=payload`, après la mesure de la lettre unique.
- Les référentiels de filière (contenu), à écrire dans l'admin ; la séquence
  de trois courriels de prospection reste pilotée par le statut du prospect
  (`a_contacter`, `lettre_1_envoyee`, `lettre_2_envoyee`), le troisième
  courriel (invitation à « recevoir mon lien ») n'est pas encore envoyé par le
  portail.
- Le contrôle du soir ne signale pas encore `TRIGGER_SECRET_KEY` absente ni un
  run Trigger.dev en échec ; un travail refusé ou abandonné se voit sur
  `/espaces/file` et dans `GET /api/veille/travaux`, ses portes dans la table
  `runs`. Une édition d'organisation refusée n'est écrite nulle part ; seule
  une lettre de filière refusée par la revalidation reste en brouillon.
- Faire entrer les lettres de filière dans la file (option C) : une veille de
  filière, un travail par parution, la même conclusion par `editions`.
- Le troisième exécuteur possible, un appel d'API direct depuis le portail
  sans Trigger.dev, n'est pas écrit : la file le permet sans changement.
- Le build de production applique les migrations Payload après celles de
  Drizzle (`scripts/base-migrer.ts --deploiement`), production seule, dès que
  `PAYLOAD_SECRET` est posée ; avant, il le dit et continue.
- `pnpm build` n'a pas été lancé dans la session (pas de base) : à faire sur
  une prévisualisation Vercel avec `PAYLOAD_SECRET` avant de fusionner.

## Journal

- **22 octobre 2026** : branche ouverte, dépendances installées (Payload
  3.91.0, Trigger.dev SDK 4.7.6), document écrit.
- **22 octobre 2026** : Payload intégré au Next.js existant (`payload.config.ts`,
  sept collections, admin sous `/admin`, API sous `/payload-api`, migration
  initiale), application déplacée dans `app/(portail)/`, façade
  `lib/documents/` aiguillée par `SOURCE_DOCUMENTS`, `lib/moteur/declencher.ts`,
  gardes d'architecture étendues (lecture Payload cachée, `getPayload` confiné,
  cinquième invalidation), `tests/payload.collections.test.ts`.
- **22 octobre 2026, suite** : contrat de la lettre unique dans le validateur,
  moteur en code, tâches Trigger.dev, Payload intégré (registre, documents,
  façade, admin), routes du dispositif, gel des sources, envoi des lettres,
  crochets du registre vers le portail, édition de découverte à la première
  visite, script d'évaluation de la lettre unique.
- **22 octobre 2026, réconciliation avec la file de travaux** : la branche
  `claude/sharp-fermat-lafthr` (palier 2 : `travaux`, `runs`, `veilles`
  écrite, `/api/veille/travaux`, `/api/veille/resultat`) est fusionnée,
  migration renumérotée 0009. Deux décisions : la table Drizzle `runs` est le
  seul journal (collection Payload `runs` retirée, migration `retrait_runs`) ;
  les filières restent hors de la file. Trigger.dev prend de la file
  (`vider-la-file`), `editions` conclut le travail (`recevoirUneÉdition`),
  `dossier?travail=` sert le dossier décidé, l'onboarding et la découverte
  posent et prennent un travail `premiere_lettre`, la veille `unique` est
  déclarée à l'ouverture d'une organisation, écran `/espaces/file`.
- **22 octobre 2026, lettre compacte** (demande de l'opératrice, d'après les deux
  lettres de Next Impact : près de 16 500 mots à elles deux, dont des idées de
  posts, une note de méthode, des listes de sources lues et non lues) : plus
  aucune recommandation de post ; un axe sans fait n'écrit que « RAS » ; au plus
  deux faits de 220 caractères par axe, avec un ou deux liens de source ; les
  sources non consultées sont une liste de liens écrite par le code
  (`assemblerLaLettre`, quatrième argument, rubrique « Sources non consultées »),
  jamais une rédaction du modèle, et un fait ne peut pas citer une source
  ignorée ; un axe est une thématique et une organisation n'est jamais un axe
  (`axe-est-un-acteur`), les dossiers sont des organisations. Le schéma de
  rédaction perd le champ `ras` et gagne `autresUrls` (une seconde source au
  plus). Les avertissements propres à l'édition n°1 (`lettre-maigre`,
  `analyse-absente`) ne valent plus en forme unique. Les deux lettres de Next
  Impact reformulées en une seule tiennent en 700 mots et passent le validateur
  sans réserve.
- **22 octobre 2026, deux informations par axe** (demande de l'opératrice) : un
  axe FORT ou MOYEN porte exactement deux faits (`axe-peu-fourni` sous deux,
  `axe-trop-fourni` au-delà). Quand la période n'en donne qu'un, le second est
  un élément de contexte daté, tiré des articles que la collecte suit sur les
  soixante jours qui précèdent la période (`contexte="oui"` dans le dossier) ;
  sans second fait sourçable, l'axe passe en RAS plutôt que d'être rempli. Le
  suffixe « (élément de contexte, non nouveau) » ne compte pas dans la longueur
  d'un fait. La collecte lit aussi la date qu'une page écrit pour sa dernière
  modification (« Mis à jour le 16 octobre 2026 », attribut `miseajour`) : un
  tarif qu'elle affiche est un fait de cette date, ce qui rattrape les pages de
  prix sans métadonnée de publication.
