# Plan de sessions du portail

Écrit le 9 septembre 2026, après les vérifications d'API et le pivot Notion
headless. Les sessions sont ordonnées : **ne pas anticiper une session
suivante**. Chaque session se termine par `pnpm lint && pnpm typecheck &&
pnpm test`, un commit, et la mise à jour de ce fichier.

Ce plan couvre le portail seul. Les tâches Cowork (intake, génération,
relecture, tenue de la base « Accès ») vivent hors de ce dépôt et ne sont
jamais modifiées depuis ici.

## Ce qui bloque, et ce qui ne bloque pas

Trois fichiers déclarés par le CLAUDE.md n'existent pas au dépôt :
`docs/charte-design.md` (et son PDF), `docs/maquette-edition.html`. Ils font
foi respectivement pour les tokens et pour la hiérarchie visuelle, et le
CLAUDE.md interdit de réinventer les uns comme l'autre.

Conséquence sur l'ordre des sessions : **tout le moteur se construit sans
eux**. Seule l'apparence en dépend. Les sessions 1 à 6 sont donc entièrement
réalisables ; la session 7 est bloquée jusqu'à la livraison de la charte et
de la maquette.

En attendant, `app/globals.css` porte un jeu de tokens **provisoires**,
explicitement marqués comme tels : une échelle de gris neutre et une seule
teinte d'accent. Ils ne prétendent pas être la charte, ils lui réservent sa
place. Le fichier est le point de bascule unique : quand la charte arrive,
seules ses valeurs changent, aucun composant.

## Session 1 — socle et garde de schéma

- Squelette Next.js 16 : App Router, TypeScript strict, `cacheComponents`,
  Tailwind v4, les trois polices en `next/font/google`.
- `lib/env.ts` : validation des variables d'environnement au démarrage,
  message explicite sur ce qui manque.
- `lib/notion/client.ts` : SDK v5, résolution des `data_source_id` à partir
  des identifiants de base, au démarrage et une seule fois.
- `lib/notion/schema.ts` : la liste des propriétés attendues, confrontée au
  schéma réel ; **refus de démarrer** si une propriété manque ou a changé de
  type. C'est le contrat des bases, et il n'existe qu'ici.
- Profil de cache `notion` dans `next.config.ts`.

Fait quand : `pnpm build` passe et la garde de schéma est testée sur des
schémas factices, complets et amputés.

## Session 2 — domaine, sans réseau

Fonctions pures, testées unitairement, sans aucun appel Notion :

- `lib/domaine/impact.ts` : suffixe d'un titre H2 → `FORT`, `MOYEN`, `RAS`
  ou « inconnu ». `FAIBLE` n'est pas un niveau : il tombe en « inconnu »,
  s'affiche sans badge, et n'est jamais converti.
- `lib/domaine/semaines.ts` : lundi de la semaine ISO d'une date, clé de
  semaine, regroupement d'éditions en semaines, tri.
- `lib/domaine/dossiers.ts` : analyse de `nom (compteur, précision)`
  séparés par ` · `, tolérante aux écarts de format.
- `lib/domaine/document.ts` : blocs Notion → arbre de rendu, familles
  repliables, aucune URL de fichier Notion conservée.

Fait quand : la couverture des cas tordus est écrite avant le code.

## Session 3 — lectures Notion cachées

- `lib/notion/acces.ts` : lecture de la base « Accès — portail » par
  identifiant d'accès, en `'use cache: remote'`, tag
  `liste:<data_source_id>`.
- `lib/notion/editions.ts` : requêtes filtrées `Statut = Envoyé` **et**
  `Organisation contains <page_id>`, en `'use cache: remote'`, tags
  `liste:` et `page:`.
- Aucune fonction cachée ne reçoit l'identité d'une personne ; les
  fonctions de contenu ne reçoivent que l'identifiant d'organisation.

Fait quand : chaque lecture est dans une fonction cachée, et un test le
vérifie en lisant le code source des modules.

## Session 4 — accès par lien magique persistant

- `lib/auth/jeton.ts` : signature HMAC-SHA256, encodage base64url,
  comparaison en temps constant.
- `app/acces/[jeton]/route.ts` : vérifie, pose le cookie, **redirige
  immédiatement**. Le jeton n'apparaît nulle part ailleurs.
- `proxy.ts` : cookie → identifiant → organisation, à chaque requête.
  Révocation effective à la requête suivante.
- Page « recevoir mon lien » et envoi par l'API Gmail de Workspace.

Fait quand : un jeton falsifié, un jeton révoqué et un cookie absent
mènent tous les trois où il faut, et sont testés.

## Session 5 — écrans, structure avant apparence

- `/[slug]` : la semaine la plus récente, qui rassemble les notes de la
  semaine (décision 6).
- `/[slug]/semaines` : l'archive, une entrée par semaine.
- `/[slug]/semaines/[semaine]` : une semaine.
- Rendu du document, familles repliables, badges d'impact, panneau des
  dossiers ouverts.

La structure et la sémantique sont définitives à l'issue de cette session ;
l'apparence ne l'est pas.

## Session 6 — webhook, médias, mode dégradé

- `app/api/webhooks/notion/route.ts` : signature vérifiée avec
  `verifyWebhookSignature`, réponse 2xx immédiate, puis `revalidateTag`.
  Le handler ne relit jamais Notion et n'envoie jamais d'email.
- `app/api/media/[block_id]/route.ts` : proxy d'images, parce que les URL
  de fichiers Notion expirent en une heure.
- Recette du mode dégradé : couper l'accès à Notion et vérifier que la
  dernière version connue est servie. C'est le point noté « non vérifié »
  dans `docs/etat-des-api.md`, et il ne se vérifie qu'ici.

## Session 7 — charte et maquette *(bloquée)*

Ouvrir `docs/maquette-edition.html` dans un navigateur, remplacer les
tokens provisoires par ceux de `docs/charte-design.md`, comparer chaque
écran à la maquette, corriger les écarts. Rien de cette session ne peut
commencer avant que les deux fichiers existent.

## Session 8 — recette de cloisonnement

Playwright, **un compte par client**. Vérifier qu'aucune donnée d'un client
n'apparaît dans le HTML d'un autre, y compris dans les charges JSON non
affichées. C'est la règle 7, et elle ne se vérifie qu'avec des comptes
réels sur un déploiement réel.
