# Application installable et lecture hors ligne

*10 septembre 2026.*

Le portail s'installe comme une application et reste lisible sans réseau. Ce
document dit ce qui est mis en cache, ce qui ne l'est jamais, et ce que cela
change pour la confidentialité — c'est la seule partie du portail qui laisse
des données client sur un appareil.

## Pourquoi

La veille se lit dans un train, dans une salle d'attente, entre deux rendez-vous.
Le réseau y est le premier obstacle. Une application installée ouvre la semaine
en un geste depuis l'écran d'accueil, et une semaine déjà ouverte reste lisible
quand la connexion tombe.

## Ce que le service worker fait

`public/sw.js`, trois comportements et une précaution.

| ce qui est demandé | stratégie | pourquoi |
|---|---|---|
| `/_next/static/…` | cache d'abord | ces fichiers sont versionnés : sous un même nom, ils ne changent jamais |
| une navigation | **réseau d'abord**, cache en secours, `/hors-ligne` en dernier | une veille périmée servie alors qu'on est en ligne serait pire que pas de veille |
| le reste, dont les médias | cache d'abord | les images passent déjà par `/api/media`, cloisonné |

Jamais mis en cache, quelle que soit la stratégie : `/api/webhooks/`,
`/acces/` (l'URL qui porte le jeton) et `/quitter`. Les requêtes qui ne sont
pas des `GET` non plus.

La page `/hors-ligne` est mise en cache à l'installation du worker. C'est la
seule page dont on soit certain qu'elle réponde toujours ; elle est publique
pour cette raison, et ne contient aucune donnée client.

## La précaution : le cache est une copie sur l'appareil

Le portail sert du contenu privé. Ce cache vit sur le téléphone ou le poste de
la personne, et il survit à la fermeture du navigateur. Trois choses le
limitent.

**La révocation purge.** Dès qu'une navigation est **redirigée** vers
« recevoir mon lien » — case `actif` décochée, cookie expiré —, tout le cache
des pages est jeté. Le drapeau `redirected` est indispensable : sans lui, la
simple visite du formulaire purgerait le cache, et plus aucune page ne serait
jamais disponible hors ligne. Ce défaut a existé, il a été trouvé en recette.

**« Quitter sur cet appareil » purge aussi.** Le bouton du rail poste vers
`/quitter`, qui efface le cookie ; la page demande au worker de vider son cache
avant de partir. C'est le geste à faire sur un poste partagé. La route est en
`POST` : effacer une session est une action, pas une lecture, et une route en
`GET` se déclencherait sur une simple image distante pointée vers elle.

**Risque résiduel, à connaître.** Entre la révocation d'un accès et la
prochaine navigation de la personne, les semaines déjà ouvertes restent
lisibles hors ligne sur son appareil. Aucune purge à distance n'existe : un
service worker ne s'exécute pas tant que le navigateur ne le sollicite pas. La
révocation ferme l'accès au portail immédiatement — c'est le contrôle serveur
qui compte —, elle n'efface pas ce qui a déjà été lu. Sur un appareil dont on
n'a plus la maîtrise, la seule réponse est celle qui vaut pour tout document
déjà téléchargé.

## La bannière d'installation

`components/banniere-installation.tsx`. Deux chemins, parce que les navigateurs
n'en offrent pas un seul.

- Chrome et Edge émettent `beforeinstallprompt` : on le retient et on le
  déclenche sur le bouton « Installer ».
- Safari sur iOS n'émet rien. On y explique le geste — Partager, puis « Sur
  l'écran d'accueil » —, sans quoi un iPhone n'aurait jamais l'information.

Le refus est mémorisé dans `localStorage` : une bannière qui revient à chaque
visite est une nuisance, pas une invitation. Rien ne s'affiche si l'application
tourne déjà en mode autonome.

Les deux lectures propres au navigateur (le refus mémorisé, l'appartenance à
iOS) passent par `useSyncExternalStore` avec un instantané serveur neutre. Un
`setState` dans un effet ferait le même travail mais déclencherait un rendu en
cascade, et la règle `react-hooks/set-state-in-effect` le refuse à juste titre.

## Le menu de pied

`components/menu-bas.tsx` porte les mêmes cinq écrans que le rail latéral, qui
disparaît sous l'écran large. En application installée, c'est la barre que le
pouce atteint ; d'où le retrait sous `env(safe-area-inset-bottom)` pour les
appareils à encoche.

Les libellés courts sont déclarés dans `ongletsDe` (`lib/portail/semaine.ts`),
à côté des libellés longs. Ce sont les mêmes mots abrégés, jamais des
synonymes : « Conseils » à la place de « Recommandations » ferait croire à deux
destinations différentes.

## Comment c'est vérifié

`e2e/pwa.spec.ts`. Le manifeste, l'en-tête du worker, l'accessibilité de la
page de secours, puis la coupure elle-même.

**`context.setOffline` ne sert à rien ici.** Le drapeau ne s'applique pas aux
requêtes émises par le service worker, qui continuent d'atteindre le serveur :
un test « hors ligne » y passe sans rien prouver. Le premier essai est tombé
dans ce piège, et concluait que le secours fonctionnait alors qu'il n'avait
jamais été sollicité.

La recette démarre donc son propre serveur sur le port 3101, chauffe le cache,
puis **arrête le serveur** — groupe de processus compris, `npx` n'étant qu'un
lanceur. Elle refuse de démarrer si le port est déjà pris : un serveur resté
d'un run précédent répondrait à sa place, et le test tournerait serveur debout.

Ce qui est alors vérifié, serveur coupé : une page déjà ouverte s'affiche
depuis le cache, une adresse jamais visitée reçoit `/hors-ligne` **sans perdre
son adresse** — un rechargement, le réseau revenu, ramène la page voulue.

## Ce qui n'est pas couvert

La purge à la révocation n'est pas dans la recette automatisée : elle demande
une session valide, donc Notion. Elle se vérifie à la main, en décochant
`actif` dans « Accès — portail » puis en rouvrant le portail sur l'appareil.
