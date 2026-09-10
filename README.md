# Portail signauxfaibles

Portail web où les clients d'une veille hebdomadaire consultent leurs éditions
archivées. Notion est le back-office unique ; le portail **lit** Notion et n'y
écrit jamais. Il n'a pas de base de données.

Le contexte, les règles non négociables et le modèle de données sont dans
`CLAUDE.md`. Les décisions d'architecture et les faits d'API vérifiés sont dans
`docs/`.

## Démarrer

```bash
pnpm install
cp .env.example .env.local   # puis renseigner les valeurs
pnpm dev
```

Avant tout commit :

```bash
pnpm lint && pnpm typecheck && pnpm test
```

La recette de bout en bout demande un navigateur :

```bash
pnpm e2e
# sur une machine où Chromium est déjà présent :
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/chemin/vers/chromium pnpm e2e
```

## Installer une organisation

`docs/onboarding-organisation.md` décrit le chemin complet, de la demande au
portail ouvert : les sept statuts du registre, les trois exécutions Cowork, la
boucle de validation, puis la ligne à créer dans « Accès — portail ». C'est le
document à suivre pour équiper un nouveau client.

## Ce qu'il faut avoir préparé ailleurs

Le portail ne fonctionne qu'une fois ces quatre choses faites hors du dépôt.

**1. Partager les deux bases Notion, et elles seules.** L'intégration interne
doit voir « Éditions de veille » et « Accès — portail ». Jamais le registre des
organisations, qui contient l'intake confidentiel, ni les validations, ni les
référentiels. Le portail n'a pas besoin du registre : il ne compare que des
identifiants de page.

**2. Renseigner l'identifiant d'organisation dans « Accès — portail ».** La
propriété `Identifiant Notion de l'organisation` porte le `page_id` de la ligne
du registre. C'est la seule clé de cloisonnement. Une ligne d'accès sans cette
valeur est refusée : mieux vaut un portail vide qu'une requête non cloisonnée.

**3. Abonner le webhook.** Notion envoie d'abord une poignée de main ; le jeton
de vérification se copie depuis la page de l'intégration vers
`NOTION_WEBHOOK_SECRET`. Le handler ne le journalise pas.

**4. Autoriser la délégation Workspace.** Le compte de service doit être
autorisé dans la console d'administration pour la **seule** portée
`https://www.googleapis.com/auth/gmail.send`, et emprunter la boîte émettrice
dédiée. Pas de SMTP : l'authentification basique est arrêtée pour Workspace
depuis le 14 mars 2025.

## Comment c'est fait

| | |
|---|---|
| `lib/notion/schema.ts` | le contrat des bases, confronté au schéma réel avant la première lecture |
| `lib/notion/editions.ts`, `acces.ts` | les seules lectures Notion, toutes cachées et filtrées |
| `lib/domaine/` | fonctions pures : impact, semaines, dossiers, arbre de document |
| `lib/auth/` | signature du lien, session, contrôle d'appartenance |
| `proxy.ts` | premier verrou : signature du cookie, pages seulement |
| `app/api/media/[block_id]` | proxy d'images, cloisonné comme une page |
| `app/api/webhooks/notion` | vérifie, invalide les tags, ne relit jamais Notion |

Trois garde-fous méritent d'être connus avant de toucher au code.

**Aucune lecture Notion hors d'une fonction cachée.** Le débit est de trois
requêtes par seconde par intégration. `tests/architecture.test.ts` lit le code
source et échoue si une lecture s'échappe.

**Le cloisonnement ne se décide jamais sur `Organisation[0]`.** Une relation
est une liste. Le 9 septembre 2026, deux éditions ont porté simultanément la
ligne de registre vivante et son doublon mis à la corbeille ; lire le premier
élément aurait donné la mauvaise organisation.

**Aucune URL de fichier Notion dans le HTML.** Elles expirent en une heure.
L'arbre de document ne conserve que l'identifiant du bloc, et un test le
vérifie.

## L'apparence

Les tokens de `app/globals.css` sont ceux de la charte graphique v1.0
(`docs/charte-design.pdf`, transcrite dans `docs/charte-design.md`). Aucun
composant ne porte de couleur ni de taille en dur : ce fichier reste le point
de bascule unique.

Trois règles de la charte se tiennent dans le code plutôt que dans un
commentaire. Le rose ne porte jamais de texte courant, il ne sert qu'aux
badges, au curseur du logo et aux impulsions du motif. L'italique Lora est
réservé à la voix éditoriale, jamais à l'insistance. Et il n'y a qu'un seul
bouton primaire par écran.

## Ce qui n'est pas fait

`docs/maquette-edition.html` n'existe pas. La charte donne les briques, la
maquette donnerait la hiérarchie visuelle de la page d'édition et du panneau
des dossiers ; la mise en page actuelle en découle mais n'a été comparée à
aucune maquette.

Le domaine reste à trancher : la charte porte `signauxfaibles.io`, le
`CLAUDE.md` porte `signal-faible.fr`. Rien n'est codé en dur, `PORTAIL_URL`
est une variable d'environnement, mais c'est ce domaine qui apparaîtra dans
les courriers.

La recette de cloisonnement avec un compte par client demande un déploiement
réel ; elle est décrite en session 8 de `docs/plan-sessions-portail.md`.

Le mode dégradé reste à vérifier en coupant l'accès à Notion sur un
déploiement : c'est le point noté « non vérifié » dans `docs/etat-des-api.md`.
