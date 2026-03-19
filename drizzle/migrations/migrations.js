// This file is required for Expo/React Native SQLite migrations - https://orm.drizzle.team/quick-sqlite/expo

import journal from './meta/_journal.json';
import m0000 from './0000_dapper_sugar_man.sql';
import m0001 from './0001_regular_magus.sql';
import m0002 from './0002_purple_puma.sql';
import m0003 from './0003_military_spiral.sql';
import m0004 from './0004_thick_weapon_omega.sql';

  export default {
    journal,
    migrations: {
      m0000,
m0001,
m0002,
m0003,
m0004
    }
  }
  