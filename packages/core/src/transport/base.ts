// ─────────────────────────────────────────────────────────────────────────────
// BaseAgentBridge — Shared event emitter + reconnect logic for all adapters.
//
// Concrete adapters extend this and call:
//   - this.setState()    — update connectionState and notify listeners
//   - this.emit()        — fire an event to all subscribers
//   - this.scheduleReconnect() — exponential-backoff reconnect
//   - this.cancelReconnect()  — cancel a pending retry
// ─────────────────────────────────────────────────────────────────────────────

import type {
  AgentBridge,
  AgentBridgeEventName,
  AgentBridgeEvents,
  AgentBridgeListener,
  ConnectionState,
  ReconnectOptions,
  TransportOptions,
} from './types';

type ListenerEntry<K extends AgentBridgeEventName> = {
  listener: AgentBridgeListener<K>;
  once: boolean;
};

const DEFAULT_RECONNECT: Required<ReconnectOptions> = {
  maxAttempts: 5,
  baseDelayMs: 1_000,
  maxDelayMs: 30_000,
};

export abstract class BaseAgentBridge implements AgentBridge {
  private _state: ConnectionState = 'idle';
  private _listeners = new Map<
    AgentBridgeEventName,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Set<ListenerEntry<any>>
  >();
  private _reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private _reconnectAttempt = 0;

  protected readonly reconnectOpts: Required<ReconnectOptions>;
  protected readonly log: NonNullable<TransportOptions['onLog']>;

  constructor(opts: TransportOptions = {}) {
    this.reconnectOpts = { ...DEFAULT_RECONNECT, ...opts.reconnect };
    this.log = opts.onLog ?? (() => undefined);
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  get connectionState(): ConnectionState {
    return this._state;
  }

  on<K extends AgentBridgeEventName>(
    event: K,
    listener: AgentBridgeListener<K>,
  ): () => void {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set());
    }
    const entry: ListenerEntry<K> = { listener, once: false };
    this._listeners.get(event)!.add(entry);
    return () => this._listeners.get(event)?.delete(entry);
  }

  once<K extends AgentBridgeEventName>(
    event: K,
    listener: AgentBridgeListener<K>,
  ): () => void {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set());
    }
    const entry: ListenerEntry<K> = { listener, once: true };
    this._listeners.get(event)!.add(entry);
    return () => this._listeners.get(event)?.delete(entry);
  }

  // ── Abstract interface ──────────────────────────────────────────────────────

  abstract connect(): Promise<void>;
  abstract disconnect(): void;
  abstract sendModification(patch: import('../schemas/intent').IntentModification): void;
  abstract sendCapabilityManifest(
    manifest: import('../compiler/version').CapabilityManifest,
  ): void;
  abstract queryWhatIf(
    query: import('./types').WhatIfQuery,
  ): Promise<import('./types').WhatIfResult>;

  // ── Protected helpers for subclasses ───────────────────────────────────────

  protected setState(next: ConnectionState): void {
    if (this._state === next) return;
    this._state = next;
    this.emit('stateChange', next);
    this.log('debug', `[AgentBridge] state → ${next}`);
  }

  protected emit<K extends AgentBridgeEventName>(
    event: K,
    payload: AgentBridgeEvents[K],
  ): void {
    const set = this._listeners.get(event);
    if (!set) return;
    const toRemove: ListenerEntry<K>[] = [];
    for (const entry of set) {
      try {
        entry.listener(payload);
      } catch (err) {
        this.log('error', `[AgentBridge] listener threw`, err);
      }
      if (entry.once) toRemove.push(entry);
    }
    toRemove.forEach((e) => set.delete(e));
  }

  protected scheduleReconnect(doConnect: () => Promise<void>): void {
    if (this._reconnectAttempt >= this.reconnectOpts.maxAttempts) {
      this.log('error', '[AgentBridge] max reconnect attempts reached');
      this.setState('error');
      this.emit('error', new Error('Max reconnect attempts reached'));
      return;
    }

    const delay = Math.min(
      this.reconnectOpts.baseDelayMs * 2 ** this._reconnectAttempt,
      this.reconnectOpts.maxDelayMs,
    );
    this._reconnectAttempt += 1;
    this.log(
      'debug',
      `[AgentBridge] reconnecting in ${delay}ms (attempt ${this._reconnectAttempt})`,
    );
    this.setState('reconnecting');
    this._reconnectTimer = setTimeout(async () => {
      this._reconnectTimer = null;
      try {
        await doConnect();
        this._reconnectAttempt = 0; // reset on success
      } catch {
        this.scheduleReconnect(doConnect);
      }
    }, delay);
  }

  protected cancelReconnect(): void {
    if (this._reconnectTimer !== null) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
    this._reconnectAttempt = 0;
  }
}

// Re-export for adapters
export type { IntentModification } from '../schemas/intent';
