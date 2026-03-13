# HARI LLM Adapters — Reference Implementations

This directory contains reference integrations showing how to adapt various LLM
provider APIs to HARI's `SituationalPerception` pipeline.

| Adapter | Model | Key Technique |
|---------|-------|---------------|
| [`claude/`](./claude/) | Claude 3.5 Sonnet | Tool Use → `SituationalPerception` |

---

## Claude 3.5 Sonnet (`claude/index.ts`)

### Overview

The Claude adapter uses Anthropic's **Tool Use** (function calling) feature as
the primary mechanism for generating structured HARI perception objects. This is
architecturally different from the OpenAI adapter which relies on `json_object`
response format + a prompt-embedded JSON spec.

### Why Tool Use instead of JSON mode?

| Concern | JSON mode approach | Tool Use approach |
|---|---|---|
| Schema enforcement | Prompt-engineered (fragile) | Tool `input_schema` (structural) |
| Parse reliability | Can fail with malformed JSON | SDK guarantees parsed `input` |
| Field completeness | Model may omit fields | `required[]` forces all fields |
| Misuse detection | After parse | Before LLM call |

### Mapping: Claude Tool Use → SituationalPerception

```
tool_use.input
│
├── perceptionId              ──► SituationalPerception.perceptionId
├── schemaVersion             ──► SituationalPerception.schemaVersion
├── originatingQuestion       ──► SituationalPerception.originatingQuestion
├── agentId                   ──► SituationalPerception.agentId
│
├── view
│   ├── confidence            ──► SituationalView.confidence
│   │                               < 0.5 → UI mandatory warning indicator
│   ├── unknowns[]            ──► SituationalView.unknowns
│   │                               → UncertaintyIndicators: Epistemic panel
│   ├── assumptions[]         ──► SituationalView.assumptions
│   │                               → UncertaintyIndicators: Assumptions panel
│   ├── scope.systems[]       ──► SituationalView.scope.systems
│   ├── scope.riskLevel       ──► SituationalView.scope.riskLevel
│   ├── expiresAt             ──► SituationalView.expiresAt (time-bounding)
│   └── renderContract        ──► IntentPayload (compiled by HARI registry)
│
└── evidence[]
    ├── source                ──► EvidenceEntry.source
    ├── excerpt               ──► EvidenceEntry.excerpt
    ├── timestamp             ──► EvidenceEntry.timestamp
    └── confidence            ──► EvidenceEntry.confidence
                                    (per-source reliability, shown in UI)
```

### Uncertainty Fields — HARI Doctrine

HARI mandates that uncertainty is **always visible**.  The Claude adapter
enforces this through three mechanisms:

1. **`view.confidence`** — forced by tool schema to be `0.0–1.0`. The system
   prompt explicitly instructs Claude to use `0.3–0.55` when lacking live data.
   Values `< 0.5` trigger a mandatory warning indicator in `<UncertaintyIndicators />`.

2. **`view.unknowns`** — rendered as the *Epistemic Uncertainty* panel. The tool
   schema marks this as required and the system prompt requires at least one entry
   when Claude lacks real-time access.

3. **`evidence[].confidence`** — per-source reliability score. Each evidence
   entry carries its own confidence so operators can see which claims have thin
   support.

### Time-Bounding

Every perception includes `expiresAt` (default: `generatedAt + 15 minutes`).
`assertPerceptionNotExpired()` is called before any render to enforce this at
the code level. Expired views are never passed to the renderer.

### Running

```bash
# Install the adapter's only runtime dependency
npm install @anthropic-ai/sdk

# Run with your API key
ANTHROPIC_API_KEY=sk-ant-... npx tsx examples/llm-adapters/claude/index.ts

# Ask a custom question
ANTHROPIC_API_KEY=sk-ant-... npx tsx examples/llm-adapters/claude/index.ts \
  "Is the payment service healthy enough to process Black Friday traffic?"

# Use a different Claude model
ANTHROPIC_API_KEY=sk-ant-... CLAUDE_MODEL=claude-3-haiku-20240307 \
  npx tsx examples/llm-adapters/claude/index.ts
```

### Expected Output

```
[HARI] Claude 3.5 Sonnet Adapter
[HARI] Model        : claude-3-5-sonnet-20241022
[HARI] Validation   : STRICT (Zod schema)
[HARI] Question     : "Is the authentication service healthy enough..."

═══════════════════════════════════════════════════════════
HARI Perception Output — Claude 3.5 Sonnet Adapter
═══════════════════════════════════════════════════════════
Confidence  : 42%
...

┌─ UNCERTAINTY PROFILE ───────────────────────────────────
│ Overall Confidence : 42% (LOW ⚠)
│ Confidence < 50%   : YES — UI warning displayed
│
│ Known Unknowns (Epistemic Uncertainty):
│   ? Real-time error rate from auth service monitoring
│   ? Current active session count
│
│ Assumptions (UncertaintyIndicators panel):
│   ~ Authentication service is in its normal operational state
└─────────────────────────────────────────────────────────
```

### Conformance Checklist

- [x] `originatingQuestion` is ≥ 10 chars, not generic
- [x] Every view has `expiresAt`
- [x] Confidence reflects real uncertainty (system prompt enforced)
- [x] `evidence` is non-empty
- [x] `unknowns` is non-empty when Claude has no real data
- [x] STRICT Zod validation applied before any render
- [x] `assertPerceptionNotExpired()` called before render
- [x] `checkPerceptionMisuse()` called in dev mode

---

## Adding More Adapters

To add a new LLM provider adapter (e.g. Gemini, Mistral, Cohere):

1. Create `examples/llm-adapters/<provider>/index.ts`
2. Map the provider's structured output to `SituationalPerception`
3. Always validate with `SituationalPerceptionSchema.parse()`
4. Always call `assertPerceptionNotExpired()` before render
5. Document the field mapping in a table (see Claude adapter above)
6. Add your adapter to the table in this README
