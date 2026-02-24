# HARI Dev Services

Backend services implementing the HARI transport layer for local development and integration testing.

## Services

- **WebSocket Server** (port 3001) — Real-time bidirectional intent updates
- **SSE Server** (port 3002) — Server-Sent Events stream + POST endpoints
- **MCP Server** (port 3003) — Model Context Protocol with LLM agent integration
- **Ollama** (port 11434) — Local LLM for agent decision-making

## Quick Start

### With Docker Compose (Recommended)

```bash
# From workspace root
docker-compose up

# Services will be available:
# - http://localhost:3001 (WebSocket)
# - http://localhost:3002 (SSE) 
# - http://localhost:3003 (MCP)
# - http://localhost:11434 (Ollama)
```

### Without Docker

```bash
# Terminal 1: Install dependencies
pnpm install

# Terminal 2: Start Ollama (requires local Ollama setup)
ollama serve

# Terminal 3: Build and start WebSocket server
cd packages/dev-services
pnpm run dev:ws

# Terminal 4: Start SSE server
pnpm run dev:sse

# Terminal 5: Start MCP server
pnpm run dev:mcp
```

## Usage

### In Demo App

Switch transport in the UI:
1. Open demo app
2. Click transport dropdown in header (next to view toggle)
3. Select `WebSocket`, `Server-Sent Events`, or `MCP`
4. Load any scenario — it will connect to the real service
5. Open browser DevTools to see message traffic

### Environment Variables

Create `.env.local` in `packages/demo/`:

```bash
VITE_TRANSPORT=websocket
VITE_WEBSOCKET_URL=ws://localhost:3001
```

Or for SSE:
```bash
VITE_TRANSPORT=sse
VITE_SSE_URL=http://localhost:3002
```

Or for MCP:
```bash
VITE_TRANSPORT=mcp
VITE_MCP_URL=ws://localhost:3003
```

## Architecture

### Message Flow

```
React App (WebSocketAgentBridge)
  ↓
WebSocket Server (ws-server.ts)
  ↓
Agent Logic (agent.ts)
  ↓
Ollama LLM (generates modifications)
  ↓
Response → UI
```

### Agents

The servers are stateless agents that:
1. Accept intent payloads from the client
2. Call Ollama with NLU prompt asking "what fields should change?"
3. Apply modifications to intent state
4. Broadcast updated intent back to client

### Scenario Fixtures

Pre-built scenarios from the demo app are loaded on startup:
- Travel
- CloudOps
- IoT
- Document
- Form
- Calendar
- Timeline
- Workflow
- Kanban
- Chat
- Tree/Org Chart

Use `GET /list_scenarios` (SSE/WebSocket) to see available scenarios.

## Testing with cURL

### WebSocket
```bash
# Requires wscat: npm install -g wscat
wscat -c ws://localhost:3001

# Send: {"type": "load_scenario", "scenarioId": "travel"}
# Receive: {"type": "intent", "intent": {...}}
```

### SSE
```bash
# Start listening
curl -N http://localhost:3002/stream?sessionId=test-1

# In another terminal, trigger modification
curl -X POST http://localhost:3002/modification \
  -H "Content-Type: application/json" \
  -d '{"query": "show alternative flights"}'

# Stream will receive: event: intent_update\ndata: {...}
```

### MCP
```bash
# Requires MCP client
# Protocol: JSON-RPC 2.0 over WebSocket
# Endpoints: tools/list, tools/call, resources/list, resources/read
```

## Troubleshooting

### Ollama not available
Services gracefully degrade: if Ollama is unreachable, they generate random synthetic modifications instead of LLM-driven ones.

Check Ollama health:
```bash
curl http://localhost:11434/api/tags
```

### Port conflicts
Change ports in docker-compose.yml and update VITE_* environment variables accordingly.

### Build errors
```bash
# Clean and rebuild
rm -rf packages/dev-services/dist node_modules
pnpm install
pnpm --filter @hari/dev-services build
```

## Development

### Adding a new transport

1. Create `packages/dev-services/src/xyz-server.ts`
2. Implement the HARI message protocol (see [base.ts](../../core/src/transport/base.ts))
3. Add Dockerfile: `packages/dev-services/Dockerfile.xyz`
4. Update docker-compose.yml
5. Add bridge class to `@hari/core/src/transport/`
6. Wire it into App.tsx transport selector

### Extending agent logic

Edit `packages/dev-services/src/agent.ts`:
- `generateIntentModification()` — Main LLM integration
- `generateRandomModification()` — Fallback synthetic changes
- `buildPrompt()` — Customize LLM instructions

## Performance Notes

- Ollama model pulls on first run (~1-2 GB download, depends on model)
- WebSocket reconnects automatically on disconnect
- SSE heartbeat every 25s to avoid proxy timeouts
- MCP JSON-RPC has no size limits but large intents may be slow

## See Also

- `/docker-compose.yml` — Service definitions
- `/packages/core/src/transport/` — Transport implementations
- `/packages/demo/src/App.tsx` — Transport selector UI
- `/IMPLEMENTATION_SUMMARY.md` — Overall architecture
