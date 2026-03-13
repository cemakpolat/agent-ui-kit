// ─────────────────────────────────────────────────────────────────────────────
// AI Governance Service — Phase 8.2
//
// A lightweight client that bridges the HARI governance system with a local
// Ollama instance (or any OpenAI-compatible endpoint) to provide:
//
//   1. Precondition suggestion — given an action description, suggest
//      relevant preconditions and their criticality
//
//   2. Assumption criticality evaluation — given an existing set of
//      preconditions, rank them by criticality and flag gaps
//
//   3. Justification summary generation — generate human-readable
//      justification summaries from a set of decision facts
//
// All features degrade gracefully when Ollama is offline.
// ─────────────────────────────────────────────────────────────────────────────

import { telemetry } from '@hari/core';

// ── Config ────────────────────────────────────────────────────────────────────

export interface AIGovernanceConfig {
  /** Ollama endpoint (default: http://localhost:11434) */
  ollamaUrl?: string;
  /** Model to use (default: llama3.2) */
  model?: string;
  /** Request timeout in ms (default: 30000) */
  timeoutMs?: number;
}

const DEFAULT_CONFIG: Required<AIGovernanceConfig> = {
  ollamaUrl: 'http://localhost:11434',
  model: 'llama3.2',
  timeoutMs: 30_000,
};

// ── Response types ────────────────────────────────────────────────────────────

export interface SuggestedPrecondition {
  description: string;
  verificationMethod: string;
  resolution: string;
  criticality: 'low' | 'medium' | 'high' | 'critical';
  rationale: string;
  /** Matched template ID if this suggestion aligns with a marketplace template */
  matchedTemplateId?: string;
}

export interface CriticalityEvaluation {
  preconditionDescription: string;
  assignedCriticality: 'low' | 'medium' | 'high' | 'critical';
  rationale: string;
  isRedundant: boolean;
  isMissing?: string; // description of a gap that was detected
}

export interface JustificationSummary {
  summary: string;
  keyDecisionPoints: string[];
  riskAcknowledgement: string;
  auditTrailNote: string;
}

export interface AIGovernanceResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  latencyMs: number;
  provider: string;
  model: string;
}

// ── JSON extraction ────────────────────────────────────────────────────────────

function extractJSON(text: string): unknown {
  // Try code block first
  const codeBlock = text.match(/```(?:json)?\s*([\s\S]+?)```/);
  if (codeBlock) {
    try { return JSON.parse(codeBlock[1].trim()); } catch { /* fall through */ }
  }
  // Try raw JSON object/array
  const jsonMatch = text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  if (jsonMatch) {
    try { return JSON.parse(jsonMatch[1]); } catch { /* fall through */ }
  }
  return null;
}

// ── Ollama client helper ──────────────────────────────────────────────────────

async function ollamaChat(
  config: Required<AIGovernanceConfig>,
  systemPrompt: string,
  userMessage: string,
): Promise<{ text: string; latencyMs: number }> {
  const start = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const response = await fetch(`${config.ollamaUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model: config.model,
        stream: false,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        options: {
          temperature: 0.3,
          top_p: 0.9,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama returned ${response.status}: ${response.statusText}`);
    }

    const data = await response.json() as { message?: { content?: string }; error?: string };
    if (data.error) throw new Error(data.error);

    const text = data.message?.content ?? '';
    return { text, latencyMs: Date.now() - start };
  } finally {
    clearTimeout(timeout);
  }
}

// ── AI Governance Service ─────────────────────────────────────────────────────

export class AIGovernanceService {
  private readonly config: Required<AIGovernanceConfig>;
  private readonly providerId: string;

  constructor(config: AIGovernanceConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.providerId = `ollama/${this.config.model}`;
  }

  // ── 8.2-A: Precondition Suggestion ───────────────────────────────────────

  /**
   * Given a plain-English description of an action, suggest relevant
   * preconditions with criticality ratings.
   *
   * @param actionDescription  e.g. "Deploy checkout-service v2.4 to production"
   * @param context            Optional domain context, reversibility, blast radius
   */
  async suggestPreconditions(
    actionDescription: string,
    context?: {
      domain?: string;
      reversibility?: string;
      blastRadius?: string;
      requiredAuthority?: string;
    },
  ): Promise<AIGovernanceResult<SuggestedPrecondition[]>> {
    const start = Date.now();
    const systemPrompt = `You are a governance expert who recommends preconditions for governed actions in software systems.

Your job is to suggest 3-6 concrete, actionable preconditions that must be true before an action can proceed safely.

Each precondition must have:
- description: what must be true
- verificationMethod: how to check it
- resolution: what to do if it's not met
- criticality: "low" | "medium" | "high" | "critical"
- rationale: why this precondition matters for this action

Respond ONLY with valid JSON in this format:
{
  "preconditions": [
    {
      "description": "...",
      "verificationMethod": "...",
      "resolution": "...",
      "criticality": "high",
      "rationale": "..."
    }
  ]
}`;

    const contextInfo = context
      ? `\nContext:\n- Domain: ${context.domain ?? 'general'}\n- Reversibility: ${context.reversibility ?? 'unknown'}\n- Blast radius: ${context.blastRadius ?? 'unknown'}\n- Required authority: ${context.requiredAuthority ?? 'approve'}`
      : '';

    const userMessage = `Action to govern: "${actionDescription}"${contextInfo}\n\nSuggest appropriate preconditions for this action.`;

    try {
      const { text, latencyMs } = await ollamaChat(this.config, systemPrompt, userMessage);
      const parsed = extractJSON(text) as { preconditions?: SuggestedPrecondition[] } | null;

      const suggestions = parsed?.preconditions ?? [];

      telemetry.emit({
        type: 'governance:ai_suggestion',
        actionDescription,
        suggestedCount: suggestions.length,
        acceptedCount: 0, // caller updates this via emitAccepted()
        provider: this.providerId,
        latencyMs,
        timestamp: new Date().toISOString(),
      });

      return { success: true, data: suggestions, latencyMs, provider: this.providerId, model: this.config.model };
    } catch (err) {
      const latencyMs = Date.now() - start;
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
        latencyMs,
        provider: this.providerId,
        model: this.config.model,
      };
    }
  }

  // ── 8.2-B: Assumption Criticality Evaluation ──────────────────────────────

  /**
   * Given an existing set of preconditions, evaluate their criticality and
   * identify any gaps or redundancies.
   *
   * @param preconditions  List of precondition descriptions
   * @param actionType     The type of action being governed
   */
  async evaluateCriticality(
    preconditions: string[],
    actionType: string,
  ): Promise<AIGovernanceResult<CriticalityEvaluation[]>> {
    const start = Date.now();
    const systemPrompt = `You are a governance risk analyst. You evaluate the criticality of preconditions for governed actions.

For each precondition, assign a criticality level:
- "critical": safety-critical, must never be skipped; waiving requires board-level override
- "high": important risk control; skipping would create significant exposure
- "medium": good practice; skipping increases risk but may be acceptable with documented rationale
- "low": nice-to-have; can be waived by approver-level authority

Also identify:
- Redundant preconditions (checking the same thing twice)
- Critical gaps (important preconditions missing from the list)

Respond ONLY with valid JSON:
{
  "evaluations": [
    {
      "preconditionDescription": "...",
      "assignedCriticality": "high",
      "rationale": "...",
      "isRedundant": false
    }
  ],
  "detectedGaps": [
    "Description of missing critical precondition"
  ]
}`;

    const userMessage = `Action type: "${actionType}"\n\nExisting preconditions:\n${preconditions.map((p, i) => `${i + 1}. ${p}`).join('\n')}\n\nEvaluate criticality and identify gaps.`;

    try {
      const { text, latencyMs } = await ollamaChat(this.config, systemPrompt, userMessage);
      const parsed = extractJSON(text) as {
        evaluations?: CriticalityEvaluation[];
        detectedGaps?: string[];
      } | null;

      const evaluations = parsed?.evaluations ?? [];
      const gaps = parsed?.detectedGaps ?? [];

      // Append gap notifications as synthetic evaluations
      for (const gap of gaps) {
        evaluations.push({
          preconditionDescription: `[GAP DETECTED] ${gap}`,
          assignedCriticality: 'high',
          rationale: 'AI detected this as a missing critical precondition',
          isRedundant: false,
          isMissing: gap,
        });
      }

      return { success: true, data: evaluations, latencyMs, provider: this.providerId, model: this.config.model };
    } catch (err) {
      const latencyMs = Date.now() - start;
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
        latencyMs,
        provider: this.providerId,
        model: this.config.model,
      };
    }
  }

  // ── 8.2-C: Justification Summary Generation ───────────────────────────────

  /**
   * Generate a human-readable justification summary from governance decision facts.
   * Suitable for inclusion in audit logs, compliance reports, or stakeholder comms.
   */
  async generateJustification(params: {
    actionDescription: string;
    decisionType: 'approved' | 'rejected';
    decidedBy: string;
    authority: string;
    preconditions: Array<{ description: string; status: string }>;
    additionalContext?: string;
  }): Promise<AIGovernanceResult<JustificationSummary>> {
    const start = Date.now();
    const systemPrompt = `You are a governance documentation specialist. You write clear, professional justification summaries for governed decisions.

A justification summary must:
1. State what was decided and by whom
2. Summarise the key preconditions that were (or were not) met
3. Acknowledge any risks accepted
4. Provide a clear audit trail note

Write in formal but accessible language. Be concise (3-4 sentences for summary).

Respond ONLY with valid JSON:
{
  "summary": "...",
  "keyDecisionPoints": ["...", "..."],
  "riskAcknowledgement": "...",
  "auditTrailNote": "..."
}`;

    const preconditionText = params.preconditions
      .map((p) => `  [${p.status.toUpperCase()}] ${p.description}`)
      .join('\n');

    const userMessage = `Decision: ${params.decisionType.toUpperCase()}
Action: "${params.actionDescription}"
Decided by: ${params.decidedBy} (authority: ${params.authority})
Preconditions:
${preconditionText}
${params.additionalContext ? `\nAdditional context: ${params.additionalContext}` : ''}

Generate a professional governance justification summary.`;

    try {
      const { text, latencyMs } = await ollamaChat(this.config, systemPrompt, userMessage);
      const parsed = extractJSON(text) as JustificationSummary | null;

      if (!parsed?.summary) {
        throw new Error('LLM did not return a valid justification summary');
      }

      telemetry.emit({
        type: 'governance:ai_justification',
        decisionId: `${params.decidedBy}-${Date.now()}`,
        provider: this.providerId,
        latencyMs,
        timestamp: new Date().toISOString(),
      });

      return { success: true, data: parsed, latencyMs, provider: this.providerId, model: this.config.model };
    } catch (err) {
      const latencyMs = Date.now() - start;
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
        latencyMs,
        provider: this.providerId,
        model: this.config.model,
      };
    }
  }

  // ── Health check ──────────────────────────────────────────────────────────

  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch(`${this.config.ollamaUrl}/api/tags`, {
        signal: AbortSignal.timeout(3000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  get providerLabel(): string {
    return `${this.config.ollamaUrl} · ${this.config.model}`;
  }
}

/** Singleton instance with default configuration. */
export const aiGovernance = new AIGovernanceService();
