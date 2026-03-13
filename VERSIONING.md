# HARI — Versioning & Stability Policy

**Version:** 1.0.0  
**Date:** March 2026  
**Status:** Active

---

## Feature Freeze: March 2 – June 1, 2026

HARI v1.0.0 is in a **90-day feature freeze** (March 2 – June 1, 2026).

During this window:

- **Accepted:** Bug fixes (`PATCH` bumps), spec clarifications (doc-only PRs), test additions, example fixes, dependency security patches.
- **Rejected:** New schemas, new exported symbols, new UI components, new governance concepts, refactoring.

The freeze exists to let the architecture prove itself against real integrations before any new capabilities are added. All proposed additions during this period are recorded and deferred to v1.1.0 planning (June 2026).

See `CONTRIBUTING.md` for the full criteria.

---


## The Short Version

| Guarantee | Coverage |
|---|---|
| **Never breaks** | The four perception invariants |
| **Stable** | Core schemas, authority modes, governance protocol |
| **May change** | UI components, renderers, demo app, dev-services |
| **Explicitly unstable** | Anything marked `@experimental` or `@internal` |

---

## Semantic Versioning

HARI uses [SemVer 2.0.0](https://semver.org/).

```
MAJOR.MINOR.PATCH
  │     │     └── Bug fix. No API change.
  │     └──────── New capability. Backward-compatible.
  └────────────── Breaking change. Requires migration.
```

---

## What Is Stable (v1.0+)

### Perception Invariants (NEVER break)

These four rules are the foundation of HARI. They will **never change** across
any version, including future major versions. Any implementation that satisfies
them is HARI-compatible regardless of version.

1. **Every rendered view answers a question.** `originatingQuestion` is always required.
2. **Every rendered view expires.** `expiresAt` or `invalidationCondition` is always required.
3. **Evidence and recommendations are always separated.** They are never merged.
4. **Uncertainty is never hidden.** Agents cannot omit or suppress confidence degradation.

If any of these four rules ever changed, HARI would no longer be HARI.

---

### Core Schemas (`@hari/core`) — Stable

The following schemas are stable. Their required fields will not be removed, and
their `z.enum()` values will not be removed. New optional fields may be added
in minor versions.

| Schema | Stable Since |
|---|---|
| `SituationalPerceptionSchema` | v1.0.0 |
| `SituationalViewSchema` | v1.0.0 |
| `GovernedActionSchema` | v1.0.0 |
| `AuthorityContextSchema` | v1.0.0 |
| `DecisionRecordSchema` | v1.0.0 |
| `ApprovalChainSchema` | v1.0.0 |
| `UncertaintyIndicatorSchema` | v1.0.0 |
| `IntentPayloadSchema` | v1.0.0 |
| All 20 intent type schemas | v1.0.0 |

### Authority Modes — Stable

The four authority modes (`observe`, `intervene`, `approve`, `override`) and their
semantics are stable. New modes will never be inserted between existing ones.
Adding a mode is a major version change.

### Governance Protocol — Stable

- The escalation flow (observe → intervene → approve → override) is stable.
- The audit record structure (`DecisionRecord`) is stable.
- The validation modes (`STRICT`, `LENIENT`, `DIAGNOSTIC`) are stable.

### Compiler API (`@hari/core`) — Stable

```typescript
compileIntent(intent, options?: CompilerOptions): CompiledView
// CompilerOptions.validationMode is stable
// CompiledView.validationMode is stable
// CompiledView.insufficientInformation is stable
// LLMValidationError is stable
```

---

## What May Change (Minor Versions)

### UI Components (`@hari/ui`)

Component **props** may gain new optional properties in minor versions.
Existing optional props will not be removed in minor versions but may be
deprecated and removed in major versions.

Component **visual appearance** (colors, layout, spacing) may change in minor
versions without notice. Do not test against rendered output.

| Component | Stability |
|---|---|
| `TrustSurface` | Props stable, visual varies |
| `SituationalViewRenderer` | Props stable, visual varies |
| `GovernedActionPanel` | Props stable, visual varies |
| `AuthorityModeSwitch` | Props stable, visual varies |
| All other renderers | Props stable, visual varies |

### Helper Functions — Stable API, May Gain Overloads

```typescript
parseSituationalPerception()    // stable — signature will not change
assertSituationalPerception()   // stable — throw behavior will not change
createDecisionRecord()          // stable — options may gain optional fields
assertPerceptionNotExpired()    // stable — semantics will not change
isViewExpired()                 // stable
```

---

## What Can Change Without Notice (Do Not Depend On)

- Internal implementation of the compiler
- Demo app (`@hari/demo`) — purely illustrative, not a library
- Dev services (`@hari/dev-services`) — reference only, not a library
- Marketplace templates (30+ built-in preconditions) — content may change
- Test utilities
- Any symbol marked `@experimental` in JSDoc
- Any symbol marked `@internal` in JSDoc

---

## What a Breaking Change Looks Like

A major version bump (e.g. `1.x.x` → `2.0.0`) will be triggered by:

- Removing a required field from any stable schema
- Removing an enum value from any stable schema
- Removing or renaming a stable exported symbol
- Changing the four perception invariants (this has never happened)
- Changing the authority mode semantics
- Changing the thrown type of `LLMValidationError`
- Removing a compiler option

A major version bump will **always** include:

- A `MIGRATION.md` with a step-by-step upgrade guide
- A deprecation period of at least one minor version
- Clearly marked `@deprecated` annotations before removal

---

## Deprecation Policy

1. Symbol is marked `@deprecated` with a replacement and version.
2. Deprecation ships in a **minor** version.
3. Removal ships in the next **major** version, no sooner.
4. At least 90 days between deprecation and removal.

---

## Experimental APIs

Symbols marked `@experimental` have no stability guarantee. They may:

- Change signature between patch versions
- Be removed without deprecation
- Graduate to stable in a minor version (with a changelog entry)

---

## The Normative Documents

These documents have the same stability guarantee as stable schemas.
Changes to them constitute a breaking change.

| Document | Status |
|---|---|
| [docs/PERCEPTION-CONTRACT.md](docs/PERCEPTION-CONTRACT.md) | **NORMATIVE** |
| [CONFORMANCE.md](CONFORMANCE.md) | **NORMATIVE** |
| This file ([VERSIONING.md](VERSIONING.md)) | **NORMATIVE** |

All other documentation is non-normative (informative only).

---

## Changelog

### v1.0.0 — March 2026

- **Architecture locked.** Perception invariants declared stable and permanent.
- **Feature freeze declared.** March 2 – June 1, 2026. See `CONTRIBUTING.md`.
- `SituationalPerceptionSchema` declared stable top-level entry point.
- `ValidationMode` (`STRICT` / `LENIENT` / `DIAGNOSTIC`) declared stable.
- `TrustSurface` component introduced as mandatory rendering requirement.
- `createDecisionRecord()` declared stable with perception/question linking.
- `assertPerceptionNotExpired()` declared stable.
- `PERCEPTION-CONTRACT.md` tagged normative.
- `CONFORMANCE.md` published.
- `WHY-HARI.md` published — canonical narrative and synchronizer model.
- `ANTI-PATTERNS.md` published — 8 named misuse patterns, runtime warning detector.
- `dev-warnings.ts` published — `checkPerceptionMisuse()` exported from `@hari/core`.
- Reference integrations published: `examples/openai/`, `examples/ollama/`, `examples/backend-orchestration/`.
- `CONTRIBUTING.md` published — freeze gate, accepted/rejected criteria.
