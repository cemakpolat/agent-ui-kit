// ─────────────────────────────────────────────────────────────────────────────
// AgentBridge — Transport contract between HARI frontend and an agent backend.
//
// Responsibilities:
//   - Dispatch IntentModification patches when the user adjusts controls
//   - Advertise CapabilityManifest so the agent knows what the UI can render
//   - Receive new IntentPayload (full or streaming) from the agent
//   - Facilitate what-if / hypothetical queries without touching main intent
//   - Manage connection lifecycle (connect, disconnect, reconnect)
//
// Three adapters are provided out-of-the-box:
//   - MockAgentBridge   — deterministic in-process simulation (demo & tests)
//   - WebSocketAgentBridge — bidirectional real-time (ws:// / wss://)
//   - SSEAgentBridge     — server push over SSE, client sends via fetch
// ─────────────────────────────────────────────────────────────────────────────

import type { IntentPayload, IntentModification } from '../schemas/intent';
import type { CapabilityManifest } from '../compiler/version';

// ── Connection state ─────────────────────────────────────────────────────────

export type ConnectionState =
  | 'idle'         // not yet connected
  | 'connecting'   // handshake in progress
  | 'connected'    // alive and ready
  | 'reconnecting' // lost connection, retrying
  | 'disconnected' // cleanly closed
  | 'error';       // unrecoverable failure

// ── What-if query / response ─────────────────────────────────────────────────

export interface WhatIfQuery {
  /** The free-text or chip-selected question */
  question: string;
  /** Snapshot of the intent at the time of the query */
  intentSnapshot: IntentPayload;
}

export interface WhatIfDelta {
  field: string;
  was: unknown;
  becomes: unknown;
  /** Direction of impact relative to the user's goal */
  impact: 'positive' | 'negative' | 'neutral';
}

export interface WhatIfResult {
  /** Agent's reasoning for the proposed change */
  reasoning: string;
  /** Field-level deltas in the hypothetical world */
  deltas: WhatIfDelta[];
  /** Caveats the agent wants to surface */
  caveats: string[];
  /** Confidence in the hypothetical [0–1] */
  confidence: number;
}

// ── Event map ────────────────────────────────────────────────────────────────

export interface AgentBridgeEvents {
  /** A complete new intent arrived from the agent */
  intent: IntentPayload;
  /** Connection state changed */
  stateChange: ConnectionState;
  /** An unrecoverable error occurred */
  error: Error;
}

export type AgentBridgeEventName = keyof AgentBridgeEvents;
export type AgentBridgeListener<K extends AgentBridgeEventName> =
  (payload: AgentBridgeEvents[K]) => void;

// ── Core interface ────────────────────────────────────────────────────────────

export interface AgentBridge {
  readonly connectionState: ConnectionState;

  /**
   * Open the connection. Resolves when the handshake is complete and the
   * bridge is ready to send/receive.  Safe to call multiple times (no-op if
   * already connected).
   */
  connect(): Promise<void>;

  /** Close the connection cleanly. */
  disconnect(): void;

  /**
   * Send an IntentModification patch.  Call this whenever the user changes
   * an ambiguity control or requests a parameter change.
   */
  sendModification(patch: IntentModification): void;

  /**
   * Advertise what the frontend can render so the agent can tailor payloads.
   * Called automatically on connect; exposed for manual re-advertisement.
   */
  sendCapabilityManifest(manifest: CapabilityManifest): void;

  /**
   * Perform an isolated what-if query.  Never mutates the committed intent.
   * Returns a promise so callers can await a single response.
   */
  queryWhatIf(query: WhatIfQuery): Promise<WhatIfResult>;

  /** Subscribe to bridge events. Returns an unsubscribe function. */
  on<K extends AgentBridgeEventName>(
    event: K,
    listener: AgentBridgeListener<K>,
  ): () => void;

  /** One-time subscription — auto-unsubscribes after first event. */
  once<K extends AgentBridgeEventName>(
    event: K,
    listener: AgentBridgeListener<K>,
  ): () => void;
}

// ── Reconnect options (shared across adapters) ────────────────────────────────

export interface ReconnectOptions {
  /** Maximum number of reconnect attempts before giving up. Default: 5 */
  maxAttempts?: number;
  /** Base delay (ms) between attempts — doubled each retry. Default: 1000 */
  baseDelayMs?: number;
  /** Cap on delay (ms). Default: 30_000 */
  maxDelayMs?: number;
}

export interface TransportOptions {
  reconnect?: ReconnectOptions;
  /** Called when a log-worthy event occurs (debug, warn, error) */
  onLog?: (level: 'debug' | 'warn' | 'error', msg: string, data?: unknown) => void;
}
