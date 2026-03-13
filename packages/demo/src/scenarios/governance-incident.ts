import { v4 as uuid } from 'uuid';
import type { IntentPayloadInput } from '@hari/core';
import type {
  SituationalView,
  QuestionIntent,
  AuthorityContext,
  GovernedAction,
  DecisionRecord,
  TemporalLens,
  UncertaintySummary,
} from '@hari/core';

// ─────────────────────────────────────────────────────────────────────────────
// Governance Demo Scenario: "Database replica lag — governed incident response"
//
// This scenario exercises all v0.3 governance and perception components:
//   - SituationalView with scope, confidence, expiry
//   - QuestionIntent with follow-ups and limitations
//   - AuthorityContext at 'intervene' level
//   - GovernedActions with preconditions and reversibility
//   - DecisionRecords (audit trail)
//   - TemporalLens (before/now/after)
//   - UncertaintySummary with assumptions and unknowns
//
// This is the same "database lag" scenario from cloudops, but wrapped in full
// HARI governance context — demonstrating how a known scenario transforms
// when rendered through the perception runtime.
// ─────────────────────────────────────────────────────────────────────────────

const now = new Date().toISOString();
const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
const inTenMin = new Date(Date.now() + 10 * 60 * 1000).toISOString();

// ── Intent payload (the render contract inside the SituationalView) ─────────

export const governanceRenderContract: IntentPayloadInput = {
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
        confirmationDelay: 3000,
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
        explanation:
          'Upgrade to db.r6g.2xlarge adds $120/day but should absorb the current connection load.',
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
        'Replication lag spiked 40× above baseline in the last 8 minutes, correlated with a surge in active connections.',
      dataSources: [
        { name: 'CloudWatch Metrics MCP', type: 'mcp', freshness: now, reliability: 0.99 },
        { name: 'RDS Performance Insights', type: 'api', freshness: now, reliability: 0.97 },
      ],
      assumptions: [
        'Lag threshold considered critical: > 1 s',
        'Connection surge defined as > 200% of 7-day average',
      ],
      confidenceRange: { low: 0.68, high: 0.91 },
      alternativesConsidered: [
        {
          description: 'Kill the long-running query directly',
          reason: 'Query owner unknown; killing may corrupt an in-progress report.',
        },
      ],
      whatIfQueries: [
        'What if I scale the replica instead?',
        'What happens if I do nothing for 10 min?',
      ],
    },
  },
};

// ── QuestionIntent ──────────────────────────────────────────────────────────

const questionId = uuid();

export const governanceQuestion: QuestionIntent = {
  questionId,
  question: 'Why is the database replica lagging and what should I do about it?',
  origin: 'system_triggered',
  urgency: 'urgent',
  domain: 'cloudops',
  askedAt: tenMinAgo,
  sufficiencyStatement:
    'This view shows the root cause (connection surge → lock contention → replication lag) and two remediation paths with impact analysis.',
  limitations: [
    'Cannot identify the specific blocking query without pg_stat_activity access',
    'Cost projection for Scale Up assumes current pricing tier',
    'No correlation data with recent deployments (deploy history unavailable)',
  ],
  suggestedFollowUps: [
    {
      question: 'Show me the slow queries on the replica right now',
      rationale: 'Identifying the specific blocking query would increase confidence from 81% to ~95%',
    },
    {
      question: 'What happened in the last 3 deployments?',
      rationale: 'A recent schema migration could be the root cause of the lock',
    },
    {
      question: 'What is the historical pattern of lag spikes?',
      rationale: 'Recurring lag might indicate a systemic issue rather than an incident',
    },
  ],
};

// ── AuthorityContext ────────────────────────────────────────────────────────

export const governanceAuthority: AuthorityContext = {
  currentMode: 'intervene',
  holderId: 'sre-alice',
  holderName: 'Alice (SRE On-Call)',
  enteredAt: fiveMinAgo,
  expiresAt: inTenMin,
  reason: 'incident_response',
  justification: 'SRE on-call responding to page DB-4521',
  escalationHistory: [
    {
      from: 'observe',
      to: 'intervene',
      timestamp: fiveMinAgo,
      reason: 'incident_response',
      justification: 'Replication lag exceeded SLO threshold',
    },
  ],
};

// ── GovernedActions ─────────────────────────────────────────────────────────

export const governanceActions: GovernedAction[] = [
  {
    action: {
      id: 'restart_replica',
      label: 'Restart Replica',
      variant: 'destructive',
      disabled: false,
      safety: {
        confidence: 0.84,
        reversible: true,
        riskLevel: 'high',
        requiresConfirmation: true,
        confirmationDelay: 3000,
        explanation:
          'Restarting the replica will clear the lag. Read traffic fails over to primary for ~50 ms.',
        blastRadius: {
          scope: 'team',
          affectedSystems: ['db-replica-1', 'read-api', 'analytics-service'],
          downstreamEffects: 'Analytics dashboards may show stale data for up to 60 s.',
          estimatedImpact: '~50 ms read-query latency spike.',
        },
      },
    },
    intent: 'Immediately clear replication lag by restarting the lagging replica instance',
    impactScope: {
      scope: 'team',
      affectedSystems: ['db-replica-1', 'read-api', 'analytics-service'],
      downstreamEffects: 'Analytics dashboards stale for ~60s; read latency spike ~50ms',
    },
    reversibility: 'fully_reversible',
    requiredAuthority: 'intervene',
    actionConfidence: 0.84,
    preconditions: [
      {
        description: 'Primary instance is healthy and can absorb read traffic',
        status: 'met',
      },
      {
        description: 'No active maintenance window on the replica',
        status: 'met',
      },
      {
        description: 'Analytics batch job is not currently running',
        status: 'unknown',
        resolution: 'Check analytics scheduler — if batch is running, defer restart 15 min',
      },
    ],
    alternatives: [
      {
        description: 'Kill the blocking query directly',
        rejectionReason: 'Query owner unknown; killing may corrupt an in-progress ETL job',
      },
      {
        description: 'Add a second read replica',
        rejectionReason: 'Provisioning takes ~8 min; situation requires immediate action',
      },
    ],
    tags: ['incident', 'database', 'remediation'],
  },
  {
    action: {
      id: 'scale_replica',
      label: 'Scale Up Replica',
      variant: 'primary',
      disabled: false,
      safety: {
        confidence: 0.76,
        reversible: true,
        cost: 120,
        currency: '$',
        riskLevel: 'medium',
        requiresConfirmation: true,
        explanation: 'Upgrade to db.r6g.2xlarge — $120/day increase.',
        blastRadius: {
          scope: 'org',
          affectedSystems: ['db-replica-1', 'billing'],
          downstreamEffects: '~2 min downtime during resize.',
          estimatedImpact: '~2 min read unavailability.',
        },
      },
    },
    intent: 'Scale the replica to handle increased connection load without restart',
    impactScope: {
      scope: 'org',
      affectedSystems: ['db-replica-1', 'billing', 'cost-center-platform'],
      downstreamEffects: '~2 min downtime; +$120/day cost increase',
    },
    reversibility: 'partially_reversible',
    requiredAuthority: 'approve',
    actionConfidence: 0.76,
    preconditions: [
      {
        description: 'Budget approval for $120/day increase',
        status: 'unmet',
        resolution: 'Requires finance team approval or manager override',
      },
      {
        description: 'Target instance class available in current AZ',
        status: 'met',
      },
    ],
    alternatives: [
      {
        description: 'Restart instead of scaling',
        rejectionReason: 'Restart only treats the symptom; if load persists, lag will return',
      },
    ],
    tags: ['incident', 'database', 'scaling'],
  },
];

// ── DecisionRecords (prior audit trail) ─────────────────────────────────────

export const governanceDecisionRecords: DecisionRecord[] = [
  {
    decisionId: uuid(),
    governedActionId: 'restart_replica',
    outcome: 'deferred',
    decidedAt: 'observe',
    deciderId: 'sre-alice',
    timestamp: tenMinAgo,
    rationale: 'Waiting for more data — lag may self-resolve',
    deliberationTimeMs: 45000,
  },
];

// ── TemporalLens ────────────────────────────────────────────────────────────

export const governanceTemporalLens: TemporalLens = {
  activeLens: 'now',
  availableLenses: ['before', 'now', 'after'],
  annotations: {
    before: [
      {
        elementId: 'replication_lag',
        changeType: 'modified',
        previousValue: '0.1s (baseline)',
        currentValue: '4.2s (critical)',
        causalFactors: ['Connection surge at 14:32 UTC', 'Long-running analytics query'],
      },
      {
        elementId: 'connections',
        changeType: 'modified',
        previousValue: '120 (normal)',
        currentValue: '287 (elevated)',
        causalFactors: ['Analytics batch started at 14:30 UTC'],
      },
    ],
    now: [
      {
        elementId: 'replication_lag',
        changeType: 'modified',
        currentValue: '4.2s — 40× above baseline',
        causalFactors: ['Active lock contention on replica'],
      },
    ],
    after: [
      {
        elementId: 'replication_lag',
        changeType: 'projected',
        currentValue: '4.2s',
        projectedValue: '< 0.5s within 2 min (if restarted)',
        projectionConfidence: 0.84,
        causalFactors: ['Based on 3 prior restart events'],
      },
      {
        elementId: 'connections',
        changeType: 'projected',
        currentValue: '287',
        projectedValue: '~150 (post-restart, batch completes)',
        projectionConfidence: 0.72,
        causalFactors: [],
      },
    ],
  },
  referencePoints: {
    beforeTimestamp: tenMinAgo,
    afterHorizon: 'PT10M',
  },
  changeSummary: {
    whatChanged: 'Replication lag spiked 40× after connection surge at 14:32 UTC',
    whatWillHappen: 'Lag should drop below 0.5s within 2 min if replica is restarted',
  },
};

// ── UncertaintySummary ──────────────────────────────────────────────────────

export const governanceUncertainty: UncertaintySummary = {
  overallConfidence: 0.81,
  knownUnknowns: [
    'Identity of the blocking query',
    'Whether analytics batch job is currently running',
    'Correlation with recent deployments',
  ],
  assumptions: [
    { assumption: 'Primary instance can absorb failover traffic', criticality: 'high' },
    { assumption: 'No schema migration is in progress', criticality: 'medium' },
    { assumption: 'Current pricing tier applies to scale-up cost', criticality: 'low' },
  ],
  indicators: [
    {
      elementId: 'replication_lag',
      type: 'source',
      confidence: 0.99,
      valueOrigin: 'measured',
      dataAge: {
        lastUpdated: now,
        isStale: false,
      },
    },
    {
      elementId: 'connections',
      type: 'source',
      confidence: 0.97,
      valueOrigin: 'measured',
      dataAge: {
        lastUpdated: now,
        isStale: false,
      },
    },
    {
      elementId: 'root_cause',
      type: 'epistemic',
      confidence: 0.72,
      confidenceInterval: { low: 0.58, high: 0.85, level: 0.95 },
      valueOrigin: 'estimated',
      dataAge: {
        lastUpdated: tenMinAgo,
        isStale: false,
      },
    },
  ],
  unknownElements: ['blocking_query_id', 'batch_job_status', 'recent_deployments'],
  lowConfidenceCount: 1,
};

// ── SituationalView (top-level orchestrator data) ───────────────────────────

const situationId = uuid();

export const governanceSituationalView: SituationalView = {
  situationId,
  question: 'Why is the database replica lagging and what should I do about it?',
  answerSummary:
    'Replication lag spiked 40× due to connection surge and lock contention. Two remediation paths available: restart (fast, reversible) or scale (slower, costlier).',
  scope: {
    systems: ['db-replica-1', 'read-api', 'analytics-service', 'billing'],
    timeWindow: 'PT30M',
    riskLevel: 'high',
    orgScope: 'team',
  },
  confidence: 0.81,
  unknowns: [
    'Blocking query identity',
    'Analytics batch job status',
    'Correlation with recent deployments',
  ],
  assumptions: [
    'Primary can absorb failover read traffic',
    'No schema migration in progress',
  ],
  generatedAt: fiveMinAgo,
  expiresAt: inTenMin,
  status: 'active',
  priority: 85,
  tags: ['incident', 'database', 'replication', 'sre'],
  renderContract: governanceRenderContract as any,
};
