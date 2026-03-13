// ─────────────────────────────────────────────────────────────────────────────
// Phase 3.3 — Governance Component Accessibility & UX Polish Tests
//
// Covers:
//   ✓ AuthorityModeSwitch — radiogroup semantics, aria-checked, aria-live countdown,
//                            role=dialog escalation modal, keyboard trigger
//   ✓ UncertaintyIndicators — role=region, aria-expanded toggle, keyboard expand,
//                              role=list / role=listitem for assumptions
//   ✓ GovernedActionPanel — role=alert for authority block, role=form confirmation,
//                            aria-disabled on blocked action button
//   ✓ DecisionRecordViewer — role=list timeline, role=listitem per record,
//                             aria-label on timeline container
//   ✓ QuestionIntentBar — role=region, urgency aria-label, follow-up chips labelled
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from '../ThemeContext';
import { lightTheme } from '../theme';

import { AuthorityModeSwitch } from '../components/AuthorityModeSwitch';
import { GovernedActionPanel } from '../components/GovernedActionPanel';
import { UncertaintyIndicators } from '../components/UncertaintyIndicators';
import { DecisionRecordViewer } from '../components/DecisionRecordViewer';
import { QuestionIntentBar } from '../components/QuestionIntentBar';

import type {
  AuthorityContext,
  AuthorityMode,
  GovernedAction,
  DecisionRecord,
  UncertaintySummary,
  QuestionIntent,
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
    },
    intent: 'Clear replication lag',
    impactScope: { scope: 'self', affectedSystems: ['db-replica-2'] },
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
    decidedAt: 'approve',
    deciderId: 'alice@acme.com',
    timestamp: new Date().toISOString(),
    modifications: {},
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
      { assumption: 'Replica restarts cleanly', criticality: 'high' },
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
      { question: 'Check primary write load?', rationale: 'Heavy writes cause lag' },
    ],
    limitations: [],
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// AuthorityModeSwitch — Accessibility
// ─────────────────────────────────────────────────────────────────────────────

describe('AuthorityModeSwitch — Accessibility', () => {
  it('mode container has role="radiogroup" and accessible label', () => {
    wrap(
      <AuthorityModeSwitch
        authority={makeAuthority('observe')}
        onModeChange={vi.fn()}
      />,
    );
    expect(screen.getByRole('radiogroup', { name: /authority mode/i })).toBeInTheDocument();
  });

  it('each mode button has role="radio"', () => {
    wrap(
      <AuthorityModeSwitch
        authority={makeAuthority('observe')}
        onModeChange={vi.fn()}
      />,
    );
    const radios = screen.getAllByRole('radio');
    expect(radios.length).toBe(4); // observe, suggest, approve, override
  });

  it('active mode button has aria-checked="true"', () => {
    wrap(
      <AuthorityModeSwitch
        authority={makeAuthority('approve')}
        onModeChange={vi.fn()}
      />,
    );
    const approveRadio = screen.getByRole('radio', { name: /approve/i });
    expect(approveRadio).toHaveAttribute('aria-checked', 'true');
  });

  it('inactive mode buttons have aria-checked="false"', () => {
    wrap(
      <AuthorityModeSwitch
        authority={makeAuthority('observe')}
        onModeChange={vi.fn()}
      />,
    );
    const approveRadio = screen.getByRole('radio', { name: /approve/i });
    expect(approveRadio).toHaveAttribute('aria-checked', 'false');
  });

  it('expiry countdown span has aria-live="polite"', () => {
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    wrap(
      <AuthorityModeSwitch
        authority={makeAuthority('approve', { expiresAt })}
        onModeChange={vi.fn()}
      />,
    );
    const liveRegion = screen.getByText(/30m/).closest('[aria-live]');
    expect(liveRegion).toHaveAttribute('aria-live', 'polite');
  });

  it('expiry span has aria-label describing expiry', () => {
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    wrap(
      <AuthorityModeSwitch
        authority={makeAuthority('approve', { expiresAt })}
        onModeChange={vi.fn()}
      />,
    );
    const liveRegion = screen.getByLabelText(/authority expires/i);
    expect(liveRegion).toBeInTheDocument();
  });

  it('clicking an escalation button opens role="dialog"', () => {
    wrap(
      <AuthorityModeSwitch
        authority={makeAuthority('observe')}
        onModeChange={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('radio', { name: /approve/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('escalation dialog has aria-modal="true"', () => {
    wrap(
      <AuthorityModeSwitch
        authority={makeAuthority('observe')}
        onModeChange={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('radio', { name: /approve/i }));
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
  });

  it('escalation dialog has an accessible label describing the target mode', () => {
    wrap(
      <AuthorityModeSwitch
        authority={makeAuthority('observe')}
        onModeChange={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('radio', { name: /approve/i }));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-label', expect.stringMatching(/Approve/i));
  });

  it('each mode button has a descriptive aria-label', () => {
    wrap(
      <AuthorityModeSwitch
        authority={makeAuthority('observe')}
        onModeChange={vi.fn()}
      />,
    );
    const observeBtn = screen.getByRole('radio', { name: /observe/i });
    // aria-label should include mode name
    expect(observeBtn.getAttribute('aria-label')).toMatch(/observe/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// UncertaintyIndicators — Accessibility
// ─────────────────────────────────────────────────────────────────────────────

describe('UncertaintyIndicators — Accessibility', () => {
  it('outer container has role="region"', () => {
    wrap(<UncertaintyIndicators summary={makeUncertaintySummary()} />);
    expect(screen.getByRole('region', { name: /confidence/i })).toBeInTheDocument();
  });

  it('toggle header has role="button" and aria-expanded=false initially', () => {
    wrap(<UncertaintyIndicators summary={makeUncertaintySummary()} />);
    expect(screen.getByRole('button', { hidden: false })).toHaveAttribute('aria-expanded', 'false');
  });

  it('aria-expanded toggles to true after click', () => {
    wrap(<UncertaintyIndicators summary={makeUncertaintySummary()} />);
    const toggle = screen.getByRole('button');
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });

  it('aria-expanded goes back to false on second click', () => {
    wrap(<UncertaintyIndicators summary={makeUncertaintySummary()} />);
    const toggle = screen.getByRole('button');
    fireEvent.click(toggle);
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  it('Space key expands the details', () => {
    wrap(<UncertaintyIndicators summary={makeUncertaintySummary()} />);
    const toggle = screen.getByRole('button');
    fireEvent.keyDown(toggle, { key: ' ' });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });

  it('Enter key expands the details', () => {
    wrap(<UncertaintyIndicators summary={makeUncertaintySummary()} />);
    const toggle = screen.getByRole('button');
    fireEvent.keyDown(toggle, { key: 'Enter' });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });

  it('expanded assumptions use role="list"', () => {
    wrap(<UncertaintyIndicators summary={makeUncertaintySummary()} />);
    fireEvent.click(screen.getByRole('button'));
    // both known-unknowns and assumptions are rendered as ul[role=list]
    const lists = screen.getAllByRole('list');
    expect(lists.length).toBeGreaterThanOrEqual(1);
  });

  it('each assumption uses role="listitem"', () => {
    wrap(
      <UncertaintyIndicators
        summary={makeUncertaintySummary({
          assumptions: [
            { assumption: 'Assumption A', criticality: 'critical' },
            { assumption: 'Assumption B', criticality: 'low' },
          ],
        })}
      />,
    );
    fireEvent.click(screen.getByRole('button'));
    const items = screen.getAllByRole('listitem');
    expect(items.length).toBeGreaterThanOrEqual(2);
  });

  it('toggle has tabIndex=0 so it is keyboard-focusable', () => {
    wrap(<UncertaintyIndicators summary={makeUncertaintySummary()} />);
    const toggle = screen.getByRole('button');
    expect(toggle).toHaveAttribute('tabindex', '0');
  });

  it('assumptions section label "Assumptions" appears when expanded', () => {
    wrap(<UncertaintyIndicators summary={makeUncertaintySummary()} />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('Assumptions')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GovernedActionPanel — Accessibility
// ─────────────────────────────────────────────────────────────────────────────

describe('GovernedActionPanel — Accessibility', () => {
  it('authority-required block has role="alert"', () => {
    wrap(
      <GovernedActionPanel
        governedAction={makeGovernedAction({ requiredAuthority: 'override' })}
        currentAuthority="observe"
        onDecision={vi.fn()}
      />,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('alert block announces required authority level', () => {
    wrap(
      <GovernedActionPanel
        governedAction={makeGovernedAction({ requiredAuthority: 'override' })}
        currentAuthority="observe"
        onDecision={vi.fn()}
      />,
    );
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toMatch(/override/i);
  });

  it('action button has aria-disabled="true" when preconditions block it', () => {
    const action = makeGovernedAction({
      requiredAuthority: 'approve',
      preconditions: [{ description: 'Health OK', status: 'unmet' }],
    });
    wrap(
      <GovernedActionPanel
        governedAction={action}
        currentAuthority="approve"
        onDecision={vi.fn()}
      />,
    );
    const btn = screen.getByRole('button', { name: /restart replica/i });
    expect(btn).toHaveAttribute('aria-disabled', 'true');
  });

  it('action button does NOT have aria-disabled when all preconditions pass', () => {
    const action = makeGovernedAction({
      requiredAuthority: 'approve',
      preconditions: [{ description: 'Health OK', status: 'met' }],
    });
    wrap(
      <GovernedActionPanel
        governedAction={action}
        currentAuthority="approve"
        onDecision={vi.fn()}
      />,
    );
    const btn = screen.getByRole('button', { name: /restart replica/i });
    expect(btn).not.toHaveAttribute('aria-disabled', 'true');
  });

  it('confirmation section has role="form" after clicking action', () => {
    wrap(
      <GovernedActionPanel
        governedAction={makeGovernedAction({ requiredAuthority: 'approve' })}
        currentAuthority="approve"
        onDecision={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /restart replica/i }));
    expect(screen.getByRole('form')).toBeInTheDocument();
  });

  it('confirmation form is labelled "Confirm action"', () => {
    wrap(
      <GovernedActionPanel
        governedAction={makeGovernedAction({ requiredAuthority: 'approve' })}
        currentAuthority="approve"
        onDecision={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /restart replica/i }));
    expect(screen.getByRole('form', { name: /confirm action/i })).toBeInTheDocument();
  });

  it('escalate button is rendered inside alert when onEscalate is provided', () => {
    wrap(
      <GovernedActionPanel
        governedAction={makeGovernedAction({ requiredAuthority: 'override' })}
        currentAuthority="observe"
        onDecision={vi.fn()}
        onEscalate={vi.fn()}
      />,
    );
    const alert = screen.getByRole('alert');
    expect(alert.querySelector('button')).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DecisionRecordViewer — Accessibility
// ─────────────────────────────────────────────────────────────────────────────

describe('DecisionRecordViewer — Accessibility', () => {
  it('timeline container has role="list"', () => {
    wrap(
      <DecisionRecordViewer records={[makeDecisionRecord()]} />,
    );
    expect(screen.getByRole('list', { name: /decision audit/i })).toBeInTheDocument();
  });

  it('each decision record has role="listitem"', () => {
    wrap(
      <DecisionRecordViewer
        records={[
          makeDecisionRecord({ outcome: 'approved' }),
          makeDecisionRecord({ outcome: 'rejected' }),
        ]}
      />,
    );
    expect(screen.getAllByRole('listitem').length).toBe(2);
  });

  it('listitem has aria-label describing the outcome', () => {
    wrap(
      <DecisionRecordViewer records={[makeDecisionRecord({ outcome: 'approved' })]} />,
    );
    const item = screen.getByRole('listitem');
    expect(item).toHaveAttribute('aria-label', expect.stringMatching(/approved/i));
  });

  it('empty state renders without list role', () => {
    wrap(<DecisionRecordViewer records={[]} />);
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('timeline aria-label is accessible from assistive technology', () => {
    wrap(
      <DecisionRecordViewer records={[makeDecisionRecord()]} />,
    );
    const list = screen.getByRole('list');
    expect(list).toHaveAttribute('aria-label');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// QuestionIntentBar — Accessibility
// ─────────────────────────────────────────────────────────────────────────────

describe('QuestionIntentBar — Accessibility', () => {
  it('outer container has role="region"', () => {
    wrap(
      <QuestionIntentBar
        question={makeQuestion()}
        status="pending"
        onFollowUp={vi.fn()}
        onRefine={vi.fn()}
      />,
    );
    expect(screen.getByRole('region', { name: /active question/i })).toBeInTheDocument();
  });

  it('urgency badge has an aria-label', () => {
    wrap(
      <QuestionIntentBar
        question={makeQuestion({ urgency: 'critical' })}
        status="pending"
        onFollowUp={vi.fn()}
        onRefine={vi.fn()}
      />,
    );
    expect(screen.getByLabelText(/urgency/i)).toBeInTheDocument();
  });

  it('follow-up chips are rendered as buttons when status is answered', () => {
    wrap(
      <QuestionIntentBar
        question={makeQuestion()}
        status="answered"
        onFollowUp={vi.fn()}
        onRefine={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: /check primary write load/i })).toBeInTheDocument();
  });

  it('Adequate response button is labelled when status is answered', () => {
    wrap(
      <QuestionIntentBar
        question={makeQuestion()}
        status="answered"
        onFollowUp={vi.fn()}
        onRefine={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: /adequate/i })).toBeInTheDocument();
  });

  it('Refine question button is labelled when status is answered', () => {
    wrap(
      <QuestionIntentBar
        question={makeQuestion()}
        status="answered"
        onFollowUp={vi.fn()}
        onRefine={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: /refine question/i })).toBeInTheDocument();
  });

  it('region label is "Active question"', () => {
    wrap(
      <QuestionIntentBar
        question={makeQuestion()}
        status="pending"
        onFollowUp={vi.fn()}
        onRefine={vi.fn()}
      />,
    );
    const region = screen.getByRole('region');
    expect(region).toHaveAttribute('aria-label', 'Active question');
  });
});
