import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { TreeRenderer } from './TreeRenderer';
import { TreeDataSchema } from '@hari/core';

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
        ○ View Expired — this perception has passed its time bound. Re-task the agent to refresh.
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

const ORG_CHART = TreeDataSchema.parse({
  title: 'Engineering Organisation',
  showLines: true,
  searchable: true,
  nodes: [
    {
      id: 'cto',
      label: 'Priya Mehta — CTO',
      icon: '👤',
      status: 'active',
      badge: '3 reports',
      defaultExpanded: true,
      children: [
        {
          id: 'platform',
          label: 'Platform Engineering',
          description: '12 engineers',
          icon: '⚙️',
          status: 'active',
          badge: 4,
          defaultExpanded: true,
          children: [
            { id: 'p1', label: 'Alicia Chen — Staff Eng', icon: '👤', status: 'active' },
            { id: 'p2', label: 'Dev Raj — SRE Lead', icon: '👤', status: 'active' },
            { id: 'p3', label: 'Sam Torres — Security Eng', icon: '👤', status: 'active' },
          ],
        },
        {
          id: 'product',
          label: 'Product Engineering',
          description: '18 engineers',
          icon: '💻',
          status: 'active',
          badge: 3,
          children: [
            { id: 'e1', label: 'Jordan Kim — EM', icon: '👤', status: 'active' },
            { id: 'e2', label: 'Maya Patel — Senior SWE', icon: '👤', status: 'active' },
          ],
        },
        {
          id: 'data',
          label: 'Data & ML',
          description: '8 engineers',
          icon: '🧠',
          status: 'warning',
          badge: '⚠ 2 roles open',
          children: [
            { id: 'd1', label: 'Wei Liu — Data Lead', icon: '👤', status: 'active' },
            { id: 'd2', label: '[Open Role] ML Engineer', icon: '❓', status: 'inactive' },
            { id: 'd3', label: '[Open Role] Data Engineer', icon: '❓', status: 'inactive' },
          ],
        },
      ],
    },
  ],
});

// High-uncertainty dependency graph: partial data, many unknown nodes
const DEPENDENCY_TREE = TreeDataSchema.parse({
  title: 'Service Dependency Map (Partial)',
  showLines: true,
  searchable: true,
  nodes: [
    {
      id: 'api-gateway',
      label: 'api-gateway',
      description: 'Entry point — status confirmed',
      icon: '🌐',
      status: 'active',
      defaultExpanded: true,
      children: [
        {
          id: 'auth-service',
          label: 'auth-service',
          description: 'Status: inferred from upstream signals. Not directly monitored.',
          icon: '🔐',
          status: 'warning',
          badge: 'unverified',
          color: '#f59e0b',
          children: [
            { id: 'user-db', label: 'user-db (PostgreSQL)', icon: '🗄️', status: 'warning', description: 'Failover status unknown' },
            { id: 'token-cache', label: 'token-cache (Redis)', icon: '⚡', status: 'error', description: 'Cache miss rate elevated — agent inference only' },
          ],
        },
        {
          id: 'order-service',
          label: 'order-service',
          description: 'Memory leak reported. Agent has no live heap metrics.',
          icon: '📦',
          status: 'error',
          badge: '⚠ degraded',
          color: '#ef4444',
          children: [
            { id: 'order-db', label: 'order-db', icon: '🗄️', status: 'active' },
            { id: 'payment-api', label: 'payment-api (external)', icon: '💳', status: 'warning', description: 'Third-party. Circuit-breaker state unknown.' },
          ],
        },
        {
          id: 'cdn',
          label: 'CDN Layer',
          description: 'Purge outcome unverified after incident mitigation.',
          icon: '☁️',
          status: 'warning',
          badge: 'cache inconsistent',
        },
      ],
    },
  ],
});

// ─────────────────────────────────────────────────────────────────────────────
// Meta
// ─────────────────────────────────────────────────────────────────────────────

const meta: Meta<typeof TreeRenderer> = {
  title: 'Renderers/TreeRenderer',
  component: TreeRenderer,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Renders hierarchical data as an interactive expand/collapse tree. ' +
          'Supports status colour dots, badges, icons, and path breadcrumbs. ' +
          'Density-aware: executive shows top 2 levels; expert includes search and full metadata.',
      },
    },
  },
};
export default meta;

type Story = StoryObj<typeof TreeRenderer>;

// ── Default ───────────────────────────────────────────────────────────────────

export const Default: Story = {
  name: 'Default',
  args: {
    data: ORG_CHART,
    density: 'operator',
  },
  parameters: {
    docs: {
      description: {
        story: 'Engineering org chart at operator density. High confidence — sourced from HRIS.',
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
        confidence={0.34}
        unknowns={[
          'auth-service health not directly observable',
          'CDN cache state post-mitigation unverified',
          'payment-api circuit-breaker state unknown',
        ]}
      />
      <TreeRenderer {...args} />
    </div>
  ),
  args: {
    data: DEPENDENCY_TREE,
    density: 'operator',
  },
  parameters: {
    docs: {
      description: {
        story:
          'Service dependency tree reconstructed from partial signals — confidence 34%. ' +
          'Nodes with ⚠ status represent services the agent could not directly monitor. ' +
          'HARI colour-codes uncertainty: warnings (amber) vs errors (red) vs unverified (badge).',
      },
    },
  },
};

// ── Expired ───────────────────────────────────────────────────────────────────

export const Expired: Story = {
  name: 'Expired',
  render: (args) => (
    <div style={{ opacity: 0.55, filter: 'grayscale(0.45)' }}>
      <ExpiredBanner />
      <TreeRenderer {...args} />
    </div>
  ),
  args: {
    data: ORG_CHART,
    density: 'operator',
  },
  parameters: {
    docs: {
      description: {
        story:
          'Expired view. HARI time-bounding logic: once expiresAt passes, ' +
          'the view is desaturated and all approval actions are blocked. ' +
          'The operator must trigger a re-perception to get fresh data.',
      },
    },
  },
};

// ── Density variants ──────────────────────────────────────────────────────────

export const ExecutiveDensity: Story = {
  args: { data: ORG_CHART, density: 'executive' },
};

export const ExpertDensity: Story = {
  args: { data: ORG_CHART, density: 'expert' },
};
