# Procédure de test du dispositif « lettre unique » (file de travaux, Trigger.dev, Payload)

*Écrite le 21 octobre 2026, après la fusion des PR 54 à 56 et la rotation
d'`ACTIVATION_SECRET`. État de départ vérifié ce jour à 14:18 UTC : production
READY, migrations Drizzle 0009 et Payload `retrait_runs` appliquées, premier
utilisateur Payload créé, `TRIGGER_SECRET_KEY` et `TRIGGER_PROJECT_REF` posées
sur Vercel, nouvelle `ACTIVATION_SECRET` reconnue depuis une session neuve de
l'environnement « signaux-faibles-io » (trois routes de veille en 200).*

## Règles communes à tous les tests

- **Le jeton ne s'écrit jamais.** Toute commande `curl` ci-dessous est lancée
  depuis une session Claude Code de l'environnement **« signaux-faibles-io »**
  (identifiant `env_01VZWMpwnvqV6XrWky72HWeV`), qui ajoute lui-même l'en-tête
  d'autorisation vers `www.signauxfaibles.io`. Une session ouverte **avant** une
  rotation du secret garde l'ancienne valeur : relancer une session neuve.
  Depuis une autre machine, l'en-tête est `Authorization: Bearer <ACTIVATION_SECRET>`.
- **L'adresse porte toujours `www.`** : l'apex redirige, et une redirection
  perd l'en-tête.
- **Ne jamais passer une organisation réelle « à onboarder » dans l'admin
  pendant les tests** : ce geste lance l'onboarding complet (8 à 15 $) et fait
  partir un lien d'accès au contact.
- **Chaque test dit son coût.** Les tests T1, T3 et T6 ne coûtent rien ; T2 et
  T5 appellent le modèle.
- Après chaque test, noter dans le journal de `docs/programme-lettre-unique.md`
  la date, le résultat et l'écart éventuel.

## T0. Préalables, à relancer avant chaque séance

Depuis une session neuve de « signaux-faibles-io » :

```
curl -s https://www.signauxfaibles.io/api/veille/etat | head -c 300
curl -s https://www.signauxfaibles.io/api/veille/travaux
curl -s "https://www.signauxfaibles.io/api/veille/dossier?mode=selection"
```

Attendu : `"état":"contrôlé"` et `"base":"joignable"` ; une file avec ses
cinq compteurs (tous à zéro tant qu'aucune veille `unique` n'est déclarée) ;
`{"organisations":[],"filieres":[]}`. Un 401 sur l'une des trois signifie que
le secret de l'environnement n'est pas celui de Vercel : ne rien tester avant
de l'avoir aligné (voir la session du 21 octobre).

## T1. Trigger.dev joignable et branché sur le portail (coût nul)

1. Dans le tableau de bord Trigger.dev, projet « signaux-faibles »,
   environnement **prod**, onglet **Tasks** : les sept tâches doivent être
   listées, `vider-la-file`, `produire-la-lettre`, `lettres-de-filiere`,
   `produire-la-lettre-de-filiere`, `onboarding`, `edition-de-decouverte`,
   `bloc-personnalise`. Si la liste est vide, le déploiement n'a pas été fait :
   `TRIGGER_PROJECT_REF=proj_… pnpm exec trigger.dev deploy` depuis le dépôt,
   après `pnpm exec trigger.dev login`.
2. Onglet **Schedules** : `vider-la-file` toutes les heures de 6 h à 20 h,
   du lundi au vendredi, Europe/Paris ; `lettres-de-filiere` le lundi à 6 h.
3. Lancer `vider-la-file` à la main (**Test** sur la tâche, charge utile `{}`).
   Attendu : run `Completed`, sortie `{ "confiés": [] }`, journal « file vidée,
   confiés 0 ». C'est la preuve que `PORTAIL_URL` et `ACTIVATION_SECRET` de
   l'environnement Trigger.dev sont bons.
   - Erreur `POST /api/veille/travaux (prendre) : 401` : `ACTIVATION_SECRET`
     de l'environnement Trigger.dev n'est pas celle de Vercel.
   - Erreur de connexion : `PORTAIL_URL` absent ou sans `https://www.`.
4. Vérifier le sens portail vers Trigger.dev sans rien déclencher : dans les
   journaux Vercel (`Runtime logs`, production), aucun
   `[moteur] déclenchement ignoré : TRIGGER_SECRET_KEY absente` depuis le
   redéploiement de 13:53 UTC. Un tel message signifierait que la variable n'a
   pas été chargée.

## T2. Mesure de la lettre unique en local (coût : un appel de conversion par organisation, puis 2 à 5 $ par lettre)

Prérequis : crédits API rechargés, `ANTHROPIC_API_KEY` dans l'environnement
du terminal, dépôt à jour, exports présents dans `evaluation/entrees/`
(Konica, Infralliance, Hermitage, Petite Vitrine).

1. Conversion des deux référentiels Notion en un référentiel unique :
   ```
   pnpm evaluation:unique convertir --organisation konica,infralliance
   ```
   Attendu : un fichier `referentiel-unique.md` par organisation sous
   `evaluation/sorties/<horodatage>/`, relu sans erreur par
   `lireRéférentielUnique` (le script s'arrête sinon). Vérifier à l'œil :
   dix à quinze axes, chacun avec ses sources en URL réelles, ses requêtes et
   ses critères FORT et MOYEN.
2. Répétition à blanc, sans appel au modèle, pour vérifier la collecte :
   ```
   pnpm evaluation:unique generer --organisation konica --a-blanc
   ```
   Attendu : le nombre de sources ouvertes et la couverture (part des sources
   nommées effectivement lues). Une couverture sous 0,7 se corrige dans le
   référentiel (sources mortes ou fermées), pas dans le moteur.
3. Génération réelle :
   ```
   pnpm evaluation:unique generer --organisation konica,infralliance
   ```
   Le rapport `rapport.md` du dossier de sortie donne, par organisation :
   acceptée ou non, manquements restants, axes, faits, couverture, reprises,
   recherches, coût, durée.

Critères de passage, à reporter dans le journal :

| Mesure | Seuil |
|---|---|
| Lettre acceptée | oui, en deux reprises au plus |
| Axes | 10 à 15 |
| Faits datés et sourcés | au moins un par axe non RAS |
| Couverture des sources | 0,7 ou plus |
| Coût par lettre | compatible avec l'offre (29 ou 89 € HT par mois pour quatre lettres) |
| Lecture humaine | aucun fait inventé sur dix vérifiés, aucune date fausse |

Si une organisation échoue sur le contrat de forme, lire les codes de rupture
dans le rapport : ils nomment l'axe et la règle ; corriger le référentiel
(sources, critères) avant d'incriminer la rédaction.

## T3. La file à vide en production (coût nul)

Depuis une session neuve de « signaux-faibles-io ». Rien n'est créé.

```
curl -s -X POST https://www.signauxfaibles.io/api/veille/travaux \
  -H 'content-type: application/json' -d '{"action":"prendre","session":"test-t3"}'
```
Attendu : `{"état":"vide"}`.

```
curl -s "https://www.signauxfaibles.io/api/veille/dossier?travail=00000000-0000-4000-8000-000000000000"
```
Attendu : 404 `{"état":"travail-inconnu"}`.

```
curl -s -X POST https://www.signauxfaibles.io/api/veille/travaux \
  -H 'content-type: application/json' \
  -d '{"action":"prendre","session":"test-t3","travail":"00000000-0000-4000-8000-000000000000"}'
```
Attendu : 409 `{"état":"non-prenable"}`.

Écran : connectée en opératrice, ouvrir `https://www.signauxfaibles.io/espaces/file`.
Attendu : les quatre tuiles à zéro, le texte « Aucun travail ouvert », le lien
« Choisir un espace ». Sur `/espaces`, le lien « Suivre la file de travaux ».

## T4. Reporté : un client historique sur le moteur

Un client existant garde pour clé de cloisonnement l'identifiant de sa ligne
de registre Notion. Le dossier d'un travail et l'envoi des courriers retrouvent
l'organisation Payload par cette même clé : il faudrait donc la repointer vers
l'identifiant Payload, ce qui viderait son espace tant que
`SOURCE_DOCUMENTS` vaut `notion`. Ce test se fait à la bascule, après l'import
de l'archive (`pnpm documents:importer`, à écrire), jamais avant.

## T5. Onboarding complet d'une organisation de test, de bout en bout (coût : 8 à 15 $)

C'est le test qui prouve la chaîne entière : registre Payload, ouverture dans
le portail, veille `unique` déclarée, travail `premiere_lettre` posé et pris
par le run, référentiel dérivé, lettre produite, portes, conclusion par la
file, publication, courrier. Il n'implique aucun client réel : l'organisation
de test reçoit tout à l'adresse de relecture.

Prérequis : T1 et T2 passés ; `RELECTEUR_EMAIL` posée sur Vercel (c'est le
cas) ; la correction du 21 octobre qui fait lire cette variable par l'envoi des
lettres (`lib/portail/parution.ts` lisait `EMAIL_RELECTURE`, variable qui
n'existe pas) déployée.

Limites connues en l'état des bascules, à ne pas prendre pour des pannes :

- `SOURCE_ACCES` vaut `double`, Notion fait foi : le crochet Payload ne crée
  pas de lecteur Postgres (journal « lecteur … non créé, Notion fait encore
  foi »), et `/api/acces/ouvrir` ne trouve pas l'adresse : aucun lien d'accès ne
  part, en silence. C'est voulu.
- `SOURCE_DOCUMENTS` vaut `notion` : l'édition publiée dans Payload ne
  s'affiche pas encore dans un espace client. Elle se lit dans l'admin et dans
  le courrier.

Déroulé, dans cet ordre strict :

1. **Admin, filière.** Créer une filière « Test moteur » (slug `test-moteur`),
   active, et lui donner un référentiel de filière : coller le
   `referentiel-unique.md` de Konica issu de T2, titre « Référentiel de filière
   test », `actif` coché, rattaché à la **filière** (jamais à une organisation
   en même temps).
2. **Admin, organisation, état `prospect`.** Nom « Test moteur », slug
   `test-moteur`, site : l'URL du site de Konica Minolta France, filière « Test
   moteur », contact : votre nom et `agathe@signauxfaibles.io`, état
   **`prospect`** (aucun crochet ne part à cet état). Noter l'identifiant
   Payload (uuid avec tirets, dans l'URL de la fiche).
3. **Portail, ligne de l'organisation.** Depuis la session de l'environnement :
   ```
   curl -s -X POST https://www.signauxfaibles.io/api/veille/organisations \
     -H 'content-type: application/json' \
     -d '{"slug":"test-moteur","nom":"Test moteur","registreNotion":"<uuid Payload sans tirets, 32 hexadécimaux>"}'
   ```
   Attendu : 201 `créée`. Puis la relecture, pour que la lettre vienne à vous :
   ```
   curl -s -X PATCH https://www.signauxfaibles.io/api/veille/organisations \
     -H 'content-type: application/json' \
     -d '{"slug":"test-moteur","action":"relecture","requise":true}'
   ```
   Attendu : 200 `relecture-réglée`.
4. **Admin, déclenchement.** Passer l'organisation à l'état **« À onboarder »**
   et enregistrer. Vérifier dans les journaux Vercel : `[registre] test-moteur`
   sans erreur, puis `[moteur] tâche onboarding déclenchée : run run_…`.
   Vérifier la veille :
   ```
   curl -s "https://www.signauxfaibles.io/api/veille/veilles?slug=test-moteur"
   ```
   Attendu : une veille `unique`, lundi, `06:00`, hebdomadaire, numéro courant 0.
5. **Trigger.dev, le run `onboarding`.** Le suivre dans le tableau de bord
   (10 à 30 minutes). Jalons attendus dans le journal du run : « référentiel
   remis », puis la prise du travail (dans `/espaces/file`, une ligne
   `test-moteur · première lettre · pris`), « dossier du travail » avec
   `numéro: 1`, « édition remise » avec `accusé.statut: "publiee"` et
   `travail: "accepte"`.
6. **Résultats à constater.**
   - `/espaces/file` : la ligne passe à `accepté`, compteur « acceptés » à 1.
   - Admin, collection Éditions : une édition « Test moteur », numéro 1, statut
     publiée, `blocs` calculés ; collection Référentiels : le référentiel
     unique dérivé, actif, version 1 ; collection Gels : une ligne par source lue.
   - Un courrier « [Relecture, pour test-moteur] … » dans la boîte de
     relecture, mis en forme par le gabarit de la charte ; dans
     `GET /api/veille/courriers?jours=1`, une ligne `lettre`, état `envoye`,
     déclencheur `parution`.
   - `GET /api/veille/veilles?slug=test-moteur` : numéro courant 1.
   - Journal Vercel : aucun `[veille/editions] … refusée`.
7. **Lecture de la lettre.** La relire avec la grille de T2 : axes, faits datés
   et sourcés, aucune invention. C'est la mesure qui compte pour décider de la
   suite.
8. **Nettoyage, obligatoire.** Sans lui, le passage quotidien planifiera une
   lettre par semaine pour « Test moteur » et `vider-la-file` la produira :
   ```
   curl -s -X POST https://www.signauxfaibles.io/api/veille/veilles \
     -H 'content-type: application/json' \
     -d '{"slug":"test-moteur","type":"unique","libellé":"Veille","jourParution":1,"heureParution":"06:00","cadence":"hebdomadaire","état":"suspendue"}'
   ```
   Attendu : 200 `mise-à-jour`. Puis, dans l'admin, passer l'organisation à
   l'état « Suspendue ». La ligne Postgres et l'édition restent : ce sont des
   traces de test, identifiables par leur slug.

Cas d'échec et lecture :

| Constat | Cause probable | Où regarder |
|---|---|---|
| Run `onboarding` en erreur « travail non posé (organisation-inconnue) » | l'étape 3 a été sautée, ou le slug Payload diffère du slug Postgres | `GET /api/veille/veilles?slug=` |
| « travail non posé (veille-inconnue) » | la veille `unique` n'a pas été déclarée : l'étape 4 a été faite avant la 3 | journaux Vercel `[registre]` |
| « travail … non prenable » | un run précédent l'a déjà pris ; attendre trois heures ou poser un autre jour de parution | `/espaces/file` |
| `accusé.état: "refuse"` | portes du portail ou lint ; la lettre n'est écrite nulle part | `portes` dans la réponse, ligne `runs` de la base |
| Courrier `sans-destinataire` | relecture non réglée (étape 3) et aucun lecteur Postgres | `GET /api/veille/courriers` |
| Courrier absent, `relectureRequise` vrai | `RELECTEUR_EMAIL` absente ou correction non déployée | journaux Vercel `[courriers]` |

## T6. La conclusion par la file : refus et abandon (coût nul)

Prouve que la route `editions` ne publie rien de ce que la file refuse, et
que le troisième refus abandonne. À faire **hors des heures de
`vider-la-file`** (avant 6 h, après 20 h ou le week-end, heure de Paris), ou
en enchaînant les commandes sans pause : un travail prenable entre deux
refus serait pris par la tâche et produirait une vraie lettre.

Prérequis : l'organisation « Test moteur » de T5, veille `unique` remise en
`active` le temps du test (même commande que le nettoyage, avec `"état":"active"`).

1. Poser un travail pour aujourd'hui :
   ```
   curl -s -X POST https://www.signauxfaibles.io/api/veille/travaux \
     -H 'content-type: application/json' \
     -d '{"action":"poser","slug":"test-moteur","veille":"unique","type":"lettre","parution":"<AAAA-MM-JJ du jour>"}'
   ```
   Attendu : 201 `créé` avec `travailId`.
2. Le prendre, puis remettre une édition délibérément non conforme, trois fois
   de suite, avec la **même** session :
   ```
   curl -s -X POST https://www.signauxfaibles.io/api/veille/travaux \
     -H 'content-type: application/json' \
     -d '{"action":"prendre","session":"test-t6","travail":"<travailId>"}'
   ```
   Attendu : 200 `pris`, `contexte.numéro` égal au numéro courant plus un.
   ```
   curl -s -X POST https://www.signauxfaibles.io/api/veille/editions \
     -H 'content-type: application/json' -d @remise-t6.json
   ```
   avec `remise-t6.json` :
   ```json
   {
     "organisation": "<uuid Payload avec tirets>", "filiere": null, "mode": "parution",
     "run": "test-t6", "travail": "<travailId>", "session": "test-t6",
     "proprietes": { "titre": "Test T6", "numero": 99, "dateEdition": "<AAAA-MM-JJ>",
       "periodeCouverte": "", "fenetreElargie": false, "dossiersOuvertsSuivis": "", "actionDeLaSemaine": "" },
     "markdown": "# L’essentiel\n\n- Une ligne.\n",
     "acceptee": true,
     "controle": { "manquements": [], "avertissements": [] },
     "mesures": { "couverture": { "nommees": 0, "ouvertes": 0, "taux": 0 }, "faits": 0, "reprises": 0,
       "recherches": 0, "cout": 0, "dureeMs": 0, "modele": "test" },
     "collecte": { "lectures": [], "gelSuivant": [] },
     "debut": "<ISO>", "fin": "<ISO>"
   }
   ```
   Attendu à la première et à la deuxième remise : 200
   `{"état":"refuse","tentatives":1 puis 2,"portes":{…}}` avec, dans
   `portes.portail`, `numéro-différent` (99 n'est pas le numéro attribué) et,
   dans `portes.ruptures`, les codes du contrat de forme unique
   (`axes-trop-peu` au moins). Entre les deux, `prendre` répond à nouveau
   `pris`.
   Attendu à la troisième : `{"état":"abandonne","tentatives":3,…}`.
3. Constater : `/espaces/file` montre la ligne `abandonné` sur fond rose,
   compteur « abandonnés » à 1 ; l'admin ne porte **aucune** édition « Test
   T6 » ; `GET /api/veille/veilles?slug=test-moteur` a gardé son numéro
   courant ; `prendre` sur ce travail répond désormais 409 `non-prenable`.
4. Remettre la veille en `suspendue`.

## T7. À la bascule seulement

- Import de l'archive Notion vers Payload (`pnpm documents:importer`, à
  écrire), puis `SOURCE_DOCUMENTS=payload` sur une prévisualisation Vercel
  avant la production : les sept écrans d'un client historique doivent montrer
  les mêmes lettres qu'avec Notion, et l'espace de « Test moteur » sa lettre
  n° 1. C'est le seul moment où le rendu des éditions Payload se vérifie.
- `SOURCE_ACCES=postgres` : le crochet Payload crée alors le lecteur du
  contact, et `/api/acces/ouvrir` fait partir le lien après la première lettre.
  Rejouer T5 à ce moment-là, avec une adresse de test, pour voir le lien partir.

## Ce que cette procédure ne couvre pas

- Les lettres de filière (`lettres-de-filiere`, prospects, bloc personnalisé) :
  à tester quand une filière réelle aura son référentiel et au moins un prospect
  de test, selon le même schéma que T5 (adresse de relecture, nettoyage).
- La charge : plusieurs organisations le même lundi. `vider-la-file` prend
  vingt travaux par passage ; au-delà, le passage suivant reprend.
