# Why HARI Must Exist

**This is not a README.**
This is the argument for HARI's existence.

---

## The Scene

It is 2:47 AM. An autonomous system is watching a production database cluster.

Every 200 milliseconds, it reads CPU utilization, query latency, replication lag,
connection pool saturation, cache hit ratio, slow query logs. It has been doing
this continuously for 6 months. It has seen 1,847 incidents. It knows the patterns.

Tonight, at 2:47 AM, it notices something.

Replication lag is climbing. It started at 120ms. Now it's 480ms. The trend is
exponential. In 4 minutes, at this rate, read replicas will begin returning stale
data to 23 microservices. In 11 minutes, connection pool exhaustion will cascade
to the payment processor.

The autonomous system has already calculated three responses:
1. Kill the three heaviest long-running queries (risk: disrupts ongoing batch jobs)
2. Promote a read replica to reduce load on primary (risk: 90-second failover window)
3. Call a human (risk: humans take 4 minutes just to understand what's happening)

It has a confidence of 0.84 in its diagnosis. It knows what to do.

---

## The Problem

The autonomous system cannot act.

Not because it lacks capability. It can execute any of those three responses in
milliseconds. It has the credentials. It has the authority in its technical sense.

It cannot act because **it has no right to act without human knowledge.**

This is not a technical constraint. This is a governance constraint. The humans
who are responsible for this system — who are accountable to customers, regulators,
and each other — have not authorized autonomous action at this hour with this severity.

And they shouldn't have. Not yet. Because:

- The system's 0.84 confidence means a 16% chance it is wrong.
- Killing the batch jobs might cause a compliance violation.
- The VP of Engineering is asleep and does not know any of this is happening.

---

## What Happens Without HARI

The autonomous system sends an alert.

```
[CRITICAL] Replication lag: 480ms ↑↑↑ — threshold exceeded
```

The on-call engineer is paged. They wake up. They look at a dashboard. The
dashboard shows 47 metrics. Graphs everywhere. Numbers. Red. Some amber.

What is the question? The engineer doesn't know yet. They have to reconstruct
it from noise. They open Slack. They open another tab. They write a query.
Two minutes have passed.

Meanwhile, the autonomous system knows exactly what is happening. It has the
full causal chain in its working memory. But it cannot transfer this understanding.

The engineer asks a colleague. Four minutes have passed. The engineer now
understands the problem but is not sure whether option 1 or option 2 is safer.
They choose option 2. The failover begins. At minute 9, the cascade is stopped.

No one will ever know how close it was.

---

## What HARI Does

At 2:47 AM, the autonomous system forms a **perception**.

This is not an alert. It is not a graph. It is a formal, validated object that
answers a specific question:

> *"Is the database cluster at risk of cascading failure, and if so, what is the
> safest intervention that a human can authorize in the next 4 minutes?"*

The perception contains:
- The diagnosis (replication lag, trend, projected cascade time)
- The confidence (0.84, with the specific unknowns that account for the 0.16)
- The evidence (timestamped measurements, not dashboards)
- The recommendations (three options, each with risk, reversibility, and required authority)
- An expiration (valid for 4 minutes — after that, the situation will have changed)

HARI delivers this perception to the on-call engineer's screen as a
**Situational View** — a single, purposeful interface designed to answer
exactly that question and nothing else.

The engineer wakes up. They see:

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Authority: OBSERVE  ·  Confidence: 84%  ·  Valid: 3m 42s  ·  Pending ✓ │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Is the database cluster at risk of cascading failure?                   │
│                                                                          │
│  YES — Replication lag is 480ms and climbing at 90ms/30s.               │
│  Projected cascade to payment processor: 10 min 18 sec.                 │
│                                                                          │
│  Evidence:                                                               │
│  • Replication lag: 480ms (was 120ms 8 min ago)           [HIGH]        │
│  • Connection pool: 78% of capacity                       [MEDIUM]      │
│  • Cache hit ratio: unavailable (last 2 min)              [UNKNOWN]     │
│                                                                          │
│  Recommended: Promote read replica (90s failover, safest option)        │
│  ⚠ Requires: APPROVE authority                                           │
│                                                                          │
│  [Escalate to Approve →]    [View alternatives]    [Defer 2 min]        │
└──────────────────────────────────────────────────────────────────────────┘
```

The engineer escalates. They read the justification prompt, type three words:
*"lag cascade risk"*. They are now in Approve mode.

They approve the recommendation. The failover begins at minute 2. The cascade
is stopped at minute 4. A decision record is created, linking the approval
to the specific perception, the specific question, the specific evidence.

The VP of Engineering reads it in the morning with full context. No one had
to reconstruct anything.

---

## The Synchronizer

This is the core insight that HARI is built on:

```
AGENT TIME                              HUMAN TIME

Continuous ─────────────────────        Discrete ─────────────────────
200ms ticks                             Minutes per context switch
Pattern recognition                     Judgment
No fatigue                              Full accountability
No authority                            Full authority

                    │                │
                    │   H A R I      │
                    │                │
                    ▼                ▼

              Perception            Decision
              (instantaneous)       (deliberate)

              Question ──────────── Answer
              Evidence ──────────── Judgment
              Expiration ─────────── Action
              Uncertainty ────────── Audit
```

The agent moves fast. The human moves slow. Both are necessary.

The agent cannot act for the human. The human cannot watch at agent speed.

HARI is what sits between them — not as a dashboard, not as a notification, not
as a chatbot, but as a **perception materializer**: it takes what the agent knows
and renders it into a form that allows a human to exercise authority correctly.

---

## What HARI Is Not

**HARI is not a UI kit.** It does not help you build interfaces. It helps
you structure the *transfer of authority* between an agent and a human.

**HARI is not an agent framework.** It does not help you build agents. It
helps agents communicate their situational understanding to the humans
who are accountable for the outcome.

**HARI is not a monitoring tool.** It does not show you what is happening.
It shows you what the agent believes is happening, with calibrated confidence,
in response to a specific question, for a limited time.

**HARI is not a notification system.** Notifications interrupt. Perceptions
*answer*. A notification says "something is wrong." A perception says
"here is what is wrong, here is how confident I am, here is what you
can do about it right now, and here is when this information expires."

---

## Why The Architecture Is Not Optional

Every rule in HARI exists because something breaks without it.

| Rule | What breaks without it |
|---|---|
| Every view answers a question | Human has no anchor. They are looking at data, not a judgment. |
| Every view expires | The screen becomes a dashboard. The human stops reading it. |
| Evidence and recommendations are separated | Human cannot distinguish what the agent observed from what it advocates. |
| Uncertainty is always visible | Human makes a confident decision on a 0.4-confidence basis. No one knows. |
| Every action requires an authority level | An `observe`-mode human approves a production change. The audit trail is meaningless. |
| Every decision creates a record | The next incident cannot be traced. Patterns are invisible. Accountability is impossible. |

You cannot remove any of these rules and still call it HARI.
You can remove all of them and build a dashboard.

---

## The Rarest Position

Most software is built to make things faster.

HARI is built to make one specific thing *slower in the right way*: the moment
when an autonomous system proposes an action and a human must decide whether
to authorize it.

That moment must be slow enough for real judgment. It must be informed by
real evidence with calibrated uncertainty. It must be time-bounded so the
information doesn't expire before the decision is made. And it must leave
a record that future humans can learn from.

HARI does not optimize that moment. HARI *protects* it.

That is why it must exist.
