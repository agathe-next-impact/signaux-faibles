# Prescripteurs : un canal à part de la prospection automatisée

*Décidé le 24 octobre 2026 : réciprocité (option A) et quatre parutions d'essai
pour le client recommandé. Codé le même jour, sauf le point mensuel et la
lettre de filière transmise (« Ce qui reste »).*

## La règle

La prospection automatisée est réservée aux **clients finaux** : la séquence
lemlist ou son pilote par brouillons Gmail (`docs/prospection-lemlist.md`), la
lettre de filière avec son bloc personnalisé, l'édition de découverte à la
première visite (`docs/programme-lettre-unique.md`, paliers 1 à 3). Un
prescripteur n'entre jamais dans une séquence.

Trois raisons :

1. **La valeur n'est pas la même.** Un client final rapporte un abonnement ; un
   prescripteur en rapporte plusieurs, et peut en fermer autant s'il se sent
   démarché comme un client.
2. **Le nombre n'est pas le même.** Quelques dizaines de prescripteurs utiles,
   contre des centaines de prospects par filière : l'automatisation n'apporte
   rien à cette échelle, la relation apporte tout.
3. **Le message n'est pas le même.** La lettre 1 dit au prospect « voici votre
   veille » ; au prescripteur, il faut dire « voici ce que vos clients ou vos
   adhérents recevraient, et ce que vous y gagnez ».

## Qui est prescripteur

| Type | Ce qu'il apporte | Ce qu'il attend |
| --- | --- | --- |
| Expert-comptable, avocat d'affaires | Des PME qu'il conseille chaque mois | Un service de plus à recommander, sans risque pour sa relation |
| Cabinet de conseil en stratégie ou en financement | Des clients en mission, qui ont besoin de suivre leur marché après la mission | Une veille qui prolonge son travail, sans le concurrencer |
| Chambre consulaire, agence de développement économique | Des entreprises de son territoire | Un outil d'accompagnement à proposer à ses ressortissants |
| Cluster, pôle de compétitivité, fédération professionnelle | Les adhérents d'une filière | Une information de filière à redistribuer |
| Réseau de l'ESS, financeur solidaire | Des structures qu'il finance ou accompagne | Des structures mieux informées des appels à projets |

## Le système proposé

Quatre pièces, dont deux existent déjà dans le portail.

### 1. Le prescripteur a son propre espace, en accès offert

Le prescripteur juge la veille sur la sienne, pas sur une démonstration.
L'onboarding est celui d'un client (`/onboarding-demande`, référentiels,
première lettre), puis l'opératrice pose `offre = gratuite` : accès offert,
jamais de fin d'essai (`réglerLeParcours`, déjà en place). Coût : celui d'une
lettre par semaine pour une organisation.

### 2. Il recommande par un lien qui porte son code

Chaque prescripteur a un code court. Son lien mène au formulaire de
démonstration : `/demo?de=<code>`. Le formulaire garde le code dans un champ
caché, et le courrier qui part vers `agathe@signauxfaibles.io` nomme le
prescripteur. À l'onboarding, `POST /api/veille/organisations` reçoit
`prescripteur: <code>` et rattache l'organisation à son prescripteur.

Une organisation recommandée **sort de la prospection automatisée** : le
portail refuse ensuite `origine: "prospection"` pour elle
(`déjà-recommandée`), et la tâche de prospection lit une liste d'exclusion
(domaines des prescripteurs et de leurs organisations recommandées) avant de
constituer son lot. Un prescripteur ne reçoit donc jamais une lettre 1, et son
client non plus.

Pour une chambre, un cluster ou une fédération, la **lettre de filière** peut
devenir son support : il la reçoit chaque semaine et la transmet lui-même à ses
adhérents, avec son lien de recommandation dans le bouton. C'est le prescripteur
qui envoie, à des personnes qui l'ont accepté : aucun courriel non sollicité ne
part de signauxfaibles.

### 3. Le client recommandé a un avantage

Sans nouveau code : un essai de quatre parutions au lieu de deux
(`réglerLeParcours`, réglage `parutions`, déjà en place). Le prescripteur a
quelque chose à offrir, et le client plus de temps pour juger.

### 4. L'opératrice suit chaque prescripteur

Un tableau `/espaces/prescripteurs`, gardé comme `/espaces/abonnements`
(privilège « Tous les espaces », garde dans la fonction) : par prescripteur, les
organisations recommandées et leur étape (`libelléDÉtape` : essai, abonnée,
suspendue). Chaque mois, un **brouillon Gmail** de point au prescripteur
(`créerBrouillon`, comme les courriers commerciaux), relu et envoyé par
l'opératrice. Jamais d'envoi direct, jamais de séquence.

## Ce que le prescripteur ne voit jamais

- **Les lettres de ses clients.** Le cloisonnement par client (règles 2 et 7 de
  `CLAUDE.md`) ne connaît pas d'exception de ce côté : un prescripteur n'est
  jamais lecteur d'une autre organisation que la sienne, et n'a jamais le
  privilège « Tous les espaces ».
- **Un libellé d'étape sans accord du client.** Le point mensuel nomme une
  organisation et son étape ; c'est une information commerciale sur le client,
  à couvrir par une mention à l'onboarding (décision ci-dessous).

## La contrepartie : trois options

Montants calculés sur `lib/domaine/offre.ts` (149 € HT par mois, 1 490 € HT par
an).

| Option | Le prescripteur reçoit | Coût pour signauxfaibles | Ce que cela demande |
| --- | --- | --- | --- |
| A. Réciprocité | Son espace en accès offert, et un avantage pour ses clients (quatre parutions d'essai) | Une lettre par semaine pour le prescripteur | Rien de plus que ce qui existe |
| B. Commission | 20 % du HT encaissé la première année : 29,80 € par mois et par client mensuel (357,60 € au plus), 298 € par client annuel | 20 % de la première année | Un relevé mensuel lu dans `abonnements`, la facture du prescripteur, un contrat |
| C. Remise au client | Rien en propre ; ses clients paient moins (par exemple deux mois offerts sur l'annuel) | La remise | Un prix Stripe ou un coupon de plus |

**Recommandation** : commencer par A, qui ne demande ni contrat ni flux
d'argent et s'appuie sur ce qui existe ; passer à B pour un prescripteur qui a
apporté trois abonnés, par un contrat à lui.

## Ce qui est codé

| Pièce | Où |
| --- | --- |
| Table `prescripteurs` (organisation du prescripteur, code unique, type, actif) ; `organisations.recommandée_par` et `recommandée_le` ; contrainte : jamais à la fois recommandée et entrée par prospection | `lib/base/schema.ts`, migration `drizzle/0012_prescripteurs.sql` |
| Déclarer un prescripteur ; liste d'exclusion ; tableau | `lib/base/prescripteurs.ts`, `POST` et `GET /api/veille/prescripteurs` (`docs/api-veille.md`) |
| Rattacher une organisation recommandée, quatre parutions d'essai, refus de la prospection (`hors-prospection`, `déjà-prospectée`) | `ouvrirEnEssai` (`lib/base/organisations.ts`), champ `prescripteur` de `POST /api/veille/organisations` |
| Le code dans la demande de démo, lu à l'envoi du formulaire ; la page reste sans base | `lib/domaine/prescripteurs.ts`, `lib/portail/demo.ts`, `app/(portail)/demo/formulaire.tsx` |
| Tableau de l'opératrice : lien de recommandation, organisations recommandées et leur étape | `/espaces/prescripteurs`, `listerLesPrescripteurs` (`lib/auth/appartenance.ts`) |
| Gardes : seul appelant du tableau, `/demo` sans import de `lib/base/` | `tests/architecture.test.ts` |

## Mettre un prescripteur en service

1. Ouvrir son espace comme celui d'un client (`/onboarding-demande`,
   référentiels, première lettre, activation).
2. `POST /api/veille/prescripteurs` `{ "slug", "code", "type" }`.
3. Poser l'accès offert : `PATCH /api/veille/organisations`
   `{ "slug", "action": "offre", "offre": "gratuite" }`, ou le tableau des
   abonnements.
4. Lui donner son lien, affiché sur `/espaces/prescripteurs` :
   `https://www.signauxfaibles.io/demo?de=<code>`.
5. À chaque demande de démo qui porte un code, passer
   `"prescripteur": "<code>"` à l'onboarding.
6. Ajouter la lecture de `GET /api/veille/prescripteurs?exclusions=1` à la
   tâche de prospection, avant la constitution du lot.

## Ce qui reste

- **Le point mensuel au prescripteur**, en brouillon Gmail : il attend la
  mention à l'onboarding qui autorise à lui donner le nom et l'étape de ses
  clients.
- **La lettre de filière transmise** par les chambres, clusters et
  fédérations : elle attend la mise en service des lettres de filière
  (`docs/programme-lettre-unique.md`) et une décision de marque.
- **La commission (option B)** : pour un prescripteur qui a apporté trois
  abonnés, par un contrat à lui ; le relevé se lira dans `abonnements`.
- **La durée de l'attribution** : aujourd'hui, le premier prescripteur garde
  l'organisation sans limite ; une durée ne compte qu'avec une commission.
