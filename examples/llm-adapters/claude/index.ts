/**
 * HARI × Anthropic Claude 3.5 Sonnet — Reference Integration
 *
 * This file demonstrates how to connect Claude's native "Tool Use" (function
 * calling) output directly to HARI's SituationalPerception pipeline.
 *
 * Key design choices:
 *
 *   WHY TOOL USE instead of JSON mode?
 *   ────────────────────────────────────
 *   Claude's Tool Use is structurally stricter than asking for JSON in the
 *   system prompt.  The model generates a typed `tool_use` content block whose
 *   `input` field is already parsed JSON — guaranteed by the Anthropic SDK.
 *   This eliminates the parse-fail class of errors seen with prompt-engineered
 *   JSON output.
 *
 *   MAPPING Tool Use → SituationalPerception
 *   ─────────────────────────────────────────
 *   Claude returns tool_use blocks with:
 *     tool_use.input  ──► SituationalPerception (via Zod validation)
 *
 *   The tool definition IS the schema contract.  We describe every required
 *   field (originatingQuestion, view, evidence, recommendations) as tool
 *   parameters so the model is unable to omit them.
 *
 *   UNCERTAINTY mapping (Claude → HARI):
 *   ─────────────────────────────────────
 *   Claude's tool parameters include:
 *     `view.confidence`   ──► used directly as SituationalView.confidence
 *     `view.unknowns`     ──► epistemic uncertainty (things Claude doesn't know)
 *     `view.assumptions`  ──► assumption list surfaced by UncertaintyIndicators
 *     `evidence[].confidence` ──► per-source reliability score
 *
 *   EVIDENCE mapping (Claude → HARI):
 *   ────────────────────────────────────
 *   Each tool call argument in `evidence` maps to an EvidenceEntry:
 *     source      — the system / dataset Claude examined
 *     excerpt     — the raw observation Claude extracted
 *     timestamp   — ISO 8601 time Claude associates with the data point
 *     confidence  — Claude's self-rated reliability for this evidence
 *
 * To run:
 *   ANTHROPIC_API_KEY=sk-ant-xxx npx tsx examples/llm-adapters/claude/index.ts
 *   ANTHROPIC_API_KEY=sk-ant-xxx npx tsx examples/llm-adapters/claude/index.ts "Is our auth service degraded?"
 *
 * Prerequisites:
 *   npm install @anthropic-ai/sdk
 *   (or:  pnpm add @anthropic-ai/sdk --filter @hari/examples-claude)
 */

import { randomUUID } from 'crypto';
import {
  SituationalPerceptionSchema,
  LLMValidationError,
  compileIntent,
  ComponentRegistryManager,
  checkPerceptionMisuse,
  assertPerceptionNotExpired,
} from '@hari/core';
import type { SituationalPerception, AuthorityMode } from '@hari/core';

// ── Configuration ─────────────────────────────────────────────────────────────

const CLAUDE_MODEL = process.env['CLAUDE_MODEL'] ?? 'claude-3-5-sonnet-20241022';
const AUTHORITY_MODE: AuthorityMode = 'observe';

// ── HARI Perception Tool Definition ──────────────────────────────────────────
//
// This tool description IS the schema contract sent to Claude.
// The model will populate every field described here.
//
// Design rule: the more precise the parameter descriptions, the more
// faithful the uncertainty and evidence mapping becomes.

const PERCEPTION_TOOL = {
  name: 'emit_situational_perception',
  description:
    'Emit a structured HARI SituationalPerception object. You MUST call this tool ' +
    'with all fields populated. Never respond with prose — always call this tool.',
  input_schema: {
    type: 'object' as const,
    required: ['perceptionId', 'schemaVersion', 'originatingQuestion', 'generatedAt', 'agentId', 'view', 'evidence', 'recommendations'],
    properties: {
      perceptionId: {
        type: 'string',
        description: 'A unique UUID for this perception response.',
      },
      schemaVersion: {
        type: 'string',
        description: 'Always "1.0.0".',
      },
      originatingQuestion: {
        type: 'string',
        description:
          'The exact question asked by the human — verbatim, unparaphrased.',
      },
      generatedAt: {
        type: 'string',
        description: 'ISO 8601 timestamp for when this perception was generated.',
      },
      agentId: {
        type: 'string',
        description: 'Identifier for this agent. Use "claude-3-5-sonnet-agent".',
      },
      view: {
        type: 'object',
        description: 'The situational view that directly answers the question.',
        required: ['situationId', 'question', 'scope', 'confidence', 'unknowns', 'assumptions', 'generatedAt', 'expiresAt', 'status', 'renderContract'],
        properties: {
          situationId: { type: 'string', description: 'UUID for the view.' },
          question: { type: 'string', description: 'Verbatim copy of the originating question.' },
          answerSummary: { type: 'string', description: 'One sentence answer.' },
          scope: {
            type: 'object',
            required: ['systems'],
            properties: {
              systems: {
                type: 'array',
                items: { type: 'string' },
                description: 'The systems or domains you examined to produce this view.',
              },
              timeWindow: { type: 'string', description: 'ISO 8601 duration, e.g. "PT15M".' },
              riskLevel: {
                type: 'string',
                enum: ['low', 'medium', 'high', 'critical'],
                description:
                  'Overall risk level of the situation. Use "high" or "critical" if you are uncertain.',
              },
            },
          },
          confidence: {
            type: 'number',
            minimum: 0,
            maximum: 1,
            description:
              'Your overall confidence in this view as a correct and complete answer. ' +
              'CRITICAL: reflect real uncertainty. If you lack direct system access or ' +
              'real metrics, use 0.3–0.55. Never use 0.99 or 1.0. ' +
              'Confidence < 0.5 triggers a mandatory uncertainty warning in the UI.',
          },
          unknowns: {
            type: 'array',
            items: { type: 'string' },
            description:
              'Things you do NOT know that are relevant to the question. ' +
              'Each unknown is rendered as an Epistemic Uncertainty indicator. ' +
              'Never leave this empty — list at least one unknown if you lack live data.',
          },
          assumptions: {
            type: 'array',
            items: { type: 'string' },
            description:
              'Assumptions you are making. Each appears in the UncertaintyIndicators ' +
              'panel so operators can review and challenge them.',
          },
          generatedAt: { type: 'string', description: 'ISO 8601 generation timestamp.' },
          expiresAt: {
            type: 'string',
            description:
              'ISO 8601 timestamp after which this view is considered stale. ' +
              'Typically generatedAt + 15 minutes for operational data.',
          },
          status: {
            type: 'string',
            enum: ['active', 'stale', 'expired', 'superseded', 'hypothetical'],
            description: 'Always "active" for a new perception.',
          },
          renderContract: {
            type: 'object',
            required: ['id', 'version', 'domain', 'type', 'confidence', 'density', 'primaryGoal', 'data'],
            properties: {
              id: { type: 'string', description: 'UUID.' },
              version: { type: 'string', description: 'Always "1.0.0".' },
              domain: {
                type: 'string',
                enum: ['operations', 'analytics', 'planning', 'communication', 'monitoring'],
                description: 'Which domain best describes the intent.',
              },
              type: {
                type: 'string',
                enum: ['chat', 'document', 'kanban', 'timeline', 'tree', 'diagram'],
                description: 'Renderer type. "chat" if plain text. "document" if structured report.',
              },
              confidence: { type: 'number', description: 'Same value as view.confidence.' },
              density: {
                type: 'string',
                enum: ['executive', 'operator', 'expert'],
                description: 'Use "operator" for most operational questions.',
              },
              primaryGoal: { type: 'string', description: 'One sentence: what should the human understand?' },
              data: {
                type: 'object',
                description:
                  'Renderer-specific payload. For "chat" type: { messages: [ { id, role, content, timestamp } ] }. ' +
                  'For "document" type: { title, sections: [ { id, title, confidence, blocks: [ ... ] } ] }.',
              },
            },
          },
        },
      },
      evidence: {
        type: 'array',
        description:
          'Evidence entries that support your view. ' +
          'Each entry represents one data source Claude examined. ' +
          'Every claim in the view should be traceable to at least one evidence entry. ' +
          'If you have no real data, include an entry with low confidence (0.2–0.4) noting the limitation.',
        items: {
          type: 'object',
          required: ['source', 'excerpt', 'timestamp', 'confidence'],
          properties: {
            source: { type: 'string', description: 'System or dataset name.' },
            excerpt: {
              type: 'string',
              description:
                'The raw observation that supports the view. Quote data or describe ' +
                'what you found. Do not paraphrase into conclusions here.',
            },
            timestamp: { type: 'string', description: 'ISO 8601 timestamp for this data point.' },
            confidence: {
              type: 'number',
              minimum: 0,
              maximum: 1,
              description:
                'Your confidence in this specific evidence source. ' +
                'Use 0.2–0.4 for inferred or assumed data. 0.7–0.9 for monitored metrics.',
            },
          },
        },
      },
      recommendations: {
        type: 'array',
        description: 'Optional recommended actions. Leave empty if none are appropriate.',
        items: {
          type: 'object',
          required: ['id', 'text', 'priority'],
          properties: {
            id: { type: 'string' },
            text: { type: 'string', description: 'One-sentence recommended action.' },
            priority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
            rationale: { type: 'string', description: 'Why this action is recommended.' },
          },
        },
      },
    },
  },
} as const;

// ── LLM call ──────────────────────────────────────────────────────────────────

async function callClaude(question: string): Promise<Record<string, unknown> | null> {
  // Dynamic import to keep example runnable without SDK as a workspace dep
  type AnthropicConstructor = new (opts: { apiKey: string }) => {
    messages: {
      create: (opts: {
        model: string;
        max_tokens: number;
        tools: unknown[];
        tool_choice: { type: string; name: string };
        messages: Array<{ role: string; content: string }>;
      }) => Promise<{
        content: Array<{
          type: string;
          name?: string;
          input?: Record<string, unknown>;
        }>;
      }>;
    };
  };

  const { default: Anthropic } = await import('@anthropic-ai/sdk' as string).catch(() => {
    throw new Error(
      '@anthropic-ai/sdk not installed.\n' +
      'Run:  npm install @anthropic-ai/sdk\n' +
      'Then: ANTHROPIC_API_KEY=sk-ant-... npx tsx examples/llm-adapters/claude/index.ts',
    );
  }) as { default: AnthropicConstructor };

  const client = new Anthropic({ apiKey: process.env['ANTHROPIC_API_KEY'] ?? '' });

  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  const systemPrompt = `You are a system intelligence agent embedded in a HARI (Human-Agent Runtime Interface)
platform. You have been asked to assess an operational situation and emit a
structured SituationalPerception using the emit_situational_perception tool.

CURRENT TIME: ${now}
DEFAULT EXPIRY: ${expiresAt}

CRITICAL RULES you must follow to comply with the HARI perception contract:

1. HONESTY ABOUT UNCERTAINTY
   You do not have real-time access to production systems.  Your knowledge has a
   training cutoff.  Therefore:
   - confidence MUST reflect this.  Use 0.3–0.55 for questions requiring live data.
   - unknowns MUST list what live data you'd need to give a definitive answer.
   - evidence MUST flag when data is inferred, not measured.

2. NO FABRICATED METRICS
   Do NOT invent specific numbers (e.g. "error rate is 2.3%").  Instead use
   qualitative reasoning ("error rate appears elevated based on described symptoms").

3. UNCERTAINTY IS MANDATORY TRANSPARENCY
   HARI will render your unknowns and assumptions in a dedicated UI panel.
   This is a feature, not a bug.  More unknowns = more operator trust.

4. TIME-BOUNDED VIEWS
   Always set expiresAt to ${expiresAt} unless the question implies a different
   validity window (e.g. "what happened last week" → longer window is fine).

5. ALWAYS CALL THE TOOL
   Never respond with text. Always call emit_situational_perception.`;

  const response = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 2048,
    tools: [PERCEPTION_TOOL],
    // Force Claude to call exactly our tool — no prose responses
    tool_choice: { type: 'tool', name: 'emit_situational_perception' },
    messages: [
      {
        role: 'user',
        content:
          `CURRENT TIME: ${now}\n\nQuestion from operator: "${question}"\n\n` +
          `Call emit_situational_perception with your complete assessment. ` +
          `perceptionId="${randomUUID()}", situationId="${randomUUID()}", ` +
          `renderContractId="${randomUUID()}".`,
      },
    ],
  });

  // Extract the tool_use block.  With tool_choice: { type: 'tool', name: ... }
  // Claude MUST return a tool_use block as the first content element.
  const toolBlock = response.content.find((b) => b.type === 'tool_use' && b.name === 'emit_situational_perception');

  if (!toolBlock || toolBlock.type !== 'tool_use' || !toolBlock.input) {
    console.error('[HARI] Claude did not return a tool_use block — unexpected response structure.');
    return null;
  }

  return toolBlock.input as Record<string, unknown>;
}

// ── Perception pipeline ───────────────────────────────────────────────────────

async function perceive(question: string): Promise<SituationalPerception | null> {
  // Step 1: Get tool_use output from Claude (already parsed JSON)
  const toolInput = await callClaude(question);
  if (!toolInput) return null;

  console.log('\n[HARI] Raw tool input received from Claude:');
  console.log(JSON.stringify(toolInput, null, 2));

  // Step 2: Validate against the HARI SituationalPerception schema (STRICT)
  //
  // This is the critical trust boundary.  Even though Claude used a strongly-
  // typed tool definition, we never trust unvalidated LLM output.  The Zod
  // schema is the authoritative contract.
  try {
    const perception = SituationalPerceptionSchema.parse(toolInput);

    // Step 3: Dev-mode misuse checks
    checkPerceptionMisuse(
      {
        originatingQuestion: perception.originatingQuestion,
        confidence: perception.view.confidence,
        view: { expiresAt: perception.view.expiresAt ?? null },
        evidence: perception.evidence,
        recommendations: perception.recommendations,
      },
      'claude-3-5-sonnet-adapter',
    );

    return perception;
  } catch (err) {
    if (err instanceof LLMValidationError) {
      console.error('[HARI] STRICT validation failed (LLMValidationError):');
      err.violations.forEach((v) => console.error('  •', v));
    } else {
      console.error('[HARI] Schema validation failed (Zod parse error):', err);
    }
    return null;
  }
}

// ── Uncertainty renderer (console) ────────────────────────────────────────────
//
// In a real UI this is rendered by <UncertaintyIndicators /> from @hari/ui.
// Here we print it to stdout to demonstrate the mapping.

function printUncertainty(perception: SituationalPerception): void {
  const { view } = perception;
  const confidencePct = (view.confidence * 100).toFixed(0);
  const level =
    view.confidence >= 0.75 ? 'HIGH' :
    view.confidence >= 0.5  ? 'MODERATE' :
                              'LOW ⚠';

  console.log(`\n┌─ UNCERTAINTY PROFILE ${'─'.repeat(35)}`);
  console.log(`│ Overall Confidence : ${confidencePct}% (${level})`);
  console.log(`│ Confidence < 50%   : ${view.confidence < 0.5 ? 'YES — UI warning displayed' : 'no'}`);

  if (view.unknowns.length > 0) {
    console.log(`│`);
    console.log(`│ Known Unknowns (Epistemic Uncertainty):`);
    view.unknowns.forEach((u) => console.log(`│   ? ${u}`));
  }

  if (view.assumptions.length > 0) {
    console.log(`│`);
    console.log(`│ Assumptions (UncertaintyIndicators panel):`);
    view.assumptions.forEach((a) => console.log(`│   ~ ${a}`));
  }

  console.log(`│`);
  console.log(`│ Evidence Sources   : ${perception.evidence.length}`);
  perception.evidence.forEach((e) => {
    const conf = (e.confidence * 100).toFixed(0);
    console.log(`│   [${conf}%] ${e.source}: "${e.excerpt.slice(0, 80)}${e.excerpt.length > 80 ? '…' : ''}"`);
  });

  console.log(`└${'─'.repeat(57)}`);
}

// ── Render pipeline ───────────────────────────────────────────────────────────

function render(perception: SituationalPerception, authorityMode: AuthorityMode): void {
  // 1. Enforce time-bounding — reject expired views before rendering anything
  assertPerceptionNotExpired(perception.view);

  const { view } = perception;

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log(`HARI Perception Output — Claude 3.5 Sonnet Adapter`);
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`Question    : ${perception.originatingQuestion}`);
  console.log(`Agent       : ${perception.agentId}`);
  console.log(`Model       : ${CLAUDE_MODEL}`);
  console.log(`Authority   : ${authorityMode.toUpperCase()}`);
  console.log(`Confidence  : ${(view.confidence * 100).toFixed(0)}%`);
  console.log(`Expires     : ${view.expiresAt ?? `on condition: ${view.invalidationCondition}`}`);
  console.log(`Status      : ${view.status}`);
  console.log('───────────────────────────────────────────────────────────');

  if (view.answerSummary) {
    console.log(`Summary     : ${view.answerSummary}`);
  }

  console.log(`Scope       : ${view.scope.systems.join(', ')} | risk=${view.scope.riskLevel ?? 'unspecified'}`);

  // 2. Print uncertainty analysis (in UI: rendered by <UncertaintyIndicators />)
  printUncertainty(perception);

  // 3. Compile intent through the HARI registry
  const registry = new ComponentRegistryManager();
  try {
    const compiled = compileIntent(view.renderContract, registry, { validationMode: 'STRICT' });
    console.log(`\n[Renderer] ${compiled.domain}/${compiled.type} — "${compiled.primaryGoal}"`);
    console.log(`[Renderer] Density: ${compiled.density}`);
  } catch (err) {
    if (err instanceof LLMValidationError) {
      console.error('[HARI] Intent compilation failed (STRICT):', err.violations);
    } else {
      console.error('[HARI] Intent compilation error:', err);
    }
  }

  // 4. Authority gate
  console.log(`\n[Authority] Mode: ${authorityMode}`);
  if (authorityMode === 'observe') {
    console.log('[Authority] Read-only. Human is observing. No actions can be triggered.');
  } else if (authorityMode === 'approve') {
    console.log('[Authority] Approval mode. HARI governance controls surfaced.');
    if (perception.recommendations.length > 0) {
      console.log('[Authority] Pending recommendations:');
      perception.recommendations.forEach((r) =>
        console.log(`  [${r.priority.toUpperCase()}] ${r.text}`),
      );
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════\n');
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const question =
    process.argv[2] ??
    'Is the authentication service healthy enough to support tonight\'s planned deployment?';

  console.log(`\n[HARI] Claude 3.5 Sonnet Adapter`);
  console.log(`[HARI] Model        : ${CLAUDE_MODEL}`);
  console.log(`[HARI] Validation   : STRICT (Zod schema)`);
  console.log(`[HARI] Authority    : ${AUTHORITY_MODE}`);
  console.log(`[HARI] Question     : "${question}"\n`);
  console.log('[HARI] Calling Claude via Tool Use...');

  const perception = await perceive(question);

  if (!perception) {
    console.log('\n[HARI] Insufficient information — rendering error state.');
    console.log('       The Claude tool output did not meet the HARI perception contract.');
    console.log('       UI should surface: "The agent could not produce a valid assessment."');
    process.exit(1);
  }

  render(perception, AUTHORITY_MODE);
}

main().catch((err) => {
  console.error('[HARI] Fatal error:', err instanceof Error ? err.message : err);
  process.exit(1);
});
