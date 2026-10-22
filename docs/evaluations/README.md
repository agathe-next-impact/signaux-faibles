# Évaluations versionnées

Copies figées de sorties du dossier `evaluation/` (ignoré par git, local à une session).
Chaque sous-dossier est une exécution : `lettre.md`, `referentiel-unique.md`, `rapport.md`
(coûts aux tarifs publics), `validation.json`, `production.json`, `courriel.html`.

| Dossier | Contenu |
|---|---|
| `2026-10-22-onboarding-la-petite-vitrine` | Onboarding local de bout en bout (`pnpm onboarding:local`) : référentiel dérivé d'un nom et d'une URL, lettre n° 1 acceptée par le portail, 3,61 $. Limites mesurées dans `docs/programme-lettre-unique.md`. |
| `2026-10-22-suivi-deux-semaines-la-petite-vitrine` | Deux parutions de suite (`--semaines 2`) le même jour, référentiel repris : numéro 2 attribué par la file, gel de la semaine 1, lettre précédente transmise. La période se chevauche et le web n'a rien de postérieur au 22 octobre : ce test mesure le mécanisme de suivi, pas du contenu nouveau. |
