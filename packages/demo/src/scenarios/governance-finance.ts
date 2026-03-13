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
// Governance Demo Scenario: "Finance Decision — High-Value Transaction Escalation"
//
// A $2.4M wire transfer to a new supplier is flagged by the fraud detection
// engine with confidence 0.73. The finance lead must decide whether to release,
// hold, or escalate to the CFO. This scenario exercises:
//   - Override authority requirement (> $1M threshold)
//   - Irreversible action with full deliberation enforcement
//   - Multi-approver precondition (CFO second sign-off)
//   - Fraud score surfacing and confidence acknowledgment
//   - Time pressure (supplier contract penalty at T+4h)
// ─────────────────────────────────────────────────────────────────────────────

const now = new Date().toISOString();
const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
const inFourHours = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();
const inThirtyMin = new Date(Date.now() + 30 * 60 * 1000).toISOString();

// ── Intent payload (render contract) ─────────────────────────────────────────

export const financeRenderContract: IntentPayloadInput = {
  version: '1.0.0',
  intentId: uuid(),
  type: 'diagnostic_overview',
  domain: 'finance',
  primaryGoal: 'Evaluate and resolve flagged high-value wire transfer TXN-882941',
  confidence: 0.73,
  density: 'operator',
  explain: true,
  layoutHint: 'dashboard',
  priorityFields: ['fraud_score', 'amount', 'deadline', 'supplier_status'],

  data: {
    metrics: [
      {
        id: 'fraud_score',
        label: 'Fraud Risk Score',
        value: 73,
        unit: '/100',
        trend: 'up',
        status: 'critical',
        sparkline: [20, 22, 25, 31, 40, 58, 67, 73],
        sampledAt: now,
        percentileRank: 89,
      },
      {
        id: 'transaction_amount',
        label: 'Transaction Amount',
        value: 2400000,
        unit: 'USD',
        trend: 'stable',
        status: 'warning',
        sparkline: [2400000],
        sampledAt: now,
        percentileRank: 99,
      },
      {
        id: 'supplier_history',
        label: 'Prior Payments to Supplier',
        value: 0,
        unit: 'payments',
        trend: 'stable',
        status: 'warning',
        sparkline: [0],
        sampledAt: now,
        percentileRank: 5,
      },
      {
        id: 'time_to_penalty',
        label: 'Time to Contract Penalty',
        value: 4.0,
        unit: 'h',
        trend: 'down',
        status: 'warning',
        sparkline: [8, 7, 6, 5.5, 5, 4.5, 4.2, 4.0],
        sampledAt: now,
        percentileRank: null as any,
      },
    ],
    summary: {
      transactionId: 'TXN-882941',
      beneficiary: 'Meridian Logistics AG',
      beneficiaryCountry: 'DE',
      beneficiaryIBAN: 'DE89 3704 0044 0532 0130 00',
      beneficiaryBIC: 'COBADEFFXXX',
      initiatedBy: 'procurement-lead',
      approvedByInitiator: true,
      poReference: 'PO-2025-00187',
      contractPenaltyAt: inFourHours,
      penaltyAmount: 48000,
    },
    fraudSignals: [
      { signal: 'New beneficiary — no prior payment history', weight: 0.35, triggered: true },
      { signal: 'Amount exceeds 5× median supplier payment ($480K)', weight: 0.28, triggered: true },
      { signal: 'Wire initiated outside business hours (23:00 local)', weight: 0.22, triggered: true },
      { signal: 'IBAN country matches known high-risk corridors', weight: 0.08, triggered: false },
      { signal: 'Beneficiary name matches known entity (Meridian registered 2019)', weight: 0.07, triggered: false },
    ],
  },

  actions: [
    {
      id: 'release_transaction',
      label: 'Release Transaction',
      variant: 'destructive',
      safety: {
        confidence: 0.60,
        reversible: false,
        riskLevel: 'critical',
        requiresConfirmation: true,
        confirmationDelay: 8000,
        explanation:
          'Releasing this transaction is irreversible once the wire clears (typically 15–60 min). If fraudulent, recovery probability is < 30%.',
        blastRadius: {
          scope: 'org',
          affectedSystems: ['treasury', 'banking-integration', 'accounts-payable'],
          downstreamEffects: 'Funds leave company account permanently within 60 min of release.',
          estimatedImpact: '$2,400,000 irreversibly transferred to Meridian Logistics AG.',
        },
      },
    },
    {
      id: 'hold_for_review',
      label: 'Hold for Manual Review',
      variant: 'primary',
      safety: {
        confidence: 0.94,
        reversible: true,
        riskLevel: 'low',
        requiresConfirmation: false,
        explanation:
          'Places transaction in pending state for up to 24h. Contract penalty of $48K applies if not released within 4h.',
      },
    },
    {
      id: 'escalate_to_cfo',
      label: 'Escalate to CFO',
      variant: 'secondary',
      safety: {
        confidence: 0.97,
        reversible: true,
        riskLevel: 'low',
        requiresConfirmation: false,
        explanation: 'Routes transaction for CFO second approval. Required for transactions > $1M per policy.',
      },
    },
  ],

  explainability: {
    overview: {
      elementId: 'overview',
      summary:
        'TXN-882941 is a $2.4M wire to Meridian Logistics AG — a first-time beneficiary. Three fraud signals triggered: new beneficiary, amount 5× median, and off-hours initiation. Fraud score: 73/100 (high risk). A $48K contract penalty applies in 4 hours if not released.',
      dataSources: [
        { name: 'Fraud Detection Engine v3', type: 'api', freshness: now, reliability: 0.91 },
        { name: 'Banking Integration', type: 'api', freshness: now, reliability: 0.99 },
        { name: 'Contract Management System', type: 'api', freshness: fifteenMinAgo, reliability: 0.95 },
      ],
      assumptions: [
        'Fraud engine confidence of 73% means 27% probability the transaction is legitimate',
        'Contract penalty is binding based on PO-2025-00187 terms',
        'Meridian Logistics AG is a real entity (registered 2019, verified against company registry)',
      ],
      confidenceRange: { low: 0.55, high: 0.85 },
      alternativesConsidered: [
        {
          description: 'Partial release of 50% of funds',
          reason: 'Banking integration does not support partial wire; transaction must be released in full or held',
        },
        {
          description: 'Request supplier to resubmit via established payment channel',
          reason: 'Timeline does not permit resubmission before penalty deadline',
        },
      ],
      whatIfQueries: [
        'What is the probability of fraud recovery if we hold and this turns out to be legitimate?',
        'What happens to the supplier relationship if we delay past the contract deadline?',
      ],
    },
  },
};

// ── QuestionIntent ─────────────────────────────────────────────────────────

const questionId = uuid();

export const financeQuestion: QuestionIntent = {
  questionId,
  question: 'Should we release TXN-882941 ($2.4M wire to Meridian Logistics AG) given the fraud score of 73?',
  origin: 'system_triggered',
  urgency: 'urgent',
  domain: 'finance',
  askedAt: fifteenMinAgo,
  sufficiencyStatement:
    'This view covers the fraud signals, contract penalty deadline, transaction details, and 3 action paths (release, hold, escalate).',
  limitations: [
    'Fraud engine cannot distinguish legitimate first-time large payments from fraudulent ones with confidence > 85% for new beneficiaries',
    'Recovery probability (< 30%) is a model estimate based on historical wire fraud cases — actual recovery is jurisdiction-dependent',
    'Contract penalty applicability has not been verified by legal — assumption based on standard PO terms',
  ],
  suggestedFollowUps: [
    {
      question: 'Can we verify Meridian Logistics AG through an external source right now?',
      rationale: 'Independent verification of beneficiary identity would reduce fraud score significantly',
    },
    {
      question: 'Who at Meridian Logistics AG initiated this payment request?',
      rationale: 'Business email compromise (BEC) often involves impersonating a contact from a known supplier',
    },
    {
      question: 'What does the contract actually say about the penalty deadline?',
      rationale: 'Legal review may find grounds to negotiate a 24h extension without penalty',
    },
  ],
};

// ── AuthorityContext ───────────────────────────────────────────────────────

export const financeAuthority: AuthorityContext = {
  currentMode: 'approve',
  holderId: 'finance-lead',
  holderName: 'Jordan (Finance Lead)',
  enteredAt: fifteenMinAgo,
  expiresAt: inFourHours,
  reason: 'approval_request',
  justification: 'Assigned as transaction reviewer for TXN-882941 per fraud alert FA-4821',
  escalationHistory: [
    {
      from: 'observe',
      to: 'approve',
      timestamp: fifteenMinAgo,
      reason: 'approval_request',
      justification: 'Fraud alert triggered automatic escalation to Finance Lead review',
    },
  ],
};

// ── GovernedActions ───────────────────────────────────────────────────────

export const financeActions: GovernedAction[] = [
  {
    action: {
      id: 'release_transaction',
      label: 'Release Transaction',
      variant: 'destructive',
      disabled: false,
      safety: {
        confidence: 0.60,
        reversible: false,
        riskLevel: 'critical',
        requiresConfirmation: true,
        confirmationDelay: 8000,
        explanation:
          'Wire transfer is irreversible once cleared. Fraud recovery probability < 30%. CFO second approval is required by policy for transactions > $1M.',
        blastRadius: {
          scope: 'org',
          affectedSystems: ['treasury', 'banking-integration', 'accounts-payable'],
          downstreamEffects: '$2.4M leaves company account permanently within 60 min.',
          estimatedImpact: 'Irreversible wire transfer of $2,400,000.',
        },
      },
    },
    intent: 'Release the $2.4M wire transfer to Meridian Logistics AG to meet contract deadline',
    impactScope: {
      scope: 'org',
      affectedSystems: ['treasury', 'banking-integration', 'accounts-payable', 'audit'],
      downstreamEffects: 'Funds irreversibly transferred; contract obligation met; fraud risk accepted',
    },
    reversibility: 'irreversible',
    requiredAuthority: 'override',
    actionConfidence: 0.60,
    preconditions: [
      {
        description: 'CFO has provided second approval (required for transactions > $1M)',
        status: 'unmet',
        resolution: 'Use "Escalate to CFO" action to route for second approval',
      },
      {
        description: 'Beneficiary IBAN has been independently verified',
        status: 'unknown',
        resolution: 'Confirm IBAN via callback to Meridian Logistics AG using a known phone number (not from the payment request)',
      },
      {
        description: 'PO-2025-00187 reference is valid and matches procurement records',
        status: 'met',
      },
      {
        description: 'Fraud score acknowledgment: reviewer accepts 27% legitimacy probability',
        status: 'unmet',
        resolution: 'Reviewer must explicitly acknowledge fraud risk before release',
      },
    ],
    alternatives: [
      {
        description: 'Hold and negotiate deadline extension with supplier',
        rejectionReason: 'Requires supplier contact — time-consuming with 4h window remaining',
      },
      {
        description: 'Partial release to establish trust',
        rejectionReason: 'Banking integration does not support partial wire transfers',
      },
    ],
    tags: ['finance', 'wire-transfer', 'fraud', 'irreversible', 'escalation'],
  },
  {
    action: {
      id: 'hold_for_review',
      label: 'Hold for Manual Review (24h)',
      variant: 'primary',
      disabled: false,
      safety: {
        confidence: 0.94,
        reversible: true,
        riskLevel: 'low',
        requiresConfirmation: false,
        explanation:
          'Holds the transaction for up to 24h. Contract penalty of $48K will apply after the 4h deadline. No funds leave the company during the hold.',
      },
    },
    intent: 'Pause the transaction to allow deeper fraud investigation and supplier verification',
    impactScope: {
      scope: 'org',
      affectedSystems: ['treasury', 'accounts-payable'],
      downstreamEffects: '$48K contract penalty if hold extends past 4h deadline',
    },
    reversibility: 'fully_reversible',
    requiredAuthority: 'intervene',
    actionConfidence: 0.94,
    preconditions: [
      {
        description: 'Finance board has been notified of the hold',
        status: 'unknown',
        resolution: 'Send hold notification to finance-board@example.com',
      },
    ],
    alternatives: [],
    tags: ['finance', 'hold', 'fraud', 'investigation'],
  },
  {
    action: {
      id: 'escalate_to_cfo',
      label: 'Escalate to CFO',
      variant: 'secondary',
      disabled: false,
      safety: {
        confidence: 0.98,
        reversible: true,
        riskLevel: 'low',
        requiresConfirmation: false,
        explanation:
          'Routes transaction for CFO second approval per policy. CFO is notified immediately with full fraud context.',
      },
    },
    intent: 'Engage CFO second approver to satisfy the >$1M transaction policy requirement',
    impactScope: {
      scope: 'team',
      affectedSystems: ['approval-workflow', 'notifications'],
      downstreamEffects: 'CFO receives fraud report and approval request',
    },
    reversibility: 'fully_reversible',
    requiredAuthority: 'intervene',
    actionConfidence: 0.98,
    preconditions: [],
    alternatives: [],
    tags: ['finance', 'escalation', 'cfo', 'approval'],
  },
];

// ── DecisionRecords ───────────────────────────────────────────────────────

export const financeDecisionRecords: DecisionRecord[] = [
  {
    decisionId: uuid(),
    governedActionId: 'hold_for_review',
    outcome: 'approved',
    decidedAt: 'intervene',
    deciderId: 'fraud-system',
    timestamp: fifteenMinAgo,
    rationale: 'Fraud score exceeded 70/100 threshold. Transaction auto-held for human review.',
    deliberationTimeMs: 0,
  },
];

// ── TemporalLens ──────────────────────────────────────────────────────────

export const financeTemporalLens: TemporalLens = {
  activeLens: 'now',
  availableLenses: ['before', 'now', 'after'],
  annotations: {
    before: [
      {
        elementId: 'fraud_score',
        changeType: 'modified',
        previousValue: 'N/A (no prior transactions with Meridian)',
        currentValue: '73/100 (high risk)',
        causalFactors: [
          'First-time beneficiary relationship',
          'Amount 5× above median',
          'Off-hours initiation',
        ],
      },
    ],
    now: [
      {
        elementId: 'fraud_score',
        changeType: 'modified',
        currentValue: '73/100 — 3 of 5 fraud signals active',
        causalFactors: ['Fraud engine analysis complete'],
      },
      {
        elementId: 'time_to_penalty',
        changeType: 'modified',
        currentValue: '4h remaining before $48K penalty',
        causalFactors: ['Contract terms PO-2025-00187'],
      },
    ],
    after: [
      {
        elementId: 'transaction_status',
        changeType: 'projected',
        currentValue: 'Held',
        projectedValue: 'Released (if approved) — Wire clears in 15–60 min',
        projectionConfidence: 0.95,
        causalFactors: ['Standard SWIFT wire processing time'],
      },
      {
        elementId: 'fraud_recovery',
        changeType: 'projected',
        currentValue: 'N/A',
        projectedValue: '< 30% recovery probability if transaction is fraudulent',
        projectionConfidence: 0.71,
        causalFactors: ['Historical wire fraud recovery rate (BEC category)'],
      },
    ],
  },
  referencePoints: {
    beforeTimestamp: oneHourAgo,
    afterHorizon: 'PT4H',
  },
  changeSummary: {
    whatChanged: 'TXN-882941 auto-held by fraud engine 15 min ago at score 73/100.',
    whatWillHappen: 'If released: wire clears in 15–60 min, irreversible. If held past 4h: $48K contract penalty.',
  },
};

// ── UncertaintySummary ────────────────────────────────────────────────────

export const financeUncertainty: UncertaintySummary = {
  overallConfidence: 0.73,
  knownUnknowns: [
    'Whether Meridian Logistics AG IBAN is under attacker control (BEC scenario)',
    'Whether the contract penalty is legally binding without payment being made',
    'Recovery probability if fraud is confirmed after release',
  ],
  assumptions: [
    { assumption: 'Fraud engine score of 73 implies 27% legitimacy probability', criticality: 'high' },
    { assumption: 'Contract penalty deadline is 4h from now', criticality: 'high' },
    { assumption: 'Meridian Logistics AG is a real company (verified via registry)', criticality: 'medium' },
  ],
  indicators: [
    {
      elementId: 'fraud_score',
      type: 'source',
      confidence: 0.91,
      valueOrigin: 'measured',
      dataAge: { lastUpdated: now, isStale: false },
    },
    {
      elementId: 'fraud_recovery',
      type: 'epistemic',
      confidence: 0.55,
      confidenceInterval: { low: 0.35, high: 0.75, level: 0.90 },
      valueOrigin: 'estimated',
      dataAge: { lastUpdated: oneHourAgo, isStale: false },
    },
  ],
  unknownElements: ['iban_control', 'contract_enforceability', 'fraud_recovery_probability'],
  lowConfidenceCount: 2,
};

// ── SituationalView ───────────────────────────────────────────────────────

const situationId = uuid();

export const financeSituationalView: SituationalView = {
  situationId,
  question: 'Should we release TXN-882941 ($2.4M wire to Meridian Logistics AG) given the fraud score of 73?',
  answerSummary:
    '$2.4M wire to a first-time beneficiary flagged at fraud score 73/100. 3 of 5 fraud signals active. CFO escalation required to release (>$1M policy). $48K contract penalty in 4h if held. Recommend: escalate to CFO + verify IBAN independently.',
  scope: {
    systems: ['treasury', 'banking-integration', 'accounts-payable', 'fraud-engine'],
    timeWindow: 'PT4H',
    riskLevel: 'critical',
    orgScope: 'org',
  },
  confidence: 0.73,
  unknowns: [
    'IBAN under attacker control',
    'Contract penalty enforceability',
    'Recovery probability post-fraud',
  ],
  assumptions: [
    'Fraud score of 73 implies 27% legitimacy probability',
    'Contract penalty deadline is accurate',
    'Meridian Logistics AG is a real entity',
  ],
  generatedAt: fifteenMinAgo,
  expiresAt: inThirtyMin,
  status: 'active',
  priority: 95,
  tags: ['finance', 'wire-transfer', 'fraud', 'escalation', 'irreversible'],
  renderContract: financeRenderContract as any,
};
