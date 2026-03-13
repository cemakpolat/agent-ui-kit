// ─────────────────────────────────────────────────────────────────────────────
// useDecisionStream — Phase 7.3: Real-Time WebSocket Decision Streaming
//
// Opens a WebSocket connection to a decision-stream endpoint and pushes
// incoming DecisionRecord events into local state.  The server pushes new
// decisions as they are recorded instead of the UI polling.
//
// Wire protocol (JSON over ws:// / wss://):
//
//   Server → Client:
//     { type: 'decision_record', payload: DecisionRecord }
//       — Pushed whenever a new decision is persisted on the server.
//
//     { type: 'decision_patch', payload: { decisionId: string; patch: Partial<DecisionRecord> } }
//       — Partial update to an existing record (e.g. outcome corrected).
//         Only changed fields are transmitted (Phase 7.3 "partial view updates").
//
//     { type: 'snapshot', payload: DecisionRecord[] }
//       — Initial bulk load sent on first connect (replaces polling).
//
//     { type: 'ping' }
//       — Keepalive from server; client responds with { type: 'pong' }.
//
//   Client → Server:
//     { type: 'subscribe', filter?: DecisionStreamFilter }
//       — Sent on connect to register interest and optional server-side filter.
//     { type: 'pong' }
//       — Response to server ping.
//
// Features:
//   - Auto-reconnect with exponential backoff (up to maxReconnectMs)
//   - Rolling buffer: only the last `bufferSize` records are kept in memory
//   - Partial patch updates: only the changed fields are merged into the record
//   - `newSinceLastReset` counter for "X new decisions" badge
//   - `resetNew()` to acknowledge and clear the counter
//   - SSR-safe: no-ops when WebSocket is unavailable
//
// Rule: Push beats poll. The server knows when it happens; tell the UI.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef, useState } from 'react';
import type { DecisionRecord } from '@hari/core';

// ── Types ─────────────────────────────────────────────────────────────────────

export type DecisionStreamStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'error';

export interface DecisionStreamFilter {
  /** Only stream decisions for this deciderId. */
  deciderId?: string;
  /** Only stream decisions with these outcomes. */
  outcomes?: DecisionRecord['outcome'][];
  /** Only stream decisions for this situationId. */
  situationId?: string;
}

export interface UseDecisionStreamOptions {
  /** WebSocket URL, e.g. 'ws://localhost:3005/decisions/stream' */
  url: string;

  /**
   * Server-side filter applied on subscribe.  Limits what the server pushes.
   * Saves bandwidth when you only care about a subset of decisions.
   */
  filter?: DecisionStreamFilter;

  /**
   * Maximum number of DecisionRecords to hold in memory.
   * When the buffer is full the oldest record is dropped.
   * Default: 500.
   */
  bufferSize?: number;

  /**
   * Initial backoff delay in ms for auto-reconnect.  Doubles each attempt
   * up to `maxReconnectMs`.  Default: 1000.
   */
  reconnectDelayMs?: number;

  /** Maximum reconnect backoff (ms).  Default: 30_000. */
  maxReconnectMs?: number;

  /**
   * Maximum number of reconnect attempts before giving up (status → 'error').
   * 0 = unlimited.  Default: 0.
   */
  maxReconnectAttempts?: number;

  /** Called when a new decision arrives. */
  onDecision?: (record: DecisionRecord) => void;

  /** Called when connection status changes. */
  onStatusChange?: (status: DecisionStreamStatus) => void;
}

export interface UseDecisionStreamResult {
  /** Buffered decision records (newest first). */
  records: DecisionRecord[];
  /** Current WebSocket connection status. */
  status: DecisionStreamStatus;
  /** Count of records received since the last `resetNew()` call. */
  newSinceLastReset: number;
  /** Clear the `newSinceLastReset` counter (e.g. when the user opens the panel). */
  resetNew: () => void;
  /**
   * Force a manual reconnect.
   * Useful when the user clicks a "Reconnect" button after an error.
   */
  reconnect: () => void;
  /** Close the stream cleanly (status → 'disconnected'). */
  close: () => void;
}

// ── Internal message shapes ───────────────────────────────────────────────────

interface DecisionRecordMsg {
  type: 'decision_record';
  payload: DecisionRecord;
}

interface DecisionPatchMsg {
  type: 'decision_patch';
  payload: { decisionId: string; patch: Partial<DecisionRecord> };
}

interface SnapshotMsg {
  type: 'snapshot';
  payload: DecisionRecord[];
}

interface PingMsg { type: 'ping' }

type ServerMessage = DecisionRecordMsg | DecisionPatchMsg | SnapshotMsg | PingMsg;

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useDecisionStream({
  url,
  filter,
  bufferSize = 500,
  reconnectDelayMs = 1_000,
  maxReconnectMs = 30_000,
  maxReconnectAttempts = 0,
  onDecision,
  onStatusChange,
}: UseDecisionStreamOptions): UseDecisionStreamResult {
  const [records, setRecords] = useState<DecisionRecord[]>([]);
  const [status, setStatus] = useState<DecisionStreamStatus>('idle');
  const [newSinceLastReset, setNewSinceLastReset] = useState(0);

  // Stable refs so callbacks don't need to be in effect deps
  const filterRef         = useRef(filter);
  const onDecisionRef     = useRef(onDecision);
  const onStatusChangeRef = useRef(onStatusChange);
  const bufferSizeRef     = useRef(bufferSize);

  useEffect(() => { filterRef.current = filter; },            [filter]);
  useEffect(() => { onDecisionRef.current = onDecision; },    [onDecision]);
  useEffect(() => { onStatusChangeRef.current = onStatusChange; }, [onStatusChange]);
  useEffect(() => { bufferSizeRef.current = bufferSize; },    [bufferSize]);

  const wsRef             = useRef<WebSocket | null>(null);
  const reconnectTimer    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptRef        = useRef(0);
  const aliveRef          = useRef(true);
  const manualCloseRef    = useRef(false);

  // ── Status helper ─────────────────────────────────────────────────────────

  const applyStatus = useCallback((s: DecisionStreamStatus) => {
    setStatus(s);
    onStatusChangeRef.current?.(s);
  }, []);

  // ── Record mutation helpers ───────────────────────────────────────────────

  const addRecord = useCallback((record: DecisionRecord) => {
    setRecords((prev) => {
      const next = [record, ...prev];
      return next.length > bufferSizeRef.current
        ? next.slice(0, bufferSizeRef.current)
        : next;
    });
    setNewSinceLastReset((n) => n + 1);
    onDecisionRef.current?.(record);
  }, []);

  const applySnapshot = useCallback((snapshot: DecisionRecord[]) => {
    // Snapshot replaces buffer; newest first.
    const ordered = [...snapshot].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
    setRecords(ordered.slice(0, bufferSizeRef.current));
  }, []);

  const applyPatch = useCallback(
    (decisionId: string, patch: Partial<DecisionRecord>) => {
      setRecords((prev) =>
        prev.map((r) =>
          r.decisionId === decisionId ? { ...r, ...patch } : r,
        ),
      );
    },
    [],
  );

  // ── WebSocket connect ─────────────────────────────────────────────────────

  const connect = useCallback(() => {
    if (typeof WebSocket === 'undefined') return; // SSR guard
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    applyStatus(attemptRef.current === 0 ? 'connecting' : 'reconnecting');

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!aliveRef.current) return;
      attemptRef.current = 0;
      applyStatus('connected');

      // Subscribe and send optional filter
      ws.send(JSON.stringify({
        type: 'subscribe',
        filter: filterRef.current,
      }));
    };

    ws.onmessage = (event: MessageEvent) => {
      if (!aliveRef.current) return;
      try {
        const msg = JSON.parse(event.data as string) as ServerMessage;

        switch (msg.type) {
          case 'decision_record':
            addRecord(msg.payload);
            break;

          case 'decision_patch':
            applyPatch(msg.payload.decisionId, msg.payload.patch);
            break;

          case 'snapshot':
            applySnapshot(msg.payload);
            break;

          case 'ping':
            ws.send(JSON.stringify({ type: 'pong' }));
            break;
        }
      } catch {
        // Ignore malformed messages
      }
    };

    ws.onerror = () => {
      if (!aliveRef.current) return;
      applyStatus('error');
    };

    ws.onclose = () => {
      if (!aliveRef.current) return;
      if (manualCloseRef.current) {
        applyStatus('disconnected');
        return;
      }

      // Auto-reconnect with exponential backoff
      attemptRef.current++;
      if (maxReconnectAttempts > 0 && attemptRef.current >= maxReconnectAttempts) {
        applyStatus('error');
        return;
      }

      const delay = Math.min(
        reconnectDelayMs * Math.pow(2, attemptRef.current - 1),
        maxReconnectMs,
      );

      applyStatus('reconnecting');
      reconnectTimer.current = setTimeout(() => {
        if (aliveRef.current) connect();
      }, delay);
    };
  }, [
    url, addRecord, applyPatch, applySnapshot, applyStatus,
    reconnectDelayMs, maxReconnectMs, maxReconnectAttempts,
  ]);

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  useEffect(() => {
    aliveRef.current = true;
    manualCloseRef.current = false;
    connect();

    return () => {
      aliveRef.current = false;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  // connect is stable (useCallback with stable deps) — this only runs on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  // ── Public API ────────────────────────────────────────────────────────────

  const resetNew = useCallback(() => setNewSinceLastReset(0), []);

  const reconnect = useCallback(() => {
    manualCloseRef.current = false;
    attemptRef.current = 0;
    if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    wsRef.current?.close();
    connect();
  }, [connect]);

  const close = useCallback(() => {
    manualCloseRef.current = true;
    if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    wsRef.current?.close();
  }, []);

  return { records, status, newSinceLastReset, resetNew, reconnect, close };
}
