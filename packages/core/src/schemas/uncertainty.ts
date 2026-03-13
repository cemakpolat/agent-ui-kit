import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────────────────
// Uncertainty Schema — Making the Unknown Visible
//
// Agents will never have perfect information.  Hiding uncertainty destroys
// trust.  HARI mandates that uncertainty is *always* visible, not optional.
//
// This schema provides a unified uncertainty model that can be attached to
// any data element: chart points, table cells, document paragraphs, metrics,
// sensor readings, or entire views.
//
// Types of uncertainty:
//   - Statistical:  confidence intervals, standard deviations
//   - Epistemic:    things the agent knows it doesn't know
//   - Temporal:     data staleness, prediction horizon decay
//   - Source:       reliability of underlying data sources
//
// UI rendering rules:
//   1. Confidence < 0.5 → mandatory warning indicator
//   2. Unknown values → explicit "Unknown" label, never blank
//   3. Assumptions → always surfaceable (click to expand)
//   4. Stale data → visual degradation (desaturation, timestamp badge)
// ─────────────────────────────────────────────────────────────────────────────

export const UncertaintyTypeSchema = z.enum([
  'statistical',   // Quantitative confidence interval
  'epistemic',     // Knowledge gap
  'temporal',      // Data freshness / prediction decay
  'source',        // Source reliability
  'aggregated',    // Combined from multiple sources
]);

export type UncertaintyType = z.infer<typeof UncertaintyTypeSchema>;

/**
 * Uncertainty indicator for a single data element.
 */
export const UncertaintyIndicatorSchema = z.object({
  /** The data element this uncertainty applies to */
  elementId: z.string(),

  /** Type of uncertainty */
  type: UncertaintyTypeSchema,

  /** Confidence level (0–1). 1 = certain, 0 = unknown */
  confidence: z.number().min(0).max(1),

  /** Statistical confidence interval (for quantitative data) */
  confidenceInterval: z.object({
    low: z.number(),
    high: z.number(),
    level: z.number().min(0).max(1).default(0.95), // e.g., 95% CI
  }).optional(),

  /** Human-readable explanation of the uncertainty */
  explanation: z.string().optional(),

  /** Whether this value is assumed vs. measured vs. estimated */
  valueOrigin: z.enum([
    'measured',   // Directly observed
    'calculated', // Derived from measurements
    'estimated',  // Best guess based on partial data
    'assumed',    // Default assumption, not validated
    'unknown',    // Cannot determine origin
  ]).default('measured'),

  /** Data freshness — how old is the underlying data? */
  dataAge: z.object({
    /** ISO 8601 timestamp of when the data was last updated */
    lastUpdated: z.string().datetime(),
    /** Is this data considered stale by the agent? */
    isStale: z.boolean().default(false),
    /** ISO 8601 duration for expected refresh interval */
    expectedRefreshInterval: z.string().optional(),
  }).optional(),
});

export type UncertaintyIndicator = z.infer<typeof UncertaintyIndicatorSchema>;

/**
 * View-level uncertainty summary.
 * Attached to a SituationalView to provide an overall uncertainty profile.
 */
export const UncertaintySummarySchema = z.object({
  /** Overall confidence of the view (0–1) */
  overallConfidence: z.number().min(0).max(1),

  /** Things the agent knows it does not know */
  knownUnknowns: z.array(z.string()).default([]),

  /** Assumptions the agent is making — always visible */
  assumptions: z.array(z.object({
    /** What is assumed */
    assumption: z.string(),
    /** How critical this assumption is to the view's validity */
    criticality: z.enum(['low', 'medium', 'high', 'critical']),
    /** What would happen if this assumption is wrong */
    impactIfWrong: z.string().optional(),
  })).default([]),

  /** Per-element uncertainty indicators */
  indicators: z.array(UncertaintyIndicatorSchema).default([]),

  /** How many data points in this view have low confidence (< 0.5) */
  lowConfidenceCount: z.number().int().min(0).default(0),

  /** Elements with unknown or assumed values */
  unknownElements: z.array(z.string()).default([]),
});

export type UncertaintySummary = z.infer<typeof UncertaintySummarySchema>;
export type UncertaintySummaryInput = z.input<typeof UncertaintySummarySchema>;

// ── UI Rendering Rules ──────────────────────────────────────────────────────

export type UncertaintyVisualLevel = 'confident' | 'moderate' | 'low' | 'unknown';

/**
 * Map a confidence value to a visual uncertainty level.
 * Used by renderers to determine how to display uncertainty.
 */
export function getUncertaintyLevel(confidence: number): UncertaintyVisualLevel {
  if (confidence >= 0.8) return 'confident';
  if (confidence >= 0.5) return 'moderate';
  if (confidence > 0) return 'low';
  return 'unknown';
}

/**
 * Check whether a view has critical uncertainty that should be highlighted.
 */
export function hasCriticalUncertainty(summary: UncertaintySummary): boolean {
  return (
    summary.overallConfidence < 0.5 ||
    summary.assumptions.some((a) => a.criticality === 'critical') ||
    summary.lowConfidenceCount > 0 ||
    summary.unknownElements.length > 0
  );
}

/**
 * Get assumptions sorted by criticality (most critical first).
 */
export function getAssumptionsByCriticality(
  summary: UncertaintySummary
): UncertaintySummary['assumptions'] {
  const order = { critical: 0, high: 1, medium: 2, low: 3 };
  return [...summary.assumptions].sort(
    (a, b) => order[a.criticality] - order[b.criticality]
  );
}

// ── Phase 4.3: Uncertainty Aggregation Helpers ────────────────────────────────

/**
 * Applies exponential half-life decay to a confidence score based on data age.
 *
 * Uses the formula:  C_decayed = C * 0.5^(ageMs / halfLifeMs)
 *
 * @param confidence  Baseline confidence [0, 1]
 * @param ageMs       How old the data is, in milliseconds
 * @param halfLifeMs  Half-life constant — time (ms) after which confidence halves
 * @returns           Decayed confidence clamped to [0, 1]
 */
export function decayConfidence(
  confidence: number,
  ageMs: number,
  halfLifeMs: number,
): number {
  if (halfLifeMs <= 0) return 0;
  if (ageMs <= 0) return Math.max(0, Math.min(1, confidence));
  const decayFactor = Math.pow(0.5, ageMs / halfLifeMs);
  return Math.max(0, Math.min(1, confidence * decayFactor));
}

/**
 * Computes a sensitivity score [0, 1] indicating how sensitive the view's
 * conclusions are to its current assumptions.  Higher = more sensitive.
 *
 * Weights: critical=1.0, high=0.7, medium=0.4, low=0.2
 */
export function computeSensitivity(summary: UncertaintySummary): number {
  if (summary.assumptions.length === 0) return 0;
  const weights: Record<string, number> = {
    critical: 1.0,
    high: 0.7,
    medium: 0.4,
    low: 0.2,
  };
  const totalWeight = summary.assumptions.reduce(
    (acc, a) => acc + (weights[a.criticality] ?? 0),
    0,
  );
  const maxPossible = summary.assumptions.length * weights.critical;
  return maxPossible > 0 ? totalWeight / maxPossible : 0;
}

/**
 * Recommends which known unknown or assumption to resolve next, based on
 * criticality and the number of unknowns.
 *
 * Resolution order: critical assumptions → high assumptions → known unknowns
 *
 * @returns A human-readable instruction string, or undefined if nothing to do
 */
export function recommendNextQuestion(
  summary: UncertaintySummary,
  _context?: string,
): string | undefined {
  const sorted = getAssumptionsByCriticality(summary);
  const critical = sorted.find((a) => a.criticality === 'critical');
  if (critical) return `Clarify: ${critical.assumption}`;

  const high = sorted.find((a) => a.criticality === 'high');
  if (high) return `Clarify: ${high.assumption}`;

  if (summary.knownUnknowns.length > 0) {
    return `Investigate: ${summary.knownUnknowns[0]}`;
  }

  return undefined;
}
