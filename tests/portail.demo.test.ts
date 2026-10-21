import { describe, expect, it } from 'vitest'
import { composerMessage } from '@/lib/email/gmail'
import {
  ADRESSE_DES_DEMANDES_DE_DÉMO,
  CHAMP_PIÈGE,
  composerCourrierDeDémo,
  lireLaDemande,
  siteDeLOrganisation,
} from '@/lib/portail/demo'

function formulaire(champs: Record<string, string>): FormData {
  const données = new FormData()
  for (const [nom, valeur] of Object.entries(champs)) données.set(nom, valeur)
  return données
}

const COMPLET = {
  nom: 'Jeanne Martin',
  email: 'Jeanne.Martin@Exemple.test ',
  organisation: 'Office de tourisme',
  site: 'office-tourisme.fr',
  fonction: 'Directrice',
  message: 'Suivre la concurrence\r\ndes autres offices.',
}

describe('lireLaDemande', () => {
  it('accepte une demande complète et normalise l’adresse', () => {
    const lecture = lireLaDemande(formulaire(COMPLET))
    expect(lecture).toEqual({
      sorte: 'valide',
      demande: {
        nom: 'Jeanne Martin',
        email: 'jeanne.martin@exemple.test',
        organisation: 'Office de tourisme',
        site: 'https://office-tourisme.fr',
        fonction: 'Directrice',
        message: 'Suivre la concurrence\ndes autres offices.',
      },
    })
  })

  it('laisse la fonction et le message facultatifs', () => {
    const lecture = lireLaDemande(formulaire({ nom: 'J', email: 'j@e.test', organisation: 'O', site: 'o.fr' }))
    expect(lecture.sorte).toBe('valide')
  })

  it('nomme les champs obligatoires manquants et rend les valeurs saisies', () => {
    const lecture = lireLaDemande(formulaire({ nom: ' ', email: 'pas-une-adresse', organisation: '', fonction: 'DG' }))
    expect(lecture).toMatchObject({ sorte: 'invalide', champs: ['nom', 'email', 'organisation', 'site'] })
    if (lecture.sorte === 'invalide') expect(lecture.valeurs.fonction).toBe('DG')
  })

  it('refuse une adresse qui injecterait un en-tête', () => {
    const lecture = lireLaDemande(formulaire({ ...COMPLET, email: 'a@b.test\r\nBcc: c@d.test' }))
    expect(lecture).toMatchObject({ sorte: 'invalide', champs: ['email'] })
  })

  it('exige le site de l’organisation', () => {
    const { site: _site, ...sansSite } = COMPLET
    expect(lireLaDemande(formulaire(sansSite))).toMatchObject({ sorte: 'invalide', champs: ['site'] })
    expect(lireLaDemande(formulaire({ ...COMPLET, site: 'pas un site' }))).toMatchObject({
      sorte: 'invalide',
      champs: ['site'],
    })
  })

  it('plafonne la longueur du message', () => {
    const lecture = lireLaDemande(formulaire({ ...COMPLET, message: 'x'.repeat(2_001) }))
    expect(lecture).toMatchObject({ sorte: 'invalide', champs: ['message'] })
  })

  it('retire les retours à la ligne d’un champ d’une ligne', () => {
    const lecture = lireLaDemande(formulaire({ ...COMPLET, organisation: 'Office\r\nBcc: x@y.test' }))
    expect(lecture.sorte === 'valide' && lecture.demande.organisation).toBe('Office Bcc: x@y.test')
  })

  it('écarte un formulaire dont le champ piège est rempli', () => {
    expect(lireLaDemande(formulaire({ ...COMPLET, [CHAMP_PIÈGE]: 'https://spam.test' }))).toEqual({ sorte: 'piège' })
  })
})

describe('siteDeLOrganisation', () => {
  it('complète une adresse saisie sans protocole', () => {
    expect(siteDeLOrganisation('next-impact.digital')).toBe('https://next-impact.digital')
    expect(siteDeLOrganisation('www.exemple.fr/contact')).toBe('https://www.exemple.fr/contact')
  })

  it('garde une adresse complète en http ou https', () => {
    expect(siteDeLOrganisation('http://exemple.fr/')).toBe('http://exemple.fr')
    expect(siteDeLOrganisation('https://exemple.fr/a?b=1')).toBe('https://exemple.fr/a?b=1')
  })

  it('refuse ce qui n’est pas un site web', () => {
    expect(siteDeLOrganisation('')).toBeNull()
    expect(siteDeLOrganisation('localhost')).toBeNull()
    expect(siteDeLOrganisation('javascript:alert(1)')).toBeNull()
    expect(siteDeLOrganisation('mailto:a@b.fr')).toBeNull()
    expect(siteDeLOrganisation('ftp://exemple.fr')).toBeNull()
    expect(siteDeLOrganisation('https://moi:secret@exemple.fr')).toBeNull()
    expect(siteDeLOrganisation('exemple .fr')).toBeNull()
  })
})

describe('composerCourrierDeDémo', () => {
  const lecture = lireLaDemande(formulaire(COMPLET))
  if (lecture.sorte !== 'valide') throw new Error('demande de référence invalide')
  const courrier = composerCourrierDeDémo(lecture.demande, new Date('2026-10-21T10:00:00Z'))

  it('part vers l’opératrice, réponse adressée au demandeur', () => {
    expect(courrier.destinataire).toBe(ADRESSE_DES_DEMANDES_DE_DÉMO)
    expect(courrier.destinataire).toBe('agathe@signauxfaibles.io')
    expect(courrier.répondreÀ).toBe('jeanne.martin@exemple.test')
    expect(courrier.sujet).toBe('Demande de démo : Office de tourisme')
  })

  it('reprend chaque champ dans le corps', () => {
    expect(courrier.texte).toContain('reçue le 21/10/2026')
    expect(courrier.texte).toContain('Nom : Jeanne Martin')
    expect(courrier.texte).toContain('Adresse : jeanne.martin@exemple.test')
    expect(courrier.texte).toContain('Site : https://office-tourisme.fr')
    expect(courrier.texte).toContain('Fonction : Directrice')
    expect(courrier.texte).toContain('Suivre la concurrence\ndes autres offices.')
  })

  it('pose l’en-tête Reply-To dans le message composé', () => {
    const brut = composerMessage(courrier, 'acces@signauxfaibles.io', 'signauxfaibles')
    expect(brut).toContain('\r\nReply-To: jeanne.martin@exemple.test\r\n')
  })
})
