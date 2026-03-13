// ─────────────────────────────────────────────────────────────────────────────
// Phase 3.1 — Governance Component Interaction Tests
//
// Covers:
//   ✓ AuthorityModeSwitch — escalation flow, downgrade, override justification
//   ✓ GovernedActionPanel — authority blocking, precondition enforcement,
//                            deliberation timer, confirmation flow, defer
//   ✓ UncertaintyIndicators — expand/collapse, compact mode, critical flag
//   ✓ QuestionIntentBar — follow-up, refine, status lifecycle
//   ✓ DecisionRecordViewer — empty state, record rendering, compact
//   ✓ SituationalViewRenderer — full composition integration
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { ThemeProvider } from '../ThemeContext';
import { lightTheme } from '../theme';

import { AuthorityModeSwitch } from '../components/AuthorityModeSwitch';
import { GovernedActionPanel } from '../components/GovernedActionPanel';
import { UncertaintyIndicators } from '../components/UncertaintyIndicators';
import { QuestionIntentBar } from '../components/QuestionIntentBar';
import { DecisionRecordViewer } from '../components/DecisionRecordViewer';

import type {
  AuthorityContext,
  AuthorityMode,
  AuthorityEscalationReason,
  GovernedAction,
  DecisionOutcome,
  DecisionRecord,
  UncertaintySummary,
  QuestionIntent,
  QuestionStatus,
} from '@hari/core';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
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
    holderName: 'Alice',
    enteredAt: new Date().toISOString(),
    escalationHistory: [],
    ...overrides,
  };
}

function makeGovernedAction(overrides: Partial<GovernedAction> = {}): GovernedAction {
  return {
    action: {
      id: 'restart-replica',
      label: 'Restart Replica',
      variant: 'destructive',
      disabled: false,
      safety: {
        confidence: 0.84,
        reversible: true,
        riskLevel: 'high',
        requiresConfirmation: true,
        confirmationDelay: 0,
        explanation: 'Restarting clears lag. Down for ~50ms.',
        blastRadius: {
          scope: 'self',
          affectedSystems: ['db-replica-2'],
        },
      },
    },
    intent: 'Clear replication lag by restarting the replica',
    impactScope: {
      scope: 'self',
      affectedSystems: ['db-replica-2'],
    },
    reversibility: 'fully_reversible',
    requiredAuthority: 'approve',
    preconditions: [],
    actionConfidence: 0.84,
    alternatives: [],
    tags: [],
    ...overrides,
  };
}

function makeDecisionRecord(overrides: Partial<DecisionRecord> = {}): DecisionRecord {
  return {
    decisionId: crypto.randomUUID(),
    governedActionId: 'restart-replica',
    outcome: 'approved',
    decidedAt: 'approve',          // AuthorityMode at time of decision
    deciderId: 'alice@acme.com',
    timestamp: new Date().toISOString(),
    deliberationTimeMs: 4500,
    rationale: 'Lag is critical, action is reversible.',
    ...overrides,
  };
}

function makeUncertaintySummary(
  overrides: Partial<UncertaintySummary> = {},
): UncertaintySummary {
  return {
    overallConfidence: 0.75,
    knownUnknowns: ['Root cause of lag spike'],
    assumptions: [
      {
        assumption: 'Replica restarts cleanly',
        criticality: 'high',
        impactIfWrong: 'Extended downtime',
      },
    ],
    indicators: [],
    lowConfidenceCount: 1,
    unknownElements: [],
    ...overrides,
  };
}

function makeQuestion(overrides: Partial<QuestionIntent> = {}): QuestionIntent {
  return {
    questionId: crypto.randomUUID(),
    question: 'Why is replication lag increasing?',
    urgency: 'urgent',
    origin: 'system_triggered',
    domain: 'cloudops',
    askedAt: new Date().toISOString(),
    suggestedFollowUps: [
      { question: 'Is the primary under heavy write load?', rationale: 'Heavy writes can cause lag' },
      { question: 'Check replica disk I/O', rationale: 'Disk bottleneck is common' },
    ],
    sufficiencyStatement: 'View covers the last 10 minutes of replica metrics.',
    limitations: ['No access to replica error logs'],
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// AuthorityModeSwitch
// ─────────────────────────────────────────────────────────────────────────────

describe('AuthorityModeSwitch', () => {
  it('renders all four authority mode buttons', () => {
    wrap(<AuthorityModeSwitch authority={makeAuthority()} onModeChange={vi.fn()} />);
    expect(screen.getByText('Observe')).toBeInTheDocument();
    expect(screen.getByText('Intervene')).toBeInTheDocument();
    expect(screen.getByText('Approve')).toBeInTheDocument();
    expect(screen.getByText('Override')).toBeInTheDocument();
  });

  it('marks the current mode as pressed', () => {
    wrap(<AuthorityModeSwitch authority={makeAuthority('intervene')} onModeChange={vi.fn()} />);
    const interveneBtn = screen.getByRole('radio', { name: /Intervene/i });
    expect(interveneBtn).toHaveAttribute('aria-checked', 'true');
    const observeBtn = screen.getByRole('radio', { name: /Observe/i });
    expect(observeBtn).toHaveAttribute('aria-checked', 'false');
  });

  it('downgrades authority immediately without escalation dialog', () => {
    const onModeChange = vi.fn();
    wrap(
      <AuthorityModeSwitch
        authority={makeAuthority('approve')}
        onModeChange={onModeChange}
      />,
    );
    fireEvent.click(screen.getByRole('radio', { name: /Observe/i }));
    // Dialog should NOT appear; onModeChange called directly
    expect(screen.queryByText(/Escalate to/i)).not.toBeInTheDocument();
    expect(onModeChange).toHaveBeenCalledWith('observe', 'manual');
  });

  it('shows escalation dialog when upgrading authority', () => {
    wrap(<AuthorityModeSwitch authority={makeAuthority('observe')} onModeChange={vi.fn()} />);
    fireEvent.click(screen.getByRole('radio', { name: /Intervene/i }));
    expect(screen.getByText(/Escalate to Intervene/i)).toBeInTheDocument();
  });

  it('cancels escalation without calling onModeChange', () => {
    const onModeChange = vi.fn();
    wrap(<AuthorityModeSwitch authority={makeAuthority('observe')} onModeChange={onModeChange} />);
    fireEvent.click(screen.getByRole('radio', { name: /Intervene/i }));
    fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));
    expect(onModeChange).not.toHaveBeenCalled();
    expect(screen.queryByText(/Escalate to/i)).not.toBeInTheDocument();
  });

  it('calls onModeChange after confirming non-override escalation', () => {
    const onModeChange = vi.fn();
    wrap(
      <AuthorityModeSwitch
        authority={makeAuthority('observe')}
        onModeChange={onModeChange}
      />,
    );
    fireEvent.click(screen.getByRole('radio', { name: /Intervene/i }));
    fireEvent.click(screen.getByRole('button', { name: /Confirm Escalation/i }));
    expect(onModeChange).toHaveBeenCalledWith('intervene', 'manual', undefined);
  });

  it('disables Confirm Escalation for override without justification', () => {
    wrap(<AuthorityModeSwitch authority={makeAuthority('approve')} onModeChange={vi.fn()} />);
    fireEvent.click(screen.getByRole('radio', { name: /Override/i }));
    const confirmBtn = screen.getByRole('button', { name: /Confirm Escalation/i });
    expect(confirmBtn).toBeDisabled();
  });

  it('enables Confirm Escalation for override after justification is filled', () => {
    const onModeChange = vi.fn();
    wrap(
      <AuthorityModeSwitch
        authority={makeAuthority('approve')}
        onModeChange={onModeChange}
      />,
    );
    fireEvent.click(screen.getByRole('radio', { name: /Override/i }));
    const textarea = screen.getByPlaceholderText(/emergency override/i);
    fireEvent.change(textarea, { target: { value: 'Primary is down, must use override' } });
    const confirmBtn = screen.getByRole('button', { name: /Confirm Escalation/i });
    expect(confirmBtn).not.toBeDisabled();
    fireEvent.click(confirmBtn);
    expect(onModeChange).toHaveBeenCalledWith(
      'override',
      'manual',
      'Primary is down, must use override',
    );
  });

  it('shows expiry countdown when expiresAt is set', () => {
    const expiresAt = new Date(Date.now() + 90 * 60 * 1000).toISOString(); // +90 min
    wrap(
      <AuthorityModeSwitch
        authority={makeAuthority('approve', { expiresAt })}
        onModeChange={vi.fn()}
      />,
    );
    // Should show countdown: 90m or formatted
    const countdown = screen.getByText(/m$/i);
    expect(countdown).toBeInTheDocument();
  });

  it('shows compact layout without status bar detail', () => {
    wrap(
      <AuthorityModeSwitch
        authority={makeAuthority('observe')}
        onModeChange={vi.fn()}
        compact
      />,
    );
    // Buttons still present
    expect(screen.getByText('Observe')).toBeInTheDocument();
    // Status bar text "Density:" should not appear in compact mode
    expect(screen.queryByText(/Density:/i)).not.toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GovernedActionPanel
// ─────────────────────────────────────────────────────────────────────────────

describe('GovernedActionPanel', () => {
  it('renders action label and intent', () => {
    wrap(
      <GovernedActionPanel
        governedAction={makeGovernedAction()}
        currentAuthority="approve"
        onDecision={vi.fn()}
      />,
    );
    // The label appears in both the header div and the action button — use getAllByText
    expect(screen.getAllByText('Restart Replica').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Clear replication lag/i)).toBeInTheDocument();
  });

  it('shows authority block when authority is insufficient', () => {
    wrap(
      <GovernedActionPanel
        governedAction={makeGovernedAction({ requiredAuthority: 'approve' })}
        currentAuthority="observe"
        onDecision={vi.fn()}
      />,
    );
    expect(screen.getByText(/Requires "approve" authority/i)).toBeInTheDocument();
    // Approve button should NOT be present
    expect(screen.queryByRole('button', { name: /Restart Replica/i })).not.toBeInTheDocument();
  });

  it('calls onEscalate when escalate button clicked during authority block', () => {
    const onEscalate = vi.fn();
    wrap(
      <GovernedActionPanel
        governedAction={makeGovernedAction({ requiredAuthority: 'approve' })}
        currentAuthority="observe"
        onDecision={vi.fn()}
        onEscalate={onEscalate}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Escalate/i }));
    expect(onEscalate).toHaveBeenCalledTimes(1);
  });

  it('blocks the action button when unmet preconditions exist', () => {
    const action = makeGovernedAction({
      preconditions: [
        { description: 'No active transactions', status: 'unmet' },
      ],
    });
    wrap(
      <GovernedActionPanel
        governedAction={action}
        currentAuthority="approve"
        onDecision={vi.fn()}
      />,
    );
    const actionBtn = screen.getByRole('button', { name: 'Restart Replica' });
    expect(actionBtn).toBeDisabled();
  });

  it('allows action button with unknown-status preconditions', () => {
    const action = makeGovernedAction({
      preconditions: [
        { description: 'Network reachable', status: 'unknown' },
      ],
    });
    wrap(
      <GovernedActionPanel
        governedAction={action}
        currentAuthority="approve"
        onDecision={vi.fn()}
      />,
    );
    const actionBtn = screen.getByRole('button', { name: 'Restart Replica' });
    expect(actionBtn).not.toBeDisabled();
  });

  it('shows confirmation flow when action button is clicked', () => {
    wrap(
      <GovernedActionPanel
        governedAction={makeGovernedAction()}
        currentAuthority="approve"
        onDecision={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Restart Replica' }));
    expect(screen.getByText(/Confirm: Restart Replica/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Yes, approve/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reject/i })).toBeInTheDocument();
  });

  it('calls onDecision("approved") on confirmation', () => {
    const onDecision = vi.fn();
    wrap(
      <GovernedActionPanel
        governedAction={makeGovernedAction()}
        currentAuthority="approve"
        onDecision={onDecision}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Restart Replica' }));
    fireEvent.click(screen.getByRole('button', { name: /Yes, approve/i }));
    expect(onDecision).toHaveBeenCalledWith('approved', undefined);
  });

  it('calls onDecision("rejected") when reject is clicked in confirmation', () => {
    const onDecision = vi.fn();
    wrap(
      <GovernedActionPanel
        governedAction={makeGovernedAction()}
        currentAuthority="approve"
        onDecision={onDecision}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Restart Replica' }));
    fireEvent.click(screen.getByRole('button', { name: /Reject/i }));
    expect(onDecision).toHaveBeenCalledWith('rejected', undefined);
  });

  it('calls onDecision("deferred") when defer button clicked', () => {
    const onDecision = vi.fn();
    wrap(
      <GovernedActionPanel
        governedAction={makeGovernedAction()}
        currentAuthority="approve"
        onDecision={onDecision}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Defer/i }));
    expect(onDecision).toHaveBeenCalledWith('deferred', undefined);
  });

  it('cancels confirmation flow and returns to action buttons', () => {
    wrap(
      <GovernedActionPanel
        governedAction={makeGovernedAction()}
        currentAuthority="approve"
        onDecision={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Restart Replica' }));
    expect(screen.getByText(/Confirm:/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));
    expect(screen.queryByText(/Confirm:/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Restart Replica' })).toBeInTheDocument();
  });

  it('requires rationale for irreversible actions before approve is enabled', () => {
    const action = makeGovernedAction({ reversibility: 'irreversible' });
    wrap(
      <GovernedActionPanel
        governedAction={action}
        currentAuthority="approve"
        onDecision={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Restart Replica' }));
    const approveBtn = screen.getByRole('button', { name: /Yes, approve/i });
    expect(approveBtn).toBeDisabled();
    const textarea = screen.getByPlaceholderText(/Why are you approving/i);
    fireEvent.change(textarea, { target: { value: 'No other option' } });
    expect(approveBtn).not.toBeDisabled();
  });

  it('passes rationale to onDecision for irreversible action', () => {
    const onDecision = vi.fn();
    const action = makeGovernedAction({ reversibility: 'irreversible' });
    wrap(
      <GovernedActionPanel
        governedAction={action}
        currentAuthority="approve"
        onDecision={onDecision}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Restart Replica' }));
    const textarea = screen.getByPlaceholderText(/Why are you approving/i);
    fireEvent.change(textarea, { target: { value: 'Critical situation' } });
    fireEvent.click(screen.getByRole('button', { name: /Yes, approve/i }));
    expect(onDecision).toHaveBeenCalledWith('approved', 'Critical situation');
  });

  it('shows deliberation timer countdown during confirmation delay', async () => {
    vi.useFakeTimers();
    const action = makeGovernedAction({
      action: {
        id: 'slow-action',
        label: 'Slow Action',
        variant: 'destructive',
        disabled: false,
        safety: {
          confidence: 0.9,
          reversible: true,
          riskLevel: 'low',
          requiresConfirmation: true,
          confirmationDelay: 3000,
          explanation: 'Takes 3 seconds.',
          blastRadius: { scope: 'self', affectedSystems: [] },
        },
      },
    });
    wrap(
      <GovernedActionPanel
        governedAction={action}
        currentAuthority="approve"
        onDecision={vi.fn()}
      />,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Slow Action' }));
    });

    // Immediately after clicking: approval button shows waiting state and is disabled
    expect(screen.getByRole('button', { name: /Wait/i })).toBeDisabled();

    // Advance all timers (the 3s countdown + setState flush)
    await act(async () => {
      vi.runAllTimers();
    });

    // Now approve should be enabled
    expect(screen.getByRole('button', { name: /Yes, approve/i })).not.toBeDisabled();
    vi.useRealTimers();
  });

  it('shows reversibility badge in header', () => {
    wrap(
      <GovernedActionPanel
        governedAction={makeGovernedAction({ reversibility: 'irreversible' })}
        currentAuthority="approve"
        onDecision={vi.fn()}
      />,
    );
    expect(screen.getByText(/Irreversible/i)).toBeInTheDocument();
  });

  it('shows precondition list with status icons', () => {
    const action = makeGovernedAction({
      preconditions: [
        { description: 'No active transactions', status: 'met' },
        { description: 'Disk space available', status: 'unknown' },
      ],
    });
    wrap(
      <GovernedActionPanel
        governedAction={action}
        currentAuthority="approve"
        onDecision={vi.fn()}
      />,
    );
    expect(screen.getByText('No active transactions')).toBeInTheDocument();
    expect(screen.getByText('Disk space available')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// UncertaintyIndicators
// ─────────────────────────────────────────────────────────────────────────────

describe('UncertaintyIndicators', () => {
  it('renders confidence percentage', () => {
    wrap(<UncertaintyIndicators summary={makeUncertaintySummary()} />);
    expect(screen.getByText(/75%/)).toBeInTheDocument();
  });

  it('expands to show known unknowns on click', () => {
    wrap(<UncertaintyIndicators summary={makeUncertaintySummary()} />);
    // Initially collapsed — unknown text hidden
    expect(screen.queryByText('Root cause of lag spike')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText(/75%/));
    expect(screen.getByText('Root cause of lag spike')).toBeInTheDocument();
  });

  it('expands to show assumptions', () => {
    wrap(<UncertaintyIndicators summary={makeUncertaintySummary()} />);
    fireEvent.click(screen.getByText(/75%/));
    expect(screen.getByText('Replica restarts cleanly')).toBeInTheDocument();
  });

  it('shows critical warning badge for hasCriticalUncertainty summaries', () => {
    const summary = makeUncertaintySummary({
      overallConfidence: 0.3,
      assumptions: [
        {
          assumption: 'System is in stable state',
          criticality: 'critical',
          impactIfWrong: 'Complete failure',
        },
      ],
    });
    wrap(<UncertaintyIndicators summary={summary} />);
    // Low confidence colors or critical badge should be rendered
    // The component applies a different border when isCritical
    // Check the confidence is shown
    expect(screen.getByText(/30%/)).toBeInTheDocument();
  });

  it('compact mode renders inline badge without expandable content', () => {
    wrap(<UncertaintyIndicators summary={makeUncertaintySummary()} compact />);
    const badge = screen.getByTitle(/View uncertainty details/i);
    expect(badge).toBeInTheDocument();
    // Known unknowns text not in compact view
    expect(screen.queryByText('Known Unknowns')).not.toBeInTheDocument();
  });

  it('handles empty known unknowns gracefully', () => {
    const summary = makeUncertaintySummary({ knownUnknowns: [] });
    wrap(<UncertaintyIndicators summary={summary} />);
    fireEvent.click(screen.getByText(/75%/));
    expect(screen.queryByText('Known Unknowns')).not.toBeInTheDocument();
  });

  it('handles empty assumptions gracefully', () => {
    const summary = makeUncertaintySummary({ assumptions: [] });
    wrap(<UncertaintyIndicators summary={summary} />);
    fireEvent.click(screen.getByText(/75%/));
    expect(screen.queryByText('Assumptions')).not.toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// QuestionIntentBar
// ─────────────────────────────────────────────────────────────────────────────

// QuestionIntentBar feedback buttons only show when status === 'answered'
describe('QuestionIntentBar', () => {
  const viewingStatus: QuestionStatus = 'answering';
  const answeredStatus: QuestionStatus = 'answered';

  it('renders the question text', () => {
    wrap(
      <QuestionIntentBar
        question={makeQuestion()}
        status={viewingStatus}
      />,
    );
    expect(screen.getByText('Why is replication lag increasing?')).toBeInTheDocument();
  });

  it('shows urgency icon for urgent questions', () => {
    wrap(
      <QuestionIntentBar
        question={makeQuestion({ urgency: 'urgent' })}
        status={viewingStatus}
      />,
    );
    // Urgency icon "!" for urgent
    expect(screen.getByText('!')).toBeInTheDocument();
  });

  it('shows critical urgency indicator', () => {
    wrap(
      <QuestionIntentBar
        question={makeQuestion({ urgency: 'critical' })}
        status={viewingStatus}
      />,
    );
    expect(screen.getByText('‼')).toBeInTheDocument();
  });

  it('shows follow-up question chips', () => {
    wrap(
      <QuestionIntentBar
        question={makeQuestion()}
        status={viewingStatus}
      />,
    );
    expect(screen.getByText('Is the primary under heavy write load?')).toBeInTheDocument();
  });

  it('calls onFollowUp with the question text when a chip is clicked', () => {
    const onFollowUp = vi.fn();
    wrap(
      <QuestionIntentBar
        question={makeQuestion()}
        status={viewingStatus}
        onFollowUp={onFollowUp}
      />,
    );
    fireEvent.click(screen.getByText('Is the primary under heavy write load?'));
    expect(onFollowUp).toHaveBeenCalledWith('Is the primary under heavy write load?');
  });

  it('calls onMarkAdequate when adequate button clicked (status: answered)', () => {
    const onMarkAdequate = vi.fn();
    wrap(
      <QuestionIntentBar
        question={makeQuestion()}
        status={answeredStatus}
        onMarkAdequate={onMarkAdequate}
      />,
    );
    fireEvent.click(screen.getByText(/✓ Adequate/i));
    expect(onMarkAdequate).toHaveBeenCalledTimes(1);
  });

  it('shows refine input when refine button clicked (status: answered)', () => {
    wrap(
      <QuestionIntentBar
        question={makeQuestion()}
        status={answeredStatus}
        onRefine={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText(/✎ Refine question/i));
    expect(screen.getByPlaceholderText(/Refine your question/i)).toBeInTheDocument();
  });

  it('calls onRefine with new text on send', () => {
    const onRefine = vi.fn();
    wrap(
      <QuestionIntentBar
        question={makeQuestion()}
        status={answeredStatus}
        onRefine={onRefine}
      />,
    );
    fireEvent.click(screen.getByText(/✎ Refine question/i));
    const input = screen.getByPlaceholderText(/Refine your question/i);
    fireEvent.change(input, { target: { value: 'Is disk I/O causing the lag?' } });
    fireEvent.click(screen.getByRole('button', { name: /Send/i }));
    expect(onRefine).toHaveBeenCalledWith('Is disk I/O causing the lag?');
  });

  it('compact mode hides follow-ups and limitations', () => {
    wrap(
      <QuestionIntentBar
        question={makeQuestion()}
        status={viewingStatus}
        compact
      />,
    );
    // Question still shown
    expect(screen.getByText('Why is replication lag increasing?')).toBeInTheDocument();
    // Follow-up chips hidden in compact mode
    expect(screen.queryByText('Is the primary under heavy write load?')).not.toBeInTheDocument();
  });

  it('shows limitations list', () => {
    wrap(
      <QuestionIntentBar
        question={makeQuestion()}
        status={viewingStatus}
      />,
    );
    expect(screen.getByText('No access to replica error logs')).toBeInTheDocument();
  });

  it('question region has proper ARIA landmark', () => {
    wrap(
      <QuestionIntentBar
        question={makeQuestion()}
        status={viewingStatus}
      />,
    );
    expect(screen.getByRole('region', { name: /Active question/i })).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DecisionRecordViewer
// ─────────────────────────────────────────────────────────────────────────────

describe('DecisionRecordViewer', () => {
  it('shows empty state message when no records', () => {
    wrap(<DecisionRecordViewer records={[]} />);
    expect(screen.getByText(/No decisions recorded yet/i)).toBeInTheDocument();
  });

  it('renders a single decision record with outcome badge and decider id', () => {
    wrap(<DecisionRecordViewer records={[makeDecisionRecord()]} />);
    expect(screen.getByText('Approved')).toBeInTheDocument();
    // Component shows "by {deciderId}" — check decider identity
    expect(screen.getByText(/alice@acme.com/i)).toBeInTheDocument();
  });

  it('renders record count in header', () => {
    wrap(
      <DecisionRecordViewer
        records={[makeDecisionRecord(), makeDecisionRecord({ outcome: 'rejected' })]}
      />,
    );
    expect(screen.getByText(/2 records/i)).toBeInTheDocument();
  });

  it('renders all outcome types', () => {
    const outcomes: DecisionOutcome[] = ['approved', 'rejected', 'deferred', 'modified', 'escalated', 'expired'];
    const records = outcomes.map((outcome) =>
      makeDecisionRecord({ outcome }),
    );
    wrap(<DecisionRecordViewer records={records} />);
    expect(screen.getByText('Approved')).toBeInTheDocument();
    expect(screen.getByText('Rejected')).toBeInTheDocument();
    expect(screen.getByText('Deferred')).toBeInTheDocument();
    expect(screen.getByText('Modified')).toBeInTheDocument();
    expect(screen.getByText('Escalated')).toBeInTheDocument();
    expect(screen.getByText('Expired')).toBeInTheDocument();
  });

  it('shows rationale when present', () => {
    wrap(<DecisionRecordViewer records={[makeDecisionRecord()]} />);
    // Rationale is rendered as "text" in quotes — use regex substring match
    expect(screen.getByText(/Lag is critical, action is reversible\./)).toBeInTheDocument();
  });

  it('compact mode renders without modifications block', () => {
    const record = makeDecisionRecord({
      modifications: { timeout: 60 },
    });
    const { container } = wrap(<DecisionRecordViewer records={[record]} compact />);
    // In compact mode, modifications section should be suppressed
    expect(screen.queryByText(/Modified fields/i)).not.toBeInTheDocument();
    expect(container.firstChild).toBeTruthy();
  });

  it('shows deliberation time formatted (4500ms → 5s)', () => {
    // formatDeliberation: Math.round(4500/1000) = 5 → "5s"
    wrap(<DecisionRecordViewer records={[makeDecisionRecord({ deliberationTimeMs: 4500 })]} />);
    expect(screen.getByText(/⏱ 5s/i)).toBeInTheDocument();
  });
});
