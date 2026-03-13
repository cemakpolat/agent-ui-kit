import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { DiagramRenderer } from './DiagramRenderer';
import { DiagramDataSchema } from '@hari/core';

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

// ── Mermaid flowchart — deployment pipeline ───────────────────────────────────

const PIPELINE_DIAGRAM = DiagramDataSchema.parse({
  title: 'CI/CD Deployment Pipeline',
  diagrams: [
    {
      kind: 'mermaid',
      id: 'pipeline',
      title: 'Build → Test → Deploy Flow',
      caption: 'All stages must pass before production deploy.',
      markup: `flowchart LR
  A([Source Push]) --> B[Build & Lint]
  B --> C{Tests pass?}
  C -- Yes --> D[Security Scan]
  C -- No --> E[❌ Fail Build]
  D --> F{Scan clean?}
  F -- Yes --> G[Deploy to Staging]
  F -- No --> H[❌ Block Deploy]
  G --> I{Smoke Tests?}
  I -- Yes --> J[Promote to Production]
  I -- No --> K[❌ Rollback]
  J --> L([✅ Live])
  style L fill:#10b981,color:#fff
  style E fill:#ef4444,color:#fff
  style H fill:#ef4444,color:#fff
  style K fill:#ef4444,color:#fff`,
    },
  ],
});

// ── Bar chart — error rate by service ────────────────────────────────────────

const ERROR_RATE_DIAGRAM = DiagramDataSchema.parse({
  title: 'Error Rate by Service (Last 24h)',
  diagrams: [
    {
      kind: 'chart',
      id: 'error-rates',
      title: 'Error Rate (%) — Last 24 Hours',
      caption: 'SLO threshold: 0.5%. Values above threshold highlighted.',
      chartType: 'bar',
      xLabel: 'Service',
      yLabel: 'Error Rate (%)',
      series: [
        {
          name: 'Current',
          color: '#6366f1',
          data: [
            { x: 'api-gateway',   y: 0.12 },
            { x: 'auth-service',  y: 0.48 },
            { x: 'order-service', y: 1.87 },
            { x: 'payment-api',   y: 0.09 },
            { x: 'cdn',           y: 0.03 },
          ],
        },
        {
          name: 'Previous (24h)',
          color: '#d1d5db',
          data: [
            { x: 'api-gateway',   y: 0.11 },
            { x: 'auth-service',  y: 0.21 },
            { x: 'order-service', y: 0.18 },
            { x: 'payment-api',   y: 0.07 },
            { x: 'cdn',           y: 0.02 },
          ],
        },
      ],
    },
  ],
});

// ── High-uncertainty graph diagram ────────────────────────────────────────────
// In high-uncertainty state, graph shows: unknown nodes (grey), inferred edges (dashed)

const DEPENDENCY_GRAPH = DiagramDataSchema.parse({
  title: 'Service Dependency Graph (Partial — Agent Inference)',
  diagrams: [
    {
      kind: 'graph',
      id: 'deps',
      title: 'Live Dependency Map (Incomplete)',
      caption:
        'Dashed edges represent inferred dependencies — not directly observed. ' +
        'Grey nodes have unverified health status.',
      nodes: [
        { id: 'gw',    label: 'api-gateway',    group: 'edge',     status: 'healthy' },
        { id: 'auth',  label: 'auth-service',   group: 'core',     status: 'degraded' },
        { id: 'order', label: 'order-service',  group: 'core',     status: 'degraded' },
        { id: 'pay',   label: 'payment-api',    group: 'external', status: 'unknown' },
        { id: 'udb',   label: 'user-db',        group: 'data',     status: 'unknown' },
        { id: 'odr',   label: 'order-db',       group: 'data',     status: 'healthy' },
        { id: 'cache', label: 'token-cache',    group: 'infra',    status: 'unknown' },
      ],
      edges: [
        { source: 'gw',    target: 'auth',  label: 'authn' },
        { source: 'gw',    target: 'order', label: 'orders' },
        { source: 'auth',  target: 'udb',   label: 'read/write' },
        { source: 'auth',  target: 'cache', label: 'token store' },
        { source: 'order', target: 'odr',   label: 'read/write' },
        { source: 'order', target: 'pay',   label: 'charge' },
      ],
      directed: true,
      layout: 'circular',
    },
  ],
});

// ─────────────────────────────────────────────────────────────────────────────
// Meta
// ─────────────────────────────────────────────────────────────────────────────

const meta: Meta<typeof DiagramRenderer> = {
  title: 'Renderers/DiagramRenderer',
  component: DiagramRenderer,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Renders three sub-kinds of diagrams: **mermaid** (flowchart/sequence/ER via Mermaid.js), ' +
          '**graph** (SVG node/edge network with circular layout), and **chart** (bar/line/area/pie). ' +
          'Expert density adds raw markup toggle and full node metadata.',
      },
    },
  },
};
export default meta;

type Story = StoryObj<typeof DiagramRenderer>;

// ── Default ───────────────────────────────────────────────────────────────────

export const Default: Story = {
  name: 'Default — Pipeline Flowchart',
  args: {
    data: PIPELINE_DIAGRAM,
    density: 'operator',
  },
  parameters: {
    docs: {
      description: {
        story: 'Mermaid flowchart showing a CI/CD pipeline. Operator density.',
      },
    },
  },
};

export const BarChart: Story = {
  name: 'Default — Error Rate Bar Chart',
  args: {
    data: ERROR_RATE_DIAGRAM,
    density: 'operator',
  },
};

// ── High Uncertainty ──────────────────────────────────────────────────────────

export const HighUncertainty: Story = {
  name: 'High Uncertainty',
  render: (args) => (
    <div>
      <UncertaintyBanner
        confidence={0.36}
        unknowns={[
          'auth-service and payment-api health not directly monitored',
          'edge labels are inferred — dependency scan not available',
          'token-cache and user-db status unverified',
        ]}
      />
      <DiagramRenderer {...args} />
    </div>
  ),
  args: {
    data: DEPENDENCY_GRAPH,
    density: 'operator',
  },
  parameters: {
    docs: {
      description: {
        story:
          'Confidence 36% — dependency graph constructed from agent inference, not live service discovery. ' +
          '"Unknown" status nodes (grey) represent services whose health could not be measured. ' +
          'HARI requires all unknowns to be surfaced — never leave them blank.',
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
      <DiagramRenderer {...args} />
    </div>
  ),
  args: {
    data: ERROR_RATE_DIAGRAM,
    density: 'operator',
  },
  parameters: {
    docs: {
      description: {
        story:
          'Chart data has passed its 15-minute validity window. ' +
          'Error rates may have changed since this perception was generated. ' +
          'HARI desaturates expired views and blocks approvals until fresh data is obtained.',
      },
    },
  },
};

// ── Density variants ──────────────────────────────────────────────────────────

export const ExecutiveDensity: Story = {
  args: { data: PIPELINE_DIAGRAM, density: 'executive' },
};

export const ExpertDensity: Story = {
  args: { data: PIPELINE_DIAGRAM, density: 'expert' },
};

// ── System Architecture — sanitizer stress-test ───────────────────────────────
// Demonstrates automatic repair of common LLM Mermaid mistakes:
//   • spaces before bracket:   NodeId ['Label']
//   • single-quoted labels:    ['Label'] → ["Label"]
//   • multi-word node IDs:     Message Queues → MessageQueues

const ARCH_DIAGRAM = DiagramDataSchema.parse({
  title: 'System Architecture — Microservices Overview',
  diagrams: [
    {
      kind: 'mermaid',
      id: 'arch',
      title: 'System Components',
      caption:
        'LLM-generated markup with common syntax errors (spaces before brackets, ' +
        'single-quoted labels, multi-word IDs) is auto-repaired by the sanitiser.',
      markup: `flowchart LR
  Microservices ['Backend']
  Databases ['Database']
  Message Queues ['MQ']
  Microservices --> Databases
  Databases --> Message Queues
  Message Queues --> Microservices`,
    },
  ],
});

export const SystemArchitecture: Story = {
  name: 'System Architecture (LLM markup sanitised)',
  args: {
    data: ARCH_DIAGRAM,
    density: 'operator',
  },
  parameters: {
    docs: {
      description: {
        story:
          'The raw markup uses `NodeId [\'Label\']` (space + single quotes) and the ' +
          'multi-word node ID `Message Queues`, both of which Mermaid rejects. ' +
          'The `sanitizeMermaidMarkup` function repairs these errors automatically.',
      },
    },
  },
};
// ── System Architecture v2 — duplicate IDs + parenthesis shapes ──────────────
// Demonstrates the three new sanitiser passes:
//   1. ('single-quoted') → ("double-quoted")
//   2. NodeId("label")['extra'] — extra label suffix stripped
//   3. Duplicate "Database" node ID — each renamed from its own label text

const ARCH_DIAGRAM_V2 = DiagramDataSchema.parse({
  title: 'System Architecture — Microservices + Databases',
  diagrams: [
    {
      kind: 'mermaid',
      id: 'arch-v2',
      title: 'System Architecture Diagram',
      caption:
        'LLM output: parenthesised single-quoted labels, extra ["MySQL"]/["PostgreSQL"] suffixes, ' +
        'and duplicate "Database" node IDs are all repaired automatically.',
      markup: `graph LR
Order Service['Order Service']
Product Service['Product Service']
Payment Gateway['Payment Gateway']
Inventory Service['Inventory Service']
Database('Product Database')['MySQL']
Database('Order Database')['PostgreSQL']
Message Queue['RabbitMQ']
Order Service --> Message Queue
Message Queue --> Product Service
Product Service --> Payment Gateway
Payment Gateway --> Inventory Service`,
    },
  ],
});

export const SystemArchitectureV2: Story = {
  name: 'System Architecture v2 (duplicate IDs + paren shapes)',
  args: {
    data: ARCH_DIAGRAM_V2,
    density: 'operator',
  },
  parameters: {
    docs: {
      description: {
        story:
          "Covers Database('Product Database')['MySQL'] — parenthesised rounded-rect " +
          "shape with a single-quoted extra label — and a duplicate Database node ID " +
          "which is resolved to ProductDatabase / OrderDatabase from each node's own label.",
      },
    },
  },
};