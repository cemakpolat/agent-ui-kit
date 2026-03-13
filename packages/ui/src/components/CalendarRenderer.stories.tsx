import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { CalendarRenderer } from './CalendarRenderer';
import { CalendarDataSchema } from '@hari/core';

// ─────────────────────────────────────────────────────────────────────────────
// Shared decorators for HARI time-bounding & uncertainty states
// ─────────────────────────────────────────────────────────────────────────────

function UncertaintyBanner({ confidence, unknowns }: { confidence: number; unknowns: string[] }) {
  const pct   = Math.round(confidence * 100);
  const isLow = confidence < 0.5;
  const bg    = isLow ? '#fee2e2' : '#fef9c3';
  const color = isLow ? '#991b1b' : '#854d0e';
  const icon  = isLow ? '⚠' : '~';
  const label = isLow ? 'Low Confidence' : 'Moderate Confidence';
  return (
    <div style={{ border: `2px solid ${color}`, borderRadius: 8, overflow: 'hidden', marginBottom: 12 }}>
      <div style={{ background: bg, color, padding: '8px 12px', fontSize: '0.8rem', fontWeight: 600, display: 'flex', gap: 12, alignItems: 'baseline' }}>
        <span>{icon} {label} — {pct}%</span>
        <span style={{ fontWeight: 400, fontSize: '0.75rem' }}>{unknowns.join(' · ')}</span>
      </div>
    </div>
  );
}

function ExpiredBanner() {
  return (
    <div style={{ border: '2px solid #991b1b', borderRadius: 8, overflow: 'hidden', marginBottom: 12 }}>
      <div style={{ background: '#fee2e2', color: '#991b1b', padding: '8px 12px', fontSize: '0.8rem', fontWeight: 600 }}>
        ○ View Expired — this perception has passed its time bound. Re-task the agent to refresh the calendar view.
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

const now = new Date();
function isoDay(addDays: number): string {
  const d = new Date(now);
  d.setDate(d.getDate() + addDays);
  return d.toISOString().slice(0, 10); // Date-only: YYYY-MM-DD
}
function isoTs(addDays: number, hour: number, minute = 0): string {
  const d = new Date(now);
  d.setDate(d.getDate() + addDays);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

const TEAM_CALENDAR = CalendarDataSchema.parse({
  title: 'Platform Team — Release Calendar',
  defaultView: 'week',
  events: [
    {
      id: 'c1',
      title: 'Sprint 42 Planning',
      start: isoTs(-1, 10),
      end: isoTs(-1, 12),
      category: 'planning',
      status: 'confirmed',
      attendees: ['Priya', 'Alicia', 'Dev', 'Sam'],
      location: 'Conf Room A',
    },
    {
      id: 'c2',
      title: 'v2.5.0 Freeze',
      start: isoDay(0),
      end: isoDay(0),
      allDay: true,
      category: 'release',
      status: 'confirmed',
      color: '#ef4444',
    },
    {
      id: 'c3',
      title: 'Arch Review: Rate Limiting Design',
      start: isoTs(1, 14),
      end: isoTs(1, 15, 30),
      category: 'review',
      status: 'confirmed',
      attendees: ['Alicia', 'Jordan', 'Priya'],
    },
    {
      id: 'c4',
      title: 'On-Call Handover',
      start: isoTs(2, 9),
      end: isoTs(2, 9, 30),
      category: 'oncall',
      status: 'confirmed',
      recurrence: 'Every Monday and Thursday',
    },
    {
      id: 'c5',
      title: 'v2.5.0 Staging Deploy',
      start: isoTs(3, 11),
      end: isoTs(3, 12),
      category: 'release',
      status: 'tentative',
      attendees: ['Dev', 'Alicia'],
    },
    {
      id: 'c6',
      title: 'Retrospective Sprint 41',
      start: isoTs(4, 15),
      end: isoTs(4, 16),
      category: 'planning',
      status: 'confirmed',
      attendees: ['Priya', 'Alicia', 'Dev', 'Sam', 'Jordan', 'Maya'],
    },
    {
      id: 'c7',
      title: 'v2.5.0 Production Deploy',
      start: isoTs(7, 14),
      end: isoTs(7, 15),
      category: 'release',
      status: 'tentative',
      color: '#6366f1',
    },
  ],
});

// High-uncertainty calendar: unconfirmed events, inferred schedules
const INCIDENT_SCHEDULE = CalendarDataSchema.parse({
  title: 'Incident Response Schedule (Inferred)',
  defaultView: 'week',
  events: [
    {
      id: 'i1',
      title: 'Incident bridge open (auto-detected)',
      start: isoTs(-1, 22),
      end: isoTs(0, 2),
      category: 'incident',
      status: 'confirmed',
      color: '#ef4444',
      description: 'Bridge start inferred from PagerDuty log. Actual end time unknown.',
    },
    {
      id: 'i2',
      title: 'On-call escalation (assumed)',
      start: isoTs(0, 0, 30),
      end: isoTs(0, 1),
      category: 'incident',
      status: 'tentative',
      color: '#f59e0b',
      description: 'Escalation assumed based on incident severity. Not confirmed in runbook log.',
    },
    {
      id: 'i3',
      title: 'Post-Incident Review — TBD',
      start: isoTs(3, 10),
      end: isoTs(3, 11),
      category: 'review',
      status: 'tentative',
      description: 'Scheduling not confirmed. Attendees unknown until on-call rotation finalised.',
    },
    {
      id: 'i4',
      title: 'Cancelled: Sprint Demo',
      start: isoTs(2, 15),
      end: isoTs(2, 16),
      category: 'planning',
      status: 'cancelled',
    },
  ],
});

// ─────────────────────────────────────────────────────────────────────────────
// Meta
// ─────────────────────────────────────────────────────────────────────────────

const meta: Meta<typeof CalendarRenderer> = {
  title: 'Renderers/CalendarRenderer',
  component: CalendarRenderer,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Renders calendar events in month, week, or agenda view with category colour-coding. ' +
          'Executive density: month grid with dot counts. ' +
          'Operator density: week view with titles and times. ' +
          'Expert density: full agenda with attendees, recurrence, and metadata.',
      },
    },
  },
};
export default meta;

type Story = StoryObj<typeof CalendarRenderer>;

// ── Default ───────────────────────────────────────────────────────────────────

export const Default: Story = {
  name: 'Default',
  args: {
    data: TEAM_CALENDAR,
    density: 'operator',
  },
  parameters: {
    docs: {
      description: {
        story: 'Standard team release calendar at operator density. Confirmed events, high confidence.',
      },
    },
  },
};

// ── High Uncertainty ──────────────────────────────────────────────────────────

export const HighUncertainty: Story = {
  name: 'High Uncertainty',
  render: (args) => (
    <div>
      <UncertaintyBanner
        confidence={0.41}
        unknowns={[
          'PIR scheduling not confirmed',
          'Incident end time not directly observed — inferred from log',
          'On-call escalation assumed, not verified',
        ]}
      />
      <CalendarRenderer {...args} />
    </div>
  ),
  args: {
    data: INCIDENT_SCHEDULE,
    density: 'operator',
  },
  parameters: {
    docs: {
      description: {
        story:
          'Confidence 41% — incident schedule reconstructed from secondary signals. ' +
          'Tentative events (lighter opacity) reflect unconfirmed scheduling. ' +
          'Cancelled events are shown struck-through per HARI\'s "never blank" policy.',
      },
    },
  },
};

// ── Expired ───────────────────────────────────────────────────────────────────

export const Expired: Story = {
  name: 'Expired',
  render: (args) => (
    <div style={{ opacity: 0.55, filter: 'grayscale(0.4)' }}>
      <ExpiredBanner />
      <CalendarRenderer {...args} />
    </div>
  ),
  args: {
    data: TEAM_CALENDAR,
    density: 'operator',
  },
  parameters: {
    docs: {
      description: {
        story:
          'Expired perception state. Calendar data was valid at generation time (generatedAt) ' +
          'but has passed its expiresAt boundary. New meetings may have been scheduled, cancelled, ' +
          'or rescheduled since. HARI desaturates the view and requires a fresh perception.',
      },
    },
  },
};

// ── Density variants ──────────────────────────────────────────────────────────

export const ExecutiveDensity: Story = {
  args: { data: TEAM_CALENDAR, density: 'executive' },
};

export const ExpertDensity: Story = {
  args: { data: TEAM_CALENDAR, density: 'expert' },
};
