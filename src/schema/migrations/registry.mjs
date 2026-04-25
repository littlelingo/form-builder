import * as v1_0_0_to_v1_1_0 from './v1_0_0-to-v1_1_0.mjs';

export const CURRENT_SCHEMA_VERSION = '1.1.0';

const MIGRATIONS = [v1_0_0_to_v1_1_0];

export async function runMigrations(form) {
  if (!form || typeof form !== 'object') {
    throw new Error('runMigrations requires a form object');
  }
  let current = form;
  for (let i = 0; i < MIGRATIONS.length; i += 1) {
    const migration = MIGRATIONS[i];
    if (current.schemaVersion === migration.fromVersion) {
      // eslint-disable-next-line no-await-in-loop
      current = await migration.migrate(current);
    }
  }
  if (current.schemaVersion !== CURRENT_SCHEMA_VERSION) {
    throw new Error(
      `runMigrations: form schemaVersion "${current.schemaVersion}" did not reach current "${CURRENT_SCHEMA_VERSION}". No migration path registered.`,
    );
  }
  return current;
}

export function listMigrations() {
  return MIGRATIONS.map(({ fromVersion, toVersion }) => ({ fromVersion, toVersion }));
}
