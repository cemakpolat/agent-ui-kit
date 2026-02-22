import { describe, it, expect } from 'vitest';
import { checkSchemaVersion, buildCapabilityManifest, SUPPORTED_SCHEMA_VERSION } from '../compiler/version';

describe('checkSchemaVersion', () => {
  it('returns compatible for the current supported version', () => {
    const result = checkSchemaVersion(SUPPORTED_SCHEMA_VERSION);
    expect(result.status).toBe('compatible');
  });

  it('returns compatible for 1.0.0', () => {
    const result = checkSchemaVersion('1.0.0');
    expect(result.status).toBe('compatible');
  });

  it('returns degraded for a higher minor within same major', () => {
    // 1.99.0 is ahead of 1.0.0 — frontend will warn but not reject
    const result = checkSchemaVersion('1.99.0');
    expect(result.status).toBe('degraded');
    expect((result as { reason: string }).reason).toBeDefined();
  });

  it('returns incompatible for a different major version', () => {
    const [major] = SUPPORTED_SCHEMA_VERSION.split('.').map(Number);
    const nextMajor = `${major + 1}.0.0`;
    const result = checkSchemaVersion(nextMajor);
    expect(result.status).toBe('incompatible');
    expect((result as { reason: string }).reason).toBeDefined();
  });

  it('result includes a reason string when not compatible', () => {
    const result = checkSchemaVersion('99.0.0');
    expect(result.status).toBe('incompatible');
    const r = result as { reason: string };
    expect(typeof r.reason).toBe('string');
    expect(r.reason.length).toBeGreaterThan(0);
  });

  it('returns degraded for an unrecognised version format', () => {
    const result = checkSchemaVersion('not-a-version');
    expect(result.status).toBe('degraded');
  });
});

describe('buildCapabilityManifest', () => {
  it('includes provided domains and intent types', () => {
    const manifest = buildCapabilityManifest(['travel', 'cloudops'], ['comparison', 'diagnostic']);
    expect(manifest.supportedDomains).toContain('travel');
    expect(manifest.supportedDomains).toContain('cloudops');
    expect(manifest.supportedIntentTypes).toContain('comparison');
    expect(manifest.supportedIntentTypes).toContain('diagnostic');
  });

  it('includes the supported schema version', () => {
    const manifest = buildCapabilityManifest([], []);
    expect(manifest.schemaVersion).toBe(SUPPORTED_SCHEMA_VERSION);
  });

  it('includes all four built-in ambiguity control types', () => {
    const manifest = buildCapabilityManifest([], []);
    expect(manifest.supportedAmbiguityTypes).toContain('range_selector');
    expect(manifest.supportedAmbiguityTypes).toContain('toggle');
    expect(manifest.supportedAmbiguityTypes).toContain('multi_select');
    expect(manifest.supportedAmbiguityTypes).toContain('single_select');
  });

  it('includes all three density modes', () => {
    const manifest = buildCapabilityManifest([], []);
    expect(manifest.densityModes).toContain('executive');
    expect(manifest.densityModes).toContain('operator');
    expect(manifest.densityModes).toContain('expert');
  });
});
