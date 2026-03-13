import { z } from 'zod';
import { AuthorityModeSchema } from './authority';

// ─────────────────────────────────────────────────────────────────────────────
// Approval Workflow Schemas — Phase 4.1
//
// Approval workflows formalise multi-level, conditional, and delegated
// decision chains for governed actions:
//
//   ApprovalStep      — one approver in a sequential chain
//   ApprovalChain     — the full ordered list of steps (multi-level approval)
//   ApprovalDelegate  — delegation of approval right from one holder to another
//   ConditionalApproval — conditions that must hold for approval to be valid
//   WorkflowExpiry    — time-bound validity and what happens when it lapses
//
// Design principles:
//   - Every approval is auditable: who, when, why, under what conditions
//   - Delegation is explicit and scoped — proxies are always visible
//   - Expiry is first-class: no stale approvals silently accepted
//   - Conditions are machine-readable and human-explainable
// ─────────────────────────────────────────────────────────────────────────────

// ── Step status ───────────────────────────────────────────────────────────────

export const ApprovalStepStatusSchema = z.enum([
  'pending',    // Waiting for this approver to act
  'approved',   // This step approved
  'rejected',   // This step rejected — chain halted
  'delegated',  // Approver delegated to another party
  'expired',    // Approver did not act before deadline
  'skipped',    // Step conditionally skipped (conditions not required at level)
]);

export type ApprovalStepStatus = z.infer<typeof ApprovalStepStatusSchema>;

// ── Individual step ───────────────────────────────────────────────────────────

export const ApprovalStepSchema = z.object({
  /** Unique identifier for this step */
  stepId: z.string(),

  /** Ordinal position in the chain (1-indexed) */
  position: z.number().int().positive(),

  /** Identifier of the required approver */
  approverId: z.string(),

  /** Human-readable name of the required approver */
  approverName: z.string(),

  /** Minimum authority level the approver must hold */
  requiredAuthority: AuthorityModeSchema,

  /** Current lifecycle status of this step */
  status: ApprovalStepStatusSchema,

  /** ISO timestamp when a decision was made */
  decidedAt: z.string().optional(),

  /** Free-text rationale for the decision */
  rationale: z.string().optional(),

  /** Conditions that were evaluated at this step */
  evaluatedConditions: z.array(z.string()).optional(),

  /** If delegated, who the approval was delegated to */
  delegatedTo: z.string().optional(),

  /** Deadline for this step (ISO timestamp) */
  deadline: z.string().optional(),
});

export type ApprovalStep = z.infer<typeof ApprovalStepSchema>;

// ── Multi-level chain ─────────────────────────────────────────────────────────

export const ApprovalChainStatusSchema = z.enum([
  'pending',    // Not all required steps complete
  'approved',   // All required steps approved — chain complete
  'rejected',   // At least one step rejected — chain halted
  'expired',    // Chain overall deadline exceeded before completion
  'cancelled',  // Manually cancelled
]);

export type ApprovalChainStatus = z.infer<typeof ApprovalChainStatusSchema>;

export const ApprovalChainSchema = z.object({
  /** Unique chain identifier */
  chainId: z.string(),

  /** The governed action this chain authorises */
  governedActionId: z.string(),

  /** Ordered list of approval steps */
  steps: z.array(ApprovalStepSchema),

  /** How many steps must approve for the chain to succeed (default: all) */
  requiredApprovals: z.number().int().positive().optional(),

  /** Overall chain status (derived from steps, but stored for quick lookup) */
  status: ApprovalChainStatusSchema,

  /** ISO timestamp when the chain was initiated */
  createdAt: z.string(),

  /** ISO timestamp by which the full chain must complete */
  expiresAt: z.string().optional(),

  /** ISO timestamp when the chain reached a terminal state */
  completedAt: z.string().optional(),

  /** Overall rationale or context for this chain */
  context: z.string().optional(),
});

export type ApprovalChain = z.infer<typeof ApprovalChainSchema>;

// ── Delegation ────────────────────────────────────────────────────────────────

export const ApprovalDelegateSchema = z.object({
  /** Unique delegation record identifier */
  delegateId: z.string(),

  /** The person delegating their authority */
  fromApproverId: z.string(),
  fromApproverName: z.string(),

  /** The person receiving the delegated authority */
  toApproverId: z.string(),
  toApproverName: z.string(),

  /**
   * Scope: which authority level is being delegated.
   * A delegate cannot grant more authority than they hold.
   */
  scope: AuthorityModeSchema,

  /** Free-text reason for the delegation */
  reason: z.string().optional(),

  /** ISO timestamp when delegation was created */
  createdAt: z.string(),

  /** ISO timestamp when delegation expires (if time-limited) */
  expiresAt: z.string().optional(),

  /** Whether this delegation is currently active */
  isActive: z.boolean().default(true),
});

export type ApprovalDelegate = z.infer<typeof ApprovalDelegateSchema>;

// ── Conditional approval ──────────────────────────────────────────────────────

export const ConditionalApprovalSchema = z.object({
  /** Unique condition identifier */
  conditionId: z.string(),

  /** Human-readable description of the condition */
  description: z.string(),

  /**
   * Machine-readable condition expression.
   * Example: "traffic_rate < 1000 && error_rate < 0.01"
   */
  expression: z.string(),

  /** Whether this condition is currently satisfied */
  isSatisfied: z.boolean(),

  /** Severity if this condition lapses during execution */
  severity: z.enum(['blocking', 'warning', 'informational']),

  /** ISO timestamp when this condition was last evaluated */
  evaluatedAt: z.string().optional(),

  /** Measured value at evaluation time (for display) */
  currentValue: z.string().optional(),

  /** Threshold value for comparison (for display) */
  threshold: z.string().optional(),
});

export type ConditionalApproval = z.infer<typeof ConditionalApprovalSchema>;

// ── Workflow expiry policy ────────────────────────────────────────────────────

export const WorkflowExpirySchema = z.object({
  /** ISO timestamp when the approval lapses */
  expiresAt: z.string(),

  /** Notify this many milliseconds before expiry (optional) */
  notifyBeforeMs: z.number().nonnegative().optional(),

  /** What happens when expiry is reached */
  action: z.enum(['void', 'escalate', 'auto_reject']),

  /** If action is 'escalate', who to escalate to */
  escalationTarget: z.string().optional(),
});

export type WorkflowExpiry = z.infer<typeof WorkflowExpirySchema>;

// ── Helper functions ──────────────────────────────────────────────────────────

/**
 * Returns the current active step in an approval chain (first 'pending' step).
 * Returns undefined if no pending step exists.
 */
export function getActiveStep(chain: ApprovalChain): ApprovalStep | undefined {
  return chain.steps.find((s) => s.status === 'pending');
}

/**
 * Returns true if all required approvals have been obtained for the chain.
 */
export function isChainApproved(chain: ApprovalChain): boolean {
  const required = chain.requiredApprovals ?? chain.steps.length;
  const approvedCount = chain.steps.filter(
    (s) => s.status === 'approved' || s.status === 'skipped',
  ).length;
  return approvedCount >= required && !chain.steps.some((s) => s.status === 'rejected');
}

/**
 * Returns true if any step in the chain has been rejected.
 */
export function isChainRejected(chain: ApprovalChain): boolean {
  return chain.steps.some((s) => s.status === 'rejected');
}

/**
 * Returns steps that are completed (any terminal status).
 */
export function getCompletedSteps(chain: ApprovalChain): ApprovalStep[] {
  return chain.steps.filter(
    (s) => s.status !== 'pending',
  );
}

/**
 * Returns true if a delegation is currently valid (active and not expired).
 */
export function isDelegationActive(delegate: ApprovalDelegate): boolean {
  if (!delegate.isActive) return false;
  if (!delegate.expiresAt) return true;
  return new Date(delegate.expiresAt).getTime() > Date.now();
}

/**
 * Returns all conditions that must be satisfied and currently are not.
 */
export function getUnsatisfiedConditions(
  conditions: ConditionalApproval[],
): ConditionalApproval[] {
  return conditions.filter((c) => !c.isSatisfied && c.severity === 'blocking');
}
