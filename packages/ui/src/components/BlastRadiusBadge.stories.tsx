import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { BlastRadiusBadge } from './BlastRadiusBadge';
import type { ActionSafety } from '@hari/core';

// ── Fixture helpers ────────────────────────────────────────────────────────────

function makeSafety(overrides: Partial<ActionSafety> = {}): ActionSafety {
  return {
    riskLevel: 'low',
    reversible: true,
    requiresConfirmation: false,
    confidence: 0.9,
    ...overrides,
  };
}

const meta: Meta<typeof BlastRadiusBadge> = {
  title: 'Core/BlastRadiusBadge',
  component: BlastRadiusBadge,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Visualises risk level and downstream impact of an agent action. ' +
          'Renders as a compact chip that expands on click to show full dependency summary.',
      },
    },
  },
};
export default meta;

type Story = StoryObj<typeof BlastRadiusBadge>;

export const LowRisk: Story = {
  args: {
    safety: makeSafety({ riskLevel: 'low', reversible: true }),
    compact: true,
  },
};

export const MediumRisk: Story = {
  args: {
    safety: makeSafety({
      riskLevel: 'medium',
      reversible: true,
      blastRadius: { scope: 'team', affectedSystems: ['billing-api', 'reporting'] },
    }),
    compact: true,
  },
};

export const HighRisk: Story = {
  args: {
    safety: makeSafety({
      riskLevel: 'high',
      reversible: false,
      blastRadius: {
        scope: 'org',
        affectedSystems: ['prod-db', 'cdn', 'auth-service'],
        downstreamEffects: 'All reads will fail until replica is restarted.',
      },
      requiresConfirmation: true,
    }),
    compact: true,
  },
};

export const CriticalRisk: Story = {
  args: {
    safety: makeSafety({
      riskLevel: 'critical',
      reversible: false,
      blastRadius: {
        scope: 'global',
        affectedSystems: ['prod-db', 'cdn', 'auth-service', 'payment-gateway'],
        estimatedImpact: 'Full service outage for ~2 hours.',
      },
      requiresConfirmation: true,
      confirmationDelay: 3000,
    }),
    compact: true,
  },
};

export const Expanded: Story = {
  args: {
    safety: makeSafety({
      riskLevel: 'high',
      reversible: false,
      blastRadius: {
        scope: 'org',
        affectedSystems: ['prod-db', 'cdn', 'auth-service'],
      },
      requiresConfirmation: true,
      explanation: 'This action restarts the primary database — all active connections will be dropped.',
    }),
    compact: false,
  },
};

export const AllVariants: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
      {(['low', 'medium', 'high', 'critical'] as const).map((riskLevel) => (
        <BlastRadiusBadge
          key={riskLevel}
          safety={makeSafety({ riskLevel })}
          compact={true}
        />
      ))}
    </div>
  ),
};
