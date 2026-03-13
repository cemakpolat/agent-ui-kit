import React from 'react';
import type {
  ApprovalChain,
  ApprovalStep,
  ApprovalStepStatus,
  ApprovalDelegate,
  ConditionalApproval,
  WorkflowExpiry,
} from '@hari/core';
import {
  getActiveStep,
  isChainApproved,
  isChainRejected,
  getCompletedSteps,
  isDelegationActive,
  getUnsatisfiedConditions,
} from '@hari/core';
import { useTheme } from '../ThemeContext';

// ─────────────────────────────────────────────────────────────────────────────
// ApprovalWorkflowPanel
//
// Renders an approval chain: multi-level, conditional, and delegated approvals
// for a governed action.
//
// Features:
//   - Step-by-step chain with status indicators
//   - Active step: approve / reject controls with rationale
//   - Delegation badges
//   - Conditional pre-flight checks
//   - Expiry countdown with policy display
// ─────────────────────────────────────────────────────────────────────────────

// ── Status visuals ────────────────────────────────────────────────────────────

const STEP_STATUS_META: Record<
  ApprovalStepStatus,
  { icon: string; label: string; color: string; bgColor: string }
> = {
  pending:  { icon: '⏳', label: 'Pending',  color: '#854d0e', bgColor: '#fef9c3' },
  approved: { icon: '✅', label: 'Approved', color: '#166534', bgColor: '#dcfce7' },
  rejected: { icon: '❌', label: 'Rejected', color: '#991b1b', bgColor: '#fee2e2' },
  delegated:{ icon: '🔀', label: 'Delegated',color: '#1d4ed8', bgColor: '#dbeafe' },
  expired:  { icon: '⌛', label: 'Expired',  color: '#6b7280', bgColor: '#f3f4f6' },
  skipped:  { icon: '⏭', label: 'Skipped',  color: '#6d28d9', bgColor: '#ede9fe' },
};

const CHAIN_STATUS_META = {
  pending:   { label: 'Awaiting Approval', color: '#854d0e', bgColor: '#fef9c3' },
  approved:  { label: 'Approved',          color: '#166534', bgColor: '#dcfce7' },
  rejected:  { label: 'Rejected',          color: '#991b1b', bgColor: '#fee2e2' },
  expired:   { label: 'Expired',           color: '#6b7280', bgColor: '#f3f4f6' },
  cancelled: { label: 'Cancelled',         color: '#475569', bgColor: '#f1f5f9' },
};

// ── Utility ───────────────────────────────────────────────────────────────────

function computeExpiresIn(expiresAt?: string): string | null {
  if (!expiresAt) return null;
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return 'Expired';
  const mins = Math.ceil(ms / 60000);
  return mins > 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;
}

function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface ApprovalWorkflowPanelProps {
  /** The approval chain to display */
  chain: ApprovalChain;

  /** ID of the approver viewing this panel (to determine which step is theirs) */
  currentApproverId: string;

  /** Called when the current approver approves their step */
  onApprove?: (stepId: string, rationale?: string) => void;

  /** Called when the current approver rejects their step */
  onReject?: (stepId: string, rationale: string) => void;

  /** Called when the current approver delegates their step */
  onDelegate?: (stepId: string, toApproverId: string) => void;

  /** Active delegations for context display */
  delegations?: ApprovalDelegate[];

  /** Conditional checks that must pass before final execution */
  conditions?: ConditionalApproval[];

  /** Workflow expiry policy */
  expiry?: WorkflowExpiry;

  /** Compact rendering for integration in larger panels */
  compact?: boolean;
}

// ── Main component ────────────────────────────────────────────────────────────

export function ApprovalWorkflowPanel({
  chain,
  currentApproverId,
  onApprove,
  onReject,
  onDelegate,
  delegations = [],
  conditions = [],
  expiry,
  compact = false,
}: ApprovalWorkflowPanelProps) {
  const { theme } = useTheme();

  const [rationale, setRationale] = React.useState('');
  const [delegateTo, setDelegateTo] = React.useState('');
  const [delegating, setDelegating] = React.useState(false);

  const activeStep = getActiveStep(chain);
  const isMyStep = activeStep?.approverId === currentApproverId;
  const chainApproved = isChainApproved(chain);
  const chainRejected = isChainRejected(chain);
  const completedSteps = getCompletedSteps(chain);
  const blockedConditions = getUnsatisfiedConditions(conditions);
  const activeDelegations = delegations.filter(isDelegationActive);

  const chainMeta = CHAIN_STATUS_META[chain.status];

  const [expiresIn, setExpiresIn] = React.useState<string | null>(
    () => computeExpiresIn(chain.expiresAt),
  );

  React.useEffect(() => {
    if (!chain.expiresAt) return;
    setExpiresIn(computeExpiresIn(chain.expiresAt));
    const interval = setInterval(() => {
      setExpiresIn(computeExpiresIn(chain.expiresAt));
    }, 30_000);
    return () => clearInterval(interval);
  }, [chain.expiresAt]);

  const handleApprove = () => {
    if (!activeStep) return;
    onApprove?.(activeStep.stepId, rationale || undefined);
    setRationale('');
  };

  const handleReject = () => {
    if (!activeStep || !rationale.trim()) return;
    onReject?.(activeStep.stepId, rationale);
    setRationale('');
  };

  const handleDelegate = () => {
    if (!activeStep || !delegateTo.trim()) return;
    onDelegate?.(activeStep.stepId, delegateTo);
    setDelegateTo('');
    setDelegating(false);
  };

  // ── Styles ──────────────────────────────────────────────────────────────────

  const containerStyle: React.CSSProperties = {
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    overflow: 'hidden',
    fontFamily: theme.typography.family,
  };

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0.625rem 0.875rem',
    backgroundColor: chainMeta.bgColor,
    borderBottom: `1px solid ${theme.colors.border}`,
  };

  return (
    <div
      role="region"
      aria-label="Approval workflow"
      style={containerStyle}
    >
      {/* Header — chain status */}
      <div style={headerStyle}>
        <div>
          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: chainMeta.color }}>
            Approval Chain: {chainMeta.label}
          </span>
          {chain.context && !compact && (
            <div style={{ fontSize: '0.7rem', color: theme.colors.textMuted, marginTop: '0.1rem' }}>
              {chain.context}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {expiresIn && (
            <span
              aria-live="polite"
              aria-label={`Workflow expires in: ${expiresIn}`}
              style={{
                fontSize: '0.7rem',
                fontWeight: 600,
                color: expiresIn === 'Expired' ? theme.colors.danger : theme.colors.warning,
              }}
            >
              ⏱ {expiresIn}
            </span>
          )}
          <span style={{
            fontSize: '0.65rem',
            color: theme.colors.textMuted,
          }}>
            {completedSteps.length}/{chain.steps.length} steps
          </span>
        </div>
      </div>

      {/* Conditions pre-flight */}
      {conditions.length > 0 && !compact && (
        <div style={{
          padding: '0.5rem 0.875rem',
          borderBottom: `1px solid ${theme.colors.border}`,
          backgroundColor: blockedConditions.length > 0 ? '#fef2f2' : '#f0fdf4',
        }}>
          <div style={{ fontSize: '0.65rem', fontWeight: 700, color: theme.colors.textSecondary, marginBottom: '0.25rem' }}>
            Conditions
          </div>
          <ul role="list" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {conditions.map((c) => (
              <li key={c.conditionId} role="listitem" style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.375rem',
                fontSize: '0.75rem',
                padding: '0.1rem 0',
              }}>
                <span aria-label={c.isSatisfied ? 'Condition met' : 'Condition not met'}>
                  {c.isSatisfied ? '✅' : c.severity === 'blocking' ? '🔴' : '⚠️'}
                </span>
                <span style={{ color: theme.colors.text }}>{c.description}</span>
                {c.currentValue && (
                  <span style={{ fontSize: '0.65rem', color: theme.colors.textMuted }}>
                    ({c.currentValue})
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Active delegations */}
      {activeDelegations.length > 0 && !compact && (
        <div style={{
          padding: '0.375rem 0.875rem',
          borderBottom: `1px solid ${theme.colors.border}`,
          backgroundColor: '#eff6ff',
        }}>
          <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#1d4ed8', marginBottom: '0.15rem' }}>
            Active Delegations
          </div>
          {activeDelegations.map((d) => (
            <div key={d.delegateId} style={{ fontSize: '0.7rem', color: theme.colors.textSecondary }}>
              🔀 {d.fromApproverName} → {d.toApproverName}
              {d.expiresAt && ` (expires ${computeExpiresIn(d.expiresAt)})`}
            </div>
          ))}
        </div>
      )}

      {/* Step list */}
      <div style={{ padding: compact ? '0.375rem 0.625rem' : '0.5rem 0.875rem' }}>
        <ul role="list" aria-label="Approval steps" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {chain.steps.map((step, idx) => {
            const meta = STEP_STATUS_META[step.status];
            const isActive = step.status === 'pending';
            const isLast = idx === chain.steps.length - 1;

            return (
              <li
                key={step.stepId}
                role="listitem"
                aria-label={`Step ${step.position}: ${step.approverName} — ${meta.label}`}
                style={{
                  display: 'flex',
                  gap: '0.5rem',
                  paddingBottom: isLast ? 0 : '0.5rem',
                  position: 'relative',
                }}
              >
                {/* Connector line */}
                {!isLast && (
                  <div style={{
                    position: 'absolute',
                    left: '0.6rem',
                    top: '1.5rem',
                    bottom: 0,
                    width: '1px',
                    backgroundColor: theme.colors.border,
                  }} />
                )}

                {/* Status dot */}
                <div style={{
                  width: '1.25rem',
                  height: '1.25rem',
                  borderRadius: '50%',
                  backgroundColor: meta.bgColor,
                  border: `2px solid ${meta.color}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  fontSize: '0.6rem',
                  marginTop: '0.1rem',
                  zIndex: 1,
                }}>
                  {meta.icon}
                </div>

                {/* Step details */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.375rem',
                    flexWrap: 'wrap',
                  }}>
                    <span style={{
                      fontSize: '0.8rem',
                      fontWeight: isActive ? 700 : 400,
                      color: theme.colors.text,
                    }}>
                      {step.approverName}
                    </span>
                    <span style={{
                      fontSize: '0.6rem',
                      padding: '0.1rem 0.3rem',
                      borderRadius: '3px',
                      backgroundColor: meta.bgColor,
                      color: meta.color,
                      fontWeight: 700,
                    }}>
                      {meta.label}
                    </span>
                    {step.delegatedTo && (
                      <span style={{
                        fontSize: '0.6rem',
                        color: '#1d4ed8',
                      }}>
                        → {step.delegatedTo}
                      </span>
                    )}
                  </div>

                  {step.requiredAuthority && (
                    <div style={{ fontSize: '0.65rem', color: theme.colors.textMuted }}>
                      Required: {step.requiredAuthority}
                    </div>
                  )}

                  {step.decidedAt && (
                    <div style={{ fontSize: '0.65rem', color: theme.colors.textMuted }}>
                      {formatTimestamp(step.decidedAt)}
                    </div>
                  )}

                  {step.rationale && !compact && (
                    <div style={{
                      fontSize: '0.7rem',
                      color: theme.colors.textSecondary,
                      fontStyle: 'italic',
                      marginTop: '0.1rem',
                    }}>
                      "{step.rationale}"
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {/* My turn — approval controls */}
      {isMyStep && activeStep && !chainApproved && !chainRejected && (
        <div
          role="form"
          aria-label="Your approval decision"
          style={{
            margin: '0 0.875rem 0.875rem',
            padding: '0.75rem',
            borderRadius: theme.radius.sm,
            border: `1.5px solid ${theme.colors.accent}`,
            backgroundColor: theme.colors.accentSubtle,
          }}
        >
          <div style={{
            fontSize: '0.8rem',
            fontWeight: 700,
            color: theme.colors.accent,
            marginBottom: '0.5rem',
          }}>
            Your turn to approve
          </div>

          {blockedConditions.length > 0 && (
            <div
              role="alert"
              style={{
                padding: '0.375rem 0.5rem',
                borderRadius: theme.radius.sm,
                backgroundColor: '#fee2e2',
                color: '#991b1b',
                fontSize: '0.75rem',
                marginBottom: '0.5rem',
              }}
            >
              ⚠️ {blockedConditions.length} blocking condition{blockedConditions.length > 1 ? 's' : ''} not met — approval not recommended
            </div>
          )}

          <div style={{ marginBottom: '0.5rem' }}>
            <label style={{
              display: 'block',
              fontSize: '0.7rem',
              fontWeight: 600,
              color: theme.colors.textSecondary,
              marginBottom: '0.2rem',
            }}>
              Rationale {!onApprove ? '*' : ''}
            </label>
            <textarea
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
              placeholder="Provide your reasoning…"
              rows={2}
              style={{
                width: '100%',
                padding: '0.375rem',
                borderRadius: theme.radius.sm,
                border: `1px solid ${theme.colors.border}`,
                fontSize: '0.8rem',
                fontFamily: theme.typography.family,
                resize: 'vertical',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              onClick={handleApprove}
              aria-label="Approve this step"
              style={{
                padding: '0.375rem 0.75rem',
                borderRadius: theme.radius.sm,
                border: 'none',
                backgroundColor: '#166534',
                color: '#fff',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              ✓ Approve
            </button>
            <button
              onClick={handleReject}
              disabled={!rationale.trim()}
              aria-label="Reject this step"
              aria-disabled={!rationale.trim()}
              style={{
                padding: '0.375rem 0.75rem',
                borderRadius: theme.radius.sm,
                border: 'none',
                backgroundColor: !rationale.trim() ? theme.colors.border : '#991b1b',
                color: '#fff',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: !rationale.trim() ? 'not-allowed' : 'pointer',
                opacity: !rationale.trim() ? 0.6 : 1,
              }}
            >
              ✗ Reject
            </button>

            {onDelegate && (
              <>
                {delegating ? (
                  <div style={{ display: 'flex', gap: '0.375rem', width: '100%', marginTop: '0.25rem' }}>
                    <input
                      type="text"
                      value={delegateTo}
                      onChange={(e) => setDelegateTo(e.target.value)}
                      placeholder="Delegate to (user ID or name)…"
                      aria-label="Delegate to"
                      style={{
                        flex: 1,
                        padding: '0.375rem',
                        borderRadius: theme.radius.sm,
                        border: `1px solid ${theme.colors.border}`,
                        fontSize: '0.8rem',
                        fontFamily: theme.typography.family,
                      }}
                    />
                    <button
                      onClick={handleDelegate}
                      disabled={!delegateTo.trim()}
                      style={{
                        padding: '0.375rem 0.5rem',
                        borderRadius: theme.radius.sm,
                        border: 'none',
                        backgroundColor: theme.colors.accent,
                        color: '#fff',
                        fontSize: '0.75rem',
                        cursor: !delegateTo.trim() ? 'not-allowed' : 'pointer',
                      }}
                    >
                      Send
                    </button>
                    <button
                      onClick={() => setDelegating(false)}
                      style={{
                        padding: '0.375rem 0.5rem',
                        borderRadius: theme.radius.sm,
                        border: `1px solid ${theme.colors.border}`,
                        backgroundColor: theme.colors.surface,
                        color: theme.colors.textMuted,
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setDelegating(true)}
                    aria-label="Delegate this step"
                    style={{
                      padding: '0.375rem 0.75rem',
                      borderRadius: theme.radius.sm,
                      border: `1px solid ${theme.colors.border}`,
                      backgroundColor: theme.colors.surface,
                      color: theme.colors.textSecondary,
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                    }}
                  >
                    🔀 Delegate
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Terminal state banner */}
      {(chainApproved || chainRejected || chain.status === 'expired') && (
        <div
          role="status"
          style={{
            margin: '0 0.875rem 0.875rem',
            padding: '0.5rem 0.75rem',
            borderRadius: theme.radius.sm,
            backgroundColor: chainMeta.bgColor,
            color: chainMeta.color,
            fontSize: '0.8rem',
            fontWeight: 600,
            textAlign: 'center',
          }}
        >
          {chainMeta.label}
          {chain.completedAt && ` · ${formatTimestamp(chain.completedAt)}`}
        </div>
      )}
    </div>
  );
}
