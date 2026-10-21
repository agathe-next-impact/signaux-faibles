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
   territoire, etc.) ou un type d'organisations concurrentes (constructeurs,
   intégrateurs, acteurs publics, nouveaux entrants, etc.). Très synthétique,
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
| Corps d'un axe FORT ou MOYEN | un à **trois faits**, un paragraphe par fait, **deux phrases au plus et 280 caractères au plus** par fait, chaque fait daté et portant une URL ouverte pendant le run ; les constats d'absence en encadré à la suite | `fait-trop-long`, `axe-trop-fourni`, `fait-sans-date`, `fait-sans-source` |
| Corps d'un axe RAS | un seul encadré, 200 caractères au plus, qui nomme ce qui a été vérifié | `absence-en-prose` (rupture en forme unique) |
| « Dossiers suivis » | titre H1 du pied, un paragraphe par dossier ouvert, qui le nomme exactement comme la propriété ; la propriété `Dossiers ouverts suivis` garde le format `nom (compteur, précision)` | `dossier-sans-compteur`, `dossier-non-nommé` |
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

- `trigger.config.ts` (projet `signaux-faibles`, Node 24, extension Playwright
  pour le navigateur de collecte), tâches dans `trigger/` :
  `parution-hebdomadaire` (planifiée, le lundi 6 h Europe/Paris : une
  `produire-la-lettre` par organisation active), `produire-la-lettre`
  (le moteur, puis la remise au portail), `onboarding` (fiche, référentiel
  unique, première lettre, remise, puis ouverture de l'espace par
  `/api/acces/ouvrir` selon la règle du 20 octobre), `lettre-de-filiere`
  (planifiée, une par filière active), `bloc-personnalise` (un prospect),
  `edition-de-decouverte` (déclenchée par la première visite).
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
Payload sur Neon (`pnpm payload migrate`) ; créer le premier utilisateur Payload ;
poser `ANTHROPIC_API_KEY` dans l'environnement Trigger.dev ; écrire les
référentiels de filière.

## Journal

- **22 octobre 2026** : branche ouverte, dépendances installées (Payload
  3.91.0, Trigger.dev SDK 4.7.6), document écrit.
