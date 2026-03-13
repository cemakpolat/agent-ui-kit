import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  SituationalPerceptionSchema,
  SituationalViewSchema,
  parseSituationalPerception,
  assertSituationalPerception,
  isViewExpired,
} from '../schemas/situational-view';
import {
  assertPerceptionNotExpired,
} from '../schemas/governed-action';
import { compileIntent } from '../compiler/compiler';
import { ComponentRegistryManager } from '../compiler/registry';
import { LLMValidationError } from '../compiler/compiler';
import {
  _clearWarnings,
  _warnedKeys,
  warnIfNoQuestion,
  warnIfLongLivedView,
  warnIfUncalibratedConfidence,
  warnIfNoExpiration,
  warnIfRecommendationsWithoutEvidence,
  checkPerceptionMisuse,
} from '../validation/dev-warnings';

// ─────────────────────────────────────────────────────────────────────────────
// HARI — Refusal Tests
//
// These tests assert that HARI *refuses* invalid inputs, not just that it
// handles them gracefully. Every test here corresponds to a hard invariant
// declared in the Perception Contract (docs/PERCEPTION-CONTRACT.md) and the
// Conformance Specification (CONFORMANCE.md).
//
// A conforming implementation MUST pass all tests in this file.
// See CONFORMANCE.md §Conformance Test Suite.
// ─────────────────────────────────────────────────────────────────────────────

// ── Helpers ───────────────────────────────────────────────────────────────────

const VALID_PERCEPTION_BASE = {
  perceptionId:        '00000000-0000-0000-0000-000000000001',
  schemaVersion:       '1.0.0',
  originatingQuestion: 'Is the payment service healthy enough to resume processing?',
  scope: { systems: ['payment-service'] },
  view: {
    situationId:  '00000000-0000-0000-0000-000000000002',
    question:     'Is the payment service healthy?',
    scope:        { systems: ['payment-service'] },
    confidence:   0.82,
    generatedAt:  new Date().toISOString(),
    priority:     5,
    expiresAt:    new Date(Date.now() + 10 * 60 * 1000).toISOString(), // +10m
    status:       'active' as const,
    unknowns:     [],
    assumptions:  [],
    tags:         [],
    renderContract: {
      version:         '1.0.0',
      intentId:        '00000000-0000-0000-0000-000000000003',
      type:            'chat' as const,
      domain:          'ops',
      primaryGoal:     'Assess payment service health',
      confidence:      0.82,
      data: {
        messages: [{ id: '1', role: 'agent', content: 'All systems normal.', timestamp: 1000 }],
      },
      density: 'operator' as const,
      ambiguities: [],
      priorityFields: [],
      actions: [],
      explain: false,
    },
  },
  submittedAt: new Date().toISOString(),
  evidence: [{ claim: 'P99 latency is 120ms', source: 'datadog', confidence: 0.9 }],
  recommendations: [{ action: 'Resume processing', rationale: 'All health checks pass', confidence: 0.85 }],
};

// ── Part 1: Invariant 1 — Every view answers a question ──────────────────────

describe('Invariant 1: Originating question is required', () => {
  it('rejects perception with no originatingQuestion', () => {
    const { originatingQuestion: _, ...withoutQuestion } = VALID_PERCEPTION_BASE;
    const result = SituationalPerceptionSchema.safeParse(withoutQuestion);
    expect(result.success).toBe(false);
  });

  it('rejects perception with empty originatingQuestion', () => {
    const result = SituationalPerceptionSchema.safeParse({
      ...VALID_PERCEPTION_BASE,
      originatingQuestion: '',
    });
    expect(result.success).toBe(false);
    const errs = result.error!.errors.map((e) => e.message).join(' ');
    expect(errs).toMatch(/originatingQuestion/i);
  });

  it('rejects originatingQuestion shorter than 10 chars', () => {
    const result = SituationalPerceptionSchema.safeParse({
      ...VALID_PERCEPTION_BASE,
      originatingQuestion: 'Healthy?',
    });
    expect(result.success).toBe(false);
  });

  it('rejects generic label "status"', () => {
    const result = SituationalPerceptionSchema.safeParse({
      ...VALID_PERCEPTION_BASE,
      originatingQuestion: 'status',
    });
    expect(result.success).toBe(false);
    const errs = result.error!.errors.map((e) => e.message).join(' ');
    expect(errs).toMatch(/generic label|real question/i);
  });

  it('rejects generic label "dashboard"', () => {
    const result = SituationalPerceptionSchema.safeParse({
      ...VALID_PERCEPTION_BASE,
      originatingQuestion: 'DASHBOARD',
    });
    expect(result.success).toBe(false);
  });

  it('rejects generic label "overview"', () => {
    const result = SituationalPerceptionSchema.safeParse({
      ...VALID_PERCEPTION_BASE,
      originatingQuestion: 'overview',
    });
    expect(result.success).toBe(false);
  });

  it('accepts a real question', () => {
    const result = SituationalPerceptionSchema.safeParse(VALID_PERCEPTION_BASE);
    expect(result.success).toBe(true);
  });

  it('parseSituationalPerception surfaces question error', () => {
    const result = parseSituationalPerception({ ...VALID_PERCEPTION_BASE, originatingQuestion: 'status' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const msg = result.errors.map((e) => e.message).join(' ');
      expect(msg).toMatch(/generic|real question/i);
    }
  });

  it('assertSituationalPerception throws with descriptive message', () => {
    expect(() =>
      assertSituationalPerception({ ...VALID_PERCEPTION_BASE, originatingQuestion: '' })
    ).toThrow(/perception contract violation/i);
  });
});

// ── Part 2: Invariant 2 — Every view expires ─────────────────────────────────

describe('Invariant 2: Expiration is required', () => {
  const viewBase = {
    situationId:  '00000000-0000-0000-0000-000000000002',
    question:     'Is the service healthy?',
    scope:        { systems: ['payment-service'] },
    confidence:   0.82,
    generatedAt:  new Date().toISOString(),
    priority:     5,
    status:       'active' as const,
    unknowns:     [],
    assumptions:  [],
    tags:         [],
    renderContract: {
      version:     '1.0.0',
      intentId:    '00000000-0000-0000-0000-000000000003',
      type:        'chat' as const,
      domain:      'ops',
      primaryGoal: 'Health check',
      confidence:  0.82,
      data: { messages: [{ id: '1', role: 'agent', content: 'OK', timestamp: 1000 }] },
      density: 'operator' as const,
      ambiguities: [],
      priorityFields: [],
      actions: [],
      explain: false,
    },
  };

  it('rejects SituationalView with neither expiresAt nor invalidationCondition', () => {
    const result = SituationalViewSchema.safeParse(viewBase);
    expect(result.success).toBe(false);
    const errs = result.error!.errors.map((e) => e.message).join(' ');
    expect(errs).toMatch(/expiresAt|invalidation/i);
  });

  it('accepts view with only expiresAt', () => {
    const result = SituationalViewSchema.safeParse({
      ...viewBase,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });
    expect(result.success).toBe(true);
  });

  it('accepts view with only invalidationCondition', () => {
    const result = SituationalViewSchema.safeParse({
      ...viewBase,
      invalidationCondition: 'When lag drops below 100ms',
    });
    expect(result.success).toBe(true);
  });

  it('isViewExpired returns true for past expiresAt', () => {
    const view = { ...VALID_PERCEPTION_BASE.view, expiresAt: new Date(Date.now() - 1000).toISOString() };
    expect(isViewExpired(view)).toBe(true);
  });

  it('isViewExpired returns false for future expiresAt', () => {
    const view = { ...VALID_PERCEPTION_BASE.view, expiresAt: new Date(Date.now() + 60_000).toISOString() };
    expect(isViewExpired(view)).toBe(false);
  });

  it('isViewExpired returns true when status is expired', () => {
    const view = { ...VALID_PERCEPTION_BASE.view, status: 'expired' as const };
    expect(isViewExpired(view)).toBe(true);
  });
});

// ── Part 3: Approval blocked on expired perception ────────────────────────────

describe('Approval blocked on expired perception', () => {
  it('assertPerceptionNotExpired throws for expired status', () => {
    const expiredView = { ...VALID_PERCEPTION_BASE.view, status: 'expired' as const };
    expect(() => assertPerceptionNotExpired(expiredView)).toThrow(/expired/i);
  });

  it('assertPerceptionNotExpired throws for past expiresAt', () => {
    const expiredView = {
      ...VALID_PERCEPTION_BASE.view,
      status: 'active' as const,
      expiresAt: new Date(Date.now() - 5000).toISOString(),
    };
    expect(() => assertPerceptionNotExpired(expiredView)).toThrow(/expired/i);
  });

  it('assertPerceptionNotExpired does not throw for active view', () => {
    expect(() =>
      assertPerceptionNotExpired(VALID_PERCEPTION_BASE.view)
    ).not.toThrow();
  });
});

// ── Part 4: STRICT validation mode throws LLMValidationError ─────────────────

describe('Compiler STRICT mode — hard refusal', () => {
  const registry = new ComponentRegistryManager();

  const makeBadIntent = (id: string) => ({
    version:     '1.0.0',
    intentId:    id,
    type:        'nonexistent_type',
    domain:      'ops',
    primaryGoal: 'test',
    confidence:  0.5,
    data:        {},
  });

  it('throws LLMValidationError for unknown intent type in STRICT mode', () => {
    expect(() =>
      compileIntent(makeBadIntent('test-1') as never, registry, { validationMode: 'STRICT' })
    ).toThrow(LLMValidationError);
  });

  it('LLMValidationError has violations array', () => {
    try {
      compileIntent(makeBadIntent('test-2') as never, registry, { validationMode: 'STRICT' });
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(LLMValidationError);
      const e = err as LLMValidationError;
      expect(e.violations.length).toBeGreaterThan(0);
      expect(e.mode).toBe('STRICT');
    }
  });

  it('STRICT mode error message mentions the problem', () => {
    try {
      compileIntent(makeBadIntent('test-3') as never, registry, { validationMode: 'STRICT' });
      expect.fail('should have thrown');
    } catch (err) {
      expect((err as Error).message).toMatch(/HARI STRICT|validation failed/i);
    }
  });

  it('DIAGNOSTIC mode returns insufficientInformation instead of throwing', () => {
    const result = compileIntent(makeBadIntent('test-4') as never, registry, { validationMode: 'DIAGNOSTIC' });
    expect(result.insufficientInformation).toBe(true);
    expect(result.resolvedComponent).toBeNull();
  });

  it('LENIENT mode does not throw for unknown intent type', () => {
    expect(() =>
      compileIntent(makeBadIntent('test-5') as never, registry, { validationMode: 'LENIENT' })
    ).not.toThrow();
  });
});

// ── Part 5: Dev-mode misuse warnings ─────────────────────────────────────────

describe('Dev-mode misuse warnings', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    _clearWarnings();
    consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // Ensure we're not in production
    (globalThis as any).process = (globalThis as any).process || {};
    (globalThis as any).process.env = (globalThis as any).process.env || {};
    (globalThis as any).process.env.NODE_ENV = 'test';
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('warnIfNoQuestion fires for null question', () => {
    warnIfNoQuestion(null, 'test:null-question');
    expect(consoleSpy).toHaveBeenCalled();
    expect(consoleSpy.mock.calls[0][0]).toMatch(/without a question/i);
  });

  it('warnIfNoQuestion fires for empty string', () => {
    warnIfNoQuestion('', 'test:empty-question');
    expect(consoleSpy).toHaveBeenCalled();
  });

  it('warnIfNoQuestion fires for generic label "status"', () => {
    warnIfNoQuestion('status', 'test:generic-status');
    expect(consoleSpy).toHaveBeenCalled();
    expect(consoleSpy.mock.calls[0][0]).toMatch(/generic/i);
  });

  it('warnIfNoQuestion does NOT fire for real question', () => {
    warnIfNoQuestion('Is the service healthy enough to process payments?', 'test:real-q');
    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it('warnIfLongLivedView fires for view expiring in 48h', () => {
    const in48h = new Date(Date.now() + 48 * 3_600_000).toISOString();
    warnIfLongLivedView(in48h, 'test:long-lived');
    expect(consoleSpy).toHaveBeenCalled();
    expect(consoleSpy.mock.calls[0][0]).toMatch(/long-lived/i);
  });

  it('warnIfLongLivedView does NOT fire for 1h expiry', () => {
    const in1h = new Date(Date.now() + 3_600_000).toISOString();
    warnIfLongLivedView(in1h, 'test:short-lived');
    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it('warnIfLongLivedView does NOT fire when expiresAt is null', () => {
    warnIfLongLivedView(null, 'test:null-expiry');
    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it('warnIfUncalibratedConfidence fires for confidence 0.99', () => {
    warnIfUncalibratedConfidence(0.99, 'test:uncalibrated');
    expect(consoleSpy).toHaveBeenCalled();
    expect(consoleSpy.mock.calls[0][0]).toMatch(/confidence|uncalibrated/i);
  });

  it('warnIfUncalibratedConfidence fires for confidence 1.0', () => {
    warnIfUncalibratedConfidence(1.0, 'test:perfect');
    expect(consoleSpy).toHaveBeenCalled();
  });

  it('warnIfUncalibratedConfidence does NOT fire for confidence 0.85', () => {
    warnIfUncalibratedConfidence(0.85, 'test:good-confidence');
    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it('warnIfNoExpiration fires when both fields are absent', () => {
    warnIfNoExpiration(null, null, 'test:no-expiry');
    expect(consoleSpy).toHaveBeenCalled();
    expect(consoleSpy.mock.calls[0][0]).toMatch(/no expiration|expiresAt/i);
  });

  it('warnIfNoExpiration does NOT fire when expiresAt is set', () => {
    warnIfNoExpiration(new Date().toISOString(), null, 'test:has-expiry');
    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it('warnIfNoExpiration does NOT fire when invalidationCondition is set', () => {
    warnIfNoExpiration(null, 'When lag drops below 100ms', 'test:has-cond');
    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it('warnIfRecommendationsWithoutEvidence fires when recs exist but evidence is empty', () => {
    warnIfRecommendationsWithoutEvidence([], [{ action: 'Restart' }], 'test:no-evidence');
    expect(consoleSpy).toHaveBeenCalled();
    expect(consoleSpy.mock.calls[0][0]).toMatch(/evidence|lobbying/i);
  });

  it('warnIfRecommendationsWithoutEvidence does NOT fire when evidence is present', () => {
    warnIfRecommendationsWithoutEvidence(
      [{ claim: 'CPU at 90%', source: 'metrics', confidence: 0.9 }],
      [{ action: 'Scale up' }],
      'test:has-evidence',
    );
    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it('warnings are deduplicated — second call with same key is silent', () => {
    warnIfNoQuestion(null, 'test:dedup');
    warnIfNoQuestion(null, 'test:dedup');
    expect(consoleSpy).toHaveBeenCalledTimes(1);
  });

  it('_warnedKeys tracks fired warning keys', () => {
    warnIfNoQuestion(null, 'test:track-key');
    const keys = _warnedKeys();
    expect(keys.has('no-question:test:track-key')).toBe(true);
  });

  it('_clearWarnings resets deduplication', () => {
    warnIfNoQuestion(null, 'test:clear');
    _clearWarnings();
    warnIfNoQuestion(null, 'test:clear');
    expect(consoleSpy).toHaveBeenCalledTimes(2);
  });

  it('checkPerceptionMisuse aggregates all relevant warnings', () => {
    checkPerceptionMisuse({
      originatingQuestion: null,
      confidence: 1.0,
      view: { expiresAt: null, invalidationCondition: null },
      evidence: [],
      recommendations: [{ action: 'Do something' }],
    }, 'test:composite');
    // Should have fired at least: no-question, uncalibrated-confidence, no-expiration, recs-without-evidence
    expect(consoleSpy.mock.calls.length).toBeGreaterThanOrEqual(3);
  });
});

// ── Part 6: Schema — valid perception must parse cleanly ──────────────────────

describe('Valid SituationalPerception — positive cases', () => {
  it('parses a well-formed perception', () => {
    const result = parseSituationalPerception(VALID_PERCEPTION_BASE);
    expect(result.success).toBe(true);
  });

  it('assertSituationalPerception returns data for valid input', () => {
    const data = assertSituationalPerception(VALID_PERCEPTION_BASE);
    expect(data.originatingQuestion).toBe(VALID_PERCEPTION_BASE.originatingQuestion);
    expect(data.perceptionId).toBe(VALID_PERCEPTION_BASE.perceptionId);
  });

  it('accepts perception with invalidationCondition instead of expiresAt', () => {
    const { expiresAt: _removed, ...viewWithoutExpiry } = VALID_PERCEPTION_BASE.view;
    const result = parseSituationalPerception({
      ...VALID_PERCEPTION_BASE,
      view: {
        ...viewWithoutExpiry,
        invalidationCondition: 'When all replicas report healthy',
      },
    });
    expect(result.success).toBe(true);
  });
});
