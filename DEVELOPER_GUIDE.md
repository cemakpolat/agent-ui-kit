# HARI Developer Guide

> **For engineers building systems on top of HARI or integrating domain components with governance.**

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Component Integration Patterns](#component-integration-patterns)
3. [Attaching Governance to Custom Domain Components](#attaching-governance-to-custom-domain-components)
4. [Customizing Authority Hierarchies](#customizing-authority-hierarchies)
5. [Building Governance-Aware Agents](#building-governance-aware-agents)
6. [Schema Reference Quick Links](#schema-reference-quick-links)

---

## Architecture Overview

HARI's runtime is a pipeline:

```
Agent / LLM
    │
    │  IntentPayload (v0.1+) or SituationalView (v0.3+)
    ▼
Transport Layer (WebSocket | SSE | MCP | Mock)
    │
    ▼
Intent Compiler   ── validates schema, applies defaults, resolves ambiguity
    │
    ▼
Intent Store      ── reactive state, undo/redo, collaboration sync
    │
    ▼
UI Renderer       ── IntentRenderer or SituationalViewRenderer
    │
    ▼
Governed Action   ── user clicks an action → GovernedAction authority check
    │
    ▼
Decision Record   ── appended to audit trail
```

Each stage is a composable unit. You can enter the pipeline at any point.

---

## Component Integration Patterns

### Pattern 1 — Minimal: Raw IntentPayload Render

Use this when you have an existing agent that produces structured data but no governance context yet.

```tsx
import { IntentRenderer, ThemeProvider } from '@hari/ui';
import { compileIntent } from '@hari/core';
import type { IntentPayloadInput } from '@hari/core';

const myPayload: IntentPayloadInput = {
  version: '1.0.0',
  intentId: 'my-intent-1',
  type: 'diagnostic_overview',
  domain: 'cloudops',
  primaryGoal: 'Show current system health',
  confidence: 0.9,
  density: 'operator',
  data: { metrics: [...] },
};

function MyDashboard() {
  const compiled = compileIntent(myPayload);
  return (
    <ThemeProvider theme="default">
      <IntentRenderer intent={compiled} />
    </ThemeProvider>
  );
}
```

**When to use:** Prototyping, simple read-only dashboards, early-stage agent integration.

---

### Pattern 2 — Intermediate: Bridge + Store

Use this when you have a real agent connection and want live updates, undo/redo, and telemetry.

```tsx
import { useAgentBridge, IntentRenderer } from '@hari/ui';
import { useIntentStore, WebSocketAgentBridge } from '@hari/core';

const bridge = new WebSocketAgentBridge('wss://my-agent:3001');

function LiveDashboard() {
  const { intent, sendModification, queryWhatIf } = useAgentBridge(bridge);
  const { undo, redo } = useIntentStore();

  if (!intent) return <p>Waiting for agent...</p>;

  return (
    <IntentRenderer
      intent={intent}
      onAction={(actionId) => {
        sendModification({ type: 'action', actionId });
      }}
    />
  );
}
```

**Transport options:**

| Bridge | Use Case |
|---|---|
| `MockAgentBridge` | Development, demos, testing |
| `WebSocketAgentBridge` | Real-time agent (bidirectional) |
| `SSEAgentBridge` | Server-push-only agents |
| `MCPAgentBridge` | Model Context Protocol agents |

---

### Pattern 3 — Full Governance: SituationalViewRenderer

Use this when your domain requires full human-agent governance, audit trails, and authority enforcement.

```tsx
import {
  SituationalViewRenderer,
  ThemeProvider,
} from '@hari/ui';
import type {
  SituationalView,
  AuthorityContext,
  GovernedAction,
} from '@hari/core';

function GovernanceDashboard({ view, authority, actions }) {
  return (
    <ThemeProvider theme="default">
      <SituationalViewRenderer
        view={view}                   // SituationalView
        authority={authority}         // AuthorityContext
        actions={actions}             // GovernedAction[]
        onDecision={(record) => {
          // Persist the DecisionRecord to your audit store
          auditStore.append(record);
        }}
        onAuthorityEscalate={(request) => {
          // Route escalation request to your auth system
          authService.requestEscalation(request);
        }}
      />
    </ThemeProvider>
  );
}
```

**When to use:** Production operations, compliance-sensitive domains, multi-human approval workflows.

---

### Pattern 4 — Hypothetical Overlays

Use this when you want agents to propose futures before committing to actions.

```tsx
import {
  HypotheticalOverlay,
  HypotheticalCompare,
} from '@hari/ui';
import { useAgentBridge } from '@hari/ui';

function HypotheticalDashboard() {
  const { intent, queryWhatIf, hypothetical } = useAgentBridge(bridge);

  return (
    <>
      <IntentRenderer intent={intent} />

      {hypothetical && (
        <HypotheticalOverlay
          current={intent}
          proposed={hypothetical}
          confidence={hypothetical.confidence}
        />
      )}

      <button onClick={() => queryWhatIf('What if I scale up the replica?')}>
        Run What-If
      </button>
    </>
  );
}
```

---

## Attaching Governance to Custom Domain Components

### Step 1 — Define Your Domain's GovernedActions

Every consequential user action in your domain should become a `GovernedAction`. Map your existing button handlers:

**Before (raw button):**
```tsx
<button onClick={() => deleteRecord(id)}>Delete</button>
```

**After (governed action):**
```typescript
import type { GovernedAction } from '@hari/core';

const deleteRecordAction: GovernedAction = {
  action: {
    id: 'delete_record',
    label: 'Delete Record',
    variant: 'destructive',
    safety: {
      confidence: 0.95,
      reversible: false,
      riskLevel: 'high',
      requiresConfirmation: true,
      confirmationDelay: 5000,
      explanation: 'This permanently deletes the record and all child entities.',
      blastRadius: {
        scope: 'team',
        affectedSystems: ['record-store', 'search-index', 'audit-log'],
        downstreamEffects: 'Search index will not reflect deletion for ~30s.',
        estimatedImpact: 'Record and 14 child entities deleted.',
      },
    },
  },
  intent: 'Remove obsolete record from production database',
  impactScope: {
    scope: 'team',
    affectedSystems: ['record-store', 'search-index'],
    downstreamEffects: 'Search index lag ~30s',
  },
  reversibility: 'irreversible',
  requiredAuthority: 'override',      // Irreversible → override required
  actionConfidence: 0.95,
  preconditions: [
    {
      description: 'No active jobs are reading this record',
      status: 'met',
    },
    {
      description: 'Backup of record exists within last 24h',
      status: 'unknown',
      resolution: 'Check backup service before proceeding',
    },
  ],
  alternatives: [
    {
      description: 'Archive instead of delete (soft delete)',
      rejectionReason: 'GDPR right-to-erasure requires hard delete in this case',
    },
  ],
  tags: ['data-management', 'deletion'],
};
```

### Step 2 — Register Your Component with the Intent Registry

If your domain has a custom visualization, register it so the HARI compiler knows how to render it:

```typescript
// packages/demo/src/registry/index.tsx
import { Registry } from '@hari/core';
import { MyCustomChartComponent } from './MyCustomChart';

Registry.registerComponent({
  type: 'my_custom_chart',           // Must match IntentPayload data key
  domain: 'my-domain',
  component: MyCustomChartComponent,
  schema: MyCustomChartSchema,       // Zod schema for validation
});
```

### Step 3 — Emit Decision Records

When a user acts on your governed action, emit a `DecisionRecord`:

```typescript
import type { DecisionRecord } from '@hari/core';
import { v4 as uuid } from 'uuid';

function onUserApproval(actionId: string, rationale: string) {
  const record: DecisionRecord = {
    decisionId: uuid(),
    governedActionId: actionId,
    outcome: 'approved',
    decidedAt: 'approve',
    deciderId: currentUser.id,
    timestamp: new Date().toISOString(),
    rationale,
    deliberationTimeMs: Date.now() - actionPresentedAt,
  };

  auditClient.append(record);
}
```

---

## Customizing Authority Hierarchies

### Built-In Modes

HARI ships with four authority modes in a fixed escalation order:

```
observe → intervene → approve → override
```

Each mode is a cognitive state, not a role. The same person can hold different modes in different contexts.

### Configuring Per-Action Authority Requirements

Set `requiredAuthority` on each `GovernedAction` based on impact, not convention:

```typescript
// Low impact, easily reversible
{ requiredAuthority: 'observe' }      // Reading, monitoring

// Moderate impact, reversible
{ requiredAuthority: 'intervene' }    // Tuning parameters, restarting services

// Consequential, stakeholder impact
{ requiredAuthority: 'approve' }      // Deploying to production, scaling costs

// Irreversible, emergency, against agent recommendation
{ requiredAuthority: 'override' }     // Deleting data, emergency patches, policy exceptions
```

### Configuring Authority Escalation Constraints

When providing an `AuthorityContext`, constrain escalation time and scope:

```typescript
import type { AuthorityContext } from '@hari/core';

const authority: AuthorityContext = {
  currentMode: 'intervene',
  holderId: 'user-123',
  holderName: 'Jane (SRE Lead)',
  enteredAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 min max
  reason: 'incident_response',
  justification: 'Responding to PagerDuty alert PLAT-9821',
  escalationHistory: [],
};
```

### Multi-Approver Workflows

For actions that require more than one approver, encode the constraint as a precondition:

```typescript
preconditions: [
  {
    description: 'Second approver (Finance Lead) has confirmed this transaction',
    status: 'unmet',
    resolution: 'Request approval from finance-lead@example.com before proceeding',
  },
]
```

HARI blocks the action until the precondition becomes `met`. The second approver's confirmation is itself a GovernedAction in their session, creating a linked DecisionRecord chain.

### Domain-Specific Authority Labels

If "override" is too generic for your domain, alias it in your UI layer:

```typescript
const AUTHORITY_LABELS: Record<string, string> = {
  observe:   'View Only',
  intervene: 'Operations Mode',
  approve:   'Change Approver',
  override:  'Emergency Authority',
};
```

---

## Building Governance-Aware Agents

### What a Governance-Aware Agent Produces

A governance-aware agent emits a `SituationalView` (not just raw data). The view answers a specific `QuestionIntent` and proposes `GovernedActions` rather than triggering operations directly.

### Minimal Agent Output Contract

```typescript
import type { SituationalView, QuestionIntent } from '@hari/core';

// Your agent must emit this shape
interface AgentGovernanceOutput {
  question: QuestionIntent;
  view: SituationalView;
}
```

### Implementing the Agent Response Loop

```typescript
// Agent implementation (server-side)
class GovernanceAwareAgent {
  async respond(question: QuestionIntent): Promise<AgentGovernanceOutput> {
    // 1. Analyze the question and gather data
    const data = await this.gatherData(question);

    // 2. Assess confidence — never pretend certainty
    const confidence = this.computeConfidence(data);

    // 3. Build GovernedActions — never trigger side effects directly
    const actions = this.proposeActions(data);

    // 4. Identify unknowns and assumptions explicitly
    const uncertainty = this.assessUncertainty(data);

    // 5. Return a SituationalView — let the human decide
    const view: SituationalView = {
      situationId: uuid(),
      question: question.question,
      answerSummary: this.summarize(data),
      confidence,
      scope: this.determineScope(data),
      unknowns: uncertainty.knownUnknowns,
      assumptions: uncertainty.assumptions.map(a => a.assumption),
      generatedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      status: 'active',
      priority: this.computePriority(question),
      tags: question.domain ? [question.domain] : [],
      renderContract: this.buildRenderContract(data),
    };

    return { question, view };
  }
}
```

### Key Agent Design Rules

| Rule | Rationale |
|---|---|
| **Propose, never execute** | Agents submit GovernedActions. Humans approve them. Agents never trigger side effects without a DecisionRecord. |
| **Be explicit about uncertainty** | Every SituationalView must declare `confidence`, `unknowns`, and `assumptions`. Missing these fields is a governance failure. |
| **Suggest follow-ups** | Include `suggestedFollowUps` in QuestionIntent. Agents communicate the boundary of their knowledge by showing what they cannot answer. |
| **Set `expiresAt`** | Every SituationalView must declare when its answer becomes stale. Views with no expiry become stale facts — dangerous in fast-moving situations. |
| **Prefer alternatives** | Every GovernedAction should include at least one alternative with a rejection reason. This prevents option blindness. |

### Connecting an Agent via Transport

```typescript
// SSE agent (server → HARI)
import { SSEAgentBridge } from '@hari/core';

const bridge = new SSEAgentBridge('http://my-agent:3002/stream');
bridge.onIntent((view) => {
  // view is a SituationalView
  store.setSituationalView(view);
});
bridge.connect();

// MCP agent
import { MCPAgentBridge } from '@hari/core';
const mcp = new MCPAgentBridge({ serverUrl: 'http://localhost:3003' });
await mcp.connect();
const result = await mcp.call('analyze_incident', { incidentId: 'DB-4521' });
```

### Testing Governance-Aware Agents

Use `MockAgentBridge` to simulate governance scenarios in unit tests:

```typescript
import { MockAgentBridge } from '@hari/core';
import { renderHook, act } from '@testing-library/react';
import { useAgentBridge } from '@hari/ui';

it('blocks action when authority is insufficient', async () => {
  const bridge = new MockAgentBridge({
    simulateGovernance: true,
    authorityMode: 'observe',  // User is in observe-only mode
  });

  bridge.loadSituationalView(myGovernanceScenario);

  const { result } = renderHook(() => useAgentBridge(bridge));

  act(() => {
    result.current.triggerAction('scale_replica');  // Requires 'approve'
  });

  // Expect the action to be blocked, not executed
  expect(result.current.blockedActions).toContain('scale_replica');
  expect(result.current.escalationRequired).toBe(true);
});
```

---

## Schema Reference Quick Links

All schemas are defined in `packages/core/src/schemas/`:

| Schema | File | Purpose |
|---|---|---|
| `IntentPayload` | `intent.ts` | Core render contract (v0.1+) |
| `SituationalView` | `situational-view.ts` | Perception orchestrator (v0.3+) |
| `QuestionIntent` | `situational-view.ts` | What question this view answers |
| `GovernedAction` | `situational-view.ts` | An action with authority, preconditions, alternatives |
| `DecisionRecord` | `situational-view.ts` | Audit trail entry |
| `AuthorityContext` | `situational-view.ts` | Current human authority state |
| `TemporalLens` | `situational-view.ts` | Before / Now / After view control |
| `UncertaintySummary` | `situational-view.ts` | Confidence and unknowns |
| `AgentAction` | `action.ts` | Raw action (wrapped by GovernedAction in v0.3+) |

---

*For implementation examples, see `packages/demo/src/scenarios/governance-*.ts`.*
*For transport implementation, see `packages/dev-services/src/`.*
