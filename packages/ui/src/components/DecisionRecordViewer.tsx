import React from 'react';
import type { DecisionRecord } from '@hari/core';
import { useTheme } from '../ThemeContext';
import { VirtualDecisionTimeline } from './VirtualDecisionTimeline';
import type { TimelineGroupBy } from './VirtualDecisionTimeline';

// ─────────────────────────────────────────────────────────────────────────────
// DecisionRecordViewer
//
// Renders the governance audit trail — the sequence of human decisions
// on governed actions.  Each record shows:
//   - Outcome badge (approved / rejected / deferred / modified / escalated / expired)
//   - Who decided and at what authority level
//   - Deliberation time (how long the human spent before deciding)
//   - Rationale (if provided)
//   - Modifications (if the action was modified)
//   - Timestamp
//
// Phase 7.1 enhancements:
//   - Virtualized rendering via VirtualDecisionTimeline (only visible rows mount)
//   - Pagination: set pageSize > 0 to show paged controls
//   - Compressed summaries: set groupBy='hour' or 'day' to collapse history
//
// Rule: Every decision leaves a trace. Governance without memory is theater.
// ─────────────────────────────────────────────────────────────────────────────

export interface DecisionRecordViewerProps {
  /** Decision records to display (newest first recommended) */
  records: DecisionRecord[];
  /** Compact mode: hide modifications and truncate rationale */
  compact?: boolean;

  // ── Phase 7.1: Performance ────────────────────────────────────────────────

  /**
   * Page size for pagination controls. 0 (default) disables pagination.
   * Values ≥ 1 show paged navigation and limit rendered rows per page.
   */
  pageSize?: number;

  /**
   * Group decisions into compressed hour / day summaries.
   * 'none' (default) renders every record individually.
   * 'hour' / 'day' collapse records into expandable buckets with outcome counts.
   */
  groupBy?: TimelineGroupBy;
}

export function DecisionRecordViewer({
  records,
  compact = false,
  pageSize = 0,
  groupBy = 'none',
}: DecisionRecordViewerProps) {
  const { theme } = useTheme();

  return (
    <div style={{
      border: `1px solid ${theme.colors.border}`,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.surface,
      overflow: 'hidden',
    }}>
      {/* Title */}
      <div style={{
        padding: '0.5rem 0.75rem',
        backgroundColor: theme.colors.surfaceAlt,
        borderBottom: `1px solid ${theme.colors.border}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <span style={{
          fontSize: '0.75rem',
          fontWeight: 700,
          color: theme.colors.text,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}>
          Decision Audit Trail
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {groupBy !== 'none' && (
            <span style={{
              fontSize: '0.6rem',
              padding: '0.05rem 0.35rem',
              borderRadius: '8px',
              backgroundColor: theme.colors.border,
              color: theme.colors.textMuted,
              textTransform: 'uppercase',
              fontWeight: 600,
            }}>
              by {groupBy}
            </span>
          )}
          <span style={{
            fontSize: '0.65rem',
            color: theme.colors.textMuted,
          }}>
            {records.length} record{records.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Virtualized / paginated / grouped timeline */}
      <div style={{ padding: '0.5rem 0.75rem' }}>
        <VirtualDecisionTimeline
          records={records}
          groupBy={groupBy}
          pageSize={pageSize}
          compact={compact}
        />
      </div>

    </div>
  );
}
