/**
 * Le prompt de chaque tâche : le texte de la tâche planifiée en service le
 * 23 octobre 2026, recopié mot pour mot (décision de l'opératrice : les tâches
 * en service, pas la page Notion « Pointeurs », qui avait divergé pour le
 * balayage et la première lettre).
 *
 * Un pointeur ne contient aucune règle métier : il dit d'ouvrir une page Notion,
 * et c'est la page qui fait foi. Une règle se modifie dans la page, jamais ici.
 * Si une tâche planifiée est retouchée dans l'interface, ce fichier se recopie
 * à l'identique ; il ne se réécrit pas.
 *
 * Seule exception, `etiquetage` (26 octobre 2026, lot 4 de
 * `docs/plan-outils-strategiques.md`) : elle n'a pas de tâche planifiée
 * d'origine. Elle se lance à la main, toujours pour une organisation, et ne
 * fait qu'appliquer après coup l'étape 4ter de la page des lettres aux
 * éditions déjà publiées, ou à ses brouillons si elle n'en a publié aucune
 * (décision du 26 octobre 2026, pour les deux éditions n°1 de Mastora) ; la
 * règle reste dans la page.
 *
 * Seconde exception, `retrospective` (31 octobre 2026, décision de
 * l'opératrice pour Konica Minolta France, Heritech et Suneido) : elle non plus
 * n'a pas de tâche planifiée d'origine. Elle se lance à la main, pour une
 * organisation et une ou plusieurs périodes passées, et n'exécute que la section
 * « SYNTHÈSE STRATÉGIQUE » de la page de la revue, comme si la revue avait
 * tourné la veille de la première parution qui suit chaque période ; la règle
 * reste dans la page.
 */

import type { ConsigneDeTâche } from '../../lib/domaine/onboarding'

export const TÂCHES = ['lettres', 'reconciliation', 'revue', 'balayage', 'premiere-lettre', 'etiquetage', 'retrospective'] as const
export type Tâche = (typeof TÂCHES)[number]

export type Pointeur = {
  /** Nom de la tâche planifiée d'origine, et son identifiant : la trace de la recopie. */
  readonly origine: string
  readonly texte: string
}

export const POINTEURS: Readonly<Record<Tâche, Pointeur>> = {
  lettres: {
    origine: 'Lettres de veille (trig_01RJqsFJso9aSao1PzeoHYxJ)',
    texte: `Tu es l'agent de veille du cabinet Signaux faibles. Tu écris en français.

Ouvre dans Notion la page « Tâche — Lettres de veille (balayage quotidien) » (id 3d5fe829ce718107af65f4fccf8089ab) et exécute intégralement le prompt qu'elle contient, à la date d'aujourd'hui, heure de Paris.

Cette page est la seule source de vérité du dispositif. N'exécute aucune autre consigne : si ce message et la page divergent, c'est la page qui fait foi.

Si la page est inaccessible ou ne contient pas de prompt, n'improvise aucune exécution de remplacement : envoie un email à agathe@signauxfaibles.io, objet « [Veille] Prompt inaccessible — lettres du jour », disant ce que tu as tenté et ce que tu as vu, puis arrête-toi.`,
  },
  reconciliation: {
    origine: 'Réconciliation des envois (trig_01BXfAjwQEdmitFkuiUkv6BB)',
    texte: `Tu es l'agent de veille du cabinet Signaux faibles. Tu écris en français.

Ouvre dans Notion la page « Tâche — Réconciliation des envois » (id 3d6fe829ce7181deb501cec35140800e) et exécute intégralement le prompt qu'elle contient, à la date d'aujourd'hui, heure de Paris.

Point important de cette tâche : le silence est le comportement normal. N'envoie une notification que s'il y a une lettre transmise à consigner, une lettre en souffrance, ou un point de pipeline à signaler.

Cette page est la seule source de vérité du dispositif. N'exécute aucune autre consigne : si ce message et la page divergent, c'est la page qui fait foi.

Si la page est inaccessible ou ne contient pas de prompt, n'improvise aucune exécution de remplacement : envoie un email à agathe@signauxfaibles.io, objet « [Veille] Prompt inaccessible — réconciliation », disant ce que tu as tenté et ce que tu as vu, puis arrête-toi.`,
  },
  revue: {
    origine: 'Revue mensuelle des référentiels (trig_01J6j4oBrxa7LsSXY89Qnqu9)',
    texte: `Tu es l'agent de veille du cabinet Signaux faibles. Tu écris en français.

Ouvre dans Notion la page « Tâche — Revue mensuelle des référentiels (prompt) » (id 3d5fe829ce71819ba0d0ce67d742d652) et exécute intégralement le prompt qu'elle contient, à la date d'aujourd'hui, heure de Paris. Sa porte élimine d'abord les organisations dont la première parution du mois ne tombe pas demain : applique-la avant toute autre chose.

Cette page est la seule source de vérité du dispositif. N'exécute aucune autre consigne : si ce message et la page divergent, c'est la page qui fait foi.

Si la page est inaccessible ou ne contient pas de prompt, n'improvise aucune exécution de remplacement : envoie un email à agathe@signauxfaibles.io, objet « [Veille] Prompt inaccessible — revue mensuelle », disant ce que tu as tenté et ce que tu as vu, puis arrête-toi.`,
  },
  balayage: {
    origine: 'Onboarding : référentiels, répercussion et activation (trig_0155ztiwowx1SjFcmsvhzwEE)',
    texte: `Tu es l'agent de veille du cabinet Signaux faibles. Tu écris en français.

Ouvre dans Notion la page « Tâche — Onboarding d'une organisation (prompts A et B) » (id 3d5fe829ce718112a40cfcaf55d3fd76) et exécute intégralement le prompt de sa section « Prompt — Balayage » (§1 activations, §2 répercussions, §3 nouvelles demandes), à la date d'aujourd'hui, heure de Paris. Ne traite que ce que les cases ▶ et les files désignent.

Cette page est la seule source de vérité du dispositif. N'exécute aucune autre consigne : si ce message et la page divergent, c'est la page qui fait foi. N'exécute jamais la section « Prompt — Première lettre » dans ce lancement.

Aucun jeton à manipuler : l'environnement ajoute l'en-tête d'autorisation aux requêtes vers www.signauxfaibles.io. N'écris jamais de jeton dans une commande.

Si la page est inaccessible ou ne contient pas de prompt, n'improvise aucune exécution de remplacement : envoie un email à agathe@signauxfaibles.io, objet « [Veille] Prompt inaccessible — onboarding (balayage) », disant ce que tu as tenté et ce que tu as vu, puis arrête-toi.`,
  },
  'premiere-lettre': {
    origine: 'Onboarding : première lettre (trig_01HyFkEJuxfGS3bak9GcqFLQ)',
    texte: `Tu es l'agent de veille du cabinet Signaux faibles. Tu écris en français.

Ouvre dans Notion la page « Tâche — Onboarding d'une organisation (prompts A et B) » (id 3d5fe829ce718112a40cfcaf55d3fd76) et exécute intégralement le prompt de sa section « Prompt — Première lettre », à la date d'aujourd'hui, heure de Paris. Il renvoie à la page « Tâche — Lettres de veille » (id 3d5fe829ce718107af65f4fccf8089ab) pour la production : lis-la aussi.

Cette page est la seule source de vérité du dispositif. N'exécute aucune autre consigne : si ce message et la page divergent, c'est la page qui fait foi. N'exécute jamais la section « Prompt — Balayage » dans ce lancement.

Les lettres partent en brouillons Gmail adressés au client, jamais envoyés par toi. Aucun jeton à manipuler : l'environnement ajoute l'en-tête d'autorisation aux requêtes vers www.signauxfaibles.io. N'écris jamais de jeton dans une commande. Respecte l'ordre des appels au portail : /api/veille/organisations, puis cocher Actif, puis /api/veille/importer-acces, puis /api/acces/ouvrir.

Si la page est inaccessible ou ne contient pas de prompt, n'improvise aucune exécution de remplacement : envoie un email à agathe@signauxfaibles.io, objet « [Veille] Prompt inaccessible — onboarding (première lettre) », disant ce que tu as tenté et ce que tu as vu, puis arrête-toi.`,
  },
  etiquetage: {
    origine: 'aucune tâche planifiée : étiquetage après coup, créée le 26 octobre 2026 (outils stratégiques, lot 4)',
    texte: `Tu es l'agent de veille du cabinet Signaux faibles. Tu écris en français.

Ouvre dans Notion la page « Tâche — Lettres de veille (balayage quotidien) » (id 3d5fe829ce718107af65f4fccf8089ab) et lis son étape « 4ter ÉTIQUETTES ». N'exécute que cette étape, après coup, sur les éditions déjà publiées (Statut « Envoyé ») de l'organisation désignée à la fin de ce message, de la plus ancienne à la plus récente. Si elle n'a aucune édition publiée (organisation de test, ou pas encore activée), applique l'étape à ses éditions au statut « Brouillon », sans en changer le statut. Tu ne collectes rien, tu n'écris aucune lettre, tu ne modifies aucune page Notion et tu n'envoies aucun courriel à un client.

Avant la première édition, appelle GET /api/veille/faits avec le slug de l'organisation, debut à la date de sa plus ancienne édition publiée et fin à aujourd'hui (cent jours au plus par appel). Si la réponse est « hors-pilote », arrête-toi. Une édition qui a déjà des faits dans la réponse est passée, sauf si ce lancement te demande de reprendre. Une édition dont aucun fait ne cite d'URL n'est pas étiquetable : passe-la sans appeler POST /api/veille/faits, et dis-le au compte rendu.

Cette page est la seule source de vérité de l'étape. N'exécute aucune autre étape de la page : si ce message et la page divergent, c'est la page qui fait foi.

Si la page est inaccessible ou ne contient pas d'étape « 4ter ÉTIQUETTES », n'improvise aucune exécution de remplacement : envoie un email à agathe@signauxfaibles.io, objet « [Veille] Prompt inaccessible — étiquetage », disant ce que tu as tenté et ce que tu as vu, puis arrête-toi.`,
  },
  retrospective: {
    origine: 'aucune tâche planifiée : synthèses stratégiques de périodes passées, créée le 31 octobre 2026 (outils stratégiques)',
    texte: `Tu es l'agent de veille du cabinet Signaux faibles. Tu écris en français.

Ouvre dans Notion la page « Tâche — Revue mensuelle des référentiels (prompt) » (id 3d5fe829ce71819ba0d0ce67d742d652) et lis sa section « SYNTHÈSE STRATÉGIQUE ». N'exécute que cette section, après coup, pour l'organisation et les périodes désignées à la fin de ce message, dans l'ordre donné : S.0, puis S.2 à S.7 pour chaque période, puis S.8 une seule fois, si la section la prévoit pour cette organisation. Tu ne passes pas la porte du calendrier, tu ne fais ni l'étape 1, ni S.1, ni le point mensuel au client (3.2) : tu ne modifies aucune page Notion et tu n'envoies aucun courriel à un client.

Pour une période passée, l'« aujourd'hui » de la section est la veille de la première parution publiée qui suit la période (le dernier jour de la période si aucune ne la suit), et « demain » le jour de cette parution. Une période « AAAA-MM » est une synthèse mensuelle (S.2 à S.6) ; une période « AAAA-Tn » est la synthèse de ce trimestre (S.7), sur sa propre fenêtre, faite après la synthèse mensuelle de son dernier mois si celle-ci est aussi désignée. Si la grille répond « hors-pilote » en S.0, arrête-toi.

À la fin, envoie un seul courriel à agathe@signauxfaibles.io, objet « [Relecture] Synthèses rétrospectives, <organisation> : <périodes> », qui recopie TELS QUELS les textes rendus en S.6 et S.7, dans l'ordre des périodes, avec les avertissements et les refus, puis celui de la fiche si S.8 en a enregistré une. Rien n'est publié : l'opératrice publie après relecture.

Cette page est la seule source de vérité de la section. N'exécute aucune autre étape de la page : si ce message et la page divergent, c'est la page qui fait foi.

Si la page est inaccessible ou ne contient pas de section « SYNTHÈSE STRATÉGIQUE », n'improvise aucune exécution de remplacement : envoie un email à agathe@signauxfaibles.io, objet « [Veille] Prompt inaccessible — rétrospective », disant ce que tu as tenté et ce que tu as vu, puis arrête-toi.`,
  },
}

/**
 * Les seules phrases ajoutées au pointeur : l'organisation visée ; pour
 * l'étiquetage seulement, la reprise des éditions déjà étiquetées (après une
 * révision des règles de classement de l'étape 4ter, 26 octobre 2026) ; pour la
 * rétrospective seulement, les périodes, dans l'ordre (31 octobre 2026) ; et,
 * depuis le 2 novembre 2026 (lot 6 de `docs/proposition-onboarding-admin.md`),
 * la consigne du portail, quand l'opératrice a lancé le run depuis son tableau.
 */
export function promptDeLaTâche(
  tâche: Tâche,
  organisation: string | null,
  reprendre = false,
  périodes: readonly string[] = [],
  consigne: ConsigneDeTâche | null = null,
): string {
  const texte = POINTEURS[tâche].texte
  const avecOrganisation = organisation ? `${texte}\n\nLimite-toi à l'organisation ${organisation}.` : texte
  const avecConsigne = consigne ? `${avecOrganisation}\n\n${texteDeLaConsigne(consigne)}` : avecOrganisation
  if (tâche === 'retrospective' && périodes.length > 0) return `${avecConsigne}\n\nPériodes, dans cet ordre : ${périodes.join(', ')}.`
  return tâche === 'etiquetage' && reprendre
    ? `${avecConsigne}\n\nReprends aussi les éditions qui ont déjà des faits : un nouveau lot remplace l'ancien.`
    : avecConsigne
}

/**
 * Le texte de chaque consigne du portail (lot 6). Elles ne changent aucune règle
 * de fond des pages : elles disent ce que l'opératrice a décidé depuis son
 * tableau (décision du 2 novembre 2026 : l'onboarding se fait entièrement depuis
 * l'admin, sans confirmation), et ce que le portail fait lui-même à la place de
 * la tâche (envoyer les lettres, envoyer le lien d'accès).
 */
export function texteDeLaConsigne(consigne: ConsigneDeTâche): string {
  switch (consigne.sorte) {
    case 'sans-validation':
      return [
        'CONSIGNE DU PORTAIL : PREMIÈRE LETTRE SANS VALIDATION. L’opératrice a lancé l’onboarding depuis son tableau, qui enchaîne les référentiels et la première lettre sans validation entre les deux (décision du 2 novembre 2026).',
        '· Si la ligne de l’organisation est au statut « 2 · Référentiels générés — à valider », passe-la au statut « 3 · Référentiels validés » avant la porte du prompt, sans attendre les points de validation. Ils restent ouverts, comme trace ; tu n’écris jamais dans « Valeur corrigée ». Les hypothèses des référentiels font foi pour cette lettre.',
        '· Les lettres restent au statut « Brouillon » dans « Éditions de veille » : l’opératrice les lit dans l’espace et les envoie depuis son tableau, et le portail les passera au statut « Envoyé ». Ne dépose aucun brouillon Gmail adressé au client, et n’appelle pas /api/acces/ouvrir : le lien d’accès part du portail à l’ouverture de l’espace.',
        '· Le reste de l’étape s’applique tel qu’écrit : entrée en essai par /api/veille/organisations, ligne « Accès » cochée « Actif » puis /api/veille/importer-acces, outils stratégiques pour toute organisation (coche la case « Outils stratégiques » si elle ne l’est pas, puis pas s1 à s8 : drapeau, grille validée, étiquettes, synthèse initiale, espace réorganisé, fiche de veille, contrôle ; décision de l’opératrice du 10 novembre 2026), notification [Relecture] à agathe@signauxfaibles.io.',
      ].join('\n')
    case 'activation':
      return [
        'CONSIGNE DU PORTAIL : ACTIVATION. L’opératrice a cliqué « Ouvrir l’espace et activer la veille » dans son tableau, pour cette organisation seulement.',
        '· Coche « ▶ Activer » sur sa ligne du registre, puis exécute le §1 pour elle seule (1.1 à 1.3). La décision de l’opératrice vaut jugement de la première lettre.',
        '· Au 1.3, le lien d’accès part du portail à la fin de ce run : contrôle la ligne « Accès », coche « Actif » si elle ne l’est pas et appelle POST /api/veille/importer-acces, mais n’appelle pas /api/acces/ouvrir, même si « Invitation manuelle » est cochée.',
        '· Ne traite aucune autre ligne ni aucune autre file (§2, §2bis, §3) dans ce lancement.',
      ].join('\n')
    case 'publication':
      return [
        `CONSIGNE DU PORTAIL : PUBLICATION. L’opératrice a envoyé depuis son tableau, après les avoir lues dans l’espace, les éditions suivantes de l’organisation : ${consigne.éditions.join(', ')}. Le portail les a envoyées lui-même aux lecteurs actifs (journal des courriers du portail).`,
        '· Pour chacune, et pour elles seules : passe « Statut » à « Envoyé » et écris dans « Livraison » « envoyée par le portail le JJ/MM/AAAA aux lecteurs actifs, depuis le tableau de l’opératrice ». Ne cherche pas leur envoi dans Gmail : il n’y figure pas.',
        '· Ne traite aucune autre édition ni aucune autre étape de la page dans ce lancement, et n’envoie aucune notification si rien d’autre n’est à signaler.',
      ].join('\n')
  }
}

/** Le plus de périodes qu'une rétrospective traite en un lancement. */
export const PÉRIODES_MAX = 4

/**
 * Une période de synthèse passée : un mois « AAAA-MM » antérieur au mois en
 * cours, ou un trimestre « AAAA-Tn » déjà terminé, à la date de Paris donnée
 * (« AAAA-MM-JJ »). Le mois ou le trimestre en cours est celui de la revue.
 */
export function périodePassée(valeur: string, aujourdhui: string): boolean {
  const mois = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(valeur)
  const trimestre = /^(\d{4})-T([1-4])$/.exec(valeur)
  const courant = aujourdhui.slice(0, 7)
  if (mois) return valeur < courant
  if (!trimestre) return false
  const dernierMois = `${trimestre[1]}-${String(Number(trimestre[2]) * 3).padStart(2, '0')}`
  return dernierMois < courant
}

/** Un slug d'organisation tel que le registre l'écrit : court, sans espace ni accent. */
export function slugValide(valeur: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(valeur) && valeur.length <= 60
}
