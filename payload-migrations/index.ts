import * as migration_20261021_105110_initiale from './20261021_105110_initiale';

export const migrations = [
  {
    up: migration_20261021_105110_initiale.up,
    down: migration_20261021_105110_initiale.down,
    name: '20261021_105110_initiale'
  },
];
