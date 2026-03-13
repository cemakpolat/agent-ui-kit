# HARI Release Process — Changesets Workflow

## Overview

HARI uses [@changesets/cli](https://github.com/changesets/changesets) for
versioning and publishing. Changesets separates the act of **describing a
change** (done per PR by the author) from **releasing** (done by the
release manager at the end of a freeze).

This document covers:
- The changeset configuration for this monorepo
- The step-by-step v1.1.0 release procedure
- The ongoing workflow for contributors

---

## Monorepo Configuration

### Tracked packages (`core` and `ui` only)

| Package | npm name | Tracked | Why |
|---|---|---|---|
| `packages/core` | `@hari/core` | ✅ Yes | Public library |
| `packages/ui`   | `@hari/ui`   | ✅ Yes | Public library |
| `packages/demo` | `@hari/demo` | ❌ No  | Internal demo, not published |
| `packages/dev-services` | `@hari/dev-services` | ❌ No | Internal tooling, not published |

The `ignore` list in `.changeset/config.json` excludes `@hari/demo` and
`@hari/dev-services`. Changesets will never create version bumps or changelogs
for these packages, even if changes target them.

### Version locking (`linked`)

`@hari/core` and `@hari/ui` are **linked**: they always release at the same
version tag. If any changeset touches only `core`, `ui` is bumped to match.
This prevents consumers from having to reason about `@hari/core@1.2.0` +
`@hari/ui@1.1.5`.

### Internal dependency updates (`updateInternalDependencies: "patch"`)

When `@hari/core` is released, the `@hari/ui` dependency on it is automatically
updated using a patch bump. This keeps the workspace consistent without manual
`package.json` edits.

---

## v1.1.0 Release Procedure

### Prerequisites

- [ ] All feature branches merged to `main`
- [ ] `pnpm test` passes (`pnpm -r test`)
- [ ] `pnpm typecheck` passes (`pnpm -r typecheck`)
- [ ] `pnpm build` succeeds (`@hari/core` and `@hari/ui`)
- [ ] Release freeze is officially lifted (see VERSIONING.md)

### Step 1 — Create a changeset for v1.1.0

Run the changeset CLI interactively:

```bash
pnpm changeset
```

The CLI will ask:
1. **Which packages to release?** → Select `@hari/core` (ui is linked, so it will be bumped too)
2. **Bump type?** → `minor` (v1.0.0 → v1.1.0)
3. **Summary?** → See example summary below

#### Example v1.1.0 changeset summary

```
feat: Claude 3.5 Sonnet adapter via Tool Use — maps tool_use.input directly
to SituationalPerception; uncertainty and evidence fields mapped from Claude's
structural output.

feat: Add rendering stories for CalendarRenderer, DiagramRenderer,
KanbanRenderer, MapRenderer, TimelineRenderer, TreeRenderer, and
WorkflowRenderer — each with Default, HighUncertainty, and Expired states.

feat: Storybook stories demonstrate HARI time-bounding (Expired state) and
mandatory uncertainty disclosure (HighUncertainty state with confidence < 50%).
```

This creates a file like `.changeset/fuzzy-cats-dance.md`.

### Step 2 — Review the changeset file

```bash
cat .changeset/*.md
```

Verify the content is accurate. Edit the file directly if needed — it is plain
Markdown tracked in git.

### Step 3 — Apply versions

```bash
pnpm changeset:version
```

This command:
- Reads all pending `.changeset/*.md` files
- Bumps `@hari/core` and `@hari/ui` to `1.1.0` (minor bump, linked)
- Updates `packages/core/package.json` and `packages/ui/package.json`
- Regenerates `CHANGELOG.md` in each package
- Deletes the processed `.changeset/*.md` files

Review the diff, then commit:

```bash
git add -A
git commit -m "chore: release v1.1.0"
```

### Step 4 — Build release artifacts

```bash
pnpm build
```

Verify both packages build cleanly:

```
packages/core/dist/index.js   ✓
packages/core/dist/index.cjs  ✓
packages/core/dist/index.d.ts ✓
packages/ui/dist/index.js     ✓
packages/ui/dist/index.cjs    ✓
packages/ui/dist/index.d.ts   ✓
```

### Step 5 — Publish to npm

```bash
pnpm changeset:publish
```

This runs `changeset publish`, which:
- Reads the updated `package.json` versions
- Publishes `@hari/core@1.1.0` and `@hari/ui@1.1.0` to npm
- Creates git tags: `@hari/core@1.1.0` and `@hari/ui@1.1.0`

> **Note**: `@hari/demo` and `@hari/dev-services` are **not** published — they
> are excluded by the `ignore` list in `.changeset/config.json`.

### Step 6 — Push tags

```bash
git push origin main --tags
```

### Step 7 — Create a GitHub release

```bash
gh release create @hari/core@1.1.0 \
  --title "HARI v1.1.0" \
  --notes-file packages/core/CHANGELOG.md \
  --latest
```

---

## Ongoing PR Workflow (after v1.1.0)

Every PR that introduces a user-visible change to `@hari/core` or `@hari/ui`
**must include a changeset**. PRs without one will be blocked by CI.

### Adding a changeset to a PR

```bash
# Inside your feature branch
pnpm changeset

# Answer the interactive prompts
# Commit the generated .changeset/<hash>.md file
git add .changeset/*.md
git commit -m "chore: add changeset"
```

### Changeset bump guidelines

| Change type | Bump | Examples |
|---|---|---|
| Breaking API change | `major` | Removing a schema field, renaming a prop |
| New feature (backward-compatible) | `minor` | New renderer, new schema type |
| Bug fix | `patch` | Fix rendering bug, fix Zod validation edge case |
| Docs / tests only | No changeset needed | Story additions, README updates |

> **Exception**: Storybook story files (`.stories.tsx`) are documentation.
> They do not require a changeset unless they also change a component's API.

### Checking pending changesets

```bash
pnpm changeset:status
```

---

## On the `ignore` Configuration

### Why `@hari/demo` is ignored

The demo package is a development sandbox. It is never published to npm and its
version is not semantically meaningful to external consumers. Including it in
changesets would create spurious version noise.

### Why `@hari/dev-services` is ignored

`@hari/dev-services` contains internal SSE/WebSocket servers and test tooling.
It is not a public package.  It has `private: true` in its `package.json` and
should never appear on npm.

---

## Configuration Reference

`.changeset/config.json`:

```json
{
  "changelog": "@changesets/cli/changelog",
  "commit": false,
  "linked": [["@hari/core", "@hari/ui"]],
  "access": "public",
  "baseBranch": "main",
  "updateInternalDependencies": "patch",
  "ignore": ["@hari/demo", "@hari/dev-services"]
}
```

| Field | Value | Meaning |
|---|---|---|
| `commit` | `false` | Do not auto-commit version bumps. Release manager commits manually. |
| `linked` | `[["@hari/core","@hari/ui"]]` | Always release at the same version. |
| `access` | `"public"` | Publish as public scoped packages (`@hari/...`). |
| `baseBranch` | `"main"` | Changesets compares against `main`. |
| `updateInternalDependencies` | `"patch"` | Auto-update internal deps on release. |
| `ignore` | `["@hari/demo","@hari/dev-services"]` | Exclude internal packages. |
