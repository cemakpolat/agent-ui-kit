# How HARI Works with LLMs

**For integrators building human–agent interfaces on top of language models.**

---

## The Problem

Most LLM interfaces are prompt boxes.

You send a message. The LLM responds. The UI renders whatever the LLM outputs.

This is fine for chatbots. It is **dangerous for operational systems** where humans make high-stakes decisions based on what they see.

Problems with naive LLM-to-UI pipelines:

1. **The LLM invents UI.** The model decides font size, layout, emphasis. The human trusts the visual hierarchy more than the data.
2. **Confidence is hidden.** A 60% confident recommendation looks identical to a 98% confident one.
3. **Expired state is rendered.** The model answers based on stale context, and the UI shows it as current.
4. **Evidence and recommendations merge.** The human cannot tell what was observed versus what was suggested.
5. **There is no question.** The UI shows a summary of agent reasoning, not an answer to anything the human asked.

HARI solves all five problems with a single constraint: **the LLM cannot invent UI**.

---

## The 4-Stage Flow

```
╔══════════════════════════════════════════════════════════════════╗
║  Stage 1: Human Question                                        ║
║                                                                  ║
║    Human asks: "Is the EU payment cluster healthy?"             ║
║    → Captured as QuestionIntent (explicit or inferred)          ║
╚══════════════════════════╤═══════════════════════════════════════╝
                           │
                           ▼
╔══════════════════════════════════════════════════════════════════╗
║  Stage 2: LLM Reasoning                                         ║
║                                                                  ║
║    Model queries tools, aggregates context, reasons             ║
║    → Produces structured SituationalPerception JSON             ║
║    → NOT prose. NOT markdown. NOT "here is what I found."       ║
╚══════════════════════════╤═══════════════════════════════════════╝
                           │
                           ▼
╔══════════════════════════════════════════════════════════════════╗
║  Stage 3: Perception Contract Validation                        ║
║                                                                  ║
║    HARI validates the SituationalPerception schema               ║
║    → STRICT: reject invalid output, surface "Insufficient Info" ║
║    → LENIENT: collect warnings, render best-effort              ║
║    → DIAGNOSTIC: block render, return full error context        ║
╚══════════════════════════╤═══════════════════════════════════════╝
                           │
                           ▼
╔══════════════════════════════════════════════════════════════════╗
║  Stage 4: HARI Rendering                                        ║
║                                                                  ║
║    Intent compiler translates validated perception → React UI   ║
║    → Trust Surface: authority mode, confidence, validity        ║
║    → Question bar: the question being answered (always visible) ║
║    → Governed Actions: authority requests, not buttons          ║
║    → Decision Records: every governance event auto-recorded     ║
╚══════════════════════════════════════════════════════════════════╝
```

---

## What the LLM Must Produce

The LLM does not write HTML. It does not choose layouts. It does not decide what to emphasize.

It produces a **`SituationalPerception`** object:

```json
{
  "perceptionId": "550e8400-e29b-41d4-a716-446655440000",
  "schemaVersion": "1.0.0",
  "originatingQuestion": "Is the EU payment cluster healthy right now?",
  "submittedAt": "2026-03-02T14:23:00Z",
  "agentId": "claude-3-7-sonnet",
  "scope": {
    "systems": ["payment-gateway-eu", "postgres-eu-primary"],
    "timeWindow": "PT1H",
    "riskLevel": "high"
  },
  "view": {
    "situationId": "7b8e9f00-1a2b-3c4d-5e6f-7a8b9c0d1e2f",
    "question": "Is the EU payment cluster healthy right now?",
    "answerSummary": "Elevated latency detected on payment-gateway-eu. Database is healthy.",
    "scope": {
      "systems": ["payment-gateway-eu", "postgres-eu-primary"],
      "timeWindow": "PT1H",
      "riskLevel": "high"
    },
    "confidence": 0.87,
    "unknowns": ["Root cause of latency spike not yet identified"],
    "assumptions": ["Prometheus metrics are accurate and not delayed"],
    "generatedAt": "2026-03-02T14:23:00Z",
    "expiresAt": "2026-03-02T14:38:00Z",
    "status": "active",
    "priority": 80,
    "tags": ["payment", "latency", "eu"],
    "renderContract": {
      "version": "1.0.0",
      "intentId": "abc-123",
      "type": "diagnostic_overview",
      "domain": "cloudops",
      "primaryGoal": "Show EU payment cluster health with anomaly callouts",
      "confidence": 0.87,
      "density": "operator",
      "data": {
        "metrics": [
          { "name": "P99 Latency", "value": 847, "unit": "ms", "anomaly": true },
          { "name": "DB Connections", "value": 45, "unit": "count", "anomaly": false }
        ]
      },
      "actions": [],
      "ambiguities": [],
      "priorityFields": ["metrics"],
      "explain": false
    }
  },
  "evidence": [
    {
      "claim": "payment-gateway-eu P99 latency is 847ms",
      "source": "Prometheus /api/v1/query at 14:23 UTC",
      "confidence": 0.99
    }
  ],
  "recommendations": [
    {
      "action": "Investigate payment-gateway-eu pod logs for connection pool exhaustion",
      "rationale": "Latency pattern is consistent with connection pool saturation, not network latency",
      "confidence": 0.71
    }
  ]
}
```

---

## Bad LLM Behaviors (with examples)

### 1. Answering without a question

**Bad:**
```json
{ "originatingQuestion": "Dashboard" }
```
**HARI rejects:** Generic label — not a question.

**Good:**
```json
{ "originatingQuestion": "What is the current health of the EU payment cluster?" }
```

---

### 2. Claiming certainty on uncertain data

**Bad:**
```json
{
  "confidence": 1.0,
  "unknowns": []
}
```
**HARI warns:** Confidence 1.0 with empty unknowns is almost always dishonest.

**Good:**
```json
{
  "confidence": 0.82,
  "unknowns": ["Root cause not yet confirmed", "3 nodes unreachable — metrics estimated"]
}
```

---

### 3. No expiry declared

**Bad:**
```json
{
  "expiresAt": null,
  "invalidationCondition": null
}
```
**HARI rejects:** Schema validation fails. A view without an invalidation condition is a permanent dashboard.

**Good:**
```json
{ "expiresAt": "2026-03-02T14:38:00Z" }
```
Or:
```json
{ "invalidationCondition": "latency returns below 200ms P99 for 5 consecutive minutes" }
```

---

### 4. Mixing evidence and recommendations

**Bad:**
```json
{
  "evidence": [
    "Latency is 847ms and you should scale out the pods immediately"
  ]
}
```
This is **not** evidence — it is a recommendation disguised as a fact.

**Good:**
```json
{
  "evidence": [
    { "claim": "P99 latency is 847ms", "source": "Prometheus", "confidence": 0.99 }
  ],
  "recommendations": [
    { "action": "Scale out payment-gateway-eu by 2 replicas", "rationale": "Pod CPU > 90%", "confidence": 0.78 }
  ]
}
```

---

### 5. Inventing UI layout

**Bad:**
```json
{
  "renderContract": {
    "type": "custom_urgent_alert_dashboard_v2"
  }
}
```
**HARI warns:** Unknown type generates a compiler warning and requires an explicit renderer.

**Good:**
```json
{
  "renderContract": {
    "type": "diagnostic_overview"
  }
}
```

---

## How HARI Rejects Unsafe Outputs

HARI does not silently fail. It has three responses to bad LLM output:

### STRICT mode — throw, block, show "Insufficient Information"

```typescript
// In your render pipeline
try {
  const compiled = compileIntent(perception.view.renderContract, registry, {
    validationMode: 'STRICT',
  });
  render(compiled);
} catch (err) {
  if (err instanceof LLMValidationError) {
    renderInsufficientInformation({
      message: 'The agent could not produce a valid perception for this question.',
      violations: err.violations,
      question: perception.originatingQuestion,
    });
  }
}
```

The human sees a structured "Insufficient Information" view — not a blank screen, not a crash. This teaches them that the system is working correctly when it refuses to render bad output.

### LENIENT mode — warn, render best-effort

Suitable for development. Violations appear as warnings in the debug panel. Do not use in production approval flows.

### DIAGNOSTIC mode — block, return full context

```typescript
const compiled = compileIntent(intent, registry, { validationMode: 'DIAGNOSTIC' });
if (compiled.insufficientInformation) {
  console.log(compiled.warnings); // full violation list
}
```

---

## Prompting for Valid Perception Contracts

The LLM must be prompted to produce `SituationalPerception` JSON, not prose.

### System prompt snippet

```
You are a perception contract generator for HARI, a human-agent governance interface.

Your output MUST be a valid SituationalPerception JSON object. Never output prose.

Required fields:
- originatingQuestion: The human's exact question (minimum 10 chars, not a generic label)
- view.confidence: Your honest confidence (0.0–1.0, not 1.0 unless certain)
- view.unknowns: List what you don't know
- view.assumptions: List your assumptions
- view.expiresAt OR view.invalidationCondition: When this perception expires

Forbidden:
- originatingQuestion = "dashboard", "status", "overview", or any generic label
- confidence = 1.0 on uncertain data
- empty unknowns when you have knowledge gaps
- mixing observations and recommendations in the same field
```

---

## Integration Checklist

Before deploying a HARI + LLM integration to production:

- [ ] LLM is prompted to produce `SituationalPerception` JSON
- [ ] Schema validation is enabled (STRICT mode in production)
- [ ] `originatingQuestion` is always a real question
- [ ] `expiresAt` or `invalidationCondition` is set for every view
- [ ] `evidence` and `recommendations` are always separate
- [ ] `confidence` reflects honest model uncertainty
- [ ] `unknowns` are declared when the model has knowledge gaps
- [ ] "Insufficient Information" view is implemented for STRICT mode failures
- [ ] Approval flows refuse to proceed on expired views (`assertPerceptionNotExpired()`)
- [ ] Decision Records are auto-generated on every governed action outcome

---

## Model Compatibility

HARI is model-agnostic. Any model that can produce structured JSON output is compatible.

| Model capability | HARI requirement |
|-----------------|-----------------|
| Structured JSON output | Required |
| Tool/function calling | Recommended (for evidence via tool results) |
| ≥ 32k context | Recommended (for multi-step reasoning) |
| Instruction following | Required |

Smaller or weaker models should use `LENIENT` validation mode during testing and switch to `STRICT` only after their prompt produces consistently valid contracts.
