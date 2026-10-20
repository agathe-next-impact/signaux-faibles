import { describe, expect, it } from 'vitest'
import {
  Html,
  IMPULSIONS_PAR_DÉFAUT,
  SEUIL_GMAIL_OCTETS,
  composerCourriel,
  composerTexte,
  corpsDeParagraphes,
  dateCourte,
  ligneDeSignaux,
  typographie,
  urlSûre,
  échapper,
  type Courriel,
} from '@/lib/email/gabarit'

const base: Courriel = {
  objet: 'Votre veille évolue en novembre : ce qui change pour vous',
  préheader: 'Deux nouveautés dans vos lettres, et une chose qui ne change pas.',
  typeEnvoi: 'Lettre client',
  date: '20/10/2026',
  surtitre: 'Nouveautés du service',
  titre: 'Votre veille évolue en novembre.',
  accroche: 'Deux nouveautés, et une chose qui ne change pas.',
  salutation: 'Bonjour Camille,',
  corps: corpsDeParagraphes(['À partir du 3 novembre, vos lettres changent.', 'Voici l’essentiel.']),
  points: [
    { niveau: 'FORT', titre: 'Une synthèse plus courte', texte: 'Le fait le plus fort.', méta: 'En place le 03/11/2026' },
    { niveau: 'MOYEN', titre: 'Votre référentiel', texte: 'Deux minutes suffisent.' },
    { niveau: 'RAS', titre: 'Aucun changement de tarif', texte: 'Rien à faire.' },
  ],
  action: { libellé: 'Voir les nouveautés', url: 'https://www.signauxfaibles.io/acme' },
  lienSecondaire: { libellé: 'Ma dernière lettre', url: 'https://www.signauxfaibles.io/acme/lettres' },
  réassurance: 'Accès direct à votre espace, sans mot de passe supplémentaire.',
  pied: { sorte: 'client', destinataire: 'camille@exemple.fr', organisation: 'Acme', gestion: 'https://www.signauxfaibles.io/acme/abonnement', versionWeb: null },
  racine: 'https://www.signauxfaibles.io',
  adressePostale: '12 rue Exemple, 15000 Aurillac',
}

describe('le gabarit des courriels client', () => {
  const html = composerCourriel(base)

  it('reprend la structure du template : préheader, méta, logo texte, titre, carte, action, signature, pied', () => {
    expect(html.startsWith('<!DOCTYPE html>')).toBe(true)
    expect(html).toContain('<title>Votre veille évolue en novembre : ce qui change pour vous</title>')
    expect(html).toContain('Deux nouveautés dans vos lettres')
    expect(html).toContain('>signauxfaibles</span>')
    expect(html).toContain('Votre veille évolue en novembre.</h1>')
    expect(html).toContain("Ce qu&#39;il faut retenir")
    expect(html).toContain('Bonne lecture,')
    expect(html).toContain('Fondatrice · Signaux Faibles')
    expect(html).toContain('Votre veille, rédigée.')
    expect(html).toContain('12 rue Exemple, 15000 Aurillac')
  })

  it('n’a qu’un bouton primaire, à l’encre, et une version Outlook', () => {
    expect(html.match(/class="btn-primary/g)).toHaveLength(1)
    expect(html.match(/<v:roundrect/g)).toHaveLength(1)
    expect(html).toContain('background:#111418; color:#ffffff')
  })

  it('ne colore jamais un texte en rose : curseur, impulsions et flèche seulement', () => {
    const usages = [...html.matchAll(/(?:color|background|bgcolor)[:=]"?#dd768a/g)].map((m) => html.slice(m.index - 120, m.index + 40))
    for (const usage of usages) {
      expect(usage.includes('&#124;') || usage.includes('&rarr;') || usage.includes('width="3"') || usage.includes('height:')).toBe(true)
    }
    // Le texte courant n'est jamais posé en rose.
    expect(html).not.toMatch(/<p[^>]*color:#dd768a/)
  })

  it('n’affiche que les trois badges de la charte', () => {
    expect(html).toContain('>Signal fort</td>')
    expect(html).toContain('>À surveiller</td>')
    expect(html).toContain('>RAS</td>')
    expect(html).not.toMatch(/FAIBLE/)
  })

  it('échappe le texte et applique les espaces insécables', () => {
    expect(échapper('<script>alert("x")</script>')).toBe('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;')
    expect(typographie('« L’essentiel » : oui ; non ?')).toBe('« L’essentiel » : oui ; non ?')
    const piégé = composerCourriel({ ...base, titre: '<img src=x onerror=alert(1)>' })
    expect(piégé).not.toContain('<img src=x')
  })

  it('refuse les adresses qui ne sont ni https, ni mailto, ni une variable d’outil', () => {
    expect(urlSûre('https://www.signauxfaibles.io/a')).toBe('https://www.signauxfaibles.io/a')
    expect(urlSûre('mailto:contact@signauxfaibles.io')).not.toBeNull()
    expect(urlSûre('{{unsubscribe}}')).toBe('{{unsubscribe}}')
    expect(urlSûre('javascript:alert(1)')).toBeNull()
    expect(urlSûre('http://exemple.fr')).toBeNull()
    const piégé = composerCourriel({ ...base, action: { libellé: 'x', url: 'javascript:alert(1)' } })
    expect(piégé).not.toContain('javascript:')
  })

  it('laisse aux impulsions la place de s’afficher : les intervalles ne prennent pas toute la largeur', () => {
    for (const nombre of [1, 3, 5, 7]) {
      const ligne = ligneDeSignaux(IMPULSIONS_PAR_DÉFAUT.concat(IMPULSIONS_PAR_DÉFAUT).slice(0, nombre)).valeur
      const pourcents = [...ligne.matchAll(/<td width="(\d+)%"/g)].reduce((somme, m) => somme + Number(m[1]), 0)
      expect(pourcents).toBeLessThanOrEqual(93)
      expect(ligne.match(/width="3" height=/g)).toHaveLength(nombre)
    }
    // Sept au plus, comme la charte.
    expect(ligneDeSignaux(Array(9).fill({ forte: true, hauteur: 20 })).valeur.match(/width="3" height=/g)).toHaveLength(7)
  })

  it('compose les trois pieds : client, accès sans désinscription, prospect avec la sienne', () => {
    expect(html).toContain('Gérer mon abonnement')
    expect(html).toContain('Se désinscrire')
    expect(html).toContain('camille@exemple.fr')
    const accès = composerCourriel({ ...base, pied: { sorte: 'accès', destinataire: 'a@b.fr' } })
    expect(accès).not.toContain('Se désinscrire')
    expect(accès).toContain('ignorez-le')
    const prospect = composerCourriel({ ...base, pied: { sorte: 'prospect', motif: 'Parce que.', désinscription: '{{unsubscribe}}' } })
    expect(prospect).toContain('href="{{unsubscribe}}"')
    expect(prospect).toContain('Se désinscrire en un clic')
  })

  it('omet ce qui n’est pas fourni : accroche, salutation, carte, action, adresse postale', () => {
    const nu = composerCourriel({ ...base, accroche: null, salutation: null, points: [], action: null, lienSecondaire: null, réassurance: null, adressePostale: null })
    expect(nu).not.toContain('Bonjour Camille')
    expect(nu).not.toContain('Ce qu&#39;il faut retenir')
    expect(nu).not.toContain('btn-primary btn-full')
    expect(nu).toContain('Next Impact Digital</a>\n')
  })

  it('reste loin du seuil de troncature de Gmail', () => {
    expect(Buffer.byteLength(html)).toBeLessThan(SEUIL_GMAIL_OCTETS / 3)
  })

  it('donne une version texte lisible, badges en clair', () => {
    const texte = composerTexte(base)
    expect(texte).toContain('Bonjour Camille,')
    expect(texte).toContain('[Signal fort] Une synthèse plus courte')
    expect(texte).toContain('Voir les nouveautés :\nhttps://www.signauxfaibles.io/acme')
    expect(texte).not.toContain('<')
  })

  it('n’échappe pas deux fois un fragment déjà composé', () => {
    const c = composerCourriel({ ...base, corps: { html: new Html('<p>a &amp; b</p>'), texte: 'a & b' } })
    expect(c).toContain('<p>a &amp; b</p>')
    expect(dateCourte('2026-10-19')).toBe('19/10/2026')
  })
})
