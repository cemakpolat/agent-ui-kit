// ─────────────────────────────────────────────────────────────────────────────
// SSEAgentBridge — Server-Sent Events for server→client push; fetch for
//                  client→server messages.
//
// Useful when the backend sits behind an HTTP/1.1 proxy that doesn't support
// WebSocket upgrades (common in serverless or edge deployments).
//
// Message protocol:
//   Server-sent events (EventSource):
//     event: intent         data: <IntentPayload JSON>
//     event: what_if_result data: { id: string, payload: WhatIfResult } JSON
//     event: error          data: { message: string } JSON
//
//   Client→server (POST to sendUrl):
//     POST /hari/send  body: { type, payload, [id] }
//     Expected response: 200 OK  (payload ignored)
// ─────────────────────────────────────────────────────────────────────────────

import { BaseAgentBridge } from './base';
import type { TransportOptions, WhatIfQuery, WhatIfResult } from './types';
import type { IntentModification } from '../schemas/intent';
import type { CapabilityManifest } from '../compiler/version';
import { IntentPayloadSchema } from '../schemas/intent';

export interface SSETransportOptions extends TransportOptions {
  /** URL for the EventSource (SSE) stream, e.g. 'https://your-agent/hari/stream' */
  streamUrl: string;
  /** URL to POST outbound messages to, e.g. 'https://your-agent/hari/send' */
  sendUrl: string;
  /** Extra headers to attach to POST requests (e.g. Authorization) */
  headers?: Record<string, string>;
}

export class SSEAgentBridge extends BaseAgentBridge {
  private readonly _streamUrl: string;
  private readonly _sendUrl: string;
  private readonly _headers: Record<string, string>;
  private _es: EventSource | null = null;
  private _pendingWhatIf = new Map<
    string,
    { resolve: (r: WhatIfResult) => void; reject: (e: Error) => void }
  >();

  constructor(opts: SSETransportOptions) {
    super(opts);
    this._streamUrl = opts.streamUrl;
    this._sendUrl = opts.sendUrl;
    this._headers = opts.headers ?? {};
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  async connect(): Promise<void> {
    if (
      this.connectionState === 'connected' ||
      this.connectionState === 'connecting'
    ) return;

    this.setState('connecting');

    return new Promise<void>((resolve, reject) => {
      const es = new EventSource(this._streamUrl);
      this._es = es;

      es.addEventListener('open', () => {
        this.setState('connected');
        resolve();
      });

      es.addEventListener('intent', (ev: Event) => {
        const data = (ev as MessageEvent).data as string;
        this._handleEvent('intent', data);
      });

      es.addEventListener('what_if_result', (ev: Event) => {
        const data = (ev as MessageEvent).data as string;
        this._handleEvent('what_if_result', data);
      });

      es.addEventListener('error', () => {
        if (es.readyState === EventSource.CLOSED) {
          this._es = null;
          if (this.connectionState === 'connecting') {
            const err = new Error('SSE connection failed');
            reject(err);
            this.emit('error', err);
          } else {
            this.scheduleReconnect(() => this.connect());
          }
        }
        // readyState === CONNECTING means browser is auto-retrying; let it
      });
    });
  }

  disconnect(): void {
    this.cancelReconnect();
    if (this._es) {
      this._es.close();
      this._es = null;
    }
    this.setState('disconnected');
  }

  // ── AgentBridge implementation ──────────────────────────────────────────────

  sendModification(patch: IntentModification): void {
    this._post({ type: 'modification', payload: patch });
  }

  sendCapabilityManifest(manifest: CapabilityManifest): void {
    this._post({ type: 'capability_manifest', payload: manifest });
  }

  async queryWhatIf(query: WhatIfQuery): Promise<WhatIfResult> {
    const id = `wif-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    return new Promise<WhatIfResult>((resolve, reject) => {
      this._pendingWhatIf.set(id, { resolve, reject });
      this._post({ type: 'what_if_query', payload: query, id });
    });
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  private _post(body: unknown): void {
    fetch(this._sendUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...this._headers },
      body: JSON.stringify(body),
    }).catch((err) => {
      this.log('error', '[SSE] POST failed', err);
    });
  }

  private _handleEvent(type: string, raw: string): void {
    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch {
      this.log('error', `[SSE] invalid JSON for event "${type}"`, raw);
      return;
    }

    if (type === 'intent') {
      const result = IntentPayloadSchema.safeParse(data);
      if (result.success) {
        this.emit('intent', result.data);
      } else {
        this.log('error', '[SSE] intent validation failed', result.error.flatten());
      }
      return;
    }

    if (type === 'what_if_result') {
      const { id, payload } = data as { id: string; payload: WhatIfResult };
      const pending = this._pendingWhatIf.get(id);
      if (pending) {
        pending.resolve(payload);
        this._pendingWhatIf.delete(id);
      }
    }
  }
}
