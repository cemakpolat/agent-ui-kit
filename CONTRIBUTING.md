# Contributing to HARI

## Feature Freeze: March 2 – June 1, 2026

HARI v1.0.0 is in a **90-day feature freeze**.

The architecture is locked. The perception contract is normative. The conformance
specification is published. The reference integrations are complete. The correct
next step is not to build more — it is to let the architecture prove itself against
real integration attempts and collect the failure modes that only appear in practice.

### What this means for contributions

**Accepted during the freeze:**

| Type | Criterion | Version bump |
|---|---|---|
| Bug fix | Existing behavior is incorrect — the spec says X, the code does Y | `PATCH` |
| Spec clarification | A NORMATIVE document is ambiguous — the fix removes ambiguity without changing the rule | None (doc PR) |
| Test addition | A conformance case is untested — the new test passes without code change | `PATCH` |
| Example fix | A reference integration (`examples/`) has an error or uses a wrong API | `PATCH` |
| Dependency update | Security patch in a direct dependency | `PATCH` |

**Rejected during the freeze:**

| Type | Reason |
|---|---|
| New intent schema | Architecture locked. 20 schemas cover all common data shapes. |
| New UI component | Rendering surface complete. Add renderers in your own app. |
| New governance concept | Define new concepts by extending the spec through conformance levels, not new code. |
| New API surface | v1.0.0 API is stable. Additions wait for v1.1.0 post-freeze. |
| Refactoring | No behavior change PRs during freeze — they introduce risk with no user value. |
| "What if we..." | Proposals are welcome in Discussions, not as PRs until freeze ends. |

### How to submit a bug fix

1. Open an issue with: the invariant or spec section that is violated, the observed behavior, and the expected behavior
2. Reference the specific section of `CONFORMANCE.md` or `docs/PERCEPTION-CONTRACT.md` that defines the correct behavior
3. Include a failing test that demonstrates the bug — PRs without a test that fails before the fix will not be reviewed
4. The fix must not add new exported symbols — it must only correct existing behavior

### How to submit a spec clarification

1. Quote the exact ambiguous passage
2. Describe the two valid interpretations
3. Propose the clearest wording that preserves the original intent
4. If the clarification changes behavior for any current implementation, it is a breaking change and is rejected until post-freeze

### How to report a misuse pattern

If you ran a HARI integration and encountered a failure mode not in `ANTI-PATTERNS.md`:

1. Open an issue describing the pattern, the failure mode, and the correct pattern
2. Do not propose code changes — pattern documentation does not require code
3. We will add the pattern to `ANTI-PATTERNS.md` if it is genuinely novel and not covered by an existing pattern

### What we are watching during the freeze

- How teams write system prompts for `SituationalPerception`
- Which parts of `CONFORMANCE.md` are unclear or contested
- Which perception invariants are accidentally violated and how
- Whether the `examples/` reference integrations are sufficient for independent adoption
- Which anti-patterns appear in practice but are not in `ANTI-PATTERNS.md`

Failure modes discovered during the freeze will inform v1.1.0.

---

## Post-Freeze (v1.1.0 planning, June 2026)

After the freeze ends, the following areas are candidates for v1.1.0 work:

- Additional conformance tests based on freeze-period integrations
- Spec refinements based on observed ambiguities
- New intent schemas if 20 provably do not cover a real use case
- Streaming perception protocol improvements (multi-view, supersession signaling)

No decisions have been made about any of these. The freeze period exists to
gather evidence before committing to any of them.

---

## Governance of this document

This document is non-normative. The normative sources for freeze behavior are:

- `VERSIONING.md` — stability guarantees and what constitutes a breaking change
- `CONFORMANCE.md` — what compliant implementations must satisfy

If this document conflicts with either of those, the normative document wins.

**Freeze window:** March 2, 2026 → June 1, 2026
