/**
 * @hari/dev-services
 *
 * Development backend services for HARI (WebSocket, SSE, MCP).
 * Start with Docker Compose: `docker-compose up`
 *
 * Services exposed:
 * - WebSocket: ws://localhost:3001
 * - SSE: http://localhost:3002/stream
 * - MCP: ws://localhost:3003
 * - Ollama: http://localhost:11434
 */

export { generateIntentModification, generateRandomModification, isOllamaHealthy, ensureModelAvailable } from './agent.js';
export { SCENARIOS, getScenario, listScenarios, type Scenario, type ScenarioId } from './scenarios.js';

console.log('dev-services library loaded');
