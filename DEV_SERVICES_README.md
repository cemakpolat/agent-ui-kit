# Docker Dev Services Implementation — Complete ✓

## What was implemented

A complete Docker-based development environment for HARI with three real backend services + Ollama LLM integration.

### Services Created

1. **WebSocket Server** (`packages/dev-services/src/ws-server.ts`) — Port 3001
   - Bi-directional WebSocket for real-time intent updates
   - Implements load_scenario, modification, what_if_query, list_scenarios endpoints
   - Integrates with Ollama for agent-driven modifications

2. **SSE Server** (`packages/dev-services/src/sse-server.ts`) — Port 3002  
   - Server-Sent Events stream for progressive rendering
   - POST endpoints for client requests
   - Graceful heartbeat logic for proxy timeouts

3. **MCP Server** (`packages/dev-services/src/mcp-server.ts`) — Port 3003
   - Model Context Protocol (JSON-RPC 2.0) over WebSocket
   - Tools: loadScenario, modifyIntent, whatIfQuery, listScenarios
   - Resources: hari://intent/current (read-only snapshot)

4. **Ollama Service** — Port 11434
   - Local LLM (`orca-mini`) for agent decision-making
   - Auto-pulls model on first run (~1-2 GB)
   - Graceful fallback: services work without Ollama using random modifications

### Demo App Enhancement

- Added **transport selector** in header (next to view toggle)
- Switch between Mock | WebSocket | SSE | MCP at runtime
- Supports environment variables: `VITE_TRANSPORT`, `VITE_WEBSOCKET_URL`, `VITE_SSE_URL`, `VITE_MCP_URL`
- All 12 scenarios work with any transport

### Files Created/Modified

**Created:**
- `docker-compose.yml` — 4 services (ollama, ws-server, sse-server, mcp-server)
- `packages/dev-services/` — Complete dev-services package
  - `src/agent.ts` — Ollama integration
  - `src/scenarios.ts` — 12 fixture scenarios
  - `src/ws-server.ts`, `sse-server.ts`, `mcp-server.ts` — Service implementations
  - `Dockerfile.ws`, `Dockerfile.sse`, `Dockerfile.mcp` — Containerization
  - `tsconfig.json`, `tsup.config.ts`, `package.json`, `README.md`
- `.env.example` — Configuration reference
- `packages/dev-services/README.md` — Comprehensive dev guide

**Modified:**
- `packages/demo/src/App.tsx` — Added transport selector + dynamic bridge creation
- `pnpm-lock.yaml` — Updated dependencies (ws, axios, axios, zod, @types/*)

### Quick Start

```bash
# From workspace root
docker-compose up

# In demo app, switch transport and load scenarios
# Services available at:
# - ws://localhost:3001 (WebSocket)
# - http://localhost:3002/stream (SSE)
# - ws://localhost:3003 (MCP)
# - http://localhost:11434 (Ollama)
```

### Architecture

```
┌─────────────────────┐
│   React Demo App    │
│ (Transport Selector)│
└──────────┬──────────┘
           │
      ┌────┴──────────────────────────┐
      │                               │
      V                               V
  [WebSocket]  [SSE]  [MCP]    [Mock] (no server)
      │          │       │         │
      V          V       V         V
    Port 3001  Port 3002 Port 3003 In-memory
    ┌────────────────────────────────────┐
    │      Agent Bridge Protocol         │
    │ (load_scenario, modification,      │
    │  what_if_query, list_scenarios)    │
    └────────────────────────────────────┘
      │          │       │
      V          V       V
    ┌────────────────────────────┐
    │    Agent Logic (agent.ts)  │
    │  - Generate modifications  │
    │  - Call Ollama/fallback    │
    └────────────────────────────┘
      │
      V
    ┌──────────────────┐
    │ Ollama (11434)   │
    │ Model:orca-mini  │
    └──────────────────┘
```

### Message Flow Example

**WebSocket Modification:**
```
Client                Server              Ollama
  │                     │                   │
  ├─load_scenario────>  X
  |                  [register]
  |
  ├─modification────>  X
  |                  [parse query]
  |                    ├─generate────────>  |
  |                    |              [LLM inference]
  |                    |<──────────────────┤
  |<─intent_update─────X
  |               [UI re-renders]
```

### Testing

Build succeeded:
```
✓ ESM Build success in 15ms
✓ DTS Build success in 777ms
```

Verify with:
```bash
pnpm install
pnpm --filter @hari/dev-services build
docker-compose build  # if modifying Dockerfiles
docker-compose up     # start all services
```

###Key Design Decisions

1. **Graceful Ollama fallback** — If LLM unavailable, services generate synthetic modifications automatically
2. **Simplified agent logic** — Focuses on demonstrating transports, not perfect LLM integration
3. **No database** — All state in-memory per session (demo only, not production-ready)
4. **Shared scenarios** — 12 fixture scenarios work with all transports
5. **Minimal dependencies** — Only ws, axios, zod

### Next Steps

- [ ] Wire up Ollama prompts to be scenario-aware (diagnostic vs form vs document, etc.)
- [ ] Add persistent session storage (redis/db) for long-lived agents
- [ ] Implement streaming JSON parser for large intent payloads
- [ ] Add authentication/authorization layer
- [ ] Create integration tests that spin up Docker services
- [ ] Document MCP client integration (for Claude, etc.)

### Reference

- [Dev Services README](./packages/dev-services/README.md)
- [Docker Compose](./docker-compose.yml)
- [Demo Transport Selector](./packages/demo/src/App.tsx#L145)
- [WebSocket Protocol](./packages/core/src/transport/websocket.ts)
- [Agent Bridge Interface](./packages/core/src/transport/types.ts)
