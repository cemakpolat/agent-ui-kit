// ─────────────────────────────────────────────────────────────────────────────
// Phase 4.1 — Approval Workflow Tests
//
// Covers:
//   ✓ ApprovalWorkflowPanel rendering (pending, approved, rejected, expired)
//   ✓ Step list: role=list / role=listitem, step status display
//   ✓ Active step: approve / reject / delegate controls
//   ✓ Rationale required before rejection
//   ✓ Delegation flow: input + send + cancel
//   ✓ Conditions panel: blocking / passing conditions
//   ✓ Active delegations display
//   ✓ Expiry countdown (aria-live)
//   ✓ Terminal state banner (approved / rejected / expired)
//   ✓ Compact mode suppresses extras
//   ✓ Helper functions: getActiveStep, isChainApproved, isChainRejected,
//       getCompletedSteps, isDelegationActive, getUnsatisfiedConditions
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from '../ThemeContext';
import { lightTheme } from '../theme';

import { ApprovalWorkflowPanel } from '../components/ApprovalWorkflowPanel';

import type {
  ApprovalChain,
  ApprovalStep,
  ApprovalDelegate,
  ConditionalApproval,
} from '@hari/core';
import {
  getActiveStep,
  isChainApproved,
  isChainRejected,
  getCompletedSteps,
  isDelegationActive,
  getUnsatisfiedConditions,
} from '@hari/core';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function wrap(ui: React.ReactElement) {
  return render(<ThemeProvider theme={lightTheme}>{ui}</ThemeProvider>);
}

function makeStep(overrides: Partial<ApprovalStep> = {}): ApprovalStep {
  return {
    stepId: crypto.randomUUID(),
    position: 1,
    approverId: 'alice',
    approverName: 'Alice',
    requiredAuthority: 'approve',
    status: 'pending',
    ...overrides,
  };
}

function makeChain(overrides: Partial<ApprovalChain> = {}): ApprovalChain {
  return {
    chainId: crypto.randomUUID(),
    governedActionId: 'restart-replica',
    steps: [
      makeStep({ position: 1, approverId: 'alice', approverName: 'Alice', status: 'pending' }),
      makeStep({ position: 2, approverId: 'bob', approverName: 'Bob', status: 'pending' }),
    ],
    status: 'pending',
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeDelegate(overrides: Partial<ApprovalDelegate> = {}): ApprovalDelegate {
  return {
    delegateId: crypto.randomUUID(),
    fromApproverId: 'alice',
    fromApproverName: 'Alice',
    toApproverId: 'charlie',
    toApproverName: 'Charlie',
    scope: 'approve',
    createdAt: new Date().toISOString(),
    isActive: true,
    ...overrides,
  };
}

function makeCondition(overrides: Partial<ConditionalApproval> = {}): ConditionalApproval {
  return {
    conditionId: crypto.randomUUID(),
    description: 'Traffic rate below threshold',
    expression: 'traffic_rate < 1000',
    isSatisfied: true,
    severity: 'blocking',
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Rendering — basic structure
// ─────────────────────────────────────────────────────────────────────────────

describe('ApprovalWorkflowPanel — Rendering', () => {
  it('renders without crashing', () => {
    wrap(
      <ApprovalWorkflowPanel
        chain={makeChain()}
        currentApproverId="alice"
      />,
    );
    expect(screen.getByRole('region', { name: /approval workflow/i })).toBeInTheDocument();
  });

  it('shows chain status label "Awaiting Approval" for pending chain', () => {
    wrap(
      <ApprovalWorkflowPanel
        chain={makeChain({ status: 'pending' })}
        currentApproverId="alice"
      />,
    );
    expect(screen.getByText(/awaiting approval/i)).toBeInTheDocument();
  });

  it('shows approved status label when chain is approved', () => {
    const chain = makeChain({
      status: 'approved',
      steps: [
        makeStep({ status: 'approved', decidedAt: new Date().toISOString() }),
      ],
    });
    wrap(<ApprovalWorkflowPanel chain={chain} currentApproverId="alice" />);
    expect(screen.getAllByText(/approved/i).length).toBeGreaterThanOrEqual(1);
  });

  it('shows rejected status label when chain is rejected', () => {
    const chain = makeChain({
      status: 'rejected',
      steps: [
        makeStep({ status: 'rejected', decidedAt: new Date().toISOString() }),
      ],
    });
    wrap(<ApprovalWorkflowPanel chain={chain} currentApproverId="alice" />);
    expect(screen.getAllByText(/rejected/i).length).toBeGreaterThanOrEqual(1);
  });

  it('shows expired status when chain is expired', () => {
    const chain = makeChain({ status: 'expired' });
    wrap(<ApprovalWorkflowPanel chain={chain} currentApproverId="alice" />);
    expect(screen.getAllByText(/expired/i).length).toBeGreaterThanOrEqual(1);
  });

  it('shows chain context when given', () => {
    const chain = makeChain({ context: 'Emergency replica restart approval' });
    wrap(<ApprovalWorkflowPanel chain={chain} currentApproverId="alice" />);
    expect(screen.getByText('Emergency replica restart approval')).toBeInTheDocument();
  });

  it('shows completed / total steps count', () => {
    const chain = makeChain({
      steps: [
        makeStep({ status: 'approved' }),
        makeStep({ position: 2, status: 'pending' }),
      ],
    });
    wrap(<ApprovalWorkflowPanel chain={chain} currentApproverId="alice" />);
    expect(screen.getByText('1/2 steps')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Step list — ARIA & display
// ─────────────────────────────────────────────────────────────────────────────

describe('ApprovalWorkflowPanel — Step list', () => {
  it('step list has role="list" with label "Approval steps"', () => {
    wrap(
      <ApprovalWorkflowPanel chain={makeChain()} currentApproverId="alice" />,
    );
    expect(screen.getByRole('list', { name: /approval steps/i })).toBeInTheDocument();
  });

  it('each step has role="listitem"', () => {
    wrap(
      <ApprovalWorkflowPanel chain={makeChain()} currentApproverId="alice" />,
    );
    expect(screen.getAllByRole('listitem').length).toBeGreaterThanOrEqual(2);
  });

  it('each step has aria-label describing approver and status', () => {
    wrap(
      <ApprovalWorkflowPanel chain={makeChain()} currentApproverId="alice" />,
    );
    const items = screen.getAllByRole('listitem');
    expect(items[0]).toHaveAttribute('aria-label', expect.stringMatching(/alice/i));
  });

  it('shows approver names in the step list', () => {
    wrap(
      <ApprovalWorkflowPanel chain={makeChain()} currentApproverId="alice" />,
    );
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('shows rationale when step has one (non-compact)', () => {
    const chain = makeChain({
      steps: [
        makeStep({
          status: 'approved',
          rationale: 'Lag is critical and action is reversible',
        }),
      ],
    });
    wrap(<ApprovalWorkflowPanel chain={chain} currentApproverId="alice" />);
    expect(screen.getByText(/lag is critical/i)).toBeInTheDocument();
  });

  it('does NOT show rationale in compact mode', () => {
    const chain = makeChain({
      steps: [
        makeStep({ status: 'approved', rationale: 'Critical and reversible' }),
      ],
    });
    wrap(<ApprovalWorkflowPanel chain={chain} currentApproverId="alice" compact />);
    expect(screen.queryByText(/critical and reversible/i)).not.toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// My-turn approval controls
// ─────────────────────────────────────────────────────────────────────────────

describe('ApprovalWorkflowPanel — Approval controls', () => {
  it('shows "Your turn to approve" when it is the current approver\'s step', () => {
    wrap(
      <ApprovalWorkflowPanel
        chain={makeChain()}
        currentApproverId="alice"
        onApprove={vi.fn()}
        onReject={vi.fn()}
      />,
    );
    expect(screen.getByText(/your turn to approve/i)).toBeInTheDocument();
  });

  it('does NOT show approval controls when it is not the current approver\'s step', () => {
    wrap(
      <ApprovalWorkflowPanel
        chain={makeChain()}
        currentApproverId="bob"  // bob is step 2, alice (step 1) is active
        onApprove={vi.fn()}
        onReject={vi.fn()}
      />,
    );
    expect(screen.queryByText(/your turn to approve/i)).not.toBeInTheDocument();
  });

  it('approval form has role="form"', () => {
    wrap(
      <ApprovalWorkflowPanel
        chain={makeChain()}
        currentApproverId="alice"
        onApprove={vi.fn()}
        onReject={vi.fn()}
      />,
    );
    expect(screen.getByRole('form', { name: /your approval decision/i })).toBeInTheDocument();
  });

  it('Approve button calls onApprove with stepId', () => {
    const onApprove = vi.fn();
    const chain = makeChain();
    const activeStepId = chain.steps[0].stepId;
    wrap(
      <ApprovalWorkflowPanel
        chain={chain}
        currentApproverId="alice"
        onApprove={onApprove}
        onReject={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /approve this step/i }));
    expect(onApprove).toHaveBeenCalledWith(activeStepId, undefined);
  });

  it('Approve button passes rationale when filled', () => {
    const onApprove = vi.fn();
    wrap(
      <ApprovalWorkflowPanel
        chain={makeChain()}
        currentApproverId="alice"
        onApprove={onApprove}
        onReject={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText(/provide your reasoning/i), {
      target: { value: 'Looks safe' },
    });
    fireEvent.click(screen.getByRole('button', { name: /approve this step/i }));
    expect(onApprove).toHaveBeenCalledWith(expect.any(String), 'Looks safe');
  });

  it('Reject button is disabled when rationale is empty', () => {
    wrap(
      <ApprovalWorkflowPanel
        chain={makeChain()}
        currentApproverId="alice"
        onApprove={vi.fn()}
        onReject={vi.fn()}
      />,
    );
    const rejectBtn = screen.getByRole('button', { name: /reject this step/i });
    expect(rejectBtn).toHaveAttribute('aria-disabled', 'true');
  });

  it('Reject button calls onReject when rationale is filled', () => {
    const onReject = vi.fn();
    const chain = makeChain();
    const activeStepId = chain.steps[0].stepId;
    wrap(
      <ApprovalWorkflowPanel
        chain={chain}
        currentApproverId="alice"
        onApprove={vi.fn()}
        onReject={onReject}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText(/provide your reasoning/i), {
      target: { value: 'Conditions not met' },
    });
    fireEvent.click(screen.getByRole('button', { name: /reject this step/i }));
    expect(onReject).toHaveBeenCalledWith(activeStepId, 'Conditions not met');
  });

  it('does not show approve/reject when chain is already approved', () => {
    const chain = makeChain({
      status: 'approved',
      steps: [makeStep({ status: 'approved' })],
    });
    wrap(
      <ApprovalWorkflowPanel chain={chain} currentApproverId="alice" onApprove={vi.fn()} onReject={vi.fn()} />,
    );
    expect(screen.queryByText(/your turn to approve/i)).not.toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Delegation flow
// ─────────────────────────────────────────────────────────────────────────────

describe('ApprovalWorkflowPanel — Delegation', () => {
  it('shows Delegate button when onDelegate is provided', () => {
    wrap(
      <ApprovalWorkflowPanel
        chain={makeChain()}
        currentApproverId="alice"
        onApprove={vi.fn()}
        onReject={vi.fn()}
        onDelegate={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: /delegate this step/i })).toBeInTheDocument();
  });

  it('clicking Delegate reveals delegation input', () => {
    wrap(
      <ApprovalWorkflowPanel
        chain={makeChain()}
        currentApproverId="alice"
        onApprove={vi.fn()}
        onReject={vi.fn()}
        onDelegate={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /delegate this step/i }));
    expect(screen.getByLabelText(/delegate to/i)).toBeInTheDocument();
  });

  it('Send delegation calls onDelegate with stepId and delegateTo', () => {
    const onDelegate = vi.fn();
    const chain = makeChain();
    const activeStepId = chain.steps[0].stepId;
    wrap(
      <ApprovalWorkflowPanel
        chain={chain}
        currentApproverId="alice"
        onApprove={vi.fn()}
        onReject={vi.fn()}
        onDelegate={onDelegate}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /delegate this step/i }));
    fireEvent.change(screen.getByLabelText(/delegate to/i), {
      target: { value: 'charlie' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send/i }));
    expect(onDelegate).toHaveBeenCalledWith(activeStepId, 'charlie');
  });

  it('Cancel in delegation flow hides the input', () => {
    wrap(
      <ApprovalWorkflowPanel
        chain={makeChain()}
        currentApproverId="alice"
        onApprove={vi.fn()}
        onReject={vi.fn()}
        onDelegate={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /delegate this step/i }));
    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.queryByLabelText(/delegate to/i)).not.toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Conditions panel
// ─────────────────────────────────────────────────────────────────────────────

describe('ApprovalWorkflowPanel — Conditions', () => {
  it('renders condition descriptions', () => {
    wrap(
      <ApprovalWorkflowPanel
        chain={makeChain()}
        currentApproverId="alice"
        conditions={[makeCondition({ description: 'Traffic rate below threshold' })]}
      />,
    );
    expect(screen.getByText('Traffic rate below threshold')).toBeInTheDocument();
  });

  it('condition list uses role="list"', () => {
    wrap(
      <ApprovalWorkflowPanel
        chain={makeChain()}
        currentApproverId="alice"
        conditions={[makeCondition()]}
      />,
    );
    // conditions list + steps list — at least 2 lists present
    expect(screen.getAllByRole('list').length).toBeGreaterThanOrEqual(2);
  });

  it('shows alert when blocking conditions are not satisfied', () => {
    wrap(
      <ApprovalWorkflowPanel
        chain={makeChain()}
        currentApproverId="alice"
        onApprove={vi.fn()}
        onReject={vi.fn()}
        conditions={[makeCondition({ isSatisfied: false, severity: 'blocking' })]}
      />,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('alert').textContent).toMatch(/blocking condition/i);
  });

  it('does NOT show alert when all conditions are satisfied', () => {
    wrap(
      <ApprovalWorkflowPanel
        chain={makeChain()}
        currentApproverId="alice"
        onApprove={vi.fn()}
        onReject={vi.fn()}
        conditions={[makeCondition({ isSatisfied: true })]}
      />,
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('conditions panel is hidden in compact mode', () => {
    wrap(
      <ApprovalWorkflowPanel
        chain={makeChain()}
        currentApproverId="alice"
        conditions={[makeCondition({ description: 'Traffic below limit' })]}
        compact
      />,
    );
    expect(screen.queryByText('Traffic below limit')).not.toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Active delegations display
// ─────────────────────────────────────────────────────────────────────────────

describe('ApprovalWorkflowPanel — Active delegations display', () => {
  it('shows delegation from → to when delegation is active', () => {
    wrap(
      <ApprovalWorkflowPanel
        chain={makeChain()}
        currentApproverId="alice"
        delegations={[makeDelegate()]}
      />,
    );
    expect(screen.getByText(/Alice → Charlie/)).toBeInTheDocument();
  });

  it('does NOT show expired delegations', () => {
    wrap(
      <ApprovalWorkflowPanel
        chain={makeChain()}
        currentApproverId="alice"
        delegations={[
          makeDelegate({
            expiresAt: new Date(Date.now() - 5000).toISOString(),
          }),
        ]}
      />,
    );
    expect(screen.queryByText(/Alice → Charlie/)).not.toBeInTheDocument();
  });

  it('delegations section is hidden in compact mode', () => {
    wrap(
      <ApprovalWorkflowPanel
        chain={makeChain()}
        currentApproverId="alice"
        delegations={[makeDelegate()]}
        compact
      />,
    );
    expect(screen.queryByText(/Active Delegations/i)).not.toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Expiry
// ─────────────────────────────────────────────────────────────────────────────

describe('ApprovalWorkflowPanel — Expiry', () => {
  it('shows countdown when chain has future expiresAt', () => {
    const expiresAt = new Date(Date.now() + 20 * 60 * 1000).toISOString();
    wrap(
      <ApprovalWorkflowPanel
        chain={makeChain({ expiresAt })}
        currentApproverId="alice"
      />,
    );
    expect(screen.getByText(/20m/)).toBeInTheDocument();
  });

  it('shows "Expired" when chain expiresAt is in the past', () => {
    const expiresAt = new Date(Date.now() - 10000).toISOString();
    wrap(
      <ApprovalWorkflowPanel
        chain={makeChain({ expiresAt })}
        currentApproverId="alice"
      />,
    );
    expect(screen.getByText(/Expired/)).toBeInTheDocument();
  });

  it('expiry span has aria-live="polite"', () => {
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    wrap(
      <ApprovalWorkflowPanel
        chain={makeChain({ expiresAt })}
        currentApproverId="alice"
      />,
    );
    const liveEl = screen.getByText(/30m/).closest('[aria-live]');
    expect(liveEl).toHaveAttribute('aria-live', 'polite');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Terminal state banner
// ─────────────────────────────────────────────────────────────────────────────

describe('ApprovalWorkflowPanel — Terminal banner', () => {
  it('shows role="status" banner for approved chain', () => {
    const chain = makeChain({
      status: 'approved',
      steps: [makeStep({ status: 'approved' })],
    });
    wrap(<ApprovalWorkflowPanel chain={chain} currentApproverId="alice" />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('shows role="status" banner for rejected chain', () => {
    const chain = makeChain({
      status: 'rejected',
      steps: [makeStep({ status: 'rejected' })],
    });
    wrap(<ApprovalWorkflowPanel chain={chain} currentApproverId="alice" />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('does NOT show terminal banner for pending chain', () => {
    wrap(
      <ApprovalWorkflowPanel chain={makeChain()} currentApproverId="alice" />,
    );
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Core helper functions
// ─────────────────────────────────────────────────────────────────────────────

describe('getActiveStep', () => {
  it('returns the first pending step', () => {
    const chain = makeChain({
      steps: [
        makeStep({ stepId: 'a', status: 'approved' }),
        makeStep({ stepId: 'b', status: 'pending' }),
        makeStep({ stepId: 'c', status: 'pending' }),
      ],
    });
    expect(getActiveStep(chain)?.stepId).toBe('b');
  });

  it('returns undefined when no pending steps', () => {
    const chain = makeChain({
      steps: [makeStep({ status: 'approved' })],
    });
    expect(getActiveStep(chain)).toBeUndefined();
  });
});

describe('isChainApproved', () => {
  it('returns true when all steps are approved', () => {
    const chain = makeChain({
      steps: [
        makeStep({ status: 'approved' }),
        makeStep({ status: 'approved' }),
      ],
    });
    expect(isChainApproved(chain)).toBe(true);
  });

  it('returns false when a step is pending', () => {
    const chain = makeChain({
      steps: [
        makeStep({ status: 'approved' }),
        makeStep({ status: 'pending' }),
      ],
    });
    expect(isChainApproved(chain)).toBe(false);
  });

  it('returns false when a step is rejected even if others approved', () => {
    const chain = makeChain({
      steps: [
        makeStep({ status: 'approved' }),
        makeStep({ status: 'rejected' }),
      ],
    });
    expect(isChainApproved(chain)).toBe(false);
  });

  it('returns true when requiredApprovals threshold met', () => {
    const chain = makeChain({
      requiredApprovals: 1,
      steps: [
        makeStep({ status: 'approved' }),
        makeStep({ status: 'pending' }),
      ],
    });
    expect(isChainApproved(chain)).toBe(true);
  });
});

describe('isChainRejected', () => {
  it('returns true when any step is rejected', () => {
    const chain = makeChain({
      steps: [makeStep({ status: 'rejected' })],
    });
    expect(isChainRejected(chain)).toBe(true);
  });

  it('returns false when no steps are rejected', () => {
    const chain = makeChain({
      steps: [makeStep({ status: 'pending' })],
    });
    expect(isChainRejected(chain)).toBe(false);
  });
});

describe('getCompletedSteps', () => {
  it('returns steps that are not pending', () => {
    const chain = makeChain({
      steps: [
        makeStep({ status: 'approved' }),
        makeStep({ status: 'pending' }),
        makeStep({ status: 'rejected' }),
      ],
    });
    expect(getCompletedSteps(chain).length).toBe(2);
  });

  it('returns empty array when all steps are pending', () => {
    const chain = makeChain({
      steps: [makeStep({ status: 'pending' })],
    });
    expect(getCompletedSteps(chain).length).toBe(0);
  });
});

describe('isDelegationActive', () => {
  it('returns true for active delegation without expiry', () => {
    expect(isDelegationActive(makeDelegate())).toBe(true);
  });

  it('returns false for inactive delegation', () => {
    expect(isDelegationActive(makeDelegate({ isActive: false }))).toBe(false);
  });

  it('returns false for delegation with past expiresAt', () => {
    const delegate = makeDelegate({
      expiresAt: new Date(Date.now() - 5000).toISOString(),
    });
    expect(isDelegationActive(delegate)).toBe(false);
  });

  it('returns true for delegation with future expiresAt', () => {
    const delegate = makeDelegate({
      expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    });
    expect(isDelegationActive(delegate)).toBe(true);
  });
});

describe('getUnsatisfiedConditions', () => {
  it('returns blocking conditions that are not satisfied', () => {
    const conditions: ConditionalApproval[] = [
      makeCondition({ isSatisfied: false, severity: 'blocking' }),
      makeCondition({ isSatisfied: true, severity: 'blocking' }),
      makeCondition({ isSatisfied: false, severity: 'warning' }),
    ];
    const result = getUnsatisfiedConditions(conditions);
    expect(result.length).toBe(1);
    expect(result[0].isSatisfied).toBe(false);
    expect(result[0].severity).toBe('blocking');
  });

  it('returns empty array when all blocking conditions are satisfied', () => {
    const conditions: ConditionalApproval[] = [
      makeCondition({ isSatisfied: true, severity: 'blocking' }),
    ];
    expect(getUnsatisfiedConditions(conditions).length).toBe(0);
  });
});
