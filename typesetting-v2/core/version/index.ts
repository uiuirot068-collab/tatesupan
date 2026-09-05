// VersionMetadata (Core Contract §25) — carried on every CanonicalDocument
// so a saved project can be reproducibly re-laid-out later.

export const CORE_SCHEMA_VERSION = "1.0.0";

export interface VersionMetadata {
  coreSchemaVersion: string;
  ruleSetVersion: string;
  settingsVersion: string;
  measurementIdentity: string;
}
