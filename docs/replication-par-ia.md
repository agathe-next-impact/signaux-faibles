# Signaux faibles : spécification de reconstruction par une IA

*24 octobre 2026. État du dépôt au commit de `main` 83c65b2, plus la page
« Exemples » (PR 64).*

Ce document décrit le projet assez précisément pour qu'un agent de code le
reconstruise sans lire tout l'historique. Il dit **quoi** construire, **dans
quel ordre**, et **quelles règles ne se négocient pas**. Les choix de détail
sont dans le code et dans les documents cités ; en cas d'écart, le code et
`CLAUDE.md` font foi, et ce document doit être corrigé.

---

## 0. Mode d'emploi pour l'agent

1. Lire, dans cet ordre : ce document, `CLAUDE.md` (règles non négociables),
   `docs/charte-design.md`, `docs/schema-donnees.md`, `docs/api-veille.md`,
   `docs/programme-lettre-unique.md`.
2. Reconstruire par étapes (§ 20). Chaque étape a un critère de fin vérifiable
   par des tests ; ne pas passer à la suivante avant qu'il soit vrai.
3. Avant tout commit : `pnpm lint && pnpm typecheck && pnpm test`.
4. Tout écrire en français : code métier (identifiants accentués compris,
   `étapeDuParcours`, `contrôlerLaLettre`), commentaires, interface, messages.
   L'interface est en **sentence case** ; seules les étiquettes en police mono
   sont en capitales.
5. Ne jamais inventer une API Notion, Next.js ou Stripe de mémoire : vérifier la
   documentation courante. Les faits vérifiés sont datés dans
   `docs/etat-des-api.md`.

---

## 1. Le produit

**Signaux faibles** est une veille stratégique hebdomadaire vendue à des
organisations (entreprises, cabinets, collectivités, structures de l'ESS).
Chaque semaine, chaque client reçoit **une lettre** : dix à quinze **axes**
thématiques, chacun noté **FORT**, **MOYEN** ou **RAS**, des faits courts,
datés et sourcés, et le suivi de **dossiers ouverts** (concurrents, appels
d'offres, réglementations) d'une semaine sur l'autre.

Le **portail** (`signauxfaibles.io`) est l'espace où le client relit ses
lettres et voit son tableau de bord. Il sert aussi la vitrine commerciale, les
routes appelées par les tâches de production, l'abonnement Stripe et les
courriers.

Prix public : 149 € HT par mois ou 1 490 € HT par an par organisation, trois
lecteurs au plus, essai de trois parutions complètes
(`lib/domaine/offre.ts`, `lib/domaine/parcours.ts`).

---

## 2. Architecture d'ensemble

```
            ┌───────────────────────── production des lettres ─────────────────────────┐
            │                                                                           │
  Dispositif en service :                         Dispositif cible (programme du 22/10) :
  tâches planifiées Claude (Cowork, puis           moteur en code (lib/moteur) exécuté par
  GitHub Actions sur l'API Claude), qui            Trigger.dev, qui prend un travail dans la
  lisent leur prompt dans des pages Notion         file du portail et lui remet la lettre
  et écrivent les éditions dans Notion             en Markdown
            │                                                   │
            ▼                                                   ▼
     Notion (documents)                              Payload CMS 3 (schéma Postgres `payload`)
     base « Éditions de veille »                     collections éditions, organisations…
     base « Accès portail »                                     │
            │                                                   │
            └──────────────► lib/documents (façade, SOURCE_DOCUMENTS) ◄───────┘
                                       │
                         Portail Next.js 16 sur Vercel
              écrans client · vitrine · /api/veille/* · webhooks
                                       │
                          Postgres Neon (Drizzle) : l'état
        organisations · veilles · lecteurs · abonnements · courriers ·
        prospections · travaux · runs
                                       │
                 Gmail (API Workspace, compte de service) · Stripe · lemlist
```

Trois principes structurent tout le reste :

- **Notion (ou Payload) porte les documents, Postgres porte l'état.** Postgres
  ne contient jamais le corps d'une lettre, seulement des identifiants.
- **Le portail ne devine rien.** Le format de la lettre est un contrat ; ce qui
  ne le respecte pas n'est pas affiché, et un validateur (`lint`) le dit avant
  l'envoi.
- **Le cloisonnement entre clients est dans le code**, sans RLS : chaque lecture
  est filtrée par l'identifiant d'organisation de la personne connectée, et
  rien d'autre.

---

## 3. Stack exacte

| Brique | Version | Rôle |
|---|---|---|
| Next.js | 16.3 (App Router, `cacheComponents`, `proxy.ts`) | portail et API |
| React | 19.2 | interface |
| TypeScript | strict | tout le code |
| Tailwind CSS | v4, jetons dans `app/globals.css` (`@theme`) | style, jetons tirés de la charte |
| `@notionhq/client` | 5.26, API Notion `2025-09-03` (`dataSources.query`) | lecture des éditions et des accès |
| Postgres | Neon, pilote `@neondatabase/serverless` 1.2 en `Pool` | état |
| Drizzle ORM | 0.45, `drizzle-kit` | schéma et migrations SQL |
| Payload CMS | 3.91 (`@payloadcms/next`, `db-postgres`, `richtext-lexical`) | registre et documents cibles, admin `/admin` |
| Trigger.dev | SDK 4.7 | exécution des runs du moteur |
| Stripe | SDK 23 | abonnement, Checkout, portail de facturation |
| zod | 4.5 | validation des entrées des routes |
| `@anthropic-ai/sdk`, `@anthropic-ai/claude-agent-sdk` | dev | moteur, évaluations, tâches sur l'API |
| Vitest, PGlite, Playwright | dev | tests unitaires sur vraie base Postgres en mémoire, recette |
| Polices | `next/font/google` : Lora (titres), Public Sans (corps), IBM Plex Mono (dates, sources, étiquettes, `weight` explicite) | charte |

Hébergement : Vercel (projet unique, deux crons dans `vercel.json`),
Neon rattachée au projet Vercel.

---

## 4. Arborescence et responsabilités

| Dossier | Contenu | Règle |
|---|---|---|
| `app/(portail)/` | écrans : vitrine (`/`, `/offre`, `/tarifs`, `/exemple`, `/demo`), accès (`/acces/[jeton]`, `/recevoir-mon-lien`, `/quitter`), espace client `/[slug]/…`, opératrice `/espaces/…` | aucun accès direct à Postgres ni à Notion : passer par `lib/` |
| `app/api/veille/` | routes du dispositif, gardées par jeton | jamais appelées par un navigateur |
| `app/api/webhooks/` | Notion, Stripe, lemlist | signature vérifiée avant tout |
| `app/api/acces/ouvrir` | envoi du lien d'accès à une adresse | jeton d'activation |
| `app/api/media/[block_id]` | proxy des images Notion | vérifie l'appartenance avant toute lecture |
| `app/(payload)/` | admin et API Payload | |
| `lib/domaine/` | logique pure : document, axes, dossiers, mentions, fraîcheur, synthèse, parcours, calendrier, troncature, Markdown | sans entrée-sortie, entièrement testée |
| `lib/notion/` | client, schéma attendu, lectures cachées | seul endroit qui appelle Notion |
| `lib/base/` | schéma Drizzle et requêtes | **seul** endroit qui lit ou écrit Postgres |
| `lib/documents/` | façade de lecture des documents, aiguillée par `SOURCE_DOCUMENTS` (`notion` ou `payload`) | |
| `lib/auth/` | jeton HMAC, session, appartenance, façade d'accès (`SOURCE_ACCES`) | |
| `lib/portail/` | orchestration : lint, file de travaux, courriers, parcours, prospection, abonnement, lecture | |
| `lib/moteur/` | production d'une lettre en code | n'écrit nulle part, rend une production |
| `lib/email/` | gabarit HTML à la charte, Gmail, lettres en courriel | seul gabarit pour un client |
| `lib/stripe/`, `lib/lemlist/` | clients et webhooks | |
| `lib/payload/` | collections et accès Payload | |
| `lib/vitrine/` | contenus des démonstrations | fictifs |
| `components/` | composants d'interface ; `coquille.tsx` porte `Grille` et `Case` (seul endroit qui dessine une grille) | |
| `trigger/` | tâches Trigger.dev | lisent et remettent par le portail |
| `scripts/` | migrations, import des accès, évaluations, tâches sur l'API (`scripts/taches/`), collecte en code (`scripts/collecte/`) | |
| `drizzle/` | migrations SQL 0000 à 0010, relues et commitées | |
| `.claude/` | permissions, six commandes d'onboarding (`skills/`), agents `collecteur-veille` et `redacteur-veille` | |
| `tests/` | Vitest, dont `architecture.test.ts` | les gardes d'architecture |

---

## 5. Modèle de données

### 5.1 Notion (documents, dispositif en service)

Deux bases seulement sont partagées avec l'intégration du portail :

- **Éditions de veille** : Titre, Organisation (**relation** vers le registre ;
  le portail ne reçoit que des identifiants), Veille (nom affiché), Date
  d'édition, Numéro, Statut (Brouillon, Relu, **Envoyé** = publié), Période
  couverte, Fenêtre élargie, Dossiers ouverts suivis (texte), Action de la
  semaine, et trois propriétés internes jamais affichées : Famille,
  Amendements au référentiel, Livraison. Le corps de la page **est** la lettre.
- **Accès portail** (nom exact dans Notion : `Accès — portail`) : Nom, Email, Organisation (libellé), Identifiant Notion
  de l'organisation (la clé de cloisonnement), Slug, Identifiant d'accès,
  Actif, Tous les espaces (accès opérateur).

Le portail garde la liste des propriétés attendues (`lib/notion/schema.ts`), la
confronte au schéma réel et refuse de démarrer si une propriété manque.

Jamais partagés avec le portail : le registre des organisations, les
validations, les référentiels, les pages de prompt des tâches.

### 5.2 Postgres (état, `lib/base/schema.ts`)

| Table | Contenu | Écrite par |
|---|---|---|
| `organisations` | slug, nom, `registre_notion` (clé de cloisonnement), état (`demande`, `generation`, `essai`, `abonnee`…), offre (`standard`, `early_adopter`, `gratuite`), dates d'essai (`essai_ouvert_le`, `activée_le` = J0), parutions d'essai, relecture requise, entrée par prospection | `lib/base/organisations.ts`, réglages de l'opératrice |
| `veilles` | jour, heure de Paris, cadence (`hebdomadaire`, `bimensuelle`, `mensuelle`), numéro courant, état | `POST /api/veille/veilles`, file |
| `lecteurs` | nom, adresse, identifiant d'accès, rôle (`lecteur`, `relecteur`, `operateur`), actif ; trois actifs au plus par organisation | import des accès, `POST /api/veille/lecteurs`, « Mon abonnement » |
| `abonnements` | copie de l'abonnement Stripe, une ligne par abonnement, ordre des événements absorbé | **seul** le webhook Stripe |
| `courriers` | journal de chaque envoi ou brouillon : sorte, état (`prevu`, `envoye`, `echec`, `brouillon`), empreinte de l'adresse (jamais l'adresse), clé d'unicité | `envoyerCourrier` |
| `prospections`, `événements_prospection` | état d'un prospect et journal des webhooks lemlist | `lib/portail/prospection.ts` |
| `travaux` | file : type (`referentiel`, `premiere_lettre`, `lettre`, `revue`), état (`a_faire`, `pris`, `accepte`, `refuse`, `abandonne`), échéance, numéro attribué | `lib/base/travaux.ts` depuis `lib/portail/file.ts` |
| `runs` | journal unique des exécutions (coût, durée, verdict) | idem |

Migrations : `pnpm base:generer <nom>` puis relecture et commit du SQL ;
application par `pnpm base:migrer`, et **par le build de production lui-même**
(`tsx scripts/base-migrer.ts --deploiement && next build`). Le contrôle du soir
signale toute migration en attente.

### 5.3 Payload (dispositif cible)

Collections `editions`, `organisations`, `referentiels`, `filieres`,
`prospects`, `gels`, `utilisateurs` (`lib/payload/collections/`), dans le schéma
Postgres `payload`. Les écrans lisent Payload quand `SOURCE_DOCUMENTS=payload`.

---

## 6. Le contrat de la lettre

C'est la pièce centrale : le portail tire tout son affichage de la **forme** de
la lettre. Le même contrat est appliqué par le validateur
(`lib/portail/lint.ts`, `contrôlerLaLettre`), par le moteur (portes) et par les
tests.

### 6.1 Forme unique (cible, programme du 22 octobre 2026)

```markdown
# L'essentiel
- 8 lignes au plus, 140 caractères au plus chacune, lisible seule.

# Actualités par axe

## ① Nom de l'axe — FORT
Fait daté (jour et mois), 280 caractères et 2 phrases au plus. ([libellé](https://source))

Second fait… ([libellé](https://source))

## ② Autre axe — RAS
> Encadré court (200 caractères au plus) : ce qui a été vérifié sans résultat.

# Dossiers suivis
Un paragraphe par dossier ouvert, qui le nomme exactement comme la propriété.
```

Seuils (`LETTRE_UNIQUE`) : 10 à 15 axes, 3 faits par axe au plus, 2 phrases et
280 caractères par fait (source exclue), 200 caractères pour un RAS, 1 400 mots
pour la lettre entière. Chaque fait porte une date lisible et un lien.

### 6.2 Règles de forme communes

- **Axe** = titre de niveau 2 terminé par un tiret cadratin et le niveau, écrits
  littéralement `— FORT`, `— MOYEN` ou `— RAS`. **Trois niveaux et trois seulement ; FAIBLE n'existe pas.** Un
  suffixe inconnu s'affiche sans badge et n'est jamais converti.
- Les numéros cerclés (①…) sont détachés du titre (`lireTitreDAxe`) et
  recomposés en indice mono : les polices de la charte ne les dessinent pas.
- **Ce qui est encadré n'est pas un fait** (`callout` Notion, `>` en Markdown) :
  méthode, absence, sources muettes. Le portail ne cite jamais un encadré hors
  de la lettre.
- **Dossiers ouverts suivis** : une ligne `nom (compteur, précision) · nom
  (compteur)`. Le compteur est un entier entre parenthèses, **obligatoire** ; 0
  signifie que le dossier a bougé, N le nombre de semaines sans mouvement. Sans
  compteur, l'acteur disparaît du tableau de bord.
- Une rubrique dont le titre contient le mot **cadrage** (entier) et la rubrique
  « acteurs que nous suivons » sont **détachées à la construction** et
  rendues sur l'écran Périmètre ; un trait `---` ferme la section détachée.
- Depuis le 22 octobre 2026, la lettre ne porte plus le rapport de collecte ni
  le bloc de cadrage (le validateur l'avertit).

### 6.3 Le validateur

`POST /api/veille/lint { page }` relit la page avec le parseur de production et
rend `conforme`, `ruptures` (bloquantes) et `avertissements`. Aucune lettre ne
part tant que `conforme` est faux. Le moteur applique la même fonction sur
`markdownVersBlocs`.

---

## 7. Le domaine (`lib/domaine/`)

| Module | Rôle |
|---|---|
| `document.ts` | `construireDocument(blocs)` : préambule, rubriques (H1), axes (H2 avec niveau), cadrage et acteurs suivis détachés ; `faitsDe`, `fusionnerLesAxes`, `pointsDAxe`, `phrasesDe`, extraits avec `segments` (mise en forme conservée) |
| `markdown.ts` | `markdownVersBlocs` : Markdown vers blocs au format Notion (titres, puces, encadrés `>`, tableaux, liens, gras) |
| `dossiers.ts` | lecture de la propriété des dossiers, ordre (ce qui vient de bouger d'abord) |
| `mentions.ts` | `mentionsDe(nom, document)` : phrases qui nomment un dossier, recherche bornée aux mots, accents et casse ignorés, jusqu'à deux mots courts intercalés ; `acteursEnVue` : deux portes (nommé dans les trois dernières lettres, ou compteur à zéro) |
| `fraicheur.ts` | trois états `nouveau`, `suivi`, `dormant`, communs aux axes et aux acteurs |
| `impact.ts` | niveaux et tri par impact (stable) |
| `synthese.ts` | chiffres de la semaine : axes par niveau, dossiers, dossiers en attente |
| `semaines.ts`, `calendrier.ts` | regroupement par lundi de semaine ISO ; sélection des parutions du jour en heure de Paris |
| `parcours.ts` | `étapeDuParcours` : étape calculée, jamais stockée (essai J0, J+7, J+14, « L'essentiel » seul à J+21, suspension ; offres) |
| `troncature.ts` | `tronquerÀLEssentiel` : retire tout sauf « L'essentiel » **à la construction**, pour que rien n'atteigne le HTML |
| `texte.ts` | conventions de titres (`estTitreDeCadrage`), seuils de « L'essentiel » |
| `offre.ts` | prix, TVA, lecteurs |

---

## 8. Les écrans

**Espace client** (`/[slug]`, sept écrans, pas d'autre sans décision) :

1. **Vue d'ensemble** : quatre tuiles (axes, signal fort, acteurs, sans
   mouvement), action de la semaine, « À la une » (dossiers en vue), «
   L'écosystème » (axes fusionnés, triés par impact).
2. **Lettres** : grille de toutes les lettres, et `/lettres/[edition]` pour en
   lire une.
3. **Les axes** : grille des axes avec leur fraîcheur ; `/axes/[axe]` sur les
   quatre dernières lettres.
4. **Acteurs** : suivi des dossiers sur toute l'archive, **sans lire aucun
   corps** ; `/acteurs/[acteur]` avec les mentions.
5. **Recommandations**.
6. **Archives** : une entrée par semaine.
7. **Périmètre** : cadrage et acteurs suivis détachés.

Hors des sept : `/[slug]/abonnement` (Postgres seul, toujours ouvert),
`/espaces` (sélecteur opérateur), `/espaces/abonnements`, `/espaces/file`.

**Vitrine** (publique, indexable, ouverte par le proxy à l'adresse exacte) :
`/`, `/offre`, `/tarifs`, `/exemple` (trois organisations fictives en onglets,
tableau de bord et lettre), `/demo` (formulaire de demande).

**Règles d'interface de la charte** : grilles à angle droit et sans gouttière,
cases qui se touchent ; une case qui porte un badge reste sur fond blanc ; une
case cliquable l'est en entier par un seul lien étendu ; pastille carrée pour
la fraîcheur ; un seul bouton primaire par écran (« Se connecter » de la vitrine
est l'exception décidée le 23 octobre) ; jetons de couleur dans
`app/globals.css` (encre `#111418`, rose `#dd768a`, ardoise `#5d6b7f`, gris de
filet `#dee3e6`, fonds teintés).

**Mode dégradé** : profil de cache à expiration longue ; pages de secours dans
la charte (`components/page-de-secours.tsx`) qui n'affichent jamais le message
technique.

---

## 9. Accès et cloisonnement

- **Lien magique persistant**, un par personne : le jeton est l'identifiant
  d'accès suivi de sa signature HMAC-SHA256 (`ACCES_SECRET_HMAC`), comparée en
  temps constant (`lib/auth/jeton.ts`). `/acces/[jeton]` pose un cookie de
  douze mois (`httpOnly`, `Secure`, `SameSite=Lax`) et redirige aussitôt ; le
  jeton n'apparaît nulle part ailleurs.
- **Appartenance** : lue par la façade `lib/auth/source-acces.ts`, aiguillée par
  `SOURCE_ACCES` (`notion`, `double`, `postgres`). Contrôle dans `proxy.ts` et
  dans le layout, **avant** tout appel caché.
- **Cloisonnement** : toute requête sur les éditions porte le filtre
  `Organisation contains <registre_notion>` **et** `Statut = Envoyé` ; jamais de
  requête globale filtrée en mémoire, jamais de filtre par nom ; une fonction
  cachée ne reçoit jamais l'identité de l'utilisateur.
- **Accès opérateur** (case « Tous les espaces ») : seule exception, tenue dans
  `lib/auth/appartenance.ts` ; bandeau visible sur l'écran ; visite journalisée.
- **Révocation** : case « Actif » décochée, effective à la requête suivante.
- **Envoi du lien** : « recevoir mon lien » et `POST /api/acces/ouvrir`, un envoi
  par adresse et par dix minutes, cinq par origine, temps de réponse plancher
  commun pour ne pas trahir qu'une adresse est connue.
- **Aucune adresse de lecteur dans les journaux** : empreinte de huit caractères.

---

## 10. Cache et lectures Notion

- Toute lecture Notion est dans une fonction `'use cache: remote'`, profil
  unique `notion` : `stale` 5 min, `revalidate` 1 h, `expire` 30 jours.
- Étiquettes `page:<page_id>` et `liste:<data_source_id>`.
- Débit Notion : 3 requêtes par seconde ; le coût d'un écran se compte en corps
  de lettres lus (la vue d'ensemble lit la semaine courante et la précédente ;
  une page d'axe, quatre lettres au plus).
- **Invalider est un pouvoir**, tenu en cinq endroits qui vérifient chacun
  quelque chose : webhook Notion (signature), bouton « resynchroniser »
  (opérateur), `/api/acces/ouvrir` (jeton), `/api/veille/lint` et
  `/api/veille/resultat` (jeton). Un écran n'invalide jamais au rendu.
- Les URL de fichiers Notion expirent en une heure : les images passent par
  `/api/media/[block_id]?page=…`, qui vérifie l'appartenance d'abord.

---

## 11. Routes du dispositif (`/api/veille/*`)

Gardées par `ACTIVATION_SECRET` (en-tête `Authorization: Bearer`) ou
`CRON_SECRET`, **avant** toute lecture de l'environnement. Détail dans
`docs/api-veille.md`.

| Route | Rôle |
|---|---|
| `calendrier` | parutions du jour à partir des lignes que la tâche fournit |
| `contexte` | numéros à porter et anti-doublon, par famille |
| `lint` | contrat de forme d'une page, expire son cache |
| `courriel` | met une lettre ou un message à la charte ; option `brouillon` : dépose le brouillon Gmail chez l'opératrice |
| `etat` | contrôle du soir des espaces (cron 17 h 30 UTC, jours ouvrés) |
| `parcours` | passage quotidien (cron 8 h UTC) : J0, courriers d'essai en brouillons, synchronisation lemlist, planification des travaux |
| `organisations` | entrée en essai (`POST`), réglages de l'opératrice (`PATCH`) |
| `importer-acces`, `lecteurs` | alignement de Postgres sur Notion ; écriture des lecteurs après la bascule |
| `veilles`, `travaux`, `dossier`, `resultat`, `editions` | file de travaux : déclarer, prendre, lire le dossier, remettre une page Notion ou une lettre Markdown |
| `courriers`, `prospection` | journal des courriers ; état des prospections |
| `referentiels`, `prospects` | remise d'un référentiel unique (relu par le lecteur du moteur) ; remise du bloc personnalisé d'un prospect |
| `migrer` | crée ou met à jour les tables de la base du portail |

Webhooks : `notion` (signature du SDK, réponse 2xx immédiate, `revalidateTag`
seulement, jamais d'email), `stripe` (seul écrivain de `abonnements`, mode
vérifié), `lemlist` (secret comparé en temps constant).

---

## 12. Abonnement et parcours d'essai

- Stripe est la seule source de vérité ; `abonnements` en est la copie.
- L'étape n'est jamais stockée : `étapeDuParcours` la calcule de J0, de l'état
  de l'organisation et de l'état Stripe.
- **Droit de lecture** (`lectureDeLEspace`) : complet dans le doute ; en fin
  d'essai, les écrans assemblés renvoient à la vue d'ensemble (`FinDEssai`), les
  lettres restent lisibles réduites à « L'essentiel ».
- Souscription par Stripe Checkout et portail de facturation, ouverts par deux
  actions serveur ; aucune n'écrit dans Postgres.
- J0 est posé par le passage quotidien à la première lettre publiée, jamais à la
  main ; l'opératrice peut le décaler (`prolonger`).

---

## 13. Courriers

- Tout envoi passe par `envoyerCourrier` : réservation d'une ligne du journal
  **avant** l'appel à Gmail, puis conclusion.
- Gmail : compte de service avec délégation limitée à `gmail.send` et
  `gmail.compose`, boîte émettrice dédiée ; pas de SMTP.
- **Courriers commerciaux en brouillons**, jamais envoyés par le portail :
  l'opératrice relit et envoie. Unicité par clé.
- Partent directement : le lien d'accès, l'alerte du soir, la demande de démo.
- Tout courriel client sort du gabarit unique `lib/email/gabarit.ts`
  (`multipart/alternative`) ; aucun modèle n'écrit de HTML pour un client.

---

## 14. Production des lettres

### 14.1 Moteur en code (`lib/moteur/`, cible)

1. **Sélection** et **collecte** en code : ouverture des sources du référentiel,
   dates vues, requêtes types (`collecte.ts`, `recherche.ts`, `grille.ts`).
2. **Rédaction** : un seul appel au modèle en sortie structurée, sans outil ;
   le modèle ne peut citer qu'une URL du dossier de collecte (`redaction.ts`).
3. **Portes** mécaniques (`portes.ts`) : contrat de forme, citations, dates,
   vocabulaire interdit ; un manquement devient un message de reprise, deux
   reprises au plus.
4. **Assemblage** en Markdown et remise au portail (`assemblage.ts`,
   `remise.ts`) ; `produire.ts` enchaîne le tout et n'écrit nulle part.

### 14.2 File de travaux (`lib/portail/file.ts`)

Le portail décide quoi produire : une veille déclarée donne un travail `lettre`
par parution. `prendre` réserve le plus ancien travail échu ; la remise est
contrôlée (organisation, numéro, lint, verdict) **avant** toute écriture ;
accepté, le numéro courant avance dans la même transaction ; refusé, le travail
redevient prenable, abandonné au troisième refus ; un travail pris sans
conclusion revient après trois heures.

### 14.3 Trigger.dev (`trigger/`)

`vider-la-file` (heures ouvrées) confie chaque travail à `produire-la-lettre` ;
`lettres-de-filiere` le lundi à 6 h ; `onboarding`, `edition-de-decouverte`,
`bloc-personnalise` pour les paliers commerciaux. Toutes lisent et remettent par
le portail ; aucune n'écrit ailleurs.

### 14.4 Dispositif en service (Notion)

Cinq tâches (lettres, réconciliation, revue, balayage, première lettre) dont le
prompt est un pointeur vers une page Notion qui fait foi. Elles tournent par
GitHub Actions sur l'API Claude (`pnpm tache <tâche>`, `scripts/taches/`) :
garde des outils (`garde.ts`), outils maison pour Gmail et le portail qui
gardent les secrets hors du contexte (`outils.ts`), sous-agents de lecture
(Haiku) et de collecte (Sonnet), mesure du coût par exécution. Les commandes
`/onboarding-*` de `.claude/skills/` font la même chose à la main.

---

## 15. Variables d'environnement

| Variable | Usage |
|---|---|
| `PORTAIL_URL` | adresse publique (toujours avec `www.`) |
| `NOTION_TOKEN`, `NOTION_BASE_EDITIONS`, `NOTION_BASE_ACCES`, `NOTION_WEBHOOK_SECRET` | Notion |
| `ACCES_SECRET_HMAC` | signature des liens d'accès ; ne quitte jamais le portail |
| `ACTIVATION_SECRET`, `CRON_SECRET` | gardes des routes du dispositif |
| `DATABASE_URL` | Postgres, lue directement dans `process.env` |
| `SOURCE_ACCES`, `SOURCE_DOCUMENTS` | aiguillages de migration |
| `GOOGLE_COMPTE_SERVICE_JSON` (ou `_EMAIL` et `_CLE_PRIVEE`), `GMAIL_EXPEDITEUR`, `GMAIL_EXPEDITEUR_NOM`, `GMAIL_BOITE_OPERATRICE`, `RELECTEUR_EMAIL` | Gmail |
| `STRIPE_MODE`, `STRIPE_CLE_SECRETE`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRIX_MENSUEL`, `STRIPE_PRIX_ANNUEL`, `STRIPE_PRIX_EARLY_ADOPTER`, `STRIPE_TAUX_TVA` | Stripe |
| `LEMLIST_API_KEY`, `LEMLIST_WEBHOOK_SECRET` | prospection |
| `PAYLOAD_SECRET` | Payload |
| `TRIGGER_SECRET_KEY` | Trigger.dev |
| `ANTHROPIC_API_KEY`, `NOTION_MCP_TOKEN` | moteur et tâches sur l'API |
| `ADRESSE_POSTALE` | pied des courriels |

Règle : une variable facultative posée vide vaut une variable absente
(`lib/env.ts`, `facultative`). Une pièce Stripe manquante rend la souscription
« indisponible » sans faire tomber de page.

---

## 16. Tests et gardes

- Vitest sur une **vraie base Postgres en mémoire** (PGlite,
  `tests/aide/base-en-memoire.ts`) avec les migrations du dépôt.
- `tests/architecture.test.ts` vérifie les frontières par analyse du code :
  Postgres seulement depuis `lib/base/`, un seul écrivain par table sensible,
  `organisationDuSlug` et `espacesOuverts` seulement depuis
  `lib/auth/appartenance.ts`, aucune invalidation au rendu, ordre réservation
  puis envoi des courriers, aucune adresse dans les journaux, gabarit unique,
  droit de lecture appelé par chaque écran assemblé, ordre des vérifications du
  proxy des médias.
- Fixtures de lettres réelles (`tests/fixtures/`) pour les mentions et le
  parseur.
- Playwright pour la recette : un compte par client, et vérification qu'aucune
  donnée d'un client n'apparaît dans le HTML d'un autre.

---

## 17. Déploiement

- Vercel, framework Next.js ; build = migrations Postgres de production puis
  `next build` (sans effet en aperçu ni en local).
- Crons : `/api/veille/etat` à 17 h 30 UTC les jours ouvrés, `/api/veille/parcours`
  à 8 h UTC chaque jour.
- Domaine : l'apex redirige vers `www.` ; tout client HTTP doit viser `www.`,
  sinon la redirection perd l'en-tête d'autorisation.
- En-têtes de `next.config.ts` : HSTS un an, politique de contenu bornée à
  l'origine.
- Trigger.dev déployé séparément (`trigger.config.ts`), Payload migré par
  `pnpm payload:migrer`.

---

## 18. Ce qui n'est pas dans le dépôt

Pour reproduire le **service**, et pas seulement le code, il faut aussi :

- les pages Notion de prompt des tâches (« Tâche Lettres de veille », «
  Onboarding d'une organisation », « Réconciliation des envois », « Revue
  mensuelle des référentiels ») et le prompt de génération des référentiels ;
- un **référentiel** par client : familles de sources (une famille = un axe),
  critères FORT et MOYEN, corpus d'acteurs, requêtes types, gabarit de lettre ;
- le registre des organisations (intake) ;
- les comptes : Notion (plan Business pour le serveur MCP hébergé), Google
  Workspace (compte de service et délégation), Stripe (prix), Vercel, Neon,
  Trigger.dev, lemlist (facultatif), clé API Anthropic.

---

## 19. Pièges avérés

Chacun est arrivé en production ; la règle qui l'empêche est dans le code ou
dans `CLAUDE.md`.

| Date | Incident | Règle qui en découle |
|---|---|---|
| 10/09/2026 | espace vide : l'identifiant de la page organisation collé à la place de celui de la ligne du registre | la clé est l'identifiant de la ligne du registre, vérifiable en dix secondes |
| 11/09/2026 | ligne d'accès dupliquée : deux lignes pour un même identifiant, les deux liens refusés | identifiant neuf à chaque lecteur |
| 11/09/2026 | tableau de bord vide sur deux lettres complètes : axes sans titre de niveau 2, dossiers sans compteur entre parenthèses | contrat de forme bloquant, validateur, journal `[contrat]` |
| 12/09/2026 | espace « vide » qui n'était qu'une lettre restée en Brouillon | vérifier le statut avant l'identifiant |
| 18/10/2026 | migration partie sans être appliquée, onboarding en erreur SQL 42703 | migrations appliquées par le build de production |
| 20/10/2026 | lien d'accès envoyé avant toute lettre publiée : espace vide | le lien part après la première publication |
| 23/10/2026 | attente de 58 minutes sur une écriture Notion d'un agent | la politique d'outils du connecteur, dans claude.ai, prime sur les règles du dépôt |
| 23/10/2026 | vitrine disparue au déploiement de `main` | une branche déployée à la main doit être fusionnée avant le déploiement suivant |

---

## 20. Ordre de reconstruction

| Étape | Livrable | Critère de fin |
|---|---|---|
| 1 | Projet Next.js 16 strict, Tailwind v4 avec les jetons de la charte, polices, ESLint, Vitest | `pnpm lint`, `typecheck`, `test` passent à vide |
| 2 | `lib/domaine/` : document, Markdown, dossiers, mentions, impact, fraîcheur, synthèse, semaines | tests unitaires sur les fixtures de lettres réelles |
| 3 | Validateur `contrôlerLaLettre`, formes double et unique | une lettre conforme passe, chaque rupture a son test |
| 4 | Lectures Notion cachées (`lib/notion/`), schéma attendu, webhook | une édition `Envoyé` se lit, une `Brouillon` jamais |
| 5 | Jeton HMAC, session, proxy, appartenance, accès opérateur | un lecteur ne voit que son organisation ; test de non-fuite |
| 6 | Les sept écrans et la page de lettre | captures conformes à `docs/maquette-edition.html` |
| 7 | Postgres : schéma, migrations 0000 à 0010, façade d'accès, PGlite en test | gardes d'architecture vertes |
| 8 | Routes `/api/veille/*`, crons, contrôle du soir | chaque route refuse sans jeton, rend son contrat avec |
| 9 | Courriers et gabarit, Gmail, brouillons | réservation puis envoi ; aucun envoi commercial direct |
| 10 | Abonnement Stripe, parcours d'essai, troncature, « Mon abonnement » | étapes J0 à suspension testées, rien de tronqué dans le HTML |
| 11 | Prospection (lemlist ou Gmail), demande de démo | première visite = activation |
| 12 | File de travaux, Payload, moteur, Trigger.dev | une lettre produite passe les portes et la remise |
| 13 | Vitrine : accueil, offre, tarifs, exemples, démo | pages publiques à l'adresse exacte, aucune donnée réelle |
| 14 | Tâches sur l'API Claude et commandes d'onboarding | `pnpm tache controle` vert |

---

*Ce document se corrige à chaque décision qui change une règle de ce tableau ;
les décisions datées vivent dans `CLAUDE.md` et `docs/`.*
