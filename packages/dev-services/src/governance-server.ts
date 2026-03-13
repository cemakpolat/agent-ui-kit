/**
 * Governance Server — Phase 5.2 & 5.3
 *
 * A combined HTTP REST + WebSocket server that powers:
 *
 *   Phase 5.2 — Persistence & Audit
 *     POST /api/decisions          — record a DecisionRecord
 *     GET  /api/decisions          — query with filter params
 *     GET  /api/decisions/:id      — get single decision
 *     POST /api/views              — store a SituationalView
 *     GET  /api/views              — list stored views
 *     GET  /api/views/:id          — get a single view
 *     GET  /api/compliance/report  — generate compliance report
 *     GET  /api/decisions/replay/:situationId — replay decision chain
 *     GET  /health                 — readiness probe
 *
 *   Phase 5.3 — Real-Time Collaboration (WebSocket)
 *     ws://host/collaborate        — collaborative governance hub
 *     Protocol: JSON messages per schemas/collaboration.ts
 *       Client → Server: join | leave | acquire-lock | release-lock |
 *                         authority-change | heartbeat
 *       Server → Client: session-state | participant-joined | participant-left |
 *                         lock-acquired | lock-denied | lock-released | lock-expired |
 *                         authority-sync | escalation-alert | conflict-detected |
 *                         conflict-resolved | error
 *
 * Usage:
 *   pnpm --filter @hari/dev-services dev:governance
 *   node dist/governance-server.js
 */

import { createServer, IncomingMessage, ServerResponse } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { randomUUID } from 'crypto';
import { URL } from 'url';
import {
  auditDB,
  type StoredDecisionRecord,
  type StoredSituationalView,
  type StoredConflictRecord,
} from './audit-db.js';

// ── Config ────────────────────────────────────────────────────────────────────

const PORT = parseInt(process.env.GOVERNANCE_PORT ?? '3005', 10);
const LOCK_DEFAULT_TTL_MS = 60_000;   // 1 minute
const PARTICIPANT_IDLE_MS = 120_000;  // 2 minutes — mark as idle
const PARTICIPANT_DEAD_MS = 300_000;  // 5 minutes — remove from session

// ── Collaboration State ───────────────────────────────────────────────────────

interface Participant {
  participantId: string;
  participantName?: string;
  authorityMode: string;
  viewId: string;
  joinedAt: string;
  lastSeen: string;
  status: 'active' | 'idle' | 'disconnected';
  ws: WebSocket;
}

interface DecisionLock {
  lockId: string;
  actionId: string;
  viewId: string;
  holderId: string;
  holderName?: string;
  acquiredAt: string;
  expiresAt: string;
  status: 'active' | 'released' | 'expired' | 'contested';
}

/** Session = all collaborative state for a single SituationalView */
class CollaborationSession {
  readonly viewId: string;
  readonly participants = new Map<string, Participant>();
  readonly locks = new Map<string, DecisionLock>(); // lockId → lock
  /** actionId → lockId for rapid lookup */
  private readonly actionLocks = new Map<string, string>();
  private lockExpiryTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(viewId: string) {
    this.viewId = viewId;
  }

  addParticipant(p: Participant): void {
    this.participants.set(p.participantId, p);
  }

  removeParticipant(participantId: string): Participant | undefined {
    const p = this.participants.get(participantId);
    this.participants.delete(participantId);
    // Release all locks held by this participant
    for (const [lockId, lock] of this.locks) {
      if (lock.holderId === participantId && lock.status === 'active') {
        this.releaseLock(lockId);
      }
    }
    return p;
  }

  acquireLock(
    actionId: string,
    holderId: string,
    holderName: string | undefined,
    ttlMs: number,
  ): { granted: true; lock: DecisionLock } | { granted: false; currentLock: DecisionLock } {
    // Check if active lock already exists for this action
    const existingLockId = this.actionLocks.get(actionId);
    if (existingLockId) {
      const existing = this.locks.get(existingLockId);
      if (existing && existing.status === 'active') {
        return { granted: false, currentLock: existing };
      }
    }

    const lockId = randomUUID();
    const acquiredAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + ttlMs).toISOString();
    const lock: DecisionLock = {
      lockId,
      actionId,
      viewId: this.viewId,
      holderId,
      holderName,
      acquiredAt,
      expiresAt,
      status: 'active',
    };

    this.locks.set(lockId, lock);
    this.actionLocks.set(actionId, lockId);

    // Auto-expire
    const timer = setTimeout(() => {
      if (this.locks.get(lockId)?.status === 'active') {
        lock.status = 'expired';
        this.actionLocks.delete(actionId);
        this.lockExpiryTimers.delete(lockId);
        this.broadcast({
          type: 'lock-expired',
          lockId,
          actionId,
        });
      }
    }, ttlMs);
    this.lockExpiryTimers.set(lockId, timer);

    return { granted: true, lock };
  }

  releaseLock(lockId: string): DecisionLock | null {
    const lock = this.locks.get(lockId);
    if (!lock || lock.status !== 'active') return null;
    lock.status = 'released';
    this.actionLocks.delete(lock.actionId);
    clearTimeout(this.lockExpiryTimers.get(lockId));
    this.lockExpiryTimers.delete(lockId);
    return lock;
  }

  activeLocks(): DecisionLock[] {
    return Array.from(this.locks.values()).filter((l) => l.status === 'active');
  }

  participantList(): Omit<Participant, 'ws'>[] {
    return Array.from(this.participants.values()).map(({ ws: _ws, ...rest }) => rest);
  }

  broadcast(msg: unknown, excludeId?: string): void {
    const data = JSON.stringify(msg);
    for (const [pid, p] of this.participants) {
      if (pid === excludeId) continue;
      if (p.ws.readyState === WebSocket.OPEN) {
        p.ws.send(data);
      }
    }
  }

  broadcastAll(msg: unknown): void {
    this.broadcast(msg, undefined);
  }

  updateParticipantAuthority(
    participantId: string,
    authorityMode: string,
  ): Participant | undefined {
    const p = this.participants.get(participantId);
    if (p) p.authorityMode = authorityMode;
    return p;
  }

  touch(participantId: string): void {
    const p = this.participants.get(participantId);
    if (p) {
      p.lastSeen = new Date().toISOString();
      p.status = 'active';
    }
  }

  isEmpty(): boolean {
    return this.participants.size === 0;
  }
}

/** Global session registry: viewId → CollaborationSession */
const sessions = new Map<string, CollaborationSession>();

function getOrCreateSession(viewId: string): CollaborationSession {
  if (!sessions.has(viewId)) {
    sessions.set(viewId, new CollaborationSession(viewId));
  }
  return sessions.get(viewId)!;
}

// ── HTTP Helpers ──────────────────────────────────────────────────────────────

function cors(res: ServerResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function json(res: ServerResponse, status: number, body: unknown): void {
  cors(res);
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk: Buffer) => (raw += chunk.toString()));
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

// ── HTTP Request Handler ──────────────────────────────────────────────────────

async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const baseUrl = `http://localhost:${PORT}`;
  const url = new URL(req.url ?? '/', baseUrl);
  const method = req.method?.toUpperCase() ?? 'GET';
  const pathname = url.pathname.replace(/\/$/, '') || '/';

  // CORS preflight
  if (method === 'OPTIONS') {
    cors(res);
    res.writeHead(204);
    res.end();
    return;
  }

  // ── Health ──────────────────────────────────────────────────────────────────

  if (pathname === '/health' && method === 'GET') {
    json(res, 200, { status: 'ok', stats: auditDB.stats(), sessions: sessions.size });
    return;
  }

  // ── Decisions ───────────────────────────────────────────────────────────────

  if (pathname === '/api/decisions' && method === 'POST') {
    try {
      const body = (await readBody(req)) as StoredDecisionRecord;
      if (!body.decisionId || !body.governedActionId || !body.outcome) {
        json(res, 400, { error: 'Missing required fields: decisionId, governedActionId, outcome' });
        return;
      }
      auditDB.insertDecision(body);
      // Phase 7.3: Push to all connected decision streamers immediately.
      pushDecisionToStreamers(body);
      json(res, 201, { ok: true, decisionId: body.decisionId });
    } catch (err) {
      json(res, 400, { error: String(err) });
    }
    return;
  }

  if (pathname === '/api/decisions' && method === 'GET') {
    const filter = {
      deciderId: url.searchParams.get('deciderId') ?? undefined,
      outcome: (url.searchParams.get('outcome') as StoredDecisionRecord['outcome']) ?? undefined,
      authorityMode: (url.searchParams.get('authorityMode') as StoredDecisionRecord['decidedAt']) ?? undefined,
      situationId: url.searchParams.get('situationId') ?? undefined,
      governedActionId: url.searchParams.get('governedActionId') ?? undefined,
      from: url.searchParams.get('from') ?? undefined,
      to: url.searchParams.get('to') ?? undefined,
      limit: url.searchParams.has('limit') ? parseInt(url.searchParams.get('limit')!, 10) : undefined,
      offset: url.searchParams.has('offset') ? parseInt(url.searchParams.get('offset')!, 10) : undefined,
    };
    const decisions = auditDB.queryDecisions(filter);
    json(res, 200, { decisions, total: decisions.length });
    return;
  }

  // GET /api/decisions/replay/:situationId — MUST come before /api/decisions/:id
  const replayMatch = pathname.match(/^\/api\/decisions\/replay\/(.+)$/);
  if (replayMatch && method === 'GET') {
    const situationId = decodeURIComponent(replayMatch[1]);
    const replay = auditDB.buildReplay(situationId);
    json(res, 200, replay);
    return;
  }

  const decisionMatch = pathname.match(/^\/api\/decisions\/(.+)$/);
  if (decisionMatch && method === 'GET') {
    const decisionId = decodeURIComponent(decisionMatch[1]);
    const decision = auditDB.getDecision(decisionId);
    if (!decision) {
      json(res, 404, { error: `Decision not found: ${decisionId}` });
      return;
    }
    json(res, 200, { decision });
    return;
  }

  // ── Views ────────────────────────────────────────────────────────────────────

  if (pathname === '/api/views' && method === 'POST') {
    try {
      const body = (await readBody(req)) as StoredSituationalView;
      if (!body.situationId) {
        json(res, 400, { error: 'Missing situationId' });
        return;
      }
      auditDB.upsertView(body);
      json(res, 201, { ok: true, situationId: body.situationId });
    } catch (err) {
      json(res, 400, { error: String(err) });
    }
    return;
  }

  if (pathname === '/api/views' && method === 'GET') {
    const limit = url.searchParams.has('limit')
      ? parseInt(url.searchParams.get('limit')!, 10)
      : undefined;
    const offset = url.searchParams.has('offset')
      ? parseInt(url.searchParams.get('offset')!, 10)
      : undefined;
    const views = auditDB.listViews({ limit, offset });
    json(res, 200, { views, total: views.length });
    return;
  }

  const viewMatch = pathname.match(/^\/api\/views\/(.+)$/);
  if (viewMatch && method === 'GET') {
    const situationId = decodeURIComponent(viewMatch[1]);
    const view = auditDB.getView(situationId);
    if (!view) {
      json(res, 404, { error: `View not found: ${situationId}` });
      return;
    }
    json(res, 200, { view });
    return;
  }

  // ── Compliance Report ────────────────────────────────────────────────────────

  if (pathname === '/api/compliance/report' && method === 'GET') {
    const from = url.searchParams.get('from') ?? new Date(Date.now() - 30 * 86_400_000).toISOString();
    const to = url.searchParams.get('to') ?? new Date().toISOString();
    const report = auditDB.generateComplianceReport(from, to);
    json(res, 200, report);
    return;
  }

  // ── Collaboration stats (HTTP) ────────────────────────────────────────────────

  if (pathname === '/api/collaboration/sessions' && method === 'GET') {
    const result = Array.from(sessions.entries()).map(([viewId, session]) => ({
      viewId,
      participants: session.participantList(),
      activeLocks: session.activeLocks(),
    }));
    json(res, 200, { sessions: result });
    return;
  }

  // Conflicts
  if (pathname === '/api/conflicts' && method === 'GET') {
    const viewId = url.searchParams.get('viewId') ?? undefined;
    json(res, 200, { conflicts: auditDB.listConflicts(viewId) });
    return;
  }

  // Not found
  json(res, 404, { error: `No route: ${method} ${pathname}` });
}

// ── WebSocket Collaboration Hub ───────────────────────────────────────────────

function handleCollaborationConnection(ws: WebSocket): void {
  let participant: Participant | null = null;

  ws.on('message', (raw) => {
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(raw.toString()) as Record<string, unknown>;
    } catch {
      ws.send(JSON.stringify({ type: 'error', code: 'PARSE_ERROR', message: 'Invalid JSON' }));
      return;
    }

    const type = msg.type as string;

    switch (type) {
      case 'join': {
        const viewId = String(msg.viewId ?? '');
        const participantId = String(msg.participantId ?? '');
        const participantName = msg.participantName ? String(msg.participantName) : undefined;
        const authorityMode = String(msg.authorityMode ?? 'observe');

        if (!viewId || !participantId) {
          ws.send(JSON.stringify({
            type: 'error',
            code: 'INVALID_JOIN',
            message: 'viewId and participantId are required',
          }));
          return;
        }

        const session = getOrCreateSession(viewId);
        participant = {
          participantId,
          participantName,
          authorityMode,
          viewId,
          joinedAt: new Date().toISOString(),
          lastSeen: new Date().toISOString(),
          status: 'active',
          ws,
        };
        session.addParticipant(participant);

        // Send full session state to the joining participant
        ws.send(JSON.stringify({
          type: 'session-state',
          viewId,
          participants: session.participantList(),
          activeLocks: session.activeLocks(),
        }));

        // Broadcast to others that a new participant joined
        session.broadcast(
          {
            type: 'participant-joined',
            participant: { ...participant, ws: undefined },
          },
          participantId,
        );

        console.log(`[Collab] ${participantId} joined view ${viewId} (${session.participants.size} total)`);
        break;
      }

      case 'leave': {
        if (!participant) return;
        const session = sessions.get(participant.viewId);
        if (session) {
          session.removeParticipant(participant.participantId);
          session.broadcastAll({
            type: 'participant-left',
            participantId: participant.participantId,
            viewId: participant.viewId,
            timestamp: new Date().toISOString(),
          });
          if (session.isEmpty()) sessions.delete(participant.viewId);
        }
        participant = null;
        break;
      }

      case 'acquire-lock': {
        if (!participant) {
          ws.send(JSON.stringify({ type: 'error', code: 'NOT_JOINED', message: 'Join a session first' }));
          return;
        }
        const session = sessions.get(participant.viewId);
        if (!session) return;

        const actionId = String(msg.actionId ?? '');
        const ttlMs = typeof msg.ttlMs === 'number' ? msg.ttlMs : LOCK_DEFAULT_TTL_MS;
        const result = session.acquireLock(
          actionId,
          participant.participantId,
          participant.participantName,
          ttlMs,
        );

        if (result.granted) {
          // Broadcast lock-acquired to ALL participants (so they disable their approve button)
          session.broadcastAll({ type: 'lock-acquired', lock: result.lock });
        } else {
          // Only inform the requesting client
          const existing = result.currentLock;
          ws.send(JSON.stringify({
            type: 'lock-denied',
            actionId,
            reason: `Lock held by ${existing.holderName ?? existing.holderId}`,
            currentHolder: {
              holderId: existing.holderId,
              holderName: existing.holderName,
              expiresAt: existing.expiresAt,
            },
          }));
        }
        break;
      }

      case 'release-lock': {
        if (!participant) return;
        const session = sessions.get(participant.viewId);
        if (!session) return;

        const lockId = String(msg.lockId ?? '');
        const released = session.releaseLock(lockId);
        if (released) {
          session.broadcastAll({
            type: 'lock-released',
            lockId,
            actionId: released.actionId,
            releasedBy: participant.participantId,
          });
        }
        break;
      }

      case 'authority-change': {
        if (!participant) return;
        const session = sessions.get(participant.viewId);
        if (!session) return;

        const fromMode = String(msg.fromMode ?? participant.authorityMode);
        const toMode = String(msg.toMode ?? 'observe');
        const justification = msg.justification ? String(msg.justification) : undefined;
        const reason = msg.reason ? String(msg.reason) : undefined;

        // Update server-side authority
        session.updateParticipantAuthority(participant.participantId, toMode);
        participant.authorityMode = toMode;

        // Build authority sync event
        const authSyncEvent = {
          viewId: participant.viewId,
          participants: session.participantList(),
          changedParticipantId: participant.participantId,
          timestamp: new Date().toISOString(),
        };

        session.broadcastAll({ type: 'authority-sync', event: authSyncEvent });

        // If escalating to override, also send an escalation alert
        if (toMode === 'override') {
          const notification = {
            notificationId: randomUUID(),
            viewId: participant.viewId,
            participantId: participant.participantId,
            participantName: participant.participantName,
            fromMode,
            toMode,
            justification,
            reason,
            timestamp: new Date().toISOString(),
            isOverride: true,
          };
          session.broadcastAll({ type: 'escalation-alert', notification });
        }
        break;
      }

      case 'heartbeat': {
        if (participant) {
          const session = sessions.get(participant.viewId);
          session?.touch(participant.participantId);
        }
        // Reply with pong acknowledgement (optional)
        ws.send(JSON.stringify({ type: 'heartbeat-ack', timestamp: new Date().toISOString() }));
        break;
      }

      default:
        ws.send(JSON.stringify({
          type: 'error',
          code: 'UNKNOWN_MESSAGE',
          message: `Unknown message type: ${type}`,
        }));
    }
  });

  ws.on('close', () => {
    if (!participant) return;
    const session = sessions.get(participant.viewId);
    if (session) {
      session.removeParticipant(participant.participantId);
      session.broadcastAll({
        type: 'participant-left',
        participantId: participant.participantId,
        viewId: participant.viewId,
        timestamp: new Date().toISOString(),
      });
      if (session.isEmpty()) sessions.delete(participant.viewId);
    }
    console.log(`[Collab] ${participant.participantId} disconnected`);
  });

  ws.on('error', (err) => {
    console.error('[Collab] WebSocket error:', err.message);
  });
}

// ── Conflict Detection (post-decision) ────────────────────────────────────────

/**
 * After a decision is recorded, check whether another participant in the same
 * view reached a different conclusion about the same action within a conflict
 * detection window (default: 30 seconds).
 *
 * If a conflict is found:
 *   1. Insert ConflictRecord in audit DB
 *   2. Apply 'higher-authority' resolution strategy
 *   3. Broadcast conflict-detected then conflict-resolved to all participants
 */
export function detectAndBroadcastConflict(
  newDecision: StoredDecisionRecord,
  viewId: string,
): void {
  if (!newDecision.situationId) return;

  const CONFLICT_WINDOW_MS = 30_000;
  const newTs = Date.parse(newDecision.timestamp);

  // Find decisions for the same action in the same view within the window
  const relatedDecisions = auditDB
    .queryDecisions({
      governedActionId: newDecision.governedActionId,
      situationId: newDecision.situationId,
    })
    .filter(
      (d) =>
        d.decisionId !== newDecision.decisionId &&
        Math.abs(Date.parse(d.timestamp) - newTs) <= CONFLICT_WINDOW_MS &&
        (d.outcome === 'approved' || d.outcome === 'rejected'),
    );

  if (relatedDecisions.length === 0) return;
  const conflicting = relatedDecisions[0];

  // Conflict found — both decisions are approve/reject for same action
  if (
    newDecision.outcome !== conflicting.outcome &&
    (newDecision.outcome === 'approved' || newDecision.outcome === 'rejected') &&
    (conflicting.outcome === 'approved' || conflicting.outcome === 'rejected')
  ) {
    const AUTHORITY_ORDER = ['observe', 'intervene', 'approve', 'override'] as const;
    const newIdx = AUTHORITY_ORDER.indexOf(newDecision.decidedAt as (typeof AUTHORITY_ORDER)[number]);
    const existingIdx = AUTHORITY_ORDER.indexOf(conflicting.decidedAt as (typeof AUTHORITY_ORDER)[number]);

    const winningDecision: 'first' | 'second' = newIdx >= existingIdx ? 'second' : 'first';

    const conflict: StoredConflictRecord = {
      conflictId: randomUUID(),
      viewId,
      actionId: newDecision.governedActionId,
      timestamp: new Date().toISOString(),
      firstDecision: {
        participantId: conflicting.deciderId,
        outcome: conflicting.outcome as 'approved' | 'rejected',
        authorityMode: conflicting.decidedAt,
        timestamp: conflicting.timestamp,
        rationale: conflicting.rationale,
      },
      secondDecision: {
        participantId: newDecision.deciderId,
        outcome: newDecision.outcome as 'approved' | 'rejected',
        authorityMode: newDecision.decidedAt,
        timestamp: newDecision.timestamp,
        rationale: newDecision.rationale,
      },
      resolution: {
        strategy: 'higher-authority',
        winningDecision,
        resolvedBy: 'system',
        resolvedAt: new Date().toISOString(),
        notes: 'Automatically resolved by higher-authority strategy',
      },
      status: 'resolved',
    };

    auditDB.insertConflict(conflict);

    const session = sessions.get(viewId);
    if (session) {
      session.broadcastAll({ type: 'conflict-detected', conflict });
      session.broadcastAll({ type: 'conflict-resolved', conflict });
    }
  }
}

// ── Server Bootstrap ──────────────────────────────────────────────────────────

// ── Phase 7.3: Decision stream clients ───────────────────────────────────────
// Clients connected to ws://host/decisions/stream receive pushed DecisionRecords
// instead of polling GET /api/decisions.

interface DecisionStreamer {
  ws: WebSocket;
  filter?: {
    deciderId?: string;
    outcomes?: string[];
    situationId?: string;
  };
}

const decisionStreamers = new Set<DecisionStreamer>();

/**
 * Push a single decision to all interested streamers.
 * Applies each streamer's filter server-side to reduce client overhead.
 */
function pushDecisionToStreamers(decision: StoredDecisionRecord): void {
  const msg = JSON.stringify({ type: 'decision_record', payload: decision });
  for (const streamer of decisionStreamers) {
    try {
      if (streamer.ws.readyState !== WebSocket.OPEN) continue;

      // Server-side filter — skip if it doesn't match
      const f = streamer.filter;
      if (f) {
        if (f.deciderId && decision.deciderId !== f.deciderId) continue;
        if (f.situationId && decision.situationId !== f.situationId) continue;
        if (f.outcomes && !f.outcomes.includes(decision.outcome)) continue;
      }

      streamer.ws.send(msg);
    } catch {
      decisionStreamers.delete(streamer);
    }
  }
}

const httpServer = createServer((req, res) => {
  handleRequest(req, res).catch((err) => {
    console.error('[GovernanceServer] Unhandled error:', err);
    try {
      json(res, 500, { error: 'Internal server error' });
    } catch {
      // Response already sent
    }
  });
});

const wss = new WebSocketServer({
  server: httpServer,
  path: '/collaborate',
});

wss.on('connection', (ws) => {
  handleCollaborationConnection(ws);
});

wss.on('error', (err) => {
  console.error('[GovernanceServer] WebSocketServer error:', err.message);
});

// ── Phase 7.3: Decision stream WebSocket (/decisions/stream) ──────────────────
// Clients subscribe and receive pushed DecisionRecord events in real-time.

const decisionStreamWss = new WebSocketServer({
  server: httpServer,
  path: '/decisions/stream',
});

decisionStreamWss.on('connection', (ws) => {
  const streamer: DecisionStreamer = { ws };
  decisionStreamers.add(streamer);

  // Send initial snapshot of recent decisions (newest first, up to 100)
  try {
    const snapshot = auditDB.queryDecisions({ limit: 100 });
    ws.send(JSON.stringify({ type: 'snapshot', payload: snapshot }));
  } catch {
    // ignore snapshot failure
  }

  // Periodic keepalive ping
  const pingTimer = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'ping' }));
    } else {
      clearInterval(pingTimer);
    }
  }, 30_000);

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString()) as { type: string; filter?: DecisionStreamer['filter'] };
      if (msg.type === 'subscribe' && msg.filter) {
        streamer.filter = msg.filter;
      }
    } catch {
      // ignore malformed messages
    }
  });

  ws.on('close', () => {
    clearInterval(pingTimer);
    decisionStreamers.delete(streamer);
  });

  ws.on('error', () => {
    clearInterval(pingTimer);
    decisionStreamers.delete(streamer);
  });
});

decisionStreamWss.on('error', (err) => {
  console.error('[GovernanceServer] DecisionStream WSS error:', err.message);
});

// ── Idle participant GC (runs every minute) ────────────────────────────────────

setInterval(() => {
  const now = Date.now();
  for (const [viewId, session] of sessions) {
    for (const [pid, p] of session.participants) {
      const lastSeenMs = Date.parse(p.lastSeen);
      if (now - lastSeenMs > PARTICIPANT_DEAD_MS) {
        session.removeParticipant(pid);
        console.log(`[Collab] GC removed idle participant ${pid} from view ${viewId}`);
        session.broadcastAll({
          type: 'participant-left',
          participantId: pid,
          viewId,
          timestamp: new Date().toISOString(),
        });
      } else if (now - lastSeenMs > PARTICIPANT_IDLE_MS) {
        p.status = 'idle';
      }
    }
    if (session.isEmpty()) {
      sessions.delete(viewId);
      console.log(`[Collab] Session closed (empty) for view ${viewId}`);
    }
  }
}, 60_000);

// ── Start ─────────────────────────────────────────────────────────────────────

httpServer.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[GovernanceServer] Port ${PORT} is already in use. Use GOVERNANCE_PORT=<port> to change.`);
  } else {
    console.error('[GovernanceServer] HTTP server error:', err.message);
  }
  process.exit(1);
});

httpServer.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════╗
║    HARI Governance Server  (Phase 5.2 + 5.3 + 7.3)  ║
╠══════════════════════════════════════════════════════╣
║  REST API     →  http://localhost:${PORT}               ║
║  Collab WS    →  ws://localhost:${PORT}/collaborate     ║
║  Decision WS  →  ws://localhost:${PORT}/decisions/stream║
╠══════════════════════════════════════════════════════╣
║  Endpoints:                                          ║
║    GET  /health                                      ║
║    POST /api/decisions   (pushes to stream clients)  ║
║    GET  /api/decisions                               ║
║    GET  /api/decisions/:id                           ║
║    GET  /api/decisions/replay/:situationId           ║
║    POST /api/views                                   ║
║    GET  /api/views                                   ║
║    GET  /api/views/:id                               ║
║    GET  /api/compliance/report                       ║
║    GET  /api/collaboration/sessions                  ║
║    GET  /api/conflicts                               ║
╚══════════════════════════════════════════════════════╝
`);
});
