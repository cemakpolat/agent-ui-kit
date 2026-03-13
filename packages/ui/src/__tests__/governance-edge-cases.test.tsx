// ─────────────────────────────────────────────────────────────────────────────
// Phase 3.2 — Governance Edge Cases & Error States
//
// Covers:
//   ✓ AuthorityModeSwitch — expiry countdown fires onExpiry; already-expired state
//   ✓ GovernedActionPanel — no safety, no preconditions, no alternatives, no blast
//   ✓ TemporalLensOverlay — no annotations, only "now" lens, missing change summary
//   ✓ UncertaintyIndicators — zero confidence, 100% confidence, empty summary
//   ✓ DecisionRecordViewer — modifications display, deliberation < 1s, > 1min
//   ✓ QuestionIntentBar — no follow-ups, no limitations, no sufficiency statement
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { ThemeProvider } from '../ThemeContext';
import { lightTheme } from '../theme';

import { AuthorityModeSwitch } from '../components/AuthorityModeSwitch';
import { GovernedActionPanel } from '../components/GovernedActionPanel';
import { TemporalLensOverlay } from '../components/TemporalLensOverlay';
import { UncertaintyIndicators } from '../components/UncertaintyIndicators';
import { DecisionRecordViewer } from '../components/DecisionRecordViewer';
import { QuestionIntentBar } from '../components/QuestionIntentBar';

import type {
  AuthorityContext,
  AuthorityMode,
  GovernedAction,
  TemporalLens,
  UncertaintySummary,
  QuestionIntent,
  QuestionStatus,
  DecisionRecord,
} from '@hari/core';

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

function wrap(ui: React.ReactElement) {
  return render(<ThemeProvider theme={lightTheme}>{ui}</ThemeProvider>);
}

function makeAuthority(
  mode: AuthorityMode = 'observe',
  overrides: Partial<AuthorityContext> = {},
): AuthorityContext {
  return {
    currentMode: mode,
    holderId: 'user-1',
    enteredAt: new Date().toISOString(),
    escalationHistory: [],
    ...overrides,
  };
}

function makeGovernedAction(overrides: Partial<GovernedAction> = {}): GovernedAction {
  return {
    action: {
      id: 'minimal-action',
      label: 'Minimal Action',
      variant: 'primary',
      disabled: false,
    },
    intent: 'Minimal intent for edge case testing',
    impactScope: { scope: 'self', affectedSystems: [] },
    reversibility: 'fully_reversible',
    requiredAuthority: 'observe',
    preconditions: [],
    actionConfidence: 0.5,
    alternatives: [],
    tags: [],
    ...overrides,
  };
}

function makeEmptyLens(): TemporalLens {
  return {
    activeLens: 'now',
    availableLenses: ['now'],
    annotations: { now: [], before: [], after: [] },
    referencePoints: {},
    changeSummary: {},
  };
}

function makeNowOnlyLens(): TemporalLens {
  return {
    activeLens: 'now',
    availableLenses: ['now'],
    annotations: {
      now: [
        {
          elementId: 'cpu',
          changeType: 'unchanged',
          currentValue: 62,
          causalFactors: [],
        },
      ],
      before: [],
      after: [],
    },
    referencePoints: {},
    changeSummary: { whatChanged: 'CPU remained stable' },
  };
}

function makeFullLens(): TemporalLens {
  return {
    activeLens: 'before',
    availableLenses: ['before', 'now', 'after'],
    annotations: {
      now: [{ elementId: 'lag', changeType: 'modified', currentValue: 4.2, causalFactors: [] }],
      before: [{ elementId: 'lag', changeType: 'modified', previousValue: 0.1, currentValue: 4.2, explanation: 'Lag spiked', causalFactors: ['write storms'] }],
      after:  [{ elementId: 'lag', changeType: 'projected', projectedValue: 0.2, projectionConfidence: 0.82, causalFactors: ['restart'] }],
    },
    referencePoints: {
      beforeTimestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
      afterHorizon: 'PT2M',
    },
    changeSummary: {
      whatChanged: 'Replication lag jumped from 0.1s to 4.2s',
      whatWillHappen: 'Lag will return to near zero after restart',
      affectedCount: 1,
    },
  };
}

function makeEmptyUncertainty(): UncertaintySummary {
  return {
    overallConfidence: 1.0,
    knownUnknowns: [],
    assumptions: [],
    indicators: [],
    lowConfidenceCount: 0,
    unknownElements: [],
  };
}

function makeQuestion(overrides: Partial<QuestionIntent> = {}): QuestionIntent {
  return {
    questionId: crypto.randomUUID(),
    question: 'Is the database healthy?',
    urgency: 'normal',
    origin: 'human_explicit',
    domain: 'cloudops',
    askedAt: new Date().toISOString(),
    suggestedFollowUps: [],
    limitations: [],
    ...overrides,
  };
}

function makeRecord(overrides: Partial<DecisionRecord> = {}): DecisionRecord {
  return {
    decisionId: crypto.randomUUID(),
    governedActionId: 'minimal-action',
    outcome: 'approved',
    decidedAt: 'approve',
    deciderId: 'user@example.com',
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// AuthorityModeSwitch — expiry edge cases
// ─────────────────────────────────────────────────────────────────────────────

describe('AuthorityModeSwitch — expiry edge cases', () => {
  afterEach(() => { vi.useRealTimers(); });

  it('calls onExpiry when expiresAt passes (interval tick)', async () => {
    vi.useFakeTimers();
    const onExpiry = vi.fn();
    // Set expiry to 1 second ago (already expired)
    const expiresAt = new Date(Date.now() - 1000).toISOString();

    wrap(
      <AuthorityModeSwitch
        authority={makeAuthority('approve', { expiresAt })}
        onModeChange={vi.fn()}
        onExpiry={onExpiry}
      />,
    );

    // Tick the 30s interval so the component re-evaluates
    await act(async () => { vi.advanceTimersByTime(30_001); });

    expect(onExpiry).toHaveBeenCalledTimes(1);
  });

  it('shows Expired label immediately when expiresAt is in the past', () => {
    const expiresAt = new Date(Date.now() - 5000).toISOString();
    wrap(
      <AuthorityModeSwitch
        authority={makeAuthority('approve', { expiresAt })}
        onModeChange={vi.fn()}
      />,
    );
    // The ⏱ + "Expired" are rendered as a single span whose text begins with ⏱
    expect(screen.getByText(/Expired/)).toBeInTheDocument();
  });

  it('shows formatted countdown for future expiresAt', () => {
    const expiresAt = new Date(Date.now() + 45 * 60 * 1000).toISOString(); // +45 min
    wrap(
      <AuthorityModeSwitch
        authority={makeAuthority('approve', { expiresAt })}
        onModeChange={vi.fn()}
      />,
    );
    expect(screen.getByText(/45m/)).toBeInTheDocument();
  });

  it('shows hours-and-minutes format for long expiry', () => {
    const expiresAt = new Date(Date.now() + 90 * 60 * 1000).toISOString(); // +90 min
    wrap(
      <AuthorityModeSwitch
        authority={makeAuthority('approve', { expiresAt })}
        onModeChange={vi.fn()}
      />,
    );
    // 90 min → "1h 30m"
    expect(screen.getByText(/1h 30m/)).toBeInTheDocument();
  });

  it('shows nothing when no expiresAt', () => {
    wrap(
      <AuthorityModeSwitch
        authority={makeAuthority('observe')}
        onModeChange={vi.fn()}
      />,
    );
    // No countdown text
    expect(screen.queryByText(/m$|Expired/)).not.toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GovernedActionPanel — minimal / edge case data
// ─────────────────────────────────────────────────────────────────────────────

describe('GovernedActionPanel — edge cases', () => {
  it('renders without safety block (no safety on action)', () => {
    const action = makeGovernedAction();
    // action.action.safety is undefined — confirm renders without crashing
    wrap(
      <GovernedActionPanel
        governedAction={action}
        currentAuthority="observe"
        onDecision={vi.fn()}
      />,
    );
    // Label appears in header div + button — use getAllByText
    expect(screen.getAllByText('Minimal Action').length).toBeGreaterThanOrEqual(1);
  });

  it('shows no precondition block when preconditions array is empty', () => {
    wrap(
      <GovernedActionPanel
        governedAction={makeGovernedAction()}
        currentAuthority="observe"
        onDecision={vi.fn()}
      />,
    );
    expect(screen.queryByText('Preconditions')).not.toBeInTheDocument();
  });

  it('shows no alternatives block when alternatives is empty', () => {
    wrap(
      <GovernedActionPanel
        governedAction={makeGovernedAction()}
        currentAuthority="observe"
        onDecision={vi.fn()}
      />,
    );
    expect(screen.queryByText(/Alternatives Considered/i)).not.toBeInTheDocument();
  });

  it('shows alternatives section when alternatives exist (non-compact)', () => {
    const action = makeGovernedAction({
      alternatives: [
        { description: 'Scale up primary', rejectionReason: 'More expensive' },
      ],
    });
    wrap(
      <GovernedActionPanel
        governedAction={action}
        currentAuthority="observe"
        onDecision={vi.fn()}
      />,
    );
    expect(screen.getByText(/Alternatives Considered \(1\)/i)).toBeInTheDocument();
  });

  it('hides alternatives in compact mode', () => {
    const action = makeGovernedAction({
      alternatives: [
        { description: 'Scale up primary', rejectionReason: 'More expensive' },
      ],
    });
    wrap(
      <GovernedActionPanel
        governedAction={action}
        currentAuthority="observe"
        onDecision={vi.fn()}
        compact
      />,
    );
    expect(screen.queryByText(/Alternatives Considered/i)).not.toBeInTheDocument();
  });

  it('renders time_limited reversibility badge', () => {
    const action = makeGovernedAction({ reversibility: 'time_limited', reversalWindow: 'PT1H' });
    wrap(
      <GovernedActionPanel
        governedAction={action}
        currentAuthority="observe"
        onDecision={vi.fn()}
      />,
    );
    expect(screen.getByText(/Time-limited reversal/i)).toBeInTheDocument();
  });

  it('renders partially_reversible badge', () => {
    const action = makeGovernedAction({ reversibility: 'partially_reversible' });
    wrap(
      <GovernedActionPanel
        governedAction={action}
        currentAuthority="observe"
        onDecision={vi.fn()}
      />,
    );
    expect(screen.getByText(/Partially reversible/i)).toBeInTheDocument();
  });

  it('does not show escalate button when onEscalate is not provided', () => {
    // Authority insufficient, but no escalate callback
    wrap(
      <GovernedActionPanel
        governedAction={makeGovernedAction({ requiredAuthority: 'approve' })}
        currentAuthority="observe"
        onDecision={vi.fn()}
      />,
    );
    expect(screen.getByText(/Requires "approve" authority/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Escalate/i })).not.toBeInTheDocument();
  });

  it('shows waived precondition status', () => {
    const action = makeGovernedAction({
      preconditions: [{ description: 'Maintenance window active', status: 'waived' }],
    });
    wrap(
      <GovernedActionPanel
        governedAction={action}
        currentAuthority="observe"
        onDecision={vi.fn()}
      />,
    );
    expect(screen.getByText('Maintenance window active')).toBeInTheDocument();
  });

  it('shows all four precondition statuses rendered', () => {
    const action = makeGovernedAction({
      preconditions: [
        { description: 'met condition', status: 'met' },
        { description: 'unmet condition', status: 'unmet' },
        { description: 'unknown condition', status: 'unknown' },
        { description: 'waived condition', status: 'waived' },
      ],
    });
    wrap(
      <GovernedActionPanel
        governedAction={action}
        currentAuthority="approve"
        onDecision={vi.fn()}
      />,
    );
    expect(screen.getByText('met condition')).toBeInTheDocument();
    expect(screen.getByText('unmet condition')).toBeInTheDocument();
    expect(screen.getByText('unknown condition')).toBeInTheDocument();
    expect(screen.getByText('waived condition')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TemporalLensOverlay — edge cases
// ─────────────────────────────────────────────────────────────────────────────

describe('TemporalLensOverlay — edge cases', () => {
  it('renders only Now tab when only "now" lens is available', () => {
    wrap(
      <TemporalLensOverlay
        lens={makeEmptyLens()}
        onLensChange={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: /Now/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Before/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /After/i })).not.toBeInTheDocument();
  });

  it('renders no annotation cards when Now lens has no annotations', () => {
    wrap(
      <TemporalLensOverlay
        lens={makeEmptyLens()}
        onLensChange={vi.fn()}
      />,
    );
    // No annotation items with change type badges
    expect(screen.queryByText(/added|removed|modified|projected/i)).not.toBeInTheDocument();
  });

  it('renders all three lens tabs when full lens is provided', () => {
    wrap(
      <TemporalLensOverlay
        lens={makeFullLens()}
        onLensChange={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: /Now/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Before/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /After/i })).toBeInTheDocument();
  });

  it('shows before-lens annotation explanation when Before tab is active', () => {
    wrap(
      <TemporalLensOverlay
        lens={makeFullLens()}
        onLensChange={vi.fn()}
      />,
    );
    // Full lens starts with activeLens='before', should show before annotations
    expect(screen.getByText('Lag spiked')).toBeInTheDocument();
  });

  it('switches active lens on tab click and calls onLensChange', () => {
    const onLensChange = vi.fn();
    wrap(
      <TemporalLensOverlay
        lens={makeFullLens()}
        onLensChange={onLensChange}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /After/i }));
    expect(onLensChange).toHaveBeenCalledWith('after');
  });

  it('compact mode hides annotation cards', () => {
    wrap(
      <TemporalLensOverlay
        lens={makeFullLens()}
        onLensChange={vi.fn()}
        compact
      />,
    );
    // In compact mode TemporalAnnotationList is not rendered, so explanation hidden
    expect(screen.queryByText('Lag spiked')).not.toBeInTheDocument();
  });

  it('hides compact TemporalLensOverlay entirely when no temporal context', () => {
    // Empty lens in compact mode should return null (hasTemporalContext returns false)
    const { container } = wrap(
      <TemporalLensOverlay
        lens={makeEmptyLens()}
        onLensChange={vi.fn()}
        compact
      />,
    );
    // The TemporalLensSelector returns null in compact when no context
    // but TemporalLensOverlay wraps it in a div — check no lens buttons
    expect(screen.queryByRole('button', { name: /Now/i })).not.toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// UncertaintyIndicators — edge cases
// ─────────────────────────────────────────────────────────────────────────────

describe('UncertaintyIndicators — edge cases', () => {
  it('renders 100% confidence as "High Confidence"', () => {
    wrap(<UncertaintyIndicators summary={makeEmptyUncertainty()} />);
    expect(screen.getByText(/High Confidence/i)).toBeInTheDocument();
    expect(screen.getByText(/100%/)).toBeInTheDocument();
  });

  it('renders 0% confidence as "Unknown" (getUncertaintyLevel(0) → unknown)', () => {
    wrap(<UncertaintyIndicators summary={{ ...makeEmptyUncertainty(), overallConfidence: 0 }} />);
    // 0% → level 'unknown' → label 'Unknown'
    expect(screen.getByText(/Unknown/i)).toBeInTheDocument();
    expect(screen.getByText(/0%/)).toBeInTheDocument();
  });

  it('renders 50% as "Moderate Confidence"', () => {
    wrap(<UncertaintyIndicators summary={{ ...makeEmptyUncertainty(), overallConfidence: 0.5 }} />);
    expect(screen.getByText(/Moderate Confidence/i)).toBeInTheDocument();
  });

  it('expands empty summary without crashing', () => {
    wrap(<UncertaintyIndicators summary={makeEmptyUncertainty()} />);
    // Click to expand — should not render any sections since all are empty
    fireEvent.click(screen.getByText(/100%/));
    expect(screen.queryByText('Known Unknowns')).not.toBeInTheDocument();
    expect(screen.queryByText('Assumptions')).not.toBeInTheDocument();
  });

  it('renders assumption impact-if-wrong when present', () => {
    const summary: UncertaintySummary = {
      overallConfidence: 0.6,
      knownUnknowns: [],
      assumptions: [
        {
          assumption: 'Network is healthy',
          criticality: 'critical',
          impactIfWrong: 'All connections fail',
        },
      ],
      indicators: [],
      lowConfidenceCount: 0,
      unknownElements: [],
    };
    wrap(<UncertaintyIndicators summary={summary} />);
    fireEvent.click(screen.getByText(/60%/));
    // Impact is rendered as "Impact: All connections fail" — use substring regex
    expect(screen.getByText(/All connections fail/)).toBeInTheDocument();
  });

  it('sorts assumptions by criticality (critical first)', () => {
    const summary: UncertaintySummary = {
      overallConfidence: 0.7,
      knownUnknowns: [],
      assumptions: [
        { assumption: 'Low impact assumption', criticality: 'low' },
        { assumption: 'Critical assumption first', criticality: 'critical' },
        { assumption: 'Medium assumption', criticality: 'medium' },
      ],
      indicators: [],
      lowConfidenceCount: 0,
      unknownElements: [],
    };
    wrap(<UncertaintyIndicators summary={summary} />);
    fireEvent.click(screen.getByText(/70%/));

    // All assumption texts should be visible
    expect(screen.getByText('Critical assumption first')).toBeInTheDocument();
    expect(screen.getByText('Low impact assumption')).toBeInTheDocument();

    // Critical should appear before Low in DOM: compare their positions
    const critical = screen.getByText('Critical assumption first');
    const low = screen.getByText('Low impact assumption');
    const pos = critical.compareDocumentPosition(low);
    // DOCUMENT_POSITION_FOLLOWING = 4: low comes AFTER critical
    expect(pos & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DecisionRecordViewer — deliberation time formatting edge cases
// ─────────────────────────────────────────────────────────────────────────────

describe('DecisionRecordViewer — deliberation formatting', () => {
  it('shows milliseconds for sub-second deliberation', () => {
    wrap(<DecisionRecordViewer records={[makeRecord({ deliberationTimeMs: 450 })]} />);
    expect(screen.getByText(/450ms/)).toBeInTheDocument();
  });

  it('shows seconds for 1-59 second deliberation', () => {
    wrap(<DecisionRecordViewer records={[makeRecord({ deliberationTimeMs: 30_000 })]} />);
    expect(screen.getByText(/30s/)).toBeInTheDocument();
  });

  it('shows minutes for 60+ second deliberation', () => {
    wrap(<DecisionRecordViewer records={[makeRecord({ deliberationTimeMs: 2 * 60 * 1000 })]} />);
    expect(screen.getByText(/2m$/)).toBeInTheDocument();
  });

  it('shows minutes and seconds for non-round values', () => {
    wrap(<DecisionRecordViewer records={[makeRecord({ deliberationTimeMs: 90_000 })]} />);
    expect(screen.getByText(/1m 30s/)).toBeInTheDocument();
  });

  it('hides deliberation time when not provided', () => {
    wrap(<DecisionRecordViewer records={[makeRecord({ deliberationTimeMs: undefined })]} />);
    expect(screen.queryByText(/⏱/)).not.toBeInTheDocument();
  });

  it('shows modifications block in non-compact mode', () => {
    const record = makeRecord({ modifications: { retries: 3, timeout: 60 } });
    wrap(<DecisionRecordViewer records={[record]} />);
    expect(screen.getByText('Modifications')).toBeInTheDocument();
    expect(screen.getByText(/retries/)).toBeInTheDocument();
  });

  it('hides modifications block in compact mode', () => {
    const record = makeRecord({ modifications: { retries: 3 } });
    wrap(<DecisionRecordViewer records={[record]} compact />);
    expect(screen.queryByText('Modifications')).not.toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// QuestionIntentBar — no optionals edge cases
// ─────────────────────────────────────────────────────────────────────────────

describe('QuestionIntentBar — optional fields edge cases', () => {
  const status: QuestionStatus = 'answering';

  it('renders without follow-up chips when suggestedFollowUps is empty', () => {
    wrap(<QuestionIntentBar question={makeQuestion()} status={status} />);
    expect(screen.queryByText(/Follow-up Questions/i)).not.toBeInTheDocument();
  });

  it('renders without limitations section when limitations is empty', () => {
    wrap(<QuestionIntentBar question={makeQuestion()} status={status} />);
    expect(screen.queryByText(/Known Limitations/i)).not.toBeInTheDocument();
  });

  it('renders without sufficiency statement when not provided', () => {
    wrap(<QuestionIntentBar question={makeQuestion({ sufficiencyStatement: undefined })} status={status} />);
    expect(screen.queryByText(/Agent:/i)).not.toBeInTheDocument();
  });

  it('shows sufficiency statement when provided', () => {
    const question = makeQuestion({ sufficiencyStatement: 'The view covers all critical metrics.' });
    wrap(<QuestionIntentBar question={question} status={status} />);
    expect(screen.getByText(/The view covers all critical metrics./)).toBeInTheDocument();
  });

  it('does not show feedback buttons for non-answered status', () => {
    // Feedback buttons only appear when status === 'answered'
    wrap(<QuestionIntentBar question={makeQuestion()} status="pending" />);
    expect(screen.queryByText(/Adequate/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Refine/i)).not.toBeInTheDocument();
  });

  it('shows feedback buttons for answered status', () => {
    wrap(<QuestionIntentBar question={makeQuestion()} status="answered" />);
    expect(screen.getByText(/✓ Adequate/i)).toBeInTheDocument();
    expect(screen.getByText(/✎ Refine question/i)).toBeInTheDocument();
  });

  it('shows humanFeedback adequate indicator when already given', () => {
    const question = makeQuestion({
      humanFeedback: { adequate: true, feedbackAt: new Date().toISOString() },
    });
    wrap(<QuestionIntentBar question={question} status="answered" />);
    expect(screen.getByText(/✓ Marked as adequate/i)).toBeInTheDocument();
    // Feedback buttons should not show
    expect(screen.queryByText(/✓ Adequate/i)).not.toBeInTheDocument();
  });

  it('shows humanFeedback refined indicator when question was refined', () => {
    const question = makeQuestion({
      humanFeedback: {
        adequate: false,
        refinedQuestion: 'What is the write amplification?',
        feedbackAt: new Date().toISOString(),
      },
    });
    wrap(<QuestionIntentBar question={question} status="answered" />);
    expect(screen.getByText(/✎ Refined/i)).toBeInTheDocument();
  });

  it('background urgency shows info icon', () => {
    wrap(<QuestionIntentBar question={makeQuestion({ urgency: 'background' })} status={status} />);
    expect(screen.getByText('ℹ')).toBeInTheDocument();
  });

  it('normal urgency shows dot icon', () => {
    wrap(<QuestionIntentBar question={makeQuestion({ urgency: 'normal' })} status={status} />);
    expect(screen.getByText('●')).toBeInTheDocument();
  });
});
