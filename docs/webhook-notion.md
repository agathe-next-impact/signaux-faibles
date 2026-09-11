# Abonner le portail au webhook Notion

Le webhook est ce qui rend le cache honnête : sans lui, une édition passée en
« Envoyé » resterait invisible jusqu'à la revalidation horaire, et une remise en
brouillon resterait visible tout aussi longtemps.

Faits vérifiés le 9 septembre 2026, détaillés dans `docs/etat-des-api.md` §1.

## Avant de commencer

**L'URL doit être publiquement joignable.** Les prévisualisations Vercel sont
protégées par authentification : Notion n'y verrait qu'une redirection vers une
page de connexion. L'abonnement doit donc viser la **production**, ou cette
route doit être exclue de la protection du projet.

**L'URL ne se change plus après vérification.** « You can only change the
webhook URL before verification. After verification, if you need to change the
URL, you must delete and recreate the subscription. » Les événements souscrits,
eux, se modifient à tout moment.

**Il n'existe pas d'API pour créer un abonnement.** Tout se passe dans
l'interface de l'intégration.

## La marche à suivre

1. Ouvrir les paramètres de l'intégration interne du portail, onglet
   **Webhooks**, puis **Create a subscription**.
2. Saisir l'URL : `https://<domaine-de-production>/api/webhooks/notion`.
3. Choisir la **version d'API `2025-09-03`** au moins. C'est elle qui produit
   les événements `data_source.*` ; en deçà, le portail recevrait les
   `database.*` dépréciés et n'invaliderait rien. Un abonnement ne suit pas
   seul les versions ni les nouveaux types d'événements.
4. Sélectionner les événements. Le portail en exploite cinq :

   | Événement | Ce qu'il couvre |
   |---|---|
   | `page.properties_updated` | le passage en « Envoyé », le cas principal |
   | `page.content_updated` | une note corrigée après envoi |
   | `page.created` | une édition créée directement en « Envoyé » |
   | `page.deleted`, `page.undeleted` | une dépublication par mise à la corbeille |
   | `data_source.schema_updated` | un changement de schéma, qui refait passer la garde de démarrage |

5. Valider. Notion poste immédiatement à l'URL une charge
   `{"verification_token": "secret_…"}`. **Cette charge n'est pas signée** : le
   secret de signature est justement ce qu'elle apporte.
6. Lire le jeton dans les journaux d'exécution Vercel. Le portail le
   journalise sous `[webhook notion] poignée de main reçue`. C'est le seul
   endroit où il apparaît : Notion ne l'affiche pas dans l'interface.
7. Coller le jeton dans **Verify subscription**. Le bouton **Resend token**
   renvoie la poignée de main si elle a été manquée.
8. Poser le même jeton dans la variable d'environnement
   `NOTION_WEBHOOK_SECRET` du projet Vercel, puis redéployer. Tant qu'elle est
   absente, toutes les livraisons repartent en 401.
9. Purger la ligne de journal qui porte le jeton : c'est un secret.

## Vérifier que ça marche

Passer une édition de Brouillon à Envoyé dans Notion, puis regarder les
journaux d'exécution : un POST sur `/api/webhooks/notion` doit y apparaître en
200, dans la minute. La page du portail sert alors la version précédente le
temps que la régénération se fasse en arrière-plan, puis la nouvelle.

Sans toucher à Notion, on peut aussi éprouver le handler avec une charge
fabriquée : le SDK expose `signWebhookPayload`, qui produit exactement ce que
Notion enverrait. `tests/notion.webhook.test.ts` couvre les huit cas, poignée
de main comprise.

## Ce que le webhook ne garantit pas

**Les charges sont creuses.** Elles disent qu'une page a changé, jamais ce
qu'elle est devenue : `updated_properties` contient des identifiants de
propriété, pas des noms ni des valeurs. Le webhook est un déclencheur, jamais
une source de vérité — d'où l'invalidation de tag, suivie d'une relecture.

**L'ordre n'est pas garanti et les événements sont agrégés.** Des changements
rapprochés fusionnent, et peuvent même s'annuler « if the state returns to its
original one ». C'est pourquoi le portail invalide la page *et* sa liste dès
qu'une page bouge, plutôt que de raisonner sur le type d'événement.

**La livraison est « at-most-once ».** Huit tentatives en exponentiel, la
dernière environ vingt-quatre heures après. Un événement peut donc être perdu :
un abonnement en pause, un déploiement au mauvais moment. La revalidation
horaire du profil de cache est le filet ; elle rattrape en une heure ce que le
webhook rattraperait en une minute.

## Le troisième chemin : resynchroniser à la main

Ajouté le 11 septembre 2026. Le webhook rattrape en une minute, la revalidation
horaire en une heure. Il restait un cas sans réponse : **vérifier tout de
suite**, quand on vient de corriger une lettre dans Notion et qu'on veut la voir
dans l'espace, ou quand on soupçonne le webhook d'être débranché (secret
régénéré, abonnement en pause).

Le bouton « resynchroniser depuis Notion » vit dans le rail de l'espace client
et n'apparaît que pour une ligne « Accès » dont la case **Tous les espaces** est
cochée. C'est le privilège qui l'ouvre, pas la visite : sur son propre espace,
l'opératrice n'est pas `enOpérateur` et doit pourtant l'avoir. Il reste fermé
aux clients pour une raison de débit — Notion tient trois requêtes par seconde,
et un bouton « rafraîchir » offert à tout le monde est un bouton sur lequel on
tape.

`lib/portail/resynchroniser.ts` est une action serveur. Elle :

1. vérifie le slug reçu du navigateur par `exigerAccès`, le contrôle unique ;
2. exige `tousLesEspaces` ;
3. relève les corps de notes **avant** d'invalider la liste — ce sont ceux qui
   sont en cache, donc ceux qu'il faut expirer ; une lettre parue depuis n'a
   jamais été lue et n'a rien à invalider ;
4. appelle `updateTag` sur les deux listes et sur chaque page.

`updateTag` et non `revalidateTag`, et c'est tout le sujet. `revalidateTag`
marque périmé et **sert l'ancienne version** pendant la régénération : la
personne qui vient de cliquer verrait encore l'ancienne page, exactement ce
qu'elle cherchait à éviter. `updateTag` expire immédiatement, au prix d'être
réservé aux actions serveur — ce qui tombe bien. `refresh()` termine le geste
côté navigateur : sans lui, le routeur client garderait son propre rendu
pendant les cinq minutes de `stale`.

**`schema:notion` n'est délibérément pas invalidé.** Ce tag porte la garde de
contrat, qui refuse de servir si une propriété manque. Le relancer pendant
qu'une propriété est en cours de renommage dans Notion couperait le portail pour
tous les clients. Un vrai changement de schéma arrive par le webhook, qui porte
l'événement correspondant.

`tests/architecture.test.ts` tient les quatre propriétés, et vérifie surtout que
l'invalidation de cache reste à **deux endroits** : ce handler et cette action.
Un écran qui invaliderait au rendu viderait le cache à chaque visite.
