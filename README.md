# HARI — Human–Agent Reasoning Interface

> UI is not output. It is perception.

> **Feature Freeze — March 2 – June 1, 2026.** v1.0.0 is declared stable. The architecture is locked. During this 90-day window only bug fixes, spec clarifications, and test additions are accepted. Read `CONTRIBUTING.md` before opening a PR. New features wait for v1.1.0.

---

## The Problem

Agents are fast. Humans are slow.

This is not a bug. It is the fundamental asymmetry that HARI is built around.

When an autonomous agent makes a decision in milliseconds, a human cannot
meaningfully oversee it in that same window. So we have two choices:

1. Let agents act without oversight and hope they are right.
2. Build infrastructure that **slows the system down to human time** — not to
   create friction, but to create real governance.

HARI is option 2.

---

## What HARI Is

HARI is the **perception and governance layer** between human judgment and
machine autonomy.

It is not a UI framework. It is not a component library. It is not a dashboard tool.

It is the answer to the question: *how does a human govern something that moves
faster than they can watch?*

The answer is: **you do not watch it. You perceive it.**

Perception is different from watching. Watching is passive reception — you look
at a screen and process whatever is shown. Perception is active and anchored —
you ask a question, you receive a view that answers it, you govern based on what
you understand.

HARI enforces this distinction technically.

---

## The Vision

Every view in HARI must answer a question the human actually asked.

There are no persistent screens. There are no dashboards. There are no menus of
options. There is a question, and there is a perception of the system state
that answers it — with a confidence level, an expiration time, and a clear
statement of what the agent does not know.

When the answer expires, the view degrades and disappears.
When the question changes, the view changes.
When the agent is uncertain, the human sees the uncertainty.

The human is never looking at a static representation of state. They are always
answering a specific question with time-bounded, uncertainty-honest perception.

This is what it means for UI to be perception rather than output.

---

## How It Works

### 1. The human asks a question

Explicitly: "Is the EU payment cluster healthy right now?"
Or implicitly, inferred from navigation, alerts, or prior context.

The question is captured as a `QuestionIntent` — a typed, structured object with
urgency, origin, domain, and follow-up scaffolding.

### 2. The agent reasons and produces a Perception Contract

The LLM does not produce HTML. It does not choose layouts. It does not decide
what to emphasize.

It produces a `SituationalPerception` — a structured JSON object that declares:
- What question it is answering
- What it observed (evidence, separated from recommendations)
- How confident it is
- What it does not know
- When this perception expires

This is the hard boundary between machine and human. HARI validates it before
anything is rendered.

### 3. HARI validates and renders

The Perception Contract is validated against a schema. In STRICT mode, invalid
output is rejected entirely — the human sees an "Insufficient Information" view
rather than hallucinated UI.

Valid contracts are rendered using the intent compiler, which translates
structured data into the appropriate component tree.

### 4. The human governs

Every proposed action is wrapped as an **Authority Request** — a formal object
that declares who must approve, why escalation is required, and what happens if
not approved. Humans approve, reject, escalate, or modify. Every decision
becomes a **Decision Record** — an auditable governance artifact linked to the
question, the perception, and the authority mode at the time of decision.

---

## The Architecture

```
Human question
     │
     ▼
QuestionIntent (typed, structured)
     │
     ▼
LLM reasoning + tool calls
     │
     ▼
SituationalPerception (validated JSON — Perception Contract)
     │
     ├── STRICT validation → reject if invalid, show "Insufficient Information"
     │
     ▼
Intent compiler → React component tree
     │
     ├── TrustSurface (authority mode, confidence, validity, approval state)
     ├── QuestionIntentBar (the question — always visible, never decorative)
     ├── Domain renderer (chart, form, timeline, etc.)
     └── GovernedActionPanel × n (Authority Requests, not buttons)
                              │
                              ▼
                        DecisionRecord (auto-generated, linked to perception + question)
```

---

## Non-Goals

HARI explicitly does not:

**Build dashboards.**
Dashboards are permanent. Perception is temporary. Every view has an expiration
condition — it degrades and disappears when it is no longer relevant.

**Optimize for speed.**
HARI deliberately slows approval flows. Confirmation delays and deliberation
gates are features. High-stakes decisions require time.

**Build a prompt UI.**
The human should not be writing prompts to govern agents. They should be asking
questions, reviewing perception, and making deliberate decisions.

**Add more UI components.**
The rendering surface is complete. 13 intent type renderers cover every common
data shape. What remains is architectural declaration — locking in the governance
model so it cannot be misused.

**Hide uncertainty.**
Confidence, unknowns, and assumptions are never optional. A confident-looking
view of uncertain data is a failure mode, not a feature.

---

## Monorepo Structure

```
packages/
  core/          @hari/core      — schemas, transport, governance engine, telemetry
  ui/            @hari/ui        — React components, hooks
  demo/          @hari/demo      — interactive demo app (Vite/React)
  dev-services/  @hari/dev-services — SSE/WS/MCP servers + governance audit backend

docs/
  PERCEPTION-CONTRACT.md    — authoritative Perception Contract spec v1
  HARI-WITH-LLMS.md         — how to integrate LLMs without misuse
```

---

## What Is Built

### Core Library (`@hari/core`)

**Perception schemas:**

| Schema | Concept |
|---|---|
| `situational-view.ts` | `SituationalView` — time-bounded, question-anchored perception unit |
| `situational-view.ts` | `SituationalPerception` — canonical top-level render pipeline entry point |
| `question-intent.ts` | `QuestionIntent` — the human's question, typed and structured |
| `authority.ts` | `AuthorityMode` (observe/intervene/approve/override), escalation, capabilities |
| `governed-action.ts` | `AuthorityRequest` / `GovernedAction`, `DecisionRecord`, `createDecisionRecord()` |
| `approval-workflow.ts` | Multi-level `ApprovalChain`, delegation, conditional approvals, expiry |
| `temporal-lens.ts` | Past/present/future annotation overlays |
| `temporal-projection.ts` | What-if projections, confidence intervals, alternative timelines |
| `uncertainty.ts` | `UncertaintyIndicator`, sensitivity analysis, confidence degradation |
| `collaboration.ts` | `DecisionLock`, `ConflictRecord`, authority sync, escalation notifications |

**General intent schemas:** action, ambiguity, calendar, chat, diagram, document,
explainability, form, intent, kanban, map, presence, question-intent, snapshot,
timeline, tree, workflow.

**Compiler:**

| Export | Purpose |
|---|---|
| `compileIntent()` | Transforms `IntentPayload` → `CompiledView` |
| `ValidationMode` | `STRICT \| LENIENT \| DIAGNOSTIC` LLM output validation |
| `LLMValidationError` | Thrown in STRICT mode on schema violations |

**Transport:** `MockAgentBridge`, `SSEAgentBridge`, `WebSocketAgentBridge`,
`MCPAgentBridge`, `GovernanceAgentBridge` (adds authority enforcement + audit
recording to any bridge).

**Governance engine:** `GovernanceAuditClient` (REST), `CollaborationClient` (WebSocket).

**Marketplace:** 30+ `PreconditionTemplate`s, authority hierarchy presets
(HARI Standard, SRE, Finance, Security, Hotfix), `GovernancePattern` schema.

**Telemetry:** `GovernanceMetrics` — authority mode transitions, decision latency, confidence tracks.

### UI Components (`@hari/ui`)

**Governance components:**

| Component | What It Renders |
|---|---|
| `TrustSurface` | **Mandatory** — authority mode, confidence, temporal validity, approval state |
| `SituationalViewRenderer` | Orchestrates all governance layers around domain content |
| `QuestionIntentBar` | The active question — always visible, never decorative |
| `AuthorityModeSwitch` | Observe/Intervene/Approve/Override switcher with escalation justification |
| `GovernedActionPanel` | Authority Request context, preconditions, deliberation timer |
| `ApprovalWorkflowPanel` | Multi-level chains, delegation, conditional approvals, expiry countdown |
| `TemporalLensOverlay` | Past/present/future overlay on any intent payload |
| `TemporalProjectionPanel` | What-if analysis, alternative timeline comparison |
| `UncertaintyAggregator` | Confidence degradation, sensitivity analysis |
| `UncertaintyIndicators` | Per-indicator confidence badges |
| `DecisionRecordViewer` | Decision timeline display |
| `VirtualDecisionTimeline` | Virtualized timeline for large decision histories |
| `DecisionStreamPanel` | Real-time streaming decision feed |
| `BlastRadiusBadge` | Impact scope visualization |

**General renderers:** `IntentRenderer`, `ChatRenderer`, `DocumentRenderer`,
`FormRenderer`, `DiagramRenderer`, `KanbanRenderer`, `MapRenderer`,
`CalendarRenderer`, `TimelineRenderer`, `TreeRenderer`, `WorkflowRenderer`,
`CollaborativeDocumentEditor`.

**Hooks:** `useAgentBridge`, `useDecisionStream`, `useTemporalLensCache`,
`useDocumentCollaboration`, `useVoiceInput`, `useIntersectionMount`.

---

## Quick Start

```bash
git clone <repo>
cd agent-ui-kit
pnpm install
pnpm dev   # http://localhost:5173
```

Tests:

```bash
pnpm test
pnpm --filter @hari/core test --run
pnpm --filter @hari/ui test --run
```

---

## Integrating with LLMs

Read [docs/HARI-WITH-LLMS.md](docs/HARI-WITH-LLMS.md) before building any
LLM integration. The document covers the 4-stage flow, common bad LLM behaviors,
prompting guidelines, and how HARI rejects unsafe output.

Short checklist:

- [ ] Prompt LLM to produce `SituationalPerception` JSON, not prose
- [ ] Use `STRICT` validation mode in production
- [ ] `originatingQuestion` must be a real question (not "dashboard", "status")
- [ ] Set `expiresAt` or `invalidationCondition` on every view
- [ ] Separate `evidence` from `recommendations`
- [ ] Call `assertPerceptionNotExpired()` before any approval

---

## Perception Contract Specification

Read [docs/PERCEPTION-CONTRACT.md](docs/PERCEPTION-CONTRACT.md) for the
authoritative specification: allowed intent types, required uncertainty fields,
forbidden LLM behaviors, validation modes, and safe degradation rules.

---

## Governance System

The governance model in short:

| Rule | Why |
|------|-----|
| Every view answers a question | No question = no anchor for judgment |
| Every view expires | No expiry = permanent dashboard = forbidden |
| Every action is an Authority Request | Buttons are not governance |
| Every decision creates a record | Use `createDecisionRecord()` — auto-linked |
| Uncertainty is always visible | Hidden uncertainty destroys trust |

See [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md) for integration patterns.

---

## Running the Full Stack

```bash
# Terminal 1 — backend services
cd packages/dev-services
pnpm dev   # SSE :3001, WS :3002, MCP :3003, Governance :3004

# Terminal 2 — demo UI
pnpm --filter @hari/demo dev   # http://localhost:5173
```

Or with Docker:

```bash
docker-compose up
pnpm --filter @hari/demo dev
```

---

## Status

| Area | Status |
|---|---|
| SituationalPerception top-level schema | ✅ |
| LLM Validation Modes (STRICT / LENIENT / DIAGNOSTIC) | ✅ |
| TrustSurface component (mandatory) | ✅ |
| Expiration semantics (expiresAt + invalidationCondition required) | ✅ |
| Authority Request terminology + display context | ✅ |
| Decision Record auto-generation with perception/question links | ✅ |
| Evidence vs recommendation separation | ✅ |
| Perception Contract Specification doc | ✅ |
| HARI With LLMs integration guide | ✅ |
| Transport layer (Mock/SSE/WS/MCP) | ✅ |
| GovernanceAgentBridge | ✅ |
| Approval workflows | ✅ |
| Temporal lens + what-if projections | ✅ |
| Audit backend | ✅ |
| Real-time collaboration | ✅ |
| Core tests: 610 | ✅ All passing |

---

## Documentation

| Document | Purpose |
|---|---|
| [WHY-HARI.md](WHY-HARI.md) | **Read this first** — why HARI must exist, the canonical story, the synchronizer |
| [docs/PERCEPTION-CONTRACT.md](docs/PERCEPTION-CONTRACT.md) | Normative v1 spec — what is a valid perception, what is forbidden |
| [CONFORMANCE.md](CONFORMANCE.md) | What "HARI-compatible" means — MUST/SHOULD requirements |
| [VERSIONING.md](VERSIONING.md) | Stability guarantees, breaking change policy, what never changes |
| [CONTRIBUTING.md](CONTRIBUTING.md) | **Feature freeze rules** — what is accepted/rejected, how to submit bug fixes |
| [ANTI-PATTERNS.md](ANTI-PATTERNS.md) | 8 misuse patterns, why each fails, runtime warning reference |
| [examples/README.md](examples/README.md) | **Reference integrations** — OpenAI, Ollama, and multi-agent backend orchestration |
| [docs/HARI-WITH-LLMS.md](docs/HARI-WITH-LLMS.md) | The 4-stage flow, bad LLM behaviors, prompting, model compatibility |
| [HARI_DOCTRINE.md](HARI_DOCTRINE.md) | Design philosophy, principles |
| [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md) | Component integration, custom renderers, governance extension |
| [INTEGRATION_GUIDE.md](INTEGRATION_GUIDE.md) | Backend patterns for OpenAI, Claude, Ollama |
| [ACCOMPLISHMENTS.md](ACCOMPLISHMENTS.md) | Complete build history across all phases |
