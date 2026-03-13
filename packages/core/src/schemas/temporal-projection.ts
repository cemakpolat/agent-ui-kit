import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────────────────
// Temporal Projection Schemas — Phase 4.2
//
// Temporal projections formalise forward-looking predictions about how metrics
// will evolve over time, with confidence bounds and counterfactual "what-if"
// alternative timelines.
//
//   ProjectionPoint      — a single time-value pair with optional CI
//   TemporalProjection   — a metric's projected trajectory over a time horizon
//   AlternativeTimeline  — a counterfactual trajectory under a different action
//   WhatIfScenario       — a "what-if" analysis with multiple alternatives
//
// Design principles:
//   - Confidence is first-class; every projection carries uncertainty bounds
//   - Counterfactuals are explicit, not implicit
//   - Recommended actions are surfaced with the evidence that supports them
//   - Machine-readable + human-explainable
// ─────────────────────────────────────────────────────────────────────────────

// ── Building blocks ───────────────────────────────────────────────────────────

export const ConfidenceIntervalSchema = z.object({
  /** Lower bound of the confidence interval (same unit as prediction) */
  lower: z.number(),
  /** Upper bound of the confidence interval (same unit as prediction) */
  upper: z.number(),
  /** Confidence level (e.g. 0.95 = 95% CI) */
  level: z.number().min(0).max(1).default(0.95),
});

export type ConfidenceInterval = z.infer<typeof ConfidenceIntervalSchema>;

export const ProjectionPointSchema = z.object({
  /** ISO timestamp for this data point */
  timestamp: z.string(),

  /** Predicted (or actual) value at this timestamp */
  value: z.number(),

  /** Optional confidence interval around this prediction */
  ci: ConfidenceIntervalSchema.optional(),

  /**
   * True if this is a historical/actual observation rather than a prediction.
   * Used to differentiate the "past" portion of a projection chart.
   */
  isActual: z.boolean().optional(),
});

export type ProjectionPoint = z.infer<typeof ProjectionPointSchema>;

// ── Temporal projection (single metric trajectory) ────────────────────────────

export const ProjectionMethodSchema = z.enum([
  'linear_regression',
  'exponential_smoothing',
  'arima',
  'moving_average',
  'expert_estimate',
  'simulation',
]);

export type ProjectionMethod = z.infer<typeof ProjectionMethodSchema>;

export const TemporalProjectionSchema = z.object({
  /** Unique identifier */
  projectionId: z.string(),

  /** Human-readable metric name (e.g. "Replication Lag") */
  metric: z.string(),

  /** Physical unit of the metric (e.g. "ms", "req/s", "%") */
  unit: z.string(),

  /** ISO timestamp when this projection was generated */
  generatedAt: z.string(),

  /** ISO timestamp that is the baseline (now or most recent observation) */
  baselineAt: z.string(),

  /** ISO timestamp of the projection horizon (furthest future point) */
  horizon: z.string(),

  /** Ordered time-series data: historical actuals followed by predictions */
  points: z.array(ProjectionPointSchema),

  /** Overall confidence in this projection (0-1) */
  confidence: z.number().min(0).max(1),

  /** Algorithm used to compute predictions */
  method: ProjectionMethodSchema,

  /** Human-readable summary of what the projection implies */
  summary: z.string().optional(),

  /** Tags for grouping / filtering */
  tags: z.array(z.string()).default([]),
});

export type TemporalProjection = z.infer<typeof TemporalProjectionSchema>;

// ── Alternative timeline (counterfactual) ────────────────────────────────────

export const AlternativeTimelineSchema = z.object({
  /** Unique identifier */
  timelineId: z.string(),

  /** Short label for the alternative (e.g. "Restart replica now") */
  label: z.string(),

  /** Description of the action or change this timeline assumes */
  actionDescription: z.string(),

  /** Projected trajectory under this alternative */
  points: z.array(ProjectionPointSchema),

  /** Human-readable description of the projected outcome */
  outcomeDescription: z.string(),

  /** Estimated probability that this outcome materialises (0-1) */
  probability: z.number().min(0).max(1),

  /** Confidence in the probability estimate (0-1) */
  confidence: z.number().min(0).max(1).optional(),

  /** Risk level of this alternative */
  riskLevel: z.enum(['low', 'medium', 'high', 'critical']).optional(),

  /** If true, this timeline is recommended by the system */
  isRecommended: z.boolean().optional(),
});

export type AlternativeTimeline = z.infer<typeof AlternativeTimelineSchema>;

// ── What-If scenario (multi-alternative comparison) ──────────────────────────

export const WhatIfScenarioSchema = z.object({
  /** Unique identifier */
  scenarioId: z.string(),

  /** Human-readable question this scenario answers */
  question: z.string(),

  /** The metric being explored */
  metric: z.string(),
  unit: z.string(),

  /** The baseline (no-action) trajectory */
  baseline: TemporalProjectionSchema.optional(),

  /** Alternative timelines — one per possible action */
  alternatives: z.array(AlternativeTimelineSchema),

  /** timelineId of the recommended alternative (if any) */
  recommendedTimelineId: z.string().optional(),

  /** Overall confidence in the scenario analysis (0-1) */
  analysisConfidence: z.number().min(0).max(1),

  /** ISO timestamp when this analysis was performed */
  analysedAt: z.string(),

  /** Caveats or limitations of this analysis */
  caveats: z.array(z.string()).default([]),
});

export type WhatIfScenario = z.infer<typeof WhatIfScenarioSchema>;

// ── Helper functions ──────────────────────────────────────────────────────────

/**
 * Returns the recommended alternative timeline from a what-if scenario.
 * Returns undefined if none is flagged as recommended.
 */
export function getRecommendedTimeline(
  scenario: WhatIfScenario,
): AlternativeTimeline | undefined {
  if (scenario.recommendedTimelineId) {
    return scenario.alternatives.find(
      (a) => a.timelineId === scenario.recommendedTimelineId,
    );
  }
  return scenario.alternatives.find((a) => a.isRecommended);
}

/**
 * Returns the latest predicted (non-actual) value in a projection.
 */
export function getLatestPrediction(projection: TemporalProjection): number | undefined {
  const predicted = [...projection.points].reverse().find((p) => !p.isActual);
  return predicted?.value;
}

/**
 * Returns the latest actual value in a projection.
 */
export function getLatestActual(projection: TemporalProjection): number | undefined {
  const actual = [...projection.points].reverse().find((p) => p.isActual === true);
  return actual?.value;
}

/**
 * Returns the projected change (latest predicted − latest actual), or undefined.
 */
export function getProjectedChange(projection: TemporalProjection): number | undefined {
  const latest = getLatestPrediction(projection);
  const baseline = getLatestActual(projection);
  if (latest === undefined || baseline === undefined) return undefined;
  return latest - baseline;
}

/**
 * Returns alternatives sorted by probability descending.
 */
export function sortAlternativesByProbability(
  alternatives: AlternativeTimeline[],
): AlternativeTimeline[] {
  return [...alternatives].sort((a, b) => b.probability - a.probability);
}
