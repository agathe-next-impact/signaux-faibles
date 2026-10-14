import { LogoEmpile } from '@/components/marque'

/**
 * Le gabarit commun des pages de secours : introuvable, erreur, hors ligne.
 *
 * Il tient dans la charte sans rien lui emprunter de plus que les tokens :
 * Lora pour le titre, Public Sans pour le texte, un seul lien. Aucune donnée de
 * client n'y passe jamais, et aucun message technique non plus : ce que Notion
 * ou Next ont répondu va dans les journaux Vercel (règle 4), pas sur l'écran.
 */
export function PageDeSecours({
  titre,
  children,
  action,
}: {
  titre: string
  children: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-6 px-6 py-16">
      <LogoEmpile />
      <h2 className="font-titre text-h2 font-bold text-encre">{titre}</h2>
      <div className="flex flex-col gap-3 text-ardoise">{children}</div>
      {action ? <div>{action}</div> : null}
    </main>
  )
}

/** Un lien ou un bouton de page de secours, dans le style du bouton primaire. */
export const CLASSE_ACTION_DE_SECOURS =
  'inline-block rounded-douce bg-encre px-4 py-2 text-corps font-medium text-blanc'
