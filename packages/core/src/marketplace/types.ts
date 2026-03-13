// ─────────────────────────────────────────────────────────────────────────────
// Governance Marketplace — Phase 8.1
//
// A typed registry for reusable governance artifacts:
//
//   AuthorityHierarchy   — shareable escalation chain configurations
//   PreconditionTemplate — fill-in-the-blank precondition definitions
//   GovernancePattern    — named composition of hierarchy + preconditions
//
// Artifacts can be:
//   - Defined locally in this package (built-ins)
//   - Loaded from remote JSON (community marketplace — future v2)
//   - Composed and published as @hari/marketplace-* npm packages
//
// All items carry SemVer + SPDX licence metadata so enterprise
// compliance teams can audit what governance rules are in use.
// ─────────────────────────────────────────────────────────────────────────────

import { z } from 'zod';

// ── Provenance ────────────────────────────────────────────────────────────────

export const MarketplaceProvenanceSchema = z.object({
  /** Human-readable author / organisation */
  author: z.string(),
  /** SPDX licence identifier, e.g. "MIT", "Apache-2.0" */
  licence: z.string().default('MIT'),
  /** SemVer string */
  version: z.string().regex(/^\d+\.\d+\.\d+(-[\w.]+)?$/),
  /** ISO 8601 publication date */
  publishedAt: z.string().datetime().optional(),
  /** Source URL (GitHub, registry, etc.) */
  sourceUrl: z.string().url().optional(),
  /** Community star count (fetched from remote marketplace) */
  stars: z.number().int().nonnegative().optional(),
});

export type MarketplaceProvenance = z.infer<typeof MarketplaceProvenanceSchema>;

// ── Tags / Categories ─────────────────────────────────────────────────────────

export const MarketplaceCategorySchema = z.enum([
  'incident-response',
  'deployment',
  'finance',
  'security',
  'compliance',
  'hr',
  'legal',
  'devops',
  'iot',
  'general',
]);

export type MarketplaceCategory = z.infer<typeof MarketplaceCategorySchema>;

// ── 8.1-A: Authority Hierarchy ────────────────────────────────────────────────

/**
 * A shareable authority escalation chain.
 *
 * Beyond the four built-in modes (observe/intervene/approve/override),
 * organisations often define *role constraints* on top — e.g. only
 * members of SRE Team can enter `approve` for production changes.
 *
 * An AuthorityHierarchy captures these organisational overlays in a
 * reusable artifact that can be imported and applied to any governance view.
 */
export const AuthorityHierarchySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  provenance: MarketplaceProvenanceSchema,
  category: MarketplaceCategorySchema,
  /** Short rationale — why this escalation chain was designed this way */
  rationale: z.string().optional(),

  /**
   * Ordered escalation steps (index 0 = lowest authority).
   * The built-in modes are the superset; hierarchy items map to them.
   */
  levels: z.array(z.object({
    mode: z.enum(['observe', 'intervene', 'approve', 'override']),
    /** Human-readable name for this level in context (e.g. "L1 Support") */
    label: z.string(),
    /** Who can hold this level — free-text role identifiers */
    allowedRoles: z.array(z.string()).default([]),
    /** Maximum time (ISO 8601 duration) this level may be held before forced review */
    maxDuration: z.string().optional(),
    /** Whether justification text is required to enter this level */
    requiresJustification: z.boolean().default(false),
    /** Whether a second human must co-authorise entry into this level */
    requiresDualAuthorisation: z.boolean().default(false),
    /** Whether every action taken at this level must be audit-logged */
    auditLogged: z.boolean().default(true),
  })),

  /** Auto-downgrade: after this duration at override, return to approve */
  autoDowngrade: z.object({
    enabled: z.boolean(),
    afterDuration: z.string().optional(), // ISO 8601 duration
    targetMode: z.enum(['observe', 'intervene', 'approve']).optional(),
  }).default({ enabled: false }),
});

export type AuthorityHierarchy = z.infer<typeof AuthorityHierarchySchema>;

// ── 8.1-B: Precondition Template ─────────────────────────────────────────────

/**
 * A reusable precondition definition with slots for contextual values.
 *
 * Templates solve the copy-paste problem: operators manually re-type
 * "backup must be verified" for every deployment action.  Templates make
 * governance *composable*.
 *
 * Slots use {{mustache}} syntax in description/resolution/verification strings.
 */
export const PreconditionTemplateSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  provenance: MarketplaceProvenanceSchema,
  category: MarketplaceCategorySchema,
  /** Use-case tags for search */
  tags: z.array(z.string()).default([]),

  /**
   * Template strings.  Use {{slotName}} to mark fill-in slots.
   * e.g. "{{service}} backup verified within {{window}}"
   */
  template: z.object({
    /** Precondition description with slots */
    description: z.string(),
    /** Default slot values — used when consumer doesn't override them */
    defaultSlots: z.record(z.string(), z.string()).default({}),
    /** How this precondition is typically verified */
    verificationMethod: z.string().optional(),
    /** What to do if unmet */
    resolution: z.string().optional(),
  }),

  /**
   * Criticality: how important is this precondition?
   * AI evaluator uses this as context when ranking suggested preconditions.
   */
  criticality: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),

  /** Minimum authority required to waive this precondition */
  minimumWaiverAuthority: z.enum(['approve', 'override']).default('override'),

  /** Applies to these action types (leave empty = universal) */
  applicableActionTypes: z.array(z.string()).default([]),
});

export type PreconditionTemplate = z.infer<typeof PreconditionTemplateSchema>;

// ── 8.1-C: Governance Pattern ─────────────────────────────────────────────────

/**
 * A named, reusable composition of an authority hierarchy plus a set of
 * precondition templates — the top-level shareable unit.
 *
 * A pattern represents a *complete governance stance* for a domain scenario.
 * Example: "ITIL-Aligned Production Change" bundles the CAB hierarchy with
 * backup/notification/rollback precondition templates.
 */
export const GovernancePatternSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  provenance: MarketplaceProvenanceSchema,
  category: MarketplaceCategorySchema,
  tags: z.array(z.string()).default([]),
  /** Use this in README / marketplace listing */
  longDescription: z.string().optional(),
  exampleUseCases: z.array(z.string()).default([]),

  /** Authority hierarchy bundled with this pattern */
  authorityHierarchyId: z.string(),

  /**
   * Ordered precondition template references.
   * Templates are applied in order — consumers fill slots.
   */
  preconditionTemplates: z.array(z.object({
    templateId: z.string(),
    /** Override slot values for this pattern's context */
    slotOverrides: z.record(z.string(), z.string()).default({}),
    /** Whether this template is required (cannot be removed by consumer) */
    required: z.boolean().default(false),
  })),

  /**
   * Recommended minimum deliberation delay (ISO 8601 duration).
   * Prevents rubber-stamping by forcing a review pause.
   */
  recommendedDeliberationDelay: z.string().optional(),

  /** Compliance frameworks this pattern helps satisfy */
  complianceFrameworks: z.array(z.string()).default([]),
});

export type GovernancePattern = z.infer<typeof GovernancePatternSchema>;

// ── Marketplace Item Union ────────────────────────────────────────────────────

export type MarketplaceItemType = 'hierarchy' | 'template' | 'pattern';

export interface MarketplaceItem {
  type: MarketplaceItemType;
  item: AuthorityHierarchy | PreconditionTemplate | GovernancePattern;
}

// ── Import Result ─────────────────────────────────────────────────────────────

/** Filled precondition — template with slots resolved */
export interface ResolvedPrecondition {
  description: string;
  verificationMethod?: string;
  resolution?: string;
  status: 'unknown';
  /** Source template id for traceability */
  fromTemplate: string;
  criticality: PreconditionTemplate['criticality'];
}
