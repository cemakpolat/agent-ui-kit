import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────────────────
// Action Safety & Blast Radius
//
// Every agent-initiated action carries safety metadata.  The UI uses this to:
//   - colour-code risk level
//   - require two-step confirmation for irreversible actions
//   - surface blast radius (which systems / users are affected)
//   - show estimated cost before execution
//
// Rule: no irreversible action should be visually indistinguishable from a safe one.
// ─────────────────────────────────────────────────────────────────────────────

export const BlastRadiusScopeSchema = z.enum(['self', 'team', 'org', 'global']);
export type BlastRadiusScope = z.infer<typeof BlastRadiusScopeSchema>;

export const BlastRadiusSchema = z.object({
  /** How widely the action propagates */
  scope: BlastRadiusScopeSchema,
  /** Names of systems, services, or APIs that will be affected */
  affectedSystems: z.array(z.string()),
  /** Human-readable description of downstream effects */
  downstreamEffects: z.string().optional(),
  /** Free-text impact estimate, e.g. "~50 ms read-latency spike" */
  estimatedImpact: z.string().optional(),
});

export type BlastRadius = z.infer<typeof BlastRadiusSchema>;

export const ActionSafetySchema = z.object({
  /** Agent confidence that this action achieves the goal (0–1) */
  confidence: z.number().min(0).max(1),
  /** Whether the action can be undone */
  reversible: z.boolean(),
  /** Estimated financial cost, if applicable */
  cost: z.number().optional(),
  currency: z.string().optional(),
  blastRadius: BlastRadiusSchema.optional(),
  /** Whether the UI must present a two-step confirmation */
  requiresConfirmation: z.boolean().default(false),
  /** Optional mandatory delay (ms) before the confirm button activates */
  confirmationDelay: z.number().optional(),
  /** Agent's justification for the action */
  explanation: z.string().optional(),
  riskLevel: z.enum(['low', 'medium', 'high', 'critical']),
});

export type ActionSafety = z.infer<typeof ActionSafetySchema>;

export const AgentActionSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string().optional(),
  /** Visual variant — drives button styling */
  variant: z.enum(['primary', 'secondary', 'destructive', 'info']).default('primary'),
  disabled: z.boolean().optional().default(false),
  safety: ActionSafetySchema.optional(),
  /** Arbitrary data forwarded to the agent on execution */
  payload: z.record(z.string(), z.unknown()).optional(),
});

export type AgentAction = z.infer<typeof AgentActionSchema>;
