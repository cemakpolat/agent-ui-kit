import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { TimelineRenderer } from './TimelineRenderer';
import { TimelineDataSchema } from '@hari/core';

// ─────────────────────────────────────────────────────────────────────────────
// Shared decorators for HARI time-bounding & uncertainty states
// ─────────────────────────────────────────────────────────────────────────────

function UncertaintyBanner({ confidence, unknowns }: { confidence: number; unknowns: string[] }) {
  const pct    = Math.round(confidence * 100);
  const isLow  = confidence < 0.5;
  const bg     = isLow ? '#fee2e2' : '#fef9c3';
  const color  = isLow ? '#991b1b' : '#854d0e';
  const icon   = isLow ? '⚠' : '~';
  const label  = isLow ? 'Low Confidence' : 'Moderate Confidence';
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
        ○ View Expired — this perception has passed its time bound. Re-task the agent to refresh.
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

const now = new Date();
function ts(offsetMs: number) {
  return new Date(now.getTime() + offsetMs).toISOString();
}

const DEPLOYMENT_TIMELINE = TimelineDataSchema.parse({
  title: 'API Gateway — Deployment History',
  showGroupHeaders: true,
  events: [
    {
      id: 't1',
      title: 'v2.4.1 deployed to staging',
      description: 'All smoke tests passed. Latency p99 within SLO.',
      timestamp: ts(-7 * 24 * 3600000),
      status: 'completed',
      category: 'deploy',
      icon: '🚀',
    },
    {
      id: 't2',
      title: 'Load test: 10k RPS baseline established',
      timestamp: ts(-6 * 24 * 3600000),
      status: 'completed',
      category: 'testing',
      icon: '📊',
    },
    {
      id: 't3',
      title: 'CVE-2024-38475 patch applied',
      description: 'Security patch for request-smuggling vulnerability in underlying nginx.',
      timestamp: ts(-4 * 24 * 3600000),
      status: 'completed',
      category: 'security',
      icon: '🔒',
    },
    {
      id: 't4',
      title: 'v2.4.2 promoted to production',
      description: 'Blue-green switch. Zero-downtime. Rollback window: 60 min.',
      timestamp: ts(-2 * 24 * 3600000),
      status: 'completed',
      category: 'deploy',
      icon: '✅',
    },
    {
      id: 't5',
      title: 'Post-deploy monitoring window',
      description: 'Error rate < 0.05%, p99 latency 143ms. Within SLO.',
      timestamp: ts(-47 * 3600000),
      endTimestamp: ts(-23 * 3600000),
      status: 'completed',
      category: 'monitoring',
      icon: '📡',
    },
    {
      id: 't6',
      title: 'v2.5.0 RC1 — gate review',
      description: 'Pending engineering sign-off before staging deploy.',
      timestamp: ts(2 * 3600000),
      status: 'pending',
      category: 'deploy',
      icon: '🔮',
    },
  ],
});

// High-uncertainty timeline: incomplete event data, inferred timestamps
const INCIDENT_TIMELINE = TimelineDataSchema.parse({
  title: 'Incident #INC-2084 — Partial Reconstruction',
  events: [
    {
      id: 'i1',
      title: 'First alert received (PagerDuty)',
      description: 'Exact alert time inferred from on-call log. Monitoring system was itself degraded.',
      timestamp: ts(-4 * 3600000),
      status: 'completed',
      category: 'incident',
      icon: '🔔',
    },
    {
      id: 'i2',
      title: 'Initial triage — RCA unknown',
      description: 'Root cause not determined. Assumed: upstream dependency failure. Not confirmed.',
      timestamp: ts(-3.5 * 3600000),
      status: 'completed',
      category: 'incident',
      icon: '🔍',
    },
    {
      id: 'i3',
      title: 'Traffic rerouted to failover region',
      description: 'Partial mitigation. CDN cache state inconsistent — full impact not measurable.',
      timestamp: ts(-3 * 3600000),
      status: 'completed',
      category: 'mitigation',
      icon: '↔',
    },
    {
      id: 'i4',
      title: 'Service partially restored',
      description: 'Agent inference: based on alert resolution. Actual service health not directly observed.',
      timestamp: ts(-90 * 60000),
      status: 'in_progress',
      category: 'mitigation',
      icon: '⚡',
    },
    {
      id: 'i5',
      title: 'Post-incident review — not yet scheduled',
      timestamp: ts(24 * 3600000),
      status: 'pending',
      category: 'review',
      icon: '📋',
    },
  ],
});

// ─────────────────────────────────────────────────────────────────────────────
// Meta
// ─────────────────────────────────────────────────────────────────────────────

const meta: Meta<typeof TimelineRenderer> = {
  title: 'Renderers/TimelineRenderer',
  component: TimelineRenderer,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Renders a chronological sequence of events as a vertical timeline with ' +
          'status badges, category colour-coding, and duration spans. ' +
          'Density-aware: executive shows only recent events; expert shows full metadata and grouping.',
      },
    },
  },
};
export default meta;

type Story = StoryObj<typeof TimelineRenderer>;

// ── Default ───────────────────────────────────────────────────────────────────

export const Default: Story = {
  name: 'Default',
  args: {
    data: DEPLOYMENT_TIMELINE,
    density: 'operator',
  },
  parameters: {
    docs: {
      description: {
        story: 'Deployment history at operator density. High confidence — events sourced from deployment system.',
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
        confidence={0.31}
        unknowns={[
          'Monitoring system was degraded — timestamps are inferred',
          'Root cause of incident not confirmed',
          'Full blast radius not directly measured',
        ]}
      />
      <TimelineRenderer {...args} />
    </div>
  ),
  args: {
    data: INCIDENT_TIMELINE,
    density: 'operator',
  },
  parameters: {
    docs: {
      description: {
        story:
          'Confidence 31% — incident timeline reconstructed from secondary signals, not direct monitoring. ' +
          'HARI mandates the uncertainty banner when confidence < 50%. ' +
          'The timeline content itself reflects what the agent inferred vs. directly observed.',
      },
    },
  },
};

// ── Expired ───────────────────────────────────────────────────────────────────

export const Expired: Story = {
  name: 'Expired',
  render: (args) => (
    <div style={{ opacity: 0.55, filter: 'grayscale(0.5)' }}>
      <ExpiredBanner />
      <TimelineRenderer {...args} />
    </div>
  ),
  args: {
    data: DEPLOYMENT_TIMELINE,
    density: 'operator',
  },
  parameters: {
    docs: {
      description: {
        story:
          'Expired view: the perception\'s expiresAt has passed (typically +15 min from generatedAt). ' +
          'HARI desaturates the view and blocks approval actions. ' +
          'The agent must be re-tasked to emit a fresh SituationalPerception.',
      },
    },
  },
};

// ── Density variants ──────────────────────────────────────────────────────────

export const ExecutiveDensity: Story = {
  args: { data: DEPLOYMENT_TIMELINE, density: 'executive' },
};

export const ExpertDensity: Story = {
  args: { data: DEPLOYMENT_TIMELINE, density: 'expert' },
};
