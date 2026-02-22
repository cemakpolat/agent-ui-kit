import { describe, it, expect } from 'vitest';
const uuidv4 = () => crypto.randomUUID();
import {
  IntentPayloadSchema,
  IntentModificationSchema,
  DensityModeSchema,
} from '../schemas/intent';
import {
  AmbiguityControlSchema,
  RangeSelectorSchema,
  ToggleSchema,
  MultiSelectSchema,
  SingleSelectSchema,
} from '../schemas/ambiguity';
import { AgentActionSchema } from '../schemas/action';
import { ExplainabilityContextSchema } from '../schemas/explainability';

const BASE_INTENT = {
  version: '1.0.0',
  intentId: uuidv4(),
  type: 'comparison',
  domain: 'travel',
  primaryGoal: 'Find the best flight from LHR to JFK',
  confidence: 0.92,
  data: { flights: [] },
};

// ── IntentPayloadSchema ───────────────────────────────────────────────────────

describe('IntentPayloadSchema', () => {
  it('parses a valid minimal intent', () => {
    const result = IntentPayloadSchema.safeParse(BASE_INTENT);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.ambiguities).toEqual([]);
      expect(result.data.density).toBe('operator'); // default
      expect(result.data.explain).toBe(false);      // default
    }
  });

  it('applies density default to operator', () => {
    const result = IntentPayloadSchema.parse(BASE_INTENT);
    expect(result.density).toBe('operator');
  });

  it('accepts all three density modes', () => {
    for (const density of ['executive', 'operator', 'expert'] as const) {
      const result = IntentPayloadSchema.safeParse({ ...BASE_INTENT, density });
      expect(result.success).toBe(true);
    }
  });

  it('rejects unknown density mode', () => {
    const result = IntentPayloadSchema.safeParse({ ...BASE_INTENT, density: 'superuser' });
    expect(result.success).toBe(false);
  });

  it('rejects confidence outside 0–1', () => {
    expect(IntentPayloadSchema.safeParse({ ...BASE_INTENT, confidence: -0.1 }).success).toBe(false);
    expect(IntentPayloadSchema.safeParse({ ...BASE_INTENT, confidence: 1.1 }).success).toBe(false);
  });

  it('rejects malformed version string', () => {
    const result = IntentPayloadSchema.safeParse({ ...BASE_INTENT, version: '1.0' });
    expect(result.success).toBe(false);
  });

  it('rejects non-UUID intentId', () => {
    const result = IntentPayloadSchema.safeParse({ ...BASE_INTENT, intentId: 'not-a-uuid' });
    expect(result.success).toBe(false);
  });

  it('parses layoutHint when provided', () => {
    const result = IntentPayloadSchema.parse({ ...BASE_INTENT, layoutHint: 'matrix' });
    expect(result.layoutHint).toBe('matrix');
  });

  it('omits layoutHint when absent', () => {
    const result = IntentPayloadSchema.parse(BASE_INTENT);
    expect(result.layoutHint).toBeUndefined();
  });
});

// ── DensityModeSchema ─────────────────────────────────────────────────────────

describe('DensityModeSchema', () => {
  it('accepts valid modes', () => {
    expect(DensityModeSchema.parse('executive')).toBe('executive');
    expect(DensityModeSchema.parse('operator')).toBe('operator');
    expect(DensityModeSchema.parse('expert')).toBe('expert');
  });

  it('rejects invalid mode', () => {
    expect(() => DensityModeSchema.parse('beginner')).toThrow();
  });
});

// ── IntentModificationSchema ──────────────────────────────────────────────────

describe('IntentModificationSchema', () => {
  it('parses a valid patch', () => {
    const patch = {
      event: 'intent_modification' as const,
      originalIntentId: uuidv4(),
      modifications: { priceWeight: 0.7, nonstopOnly: true },
      timestamp: Date.now(),
    };
    const result = IntentModificationSchema.safeParse(patch);
    expect(result.success).toBe(true);
  });

  it('rejects wrong event literal', () => {
    const result = IntentModificationSchema.safeParse({
      event: 'intent_creation',
      originalIntentId: uuidv4(),
      modifications: {},
      timestamp: Date.now(),
    });
    expect(result.success).toBe(false);
  });
});

// ── AmbiguityControlSchema ────────────────────────────────────────────────────

describe('AmbiguityControlSchema', () => {
  it('parses a range_selector', () => {
    const ctrl = {
      type: 'range_selector', id: 'price', label: 'Price weight',
      min: 0, max: 1, step: 0.1, value: 0.5, parameterKey: 'priceWeight',
    };
    expect(RangeSelectorSchema.safeParse(ctrl).success).toBe(true);
  });

  it('parses a toggle', () => {
    const ctrl = {
      type: 'toggle', id: 'nonstop', label: 'Nonstop only',
      value: false, parameterKey: 'nonstopOnly',
    };
    expect(ToggleSchema.safeParse(ctrl).success).toBe(true);
  });

  it('parses a multi_select', () => {
    const ctrl = {
      type: 'multi_select', id: 'airlines', label: 'Airlines',
      options: [{ value: 'BA', label: 'British Airways' }],
      value: ['BA'], parameterKey: 'airlines',
    };
    expect(MultiSelectSchema.safeParse(ctrl).success).toBe(true);
  });

  it('parses a single_select', () => {
    const ctrl = {
      type: 'single_select', id: 'class', label: 'Cabin class',
      options: [{ value: 'economy', label: 'Economy' }],
      value: 'economy', parameterKey: 'cabinClass',
    };
    expect(SingleSelectSchema.safeParse(ctrl).success).toBe(true);
  });

  it('rejects unknown control type', () => {
    const ctrl = { type: 'color_picker', id: 'x', label: 'Color', value: '#f00', parameterKey: 'c' };
    expect(AmbiguityControlSchema.safeParse(ctrl).success).toBe(false);
  });
});

// ── AgentActionSchema ─────────────────────────────────────────────────────────

describe('AgentActionSchema', () => {
  it('parses a valid action with safety metadata', () => {
    const action = {
      id: 'book_flight', label: 'Book Flight',
      variant: 'primary' as const,
      safety: {
        confidence: 0.95, reversible: false,
        riskLevel: 'high' as const, requiresConfirmation: true,
      },
    };
    expect(AgentActionSchema.safeParse(action).success).toBe(true);
  });

  it('defaults variant to primary and disabled to false', () => {
    const result = AgentActionSchema.parse({ id: 'refresh', label: 'Refresh' });
    expect(result.variant).toBe('primary');
    expect(result.disabled).toBe(false);
  });

  it('safety.requiresConfirmation defaults to false', () => {
    const result = AgentActionSchema.parse({
      id: 'go', label: 'Go',
      safety: { confidence: 0.9, reversible: true, riskLevel: 'low' as const },
    });
    expect(result.safety!.requiresConfirmation).toBe(false);
  });
});

// ── ExplainabilityContextSchema ───────────────────────────────────────────────

describe('ExplainabilityContextSchema', () => {
  it('parses a valid explainability context', () => {
    const ctx = {
      elementId: 'price_card',
      summary: 'Ranked by price-to-comfort ratio',
    };
    expect(ExplainabilityContextSchema.safeParse(ctx).success).toBe(true);
  });

  it('populates array defaults on minimal input', () => {
    const result = ExplainabilityContextSchema.parse({
      elementId: 'x', summary: 'y',
    });
    expect(result.dataSources).toEqual([]);
    expect(result.assumptions).toEqual([]);
    expect(result.whatIfQueries).toEqual([]);
  });

  it('parses whatIfQueries when provided', () => {
    const result = ExplainabilityContextSchema.parse({
      elementId: 'x', summary: 'y',
      whatIfQueries: ['What if carbon is prioritised?'],
    });
    expect(result.whatIfQueries).toHaveLength(1);
  });

  it('rejects missing required fields', () => {
    // missing summary
    expect(ExplainabilityContextSchema.safeParse({ elementId: 'x' }).success).toBe(false);
    // missing elementId
    expect(ExplainabilityContextSchema.safeParse({ summary: 'y' }).success).toBe(false);
  });
});
