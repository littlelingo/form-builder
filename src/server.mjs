export {
  CURRENT_SCHEMA_VERSION,
  runMigrations,
  listMigrations,
} from './schema/migrations/registry.mjs';
export { computeSchemaHash } from './schema/migrations/schemaHash.mjs';
