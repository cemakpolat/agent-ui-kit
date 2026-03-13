import { createServer, IncomingMessage, ServerResponse } from 'http';
import { URL } from 'url';
import { execSync } from 'child_process';
import {
  generateIntentModification,
  generateRandomModification,
  isOllamaHealthy,
  ensureModelAvailable,
} from './agent.js';
import { getScenario, SCENARIOS, listScenarios, ScenarioId } from './scenarios.js';

/** A running process entry from the OS */
interface ProcessInfo {
  user: string;
  pid: string;
  cpu: number;
  mem: number;
  vsz: number;
  rss: number;
  command: string;
}

/**
 * Get the top running processes from the OS using `ps aux`.
 * Works on macOS and Linux.
 */
function getSystemProcesses(topN = 20): ProcessInfo[] {
  try {
    const output = execSync('ps aux', { encoding: 'utf8', timeout: 5000 });
    const lines = output.trim().split('\n');
    // Skip header line
    const processes = lines.slice(1).map((line): ProcessInfo | null => {
      const parts = line.trim().split(/\s+/);
      if (parts.length < 11) return null;
      return {
        user: parts[0],
        pid: parts[1],
        cpu: parseFloat(parts[2]) || 0,
        mem: parseFloat(parts[3]) || 0,
        vsz: parseInt(parts[4], 10) || 0,
        rss: parseInt(parts[5], 10) || 0,
        // Column 10+ is the command name
        command: parts.slice(10).join(' '),
      };
    });
    return (processes.filter(Boolean) as ProcessInfo[])
      .sort((a, b) => b.cpu - a.cpu)
      .slice(0, topN);
  } catch (err) {
    console.error('[SSE] Failed to read system processes:', err);
    return [];
  }
}

const PORT = parseInt(process.env.PORT || '3002', 10);

// In-memory state per client session
interface ClientSession {
  id: string;
  intent: Record<string, unknown> | null;
  scenarioId: ScenarioId | null;
}

const activeSessions = new Map<string, ClientSession>();

/**
 * SSE endpoint that streams intent updates
 */
function handleSSEStream(res: ServerResponse, sessionId: string): void {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });

  let session = activeSessions.get(sessionId);
  if (!session) {
    session = {
      id: sessionId,
      intent: null,
      scenarioId: null,
    };
    activeSessions.set(sessionId, session);
  }

  // Send welcome event
  res.write(`event: ready\n`);
  res.write(`data: ${JSON.stringify({ sessionId, timestamp: Date.now() })}\n\n`);

  // Keep connection alive with periodic heartbeat
  const heartbeat = setInterval(() => {
    res.write(`: heartbeat\n\n`);
  }, 25000); // 25 sec to avoid proxy timeouts

  // Cleanup on close
  res.on('close', () => {
    clearInterval(heartbeat);
    console.log(`[SSE] Client disconnected: ${sessionId}`);
  });

  res.on('error', (error) => {
    console.error(`[SSE] Stream error (${sessionId}):`, error);
    clearInterval(heartbeat);
    res.end();
  });

  // Store response for later writes (if needed for live updates)
  (session as any).sseResponse = res;
}

/**
 * POST handler for client requests (modification, scenarios, etc.)
 */
async function handlePost(
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
  sessionId: string
): Promise<void> {
  let body = '';

  req.on('data', (chunk) => {
    body += chunk.toString();
  });

  req.on('end', async () => {
    try {
      const payload = body ? JSON.parse(body) : {};
      const session = activeSessions.get(sessionId);

      if (!session) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Session not found' }));
        return;
      }

      let responseData: any = null;

      if (pathname === '/modification') {
        if (!session.intent) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'No intent loaded' }));
          return;
        }

        const userQuery = payload.query || '';
        console.log(`[SSE] Received modification: "${userQuery}"`);

        // Generate modifications
        let modifications = await generateIntentModification(userQuery);
        if (Object.keys(modifications).length === 0) {
          modifications = generateRandomModification();
        }

        // Apply modifications
        const updatedIntent = applyModifications(session.intent, modifications);
        session.intent = updatedIntent;

        // Send updated intent via SSE
        const sseRes = (session as any).sseResponse;
        if (sseRes && !sseRes.destroyed) {
          sseRes.write(`event: intent_update\n`);
          sseRes.write(
            `data: ${JSON.stringify({
              modifications,
              intent: updatedIntent,
              timestamp: Date.now(),
            })}\n\n`
          );
        }

        responseData = {
          success: true,
          modifications: modifications.length,
        };
      } else if (pathname === '/load_scenario') {
        const scenarioId = payload.scenarioId || 'travel';
        const scenario = getScenario(scenarioId);
        session.intent = scenario.intent;
        session.scenarioId = scenario.id;

        console.log(`[SSE] Loaded scenario: ${scenario.id}`);

        // Send intent via SSE
        const sseRes = (session as any).sseResponse;
        if (sseRes && !sseRes.destroyed) {
          sseRes.write(`event: intent\n`);
          sseRes.write(
            `data: ${JSON.stringify({
              intent: scenario.intent,
              timestamp: Date.now(),
            })}\n\n`
          );
        }

        responseData = {
          success: true,
          scenario: scenario.id,
        };
      } else if (pathname === '/list_scenarios') {
        const scenarios = listScenarios().map((id) => ({
          id,
          name: SCENARIOS[id].name,
          description: SCENARIOS[id].description,
        }));

        responseData = {
          scenarios,
        };
      } else if (pathname === '/what_if') {
        if (!session.intent) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'No intent loaded' }));
          return;
        }

        const query = payload.query || '';
        console.log(`[SSE] What-if query: "${query}"`);

        let hypotheticalMods = await generateIntentModification(query);
        if (Object.keys(hypotheticalMods).length === 0) {
          hypotheticalMods = generateRandomModification();
        }

        const hypothetical = applyModifications(session.intent, hypotheticalMods);

        responseData = {
          query,
          hypothetical,
          modifications: hypotheticalMods,
        };
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
        return;
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(responseData));
    } catch (error) {
      console.error('[SSE] POST handler error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal server error' }));
    }
  });
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

// Create HTTP server
const server = createServer((req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const url = new URL(req.url || '/', `http://${req.headers.host}`);
  const pathname = url.pathname;
  const sessionId = url.searchParams.get('sessionId') || `session_${Date.now()}`;

  if (pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', service: 'sse-server' }));
  } else if (pathname === '/api/processes' && req.method === 'GET') {
    const topN = parseInt(url.searchParams.get('top') || '20', 10);
    const processes = getSystemProcesses(topN);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ processes, timestamp: Date.now() }));
  } else if (pathname === '/stream' && req.method === 'GET') {
    handleSSEStream(res, sessionId);
  } else if (req.method === 'POST') {
    handlePost(req, res, pathname, sessionId).catch((error) => {
      console.error('[SSE] Unhandled error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal server error' }));
    });
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

server.listen(PORT, () => {
  console.log(`[SSE] Server listening on port ${PORT}`);

  // Warm up Ollama in background
  (async () => {
    const healthy = await isOllamaHealthy();
    if (healthy) {
      console.log('[SSE] Ollama is available');
      await ensureModelAvailable();
    } else {
      console.warn('[SSE] Ollama is not available; will run in fallback mode');
    }
  })();
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[SSE] SIGTERM received, closing server');
  server.close(() => {
    console.log('[SSE] Server closed');
    process.exit(0);
  });
});
