import { createServer } from 'http';
import { WebSocket, WebSocketServer } from 'ws';
import {
  generateIntentModification,
  generateRandomModification,
  isOllamaHealthy,
  ensureModelAvailable,
} from './agent.js';
import { getScenario, SCENARIOS, listScenarios, ScenarioId } from './scenarios.js';

const PORT = parseInt(process.env.PORT || '3003', 10);

/**
 * MCP Server implementing Model Context Protocol
 * https://modelcontextprotocol.io/
 *
 * Exposes HARI intent operations as MCP tools and resources.
 */

interface MCPRequest {
  jsonrpc: string;
  id: number | string;
  method: string;
  params?: Record<string, unknown>;
}

interface MCPResponse {
  jsonrpc: string;
  id: number | string;
  result?: unknown;
  error?: { code: number; message: string };
}

// Session state
interface SessionState {
  intent: Record<string, unknown> | null;
  scenarioId: ScenarioId | null;
  initialized: boolean;
}

const sessions = new Map<WebSocket, SessionState>();

// Create HTTP server for health check
const app = createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', service: 'mcp-server' }));
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

// Create WebSocket server for MCP protocol
const wss = new WebSocketServer({ server: app });

wss.on('connection', (ws: WebSocket) => {
  const session: SessionState = {
    intent: null,
    scenarioId: null,
    initialized: false,
  };
  sessions.set(ws, session);

  console.log('[MCP] Client connected');

  ws.on('message', async (data: Buffer) => {
    try {
      const request = JSON.parse(data.toString()) as MCPRequest;
      const response = await handleMCPRequest(request, session);
      ws.send(JSON.stringify(response));
    } catch (error) {
      console.error('[MCP] Failed to handle request:', error);
      ws.send(
        JSON.stringify({
          jsonrpc: '2.0',
          id: null,
          error: { code: -32700, message: 'Parse error' },
        })
      );
    }
  });

  ws.on('close', () => {
    sessions.delete(ws);
    console.log('[MCP] Client disconnected');
  });

  ws.on('error', (error) => {
    console.error('[MCP] Client error:', error);
  });
});

/**
 * Handle MCP JSON-RPC 2.0 requests
 */
async function handleMCPRequest(req: MCPRequest, session: SessionState): Promise<MCPResponse> {
  const { id, method, params } = req;

  try {
    let result: unknown;

    switch (method) {
      case 'initialize':
        result = {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: {
              listChanged: false,
            },
            resources: {
              listChanged: false,
            },
          },
          serverInfo: {
            name: 'hari-mcp-server',
            version: '0.1.0',
          },
        };
        session.initialized = true;
        console.log('[MCP] Client initialized');
        break;

      case 'tools/list':
        result = {
          tools: [
            {
              name: 'loadScenario',
              description: 'Load a fixture scenario intent',
              inputSchema: {
                type: 'object',
                properties: {
                  scenarioId: {
                    type: 'string',
                    description: 'Scenario ID to load',
                  },
                },
                required: ['scenarioId'],
              },
            },
            {
              name: 'modifyIntent',
              description: 'Apply modifications to the current intent based on user query',
              inputSchema: {
                type: 'object',
                properties: {
                  query: {
                    type: 'string',
                    description: 'User query describing desired intent changes',
                  },
                },
                required: ['query'],
              },
            },
            {
              name: 'whatIfQuery',
              description: 'Generate hypothetical intent state without mutation',
              inputSchema: {
                type: 'object',
                properties: {
                  query: {
                    type: 'string',
                    description: 'Hypothetical scenario to evaluate',
                  },
                },
                required: ['query'],
              },
            },
            {
              name: 'listScenarios',
              description: 'List available fixture scenarios',
              inputSchema: {
                type: 'object',
                properties: {},
              },
            },
          ],
        };
        break;

      case 'tools/call': {
        const toolName = params?.name as string;
        const toolParams = (params?.arguments || {}) as Record<string, unknown>;

        switch (toolName) {
          case 'loadScenario': {
            const scenarioId = (toolParams.scenarioId as string) || 'travel';
            const scenario = getScenario(scenarioId);
            session.intent = scenario.intent;
            session.scenarioId = scenario.id;

            console.log(`[MCP] Loaded scenario: ${scenario.id}`);

            result = {
              type: 'text',
              text: `Loaded scenario: ${scenario.name}. Intent ID: ${scenario.intent.id}`,
            };
            break;
          }

          case 'modifyIntent': {
            if (!session.intent) {
              throw new Error('No intent loaded. Call loadScenario first.');
            }

            const query = (toolParams.query as string) || '';
            console.log(`[MCP] Modify request: "${query}"`);

            let modifications = await generateIntentModification(query);
            if (Object.keys(modifications).length === 0) {
              modifications = generateRandomModification();
            }

            const updated = applyModifications(session.intent, modifications);
            session.intent = updated;

            result = {
              type: 'text',
              text: `Applied modifications. Intent updated.`,
            };
            break;
          }

          case 'whatIfQuery': {
            if (!session.intent) {
              throw new Error('No intent loaded');
            }

            const query = (toolParams.query as string) || '';
            console.log(`[MCP] What-if query: "${query}"`);

            let modifications = await generateIntentModification(query);
            if (Object.keys(modifications).length === 0) {
              modifications = generateRandomModification();
            }

            const hypothetical = applyModifications(session.intent, modifications);

            result = {
              type: 'text',
              text: `Hypothetical state generated. (Not applied to actual state)`,
            };
            break;
          }

          case 'listScenarios': {
            const scenarios = listScenarios().map((id) => ({
              id,
              name: SCENARIOS[id].name,
            }));

            result = {
              type: 'text',
              text: `Available scenarios: ${scenarios.map((s) => s.id).join(', ')}`,
            };
            break;
          }

          default:
            throw new Error(`Unknown tool: ${toolName}`);
        }
        break;
      }

      case 'resources/list':
        result = {
          resources: [
            {
              uri: 'hari://intent/current',
              name: 'Current Intent',
              description: 'The currently loaded intent payload',
              mimeType: 'application/json',
            },
          ],
        };
        break;

      case 'resources/read': {
        const uri = params?.uri as string;

        if (uri === 'hari://intent/current') {
          if (!session.intent) {
            result = {
              contents: [
                {
                  uri,
                  mimeType: 'application/json',
                  text: JSON.stringify(
                    { error: 'No intent loaded. Call loadScenario first.' },
                    null,
                    2
                  ),
                },
              ],
            };
          } else {
            result = {
              contents: [
                {
                  uri,
                  mimeType: 'application/json',
                  text: JSON.stringify(session.intent, null, 2),
                },
              ],
            };
          }
        } else {
          throw new Error(`Unknown resource: ${uri}`);
        }
        break;
      }

      default:
        throw new Error(`Unknown method: ${method}`);
    }

    return {
      jsonrpc: '2.0',
      id,
      result,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      jsonrpc: '2.0',
      id,
      error: { code: -32603, message: `Internal error: ${message}` },
    };
  }
}

/**
 * Apply modifications to intent
 */
function applyModifications(intent: Record<string, unknown>, modifications: Record<string, unknown>): Record<string, unknown> {
  return {
    ...intent,
    ...modifications,
  };
}

// Start server
app.listen(PORT, () => {
  console.log(`[MCP] Server listening on port ${PORT}`);

  // Warm up Ollama
  (async () => {
    const healthy = await isOllamaHealthy();
    if (healthy) {
      console.log('[MCP] Ollama is available');
      await ensureModelAvailable();
    } else {
      console.warn('[MCP] Ollama is not available; will run in fallback mode');
    }
  })();
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[MCP] SIGTERM received, closing server');
  wss.close(() => {
    app.close(() => {
      console.log('[MCP] Server closed');
      process.exit(0);
    });
  });
});
