# Déploiement Vercel

## Pourquoi il y a un `vercel.json`

Le projet Vercel a été créé alors que le dépôt ne contenait que des documents :
aucun `package.json`, donc aucun cadriciel détecté, et `framework: null` resté
figé dans les réglages du projet. Depuis, Vercel construisait bien
l'application — la table des routes s'affichait entière dans les journaux —
puis échouait juste après :

```
Error: No Output Directory named "public" found after the Build completed.
```

C'est le comportement du préréglage « Other » : il cherche un dossier de
fichiers statiques là où Next.js produit un `.next`. La déclaration
`"framework": "nextjs"` dans `vercel.json` corrige cela depuis le dépôt, où
elle est versionnée et relue en revue, plutôt que depuis un réglage de tableau
de bord que personne ne retrouve six mois plus tard.

## Variables d'environnement à poser dans le projet

Sans elles, le portail se construit mais ne sert rien : la validation est
paresseuse, elle échoue à la première requête et non à la compilation. C'est
voulu — les secrets n'ont pas à être présents au build.

| Variable | Où la trouver |
|---|---|
| `NOTION_TOKEN` | jeton de l'intégration interne, partagée sur les deux seules bases du portail |
| `NOTION_BASE_EDITIONS` | identifiant de la base « Éditions de veille » |
| `NOTION_BASE_ACCES` | identifiant de la base « Accès — portail » |
| `NOTION_WEBHOOK_SECRET` | jeton de vérification, lu dans les journaux à la poignée de main — voir `docs/webhook-notion.md` |
| `ACCES_SECRET_HMAC` | à générer : `openssl rand -base64 48`. Ne jamais le régénérer sans prévenir : tous les liens en circulation deviendraient invalides |
| `PORTAIL_URL` | l'adresse publique retenue, celle qui apparaîtra dans les courriers |
| `GOOGLE_COMPTE_SERVICE_EMAIL` | compte de service Workspace |
| `GOOGLE_COMPTE_SERVICE_CLE_PRIVEE` | clé privée du compte de service, retours à la ligne échappés acceptés |
| `GMAIL_EXPEDITEUR` | boîte émettrice dédiée, empruntée par délégation |
| `GMAIL_EXPEDITEUR_NOM` | facultatif, « signauxfaibles » par défaut |

## Ce qui reste à vérifier une fois déployé

**Le cache distant.** `'use cache: remote'` suppose un gestionnaire de cache
fourni par l'hébergeur. Il faut confirmer qu'il fonctionne sans configuration
sur ce projet : en local, le cache mémoire donne une fausse impression de
succès, et en serverless il ne survit pas d'une requête à l'autre.

**Le mode dégradé.** C'est le seul point encore noté « non vérifié » dans
`docs/etat-des-api.md` : la documentation de Next.js ne dit pas explicitement
que l'ancienne valeur reste servie quand la régénération en arrière-plan
échoue. Se vérifie en coupant l'accès à Notion sur un déploiement, jamais en
local.

**La région d'exécution.** Le projet construit à Washington. Pour un portail
dont tous les lecteurs sont en France, `cdg1` réduirait la latence de chaque
page rendue à la demande. Ce n'est pas un correctif, c'est un réglage à
décider.
