import type {
  CollaborationParticipant,
  DecisionLock,
  EscalationNotification,
  ConflictRecord,
  AuthoritySyncEvent,
  ServerMessage,
  ClientMessage,
  CollaborationClientOptions,
} from '../schemas/collaboration';
import type { AuthorityMode } from '../schemas/authority';

// ─────────────────────────────────────────────────────────────────────────────
// CollaborationClient
//
// Real-time WebSocket client for the GovernanceCollaborationHub (Phase 5.3).
//
// Responsibilities:
//   - Join / leave collaboration sessions tied to a SituationalView
//   - Acquire and release decision locks (prevent race conditions)
//   - Notify other participants when authority mode changes
//   - React to escalation alerts and conflict notifications
//   - Maintain a local snapshot of all participants' authority states
//
// Usage:
//   const client = new CollaborationClient({ serverUrl, viewId, participantId, ... });
//   client.on('authority-sync', (event) => updatePresenceSidebar(event.participants));
//   client.on('lock-acquired', (lock) => enableApproveButton(lock));
//   await client.connect();
//   const lock = await client.acquireLock(actionId);
//   if (lock) { /* approved */ await client.releaseLock(lock.lockId); }
// ─────────────────────────────────────────────────────────────────────────────

// ── Event map ─────────────────────────────────────────────────────────────────

export interface CollaborationClientEvents {
  /** Full session state (emitted on join) */
  'session-state': { participants: CollaborationParticipant[]; activeLocks: DecisionLock[] };
  'participant-joined': CollaborationParticipant;
  'participant-left': { participantId: string; viewId: string; timestamp: string };
  'lock-acquired': DecisionLock;
  'lock-denied': { actionId: string; reason: string; currentHolder?: { holderId: string; holderName?: string; expiresAt: string } };
  'lock-released': { lockId: string; actionId: string; releasedBy: string };
  'lock-expired': { lockId: string; actionId: string };
  'authority-sync': AuthoritySyncEvent;
  'escalation-alert': EscalationNotification;
  'conflict-detected': ConflictRecord;
  'conflict-resolved': ConflictRecord;
  'connected': void;
  'disconnected': { code: number; reason: string };
  'error': Error;
}

type EventListener<K extends keyof CollaborationClientEvents> = (
  payload: CollaborationClientEvents[K],
) => void;

// ── CollaborationClient ───────────────────────────────────────────────────────

export class CollaborationClient {
  private opts: Required<CollaborationClientOptions>;
  private ws: WebSocket | null = null;
  private _connected = false;
  private _destroyed = false;

  /** Local cache of participants in this session */
  private _participants = new Map<string, CollaborationParticipant>();
  /** Active decision locks in this session */
  private _activeLocks = new Map<string, DecisionLock>();
  /** Locks owned by this client */
  private _ownedLocks = new Set<string>();

  private _heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private _reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private _reconnectAttempts = 0;
  private readonly MAX_RECONNECT = 5;

  private _listeners = new Map<
    keyof CollaborationClientEvents,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Set<EventListener<any>>
  >();

  constructor(opts: CollaborationClientOptions) {
    this.opts = {
      lockTtlMs: 60_000,
      heartbeatIntervalMs: 30_000,
      onError: undefined as never,
      participantName: undefined as never,
      ...opts,
    };
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  get connected(): boolean {
    return this._connected;
  }

  get participants(): CollaborationParticipant[] {
    return Array.from(this._participants.values());
  }

  get activeLocks(): DecisionLock[] {
    return Array.from(this._activeLocks.values());
  }

  async connect(): Promise<void> {
    if (this._destroyed) throw new Error('CollaborationClient has been destroyed');
    if (this._connected) return;
    return new Promise<void>((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.opts.serverUrl);

        this.ws.onopen = () => {
          this._reconnectAttempts = 0;
          this._sendRaw({
            type: 'join',
            viewId: this.opts.viewId as `${string}-${string}-${string}-${string}-${string}`,
            participantId: this.opts.participantId,
            participantName: this.opts.participantName,
            authorityMode: this.opts.initialAuthorityMode,
          });
          this._startHeartbeat();
          this._connected = true;
          this.emit('connected', undefined as never);
          resolve();
        };

        this.ws.onmessage = (ev: MessageEvent) => {
          this._handleMessage(ev.data as string);
        };

        this.ws.onerror = () => {
          const err = new Error('CollaborationClient WebSocket error');
          this.emit('error', err);
          if (this.opts.onError) this.opts.onError(err);
          reject(err);
        };

        this.ws.onclose = (ev: CloseEvent) => {
          this._connected = false;
          this._stopHeartbeat();
          this.emit('disconnected', { code: ev.code, reason: ev.reason });
          if (!this._destroyed) this._scheduleReconnect();
        };
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        reject(error);
      }
    });
  }

  /** Gracefully leave the session and close the WebSocket. */
  disconnect(): void {
    this._destroyed = true;
    this._stopHeartbeat();
    clearTimeout(this._reconnectTimer ?? undefined);
    if (this.ws) {
      try {
        this._sendRaw({
          type: 'leave',
          viewId: this.opts.viewId as `${string}-${string}-${string}-${string}-${string}`,
          participantId: this.opts.participantId,
        });
      } catch {
        // ignore send errors during shutdown
      }
      this.ws.close(1000, 'Client disconnected');
      this.ws = null;
    }
  }

  // ── Decision Locks ────────────────────────────────────────────────────────

  /**
   * Attempt to acquire an exclusive decision lock on a governed action.
   *
   * Returns the lock if granted, null if denied (another participant holds it).
   * Resolves after the server responds (lock-acquired or lock-denied).
   */
  acquireLock(actionId: string): Promise<DecisionLock | null> {
    return new Promise((resolve) => {
      const onAcquired = (lock: DecisionLock) => {
        if (lock.actionId === actionId) {
          offAcquired();
          offDenied();
          resolve(lock);
        }
      };
      const onDenied = (msg: CollaborationClientEvents['lock-denied']) => {
        if (msg.actionId === actionId) {
          offAcquired();
          offDenied();
          resolve(null);
        }
      };
      const offAcquired = this.on('lock-acquired', onAcquired);
      const offDenied = this.on('lock-denied', onDenied);

      this._sendRaw({
        type: 'acquire-lock',
        viewId: this.opts.viewId as `${string}-${string}-${string}-${string}-${string}`,
        actionId,
        participantId: this.opts.participantId,
        participantName: this.opts.participantName,
        ttlMs: this.opts.lockTtlMs,
      });

      // Timeout after lock TTL to prevent hanging promises
      setTimeout(() => {
        offAcquired();
        offDenied();
        resolve(null);
      }, this.opts.lockTtlMs);
    });
  }

  /**
   * Release a previously acquired lock.
   */
  releaseLock(lockId: string): void {
    this._ownedLocks.delete(lockId);
    this._sendRaw({
      type: 'release-lock',
      lockId: lockId as `${string}-${string}-${string}-${string}-${string}`,
      participantId: this.opts.participantId,
    });
  }

  /**
   * Check if the current participant holds the lock for a given action.
   */
  holdsLock(actionId: string): boolean {
    const lock = Array.from(this._activeLocks.values()).find(
      (l) => l.actionId === actionId && l.holderId === this.opts.participantId,
    );
    return !!lock && lock.status === 'active';
  }

  /**
   * Check if ANY participant holds the lock for a given action.
   */
  isLocked(actionId: string): boolean {
    return Array.from(this._activeLocks.values()).some(
      (l) => l.actionId === actionId && l.status === 'active',
    );
  }

  // ── Authority Management ──────────────────────────────────────────────────

  /**
   * Notify all participants in the session that this user's authority changed.
   * Call this whenever the local AuthorityContext mode changes.
   */
  notifyAuthorityChange(
    fromMode: AuthorityMode,
    toMode: AuthorityMode,
    opts: { justification?: string; reason?: string } = {},
  ): void {
    this._sendRaw({
      type: 'authority-change',
      viewId: this.opts.viewId as `${string}-${string}-${string}-${string}-${string}`,
      participantId: this.opts.participantId,
      participantName: this.opts.participantName,
      fromMode,
      toMode,
      ...opts,
    });
  }

  // ── Event subscriptions ───────────────────────────────────────────────────

  on<K extends keyof CollaborationClientEvents>(
    event: K,
    listener: EventListener<K>,
  ): () => void {
    if (!this._listeners.has(event)) this._listeners.set(event, new Set());
    this._listeners.get(event)!.add(listener);
    return () => this._listeners.get(event)?.delete(listener);
  }

  private emit<K extends keyof CollaborationClientEvents>(
    event: K,
    payload: CollaborationClientEvents[K],
  ): void {
    const set = this._listeners.get(event);
    if (!set) return;
    for (const fn of set) {
      try {
        fn(payload);
      } catch (err) {
        console.error('[CollaborationClient] listener error:', err);
      }
    }
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private _handleMessage(raw: string): void {
    let msg: ServerMessage;
    try {
      msg = JSON.parse(raw) as ServerMessage;
    } catch {
      console.warn('[CollaborationClient] unparseable message:', raw);
      return;
    }

    switch (msg.type) {
      case 'session-state':
        this._participants.clear();
        this._activeLocks.clear();
        for (const p of msg.participants) this._participants.set(p.participantId, p);
        for (const l of msg.activeLocks) this._activeLocks.set(l.lockId, l);
        this.emit('session-state', {
          participants: msg.participants,
          activeLocks: msg.activeLocks,
        });
        break;

      case 'participant-joined':
        this._participants.set(msg.participant.participantId, msg.participant);
        this.emit('participant-joined', msg.participant);
        break;

      case 'participant-left':
        this._participants.delete(msg.participantId);
        this.emit('participant-left', {
          participantId: msg.participantId,
          viewId: msg.viewId,
          timestamp: msg.timestamp,
        });
        break;

      case 'lock-acquired':
        this._activeLocks.set(msg.lock.lockId, msg.lock);
        if (msg.lock.holderId === this.opts.participantId) {
          this._ownedLocks.add(msg.lock.lockId);
        }
        this.emit('lock-acquired', msg.lock);
        break;

      case 'lock-denied':
        this.emit('lock-denied', msg);
        break;

      case 'lock-released':
        this._activeLocks.delete(msg.lockId);
        this._ownedLocks.delete(msg.lockId);
        this.emit('lock-released', msg);
        break;

      case 'lock-expired':
        this._activeLocks.delete(msg.lockId);
        this._ownedLocks.delete(msg.lockId);
        this.emit('lock-expired', msg);
        break;

      case 'authority-sync': {
        // Update local participant cache
        const event = msg.event;
        for (const p of event.participants) {
          this._participants.set(p.participantId, p);
        }
        this.emit('authority-sync', event);
        break;
      }

      case 'escalation-alert':
        this.emit('escalation-alert', msg.notification);
        break;

      case 'conflict-detected':
        this.emit('conflict-detected', msg.conflict);
        break;

      case 'conflict-resolved':
        this.emit('conflict-resolved', msg.conflict);
        break;

      case 'error':
        this.emit('error', new Error(`[Server] ${msg.code}: ${msg.message}`));
        break;
    }
  }

  private _sendRaw(msg: ClientMessage): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('[CollaborationClient] cannot send — not connected');
      return;
    }
    this.ws.send(JSON.stringify(msg));
  }

  private _startHeartbeat(): void {
    this._heartbeatTimer = setInterval(() => {
      this._sendRaw({ type: 'heartbeat', participantId: this.opts.participantId });
    }, this.opts.heartbeatIntervalMs);
  }

  private _stopHeartbeat(): void {
    if (this._heartbeatTimer) {
      clearInterval(this._heartbeatTimer);
      this._heartbeatTimer = null;
    }
  }

  private _scheduleReconnect(): void {
    if (this._reconnectAttempts >= this.MAX_RECONNECT) {
      const err = new Error('CollaborationClient: max reconnect attempts reached');
      this.emit('error', err);
      if (this.opts.onError) this.opts.onError(err);
      return;
    }
    const delay = Math.min(1_000 * Math.pow(2, this._reconnectAttempts), 30_000);
    this._reconnectAttempts++;
    this._reconnectTimer = setTimeout(() => {
      this._destroyed = false; // allow reconnect
      this.connect().catch((err) => {
        this.emit('error', err instanceof Error ? err : new Error(String(err)));
        this._scheduleReconnect();
      });
    }, delay);
  }
}


