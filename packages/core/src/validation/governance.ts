import { z } from 'zod';
import { SituationalViewSchema, type SituationalView } from '../schemas/situational-view';
import { GovernedActionSchema, type GovernedAction, arePreconditionsMet } from '../schemas/governed-action';
import { hasAuthority, type AuthorityMode } from '../schemas/authority';

// ─────────────────────────────────────────────────────────────────────────────
// Governance Validation
//
// Validates that governance contracts are satisfied before views are rendered
// and actions are executed.  This is the enforcement layer — schemas define
// what governance means; this module ensures it actually happens.
//
// Rules enforced:
//   1. Every SituationalView must answer a question
//   2. Confidence must be declared (no silent certainty)
//   3. Expired views must not be rendered without warning
//   4. Actions require sufficient authority
//   5. Preconditions must be checked before action approval
//   6. Decision records must capture rationale for rejections
// ─────────────────────────────────────────────────────────────────────────────

export type GovernanceViolation = {
  rule: string;
  severity: 'warning' | 'error' | 'critical';
  message: string;
  elementId?: string;
};

export type GovernanceReport = {
  valid: boolean;
  violations: GovernanceViolation[];
  timestamp: string;
};

/**
 * Validate a SituationalView against governance rules.
 */
export function validateView(view: SituationalView): GovernanceReport {
  const violations: GovernanceViolation[] = [];

  // Rule 1: View must answer a question
  if (!view.question || view.question.trim().length === 0) {
    violations.push({
      rule: 'question-required',
      severity: 'error',
      message: 'Every SituationalView must declare the question it answers.',
      elementId: view.situationId,
    });
  }

  // Rule 2: Confidence must be declared
  if (view.confidence === undefined || view.confidence === null) {
    violations.push({
      rule: 'confidence-required',
      severity: 'error',
      message: 'View confidence must be explicitly declared (0–1).',
      elementId: view.situationId,
    });
  }

  // Rule 3: Low confidence must have unknowns declared
  if (view.confidence < 0.5 && view.unknowns.length === 0) {
    violations.push({
      rule: 'low-confidence-unknowns',
      severity: 'warning',
      message: `View confidence is ${view.confidence} but no unknowns are declared. ` +
        'Low-confidence views should explain what the agent does not know.',
      elementId: view.situationId,
    });
  }

  // Rule 4: Scope must include at least one system
  if (!view.scope.systems || view.scope.systems.length === 0) {
    violations.push({
      rule: 'scope-required',
      severity: 'error',
      message: 'View scope must include at least one system.',
      elementId: view.situationId,
    });
  }

  // Rule 5: Expired views should not be active
  if (view.expiresAt) {
    const expiry = new Date(view.expiresAt);
    if (expiry < new Date() && view.status === 'active') {
      violations.push({
        rule: 'expired-view-active',
        severity: 'warning',
        message: `View expired at ${view.expiresAt} but is still marked as active.`,
        elementId: view.situationId,
      });
    }
  }

  // Rule 6: Superseded views must reference replacement
  if (view.status === 'superseded' && !view.supersededBy) {
    violations.push({
      rule: 'superseded-without-replacement',
      severity: 'warning',
      message: 'View is marked as superseded but does not reference a replacement view.',
      elementId: view.situationId,
    });
  }

  return {
    valid: violations.filter(v => v.severity === 'error' || v.severity === 'critical').length === 0,
    violations,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Validate whether a GovernedAction can be executed given authority and preconditions.
 */
export function validateActionExecution(
  action: GovernedAction,
  currentAuthority: AuthorityMode
): GovernanceReport {
  const violations: GovernanceViolation[] = [];

  // Rule 1: Authority check
  if (!hasAuthority(currentAuthority, action.requiredAuthority)) {
    violations.push({
      rule: 'insufficient-authority',
      severity: 'critical',
      message: `Action requires '${action.requiredAuthority}' authority but current level is '${currentAuthority}'.`,
      elementId: action.action.id,
    });
  }

  // Rule 2: Preconditions check
  if (!arePreconditionsMet(action)) {
    const unmet = action.preconditions.filter(p => p.status === 'unmet');
    for (const p of unmet) {
      violations.push({
        rule: 'precondition-unmet',
        severity: 'error',
        message: `Precondition not met: ${p.description}`,
        elementId: action.action.id,
      });
    }
  }

  // Rule 3: Unknown preconditions require human judgment
  const unknown = action.preconditions.filter(p => p.status === 'unknown');
  if (unknown.length > 0) {
    for (const p of unknown) {
      violations.push({
        rule: 'precondition-unknown',
        severity: 'warning',
        message: `Precondition status unknown — human judgment required: ${p.description}`,
        elementId: action.action.id,
      });
    }
  }

  // Rule 4: Low action confidence on irreversible actions
  if (action.reversibility === 'irreversible' && action.actionConfidence < 0.7) {
    violations.push({
      rule: 'low-confidence-irreversible',
      severity: 'warning',
      message: `Action is irreversible but confidence is only ${action.actionConfidence}. ` +
        'Consider requiring higher confidence or human override.',
      elementId: action.action.id,
    });
  }

  // Rule 5: Irreversible actions must require at least 'approve' authority
  if (action.reversibility === 'irreversible' && action.requiredAuthority === 'observe') {
    violations.push({
      rule: 'irreversible-insufficient-authority',
      severity: 'error',
      message: 'Irreversible actions must require at least "intervene" authority level.',
      elementId: action.action.id,
    });
  }

  return {
    valid: violations.filter(v => v.severity === 'error' || v.severity === 'critical').length === 0,
    violations,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Validate a SituationalView schema structurally (Zod parse).
 */
export function parseView(data: unknown): { success: true; data: SituationalView } | { success: false; errors: z.ZodError } {
  const result = SituationalViewSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error };
}

/**
 * Validate a GovernedAction schema structurally (Zod parse).
 */
export function parseGovernedAction(data: unknown): { success: true; data: GovernedAction } | { success: false; errors: z.ZodError } {
  const result = GovernedActionSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error };
}
