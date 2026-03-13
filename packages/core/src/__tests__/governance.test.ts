import { describe, it, expect } from 'vitest';

const uuidv4 = () => crypto.randomUUID();

import {
  SituationalViewSchema,
  isViewExpired,
  isViewStale,
  computeViewStatus,
  sortViews,
  type SituationalView,
} from '../schemas/situational-view';

import {
  QuestionIntentSchema,
  QuestionThreadSchema,
} from '../schemas/question-intent';

import {
  AuthorityModeSchema,
  AuthorityContextSchema,
  hasAuthority,
  isValidEscalation,
  getAuthorityCapabilities,
  getRecommendedDensity,
  AUTHORITY_HIERARCHY,
} from '../schemas/authority';

import {
  GovernedActionSchema,
  DecisionRecordSchema,
  arePreconditionsMet,
  getUnmetPreconditions,
  getUnknownPreconditions,
  wrapAsGovernedAction,
} from '../schemas/governed-action';

import {
  TemporalLensSchema,
  getAnnotationsForLens,
  countChanges,
  hasTemporalContext,
} from '../schemas/temporal-lens';

import {
  UncertaintySummarySchema,
  UncertaintyIndicatorSchema,
  getUncertaintyLevel,
  hasCriticalUncertainty,
  getAssumptionsByCriticality,
} from '../schemas/uncertainty';

import {
  validateView,
  validateActionExecution,
  parseView,
  parseGovernedAction,
} from '../validation/governance';

// ── Test Fixtures ──────────────────────────────────────────────────────────

const BASE_INTENT = {
  version: '1.0.0',
  intentId: uuidv4(),
  type: 'diagnostic_overview',
  domain: 'infrastructure',
  primaryGoal: 'Identify the cause of the latency spike',
  confidence: 0.78,
  data: { metrics: [] },
};

const BASE_VIEW_INPUT = {
  situationId: uuidv4(),
  question: "What's causing the latency spike in the API gateway?",
  scope: { systems: ['api-gateway', 'auth-service'], riskLevel: 'high' as const },
  confidence: 0.78,
  unknowns: ['Cache hit ratio unavailable for last 2 minutes'],
  assumptions: ['Primary database is healthy'],
  generatedAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
  renderContract: BASE_INTENT,
};

const BASE_GOVERNED_ACTION = {
  action: {
    id: 'restart-replica',
    label: 'Restart Replica',
    variant: 'destructive' as const,
    safety: {
      confidence: 0.85,
      reversible: true,
      requiresConfirmation: true,
      riskLevel: 'high' as const,
      blastRadius: {
        scope: 'team' as const,
        affectedSystems: ['postgres-replica-2'],
      },
    },
  },
  intent: 'Restore read-replica health after OOM event',
  impactScope: { scope: 'team' as const, affectedSystems: ['postgres-replica-2'] },
  reversibility: 'fully_reversible' as const,
  requiredAuthority: 'approve' as const,
  preconditions: [
    { description: 'Primary is healthy', status: 'met' as const },
    { description: 'No active transactions', status: 'unknown' as const },
  ],
  actionConfidence: 0.85,
};

// ── SituationalView ──────────────────────────────────────────────────────────

describe('SituationalViewSchema', () => {
  it('parses a valid situational view', () => {
    const result = SituationalViewSchema.safeParse(BASE_VIEW_INPUT);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe('active');
      expect(result.data.priority).toBe(50);
      expect(result.data.tags).toEqual([]);
    }
  });

  it('requires a question', () => {
    const result = SituationalViewSchema.safeParse({
      ...BASE_VIEW_INPUT,
      question: '',
    });
    expect(result.success).toBe(false);
  });

  it('requires at least one system in scope', () => {
    const result = SituationalViewSchema.safeParse({
      ...BASE_VIEW_INPUT,
      scope: { systems: [] },
    });
    expect(result.success).toBe(false);
  });

  it('rejects confidence outside 0–1', () => {
    expect(SituationalViewSchema.safeParse({ ...BASE_VIEW_INPUT, confidence: 1.5 }).success).toBe(false);
    expect(SituationalViewSchema.safeParse({ ...BASE_VIEW_INPUT, confidence: -0.1 }).success).toBe(false);
  });
});

describe('SituationalView lifecycle helpers', () => {
  const activeView = SituationalViewSchema.parse(BASE_VIEW_INPUT) as SituationalView;

  it('detects non-expired views', () => {
    expect(isViewExpired(activeView)).toBe(false);
  });

  it('detects expired views', () => {
    const expired = { ...activeView, expiresAt: new Date(Date.now() - 10 * 60 * 1000).toISOString() };
    expect(isViewExpired(expired)).toBe(true);
  });

  it('detects stale views within grace period', () => {
    const stale = { ...activeView, expiresAt: new Date(Date.now() - 60 * 1000).toISOString() };
    expect(isViewStale(stale)).toBe(true);
  });

  it('computes effective status', () => {
    expect(computeViewStatus(activeView)).toBe('active');
    const hypo = { ...activeView, status: 'hypothetical' as const };
    expect(computeViewStatus(hypo)).toBe('hypothetical');
  });

  it('sorts views by priority descending', () => {
    const low = { ...activeView, priority: 10, situationId: uuidv4() };
    const high = { ...activeView, priority: 90, situationId: uuidv4() };
    const sorted = sortViews([low, high]);
    expect(sorted[0].priority).toBe(90);
    expect(sorted[1].priority).toBe(10);
  });
});

// ── QuestionIntent ──────────────────────────────────────────────────────────

describe('QuestionIntentSchema', () => {
  it('parses a valid question intent', () => {
    const result = QuestionIntentSchema.safeParse({
      questionId: uuidv4(),
      question: 'Should we approve the canary deployment?',
      origin: 'agent_proactive',
      urgency: 'urgent',
      domain: 'infrastructure',
      askedAt: new Date().toISOString(),
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limitations).toEqual([]);
      expect(result.data.suggestedFollowUps).toEqual([]);
    }
  });

  it('accepts all question origins', () => {
    for (const origin of ['human_explicit', 'human_implicit', 'agent_proactive', 'system_triggered', 'follow_up']) {
      const result = QuestionIntentSchema.safeParse({
        questionId: uuidv4(),
        question: 'Test question',
        origin,
        domain: 'test',
        askedAt: new Date().toISOString(),
      });
      expect(result.success).toBe(true);
    }
  });

  it('requires a non-empty question', () => {
    const result = QuestionIntentSchema.safeParse({
      questionId: uuidv4(),
      question: '',
      origin: 'human_explicit',
      domain: 'test',
      askedAt: new Date().toISOString(),
    });
    expect(result.success).toBe(false);
  });
});

// ── AuthorityMode ──────────────────────────────────────────────────────────

describe('AuthorityMode', () => {
  it('accepts all four authority modes', () => {
    for (const mode of ['observe', 'intervene', 'approve', 'override']) {
      expect(AuthorityModeSchema.safeParse(mode).success).toBe(true);
    }
  });

  it('rejects invalid modes', () => {
    expect(AuthorityModeSchema.safeParse('admin').success).toBe(false);
  });

  it('checks authority hierarchy correctly', () => {
    expect(hasAuthority('override', 'approve')).toBe(true);
    expect(hasAuthority('approve', 'approve')).toBe(true);
    expect(hasAuthority('observe', 'approve')).toBe(false);
    expect(hasAuthority('intervene', 'override')).toBe(false);
  });

  it('validates escalation', () => {
    expect(isValidEscalation('observe', 'approve')).toBe(true);
    expect(isValidEscalation('approve', 'observe')).toBe(true); // downgrade always valid
  });

  it('returns correct capabilities per mode', () => {
    const observe = getAuthorityCapabilities('observe');
    expect(observe.canView).toBe(true);
    expect(observe.canModifyConstraints).toBe(false);
    expect(observe.canApproveActions).toBe(false);
    expect(observe.canEscalate).toBe(true);

    const override = getAuthorityCapabilities('override');
    expect(override.canOverride).toBe(true);
    expect(override.canEscalate).toBe(false); // already at max
  });

  it('maps authority to density', () => {
    expect(getRecommendedDensity('observe')).toBe('executive');
    expect(getRecommendedDensity('override')).toBe('expert');
  });
});

describe('AuthorityContextSchema', () => {
  it('parses a valid authority context', () => {
    const result = AuthorityContextSchema.safeParse({
      currentMode: 'approve',
      holderId: 'user-123',
      holderName: 'Alice',
      enteredAt: new Date().toISOString(),
      reason: 'approval_request',
    });
    expect(result.success).toBe(true);
  });
});

// ── GovernedAction ──────────────────────────────────────────────────────────

describe('GovernedActionSchema', () => {
  it('parses a valid governed action', () => {
    const result = GovernedActionSchema.safeParse(BASE_GOVERNED_ACTION);
    expect(result.success).toBe(true);
  });

  it('checks preconditions', () => {
    const action = GovernedActionSchema.parse(BASE_GOVERNED_ACTION);
    // Has one 'unknown' precondition, so all preconditions are NOT met
    expect(arePreconditionsMet(action)).toBe(false);
    expect(getUnmetPreconditions(action)).toHaveLength(0);
    expect(getUnknownPreconditions(action)).toHaveLength(1);
  });

  it('wraps an AgentAction into GovernedAction', () => {
    const agentAction = {
      id: 'deploy',
      label: 'Deploy',
      variant: 'primary' as const,
      disabled: false,
      safety: {
        confidence: 0.9,
        reversible: false,
        requiresConfirmation: true,
        riskLevel: 'critical' as const,
      },
    };
    const wrapped = wrapAsGovernedAction(agentAction);
    expect(wrapped.reversibility).toBe('irreversible');
    expect(wrapped.requiredAuthority).toBe('approve');
    expect(wrapped.actionConfidence).toBe(0.9);
  });
});

describe('DecisionRecordSchema', () => {
  it('parses a valid decision record', () => {
    const result = DecisionRecordSchema.safeParse({
      decisionId: uuidv4(),
      governedActionId: 'restart-replica',
      outcome: 'approved',
      decidedAt: 'approve',
      deciderId: 'user-123',
      timestamp: new Date().toISOString(),
      rationale: 'Primary is healthy, safe to restart replica',
      deliberationTimeMs: 12500,
    });
    expect(result.success).toBe(true);
  });
});

// ── TemporalLens ──────────────────────────────────────────────────────────

describe('TemporalLensSchema', () => {
  it('parses a minimal temporal lens', () => {
    const result = TemporalLensSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.activeLens).toBe('now');
      expect(result.data.availableLenses).toEqual(['now']);
    }
  });

  it('parses a full temporal lens with annotations', () => {
    const result = TemporalLensSchema.safeParse({
      activeLens: 'before',
      availableLenses: ['now', 'before', 'after'],
      annotations: {
        now: [{ elementId: 'latency', changeType: 'modified', currentValue: 250 }],
        before: [{ elementId: 'latency', changeType: 'modified', previousValue: 50, currentValue: 250 }],
        after: [{ elementId: 'latency', changeType: 'projected', projectedValue: 60, projectionConfidence: 0.8 }],
      },
    });
    expect(result.success).toBe(true);
  });

  it('counts changes correctly', () => {
    const lens = TemporalLensSchema.parse({
      availableLenses: ['now', 'before'],
      annotations: {
        now: [
          { elementId: 'a', changeType: 'modified' },
          { elementId: 'b', changeType: 'added' },
        ],
        before: [
          { elementId: 'a', changeType: 'modified' },
        ],
        after: [],
      },
    });
    const counts = countChanges(lens);
    expect(counts.modified).toBe(2);
    expect(counts.added).toBe(1);
  });

  it('detects temporal context', () => {
    const nowOnly = TemporalLensSchema.parse({ availableLenses: ['now'] });
    expect(hasTemporalContext(nowOnly)).toBe(false);

    const full = TemporalLensSchema.parse({ availableLenses: ['now', 'before', 'after'] });
    expect(hasTemporalContext(full)).toBe(true);
  });
});

// ── Uncertainty ──────────────────────────────────────────────────────────

describe('UncertaintySummary', () => {
  it('parses a valid uncertainty summary', () => {
    const result = UncertaintySummarySchema.safeParse({
      overallConfidence: 0.72,
      knownUnknowns: ['Cache hit ratio unavailable'],
      assumptions: [
        { assumption: 'Primary DB is healthy', criticality: 'high' },
        { assumption: 'Network latency is stable', criticality: 'low' },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('classifies uncertainty levels correctly', () => {
    expect(getUncertaintyLevel(0.9)).toBe('confident');
    expect(getUncertaintyLevel(0.6)).toBe('moderate');
    expect(getUncertaintyLevel(0.3)).toBe('low');
    expect(getUncertaintyLevel(0)).toBe('unknown');
  });

  it('detects critical uncertainty', () => {
    const critical = UncertaintySummarySchema.parse({
      overallConfidence: 0.3,
      assumptions: [{ assumption: 'test', criticality: 'critical' }],
    });
    expect(hasCriticalUncertainty(critical)).toBe(true);

    const safe = UncertaintySummarySchema.parse({
      overallConfidence: 0.9,
    });
    expect(hasCriticalUncertainty(safe)).toBe(false);
  });

  it('sorts assumptions by criticality', () => {
    const summary = UncertaintySummarySchema.parse({
      overallConfidence: 0.5,
      assumptions: [
        { assumption: 'low', criticality: 'low' },
        { assumption: 'critical', criticality: 'critical' },
        { assumption: 'medium', criticality: 'medium' },
      ],
    });
    const sorted = getAssumptionsByCriticality(summary);
    expect(sorted[0].criticality).toBe('critical');
    expect(sorted[1].criticality).toBe('medium');
    expect(sorted[2].criticality).toBe('low');
  });
});

describe('UncertaintyIndicator', () => {
  it('parses a valid indicator', () => {
    const result = UncertaintyIndicatorSchema.safeParse({
      elementId: 'latency-metric',
      type: 'statistical',
      confidence: 0.85,
      confidenceInterval: { low: 200, high: 300, level: 0.95 },
      valueOrigin: 'measured',
    });
    expect(result.success).toBe(true);
  });
});

// ── Governance Validation ──────────────────────────────────────────────────

describe('Governance validation', () => {
  describe('validateView', () => {
    it('passes for a valid view', () => {
      const view = SituationalViewSchema.parse(BASE_VIEW_INPUT);
      const report = validateView(view);
      expect(report.valid).toBe(true);
      expect(report.violations).toHaveLength(0);
    });

    it('warns on low confidence without unknowns', () => {
      const view = SituationalViewSchema.parse({
        ...BASE_VIEW_INPUT,
        confidence: 0.3,
        unknowns: [],
      });
      const report = validateView(view);
      expect(report.violations.some(v => v.rule === 'low-confidence-unknowns')).toBe(true);
    });

    it('warns on expired but still active views', () => {
      const view = SituationalViewSchema.parse({
        ...BASE_VIEW_INPUT,
        expiresAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
        status: 'active',
      });
      const report = validateView(view);
      expect(report.violations.some(v => v.rule === 'expired-view-active')).toBe(true);
    });
  });

  describe('validateActionExecution', () => {
    it('blocks action with insufficient authority', () => {
      const action = GovernedActionSchema.parse(BASE_GOVERNED_ACTION);
      const report = validateActionExecution(action, 'observe');
      expect(report.valid).toBe(false);
      expect(report.violations.some(v => v.rule === 'insufficient-authority')).toBe(true);
    });

    it('passes action with sufficient authority', () => {
      const action = GovernedActionSchema.parse({
        ...BASE_GOVERNED_ACTION,
        preconditions: [
          { description: 'Primary is healthy', status: 'met' },
        ],
      });
      const report = validateActionExecution(action, 'approve');
      expect(report.valid).toBe(true);
    });

    it('warns on unknown preconditions', () => {
      const action = GovernedActionSchema.parse(BASE_GOVERNED_ACTION);
      const report = validateActionExecution(action, 'approve');
      expect(report.violations.some(v => v.rule === 'precondition-unknown')).toBe(true);
    });
  });

  describe('parseView', () => {
    it('validates structure with Zod', () => {
      const result = parseView(BASE_VIEW_INPUT);
      expect(result.success).toBe(true);
    });

    it('rejects invalid structure', () => {
      const result = parseView({ question: 'no scope' });
      expect(result.success).toBe(false);
    });
  });

  describe('parseGovernedAction', () => {
    it('validates structure', () => {
      const result = parseGovernedAction(BASE_GOVERNED_ACTION);
      expect(result.success).toBe(true);
    });
  });
});
