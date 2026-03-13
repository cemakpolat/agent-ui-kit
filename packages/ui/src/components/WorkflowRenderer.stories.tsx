import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { WorkflowRenderer } from './WorkflowRenderer';
import { WorkflowDataSchema } from '@hari/core';

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
        ○ View Expired — approval window has closed. This workflow must be re-initiated.
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

const DEPLOY_WORKFLOW = WorkflowDataSchema.parse({
  title: 'Production Deployment Checklist',
  currentStepIndex: 1,
  allowSkipAhead: false,
  finishLabel: 'Approve Deploy',
  steps: [
    {
      id: 'preflight',
      title: 'Pre-flight Checks',
      icon: '✓',
      type: 'info',
      status: 'completed',
      content:
        'Automated checks passed:\n' +
        '• All tests green (CI #4821)\n' +
        '• Security scan: no critical CVEs\n' +
        '• Canary traffic: p99 < 180ms\n' +
        '• On-call engineer confirmed available',
    },
    {
      id: 'config-review',
      title: 'Configuration Review',
      icon: '⚙',
      type: 'form',
      status: 'in_progress',
      description: 'Confirm deployment parameters before proceeding.',
      fields: [
        {
          id: 'environment',
          type: 'select',
          label: 'Target Environment',
          required: true,
          options: [
            { value: 'staging',    label: 'Staging' },
            { value: 'production', label: 'Production' },
          ],
          defaultValue: 'production',
        },
        {
          id: 'strategy',
          type: 'select',
          label: 'Deploy Strategy',
          required: true,
          options: [
            { value: 'blue-green', label: 'Blue/Green (zero downtime)' },
            { value: 'canary',     label: 'Canary 10%' },
            { value: 'rolling',    label: 'Rolling' },
          ],
          defaultValue: 'blue-green',
        },
        {
          id: 'rollback_window',
          type: 'number',
          label: 'Rollback Window (minutes)',
          required: true,
          min: 15,
          max: 120,
          step: 15,
          defaultValue: 60,
          helpText: 'Minimum 15 minutes. Alarms will fire if SLO is breached.',
        },
        {
          id: 'notify_slack',
          type: 'checkbox',
          label: 'Post deploy notification to #platform-releases',
          defaultValue: true,
        },
      ],
    },
    {
      id: 'confirmation',
      title: 'Confirm Deployment',
      icon: '🚀',
      type: 'confirmation',
      status: 'pending',
      content:
        'You are about to promote v2.5.0 to production. ' +
        'This action is reversible within the rollback window. ' +
        'A governance audit record will be created with your identity and timestamp.',
    },
    {
      id: 'post-deploy',
      title: 'Post-Deploy Monitoring',
      icon: '📡',
      type: 'info',
      status: 'pending',
      content:
        'Automated monitoring will begin immediately after deployment. ' +
        'Dashboards: Datadog, Sentry. SLO alerts active for 2 hours post-deploy.',
    },
  ],
});

// High-uncertainty: incomplete pre-checks, missing context
const INCIDENT_WORKFLOW = WorkflowDataSchema.parse({
  title: 'Emergency Rollback — INC-2084',
  currentStepIndex: 0,
  allowSkipAhead: false,
  finishLabel: 'Initiate Rollback',
  steps: [
    {
      id: 'triage',
      title: 'Situation Assessment',
      icon: '🔍',
      type: 'info',
      status: 'in_progress',
      content:
        'AGENT UNCERTAINTY: The following checks could NOT be completed automatically.\n\n' +
        '⚠ Database failover state: UNKNOWN — monitoring system degraded\n' +
        '⚠ Downstream impact scope: UNVERIFIED — no live traffic data\n' +
        '⚠ Rollback target version: v2.4.2 (assumed — verify before proceeding)\n\n' +
        'Operator verification required before proceeding to rollback initiation.',
    },
    {
      id: 'rollback-target',
      title: 'Select Rollback Target',
      icon: '⏪',
      type: 'form',
      status: 'pending',
      description: 'Confirm the version to roll back to. Agent suggests v2.4.2 but this must be verified.',
      fields: [
        {
          id: 'target_version',
          type: 'select',
          label: 'Rollback Target Version',
          required: true,
          helpText: 'Agent assumes v2.4.2 was the last stable version. Verify before confirming.',
          options: [
            { value: 'v2.4.2', label: 'v2.4.2 (agent suggested — verify)' },
            { value: 'v2.4.1', label: 'v2.4.1' },
            { value: 'v2.4.0', label: 'v2.4.0' },
          ],
          defaultValue: 'v2.4.2',
        },
        {
          id: 'scope',
          type: 'select',
          label: 'Rollback Scope',
          required: true,
          options: [
            { value: 'full',    label: 'Full rollback (all regions)' },
            { value: 'partial', label: 'Partial (eu-west-1 only)' },
          ],
          defaultValue: 'full',
        },
      ],
    },
    {
      id: 'initiate',
      title: 'Initiate Rollback',
      icon: '⚡',
      type: 'confirmation',
      status: 'pending',
      content:
        'WARNING: This action cannot be fully automated due to monitoring system degradation. ' +
        'Operator must manually verify service health after rollback. ' +
        'A high-priority governance audit entry will be created.',
    },
  ],
});

// ─────────────────────────────────────────────────────────────────────────────
// Meta
// ─────────────────────────────────────────────────────────────────────────────

const meta: Meta<typeof WorkflowRenderer> = {
  title: 'Renderers/WorkflowRenderer',
  component: WorkflowRenderer,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Renders a multi-step guided process. Step types: **info** (instructions), ' +
          '**form** (structured input), **confirmation** (binary decision), **review** (summary). ' +
          'The component manages its own step index and accumulated form values.',
      },
    },
  },
};
export default meta;

type Story = StoryObj<typeof WorkflowRenderer>;

// ── Default ───────────────────────────────────────────────────────────────────

export const Default: Story = {
  name: 'Default',
  args: {
    data: DEPLOY_WORKFLOW,
    density: 'operator',
    onComplete: (values) => console.log('[HARI] Workflow complete:', values),
    onStepChange: (idx, id) => console.log('[HARI] Step change:', idx, id),
  },
  parameters: {
    docs: {
      description: {
        story:
          'Production deployment workflow at step 2 (Configuration Review). ' +
          'Operator density with sidebar step list.',
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
        confidence={0.29}
        unknowns={[
          'DB failover state unknown — monitoring degraded',
          'Impact scope unverified — no live traffic metrics',
          'Rollback target version assumed v2.4.2 (not confirmed)',
        ]}
      />
      <WorkflowRenderer {...args} />
    </div>
  ),
  args: {
    data: INCIDENT_WORKFLOW,
    density: 'operator',
    onComplete: (values) => console.log('[HARI] Emergency rollback approved:', values),
  },
  parameters: {
    docs: {
      description: {
        story:
          'Emergency rollback workflow under high uncertainty — confidence 29%. ' +
          'The workflow content itself surfaces the agent\'s gaps (marked ⚠). ' +
          'HARI doctrine: operator must verify before taking destructive action. ' +
          'The banner mirrors what <UncertaintyIndicators /> renders at view level.',
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
      <WorkflowRenderer {...args} />
    </div>
  ),
  args: {
    data: DEPLOY_WORKFLOW,
    density: 'operator',
  },
  parameters: {
    docs: {
      description: {
        story:
          'Approval window closed. This is particularly important for deployment workflows — ' +
          'a deploy approved 20 minutes ago may no longer be safe if system state has changed. ' +
          'HARI\'s expiresAt prevents stale approvals from being acted upon.',
      },
    },
  },
};

// ── Density variants ──────────────────────────────────────────────────────────

export const ExecutiveDensity: Story = {
  args: { data: DEPLOY_WORKFLOW, density: 'executive' },
};

export const ExpertDensity: Story = {
  args: { data: DEPLOY_WORKFLOW, density: 'expert' },
};
