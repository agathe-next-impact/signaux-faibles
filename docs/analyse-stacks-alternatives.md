# Analyse de la stack et cinq stacks alternatives

*Proposition du 21 octobre 2026, non décidée. Deux objectifs fixés par la
propriétaire du dispositif : simplifier l'utilisation (celle de l'opératrice
d'abord, celle des lecteurs ensuite) et permettre plus d'organisations. Chaque
stack est évaluée techniquement et économiquement, avec ses hypothèses. Le temps
de relecture humaine n'est pas compté : l'analyse ne porte que sur ce que la
stack borne, et donne pour chacune le nombre d'organisations qu'elle permet. Les prix
viennent de sources tierces datées de 2026, sauf mention contraire ; ils sont à
confirmer sur la page de chaque fournisseur avant toute décision.*

## 1. La stack d'aujourd'hui, mesurée

### 1.1 Les composants

| Rôle | Composant | Ce qu'il porte |
|---|---|---|
| Portail | Next.js 16, App Router, `cacheComponents`, Tailwind v4, sur Vercel | les sept écrans, deux écrans d'abonnement, 16 routes API, 3 webhooks, 2 crons |
| Documents | Notion, plan gratuit, un seul membre, SDK v5, API 2025-09-03 | base « Éditions de veille » (corps des lettres, lu par blocs), base « Accès » (en migration) |
| État | Postgres Neon, Drizzle 0.45, 7 migrations | organisations, veilles, lecteurs, abonnements, courriers, prospections |
| Accès | lien magique persistant HMAC, cookie 12 mois, `proxy.ts` | aucun fournisseur d'authentification |
| Courrier | API Gmail, compte de service, délégation au niveau du domaine | lien d'accès, fin d'essai, alerte du soir ; lettres déposées en brouillons Gmail |
| Paiement | Stripe 23, Checkout et portail de facturation, webhook | copie dans `abonnements` |
| Prospection | lemlist (clé facultative) et pilote par brouillons Gmail | `prospections`, `événements_prospection` |
| Moteur cognitif | tâches Cowork planifiées sur l'abonnement Max, six commandes Claude Code d'onboarding, prompts dans des pages Notion | référentiels, lettres, relecture, réconciliation |

Chiffres du dépôt au 21 octobre 2026 : 25 130 lignes de TypeScript, 54 fichiers
de tests Vitest sur PGlite, 142 commits en six semaines, 25 variables
d'environnement, 668 lignes de `SKILL.md` pour les six commandes d'onboarding.

### 1.2 Où est la complexité d'utilisation

Elle est presque entièrement du côté de l'opératrice, et elle vient de cinq
sources, toutes documentées dans `CLAUDE.md` comme des pièges avérés.

1. **Deux systèmes de vérité pendant la migration.** La base « Accès » Notion
   et la table `lecteurs`, aiguillées par `SOURCE_ACCES` à trois valeurs ; une
   tâche Cowork écrit l'une, le portail lit les deux. La bascule attend encore.
2. **Notion comme base de données sans en être une.** Pas d'unicité (deux
   lignes « Accès » avec le même identifiant, 11 septembre), pas de relation
   typée côté portail (ligne du registre contre page organisation, 10
   septembre), pas de transaction, un statut `Brouillon` invisible du portail
   (Konica, 12 septembre). Le corps d'une lettre est de la prose dont le
   portail déduit la structure : suffixe du H2, format des dossiers, mot
   « cadrage » dans un H1. Le contrat de forme tient 458 lignes de validateur
   et 745 lignes de parseur, et sa rupture fut muette (Pays de Mauriac, 11
   septembre).
3. **L'onboarding est une procédure.** Six commandes lancées à la main depuis
   Claude Code, chacune ouvrant une page Notion qui fait foi, six statuts de
   registre, une case ▶ cochée puis décochée, un import, un appel d'ouverture,
   et des sessions qui doivent tourner sur un environnement précis
   (« signaux-faibles-io ») sous peine de 401.
4. **La relecture passe par des brouillons Gmail.** Chaque lettre, deux par
   organisation et par semaine, est mise en forme par le portail, déposée en
   brouillon par la tâche, puis envoyée par la relectrice. `relecture_requise`
   est vrai par défaut.
5. **Des secrets fragiles.** La clé privée du compte de service Google a six
   formes de mutilation rattrapées en code ; la délégation demande un second
   super-administrateur ; le webhook Notion a une poignée de main ; une
   variable facultative posée vide a fait tomber toutes les pages le 14 octobre.

### 1.3 Où sont les plafonds sur le nombre d'organisations

| Plafond | Cause | Ordre de grandeur |
|---|---|---|
| **Le moteur** | tâches Cowork sur un abonnement Max individuel : exécution séquentielle, liée à une session, quotas hebdomadaires non publiés, plan vendu « individuel, pas pour les équipes » | 15 à 25 organisations à deux lettres par semaine, en comptant 15 à 30 minutes d'agent par lettre ; au-delà, un second abonnement et toujours pas de parallélisme garanti |
| **Notion, un seul membre** | plan gratuit : un second membre plafonne l'espace à 1 000 blocs à vie et l'API refuse ensuite toute création | aucun relecteur, aucun collaborateur ne peut jamais entrer dans Notion |
| **Notion, le débit** | 3 requêtes par seconde par intégration, limite par espace de travail non publiée sur le plan gratuit, 180 requêtes par minute pour le connecteur MCP de Cowork | indolore pour le portail (cache), contraignant pour les écritures des tâches |
| **Notion, le contrat de prose** | la structure est devinée du texte | le risque de tableau de bord vide croît avec le nombre de lettres produites |
| Gmail | 2 000 messages par jour et par boîte | 50 organisations × 3 lecteurs × 2 lettres = 300 messages par semaine : loin |
| Vercel, Neon | facturation à l'usage | sans objet avant plusieurs centaines d'organisations |
| Cloisonnement en code | pas de RLS, contrôle dans `proxy.ts` et le layout | le risque croît avec le nombre de **routes**, pas de clients ; il est tenu par `tests/architecture.test.ts` |

Le plafond qui mord en premier est le moteur, et il est indépendant de
l'hébergement du portail. Derrière lui viennent les limites Notion, puis Gmail.
**Nombre d'organisations possibles avec la stack actuelle : 15 à 25**, borné par
le moteur ; un second abonnement Max porterait la borne vers 30 à 50, toujours
sans parallélisme garanti.

### 1.4 Coût mensuel actuel

| Poste | Estimation | Note |
|---|---|---|
| Vercel Pro | 20 $ | le plan Hobby interdit l'usage commercial |
| Neon | 0 à 10 $ | plan gratuit ou Launch à l'usage, base qui dort |
| Notion | 0 $ | plan gratuit, un membre |
| Google Workspace | 7 à 14 € | une boîte sur le domaine, nécessaire de toute façon |
| Claude Max 20x | 200 $ | le moteur ; sert aussi au développement |
| Stripe | 1,5 % + 0,25 € par paiement européen | variable, identique dans toutes les stacks |
| lemlist | 0 € | pilote par Gmail en cours |
| **Total fixe** | **≈ 230 à 250 $** | dont 80 % pour le moteur |

### 1.5 Ce qui s'achète sans changer de stack

- **Deux sièges Notion Plus** (10 à 12 $ par siège et par mois selon les
  sources) lèvent le plafond des 1 000 blocs : un espace payant n'a pas de
  limite de blocs. Une seconde personne pourrait entrer dans Notion. La limite de
  3 requêtes par seconde par intégration, elle, ne change pas avec le plan.
- **La colonne `runs.coût`** du schéma cible, à remplir dès le premier run par
  API : toute l'économie ci-dessous repose sur des ordres de grandeur qu'un mois
  de mesure remplacerait par des faits.

## 2. Hypothèses économiques communes

**Revenu** : 89 € HT par organisation et par mois (29 € en early adopter),
soit 1 780 € à 20 organisations et 4 450 € à 50. L'infrastructure est
négligeable devant ce revenu dans toutes les stacks ; ce qui compte, c'est le
coût du modèle par lettre.

**Coût du modèle.** Tarifs API Anthropic au 6 octobre 2026 : Opus 5.5 à 4 $ le
million de jetons en entrée et 20 $ en sortie (lecture de cache 0,20 $) ;
Sonnet 5.5 à 2 $ et 10 $ ; Batch à moitié prix, adapté à des lettres
hebdomadaires qui n'ont aucune contrainte de latence. Deux conceptions de la
génération donnent deux ordres de grandeur très différents :

| Conception | Modèle | Jetons par lettre (hypothèse) | Coût par lettre | Par organisation et par mois (8,7 lettres) |
|---|---|---|---|---|
| **Agentique** : le modèle cherche et lit lui-même, 20 à 40 tours d'outils | Opus 5.5 | 3 à 5 M en entrée dont 85 % lus en cache, 300 k neufs, 40 k en sortie, 30 à 40 recherches | 3 à 4 $ | 26 à 35 $ |
| Agentique | Sonnet 5.5 | idem | 1,5 à 2 $ | 13 à 18 $ |
| **Pipeline** : le code collecte les sources, un appel à sortie structurée, une passe de relecture automatique, Batch | Opus 5.5 | 120 k en entrée, 15 k en sortie, × 1,5, puis − 50 % | 0,5 à 1 $ | 4 à 9 $ |
| Pipeline | Sonnet 5.5 | idem | 0,25 à 0,5 $ | 2 à 4 $ |

La génération d'un référentiel à l'onboarding est un coût unique, de l'ordre de
5 à 15 $ en agentique. Le tarif de l'outil de recherche web côté API est à
vérifier ; il est compté ici à 1 cent la recherche. Ces chiffres sont des
hypothèses de dimensionnement, pas des mesures.

**Conséquence** : la conception pipeline (collecteur de sources en code,
prévue au palier 3) ramène le coût du modèle sous 10 % du revenu par
organisation. La conception agentique le place entre 15 et 40 %. C'est la
décision économique la plus lourde de ce document, et elle est indépendante de
la stack d'hébergement.

**Prix des fournisseurs retenus** (sources tierces, 2026, à confirmer) :
Vercel Pro 20 $ par siège ; Neon Launch à l'usage, quelques dollars pour une
base qui dort ; Supabase Pro 25 $ plus calcul ; Hetzner CX23 5,99 € (2 vCPU,
4 Go) après la hausse d'avril 2026, gammes supérieures 10 à 20 € ; Resend
gratuit jusqu'à 3 000 courriels par mois puis 20 $ ; Postmark 15 $ pour
10 000 ; Notion Plus 10 à 12 $ par siège ; Claude Max 100 ou 200 $ ; Trigger.dev
(page officielle, lue le 22 octobre 2026) : Free 0 $ avec 5 $ de crédit et 20
runs simultanés, Hobby 10 $ avec 10 $ de crédit et 50 runs simultanés, Pro 50 $
avec 50 $ de crédit et 200 runs simultanés, calcul facturé à la seconde
(machine par défaut Small 1x : 0,0000338 $ la seconde, soit 0,12 $ l'heure),
0,25 $ par 10 000 runs, pas de durée maximale par défaut ; tarification de
Managed Agents non publiée dans les sources consultées.

**Comment le nombre d'organisations est calculé.** Pour chaque stack, la
capacité est le plus petit des plafonds techniques, en comptant deux lettres par
organisation et par semaine, trois lecteurs par organisation, une lettre de 150
blocs ou 15 000 jetons de sortie, et des parutions étalées sur les cinq jours
ouvrés. Les plafonds considérés : débit d'écriture Notion (3 requêtes par
seconde par intégration, soit une lettre par seconde au plus), quota Gmail
(2 000 messages par jour et par boîte, soit 330 organisations recevant leurs
deux lettres le même jour, 1 600 si les parutions sont étalées), durée d'une
fonction Vercel, débit API Anthropic du palier de facturation, puissance d'une
machine pour les runs agentiques.

## 3. Les cinq stacks

Chaque stack est décrite par ce qu'elle change, ce qui survit du dépôt, ce
qu'elle apporte sur les deux objectifs, le nombre d'organisations qu'elle
permet et ce qui le borne, ses risques, son coût mensuel à 5, 20, 50 et 100
organisations (conception pipeline sur Opus 5.5, soit 7 $ par organisation ;
entre parenthèses, conception agentique à 30 $) et son effort de migration.

### Stack 1 : même socle, moteur en code par l'API, Notion conservé

**Principe.** Le portail reste tel quel. Le moteur quitte l'abonnement Max : une
fonction planifiée collecte les sources de chaque veille (le collecteur du
palier 3), soumet la rédaction en Batch avec une sortie structurée (le document
au format que `construireDocument` produit déjà : rubriques, axes avec niveau,
dossiers avec compteur), relit le résultat avec le validateur existant, écrit la
page Notion acceptée par l'API Notion (100 blocs par requête, 3 requêtes par
seconde), puis la publie. C'est l'alternative que la décision du 16 octobre
nomme elle-même (« appeler le modèle depuis le code change le modèle de coût,
pas le modèle de données »).

**Ce qui change dans le dépôt.** Un dossier `lib/moteur/` (collecte, prompt,
appel, acceptation), les tables `travaux` et `runs` déjà dessinées, les prompts
dans `prompts/` comme prévu. Le reste survit intégralement : `lib/domaine`,
`lib/base`, `lib/notion`, l'authentification, les écrans. La règle « le portail
n'écrit jamais dans Notion » devient « seul `lib/moteur` écrit dans Notion, et
seulement une page acceptée » ; la garde d'architecture le vérifie.

**Simplification.** Disparaissent : les sessions Cowork, l'environnement à
sortie réseau, les prompts dans Notion, quatre des six commandes d'onboarding
(ne restent que la demande et l'ouverture). Restent : les pièges Notion, la
relecture par brouillons Gmail, les deux bases Accès jusqu'à la bascule.

**Nombre d'organisations : 200 à 300.** Le moteur devient parallèle et facturé
à l'usage. Ce qui borne ensuite : la limite de débit par espace de travail
Notion, non publiée sur le plan gratuit, et le quota Gmail si les parutions
restent groupées le même jour (330 organisations). L'écriture des pages, elle,
ne borne rien avant plusieurs milliers de lettres par semaine. Avec deux sièges
Notion Plus et des parutions étalées, la borne passe au-delà de 500.

**Risques.** La durée d'une fonction Vercel (quelques centaines de secondes au
plus, 800 s sur Pro avec Fluid compute, à vérifier) interdit un run agentique
long dans le portail : la conception pipeline ou le Batch sont obligatoires,
ce qui est un avantage économique déguisé en contrainte. Un run agentique
resterait possible en Batch avec les outils serveur de recherche, à mesurer.

**Coût mensuel.** Fixe ≈ 50 $ (Vercel 20, Neon 10, Workspace 10, Max remplacé
par un abonnement Pro de développement à 20 $) ; 5 organisations ≈ 85 $
(200 $) ; 20 ≈ 190 $ (650 $) ; 50 ≈ 400 $ (1 550 $) ; 100 ≈ 770 $ (3 070 $),
Vercel et Neon commençant alors à facturer l'usage.

**Effort.** 2 à 4 semaines. Risque de migration faible : rien d'existant n'est
réécrit.

### Stack 2 : Supabase comme socle (Postgres, RLS, file, cron) et Trigger.dev pour les runs

**Principe.** Neon est remplacé par Supabase (Postgres géré, RLS, `pg_cron`,
`pgmq`, stockage, journaux dans un seul tableau de bord). Les runs longs vont
dans Trigger.dev (tâches durables, retentatives, observabilité), qui peut faire
tourner soit la conception pipeline, soit un agent complet (Claude Agent SDK
réutilisant les `SKILL.md` existants) sans limite de durée. Les lettres sont
stockées en Postgres sous RLS ; Notion devient facultatif, gardé pour l'archive
ou retiré. Le lien magique HMAC reste tel quel : Supabase Auth n'offre que des
liens à usage unique (`docs/etat-des-api.md`, §5), ce qui avait déjà été écarté.

**Ce qui change.** `lib/base/client.ts` (le pilote), les politiques RLS en
migrations, un projet Trigger.dev, `lib/notion` devient un importateur de
l'archive. `lib/domaine`, l'authentification et les écrans survivent.

**Simplification.** Un seul tableau de bord pour la base, la file, les crons,
les journaux, le stockage ; la limitation de débit en mémoire devient une table ;
le filet RLS que `docs/architecture-notion-headless.md` reconnaît manquer
(« plus fragile qu'une RLS, une seule ligne oubliée suffit ») revient sous le
cloisonnement en code. Deux fournisseurs de plus à tenir (Supabase, Trigger.dev)
pour un fournisseur de moins (Notion) : solde neutre sur ce plan.

**Nombre d'organisations : plus de 1 000.** Runs parallèles et durables,
Postgres géré, courrier par fournisseur transactionnel sans quota journalier.
Ce qui borne : le débit API Anthropic du palier de facturation, qui se demande.

**Risques.** Trigger.dev avait déjà été écarté le 9 septembre, pour une autre
raison (plus de tâche longue à l'époque) ; son plan gratuit est borné à une
exécution par heure et par planification. Deux migrations de données
(Neon vers Supabase, Notion vers Postgres) dans la même fenêtre. Dépendance à
un second hébergeur américain pour les données clients (région EU disponible
chez Supabase).

**Coût mensuel.** Fixe ≈ 75 $ (Vercel 20, Supabase 35, Trigger.dev Hobby 10,
Resend 0, Workspace 10) ; 5 organisations ≈ 110 $ (225 $) ; 20 ≈ 215 $ (675 $) ;
50 ≈ 425 $ (1 585 $) ; 100 ≈ 795 $ (3 120 $), le calcul Trigger.dev d'un run
agentique de vingt minutes coûtant 0,04 $, soit 0,35 $ par organisation et par
mois, couvert par le crédit Hobby jusqu'à une trentaine d'organisations.

**Effort.** 5 à 8 semaines.

### Stack 3 : Payload CMS 3 dans le Next.js existant, Notion retiré

**Principe.** Payload 3 s'installe **dans** une application Next.js, sur
Postgres par Drizzle, le même ORM qu'aujourd'hui. Il apporte ce que le dépôt
réécrit à la main ou délègue à Notion : une interface d'administration, des
collections typées avec versions et brouillons, un éditeur de texte riche
(Lexical) pour la relecture, des utilisateurs et des rôles sans limite de
sièges, un greffon multi-tenant, une file de travaux (Payload Jobs) déclenchée
par cron, des hooks avant publication où vit le validateur. Une lettre devient
une collection à blocs structurés (rubrique, axe avec niveau, dossier avec
compteur) : le contrat de forme passe de la prose au schéma, et le modèle écrit
directement ce schéma par sortie structurée. Le portail client lit Postgres ;
Notion est retiré après import de l'archive.

**Ce qui change.** `lib/notion` meurt (remplacé par un import unique),
`construireDocument` devient l'importateur des anciennes lettres, les écrans
d'opératrice (`/espaces`, `/espaces/abonnements`, réglages) sont remplacés par
l'administration Payload, `lib/base/schema.ts` est redécrit en collections
Payload (Payload génère ses propres migrations Drizzle). Survivent : tout
`lib/domaine`, l'authentification des lecteurs (Payload n'authentifie que
l'opératrice et les relecteurs), Stripe, les courriers, les écrans clients.

**Simplification.** La plus forte des cinq pour l'opératrice : une seule
application, une seule base, un seul écran d'administration où une organisation
se crée en remplissant un formulaire, où une lettre se relit et se publie d'un
bouton, où un relecteur se crée sans toucher à Notion. Les trois pièges Notion
disparaissent par construction (relation typée, unicité en base, statut vu par
le portail). Les prompts et le validateur vivent dans le dépôt.

**Nombre d'organisations : plus de 1 000.** Postgres porte les documents, le
courrier part par fournisseur transactionnel, les jobs tournent par lots dans
des fonctions planifiées. Ce qui borne : la durée d'une fonction Vercel par lot
de collecte, résolue en découpant les lots, puis le débit API Anthropic.

**Risques.** Payload est opiniâtre : schéma, administration, authentification ;
le greffon multi-tenant tient le cloisonnement dans l'application, pas en base,
comme aujourd'hui. Les jobs tournent dans des fonctions Vercel : même contrainte
de durée que la stack 1, même réponse (pipeline ou Batch). La refonte du schéma
de données en cours de migration de la base Accès demande de finir la bascule
`SOURCE_ACCES=postgres` d'abord. Les règles de la charte (sentence case, polices)
ne concernent que le portail client ; l'administration Payload garde son
apparence, ce qui est acceptable pour un outil interne.

**Coût mensuel.** Fixe ≈ 55 $ (Vercel 20, Neon 15 à 25 car l'administration
garde la base éveillée, Resend 0 à 20, Workspace 10) ; 5 organisations ≈ 90 $
(205 $) ; 20 ≈ 195 $ (655 $) ; 50 ≈ 405 $ (1 555 $) ; 100 ≈ 780 $ (3 080 $).
Licence Payload : 0, MIT.

**Effort.** 6 à 10 semaines, en deux temps (bascule Accès, puis documents).

### Stack 4 : monolithe auto-hébergé en Europe, agent complet sur la machine

**Principe.** Le même Next.js, Postgres sur la même machine ou géré chez un
hébergeur européen (Scaleway, OVHcloud), un processus de travail `pg-boss` ou
BullMQ, Caddy, le tout déployé par Coolify sur un serveur Hetzner ou Scaleway.
Sans limite de durée de fonction, le moteur peut rester **agentique** : le
Claude Agent SDK fait tourner les six `SKILL.md` actuels presque tels quels,
facturés à l'API, sans abonnement Max ni session Cowork. Les lettres vont en
Postgres ; Notion est retiré ou gardé en archive. Le courrier passe par un
fournisseur transactionnel européen (Brevo, Scaleway TEM) ou Resend, à la place
de la délégation Google.

**Ce qui change.** `'use cache: remote'` perd son gestionnaire Vercel : soit un
gestionnaire de cache Redis, soit, si les lettres sont en Postgres, la plupart
des lectures cachées n'ont plus de raison d'être. `next.config.ts` (en-têtes,
redirections) survit, `vercel.json` disparaît au profit d'un cron système, la
limitation de débit du pare-feu Vercel devient une règle Caddy ou une table.
Tout le reste survit.

**Simplification.** Architecture la plus simple à **comprendre** : un
dépôt, une machine, une base, un worker. Mais l'exploitation revient à
l'opératrice : sauvegardes, mises à jour, surveillance, certificats, reprise
après panne. Coolify et une base gérée réduisent cela à 2 à 4 heures par mois,
sans l'annuler. Pour une personne seule, c'est le point faible de cette stack.

**Nombre d'organisations : 300 à 800 par machine.** En agentique, quatre runs
simultanés de 15 à 30 minutes sur une machine à 4 vCPU donnent 1 300 à 2 700
lettres par semaine, soit 650 à 1 300 organisations en théorie ; la borne
pratique est le débit API Anthropic et la mémoire de la machine, d'où la
fourchette retenue. Une seconde machine de worker double la capacité. Les données restent en France ou en Allemagne,
argument réel pour des clients collectivités (Pays de Mauriac) et pour la
conformité RGPD ; l'inférence, elle, reste chez Anthropic, et le paramètre
`inference_geo` est à vérifier pour une option européenne.

**Risques.** Perte des déploiements de prévisualisation, du pare-feu géré et de
l'observabilité Vercel ; `cacheComponents` sans gestionnaire distant doit être
validé ; un incident de nuit n'a personne d'astreinte.

**Coût mensuel.** Fixe ≈ 40 $ (serveur 12, Postgres géré 10 ou 0 sur la même
machine, sauvegardes 3, courrier 0 à 10, Workspace 10) ; 5 organisations ≈ 75 $
(190 $) ; 20 ≈ 180 $ (640 $) ; 50 ≈ 390 $ (1 540 $) ; 100 ≈ 750 $ (3 050 $),
la machine suivante coûtant 12 à 20 $. À quoi s'ajoute le temps
d'exploitation. La conception agentique y est naturelle, ce qui pousse vers la
colonne de droite.

**Effort.** 4 à 8 semaines, dont une d'installation et de procédures
d'exploitation écrites.

### Stack 5 : Managed Agents d'Anthropic pour le moteur, portail inchangé

**Principe.** Le moteur devient un agent géré par Anthropic, avec déploiements
planifiés, outils de recherche et de lecture web côté serveur, connecteur MCP
Notion pour écrire la page, identifiants en coffre (le jeton d'activation n'est
jamais dans le prompt), et un « outcome » noté sur une grille qui reprend le
contrat de forme. Il lit la file de travaux et poste ses résultats sur les deux
routes que la décision du 16 octobre a déjà dessinées
(`GET /api/veille/travaux`, `POST /api/veille/resultat`). C'est la version de
production exacte de ce que font aujourd'hui les tâches Cowork, sans session
interactive, sans abonnement individuel et sans la question de l'autorisation
de sortie réseau, nommée « risque principal » de la décision.

**Ce qui change.** Presque rien dans le dépôt : les deux routes de file, la
table `runs`, les prompts dans `prompts/` servis à l'agent. `lib/notion`,
`lib/base`, l'authentification, les écrans : tout survit.

**Simplification.** Les sessions Cowork, l'environnement dédié et les commandes
d'onboarding lourdes disparaissent ; les pièges Notion et la relecture par
Gmail restent, comme dans la stack 1.

**Nombre d'organisations : 200 à 300**, pour les mêmes raisons que la stack 1
(Notion et Gmail restent), la plateforme d'agents elle-même ne bornant rien
avant la limite de sessions simultanées du compte, à vérifier.

**Risques.** Produit en bêta ; **tarification non publiée dans les sources
consultées** (jetons au tarif API, plus des frais de session à confirmer) ; la
conception y est agentique par nature, donc dans la colonne de coût haute ;
exécution aux États-Unis, à vérifier pour la résidence des données sources ;
dépendance forte à un seul fournisseur pour le cœur du service.

**Coût mensuel.** Fixe ≈ 45 $ (Vercel 20, Neon 10, Workspace 10, plus les frais
de plateforme inconnus) ; 5 organisations ≈ 195 $ et plus ; 20 ≈ 645 $ et plus ;
50 ≈ 1 545 $ et plus ; 100 ≈ 3 045 $ et plus, en conception agentique sur
Opus 5.5 ; moitié sur Sonnet 5.5.

**Effort.** 2 à 4 semaines, une fois les prix connus.

## 3bis. Fiabilité et onboardings depuis l'admin : stacks 1, 2 et 3

*Ajouté le 22 octobre 2026 à la demande de la propriétaire. Le temps de
relecture humaine n'est toujours pas compté ; les attentes humaines (validation
des référentiels, publication de la première lettre, choix du jour d'ouverture)
sont nommées comme des gestes, jamais mesurées.*

### Fiabilité des stacks 2 et 3

| Critère | 2 · Supabase + Trigger.dev | 3 · Payload CMS 3 | Avantage |
|---|---|---|---|
| Exécution des runs | tâches durables, retentatives, reprise après coupure, pas de limite de durée, tableau de bord par run, alertes | Payload Jobs dans des fonctions Vercel bornées en durée ; un run coupé reste à traiter à la main ; observabilité à construire | 2 |
| Cloisonnement | RLS en base sous le contrôle applicatif | contrôle d'accès applicatif (greffon multi-tenant), un seul rôle Postgres, comme aujourd'hui | 2 |
| Sauvegardes et retour arrière | sept sauvegardes quotidiennes sur Pro, PITR à 100 $ par mois en option | historique et branches Neon selon le plan ; versions et brouillons Payload par document | égal |
| Couplage au moteur de pages | aucun | fort : Payload vit dans le processus Next.js, prise en charge de Next.js 16 depuis la 3.77 (février 2026, source unique), deux versions de Drizzle côte à côte, rythme de versions élevé | 2 |
| Pérennité des éditeurs | Supabase indépendant et financé ; Trigger.dev petite société, code ouvert, deux incidents relevés en trente jours par un agrégateur, aucun SLA trouvé | Payload racheté par Figma, MIT conservée, Payload Cloud fermé ; Neon racheté par Databricks, commercialisé sous le nom Lakebase | égal |
| Surface de panne | quatre services réseau | deux services, mais une administration, une API et une authentification par mot de passe exposées sur le domaine client | partagé |
| Transition | code conservé, 54 fichiers de tests valides, deux migrations de données | schéma redécrit, écrans d'opératrice remplacés, banc de test à refaire, une migration de données | 2 sur le code |

Si la stack 3 est retenue : runs longs en pipeline et Batch plutôt qu'en Payload
Jobs, lectures Postgres gardées en cache distant, version de Payload figée et
testée en prévisualisation, compatibilité avec Next.js 16.3 et `cacheComponents`
prouvée sur une branche avant d'engager la migration.

### Plusieurs onboardings lancés depuis l'admin

Un onboarding, c'est : une demande saisie, deux référentiels générés (lecture
du site et des sources), une validation humaine, deux premières lettres, une
publication humaine, J0 posé, l'espace ouvert. Les durées ci-dessous comptent
deux référentiels et deux lettres par organisation, en agentique 15 à 40 minutes
par référentiel et 15 à 30 par lettre, en pipeline quelques minutes de collecte
puis une fenêtre Batch de 10 à 60 minutes par étape.

| Besoin | Actuelle | 1 · API, Notion gardé | 2 · Supabase + Trigger.dev | 3 · Payload seul | 3 + Trigger.dev |
|---|---|---|---|---|---|
| Écran d'administration | aucun : six commandes Claude Code et le registre Notion | à écrire dans le Next.js, mais mince : un tableau des étapes et des boutons, l'édition restant dans Notion | à écrire dans le Next.js, avec un éditeur | fourni (listes, formulaires, filtres, rôles) | fourni |
| Éditeur de relecture des référentiels | Notion | Notion, les pages étant créées par le moteur : plus d'identifiant copié à la main | à construire | Lexical, versions, brouillons | Lexical |
| Orchestration de la chaîne | l'opératrice, commande par commande | table `travaux`, cron Vercel, Batch ; les attentes sont des états en base relus par le cron | tâches durables avec points d'attente, tâches enfants, reprise | jobs courts enchaînés par crochets `afterChange` ; Batch obligatoire pour les générations | tâches durables déclenchées par un crochet Payload |
| Parallélisme | 1 (une session par commande) | Batch parallèle par nature ; collecte bornée par la durée de fonction et la cadence du cron | exécutions parallèles, limite de concurrence par file et par organisation | invocations de fonctions, cron au mieux chaque minute, jobs bornés par appel | comme la stack 2 |
| Gestes de l'opératrice par onboarding | 6 commandes, plus les manipulations Notion | 1 saisie, 3 validations | 1 saisie, 3 validations | 1 saisie, 3 validations | 1 saisie, 3 validations |
| **Durée machine d'un onboarding** | 2 à 4 h d'agent, réparties sur les six commandes | 1 à 3 h (collecte en minutes, deux fenêtres Batch, écriture Notion en secondes) | 1 à 1 h 30 en agentique (référentiels en parallèle, puis lettres en parallèle) ; 30 min à 2 h en pipeline | 1 à 3 h (mêmes mécanismes que la stack 1) | 1 à 1 h 30 |
| **Délai calendaire minimal** (validations faites dans l'heure) | 1 à 2 semaines (statuts du registre, rythme de parution) | 1 à 2 jours (fenêtres Batch, J0 posé par le cron de 8 h) | le jour même (pas de Batch, J0 posé par la chaîne) | 1 à 2 jours | le jour même |
| **Onboardings simultanés** | 1 | 10 à 30 | 12 à 25 sur Hobby (50 runs simultanés, 2 à 4 runs par onboarding), 50 à 100 sur Pro (200), avant le palier API | 10 à 30 techniquement, 3 à 5 confortablement (reprises manuelles) | 12 à 25 sur Hobby, 50 à 100 sur Pro |
| **Onboardings soutenables par semaine** (machine) | 2 à 3 | 50 et plus | 100 et plus | 50 et plus | 100 et plus |
| Ce qui borne | la session et l'opératrice | cadence du cron, durée de fonction pour la collecte, débit Notion | palier API Anthropic, puis le plan Trigger.dev | cadence du cron, suivi des reprises | palier API, puis le plan Trigger.dev |
| **Coûts fixes mensuels** | ≈ 230 à 250 $ (dont Max 200) | ≈ 50 $ (Vercel 20, Neon 10, Workspace 10, Claude Pro 20) | ≈ 75 $ (Vercel 20, Supabase 35, Trigger.dev Hobby 10, Resend 0, Workspace 10) | ≈ 55 $ (Vercel 20, Neon 15 à 25, Resend 0, Workspace 10) | ≈ 65 $ (stack 3 plus Trigger.dev Hobby 10) |
| **Coût par organisation et par mois** (pipeline / agentique, Opus 5.5) | 0 $ en argent, le moteur étant forfaitaire | 4 à 9 $ / 26 à 35 $, plus 2 $ de frais Stripe sur une organisation payante | 4 à 9 $ / 26 à 35 $, plus 0,05 à 0,35 $ de calcul Trigger.dev et 2 $ de Stripe | 4 à 9 $ / 26 à 35 $, plus 2 $ de Stripe | 4 à 9 $ / 26 à 35 $, plus 0,05 à 0,35 $ de Trigger.dev et 2 $ de Stripe |
| **Coût unique d'un onboarding** (modèle : deux référentiels, deux lettres) | 0 $ en argent, 2 à 4 h de quota Max | 3 à 6 $ en pipeline, 15 à 40 $ en agentique | idem, plus 0,10 à 0,25 $ de calcul Trigger.dev | idem | idem |
| Part du revenu de 89 € HT | sans objet | 7 à 12 % en pipeline, 30 à 40 % en agentique | idem | idem | idem |

Lecture. La stack 1 règle déjà l'essentiel du problème de volume : elle fait
passer la capacité d'un onboarding à la fois à une dizaine en parallèle, avec un
admin mince parce que Notion reste l'éditeur et que le moteur crée lui-même les
pages, ce qui fait disparaître le piège de l'identifiant copié pour toute
nouvelle organisation. Ce qu'elle ne donne pas : le jour même (fenêtres Batch)
et un suivi des reprises digne de ce nom. La stack 2 donne la meilleure
orchestration et l'admin le plus coûteux à écrire ; la stack 3 l'inverse ; leur
combinaison, Payload pour l'administration et les documents, Trigger.dev pour la
chaîne, répond au besoin tel qu'il est formulé, pour 10 à 50 $ de plus par mois
et un fournisseur de plus. Pour toutes, le vrai plafond du parallélisme est le
palier de débit de l'API Anthropic, qui se demande.

## 4. Comparaison

Notes de 1 (faible) à 5 (fort). « Effort » et « Risque » : 5 = le moins
d'effort, le moins de risque.

| Critère | Actuelle | 1 · API, Notion gardé | 2 · Supabase + Trigger.dev | 3 · Payload | 4 · Auto-hébergé EU | 5 · Managed Agents |
|---|---|---|---|---|---|---|
| Simplification pour l'opératrice | 1 | 3 | 3 | **5** | 3 | 3 |
| **Nombre d'organisations possibles** | 15 à 25 | 200 à 300 (plus de 500 avec Notion Plus et parutions étalées) | plus de 1 000 | plus de 1 000 | 300 à 800 par machine | 200 à 300 |
| Ce qui borne | moteur sur Max | débit Notion par espace, quota Gmail | débit API Anthropic | durée de fonction par lot, débit API | débit API, machine | Notion, Gmail, sessions simultanées |
| Capacité (note) | 1 | 4 | 5 | 5 | 4 | 4 |
| Coût mensuel à 100 organisations (pipeline / agentique) | hors d'atteinte | 770 $ / 3 070 $ | 795 $ / 3 120 $ | 780 $ / 3 080 $ | 750 $ / 3 050 $ | 3 045 $ et plus |
| Effort de migration | 5 | **5** | 2 | 2 | 3 | 4 |
| Risque technique | 2 | **4** | 3 | 3 | 3 | 2 |
| Coût fixe mensuel | 2 | 4 | 3 | 4 | **5** | 4 |
| Coût du modèle maîtrisable (pipeline possible) | 1 | **5** | 5 | 5 | 4 | 2 |
| Souveraineté des données | 2 | 2 | 3 | 2 | **5** | 1 |
| Charge d'exploitation | 4 | 4 | 4 | 4 | 2 | 5 |
| Ce qui survit du dépôt | 100 % | ≈ 100 % | ≈ 80 % | ≈ 70 % | ≈ 90 % | ≈ 100 % |

Lecture : les cinq stacks lèvent le plafond du moteur, de 15 à 25 organisations
vers plusieurs centaines au moins. Les deux qui gardent Notion (1 et 5)
s'arrêtent autour de 200 à 300 ; les trois qui mettent les documents en Postgres
(2, 3, 4) ne sont plus bornées que par le débit API, qui se demande. À 100
organisations, le revenu est de 8 900 € HT par mois et le coût de la stack tient
entre 750 et 795 $ en pipeline, soit moins de 10 % ; en agentique il dépasse
3 000 $, soit un tiers. Une seule stack, Payload, remplace le contrat de prose
par un schéma ; une seule, l'auto-hébergement, répond à un argument commercial
(données en Europe) que les quatre autres ignorent.

## 5. Recommandation

1. **Tout de suite, stack 1** : sortir le moteur de l'abonnement Max vers l'API
   en conception pipeline et Batch, sans rien toucher d'autre. C'est la suite
   exacte de la décision du 16 octobre, cela coûte 2 à 4 semaines, cela
   remplace 200 $ d'abonnement par un coût à l'usage de 4 à 9 $ par organisation
   et par mois, cela porte la borne de 15 à 25 organisations à 200 à 300, et
   cela donne la mesure (`runs.coût`) qui manque à toute décision suivante.
   Deux sièges Notion Plus, en attendant, lèvent la limite à un seul membre.
2. **Au premier trimestre 2027, stack 3** : une fois `SOURCE_ACCES=postgres`
   basculé, retirer Notion au profit de Payload dans le Next.js existant, ce qui
   porte la borne de 200 à 300 organisations à plus de 1 000. C'est la seule stack qui change la vie de
   l'opératrice au quotidien, et le moteur de la stack 1 s'y branche sans
   changement : il écrit un document structuré, Payload le stocke au lieu de
   Notion.
3. **Garder la stack 4 comme option commerciale**, pas comme urgence : le même
   Next.js se déploie sur Scaleway le jour où une collectivité exige des données
   en France ; les lettres en Postgres (stack 3) rendent ce déménagement trivial,
   alors qu'il ne l'est pas tant que le cache distant Vercel porte Notion.
4. **Réévaluer la stack 5** quand la tarification de Managed Agents sera
   publique ; elle est la plus proche du plan actuel et la plus chère par lettre.
5. **Ne pas faire la stack 2** : elle cumule deux migrations de données pour un
   gain que la stack 3 obtient avec un fournisseur de moins.

Ce qui reste à décider avant la stack 1 : le modèle (Opus 5.5 ou Sonnet 5.5,
à départager sur dix lettres réelles passées au validateur et relues), et la
place du collecteur de sources (palier 3 avancé, ou première version qui
réutilise les sources que le référentiel nomme déjà).

## Sources consultées le 21 octobre 2026

Dépôt : `CLAUDE.md`, `docs/decision-portail-moteur.md`, `docs/schema-donnees.md`,
`docs/architecture-notion-headless.md`, `docs/etat-des-api.md`,
`docs/onboarding-organisation.md`, `docs/deploiement-vercel.md`,
`docs/gmail-workspace.md`, `package.json`, `vercel.json`, `lib/env.ts`,
`.claude/skills/`. Tarifs API Anthropic : table du 6 octobre 2026. Prix des
fournisseurs (tiers, à confirmer) : makerkit.dev et dev.to pour Vercel ;
neon.com/pricing, prisma.io et selfhost.dev pour Neon ; makerkit.dev,
jetadmin.io et cloudzero.com pour Supabase ; dev.to et g2.com pour Payload ;
kimmo.suominen.com, deployhandbook.com et vpsbenchmarks.com pour Hetzner ;
tinycommand.com et gend.co pour Notion ; automationatlas.io et suprsend.com
pour Resend et Postmark ; jetadmin.io et ai-toolbox.co pour Claude Max.
