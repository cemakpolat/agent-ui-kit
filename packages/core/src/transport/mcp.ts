// ─────────────────────────────────────────────────────────────────────────────
// MCPAgentBridge — Transport adapter for the Model Context Protocol (MCP).
//
// MCP (https://modelcontextprotocol.io) defines a JSON-RPC 2.0 protocol that
// lets AI clients call tools and read resources hosted by an MCP server.
//
// This bridge maps the HARI AgentBridge interface onto an MCP server that
// exposes HARI-specific tools and resources:
//
//   Resource  hari://intent/current
//     → GET current IntentPayload; server notifies on updates.
//
//   Tool      hari_modify_intent(modifications: Record<string, unknown>)
//     → Apply a parameter patch; returns updated IntentPayload.
//
//   Tool      hari_query_whatif(question: string, intent_snapshot: object)
//     → Run a hypothetical query; returns WhatIfResult.
//
// Protocol handshake:
//   1. Client → initialize (with clientInfo + capabilities)
//   2. Server → initialize result + notifications/initialized notification
//   3. Client → resources/read hari://intent/current  (initial intent)
//   4. Server → notifications/resources/updated  (subsequent intent changes)
//
// Transport: WebSocket (ws:// or wss://).
// ─────────────────────────────────────────────────────────────────────────────

import { BaseAgentBridge } from './base';
import type { TransportOptions, WhatIfQuery, WhatIfResult } from './types';
import type { IntentPayload, IntentModification } from '../schemas/intent';
import type { CapabilityManifest } from '../compiler/version';
import { IntentPayloadSchema } from '../schemas/intent';

// ── MCP constants ─────────────────────────────────────────────────────────────

const MCP_PROTOCOL_VERSION = '2024-11-05';
const HARI_INTENT_RESOURCE_URI = 'hari://intent/current';

// ── JSON-RPC 2.0 types ────────────────────────────────────────────────────────

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params?: unknown;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: number;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

interface JsonRpcNotification {
  jsonrpc: '2.0';
  method: string;
  params?: unknown;
}

type JsonRpcMessage = JsonRpcRequest | JsonRpcResponse | JsonRpcNotification;

function isResponse(msg: JsonRpcMessage): msg is JsonRpcResponse {
  return 'id' in msg && ('result' in msg || 'error' in msg);
}

function isNotification(msg: JsonRpcMessage): msg is JsonRpcNotification {
  return !('id' in msg) && 'method' in msg;
}

// ── Public options ────────────────────────────────────────────────────────────

export interface MCPTransportOptions extends TransportOptions {
  /** WebSocket URL of the MCP server, e.g. 'wss://agent.example.com/mcp'. */
  url: string;
  /** Human-readable name sent in the MCP initialize handshake. */
  clientName?: string;
  /** Semver version sent in the MCP initialize handshake. */
  clientVersion?: string;
  /**
   * Prefix for HARI tool names on the server.  Defaults to 'hari_'.
   * E.g. if the server registers 'hari_modify_intent', leave this as default.
   */
  toolPrefix?: string;
  /** How long to wait for the initialize handshake (ms). Default: 10_000. */
  connectTimeoutMs?: number;
}

// ── Bridge implementation ─────────────────────────────────────────────────────

export class MCPAgentBridge extends BaseAgentBridge {
  private readonly _url: string;
  private readonly _clientName: string;
  private readonly _clientVersion: string;
  private readonly _toolPrefix: string;
  private readonly _connectTimeoutMs: number;

  private _ws: WebSocket | null = null;
  private _nextId = 1;

  /** Pending JSON-RPC requests keyed by request id. */
  private _pending = new Map<
    number,
    { resolve: (result: unknown) => void; reject: (err: Error) => void }
  >();

  /** What-if promises keyed by the JSON-RPC request id. */
  private _pendingWhatIf = new Map<
    number,
    { resolve: (r: WhatIfResult) => void; reject: (e: Error) => void }
  >();

  private _connectResolve: (() => void) | null = null;
  private _connectReject: ((e: Error) => void) | null = null;
  private _initialized = false;

  constructor(opts: MCPTransportOptions) {
    super(opts);
    this._url = opts.url;
    this._clientName = opts.clientName ?? 'hari-ui';
    this._clientVersion = opts.clientVersion ?? '0.1.0';
    this._toolPrefix = opts.toolPrefix ?? 'hari_';
    this._connectTimeoutMs = opts.connectTimeoutMs ?? 10_000;
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  async connect(): Promise<void> {
    if (
      this.connectionState === 'connected' ||
      this.connectionState === 'connecting'
    ) return;

    this._initialized = false;
    this.setState('connecting');

    return new Promise<void>((resolve, reject) => {
      this._connectResolve = resolve;
      this._connectReject = reject;

      const timeout = setTimeout(() => {
        this._ws?.close();
        const err = new Error('MCP connect timeout');
        this._connectReject?.(err);
        this._clearConnectHandlers();
        this.setState('error');
        this.emit('error', err);
      }, this._connectTimeoutMs);

      try {
        const ws = new WebSocket(this._url);
        this._ws = ws;

        ws.addEventListener('open', () => {
          clearTimeout(timeout);
          // Start MCP initialize handshake — connection resolves after initialized.
          this._sendInitialize();
        });

        ws.addEventListener('message', (ev: MessageEvent) => {
          this._handleMessage(ev.data as string);
        });

        ws.addEventListener('close', (ev: CloseEvent) => {
          clearTimeout(timeout);
          this._ws = null;
          this._initialized = false;
          if (ev.wasClean || this.connectionState === 'disconnected') {
            this.setState('disconnected');
          } else {
            this.log('warn', `[MCP] WebSocket closed unexpectedly (code=${ev.code})`);
            this._rejectAllPending(new Error('MCP connection lost'));
            this.scheduleReconnect(() => this.connect());
          }
        });

        ws.addEventListener('error', () => {
          clearTimeout(timeout);
          const err = new Error('MCP WebSocket error');
          if (this.connectionState === 'connecting') {
            this._connectReject?.(err);
            this._clearConnectHandlers();
          }
          this.emit('error', err);
        });
      } catch (err) {
        clearTimeout(timeout);
        const e = err instanceof Error ? err : new Error(String(err));
        reject(e);
        this.setState('error');
        this.emit('error', e);
      }
    });
  }

  disconnect(): void {
    this.cancelReconnect();
    this._rejectAllPending(new Error('MCP bridge disconnected'));
    if (this._ws) {
      this.setState('disconnected');
      this._ws.close(1000, 'client disconnect');
      this._ws = null;
    }
    this._initialized = false;
  }

  // ── AgentBridge interface ───────────────────────────────────────────────────

  sendModification(patch: IntentModification): void {
    if (!this._initialized) {
      this.log('warn', '[MCP] sendModification called before initialized');
      return;
    }
    const id = this._nextRpcId();
    this._sendRequest({
      jsonrpc: '2.0',
      id,
      method: 'tools/call',
      params: {
        name: `${this._toolPrefix}modify_intent`,
        arguments: {
          modifications: patch.modifications,
          originalIntentId: patch.originalIntentId,
        },
      },
    });
    // Response handling: the server should notify via notifications/resources/updated
    // which triggers a resources/read → intent event.  If it responds directly
    // with the new intent, handle it in _handleToolResult.
    this._pending.set(id, {
      resolve: (result) => this._tryEmitIntentFromTool(result),
      reject: (err) => this.log('error', '[MCP] modify_intent failed', err),
    });
  }

  sendCapabilityManifest(manifest: CapabilityManifest): void {
    if (!this._initialized) return;
    // MCP does not have a built-in capability advertisement mechanism —
    // send it as a tool call so the server can store it.
    const id = this._nextRpcId();
    this._sendRequest({
      jsonrpc: '2.0',
      id,
      method: 'tools/call',
      params: {
        name: `${this._toolPrefix}advertise_capabilities`,
        arguments: { manifest },
      },
    });
    // Fire-and-forget — no pending handler needed.
    this._pending.set(id, {
      resolve: () => undefined,
      reject: (err) => this.log('warn', '[MCP] advertise_capabilities failed', err),
    });
  }

  async queryWhatIf(query: WhatIfQuery): Promise<WhatIfResult> {
    const id = this._nextRpcId();
    return new Promise<WhatIfResult>((resolve, reject) => {
      this._pendingWhatIf.set(id, { resolve, reject });
      this._sendRequest({
        jsonrpc: '2.0',
        id,
        method: 'tools/call',
        params: {
          name: `${this._toolPrefix}query_whatif`,
          arguments: {
            question: query.question,
            intent_snapshot: query.intentSnapshot,
          },
        },
      });
    });
  }

  // ── Private: MCP handshake ──────────────────────────────────────────────────

  private _sendInitialize(): void {
    const id = this._nextRpcId();
    this._sendRequest({
      jsonrpc: '2.0',
      id,
      method: 'initialize',
      params: {
        protocolVersion: MCP_PROTOCOL_VERSION,
        clientInfo: { name: this._clientName, version: this._clientVersion },
        capabilities: {
          roots: { listChanged: false },
        },
      },
    });
    this._pending.set(id, {
      resolve: () => {
        // After initialize response, send initialized notification then fetch intent.
        this._sendNotification('notifications/initialized', {});
        this._fetchCurrentIntent();
      },
      reject: (err) => {
        this._connectReject?.(err);
        this._clearConnectHandlers();
        this.setState('error');
      },
    });
  }

  private _fetchCurrentIntent(): void {
    const id = this._nextRpcId();
    this._sendRequest({
      jsonrpc: '2.0',
      id,
      method: 'resources/read',
      params: { uri: HARI_INTENT_RESOURCE_URI },
    });
    this._pending.set(id, {
      resolve: (result) => {
        this._initialized = true;
        this.setState('connected');
        this._connectResolve?.();
        this._clearConnectHandlers();
        this._tryEmitIntentFromResource(result);
      },
      reject: (err) => {
        // Server might not have a current intent yet — still mark as connected.
        this._initialized = true;
        this.setState('connected');
        this._connectResolve?.();
        this._clearConnectHandlers();
        this.log('warn', '[MCP] No current intent on connect', err);
      },
    });
  }

  // ── Private: message routing ────────────────────────────────────────────────

  private _handleMessage(raw: string): void {
    let msg: JsonRpcMessage;
    try {
      msg = JSON.parse(raw) as JsonRpcMessage;
    } catch {
      this.log('error', '[MCP] received invalid JSON', raw);
      return;
    }

    if (isResponse(msg)) {
      this._handleResponse(msg);
    } else if (isNotification(msg)) {
      this._handleNotification(msg);
    }
  }

  private _handleResponse(msg: JsonRpcResponse): void {
    // Check what-if pending map first.
    if (this._pendingWhatIf.has(msg.id)) {
      const { resolve, reject } = this._pendingWhatIf.get(msg.id)!;
      this._pendingWhatIf.delete(msg.id);
      if (msg.error) {
        reject(new Error(msg.error.message));
      } else {
        resolve(this._extractWhatIfResult(msg.result));
      }
      return;
    }

    // General pending map.
    if (this._pending.has(msg.id)) {
      const { resolve, reject } = this._pending.get(msg.id)!;
      this._pending.delete(msg.id);
      if (msg.error) {
        reject(new Error(msg.error.message));
      } else {
        resolve(msg.result);
      }
    }
  }

  private _handleNotification(msg: JsonRpcNotification): void {
    switch (msg.method) {
      case 'notifications/resources/updated': {
        // Server signals the hari://intent/current resource changed.
        const params = msg.params as Record<string, unknown> | undefined;
        if (params?.uri === HARI_INTENT_RESOURCE_URI) {
          this._fetchCurrentIntent();
        }
        break;
      }
      case 'notifications/initialized':
        // Server acknowledges our initialized notification — nothing to do.
        break;
      default:
        this.log('debug', `[MCP] unhandled notification: ${msg.method}`);
    }
  }

  // ── Private: intent extraction ──────────────────────────────────────────────

  private _tryEmitIntentFromResource(result: unknown): void {
    // resources/read returns: { contents: [{ uri, mimeType, text }] }
    const contents = (result as Record<string, unknown>)?.contents;
    if (!Array.isArray(contents) || contents.length === 0) return;

    const first = contents[0] as Record<string, unknown>;
    let payload: unknown;
    if (typeof first.text === 'string') {
      try { payload = JSON.parse(first.text); } catch { return; }
    } else if (first.blob != null) {
      // Binary content — not expected for intent payloads.
      return;
    }

    this._emitValidIntent(payload);
  }

  private _tryEmitIntentFromTool(result: unknown): void {
    // tools/call returns: { content: [{ type: 'text', text: '...' }] }
    const content = (result as Record<string, unknown>)?.content;
    if (!Array.isArray(content) || content.length === 0) return;

    const first = content[0] as Record<string, unknown>;
    if (first.type === 'text' && typeof first.text === 'string') {
      try {
        this._emitValidIntent(JSON.parse(first.text));
      } catch { /* ignore malformed JSON */ }
    }
  }

  private _emitValidIntent(payload: unknown): void {
    const result = IntentPayloadSchema.safeParse(payload);
    if (result.success) {
      this.emit('intent', result.data);
    } else {
      this.log('error', '[MCP] intent validation failed', result.error.flatten());
    }
  }

  private _extractWhatIfResult(result: unknown): WhatIfResult {
    // Tool result wraps JSON in content[0].text — parse and return.
    const content = (result as Record<string, unknown>)?.content;
    if (Array.isArray(content) && content.length > 0) {
      const first = content[0] as Record<string, unknown>;
      if (first.type === 'text' && typeof first.text === 'string') {
        try { return JSON.parse(first.text) as WhatIfResult; } catch { /* fall through */ }
      }
    }
    // If the server returned the object directly (non-standard but acceptable).
    return result as WhatIfResult;
  }

  // ── Private: send helpers ───────────────────────────────────────────────────

  private _sendRequest(req: JsonRpcRequest): void {
    if (!this._ws || this._ws.readyState !== WebSocket.OPEN) {
      this.log('warn', '[MCP] attempted send while not connected', req);
      return;
    }
    this._ws.send(JSON.stringify(req));
  }

  private _sendNotification(method: string, params: unknown): void {
    if (!this._ws || this._ws.readyState !== WebSocket.OPEN) return;
    const msg: JsonRpcNotification = { jsonrpc: '2.0', method, params };
    this._ws.send(JSON.stringify(msg));
  }

  private _nextRpcId(): number {
    return this._nextId++;
  }

  private _clearConnectHandlers(): void {
    this._connectResolve = null;
    this._connectReject = null;
  }

  private _rejectAllPending(err: Error): void {
    for (const { reject } of this._pending.values()) reject(err);
    this._pending.clear();
    for (const { reject } of this._pendingWhatIf.values()) reject(err);
    this._pendingWhatIf.clear();
  }
}
