# Template email client Signaux Faibles

Version 1.0 du 20/10/2026, alignée sur la charte graphique v1.0 (août 2026).

## Fichiers

| Fichier | Rôle |
|---|---|
| `template-email-client.html` | Le template, avec les variables `{{...}}` à remplacer |
| `exemple-email-client.html` | Le même template rempli avec un contenu fictif (annonce de nouveautés) |
| `apercu-desktop.png`, `apercu-mobile.png` | Rendu de l'exemple à 600 px et à 390 px |

## Variables

| Variable | Contenu attendu | Exemple |
|---|---|---|
| `objet` | Objet de l'email (balise title) | Votre veille évolue en novembre : ce qui change pour vous |
| `preheader` | Texte d'aperçu, 40 à 90 caractères | Deux nouveautés dans vos lettres, et une chose qui ne change pas. |
| `type_envoi` | Label mono en haut à gauche | Lettre client, Information, Facturation |
| `date_envoi` | Date au format JJ/MM/AAAA | 20/10/2026 |
| `surtitre` | Label mono au-dessus du titre | Nouveautés du service |
| `titre` | Titre Lora 700, sentence case | Votre veille évolue en novembre. |
| `accroche` | Une phrase en italique Lora (voix éditoriale) | Deux nouveautés, et une chose qui ne change pas. |
| `prenom` | Prénom du destinataire | Camille |
| `paragraphe_1`, `paragraphe_2` | Corps du message | |
| `point_N_titre`, `point_N_texte` | Les 3 points du bloc « Ce qu'il faut retenir » | |
| `point_1_meta`, `point_2_meta` | Ligne mono sous le point (date, source) | EN PLACE LE 03/11/2026 |
| `cta_libelle`, `cta_url` | Bouton primaire (un seul par email) | Voir les nouveautés |
| `lien_secondaire_libelle`, `lien_secondaire_url` | Lien texte avec flèche rose | Ma dernière lettre |
| `reassurance` | Mention 12 px gris sous l'action | Accès direct à votre espace, sans mot de passe supplémentaire. |
| `formule_politesse`, `signataire_nom`, `signataire_role` | Signature | Bonne lecture, / Agathe / Fondatrice |
| `email_destinataire` | Adresse du client | |
| `lien_gestion_abonnement`, `lien_desinscription`, `lien_version_web` | Liens obligatoires du pied | |
| `adresse_postale` | Adresse postale de l'éditeur (obligatoire) | |

Le format `{{variable}}` est neutre : il se remplace à la main, par script, ou se convertit en balises de l'outil d'envoi (Brevo `{{ contact.PRENOM }}`, Mailchimp `*|FNAME|*`, react-email via props).

## Modules

- **Bloc « Ce qu'il faut retenir »** : optionnel. On peut retirer un point (supprimer la ligne `<tr>` du point et le filet qui le précède) ou le bloc entier.
- **Badges** : trois niveaux seulement, comme la charte. `Signal fort` (fond rose, texte rose foncé #b23f57), `À surveiller` (fond ardoise), `RAS` (filet gris, il se montre, il ne se cache pas). Pour changer le badge d'un point, copier la cellule `<td class="mono" ...>` du badge voulu.
- **Ligne de signaux** : 5 impulsions dans l'exemple. La charte autorise au maximum 7 impulsions, rose pour un signal fort, ardoise pour un signal secondaire. La hauteur se règle avec `height` sur la cellule colorée (10 à 26 px).

## Règles de la charte appliquées

- Couleurs : encre #111418 pour le texte, les titres et le bouton ; rose #dd768a uniquement pour le curseur du logo, les impulsions et la flèche des liens (jamais de texte courant en rose, contraste 2,9:1 insuffisant) ; ardoise #5d6b7f pour labels et mentions ; gris ligne #dee3e6 pour filets et bordures ; fond blanc unique.
- Typographie : Lora pour titres et voix éditoriale, Public Sans pour le corps (16 px), IBM Plex Mono pour labels, dates et métadonnées. Sentence case partout, seuls les labels mono passent en capitales espacées.
- Composants : rayons de 8 px (bouton) et 10 px (carte), aucune ombre, un seul bouton primaire.
- Logo : mot-symbole en texte réel « signauxfaibles » suivi du curseur rose, sans image, ce qui évite qu'il disparaisse quand les images sont bloquées.

## Contrastes vérifiés (WCAG)

| Couple | Ratio | Niveau |
|---|---|---|
| Encre sur blanc | 18,5:1 | AAA |
| Ardoise sur blanc | 5,4:1 | AA |
| Ardoise sur fond neutre #f7f8f9 | 5,1:1 | AA |
| Ardoise sur fond ardoise #eef1f4 | 4,8:1 | AA |
| Rose foncé #b23f57 sur fond rose #fbeef1 (badge) | 5,0:1 | AA |

Le rose foncé #b23f57 du badge « Signal fort » n'est pas dans la palette de la charte : c'est une teinte dérivée du rose signal, nécessaire pour que le libellé reste lisible (le rose #dd768a sur #fbeef1 serait sous 3:1).

## Compatibilité

- Structure en tableaux, styles inline, largeur 600 px, responsive sous 620 px (bouton pleine largeur, colonnes empilées).
- Polices web chargées depuis Google Fonts : rendues dans Apple Mail, iOS Mail et certains clients Android. Gmail et Outlook affichent les polices de repli : Georgia pour Lora, Helvetica/Arial pour Public Sans, Courier New/Menlo pour Plex Mono. Le logo passe alors en Georgia gras, ce qui reste proche mais n'est pas strictement la police de la charte. Si un rendu exact du logo est exigé partout, le remplacer par un PNG @2x de 240 px de large minimum (taille minimale charte : 120 px affichés).
- Outlook Windows : bouton en VML (coins arrondis conservés), polices forcées en repli via un bloc conditionnel `mso`.
- Mode sombre : le template se déclare en clair (`color-scheme: light`). Apple Mail le respecte ; Gmail et Outlook peuvent inverser les couleurs automatiquement, le logo étant du texte il reste lisible.
- Poids : environ 20 Ko de HTML, aucune image, bien en dessous de la limite de troncature de Gmail (102 Ko).

## Avant un envoi réel

1. Remplacer `adresse_postale` et les trois liens du pied (désinscription en un clic obligatoire).
2. Tester l'envoi dans Gmail web et mobile, Outlook Windows et Apple Mail (outil type Litmus ou Email on Acid, ou envois de test).
3. Ne jamais laisser entendre un lien avec le dispositif public homonyme signaux-faibles.beta.gouv.fr (règle de marque, docs/20).
