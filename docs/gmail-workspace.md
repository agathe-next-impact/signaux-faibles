# La clé du compte de service Google

Le portail envoie les liens d'accès par l'API Gmail de Google Workspace. Pas de
SMTP : l'authentification basique est arrêtée pour Workspace depuis le
14 mars 2025. L'identité est un compte de service qui **emprunte** une boîte
dédiée, par délégation à l'échelle du domaine limitée à la seule portée
`gmail.send`.

Deux variables d'environnement sortent de cette procédure :
`GOOGLE_COMPTE_SERVICE_EMAIL` et `GOOGLE_COMPTE_SERVICE_CLE_PRIVEE`.

## 1. Créer le compte de service et télécharger la clé

Dans la console Google Cloud, sur le projet qui portera le portail :

1. **IAM et administration → Comptes de service → Créer un compte de service**.
   Un nom explicite, par exemple `portail-acces`. Aucun rôle IAM n'est
   nécessaire : la délégation ne passe pas par IAM.
2. Ouvrir le compte créé, onglet **Clés → Ajouter une clé → Créer une clé →
   JSON**.
3. Le fichier se télécharge **une seule fois**. Google n'en garde pas de copie
   et ne permet pas de le retélécharger. Perdu, il faut créer une nouvelle clé
   et supprimer l'ancienne.
4. Activer l'**API Gmail** sur le projet, sans quoi les appels seront refusés
   même avec un jeton valide.

Le fichier contient, entre autres :

| Champ | Ce qu'on en fait |
|---|---|
| `client_email` | va dans `GOOGLE_COMPTE_SERVICE_EMAIL` |
| `private_key` | va dans `GOOGLE_COMPTE_SERVICE_CLE_PRIVEE` |
| `client_id` | identifiant **numérique**, à saisir dans la console d'administration Workspace |

Pour extraire les valeurs sans les recopier à la main :

```bash
jq -r .client_email cle-service.json
jq -r .client_id    cle-service.json
jq -r .private_key  cle-service.json   # à coller tel quel, retours à la ligne compris
```

**Le fichier ne va pas dans le dépôt.** Il va dans les variables
d'environnement du projet Vercel, et nulle part ailleurs.

## 2. Autoriser la délégation dans la console d'administration Workspace

Cette étape demande un **super-administrateur** Workspace, et se fait dans la
console d'administration, pas dans Google Cloud.

1. **Sécurité → Contrôle des API et des données → Contrôles des API →
   Délégation au niveau du domaine → Gérer la délégation → Ajouter**.
2. **Client ID** : l'identifiant **numérique** (`client_id` du JSON), pas
   l'adresse email du compte de service. C'est la confusion la plus fréquente.
3. **Portées OAuth** : `https://www.googleapis.com/auth/gmail.send`, et elle
   seule. Une portée plus large donnerait au portail le droit de lire les
   messages, ce dont il n'a aucun besoin.
4. Depuis août 2024, une **approbation par un second super-administrateur**
   peut être exigée pour ce type d'autorisation. L'autorisation n'est active
   qu'une fois approuvée.

La boîte empruntée (`GMAIL_EXPEDITEUR`) doit exister sur le domaine. Une boîte
dédiée, `acces@` par exemple, plutôt qu'une boîte de personne : le jour où
quelqu'un part, les liens continuent de partir.

## 3. Poser la clé dans l'environnement

**Coller le fichier JSON entier dans `GOOGLE_COMPTE_SERVICE_JSON`.** C'est la
voie à préférer, et de loin. Le format JSON échappe déjà les retours à la ligne
de la clé privée : la valeur tient sur une seule ligne, aucune console
d'hébergement ne peut la mutiler, et le portail en extrait lui-même
`client_email` et `private_key`.

```bash
# le fichier entier, accolades comprises, tel qu'il a été téléchargé
cat cle-service.json
```

Les deux variables séparées, `GOOGLE_COMPTE_SERVICE_EMAIL` et
`GOOGLE_COMPTE_SERVICE_CLE_PRIVEE`, restent acceptées. Elles sont plus
fragiles : la clé privée porte des retours à la ligne, et c'est là que tout se
perd.

### Si l'on tient à séparer les deux variables

La valeur de `private_key` est une clé PKCS#8 encadrée par
`-----BEGIN PRIVATE KEY-----` et `-----END PRIVATE KEY-----`. Selon la façon
dont elle traverse une console d'hébergement, elle arrive avec de vrais retours
à la ligne, ou avec des séquences `\n` littérales.

**Six formes abîmées sont rattrapées** par `normaliserClePrivée`, dans
`lib/email/gmail.ts` : retours à la ligne échappés en `\n`, guillemets ou
apostrophes copiés avec la valeur, fins de ligne Windows, valeur ré-encodée
entièrement en base64, espaces autour, fin de ligne finale manquante. Chacune
est éprouvée sur une paire RSA réelle, en signant puis en vérifiant.

**Deux formes ne sont pas récupérables**, et donnent alors un message explicite
plutôt que l'erreur d'OpenSSL : une clé dont les retours à la ligne ont été
purement perdus, et une valeur qui n'est pas un PEM.

C'est cette première qui produit `error:1E08010C:DECODER routines::unsupported`.
L'erreur ne dit rien de la cause : elle signifie seulement qu'OpenSSL n'a pas
su lire la valeur. Neuf fois sur dix, les retours à la ligne ont sauté au
copier-coller.

## Ce que le portail envoie à Google

Un JWT auto-signé, échangé contre un jeton d'accès. Aucune bibliothèque
cliente : une trentaine de lignes dans `lib/email/gmail.ts`.

```json
{
  "iss": "portail-acces@…iam.gserviceaccount.com",
  "sub": "acces@signauxfaibles.io",
  "scope": "https://www.googleapis.com/auth/gmail.send",
  "aud": "https://oauth2.googleapis.com/token",
  "iat": 1800000000,
  "exp": 1800003600
}
```

`sub` est la boîte empruntée : c'est lui qui fait la délégation. `exp` reste à
une heure, la limite acceptée par Google.

## Si l'envoi échoue

Le message d'erreur de Google est repris tel quel dans l'exception, sans
secret, et nomme généralement la cause.

| Symptôme | Cause habituelle |
|---|---|
| `unauthorized_client` | la délégation n'est pas autorisée, ou l'a été avec l'email au lieu du Client ID numérique, ou attend l'approbation du second administrateur |
| `access_denied` sur la portée | une portée autre que `gmail.send` est demandée, ou `gmail.send` n'est pas dans la liste autorisée |
| `invalid_grant` | la boîte de `sub` n'existe pas sur le domaine, ou l'horloge du serveur dérive |
| API désactivée | l'API Gmail n'a pas été activée sur le projet Cloud |
| `DECODER routines::unsupported` | OpenSSL n'a pas su lire la clé. Le portail réécrit désormais un PEM canonique et devrait absorber la plupart des mutilations ; si l'erreur persiste, la valeur est tronquée ou altérée — basculer sur `GOOGLE_COMPTE_SERVICE_JSON` |

Quotas à connaître : 2 000 messages par jour et par utilisateur Workspace, et
environ deux envois par seconde. Sans objet pour un envoi de lien à la demande.

## Fiabilité de cette page

Les pages officielles de Google sont inaccessibles depuis l'environnement de
développement du portail. Les faits ci-dessus viennent des extraits de ces
pages remontés par la recherche, concordants entre eux, et de la vérification
locale de la chaîne de signature. Le chemin de menu exact de la console
d'administration peut avoir bougé ; le principe, lui, tient : Client ID
numérique, portée unique, approbation possible par un second administrateur.
