import type { IntentPayload, DensityMode, IntentModification, LayoutHint } from '../schemas/intent';
import { DENSITY_ORDER, isWellKnownIntentType } from '../schemas/intent';
import type { AgentAction } from '../schemas/action';
import type { AmbiguityControl } from '../schemas/ambiguity';
import type { ExplainabilityContext } from '../schemas/explainability';
import type { ComponentResolver } from './registry';
import { ComponentRegistryManager } from './registry';
import { validateIntentData, suggestIntentType } from './data-validator';
import type { IntentTypeSuggestion } from './data-validator';

// ─────────────────────────────────────────────────────────────────────────────
// Intent Compiler
//
// Transforms an IntentPayload + user preferences → a CompiledView that the
// IntentRenderer component can consume directly.
//
// The compiler is a pure function — no side effects, no React.
// Density is resolved according to the authority hierarchy:
//   1. User preference  (always wins)
//   2. System policy    (role / device / a11y bounds)
//   3. Agent recommendation
//
// ── LLM Output Validation Modes ───────────────────────────────────────────
//
// STRICT     → Any schema violation throws a ValidationError.  The render
//              pipeline surfaces an "Insufficient Information" view instead of
//              attempting to render corrupt or hallucinated output.
//              Use in production with trusted LLM pipelines.
//
// LENIENT    → Schema violations are collected as warnings.  Rendering
//              proceeds on a best-effort basis.  (Default — backward-compat.)
//              Use during development or with weaker models.
//
// DIAGNOSTIC → All warnings + full validation context returned.  Rendering
//              is blocked and the compiled view surfaces maximum error detail.
//              Use for debugging prompt pipelines and integration testing.
//
// Rule: never use LENIENT in a production approval flow — humans must see
//       only validated perception, never hallucinated output.
// ─────────────────────────────────────────────────────────────────────────────

// ── Validation Mode ──────────────────────────────────────────────────────────

export type ValidationMode = 'STRICT' | 'LENIENT' | 'DIAGNOSTIC';

/**
 * Thrown in STRICT mode when the intent payload fails validation.
 * Callers should catch this and render an "Insufficient Information" view
 * rather than attempting to render the corrupt payload.
 */
export class LLMValidationError extends Error {
  readonly violations: string[];
  readonly intentId: string | undefined;
  readonly mode = 'STRICT' as const;

  constructor(violations: string[], intentId?: string) {
    super(
      `[HARI STRICT] LLM output validation failed — cannot render:\n` +
      violations.map((v) => `  • ${v}`).join('\n'),
    );
    this.name = 'LLMValidationError';
    this.violations = violations;
    this.intentId = intentId;
  }
}

export interface CompiledView {
  intentId: string;
  domain: string;
  type: string;
  primaryGoal: string;
  density: DensityMode;
  layoutHint: LayoutHint | undefined;
  resolvedComponent: ComponentResolver | null;
  data: Record<string, unknown>;
  priorityFields: string[];
  actions: AgentAction[];
  ambiguities: AmbiguityControl[];
  explain: boolean;
  explainability: Record<string, ExplainabilityContext>;
  confidence: number;
  warnings: string[];
  /** True when the intent type is one of HARI's well-known types */
  isWellKnownType: boolean;
  /** Alternative type suggestions when data shape doesn't match type */
  typeSuggestions: IntentTypeSuggestion[];
  /** True when intent data passed schema validation for its type */
  dataValid: boolean;
  /**
   * Validation mode active during compilation.
   * In DIAGNOSTIC mode, this view should not be rendered — surface errors instead.
   */
  validationMode: ValidationMode;
  /**
   * True when the view represents an "Insufficient Information" fallback.
   * STRICT violations and DIAGNOSTIC blocks set this to true.
   */
  insufficientInformation: boolean;
}

export interface SystemPolicy {
  /** Minimum density the system will allow (e.g. "expert" for debug mode) */
  minDensity?: DensityMode;
  /** Maximum density the system will allow (e.g. "executive" for kiosk mode) */
  maxDensity?: DensityMode;
}

export interface CompilerOptions {
  /** Hard override from explicit user preference — always wins */
  userDensityOverride?: DensityMode | null;
  /** System-level constraints (role, device, accessibility) */
  systemPolicy?: SystemPolicy;
  /**
   * LLM output validation mode (default: 'LENIENT').
   *
   * STRICT     → throw LLMValidationError on any schema violation
   * LENIENT    → collect warnings, render best-effort (default)
   * DIAGNOSTIC → block rendering, return full error context
   */
  validationMode?: ValidationMode;
}

function resolveDensity(
  agentDensity: DensityMode,
  options: CompilerOptions,
): DensityMode {
  if (options.userDensityOverride) return options.userDensityOverride;

  if (options.systemPolicy) {
    let idx = DENSITY_ORDER.indexOf(agentDensity);
    const { minDensity, maxDensity } = options.systemPolicy;
    if (minDensity) idx = Math.max(idx, DENSITY_ORDER.indexOf(minDensity));
    if (maxDensity) idx = Math.min(idx, DENSITY_ORDER.indexOf(maxDensity));
    return DENSITY_ORDER[idx];
  }

  return agentDensity;
}

export function compileIntent(
  intent: IntentPayload,
  registry: ComponentRegistryManager,
  options: CompilerOptions = {},
): CompiledView {
  const warnings: string[] = [];
  const validationMode: ValidationMode = options.validationMode ?? 'LENIENT';
  const density = resolveDensity(intent.density, options);
  const data = intent.data as Record<string, unknown>;

  // ── Intent type validation ─────────────────────────────────────────────
  const knownType = isWellKnownIntentType(intent.type);
  if (!knownType) {
    warnings.push(
      `Unknown intent type "${intent.type}". ` +
      `Well-known types: comparison, diagnostic_overview, sensor_overview, ` +
      `document, form, chat, diagram, timeline, workflow, kanban, calendar, tree. ` +
      `Custom types require an explicit registry entry.`,
    );
  }

  // ── Data shape validation ──────────────────────────────────────────────
  const dataValidation = validateIntentData(intent.type, data);
  if (!dataValidation.valid) {
    warnings.push(...dataValidation.warnings);
  }

  // ── Validation mode enforcement ────────────────────────────────────────
  const hasViolations = !dataValidation.valid || (!knownType && warnings.length > 0);

  if (validationMode === 'STRICT' && hasViolations) {
    throw new LLMValidationError(warnings, intent.intentId);
  }

  if (validationMode === 'DIAGNOSTIC') {
    // Surface everything, block rendering
    const diagnosticWarnings = [
      `[DIAGNOSTIC MODE] Full validation context follows:`,
      ...warnings,
      `Intent ID:   ${intent.intentId}`,
      `Intent Type: ${intent.type} (well-known: ${knownType})`,
      `Data valid:  ${dataValidation.valid}`,
    ];
    return {
      intentId: intent.intentId,
      domain: intent.domain,
      type: intent.type,
      primaryGoal: intent.primaryGoal,
      density,
      layoutHint: intent.layoutHint,
      resolvedComponent: null,
      data,
      priorityFields: intent.priorityFields,
      actions: [],
      ambiguities: intent.ambiguities,
      explain: false,
      explainability: {},
      confidence: intent.confidence,
      warnings: diagnosticWarnings,
      isWellKnownType: knownType,
      typeSuggestions: [],
      dataValid: dataValidation.valid,
      validationMode,
      insufficientInformation: true,
    };
  }

  // ── Type suggestion (when data doesn't match declared type) ───────────
  let typeSuggestions: IntentTypeSuggestion[] = [];
  if (!dataValidation.valid || !knownType) {
    typeSuggestions = suggestIntentType(data);
    if (typeSuggestions.length > 0 && typeSuggestions[0].type !== intent.type) {
      warnings.push(
        `Data shape suggests type="${typeSuggestions[0].type}" ` +
        `(${typeSuggestions[0].reason}), but intent declares type="${intent.type}".`,
      );
    }
  }

  // ── Component resolution ───────────────────────────────────────────────
  const resolvedComponent = registry.resolve(intent.domain, intent.type, density);
  if (!resolvedComponent) {
    warnings.push(
      `No component registered for domain="${intent.domain}" type="${intent.type}" density="${density}". Falling back to auto-generated view.`,
    );
  }

  return {
    intentId: intent.intentId,
    domain: intent.domain,
    type: intent.type,
    primaryGoal: intent.primaryGoal,
    density,
    layoutHint: intent.layoutHint,
    resolvedComponent,
    data,
    priorityFields: intent.priorityFields,
    actions: intent.actions,
    ambiguities: intent.ambiguities,
    explain: intent.explain,
    explainability: (intent.explainability ?? {}) as Record<string, ExplainabilityContext>,
    confidence: intent.confidence,
    warnings,
    isWellKnownType: knownType,
    typeSuggestions,
    dataValid: dataValidation.valid,
    validationMode,
    insufficientInformation: false,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Modification Patch Builder
//
// Constructs an IntentModification patch when the user changes an ambiguity
// control.  The agent decides whether to re-sort existing data (optimistic /
// cheap) or issue a new IntentPayload (expensive).
// ─────────────────────────────────────────────────────────────────────────────

export function buildModificationPatch(
  originalIntentId: string,
  modifications: Record<string, unknown>,
): IntentModification {
  return {
    event: 'intent_modification',
    originalIntentId,
    modifications,
    timestamp: Date.now(),
  };
}
