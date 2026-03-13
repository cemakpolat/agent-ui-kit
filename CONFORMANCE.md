# HARI — Conformance Specification v1

**Status:** NORMATIVE  
**Stability:** Stable. This document defines what "HARI-compatible" means.  
**Version:** 1.0.0 — March 2026  
**Authority:** [VERSIONING.md](VERSIONING.md) governs the stability of this document.

---

## Purpose

This document specifies exactly what an implementation must do to be declared
**HARI-compatible**. It uses the keywords MUST, MUST NOT, SHALL, SHOULD, and
MAY as defined in [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119).

An implementation that satisfies all MUST requirements in this document may
declare itself "HARI-compatible v1".

---

## Conformance Levels

| Level | Meaning |
|---|---|
| **HARI-compatible** | Satisfies all MUST requirements in this document |
| **HARI-compliant** | Satisfies all MUST and SHOULD requirements |
| **HARI-certified** | HARI-compliant + passes the conformance test suite |

---

## Part 1: Perception Contract

### 1.1 Originating Question (MUST)

A conforming implementation MUST require an originating question before
rendering any view. The originating question:

- MUST be at least 10 characters long.
- MUST NOT be a generic label (e.g. "status", "update", "info", "data", "result").
- MUST express a specific human intent that the rendered view answers.
- MUST be validated against `SituationalPerceptionSchema.originatingQuestion` before rendering.

**Non-conforming example:**
```json
{ "originatingQuestion": "status" }
```

**Conforming example:**
```json
{ "originatingQuestion": "Is the payment service healthy enough to resume processing?" }
```

### 1.2 Temporal Validity (MUST)

A conforming implementation MUST require that every view declares exactly one
of the following:

- `expiresAt` — an ISO 8601 timestamp after which the view is invalid, OR
- `invalidationCondition` — a human-readable condition that, when true, invalidates the view.

A view with neither MUST be rejected. A conforming implementation MUST NOT render
a view that has neither field.

### 1.3 Evidence and Recommendations (MUST)

A conforming implementation MUST separate evidence from recommendations.

- `evidence` — observations the agent has made (facts, measurements, logs)
- `recommendations` — actions the agent suggests

A conforming implementation MUST NOT place recommendations inside the `evidence`
array or vice versa.

### 1.4 Uncertainty (MUST)

A conforming implementation MUST NOT hide uncertainty. Specifically:

- Every view MUST include `confidence` scored 0–1.
- A view with `confidence < 0.5` MUST visually signal low confidence to the human.
- Unknown values MUST be surfaced, not omitted or silently defaulted.
- Confidence degradation over time SHOULD be tracked and displayed.

---

## Part 2: Authority and Governance

### 2.1 Authority Modes (MUST)

A conforming implementation MUST support exactly four authority modes in this
escalation order:

```
observe → intervene → approve → override
```

Each mode MUST enforce the following behavioral contract:

| Mode | Human Can | Human Cannot |
|---|---|---|
| `observe` | View all perception output | Modify parameters, approve actions |
| `intervene` | View + modify constraints | Authorize governed actions |
| `approve` | View + modify + authorize actions | Bypass preconditions |
| `override` | All of the above + bypass preconditions | (no restriction — must be audited) |

A conforming implementation MUST NOT allow a human to approve governed actions
without being in `approve` or `override` mode.

### 2.2 Escalation (MUST)

A conforming implementation MUST require a justification string for any
escalation beyond `observe`. The justification:

- MUST be recorded in the audit trail.
- MUST NOT be optional when escalating to `override`.
- SHOULD be shown to the human at the time of escalation.

### 2.3 Governed Actions (MUST)

A conforming implementation MUST present every proposed agent action as a
Governed Action (also called an Authority Request). A Governed Action MUST:

- Identify who must approve it (`requiredAuthority` mode).
- State what happens if it is not approved (`unapprovedConsequence`).
- Be blocked when the governing perception has expired (`assertPerceptionNotExpired`).

A conforming implementation MUST NOT allow approval of a governed action when
the perception that generated it has expired.

### 2.4 Decision Records (MUST)

A conforming implementation MUST create a `DecisionRecord` for every human
decision (approve, reject, modify, escalate). The record MUST include:

- `decidedAt` — ISO 8601 timestamp
- `outcome` — one of: `approved`, `rejected`, `modified`, `escalated`, `deferred`
- `decidedBy` — the human's identity
- `perceptionId` — the originating perception (when available)
- `questionId` — the originating question (when available)

Decision records MUST be immutable once created. They MUST NOT be deleted.

---

## Part 3: Rendering

### 3.1 TrustSurface (MUST)

A conforming implementation MUST render a `TrustSurface` (or equivalent) for
every view. The TrustSurface MUST display at minimum:

- Current authority mode
- Agent confidence (with color coding: danger below 0.5, warning 0.5–0.8, success above 0.8)
- Temporal validity status (active, stale, expired)
- Approval state of governed actions

A conforming implementation MUST NOT render a view without these four indicators
visible to the human.

### 3.2 Expired Views (MUST)

A conforming implementation MUST NOT allow approval of governed actions when
the perception is expired. The expired state:

- MUST be visually prominent (not a subtle indicator).
- MUST block the approval affordance (button, control, etc.).
- MUST display a human-readable explanation of why approvals are blocked.

### 3.3 Validation Mode (SHOULD)

A conforming implementation SHOULD support at minimum `LENIENT` validation mode.
A conforming implementation that processes LLM output that will control real-world
systems SHOULD use `STRICT` validation mode.

`DIAGNOSTIC` mode is optional but RECOMMENDED for development and debugging.

---

## Part 4: The Audit Trail

### 4.1 Persistence (SHOULD)

A conforming implementation SHOULD persist all `DecisionRecord` objects to
durable storage. In-memory-only implementations are non-conforming for
production deployments but acceptable for prototyping.

### 4.2 Compliance Queries (SHOULD)

A conforming implementation SHOULD support at minimum:

- Querying decisions by time range
- Querying decisions by authority mode at time of decision
- Identifying override decisions (for compliance reporting)

### 4.3 Replay (MAY)

A conforming implementation MAY support decision replay — the ability to
reconstruct the reasoning chain for any historical decision from its audit record.

---

## Part 5: What a Conforming Implementation May NOT Do

These are **hard prohibitions**. Any implementation that does these is
non-conforming regardless of what else it does correctly.

| Prohibition | Why |
|---|---|
| Render a view without a question | Violates Perception Invariant 1 |
| Render a view without expiration | Violates Perception Invariant 2 |
| Auto-approve governed actions | Removes human authority |
| Suppress confidence scores | Violates Perception Invariant 4 |
| Show a permanent screen with no expiry | HARI renders situational views, not dashboards |
| Allow approval on expired perception | Expired perception cannot anchor a safe decision |
| Merge evidence and recommendations | Violates Perception Invariant 3 |
| Skip the audit trail | Removes accountability |

---

## Conformance Test Suite

The conformance test suite is located at:

```
packages/core/src/__tests__/contract-enforcement.test.ts
```

It covers all MUST requirements above. To run:

```bash
pnpm --filter @hari/core test --run -- contract-enforcement
```

All tests MUST pass for an implementation to declare HARI-compatible status.

---

## Claiming Conformance

You may state:

> "This implementation is HARI-compatible v1."

if and only if:

1. All MUST requirements in this document are satisfied.
2. The conformance test suite passes without modification.
3. No normative document (this file, VERSIONING.md, PERCEPTION-CONTRACT.md) has been selectively overridden.

You may NOT claim HARI-compatible status for a partial implementation.
