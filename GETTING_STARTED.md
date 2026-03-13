# Getting Started with HARI

> **Goal:** Render an AI-driven intent in a governed UI in under 15 minutes.

---

## Prerequisites

- **Node.js 20+** (`node -v`)
- **pnpm 9+** (`pnpm -v`)

---

## 1. Clone & Install (2 min)

```bash
git clone https://github.com/<your-org>/agent-ui-kit.git
cd agent-ui-kit
pnpm install
```

---

## 2. Start the Demo (1 min)

```bash
make dev
# → opens http://localhost:5173
```

This starts the Vite dev server for `@hari/demo`. Click through the 24 scenarios in the header to see every intent type: documents, forms, kanban boards, calendars, timelines, charts, maps, and full governance flows.

---

## 3. Your First IntentPayload (5 min)

An `IntentPayload` is the JSON contract between your AI agent and the HARI UI. The agent proposes *what* to show; HARI decides *how* to render it.

Create a file `packages/demo/src/scenarios/my-first.ts`:

```typescript
import { v4 as uuid } from 'uuid';
import type { IntentPayloadInput } from '@hari/core';

export const myFirstIntent: IntentPayloadInput = {
  version: '1.0.0',
  intentId: uuid(),
  type: 'document',
  domain: 'getting-started',
  primaryGoal: 'Show a welcome message with confidence indicators',
  confidence: 0.92,
  density: 'operator',
  data: {
    title: 'Welcome to HARI',
    author: 'My First Agent',
    publishedAt: new Date().toISOString(),
    summary: 'This is your first HARI-rendered intent.',
    sections: [
      {
        id: 'intro',
        title: 'What Just Happened',
        confidence: 0.95,
        blocks: [
          {
            type: 'paragraph',
            text: 'Your agent emitted an IntentPayload. HARI validated it against its schema, compiled it through the registry, and rendered this document — with confidence scores, density modes, and explainability built in.',
          },
          {
            type: 'callout',
            variant: 'insight',
            title: 'This is governed UI',
            text: 'Unlike a raw chatbot response, every field here is schema-validated. The confidence score (92%) is visible to the human. The human stays in control.',
          },
        ],
      },
    ],
  },
  ambiguities: [
    {
      id: 'detail_level',
      type: 'single_select',
      label: 'Detail Level',
      options: [
        { label: 'Summary', value: 'summary' },
        { label: 'Full', value: 'full' },
      ],
      value: 'summary',
    },
  ],
  actions: [
    {
      id: 'acknowledge',
      label: 'Got It',
      variant: 'primary',
      safety: { reversible: true, riskLevel: 'low', requiresConfirmation: false },
    },
  ],
  explain: false,
  priorityFields: ['summary'],
};
```

Then register it in the demo's scenario list. Open `packages/demo/src/App.tsx` and add:

```typescript
import { myFirstIntent } from './scenarios/my-first';

// Add to the SCENARIOS object:
const SCENARIOS = {
  myfirst: { label: 'My First', icon: <Zap size={14} />, intent: myFirstIntent },
  // ...existing scenarios
};
```

Reload the demo and click "My First" in the header.

---

## 4. Understand the Pipeline

```
┌─────────────────┐     ┌──────────────┐     ┌────────────────┐     ┌───────────┐
│  Your Agent      │────▶│  Transport   │────▶│  HARI Compiler │────▶│  React UI │
│  (LLM / API)    │     │  (WS/SSE/MCP)│     │  (schema +     │     │  (themed, │
│                  │     │              │     │   registry)    │     │  governed) │
└─────────────────┘     └──────────────┘     └────────────────┘     └───────────┘
```

1. **Agent** produces `IntentPayload` JSON (or `SituationalPerception` for governance flows)
2. **Transport** delivers it — `MockAgentBridge` for demos, `WebSocketAgentBridge` or `SSEAgentBridge` for production
3. **Compiler** validates against Zod schemas, resolves a component from the registry, and compiles the view
4. **React UI** renders with density modes, themes, confidence indicators, and action buttons

---

## 5. Connect a Real LLM (5 min)

### Option A — Ollama (local, no API key)

```bash
# Install Ollama: https://ollama.ai
ollama pull llama3.2

# Start the HARI dev services
docker compose up sse-server
```

Set `VITE_TRANSPORT=sse` in the demo's `.env` file and reload.

### Option B — OpenAI

```typescript
// backend/agent.ts
import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { IntentPayloadSchema } from '@hari/core';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function respond(userMessage: string) {
  const response = await openai.beta.chat.completions.parse({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: 'Respond ONLY with valid IntentPayload JSON.' },
      { role: 'user', content: userMessage },
    ],
    response_format: zodResponseFormat(IntentPayloadSchema, 'intent'),
  });
  return response.choices[0].message.parsed!;
}
```

### Option C — Anthropic Claude

```typescript
import Anthropic from '@anthropic-ai/sdk';
import { IntentPayloadSchema } from '@hari/core';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function respond(userMessage: string) {
  const response = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 4096,
    system: 'Respond ONLY with valid IntentPayload JSON.',
    messages: [{ role: 'user', content: userMessage }],
  });
  const raw = response.content[0].type === 'text' ? response.content[0].text : '';
  return IntentPayloadSchema.parse(JSON.parse(raw));
}
```

---

## 6. Add Governance (optional)

For high-stakes actions, wrap them in `GovernedAction` and emit a `SituationalPerception`:

```typescript
import type { GovernedAction } from '@hari/core';

const deployAction: GovernedAction = {
  action: {
    id: 'deploy_production',
    label: 'Deploy to Production',
    variant: 'destructive',
    safety: {
      confidence: 0.88,
      reversible: false,
      riskLevel: 'high',
      requiresConfirmation: true,
      confirmationDelay: 5000,
      explanation: 'Deploys build #1847 to all production nodes.',
    },
  },
  intent: 'Deploy latest build to production cluster',
  reversibility: 'irreversible',
  requiredAuthority: 'approve',
  actionConfidence: 0.88,
};
```

See the **Governance Demo**, **Deploy Approval**, **Finance Escalation**, and **Security Emergency** scenarios in the demo for full working examples.

---

## Next Steps

| What | Where |
|---|---|
| Full developer guide | [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md) |
| Backend integration | [INTEGRATION_GUIDE.md](INTEGRATION_GUIDE.md) |
| Perception contract spec | [docs/PERCEPTION-CONTRACT.md](docs/PERCEPTION-CONTRACT.md) |
| Anti-patterns to avoid | [ANTI-PATTERNS.md](ANTI-PATTERNS.md) |
| All documentation | [docs/guides/README.md](docs/guides/README.md) |

---

## Common Commands

```bash
make dev         # Start demo dev server
make build       # Build all packages
make test        # Run all 1,502 tests
make typecheck   # TypeScript strict mode check
make lint        # ESLint
```
