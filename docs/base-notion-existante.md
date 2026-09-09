# Base Notion existante « Veilles clients » — état des lieux et écarts

Lu le 9 septembre 2026 via le connecteur Notion, page racine
`3d5fe829ce7180408ca9f8b5eee1f308`. Rien n'est codé ; ce document confronte
ce qui existe à ce que le portail attend, et liste les décisions à prendre.

## Ce qui existe

### Base « Éditions de veille » — la seule que le portail doit lire

Source de données `collection://f3e703c8-3178-4f70-946b-72be0c2f6db1`.
Une page par lettre. Propriétés réelles :

| Propriété | Type | Valeurs | Client-facing ? |
|---|---|---|---|
| Titre | titre | libre, fixé par le §6 du référentiel (varie selon l'organisation) | oui, comme libellé d'affichage seulement |
| Organisation | **sélection** (pas relation) | `L'Hermitage`, `Infralliance` (option créée à l'onboarding) | clé de cloisonnement |
| Veille | sélection | `Écosystème`, `Concurrentiel` | oui |
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

Deux éditions seulement dans la base à ce jour. Les 14 lettres de
L'Hermitage antérieures à la bascule sur Notion n'y sont pas.

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
| Trois niveaux d'impact : fort / moyen / RAS | les référentiels scorent **FORT / MOYEN / FAIBLE**, et « RAS » désigne une rubrique sans signal | **tension avec la charte** (règle 6) : quatre états dans le contenu, trois dans la charte |
| Une édition par semaine et par client | **deux lettres** par parution (Écosystème et Concurrentiel), numérotées séparément | l'écran « édition de la semaine » doit présenter deux notes, ou un onglet par veille |
| Relation vers un client | sélection « Organisation » par nom | le filtre de cloisonnement porte sur le nom exact de l'option ; la correspondance nom → slug doit vivre ailleurs |
| Base « Dossiers » avec compteur et historique | texte « nom (compteur, précision) » séparé par « · » | le panneau des dossiers se reconstruit en analysant cette propriété d'édition en édition, si le format reste stable |
| Titres normalisés | titres fixés par chaque référentiel, différents d'une organisation à l'autre (« Veille Tiers-Lieux — … », « Veille Infralliance — Positionnement — … ») | ne jamais raisonner sur le titre ; l'afficher tel quel |
| Contenu 100 % client | callout « Livraison » interne en tête du corps, propriété « Amendements » interne | filtrage obligatoire, et fragile s'il repose sur le texte du callout |
| Médias à proxifier | aucune image | le proxy d'images (règle 5) passe en priorité basse, sans disparaître |

## Ce qui fonctionne tel quel

- Le webhook `page.properties_updated` se déclenche au passage
  `Brouillon → Envoyé` ; le portail filtre sur `Statut = Envoyé` et
  `Organisation = X`, puis lit les blocs de la page (moins de 100 blocs par
  édition, donc une seule requête).
- Les propriétés « Période couverte », « Numéro », « Date d'édition »,
  « Action de la semaine », « Dossiers ouverts suivis » suffisent aux
  panneaux de la maquette autour de la note.
- Le slug existe déjà dans le registre.

## Décisions à prendre

1. **Niveaux d'impact.** Trois options : (a) la charte s'aligne sur le
   contenu, quatre badges FORT / MOYEN / FAIBLE et un état RAS ; (b) les
   référentiels et le prompt passent à fort / moyen / RAS, FAIBLE
   disparaissant ; (c) le portail affiche FAIBLE comme RAS, ce qui ment
   sur le contenu. Recommandation : **(a)**, en amendant la règle 6 : trois
   niveaux d'impact **plus** un état « rien à signaler » qui n'est pas un
   niveau. C'est ce que disent déjà les référentiels.
2. **Items ou document.** (a) Rendre la note comme un document, avec
   repli par famille (H2) et badge d'impact lu dans le suffixe du titre ;
   (b) ajouter une base « Items » alimentée par la tâche des lettres, une
   ligne par fait, ce qui modifie le prompt (étape 4) et double les
   écritures. Recommandation : **(a) pour la première version**, avec une
   convention de titres H2 « Famille — IMPACT » inscrite dans les §6. Le
   passage à (b) reste possible plus tard sans casser le portail.
3. **Bloc « Livraison ».** Le sortir du corps de la page et le mettre dans
   une propriété texte « Livraison » (interne), pour que le portail n'ait
   rien à filtrer dans le contenu. Une ligne à changer dans le prompt,
   étape 6.
4. **Format des dossiers ouverts.** Fixer dans le prompt le format réellement
   produit, `nom (compteur, précision)` séparés par ` · `, à la place du
   « nom — statut — compteur, une ligne par dossier » qui n'est pas suivi.
   Le portail analysera ce format ; toute ligne non conforme sera affichée
   brute, sans casser la page.
5. **Base « Accès »** à créer, seule autre base partagée avec le portail :
   Email, Organisation (texte, **identique** à l'option de sélection des
   éditions), Slug, Identifiant d'accès, Actif. Elle porte la
   correspondance nom → slug, ce qui évite de partager le registre.
   L'onboarding Cowork y copie le slug et le nom.
6. **Deux notes par semaine.** Choisir la présentation : deux documents
   dans l'édition de la semaine, ou un onglet par veille. La maquette est à
   compléter dans les deux cas.
7. **Historique de L'Hermitage.** Importer ou non les 14 lettres
   antérieures ; sinon, l'archive commence au 8 septembre 2026.

## Conséquences sur la lecture Notion du portail

- Requête liste : `dataSources.query` sur `f3e703c8-…`, filtre
  `Organisation equals <nom>` **et** `Statut equals Envoyé`, tri
  `Date d'édition` décroissant, puis `Veille`.
- Requête page : `blocks.children.list` sur le `page_id`, une passe.
- Rendu : titres H1/H2, paragraphes avec gras et liens, puces, tableaux,
  citations. Callouts ignorés tant que la décision 3 n'est pas appliquée,
  puis rendus.
- Propriétés à exposer : Titre, Veille, Date d'édition, Numéro, Période
  couverte, Fenêtre élargie, Action de la semaine, Dossiers ouverts suivis.
  Jamais « Amendements au référentiel », jamais « Livraison ».
- Cloisonnement : le nom d'organisation vient de la ligne « Accès » de la
  personne connectée, jamais de l'URL seule.
