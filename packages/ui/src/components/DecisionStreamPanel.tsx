// ─────────────────────────────────────────────────────────────────────────────
// DecisionStreamPanel — Phase 7.3: Real-Time Decision Stream
//
// A self-contained panel that:
//   - Connects to a decision-stream WebSocket via useDecisionStream
//   - Renders incoming DecisionRecords with VirtualDecisionTimeline
//   - Shows a live connection indicator (pulsing dot)
//   - Displays "N new decisions" badge with one-click acknowledgement
//   - Supports filtering, grouping and pagination props passthrough
//   - Allows reconnect / disconnect controls
//
// Rule: Real governance is live. Decisions happen now, not on next refresh.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect } from 'react';
import { useTheme } from '../ThemeContext';
import { useDecisionStream } from '../hooks/useDecisionStream';
import type {
  UseDecisionStreamOptions,
  DecisionStreamStatus,
} from '../hooks/useDecisionStream';
import { VirtualDecisionTimeline } from './VirtualDecisionTimeline';
import type { TimelineGroupBy } from './VirtualDecisionTimeline';

// ── Status indicator ──────────────────────────────────────────────────────────

const STATUS_META: Record<DecisionStreamStatus, {
  label: string;
  color: string;
  pulse: boolean;
}> = {
  idle:         { label: 'Idle',         color: '#94a3b8', pulse: false },
  connecting:   { label: 'Connecting…',  color: '#f59e0b', pulse: true  },
  connected:    { label: 'Live',         color: '#22c55e', pulse: true  },
  reconnecting: { label: 'Reconnecting', color: '#f59e0b', pulse: true  },
  disconnected: { label: 'Disconnected', color: '#94a3b8', pulse: false },
  error:        { label: 'Error',        color: '#ef4444', pulse: false },
};

// ── Props ─────────────────────────────────────────────────────────────────────

export interface DecisionStreamPanelProps
  extends Omit<UseDecisionStreamOptions, 'onStatusChange' | 'onDecision'> {

  // ── Layout ──
  /** Panel title. Default: 'Live Decisions'. */
  title?: string;

  // ── Timeline display ──
  /** Compact timeline rows. Default: false. */
  compact?: boolean;
  /** Time grouping for compressed summaries. Default: 'none'. */
  groupBy?: TimelineGroupBy;
  /** Rows per page. 0 = no pagination. Default: 20. */
  pageSize?: number;

  // ── Behaviour ──
  /**
   * Auto-scroll to the top (newest record) when new decisions arrive.
   * Default: true.
   */
  autoScroll?: boolean;

  /**
   * When true the new-record badge auto-resets after this delay (ms).
   * Useful for non-interactive embedded displays.
   * Default: 0 (manual reset only).
   */
  autoResetNewMs?: number;

  /** Max panel height with overflow scroll. Default: '480px'. */
  maxHeight?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function DecisionStreamPanel({
  url,
  filter,
  bufferSize = 500,
  reconnectDelayMs,
  maxReconnectMs,
  maxReconnectAttempts,
  title = 'Live Decisions',
  compact = false,
  groupBy = 'none',
  pageSize = 20,
  autoScroll = true,
  autoResetNewMs = 0,
  maxHeight = '480px',
}: DecisionStreamPanelProps) {
  const { theme } = useTheme();

  const {
    records,
    status,
    newSinceLastReset,
    resetNew,
    reconnect,
    close,
  } = useDecisionStream({
    url,
    filter,
    bufferSize,
    reconnectDelayMs,
    maxReconnectMs,
    maxReconnectAttempts,
  });

  const scrollRef = React.useRef<HTMLDivElement>(null);
  const statusMeta = STATUS_META[status];

  // Auto-scroll to top when new records arrive
  useEffect(() => {
    if (autoScroll && records.length > 0 && scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [autoScroll, records.length]);

  // Auto-reset new badge
  useEffect(() => {
    if (!autoResetNewMs || newSinceLastReset === 0) return;
    const t = setTimeout(resetNew, autoResetNewMs);
    return () => clearTimeout(t);
  }, [autoResetNewMs, newSinceLastReset, resetNew]);

  return (
    <div style={{
      border: `1px solid ${theme.colors.border}`,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.surface,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* ── Header ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0.5rem 0.75rem',
        backgroundColor: theme.colors.surfaceAlt,
        borderBottom: `1px solid ${theme.colors.border}`,
        flexShrink: 0,
      }}>
        {/* Title + live dot */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {/* Pulsing status dot */}
          <span
            title={statusMeta.label}
            style={{
              display: 'inline-block',
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: statusMeta.color,
              flexShrink: 0,
              ...(statusMeta.pulse ? {
                animation: 'decision-stream-pulse 1.4s ease-in-out infinite',
              } : {}),
            }}
          />
          <span style={{
            fontSize: '0.75rem',
            fontWeight: 700,
            color: theme.colors.text,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}>
            {title}
          </span>

          {/* New badge */}
          {newSinceLastReset > 0 && (
            <button
              onClick={resetNew}
              title="Click to acknowledge"
              style={{
                fontSize: '0.65rem',
                fontWeight: 700,
                padding: '0.05rem 0.4rem',
                borderRadius: '8px',
                backgroundColor: '#3b82f6',
                color: '#fff',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              +{newSinceLastReset} new
            </button>
          )}
        </div>

        {/* Right controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <span style={{ fontSize: '0.65rem', color: theme.colors.textMuted }}>
            {statusMeta.label} · {records.length.toLocaleString()} record{records.length !== 1 ? 's' : ''}
          </span>

          {(status === 'disconnected' || status === 'error') && (
            <button
              onClick={reconnect}
              title="Reconnect"
              style={{
                marginLeft: '0.375rem',
                fontSize: '0.65rem',
                padding: '0.15rem 0.45rem',
                borderRadius: '4px',
                border: `1px solid ${theme.colors.border}`,
                backgroundColor: theme.colors.surface,
                color: theme.colors.text,
                cursor: 'pointer',
              }}
            >
              ↺ Reconnect
            </button>
          )}

          {status === 'connected' && (
            <button
              onClick={close}
              title="Disconnect stream"
              style={{
                marginLeft: '0.375rem',
                fontSize: '0.65rem',
                padding: '0.15rem 0.45rem',
                borderRadius: '4px',
                border: `1px solid ${theme.colors.border}`,
                backgroundColor: theme.colors.surface,
                color: theme.colors.textMuted,
                cursor: 'pointer',
              }}
            >
              ■ Stop
            </button>
          )}
        </div>
      </div>

      {/* ── Body ── */}
      <div
        ref={scrollRef}
        style={{
          maxHeight,
          overflowY: 'auto',
          padding: '0.5rem 0.75rem',
          flex: 1,
        }}
      >
        {records.length === 0 && (
          <div style={{
            padding: '2rem',
            textAlign: 'center',
            fontSize: '0.8rem',
            color: theme.colors.textMuted,
            fontStyle: 'italic',
          }}>
            {status === 'connecting' || status === 'reconnecting'
              ? 'Waiting for decisions…'
              : status === 'connected'
                ? 'No decisions yet. They will appear here in real time.'
                : 'Connect to start receiving live decisions.'}
          </div>
        )}

        {records.length > 0 && (
          <VirtualDecisionTimeline
            records={records}
            groupBy={groupBy}
            pageSize={pageSize}
            compact={compact}
          />
        )}
      </div>

      {/* ── Pulse keyframe (injected once) ── */}
      <style>{`
        @keyframes decision-stream-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.5; transform: scale(1.3); }
        }
      `}</style>
    </div>
  );
}
