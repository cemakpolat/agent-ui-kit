# agent-ui-kit · HARI v0.1

**Universal Human–Agent Runtime Interface** — an intent-driven, trust-aware UI architecture for agentic platforms.

> The UI is not an output. It is a negotiated, living conversation between human and agent — made visible, safe, and actionable.

---

## Core Idea

Traditional apps render predefined screens. Agentic systems need something different: **interfaces that are dynamic, contextual, and negotiated in real time**.

HARI treats the UI as a **runtime contract**:
- The **agent proposes** a view based on its current understanding
- The **user responds** through interaction, clarification, or correction
- The **agent adapts**, refining both its reasoning and the UI

---

## Architecture

```
agent-ui-kit/
├── packages/
│   ├── core/          @hari/core — schemas, compiler, state stores
│   ├── ui/            @hari/ui   — React component library
│   └── demo/          @hari/demo — live demo (Travel + CloudOps scenarios)
```

### `@hari/core`

The contract layer. Framework-agnostic TypeScript.

| Module | Purpose |
|---|---|
| `schemas/intent.ts` | `IntentPayload` — the JSON contract between agent and frontend |
| `schemas/action.ts` | `AgentAction` + `ActionSafety` + `BlastRadius` |
| `schemas/ambiguity.ts` | `AmbiguityControl` — range sliders, toggles, chip selects |
| `schemas/explainability.ts` | `ExplainabilityContext` — reasoning surfaces |
| `compiler/registry.ts` | `ComponentRegistryManager` — `(domain, intentType, density) → component` |
| `compiler/compiler.ts` | `compileIntent()` — intent → `CompiledView` |
| `store/intent.ts` | Zustand store — current intent + negotiation patches |
| `store/ui.ts` | Zustand store — density override, explain panels, confirmations |

### `@hari/ui`

React components. All use inline styles — no CSS framework dependency.

| Component | Purpose |
|---|---|
| `IntentRenderer` | Top-level orchestrator — renders compiled view + actions + explain panels |
| `BlastRadiusBadge` | Visualises action risk, scope, affected systems |
| `ExplainPanel` | "Why am I seeing this?" — queryable reasoning surface |
| `AmbiguityControls` | Inline controls for intent negotiation |
| `DensitySelector` | User density override (Executive / Operator / Expert) |
| `FlightCard{Executive,Operator,Expert}` | Travel domain, 3 density variants |
| `MetricCard` | CloudOps domain with sparkline |

### `@hari/demo`

A Vite + React app with two complete scenarios:

| Scenario | Intent Type | Key Features |
|---|---|---|
| **Travel** | `comparison` | Price vs comfort slider, carbon toggle, stops filter, Book flight (HIGH blast radius, 2-step confirm with 1.5 s delay) |
| **CloudOps** | `diagnostic_overview` | 4 metric cards + sparklines, Restart Replica (CRITICAL, 2-step confirm), Primary/Replica single-select ambiguity |

---

## Key Design Principles

### Intent over Layout

```json
{
  "intent": "compare_options",
  "domain": "travel",
  "primaryGoal": "Find cheapest LHR → JFK flight",
  "confidence": 0.72,
  "ambiguities": [
    { "type": "range_selector", "label": "Price vs Comfort", ... }
  ]
}
```

The agent describes **what**, not **how**. The frontend compiles layout.

### Density Authority Hierarchy

```
User preference  >  System policy  >  Agent recommendation
```

Three modes: **Executive** (KPIs only), **Operator** (tables + filters), **Expert** (raw data + diagnostics).

### Action Safety

```json
{
  "safety": {
    "reversible": false,
    "riskLevel": "high",
    "requiresConfirmation": true,
    "confirmationDelay": 1500,
    "blastRadius": {
      "scope": "org",
      "affectedSystems": ["billing", "inventory"]
    }
  }
}
```

No irreversible action is visually indistinguishable from a safe one.

### Negotiation Loop

1. User adjusts ambiguity control
2. Optimistic local re-sort (instant)
3. Patch sent to agent: `{ event: "intent_modification", modifications: { ... } }`
4. Agent decides: cheap re-sort or expensive refetch → sends updated intent

### Graceful Degradation

- Unknown component type → `FallbackView` (raw JSON, never a crash)
- Low confidence → inline warning banner
- MCP unavailable → cached summary with timestamp

---

## Getting Started

```bash
# Install dependencies
pnpm install

# Run the demo
pnpm dev

# Typecheck all packages
pnpm typecheck

# Build all packages
pnpm build
```

---

## Next Steps (Phases 3–4 from the spec)

- [ ] Trust & interaction validation — user testing of blast radius comprehension
- [ ] Streaming JSON parser integration (progressive intent rendering)
- [ ] Real MCP integration (2–3 connectors)
- [ ] Schema versioning + capability discovery protocol
- [ ] Hypothetical mode — isolated "what-if" overlay that doesn't mutate main view state
- [ ] Living documents — versioned, refreshable report snapshots
- [ ] Accessibility audit (WCAG 2.2 AA)

---

## Schema Versioning

Every `IntentPayload` carries a `version` field (`semver`). Frontends are expected to:
1. Check the version on receipt
2. Transform or gracefully degrade older versions
3. Respond to unknown fields with `FallbackView`, not errors

---

## File Reference

```
packages/core/src/
  schemas/
    intent.ts          IntentPayload, IntentPayloadInput, IntentModification
    action.ts          AgentAction, ActionSafety, BlastRadius
    ambiguity.ts       AmbiguityControl (discriminated union of 4 types)
    explainability.ts  ExplainabilityContext, DataSource
  compiler/
    registry.ts        ComponentRegistryManager
    compiler.ts        compileIntent(), buildModificationPatch()
  store/
    intent.ts          useIntentStore
    ui.ts              useUIStore

packages/ui/src/components/
  IntentRenderer.tsx
  BlastRadiusBadge.tsx
  ExplainPanel.tsx
  AmbiguityControls.tsx
  primitives/DensitySelector.tsx
  domain/travel/FlightCard.tsx
  domain/cloudops/MetricCard.tsx

packages/demo/src/
  scenarios/travel.ts      Travel IntentPayload with 3 flights + 3 actions
  scenarios/cloudops.ts    CloudOps IntentPayload with 4 metrics + 3 actions
  registry/index.tsx       Application-level component registry
  App.tsx                  Demo shell with scenario switcher + negotiation log
```
