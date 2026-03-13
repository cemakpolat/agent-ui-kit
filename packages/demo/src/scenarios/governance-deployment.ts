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
// Governance Demo Scenario: "Deployment Approval Workflow — Multi-Stage Review"
//
// A platform team proposes a production release of a new checkout service.
// The release requires staged sign-off: QA → Security → Platform Lead → Release.
// This scenario exercises:
//   - Multi-stage preconditions (each stage gates the next)
//   - Approve authority requirement with escalation path
//   - Partially reversible actions (canary rollback possible, full rollback costly)
//   - Multi-component blast radius
//   - Deliberation checkpoints and mandatory review delays
// ─────────────────────────────────────────────────────────────────────────────

const now = new Date().toISOString();
const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
const inThirtyMin = new Date(Date.now() + 30 * 60 * 1000).toISOString();
const inTwoHours = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

// ── Intent payload (render contract) ──────────────────────────────────────────

export const deploymentRenderContract: IntentPayloadInput = {
  version: '1.0.0',
  intentId: uuid(),
  type: 'workflow',
  domain: 'deployment',
  primaryGoal: 'Multi-stage approval for checkout-service v2.4.0 production release',
  confidence: 0.88,
  density: 'operator',
  explain: true,
  layoutHint: 'timeline',
  priorityFields: ['stage', 'approvers', 'risk'],

  data: {
    title: 'Checkout Service v2.4.0 — Production Release',
    steps: [
      {
        id: 'stage-qa',
        title: 'QA Sign-Off',
        status: 'completed',
        type: 'review',
        reviewItems: [
          { label: 'Test Coverage', value: '94%', highlight: true },
          { label: 'Regression', value: '< 2% on p99' },
          { label: 'Tests Passed', value: '847 / 847' },
        ],
      },
      {
        id: 'stage-security',
        title: 'Security Review',
        status: 'in_progress',
        type: 'review',
        reviewItems: [
          { label: 'SAST Scan', value: 'Complete' },
          { label: 'CVEs Found', value: '2 medium', highlight: true },
          { label: 'Status', value: 'Under review' },
        ],
      },
      {
        id: 'stage-platform',
        title: 'Platform Lead Approval',
        status: 'pending',
        type: 'confirmation',
        content: 'Ready for platform lead sign-off. CVEs are in disabled module.',
      },
      {
        id: 'stage-release',
        title: 'Release Gate',
        status: 'pending',
        type: 'confirmation',
        content: 'Final release gate approval.',
      },
    ],
    metrics: [
      {
        id: 'test_coverage',
        label: 'Test Coverage',
        value: 94,
        unit: '%',
        trend: 'up',
        status: 'healthy',
        sparkline: [88, 89, 90, 91, 92, 93, 94, 94],
        sampledAt: now,
        percentileRank: 91,
      },
      {
        id: 'canary_error_rate',
        label: 'Canary Error Rate',
        value: 0.04,
        unit: '%',
        trend: 'stable',
        status: 'healthy',
        sparkline: [0.05, 0.04, 0.04, 0.05, 0.04, 0.04, 0.04, 0.04],
        sampledAt: now,
        percentileRank: 12,
      },
      {
        id: 'p99_latency',
        label: 'p99 Latency (canary)',
        value: 142,
        unit: 'ms',
        trend: 'stable',
        status: 'warning',
        sparkline: [128, 131, 135, 140, 138, 143, 141, 142],
        sampledAt: now,
        percentileRank: 68,
      },
    ],
  },

  actions: [
    {
      id: 'approve_security_stage',
      label: 'Approve Security Stage',
      variant: 'primary',
      safety: {
        confidence: 0.88,
        reversible: true,
        riskLevel: 'medium',
        requiresConfirmation: true,
        confirmationDelay: 2000,
        explanation:
          'The 2 medium CVEs in the dependency tree are in an optional analytics module not active in production. Approving clears path for Platform Lead review.',
        blastRadius: {
          scope: 'team',
          affectedSystems: ['checkout-service', 'payment-api', 'order-service'],
          downstreamEffects: 'None at this stage — canary deployment gates actual traffic.',
          estimatedImpact: 'Approval allows workflow to advance; no production change yet.',
        },
      },
    },
    {
      id: 'request_security_exception',
      label: 'Request CVE Exception',
      variant: 'secondary',
      safety: {
        confidence: 0.71,
        reversible: true,
        riskLevel: 'low',
        requiresConfirmation: false,
        explanation:
          'Creates a tracked exception for the 2 medium CVEs with a 30-day remediation deadline.',
      },
    },
    {
      id: 'rollback_canary',
      label: 'Rollback Canary',
      variant: 'destructive',
      safety: {
        confidence: 0.95,
        reversible: true,
        riskLevel: 'low',
        requiresConfirmation: true,
        confirmationDelay: 1000,
        explanation: 'Rolls back canary slice to v2.3.1. No user-facing impact.',
      },
    },
  ],

  explainability: {
    overview: {
      elementId: 'overview',
      summary:
        'checkout-service v2.4.0 passed QA with 94% coverage. Security review is 70% complete — 2 medium CVEs in an inactive analytics dependency are under review. Canary is healthy at 0.04% error rate.',
      dataSources: [
        { name: 'CI/CD Pipeline', type: 'api', freshness: now, reliability: 0.99 },
        { name: 'SAST Scanner', type: 'api', freshness: thirtyMinAgo, reliability: 0.96 },
        { name: 'Canary Metrics', type: 'api', freshness: now, reliability: 0.98 },
      ],
      assumptions: [
        'The 2 CVEs are in the analytics module, which is disabled in production',
        'Canary at 5% traffic is representative of production load distribution',
      ],
      confidenceRange: { low: 0.76, high: 0.95 },
      alternativesConsidered: [
        {
          description: 'Hold release until CVEs are patched upstream',
          reason: 'Upstream patch ETA is 14 days; release window closes in 48h',
        },
        {
          description: 'Strip the analytics module and rebuild',
          reason: 'Rebuild would add 6h CI time and invalidate QA sign-off',
        },
      ],
      whatIfQueries: [
        'What if we deploy only the payment changes and defer checkout?',
        'What happens if canary error rate exceeds 0.1%?',
      ],
    },
  },
};

// ── QuestionIntent ─────────────────────────────────────────────────────────

const questionId = uuid();

export const deploymentQuestion: QuestionIntent = {
  questionId,
  question: 'Should checkout-service v2.4.0 proceed to production, and what are the risks?',
  origin: 'human_explicit',
  urgency: 'urgent',
  domain: 'deployment',
  askedAt: thirtyMinAgo,
  sufficiencyStatement:
    'This view covers the current stage status, canary metrics, CVE risk assessment, and 3 action paths (approve, exception, rollback).',
  limitations: [
    'CVE impact assessment relies on module-level analysis — a runtime exploit path is not fully ruled out',
    'Canary traffic (5%) may not surface low-frequency edge cases',
    'Downstream service compatibility with v2.4.0 API changes not fully verified',
  ],
  suggestedFollowUps: [
    {
      question: 'Show me the specific CVEs and their CVSS scores',
      rationale: 'Understanding CVE severity would allow a more informed exception decision',
    },
    {
      question: 'What API changes does v2.4.0 introduce?',
      rationale: 'Downstream services may need coordination before full rollout',
    },
    {
      question: 'What was the incident rate for the previous 3 releases?',
      rationale: 'Historical deployment risk would contextualize the current confidence score',
    },
  ],
};

// ── AuthorityContext ──────────────────────────────────────────────────────

export const deploymentAuthority: AuthorityContext = {
  currentMode: 'approve',
  holderId: 'security-alice',
  holderName: 'Alice (Security Lead)',
  enteredAt: thirtyMinAgo,
  expiresAt: inTwoHours,
  reason: 'approval_request',
  justification: 'Security review sign-off for release CHKOUT-240',
  escalationHistory: [
    {
      from: 'observe',
      to: 'approve',
      timestamp: thirtyMinAgo,
      reason: 'approval_request',
      justification: 'Release manager assigned security review slot',
    },
  ],
};

// ── GovernedActions ────────────────────────────────────────────────────────

export const deploymentActions: GovernedAction[] = [
  {
    action: {
      id: 'approve_security_stage',
      label: 'Approve Security Stage',
      variant: 'primary',
      disabled: false,
      safety: {
        confidence: 0.88,
        reversible: true,
        riskLevel: 'medium',
        requiresConfirmation: true,
        confirmationDelay: 2000,
        explanation:
          'CVEs are in disabled production module. Approving clears path for Platform Lead review.',
        blastRadius: {
          scope: 'team',
          affectedSystems: ['checkout-service', 'payment-api'],
          downstreamEffects: 'No production change at this stage.',
          estimatedImpact: 'Workflow advances to Platform Lead stage.',
        },
      },
    },
    intent: 'Clear the security review gate, advancing the release to Platform Lead approval',
    impactScope: {
      scope: 'team',
      affectedSystems: ['checkout-service', 'payment-api', 'order-service'],
      downstreamEffects: 'Workflow advances; canary remains active at 5% traffic',
    },
    reversibility: 'fully_reversible',
    requiredAuthority: 'approve',
    actionConfidence: 0.88,
    preconditions: [
      {
        description: 'SAST scan completed with no critical CVEs',
        status: 'met',
      },
      {
        description: 'Medium CVEs are confirmed to be in a disabled production module',
        status: 'met',
      },
      {
        description: 'CVE exception ticket has been created with 30-day remediation deadline',
        status: 'unmet',
        resolution: 'Create exception ticket in security tracker before approving, or use "Request CVE Exception" action',
      },
      {
        description: 'QA stage is fully signed off',
        status: 'met',
      },
    ],
    alternatives: [
      {
        description: 'Hold until CVEs are patched upstream',
        rejectionReason: 'Upstream patch ETA 14 days; release window closes in 48h',
      },
      {
        description: 'Strip the analytics module and rebuild',
        rejectionReason: 'Rebuild invalidates QA sign-off and adds 6h CI time',
      },
    ],
    tags: ['deployment', 'security', 'approval', 'release'],
  },
  {
    action: {
      id: 'request_security_exception',
      label: 'Request CVE Exception',
      variant: 'secondary',
      disabled: false,
      safety: {
        confidence: 0.92,
        reversible: true,
        riskLevel: 'low',
        requiresConfirmation: false,
        explanation: 'Creates exception ticket with 30-day remediation window. Does not advance workflow alone.',
      },
    },
    intent: 'Create a tracked exception for the 2 medium CVEs to allow workflow to proceed',
    impactScope: {
      scope: 'team',
      affectedSystems: ['security-tracker'],
      downstreamEffects: 'Exception will appear on monthly security review dashboard',
    },
    reversibility: 'fully_reversible',
    requiredAuthority: 'intervene',
    actionConfidence: 0.92,
    preconditions: [
      {
        description: 'CVEs have been reviewed and categorized',
        status: 'met',
      },
    ],
    alternatives: [],
    tags: ['deployment', 'security', 'exception'],
  },
  {
    action: {
      id: 'rollback_canary',
      label: 'Rollback Canary to v2.3.1',
      variant: 'destructive',
      disabled: false,
      safety: {
        confidence: 0.97,
        reversible: true,
        riskLevel: 'low',
        requiresConfirmation: true,
        confirmationDelay: 1000,
        explanation: 'Rolls back the 5% canary slice to v2.3.1. No user-visible impact.',
        blastRadius: {
          scope: 'team',
          affectedSystems: ['checkout-service-canary'],
          downstreamEffects: 'Canary metrics reset to baseline.',
          estimatedImpact: '< 0.1% of checkout traffic affected for ~15s.',
        },
      },
    },
    intent: 'Abort the v2.4.0 canary and return all traffic to v2.3.1 while issues are resolved',
    impactScope: {
      scope: 'team',
      affectedSystems: ['checkout-service', 'load-balancer'],
      downstreamEffects: '5% canary traffic returns to v2.3.1',
    },
    reversibility: 'fully_reversible',
    requiredAuthority: 'intervene',
    actionConfidence: 0.97,
    preconditions: [
      {
        description: 'v2.3.1 image is available in production registry',
        status: 'met',
      },
    ],
    alternatives: [],
    tags: ['deployment', 'rollback', 'canary'],
  },
];

// ── DecisionRecords (prior audit trail) ───────────────────────────────────

export const deploymentDecisionRecords: DecisionRecord[] = [
  {
    decisionId: uuid(),
    governedActionId: 'qa_sign_off',
    outcome: 'approved',
    decidedAt: 'approve',
    deciderId: 'qa-team-lead',
    timestamp: twoHoursAgo,
    rationale: 'All 847 tests passed. p99 regression < 2% is within acceptable bounds for this release.',
    deliberationTimeMs: 18 * 60 * 1000,
  },
];

// ── TemporalLens ──────────────────────────────────────────────────────────

export const deploymentTemporalLens: TemporalLens = {
  activeLens: 'now',
  availableLenses: ['before', 'now', 'after'],
  annotations: {
    before: [
      {
        elementId: 'test_coverage',
        changeType: 'modified',
        previousValue: '88% (v2.3.1)',
        currentValue: '94% (v2.4.0)',
        causalFactors: ['New test suite for payment retry logic', 'Removed dead code paths'],
      },
      {
        elementId: 'stage-qa',
        changeType: 'added',
        currentValue: 'Completed (2h ago)',
        causalFactors: ['All automated tests green', 'Manual smoke test passed'],
      },
    ],
    now: [
      {
        elementId: 'stage-security',
        changeType: 'modified',
        currentValue: 'In progress — 2 medium CVEs under review',
        causalFactors: ['SAST scan found CVEs in analytics dependency'],
      },
      {
        elementId: 'canary_error_rate',
        changeType: 'modified',
        currentValue: '0.04% (healthy)',
        causalFactors: ['v2.4.0 canary running for 30 min at 5% traffic'],
      },
    ],
    after: [
      {
        elementId: 'canary_error_rate',
        changeType: 'projected',
        currentValue: '0.04%',
        projectedValue: '0.04% (no expected change on full rollout)',
        projectionConfidence: 0.82,
        causalFactors: ['Canary metrics stable across traffic shape variation'],
      },
      {
        elementId: 'p99_latency',
        changeType: 'projected',
        currentValue: '142ms',
        projectedValue: '138–148ms on full rollout (within SLO)',
        projectionConfidence: 0.74,
        causalFactors: ['New async processing path reduces tail latency under load'],
      },
    ],
  },
  referencePoints: {
    beforeTimestamp: twoHoursAgo,
    afterHorizon: 'PT2H',
  },
  changeSummary: {
    whatChanged: 'QA passed. Security review in progress. Canary healthy at 5% traffic.',
    whatWillHappen: 'If approved: full production rollout over 2h. Error rate expected stable.',
  },
};

// ── UncertaintySummary ────────────────────────────────────────────────────

export const deploymentUncertainty: UncertaintySummary = {
  overallConfidence: 0.88,
  knownUnknowns: [
    'Whether the 2 medium CVEs have any exploitable path in production configuration',
    'Downstream service compatibility with v2.4.0 API schema changes',
    'Long-tail latency behaviour at 100% traffic vs. 5% canary',
  ],
  assumptions: [
    { assumption: 'Analytics module is disabled in production Helm values', criticality: 'high' },
    { assumption: 'Canary traffic distribution is representative of production', criticality: 'medium' },
    { assumption: 'No downstream services have pinned the old API schema', criticality: 'medium' },
  ],
  indicators: [
    {
      elementId: 'test_coverage',
      type: 'source',
      confidence: 0.99,
      valueOrigin: 'measured',
      dataAge: { lastUpdated: twoHoursAgo, isStale: false },
    },
    {
      elementId: 'canary_error_rate',
      type: 'source',
      confidence: 0.98,
      valueOrigin: 'measured',
      dataAge: { lastUpdated: now, isStale: false },
    },
    {
      elementId: 'cve_production_impact',
      type: 'epistemic',
      confidence: 0.71,
      confidenceInterval: { low: 0.55, high: 0.85, level: 0.9 },
      valueOrigin: 'estimated',
      dataAge: { lastUpdated: thirtyMinAgo, isStale: false },
    },
  ],
  unknownElements: ['cve_runtime_exploitability', 'downstream_api_compatibility'],
  lowConfidenceCount: 1,
};

// ── SituationalView ───────────────────────────────────────────────────────

const situationId = uuid();

export const deploymentSituationalView: SituationalView = {
  situationId,
  question: 'Should checkout-service v2.4.0 proceed to production, and what are the risks?',
  answerSummary:
    'QA passed (94% coverage). Security review 70% complete — 2 medium CVEs in a disabled module. Canary healthy at 0.04% error rate. Awaiting Security Lead approval to gate the Platform Lead stage.',
  scope: {
    systems: ['checkout-service', 'payment-api', 'order-service', 'load-balancer'],
    timeWindow: 'PT2H',
    riskLevel: 'medium',
    orgScope: 'team',
  },
  confidence: 0.88,
  unknowns: [
    'CVE exploitability in production configuration',
    'Downstream API compatibility',
    'Long-tail latency at full traffic',
  ],
  assumptions: [
    'Analytics module is disabled in production',
    'Canary is representative of production load',
  ],
  generatedAt: thirtyMinAgo,
  expiresAt: inThirtyMin,
  status: 'active',
  priority: 72,
  tags: ['deployment', 'security', 'canary', 'checkout'],
  renderContract: deploymentRenderContract as any,
};
