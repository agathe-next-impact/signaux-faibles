# Proposition : lancer et suivre l'onboarding depuis le tableau de l'opératrice

1er novembre 2026. Proposition **acceptée par l'opératrice le même jour**, avec
les cinq décisions du §9 (tranchées, voir §10). Elle tient lieu de la discussion
qu'appelle tout nouvel écran. **Lots 1, 2 et 3 codés le 1er novembre 2026** (§10 à
§12, avec leurs écarts à la proposition).

## 1. Le constat

Aujourd'hui, un onboarding se pilote depuis **trois endroits qui ne se voient
pas** :

| Où | Ce qu'on y fait |
|---|---|
| Registre Notion « Organisations, pipeline et activation » | statut 1 à 6, cases ▶, propriété « Exécuteur », vue « Créneaux Cowork de la semaine » |
| Claude Code (`/onboarding-demande`, `/onboarding-referentiels`, `/onboarding-repercussion`, `/onboarding-premiere-lettre`, `/onboarding-activation`, `/onboarding-ouvrir-espace`) | chaque étape, côté Cowork |
| GitHub Actions, « Tâches planifiées (API Claude) », « Run workflow » | `balayage` puis `premiere-lettre`, côté API, organisation saisie à la main |

Le tableau de l'opératrice (`/espaces/abonnements`, fiche
`/espaces/abonnements/[slug]`) ne connaît une organisation qu'**à partir de
l'étape B**, quand `POST /api/veille/organisations` la crée à l'état `essai`.
Tout ce qui précède (demande reçue, référentiels générés, en attente de
validation, passage bloqué, coût du run) est invisible dans le portail.

Conséquences observées dans le dépôt :

- l'organisation de l'onboarding se saisit à la main dans le formulaire GitHub,
  alors que `scripts/taches/executer.ts` exige un slug valide (`slugValide`) et
  que `docs/taches-api.md` dit encore « le slug ou, avant le §3, le nom » ;
- le coût d'un onboarding (20,03 $ mesurés sur Mastora le 25 octobre 2026) n'est
  lisible que dans le résumé du job GitHub ;
- l'ouverture d'un espace demande `/onboarding-ouvrir-espace`, alors que la fiche
  de l'organisation sait déjà renvoyer un lien et inscrire un lecteur quand
  Postgres fait foi.

## 2. Ce qui ne change pas (et borne la proposition)

1. **Le portail n'écrit jamais dans Notion et ne lit pas le registre** (stack,
   règle 2). Le tableau ne peut donc ni créer la ligne du registre, ni cocher
   une case ▶, ni passer un statut. Ce sont les tâches qui le font, comme
   aujourd'hui.
2. **La page Notion « Tâche, Onboarding d'une organisation » fait foi.** Le
   portail ne porte aucun prompt : il lance une tâche existante, avec une
   organisation, et lit ce qu'elle lui rapporte.
3. **Toute écriture Postgres passe par `lib/base/`**, depuis une seule
   orchestration (`lib/portail/onboarding.ts`), garde `exigerOpérateur` avant
   toute lecture ou écriture, comme `lib/portail/gestion-actions.ts`.
4. **Le secret HMAC ne quitte pas le portail**, l'ouverture de l'espace reste
   « jamais avant la publication de la première lettre » (décision du
   20 octobre 2026), et le partage Cowork/API (deux créneaux Cowork par
   semaine) reste la règle.
5. **Aucune adresse dans les journaux** : empreinte de huit caractères.

## 3. Le principe : le portail tient le suivi, les tâches tiennent le registre

Le tableau gagne une notion qu'il n'a pas : **l'onboarding**, une ligne
Postgres par demande, née dans le portail. Il sait trois choses par lui-même et
apprend le reste des tâches :

| Étape montrée | D'où le portail la tient |
|---|---|
| Demande enregistrée | la ligne `onboardings` qu'il vient de créer |
| Référentiels générés | **rapport de la tâche** `balayage` (§6) |
| Référentiels validés | **rapport de la tâche** suivante, qui lit le statut 3 dans le registre |
| En essai | `organisations.état = 'essai'` (déjà écrit par l'étape B) |
| Première lettre publiée | une édition `Envoyé` (lecture cachée déjà faite par le contrôle du soir) ou J0 posé |
| Espace ouvert | un lecteur actif et un courrier `lien_acces` envoyé au journal |

Comme `étapeDuParcours`, **l'étape n'est pas stockée** quand le portail peut la
calculer ; seuls les rapports des tâches sont écrits. Une étape calculée ne
peut pas mentir sur un fait que le portail voit.

## 4. Les écrans

Trois ajouts, tous derrière le privilège « Tous les espaces », aucun dans
l'espace d'un client (les sept écrans ne bougent pas) :

### 4.1 `/espaces/onboardings` : la liste

Lien depuis `/espaces`, à côté de « Gérer les abonnements ». Une ligne par
onboarding non terminé (terminé = espace ouvert depuis plus de quatorze jours),
dans l'ordre de l'étape la plus en retard :

- nom, site, exécuteur (API ou Cowork), étape et depuis quand ;
- dernier run : état (en cours, réussi, bloqué), durée, coût, lien vers le job
  GitHub ;
- **le seul geste possible à cette étape**, en bouton (§5) ;
- en tête, les créneaux Cowork de la semaine ISO (n sur 2), calculés sur la
  table, et le coût cumulé des onboardings du mois.

### 4.2 `/espaces/onboardings/nouveau` : la demande

Remplace `/onboarding-demande` pour l'opératrice. Champs : organisation, URL du
site (obligatoires), objectifs de veille (ou « à proposer »), lecteur final et
son adresse, exécuteur (API par défaut ; Cowork refusé au-delà de deux par
semaine, avec le motif). Contrôles faits par le portail **avant** d'écrire :

- anti-doublon sur ce que Postgres connaît (domaine du site et nom, accents et
  casse ignorés, contre `onboardings` et `organisations`) ; l'anti-doublon sur le
  registre reste celui de la tâche, qui seule le lit ;
- slug proposé par `enSlug` du nom, vérifié libre et non réservé (`offre`,
  `tarifs`, `demo`, `exemple`, `espaces` : les vitrines masquent un slug
  identique). C'est ce slug qui part dans `--organisation`, ce qui règle l'écart
  du §1 entre le nom et `slugValide`.

À l'envoi : ligne `onboardings` créée, puis, si l'exécuteur est l'API, lancement
immédiat de `balayage` (§5). Si c'est Cowork, l'écran affiche la commande à
copier (`/onboarding-referentiels <nom>`), puisque le portail ne lance pas
Cowork.

### 4.3 Section « Onboarding » de la fiche `/espaces/abonnements/[slug]`

Dès que l'organisation existe en Postgres, la fiche porte la frise des six
étapes, les runs avec leur coût, et le même bouton que la liste. Une fois
l'espace ouvert, la section se replie (`components/repliable.tsx`).

## 5. Les gestes, et ce que chacun déclenche

| Étape atteinte | Bouton | Ce que fait l'action serveur |
|---|---|---|
| Demande enregistrée | « Générer les référentiels » | lance `balayage` sur le slug |
| Référentiels générés | « Ouvrir la ligne dans Notion » | lien seulement : **la validation reste dans Notion** (§9, point 3) |
| Référentiels validés | « Produire la première lettre » | lance `premiere-lettre` sur le slug |
| Première lettre en brouillon | rien | la relectrice publie, la réconciliation passe en `Envoyé` |
| Première lettre publiée | « Ouvrir l'espace » | si `SOURCE_ACCES=postgres` : inscription du lecteur et lien d'accès par les fonctions déjà en place (`créerLecteur`, `envoyerLeLien` de `gestion-actions.ts`) ; sinon lance `balayage`, qui fait le §1.3 |
| Bloqué | « Relancer l'étape » | relance la même tâche, après lecture du motif |

**Le lancement passe par l'API GitHub**, `POST
/repos/agathe-next-impact/signaux-faibles/actions/workflows/taches.yml/dispatches`,
avec `tache`, `organisation` et une nouvelle entrée `onboarding` (l'uuid de la
ligne). Un seul module l'appelle (`lib/github/workflow.ts`), un seul appelant
(`lib/portail/onboarding.ts`), tenu par `tests/architecture.test.ts` comme
`envoyerMessage`.

Gardes de l'action, dans l'ordre :

1. `exigerOpérateur()` ;
2. l'étape calculée est bien celle du bouton (un formulaire rejoué après coup
   ne relance rien) ;
3. aucun run de cet onboarding en cours depuis moins de trois heures (la même
   durée que la reprise d'un travail de la file) ;
4. réservation d'une ligne `onboarding_runs` à l'état `demande` **avant**
   l'appel GitHub, comme `envoyerCourrier` réserve avant Gmail : un double clic
   trouve la réservation et s'arrête ;
5. appel GitHub, puis conclusion de la ligne (`lance`, ou `echec` avec le code
   HTTP). Une visite opératrice ne lance qu'avec un bandeau qui le dit ; le
   journal porte le nom de l'opératrice, jamais une adresse.

Sans jeton GitHub, ou s'il est refusé, le bouton devient « Indisponible » et
l'écran affiche la commande à lancer à la main : aucune page ne tombe (règle 4,
variable facultative).

## 6. Le retour des tâches

Le portail ne devine pas l'avancement : **c'est le harnais qui le rapporte, pas
le modèle**, pour que le rapport ne dépende pas d'une consigne suivie ou non.

- `scripts/taches/executer.ts`, quand `ONBOARDING` est posé, appelle
  `POST /api/veille/onboardings` (jeton `ACTIVATION_SECRET`, déjà dans le
  workflow) au début (`début`, `GITHUB_RUN_ID`, `GITHUB_RUN_ATTEMPT`) et à la fin
  (`fin`, état de sortie, coût lu dans `mesure.json`, déjà calculé aujourd'hui).
- Un outil de plus dans `scripts/taches/outils.ts`, `rapporter_onboarding`,
  permet à la tâche de donner ce que seul le registre sait : l'identifiant de la
  ligne du registre (lien Notion de l'écran), le statut atteint (2 ou 3), et un
  motif de blocage en une phrase (garde 3.0, porte, email manquant). L'outil
  n'accepte que ces champs, bornés, et l'uuid de l'onboarding du run en cours :
  il ne peut pas écrire sur un autre onboarding.
- Le contrôle du soir signale un run `lance` sans rapport `début` au bout d'une
  heure (`onboarding-sans-nouvelles`) et un onboarding immobile depuis sept jours
  (`onboarding-immobile`), dans la colonne « santé » qui existe déjà.

Côté Cowork, rien ne change pour le moment : un onboarding Cowork apparaît dans
la liste avec ses étapes calculées (essai, publication, ouverture), et ses
étapes A et validation en « non rapportées ». Ajouter l'appel aux commandes
`.claude/skills/onboarding-*` est possible, puisqu'elles ont déjà `curl` vers
`/api/veille/` en outil autorisé ; c'est un lot à part (§8, lot 4).

## 7. Données (migration 0019)

Telle que proposée ; ce qui a été codé, et ses écarts, est au §10.

```
onboardings
  id                 uuid
  organisation_id    uuid null        -- posé dès que l'étape B crée l'organisation
  nom                text  (200)
  slug               text             -- proposé par enSlug, unique
  site               text  (500)
  exécuteur          enum api | cowork
  registre_notion    text null        -- rapporté par la tâche, 32 hexadécimaux
  statut_rapporté    smallint null    -- 2 ou 3, rapporté
  motif_de_blocage   text null (300)
  intake             jsonb null       -- objectifs, lecteur final : voir §9, point 1
  créé_par           text             -- nom de l'opératrice
  créé_le, clos_le

onboarding_runs
  id, onboarding_id, tâche (balayage | premiere-lettre)
  état enum demande | lance | en_cours | reussi | bloque | echec
  run_github bigint null, tentative smallint null
  coût_usd numeric null, début, fin, code_http null
```

Écrivain unique `lib/base/onboardings.ts`. L'adresse du lecteur final, si elle
est gardée (§9, point 1), est effacée de `intake` dès que la tâche rapporte la
ligne du registre : à partir de là, c'est le registre qui la porte, puis
`lecteurs` à l'ouverture. `organisation_id` se raccorde quand
`POST /api/veille/organisations` reçoit le même slug : la route le pose, une
seule fois.

## 8. L'ordre proposé

| Lot | Contenu | Valeur | Risque |
|---|---|---|---|
| 1 | Migration 0019, `POST /api/veille/onboardings`, rapport du harnais, liste en lecture seule, section de la fiche | l'opératrice voit tous les onboardings API et leur coût dans le portail | nul : rien ne se lance depuis le portail |
| 2 | `lib/github/workflow.ts`, boutons « Générer les référentiels », « Produire la première lettre », « Relancer », entrée `onboarding` du workflow | plus de saisie dans GitHub, plus d'erreur de slug | un nouveau pouvoir, borné par les gardes du §5 |
| 3 | Formulaire `/espaces/onboardings/nouveau` | `/onboarding-demande` n'est plus nécessaire pour l'API | dépend du §9, point 1 |
| 4 | « Ouvrir l'espace » depuis le portail (mode `postgres`) ; rapport des commandes Cowork | `/onboarding-ouvrir-espace` n'est plus nécessaire | faible : mêmes fonctions que la fiche |
| 5 | À la bascule `SOURCE_DOCUMENTS=payload` : les boutons passent par `déclencherLOnboarding` (Trigger.dev) au lieu de GitHub, même écran | un seul écran avant et après la bascule | l'aiguillage vit dans `lib/portail/onboarding.ts` seulement |

Chaque lot est mergeable seul. Le lot 1 suffit déjà à supprimer l'aller-retour
vers GitHub pour lire un coût ou un échec.

## 9. Ce qu'il faut trancher

1. **L'intake dans Postgres.** Les objectifs de veille et l'adresse du lecteur
   final sont aujourd'hui dans le registre, « intake confidentiel ». Le
   formulaire (lot 3) doit les tenir quelque part jusqu'à ce que la tâche crée
   la ligne du registre. Trois options :
   - **A (recommandée)** : `onboardings.intake`, lu par la tâche par
     `GET /api/veille/onboardings/<id>` (jeton), effacé dès la ligne du registre
     rapportée ; exception bornée et datée, comme celle des outils
     stratégiques ;
   - B : passer ces champs en entrées du workflow GitHub, sans stockage ; à
     écarter, les entrées d'un `workflow_dispatch` sont recopiées dans les
     journaux du job (le workflow les pose en `env`), lisibles par quiconque a
     accès au dépôt, pendant toute la durée de rétention ;
   - C : pas de formulaire, la demande reste `/onboarding-demande` ; le portail
     ne fait que lancer et suivre (lots 1, 2, 4).
2. **Le jeton GitHub.** Un jeton à granularité fine limité à ce dépôt et à la
   permission « Actions : lecture et écriture », dans Vercel
   (`GITHUB_JETON_ACTIONS`, facultatif), ou une GitHub App dédiée. Le jeton est
   plus simple ; l'App évite qu'il soit rattaché à un compte personnel et qu'il
   expire. Recommandation : jeton pour le lot 2, App si l'onboarding passe en
   libre-service.
3. **La validation des référentiels.** Elle reste dans Notion (recommandé pour
   les lots 1 à 4 : c'est là que l'opératrice lit les référentiels). L'autre
   voie, un bouton « Valider » dans le portail que la tâche suivante reporte au
   registre, déplacerait une décision hors de Notion ; à reprendre au lot 5,
   quand le référentiel vivra dans Payload.
4. **Le lancement à la création.** Lancer `balayage` dès l'envoi du formulaire
   (recommandé : c'est ce que fait la case ▶ A aujourd'hui) ou laisser un second
   clic.
5. **Le plafond de dépense.** Afficher seulement le coût (recommandé au lot 1),
   ou refuser un lancement au-delà d'un budget mensuel d'onboardings posé en
   variable d'environnement.

## 10. Décisions et lot 1 (1er novembre 2026)

**Décisions de l'opératrice, le 1er novembre 2026 :**

1. Intake : **option A**, `onboardings.intake`, effacé dès la ligne du registre
   rapportée (lot 3).
2. Jeton GitHub : **jeton à granularité fine**, limité à ce dépôt et à la
   permission « Actions » (lot 2).
3. Validation des référentiels : **reste dans Notion**.
4. Lancement : **au second clic**. Le formulaire du lot 3 enregistre la demande ;
   « Générer les référentiels » est un geste distinct.
5. Dépense : **bloquer, de façon paramétrable**. `ONBOARDING_BUDGET_MENSUEL_USD`
   (facultative, en dollars, mois de Paris) ; vide, rien n'est bloqué.

**Lot 1, tel que codé :**

- Migration `0019_onboardings` : `onboardings` et `onboarding_runs`, seul
  écrivain `lib/base/onboardings.ts`, seule orchestration
  `lib/portail/onboarding.ts`, seule route `POST|GET /api/veille/onboardings`
  (`docs/api-veille.md`). Étapes calculées et budget, fonctions pures, dans
  `lib/domaine/onboarding.ts`.
- Harnais : `scripts/taches/onboarding.ts` (début, fin, run GitHub) et l'outil
  `rapporter_onboarding` (`scripts/taches/outils.ts`), lié au slug du run ;
  `appeler_portail` refuse la route du suivi (`docs/taches-api.md`).
- Écrans : `/espaces/onboardings` (lien depuis `/espaces`, garde dans
  `listerLesOnboardings`) et la section « Onboarding » de la fiche
  `/espaces/abonnements/[slug]`, repliée une fois l'espace ouvert ; composants
  `components/onboarding-operatrice.tsx`. Lecture seule.
- Garde d'architecture : un écrivain, une route, la garde avant la lecture
  (`tests/architecture.test.ts`).

**Écarts à la proposition, et pourquoi :**

- **Pas de colonne `organisation_id`.** Le raccord à `organisations` se fait par
  le slug, à la lecture : aucune autre route ni table n'est touchée, et un
  onboarding né avant l'étape B se raccorde seul quand elle crée l'organisation.
- **Un onboarding naît au premier run**, par son slug, `créé_par = 'tache'` :
  sans formulaire (lot 3), c'est la seule entrée. Les runs lancés à la main par
  « Run workflow » sont donc suivis dès maintenant.
- **Le budget bloque dès le lot 1**, au début du run et non au clic : le harnais
  demande au portail avant d'ouvrir la session, et s'arrête sur un refus sans
  rien dépenser. Le plafond du run (30 $ pour `balayage`, 40 $ pour
  `premiere-lettre`) doit tenir dans ce qui reste ; un run en cours compte pour
  son plafond, un run muet depuis trois heures ne compte plus. Au lot 2, le
  bouton fera le même contrôle avant d'appeler GitHub.
- **Un état `refuse`** pour un run écarté par le budget, consigné à coût nul.
- **Reporté au lot 2** : les défauts du contrôle du soir
  (`onboarding-sans-nouvelles`, `onboarding-immobile`) ; l'écran dit déjà
  « sans nouvelles » d'un run muet depuis trois heures. **Reporté aux lots 3 et
  4** : les créneaux Cowork de la semaine, qui n'ont de sens qu'avec des
  onboardings Cowork rapportés.

**À faire par l'opératrice pour mettre le lot 1 en service :** rien
d'obligatoire, la migration part avec le build de production. Pour le blocage,
poser `ONBOARDING_BUDGET_MENSUEL_USD` dans Vercel (production) et redéployer.

## 11. Lot 2 (1er novembre 2026)

**Tel que codé :**

- `lib/github/workflow.ts`, seul module qui parle à GitHub :
  `POST /repos/{dépôt}/actions/workflows/taches.yml/dispatches`, version d'API
  `2026-03-10` (documentation lue le même jour : réponse 200 avec
  `workflow_run_id` et `html_url` ; un 204 sans corps est aussi accepté).
  Jeton `GITHUB_JETON_ACTIONS` (décision 2), dépôt et branche réglables.
- Le geste, fonction pure `gesteDisponible` (`lib/domaine/onboarding.ts`) : un
  seul par étape, aucun pendant un run en cours ni pour un onboarding Cowork,
  « Relancer » sur un blocage avant la publication.
- `lancerDepuisLePortail` (`lib/portail/onboarding.ts`), appelée par la seule
  action `lancerUneÉtapeDOnboarding` (`lib/portail/onboarding-actions.ts`,
  `exigerOpérateur` d'abord), dans l'ordre du §5 : jeton, étape calculée égale
  au geste du bouton, réservation (`réserverUnLancement` : run en cours et
  budget, sous le verrou du budget), appel à GitHub, conclusion
  (`conclureUnLancement`, `lance` ou `echec` avec le code).
- Workflow : entrée `lancement`, posée en `LANCEMENT` ; le harnais la renvoie au
  début, qui reprend la ligne réservée.
- Migration `0020_onboardings_lancement` : `code_http` et `lancé_par` sur
  `onboarding_runs`.
- Contrôle du soir : `onboarding-sans-nouvelles` et `onboarding-immobile`, dans
  la colonne « santé » et dans l'alerte du soir.
- Écrans : le bouton du geste et le message de son issue, sur la liste et sur la
  fiche ; sans jeton, la commande à lancer à la main.

**Écarts :**

- **L'entrée du workflow s'appelle `lancement`**, et porte l'identifiant de la
  ligne réservée, non celui de l'onboarding : c'est ce qui permet au début du run
  de reprendre exactement la réservation et de ne pas compter son plafond deux
  fois.
- **Le budget est contrôlé deux fois** : au clic (rien n'est déclenché) et au
  début du run (rien n'est dépensé), parce qu'un run peut aussi partir de GitHub.
- **« Ouvrir l'espace » reste au lot 4**, comme prévu ; à l'étape « Première
  lettre publiée », l'écran renvoie à `/onboarding-ouvrir-espace`.

**À faire par l'opératrice :** créer le jeton et le poser dans Vercel
(`docs/taches-api.md`, « Lancer depuis le portail »). La migration 0020 part
avec le build de production.

## 12. Lot 3 (1er novembre 2026)

**Tel que codé :**

- `/espaces/onboardings/nouveau` (lien « Enregistrer une demande » sur la
  liste ; garde dans `lireLeFormulaireDeDemande`) : organisation, adresse du
  site, slug facultatif (dérivé du nom), objectifs de veille (vide ou « à
  proposer » : l'étape A formule l'hypothèse), lecteur final et son adresse,
  exécuteur. Formulaire client sur `useActionState` : en cas de refus, les
  valeurs reviennent du serveur, jamais par l'URL.
- Porte pure `contrôlerLaDemande` (`lib/domaine/onboarding.ts`) : champs requis,
  bornes, site en http(s), slug valide et hors de `SLUGS_RÉSERVÉS` (chaque
  dossier de premier niveau de `app/`, tenu par un test : `payload-api` y a été
  trouvé ainsi). Puis `enregistrerUneDemande`, sous verrou : slug libre, même nom
  ou même domaine nulle part parmi les onboardings et les organisations, deux
  créneaux Cowork par semaine de Paris au plus.
- **Décision 4, lancement au second clic** : la demande enregistrée mène à la
  liste, à l'étape « Demande enregistrée », avec le bouton « Générer les
  référentiels » du lot 2. Rien ne part à l'envoi.
- **Décision 1, l'intake en base, puis effacé** : `onboardings.intake` garde
  objectifs, lecteur final et, pour l'API seulement, son adresse. Le début du
  run les transmet au harnais (`demande` dans la réponse 201), qui ajoute la
  consigne « DEMANDE ENREGISTRÉE DANS LE PORTAIL » : trouver ou créer la ligne
  du registre comme l'étape 1 de la page Notion, avec ces valeurs et le slug du
  portail, puis la rapporter. Dès que la ligne est rapportée, le portail efface
  l'intake ; sinon le passage quotidien (`/api/veille/parcours`) l'efface au
  bout de trente jours. L'adresse n'est nommée que par le domaine, la base et
  le harnais (garde d'architecture) ; les écrans ne la montrent jamais.
- **Cowork** : la demande est enregistrée sans adresse et l'écran donne la
  commande `/onboarding-demande` toute prête, à compléter de l'adresse ; les
  créneaux comptés sont ceux du portail, la vue Notion fait foi.

**Écarts :**

- La demande part avec la réponse au **début du run**, et non par un appel
  `GET /api/veille/onboardings/<id>` de la tâche : le harnais la reçoit sans
  que le modèle ait à la demander, et elle cesse d'être servie dès la ligne
  rapportée.
- **Effacement au bout de trente jours**, ajouté : une demande jamais lancée ne
  garde pas l'intake indéfiniment.

**À faire par l'opératrice :** rien. Aucune migration nouvelle : la colonne
`intake` existe depuis la migration 0019.

