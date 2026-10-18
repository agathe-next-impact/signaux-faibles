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
| 4 · Première lettre produite | la tâche « Onboarding : première lettre » appelle, dans cet ordre, `POST /api/veille/organisations` (entrée en essai), coche Actif, `POST /api/veille/importer-acces`, puis `POST /api/acces/ouvrir` (lien d'accès) |
| première lettre envoyée par la relectrice | la réconciliation passe l'édition en `Envoyé` ; le lendemain matin, `/api/veille/parcours` fixe **J0** à sa date |
| 6 · Veille active | rien de plus : l'activation ne conditionne pas l'accès |

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
- **L'essai** : trois parutions complètes (semaine de J0 et les deux
  suivantes), une parution réduite à « L'essentiel », puis suspension sans
  abonnement Stripe. Le portail écrit au lecteur à la troisième et à la
  quatrième semaine (journal `courriers`).

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

Cinq commandes projet (`.claude/skills/`), une par lancement du cycle. Aucune ne
recopie de prompt : chacune ouvre la page Notion « Tâche — Onboarding d'une
organisation », qui fait foi, et n'en exécute que la section de son étape, sur
une seule organisation. Chacune coche puis décoche la case ▶ de son étape,
pour que le registre garde la trace du lancement. Le modèle ne les déclenche
jamais de lui-même (`disable-model-invocation`).

| Commande | Étape | Statut attendu |
|---|---|---|
| `/onboarding-demande Organisation : … · URL : …` | 1, enregistrer la demande | aucune ligne |
| `/onboarding-referentiels <nom>` | A, balayage §3 | 1 |
| `/onboarding-repercussion <nom> [partiel]` | A-bis, balayage §2 | 2 à 5 |
| `/onboarding-premiere-lettre <nom>` | B, première lettre | 3 |
| `/onboarding-activation <nom>` | activation, balayage §1 | 4 ou 5 |

Les appels au portail des deux dernières (`/api/veille/*`, `/api/acces/ouvrir`)
demandent une session sur l'environnement « signaux-faibles-io » : ailleurs,
ils reçoivent 401 ou 403, et la commande le dit au lieu de chercher un jeton.
