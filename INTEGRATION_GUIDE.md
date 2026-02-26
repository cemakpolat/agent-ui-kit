# Integration Guide — Connecting an LLM Provider to agent-ui-kit

## What this library is

**agent-ui-kit** is a **frontend-only, transport-agnostic UI shell** for LLM-driven interfaces. Its purpose is to eliminate the rendering layer as a concern: you give it a structured `IntentPayload` (JSON), it renders the right component automatically. You never write UI code per-feature again.

```
LLM / Agent  ──→  IntentPayload (JSON)  ──→  agent-ui-kit  ──→  User
User action  ──→  IntentModification  ──→  LLM / Agent
```

The library handles: component selection, density modes (executive / operator / expert), ambiguity negotiation, action safety confirmations, rich document/form/chart rendering, i18n, RTL, and more. **You supply the intelligence.**

---

## Do you need a separate backend layer?

**Yes, in production. No, for prototyping.**

| Scenario | Needs backend? | Why |
|---|---|---|
| Demo / prototype | No | Use `MockAgentBridge` — runs entirely in-browser |
| Single-user app calling an LLM directly | No | Call the LLM API from the browser (CORS + key exposure caveats) |
| Multi-user production app | **Yes** | API keys, auth, session management, rate limiting, caching, streaming |
| Enterprise with existing services | **Yes** | Needs an orchestration layer in front of the LLM |

The backend layer — when needed — is a **thin orchestration server**, not a monolith. Its only job is:

1. Accept `IntentModification` from the UI
2. Call your LLM with the right system prompt and schema
3. Return an `IntentPayload` to the UI

Everything else (rendering, validation, state, animations) stays in the browser.

---

## Architecture overview

```
┌──────────────────────────────────────────────────────────────────────────┐
│  BROWSER                                                                 │
│                                                                          │
│   Your App                                                               │
│   ├── bridge = new WebSocketAgentBridge('wss://api.yourapp.com/agent')   │
│   ├── useAgentBridge(bridge, capabilityManifest)                         │
│   │    ├── receives:  IntentPayload  (agent → UI)                        │
│   │    └── sends:     IntentModification  (UI → agent)                  │
│   └── <IntentRenderer registry={registry} />                            │
│        └── auto-selects the right component from your registry          │
│                                                                          │
└─────────────────────────┬────────────────────────────────────────────────┘
                          │  WebSocket / SSE / MCP
┌─────────────────────────▼────────────────────────────────────────────────┐
│  BACKEND (Node / Python / Go — your choice)                             │
│                                                                          │
│   AgentOrchestrator                                                      │
│   ├── receives:  IntentModification from UI                              │
│   ├── builds:    LLM system prompt with JSON schema                      │
│   ├── calls:     OpenAI / Anthropic / Bedrock / Ollama / ...            │
│   ├── validates: response against IntentPayloadSchema                    │
│   └── streams:   IntentPayload back to UI                                │
│                                                                          │
└─────────────────────────┬────────────────────────────────────────────────┘
                          │  HTTP / SDK
┌─────────────────────────▼────────────────────────────────────────────────┐
│  LLM PROVIDER                                                            │
│  OpenAI  ·  Anthropic Claude  ·  AWS Bedrock  ·  Azure OpenAI  ·        │
│  Google Gemini  ·  Ollama (local)  ·  any OpenAI-compatible endpoint    │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Step 1 — Define your intent schema

The LLM must return JSON that matches `IntentPayload`. The core fields are:

```typescript
// From @hari/core — IntentPayload
{
  version: "1.0.0",
  intentId: "<uuid>",             // Generate server-side
  type: "document",               // Drives component selection
  domain: "finance",              // Your domain name
  primaryGoal: "Show Q3 report",
  confidence: 0.92,
  density: "operator",
  data: { /* your domain data — passed as props to your component */ },
  ambiguities: [                  // Optional user-adjustable controls
    {
      id: "date_range",
      type: "single_select",
      label: "Period",
      options: [
        { label: "Q3 2024", value: "q3" },
        { label: "Q4 2024", value: "q4" }
      ],
      value: "q3"
    }
  ],
  actions: [                      // Optional action buttons
    {
      id: "export_pdf",
      label: "Export PDF",
      variant: "secondary",
      safety: { reversible: true, riskLevel: "low", requiresConfirmation: false }
    }
  ],
  explain: false,
  priorityFields: ["revenue", "margin"]
}
```

---

## Step 2 — Build the system prompt

Your backend must instruct the LLM to output a valid `IntentPayload`. Include the schema inline:

```typescript
// backend/prompts/intentPrompt.ts
export function buildSystemPrompt(domain: string): string {
  return `
You are an AI assistant for ${domain}. When the user makes a request,
respond ONLY with a valid JSON object matching this schema:

{
  "version": "1.0.0",
  "intentId": "<generate a UUID>",
  "type": "<one of: document | form | comparison | diagnostic_overview | timeline | kanban | chat>",
  "domain": "${domain}",
  "primaryGoal": "<one sentence describing what the user wants>",
  "confidence": <0.0 to 1.0>,
  "density": "operator",
  "data": { <domain-specific structured data> },
  "ambiguities": [ <array of user-adjustable controls if the request is ambiguous> ],
  "actions": [ <array of actions the user can take> ],
  "explain": false,
  "priorityFields": [ <key field names most relevant to the goal> ]
}

Rules:
- Never respond with prose. Always respond with valid JSON only.
- If you are uncertain about something, model it as an ambiguity control.
- Set confidence < 0.7 when you are guessing key parameters.
- For sensitive actions (delete, deploy, purchase) set safety.requiresConfirmation: true.
  `;
}
```

### For Anthropic Claude (recommended — native JSON mode):

```typescript
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function callAgent(
  userMessage: string,
  currentIntent: IntentPayload | null
): Promise<IntentPayload> {
  const response = await client.messages.create({
    model: 'claude-opus-4-6',         // Latest capable model
    max_tokens: 4096,
    system: buildSystemPrompt('finance'),
    messages: [
      // Include conversation history for context
      ...(currentIntent ? [{
        role: 'assistant' as const,
        content: JSON.stringify(currentIntent),
      }] : []),
      {
        role: 'user' as const,
        content: userMessage,
      },
    ],
  });

  const raw = response.content[0].type === 'text' ? response.content[0].text : '';
  const parsed = JSON.parse(raw);

  // Validate against the schema from @hari/core
  return IntentPayloadSchema.parse(parsed);
}
```

### For OpenAI (use structured outputs):

```typescript
import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { IntentPayloadSchema } from '@hari/core';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function callAgent(userMessage: string): Promise<IntentPayload> {
  const response = await openai.beta.chat.completions.parse({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: buildSystemPrompt('finance') },
      { role: 'user',   content: userMessage },
    ],
    response_format: zodResponseFormat(IntentPayloadSchema, 'intent'),
  });

  return response.choices[0].message.parsed!;
}
```

---

## Step 3 — Build the backend server

### Option A — WebSocket server (Node.js/Fastify)

Best for real-time, low-latency apps. The UI uses `WebSocketAgentBridge`.

```typescript
// backend/server.ts
import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import { randomUUID } from 'crypto';
import { IntentPayloadSchema, IntentModificationSchema } from '@hari/core';

const app = Fastify();
app.register(websocket);

app.register(async function (app) {
  app.get('/agent', { websocket: true }, (socket) => {
    // 1. Send initial intent on connect
    const initial = await buildInitialIntent();
    socket.send(JSON.stringify({ type: 'intent', payload: initial }));

    // 2. Handle modifications from the UI
    socket.on('message', async (raw) => {
      const msg = JSON.parse(raw.toString());

      if (msg.type === 'modification') {
        const mod = IntentModificationSchema.parse(msg.payload);
        const updated = await callAgent(mod);         // Your LLM call
        socket.send(JSON.stringify({ type: 'intent', payload: updated }));
      }

      if (msg.type === 'what_if_query') {
        const result = await simulateWhatIf(msg.payload);
        socket.send(JSON.stringify({ type: 'what_if_result', payload: result, id: msg.id }));
      }

      if (msg.type === 'capability_manifest') {
        // Store which intent types and domains the UI supports
        storeManifest(msg.payload);
      }
    });
  });
});

app.listen({ port: 3001 });
```

### Option B — SSE + REST (simpler, works with HTTP/1.1 proxies)

Best if your infrastructure can't handle WebSocket upgrades (e.g., some API gateways).
The UI uses `SSEAgentBridge`.

```typescript
// backend/routes/agent.ts  (Express)
import { Router } from 'express';

const router = Router();

// Server → Client: stream intents
router.get('/agent/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // Send initial intent
  const initial = buildInitialIntent();
  res.write(`event: intent\ndata: ${JSON.stringify(initial)}\n\n`);

  // Store connection for later pushes
  const sessionId = req.headers['x-session-id'] as string;
  sessions.set(sessionId, res);

  req.on('close', () => sessions.delete(sessionId));
});

// Client → Server: receive modifications
router.post('/agent/send', express.json(), async (req, res) => {
  const { type, payload, id } = req.body;
  const sessionId = req.headers['x-session-id'] as string;
  const sse = sessions.get(sessionId);

  if (type === 'modification') {
    const updated = await callAgent(payload);
    sse?.write(`event: intent\ndata: ${JSON.stringify(updated)}\n\n`);
  }

  res.json({ ok: true });
});
```

### Option C — MCP server (for Claude and MCP-compatible clients)

If your agent IS Claude (or another MCP-capable model), expose it as an MCP server.
The UI uses `MCPAgentBridge` and communicates via JSON-RPC 2.0.

```typescript
// This is handled by the MCP SDK — see:
// https://github.com/anthropics/anthropic-sdk-python/tree/main/src/anthropic/mcp
// The MCPAgentBridge expects:
//   ws://host/mcp  →  JSON-RPC 2.0 with:
//     tools: hari_modify_intent, hari_query_whatif
//     resources: hari://intent/current
```

---

## Step 4 — Wire the frontend

```tsx
// src/App.tsx
import React from 'react';
import {
  WebSocketAgentBridge,
  ComponentRegistryManager,
  buildCapabilityManifest,
} from '@hari/core';
import {
  useAgentBridge,
  IntentRenderer,
  DocumentRenderer,
  FormRenderer,
} from '@hari/ui';
import { registry } from './registry';   // Your domain → component map

// Create bridge once (outside component to avoid re-creation)
const bridge = new WebSocketAgentBridge({
  url: import.meta.env.VITE_AGENT_WS_URL ?? 'wss://api.yourapp.com/agent',
  reconnectAttempts: 5,
});

const manifest = buildCapabilityManifest({
  supportedIntentTypes: ['document', 'form', 'comparison', 'diagnostic_overview'],
  supportedDomains: ['finance', 'hr', 'ops'],
  densityModes: ['executive', 'operator', 'expert'],
});

export function App() {
  const { connectionState } = useAgentBridge(bridge, manifest);

  return (
    <div>
      <ConnectionBadge state={connectionState} />
      <IntentRenderer registry={registry} bridge={bridge} />
    </div>
  );
}
```

```tsx
// src/registry.ts
import { ComponentRegistryManager } from '@hari/core';
import { DocumentRenderer, FormRenderer } from '@hari/ui';

export const registry = new ComponentRegistryManager();

// Map (domain, intentType) → component
// The compiled intent's data is spread as props onto your component
registry.register('finance', 'document', {
  default: () => DocumentRenderer,   // Built-in rich document renderer
});

registry.register('finance', 'form', {
  default: () => FormRenderer,       // Built-in form renderer
});

registry.register('finance', 'comparison', {
  executive: () => MyCompactTable,   // Your custom component
  operator:  () => MyDetailTable,
  expert:    () => MyRawDataGrid,
  default:   () => MyDetailTable,
});
```

---

## Step 5 — Handle user actions

When the user clicks an action button (e.g., "Export PDF", "Deploy", "Book"), the UI calls your `onAction` handler:

```tsx
<IntentRenderer
  registry={registry}
  bridge={bridge}
  onAction={async (actionId, actionPayload, intent) => {
    // Send to your backend
    const result = await fetch('/api/actions', {
      method: 'POST',
      body: JSON.stringify({ actionId, payload: actionPayload, intentId: intent.intentId }),
    });
    // The backend can push a new intent back through the bridge
    // e.g., "Action completed — here's the updated state"
  }}
/>
```

---

## Streaming (optional but recommended)

For long-running LLM responses, stream partial intents progressively using the built-in NDJSON parser:

```typescript
// backend: stream partial intent updates
import { streamNdjson } from '@hari/core';

// On the server, emit newline-delimited JSON chunks as the LLM streams:
//   {"type":"intent","payload":{"version":"1.0.0","intentId":"...", ...partial...}}\n
//   {"type":"intent","payload":{...more fields...}}\n

// On the client (inside a custom bridge):
for await (const chunk of streamNdjson(response.body)) {
  bridge.emit('intent', mergePartialIntent(chunk));
}
```

---

## Deployment

### Recommended production topology

```
                  CDN (Cloudflare / CloudFront)
                         │
              ┌──────────▼──────────┐
              │  Static frontend    │  ← Vite build of @hari/ui + your app
              │  (S3 / Vercel /     │    No server required for the UI itself
              │   Cloudflare Pages) │
              └─────────────────────┘
                         │  wss:// or https://
              ┌──────────▼──────────┐
              │  Agent API server   │  ← Node/Python/Go
              │  (ECS / Cloud Run / │    WebSocket or SSE endpoint
              │   Railway / Fly.io) │    Validates + calls LLM
              └─────────────────────┘
                         │  HTTPS
              ┌──────────▼──────────┐
              │  LLM Provider       │  ← Anthropic / OpenAI / Bedrock
              │  (external API)     │    or self-hosted Ollama
              └─────────────────────┘
```

### Minimal deployment (single-server)

If you want the simplest possible setup:

```
Docker container:
  ├── Node.js server (port 3001)
  │    ├── Serves the Vite-built static files
  │    └── WebSocket endpoint at /agent
  └── Calls LLM API outbound
```

```dockerfile
# Dockerfile
FROM node:20-slim
WORKDIR /app
COPY . .
RUN pnpm install && pnpm build          # builds UI to dist/
EXPOSE 3001
CMD ["node", "backend/server.js"]       # serves dist/ + /agent websocket
```

### Scaling considerations

| Concern | Solution |
|---|---|
| WebSocket state per user | Sticky sessions (ALB / Nginx `ip_hash`) or move state to Redis |
| LLM latency (2–10s) | Stream partial `IntentPayload` chunks; show skeleton loader |
| LLM cost | Cache identical intents (hash of user query + context); use cheaper model for drafts |
| Rate limiting | Already in `FormRenderer` (`rateLimit` prop); add API-level rate limiting on the backend |
| Auth | JWT in WebSocket handshake header or cookie; validate before accepting the connection |

---

## Environment variables

```bash
# Frontend (.env)
VITE_AGENT_WS_URL=wss://api.yourapp.com/agent
VITE_APP_DOMAIN=finance           # Default domain for registry

# Backend (.env)
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...             # If using OpenAI
PORT=3001
CORS_ORIGIN=https://yourapp.com
JWT_SECRET=...
REDIS_URL=redis://...             # Optional, for session sharing
```

---

## Quick-start checklist

- [ ] Define your domain name and `intentType` values
- [ ] Write a system prompt that instructs your LLM to output `IntentPayload` JSON
- [ ] Build a backend endpoint (WebSocket recommended) that calls the LLM and returns the payload
- [ ] Register your domain/intent → component mapping in the frontend registry
- [ ] Use `WebSocketAgentBridge` (or `SSEAgentBridge`) instead of `MockAgentBridge`
- [ ] Deploy frontend as static files, backend as a containerised service
- [ ] Add auth to the WebSocket handshake
- [ ] Add LLM response caching for repeated queries

---

## Summary

| Question | Answer |
|---|---|
| Do I need a backend? | Yes for production (API key security, auth, session management). No for demos. |
| What does the backend do? | Exactly one thing: translate `IntentModification` → LLM call → `IntentPayload`. |
| Which transport should I use? | WebSocket for real-time apps; SSE if WebSocket is blocked by your infrastructure. |
| Can I use any LLM? | Yes. The backend is provider-agnostic. Swap the LLM call without changing the UI. |
| How do I add a new UI type? | Add a new `(domain, intentType)` entry to the registry and map it to a component. |
| How does the UI know what to render? | The `type` field in `IntentPayload` + the registry. No conditional rendering in your code. |
