# Installer une organisation : de la demande au portail ouvert

Ce document décrit le chemin complet d'une nouvelle organisation, depuis la
demande jusqu'au moment où son lecteur ouvre son portail. Il couvre les deux
moitiés du dispositif, qui ne vivent pas au même endroit :

- **la veille** est produite par des tâches Cowork qui écrivent dans Notion,
  hors de ce dépôt ;
- **le portail** lit Notion et n'y écrit jamais.

Elles se rejoignent en un seul point : la base « Accès — portail ». Tout le
reste est étanche, et doit le rester.

Écrit le 10 septembre 2026, à partir du schéma réel des bases Notion.

## Vue d'ensemble

Le registre « Organisations — pipeline et activation » porte un statut qui
avance d'un cran par étape. Il n'y a pas de raccourci : chaque cran suppose que
le précédent a été jugé bon par un humain.

| Statut | Ce qui vient d'arriver | Qui agit ensuite |
|---|---|---|
| `1 · Demande reçue` | la ligne existe, le site est renseigné | l'opérateur lance l'exécution A |
| `2 · Référentiels générés — à valider` | fiche et référentiels écrits, points de validation créés | le client répond aux points |
| `3 · Référentiels validés` | les réponses sont répercutées | l'opérateur lance l'exécution B |
| `4 · Première lettre produite — à valider` | brouillons créés, non envoyés | le relecteur juge la lettre |
| `5 · Prête à activer` | la lettre est bonne | l'opérateur coche « ▶ Activer » |
| `6 · Veille active` | la veille tourne toute seule | personne, sauf incident |
| `0 · Écartée` | l'organisation ne sera pas équipée | — |

Deux interrupteurs commandent tout le reste. **`Veille automatique`** est
l'interrupteur maître : décoché, l'organisation est ignorée par les tâches
hebdomadaire et mensuelle. **`▶ Activer`** est le seul geste d'activation : le
balayage du matin coche `Veille automatique`, renseigne `Activée le`, passe au
statut 6 et se décoche.

Les trois autres cases `▶` lancent une exécution sur la ligne cochée. L'agent
les décoche en fin de course : une case restée cochée signale une exécution qui
n'est pas allée au bout.

## Étape 1 · La demande

Créer une ligne dans le registre. **Le seul champ réellement obligatoire est
`URL du site`** : tout le reste peut être découvert ou demandé ensuite.

Renseigner si connu : `Organisation`, `Lecteur final` et son email, `Marché ou
métier` tel que le dirigeant le vit et non son code NAF, `Périmètre
géographique`, `Usage éditorial`, et les trois questions de cadrage.

Les trois questions portent tout le scoring qui suivra. Elles méritent d'être
posées telles quelles :

- **Q1** — ce qui remplit le carnet.
- **Q2** — qui signe, et ce qui déclenche.
- **Q3** — ce qui tuerait l'activité à douze mois.

Q3 est la plus souvent mal répondue. Un client décrit volontiers la
*conséquence* qu'il redoute plutôt que la *cause*. C'est à l'exécution A de le
signaler, et à l'opérateur de faire trancher.

`Slug` : identifiant court, sans espace ni accent. Il servira dans les titres
d'édition, dans les archives, **et dans l'URL du portail**. Le choisir une fois
pour toutes ; le changer ensuite casse les liens déjà envoyés.

`Jour de parution` : attribué au jour le moins chargé, modifiable à la main.
`Heure de parution` décale les organisations qui partagent un même jour. Les
trois premières organisations occupent lundi, mardi et mercredi, ce qui étale
la charge et laisse la journée de production à l'agent.

**La revue mensuelle tombe la veille du jour de parution.** En tenir compte
quand on choisit le jour.

## Étape 2 · Exécution A, les référentiels

Cocher **`▶ Générer les référentiels (A)`**.

L'exécution lit le site, le recoupe, et produit : la page organisation, la
fiche v1.0, un référentiel par veille à installer, et une série de **points de
validation** dans la base « Validations — fiches et référentiels ». Elle
renseigne `Diagnostic de pré-qualification`, `État du site`, `Sources de
substitution retenues` et `Questions à poser au client`.

Elle décide aussi des **veilles à installer**. Deux familles existent :
l'écosystème, qui suit ce qui s'impose à l'organisation, et le concurrentiel,
qui compare sa position à d'autres. Le nom client de la seconde varie —
« Concurrentiel », « Positionnement », « Attractivité » — selon ce que
l'organisation affronte réellement. Une collectivité n'a pas de concurrents
commerciaux ; elle a des territoires voisins qui captent les mêmes actifs.

Statut à l'issue : `2 · Référentiels générés — à valider`.

## Étape 3 · Faire répondre le client

Les points de validation sont classés par priorité :

| Priorité | Ce qu'elle couvre | Bloquante ? |
|---|---|---|
| `1 · Scoring` | ce qui commande les critères FORT | oui |
| `2 · Fiche` | identité, gouvernance, périmètre | oui |
| `3 · Corpus` | sources retenues ou écartées | non |
| `4 · Fenêtres` | fenêtres temporelles, cadences | non |

Chaque point porte une `Valeur proposée` — ce que le document affirme
aujourd'hui — et attend une `Réponse` : `Validé`, `Corrigé` (avec la
`Valeur corrigée`), `Refusé`, ou `Ne sait pas`. Le `Statut source` dit ce que
vaut l'information : `confirmé`, `client`, `déclaratif`, `à confirmer`, `n.d.`.

« Ne sait pas » est une réponse acceptable et utile : elle ferme le point sans
inventer, et laisse le référentiel marquer l'information comme non établie.

## Étape 4 · Exécution A-bis, répercuter

Cocher **`▶ Répercuter les validations (A-bis)`** quand les points de priorité
1 et 2 ont une réponse. Les priorités 3 et 4 peuvent attendre.

L'exécution applique les réponses, monte les documents en v1.1, note dans
chaque point le document où la réponse a été appliquée, et passe leur statut à
`Répercuté`. Elle peut créer de nouveaux points si une réponse en ouvre.

Statut à l'issue : `3 · Référentiels validés`.

## Étape 5 · Exécution B, la première lettre

Cocher **`▶ Produire la première lettre (B)`**, après le passage au statut 3.

L'exécution produit une édition par veille installée, les crée dans « Éditions
de veille », et prépare un brouillon d'email. **Les brouillons ne sont pas
envoyés.** C'est la règle de la première lettre : elle passe par un humain
avant d'atteindre qui que ce soit.

`Email du lecteur final` est là pour mémoire seulement — les brouillons partent
toujours chez le relecteur, jamais chez le client.

Statut à l'issue : `4 · Première lettre produite — à valider`.

## Étape 6 · Juger la lettre, puis activer

Lire la lettre en se posant une seule question : **est-ce que ce document
mérite quinze minutes du temps du lecteur ?** Si la réponse est non, corriger
le référentiel plutôt que la lettre — c'est le référentiel qui produira les
cinquante suivantes.

Quand la lettre est bonne, passer au statut `5 · Prête à activer`, puis cocher
**`▶ Activer`**. Le balayage du matin fait le reste.

## Étape 7 · Ouvrir le portail

C'est ici que les deux moitiés se rejoignent, et c'est la seule étape que le
portail voit.

**Créer une ligne par personne** dans « Accès — portail »
(`collection://4d3d7403-35d7-4815-884b-877d17423842`). Un lien par personne :
deux lecteurs chez le même client font deux lignes, pour que la révocation soit
individuelle.

| Propriété | Ce qu'on y met |
|---|---|
| `Nom` | prénom et nom, repris dans le courrier |
| `Email` | l'adresse à laquelle le lien sera envoyé |
| `Organisation (libellé)` | affichage seulement, en en-tête du portail |
| **`Identifiant Notion de l'organisation`** | le `page_id` de la **ligne du registre** — voir le piège ci-dessous |
| `Slug` | **identique** à celui du registre |
| `Identifiant d'accès` | aléatoire, 32 caractères hexadécimaux (voir ci-dessous) |
| `Actif` | coché |

### Le piège : deux pages portent le nom du client

Chaque organisation a **deux pages** dans l'espace, et elles se ressemblent :

- la **ligne du registre** « Organisations — pipeline et activation », celle qui
  porte le statut, la cadence, les référentiels — **c'est elle qu'il faut** ;
- la **page organisation**, page de travail sous « Veilles clients », qui décrit
  les dispositifs et renvoie vers le registre par une ligne « Fiche au
  registre ».

Les deux ont un `page_id` de même forme, et rien ne les distingue une fois
collées dans un champ texte. C'est la page organisation qu'on a naturellement
sous les yeux, et c'est donc elle qu'on colle par erreur.

**La conséquence est silencieuse.** Le portail filtre les éditions par
`Organisation contains <identifiant>` ; les éditions portent la ligne du
registre. Avec l'identifiant de la page organisation, le filtre ne rencontre
rien : la personne se connecte normalement et découvre un espace vide. Aucune
erreur, aucun refus — c'est le comportement voulu de la règle 2, qui préfère
ne rien montrer plutôt que de risquer les données d'un autre client.

**Comment vérifier en dix secondes.** Ouvrir une édition du client dans
« Éditions de veille », regarder sa propriété `Organisation`, et comparer à ce
qui est dans la ligne « Accès ». Les deux doivent être le même identifiant.

Depuis le 10 septembre 2026, le portail journalise le cas : « accès valide,
aucune édition » avec le slug et l'identifiant, visible dans les journaux
Vercel. Un client réellement neuf produit la même ligne — c'est un signal à
lever, pas une preuve d'erreur.

### Tirer l'identifiant d'accès

Cet identifiant est un secret : c'est lui que le portail signe pour fabriquer
le lien. Il doit venir d'un générateur **cryptographique**, jamais d'un
compteur, d'une date ni d'un nom.

Sur macOS, Linux, ou un terminal Git Bash :

```bash
openssl rand -hex 16
```

Sur Windows, en PowerShell 7 :

```powershell
[System.Convert]::ToHexString([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(16)).ToLower()
```

En Windows PowerShell 5.1, celui installé par défaut, la méthode statique
`GetBytes` n'existe pas encore. La forme suivante marche partout, 5.1 comprise :

```powershell
$octets = [byte[]]::new(16)
[System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($octets)
-join ($octets | ForEach-Object { $_.ToString("x2") })
```

Les trois produisent la même chose : trente-deux caractères hexadécimaux en
minuscules, soit seize octets d'entropie.

**Ne pas utiliser `Get-Random`.** C'est un générateur pseudo-aléatoire ordinaire,
prévu pour tirer au sort, pas pour produire un secret. Un identifiant issu de
`Get-Random` serait devinable.

**L'identifiant d'organisation est la seule clé de cloisonnement.** Le portail
n'a pas accès au registre — il ne peut donc pas résoudre un nom en identifiant,
et cette recopie est le seul moyen qu'il ait de savoir à qui appartient une
édition. Une ligne sans cet identifiant est refusée : mieux vaut un portail vide
qu'une requête non cloisonnée.

**Le slug doit être identique des deux côtés.** Le portail compare le slug de
l'URL à celui de la ligne d'accès ; un écart donne une page introuvable, sans
message explicite, parce qu'il ne faut pas confirmer l'existence du slug d'un
autre client.

Puis envoyer le lien : la personne va sur « recevoir mon lien », saisit son
adresse, et le portail recompose le lien signé et le lui envoie. Le portail
n'écrit rien dans Notion en le faisant.

## Le régime de croisière

Une fois au statut 6, la veille tourne seule. Deux rendez-vous :

- **la parution**, au jour et à l'heure de la ligne, selon la `Cadence` —
  hebdomadaire, quinzaine sur semaines paires, ou mensuelle à la première
  occurrence du mois ;
- **la revue mensuelle**, la veille du jour de parution, qui relit les
  référentiels et propose des amendements.

Le portail, lui, ne publie que les éditions au statut **`Envoyé`**. Une édition
`Relu` n'est pas publiée : c'est l'envoi qui fait la publication. Un retour en
`Brouillon` ou une mise à la corbeille la retire du portail, par webhook.

Le portail présente **une entrée par semaine**, qui rassemble les deux notes de
la parution, et une archive qui liste les semaines.

## Mettre en pause, révoquer, écarter

**Suspendre une veille** : décocher `Veille automatique` et renseigner
`Motif de pause`. Les tâches ignorent la ligne. Le portail continue de servir
les éditions déjà envoyées : la veille dort, l'archive reste.

**Révoquer un accès** : décocher `Actif` sur la ligne de « Accès — portail ».
Effectif à la requête suivante. Régénérer l'`Identifiant d'accès` invalide en
plus le lien déjà en circulation, ce qui est la bonne réponse à un lien
transféré.

**Écarter une organisation** : statut `0 · Écartée`. Ne pas supprimer la ligne
si des éditions y sont rattachées.

## Pièges constatés

**Ne jamais créer de doublon dans le registre.** Le 9 septembre 2026, une ligne
mise à la corbeille est restée la cible de la relation `Organisation` de deux
éditions, sans que rien ne le signale : une page à la corbeille reste une cible
valide pour l'API, le lien ne casse pas, il devient silencieusement faux. Si un
doublon est créé, rattacher les éditions à la ligne vivante avant d'ouvrir un
accès.

**Le nom d'une organisation ne fait jamais autorité.** Ni pour le
cloisonnement, qui passe par l'identifiant de page, ni pour le titre d'une
édition, fixé par chaque référentiel et différent d'une organisation à l'autre.

**Les clients ne sont jamais invités dans Notion.** L'espace de travail reste à
un seul membre, l'opérateur : un espace gratuit à plusieurs membres est plafonné
à mille blocs à vie, et l'API refuse ensuite toute création. Le portail est la
seule interface des clients.

**Le registre n'est jamais partagé avec l'intégration du portail.** Il contient
l'intake confidentiel. Seules « Éditions de veille » et « Accès — portail » le
sont, et c'est ce qui rend la recopie de l'identifiant nécessaire.

## Récapitulatif

- [ ] Ligne créée dans le registre, `URL du site` renseignée, `Slug` choisi
- [ ] Jour et heure de parution attribués, revue mensuelle la veille
- [ ] `▶ Générer les référentiels (A)` — statut 2
- [ ] Points de priorité 1 et 2 répondus par le client
- [ ] `▶ Répercuter les validations (A-bis)` — statut 3
- [ ] `▶ Produire la première lettre (B)` — statut 4
- [ ] Première lettre lue et jugée bonne — statut 5
- [ ] `▶ Activer` — statut 6
- [ ] Une ligne par personne dans « Accès — portail », identifiant
      d'organisation recopié, slug identique, `Actif` coché
- [ ] Lien envoyé et ouverture vérifiée
