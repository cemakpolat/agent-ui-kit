/**
 * HARI × OpenAI — Reference Integration
 *
 * This file is the canonical example of how to connect an OpenAI LLM to the
 * HARI perception pipeline. It demonstrates:
 *
 *   1. A system prompt that produces valid SituationalPerception JSON
 *   2. STRICT validation of LLM output (never render unvalidated output)
 *   3. LLMValidationError → insufficientInformation view (the correct fallback)
 *   4. Authority mode surfaces only what the human is authorized to see
 *   5. checkPerceptionMisuse() catches subtle anti-patterns at dev time
 *
 * Rules this integration follows (CONFORMANCE.md):
 *   - Every perception has an originatingQuestion (min 10 chars, not generic)
 *   - Every view has expiresAt OR invalidationCondition
 *   - Confidence is never fabricated (the LLM is prompted to hedge)
 *   - No approval can occur on expired perception
 *   - STRICT mode is used — corrupt LLM output NEVER reaches the renderer
 *
 * To run:
 *   OPENAI_API_KEY=sk-xxx npx tsx examples/openai/index.ts
 *
 * Prerequisites:
 *   npm install openai
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

// ── Configuration ────────────────────────────────────────────────────────────

const OPENAI_MODEL = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';
const AUTHORITY_MODE: AuthorityMode = 'observe'; // Change to 'approve' for approval flows

// ── System prompt ─────────────────────────────────────────────────────────────
// This prompt is the interface contract between your agent and HARI.
// Any change here must be validated against the STRICT schema test suite.

function buildSystemPrompt(question: string): string {
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // +15 min

  return `You are a system intelligence agent that provides structured, schema-valid
situational perception to human operators. You must respond with ONLY a JSON object.

CURRENT TIME: ${now}

THE HUMAN'S QUESTION: "${question}"

You must produce a JSON object matching this exact structure. Do NOT add prose before
or after the JSON. Do NOT wrap in markdown code blocks.

{
  "perceptionId": "<uuid>",
  "schemaVersion": "1.0.0",
  "originatingQuestion": "<the exact question from the human — verbatim>",
  "generatedAt": "${now}",
  "agentId": "openai-agent",
  "view": {
    "situationId": "<uuid>",
    "question": "<the exact question — verbatim>",
    "scope": {
      "systems": ["<list the systems you examined>"],
      "timeWindow": "PT15M",
      "riskLevel": "low|medium|high|critical"
    },
    "confidence": <0.0 to 1.0 — reflect real uncertainty, never use 0.99 or 1.0>,
    "unknowns": ["<what you do NOT know>"],
    "assumptions": ["<what you are assuming>"],
    "generatedAt": "${now}",
    "expiresAt": "${expiresAt}",
    "status": "active",
    "renderContract": {
      "id": "<uuid>",
      "version": "1.0.0",
      "domain": "operations",
      "type": "chat",
      "confidence": <same as above>,
      "density": "operator",
      "primaryGoal": "<one sentence — what should the human understand?>",
      "data": {
        "messages": [
          {
            "id": "<uuid>",
            "role": "agent",
            "content": "<your answer to the question>",
            "timestamp": "${now}"
          }
        ]
      }
    }
  },
  "evidence": [
    {
      "source": "<system name>",
      "excerpt": "<the raw data that supports your answer>",
      "timestamp": "${now}",
      "confidence": <0.0 to 1.0>
    }
  ],
  "recommendations": []
}

CRITICAL RULES:
- confidence must reflect true uncertainty. If you don't have real data, use 0.3–0.5.
- unknowns must be non-empty if you don't have direct system access.
- evidence must match the systems in scope.
- Never fabricate metrics you don't have.`;
}

// ── LLM call ─────────────────────────────────────────────────────────────────

async function callOpenAI(question: string): Promise<string> {
  // Dynamic import — keeps this example runnable without openai as a workspace dep
  const { default: OpenAI } = await import('openai' as string).catch(() => {
    throw new Error(
      'OpenAI SDK not installed. Run: npm install openai\n' +
      'Then set OPENAI_API_KEY in your environment.',
    );
  }) as { default: { new(opts: { apiKey: string }): { chat: { completions: { create: (opts: unknown) => Promise<{ choices: Array<{ message: { content: string | null } }> }> } } } } };

  const client = new OpenAI({ apiKey: process.env['OPENAI_API_KEY'] ?? '' });

  const response = await client.chat.completions.create({
    model: OPENAI_MODEL,
    messages: [
      { role: 'system', content: buildSystemPrompt(question) },
      { role: 'user', content: question },
    ],
    temperature: 0.2,    // Low temp: more deterministic JSON
    max_tokens: 1500,
    response_format: { type: 'json_object' }, // GPT-4o-mini supports this
  });

  const content = response.choices[0]?.message.content;
  if (!content) throw new Error('OpenAI returned empty content');
  return content;
}

// ── Perception pipeline ───────────────────────────────────────────────────────

async function perceive(question: string): Promise<SituationalPerception | null> {
  // 1. Call the LLM
  const raw = await callOpenAI(question);

  // 2. Parse JSON (structural check)
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    console.error('[HARI] LLM returned non-JSON. Refusing to render.');
    return null;
  }

  // 3. Validate perception with STRICT schema enforcement
  //    If the LLM produces invalid output, we do NOT render it.
  try {
    const perception = SituationalPerceptionSchema.parse(json);

    // 4. Dev-mode misuse checks (fires warnings, never throws)
    checkPerceptionMisuse(
      {
        originatingQuestion: perception.originatingQuestion,
        confidence: perception.view.confidence,
        view: { expiresAt: perception.view.expiresAt ?? null },
        evidence: perception.evidence,
        recommendations: perception.recommendations,
      },
      'openai-integration',
    );

    return perception;

  } catch (err) {
    if (err instanceof LLMValidationError) {
      // STRICT mode: render insufficientInformation, not the corrupt payload
      console.error('[HARI] STRICT validation failed:\n', err.violations.join('\n  '));
    } else {
      // Zod parse error: schema mismatch
      console.error('[HARI] Schema validation failed:', err);
    }
    return null; // Caller should surface an "Insufficient Information" view
  }
}

// ── Render pipeline ───────────────────────────────────────────────────────────

function render(perception: SituationalPerception, authorityMode: AuthorityMode): void {
  // 1. Verify the view is still valid before rendering anything
  assertPerceptionNotExpired(perception.view);

  const view = perception.view;

  console.log('\n─────────────────────────────────────────────────────');
  console.log(`QUESTION    : ${perception.originatingQuestion}`);
  console.log(`AUTHORITY   : ${authorityMode.toUpperCase()}`);
  console.log(`CONFIDENCE  : ${(view.confidence * 100).toFixed(0)}%`);
  console.log(`EXPIRES     : ${view.expiresAt ?? `on: ${view.invalidationCondition}`}`);
  console.log(`UNKNOWNS    : ${view.unknowns.join('; ') || 'none declared'}`);
  console.log('─────────────────────────────────────────────────────');

  // 2. Compile intent through HARI's registry
  const registry = new ComponentRegistryManager();
  try {
    const compiled = compileIntent(view.renderContract, registry, {
      validationMode: 'STRICT',
    });
    console.log(`COMPILED    : ${compiled.domain}/${compiled.type} — ${compiled.primaryGoal}`);
  } catch (err) {
    if (err instanceof LLMValidationError) {
      console.error('[HARI] Intent compilation failed (STRICT):', err.violations);
    }
  }

  // 3. Authority gate: observe mode = no approval controls surfaced
  if (authorityMode === 'observe') {
    console.log('VIEW MODE   : Read-only. Escalate to approve mode to take action.');
  } else if (authorityMode === 'approve') {
    console.log('VIEW MODE   : Approval controls available. Authority is logged.');
  }
  console.log('─────────────────────────────────────────────────────\n');
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const question =
    process.argv[2] ??
    'Is the payment service healthy enough to resume processing orders?';

  console.log(`\n[HARI] Perceiving: "${question}"`);
  console.log(`[HARI] Model: ${OPENAI_MODEL} | Validation: STRICT | Authority: ${AUTHORITY_MODE}`);

  const perception = await perceive(question);

  if (!perception) {
    console.log('\n[HARI] Insufficient information — rendering error state.');
    console.log('       The LLM output did not meet the perception contract.');
    console.log('       Show the human: "The agent could not produce a valid assessment."');
    return;
  }

  render(perception, AUTHORITY_MODE);
}

main().catch((err) => {
  console.error('[HARI] Fatal error:', err.message);
  process.exit(1);
});
