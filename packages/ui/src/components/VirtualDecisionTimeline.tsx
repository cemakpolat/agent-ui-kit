// ─────────────────────────────────────────────────────────────────────────────
// VirtualDecisionTimeline — Phase 7.1
//
// Virtualized, paginated decision audit trail for large histories.
//
// Features:
//   - IntersectionObserver-based virtualization: only visible rows are rendered
//   - Optional pagination (controlled or uncontrolled)
//   - Compressed summary mode: group decisions by 'hour' or 'day'
//   - Row-level lazy mounting via a sentinel placeholder
//   - Graceful SSR fallback (renders everything when IntersectionObserver unavailable)
//
// Rule: Large datasets shouldn't punish the user. Time bins collapse the past
//       so humans can focus on the recent and the relevant.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DecisionRecord, DecisionOutcome } from '@hari/core';
import { Pagination } from './primitives/Pagination';
import { useTheme } from '../ThemeContext';

// ── Constants ─────────────────────────────────────────────────────────────────

/** Row height placeholder for unmounted items (px). */
const ROW_PLACEHOLDER_HEIGHT = 80;
/** Root margin for pre-loading rows before they scroll into view. */
const ROW_ROOT_MARGIN = '400px';
/** Rows always eagerly mounted (above-the-fold). */
const EAGER_ROWS = 5;
/** Activate virtualization only beyond this record count. */
const VIRTUALIZE_THRESHOLD = 20;

// ── Types ─────────────────────────────────────────────────────────────────────

export type TimelineGroupBy = 'none' | 'hour' | 'day';

export interface VirtualDecisionTimelineProps {
  /** Full list of decision records (newest-first recommended). */
  records: DecisionRecord[];

  /** Grouping granularity for compressed summaries. Default: 'none'. */
  groupBy?: TimelineGroupBy;

  // ── Pagination ──
  /** Page size. When > 0 pagination controls are rendered. Default: 0 (no pagination). */
  pageSize?: number;
  /** Controlled page (1-based). Omit for uncontrolled. */
  page?: number;
  /** Called when page changes (controlled mode). */
  onPageChange?: (page: number) => void;

  // ── Appearance ──
  /** Compact mode: hide rationale & modifications. */
  compact?: boolean;
}

// ── Outcome styles ────────────────────────────────────────────────────────────

const OUTCOME_META: Record<DecisionOutcome, { icon: string; label: string; color: string; bg: string }> = {
  approved:  { icon: '✓', label: 'Approved',  color: '#166534', bg: '#dcfce7' },
  rejected:  { icon: '✗', label: 'Rejected',  color: '#991b1b', bg: '#fee2e2' },
  deferred:  { icon: '⏳', label: 'Deferred',  color: '#854d0e', bg: '#fef9c3' },
  modified:  { icon: '✎', label: 'Modified',  color: '#1e40af', bg: '#dbeafe' },
  escalated: { icon: '⬆', label: 'Escalated', color: '#6d28d9', bg: '#ede9fe' },
  expired:   { icon: '⏱', label: 'Expired',   color: '#6b7280', bg: '#f3f4f6' },
};

// ── Time-group helpers ────────────────────────────────────────────────────────

interface RecordGroup {
  key: string;
  label: string;
  records: DecisionRecord[];
}

function groupRecords(records: DecisionRecord[], groupBy: TimelineGroupBy): RecordGroup[] {
  if (groupBy === 'none') {
    return [{ key: 'all', label: '', records }];
  }

  const buckets = new Map<string, DecisionRecord[]>();

  for (const rec of records) {
    const d = new Date(rec.timestamp);
    const key =
      groupBy === 'hour'
        ? `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}-${d.getHours()}`
        : `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    const bucket = buckets.get(key) ?? [];
    bucket.push(rec);
    buckets.set(key, bucket);
  }

  return Array.from(buckets.entries()).map(([key, recs]) => {
    const d = new Date(recs[0].timestamp);
    const label =
      groupBy === 'hour'
        ? d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
        : d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    return { key, label, records: recs };
  });
}

// ── Compressed group summary ──────────────────────────────────────────────────

interface GroupSummaryProps {
  group: RecordGroup;
  groupBy: TimelineGroupBy;
}

function GroupSummary({ group, groupBy }: GroupSummaryProps) {
  const { theme } = useTheme();
  const [expanded, setExpanded] = useState(false);

  const outcomeCounts = useMemo(() => {
    const counts: Partial<Record<DecisionOutcome, number>> = {};
    for (const r of group.records) {
      counts[r.outcome] = (counts[r.outcome] ?? 0) + 1;
    }
    return Object.entries(counts) as [DecisionOutcome, number][];
  }, [group.records]);

  return (
    <div style={{
      border: `1px solid ${theme.colors.border}`,
      borderRadius: theme.radius.sm,
      marginBottom: '0.375rem',
      overflow: 'hidden',
    }}>
      {/* Group header */}
      <button
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.375rem 0.625rem',
          background: theme.colors.surfaceAlt,
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: theme.colors.text }}>
          {groupBy === 'hour' ? '⏰' : '📅'} {group.label}
        </span>

        <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          {outcomeCounts.map(([outcome, count]) => {
            const meta = OUTCOME_META[outcome];
            return (
              <span
                key={outcome}
                title={meta.label}
                style={{
                  fontSize: '0.6rem',
                  fontWeight: 700,
                  padding: '0.05rem 0.3rem',
                  borderRadius: '8px',
                  backgroundColor: meta.bg,
                  color: meta.color,
                }}
              >
                {meta.icon} {count}
              </span>
            );
          })}
          <span style={{ fontSize: '0.65rem', color: theme.colors.textMuted, marginLeft: '0.25rem' }}>
            {group.records.length} total {expanded ? '▲' : '▼'}
          </span>
        </span>
      </button>

      {/* Expanded row list */}
      {expanded && (
        <div style={{ padding: '0.375rem 0.625rem' }}>
          {group.records.map((rec, idx) => (
            <VirtualRow
              key={rec.decisionId}
              record={rec}
              isLast={idx === group.records.length - 1}
              eager={idx < EAGER_ROWS}
              compact={true}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Virtualized single row ────────────────────────────────────────────────────

interface VirtualRowProps {
  record: DecisionRecord;
  isLast: boolean;
  eager: boolean;
  compact: boolean;
}

function VirtualRow({ record, isLast, eager, compact }: VirtualRowProps) {
  const { theme } = useTheme();
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(eager);

  useEffect(() => {
    if (eager || mounted) return;
    if (typeof IntersectionObserver === 'undefined') {
      setMounted(true);
      return;
    }
    const el = sentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setMounted(true);
          observer.disconnect();
        }
      },
      { rootMargin: ROW_ROOT_MARGIN, threshold: 0 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [eager, mounted]);

  const meta = OUTCOME_META[record.outcome];

  if (!mounted) {
    return (
      <div
        ref={sentinelRef}
        role="listitem"
        aria-hidden="true"
        style={{
          height: `${ROW_PLACEHOLDER_HEIGHT}px`,
          display: 'flex',
          alignItems: 'center',
          paddingBottom: isLast ? 0 : '0.5rem',
        }}
      >
        {/* Skeleton rail */}
        <div style={{
          width: '1.25rem',
          height: '1.25rem',
          borderRadius: '50%',
          backgroundColor: theme.colors.surfaceAlt,
          flexShrink: 0,
          border: `1.5px solid ${theme.colors.border}`,
        }} />
        <div style={{
          marginLeft: '0.625rem',
          flex: 1,
          height: '0.75rem',
          borderRadius: '4px',
          backgroundColor: theme.colors.surfaceAlt,
        }} />
      </div>
    );
  }

  return (
    <div
      ref={sentinelRef}
      role="listitem"
      aria-label={`Decision: ${record.outcome}`}
      style={{
        display: 'flex',
        gap: '0.625rem',
        paddingBottom: isLast ? 0 : '0.5rem',
        position: 'relative',
      }}
    >
      {/* Timeline rail */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        flexShrink: 0,
        width: '1.25rem',
      }}>
        <div style={{
          width: '1.25rem',
          height: '1.25rem',
          borderRadius: '50%',
          backgroundColor: meta.bg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '0.65rem',
          fontWeight: 700,
          color: meta.color,
          flexShrink: 0,
          border: `1.5px solid ${meta.color}`,
        }}>
          {meta.icon}
        </div>
        {!isLast && (
          <div style={{
            flex: 1,
            width: '1.5px',
            backgroundColor: theme.colors.border,
            marginTop: '0.25rem',
          }} />
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0, paddingBottom: isLast ? 0 : '0.375rem' }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.375rem',
          flexWrap: 'wrap',
        }}>
          <span style={{
            fontSize: '0.7rem',
            fontWeight: 700,
            padding: '0.1rem 0.35rem',
            borderRadius: '3px',
            backgroundColor: meta.bg,
            color: meta.color,
          }}>
            {meta.label}
          </span>
          <span style={{ fontSize: '0.65rem', color: theme.colors.textMuted }}>
            by {record.deciderId}
          </span>
          <span style={{ fontSize: '0.65rem', color: theme.colors.textMuted }}>
            {formatTimestamp(record.timestamp)}
          </span>
          {record.deliberationTimeMs != null && (
            <span style={{ fontSize: '0.65rem', color: theme.colors.textMuted }}>
              ⏱ {formatDeliberation(record.deliberationTimeMs)}
            </span>
          )}
        </div>

        {/* Rationale */}
        {!compact && record.rationale && (
          <div style={{
            marginTop: '0.2rem',
            fontSize: '0.8rem',
            color: theme.colors.textSecondary,
            fontStyle: 'italic',
            lineHeight: 1.4,
          }}>
            "{record.rationale}"
          </div>
        )}

        {/* Compact rationale truncated */}
        {compact && record.rationale && (
          <div style={{
            marginTop: '0.15rem',
            fontSize: '0.75rem',
            color: theme.colors.textSecondary,
            fontStyle: 'italic',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {record.rationale}
          </div>
        )}

        {/* Modifications */}
        {!compact && record.modifications && Object.keys(record.modifications).length > 0 && (
          <div style={{
            marginTop: '0.25rem',
            padding: '0.3rem 0.5rem',
            borderRadius: '4px',
            backgroundColor: theme.colors.surfaceAlt,
            border: `1px solid ${theme.colors.border}`,
          }}>
            <div style={{
              fontSize: '0.6rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              color: theme.colors.textMuted,
              marginBottom: '0.15rem',
            }}>
              Modifications
            </div>
            {Object.entries(record.modifications).map(([key, val]) => (
              <div key={key} style={{ fontSize: '0.75rem', color: theme.colors.text }}>
                <span style={{ fontWeight: 600 }}>{key}:</span>{' '}
                <span style={{ color: theme.colors.textSecondary }}>
                  {typeof val === 'string' ? val : JSON.stringify(val)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function VirtualDecisionTimeline({
  records,
  groupBy = 'none',
  pageSize = 0,
  page: controlledPage,
  onPageChange,
  compact = false,
}: VirtualDecisionTimelineProps) {
  const { theme } = useTheme();

  // ── Pagination state (uncontrolled fallback) ──
  const [internalPage, setInternalPage] = useState(1);
  const activePage = controlledPage ?? internalPage;

  const handlePageChange = useCallback(
    (p: number) => {
      onPageChange?.(p);
      setInternalPage(p);
    },
    [onPageChange],
  );

  // ── Paginate the full record list ──
  const pagedRecords = useMemo(() => {
    if (!pageSize || pageSize <= 0) return records;
    const start = (activePage - 1) * pageSize;
    return records.slice(start, start + pageSize);
  }, [records, pageSize, activePage]);

  const totalPages = pageSize > 0 ? Math.max(1, Math.ceil(records.length / pageSize)) : 1;

  // ── Group the paged records ──
  const groups = useMemo(
    () => groupRecords(pagedRecords, groupBy),
    [pagedRecords, groupBy],
  );

  const shouldVirtualize = pagedRecords.length > VIRTUALIZE_THRESHOLD;

  if (records.length === 0) {
    return (
      <div style={{
        fontSize: '0.8rem',
        color: theme.colors.textMuted,
        fontStyle: 'italic',
        padding: '0.75rem',
      }}>
        No decisions recorded yet.
      </div>
    );
  }

  return (
    <div>
      {/* Compressed group summaries */}
      {groupBy !== 'none' && (
        <div>
          {groups.map((grp) => (
            <GroupSummary key={grp.key} group={grp} groupBy={groupBy} />
          ))}
        </div>
      )}

      {/* Flat virtualized list */}
      {groupBy === 'none' && (
        <div
          role="list"
          aria-label="Decision audit trail"
          style={{ padding: '0.5rem 0' }}
        >
          {pagedRecords.map((record, idx) => (
            <VirtualRow
              key={record.decisionId}
              record={record}
              isLast={idx === pagedRecords.length - 1}
              eager={!shouldVirtualize || idx < EAGER_ROWS}
              compact={compact}
            />
          ))}
        </div>
      )}

      {/* Pagination controls */}
      {pageSize > 0 && totalPages > 1 && (
        <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'center' }}>
          <Pagination
            totalPages={totalPages}
            currentPage={activePage}
            onPageChange={handlePageChange}
            compact={pagedRecords.length < 5}
          />
        </div>
      )}

      {/* Record count footer */}
      {pageSize > 0 && (
        <div style={{
          marginTop: '0.375rem',
          fontSize: '0.65rem',
          color: theme.colors.textMuted,
          textAlign: 'center',
        }}>
          {((activePage - 1) * pageSize) + 1}–{Math.min(activePage * pageSize, records.length)} of {records.length} records
        </div>
      )}
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function formatDeliberation(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const secs = Math.round(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const rem = secs % 60;
  return rem > 0 ? `${mins}m ${rem}s` : `${mins}m`;
}
