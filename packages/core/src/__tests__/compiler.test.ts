import { describe, it, expect, beforeEach } from 'vitest';
const uuidv4 = () => crypto.randomUUID();
import { compileIntent, buildModificationPatch } from '../compiler/compiler';
import { ComponentRegistryManager } from '../compiler/registry';
import type { ComponentResolver } from '../compiler/registry';
import type { IntentPayload } from '../schemas/intent';

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const STUB: ComponentResolver = (() => null) as any; // minimal ComponentResolver stub

function makeIntent(overrides: Partial<IntentPayload> = {}): IntentPayload {
  return {
    version: '1.0.0',
    intentId: uuidv4(),
    type: 'comparison',
    domain: 'travel',
    primaryGoal: 'Find best flight LHR→JFK',
    confidence: 0.9,
    density: 'operator',
    ambiguities: [],
    data: { flights: [] },
    priorityFields: [],
    actions: [],
    explain: false,
    ...overrides,
  };
}

function makeRegistry(): ComponentRegistryManager {
  return new ComponentRegistryManager().register('travel', 'comparison', {
    executive: STUB,
    operator: STUB,
    expert: STUB,
    default: STUB,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// compileIntent — density resolution
// ─────────────────────────────────────────────────────────────────────────────

describe('compileIntent — density resolution', () => {
  let registry: ComponentRegistryManager;
  beforeEach(() => { registry = makeRegistry(); });

  it('uses agent-recommended density by default', () => {
    const compiled = compileIntent(makeIntent({ density: 'executive' }), registry);
    expect(compiled.density).toBe('executive');
  });

  it('userDensityOverride always wins over agent recommendation', () => {
    const compiled = compileIntent(
      makeIntent({ density: 'expert' }),
      registry,
      { userDensityOverride: 'executive' },
    );
    expect(compiled.density).toBe('executive');
  });

  it('null userDensityOverride falls back to agent recommendation', () => {
    const compiled = compileIntent(
      makeIntent({ density: 'operator' }),
      registry,
      { userDensityOverride: null },
    );
    expect(compiled.density).toBe('operator');
  });

  it('systemPolicy minDensity bumps density up when agent is below minimum', () => {
    // agent says executive (index 0), min is expert (index 2) → clamp to expert
    const compiled = compileIntent(
      makeIntent({ density: 'executive' }),
      registry,
      { systemPolicy: { minDensity: 'expert' } },
    );
    expect(compiled.density).toBe('expert');
  });

  it('systemPolicy maxDensity clamps density down when agent is above maximum', () => {
    // agent says expert (index 2), max is executive (index 0) → clamp to executive
    const compiled = compileIntent(
      makeIntent({ density: 'expert' }),
      registry,
      { systemPolicy: { maxDensity: 'executive' } },
    );
    expect(compiled.density).toBe('executive');
  });

  it('systemPolicy with compatible range keeps agent recommendation', () => {
    const compiled = compileIntent(
      makeIntent({ density: 'operator' }),
      registry,
      { systemPolicy: { minDensity: 'executive', maxDensity: 'expert' } },
    );
    expect(compiled.density).toBe('operator');
  });

  it('userDensityOverride beats systemPolicy', () => {
    const compiled = compileIntent(
      makeIntent({ density: 'operator' }),
      registry,
      { userDensityOverride: 'expert', systemPolicy: { maxDensity: 'executive' } },
    );
    expect(compiled.density).toBe('expert');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// compileIntent — output shape
// ─────────────────────────────────────────────────────────────────────────────

describe('compileIntent — output shape', () => {
  let registry: ComponentRegistryManager;
  beforeEach(() => { registry = makeRegistry(); });

  it('passes through intentId, domain, type, primaryGoal, confidence', () => {
    const intent = makeIntent({ primaryGoal: 'Hello', confidence: 0.75 });
    const compiled = compileIntent(intent, registry);
    expect(compiled.intentId).toBe(intent.intentId);
    expect(compiled.domain).toBe('travel');
    expect(compiled.type).toBe('comparison');
    expect(compiled.primaryGoal).toBe('Hello');
    expect(compiled.confidence).toBe(0.75);
  });

  it('resolves component for known domain/type', () => {
    const compiled = compileIntent(makeIntent(), registry);
    expect(compiled.resolvedComponent).toBe(STUB);
    expect(compiled.warnings).toHaveLength(0);
  });

  it('sets resolvedComponent to null and adds a warning for unknown domain', () => {
    const compiled = compileIntent(makeIntent({ domain: 'finance' }), registry);
    expect(compiled.resolvedComponent).toBeNull();
    expect(compiled.warnings).toHaveLength(1);
    expect(compiled.warnings[0]).toContain('finance');
  });

  it('defaults explainability to empty object when absent', () => {
    const compiled = compileIntent(makeIntent(), registry);
    expect(compiled.explainability).toEqual({});
  });

  it('passes through explainability map when present', () => {
    const intent = makeIntent({
      explainability: {
        card1: {
          elementId: 'card1',
          summary: 'Best price',
          dataSources: [],
          assumptions: [],
          alternativesConsidered: [],
          whatIfQueries: [],
        },
      },
    });
    const compiled = compileIntent(intent, registry);
    expect(compiled.explainability['card1']?.summary).toBe('Best price');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// buildModificationPatch
// ─────────────────────────────────────────────────────────────────────────────

describe('buildModificationPatch', () => {
  it('creates a well-formed IntentModification', () => {
    const id = uuidv4();
    const patch = buildModificationPatch(id, { priceWeight: 0.8, nonstopOnly: true });
    expect(patch.event).toBe('intent_modification');
    expect(patch.originalIntentId).toBe(id);
    expect(patch.modifications).toEqual({ priceWeight: 0.8, nonstopOnly: true });
    expect(typeof patch.timestamp).toBe('number');
    expect(patch.timestamp).toBeLessThanOrEqual(Date.now());
  });

  it('accepts empty modifications', () => {
    const patch = buildModificationPatch(uuidv4(), {});
    expect(patch.modifications).toEqual({});
  });
});
