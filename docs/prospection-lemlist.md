# Prospection par lemlist : la liaison portail ↔ lemlist

*Décidé le 19 octobre 2026. Offre : une lettre 1 envoyée sans sollicitation à partir du site du prospect, qui ouvre un espace et un mois d'essai ; abonnement à 89 € HT par mois ensuite.*

## Le partage des rôles

Trois acteurs, et aucun ne fait le travail d'un autre.

| Qui | Fait | Ne fait jamais |
|---|---|---|
| **La tâche de prospection** (Cowork, connecteur lemlist et Notion) | Constitue le lot du lundi, déclenche l'onboarding, contrôle la lettre 1, écrit les variables lemlist des contacts (`sfUrl`, `sfEssentiel`, `sfFaitMarquant`), lit `GET /api/veille/prospection` pour le score et le registre Notion | Lancer une campagne, ajouter un contact à une campagne, envoyer un email : ces trois gestes restent à l'opératrice |
| **Le portail** | Reçoit les webhooks lemlist, rattache un lead à un lecteur, journalise, arrête la séquence à la première visite, tient `sfStatut` à jour | Ajouter un contact à une campagne, lancer quoi que ce soit, écrire dans Notion |
| **lemlist** | Envoie la lettre 1 et les relances, mesure ouvertures, clics, réponses, désinscriptions, et les pousse au portail | Rien d'autre : lemlist n'est pas le registre |

La source de vérité de **l'état du prospect** est Postgres (`prospections`) ; celle de **l'engagement email** est lemlist, recopiée dans `événements_prospection`. Notion reste la vue de pilotage, alimentée par la tâche.

## Pourquoi le jeton ne voyage pas dans lemlist

Le lien d'accès est signé par un secret qui ne quitte jamais le portail (règle 8 de `CLAUDE.md`). Le bouton de la lettre 1 envoyée par lemlist mène donc à la page « recevoir mon lien » du portail, qui envoie le lien magique par Gmail ; l'activation, au sens de la prospection, est **la première visite** du lecteur sur `/acces/[jeton]`. Deux clics plutôt qu'un, et aucun secret dans un email tiers.

## Ce qui diffère de l'onboarding classique

Quatre règles, décidées le 19 octobre 2026 :

1. **Le lien ne part pas à l'onboarding.** La tâche de prospection fait tout l'onboarding sauf `POST /api/acces/ouvrir` ; le lien magique ne part que sur demande du prospect (« recevoir mon lien »). Un prospect ne reçoit qu'un email non sollicité, celui de lemlist.
2. **Le mois d'essai commence à l'activation.** `POST /api/veille/organisations` avec `origine: "prospection"` crée l'organisation sans `essai_ouvert_le` ; la première visite le pose, et J0 est la première lettre publiée à partir de cette semaine. Une lettre 1 publiée trois semaines avant la visite ne consomme rien de l'essai.
3. **Les lettres 2 à 5 attendent l'activation.** Dans le registre Notion, la ligne reste au statut « lettre 1 envoyée » jusqu'à ce que la tâche de synchronisation lise `actif` dans `GET /api/veille/prospection` et la passe en « essai » ; la tâche des lettres ne sélectionne que les lignes en essai. Un prospect silencieux ne coûte qu'une lettre.
4. **Un prospect silencieux sort.** Après la relance J+10 et quinze jours sans activation, la tâche de synchronisation passe la ligne du registre en « écartée » ; les référentiels restent, pour un retour du même site plus tard.

## Ce qui circule

```
lemlist ──webhook──▶ POST /api/webhooks/lemlist ──▶ prospections, événements_prospection
                                                           │
prospect ──lien magique──▶ GET /acces/[jeton] ──after()──▶ statut actif ──▶ lemlist : lead intéressé (séquence arrêtée), sfStatut=actif
                                                           │
cron 8 h ──▶ GET /api/veille/parcours ──▶ étape du parcours ──▶ abonne / expire / resilie ──▶ lemlist : sfStatut
                                                           │
tâche de prospection ──▶ GET /api/veille/prospection ──▶ score, registre Notion
```

## Champs lemlist

À créer une fois dans lemlist (Paramètres → Variables personnalisées). Le connecteur ne crée pas de champ.

| Champ | Écrit par | Contenu |
|---|---|---|
| `sfUrl` | tâche | site du prospect, clé de l'onboarding |
| `sfEssentiel` | tâche | « L'essentiel » de la lettre 1 (les huit lignes au plus que mesure le validateur), en texte brut ; le corps du mail 1. Le portail n'a pas de page publique de lettre : le prospect lit l'essentiel dans le mail et le reste dans son espace |
| `sfFaitMarquant` | tâche | le fait daté repris dans la relance J+4 |
| `sfStatut` | **portail** | `envoye`, `actif`, `abonne`, `expire`, `resilie`, `rebondi`, `desinscrit` |

Les campagnes se nomment « SF · [secteur de ciblage] » (Conseil, Industrie, ÉSS…), le secteur étant un critère de liste et non un produit : chaque lettre 1 est construite depuis le site du prospect par l'onboarding. Séquence à trois emails (lettre 1 à J0, relance J+4, relance J+10), arrêt automatique sur réponse. Une condition de séquence sur `sfStatut` n'est pas nécessaire : le portail arrête la séquence en marquant le lead intéressé.

## Mise en service

1. Variables Vercel : `LEMLIST_API_KEY` (clé API lemlist) et `LEMLIST_WEBHOOK_SECRET` (`openssl rand -hex 24`). Sans la première, rien ne part ; sans la seconde, le webhook refuse tout.
2. Déployer (la migration 0005 part avec le build).
3. Créer les webhooks lemlist vers `https://signauxfaibles.io/api/webhooks/lemlist`, avec le secret dans le champ `secret`. Un seul webhook sans `type` reçoit tous les événements ; le portail ignore ceux qu'il ne suit pas. Le connecteur lemlist (`create_webhook`) sait le faire.
4. Lot pilote de dix contacts : lettre 1, ouverture d'un espace, vérifier dans lemlist que la séquence s'arrête et que `sfStatut` passe à `actif`, puis dans `GET /api/veille/prospection` que les événements arrivent.

## Ce que le contrôle du soir ne voit pas encore

Une prospection en échec de synchronisation depuis plus de deux jours, ou un lead `actif` dont la séquence n'a pas pu être arrêtée, devrait remonter dans `GET /api/veille/etat`. Ce n'est pas fait : à ajouter avec le premier lot, quand on saura à quoi ressemble un échec réel.
