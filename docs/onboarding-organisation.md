# Installer une organisation : ce que le portail attend

*Réécrit le 18 octobre 2026. La version du 10 septembre décrivait un parcours
périmé (ouverture à l'activation, jeton lu dans une page Notion, lettres envoyées
au relecteur, aucun essai). La procédure complète, côté veille, vit dans Notion :
page « Tâche — Onboarding d'une organisation (prompts A et B) ». Elle fait foi ;
ce document ne décrit que la part du portail.*

## Le parcours, en une ligne par statut du registre

| Statut | Ce qui se passe côté portail |
|---|---|
| 1 · Demande reçue | rien |
| 2 · Référentiels générés | le §3.7bis crée la ligne « Accès », case Actif **décochée**, avec l'identifiant de la **ligne du registre** : le portail ne voit rien |
| 3 · Référentiels validés | rien |
| 4 · Première lettre produite | la tâche « Onboarding : première lettre » appelle `POST /api/veille/organisations` (entrée en essai) et contrôle la ligne « Accès », **laissée inactive** : aucun lien ne part avant la publication (décision du 20 octobre 2026) |
| première lettre envoyée par la relectrice | la réconciliation passe l'édition en `Envoyé` ; le lendemain matin, `/api/veille/parcours` fixe **J0** à sa date |
| 6 · Veille active | l'activation ouvre l'espace si une édition est `Envoyé` : coche Actif, `POST /api/veille/importer-acces`, puis `POST /api/acces/ouvrir` (lien d'accès). Sinon l'espace attend et s'ouvre par `/onboarding-ouvrir-espace` |

## Les appels, et ce qu'ils garantissent

- **Aucun jeton dans les tâches.** Le secret réseau de l'environnement
  « signaux-faibles-io » ajoute `Authorization` à toute requête vers
  `www.signauxfaibles.io`. Toujours l'hôte `www.` : l'apex redirige et la
  redirection perd l'en-tête. Une tâche qui ne tourne pas sur cet
  environnement reçoit 401 (ou n'atteint pas le portail).
- **`POST /api/veille/organisations`** (`docs/api-veille.md`) crée
  l'organisation à l'état `essai`, sans J0. Elle ne rétrograde jamais un client
  historique. Elle doit précéder l'import : sinon l'import crée l'organisation à
  l'état `abonnee`, en accès complet et sans fin d'essai. Un import rejoué trop
  tôt est rattrapé : une `abonnee` créée après le 18/10/2026, il y a moins de
  quatorze jours, sans J0 ni abonnement, passe quand même en essai.
- **J0 n'est écrit par personne.** Le passage quotidien du parcours le fixe à
  la date de la plus ancienne édition publiée datée de la semaine d'entrée en
  essai ou après, une seule fois. Avant, l'espace
  est en lecture complète et aucun courrier de fin d'essai n'est dû.
- **L'essai** : deux parutions complètes par défaut depuis le 24 octobre 2026
  (semaine de J0 et la suivante ; trois auparavant), une parution réduite à
  « L'essentiel », puis suspension sans abonnement Stripe. Le portail écrit au
  lecteur à la dernière parution complète et à la parution réduite, soit la
  deuxième et la troisième semaine (journal `courriers`).

## Les deux pièges qui restent vrais

1. **Ligne du registre contre page organisation.** Chaque client a deux pages
   de même forme. Les éditions pointent vers la ligne du registre ; coller
   l'identifiant de la page organisation donne un espace vide et silencieux.
   Vérification : la propriété `Organisation` d'une édition du client doit être
   le même identifiant que la ligne « Accès ».
2. **Ne jamais dupliquer une ligne « Accès ».** La duplication recopie
   `Identifiant d'accès`, et le portail refuse alors les deux liens. Ligne
   vierge, identifiant neuf (`openssl rand -hex 16`).

Un espace vide a d'abord une autre cause, plus fréquente : des lettres encore
au statut `Brouillon`. Vérifier le statut avant l'identifiant.

## Lancer chaque étape depuis Claude Code

Six commandes projet (`.claude/skills/`), une par lancement du cycle, décrites
pour l'usage dans `docs/guide-commandes-onboarding.html`. Aucune ne
recopie de prompt : chacune ouvre la page Notion « Tâche — Onboarding d'une
organisation », qui fait foi, et n'en exécute que la section de son étape, sur
une seule organisation. Chacune coche puis décoche la case ▶ de son étape,
pour que le registre garde la trace du lancement. Le modèle ne les déclenche
jamais de lui-même (`disable-model-invocation`).

**Aucune validation à l'intérieur d'une étape** (19 octobre 2026). Lancer une
commande vaut ordre pour toutes ses étapes : chaque `SKILL.md` le dit en tête,
et l'agent ne s'arrête que sur les gardes écrites (statut, porte, email
manquant). Les outils dont les étapes ont besoin sont pré-autorisés à deux
endroits : `allowed-tools` dans chaque `SKILL.md`, pour le tour qui lance la
commande, et `permissions.allow` dans `.claude/settings.json`, pour les tours
suivants d'un même lancement. La liste est fermée : lecture et écriture Notion
(sans suppression), lecture, brouillons et envoi Gmail, recherche et lecture
web, `openssl rand`, `curl` vers `https://www.signauxfaibles.io/api/acces/`
et `/api/veille/` seulement, `node scripts/lire-page.mjs`, qui lit avec le
Chromium de la session une source que la récupération simple ne lit pas, et,
depuis le 23 octobre 2026, `pnpm -s collecte:lire` et `pnpm -s collecte:synthese`
(la collecte en code de la première lettre). Un outil hors de cette liste
redemande la permission, et c'est voulu. Ces règles ne lèvent pas une demande
qui vient de la politique d'outils du connecteur lui-même : voir
`docs/cout-premiere-lettre.md`, « Ce qui reste à faire ».

**Le §6 des référentiels fixe la richesse des lettres** (19 octobre 2026). Le
prompt des lettres rédige « selon le §6 du référentiel, sans variation de
structure ». Le §3.6 du balayage renvoyait au « prompt correspondant » sans le
nommer ; les référentiels de La petite vitrine et de Suneido en sont sortis avec
un §6 réduit à un renvoi au contrat de forme, et leurs éditions n°1 comptaient
en moyenne 5 paragraphes de faits, contre 26 pour les lettres régulières. Le
§3.6 désigne désormais le prompt de génération (page Notion « Référentiel de
veille », `3d2fe829ce71801eae49fa7fc4a0e76c`), dont le §6 est recopié verbatim :
treize rubriques, faits de 1 à 3 paragraphes avec « Ce que cela change pour
vous », analyse de la période, six faits datés au moins, tenus par
l'élargissement de la fenêtre et jamais par du remplissage. Les commandes
`/onboarding-referentiels`, `/onboarding-repercussion` et
`/onboarding-premiere-lettre` contrôlent ce §6 ; la dernière tient en outre la
grille de collecte dans un fichier, élargit la fenêtre d'une famille vide et
rouvre au navigateur une source en échec. Le validateur du portail avertit
(`lettre-maigre`, `analyse-absente`) quand une lettre reste en deçà.

| Commande | Étape | Statut attendu |
|---|---|---|
| `/onboarding-demande Organisation : … · URL : …` | 1, enregistrer la demande | aucune ligne |
| `/onboarding-referentiels <nom>` | A, balayage §3 | 1 |
| `/onboarding-repercussion <nom> [partiel]` | A-bis, balayage §2 | 2 à 5 |
| `/onboarding-premiere-lettre <nom>` | B, première lettre | 3 |
| `/onboarding-activation <nom>` | activation, balayage §1 | 4 ou 5 |
| `/onboarding-ouvrir-espace <nom>` | ouverture manuelle de l'espace, §1.3 (d) et (e), après la première publication | 4, 5 ou 6, une édition `Envoyé` |

**Invitation manuelle** (18 octobre 2026). La case du même nom, sur la ligne du
registre, retient l'ouverture de l'espace au-delà de la publication : l'étape
B fait entrer l'organisation en essai (`POST /api/veille/organisations`) sans
cocher « Actif » ni envoyer de lien, comme pour toute organisation depuis le
20 octobre 2026, et le §1.3 de l'activation contrôle sans ouvrir, même si une
lettre est publiée. L'opératrice lance `/onboarding-ouvrir-espace` le jour qu'elle choisit :
contrôle, « Actif », import, puis `POST /api/acces/ouvrir`. Le lien part
toujours du portail, la clé qui le signe ne le quittant pas : on écrit au
client d'abord, puis on lance la commande. L'essai ne démarre qu'à la première
lettre publiée ; publier et inviter la même semaine évite d'entamer l'essai
d'un client qui n'a pas encore d'accès, sinon
`PATCH /api/veille/organisations` `{ "action": "prolonger" }` rattrape l'écart.

Elles vérifient d'abord, par `GET /api/acces/ouvrir`, que le lien pourra
partir. La première lettre n'en envoie plus : pour elle, un refus est signalé,
non bloquant. `/onboarding-ouvrir-espace` exige en plus une édition `Envoyé`.
Les appels au portail des deux dernières (`/api/veille/*`, `/api/acces/ouvrir`)
demandent une session sur l'environnement « signaux-faibles-io » : ailleurs,
ils reçoivent 401 ou 403, et la commande le dit au lieu de chercher un jeton.
