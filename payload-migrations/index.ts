import * as migration_20261021_105110_initiale from './20261021_105110_initiale';
import * as migration_20261021_111008_ajout_gels_fiche_bloc from './20261021_111008_ajout_gels_fiche_bloc';

export const migrations = [
  {
    up: migration_20261021_105110_initiale.up,
    down: migration_20261021_105110_initiale.down,
    name: '20261021_105110_initiale',
  },
  {
    up: migration_20261021_111008_ajout_gels_fiche_bloc.up,
    down: migration_20261021_111008_ajout_gels_fiche_bloc.down,
    name: '20261021_111008_ajout_gels_fiche_bloc'
  },
];
