# Courriels client : un seul gabarit

*Décidé le 20 octobre 2026. Template de référence : `docs/emails/charte/` (v1.0, aligné sur la charte graphique v1.0 d'août 2026).*

Tout courriel qui part vers un client ou un prospect sort du gabarit en code, `lib/email/gabarit.ts`, qui traduit le template ligne à ligne : tableaux, styles en ligne, bouton VML pour Outlook, logo en texte réel, ligne de signaux, carte « Ce qu'il faut retenir », pied. Aucun modèle n'écrit plus de HTML pour un client : la tâche donne le texte, le portail donne la forme. `tests/architecture.test.ts` vérifie que `composerCourriel` n'a pas d'autre appelant que les compositeurs de `lib/email/` et des courriers de parcours.

## Inventaire

| Courriel | Qui le compose | Qui l'envoie | Pied |
|---|---|---|---|
| Lien d'accès (« recevoir mon lien », activation, ajout d'un lecteur) | `composerCourrierDAccès`, `lib/email/gmail.ts` | le portail, par Gmail (`envoyerCourrier`) | accès : pas de désinscription, un courriel transactionnel |
| Fin d'essai : dernière parution complète | `composerCourrierDeParcours`, `lib/domaine/courriers-parcours.ts` | le portail, cron du parcours | client |
| Fin d'essai : parution réduite à « L'essentiel » | idem | idem | client |
| Lettre de veille, première lettre comprise | `composerLettre`, `lib/email/lettre.ts`, par `POST /api/veille/courriel` (`sorte: "lettre"`) | brouillon Gmail créé par la tâche, envoyé par l'opératrice | client |
| Point mensuel de la revue | `composerMessageClient`, `lib/email/message.ts`, par `POST /api/veille/courriel` (`sorte: "message"`) | brouillon Gmail créé par la revue, envoyé par l'opératrice | client |
| Prospection : lettre 1 (J0), relance J+4, relance J+10 | `lib/email/lemlist.ts`, fichiers générés dans `docs/emails/lemlist/` | lemlist | prospect : désinscription en un clic de lemlist |
| Prospection, pilote par Gmail | `composerProspection`, `lib/email/lemlist.ts`, par `POST /api/veille/courriel` (`sorte: "prospection"`) | brouillon Gmail créé par les tâches de prospection, envoyé par l'opératrice | prospect : réponse « STOP » |

L'alerte du soir (`[Veille] Espaces clients`) et les notifications de relecture vont à l'opératrice seule : elles restent en texte brut.

Les courriers du portail partent en `multipart/alternative` : la version texte reste celle d'avant, pour les clients qui n'affichent pas le HTML et pour les filtres.

## La lettre

La lettre est rendue depuis sa page Notion, dans l'ordre de la page, par le parseur de production (`suiteDeLaLettre`, `lib/domaine/document.ts`). Contrairement aux écrans, rien n'est détaché : le cadrage et « Les acteurs que nous suivons pour vous » restent dans le courriel, ils sont dus au lecteur.

| Dans Notion | Dans le courriel |
|---|---|
| Titre de niveau 1 | rubrique : Lora 23 px, filet au-dessus |
| Titre de niveau 2 « Nom — FORT / MOYEN / RAS » | axe : badge Signal fort / À surveiller / RAS, numéro en indice mono, nom en Lora ; un suffixe inconnu n'a pas de badge |
| Encadré (callout) | carte au fond neutre, comme la carte du template |
| Puces | puces carrées |
| Tableau | tableau à filets gris, défilant sur mobile |
| Image | jamais incluse (l'URL Notion expire en une heure) ; sa légende renvoie à l'espace |
| Lien | encre souligné ; un lien qui n'est ni https ni mailto, ou qui mène à Notion, est retiré |
| Encadré « Note de méthode », « Sources non ouvertes », « Requêtes non lancées », « Méthode et réserves » | retiré du courriel (règle d'envoi du 18 octobre 2026) ; « Sources vérifiées » et le RAS motivé restent |

La ligne de signaux de l'en-tête est lue dans la lettre : une impulsion rose par axe FORT, ardoise par axe MOYEN, rien pour un RAS, sept au plus.

**La route refuse une lettre non conforme** (422, avec les ruptures du validateur) : ce qui part chez le client est ce que le portail sait lire. Elle s'appelle après un `POST /api/veille/lint` conforme, qui a déjà expiré le cache de la page ; elle ne tient aucun pouvoir d'invalidation et n'envoie rien.

## Les emails lemlist

lemlist ne connaît pas le portail : les trois pages sont générées une fois, puis collées dans la vue Code de chaque étape.

```
pnpm emails:lemlist        # régénère docs/emails/lemlist/*.html et *.txt
```

Pour chaque étape : coller le fichier dans la vue Code, puis sélectionner « Se désinscrire en un clic » et choisir **+ Add › Add unsubscribe link** ; l'ancre `#desinscription-lemlist` doit disparaître. Prévisualiser sur un contact qui porte `sfEssentiel`, `sfFaitMarquant` et `companyName`. `tests/email.lemlist.test.ts` vérifie que les fichiers du dépôt sont ceux que le gabarit produit : une retouche de charte se propage en régénérant, jamais en éditant un fichier.

Variables : `firstName`, `companyName` (lemlist), `sfEssentiel`, `sfFaitMarquant` (tâche de prospection). `sfEssentiel` arrive en texte brut sur plusieurs lignes ; il est posé dans un bloc `white-space:pre-line`, qui garde ses retours à la ligne.

Délivrabilité : un email froid très mis en forme se classe plus souvent en promotions qu'un message sobre. Le premier lot pilote dira si la mise en forme coûte en ouverture ; lemlist permet de tester une variante texte de l'étape 1 (A/B) avec `sf-1-lettre.txt`.

## Ce qui reste à poser avant un envoi réel

1. `ADRESSE_POSTALE` dans Vercel (pied de chaque courriel client, obligatoire avant tout envoi commercial), puis `pnpm emails:lemlist` avec la même valeur pour les fichiers lemlist.
2. L'adresse `contact@signauxfaibles.io` du template doit exister (alias de la boîte de l'opératrice) : elle est dans chaque pied, et dans le lien « Se désinscrire » des courriels client.
3. Tester un envoi dans Gmail web et mobile, Outlook Windows et Apple Mail (README du template).

## Aperçus

Rendus à 680 px dans Chromium, polices de repli (comme Gmail) : `docs/emails/apercus/`. Lien d'accès (`acces.png`), fin d'essai (`essai_derniere_parution.png`, `essai_tronquee.png`), lettre (`lettre.png`), point mensuel (`point-mensuel.png`), séquence lemlist (`sf-1-lettre.png`, `sf-2-relance-j4.png`, `sf-3-relance-j10.png`, variables remplacées par un exemple).
