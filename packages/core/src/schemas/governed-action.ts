import { z } from 'zod';
import { AgentActionSchema, BlastRadiusSchema, type AgentAction } from './action';
import { AuthorityModeSchema } from './authority';

// ─────────────────────────────────────────────────────────────────────────────
// Governed Action — Actions as Decisions, Not Buttons
//
// A GovernedAction wraps every agent-proposed action with governance metadata,
// turning buttons into auditable, governed decisions:
//
//   - What is the intent of this action?
//   - What is the scope of impact?
//   - Is it reversible?
//   - What authority level is required?
//   - What preconditions must be true?
//   - What is the decision record if approved?
//
// Rule: **No action without a GovernedAction wrapper.**
//
// This elevates actions from UI events to governance artifacts that can be
// audited, replayed, and analyzed.
// ─────────────────────────────────────────────────────────────────────────────

export const ReversibilitySchema = z.enum([
  'fully_reversible',     // Can be undone with no side effects
  'partially_reversible', // Some effects can be undone, some cannot
  'irreversible',         // Cannot be undone once executed
  'time_limited',         // Reversible within a time window
]);

export type Reversibility = z.infer<typeof ReversibilitySchema>;

export const PreconditionStatusSchema = z.enum([
  'met',       // Precondition is satisfied
  'unmet',     // Precondition is not satisfied — action blocked
  'unknown',   // Cannot determine — human must decide
  'waived',    // Explicitly waived (requires override authority)
]);

export type PreconditionStatus = z.infer<typeof PreconditionStatusSchema>;

export const PreconditionSchema = z.object({
  /** What must be true for this action to proceed */
  description: z.string(),
  /** Current status of this precondition */
  status: PreconditionStatusSchema,
  /** How the precondition was verified (or why it's unknown) */
  verificationMethod: z.string().optional(),
  /** If unmet, what would make it met */
  resolution: z.string().optional(),
});

export type Precondition = z.infer<typeof PreconditionSchema>;

export const GovernedActionSchema = z.object({
  /** The underlying agent action */
  action: AgentActionSchema,

  /**
   * The intent of this action — why is the agent proposing it?
   * Not the label; the reasoning behind the action.
   */
  intent: z.string(),

  /**
   * Impact scope — which systems, users, and services are affected.
   * Extends the existing BlastRadius with richer semantics.
   */
  impactScope: BlastRadiusSchema,

  /** Reversibility classification */
  reversibility: ReversibilitySchema,

  /**
   * If time_limited reversibility, how long is the reversal window?
   * ISO 8601 duration (e.g., "PT1H" = 1 hour).
   */
  reversalWindow: z.string().optional(),

  /** Minimum authority level required to approve this action */
  requiredAuthority: AuthorityModeSchema,

  /** Preconditions that must be satisfied before execution */
  preconditions: z.array(PreconditionSchema).default([]),

  /**
   * Agent's confidence that this action will achieve the stated intent (0–1).
   * Separate from the view confidence — this is action-specific.
   */
  actionConfidence: z.number().min(0).max(1),

  /** Alternative actions the agent considered and why it recommends this one */
  alternatives: z.array(z.object({
    description: z.string(),
    /** Why this alternative was not recommended */
    rejectionReason: z.string(),
  })).default([]),

  /** Tags for categorisation and filtering */
  tags: z.array(z.string()).default([]),
});

export type GovernedAction = z.infer<typeof GovernedActionSchema>;
export type GovernedActionInput = z.input<typeof GovernedActionSchema>;

// ── Authority Request — Preferred Terminology ────────────────────────────────
//
// "Authority Request" is the human-facing name for a GovernedAction.
// Where GovernedAction describes the technical wrapper, AuthorityRequest
// describes what it *means*: the agent is requesting human authority to act.
//
// Use AuthorityRequest in UI copy, documentation, and user-facing strings.
// Use GovernedAction in code.
//
export type AuthorityRequest = GovernedAction;
export type AuthorityRequestInput = GovernedActionInput;

/**
 * Metadata that MUST be surfaced in the UI alongside every Authority Request.
 * The human needs these three answers to govern deliberately — not just click.
 */
export const AuthorityRequestDisplaySchema = z.object({
  /** Who (role/authority level) must approve this request */
  approverDescription: z.string(),

  /**
   * Why escalation is required — in plain language.
   * Not just "high risk" — explain *what* makes it require human judgment.
   */
  escalationReason: z.string(),

  /**
   * What happens if this request is NOT approved.
   * Agents must declare what the alternative outcome is.
   * Acceptable: "Action will be deferred pending re-evaluation."
   * Not acceptable: empty string or "n/a".
   */
  unapprovedConsequence: z.string().min(10),
});

export type AuthorityRequestDisplay = z.infer<typeof AuthorityRequestDisplaySchema>;

// ── Decision Records ────────────────────────────────────────────────────────

export const DecisionOutcomeSchema = z.enum([
  'approved',   // Human approved the action
  'rejected',   // Human rejected the action
  'deferred',   // Human deferred the decision
  'modified',   // Human modified the action before approving
  'escalated',  // Human escalated to higher authority
  'expired',    // Decision window expired without action
]);

export type DecisionOutcome = z.infer<typeof DecisionOutcomeSchema>;

/**
 * A DecisionRecord is the governance artifact created when a human
 * interacts with a GovernedAction.  These form the audit trail.
 *
 * Generated automatically via `createDecisionRecord()`.
 * Linked to the SituationalPerception, SituationalView, and QuestionIntent
 * that provided the context for the decision.
 */
export const DecisionRecordSchema = z.object({
  /** Unique ID of this decision */
  decisionId: z.string().uuid(),

  /** The GovernedAction that was decided upon */
  governedActionId: z.string(),

  /** The situational view context in which this decision was made */
  situationId: z.string().uuid().optional(),

  /** The SituationalPerception submission that delivered this view */
  perceptionId: z.string().uuid().optional(),

  /** The QuestionIntent that triggered this perception */
  questionId: z.string().uuid().optional(),

  /** What the human decided */
  outcome: DecisionOutcomeSchema,

  /** Authority level of the decider at the time of decision */
  decidedAt: AuthorityModeSchema,

  /** Who made the decision */
  deciderId: z.string(),

  /** ISO 8601 timestamp */
  timestamp: z.string().datetime(),

  /** Human's reasoning for the decision (required for reject/override) */
  rationale: z.string().optional(),

  /** If modified, what was changed */
  modifications: z.record(z.string(), z.unknown()).optional(),

  /** Time spent deliberating (ms) — from view presentation to decision */
  deliberationTimeMs: z.number().int().min(0).optional(),
});

export type DecisionRecord = z.infer<typeof DecisionRecordSchema>;

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Check whether all preconditions for a GovernedAction are met.
 */
export function arePreconditionsMet(action: GovernedAction): boolean {
  return action.preconditions.every(
    (p) => p.status === 'met' || p.status === 'waived'
  );
}

/**
 * Get unmet preconditions for a GovernedAction.
 */
export function getUnmetPreconditions(action: GovernedAction): Precondition[] {
  return action.preconditions.filter((p) => p.status === 'unmet');
}

/**
 * Get unknown preconditions that require human judgment.
 */
export function getUnknownPreconditions(action: GovernedAction): Precondition[] {
  return action.preconditions.filter((p) => p.status === 'unknown');
}

/**
 * Wrap an existing AgentAction into a GovernedAction with sensible defaults.
 * Use this for backward compatibility during migration.
 */
export function wrapAsGovernedAction(
  agentAction: AgentAction,
  overrides?: Partial<GovernedActionInput>
): GovernedActionInput {
  const safety = agentAction.safety;
  return {
    action: agentAction,
    intent: agentAction.description || agentAction.label,
    impactScope: safety?.blastRadius || {
      scope: 'self',
      affectedSystems: [],
    },
    reversibility: safety?.reversible ? 'fully_reversible' : 'irreversible',
    requiredAuthority: safety?.riskLevel === 'critical' || safety?.riskLevel === 'high'
      ? 'approve'
      : safety?.requiresConfirmation
        ? 'intervene'
        : 'observe',
    preconditions: [],
    actionConfidence: safety?.confidence ?? 0.5,
    alternatives: [],
    tags: [],
    ...overrides,
  };
}

// ── Decision Record Auto-Generation ─────────────────────────────────────────
//
// createDecisionRecord() auto-generates a full DecisionRecord linked to the
// perception context in which the decision occurred.
//
// Usage:
//   const record = createDecisionRecord({
//     governedAction,
//     outcome: 'approved',
//     deciderId: currentUser.id,
//     authorityMode: 'approve',
//     situationId: view.situationId,
//     perceptionId: perception.perceptionId,
//     questionId: question.questionId,
//     deliberationStartMs: presentationTimestamp,
//   });
// ─────────────────────────────────────────────────────────────────────────────

export interface CreateDecisionRecordOptions {
  governedAction: GovernedAction;
  outcome: DecisionOutcome;
  deciderId: string;
  authorityMode: import('./authority').AuthorityMode;
  situationId?: string;
  perceptionId?: string;
  questionId?: string;
  rationale?: string;
  modifications?: Record<string, unknown>;
  /** Timestamp (ms) when the view was first presented to the human */
  deliberationStartMs?: number;
}

/**
 * Auto-generate a DecisionRecord from a governed action decision,
 * linking it to the full perception context.
 *
 * Outcomes 'rejected' and 'escalated' without a rationale emit a console
 * warning — a human who cannot explain their decision has not deliberated.
 */
export function createDecisionRecord(opts: CreateDecisionRecordOptions): DecisionRecord {
  const now = new Date().toISOString();
  const deliberationTimeMs =
    opts.deliberationStartMs != null
      ? Math.max(0, Date.now() - opts.deliberationStartMs)
      : undefined;

  if (
    (opts.outcome === 'rejected' || opts.outcome === 'escalated') &&
    !opts.rationale
  ) {
    console.warn(
      `[HARI] DecisionRecord for outcome="${opts.outcome}" created without a rationale. ` +
      `A human who cannot explain their decision has not truly deliberated. ` +
      `Please require rationale in the UI for reject/escalate outcomes.`,
    );
  }

  return {
    decisionId: globalThis.crypto?.randomUUID?.() ?? `dr-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    governedActionId: opts.governedAction.action.id,
    situationId: opts.situationId,
    perceptionId: opts.perceptionId,
    questionId: opts.questionId,
    outcome: opts.outcome,
    decidedAt: opts.authorityMode,
    deciderId: opts.deciderId,
    timestamp: now,
    rationale: opts.rationale,
    modifications: opts.modifications,
    deliberationTimeMs,
  };
}

/**
 * Guard that blocks approval on a view that has expired.
 * Calling this before `createDecisionRecord` with outcome='approved'
 * prevents humans from acting on outdated perception.
 */
export function assertPerceptionNotExpired(view: {
  status?: string;
  expiresAt?: string | null;
}): void {
  if (view.status === 'expired') {
    throw new Error(
      '[HARI] Approval blocked — the situational view has expired. ' +
      'The human must receive a fresh perception before approving.',
    );
  }
  if (view.expiresAt && new Date(view.expiresAt) < new Date()) {
    throw new Error(
      `[HARI] Approval blocked — the perception expired at ${view.expiresAt}. ` +
      'Stale perception cannot be approved.',
    );
  }
}