# Lettre d'appels à projets

Troisième famille de lettre, décidée le 17 novembre 2026 par l'opératrice. Le
plan complet, avec le tableau des outils et les choix encore ouverts, est le
document « Plan : lettre de veille « appels à projets » » (Claude Docs,
`claude.ai/artifact/CRuyPUJA8Cv8kbSjHcdxqQ`). Cette page dit ce que le dépôt
porte et ce qui reste à faire dans Notion.

## Décisions du 17 novembre 2026

| # | Décision |
|---|---|
| 1 | Lettre séparée, famille interne `Appels à projets`, numérotée à part |
| 2 | Sources produites automatiquement par le prompt dans le référentiel, à l'onboarding ou à l'activation, sans validation humaine |
| 3 | Cadence à la quinzaine (semaines ISO paires) |
| 4 | Aucun projet à financer défini a priori |
| 5 | Organisation pilote : la CCI du Cantal (`cci-cantal`) |
| 10 | Activation par le geste « Activer la lettre d'appels à projets » sur la fiche de l'organisation |
| | Seuls les appels dont l'organisation est elle-même porteuse ; pas de partie « À relayer » |
| | Marchés publics exclus |
| | Tarif de la lettre : 49 € par mois (rien n'est codé dans les lots 0 à 3 : ni prix Stripe ni `lib/domaine/offre.ts`) |

Tranchés le 18 novembre 2026 : table `appels_a_projets` (6) et écran dédié (9),
option A, la table Postgres alimentée en code (voir « Lot 4 » plus bas). Choix
encore ouverts : faits d'appels dans PESTEL et Forces (7), lien avec « Marchés
et niches » (8).

## Ce que le dépôt porte (lots 0 à 3)

**Lot 1, la troisième famille.**

- `FAMILLES` gagne `Appels à projets` (`lib/portail/contexte.ts`,
  `FAMILLE_DES_APPELS`, `estFamilleDAppels`) : `GET /api/veille/contexte` rend
  son dernier numéro et ses deux dernières éditions, et une lettre d'appels ne
  tombe plus dans `sansFamille`.
- `POST /api/veille/calendrier` reçoit `appels` par ligne et rend
  `parutionsAppels` et `prochainesAppels` (`sélectionnerLesAppels`,
  `lib/domaine/calendrier.ts`, même règle de parution).
- `POST /api/veille/lint` passe la famille et la date de l'édition au
  validateur : quatre ruptures de plus pour cette famille (`clôture-absente`,
  `clôture-passée`, `source-de-l-appel-absente`, `arguments-absents`) et
  l'avertissement `dossiers-dans-la-lettre-d-appels` (`docs/api-veille.md`).
  L'étape 3bis du contrôle du soir passe par la même route : elle vérifie donc
  la lettre d'appels sans changement de code.
- `POST /api/veille/faits` répond `famille-hors-outils` pour cette famille :
  rien n'entre dans les outils stratégiques avant le lot 5.
- La lettre se regroupe par semaine et se tronque à « L'essentiel » comme les
  deux autres, sans code nouveau (tests dans `tests/lettre-appels.test.ts`).

**Lot 2, le référentiel d'appels.** La consigne `appels`
(`lib/domaine/onboarding.ts`, texte dans `CONSIGNE_DES_APPELS`,
`scripts/taches/pointeurs.ts`) fait écrire au balayage la section « Appels à
projets » du référentiel Écosystème de l'organisation : périmètre, profil
d'éligibilité, trois à six familles d'appels avec leurs sources ouvertes dans
le run, requêtes types. **Volume des sources** (décision de l'opératrice du
17 novembre 2026) : trente à trente-cinq candidates examinées, vingt retenues ;
une candidate bloquée est retentée par une autre entrée (navigateur, flux, API,
agrégateur) avant d'être écartée ; moins de vingt seulement si moins de vingt
s'ouvrent et listent des appels datés, jamais de source ajoutée pour le compte ;
la section finit par les candidates écartées et leur motif. Une cadence ou un
jour déjà posés au registre ne sont pas changés par un nouveau run. Elle retire l'axe d'appels de la lettre écosystème
s'il existe, coche la lettre au registre et ne crée aucun point de validation.
Le bouton « Activer la lettre d'appels à projets », section « Veille
hebdomadaire » de la fiche (`/espaces/abonnements/[slug]`), la lance
(`activerLaLettreDAppels`, `exigerOpérateur` d'abord ; `lancerLaLettreDAppels`,
`lib/portail/onboarding.ts`). Pour une organisation sans ligne d'onboarding ou
à ligne Cowork, le run part sans réservation : le harnais ouvre la ligne à son
début et y applique le budget du mois. La fin d'un run `appels` n'enchaîne
rien. Sans jeton GitHub : `pnpm tache balayage --organisation <slug>
--consigne appels`.

**Lot 3, la collecte.** L'outil `appels_ouverts` (`scripts/collecte/appels.ts`,
`scripts/taches/outils.ts`) reçoit le texte de la section « Appels à projets »
et les adresses à relever ; une adresse, ou une redirection, dont le domaine
n'est pas cité dans la section est refusée sans être ouverte. Il rend une
ligne par appel (intitulé, dates lisibles, adresse, source) et écarte les
marchés publics. Le collecteur l'a dans ses outils.

**Quinzaine des semaines impaires.** La cadence `Quinzaine (semaines
impaires)` (`CADENCES`, `lib/domaine/calendrier.ts`) fait paraître une lettre
les semaines ISO impaires. Elle n'est une option que de la colonne « Cadence
appels » du registre ; la CCI du Cantal y est réglée depuis le 17 novembre
2026, pour des parutions le lundi à partir du 30 novembre (semaine 49), à la
demande de l'opératrice. 2026 compte 53 semaines ISO : les semaines 53 et 1
sont toutes deux impaires, la lettre paraît donc les lundis 28 décembre 2026
et 4 janvier 2027.

**Première lettre hors calendrier.** La consigne `lettre-appels` (tâche
`lettres`, une organisation) fait produire tout de suite la lettre d'appels
d'une organisation, sans attendre sa parution : `pnpm tache lettres
--organisation <slug> --consigne lettre-appels`, ou le workflow avec ces
entrées. Le run ne produit que cette lettre, au contrat de la page, et refuse
si la lettre n'est pas cochée au registre ou si la section manque au
référentiel (`CONSIGNE_DE_LA_LETTRE_D_APPELS`, `scripts/taches/pointeurs.ts`).

## Lot 4, l'écran « Appels à projets » (18 novembre 2026)

Décision de l'opératrice : option A, une table Postgres lue par l'écran, sans
ouvrir aucune lettre.

- **Table** `appels_a_projets` (migration 0030) : une ligne par appel retenu et
  par édition (organisation, identifiant Notion de l'édition, date, clé, rang,
  intitulé de 120 caractères, financeur de 80, clôture, adresse de l'appel,
  impact `fort` ou `moyen`, « à vérifier »). Ni corps de lettre ni argument :
  des champs courts, comme les autres exceptions à la règle de Postgres. Seul
  écrivain et lecteur `lib/base/appels.ts`, seule orchestration
  `lib/portail/appels.ts`.
- **Relevé en code, jamais par un modèle** : quand `POST /api/veille/lint`
  trouve conforme une lettre d'appels, `releverLesAppels` en extrait les appels
  (`appelsDeLaLettre`, `lib/domaine/appels.ts` : phrase-titre « Financeur :
  intitulé », dernière date du titre pour la clôture, dernier « Impact fort »
  ou « Impact moyen » du texte, à défaut le niveau de l'axe, adresse prise dans
  « Pièces et calendrier ») et remplace ceux de l'édition, dans `after()`, sans
  jamais faire échouer le lint. Une lettre corrigée puis relue ne garde pas un
  appel qu'elle a retiré. La tâche n'a rien de plus à faire que son lint.
- **Suivi calculé à la lecture** (`vueDesAppels`) : un appel est reconnu d'une
  lettre à l'autre par sa clé (adresse normalisée, à défaut l'intitulé), prend
  sa citation la plus récente, est ouvert tant que sa clôture n'est pas passée,
  « nouveau » s'il n'apparaît que dans la dernière lettre. Seules comptent les
  lettres que le lecteur peut lire (règle 3 ; l'opératrice voit aussi l'aperçu).
- **Écran** `/[slug]/appels`, rubrique « Stratégie » après « Options », dans
  l'espace réorganisé, onglet montré seulement quand une lettre lisible porte un
  appel relevé : action de la quinzaine, « À instruire » (clôture en ocre,
  badge, « nouveau », « à vérifier », lien vers l'appel et vers la lettre),
  frise des clôtures sur six mois, appels clos repliés.
- **Limites** : une lettre passée au lint avant le déploiement n'a pas de
  lignes tant qu'elle n'est pas relue par le lint (contrôle du soir, étape
  3bis, ou un nouveau passage) ; les appels écartés par la tâche ne sont pas
  enregistrés, seuls les appels retenus dans la lettre le sont.

## À faire dans Notion, après le déploiement

Rien de ceci n'est fait par le portail, qui n'écrit jamais dans Notion. Dans
l'ordre :

1. **Éditions de veille** : ajouter l'option `Appels à projets` aux propriétés
   `Famille` et `Veille`.
2. **Registre des organisations** : ajouter trois colonnes, « Appels à
   projets » (case), « Jour appels » (sélection, mêmes options que « Jour de
   parution ») et « Cadence appels » (sélection, mêmes options que
   « Cadence »). Ajouter les trois à la vue « Veilles actives ».
3. **Tâche « Lettres de veille »** : coller le paragraphe ci-dessous à
   l'étape de sélection, et le contrat de la lettre à l'étape 3.
4. **CCI du Cantal** : vérifier sur sa fiche (`/espaces/abonnements/cci-cantal`)
   la grille, la fiche de veille et l'espace réorganisé ; puis cliquer
   « Activer la lettre d'appels à projets ». La première lettre paraît à la
   quinzaine suivante, en aperçu avant envoi.

### Paragraphe pour l'étape de sélection

> Donne à `POST /api/veille/calendrier`, pour chaque ligne dont « Appels à
> projets » est cochée, `appels: { jour: <Jour appels>, cadence: <Cadence
> appels> }`. Pour chaque slug de `parutionsAppels`, produis en plus une lettre
> de la famille « Appels à projets », selon le contrat de l'étape 3 pour cette
> famille ; elle passe par le même contexte, le même lint et le même aperçu
> que les deux autres.

### Contrat de la lettre, pour l'étape 3

> **Famille « Appels à projets ».** Propriétés : `Famille` et `Veille` valent
> « Appels à projets » ; numéro lu dans `familles["Appels à projets"]` du
> contexte ; « Dossiers ouverts suivis » reste vide.
>
> Collecte : lis la section « Appels à projets » du référentiel Écosystème,
> puis appelle `appels_ouverts` avec son texte et ses sources. Ouvre au lecteur
> les seules pages des appels retenus, pour leurs critères. `fiches_entreprises`
> sur le SIREN de l'organisation pour l'éligibilité. Seuls les appels dont
> l'organisation est porteuse ; jamais un marché public.
>
> Structure : « L'essentiel » (huit lignes au plus, les dépôts les plus proches
> d'abord, avec leur date) ; « Actualités par axe », un axe par famille
> d'appels de la section, suffixé FORT, MOYEN ou RAS (FORT : éligible, clôture
> à plus de quinze jours, rejoint ses missions ou ses actions ; RAS motivé en
> encadré). Dans un axe, chaque appel s'ouvre sur une phrase-titre en gras
> (financeur, intitulé, montant, clôture datée), puis « Pourquoi vous »
> (critères remplis, critères à vérifier), « Arguments » (deux à quatre, chacun
> appuyé sur un fait daté de la veille ou une force publiée du Diagnostic) et
> « Pièces et calendrier », avec l'adresse de l'appel. « Action de la semaine » :
> le dépôt le plus proche.
>
> Arguments : faits étiquetés récents (`GET /api/veille/faits`), forces de la
> dernière synthèse publiée (`GET /api/veille/syntheses`), ce que le
> référentiel dit de l'organisation. Aucun projet n'est supposé : c'est l'appel
> qui fait apparaître un projet possible, formulé dans « Pourquoi vous ». Un
> argument sans fait daté ni force publiée n'est pas écrit.
>
> Étape 4ter : la route répond `famille-hors-outils`, passe.
