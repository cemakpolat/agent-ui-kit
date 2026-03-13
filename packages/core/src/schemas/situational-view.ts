import { z } from 'zod';
import { IntentPayloadSchema } from './intent';

// ─────────────────────────────────────────────────────────────────────────────
// Situational View & Situational Perception
//
// HARI's perception model has two layers:
//
//   SituationalView       — the rendered perception unit (one question → one view)
//   SituationalPerception — the top-level submission from the agent, which is the
//                           canonical entry point for the render pipeline.
//
// Rule: the render pipeline only accepts SituationalPerception as its top-level
// input.  SituationalView is always nested inside it.
//
// A SituationalView wraps an intent payload with the *context that makes it
// meaningful*:
//
//   - What question is being answered?                 (required — no question = no view)
//   - How confident is the agent in this answer?
//   - When does this view expire or become stale?      (expiresAt OR invalidationCondition required)
//   - What scope of systems/time/risk does it cover?
//
// Existing components become *renderers* of Situational Views.  Views appear
// and disappear based on relevance — preventing "dashboard creep" and
// enforcing just-in-time perception.
//
// Design rules:
//   1. Every view must answer a question (implicit or explicit)
//   2. Views have lifespans — stale views MUST degrade or vanish
//   3. Scope is always explicit — the human knows what they're seeing
//   4. Confidence is never hidden
//   5. No SituationalPerception without a clear invalidation condition
// ─────────────────────────────────────────────────────────────────────────────

export const ViewScopeSchema = z.object({
  /** Systems or domains this view covers */
  systems: z.array(z.string()).min(1),
  /** ISO 8601 duration or absolute window: how far back/forward this view sees */
  timeWindow: z.string().optional(),
  /** Risk level the view is calibrated for */
  riskLevel: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  /** Geographic or logical boundary */
  boundary: z.string().optional(),
  /** Organizational scope */
  orgScope: z.enum(['self', 'team', 'department', 'org', 'global']).optional(),
});

export type ViewScope = z.infer<typeof ViewScopeSchema>;

export const ViewStatusSchema = z.enum([
  'active',      // Currently relevant and fresh
  'stale',       // Past expiration but still displayable with warning
  'expired',     // Should be removed or replaced
  'superseded',  // Replaced by a newer view
  'hypothetical', // Not reflecting real state — what-if mode
]);

export type ViewStatus = z.infer<typeof ViewStatusSchema>;

export const SituationalViewSchema = z.object({
  /** Unique identifier for this situational view */
  situationId: z.string().uuid(),

  /** The question this view answers — explicit or inferred */
  question: z.string().min(1),

  /** Agent's concise answer summary (one sentence) */
  answerSummary: z.string().optional(),

  /** Scope of perception: what systems, time, and risk this view covers */
  scope: ViewScopeSchema,

  /** Agent's overall confidence in this view as an adequate answer (0–1) */
  confidence: z.number().min(0).max(1),

  /** What the agent believes it does NOT know — mandatory transparency */
  unknowns: z.array(z.string()).default([]),

  /** Assumptions the agent is making in this view */
  assumptions: z.array(z.string()).default([]),

  /** ISO 8601 timestamp: when this view was generated */
  generatedAt: z.string().datetime(),

  /**
   * ISO 8601 timestamp: when this view should be considered stale.
   * At least one of `expiresAt` or `invalidationCondition` is required.
   */
  expiresAt: z.string().datetime().optional(),

  /**
   * A condition that, when true, invalidates this view — even before expiresAt.
   * Examples: "system metric drops below threshold", "incident resolved",
   *           "approval decision recorded".
   * At least one of `expiresAt` or `invalidationCondition` is required.
   */
  invalidationCondition: z.string().optional(),

  /** Current lifecycle status */
  status: ViewStatusSchema.default('active'),

  /** If superseded, the ID of the replacing view */
  supersededBy: z.string().uuid().optional(),

  /** Priority for display ordering (higher = more important) */
  priority: z.number().int().min(0).max(100).default(50),

  /** Tags for grouping and filtering views */
  tags: z.array(z.string()).default([]),

  /**
   * The render contract — your existing IntentPayload.
   * This is what actually gets compiled and rendered.
   */
  renderContract: IntentPayloadSchema,
}).refine(
  (v) => !!(v.expiresAt || v.invalidationCondition),
  {
    message: 'A SituationalView MUST declare either `expiresAt` or `invalidationCondition`. ' +
             'Perception without an invalidation condition is a permanent dashboard — that is forbidden.',
    path: ['expiresAt'],
  },
);

export type SituationalView = z.infer<typeof SituationalViewSchema>;
export type SituationalViewInput = z.input<typeof SituationalViewSchema>;

// ── SituationalPerception — Top-Level Render Pipeline Entry Point ───────────
//
// SituationalPerception is the canonical object submitted to the render
// pipeline.  It is the formal boundary between LLM output and HARI rendering.
//
// Rule: the render pipeline accepts ONLY SituationalPerception as its input.
//       Raw IntentPayloads and bare SituationalViews are rejected at the gate.
//
// Fields:
//   - perceptionId    unique identifier for this perception submission
//   - schemaVersion   enables forward-compat validation and migration
//   - originatingQuestion  the human question that drove this perception (required)
//   - view            the SituationalView to render
//   - questionId      links back to the QuestionIntent log entry
//   - submittedAt     ISO 8601 — when the agent submitted this perception
//   - agentId         which agent/model produced this
// ─────────────────────────────────────────────────────────────────────────────

export const SituationalPerceptionSchema = z.object({
  /** Unique identifier for this perception submission */
  perceptionId: z.string().uuid(),

  /** Semantic version of the perception contract schema (must match HARI's accepted range) */
  schemaVersion: z.string().regex(/^\d+\.\d+\.\d+$/, 'schemaVersion must follow semver: "1.0.0"'),

  /**
   * The originating human question — verbatim or closely paraphrased.
   * This MUST be a real question, not a summary or title.
   * Rejected values: empty string, generic phrases like "status update", "dashboard".
   */
  originatingQuestion: z.string()
    .min(10, 'originatingQuestion must be a real question (min 10 chars)')
    .refine(
      (q) => !/(^dashboard$|^status$|^overview$|^summary$)/i.test(q.trim()),
      { message: 'originatingQuestion cannot be a generic label — it must be a real question.' },
    ),

  /**
   * Scope declaration — which systems, time window, and risk level this perception covers.
   * The human must always know what they are perceiving.
   */
  scope: ViewScopeSchema,

  /**
   * The situational view to render.
   * Contains the render contract, confidence, unknowns, and expiration semantics.
   */
  view: SituationalViewSchema,

  /** Links back to the QuestionIntent log entry that spawned this perception */
  questionId: z.string().uuid().optional(),

  /** ISO 8601 timestamp — when the agent submitted this perception contract */
  submittedAt: z.string().datetime(),

  /** Identifier of the agent or model that produced this perception */
  agentId: z.string().optional(),

  /**
   * Evidence vs recommendation separation (Phase B requirement).
   * Agents MUST distinguish what they observed from what they recommend.
   */
  evidence: z.array(z.object({
    claim: z.string(),
    source: z.string(),
    confidence: z.number().min(0).max(1),
  })).default([]),

  recommendations: z.array(z.object({
    action: z.string(),
    rationale: z.string(),
    confidence: z.number().min(0).max(1),
  })).default([]),
});

export type SituationalPerception = z.infer<typeof SituationalPerceptionSchema>;
export type SituationalPerceptionInput = z.input<typeof SituationalPerceptionSchema>;

/**
 * Validate and parse a raw object as a SituationalPerception.
 * Returns a typed result with success flag — does not throw.
 */
export function parseSituationalPerception(raw: unknown): {
  success: true; data: SituationalPerception;
} | {
  success: false; errors: z.ZodError['errors'];
} {
  const result = SituationalPerceptionSchema.safeParse(raw);
  if (result.success) return { success: true, data: result.data };
  return { success: false, errors: result.error.errors };
}

/**
 * Assert that a raw object is a valid SituationalPerception.
 * Throws a descriptive error if validation fails.
 * Use in STRICT validation mode.
 */
export function assertSituationalPerception(raw: unknown): SituationalPerception {
  const result = SituationalPerceptionSchema.safeParse(raw);
  if (result.success) return result.data;
  const messages = result.error.errors.map((e) => `  [${e.path.join('.')}] ${e.message}`).join('\n');
  throw new Error(
    `SituationalPerception contract violation — HARI cannot render this output:\n${messages}\n` +
    `The LLM must be retrained or the prompt must be corrected to produce valid perception contracts.`,
  );
}

// ── View Lifecycle Helpers ──────────────────────────────────────────────────

/**
 * Check whether a view has expired based on its expiresAt timestamp.
 * Views with only invalidationCondition are considered non-expired until the
 * condition is evaluated externally and .status is set to 'expired'.
 */
export function isViewExpired(view: SituationalView): boolean {
  if (view.status === 'expired') return true;
  if (!view.expiresAt) return false;
  return new Date(view.expiresAt) < new Date();
}

/**
 * Check whether a view is stale (past expiration but within grace period).
 * Grace period defaults to 5 minutes.
 */
export function isViewStale(view: SituationalView, graceMs = 5 * 60 * 1000): boolean {
  if (!view.expiresAt) return false;
  const expiry = new Date(view.expiresAt).getTime();
  const now = Date.now();
  return now > expiry && now < expiry + graceMs;
}

/**
 * Compute the effective status of a view, factoring in time.
 */
export function computeViewStatus(view: SituationalView): ViewStatus {
  if (view.status === 'superseded' || view.status === 'hypothetical') {
    return view.status;
  }
  if (isViewExpired(view) && !isViewStale(view)) return 'expired';
  if (isViewStale(view)) return 'stale';
  return 'active';
}

/**
 * Sort views by priority (descending) then generatedAt (newest first).
 */
export function sortViews(views: SituationalView[]): SituationalView[] {
  return [...views].sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    return new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime();
  });
}
