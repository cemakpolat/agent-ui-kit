# HARI — Reference Integrations

These are the canonical reference integrations for HARI v1.0.0. Each example
demonstrates exactly how to connect an LLM or backend agent to the HARI perception
pipeline — following the spec, not working around it.

## Rules All Examples Follow

Every example in this directory enforces the same invariants:

| Rule | Enforcement |
|---|---|
| `originatingQuestion` is specific and non-generic | `checkPerceptionMisuse()` warns; schema rejects < 10 chars |
| `expiresAt` or `invalidationCondition` required | `SituationalPerceptionSchema` — parse fails if absent |
| Confidence is never fabricated | System prompts explicitly prohibit 0.99/1.0 |
| STRICT validation mode | `LLMValidationError` triggers "Insufficient Information" view |
| Expired perceptions blocked | `assertPerceptionNotExpired()` called before render |
| No auto-approval | Authority mode must be `approve` or `override` for actions |

These are not optional settings. They are part of the perception contract
(`CONFORMANCE.md`). Any integration that skips them is not HARI-compatible.

---

## Examples

### `openai/` — OpenAI Integration

Connects GPT-4o-mini (or any OpenAI model) to the HARI perception pipeline.

**When to use:** Cloud-hosted LLM, best JSON compliance, supports `response_format: json_object`.

```bash
OPENAI_API_KEY=sk-xxx npx tsx examples/openai/index.ts
# With a custom question:
OPENAI_API_KEY=sk-xxx npx tsx examples/openai/index.ts "Is the database replica lag within safe bounds?"
```

**Key patterns:**
- `buildSystemPrompt()` — the system prompt is the interface contract; changes must be validated
- `SituationalPerceptionSchema.parse()` — rejects invalid LLM output (never renders corrupt data)
- `LLMValidationError` catch → "Insufficient Information" fallback (never swallow and render)

**Dependencies:**
```bash
npm install openai
```

---

### `ollama/` — Ollama Local Integration

Runs entirely on your machine — no data leaves. Architecturally identical to the OpenAI
integration. The perception contract is the same; only the LLM transport differs.

**When to use:** Air-gapped environments, privacy-sensitive data, development without API credits.

```bash
# 1. Start Ollama
ollama serve

# 2. Pull a model (do this once)
ollama pull llama3.2:latest

# 3. Run
npx tsx examples/ollama/index.ts
# With a custom model:
OLLAMA_MODEL=mistral:latest npx tsx examples/ollama/index.ts "Is the API gateway healthy?"
```

**Key patterns:**
- `checkOllama()` health check before burning LLM latency
- `extractJSON()` — handles markdown-wrapped JSON from models that ignore instructions
- Shorter `expiresAt` (10 min vs 15 min) — local models are less reliable, treat outputs as more perishable

**Recommended models:** `llama3.2:latest`, `mistral:latest`, `phi3:mini`

---

### `backend-orchestration/` — Multi-Agent Coordination

Three specialized agents (MetricsAgent, LogsAgent, AuditAgent) running in parallel,
coordinated by a single orchestrator. Each agent issues its own `SituationalPerception`.
The coordinator ranks them by priority and applies authority gating.

**When to use:** Complex systems where no single agent has full context; multi-domain monitoring.

```bash
# Default (observe mode)
npx tsx examples/backend-orchestration/index.ts

# With approve mode (surfaces governed actions + records decisions)
npx tsx examples/backend-orchestration/index.ts \
  "Is the payment service healthy enough to resume batch orders?" \
  approve
```

**Key architecture decisions:**
- Agents run in **parallel** (`Promise.allSettled`) — coordinator never blocks on slowest
- Coordinator does **not** merge outputs — it ranks and surfaces them separately (preserves provenance)
- **Authority gate** filters recommendations in observe mode — zero controls surfaced without escalation  
- **Governed action** proposals are only surfaced at `approve` mode or above
- **Decision records** are immutable — `recordDecision()` appends to the audit log
- Expired perceptions are **filtered before reaching the human** (not surfaced with a warning)

---

## What These Examples Are NOT

These integrations follow the spec. They are not:

- **Templates to extend** — don't add new component types or modify the render contract shape
- **Starter kits** — the demo app (`packages/demo/`) is the UI reference implementation
- **Production agents** — agents in these examples return synthetic data; replace with real sources
- **Config files** — the system prompt is architectural, not configurable at runtime

## Common Integration Mistakes

See `ANTI-PATTERNS.md` for the full list. The most frequent in LLM integrations:

| Mistake | What Breaks |
|---|---|
| Not using STRICT mode | Hallucinated data reaches the renderer |
| Catching `LLMValidationError` and rendering anyway | Violates perception contract |
| Setting confidence to 0.99 always | Human sees fabricated certainty |
| Omitting `expiresAt` (schema allows it if `invalidationCondition` present) | `SituationalPerceptionSchema.refine()` will fail |
| Using generic `originatingQuestion` like "status" | `checkPerceptionMisuse()` warns; schema rejects < 10 chars |
| Surfacing recommendations in observe mode | Bypasses authority gate |

## Running with TypeScript Path Aliases

These examples import from `@hari/core` using the path aliases defined in the root
`tsconfig.json`. To run with `tsx`:

```bash
# From workspace root
npx tsx --tsconfig tsconfig.json examples/openai/index.ts
# Or with pnpm tsx (if installed in root devDependencies)
pnpm tsx examples/openai/index.ts
```

If you get `Cannot find module '@hari/core'`, run `pnpm build` in `packages/core/` first
or ensure `tsx` picks up the root `tsconfig.json`.
