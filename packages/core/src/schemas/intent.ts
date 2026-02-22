import { z } from 'zod';
import { AgentActionSchema } from './action';
import { AmbiguityControlSchema } from './ambiguity';
import { ExplainabilityContextSchema } from './explainability';

// ─────────────────────────────────────────────────────────────────────────────
// Intent Payload — the core contract between agent and frontend
//
// The agent describes *what the user is trying to accomplish*, never *how the
// UI should look*.  The frontend acts as an intent compiler, translating this
// payload into the optimal layout + component tree for the current density,
// device, role, and accessibility context.
//
// Intent is negotiable: users can adjust ambiguity controls, which send a
// patch back to the agent.  The agent responds with either a data re-sort
// (cheap) or a full new intent (expensive but sometimes necessary).
// ─────────────────────────────────────────────────────────────────────────────

export const DensityModeSchema = z.enum(['executive', 'operator', 'expert']);
export type DensityMode = z.infer<typeof DensityModeSchema>;

/**
 * Density authority hierarchy (highest wins):
 *   1. User preference
 *   2. System policy (role / device / a11y)
 *   3. Agent recommendation
 */
export const DENSITY_ORDER: DensityMode[] = ['executive', 'operator', 'expert'];

export const LayoutHintSchema = z.enum([
  'matrix',
  'timeline',
  'feed',
  'cards',
  'table',
  'dashboard',
  'form',
]);
export type LayoutHint = z.infer<typeof LayoutHintSchema>;

export const IntentPayloadSchema = z.object({
  /** Semantic version of this schema */
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  /** UUID — used to track negotiation history and patches */
  intentId: z.string().uuid(),
  /**
   * Semantic intent type used by the compiler to select components.
   * Well-known types: 'comparison', 'dashboard', 'form',
   * 'diagnostic_overview', 'incident_response', 'document'
   */
  type: z.string(),
  /** Domain — used for component registry lookup */
  domain: z.string(),
  primaryGoal: z.string(),
  /** Agent confidence in its interpretation of the user's goal (0–1) */
  confidence: z.number().min(0).max(1),
  /** Controls the agent wants the user to interact with to resolve ambiguity */
  ambiguities: z.array(AmbiguityControlSchema).default([]),
  /** Raw data entities — shape is domain/type specific */
  data: z.record(z.string(), z.unknown()),
  /** Fields the agent considers most relevant for the user's goal */
  priorityFields: z.array(z.string()).default([]),
  actions: z.array(AgentActionSchema).default([]),
  /** Agent's recommended density — may be overridden by user / system */
  density: DensityModeSchema.default('operator'),
  layoutHint: LayoutHintSchema.optional(),
  /** Whether explainability panels should be shown by default */
  explain: z.boolean().default(false),
  /**
   * Map of elementId → ExplainabilityContext.
   * The frontend lazily renders these in "Why?" drawers.
   */
  explainability: z.record(z.string(), ExplainabilityContextSchema).optional(),
});

/** Output type — what the compiler and renderer work with (all defaults applied) */
export type IntentPayload = z.infer<typeof IntentPayloadSchema>;
/** Input type — use this when constructing IntentPayload objects (e.g. in scenarios or agent code) */
export type IntentPayloadInput = z.input<typeof IntentPayloadSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Intent Modification Patch
//
// Sent from frontend → agent when the user changes an ambiguity control.
// The agent decides whether to re-sort existing data (cheap) or refetch (expensive).
// ─────────────────────────────────────────────────────────────────────────────

export const IntentModificationSchema = z.object({
  event: z.literal('intent_modification'),
  originalIntentId: z.string().uuid(),
  modifications: z.record(z.string(), z.unknown()),
  timestamp: z.number(),
});

export type IntentModification = z.infer<typeof IntentModificationSchema>;
