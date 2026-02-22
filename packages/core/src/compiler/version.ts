// ─────────────────────────────────────────────────────────────────────────────
// Schema Version Guard
//
// Every IntentPayload carries a semver `version` field.  The frontend must
// check this before rendering and decide whether to:
//   - Render normally          (version is supported)
//   - Render with warnings     (minor/patch version drift)
//   - Degrade gracefully       (major version mismatch)
//
// This implements the HARI extensibility contract:
//   "Frontends transform or gracefully degrade older versions."
//   "Capability discovery allows agents to adapt to supported features."
// ─────────────────────────────────────────────────────────────────────────────

export const SUPPORTED_SCHEMA_VERSION = '1.0.0';

export type VersionCompatibility =
  | { status: 'compatible';    warnings: string[] }
  | { status: 'degraded';      warnings: string[]; reason: string }
  | { status: 'incompatible';  reason: string };

/**
 * Check whether an IntentPayload's schema version is compatible with this
 * frontend version.  Returns a compatibility report the renderer can act on.
 */
export function checkSchemaVersion(payloadVersion: string): VersionCompatibility {
  const [supMaj, supMin] = SUPPORTED_SCHEMA_VERSION.split('.').map(Number);
  const parts = payloadVersion.split('.').map(Number);

  if (parts.length !== 3 || parts.some(isNaN)) {
    return { status: 'degraded', warnings: [], reason: `Unrecognised version format: "${payloadVersion}"` };
  }

  const [maj, min] = parts;

  if (maj !== supMaj) {
    return {
      status: 'incompatible',
      reason: `Major version mismatch: agent sent v${payloadVersion}, frontend supports v${SUPPORTED_SCHEMA_VERSION}. ` +
              `Rendering may fail. Update the frontend or ask the agent to downgrade the schema.`,
    };
  }

  const warnings: string[] = [];
  if (min > supMin) {
    warnings.push(
      `Agent uses schema v${payloadVersion} which is newer than supported v${SUPPORTED_SCHEMA_VERSION}. ` +
      `Some new fields may be ignored.`,
    );
    return { status: 'degraded', warnings, reason: warnings[0] };
  }

  if (min < supMin) {
    warnings.push(`Agent uses older schema v${payloadVersion}. Missing fields will use defaults.`);
  }

  return { status: 'compatible', warnings };
}

/**
 * Capability manifest: tells the agent which intent types and ambiguity
 * control types this frontend version supports.
 */
export interface CapabilityManifest {
  schemaVersion: string;
  supportedIntentTypes: string[];
  supportedAmbiguityTypes: string[];
  supportedDomains: string[];
  densityModes: string[];
}

export function buildCapabilityManifest(
  registeredDomains: string[],
  registeredIntentTypes: string[],
): CapabilityManifest {
  return {
    schemaVersion: SUPPORTED_SCHEMA_VERSION,
    supportedIntentTypes: registeredIntentTypes,
    supportedAmbiguityTypes: ['range_selector', 'toggle', 'multi_select', 'single_select'],
    supportedDomains: registeredDomains,
    densityModes: ['executive', 'operator', 'expert'],
  };
}
