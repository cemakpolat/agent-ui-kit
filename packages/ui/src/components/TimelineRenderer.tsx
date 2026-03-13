import React, { useMemo } from 'react';
import { TimelineDataSchema, type TimelineEvent, type TimelineEventStatus } from '@hari/core';
import { resolveIcon } from '../utils/icon-resolver';
import { useTheme } from '../ThemeContext';
import { useMessages } from '../i18n';

// ─────────────────────────────────────────────────────────────────────────────
// TimelineRenderer
//
// Renders a chronological sequence of events as a vertical or horizontal
// timeline. Supports status badges, category color-coding, grouping,
// duration spans, and density-aware presentation.
// ─────────────────────────────────────────────────────────────────────────────

export interface TimelineRendererProps {
  data: unknown;
  density?: 'executive' | 'operator' | 'expert';
  onExplain?: (elementId: string) => void;
}

// ── Status styling ────────────────────────────────────────────────────────────

function useStatusConfig() {
  const { theme } = useTheme();
  return useMemo(() => ({
    completed:   { label: 'Done',        bg: theme.colors.successSubtle, text: theme.colors.successText, border: theme.colors.success, dot: theme.colors.success },
    in_progress: { label: 'In Progress', bg: theme.colors.infoSubtle,    text: theme.colors.infoText,    border: theme.colors.info,    dot: theme.colors.info },
    pending:     { label: 'Pending',     bg: theme.colors.surfaceAlt,    text: theme.colors.textSecondary, border: theme.colors.border, dot: theme.colors.textMuted },
    cancelled:   { label: 'Cancelled',   bg: theme.colors.surfaceAlt,    text: theme.colors.textMuted,   border: theme.colors.border, dot: theme.colors.textMuted },
    failed:      { label: 'Failed',      bg: theme.colors.dangerSubtle,  text: theme.colors.dangerText,  border: theme.colors.danger, dot: theme.colors.danger },
  } as Record<TimelineEventStatus, { label: string; bg: string; text: string; border: string; dot: string }>), [theme]);
}

// Deterministic palette for categories
const CATEGORY_COLORS = [
  '#6366f1', '#0ea5e9', '#10b981', '#f59e0b',
  '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6',
];

function categoryColor(category: string, palette: Map<string, string>): string {
  if (!palette.has(category)) {
    palette.set(category, CATEGORY_COLORS[palette.size % CATEGORY_COLORS.length]);
  }
  return palette.get(category)!;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTs(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { dateStyle: 'medium' });
}

function groupKey(event: TimelineEvent, groupBy: string): string {
  if (groupBy === 'category') return event.category ?? 'Uncategorised';
  const d = new Date(event.timestamp);
  if (isNaN(d.getTime())) return 'Unknown';
  if (groupBy === 'day')   return d.toLocaleDateString(undefined, { dateStyle: 'long' });
  if (groupBy === 'week')  {
    const mon = new Date(d);
    mon.setDate(d.getDate() - d.getDay() + 1);
    return `Week of ${mon.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
  }
  if (groupBy === 'month') return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  if (groupBy === 'year')  return String(d.getFullYear());
  return '';
}

function duration(start: string, end: string): string {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (isNaN(ms)) return '';
  const s = Math.round(ms / 1000);
  if (s < 60)    return `${s}s`;
  const m = Math.round(s / 60);
  if (m < 60)    return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24)    return `${h}h`;
  return `${Math.round(h / 24)}d`;
}

// ── EventCard ─────────────────────────────────────────────────────────────────

interface EventCardProps {
  event: TimelineEvent;
  density: 'executive' | 'operator' | 'expert';
  showTimestamps: boolean;
  dotColor: string;
  isLast: boolean;
  onExplain?: (id: string) => void;
}

function EventCard({ event, density, showTimestamps, dotColor, isLast, onExplain }: EventCardProps) {
  const { theme } = useTheme();
  const statusConfig = useStatusConfig();
  const statusCfg = event.status ? statusConfig[event.status] : null;
  const dur = event.endTimestamp ? duration(event.timestamp, event.endTimestamp) : null;
  const ResolvedIcon = event.icon ? resolveIcon(event.icon, theme.id) : null;

  return (
    <div role="listitem" style={{ display: 'flex', gap: '0.75rem', position: 'relative' }}>
      {/* Spine + dot */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
        <div style={{
          width: density === 'executive' ? '0.6rem' : '0.75rem',
          height: density === 'executive' ? '0.6rem' : '0.75rem',
          borderRadius: '50%',
          backgroundColor: dotColor,
          border: `2px solid ${theme.colors.surface}`,
          boxShadow: `0 0 0 2px ${dotColor}`,
          zIndex: 1,
          flexShrink: 0,
          marginTop: '0.2rem',
        }} />
        {!isLast && (
          <div style={{
            width: '2px',
            flex: 1,
            backgroundColor: theme.colors.border,
            marginTop: '0.25rem',
            minHeight: '1.5rem',
          }} />
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, paddingBottom: isLast ? 0 : '1.25rem', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', flexWrap: 'wrap' }}>
          {/* Icon */}
          {event.icon && (
            <span style={{ fontSize: '0.85rem', flexShrink: 0, display: 'inline-flex', alignItems: 'center', color: theme.colors.accent }}>
              {ResolvedIcon ? <ResolvedIcon size={14} /> : event.icon}
            </span>
          )}

          {/* Title */}
          <span style={{
            fontWeight: density === 'executive' ? 500 : 600,
            fontSize: density === 'executive' ? '0.78rem' : '0.82rem',
            color: theme.colors.text,
            flex: 1,
          }}>
            {event.title}
          </span>

          {/* Status badge */}
          {statusCfg && density !== 'executive' && (
            <span style={{
              fontSize: '0.6rem', fontWeight: 600,
              padding: '0.1rem 0.4rem', borderRadius: '9999px',
              backgroundColor: statusCfg.bg, color: statusCfg.text,
              border: `1px solid ${statusCfg.border}`,
              whiteSpace: 'nowrap', flexShrink: 0,
            }}>
              {statusCfg.label}
            </span>
          )}

          {/* Explain button */}
          {event.explainElementId && onExplain && (
            <button
              onClick={() => onExplain(event.explainElementId!)}
              aria-label={`Explain: ${event.title}`}
              style={{
                background: 'none', border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.sm,
                padding: '0.05rem 0.3rem', fontSize: '0.6rem', color: theme.colors.textSecondary,
                cursor: 'pointer', flexShrink: 0,
              }}
            >
              Why?
            </button>
          )}
        </div>

        {/* Timestamp + duration */}
        {showTimestamps && density !== 'executive' && (
          <div style={{ fontSize: '0.65rem', color: theme.colors.textMuted, marginTop: '0.15rem', display: 'flex', gap: '0.5rem' }}>
            <span>{formatTs(event.timestamp)}</span>
            {dur && <span style={{ color: theme.colors.textSecondary }}>· {dur}</span>}
          </div>
        )}

        {/* Description */}
        {event.description && density !== 'executive' && (
          <p style={{
            margin: '0.25rem 0 0',
            fontSize: '0.78rem',
            color: theme.colors.textSecondary,
            lineHeight: 1.55,
          }}>
            {event.description}
          </p>
        )}

        {/* Expert: metadata */}
        {density === 'expert' && event.metadata && Object.keys(event.metadata).length > 0 && (
          <dl style={{
            display: 'grid',
            gridTemplateColumns: 'auto 1fr',
            gap: '0.1rem 0.75rem',
            margin: '0.4rem 0 0',
            fontSize: '0.68rem',
          }}>
            {Object.entries(event.metadata).map(([k, v]) => (
              <React.Fragment key={k}>
                <dt style={{ color: theme.colors.textMuted, fontWeight: 600, whiteSpace: 'nowrap' }}>{k}</dt>
                <dd style={{ margin: 0, color: theme.colors.textSecondary, fontFamily: theme.typography.familyMono, wordBreak: 'break-all' }}>
                  {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                </dd>
              </React.Fragment>
            ))}
          </dl>
        )}
      </div>
    </div>
  );
}

// ── Top-level component ───────────────────────────────────────────────────────

export function TimelineRenderer({
  data,
  density = 'operator',
  onExplain,
}: TimelineRendererProps) {
  const { theme } = useTheme();
  const m = useMessages();
  const statusConfig = useStatusConfig();
  const result = TimelineDataSchema.safeParse(data);

  // Compute tlOrNull early so hooks below can close over it safely.
  // Hooks MUST NOT be called after a conditional return — React rules of hooks.
  const tlOrNull = result.success ? result.data : null;

  // Sort events by timestamp ascending.
  // Declared before the error-return below to comply with React hooks rules.
  const sorted = useMemo(() => {
    if (!tlOrNull) return [];
    return [...tlOrNull.events].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );
  }, [tlOrNull]);

  // Executive density: show only the most recent N events
  const visible = density === 'executive'
    ? sorted.slice(-(tlOrNull?.executiveCap ?? 5))
    : sorted;

  // Build category → color palette
  const catPalette = useMemo<Map<string, string>>(() => {
    const map = new Map<string, string>();
    sorted.forEach((e) => { if (e.category) categoryColor(e.category, map); });
    return map;
  }, [sorted]);

  // Group events if groupBy is set
  const groups = useMemo<Array<{ label: string; events: TimelineEvent[] }>>(() => {
    if (!tlOrNull?.groupBy) return [{ label: '', events: visible }];
    const map = new Map<string, TimelineEvent[]>();
    visible.forEach((e) => {
      const key = groupKey(e, tlOrNull.groupBy!);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    });
    return Array.from(map.entries()).map(([label, events]) => ({ label, events }));
  }, [visible, tlOrNull]);

  // Error guard — placed after all hooks to comply with React rules of hooks.
  if (!result.success) {
    return (
      <div style={{ color: theme.colors.danger, fontSize: '0.8rem', padding: '1rem', fontFamily: theme.typography.familyMono }}>
        <strong>{m.timelineInvalidData}</strong>
        <pre style={{ marginTop: '0.5rem', fontSize: '0.7rem' }}>
          {JSON.stringify(result.error.flatten(), null, 2)}
        </pre>
      </div>
    );
  }

  // tl is guaranteed non-null: result.success is true at this point.
  const tl = result.data;

  return (
    <div role="list" aria-label={tl.title ?? 'Timeline'}>
      {/* Header */}
      {tl.title && (
        <h3 style={{
          margin: '0 0 1rem',
          fontSize: '0.9rem',
          fontWeight: 700,
          color: theme.colors.text,
          paddingBottom: '0.5rem',
          borderBottom: `2px solid ${theme.colors.border}`,
        }}>
          {tl.title}
        </h3>
      )}

      {/* Executive banner */}
      {density === 'executive' && tl.events.length > tl.executiveCap && (
        <p style={{ fontSize: '0.68rem', color: theme.colors.textMuted, margin: '0 0 0.75rem', fontStyle: 'italic' }}>
          {m.timelineShowing(tl.executiveCap, tl.events.length)}
        </p>
      )}

      {/* Empty state */}
      {visible.length === 0 && (
        <p style={{ fontSize: '0.8rem', color: theme.colors.textMuted, textAlign: 'center', padding: '2rem 0' }}>
          {m.timelineNoEvents}
        </p>
      )}

      {/* Groups */}
      {groups.map((group, gi) => (
        <div key={group.label || gi}>
          {/* Group header */}
          {group.label && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              margin: gi === 0 ? '0 0 0.75rem' : '1rem 0 0.75rem',
            }}>
              <span style={{
                fontSize: '0.65rem', fontWeight: 700, color: theme.colors.textSecondary,
                textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap',
              }}>
                {tl.groupBy === 'category' ? group.label : formatDate(group.events[0].timestamp)}
              </span>
              <div style={{ flex: 1, height: '1px', backgroundColor: theme.colors.border }} />
            </div>
          )}

          {/* Events */}
          {group.events.map((event, ei) => {
            const dotColor = event.status
              ? statusConfig[event.status].dot
              : event.category
                ? categoryColor(event.category, catPalette)
                : theme.colors.textMuted;
            return (
              <EventCard
                key={event.id}
                event={event}
                density={density}
                showTimestamps={tl.showTimestamps}
                dotColor={dotColor}
                isLast={ei === group.events.length - 1 && gi === groups.length - 1}
                onExplain={onExplain}
              />
            );
          })}
        </div>
      ))}

      {/* Category legend (expert + groupBy:category) */}
      {density === 'expert' && catPalette.size > 0 && (
        <div style={{
          marginTop: '1.25rem',
          paddingTop: '0.75rem',
          borderTop: `1px solid ${theme.colors.border}`,
          display: 'flex', flexWrap: 'wrap', gap: '0.5rem',
        }}>
          {Array.from(catPalette.entries()).map(([cat, color]) => (
            <span key={cat} style={{
              display: 'flex', alignItems: 'center', gap: '0.3rem',
              fontSize: '0.65rem', color: theme.colors.textSecondary,
            }}>
              <span style={{ width: '0.5rem', height: '0.5rem', borderRadius: '50%', backgroundColor: color, flexShrink: 0 }} />
              {cat}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
