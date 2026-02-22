import { v4 as uuid } from 'uuid';
import type { IntentPayloadInput } from '@hari/core';
// ─────────────────────────────────────────────────────────────────────────────
// CloudOps scenario: "The database is lagging"
//
// The agent has 81% confidence in its diagnostic — it's fairly sure the issue
// is replica lag, but it isn't certain whether the user wants to target the
// Primary or the Replica.  It surfaces a single_select control to resolve this
// before recommending the "Restart" action (critical blast radius).
// ─────────────────────────────────────────────────────────────────────────────

const now = new Date().toISOString();

export const cloudopsIntent: IntentPayloadInput = {
  version: '1.0.0',
  intentId: uuid(),
  type: 'diagnostic_overview',
  domain: 'cloudops',
  primaryGoal: 'Diagnose and resolve database replication lag',
  confidence: 0.81,
  density: 'operator',
  explain: true,
  layoutHint: 'dashboard',
  priorityFields: ['replication_lag', 'connections', 'cpu'],

  ambiguities: [
    {
      type: 'single_select',
      id: 'target_instance',
      label: 'Target instance',
      description: 'Which database instance do you want to inspect and act on?',
      options: [
        { value: 'replica', label: 'Replica (recommended)', description: 'Read replica showing lag' },
        { value: 'primary', label: 'Primary',               description: 'Primary writer instance' },
      ],
      value: 'replica',
      parameterKey: 'target.instanceType',
    },
    {
      type: 'multi_select',
      id: 'alert_channels',
      label: 'Notify on action',
      description: 'Which channels should receive a notification if you restart the instance?',
      options: [
        { value: 'slack',  label: 'Slack' },
        { value: 'email',  label: 'Email' },
        { value: 'pagerduty', label: 'PagerDuty' },
      ],
      value: ['slack'],
      parameterKey: 'notifications.channels',
    },
  ],

  data: {
    metrics: [
      {
        id: 'replication_lag',
        label: 'Replication Lag',
        value: 4.2,
        unit: 's',
        trend: 'up',
        status: 'critical',
        sparkline: [0.1, 0.2, 0.3, 0.8, 1.4, 2.1, 3.5, 4.2],
        sampledAt: now,
        percentileRank: 98,
      },
      {
        id: 'connections',
        label: 'Active Connections',
        value: 287,
        unit: '',
        trend: 'up',
        status: 'warning',
        sparkline: [120, 145, 160, 190, 220, 255, 270, 287],
        sampledAt: now,
        percentileRank: 87,
      },
      {
        id: 'cpu',
        label: 'CPU Utilisation',
        value: '62',
        unit: '%',
        trend: 'stable',
        status: 'warning',
        sparkline: [55, 58, 60, 63, 61, 64, 62, 62],
        sampledAt: now,
        percentileRank: 71,
      },
      {
        id: 'iops',
        label: 'IOPS',
        value: 3840,
        unit: '',
        trend: 'stable',
        status: 'normal',
        sparkline: [3200, 3400, 3600, 3750, 3800, 3820, 3840, 3840],
        sampledAt: now,
        percentileRank: 45,
      },
    ],
  },

  actions: [
    {
      id: 'restart_replica',
      label: 'Restart Replica',
      variant: 'destructive',
      safety: {
        confidence: 0.84,
        reversible: true,
        riskLevel: 'high',
        requiresConfirmation: true,
        confirmationDelay: 2000,
        explanation:
          'Restarting the replica will clear the lag immediately. Read traffic will fail over to the primary for ~50 ms.',
        blastRadius: {
          scope: 'team',
          affectedSystems: ['db-replica-1', 'read-api', 'analytics-service'],
          downstreamEffects: 'Analytics dashboards may show stale data for up to 60 s.',
          estimatedImpact: '~50 ms read-query latency spike during failover.',
        },
      },
    },
    {
      id: 'view_slow_queries',
      label: 'View Slow Queries',
      variant: 'secondary',
      safety: {
        confidence: 0.99,
        reversible: true,
        riskLevel: 'low',
        requiresConfirmation: false,
      },
    },
    {
      id: 'scale_replica',
      label: 'Scale Up Replica',
      variant: 'primary',
      safety: {
        confidence: 0.76,
        reversible: true,
        cost: 120,
        currency: '$',
        riskLevel: 'medium',
        requiresConfirmation: true,
        explanation: 'Upgrade to db.r6g.2xlarge adds $120/day but should absorb the current connection load.',
        blastRadius: {
          scope: 'org',
          affectedSystems: ['db-replica-1', 'billing'],
          downstreamEffects: 'Instance will restart during resize (~2 min downtime).',
          estimatedImpact: '~2 min read unavailability during resize.',
        },
      },
    },
  ],

  explainability: {
    overview: {
      elementId: 'overview',
      summary:
        'Replication lag spiked 40× above baseline in the last 8 minutes, correlated with a surge in active connections. Root cause is likely a long-running analytics query holding a lock on the replica.',
      dataSources: [
        { name: 'CloudWatch Metrics MCP', type: 'mcp',      freshness: now, reliability: 0.99 },
        { name: 'RDS Performance Insights', type: 'api',    freshness: now, reliability: 0.97 },
        { name: 'Historical Baseline DB',   type: 'database', freshness: '2025-01-01T00:00:00Z', reliability: 0.95 },
      ],
      assumptions: [
        'Lag threshold considered critical: > 1 s',
        'Connection surge defined as > 200% of 7-day average',
        'No maintenance window active',
      ],
      confidenceRange: { low: 0.68, high: 0.91 },
      alternativesConsidered: [
        {
          description: 'Kill the long-running query directly',
          reason: 'Query owner unknown; killing may corrupt an in-progress report. Restart is safer.',
        },
        {
          description: 'Add a read replica',
          reason: 'Provisioning takes ~8 min; immediate action required.',
        },
      ],
      whatIfQueries: [
        'What if I scale the replica instead?',
        'Show me the slowest queries right now',
        'What happens if I do nothing for 10 min?',
      ],
    },
  },
};
