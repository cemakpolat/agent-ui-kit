import type { ZodSchema, ZodError } from 'zod';
import { DocumentDataSchema } from '../schemas/document';
import { ChatDataSchema } from '../schemas/chat';
import { DiagramDataSchema } from '../schemas/diagram';
import { TimelineDataSchema } from '../schemas/timeline';
import { WorkflowDataSchema } from '../schemas/workflow';
import { KanbanDataSchema } from '../schemas/kanban';
import { CalendarDataSchema } from '../schemas/calendar';
import { TreeDataSchema } from '../schemas/tree';
import { MapDataSchema } from '../schemas/map';
import type { WellKnownIntentType } from '../schemas/intent';
import { isWellKnownIntentType } from '../schemas/intent';

// ─────────────────────────────────────────────────────────────────────────────
// Intent Data Validator
//
// Validates that `IntentPayload.data` conforms to the expected shape for a
// given well-known intent type. Returns structured validation results so the
// compiler can emit actionable warnings without crashing.
//
// Intent types that carry domain-specific data (comparison, diagnostic_overview,
// sensor_overview) cannot be validated here because their shape is defined by
// the consuming application. Only types with HARI-defined schemas are checked.
// ─────────────────────────────────────────────────────────────────────────────

export interface DataValidationResult {
  /** Whether validation passed (true) or had issues (false) */
  valid: boolean;
  /** Human-readable warning messages for the compiler */
  warnings: string[];
  /** Structured Zod errors (for dev tooling / playground) */
  zodErrors?: ZodError;
}

/**
 * Map of well-known intent types → their expected data schema.
 * Types not in this map have domain-specific data that we can't validate
 * generically (e.g. 'comparison' data varies by travel, e-commerce, etc.).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const DATA_SCHEMA_MAP: Partial<Record<WellKnownIntentType, ZodSchema<any>>> = {
  document: DocumentDataSchema,
  chat: ChatDataSchema,
  diagram: DiagramDataSchema,
  timeline: TimelineDataSchema,
  workflow: WorkflowDataSchema,
  kanban: KanbanDataSchema,
  calendar: CalendarDataSchema,
  tree: TreeDataSchema,
  map: MapDataSchema,
  // comparison: domain-specific (flights, products, vendors — shape varies)
  // diagnostic_overview: domain-specific (metrics, sensors — shape varies)
  // sensor_overview: domain-specific (sensor readings — shape varies)
  // form: validated by FormRenderer directly via FormSectionSchema
};

/**
 * Validate intent data against the schema for a well-known type.
 *
 * @param type - The intent type string
 * @param data - The raw data record from IntentPayload.data
 * @returns Validation result with warnings on failure
 */
export function validateIntentData(
  type: string,
  data: Record<string, unknown>,
): DataValidationResult {
  // Custom types — no schema to validate against
  if (!isWellKnownIntentType(type)) {
    return { valid: true, warnings: [] };
  }

  const schema = DATA_SCHEMA_MAP[type];

  // Well-known type without a fixed schema (domain-specific data)
  if (!schema) {
    return { valid: true, warnings: [] };
  }

  const result = schema.safeParse(data);

  if (result.success) {
    return { valid: true, warnings: [] };
  }

  // Build human-readable warnings from Zod issues
  const issues = result.error.issues;
  const summary = issues
    .slice(0, 5) // Cap at 5 to avoid flooding
    .map((issue) => {
      const path = issue.path.length > 0 ? `data.${issue.path.join('.')}` : 'data';
      return `${path}: ${issue.message}`;
    });

  if (issues.length > 5) {
    summary.push(`…and ${issues.length - 5} more validation issue(s)`);
  }

  return {
    valid: false,
    warnings: [
      `Intent data does not match the expected shape for type="${type}". ` +
      `Rendering may be incomplete or broken.`,
      ...summary,
    ],
    zodErrors: result.error,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Intent Type Inference
//
// Examines data structure heuristically and suggests a well-known intent type.
// Useful when an agent isn't sure which type to use, or for auto-correction.
// ─────────────────────────────────────────────────────────────────────────────

export interface IntentTypeSuggestion {
  /** Suggested intent type */
  type: WellKnownIntentType;
  /** Confidence in this suggestion (0–1) */
  confidence: number;
  /** Why this type was suggested */
  reason: string;
}

/**
 * Suggest a well-known intent type based on data shape heuristics.
 * Returns an array of suggestions sorted by confidence (highest first).
 *
 * This is a best-effort heuristic — it cannot replace explicit type assignment
 * but can catch obvious mismatches and help agents pick the right type.
 */
export function suggestIntentType(
  data: Record<string, unknown>,
): IntentTypeSuggestion[] {
  const suggestions: IntentTypeSuggestion[] = [];

  // Chat: has messages array with role/content objects
  if (Array.isArray(data.messages) && data.messages.length > 0) {
    const first = data.messages[0];
    if (typeof first === 'object' && first !== null && 'role' in first && 'content' in first) {
      suggestions.push({ type: 'chat', confidence: 0.95, reason: 'data.messages[] with role + content fields' });
    }
  }

  // Kanban: has columns array with cards
  if (Array.isArray(data.columns) && data.columns.length > 0) {
    const first = data.columns[0];
    if (typeof first === 'object' && first !== null && 'cards' in first) {
      suggestions.push({ type: 'kanban', confidence: 0.9, reason: 'data.columns[] with cards[]' });
    }
  }

  // Tree: has nodes array with nested children
  if (Array.isArray(data.nodes) && data.nodes.length > 0) {
    const first = data.nodes[0];
    if (typeof first === 'object' && first !== null && ('children' in first || 'label' in first)) {
      suggestions.push({ type: 'tree', confidence: 0.85, reason: 'data.nodes[] with children/label fields' });
    }
  }

  // Timeline: has events array with timestamp
  if (Array.isArray(data.events) && data.events.length > 0) {
    const first = data.events[0];
    if (typeof first === 'object' && first !== null && 'timestamp' in first) {
      // Could be calendar too — check for start/end
      if ('start' in first && 'end' in first) {
        suggestions.push({ type: 'calendar', confidence: 0.85, reason: 'data.events[] with start + end fields' });
      } else {
        suggestions.push({ type: 'timeline', confidence: 0.85, reason: 'data.events[] with timestamp field' });
      }
    }
    // Calendar: events with start/end but no timestamp
    if (typeof first === 'object' && first !== null && 'start' in first && 'end' in first) {
      if (!('timestamp' in first)) {
        suggestions.push({ type: 'calendar', confidence: 0.9, reason: 'data.events[] with start + end fields' });
      }
    }
  }

  // Diagram: has diagrams array
  if (Array.isArray(data.diagrams) && data.diagrams.length > 0) {
    suggestions.push({ type: 'diagram', confidence: 0.9, reason: 'data.diagrams[] present' });
  }

  // Document: has sections array with blocks
  if (Array.isArray(data.sections) && data.sections.length > 0) {
    const first = data.sections[0];
    if (typeof first === 'object' && first !== null && 'blocks' in first) {
      suggestions.push({ type: 'document', confidence: 0.85, reason: 'data.sections[] with blocks[]' });
    }
    // Could also be a form (sections with fields)
    if (typeof first === 'object' && first !== null && 'fields' in first) {
      suggestions.push({ type: 'form', confidence: 0.85, reason: 'data.sections[] with fields[]' });
    }
  }

  // Workflow: has steps array
  if (Array.isArray(data.steps) && data.steps.length > 0) {
    const first = data.steps[0];
    if (typeof first === 'object' && first !== null && ('status' in first || 'type' in first)) {
      suggestions.push({ type: 'workflow', confidence: 0.85, reason: 'data.steps[] with status/type fields' });
    }
  }

  // Sort by confidence descending
  suggestions.sort((a, b) => b.confidence - a.confidence);

  return suggestions;
}

/**
 * Get the registered data schema for a well-known intent type (if any).
 * Returns undefined for types with domain-specific data.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getDataSchemaForType(type: string): ZodSchema<any> | undefined {
  if (!isWellKnownIntentType(type)) return undefined;
  return DATA_SCHEMA_MAP[type];
}
