import React, { useMemo, useState } from 'react';
import { CalendarDataSchema, type CalendarEvent } from '@hari/core';
import { useTheme } from '../ThemeContext';
import { useMessages } from '../i18n';

// ─────────────────────────────────────────────────────────────────────────────
// CalendarRenderer
//
// Renders calendar events in month, week, or agenda view.
// Supports density-aware presentation:
//   executive — month grid with event-count dots per day
//   operator  — week view with event titles and times
//   expert    — agenda list with full details, attendees, metadata
// ─────────────────────────────────────────────────────────────────────────────

export interface CalendarRendererProps {
  data: unknown;
  density?: 'executive' | 'operator' | 'expert';
  onExplain?: (elementId: string) => void;
}

// ── Colour palette for categories ─────────────────────────────────────────────

const CATEGORY_COLORS = [
  '#6366f1', '#0ea5e9', '#10b981', '#f59e0b',
  '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6',
  '#f97316', '#84cc16',
];

function categoryColor(category: string, palette: Map<string, string>): string {
  if (!palette.has(category)) {
    palette.set(category, CATEGORY_COLORS[palette.size % CATEGORY_COLORS.length]);
  }
  return palette.get(category)!;
}

// ── Status styling ─────────────────────────────────────────────────────────────

const STATUS_STYLE: Record<string, { opacity: number; textDecoration: string }> = {
  confirmed: { opacity: 1,   textDecoration: 'none' },
  tentative: { opacity: 0.65, textDecoration: 'none' },
  cancelled: { opacity: 0.4,  textDecoration: 'line-through' },
};

// ── Date utilities ─────────────────────────────────────────────────────────────

function parseDate(iso: string): Date {
  // Handle date-only strings (all-day events) without timezone shift
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date(iso);
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

function startOfWeek(d: Date, weekStartsOn: number): Date {
  const day = d.getDay();
  const diff = (day - weekStartsOn + 7) % 7;
  return addDays(d, -diff);
}

function formatTime(iso: string): string {
  const d = parseDate(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function formatDateLong(d: Date): string {
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

function formatMonthYear(d: Date): string {
  return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

function formatWeekRange(start: Date, end: Date): string {
  const s = start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const e = end.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  return `${s} – ${e}`;
}

/** Return all events that overlap a given calendar day. */
function eventsForDay(events: CalendarEvent[], day: Date): CalendarEvent[] {
  const dayStr = isoDate(day);
  return events.filter((ev) => {
    const evStart = isoDate(parseDate(ev.start));
    const evEnd   = isoDate(parseDate(ev.end));
    return evStart <= dayStr && dayStr <= evEnd;
  });
}

// ── Executive: month grid with dot counts ─────────────────────────────────────

interface MonthGridProps {
  events: CalendarEvent[];
  focus: Date;
  weekStartsOn: number;
  executiveCap: number;
  palette: Map<string, string>;
  onNavigate: (d: Date) => void;
}

function MonthGrid({ events, focus, weekStartsOn, executiveCap, palette, onNavigate }: MonthGridProps) {
  const { theme } = useTheme();
  const m = useMessages();
  const today = isoDate(new Date());
  const monthStart = startOfMonth(focus);
  const monthEnd   = endOfMonth(focus);
  const gridStart  = startOfWeek(monthStart, weekStartsOn);

  // Build 6 weeks of days
  const weeks: Date[][] = [];
  let cursor = gridStart;
  while (cursor <= monthEnd || weeks.length < 6) {
    const week: Date[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(new Date(cursor));
      cursor = addDays(cursor, 1);
    }
    weeks.push(week);
    if (cursor > monthEnd && weeks.length >= 6) break;
  }

  // Day-of-week headers
  const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const headers: string[] = [];
  for (let i = 0; i < 7; i++) {
    headers.push(DOW_LABELS[(weekStartsOn + i) % 7]);
  }

  const cellStyle = (day: Date): React.CSSProperties => {
    const ds = isoDate(day);
    const isToday = ds === today;
    const inMonth = day.getMonth() === focus.getMonth();
    return {
      padding: '0.35rem 0.4rem',
      minHeight: '4.5rem',
      border: `1px solid ${theme.colors.border}`,
      borderRadius: theme.radius.sm,
      background: isToday ? theme.colors.accentSubtle : inMonth ? theme.colors.surface : theme.colors.surfaceAlt,
      opacity: inMonth ? 1 : 0.45,
      position: 'relative',
    };
  };

  return (
    <div role="grid" aria-label="Month calendar grid">
      {/* Month navigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <button
          onClick={() => onNavigate(new Date(focus.getFullYear(), focus.getMonth() - 1, 1))}
          style={{ background: 'none', border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.sm, padding: '0.2rem 0.6rem', cursor: 'pointer', fontSize: '1rem', color: theme.colors.text }}
          aria-label={m.calPrevMonth}
        >‹</button>
        <span style={{ fontWeight: 600, fontSize: '1rem', color: theme.colors.text }}>{formatMonthYear(focus)}</span>
        <button
          onClick={() => onNavigate(new Date(focus.getFullYear(), focus.getMonth() + 1, 1))}
          style={{ background: 'none', border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.sm, padding: '0.2rem 0.6rem', cursor: 'pointer', fontSize: '1rem', color: theme.colors.text }}
          aria-label={m.calNextMonth}
        >›</button>
      </div>

      {/* Day-of-week headers */}
      <div role="row" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', marginBottom: '2px' }}>
        {headers.map((h) => (
          <div key={h} role="columnheader" style={{ textAlign: 'center', fontSize: '0.7rem', fontWeight: 600, color: theme.colors.textSecondary, padding: '0.25rem 0' }}>
            {h}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      {weeks.map((week, wi) => (
        <div key={wi} role="row" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', marginBottom: '2px' }}>
          {week.map((day) => {
            const dayEvents = eventsForDay(events, day);
            const shown = dayEvents.slice(0, executiveCap);
            const overflow = dayEvents.length - shown.length;
            const ds = isoDate(day);
            const isToday = ds === today;
            return (
              <div key={ds} role="gridcell" aria-current={isToday ? 'date' : undefined} style={cellStyle(day)}>
                <div style={{
                  fontSize: '0.75rem',
                  fontWeight: isToday ? 700 : 500,
                  color: isToday ? theme.colors.accent : theme.colors.text,
                  marginBottom: '0.2rem',
                }}>
                  {day.getDate()}
                </div>
                {shown.map((ev) => {
                  const color = ev.color ?? (ev.category ? categoryColor(ev.category, palette) : theme.colors.accent);
                  return (
                    <div key={ev.id} style={{
                      fontSize: '0.65rem',
                      background: color + '22',
                      color,
                      borderLeft: `2px solid ${color}`,
                      borderRadius: '2px',
                      padding: '1px 3px',
                      marginBottom: '1px',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      ...STATUS_STYLE[ev.status ?? 'confirmed'],
                    }}>
                      {ev.title}
                    </div>
                  );
                })}
                {overflow > 0 && (
                  <div style={{ fontSize: '0.6rem', color: theme.colors.textMuted }}>{m.calMore(overflow)}</div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ── Operator: week view ────────────────────────────────────────────────────────

interface WeekViewProps {
  events: CalendarEvent[];
  focus: Date;
  weekStartsOn: number;
  palette: Map<string, string>;
  onNavigate: (d: Date) => void;
  onExplain?: (id: string) => void;
}

function WeekView({ events, focus, weekStartsOn, palette, onNavigate, onExplain }: WeekViewProps) {
  const { theme } = useTheme();
  const m = useMessages();
  const today = isoDate(new Date());
  const weekStart = startOfWeek(focus, weekStartsOn);
  const days: Date[] = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const weekEnd = days[6];

  return (
    <div role="grid" aria-label="Week calendar view">
      {/* Week navigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <button
          onClick={() => onNavigate(addDays(weekStart, -7))}
          style={{ background: 'none', border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.sm, padding: '0.2rem 0.6rem', cursor: 'pointer', fontSize: '1rem', color: theme.colors.text }}
          aria-label={m.calPrevWeek}
        >‹</button>
        <span style={{ fontWeight: 600, fontSize: '0.95rem', color: theme.colors.text }}>{formatWeekRange(weekStart, weekEnd)}</span>
        <button
          onClick={() => onNavigate(addDays(weekStart, 7))}
          style={{ background: 'none', border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.sm, padding: '0.2rem 0.6rem', cursor: 'pointer', fontSize: '1rem', color: theme.colors.text }}
          aria-label={m.calNextWeek}
        >›</button>
      </div>

      {/* Day columns */}
      <div role="row" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.375rem' }}>
        {days.map((day) => {
          const ds = isoDate(day);
          const isToday = ds === today;
          const dayEvents = eventsForDay(events, day);
          return (
            <div key={ds} role="gridcell" aria-current={isToday ? 'date' : undefined} style={{
              border: `1px solid ${isToday ? theme.colors.borderFocus : theme.colors.border}`,
              borderRadius: theme.radius.md,
              padding: '0.5rem',
              background: isToday ? theme.colors.accentSubtle : theme.colors.surface,
              minHeight: '8rem',
            }}>
              <div style={{
                fontSize: '0.7rem',
                fontWeight: 700,
                color: isToday ? theme.colors.accent : theme.colors.text,
                marginBottom: '0.375rem',
                textAlign: 'center',
              }}>
                <div>{day.toLocaleDateString(undefined, { weekday: 'short' })}</div>
                <div style={{ fontSize: '1rem' }}>{day.getDate()}</div>
              </div>
              {dayEvents.length === 0 && (
                <div style={{ fontSize: '0.65rem', color: theme.colors.textMuted, textAlign: 'center' }}>—</div>
              )}
              {dayEvents.map((ev) => {
                const color = ev.color ?? (ev.category ? categoryColor(ev.category, palette) : theme.colors.accent);
                return (
                  <div
                    key={ev.id}
                    role={ev.explainElementId ? 'button' : undefined}
                    tabIndex={ev.explainElementId ? 0 : undefined}
                    aria-label={ev.explainElementId ? `Explain: ${ev.title}` : undefined}
                    style={{
                      background: color + '18',
                      borderLeft: `3px solid ${color}`,
                      borderRadius: '3px',
                      padding: '0.2rem 0.35rem',
                      marginBottom: '0.25rem',
                      cursor: ev.explainElementId ? 'pointer' : 'default',
                      ...STATUS_STYLE[ev.status ?? 'confirmed'],
                    }}
                    onClick={() => ev.explainElementId && onExplain?.(ev.explainElementId)}
                    onKeyDown={(e) => { if (ev.explainElementId && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onExplain?.(ev.explainElementId); } }}
                  >
                    <div style={{ fontSize: '0.65rem', fontWeight: 600, color, lineHeight: 1.2 }}>{ev.title}</div>
                    {!ev.allDay && (
                      <div style={{ fontSize: '0.6rem', color: theme.colors.textSecondary }}>
                        {formatTime(ev.start)}–{formatTime(ev.end)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Expert: agenda view ────────────────────────────────────────────────────────

interface AgendaViewProps {
  events: CalendarEvent[];
  focus: Date;
  palette: Map<string, string>;
  onNavigate: (d: Date) => void;
  onExplain?: (id: string) => void;
}

function AgendaView({ events, focus, palette, onNavigate, onExplain }: AgendaViewProps) {
  const { theme } = useTheme();
  const m = useMessages();
  // Show 14 days starting from focus
  const days: Date[] = Array.from({ length: 14 }, (_, i) => addDays(focus, i));
  const today = isoDate(new Date());
  const daysWithEvents = days.filter((d) => eventsForDay(events, d).length > 0);

  return (
    <div role="list" aria-label="Agenda view">
      {/* Agenda navigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <button
          onClick={() => onNavigate(addDays(focus, -14))}
          style={{ background: 'none', border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.sm, padding: '0.2rem 0.6rem', cursor: 'pointer', fontSize: '1rem', color: theme.colors.text }}
          aria-label={m.calPrevPeriod}
        >‹</button>
        <span style={{ fontWeight: 600, fontSize: '0.95rem', color: theme.colors.text }}>
          {focus.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })} — {m.calAgenda}
        </span>
        <button
          onClick={() => onNavigate(addDays(focus, 14))}
          style={{ background: 'none', border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.sm, padding: '0.2rem 0.6rem', cursor: 'pointer', fontSize: '1rem', color: theme.colors.text }}
          aria-label={m.calNextPeriod}
        >›</button>
      </div>

      {daysWithEvents.length === 0 && (
        <div style={{ textAlign: 'center', color: theme.colors.textMuted, padding: '2rem' }}>{m.calNoEvents}</div>
      )}

      {daysWithEvents.map((day) => {
        const ds = isoDate(day);
        const isToday = ds === today;
        const dayEvents = eventsForDay(events, day).sort((a, b) =>
          a.allDay ? -1 : b.allDay ? 1 : a.start.localeCompare(b.start)
        );
        return (
          <div key={ds} role="listitem" style={{ marginBottom: '1.25rem' }}>
            {/* Day header */}
            <div style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: '0.5rem',
              marginBottom: '0.5rem',
              borderBottom: `1px solid ${theme.colors.border}`,
              paddingBottom: '0.25rem',
            }}>
              <span style={{ fontWeight: 700, fontSize: '0.9rem', color: isToday ? theme.colors.accent : theme.colors.text }}>
                {formatDateLong(day)}
              </span>
              {isToday && (
                <span style={{ fontSize: '0.65rem', background: theme.colors.accentSubtle, color: theme.colors.accent, borderRadius: '99px', padding: '0 0.4rem', fontWeight: 600 }}>
                  {m.calToday}
                </span>
              )}
            </div>

            {/* Events */}
            {dayEvents.map((ev) => {
              const color = ev.color ?? (ev.category ? categoryColor(ev.category, palette) : theme.colors.accent);
              return (
                <div
                  key={ev.id}
                  role={ev.explainElementId ? 'button' : undefined}
                  tabIndex={ev.explainElementId ? 0 : undefined}
                  aria-label={ev.explainElementId ? `Explain: ${ev.title}` : undefined}
                  style={{
                    display: 'flex',
                    gap: '0.75rem',
                    marginBottom: '0.5rem',
                    padding: '0.6rem 0.75rem',
                    background: color + '0d',
                    borderLeft: `3px solid ${color}`,
                    borderRadius: `0 ${theme.radius.sm} ${theme.radius.sm} 0`,
                    cursor: ev.explainElementId ? 'pointer' : 'default',
                    ...STATUS_STYLE[ev.status ?? 'confirmed'],
                  }}
                  onClick={() => ev.explainElementId && onExplain?.(ev.explainElementId)}
                  onKeyDown={(e) => { if (ev.explainElementId && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onExplain?.(ev.explainElementId); } }}
                >
                  {/* Time column */}
                  <div style={{ minWidth: '5.5rem', fontSize: '0.75rem', color: theme.colors.textSecondary, flexShrink: 0 }}>
                    {ev.allDay
                      ? <span style={{ background: color + '22', color, borderRadius: '3px', padding: '1px 5px', fontSize: '0.65rem', fontWeight: 600 }}>{m.calAllDay}</span>
                      : <>{formatTime(ev.start)}<br /><span style={{ color: theme.colors.textMuted }}>{formatTime(ev.end)}</span></>
                    }
                  </div>

                  {/* Content column */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.875rem', color: theme.colors.text }}>{ev.title}</span>
                      {ev.status === 'tentative' && (
                        <span style={{ fontSize: '0.65rem', background: theme.colors.warningSubtle, color: theme.colors.warningText, borderRadius: '3px', padding: '0 4px' }}>Tentative</span>
                      )}
                      {ev.status === 'cancelled' && (
                        <span style={{ fontSize: '0.65rem', background: theme.colors.dangerSubtle, color: theme.colors.dangerText, borderRadius: '3px', padding: '0 4px' }}>Cancelled</span>
                      )}
                      {ev.category && (
                        <span style={{ fontSize: '0.65rem', background: color + '22', color, borderRadius: '3px', padding: '0 4px' }}>{ev.category}</span>
                      )}
                    </div>

                    {ev.description && (
                      <div style={{ fontSize: '0.8rem', color: theme.colors.textSecondary, marginTop: '0.2rem' }}>{ev.description}</div>
                    )}

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginTop: '0.3rem' }}>
                      {ev.location && (
                        <span style={{ fontSize: '0.75rem', color: theme.colors.textSecondary }}>📍 {ev.location}</span>
                      )}
                      {ev.attendees.length > 0 && (
                        <span style={{ fontSize: '0.75rem', color: theme.colors.textSecondary }}>
                          👥 {ev.attendees.slice(0, 3).join(', ')}{ev.attendees.length > 3 ? ` +${ev.attendees.length - 3}` : ''}
                        </span>
                      )}
                      {ev.recurrence && (
                        <span style={{ fontSize: '0.75rem', color: theme.colors.textSecondary }}>🔄 {ev.recurrence}</span>
                      )}
                    </div>

                    {ev.metadata && Object.keys(ev.metadata).length > 0 && (
                      <div style={{ marginTop: '0.35rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                        {Object.entries(ev.metadata).map(([k, v]) => (
                          <span key={k} style={{ fontSize: '0.7rem', background: theme.colors.surfaceAlt, color: theme.colors.textSecondary, borderRadius: '3px', padding: '1px 6px' }}>
                            {k}: {String(v)}
                          </span>
                        ))}
                      </div>
                    )}

                    {ev.explainElementId && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onExplain?.(ev.explainElementId!); }}
                        aria-label={`Explain: ${ev.title}`}
                        style={{ marginTop: '0.3rem', fontSize: '0.7rem', background: 'none', border: `1px solid ${theme.colors.border}`, borderRadius: '3px', padding: '1px 6px', cursor: 'pointer', color: theme.colors.textSecondary }}
                      >
                        Why?
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

// ── Main renderer ─────────────────────────────────────────────────────────────

export function CalendarRenderer({ data, density = 'operator', onExplain }: CalendarRendererProps) {
  const parsed = useMemo(() => {
    const result = CalendarDataSchema.safeParse(data);
    return result.success ? result.data : null;
  }, [data]);

  const palette = useMemo(() => new Map<string, string>(), []);

  const focusDefault = useMemo(() => {
    if (parsed?.focusDate) return parseDate(parsed.focusDate);
    return new Date();
  }, [parsed?.focusDate]);

  const [focus, setFocus] = useState<Date>(focusDefault);

  // Resolve effective view based on density
  const effectiveView = useMemo(() => {
    if (density === 'executive') return 'month';
    if (density === 'expert') return 'agenda';
    return parsed?.view ?? 'week';
  }, [density, parsed?.view]);

  const { theme } = useTheme();
  const m = useMessages();

  if (!parsed) {
    return (
      <div style={{ padding: '1rem', color: theme.colors.danger, fontSize: '0.875rem' }}>
        {m.calInvalidData}
      </div>
    );
  }

  const { title, events, weekStartsOn, executiveCap } = parsed;

  return (
    <div style={{ fontFamily: theme.typography.family, maxWidth: '100%', color: theme.colors.text }}>
      {title && (
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: theme.colors.text, marginBottom: '0.75rem' }}>
          {title}
        </h2>
      )}

      {effectiveView === 'month' && (
        <MonthGrid
          events={events}
          focus={focus}
          weekStartsOn={weekStartsOn}
          executiveCap={executiveCap}
          palette={palette}
          onNavigate={setFocus}
        />
      )}

      {effectiveView === 'week' && (
        <WeekView
          events={events}
          focus={focus}
          weekStartsOn={weekStartsOn}
          palette={palette}
          onNavigate={setFocus}
          onExplain={onExplain}
        />
      )}

      {effectiveView === 'agenda' && (
        <AgendaView
          events={events}
          focus={focus}
          palette={palette}
          onNavigate={setFocus}
          onExplain={onExplain}
        />
      )}
    </div>
  );
}
