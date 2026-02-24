import type { Meta, StoryObj } from '@storybook/react';
import React, { useState } from 'react';
import { ExplainPanel } from './ExplainPanel';
import type { ExplainabilityContext } from '@hari/core';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const MINIMAL_CTX: ExplainabilityContext = {
  elementId: 'ba177-card',
  summary: 'BA177 is ranked first because it balances cost and comfort for a business traveller.',
  dataSources: [
    { name: 'Amadeus Flights API', type: 'api', freshness: '2 min ago', reliability: 0.98 },
    { name: 'Travel Policy DB', type: 'database', freshness: '1 h ago', reliability: 0.99 },
  ],
  assumptions: [
    'Direct flights preferred over connections',
    'Departure window is flexible ±2 hours',
  ],
  confidenceRange: { low: 0.78, high: 0.95 },
  alternativesConsidered: [
    { description: 'AA101 via Iceland', reason: 'Adds 2 h journey time and 89 kg CO₂' },
  ],
  whatIfQueries: [
    'What if prices increase by 10%?',
    'What if I optimise for carbon instead?',
  ],
};

const CLOUDOPS_CTX: ExplainabilityContext = {
  elementId: 'replication-lag',
  summary:
    'Replication lag is highlighted because it breached the 5 s SLA threshold 3 minutes ago.',
  dataSources: [
    { name: 'Prometheus', type: 'api', freshness: '15 s ago', reliability: 0.99 },
    { name: 'PagerDuty', type: 'api', freshness: '1 min ago', reliability: 0.97 },
  ],
  assumptions: [
    'Linear lag growth assumed for projection',
    'No spontaneous query completions expected',
  ],
  confidenceRange: { low: 0.82, high: 0.93 },
  alternativesConsidered: [],
  whatIfQueries: [
    'What if no action is taken for 10 minutes?',
    'What if we restart the replica?',
  ],
};

// ── Meta ──────────────────────────────────────────────────────────────────────

const meta: Meta<typeof ExplainPanel> = {
  title: 'Core/ExplainPanel',
  component: ExplainPanel,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          '"Why am I seeing this?" — collaborative reasoning surface. ' +
          'Shows data sources, assumptions, confidence range, alternatives, and what-if queries.',
      },
    },
  },
};
export default meta;

type Story = StoryObj<typeof ExplainPanel>;

// ── Stories ───────────────────────────────────────────────────────────────────

export const TravelContext: Story = {
  render: (args) => (
    <div style={{ maxWidth: '520px' }}>
      <ExplainPanel {...args} />
    </div>
  ),
  args: {
    context: MINIMAL_CTX,
    onClose: () => {},
  },
};

export const CloudOpsContext: Story = {
  render: (args) => (
    <div style={{ maxWidth: '520px' }}>
      <ExplainPanel {...args} />
    </div>
  ),
  args: {
    context: CLOUDOPS_CTX,
    onClose: () => {},
  },
};

export const InteractiveWhatIf: Story = {
  render: () => {
    const [whatIfQuery, setWhatIfQuery] = useState<string | null>(null);
    return (
      <div style={{ maxWidth: '520px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <ExplainPanel
          context={MINIMAL_CTX}
          onClose={() => {}}
          onWhatIf={(q) => setWhatIfQuery(q)}
        />
        {whatIfQuery && (
          <div
            style={{
              padding: '0.75rem 1rem',
              backgroundColor: '#f5f3ff',
              border: '1px solid #a78bfa',
              borderRadius: '0.5rem',
              fontSize: '0.875rem',
              color: '#4c1d95',
            }}
          >
            What-if query submitted: <strong>{whatIfQuery}</strong>
          </div>
        )}
      </div>
    );
  },
};
