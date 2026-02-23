# HARI Future Tasks — v0.3 and Beyond

This document captures all planned work that was **out of scope** for v0.1–v0.2.
It is the canonical reference for contributors picking up new features and for
project planning beyond the initial delivery.

> **Context:** v0.1 delivered the core intent architecture (comparison,
> diagnostic, document, form). v0.2 wired up the demo, added unit/integration
> tests, and stabilised the registry. Everything below targets v0.3+.

---

## Table of Contents

1. [Enhanced Form Capabilities](#1-enhanced-form-capabilities)
2. [Enhanced Document Capabilities](#2-enhanced-document-capabilities)
3. [New Intent Types](#3-new-intent-types)
4. [Accessibility (WCAG 2.2 AA)](#4-accessibility-wcag-22-aa)
5. [Trust & Validation](#5-trust--validation)
6. [Performance](#6-performance)
7. [Real Integrations — MCP, WebSocket, SSE](#7-real-integrations--mcp-websocket-sse)
8. [Schema Versioning](#8-schema-versioning)
9. [Hypothetical Mode](#9-hypothetical-mode)
10. [Developer Experience — Storybook & Tooling](#10-developer-experience--storybook--tooling)
11. [Documentation](#11-documentation)
12. [Research & Exploration](#12-research--exploration)
13. [Platform Expansion](#13-platform-expansion)
14. [Metrics & Analytics](#14-metrics--analytics)
15. [Known Issues / Tech Debt](#15-known-issues--tech-debt)
16. [Community Requests](#16-community-requests)

---

## 1. Enhanced Form Capabilities

### 1a. File Upload — Preview and Progress

**What:** The `file` field type in `packages/core/src/schemas/form.ts` currently
defines the schema (MIME filtering, max size, multiple files). The renderer in
`FormRenderer.tsx` shows a basic file input. Two major UX pieces are missing:

- **Upload progress bar** — show bytes uploaded / total while the file is in
  flight to an agent or storage endpoint.
- **Preview thumbnails** — for `image/*` files show a local `URL.createObjectURL`
  preview; for other types show a file-type icon with name and size.

**Implementation notes:**
- Add a `FileUploadProgress` sub-component inside `FormRenderer.tsx`.
- Use the `XMLHttpRequest` `progress` event or the `fetch` API with a
  `ReadableStream` body to stream upload progress.
- The field schema (`FileFieldSchema`) already carries `maxSizeBytes` and
  `accept` — use these for client-side validation before upload begins.
- Emit a `field_change` event (matching existing form submission telemetry)
  when upload completes, carrying the server-assigned file reference.

**Files to change:**
- `packages/ui/src/components/FormRenderer.tsx` — add `FileUploadProgress`
- `packages/core/src/schemas/form.ts` — optionally extend `FileFieldSchema`
  with an `uploadUrl` field so the renderer knows where to POST

---

### 1b. Multi-Step Wizard Forms

**What:** Long forms (e.g. the deployment scenario has 5 sections) benefit from
a wizard that shows one step at a time with a progress indicator, back/next
navigation, and per-step validation before advancing.

**Implementation notes:**
- Add `wizard?: boolean` and `steps?: FormStep[]` to `FormPayloadSchema` in
  `packages/core/src/schemas/form.ts`.
- `FormStep` should reference a subset of `sectionIds` from the existing
  `FormSection` array — reuse sections, don't duplicate.
- The renderer tracks `currentStep` in local React state; back/next buttons
  run validation only on the visible step's fields.
- Add a `StepIndicator` sub-component: numbered dots or a horizontal stepper
  with labels from each step's title.
- Emit `form_step_advance` and `form_step_back` telemetry events.

**Files to change:**
- `packages/core/src/schemas/form.ts` — `FormStep`, `wizard` flag
- `packages/ui/src/components/FormRenderer.tsx` — wizard state machine
- `packages/core/src/__tests__/form.test.ts` — wizard navigation tests

---

### 1c. Form Auto-Save and Recovery

Store partial form state to `localStorage` keyed by `intentId` so users can
resume a long form after a page refresh. Show a "Restore saved draft?" banner
on mount if a matching key exists. Clear on successful submission.

---

### 1d. Additional Field Types

| Field | Description |
|---|---|
| `rich_text` | Prose editor (consider Tiptap or Lexical) with bold/italic/link |
| `date_range` | Two linked date pickers for start/end with calendar overlay |
| `color` | Swatch picker emitting a hex string |
| `autocomplete` | Text input that fires an async callback and renders a dropdown of suggestions; the agent provides a query URL or callback ID |

Each new field type requires:
1. A new discriminated union branch in `FormFieldSchema`
2. A renderer branch in `FormRenderer.tsx`
3. Unit tests in `form.test.ts` and `FormRenderer.test.tsx`

---

## 2. Enhanced Document Capabilities

### 2a. Full Charting Library Integration

**What:** `dataviz` blocks in `packages/core/src/schemas/document.ts` define
chart types (`line`, `bar`, `pie`, `scatter`, `sparkline`). The current
`DocumentRenderer.tsx` renders sparklines inline and shows a grey placeholder
for all other types.

**Recommended library:** [Recharts](https://recharts.org) — composable,
TypeScript-native, small bundle, SSR-compatible.

**Implementation notes:**
- Add `recharts` to `packages/ui/package.json`.
- Create `packages/ui/src/components/charts/` with one file per chart type:
  `LineChart.tsx`, `BarChart.tsx`, `PieChart.tsx`, `ScatterChart.tsx`.
- Each wrapper accepts the existing `DataVizBlockSchema` data shape (`series`,
  `labels`, `xAxis`, `yAxis`).
- Keep the sparkline as the current inline SVG to avoid a full Recharts import
  for simple trend lines.
- Lazy-load chart components with `React.lazy` / `Suspense` so consumers that
  never render charts pay no bundle cost.

**Files to change:**
- `packages/ui/src/components/DocumentRenderer.tsx`
- `packages/ui/src/components/charts/` (new directory)
- `packages/ui/package.json`

---

### 2b. Interactive Code Blocks with Syntax Highlighting

The `code` block type currently renders in a `<pre>` tag. Add
[Shiki](https://shiki.style) (or `prism-react-renderer` for a lighter option)
to provide token-coloured output.

- Pass the `language` field from `CodeBlockSchema` to the highlighter.
- Add a "Copy to clipboard" button in the top-right corner of the block.
- Honour the user's OS colour scheme (`prefers-color-scheme`) for light/dark
  token themes.

---

### 2c. Table Sorting and Filtering

The `table` block supports `sortable` and `filterable` flags in the schema but
the renderer ignores them. Implement:

- Click a column header → cycles through `asc`, `desc`, `none` sort states.
- A filter input above the table that does client-side row filtering across all
  string columns.
- Persist sort/filter state in component-local state (not the intent payload).

---

### 2d. Expandable / Collapsible Sections

Add a `collapsible?: boolean` and `defaultCollapsed?: boolean` option to
`SectionBlockSchema`. The renderer wraps the section in a `<details>` /
`<summary>` pair (native, no JS needed for basic behaviour) and adds an
animated chevron.

---

### 2e. Table of Contents Auto-Generation

When a document contains three or more `heading` blocks, render a sticky
sidebar TOC (on wide viewports) or a floating "Contents" button (on narrow
viewports) that links to each heading via fragment IDs.

---

### 2f. Document Search and Navigation

Add a `Ctrl+F` / `⌘+F` interceptor that opens an in-document search overlay,
highlights matching text across all text blocks, and provides prev/next
navigation with a match counter.

---

### 2g. Export to PDF / Markdown

- **Markdown export:** Walk the block tree and serialise each block type to
  its Markdown equivalent. Offer as a download via `Blob` + `URL.createObjectURL`.
- **PDF export:** Use the browser's `window.print()` with a print-specific CSS
  stylesheet as a zero-dependency option. For richer output, integrate
  `@react-pdf/renderer` behind a dynamic import.

---

## 3. New Intent Types

All new intent types follow the same pattern:

1. Define a Zod schema in `packages/core/src/schemas/<type>.ts`
2. Export from `packages/core/src/index.ts`
3. Create a renderer in `packages/ui/src/components/<Type>Renderer.tsx`
4. Register in the default component registry
5. Add a demo scenario in `packages/demo/src/scenarios/<type>.ts`
6. Write unit tests for the schema and integration tests for the renderer

---

### 3a. Chat / Conversation Intent

**Purpose:** Display a conversation thread between the user and agent, with
support for streaming new messages as they arrive.

**Schema sketch (`packages/core/src/schemas/chat.ts`):**
```ts
ChatMessageSchema = z.object({
  id: z.string(),
  role: z.enum(['user', 'agent', 'system']),
  content: z.string(),           // markdown supported
  timestamp: z.number(),
  status: z.enum(['sent', 'streaming', 'error']).optional(),
  attachments: z.array(AttachmentSchema).optional(),
});

ChatPayloadSchema = z.object({
  messages: z.array(ChatMessageSchema),
  inputPlaceholder: z.string().optional(),
  allowAttachments: z.boolean().default(false),
  streamingMessageId: z.string().optional(), // which message is streaming
});
```

**Renderer notes:**
- Messages stream character-by-character when `status === 'streaming'`.
- Integrate with the existing `StreamingParser` in
  `packages/core/src/transport/streaming.ts`.
- Input box emits a `user_message` action through the existing action safety
  layer.

---

### 3b. Calendar Intent

**Purpose:** Show a calendar view for event scheduling, availability checking,
or planning.

**Schema sketch (`packages/core/src/schemas/calendar.ts`):**
```ts
CalendarEventSchema = z.object({
  id: z.string(),
  title: z.string(),
  start: z.string(),    // ISO 8601
  end: z.string(),
  allDay: z.boolean().default(false),
  color: z.string().optional(),
  description: z.string().optional(),
  actions: z.array(AgentActionSchema).optional(),
});

CalendarPayloadSchema = z.object({
  events: z.array(CalendarEventSchema),
  defaultView: z.enum(['month', 'week', 'day', 'agenda']).default('week'),
  initialDate: z.string().optional(), // ISO 8601
  selectable: z.boolean().default(false), // user can click to create events
});
```

**Implementation notes:**
- Build a lightweight month/week grid rather than importing a full calendar
  library. The existing inline-style approach used throughout the UI package
  is preferred.
- If a library is needed, evaluate `@fullcalendar/react` (rich but large) vs a
  minimal hand-rolled grid first.

---

### 3c. Workflow Intent

A multi-step guided process where the agent walks the user through a sequence
of steps, each of which can embed any other intent type (form, document, etc.).
Schema skeleton already exists at `packages/core/src/schemas/workflow.ts`.

**Remaining work:**
- Implement `WorkflowRenderer.tsx` that renders the current step and provides
  breadcrumb navigation.
- Support branching (`next` can be a step ID or a condition expression).
- Integrate with the form validation system for steps that contain forms.

---

### 3d. Timeline Intent

Chronological event visualisation. Schema skeleton exists at
`packages/core/src/schemas/timeline.ts`.

**Remaining work:**
- Implement `TimelineRenderer.tsx` with vertical (default) and horizontal
  layout modes.
- Support collapsible event details.
- Support zoom (day / week / month / year axis).

---

### 3e. Kanban Intent

Task board with lanes and draggable cards. Schema skeleton exists at
`packages/core/src/schemas/kanban.ts`.

**Remaining work:**
- Implement `KanbanRenderer.tsx`.
- Use the HTML Drag and Drop API (no library) for card reordering.
- Emit `card_moved` action events when a card is dropped in a new lane.
- Support WIP limits per lane.

---

### 3f. Tree / Hierarchy Intent

Organizational chart or file-system-style tree.

**Schema sketch:**
```ts
TreeNodeSchema: z.object({
  id: z.string(),
  label: z.string(),
  children: z.array(z.lazy(() => TreeNodeSchema)).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  actions: z.array(AgentActionSchema).optional(),
});
```

Render as an expandable/collapsible tree with indented levels; support
selecting nodes (single or multi-select) and emitting selection actions.

---

## 4. Accessibility (WCAG 2.2 AA)

A full audit pass is needed across all renderers.

| Task | Component(s) | Notes |
|---|---|---|
| Keyboard navigation audit | All | Tab order, Enter/Space activation, Escape to close |
| Screen reader optimisation | FormRenderer, DocumentRenderer | Announce live regions on updates |
| Focus management | Modals, explainability drawers | Return focus to trigger on close |
| ARIA label completeness | All interactive elements | No unlabelled buttons |
| Colour contrast verification | All themes | Minimum 4.5:1 for normal text, 3:1 for large text |
| Motion/animation reduction | All animated elements | Respect `prefers-reduced-motion` |

Use [axe-core](https://github.com/dequelabs/axe-core) in the test suite:
```ts
import { axe } from 'jest-axe'; // or vitest-axe
```

---

## 5. Trust & Validation

| Task | Description |
|---|---|
| Blast radius user testing | Conduct moderated sessions to verify users correctly understand the scope of destructive actions |
| Confirmation delay A/B test | Test 3-second vs 5-second delay on high-`blastRadius` actions and measure accidental trigger rate |
| Confidence score calibration | Compare agent-reported `confidence` against actual outcome correctness; build calibration dataset |
| Error recovery patterns | Define UX for partial action failures: retry, rollback, and partial success states |

---

## 6. Performance

### 6a. Streaming JSON Parser

The transport layer in `packages/core/src/transport/streaming.ts` provides a
`StreamingParser`. Wire it into renderers so components can start painting as
soon as the first valid block arrives, rather than waiting for the full intent
payload.

**Key change:** The compiler in `packages/core/src/compiler/compiler.ts` needs
a streaming mode that yields partial `IntentPayload` objects as additional JSON
tokens arrive.

### 6b. Large Form Virtualisation

Forms with more than ~50 visible fields (rare but possible in expert mode)
should virtualise the field list using a library such as
[`@tanstack/react-virtual`](https://tanstack.com/virtual) to keep DOM node
count bounded.

### 6c. Document Lazy Loading

For documents with many blocks, only render blocks inside or near the viewport
using an `IntersectionObserver`. Blocks outside the viewport render a
placeholder `<div>` of the correct estimated height.

### 6d. Bundle Size Optimisation

- Audit bundle with `vite-bundle-visualizer` or `rollup-plugin-visualizer`.
- Ensure Recharts (and any other large optional dependency) is tree-shaken when
  not used.
- Target: `@hari/core` < 30 KB gzipped, `@hari/ui` < 60 KB gzipped (excluding
  optional charting).

---

## 7. Real Integrations — MCP, WebSocket, SSE

### 7a. MCP Server Integration Examples

The MCP transport stub exists at `packages/core/src/transport/mcp.ts`. Build
two or three concrete connector examples:

1. **Filesystem MCP connector** — reads local files and serves them as document
   intents. Good for developer onboarding.
2. **Database MCP connector** — queries a SQLite or PostgreSQL database and
   returns comparison or diagnostic intents.
3. **REST API MCP connector** — wraps an existing REST endpoint and translates
   its response schema into a HARI intent.

Each example should live under `examples/mcp-<name>/` at the repo root with
its own `README.md` and runnable `main.ts`.

### 7b. WebSocket Transport

The `WebSocketTransport` in `packages/core/src/transport/websocket.ts` is
implemented but not demoed end-to-end. Add:
- A minimal Node.js server script (`examples/ws-server/`) that accepts
  connections and pushes live intent patches.
- A demo scenario in `packages/demo` that connects via WebSocket and shows
  live-updating diagnostic metrics.

### 7c. Server-Sent Events (SSE) for Live Document Refresh

The `SSETransport` in `packages/core/src/transport/sse.ts` exists. Wire it to
the living-document refresh mechanism:
- When `DocumentPayload.refreshable === true` and a `refreshIntervalSeconds` is
  set, the demo should open an SSE connection and push updated document payloads
  at that interval.

### 7d. Agent SDK Integration Guide

Write a step-by-step guide (in `docs/agent-sdk-integration.md`) showing how an
agent built with the Anthropic Agent SDK can:
1. Construct a valid `IntentPayload` from tool call results.
2. Stream it to a HARI frontend over SSE.
3. Handle `IntentModification` patches sent back from the user.

---

## 8. Schema Versioning

The intent payload carries a `version` field (`packages/core/src/compiler/version.ts`).
Build the infrastructure to support evolving schemas without breaking deployed
frontends.

| Task | Description |
|---|---|
| Migration utilities | Functions that up-cast older payloads to the current schema, e.g. `migrate(payload, '0.1.0', '0.3.0')` |
| Backward compatibility layer | Accept payloads one major version behind and shim missing fields |
| Version negotiation | Add a `capabilities` handshake to the transport: agent advertises supported versions, frontend responds with its range |
| Capability discovery API | Expose `GET /capabilities` returning supported intent types, field types, and schema version range |

---

## 9. Hypothetical Mode

**Purpose:** Let agents propose "what-if" scenarios without mutating real state.
The user can explore the hypothetical, compare it against current state, and
then commit or discard.

| Task | Description |
|---|---|
| Isolated overlay system | Render a hypothetical intent inside a clearly-marked overlay that cannot trigger real actions |
| State branching | `useIntentStore` should support a `hypothetical` branch that shadows the real intent without replacing it |
| Compare hypothetical vs actual | Side-by-side or diff view of current vs hypothetical intent payloads |
| Rollback / commit flow | "Apply this" button promotes the hypothetical to real; "Discard" removes the branch |

---

## 10. Developer Experience — Storybook & Tooling

### 10a. Storybook Integration

Add Storybook to `packages/ui` so every component can be developed and
reviewed in isolation.

```bash
pnpm --filter @hari/ui dlx storybook init
```

Stories needed for each of:
- `DocumentRenderer` — one story per block type (heading, paragraph, table,
  dataviz, code, image, quote, embed, callout, list, divider, badge)
- `FormRenderer` — one story per field type plus a full wizard story
- `ComparisonRenderer`
- `DiagnosticRenderer`
- All new intent type renderers as they are added

Add Chromatic (or similar) for visual regression testing via CI.

### 10b. Component Playground

An interactive page in the demo app where developers can paste a raw JSON
intent payload and see the rendered output side-by-side with schema validation
errors. Useful for agent authors testing their output.

### 10c. Intent Payload Builder / Validator UI

A form-based intent payload builder: select intent type → fill in fields →
see the generated JSON → copy to clipboard or send to the live demo renderer.

### 10d. TypeScript Strict Mode

Enable `"strict": true` in `tsconfig.json`. Fix all resulting errors. This is a
prerequisite for publishing to npm with high confidence.

### 10e. ESLint + Prettier

Add `@typescript-eslint/eslint-plugin`, `eslint-plugin-react`, and
`eslint-plugin-jsx-a11y`. Add `prettier` with a shared config. Wire both into
the `pnpm lint` and `pnpm format` scripts.

---

## 11. Documentation

| Document | Location | Description |
|---|---|---|
| Architecture Decision Records | `docs/adr/` | One ADR per major design choice (intent model, Zod schemas, inline styles, etc.) |
| Component API docs | `docs/api/` | Auto-generated from TSDoc comments via `typedoc` |
| Schema reference guide | `docs/schema-reference.md` | Human-readable reference for every schema type and field |
| Integration tutorials | `docs/tutorials/` | Step-by-step guides for common integration patterns |
| Migration guides | `docs/migration/` | How to upgrade from one version to the next |
| Video walkthroughs | Link from `README.md` | Screen recordings of the demo app and key concepts |

---

## 12. Research & Exploration

These items require research or prototyping before committing to an approach.

### 12a. Advanced Collaboration Features

- **Voice input for forms** — Web Speech API `SpeechRecognition` to populate
  text/number fields by dictation.
- **Collaborative editing** — Multiple users editing the same document intent
  simultaneously using CRDTs (e.g. Yjs).
- **Offline mode with sync** — Cache intent payloads in IndexedDB; sync
  mutations when connectivity resumes.
- **Real-time collaboration indicators** — Show cursor positions and user
  avatars for concurrent viewers.
- **Version control for intent payloads** — Git-like history of intent
  modifications with the ability to `checkout` any previous state.
- **Undo / redo** — Maintain an undo stack of `IntentModification` patches.

### 12b. AI / ML Integration

- **Intent prediction** — Based on conversation history, suggest the next
  intent type before the agent explicitly proposes it.
- **Smart defaults** — Pre-populate form fields from user history or
  organisational data.
- **Anomaly detection in diagnostic views** — Automatically flag metric values
  that fall outside historical norms.
- **Natural language form filling** — User types a sentence; HARI parses it and
  populates the relevant form fields.
- **Document summarisation** — One-click "TL;DR" that calls an LLM to produce
  a 3-bullet executive summary of a long document.

---

## 13. Platform Expansion

| Platform | Approach | Priority |
|---|---|---|
| React Native (mobile) | New `packages/ui-native` using `react-native` primitives | High — most requested |
| Web Components | Wrap each renderer in a `CustomElement` for framework-agnostic use | Medium |
| Vue.js adapter | Thin Vue wrapper that accepts the same intent payload props | Medium |
| Svelte adapter | Svelte component wrappers | Low |
| Desktop (Electron / Tauri) | Bundle the demo app as a native desktop application | Low |

---

## 14. Metrics & Analytics

Track these signals to measure HARI's real-world effectiveness. The telemetry
infrastructure exists in `packages/core/src/telemetry/`; these are the events
and dashboards to build on top of it.

| Metric | How to measure |
|---|---|
| Time to complete forms | `form_focus` → `form_submit` delta in telemetry |
| Blast radius comprehension | Survey after action + error rate on high-risk actions |
| Confidence score accuracy | Compare `IntentPayload.confidence` against outcome labelling |
| Ambiguity control usage | Count `intent_modification` events per session |
| Density mode preference by role | `density_change` events grouped by user role |
| Error rates on high-risk actions | `action_error` events filtered by `blastRadius >= 7` |
| Document engagement | Scroll-depth tracking via `IntersectionObserver` on blocks |
| Form abandonment | Sessions with `form_focus` but no `form_submit` |
| Explainability panel open rate | `explainability_open` events / total renders |

---

## 15. Known Issues / Tech Debt

These are bugs and debt items that block quality work and should be fixed early
in the v0.3 cycle.

| Issue | File(s) | Notes |
|---|---|---|
| `FormRenderer` doesn't handle async validation | `FormRenderer.tsx` | Need `validate` callback on field schemas that returns a `Promise<string \| null>` |
| `DocumentRenderer` dataviz is placeholder | `DocumentRenderer.tsx` | Blocked on §2a (charting library) |
| Image block lacks lightbox / expandable mode | `DocumentRenderer.tsx` | Add `onClick` → full-screen overlay |
| Table block lacks row actions | `DocumentRenderer.tsx`, `document.ts` | Add `rowActions: AgentAction[]` to `TableRow` |
| No responsive breakpoints for density modes | All renderers | Define CSS custom properties or media queries for `executive`/`operator`/`expert` breakpoints |
| Missing error boundaries for block types | `DocumentRenderer.tsx` | Wrap each block in `<ErrorBoundary>` so one bad block doesn't crash the document |
| Form sections don't support nested sections | `form.ts`, `FormRenderer.tsx` | `FormSection.fields` should accept nested `FormSection` via `z.lazy` |
| No built-in rate limiting for form submission | `FormRenderer.tsx` | Add debounce / disable-on-submit guard against double-submit |

---

## 16. Community Requests

Features requested by early adopters. Track additions here as issues are filed.

| Request | Status | Notes |
|---|---|---|
| Dark mode for all components | Not started | Use `prefers-color-scheme` media query + CSS custom properties |
| Custom theme configuration | Not started | Expose a `<HARIThemeProvider>` with a token map |
| Localisation / i18n | Not started | Externalise all user-visible strings; consider `react-intl` or `i18next` |
| Right-to-left (RTL) language support | Not started | `dir="rtl"` on root + CSS logical properties |
| Export scenarios to JSON | Not started | "Download scenario" button in demo app |
| Import scenarios from JSON | Not started | File picker → parse → feed into intent store |
| Component CSS variables | Not started | Replace inline style magic numbers with `var(--hari-*)` tokens |

---

## How to Pick Up a Task

1. Search this file for the area you want to work on.
2. Check `TODO.md` for any associated `[ ]` items.
3. Create a branch: `git checkout -b feat/<short-description>`.
4. Follow the implementation notes above.
5. Add tests (unit in `packages/core/src/__tests__/`, integration in
   `packages/ui/src/__tests__/`).
6. Update `TODO.md` — check off completed items and add any new ones discovered.
7. Open a pull request referencing this document.

---

*Last updated: 2026-02-23*
