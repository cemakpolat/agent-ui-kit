// ─────────────────────────────────────────────────────────────────────────────
// WebSocketAgentBridge — Real-time bidirectional adapter over ws:// / wss://.
//
// Message protocol (JSON):
//   Client → Server:
//     { type: 'capability_manifest', payload: CapabilityManifest }
//     { type: 'modification',        payload: IntentModification  }
//     { type: 'what_if_query',       payload: WhatIfQuery, id: string }
//
//   Server → Client:
//     { type: 'intent',              payload: IntentPayload       }
//     { type: 'what_if_result',      payload: WhatIfResult, id: string }
//     { type: 'ack',                 id: string                   }
//     { type: 'error',               message: string              }
//
// The bridge auto-reconnects on unexpected close using exponential backoff.
// ─────────────────────────────────────────────────────────────────────────────

import { BaseAgentBridge } from './base';
import type { TransportOptions, WhatIfQuery, WhatIfResult } from './types';
import type { IntentPayload, IntentModification } from '../schemas/intent';
import type { CapabilityManifest } from '../compiler/version';
import { IntentPayloadSchema } from '../schemas/intent';

export interface WebSocketTransportOptions extends TransportOptions {
  /** The WebSocket URL to connect to, e.g. 'wss://your-agent/hari' */
  url: string;
  /** Protocols to pass to the WebSocket constructor */
  protocols?: string | string[];
  /** How long to wait for a connection before giving up (ms). Default: 10_000 */
  connectTimeoutMs?: number;
}

export class WebSocketAgentBridge extends BaseAgentBridge {
  private readonly _url: string;
  private readonly _protocols: string | string[] | undefined;
  private readonly _connectTimeoutMs: number;
  private _ws: WebSocket | null = null;
  private _pendingWhatIf = new Map<
    string,
    { resolve: (r: WhatIfResult) => void; reject: (e: Error) => void }
  >();
  private _connectResolver: (() => void) | null = null;
  private _connectRejecter: ((e: Error) => void) | null = null;

  constructor(opts: WebSocketTransportOptions) {
    super(opts);
    this._url = opts.url;
    this._protocols = opts.protocols;
    this._connectTimeoutMs = opts.connectTimeoutMs ?? 10_000;
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  async connect(): Promise<void> {
    if (
      this.connectionState === 'connected' ||
      this.connectionState === 'connecting'
    ) return;

    this.setState('connecting');

    return new Promise<void>((resolve, reject) => {
      this._connectResolver = resolve;
      this._connectRejecter = reject;

      const timeout = setTimeout(() => {
        this._ws?.close();
        const err = new Error('WebSocket connect timeout');
        this._connectRejecter?.(err);
        this._connectResolver = null;
        this._connectRejecter = null;
        this.setState('error');
        this.emit('error', err);
      }, this._connectTimeoutMs);

      try {
        const ws = new WebSocket(this._url, this._protocols);
        this._ws = ws;

        ws.addEventListener('open', () => {
          clearTimeout(timeout);
          this.setState('connected');
          this._connectResolver?.();
          this._connectResolver = null;
          this._connectRejecter = null;
        });

        ws.addEventListener('message', (ev: MessageEvent) => {
          this._handleMessage(ev.data as string);
        });

        ws.addEventListener('close', (ev: CloseEvent) => {
          clearTimeout(timeout);
          this._ws = null;
          if (ev.wasClean || this.connectionState === 'disconnected') {
            this.setState('disconnected');
          } else {
            this.log('warn', `[WS] closed unexpectedly (code=${ev.code})`);
            this.scheduleReconnect(() => this.connect());
          }
        });

        ws.addEventListener('error', () => {
          this.log('error', '[WS] socket error');
          const err = new Error('WebSocket error');
          if (this.connectionState === 'connecting') {
            clearTimeout(timeout);
            this._connectRejecter?.(err);
            this._connectResolver = null;
            this._connectRejecter = null;
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
    if (this._ws) {
      this.setState('disconnected');
      this._ws.close(1000, 'client disconnect');
      this._ws = null;
    }
  }

  // ── AgentBridge implementation ──────────────────────────────────────────────

  sendModification(patch: IntentModification): void {
    this._send({ type: 'modification', payload: patch });
  }

  sendCapabilityManifest(manifest: CapabilityManifest): void {
    this._send({ type: 'capability_manifest', payload: manifest });
  }

  async queryWhatIf(query: WhatIfQuery): Promise<WhatIfResult> {
    const id = `wif-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    return new Promise<WhatIfResult>((resolve, reject) => {
      this._pendingWhatIf.set(id, { resolve, reject });
      this._send({ type: 'what_if_query', payload: query, id });
    });
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  private _send(msg: unknown): void {
    if (!this._ws || this._ws.readyState !== WebSocket.OPEN) {
      this.log('warn', '[WS] attempted send while not connected', msg);
      return;
    }
    this._ws.send(JSON.stringify(msg));
  }

  private _handleMessage(raw: string): void {
    let msg: unknown;
    try {
      msg = JSON.parse(raw);
    } catch {
      this.log('error', '[WS] received invalid JSON', raw);
      return;
    }

    if (!msg || typeof msg !== 'object') return;
    const { type, payload, id, message } = msg as Record<string, unknown>;

    switch (type) {
      case 'intent': {
        const result = IntentPayloadSchema.safeParse(payload);
        if (result.success) {
          this.emit('intent', result.data);
        } else {
          this.log('error', '[WS] intent validation failed', result.error.flatten());
        }
        break;
      }
      case 'what_if_result': {
        if (typeof id === 'string' && this._pendingWhatIf.has(id)) {
          this._pendingWhatIf.get(id)!.resolve(payload as WhatIfResult);
          this._pendingWhatIf.delete(id);
        }
        break;
      }
      case 'error': {
        this.log('error', '[WS] server error', message);
        this.emit('error', new Error(String(message)));
        break;
      }
      default:
        this.log('debug', `[WS] unknown message type: ${String(type)}`);
    }
  }
}
