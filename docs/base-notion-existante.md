# Base Notion existante « Veilles clients » — état des lieux et écarts

Lu le 9 septembre 2026 via le connecteur Notion, page racine
`3d5fe829ce7180408ca9f8b5eee1f308`. Rien n'est codé ; ce document confronte
ce qui existe à ce que le portail attend, et liste les décisions à prendre.

**Relu le 9 septembre 2026 en fin de journée.** Le schéma de « Éditions de
veille » a changé pendant l'import des archives : `Organisation` est passée
de sélection à **relation** vers le registre, une propriété `Famille` est
apparue, `Veille` a gagné deux options, une troisième organisation est
entrée dans le registre. Les tableaux ci-dessous ont été corrigés ; la
section « Changement de schéma du 9 septembre 2026 » explique ce que cela
change pour le portail.

## Ce qui existe

### Base « Éditions de veille » — la seule que le portail doit lire

Source de données `collection://f3e703c8-3178-4f70-946b-72be0c2f6db1`.
Une page par lettre. Propriétés réelles :

| Propriété | Type | Valeurs | Client-facing ? |
|---|---|---|---|
| Titre | titre | libre, fixé par le §6 du référentiel (varie selon l'organisation) | oui, comme libellé d'affichage seulement |
| Organisation | **relation** vers le registre `collection://4ae154b9-…` | une page du registre par organisation | clé de cloisonnement, par identifiant de page |
| Famille | sélection | `Écosystème`, `Concurrentiel` — famille interne et stable, indépendante du nom client de la veille | **non, interne** : sert au comptage des numéros et à l'anti-doublon |
| Veille | sélection | `Écosystème`, `Concurrentiel`, `Positionnement`, `Attractivité` | oui, c'est le nom client de la veille |
| Date d'édition | date | | oui |
| Numéro | nombre | incrémenté par veille et par organisation | oui |
| Statut | sélection | `Brouillon`, `Relu`, `Envoyé` | filtre de publication |
| Période couverte | texte | « 1er – 8 septembre 2026 » | oui |
| Fenêtre élargie | case | | oui, mention de méthode |
| Dossiers ouverts suivis | texte | « Loi Résilience (0) · CADA (0, rapporteurs identifiés) · … » | oui, source du panneau des dossiers |
| Action de la semaine | texte | vide pour l'écosystème | oui |
| Amendements au référentiel | texte | questions internes pour la revue mensuelle | **non, interne** |

Corps de la page (deux éditions existantes, Infralliance du 8 septembre) :

1. un **callout « Livraison »** en tête : adresse email du relecteur, objet
   de l'envoi, consigne interne — **interne, à ne jamais afficher** ;
2. un paragraphe « Ce que suit cette veille » (édition n°1 seulement) ;
3. une « Note de méthode » en gras ;
4. des titres H1 (« L'essentiel », « Actualités par famille », « Analyse »,
   « Trois idées de posts… », « Agenda des quinze jours ») ;
5. sous « Actualités par famille », des titres H2 de la forme
   **« ② Cadre français — FORT »** : le niveau d'impact est un suffixe du
   titre de famille ;
6. des paragraphes ouverts par un titre en gras, des puces, des tableaux ;
7. un paragraphe final « Dossiers ouverts … Vérifié … Non ouvert … Prochaine
   édition ».

Aucune image dans les éditions existantes : tableaux et texte seulement.

Au 9 septembre 2026 la base contient 23 éditions : les 2 éditions
Infralliance du 8 septembre, 2 brouillons Pays de Mauriac du 9 septembre, et
les **19 archives de L'Hermitage** importées le 9 septembre (décision 7,
détaillée plus bas).

### Base « Organisations — pipeline et activation » — registre interne

Source `collection://4ae154b9-0bca-42f3-9e2e-e546a40dd77f`. Une ligne par
organisation : nom (titre), **Slug**, statut de pipeline (0 à 6), case
« Veille automatique », lecteur final et **son email**, cadence, jour et
heure de parution, veilles installées, URL de la page organisation et des
référentiels, et **tout l'intake** (Q1 à Q3, diagnostic de
pré-qualification, questions au client, sources de substitution).

Ce registre contient des données confidentielles d'intake. **Il ne doit pas
être partagé avec l'intégration du portail**, même si le portail n'en
afficherait rien : le principe du moindre privilège vaut pour un jeton
serveur aussi.

### Le reste — jamais partagé

Base « Validations — fiches et référentiels », pages organisation, fiches
versionnées, référentiels (§0 à §6 et journal des révisions), pages de
méthode et prompts. Tout cela reste hors du périmètre de l'intégration,
conformément au CLAUDE.md.

### Ce qui n'existe pas

- **Pas de base « Items »** : les faits sont dans le corps de la page, pas
  en lignes structurées.
- **Pas de base « Dossiers »** : les dossiers ouverts vivent dans les
  tableaux §2 des référentiels (internes) et, côté édition, dans la
  propriété texte « Dossiers ouverts suivis ».
- **Pas de base « Clients » ni « Accès »** au sens du portail.

## Écarts avec ce que le portail attendait

| Attendu (CLAUDE.md, maquette) | Réel | Conséquence |
|---|---|---|
| Statut « publiée » | `Envoyé` | le filtre de publication devient `Statut = Envoyé` ; `Relu` n'est pas publié |
| Un item = une ligne structurée (rubrique, impact, fait, source, date, déclaratif, dossier) | la note est un document ; l'impact est un suffixe de titre H2 ; les sources sont des liens dans le texte | le tri par impact et le repli par rubrique ne peuvent se faire qu'au niveau des **familles** (titres H2), pas des items |
| Trois niveaux d'impact : fort / moyen / RAS | les référentiels scorent **FORT / MOYEN / FAIBLE**, et « RAS » désigne une rubrique sans signal | tranché le 9 septembre : la charte reste, FAIBLE disparaît des référentiels (décision 1) |
| Une édition par semaine et par client | **deux lettres** par parution, numérotées séparément par famille | tranché le 9 septembre : une seule entrée hebdomadaire dans le portail, qui rassemble les deux notes de la semaine (décision 6) |
| Relation vers un client | relation « Organisation » vers le registre (depuis le 9 septembre 2026) | le filtre de cloisonnement porte sur l'**identifiant de page** du registre, jamais sur un nom ; cet identifiant doit être écrit dans la base « Accès — portail » par l'onboarding, car le portail n'a pas accès au registre |
| Base « Dossiers » avec compteur et historique | texte « nom (compteur, précision) » séparé par « · » | le panneau des dossiers se reconstruit en analysant cette propriété d'édition en édition, si le format reste stable |
| Titres normalisés | titres fixés par chaque référentiel, différents d'une organisation à l'autre (« Veille Tiers-Lieux — … », « Veille Infralliance — Positionnement — … ») | ne jamais raisonner sur le titre ; l'afficher tel quel |
| Contenu 100 % client | callout « Livraison » interne en tête du corps, propriété « Amendements » interne | filtrage obligatoire, et fragile s'il repose sur le texte du callout |
| Médias à proxifier | aucune image | le proxy d'images (règle 5) passe en priorité basse, sans disparaître |

## Ce qui fonctionne tel quel

- Le webhook `page.properties_updated` se déclenche au passage
  `Brouillon → Envoyé` ; le portail filtre sur `Statut = Envoyé` et
  `Organisation contains <page_id de l'organisation>`, puis lit les blocs de
  la page (moins de 100 blocs par édition, donc une seule requête).
- Les propriétés « Période couverte », « Numéro », « Date d'édition »,
  « Action de la semaine », « Dossiers ouverts suivis » suffisent aux
  panneaux de la maquette autour de la note.
- Le slug existe déjà dans le registre.

## Décisions prises le 9 septembre 2026

1. **Trois niveaux d'impact, la charte ne bouge pas** : fort / moyen / RAS.
   Le niveau FAIBLE, présent aujourd'hui dans les référentiels, disparaît :
   un fait qui n'atteindrait que FAIBLE n'est pas retenu, ou la famille
   passe en RAS motivé. Le portail lit le suffixe du titre H2 et n'accepte
   que FORT, MOYEN, RAS ; tout autre suffixe s'affiche sans badge, jamais
   converti. Modifications à porter **côté Notion et Cowork** (hors dépôt) :
   - référentiels L'Hermitage « Écosystème des tiers-lieux » et « Séjours
     B2B/B2C », référentiel(s) Infralliance : dans chaque table du §1,
     supprimer la ligne **FAIBLE** ; dans le §6, remplacer
     « FORT/MOYEN/FAIBLE » par « FORT/MOYEN, RAS pour une rubrique sans
     signal » ; pour le §6 concurrentiel de L'Hermitage, le préfixe
     `[Impact FORT/MOYEN/FAIBLE]` par item devient un suffixe de titre H2
     de famille, comme pour l'écosystème ;
   - prompt « Tâche — Lettres de veille », étape 3 : « seuls les libellés
     d'impact FORT/MOYEN/FAIBLE prévus par le §6 sont client-facing »
     devient « seuls les libellés FORT, MOYEN et RAS… » ;
   - prompt « Tâche — Onboarding » (prompts A et B), à vérifier : les
     référentiels générés ne doivent plus produire de ligne FAIBLE ;
   - revue mensuelle : vérifier qu'elle ne réintroduit pas FAIBLE.
2. **La note est un document.** Pas de base « Items ». Le portail rend le
   corps de la page : H1 de rubriques, H2 de familles repliables avec badge
   d'impact, paragraphes, puces, tableaux. Le tri par impact opère sur les
   familles. Convention à inscrire dans chaque §6 : tout titre H2 sous
   « Actualités par famille » (ou « Voix concurrentes ») se termine par
   « — FORT », « — MOYEN » ou « — RAS ». Un passage ultérieur à une base
   « Items » resterait possible sans casser le portail.

## Décisions 3, 4 et 5 appliquées dans Notion le 9 septembre 2026

Appliquées via le connecteur Notion, à la demande de l'opérateur :

3. **Bloc « Livraison » sorti du corps.** Propriété texte `Livraison`
   ajoutée à « Éditions de veille » (description : interne, jamais affichée
   par le portail). Le prompt général « Tâche — Lettres de veille » et le
   prompt propre à Infralliance renseignent désormais cette propriété à
   l'étape de livraison et ne créent plus de bloc dans le corps ; le mode
   dégradé écrit aussi dans la propriété. Les deux éditions existantes
   (Infralliance, 8 septembre) ont été migrées : callout retiré du corps,
   texte reporté dans la propriété.
4. **Format des dossiers ouverts figé** dans les deux prompts : une seule
   ligne, `nom (compteur, précision)`, dossiers séparés par « · ». C'est le
   format déjà produit par les éditions existantes.
5. **Base « Accès — portail » créée** sous la page racine « Veilles
   clients » : `collection://4d3d7403-35d7-4815-884b-877d17423842`.
   Propriétés : `Nom` (titre, prénom et nom), `Email`,
   `Organisation (libellé)` (texte, affichage seulement),
   `Identifiant Notion de l'organisation` (texte, `page_id` de la ligne du
   registre — **la seule clé de cloisonnement**), `Slug`,
   `Identifiant d'accès` (texte, aléatoire, généré par l'onboarding),
   `Actif` (case). Aucune ligne pour l'instant ; l'onboarding Cowork la
   remplira. Seule base partagée avec le portail avec « Éditions de veille ».

   Les deux propriétés d'organisation ont été ajoutées et renommées en fin
   de journée du 9 septembre, à la suite du changement de schéma décrit plus
   bas : `Organisation` s'appelait ainsi et devait porter le nom exact de
   l'option de sélection, ce qui n'a plus de sens depuis que la propriété
   des éditions est une relation.

Décision 1 appliquée dans le même temps : lignes **FAIBLE** retirées des
tables du §1 des deux référentiels de L'Hermitage et du référentiel
Écosystème d'Infralliance ; §6 des quatre référentiels (L'Hermitage
Écosystème et Séjours, Infralliance Écosystème et Positionnement) porte la
convention « titre H2 de famille terminé par — FORT / — MOYEN / — RAS » et
la règle « FAIBLE n'existe pas » ; ligne datée ajoutée à chaque journal des
révisions ; étape 3 du prompt général et étape 2 du prompt Infralliance
alignées. Dans l'édition Infralliance Écosystème du 8 septembre, le titre
« ⑤ Filière et financement — FAIBLE » est passé à « — RAS », son contenu
étant un RAS motivé.

À vérifier par l'opérateur : la tâche « Revue mensuelle des référentiels »
et les prompts d'onboarding (A et B) n'ont pas été modifiés ; s'ils
génèrent des lignes FAIBLE, les corriger à la prochaine exécution.

## Changement de schéma du 9 septembre 2026

Le schéma de « Éditions de veille » a été modifié dans Notion pendant
l'import des archives. Trois changements, tous structurants pour le portail.

### `Organisation` est devenue une relation

Elle pointait sur une option de sélection portant le nom du client ; elle
pointe maintenant sur une ligne du registre
`collection://4ae154b9-0bca-42f3-9e2e-e546a40dd77f`. La relation est
bidirectionnelle : le registre a gagné une propriété `Éditions`.

Conséquences :

1. **Le filtre de cloisonnement porte sur un identifiant de page**, pas sur
   un nom : `relation.contains = <page_id de l'organisation dans le
   registre>`. C'est plus sûr qu'un nom (pas de faute de frappe, pas de
   collision, pas de renommage silencieux).
2. **Le portail ne peut pas résoudre cet identifiant lui-même.** Le registre
   n'est pas partagé avec son intégration et ne doit pas l'être. L'API
   renvoie la relation sous forme d'une liste d'identifiants sans titre ;
   le portail voit donc un identifiant opaque et jamais le nom du client
   dans la charge Notion. C'est un gain de confidentialité, à condition que
   l'identifiant lui soit fourni autrement.
3. **La base « Accès — portail » doit porter cet identifiant.** Il lui faut
   une propriété texte `Identifiant Notion de l'organisation`, renseignée
   par la tâche d'onboarding Cowork, qui a accès au registre. La propriété
   `Organisation` de la base « Accès » reste utile comme libellé d'affichage,
   mais **ne sert plus au cloisonnement**.
4. **Un identifiant périmé se traduit par un portail vide, pas par une
   fuite.** C'est le bon sens de l'échec, mais il faut le détecter : au
   démarrage, le portail vérifie que chaque ligne « Accès » active porte un
   identifiant non vide, et le monitoring alerte si une organisation active
   ne renvoie aucune édition.

### Une propriété `Famille` est apparue

Sélection à deux options, `Écosystème` et `Concurrentiel`, décrite dans
Notion comme « famille interne et stable, indépendante du nom client de la
veille ; sert au comptage des numéros et à l'anti-doublon ».

`Veille` porte désormais le **nom client** de la veille et a quatre options :
`Écosystème`, `Concurrentiel`, `Positionnement`, `Attractivité`. Les deux
propriétés se recoupent sans se confondre : la veille « Positionnement »
d'Infralliance et la veille « Attractivité » du Pays de Mauriac sont toutes
deux de famille `Concurrentiel`.

Pour le portail : **afficher `Veille`, ne jamais afficher `Famille`**, et
grouper sur `Famille` quand il faut un regroupement stable entre clients.
`Numéro` s'incrémente par organisation et par famille, pas par nom de veille.

### Une troisième organisation est entrée dans le registre

| Organisation | Slug | Page du registre | Veilles | Jour |
|---|---|---|---|---|
| L'Hermitage | `hermitage` | `3d5fe829ce71810da651f3783a725bd8` | Écosystème, Concurrentiel | lundi |
| Infralliance | `infralliance` | `3d5fe829ce718145a186fc32423a922b` | Écosystème, Positionnement | mardi |
| Pays de Mauriac | `ccpm` | `3d6fe829ce718131b6e6feca050b8890` | Écosystème, Attractivité | mercredi |

**Anomalie à corriger côté Notion, hors portail.** Le registre contient deux
lignes pour le Pays de Mauriac. L'une, « Communauté de communes du Pays de
Mauriac » (`3d5fe829ce7181dfaf34f754d7298f2c`), est **à la corbeille** mais
reste la cible de la relation des deux brouillons du 9 septembre. L'autre,
« Pays de Mauriac » (`3d6fe829ce718131b6e6feca050b8890`), est vivante et
n'a aucune édition rattachée. Une page mise à la corbeille reste une cible
de relation valide pour l'API : le lien ne casse pas, il devient
silencieusement faux. Il faut rattacher les deux brouillons à la ligne
vivante avant d'ouvrir un accès à cette organisation, et l'onboarding doit
cesser de créer des doublons.

C'est aussi la démonstration du risque de la règle 2 : le cloisonnement
tient à une donnée que le portail ne peut pas vérifier lui-même. D'où le
contrôle de démarrage et l'alerte décrits plus haut.

## Décisions 6 et 7 prises le 9 septembre 2026

### 6. Une lettre par semaine, archives accessibles

Le dispositif produit deux notes par parution et par organisation (une par
veille), numérotées séparément par famille. Le portail n'en fait **pas deux
entrées concurrentes** : il présente **une entrée par semaine**, qui
rassemble les notes de la semaine, et une archive où toutes les semaines
passées restent atteignables.

Conséquences pour le portail :

- L'écran d'accueil d'un client montre la **semaine la plus récente**, pas
  la dernière édition créée. Deux éditions de la même semaine se rejoignent
  sur une seule page.
- À l'intérieur de cette page, les deux notes se suivent, la veille
  écosystème d'abord, la veille concurrentielle ensuite ; le nom de la
  veille (`Veille`) sert de titre de section. Le repli par famille et les
  badges d'impact restent au niveau des titres H2 de chaque note.
- L'archive liste les semaines, pas les éditions. Une semaine qui n'a reçu
  qu'une seule note s'affiche telle quelle, sans emplacement vide.
- Le regroupement se fait sur `Date d'édition`, ramenée au lundi de sa
  semaine ISO. `Numéro` reste affiché par veille, comme aujourd'hui, et ne
  sert pas au regroupement : les numéros des deux veilles ne coïncident pas.
- Les URL restent construites sur le `page_id` d'une édition ; la page de
  semaine porte en plus une clé de semaine.

**Hypothèse à confirmer à la maquette.** Cette décision est lue comme une
règle de présentation du portail. Si l'intention était de faire produire à
Cowork une note unique fusionnant les deux veilles, c'est une modification
des tâches Cowork et des référentiels, hors de ce dépôt, et la numérotation
par famille devrait être revue. Rien n'a été modifié dans Cowork sur ce
point. Les archives importées gardent leurs deux veilles distinctes.

### 7. Archives de L'Hermitage importées

Les 19 lettres envoyées à `jean@hermitagelelab.com` entre le 22 juillet et
le 7 septembre 2026, relues dans Gmail, ont été créées dans « Éditions de
veille » le 9 septembre 2026, en `Statut = Envoyé`, rattachées à la ligne
de registre de L'Hermitage.

| Famille et veille | Nombre | Numéros | Période |
|---|---|---|---|
| Écosystème — « Veille Tiers-Lieux » | 12 | 1 à 12 | 22 juillet → 7 septembre |
| Concurrentiel — « Veille hebdo — Séjours B2B/B2C patrimoine rural » | 7 | 1 à 7 | 29 juillet → 7 septembre |

Points à connaître :

- Les six premières lettres écosystème sont **quasi quotidiennes** (22, 24,
  26, 27, 28 et 29 juillet) : le dispositif n'était pas encore hebdomadaire.
  La cadence devient hebdomadaire à partir du 4 août. Le regroupement par
  semaine de la décision 6 fera donc apparaître plusieurs notes écosystème
  sur les semaines de juillet. C'est fidèle à ce qui a été envoyé ; ne pas
  le lisser.
- Chaque page porte une propriété `Livraison` qui trace la provenance :
  date d'import, adresse destinataire, date d'envoi et identifiant du
  message Gmail. Propriété interne, jamais affichée.
- `Période couverte`, `Fenêtre élargie` et `Action de la semaine` sont
  renseignées quand la lettre d'origine les portait.
- Le corps est la note telle qu'envoyée, sans callout « Livraison » et avec
  la convention de suffixe d'impact de la décision 1.

**À faire manuellement par l'opérateur.** Une page de test technique reste
dans la base : « À SUPPRIMER — page de test technique (import archives) »
(`3d6fe829ce7181aeb23ff441de9968b6`). Elle est vide, en `Brouillon`, sans
organisation, donc invisible du portail. Le connecteur Notion utilisé ici ne
sait pas mettre une page à la corbeille ; il faut la supprimer d'un clic
dans l'interface.

## Conséquences sur la lecture Notion du portail

- Requête liste : `dataSources.query` sur `f3e703c8-…`, filtre
  `Organisation contains <page_id du registre>` **et**
  `Statut equals Envoyé`, tri `Date d'édition` décroissant, puis `Veille`.
  L'identifiant d'organisation vient de la ligne « Accès » de la personne
  connectée, jamais de l'URL ni d'un nom.
- Requête page : `blocks.children.list` sur le `page_id`, une passe.
- Rendu : titres H1/H2, paragraphes avec gras et liens, puces, tableaux,
  citations. Titres H2 repliables, badge d'impact lu dans le suffixe
  « — FORT / MOYEN / RAS ». Aucun bloc interne à filtrer : le corps est
  intégralement client depuis le 9 septembre 2026.
- Regroupement par semaine (décision 6) : côté portail, après la requête
  filtrée, sur le lundi de la semaine ISO de `Date d'édition`. Jamais une
  requête par semaine, qui multiplierait les appels Notion.
- Propriétés à exposer : Titre, Veille, Date d'édition, Numéro, Période
  couverte, Fenêtre élargie, Action de la semaine, Dossiers ouverts suivis.
  **Jamais** « Amendements au référentiel », « Livraison » ni « Famille » :
  les deux premières sont internes, la troisième est une clé de gestion.
- Cloisonnement : l'identifiant de l'organisation vient de la ligne « Accès »
  de la personne connectée. Le portail ne lit pas le registre et ne connaît
  donc jamais le nom d'une organisation par Notion.
