import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────────────────
// Temporal Lens — Making Time a Visible Dimension
//
// Every situational view can be examined through three temporal lenses:
//
//   NOW     — Current state of the system
//   BEFORE  — What changed to produce this state
//   AFTER   — What will happen if the proposed action is approved
//
// Temporal lenses dramatically increase trust because they answer the
// three questions humans always implicitly ask:
//   "What's happening?"  → NOW
//   "How did we get here?" → BEFORE
//   "What happens next?" → AFTER
//
// Implementation strategy: annotate existing documents, charts, and tables
// with temporal metadata.  No new components needed initially — the existing
// renderers gain time-awareness through these annotations.
// ─────────────────────────────────────────────────────────────────────────────

export const TemporalLensTypeSchema = z.enum(['now', 'before', 'after']);
export type TemporalLensType = z.infer<typeof TemporalLensTypeSchema>;

export const ChangeTypeSchema = z.enum([
  'added',      // New element appeared
  'removed',    // Element was removed
  'modified',   // Element changed value
  'unchanged',  // Explicitly unchanged (for context)
  'projected',  // Predicted future state
]);

export type ChangeType = z.infer<typeof ChangeTypeSchema>;

/**
 * A temporal annotation on any data element.
 * Attach to chart points, table rows, document sections, metric cards, etc.
 */
export const TemporalAnnotationSchema = z.object({
  /** The data key or element ID this annotation applies to */
  elementId: z.string(),

  /** What kind of temporal change occurred */
  changeType: ChangeTypeSchema,

  /** Value before the change (for 'modified' and 'removed') */
  previousValue: z.unknown().optional(),

  /** Value after the change (for 'modified' and 'added') */
  currentValue: z.unknown().optional(),

  /** Projected future value (for 'projected') */
  projectedValue: z.unknown().optional(),

  /** ISO 8601 timestamp of when the change occurred or is projected */
  timestamp: z.string().datetime().optional(),

  /** Human-readable explanation of the change */
  explanation: z.string().optional(),

  /** Confidence in projection (0–1), only for 'projected' type */
  projectionConfidence: z.number().min(0).max(1).optional(),

  /** What causes this projection — the causal chain */
  causalFactors: z.array(z.string()).default([]),
});

export type TemporalAnnotation = z.infer<typeof TemporalAnnotationSchema>;

/**
 * A TemporalLens wraps a view's data with before/after/projected context.
 * Attached to a SituationalView to enable time-travel perception.
 */
export const TemporalLensSchema = z.object({
  /** Which lens is currently active */
  activeLens: TemporalLensTypeSchema.default('now'),

  /** Available lenses for this view (not all views have all lenses) */
  availableLenses: z.array(TemporalLensTypeSchema).default(['now']),

  /** Annotations per temporal lens */
  annotations: z.object({
    /** NOW: highlights what's notable about the current state */
    now: z.array(TemporalAnnotationSchema).default([]),
    /** BEFORE: what changed to produce the current state */
    before: z.array(TemporalAnnotationSchema).default([]),
    /** AFTER: what will happen if approved / projected future */
    after: z.array(TemporalAnnotationSchema).default([]),
  }).default({ now: [], before: [], after: [] }),

  /**
   * Reference timestamps for each lens.
   * BEFORE: the point in time being compared against.
   * AFTER: how far into the future the projection extends.
   */
  referencePoints: z.object({
    beforeTimestamp: z.string().datetime().optional(),
    afterHorizon: z.string().optional(), // ISO 8601 duration (e.g., "PT1H", "P7D")
  }).default({}),

  /** Summary of changes between lenses */
  changeSummary: z.object({
    /** One-sentence summary of what changed (BEFORE → NOW) */
    whatChanged: z.string().optional(),
    /** One-sentence summary of what will happen (NOW → AFTER) */
    whatWillHappen: z.string().optional(),
    /** Number of elements affected */
    affectedCount: z.number().int().min(0).optional(),
  }).default({}),
});

export type TemporalLens = z.infer<typeof TemporalLensSchema>;
export type TemporalLensInput = z.input<typeof TemporalLensSchema>;

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Filter annotations for a specific lens.
 */
export function getAnnotationsForLens(
  lens: TemporalLens,
  type: TemporalLensType
): TemporalAnnotation[] {
  return lens.annotations[type];
}

/**
 * Count the number of changes of each type across all lenses.
 */
export function countChanges(lens: TemporalLens): Record<ChangeType, number> {
  const counts: Record<ChangeType, number> = {
    added: 0,
    removed: 0,
    modified: 0,
    unchanged: 0,
    projected: 0,
  };

  for (const lensType of ['now', 'before', 'after'] as const) {
    for (const annotation of lens.annotations[lensType]) {
      counts[annotation.changeType]++;
    }
  }

  return counts;
}

/**
 * Check whether a temporal lens has meaningful BEFORE/AFTER context
 * (i.e., it's not just a NOW-only view).
 */
export function hasTemporalContext(lens: TemporalLens): boolean {
  return lens.availableLenses.length > 1;
}
