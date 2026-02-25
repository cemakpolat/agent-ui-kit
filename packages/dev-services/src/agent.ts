import axios from 'axios';

/**
 * Lightweight agent logic for dev services.
 * In production, this would be a real agent with comprehensive logic.
 *
 * For dev purposes:
 * - Generate intent modifications based on user queries
 * - Call Ollama for LLM suggestions (graceful fallback if unavailable)
 * - Return modifications in JSON patch format
 */

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const MODEL = process.env.OLLAMA_MODEL || 'llama3.2:latest';

interface OllamaRequest {
  model: string;
  prompt: string;
  stream: boolean;
}

interface OllamaResponse {
  response: string;
  done: boolean;
}

/**
 * Call Ollama to generate suggestion for next intent state
 */
export async function generateIntentModification(userQuery: string): Promise<Record<string, unknown>> {
  try {
    const prompt = `User query: "${userQuery}"\n\nSuggest what JSON fields might change. Respond with minimal JSON only, no markdown.`;

    const response = await axios.post<OllamaResponse>(
      `${OLLAMA_URL}/api/generate`,
      {
        model: MODEL,
        prompt,
        stream: false,
      } as OllamaRequest,
      { timeout: 5000 }
    );

    // Parse LLM output as JSON
    try {
      const jsonStr = response.data.response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(jsonStr);
      return typeof parsed === 'object' && parsed ? parsed : {};
    } catch {
      return {};
    }
  } catch (error) {
    console.error('Ollama generation failed:', error);
    return {};
  }
}

/**
 * Generate random synthetic modification for testing (fallback)
 */
export function generateRandomModification(): Record<string, unknown> {
  const rand = Math.random();
  if (rand < 0.3) {
    return { 'metadata.updated': new Date().toISOString() };
  } else if (rand < 0.6) {
    return { 'metadata.version': Math.random().toString(36).slice(2, 8) };
  }
  return {};
}

/**
 * Check if Ollama is reachable
 */
export async function isOllamaHealthy(): Promise<boolean> {
  try {
    await axios.get(`${OLLAMA_URL}/api/tags`, { timeout: 2000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Pull the model (async, can be called on startup)
 */
export async function ensureModelAvailable(): Promise<void> {
  try {
    console.log(`Ensuring ${MODEL} is available...`);
    await axios.post(
      `${OLLAMA_URL}/api/pull`,
      { name: MODEL },
      { timeout: 300000 }
    );
    console.log(`✓ ${MODEL} is ready`);
  } catch (error) {
    console.warn(`Failed to pull ${MODEL}:`, error);
  }
}

