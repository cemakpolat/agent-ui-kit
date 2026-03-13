# HARI Design Doctrine

> **Human–Agent Reasoning Interface**
> *The way humans see autonomous systems.*

---

## What HARI Is

HARI is a **Human–Agent Perception & Governance Runtime**.

It is the layer between autonomous agents and the humans who must understand, trust, and govern them. HARI does not render dashboards. It renders **perception** — the structured, time-aware, uncertainty-honest, governance-enforced way that humans experience what autonomous systems are doing, have done, and will do.

Every pixel on a HARI surface answers a question. Every action requires governance. Every uncertainty is visible. Every decision is recorded.

---

## What HARI Does

| Capability | Description |
|---|---|
| **Render Perception** | Transform agent reasoning into human-comprehensible situational views |
| **Enforce Governance** | Ensure every action passes through authority checks, precondition validation, and decision records |
| **Mediate Authority** | Map human cognitive modes (observe, intervene, approve, override) to UI capabilities |
| **Slow to Human Time** | Force autonomous systems to operate at the speed of human judgment when governance requires it |
| **Surface Uncertainty** | Make unknowns, assumptions, and confidence visible — never hidden |
| **Record Decisions** | Create auditable trails of every human-agent interaction that involves authority |

---

## What HARI Does NOT Do

These non-goals protect the project from scope drift and misuse.

| Non-Goal | Explanation |
|---|---|
| **Decide Policy** | HARI surfaces options and enforces governance constraints. It never makes policy decisions. Humans decide. |
| **Execute Logic** | HARI does not run agent logic, business rules, or automation. It renders the *results* of those processes. |
| **Optimize Speed** | HARI optimizes for *trust* and *comprehension*, not throughput. If slowing down a process makes it more governable, HARI slows it down. |
| **Replace Agents** | HARI is not an agent. It is the lens through which humans see agents. Replacing agents with HARI would be like replacing a factory with a window. |
| **Store Data** | HARI processes perception streams. Persistent storage, data lakes, and long-term analytics belong elsewhere. |
| **Authenticate Users** | HARI enforces authority modes, not identity. Authentication is the responsibility of the platform that hosts HARI. |

---

## Core Principles

### 1. Perception Over Presentation

HARI does not "display data." It constructs **situational views** — time-bounded, scope-defined, confidence-annotated answers to questions. A chart in HARI is not a chart; it is a *perception artifact* that tells the human something specific and declares its own limitations.

### 2. Questions Drive Views

Every view in HARI exists because a question was asked — by the human, by the system, or by the agent. Views are **answers**, not screens. When the question changes, the view changes. When the question is resolved, the view disappears.

### 3. Trust Through Transparency

Trust is not built by hiding complexity. It is built by making complexity *legible*. HARI mandates:
- Confidence is always visible
- Unknowns are always labeled
- Assumptions are always surfaceable
- Alternatives considered are always available
- Data freshness is always shown

### 4. Actions Are Governed Decisions

In HARI, there are no "buttons." There are **governed actions** — proposed operations that carry intent, impact scope, reversibility classification, required authority, and preconditions. Every action produces a decision record. The UI enforces that humans cannot accidentally approve consequential actions.

### 5. Authority Is Cognitive, Not Hierarchical

HARI uses **authority modes**, not roles:
- **Observe** — Read-only perception
- **Intervene** — Modify constraints and parameters
- **Approve** — Authorize agent-proposed actions
- **Override** — Emergency control with full audit trail

A CTO in Observe mode sees the same view as a junior engineer in Observe mode. Authority escalation is explicit, justified, and time-limited.

### 6. Time Is Always Visible

Every view can be examined through three temporal lenses:
- **Now** — Current state
- **Before** — What changed to produce this state
- **After** — What will happen if the proposed action is approved

Hiding temporal context hides causality. Hiding causality destroys trust.

### 7. Dynamic Over Fixed

Fixed screens assume the world is predictable. Autonomous systems are not predictable. HARI generates views dynamically based on:
- What question is active
- What the agent has learned
- What authority the human holds
- What time horizon matters

Dashboard creep is a design failure. Views that persist beyond their relevance are noise.

### 8. Speed Is Irrelevant; Trust Is Everything

HARI intentionally slows humans down when governance requires it:
- Confirmation delays on high-risk actions
- Mandatory review periods for irreversible operations
- Forced temporal comparison before approvals
- Deliberation time tracking in decision records

If a human makes a faster decision, they should make a *more informed* one.

---

## Schema Architecture

HARI's schema architecture is layered:

```
┌─────────────────────────────────────────────┐
│           QuestionIntent                     │
│  "What question is being answered?"          │
├─────────────────────────────────────────────┤
│           SituationalView                    │
│  "What is the answer, and in what context?" │
├─────────────┬──────────────┬────────────────┤
│ TemporalLens│  Uncertainty │ AuthorityContext│
│ Now/Before/ │  Confidence/ │ Observe/Inter-  │
│ After       │  Unknowns    │ vene/Approve    │
├─────────────┴──────────────┴────────────────┤
│           IntentPayload (render contract)    │
│  Components, layout, data, ambiguity        │
├─────────────────────────────────────────────┤
│           GovernedAction                     │
│  Intent, impact, reversibility, authority   │
├─────────────────────────────────────────────┤
│           DecisionRecord                     │
│  Outcome, rationale, deliberation time      │
└─────────────────────────────────────────────┘
```

Each layer adds governance and perception context without breaking the layer below.

---

## Evolution Commitment

HARI evolves through **additive composition**, not rewriting:

1. **Existing schemas are stable** — IntentPayload, AgentAction, AmbiguityControl, and all component schemas remain backward compatible
2. **New schemas wrap, not replace** — SituationalView wraps IntentPayload; GovernedAction wraps AgentAction
3. **Migration is progressive** — agents can send raw IntentPayloads (v0.1 compat) or full SituationalViews (v0.3+)
4. **Components gain awareness** — existing renderers learn to read temporal, uncertainty, and authority metadata without structural changes

---

## Version History

| Version | Codename | Focus |
|---|---|---|
| v0.1 | Foundation | Intent schemas, compiler, component registry, action safety |
| v0.2 | Integration | Transport layer, streaming, real agent connections |
| v0.3 | Bridge | SituationalView, QuestionIntent, GovernedAction |
| v0.4 | Governance | Temporal lenses, authority modes, decision records |
| v0.5 | Perception | Hypothetical futures, view expiration, multi-view comparison |

---

*HARI is not a UI framework. It is a governance instrument. Treat it accordingly.*

---

## Governance Decision Trees

These trees encode how HARI routes any proposed action through the governance stack. Follow them when building agents, composing scenarios, or implementing new governed actions.

### Tree 1 — Can This Action Proceed?

```
Proposed Action Received
│
├─ Has required GovernedAction schema?
│   ├─ NO  → Reject. Log schema violation. Surface error to human.
│   └─ YES ↓
│
├─ Are all HARD preconditions met (status = 'met')?
│   ├─ NO  → Block action. Surface unmet preconditions. Offer alternatives.
│   └─ YES ↓
│
├─ Are there UNKNOWN preconditions?
│   ├─ YES → Downgrade confidence. Surface unknowns. Require human acknowledgment.
│   └─ NO  ↓
│
├─ Does current AuthorityContext.mode ≥ requiredAuthority?
│   ├─ NO  → Block. Show escalation path. Offer "Escalate authority" action.
│   └─ YES ↓
│
├─ Is reversibility = 'irreversible'?
│   ├─ YES → Force deliberation delay + mandatory temporal comparison (before/after).
│   └─ NO  ↓
│
├─ Is riskLevel = 'critical'?
│   ├─ YES → Require 'override' authority + written justification.
│   └─ NO  ↓
│
└─ Proceed. Create DecisionRecord. Start confirmationDelay if > 0.
```

### Tree 2 — Which Authority Mode Is Needed?

```
Classify the action's nature:

Read-only query or inspection?
└─ OBSERVE mode sufficient.

Modifying parameters, configuration, or non-destructive settings?
└─ INTERVENE mode required.

Approving an agent-proposed consequential action?
└─ APPROVE mode required.

Reversing a previously approved action against agent recommendation?
├─ Requires written justification.
└─ OVERRIDE mode required.

Irreversible action in production affecting external systems?
├─ Requires OVERRIDE mode.
├─ Requires blastRadius analysis.
└─ Requires post-action DecisionRecord with rationale.
```

### Tree 3 — When Does a View Expire?

```
SituationalView generated
│
├─ expiresAt set?
│   ├─ YES → Render countdown. Fade view on expiry. Prompt re-query.
│   └─ NO  → View does not auto-expire (only replaced by new question).
│
├─ Source data freshness > isStale threshold?
│   ├─ YES → Mark view as STALE. Show last-updated timestamp prominently.
│   └─ NO  ↓
│
├─ New agent event invalidates scope?
│   ├─ YES → Emit view_expired. Trigger follow-up QuestionIntent.
│   └─ NO  → Continue rendering.
│
└─ Human acts on a GovernedAction?
    └─ Transition view to 'resolved'. Archive DecisionRecord.
```

---

## Authority Mode Usage Guide

### When to Use Each Mode

| Mode | Use When | Capabilities | Restrictions |
|---|---|---|---|
| **Observe** | Monitoring, learning, auditing | Read all views, see confidence, inspect audit trails | No action approval, no parameter changes |
| **Intervene** | Active incident response, parameter tuning | Approve low/medium risk actions, modify constraints | Cannot approve high-risk or irreversible actions |
| **Approve** | Authorizing planned changes, agent proposals | Approve all reversible actions, delegate authority | Cannot reverse prior approvals without Override |
| **Override** | Emergency response, production recovery | All capabilities + irreversible actions | Full audit trail mandatory, justification required, time-limited |

### When to Escalate

Escalate authority when:
- An action's `requiredAuthority` exceeds your current mode
- A precondition is unmet and only higher authority can waive it
- The situation riskLevel escalates from `medium` → `high` → `critical`
- An alternative to the agent's recommendation requires higher authority

**How to escalate:**
1. HARI surfaces an "Escalate Authority" governed action automatically
2. The escalation is itself a governed action — it requires justification
3. Escalated authority is time-limited (`expiresAt`) — it expires even if unused
4. The escalation transition is recorded in `AuthorityContext.escalationHistory`

### Authority Anti-Patterns

| Anti-Pattern | Why It's Dangerous | HARI Response |
|---|---|---|
| Claiming Override for routine changes | Audit trail becomes noisy; real overrides get ignored | Flag as governance misuse in telemetry |
| Sharing authority credentials | Authority is personal and cognitive, not hierarchical | HARI authority modes are not credentials; platform auth handles identity |
| Approving without reading preconditions | Uninformed approval is not governance | Precondition panel is always visible before approval; deliberation time is tracked |
| Leaving Override active after incident | Overrides are time-limited for a reason | Auto-expire + notification at 80% of expiry window |

---

## Best Practices: Preconditions & Alternatives

### Designing Preconditions

Every GovernedAction **must** carry preconditions if its safety depends on system state. Preconditions answer: *"What must be true for this action to be safe?"*

**Do:**
```typescript
preconditions: [
  {
    description: 'Primary database is healthy (< 50ms p95 query time)',
    status: 'met',                      // Agent verified this
  },
  {
    description: 'No active maintenance window',
    status: 'unknown',
    resolution: 'Check maintenance calendar before proceeding',
  },
]
```

**Don't:**
```typescript
preconditions: []   // Never omit preconditions for high-risk actions
// or
preconditions: [
  { description: 'System is OK', status: 'met' }  // Too vague to be actionable
]
```

**Precondition status rules:**
- `met` — Agent verified the condition is true. Include the data source if possible.
- `unmet` — Condition is false. Action must be blocked. Offer resolution path.
- `unknown` — Agent could not verify. Downgrade action confidence. Human must acknowledge.

### Designing Alternatives

Alternatives communicate intellectual honesty: *"We considered other paths and chose this one because..."*

**Do:**
```typescript
alternatives: [
  {
    description: 'Rolling restart instead of full restart',
    rejectionReason: 'Rolling restart takes 8 min; current SLO breach requires < 2 min response',
  },
  {
    description: 'Do nothing and monitor',
    rejectionReason: 'Lag exceeds SLO threshold — doing nothing will trigger customer impact',
  },
]
```

**Don't:**
```typescript
alternatives: []   // Missing alternatives implies no analysis was done
// or
alternatives: [
  { description: 'Option B', rejectionReason: 'Not viable' }  // No rationale
]
```

**Why alternatives matter:**
- They prevent "option blindness" — the human sees what was not chosen and why
- They surface cheaper/safer paths the agent may have underweighted
- They are audit evidence that the recommended action was not arbitrary

---

## Real-World Incident Case Studies

### Case Study 1: Database Replica Lag (Resolved ✅)

**Situation:** Analytics batch job at 14:30 UTC saturated the read replica with a full-table scan. Replication lag hit 4.2s within 8 minutes, exceeding the SLO of 1s. The primary absorbed the load correctly; no data loss occurred.

**Governance path:**
1. System triggered QuestionIntent: *"Why is the database replica lagging?"*
2. SRE Alice was alerted and escalated from **Observe → Intervene** (justification: incident_response, ref DB-4521)
3. HARI presented two GovernedActions: Restart Replica (high risk, reversible) and Scale Up Replica (medium risk, requires Approve authority)
4. Restart Replica had one unknown precondition: *"Analytics batch job is not currently running"*
5. Alice checked the scheduler (2 min delay), confirmed batch was 95% complete, and deferred restart by 5 min
6. Batch completed at 14:43 UTC. Alice approved Restart at 14:44 UTC after confirmation delay
7. Lag dropped to 0.3s within 90 seconds

**Governance outcomes:**
- Deliberation time: 12 min (vs. typical impulsive restart in 2 min without HARI)
- DecisionRecord: "Deferred restart to avoid corrupting in-progress batch. Batch confirmed complete before approval."
- No secondary incident from premature restart
- Root cause (uncapped analytics query) escalated to a follow-up QuestionIntent

---

### Case Study 2: Unauthorized Deployment Escalation (Prevented ✅)

**Situation:** A developer attempted to deploy a hotfix directly to production at 23:45 UTC on a Friday. No change window was open. The deployment form pre-filled approver fields with auto-values the developer did not review.

**Governance path:**
1. HARI's deployment workflow required **Approve** authority to submit to production
2. The developer held **Intervene** authority — the "Submit to Production" action was blocked
3. Precondition `change_window_open` returned `status: 'unmet'`
4. HARI surfaced alternative: *"Deploy to Staging, request emergency change window"*
5. The developer escalated to **Approve** but HARI required written justification: *"Why is this change production-ready without a change window?"*
6. Justification was received, logged, and routed to the on-call manager who approved the emergency change window
7. Deployment proceeded 18 min later with full audit trail

**Governance outcomes:**
- The 18-minute delay was the price of governance — and avoided a misconfigured production release
- DecisionRecord captured: developer intent, manager approval, change window waiver
- Post-incident review confirmed the hotfix was correct — governance added time, not errors

---

### Case Study 3: Financial Transaction Override (Audit Required ✅)

**Situation:** A high-value wire transfer ($2.4M) was flagged by the fraud engine as anomalous (confidence: 0.73). The finance lead needed to release the payment to avoid a supplier penalty, but the transaction exceeded the automated approval threshold of $500K.

**Governance path:**
1. QuestionIntent: *"Should we release this transaction or hold for fraud review?"*
2. Finance lead held **Approve** authority but the action required **Override** (transaction > $1M threshold)
3. HARI surfaced the blastRadius: "Releasing this transaction is irreversible. Supplier holds contract pending payment."
4. Finance lead escalated to **Override** with justification: *"Supplier relationship at risk; fraud score below confidence threshold"*
5. Override was time-limited to 30 min. A second approver (CFO) was required by governance policy (configured precondition)
6. CFO approved within 12 min. Transaction released.
7. Full DecisionRecord archived with: fraud score, deliberation time (28 min), both approver IDs, justification strings

**Governance outcomes:**
- The fraud engine's 0.73 confidence was surfaced prominently — humans made an informed override, not a blind one
- Audit trail satisfied regulatory compliance (SOX audit passed)
- Post-event analysis confirmed no fraud; confidence model updated

---

### Case Study 4: Security Emergency Patch (Override Used Correctly ✅)

**Situation:** A critical CVE was announced at 02:00 UTC. The security team needed to deploy an emergency patch to 47 production hosts within a 4-hour window before the vulnerability was publicly weaponized. Standard change management requires 48 hours.

**Governance path:**
1. Security lead used **Override** authority with justification: *"CVE-2025-XXXX active exploitation risk; 4h window"*
2. HARI generated a GovernedAction per host group (4 groups) with individual blast radii
3. Preconditions checked per group: backup status, traffic levels, failover readiness
4. Two host groups had `backup_status: unknown` — HARI required acknowledgment, not block
5. Security lead acknowledged uncertainties with written rationale
6. Patch deployed in 3 sequential waves (HARI enforced order based on risk ranking)
7. Override expired after 4 hours and Authority returned to **Observe**

**Governance outcomes:**
- 47 hosts patched in 3h 18min
- No service degradation (precondition checks caught one host with a stuck backup — deferred to next wave)
- DecisionRecord per host group: patch version, confidence, who approved wave start, elapsed time
- Post-incident report generated from audit trail automatically
