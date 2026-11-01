import * as migration_20261021_105110_initiale from './20261021_105110_initiale';
import * as migration_20261021_111008_ajout_gels_fiche_bloc from './20261021_111008_ajout_gels_fiche_bloc';
import * as migration_20261021_124849_retrait_runs from './20261021_124849_retrait_runs';
import * as migration_20261101_090000_edition_a_publier from './20261101_090000_edition_a_publier';

export const migrations = [
  {
    up: migration_20261021_105110_initiale.up,
    down: migration_20261021_105110_initiale.down,
    name: '20261021_105110_initiale',
  },
  {
    up: migration_20261021_111008_ajout_gels_fiche_bloc.up,
    down: migration_20261021_111008_ajout_gels_fiche_bloc.down,
    name: '20261021_111008_ajout_gels_fiche_bloc',
  },
  {
    up: migration_20261021_124849_retrait_runs.up,
    down: migration_20261021_124849_retrait_runs.down,
    name: '20261021_124849_retrait_runs',
  },
  {
    up: migration_20261101_090000_edition_a_publier.up,
    down: migration_20261101_090000_edition_a_publier.down,
    name: '20261101_090000_edition_a_publier',
  },
];
