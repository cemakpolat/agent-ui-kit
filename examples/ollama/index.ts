/**
 * HARI × Ollama — Reference Integration
 *
 * This file is the canonical example of a fully local HARI agent using Ollama.
 * It is architecturally identical to the OpenAI integration but runs entirely
 * on your machine — no data leaves. This is the correct pattern for:
 *
 *   - Air-gapped environments
 *   - Privacy-sensitive deployments (healthcare, finance, classified)
 *   - Development without API credits
 *   - Latency-critical paths where round-trip to a cloud LLM is unacceptable
 *
 * The perception contract and validation are IDENTICAL to the OpenAI version.
 * HARI does not care where the JSON came from — only that it is valid.
 *
 * Rules this integration follows (CONFORMANCE.md):
 *   - Every perception has an originatingQuestion (min 10 chars, not generic)
 *   - Every view has expiresAt OR invalidationCondition
 *   - Confidence calibrated for the model's real capability (smaller models → lower confidence)
 *   - STRICT mode used — Ollama output NEVER rendered unvalidated
 *   - Graceful fallback if Ollama is unavailable
 *
 * To run:
 *   1. Install Ollama: https://ollama.ai
 *   2. Pull a model: ollama pull llama3.2:latest
 *   3. npx tsx examples/ollama/index.ts
 *
 * Recommended models (in order of perception quality):
 *   llama3.2:latest       — fast, good JSON compliance, reasonable uncertainty
 *   mistral:latest        — strong instruction-following
 *   phi3:mini             — smallest footprint, adequate for simple queries
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

const OLLAMA_URL   = process.env['OLLAMA_URL']   ?? 'http://localhost:11434';
const OLLAMA_MODEL = process.env['OLLAMA_MODEL'] ?? 'llama3.2:latest';
const AUTHORITY_MODE: AuthorityMode = 'observe';

// ── System prompt ─────────────────────────────────────────────────────────────
// Note: smaller/local models are less reliable at JSON compliance.
// The prompt is intentionally more explicit than the OpenAI version.

function buildSystemPrompt(question: string): string {
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // +10 min (shorter for local)
  const perceptionId = randomUUID();
  const situationId  = randomUUID();
  const contractId   = randomUUID();
  const messageId    = randomUUID();
  const evidenceId   = randomUUID();

  return `You are a system intelligence agent. Respond ONLY with the JSON below.
No extra text. No markdown. No explanation. Only the JSON object.

Replace all <FILL> with your actual answer.

{
  "perceptionId": "${perceptionId}",
  "schemaVersion": "1.0.0",
  "originatingQuestion": ${JSON.stringify(question)},
  "generatedAt": "${now}",
  "agentId": "ollama-agent:${OLLAMA_MODEL}",
  "view": {
    "situationId": "${situationId}",
    "question": ${JSON.stringify(question)},
    "scope": {
      "systems": ["<FILL: name of system(s) this addresses>"],
      "timeWindow": "PT10M",
      "riskLevel": "<FILL: low|medium|high|critical>"
    },
    "confidence": <FILL: number 0.3–0.8, never use 0.99 or 1.0>,
    "unknowns": ["<FILL: what you genuinely don't know>"],
    "assumptions": ["<FILL: what you are assuming>"],
    "generatedAt": "${now}",
    "expiresAt": "${expiresAt}",
    "status": "active",
    "renderContract": {
      "id": "${contractId}",
      "version": "1.0.0",
      "domain": "operations",
      "type": "chat",
      "confidence": <FILL: same number as above>,
      "density": "operator",
      "primaryGoal": "<FILL: one sentence, what should the human understand>",
      "data": {
        "messages": [
          {
            "id": "${messageId}",
            "role": "agent",
            "content": "<FILL: your direct answer to the question>",
            "timestamp": "${now}"
          }
        ]
      }
    }
  },
  "evidence": [
    {
      "source": "<FILL: system or data source name>",
      "excerpt": "<FILL: the specific data point or observation>",
      "timestamp": "${now}",
      "confidence": <FILL: number 0.3–0.8>
    }
  ],
  "recommendations": []
}`;
}

// ── Ollama health check ───────────────────────────────────────────────────────

async function checkOllama(): Promise<boolean> {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

// ── LLM call ─────────────────────────────────────────────────────────────────

interface OllamaStreamChunk {
  response?: string;
  done?: boolean;
  error?: string;
}

async function callOllama(question: string): Promise<string> {
  const res = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      system: buildSystemPrompt(question),
      prompt: `Answer this question as JSON: ${question}`,
      stream: false,
      options: {
        temperature: 0.1,  // Very low — JSON must be deterministic
        num_predict: 1200,
      },
    }),
    signal: AbortSignal.timeout(60_000), // 60s — local models can be slow
  });

  if (!res.ok) {
    const text = await res.text().catch(() => 'unknown error');
    throw new Error(`Ollama API error ${res.status}: ${text}`);
  }

  const body = (await res.json()) as OllamaStreamChunk;
  if (body.error) throw new Error(`Ollama model error: ${body.error}`);
  if (!body.response) throw new Error('Ollama returned empty response');

  return body.response;
}

// ── JSON extraction ───────────────────────────────────────────────────────────
// Local models sometimes wrap JSON in markdown fences despite instructions.
// This extractor handles the common failure modes.

function extractJSON(raw: string): unknown {
  // Try direct parse first
  try {
    return JSON.parse(raw.trim());
  } catch { /* fall through */ }

  // Remove markdown code fences
  const stripped = raw
    .replace(/^```(?:json)?\s*/m, '')
    .replace(/\s*```\s*$/m, '')
    .trim();
  try {
    return JSON.parse(stripped);
  } catch { /* fall through */ }

  // Find first { ... } block
  const start = raw.indexOf('{');
  const end   = raw.lastIndexOf('}');
  if (start !== -1 && end > start) {
    try {
      return JSON.parse(raw.slice(start, end + 1));
    } catch { /* fall through */ }
  }

  return null;
}

// ── Perception pipeline ───────────────────────────────────────────────────────

async function perceive(question: string): Promise<SituationalPerception | null> {
  // 1. Health check before paying the latency cost of the LLM call
  const healthy = await checkOllama();
  if (!healthy) {
    console.error(`[HARI] Ollama not reachable at ${OLLAMA_URL}. Is it running?`);
    console.error(`       Start Ollama: ollama serve`);
    console.error(`       Pull model:   ollama pull ${OLLAMA_MODEL}`);
    return null;
  }

  // 2. Call the model
  let raw: string;
  try {
    raw = await callOllama(question);
  } catch (err) {
    console.error('[HARI] Ollama call failed:', (err as Error).message);
    return null;
  }

  // 3. Extract JSON from the response (handles markdown wrapping)
  const json = extractJSON(raw);
  if (!json) {
    console.error('[HARI] Could not extract JSON from Ollama output.');
    console.error('       Raw output:', raw.slice(0, 200));
    console.error('       Try a model with better instruction-following (llama3.2, mistral).');
    return null;
  }

  // 4. Validate with SituationalPerceptionSchema
  //    Local models are less reliable — STRICT is still used. Bad output = no render.
  try {
    const perception = SituationalPerceptionSchema.parse(json);

    // 5. Dev-mode misuse checks
    checkPerceptionMisuse(
      {
        originatingQuestion: perception.originatingQuestion,
        confidence: perception.view.confidence,
        view: { expiresAt: perception.view.expiresAt ?? null },
        evidence: perception.evidence,
        recommendations: perception.recommendations,
      },
      'ollama-integration',
    );

    return perception;

  } catch (err) {
    console.error('[HARI] Schema validation failed for Ollama output:');
    if (err instanceof Error) console.error('       ', err.message.split('\n')[0]);
    console.error('       Adjust the system prompt to fix structural compliance issues.');
    return null;
  }
}

// ── Render ────────────────────────────────────────────────────────────────────

function render(perception: SituationalPerception, authorityMode: AuthorityMode): void {
  assertPerceptionNotExpired(perception.view);

  const view = perception.view;

  console.log('\n─────────────────────────────────────────────────────');
  console.log(`QUESTION    : ${perception.originatingQuestion}`);
  console.log(`MODEL       : ${OLLAMA_MODEL} (local)`);
  console.log(`AUTHORITY   : ${authorityMode.toUpperCase()}`);
  console.log(`CONFIDENCE  : ${(view.confidence * 100).toFixed(0)}%`);
  console.log(`SYSTEMS     : ${view.scope.systems.join(', ')}`);
  console.log(`EXPIRES     : ${view.expiresAt ?? `on: ${view.invalidationCondition}`}`);
  console.log(`UNKNOWNS    : ${view.unknowns.join('; ') || 'none declared'}`);
  console.log('─────────────────────────────────────────────────────');

  const registry = new ComponentRegistryManager();
  try {
    const compiled = compileIntent(view.renderContract, registry, {
      validationMode: 'STRICT',
    });
    console.log(`COMPILED    : ${compiled.domain}/${compiled.type}`);
    console.log(`GOAL        : ${compiled.primaryGoal}`);
  } catch (err) {
    if (err instanceof LLMValidationError) {
      console.error('[HARI] Intent compilation failed (STRICT):', err.violations);
    }
  }

  console.log('─────────────────────────────────────────────────────\n');
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const question =
    process.argv[2] ??
    'Are there any active incidents affecting the API gateway right now?';

  console.log(`\n[HARI × Ollama] Perceiving: "${question}"`);
  console.log(`[HARI] Model: ${OLLAMA_MODEL} | URL: ${OLLAMA_URL} | Validation: STRICT`);

  const perception = await perceive(question);

  if (!perception) {
    console.log('\n[HARI] Insufficient information — Ollama could not produce valid perception.');
    console.log('       Show the human: "Local agent could not produce a valid assessment."');
    return;
  }

  render(perception, AUTHORITY_MODE);
}

main().catch((err) => {
  console.error('[HARI] Fatal error:', (err as Error).message);
  process.exit(1);
});
