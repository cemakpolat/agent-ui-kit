import type { IntentPayloadInput, WellKnownIntentType, DensityMode, LayoutHint } from '../schemas/intent';
import { IntentPayloadSchema, isWellKnownIntentType } from '../schemas/intent';
import type { AgentActionInput } from '../schemas/action';
import type { AmbiguityControl } from '../schemas/ambiguity';
import type { ExplainabilityContext } from '../schemas/explainability';
import { validateIntentData } from './data-validator';
import type { ZodError } from 'zod';

// ─────────────────────────────────────────────────────────────────────────────
// IntentBuilder — agent-side SDK for constructing validated IntentPayloads
//
// Usage:
//   const intent = IntentBuilder
//     .create('document', 'reports')
//     .primaryGoal('Q4 Financial Summary')
//     .data({ title: 'Q4 Report', sections: [...] })
//     .confidence(0.9)
//     .build();
//
// The builder validates both the envelope (IntentPayloadSchema) and the data
// shape (per-type schema) at build time, so agents get errors before the
// payload reaches the frontend.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate a UUID v4-like string without external dependencies.
 * Uses crypto.randomUUID() when available (Node 19+, all modern browsers),
 * otherwise falls back to a Math.random-based generator.
 */
function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback for older environments
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export interface IntentBuildResult {
  /** Whether the build succeeded */
  success: boolean;
  /** The validated intent payload (undefined if validation failed) */
  intent?: IntentPayloadInput;
  /** Validation warnings (non-fatal) */
  warnings: string[];
  /** Validation errors (fatal — intent is undefined) */
  errors: string[];
  /** Structured Zod error from envelope validation */
  envelopeError?: ZodError;
  /** Structured Zod error from data validation */
  dataError?: ZodError;
}

export class IntentBuilder {
  private _type: string;
  private _domain: string;
  private _primaryGoal = '';
  private _confidence = 0.85;
  private _data: Record<string, unknown> = {};
  private _ambiguities: AmbiguityControl[] = [];
  private _actions: AgentActionInput[] = [];
  private _density: DensityMode = 'operator';
  private _layoutHint?: LayoutHint;
  private _explain = false;
  private _explainability?: Record<string, ExplainabilityContext>;
  private _priorityFields: string[] = [];
  private _version = '1.0.0';
  private _intentId?: string;

  private constructor(type: string, domain: string) {
    this._type = type;
    this._domain = domain;
  }

  /**
   * Create a new IntentBuilder.
   * @param type - Intent type (prefer WellKnownIntentType values)
   * @param domain - Domain identifier (e.g. 'travel', 'cloudops', 'hr')
   */
  static create(type: WellKnownIntentType | string, domain: string): IntentBuilder {
    return new IntentBuilder(type, domain);
  }

  /** Shortcut builders for well-known types */
  static comparison(domain: string) { return IntentBuilder.create('comparison', domain); }
  static diagnosticOverview(domain: string) { return IntentBuilder.create('diagnostic_overview', domain); }
  static sensorOverview(domain: string) { return IntentBuilder.create('sensor_overview', domain); }
  static document(domain: string) { return IntentBuilder.create('document', domain); }
  static form(domain: string) { return IntentBuilder.create('form', domain); }
  static chat(domain: string) { return IntentBuilder.create('chat', domain); }
  static diagram(domain: string) { return IntentBuilder.create('diagram', domain); }
  static timeline(domain: string) { return IntentBuilder.create('timeline', domain); }
  static workflow(domain: string) { return IntentBuilder.create('workflow', domain); }
  static kanban(domain: string) { return IntentBuilder.create('kanban', domain); }
  static calendar(domain: string) { return IntentBuilder.create('calendar', domain); }
  static tree(domain: string) { return IntentBuilder.create('tree', domain); }

  /** Set the primary goal description */
  primaryGoal(goal: string): this {
    this._primaryGoal = goal;
    return this;
  }

  /** Set agent confidence (0–1) */
  confidence(value: number): this {
    this._confidence = Math.max(0, Math.min(1, value));
    return this;
  }

  /** Set the data payload — should conform to the type's expected schema */
  data(value: Record<string, unknown>): this {
    this._data = value;
    return this;
  }

  /** Add ambiguity controls */
  ambiguities(controls: AmbiguityControl[]): this {
    this._ambiguities = controls;
    return this;
  }

  /** Add a single ambiguity control */
  addAmbiguity(control: AmbiguityControl): this {
    this._ambiguities.push(control);
    return this;
  }

  /** Add actions */
  actions(items: AgentActionInput[]): this {
    this._actions = items;
    return this;
  }

  /** Add a single action */
  addAction(action: AgentActionInput): this {
    this._actions.push(action);
    return this;
  }

  /** Set recommended density */
  density(mode: DensityMode): this {
    this._density = mode;
    return this;
  }

  /** Set layout hint */
  layoutHint(hint: LayoutHint): this {
    this._layoutHint = hint;
    return this;
  }

  /** Enable explainability */
  explain(enabled = true): this {
    this._explain = enabled;
    return this;
  }

  /** Add explainability contexts */
  explainability(contexts: Record<string, ExplainabilityContext>): this {
    this._explainability = contexts;
    return this;
  }

  /** Set priority fields */
  priorityFields(fields: string[]): this {
    this._priorityFields = fields;
    return this;
  }

  /** Override schema version (default: 1.0.0) */
  version(v: string): this {
    this._version = v;
    return this;
  }

  /** Override intentId (default: auto-generated UUID v4) */
  intentId(id: string): this {
    this._intentId = id;
    return this;
  }

  /**
   * Build and validate the intent payload.
   * Returns a result object with success/failure, warnings, and errors.
   */
  buildResult(): IntentBuildResult {
    const warnings: string[] = [];
    const errors: string[] = [];

    // Warn if custom type
    if (!isWellKnownIntentType(this._type)) {
      warnings.push(
        `Intent type "${this._type}" is not a well-known type. ` +
        `Ensure a renderer is registered for this type.`,
      );
    }

    // Generate intentId if not provided
    const intentId = this._intentId ?? generateUUID();

    const raw: IntentPayloadInput = {
      version: this._version,
      intentId,
      type: this._type,
      domain: this._domain,
      primaryGoal: this._primaryGoal,
      confidence: this._confidence,
      ambiguities: this._ambiguities,
      data: this._data,
      priorityFields: this._priorityFields,
      actions: this._actions,
      density: this._density,
      layoutHint: this._layoutHint,
      explain: this._explain,
      explainability: this._explainability,
    };

    // Validate envelope
    const envelopeResult = IntentPayloadSchema.safeParse(raw);
    let envelopeError: ZodError | undefined;
    if (!envelopeResult.success) {
      envelopeError = envelopeResult.error;
      errors.push(
        `IntentPayload envelope validation failed: ` +
        envelopeResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
      );
    }

    // Validate data shape
    const dataValidation = validateIntentData(this._type, this._data);
    if (!dataValidation.valid) {
      warnings.push(...dataValidation.warnings);
    }

    if (errors.length > 0) {
      return {
        success: false,
        warnings,
        errors,
        envelopeError,
        dataError: dataValidation.zodErrors,
      };
    }

    return {
      success: true,
      intent: raw,
      warnings,
      errors: [],
      dataError: dataValidation.zodErrors,
    };
  }

  /**
   * Build the intent payload. Throws if envelope validation fails.
   * Data validation issues are logged as warnings but don't prevent build.
   */
  build(): IntentPayloadInput {
    const result = this.buildResult();

    if (result.warnings.length > 0) {
      console.warn('[IntentBuilder] Warnings:', result.warnings);
    }

    if (!result.success) {
      throw new Error(
        `IntentBuilder validation failed:\n` +
        result.errors.join('\n'),
      );
    }

    return result.intent!;
  }
}
