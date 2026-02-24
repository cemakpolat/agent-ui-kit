import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import {
  generateIntentModification,
  generateRandomModification,
  isOllamaHealthy,
  ensureModelAvailable,
} from './agent.js';
import { getScenario, SCENARIOS, listScenarios, ScenarioId } from './scenarios.js';

const PORT = parseInt(process.env.PORT || '3001', 10);

// In-memory state per client connection
interface ClientSession {
  id: string;
  intent: Record<string, unknown> | null;
  scenarioId: ScenarioId | null;
}

const activeSessions = new Map<WebSocket, ClientSession>();

// Create HTTP server for health check endpoint
const app = createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', service: 'ws-server' }));
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

// Create WebSocket server
const wss = new WebSocketServer({ server: app });

interface WebSocketMessage {
  type: string;
  payload?: unknown;
  [key: string]: unknown;
}

/**
 * Message types following agent bridge protocol
 */
wss.on('connection', (ws: WebSocket) => {
  const sessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const session: ClientSession = {
    id: sessionId,
    intent: null,
    scenarioId: null,
  };
  activeSessions.set(ws, session);

  console.log(`[WS] Client connected: ${sessionId}`);

  ws.on('message', async (data: Buffer) => {
    try {
      const message = JSON.parse(data.toString()) as WebSocketMessage;
      await handleMessage(ws, message, session);
    } catch (error) {
      console.error('[WS] Failed to parse message:', error);
      ws.send(
        JSON.stringify({
          type: 'error',
          error: 'Invalid message format',
        })
      );
    }
  });

  ws.on('close', () => {
    activeSessions.delete(ws);
    console.log(`[WS] Client disconnected: ${sessionId}`);
  });

  ws.on('error', (error) => {
    console.error(`[WS] Client error (${sessionId}):`, error);
  });

  // Send welcome message
  ws.send(
    JSON.stringify({
      type: 'ready',
      sessionId,
      timestamp: Date.now(),
    })
  );
});

async function handleMessage(
  ws: WebSocket,
  message: WebSocketMessage,
  session: ClientSession
): Promise<void> {
  const { type } = message;

  switch (type) {
    case 'capability_manifest': {
      console.log('[WS] Received capability_manifest');
      ws.send(
        JSON.stringify({
          type: 'capability_manifest_ack',
          timestamp: Date.now(),
        })
      );
      break;
    }

    case 'load_scenario': {
      const scenarioId = (message.scenarioId as string) || 'travel';
      const scenario = getScenario(scenarioId);
      session.intent = scenario.intent;
      session.scenarioId = scenario.id;

      console.log(`[WS] Loaded scenario: ${scenario.id}`);

      ws.send(
        JSON.stringify({
          type: 'intent',
          intent: scenario.intent,
          timestamp: Date.now(),
        })
      );
      break;
    }

    case 'list_scenarios': {
      const scenarios = listScenarios().map((id) => ({
        id,
        name: SCENARIOS[id].name,
        description: SCENARIOS[id].description,
      }));

      ws.send(
        JSON.stringify({
          type: 'scenarios_list',
          scenarios,
          timestamp: Date.now(),
        })
      );
      break;
    }

    case 'modification': {
      if (!session.intent) {
        ws.send(
          JSON.stringify({
            type: 'error',
            error: 'No intent loaded. Call load_scenario first.',
          })
        );
        break;
      }

      const userQuery = (message.query || message.payload) as string;
      console.log(`[WS] Received modification request: "${userQuery}"`);

      // Try to generate modification with Ollama
      let modifications = await generateIntentModification(userQuery);

      // Fallback: generate random modification if Ollama unavailable or empty
      if (Object.keys(modifications).length === 0) {
        modifications = generateRandomModification();
      }

      // Apply modifications to intent (simple merge)
      const updatedIntent = applyModifications(session.intent, modifications);
      session.intent = updatedIntent;

      console.log(`[WS] Applied modifications`);

      // Broadcast updated intent to client
      ws.send(
        JSON.stringify({
          type: 'intent_update',
          modifications,
          intent: updatedIntent,
          timestamp: Date.now(),
        })
      );

      // Acknowledge receipt
      ws.send(
        JSON.stringify({
          type: 'modification_ack',
          timestamp: Date.now(),
        })
      );
      break;
    }

    case 'what_if_query': {
      if (!session.intent) {
        ws.send(
          JSON.stringify({
            type: 'error',
            error: 'No intent loaded',
          })
        );
        break;
      }

      const query = (message.query as string) || '';
      console.log(`[WS] Received what_if query: "${query}"`);

      // Generate hypothetical modifications (don't apply to state)
      let hypotheticalMods = await generateIntentModification(query);

      if (Object.keys(hypotheticalMods).length === 0) {
        hypotheticalMods = generateRandomModification();
      }

      const hypothetical = applyModifications(session.intent, hypotheticalMods);

      ws.send(
        JSON.stringify({
          type: 'what_if_result',
          query,
          hypothetical,
          modifications: hypotheticalMods,
          timestamp: Date.now(),
        })
      );
      break;
    }

    default:
      console.warn(`[WS] Unknown message type: ${type}`);
      ws.send(
        JSON.stringify({
          type: 'error',
          error: `Unknown message type: ${type}`,
        })
      );
  }
}

/**
 * Simple modification application (shallow merge)
 */
function applyModifications(intent: Record<string, unknown>, modifications: Record<string, unknown>): Record<string, unknown> {
  return {
    ...intent,
    ...modifications,
  };
}

// Start server
app.listen(PORT, () => {
  console.log(`[WS] Server listening on port ${PORT}`);

  // Warm up Ollama in background
  (async () => {
    const healthy = await isOllamaHealthy();
    if (healthy) {
      console.log('[WS] Ollama is available');
      await ensureModelAvailable();
    } else {
      console.warn('[WS] Ollama is not available; will run in fallback mode');
    }
  })();
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[WS] SIGTERM received, closing server');
  wss.close(() => {
    app.close(() => {
      console.log('[WS] Server closed');
      process.exit(0);
    });
  });
});

