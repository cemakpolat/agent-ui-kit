# HARI — Anti-Patterns

**Status:** NORMATIVE — These patterns are forbidden in HARI-compatible implementations.  
**Version:** 1.0.0 — March 2026

This document describes how HARI is most commonly misused and why each misuse
is harmful. Each pattern is named, described, and accompanied by the failure
mode it produces.

> If you are doing any of the things in this document, you are not using HARI.
> You may be building a dashboard. You may be building a notification system.
> You may be building a chatbot. None of those are wrong — they are just not HARI.

---

## Anti-Pattern 1: The Dashboard

**What it looks like:**

```tsx
// A screen that stays on forever, showing everything the agent monitors
<SituationalViewRenderer
  view={{ status: 'active', expiresAt: null }}  // ← no expiry
  //  ^ this view lives until the user closes the tab
/>
```

**Also looks like:**

- A "live" view that auto-refreshes every 5 seconds
- A screen that shows 6 different intent types at once
- A view that is always visible in a sidebar

**Why it's harmful:**

Dashboards require constant attention. They train humans to ignore them (because
nothing actionable is always visible). They destroy the "just-in-time" property
that makes HARI reasoning safe.

A perception that never expires is not a perception. It is noise.

**Correct pattern:**

Every view must declare `expiresAt` or `invalidationCondition`. When neither is
present, the schema rejects the view. If you feel the urge to remove expiry
because "the data is always relevant", that is the sign you are building a dashboard.

---

## Anti-Pattern 2: LLM-Designed UI

**What it looks like:**

```typescript
// The LLM decides what the interface looks like
const response = await llm.chat('Design a UI for monitoring this service');
renderArbitraryHTML(response.content);

// OR: letting the LLM choose which components to render
const intentType = response.intent_type; // unchecked
bridge.dispatch({ type: intentType });   // ← register whatever the LLM says
```

**Why it's harmful:**

The LLM should produce *perception* — structured, validated facts about a
situation. The LLM should NOT produce *interface* — layout decisions, component
choices, what to show a human.

HARI's component registry and intent type system exist precisely so that humans
(or the HARI governance model) decide what renders, not the language model.
An LLM that controls its own output surface can:
- Suppress uncertainty indicators
- Omit governed action requirements
- Design interfaces that bypass the TrustSurface

**Correct pattern:**

The LLM submits a `SituationalPerception` with a structured `view.intent`.
HARI's compiler resolves which component renders. The LLM never touches layout.

---

## Anti-Pattern 3: Skipping Uncertainty

**What it looks like:**

```json
{
  "confidence": 0.99,
  "view": {
    "intent": { "type": "diagnostic_overview" }
  }
}
```

The LLM always returns `confidence: 0.99` regardless of actual uncertainty.

**Also looks like:**

- Omitting `confidence` entirely (defaulting to 1.0)
- Using confidence scores that never fall below 0.7
- Not surfacing `unknowns` in the perception
- Removing the amber/red confidence color coding from TrustSurface

**Why it's harmful:**

Humans calibrate their judgment to the confidence they see. A human who sees
"99% confidence" will not question the recommendation. If that 99% was fabricated,
the human made an uninformed decision under the false impression they had certainty.

This is the most dangerous anti-pattern. It looks fine. Everything works.
But the TrustSurface is a lie.

**Correct pattern:**

- All confidence scores must be calibrated and reflect the actual uncertainty.
- Confidence below 0.5 MUST render in danger color (red).
- Unknown values MUST be surfaced, not omitted or defaulted.
- System prompts MUST instruct the LLM to reflect actual uncertainty, not maximize confidence.

---

## Anti-Pattern 4: Auto-Approval Flows

**What it looks like:**

```typescript
// "Auto-approve low-risk actions"
if (action.blastRadius === 'minimal') {
  approveAction(action);  // ← no human involved
}

// OR: approval that bypasses authority check
function quickApprove(action) {
  createDecisionRecord({ outcome: 'approved', ...action });  // ← no authority verification
}

// OR: approval timeout that auto-approves
setTimeout(() => approveIfNotRejected(action), 30_000);
```

**Why it's harmful:**

Auto-approval is not governance. It is a script that produces audit records
without producing human decisions. The audit trail becomes meaningless —
it shows "approved" but the human never exercised authority.

The entire value of HARI is that a human made a real decision with real
information at a real moment. Auto-approval discards this completely.

**Correct pattern:**

Every approval requires a human in the loop. If an action is "low risk enough
to auto-approve," the correct HARI response is: **don't present it as a governed
action**. Only actions that genuinely require authority should be governed actions.
Actions below the governance threshold are not governed actions — they are agent
autonomy, which is a different thing and outside HARI's scope.

---

## Anti-Pattern 5: Rendering Without a Question

**What it looks like:**

```typescript
// Dispatching a view with no origianting question
bridge.dispatch({
  view: { intent: { type: 'diagnostic_overview', ... } }
  // ← no originatingQuestion
});

// OR: generic question that passes validation but means nothing
{
  "originatingQuestion": "status update"
}
```

**Why it's harmful:**

Without a question, the human has no anchor for judgment. They are looking at
data, not an answer. They cannot evaluate whether the view is relevant.
They cannot decide when the view has served its purpose.

The question is what converts a *display* into a *perception*. A display
shows things. A perception answers something.

**Correct pattern:**

Every `SituationalPerception` requires `originatingQuestion` (min 10 chars,
rejects generic labels). If you cannot state the question, you are not ready
to render a view. Go back to the agent and ask it to form a question first.

---

## Anti-Pattern 6: Long-Lived Views

**What it looks like:**

```json
{
  "expiresAt": "2027-01-01T00:00:00Z",
  "view": { ... }
}
```

A view expiring in one year. Or one week. Or even one day.

**Also looks like:**

- Using `invalidationCondition: "never"` or similar
- Setting all view expiry times to the same distant future date
- Extending view expiry when the view becomes stale instead of refreshing it

**Why it's harmful:**

Long-lived views become dashboards. They accumulate stale information.
Humans stop trusting them because they've been wrong before. At some point,
a human approves an action based on a view that reflected state from 6 hours
ago. The action fails. No one knows why.

Perception is always situational. A situational view that is valid for one year
is not situational — it is permanent. Permanent views are dashboards.

**Correct pattern:**

Views should expire when the information they contain is no longer decision-relevant.
For incident response: minutes. For capacity planning: hours. For quarterly reviews:
days. If the information is still valid after a week, the situation has not changed
enough to require a human decision, and the view should not be rendered.

---

## Anti-Pattern 7: Hiding Governed Actions

**What it looks like:**

```tsx
// Only showing governed actions to "approve" mode users
{authorityMode === 'approve' && (
  <GovernedActionPanel actions={actions} />
)}
```

**Why it's harmful:**

Governed actions represent things the agent wants to do that require
human authorization. Every human who can see the perception should know
what actions are pending, even if they cannot approve them. Hiding governed
actions from `observe`-mode users prevents them from understanding the
full situation.

`Observe` mode means you cannot approve. It does not mean you cannot see.

**Correct pattern:**

Governed actions SHOULD always be visible. The approval affordance (button,
control) should be disabled for `observe`/`intervene` mode users.
The existence of the action should always be visible.

---

## Anti-Pattern 8: Treating HARI as a Component Library

**What it looks like:**

```tsx
// Using HARI renderers as generic UI components in a non-HARI context
import { ChatRenderer } from '@hari/ui';

// Rendering a chat history with no governance context
<ChatRenderer messages={myMessages} />
```

**Why it's harmful:**

The renderers are not general-purpose components. They are *perception renderers*
— they are designed to render a specific type of intent within a governed perception
context. Using them outside that context strips them of the TrustSurface,
the authority context, the expiration semantics, and the audit trail.

The output looks correct. The governance is gone.

**Correct pattern:**

Render through `SituationalViewRenderer` with a full `SituationalPerception`
as the entry point. The renderer selects the appropriate intent component.
Bypassing this is bypassing governance.

---

## Summary: What HARI Refuses to Do

These are enforced by code, not just convention:

| Refusal | Enforcement |
|---|---|
| Render without a question | `SituationalPerceptionSchema` — required field, min 10 chars, rejects generic labels |
| Render without expiration | `SituationalViewSchema` — `.refine()` requires `expiresAt` or `invalidationCondition` |
| Approve on expired perception | `assertPerceptionNotExpired()` — throws if expired |
| Skip TrustSurface | `SituationalViewRenderer` — renders TrustSurface unconditionally |
| Emit hallucinated output in STRICT mode | `LLMValidationError` — thrown before rendering begins |

Everything else in this document is a convention. Conventions decay.
That is why the enforced list is the floor, not the ceiling.

---

## Runtime Warnings (Development)

In development (`NODE_ENV !== 'production'`), HARI emits console warnings for
patterns that are not schema violations but indicate likely misuse.

These are implemented in `@hari/core` via `warnIfMisuse()`:

| Warning | Trigger |
|---|---|
| `[HARI] Rendering without a question` | `originatingQuestion` absent from perception |
| `[HARI] Long-lived view detected` | `expiresAt` more than 24 hours in the future |
| `[HARI] No expiration set on view` | Neither `expiresAt` nor `invalidationCondition` present (pre-validation) |
| `[HARI] Suspiciously high confidence` | `confidence >= 0.99` — likely uncalibrated |
| `[HARI] Empty evidence array` | Recommendations present but no evidence |
| `[HARI] TrustSurface not rendered` | View rendered without authority context in the renderer |

Warnings are suppressed in production. They cannot be suppressed in development
without modifying the source.
