import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { KanbanRenderer } from './KanbanRenderer';
import { KanbanDataSchema } from '@hari/core';

// ─────────────────────────────────────────────────────────────────────────────
// Shared decorators for HARI time-bounding & uncertainty states
// ─────────────────────────────────────────────────────────────────────────────

function UncertaintyBanner({ confidence, unknowns }: { confidence: number; unknowns: string[] }) {
  const pct = Math.round(confidence * 100);
  const isLow = confidence < 0.5;
  const bg    = isLow ? '#fee2e2' : '#fef9c3';
  const color = isLow ? '#991b1b' : '#854d0e';
  const icon  = isLow ? '⚠' : '~';
  const label = isLow ? 'Low Confidence' : 'Moderate Confidence';
  return (
    <div style={{ border: `2px solid ${color}`, borderRadius: 8, overflow: 'hidden' }}>
      <div style={{ background: bg, color, padding: '8px 12px', fontSize: '0.8rem', fontWeight: 600, display: 'flex', gap: 12, alignItems: 'center' }}>
        <span>{icon} {label} — {pct}%</span>
        <span style={{ fontWeight: 400 }}>Unknowns: {unknowns.join(' · ')}</span>
      </div>
    </div>
  );
}

function ExpiredBanner() {
  return (
    <div style={{ border: '2px solid #991b1b', borderRadius: 8, overflow: 'hidden' }}>
      <div style={{ background: '#fee2e2', color: '#991b1b', padding: '8px 12px', fontSize: '0.8rem', fontWeight: 600 }}>
        ○ View Expired — this perception has passed its time bound. Approve or re-task the agent to refresh.
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

const SPRINT_BOARD = KanbanDataSchema.parse({
  title: 'Sprint 42 — API Gateway Hardening',
  showCardCount: true,
  showWipLimits: true,
  columns: [
    {
      id: 'backlog',
      title: 'Backlog',
      cards: [
        { id: 'k1', title: 'Implement rate-limiting middleware', priority: 'high', tags: ['backend', 'security'] },
        { id: 'k2', title: 'Audit TLS certificate rotation policy', priority: 'medium', tags: ['infra'] },
      ],
    },
    {
      id: 'in-progress',
      title: 'In Progress',
      wipLimit: 3,
      cards: [
        { id: 'k3', title: 'Migrate auth tokens to RS256', priority: 'critical', assignee: 'alicia', dueDate: new Date(Date.now() + 86400000).toISOString(), tags: ['auth'] },
        { id: 'k4', title: 'Load test gateway at 10k RPS', priority: 'high', assignee: 'devraj', tags: ['perf'] },
      ],
    },
    {
      id: 'review',
      title: 'Review',
      wipLimit: 2,
      cards: [
        { id: 'k5', title: 'Update API docs for v2 endpoints', priority: 'low', assignee: 'sam', tags: ['docs'] },
      ],
    },
    {
      id: 'done',
      title: 'Done',
      color: '#10b981',
      cards: [
        { id: 'k6', title: 'Enable mTLS on internal services', priority: 'critical', assignee: 'alicia', tags: ['security', 'done'] },
        { id: 'k7', title: 'Patch CVE-2024-38475 in gateway', priority: 'critical', assignee: 'devraj', tags: ['security', 'done'] },
      ],
    },
  ],
});

// High-uncertainty board: many unknowns, items with missing owners and upcoming deadlines
const UNCERTAIN_BOARD = KanbanDataSchema.parse({
  title: 'Incident Response — Status Unverified',
  showCardCount: true,
  showWipLimits: true,
  columns: [
    {
      id: 'unknown',
      title: 'Unconfirmed',
      color: '#ef4444',
      wipLimit: 2,
      cards: [
        { id: 'u1', title: 'Database failover status unknown', priority: 'critical', tags: ['db', 'incident'], description: 'Agent has no live access to DB monitoring. Status inferred from prior incident patterns.' },
        { id: 'u2', title: 'CDN purge: outcome unverified', priority: 'high', tags: ['cdn', 'unverified'] },
        { id: 'u3', title: 'Third-party payment API health', priority: 'critical', tags: ['payments', 'external'], description: 'Vendor status page is the only signal. Actual circuit-breaker state unknown.' },
      ],
    },
    {
      id: 'investigating',
      title: 'Investigating',
      wipLimit: 2,
      cards: [
        { id: 'u4', title: 'Memory leak in order-service v2.1', priority: 'critical', dueDate: new Date(Date.now() - 3600000).toISOString(), tags: ['memory', 'overdue'] },
      ],
    },
    {
      id: 'mitigated',
      title: 'Mitigated (unverified)',
      color: '#f59e0b',
      cards: [
        { id: 'u5', title: 'Traffic rerouted to eu-west-1', priority: 'high', tags: ['traffic', 'assumed'] },
      ],
    },
  ],
});

// ─────────────────────────────────────────────────────────────────────────────
// Meta
// ─────────────────────────────────────────────────────────────────────────────

const meta: Meta<typeof KanbanRenderer> = {
  title: 'Renderers/KanbanRenderer',
  component: KanbanRenderer,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Renders a task board with columns and cards. Supports priority colour-coding, ' +
          'WIP limits, assignee display, and density-aware layout (executive / operator / expert). ' +
          'Wrap in SituationalViewRenderer to add HARI time-bounding and uncertainty governance.',
      },
    },
  },
};
export default meta;

type Story = StoryObj<typeof KanbanRenderer>;

// ── Default ───────────────────────────────────────────────────────────────────

export const Default: Story = {
  name: 'Default',
  args: {
    data: SPRINT_BOARD,
    density: 'operator',
    onCardClick: (cardId, columnId) => console.log('Card clicked:', cardId, 'in column:', columnId),
  },
  parameters: {
    docs: {
      description: {
        story: 'Standard sprint board at operator density. Active view, high confidence.',
      },
    },
  },
};

// ── High Uncertainty ──────────────────────────────────────────────────────────

export const HighUncertainty: Story = {
  name: 'High Uncertainty',
  render: (args) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <UncertaintyBanner
        confidence={0.38}
        unknowns={[
          'Live DB failover state not confirmed',
          'CDN purge outcome unverified',
          'Payment API circuit-breaker status unknown',
        ]}
      />
      <KanbanRenderer {...args} />
    </div>
  ),
  args: {
    data: UNCERTAIN_BOARD,
    density: 'operator',
  },
  parameters: {
    docs: {
      description: {
        story:
          'Confidence 38% — below the 50% threshold that triggers mandatory HARI uncertainty warnings. ' +
          'The amber/red banner mirrors what <UncertaintyIndicators /> renders in a full SituationalViewRenderer. ' +
          'Cards reflect items whose status the agent cannot verify without live monitoring access.',
      },
    },
  },
};

// ── Expired ───────────────────────────────────────────────────────────────────

export const Expired: Story = {
  name: 'Expired',
  render: (args) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, opacity: 0.6, filter: 'grayscale(0.4)' }}>
      <ExpiredBanner />
      <KanbanRenderer {...args} />
    </div>
  ),
  args: {
    data: SPRINT_BOARD,
    density: 'operator',
  },
  parameters: {
    docs: {
      description: {
        story:
          'Time-bound expired state. The view\'s expiresAt has passed. ' +
          'HARI applies visual degradation (desaturation + the expired banner) and blocks approval actions. ' +
          'The agent must be re-tasked to generate a fresh SituationalPerception.',
      },
    },
  },
};

// ── Density variants ──────────────────────────────────────────────────────────

export const ExecutiveDensity: Story = {
  args: { data: SPRINT_BOARD, density: 'executive' },
};

export const ExpertDensity: Story = {
  args: { data: SPRINT_BOARD, density: 'expert' },
};
