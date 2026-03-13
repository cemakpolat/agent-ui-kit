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
// Governance Demo Scenario: "Security Incident — Emergency Patch Override"
//
// CVE-2025-48291 (CVSS 9.8 — critical RCE) affects the web framework used
// across 47 production hosts. Active exploitation is confirmed in the wild.
// Security lead needs emergency Override authority to bypass the 48h change
// management window and patch immediately within a 4h exploitation window.
//
// This scenario exercises:
//   - Override authority requirement with written justification
//   - Acknowledged unknowns during time-critical patching
//   - Ordered GovernedActions (wave patching)
//   - Preconditions with partial unknowns that must be acknowledged
//   - High-stakes irreversible window (each wave once started is committed)
// ─────────────────────────────────────────────────────────────────────────────

const now = new Date().toISOString();
const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
const inTwoHoursTime = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
const inFourHoursTime = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();
const inFifteenMin = new Date(Date.now() + 15 * 60 * 1000).toISOString();

// ── Intent payload (render contract) ─────────────────────────────────────────

export const securityRenderContract: IntentPayloadInput = {
  version: '1.0.0',
  intentId: uuid(),
  type: 'diagnostic_overview',
  domain: 'security',
  primaryGoal: 'Emergency patch deployment for CVE-2025-48291 (CVSS 9.8 RCE)',
  confidence: 0.91,
  density: 'operator',
  explain: true,
  layoutHint: 'dashboard',
  priorityFields: ['vulnerability_severity', 'exposed_hosts', 'exploit_window', 'wave_status'],

  data: {
    metrics: [
      {
        id: 'exposed_hosts',
        label: 'Exposed Production Hosts',
        value: 47,
        unit: 'hosts',
        trend: 'down',
        status: 'critical',
        sparkline: [47, 47, 47, 47, 47, 47, 47, 47],
        sampledAt: now,
        percentileRank: 100,
      },
      {
        id: 'exploit_window',
        label: 'Est. Time Before Active Exploitation',
        value: 2.0,
        unit: 'h',
        trend: 'down',
        status: 'critical',
        sparkline: [4, 3.8, 3.5, 3.2, 2.8, 2.5, 2.2, 2.0],
        sampledAt: now,
        percentileRank: 100,
      },
      {
        id: 'patched_hosts',
        label: 'Hosts Patched',
        value: 0,
        unit: 'hosts',
        trend: 'stable',
        status: 'warning',
        sparkline: [0, 0, 0, 0, 0, 0, 0, 0],
        sampledAt: now,
        percentileRank: 0,
      },
      {
        id: 'cvss_score',
        label: 'CVSS Score',
        value: 9.8,
        unit: '/10',
        trend: 'stable',
        status: 'critical',
        sparkline: [9.8],
        sampledAt: twoHoursAgo,
        percentileRank: 99,
      },
    ],
    vulnerability: {
      cveId: 'CVE-2025-48291',
      cvssScore: 9.8,
      cvssVector: 'AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H',
      affectedComponent: 'express-core >= 4.0.0 < 4.21.2',
      exploitType: 'Remote Code Execution (unauthenticated)',
      exploitInWild: true,
      exploitConfirmed: true,
      patchAvailable: true,
      patchVersion: '4.21.2',
      nvdPublished: twoHoursAgo,
    },
    patchWaves: [
      {
        waveId: 'wave-1',
        label: 'Wave 1 — Internal Tools (low traffic)',
        hostCount: 8,
        trafficWeight: 3,
        status: 'ready',
        estimatedDuration: '12 min',
        rollbackRisk: 'low',
      },
      {
        waveId: 'wave-2',
        label: 'Wave 2 — API Services (medium traffic)',
        hostCount: 19,
        trafficWeight: 35,
        status: 'pending',
        estimatedDuration: '22 min',
        rollbackRisk: 'medium',
      },
      {
        waveId: 'wave-3',
        label: 'Wave 3 — Customer-Facing Services (high traffic)',
        hostCount: 14,
        trafficWeight: 52,
        status: 'pending',
        estimatedDuration: '18 min',
        rollbackRisk: 'medium',
      },
      {
        waveId: 'wave-4',
        label: 'Wave 4 — Payment Processing (critical, isolated)',
        hostCount: 6,
        trafficWeight: 10,
        status: 'pending',
        estimatedDuration: '10 min',
        rollbackRisk: 'high',
        specialRequirements: ['Payment processor maintenance window', 'PCI compliance sign-off'],
      },
    ],
  },

  actions: [
    {
      id: 'start_wave_1',
      label: 'Begin Wave 1 Patch (Internal Tools)',
      variant: 'destructive',
      safety: {
        confidence: 0.93,
        reversible: true,
        riskLevel: 'high',
        requiresConfirmation: true,
        confirmationDelay: 3000,
        explanation:
          'Patches 8 internal tools hosting (3% traffic). Rollback available if needed. Override authority required to bypass 48h change window.',
        blastRadius: {
          scope: 'team',
          affectedSystems: ['internal-dashboard', 'admin-panel', 'monitoring-ui', 'devtools'],
          downstreamEffects: 'Internal tools unavailable for ~12 min during patch.',
          estimatedImpact: '~12 min unavailability for internal staff only.',
        },
      },
    },
    {
      id: 'request_emergency_window',
      label: 'Request Emergency Change Window',
      variant: 'secondary',
      safety: {
        confidence: 0.99,
        reversible: true,
        riskLevel: 'low',
        requiresConfirmation: false,
        explanation: 'Formally opens an emergency change window. Required documentation before Override authority can be used.',
      },
    },
  ],

  explainability: {
    overview: {
      elementId: 'overview',
      summary:
        'CVE-2025-48291 is a CVSS 9.8 unauthenticated RCE in express-core < 4.21.2, confirmed exploited in the wild. All 47 production hosts are vulnerable. Patch is available and tested. Standard 48h change window must be overridden. Estimated exploitation window: 2h.',
      dataSources: [
        { name: 'NVD / NIST CVE Feed', type: 'api', freshness: twoHoursAgo, reliability: 0.99 },
        { name: 'SIEM Threat Intelligence', type: 'api', freshness: thirtyMinAgo, reliability: 0.96 },
        { name: 'Asset Inventory Service', type: 'api', freshness: now, reliability: 0.97 },
        { name: 'CI/CD Patch Verification', type: 'api', freshness: thirtyMinAgo, reliability: 0.99 },
      ],
      assumptions: [
        'All 47 hosts are running the same affected version (4.18.2)',
        'Patch (4.21.2) has passed CI validation for all host profiles',
        'Exploitation window estimate is based on threat intel — actual timing may vary',
      ],
      confidenceRange: { low: 0.84, high: 0.97 },
      alternativesConsidered: [
        {
          description: 'Apply WAF rules to block exploit pattern while waiting for change window',
          reason: 'WAF pattern published but exploit variants are already circulating; not sufficient mitigation',
        },
        {
          description: 'Take hosts offline until patch is applied',
          reason: 'Customer-facing services represent 62% of production traffic; full offline not acceptable',
        },
        {
          description: 'Wait for standard 48h change window',
          reason: 'Exploitation window estimated at 2h — standard change window would arrive after active exploitation',
        },
      ],
      whatIfQueries: [
        'What if we only patch Wave 1 and monitor for active exploitation before proceeding?',
        'What is the blast radius if an exploit succeeds on a customer-facing host?',
      ],
    },
  },
};

// ── QuestionIntent ─────────────────────────────────────────────────────────

const questionId = uuid();

export const securityQuestion: QuestionIntent = {
  questionId,
  question: 'How do we patch CVE-2025-48291 across 47 production hosts before active exploitation?',
  origin: 'system_triggered',
  urgency: 'critical',
  domain: 'security',
  askedAt: thirtyMinAgo,
  sufficiencyStatement:
    'This view covers the CVE details, exposed host inventory, 4-wave patch plan with risk ranking, and the Override authority requirement to bypass standard change management.',
  limitations: [
    'Exploitation window (2h) is a threat intel estimate — actual attacker timeline is unknown',
    'Wave 4 (payment processing) has separate PCI compliance requirements not modeled here',
    'Patch compatibility with 3 legacy host configurations is not fully verified',
  ],
  suggestedFollowUps: [
    {
      question: 'Is there active scanning against our IPs for this CVE?',
      rationale: 'SIEM data would indicate whether attacks are already targeting our systems',
    },
    {
      question: 'What are the legacy host configurations that may not be compatible with 4.21.2?',
      rationale: 'Identifying incompatible hosts would let us plan targeted rollback before Wave 2',
    },
    {
      question: 'Has the payment processor approved emergency maintenance for Wave 4?',
      rationale: 'PCI scope hosts have separate approval requirements',
    },
  ],
};

// ── AuthorityContext ───────────────────────────────────────────────────────

export const securityAuthority: AuthorityContext = {
  currentMode: 'override',
  holderId: 'security-lead',
  holderName: 'Sam (Security Lead)',
  enteredAt: thirtyMinAgo,
  expiresAt: inFourHoursTime,
  reason: 'emergency',
  justification:
    'CVE-2025-48291 CVSS 9.8 active in wild. Standard 48h change window not viable. Emergency override authorized per SEC-POLICY-12 §4.2 (critical vulnerability response).',
  escalationHistory: [
    {
      from: 'observe',
      to: 'intervene',
      timestamp: twoHoursAgo,
      reason: 'incident_response',
      justification: 'CVE disclosed — beginning impact assessment',
    },
    {
      from: 'intervene',
      to: 'override',
      timestamp: thirtyMinAgo,
      reason: 'emergency',
      justification:
        'Exploitation confirmed in wild. Patch verified. Override required to bypass 48h change management. Approved by CTO per SEC-POLICY-12 §4.2.',
    },
  ],
};

// ── GovernedActions ───────────────────────────────────────────────────────

export const securityActions: GovernedAction[] = [
  {
    action: {
      id: 'start_wave_1',
      label: 'Begin Wave 1: Internal Tools (8 hosts, 3% traffic)',
      variant: 'destructive',
      disabled: false,
      safety: {
        confidence: 0.93,
        reversible: true,
        riskLevel: 'high',
        requiresConfirmation: true,
        confirmationDelay: 3000,
        explanation:
          'Patches 8 internal tool hosts. Override authority required. Rollback to 4.18.2 available within 5 min if issues arise.',
        blastRadius: {
          scope: 'team',
          affectedSystems: ['internal-dashboard', 'admin-panel', 'monitoring-ui', 'devtools'],
          downstreamEffects: 'Internal tools down ~12 min. No customer-facing impact.',
          estimatedImpact: '~12 min staff-only service interruption.',
        },
      },
    },
    intent: 'Patch Wave 1 (internal tools) as the lowest-risk starting point to validate the patch process',
    impactScope: {
      scope: 'team',
      affectedSystems: ['internal-dashboard', 'admin-panel', 'monitoring-ui', 'devtools'],
      downstreamEffects: 'Internal staff tool access interrupted for ~12 min',
    },
    reversibility: 'fully_reversible',
    requiredAuthority: 'override',
    actionConfidence: 0.93,
    preconditions: [
      {
        description: 'Emergency Change Window formally opened in ITSM',
        status: 'unmet',
        resolution: 'Use "Request Emergency Change Window" action to open ITSM ticket before proceeding',
      },
      {
        description: 'Patch (4.21.2) verified in CI for internal tool host profile',
        status: 'met',
      },
      {
        description: 'Rollback procedure tested in staging environment',
        status: 'met',
      },
      {
        description: 'All engineers notified of tooling downtime via Slack #eng-ops',
        status: 'unknown',
        resolution: 'Post degradation notice to #eng-ops before starting',
      },
    ],
    alternatives: [
      {
        description: 'WAF-only mitigation (skip patching for now)',
        rejectionReason: 'WAF coverage insufficient — exploit variants bypass current pattern',
      },
    ],
    tags: ['security', 'patch', 'cve', 'wave-1', 'override'],
  },
  {
    action: {
      id: 'start_wave_2',
      label: 'Begin Wave 2: API Services (19 hosts, 35% traffic)',
      variant: 'destructive',
      disabled: true,
      safety: {
        confidence: 0.88,
        reversible: true,
        riskLevel: 'high',
        requiresConfirmation: true,
        confirmationDelay: 5000,
        explanation:
          'Patches 19 API service hosts carrying 35% of production traffic. Requires Wave 1 completion and health check. Canary rollback available.',
        blastRadius: {
          scope: 'org',
          affectedSystems: ['api-gateway', 'user-service', 'product-service', 'search-service'],
          downstreamEffects: 'Partial API degradation during rolling restart (~22 min). Error rate expected < 0.5%.',
          estimatedImpact: '35% of production traffic may see elevated latency during patch.',
        },
      },
    },
    intent: 'Patch Wave 2 API services after Wave 1 is confirmed healthy',
    impactScope: {
      scope: 'org',
      affectedSystems: ['api-gateway', 'user-service', 'product-service', 'search-service'],
      downstreamEffects: '35% traffic with ~0.5% elevated error rate for 22 min',
    },
    reversibility: 'partially_reversible',
    requiredAuthority: 'override',
    actionConfidence: 0.88,
    preconditions: [
      {
        description: 'Wave 1 completed successfully (all 8 hosts healthy post-patch)',
        status: 'unmet',
        resolution: 'Complete Wave 1 and verify host health before proceeding to Wave 2',
      },
      {
        description: 'Patch verified for API service host profile',
        status: 'met',
      },
      {
        description: 'Load balancer health checks configured to detect degraded instances',
        status: 'met',
      },
    ],
    alternatives: [],
    tags: ['security', 'patch', 'cve', 'wave-2', 'override'],
  },
  {
    action: {
      id: 'request_emergency_window',
      label: 'Open Emergency Change Window (ITSM)',
      variant: 'secondary',
      disabled: false,
      safety: {
        confidence: 0.99,
        reversible: true,
        riskLevel: 'low',
        requiresConfirmation: false,
        explanation: 'Creates ITSM emergency change ticket with CVE details. Required before Override authority is formally valid.',
      },
    },
    intent: 'Formally document the emergency change window in ITSM to satisfy Override authority requirements',
    impactScope: {
      scope: 'team',
      affectedSystems: ['itsm-system'],
      downstreamEffects: 'Change management record created; compliance satisfied',
    },
    reversibility: 'fully_reversible',
    requiredAuthority: 'intervene',
    actionConfidence: 0.99,
    preconditions: [],
    alternatives: [],
    tags: ['security', 'governance', 'itsm', 'compliance'],
  },
];

// ── DecisionRecords ───────────────────────────────────────────────────────

export const securityDecisionRecords: DecisionRecord[] = [
  {
    decisionId: uuid(),
    governedActionId: 'authority_escalation_override',
    outcome: 'approved',
    decidedAt: 'override',
    deciderId: 'cto',
    timestamp: thirtyMinAgo,
    rationale:
      'CVE-2025-48291 CVSS 9.8 actively exploited. Threat intel estimates 2h exploitation window. Standard change process bypassed per SEC-POLICY-12 §4.2. All patches are tested and rollback-capable.',
    deliberationTimeMs: 20 * 60 * 1000,
  },
];

// ── TemporalLens ──────────────────────────────────────────────────────────

export const securityTemporalLens: TemporalLens = {
  activeLens: 'now',
  availableLenses: ['before', 'now', 'after'],
  annotations: {
    before: [
      {
        elementId: 'exposed_hosts',
        changeType: 'added',
        currentValue: '47 hosts running express-core 4.18.2',
        causalFactors: ['CVE published 2h ago against version in use'],
      },
      {
        elementId: 'threat_level',
        changeType: 'modified',
        previousValue: 'Low (no known exploits)',
        currentValue: 'Critical (active exploitation in wild)',
        causalFactors: ['NVD advisory published', 'SIEM threat feed updated with PoC exploit'],
      },
    ],
    now: [
      {
        elementId: 'exploit_window',
        changeType: 'modified',
        currentValue: '~2h estimated before targeted exploitation',
        causalFactors: ['Threat intel: scanning for this CVE detected against our IP ranges'],
      },
      {
        elementId: 'patched_hosts',
        changeType: 'modified',
        currentValue: '0 of 47 hosts patched',
        causalFactors: ['Patch dispatch pending Override authority confirmation'],
      },
    ],
    after: [
      {
        elementId: 'patched_hosts',
        changeType: 'projected',
        currentValue: '0/47',
        projectedValue: '47/47 (within ~62 min if all 4 waves proceed)',
        projectionConfidence: 0.85,
        causalFactors: ['Wave durations: W1=12m, W2=22m, W3=18m, W4=10m'],
      },
      {
        elementId: 'exploit_window',
        changeType: 'projected',
        currentValue: '~2h',
        projectedValue: '0h remaining — patch deployed before window closes',
        projectionConfidence: 0.76,
        causalFactors: ['All-wave completion projected at T+62min, well within 2h window'],
      },
    ],
  },
  referencePoints: {
    beforeTimestamp: twoHoursAgo,
    afterHorizon: 'PT2H',
  },
  changeSummary: {
    whatChanged: 'CVE-2025-48291 CVSS 9.8 disclosed 2h ago. All 47 hosts vulnerable. Active exploitation confirmed in wild.',
    whatWillHappen: 'If Override approved and waves executed: 47 hosts patched in ~62 min, before 2h exploitation window closes.',
  },
};

// ── UncertaintySummary ────────────────────────────────────────────────────

export const securityUncertainty: UncertaintySummary = {
  overallConfidence: 0.91,
  knownUnknowns: [
    'Actual attacker timeline — threat intel estimate may be conservative or optimistic',
    'Patch compatibility with 3 legacy host configurations not fully verified',
    'Wave 4 (payment hosts) PCI approval status not confirmed',
  ],
  assumptions: [
    { assumption: 'All 47 hosts run express-core 4.18.2 (inventory assumed current)', criticality: 'high' },
    { assumption: 'Patch 4.21.2 is backward-compatible with all host configurations', criticality: 'high' },
    { assumption: 'Exploitation window is ~2h (threat intel estimate)', criticality: 'medium' },
  ],
  indicators: [
    {
      elementId: 'exposed_hosts',
      type: 'source',
      confidence: 0.97,
      valueOrigin: 'measured',
      dataAge: { lastUpdated: now, isStale: false },
    },
    {
      elementId: 'exploit_window',
      type: 'epistemic',
      confidence: 0.68,
      confidenceInterval: { low: 0.50, high: 0.82, level: 0.90 },
      valueOrigin: 'estimated',
      dataAge: { lastUpdated: thirtyMinAgo, isStale: false },
    },
    {
      elementId: 'patch_compatibility',
      type: 'epistemic',
      confidence: 0.84,
      valueOrigin: 'estimated',
      dataAge: { lastUpdated: thirtyMinAgo, isStale: false },
    },
  ],
  unknownElements: ['actual_exploit_timeline', 'legacy_host_compatibility', 'pci_wave4_approval'],
  lowConfidenceCount: 1,
};

// ── SituationalView ───────────────────────────────────────────────────────

const situationId = uuid();

export const securitySituationalView: SituationalView = {
  situationId,
  question: 'How do we patch CVE-2025-48291 across 47 production hosts before active exploitation?',
  answerSummary:
    'CVE-2025-48291 (CVSS 9.8 RCE) affects all 47 production hosts. Exploitation confirmed in wild; est. 2h window. Override authority active. 4-wave patch plan ready: W1 internal tools → W2 API services → W3 customer-facing → W4 payment. Total est. patch time: 62 min.',
  scope: {
    systems: ['all-production-hosts', 'load-balancer', 'itsm-system', 'monitoring'],
    timeWindow: 'PT4H',
    riskLevel: 'critical',
    orgScope: 'org',
  },
  confidence: 0.91,
  unknowns: [
    'Actual attacker timeline',
    'Legacy host patch compatibility',
    'Wave 4 PCI approval',
  ],
  assumptions: [
    'All 47 hosts running affected version (inventory current)',
    'Patch 4.21.2 backward-compatible',
    'Two-hour exploitation window estimate',
  ],
  generatedAt: thirtyMinAgo,
  expiresAt: inFifteenMin,
  status: 'active',
  priority: 100,
  tags: ['security', 'cve', 'rce', 'emergency', 'override', 'patch'],
  renderContract: securityRenderContract as any,
};
