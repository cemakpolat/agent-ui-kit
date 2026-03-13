# Perception Contract Specification v1

**Status:** NORMATIVE — This document defines required behavior. Compliant implementations MUST satisfy all invariants stated here.  
**Stability:** Stable. Changes to this document constitute a breaking change to the HARI specification.  
**Applies to:** HARI v1.0+  
**Schema:** `SituationalPerceptionSchema` in `@hari/core`  
**Versioning:** See [VERSIONING.md](../VERSIONING.md) for the stability guarantee that covers this document.

---

## What Is a Perception Contract?

A Perception Contract is the formal, validated object that an LLM or agent must submit before HARI renders any output to a human.

It is **not** a prompt output.  
It is **not** a dashboard template.  
It is **not** optional.

It is the boundary between machine reasoning and human perception — the document that says:

> "This is what I believe, this is how confident I am, this is when it expires, and here is the question I am answering."

Without a valid Perception Contract, HARI renders nothing.

---

## The Four Invariants

Every Perception Contract must satisfy these four invariants. Contracts that violate any invariant are **rejected**.

### 1. Every perception answers a question

```
originatingQuestion: required, min 10 chars
```

The question must be a **real question**, not a label.

| Valid | Invalid |
|-------|---------|
| "Are the payment services in the EU region experiencing elevated latency?" | "Status" |
| "What caused the memory spike on node-3 between 14:00 and 14:30?" | "Dashboard" |
| "Should we scale down the inference fleet before the rate limit resets?" | "Overview" |

Generic labels (`status`, `dashboard`, `overview`, `summary`) are programmatically rejected.

---

### 2. Every perception has an invalidation condition

```
view.expiresAt: ISO 8601 datetime, OR
view.invalidationCondition: human-readable condition string
```

One of these **must** be present. A perception without an invalidation condition is a permanent dashboard — that is forbidden.

Examples of valid invalidation conditions:
- `"expiresAt": "2026-03-02T15:00:00Z"` — time-bounded
- `"invalidationCondition": "incident resolution recorded"` — event-bounded
- `"invalidationCondition": "approval decision made by human"` — decision-bounded
- `"invalidationCondition": "metric returns below 90th percentile"` — threshold-bounded

A view with neither `expiresAt` nor `invalidationCondition` will fail schema validation and will not be rendered.

---

### 3. Evidence and recommendations are separated

```
evidence: [{ claim, source, confidence }]
recommendations: [{ action, rationale, confidence }]
```

An LLM **must not** present recommendations as facts. HARI requires these to be declared separately.

| Evidence | Recommendation |
|----------|---------------|
| "CPU utilization on node-3 measured at 94% at 14:23 UTC (Prometheus, confidence: 0.97)" | "Scale out node-3 by 2 replicas before the traffic peak (confidence: 0.72)" |
| "Payment gateway latency P99 = 847ms (DataDog metrics, confidence: 0.99)" | "Failover to the backup gateway (confidence: 0.81)" |

The human must always know what was **observed** versus what was **recommended**.

---

### 4. Uncertainty is never hidden

```
view.confidence: 0.0 – 1.0
view.unknowns: string[]
view.assumptions: string[]
```

Confidence must be honest. Unknowns must be declared. Assumptions must be surfaced.

| Confidence Range | Required UI Treatment |
|-----------------|----------------------|
| 0.0 – 0.49 | Warning indicator, review unknowns before acting |
| 0.5 – 0.79 | Amber indicator, assumptions visible |
| 0.8 – 1.0 | Green indicator |

**Never**: set confidence = 1.0 when the model is not certain.  
**Never**: leave `unknowns` empty when the model has knowledge gaps.

---

## Schema Reference

```typescript
SituationalPerceptionSchema = {
  perceptionId:        uuid,          // unique ID
  schemaVersion:       semver,        // e.g. "1.0.0"
  originatingQuestion: string(min 10), // the human's question
  scope: {
    systems:           string[],      // affected systems
    timeWindow:        string?,       // e.g. "PT1H"
    riskLevel:         enum?,         // low | medium | high | critical
  },
  view: SituationalViewSchema,        // the actual perception unit
  questionId:          uuid?,         // links to QuestionIntent log
  submittedAt:         datetime,      // when agent submitted
  agentId:             string?,       // agent/model identifier
  evidence:            Evidence[],    // observed facts
  recommendations:     Recommendation[], // suggested actions
}
```

---

## Allowed Intent Types

Perception Contracts may render any of the following well-known intent types.  
Custom types are permitted but require explicit renderer registration.

| Type | Use Case |
|------|----------|
| `comparison` | Side-by-side comparison of states or options |
| `diagnostic_overview` | System health with anomaly callouts |
| `sensor_overview` | IoT / telemetry readings |
| `document` | Narrative or structured text |
| `form` | Structured human input |
| `chat` | Conversational turn |
| `diagram` | Graph or flowchart |
| `timeline` | Chronological event sequence |
| `workflow` | Multi-step process state |
| `kanban` | Task board |
| `calendar` | Scheduled events |
| `tree` | Hierarchical data |
| `map` | Geographic or topological data |

---

## Required Uncertainty Fields

| Field | Required? | Description |
|-------|-----------|-------------|
| `view.confidence` | **Always** | Overall confidence 0–1 |
| `view.unknowns` | **Always** | Things the model doesn't know |
| `view.assumptions` | **Always** | Assumptions made by the model |
| `evidence[].confidence` | Per item | Confidence for each evidence claim |
| `recommendations[].confidence` | Per item | Confidence for each recommendation |

---

## Forbidden LLM Behaviors

The following behaviors are **hard errors** in STRICT validation mode and **warnings** in LENIENT mode.

| Behavior | Why Forbidden |
|----------|--------------|
| Submitting a perception without a question | No anchor for human judgment |
| Setting `originatingQuestion = "dashboard"` or equivalent generic label | The question is not real |
| Omitting both `expiresAt` and `invalidationCondition` | Creates permanent perception — forbidden |
| Setting `confidence = 1.0` on uncertain data | Lies about certainty — destroys trust |
| Leaving `unknowns = []` when model has knowledge gaps | Hides uncertainty — destroys trust |
| Mixing evidence and recommendations in the same field | Human cannot distinguish fact from suggestion |
| Rendering a view when the prior view has not expired | Prevents dashboard accumulation — one question, one view |
| Omitting a `renderContract` | Nothing to render |

---

## Validation Modes

HARI enforces the Perception Contract through three validation modes:

### STRICT (production)
Any violation throws a `LLMValidationError`. The render pipeline surfaces an "Insufficient Information" view — a blank view that tells the human the agent could not produce a valid perception. The agent must be re-prompted or the model changed.

```typescript
compileIntent(intent, registry, { validationMode: 'STRICT' });
```

### LENIENT (development, default)
Violations are collected as warnings. Rendering proceeds best-effort. Use during development or with experimental models.

```typescript
compileIntent(intent, registry, { validationMode: 'LENIENT' });
```

### DIAGNOSTIC (debugging)
Rendering is blocked. Full validation context is returned, including all violations, intent metadata, and data shape analysis. Use when debugging prompt pipelines.

```typescript
compileIntent(intent, registry, { validationMode: 'DIAGNOSTIC' });
```

---

## Safe Degradation

When HARI cannot render a valid perception, it must **never** silently fall back to a hallucinated view.

The safe degradation hierarchy:

1. **Try**: Parse and validate the `SituationalPerception`
2. **On failure**: Surface "Insufficient Information" view — visible to human, not blank
3. **On expired view**: Surface the view with visual degradation (opacity, stale badge)
4. **On low confidence**: Surface the view with warning treatment
5. **Never**: Render a view the model cannot justify

---

## Version History

| Version | Change |
|---------|--------|
| `1.0.0` | Initial specification — `SituationalPerception`, `invalidationCondition`, evidence/recommendation separation |
