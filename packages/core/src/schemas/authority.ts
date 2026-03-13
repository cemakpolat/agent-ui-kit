import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────────────────
// Human Authority Modes
//
// Not "roles" — these are cognitive authority levels that determine what a
// human can perceive and do at any given moment.  Authority modes prevent:
//
//   - Accidental approvals (can't approve in Observe mode)
//   - UI overload (each mode surfaces only what's relevant)
//   - Governance ambiguity (every action has a required authority level)
//
// Authority modes map naturally to the existing density system:
//
//   Observe   → Executive density  (see outcomes, no controls)
//   Intervene → Operator density   (modify constraints, adjust parameters)
//   Approve   → Operator+ density  (authorize actions, confirm decisions)
//   Override  → Expert density     (emergency control, full access)
//
// The key insight: authority is not about *who you are* but *what you are
// doing right now*.  A CTO in Observe mode has the same view as a junior
// SRE in Observe mode.  Authority escalation is explicit and audited.
// ─────────────────────────────────────────────────────────────────────────────

export const AuthorityModeSchema = z.enum([
  'observe',    // Read-only perception — see the state, no controls
  'intervene',  // Modify constraints — adjust parameters, filters, thresholds
  'approve',    // Authorize actions — confirm proposed agent actions
  'override',   // Emergency control — bypass normal governance, full access
]);

export type AuthorityMode = z.infer<typeof AuthorityModeSchema>;

/**
 * Authority hierarchy (indexed by escalation level).
 * Higher index = more authority.
 */
export const AUTHORITY_HIERARCHY: AuthorityMode[] = [
  'observe',
  'intervene',
  'approve',
  'override',
];

/**
 * Mapping from authority modes to recommended density modes.
 * This formalizes the relationship between what you can do and what you see.
 */
export const AUTHORITY_DENSITY_MAP: Record<AuthorityMode, string> = {
  observe: 'executive',
  intervene: 'operator',
  approve: 'operator',
  override: 'expert',
};

export const AuthorityEscalationReasonSchema = z.enum([
  'scheduled_maintenance',   // Pre-planned escalation
  'incident_response',       // Responding to an active incident
  'approval_request',        // Agent requested human approval
  'audit_review',            // Reviewing system behaviour
  'emergency',               // Critical situation requiring override
  'manual',                  // Human decided to escalate
]);

export type AuthorityEscalationReason = z.infer<typeof AuthorityEscalationReasonSchema>;

/**
 * An AuthorityContext tracks the human's current authority state,
 * including escalation history for governance audit.
 */
export const AuthorityContextSchema = z.object({
  /** Current authority mode */
  currentMode: AuthorityModeSchema.default('observe'),

  /** Who holds this authority (user ID or session ID) */
  holderId: z.string(),

  /** Display name of the authority holder */
  holderName: z.string().optional(),

  /** When this authority level was entered */
  enteredAt: z.string().datetime(),

  /** Auto-expire: when this authority level should automatically downgrade */
  expiresAt: z.string().datetime().optional(),

  /** Reason for current authority level (required for approve/override) */
  reason: AuthorityEscalationReasonSchema.optional(),

  /** Free-text justification (required for override) */
  justification: z.string().optional(),

  /** Authority escalation history for audit trail */
  escalationHistory: z.array(z.object({
    from: AuthorityModeSchema,
    to: AuthorityModeSchema,
    reason: AuthorityEscalationReasonSchema,
    justification: z.string().optional(),
    timestamp: z.string().datetime(),
    /** How long the escalation lasted (ms), filled retroactively */
    durationMs: z.number().int().optional(),
  })).default([]),
});

export type AuthorityContext = z.infer<typeof AuthorityContextSchema>;
export type AuthorityContextInput = z.input<typeof AuthorityContextSchema>;

// ── Authority Checks ────────────────────────────────────────────────────────

/**
 * Check if a given authority mode meets the required authority level.
 */
export function hasAuthority(
  current: AuthorityMode,
  required: AuthorityMode
): boolean {
  return AUTHORITY_HIERARCHY.indexOf(current) >= AUTHORITY_HIERARCHY.indexOf(required);
}

/**
 * Check if an escalation from one mode to another is valid.
 * Escalations must go up the hierarchy; downgrades are always valid.
 */
export function isValidEscalation(
  from: AuthorityMode,
  to: AuthorityMode
): boolean {
  // Downgrades are always valid
  if (AUTHORITY_HIERARCHY.indexOf(to) <= AUTHORITY_HIERARCHY.indexOf(from)) {
    return true;
  }
  // Escalations are valid (but should be justified in production)
  return true;
}

/**
 * Determine what UI capabilities are available at a given authority level.
 */
export function getAuthorityCapabilities(mode: AuthorityMode): {
  canView: boolean;
  canModifyConstraints: boolean;
  canApproveActions: boolean;
  canOverride: boolean;
  canDismissViews: boolean;
  canEscalate: boolean;
} {
  const level = AUTHORITY_HIERARCHY.indexOf(mode);
  return {
    canView: level >= 0,           // All modes can view
    canModifyConstraints: level >= 1, // Intervene and above
    canApproveActions: level >= 2,    // Approve and above
    canOverride: level >= 3,          // Override only
    canDismissViews: level >= 1,      // Intervene and above
    canEscalate: level < 3,           // Can escalate if not already at max
  };
}

/**
 * Get the recommended density mode for a given authority level.
 */
export function getRecommendedDensity(mode: AuthorityMode): string {
  return AUTHORITY_DENSITY_MAP[mode];
}
