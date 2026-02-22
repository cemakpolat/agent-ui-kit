import type { IntentPayload, DensityMode, IntentModification } from '../schemas/intent';
import { DENSITY_ORDER } from '../schemas/intent';
import type { AgentAction } from '../schemas/action';
import type { AmbiguityControl } from '../schemas/ambiguity';
import type { ExplainabilityContext } from '../schemas/explainability';
import type { ComponentResolver } from './registry';
import { ComponentRegistryManager } from './registry';

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
// ─────────────────────────────────────────────────────────────────────────────

export interface CompiledView {
  intentId: string;
  domain: string;
  type: string;
  primaryGoal: string;
  density: DensityMode;
  resolvedComponent: ComponentResolver | null;
  data: Record<string, unknown>;
  priorityFields: string[];
  actions: AgentAction[];
  ambiguities: AmbiguityControl[];
  explain: boolean;
  explainability: Record<string, ExplainabilityContext>;
  confidence: number;
  warnings: string[];
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
  const density = resolveDensity(intent.density, options);

  const resolvedComponent = registry.resolve(intent.domain, intent.type, density);
  if (!resolvedComponent) {
    warnings.push(
      `No component registered for domain="${intent.domain}" type="${intent.type}" density="${density}". Falling back to raw JSON view.`,
    );
  }

  return {
    intentId: intent.intentId,
    domain: intent.domain,
    type: intent.type,
    primaryGoal: intent.primaryGoal,
    density,
    resolvedComponent,
    data: intent.data as Record<string, unknown>,
    priorityFields: intent.priorityFields,
    actions: intent.actions,
    ambiguities: intent.ambiguities,
    explain: intent.explain,
    explainability: (intent.explainability ?? {}) as Record<string, ExplainabilityContext>,
    confidence: intent.confidence,
    warnings,
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
