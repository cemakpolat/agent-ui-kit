// ─────────────────────────────────────────────────────────────────────────────
// HARI — Development-Only Misuse Warnings
//
// These warnings fire only when process.env.NODE_ENV !== 'production'.
// They catch patterns that are not schema violations but strongly indicate
// incorrect use of HARI.
//
// Rules:
//   - Each warning fires at most once per unique call site (deduped by key).
//   - Warnings are never thrown — they log and return.
//   - All warnings are suppressed in production.
//   - The warning key is stable — tests can assert on it.
//
// See ANTI-PATTERNS.md for the full description of each pattern.
// ─────────────────────────────────────────────────────────────────────────────

const _warned = new Set<string>();

function warn(key: string, message: string, detail?: string): void {
  const isProduction = typeof globalThis !== 'undefined' && 
    (globalThis as any).process?.env?.NODE_ENV === 'production';
  if (isProduction) {
    return;
  }
  if (_warned.has(key)) return;
  _warned.add(key);

  const lines = [`[HARI] ${message}`];
  if (detail) lines.push(`       ${detail}`);
  lines.push('       See ANTI-PATTERNS.md for the correct pattern.');
  console.warn(lines.join('\n'));
}

/** @internal — clears the dedup set. For use in tests only. */
export function _clearWarnings(): void {
  _warned.clear();
}

/** @internal — returns a copy of the warned-key set. For use in tests only. */
export function _warnedKeys(): ReadonlySet<string> {
  return new Set(_warned);
}

// ─────────────────────────────────────────────────────────────────────────────
// Warning: rendering without a question
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Warn when a SituationalPerception is dispatched without an originating question,
 * or with a generic question that provides no anchor for judgment.
 *
 * Anti-pattern: Rendering Without a Question (ANTI-PATTERNS.md §5)
 */
export function warnIfNoQuestion(
  originatingQuestion: string | undefined | null,
  callSite = 'unknown',
): void {
  const key = `no-question:${callSite}`;

  if (!originatingQuestion || originatingQuestion.trim().length === 0) {
    warn(
      key,
      'Rendering without a question.',
      'Every SituationalPerception must have an `originatingQuestion`. ' +
      'Without a question, the human has no anchor for judgment.',
    );
    return;
  }

  const GENERIC_LABELS = [
    'status', 'update', 'info', 'data', 'result', 'report',
    'overview', 'summary', 'details', 'view', 'dashboard',
  ];
  const lower = originatingQuestion.toLowerCase().trim();
  if (GENERIC_LABELS.includes(lower)) {
    warn(
      key,
      `Generic question detected: "${originatingQuestion}"`,
      'Questions must express specific human intent, not category labels. ' +
      'Bad: "status". Good: "Is the payment service healthy enough to resume processing?"',
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Warning: long-lived view
// ─────────────────────────────────────────────────────────────────────────────

const LONG_LIVED_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Warn when a view's `expiresAt` is more than 24 hours in the future.
 * Views that live longer than a day are dashboards in disguise.
 *
 * Anti-pattern: Long-Lived Views (ANTI-PATTERNS.md §6)
 */
export function warnIfLongLivedView(
  expiresAt: string | null | undefined,
  callSite = 'unknown',
): void {
  if (!expiresAt) return; // Schema will catch the missing-expiry case
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms > LONG_LIVED_THRESHOLD_MS) {
    const hours = Math.round(ms / 3_600_000);
    warn(
      `long-lived:${callSite}`,
      `Long-lived view detected (expires in ~${hours}h).`,
      'Perceptions should expire when the information is no longer decision-relevant. ' +
      '> 24h views are dashboards in disguise. Reduce the expiry window.',
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Warning: suspiciously high confidence
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Warn when confidence >= 0.99. This almost always means the LLM is returning
 * an uncalibrated constant rather than a real uncertainty estimate.
 *
 * Anti-pattern: Skipping Uncertainty (ANTI-PATTERNS.md §3)
 */
export function warnIfUncalibratedConfidence(
  confidence: number,
  callSite = 'unknown',
): void {
  if (confidence >= 0.99) {
    warn(
      `uncalibrated-confidence:${callSite}`,
      `Suspiciously high confidence: ${confidence}.`,
      'Confidence of 0.99+ is almost always an uncalibrated constant from the LLM. ' +
      'Ensure your system prompt instructs the LLM to reflect actual uncertainty.',
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Warning: empty evidence array
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Warn when recommendations are present but evidence is absent or empty.
 * Recommendations without evidence are ungrounded advocacy, not perception.
 *
 * Anti-pattern: Skipping Uncertainty (ANTI-PATTERNS.md §3)
 */
export function warnIfRecommendationsWithoutEvidence(
  evidence: unknown[] | undefined,
  recommendations: unknown[] | undefined,
  callSite = 'unknown',
): void {
  const hasRecs = recommendations && recommendations.length > 0;
  const hasEvidence = evidence && evidence.length > 0;
  if (hasRecs && !hasEvidence) {
    warn(
      `recs-without-evidence:${callSite}`,
      'Recommendations present but evidence array is empty.',
      'Recommendations must be grounded in evidence. ' +
      'An agent that advocates without evidence is not providing perception — it is lobbying.',
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Warning: no expiration set (pre-validation, for JS consumers who skip Zod)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Warn when neither `expiresAt` nor `invalidationCondition` is present.
 * This will already be caught by SituationalViewSchema.refine() when Zod
 * validation runs, but this catches it earlier for consumers who skip validation.
 *
 * Anti-pattern: The Dashboard (ANTI-PATTERNS.md §1)
 */
export function warnIfNoExpiration(
  expiresAt: string | null | undefined,
  invalidationCondition: string | null | undefined,
  callSite = 'unknown',
): void {
  if (!expiresAt && !invalidationCondition) {
    warn(
      `no-expiration:${callSite}`,
      'No expiration set on view (neither `expiresAt` nor `invalidationCondition`).',
      'HARI requires every view to declare when it expires. ' +
      'A view with no expiry is a dashboard. Dashboards are not HARI.',
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Composite: check a full SituationalPerception for common misuse patterns
// ─────────────────────────────────────────────────────────────────────────────

export interface PerceptionMisuseCheckInput {
  originatingQuestion?: string | null;
  confidence?: number | null;
  view?: {
    expiresAt?: string | null;
    invalidationCondition?: string | null;
  } | null;
  evidence?: unknown[];
  recommendations?: unknown[];
}

/**
 * Run all dev-mode misuse checks against a SituationalPerception-like object.
 * Call this before (or instead of) full Zod validation during development.
 *
 * All warnings are deduplicated per call site, so it is safe to call this
 * on every render cycle.
 *
 * @example
 * ```ts
 * import { checkPerceptionMisuse } from '@hari/core';
 * checkPerceptionMisuse(perception, 'MyComponent');
 * ```
 */
export function checkPerceptionMisuse(
  input: PerceptionMisuseCheckInput,
  callSite = 'unknown',
): void {
  warnIfNoQuestion(input.originatingQuestion, callSite);

  if (input.confidence != null) {
    warnIfUncalibratedConfidence(input.confidence, callSite);
  }

  if (input.view) {
    warnIfNoExpiration(input.view.expiresAt, input.view.invalidationCondition, callSite);
    warnIfLongLivedView(input.view.expiresAt, callSite);
  }

  warnIfRecommendationsWithoutEvidence(input.evidence, input.recommendations, callSite);
}
