import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────────────────
// Explainability Contract
//
// Explainability is a collaborative reasoning surface, not documentation.
// Each UI element may expose a "Why am I seeing this?" panel containing:
//   - data sources (MCPs, APIs, caches) and their freshness
//   - assumptions the agent made
//   - confidence ranges
//   - alternatives the agent considered and why it rejected them
//   - pre-seeded "what-if" queries the user can fire
//
// The panel is queryable: users can ask hypothetical questions that the agent
// answers in an isolated "Hypothetical" overlay without mutating the main view.
// ─────────────────────────────────────────────────────────────────────────────

export const DataSourceSchema = z.object({
  name: z.string(),
  /** 'mcp' | 'database' | 'api' | 'cache' | 'user_provided' */
  type: z.string(),
  /** ISO 8601 timestamp of the data used */
  freshness: z.string().optional(),
  /** Agent-assessed reliability (0–1) */
  reliability: z.number().min(0).max(1).optional(),
});

export type DataSource = z.infer<typeof DataSourceSchema>;

export const AlternativeConsideredSchema = z.object({
  description: z.string(),
  /** Why the agent didn't choose this alternative */
  reason: z.string(),
});

export const ExplainabilityContextSchema = z.object({
  /** Unique ID linking back to a UI element or intent */
  elementId: z.string(),
  /** One-sentence human-readable summary */
  summary: z.string(),
  dataSources: z.array(DataSourceSchema).default([]),
  assumptions: z.array(z.string()).default([]),
  /** 90 % confidence interval for quantitative outputs */
  confidenceRange: z
    .object({ low: z.number(), high: z.number() })
    .optional(),
  alternativesConsidered: z.array(AlternativeConsideredSchema).default([]),
  /** Pre-seeded what-if queries to show as quick-pick chips */
  whatIfQueries: z.array(z.string()).default([]),
});

export type ExplainabilityContext = z.infer<typeof ExplainabilityContextSchema>;
export type AlternativeConsidered = z.infer<typeof AlternativeConsideredSchema>;
