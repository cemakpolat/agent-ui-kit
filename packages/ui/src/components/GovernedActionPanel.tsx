import React from 'react';
import type {
  GovernedAction,
  AuthorityMode,
  Precondition,
  DecisionOutcome,
  AuthorityRequestDisplay,
} from '@hari/core';
import {
  arePreconditionsMet,
  getUnmetPreconditions,
  getUnknownPreconditions,
  hasAuthority,
  getAuthorityCapabilities,
  AUTHORITY_HIERARCHY,
} from '@hari/core';
import { useTheme } from '../ThemeContext';
import type { Theme } from '../theme';

// ─────────────────────────────────────────────────────────────────────────────
// GovernedActionPanel
//
// Renders a GovernedAction with full governance context:
//   - Intent explanation (why the agent proposes this)
//   - Impact scope visualization
//   - Precondition checklist
//   - Reversibility badge
//   - Required authority check
//   - Alternatives considered
//   - Action confidence
//   - Confirmation flow with deliberation timer
//
// Rule: No action without visible governance context.
// ─────────────────────────────────────────────────────────────────────────────

const REVERSIBILITY_STYLES: Record<string, { icon: string; label: string; color: string; bg: string }> = {
  fully_reversible:     { icon: '↩', label: 'Fully reversible', color: '#166534', bg: '#dcfce7' },
  partially_reversible: { icon: '↩', label: 'Partially reversible', color: '#854d0e', bg: '#fef9c3' },
  irreversible:         { icon: '⛔', label: 'Irreversible', color: '#991b1b', bg: '#fee2e2' },
  time_limited:         { icon: '⏱', label: 'Time-limited reversal', color: '#6d28d9', bg: '#ede9fe' },
};

const PRECONDITION_STYLES: Record<string, { icon: string; color: string }> = {
  met:     { icon: '✓', color: '#166534' },
  unmet:   { icon: '✗', color: '#991b1b' },
  unknown: { icon: '?', color: '#854d0e' },
  waived:  { icon: '~', color: '#6d28d9' },
};

export interface GovernedActionPanelProps {
  governedAction: GovernedAction;
  /** Current human authority level */
  currentAuthority: AuthorityMode;
  /** Called when the human makes a decision */
  onDecision: (outcome: DecisionOutcome, rationale?: string) => void;
  /** Called when escalation is needed */
  onEscalate?: () => void;
  /** Compact mode: hide alternatives, show minimal info */
  compact?: boolean;
  /**
   * Authority Request display context — mandatory for full governance.
   * Surfaces: who must approve, why escalation is required, what happens
   * if not approved.  Without this, humans cannot deliberately govern.
   */
  authorityRequestDisplay?: AuthorityRequestDisplay;
}

export function GovernedActionPanel({
  governedAction,
  currentAuthority,
  onDecision,
  onEscalate,
  compact = false,
  authorityRequestDisplay,
}: GovernedActionPanelProps) {
  const { theme } = useTheme();
  const [confirming, setConfirming] = React.useState(false);
  const [rationale, setRationale] = React.useState('');
  const [deliberationStart, setDeliberationStart] = React.useState<number | null>(null);
  const [delayReady, setDelayReady] = React.useState(false);
  const [remaining, setRemaining] = React.useState(0);

  const action = governedAction.action;
  const safety = action.safety;
  const delay = safety?.confirmationDelay ?? 0;

  const canApprove = hasAuthority(currentAuthority, governedAction.requiredAuthority);
  const preconditionsMet = arePreconditionsMet(governedAction);
  const unmet = getUnmetPreconditions(governedAction);
  const unknown = getUnknownPreconditions(governedAction);
  const revStyle = REVERSIBILITY_STYLES[governedAction.reversibility];

  // Track deliberation time
  React.useEffect(() => {
    setDeliberationStart(Date.now());
  }, []);

  // Confirmation delay timer
  React.useEffect(() => {
    if (!confirming) {
      setDelayReady(false);
      setRemaining(0);
      return;
    }
    if (delay <= 0) {
      setDelayReady(true);
      return;
    }
    const secs = Math.ceil(delay / 1000);
    setRemaining(secs);
    const interval = setInterval(() => {
      setRemaining((r) => Math.max(0, r - 1));
    }, 1000);
    const timer = setTimeout(() => {
      setDelayReady(true);
      clearInterval(interval);
    }, delay);
    return () => { clearTimeout(timer); clearInterval(interval); };
  }, [confirming, delay]);

  const handleDecision = (outcome: DecisionOutcome) => {
    onDecision(outcome, rationale || undefined);
    setConfirming(false);
  };

  return (
    <div style={{
      border: `1px solid ${theme.colors.border}`,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.surface,
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0.625rem 0.75rem',
        backgroundColor: theme.colors.surfaceAlt,
        borderBottom: `1px solid ${theme.colors.border}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '1rem' }}>
            {action.variant === 'destructive' ? '⚠' : '⚡'}
          </span>
          <div>
            <div style={{
              fontSize: '0.6rem',
              fontWeight: 700,
              textTransform: 'uppercase' as const,
              letterSpacing: '0.06em',
              color: theme.colors.textMuted,
              marginBottom: '0.1rem',
            }}>
              Authority Request
            </div>
            <div style={{ fontWeight: 700, fontSize: '0.875rem', color: theme.colors.text }}>
              {action.label}
            </div>
            {!compact && (
              <div style={{ fontSize: '0.75rem', color: theme.colors.textSecondary }}>
                {governedAction.intent}
              </div>
            )}
          </div>
        </div>

        {/* Confidence + reversibility badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
          <span style={{
            fontSize: '0.65rem',
            fontWeight: 700,
            padding: '0.1rem 0.4rem',
            borderRadius: '3px',
            backgroundColor: governedAction.actionConfidence >= 0.8 ? '#dcfce7' : governedAction.actionConfidence >= 0.5 ? '#fef9c3' : '#fee2e2',
            color: governedAction.actionConfidence >= 0.8 ? '#166534' : governedAction.actionConfidence >= 0.5 ? '#854d0e' : '#991b1b',
          }}>
            {Math.round(governedAction.actionConfidence * 100)}%
          </span>
          <span style={{
            fontSize: '0.65rem',
            fontWeight: 600,
            padding: '0.1rem 0.4rem',
            borderRadius: '3px',
            backgroundColor: revStyle.bg,
            color: revStyle.color,
          }}>
            {revStyle.icon} {revStyle.label}
          </span>
        </div>
      </div>

      <div style={{ padding: '0.75rem' }}>
        {/* Impact scope */}
        <div style={{ marginBottom: '0.625rem' }}>
          <div style={sectionLabel(theme)}>Impact Scope</div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            flexWrap: 'wrap',
          }}>
            <span style={{
              fontSize: '0.7rem',
              fontWeight: 600,
              padding: '0.15rem 0.4rem',
              borderRadius: '3px',
              backgroundColor: theme.colors.warningSubtle,
              color: theme.colors.warningText,
              textTransform: 'uppercase',
            }}>
              {governedAction.impactScope.scope}
            </span>
            {governedAction.impactScope.affectedSystems.map((sys) => (
              <span key={sys} style={{
                fontSize: '0.7rem',
                padding: '0.1rem 0.35rem',
                borderRadius: '3px',
                backgroundColor: theme.colors.surfaceAlt,
                color: theme.colors.textSecondary,
                border: `1px solid ${theme.colors.border}`,
              }}>
                {sys}
              </span>
            ))}
          </div>
          {governedAction.impactScope.downstreamEffects && (
            <div style={{
              marginTop: '0.25rem',
              fontSize: '0.75rem',
              color: theme.colors.textSecondary,
              fontStyle: 'italic',
            }}>
              {governedAction.impactScope.downstreamEffects}
            </div>
          )}
        </div>

        {/* Preconditions */}
        {governedAction.preconditions.length > 0 && (
          <div style={{ marginBottom: '0.625rem' }}>
            <div style={sectionLabel(theme)}>Preconditions</div>
            {governedAction.preconditions.map((p, i) => {
              const ps = PRECONDITION_STYLES[p.status];
              return (
                <div key={i} style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.375rem',
                  padding: '0.2rem 0',
                  fontSize: '0.8rem',
                }}>
                  <span style={{
                    color: ps.color,
                    fontWeight: 700,
                    flexShrink: 0,
                    width: '1rem',
                    textAlign: 'center',
                  }}>
                    {ps.icon}
                  </span>
                  <div>
                    <span style={{ color: theme.colors.text }}>{p.description}</span>
                    {p.status === 'unknown' && p.resolution && (
                      <div style={{
                        fontSize: '0.7rem',
                        color: theme.colors.textMuted,
                        fontStyle: 'italic',
                      }}>
                        Resolution: {p.resolution}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Alternatives considered */}
        {!compact && governedAction.alternatives.length > 0 && (
          <div style={{ marginBottom: '0.625rem' }}>
            <details>
              <summary style={{
                ...sectionLabel(theme),
                cursor: 'pointer',
                userSelect: 'none',
              }}>
                Alternatives Considered ({governedAction.alternatives.length})
              </summary>
              {governedAction.alternatives.map((alt, i) => (
                <div key={i} style={{
                  padding: '0.375rem 0',
                  borderBottom: i < governedAction.alternatives.length - 1
                    ? `1px solid ${theme.colors.border}` : 'none',
                  fontSize: '0.8rem',
                }}>
                  <div style={{ color: theme.colors.text }}>{alt.description}</div>
                  <div style={{
                    fontSize: '0.7rem',
                    color: theme.colors.textMuted,
                    fontStyle: 'italic',
                    marginTop: '0.1rem',
                  }}>
                    Rejected: {alt.rejectionReason}
                  </div>
                </div>
              ))}
            </details>
          </div>
        )}

        {/* Authority check + action buttons */}
        {authorityRequestDisplay && !compact && (
          <div style={{
            marginBottom: '0.625rem',
            padding: '0.5rem 0.625rem',
            borderRadius: theme.radius.sm,
            backgroundColor: theme.colors.infoSubtle,
            border: `1px solid ${theme.colors.info}`,
          }}>
            <div style={{
              fontSize: '0.68rem',
              fontWeight: 700,
              textTransform: 'uppercase' as const,
              letterSpacing: '0.05em',
              color: theme.colors.info,
              marginBottom: '0.375rem',
            }}>
              Authority Request Context
            </div>
            <div style={{ display: 'grid', gap: '0.25rem', fontSize: '0.78rem' }}>
              <div>
                <span style={{ fontWeight: 600, color: theme.colors.text }}>Who must approve: </span>
                <span style={{ color: theme.colors.textSecondary }}>{authorityRequestDisplay.approverDescription}</span>
              </div>
              <div>
                <span style={{ fontWeight: 600, color: theme.colors.text }}>Why escalation required: </span>
                <span style={{ color: theme.colors.textSecondary }}>{authorityRequestDisplay.escalationReason}</span>
              </div>
              <div>
                <span style={{ fontWeight: 600, color: theme.colors.warning }}>If not approved: </span>
                <span style={{ color: theme.colors.textSecondary }}>{authorityRequestDisplay.unapprovedConsequence}</span>
              </div>
            </div>
          </div>
        )}

        {/* Authority check + action buttons */}
        {!canApprove ? (
          <div role="alert" style={{
            padding: '0.5rem 0.75rem',
            borderRadius: theme.radius.sm,
            backgroundColor: '#fef3c7',
            border: '1px solid #fde047',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.5rem',
          }}>
            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#854d0e' }}>
                🔒 Requires "{governedAction.requiredAuthority}" authority
              </div>
              <div style={{ fontSize: '0.7rem', color: '#92400e' }}>
                Current: {currentAuthority}
              </div>
            </div>
            {onEscalate && (
              <button
                onClick={onEscalate}
                style={{
                  padding: '0.375rem 0.75rem',
                  borderRadius: theme.radius.sm,
                  border: '1px solid #b45309',
                  backgroundColor: '#fff',
                  color: '#b45309',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Escalate
              </button>
            )}
          </div>
        ) : confirming ? (
          /* Confirmation flow */
          <div role="form" aria-label="Confirm action" style={{
            padding: '0.625rem',
            borderRadius: theme.radius.sm,
            border: `1.5px solid ${theme.colors.danger}`,
            backgroundColor: theme.colors.dangerSubtle,
          }}>
            <div style={{
              fontSize: '0.8rem',
              fontWeight: 700,
              color: theme.colors.danger,
              marginBottom: '0.375rem',
            }}>
              Confirm: {action.label}
            </div>

            {(governedAction.reversibility === 'irreversible' || unmet.length > 0) && (
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  color: theme.colors.textSecondary,
                  marginBottom: '0.2rem',
                }}>
                  Rationale {governedAction.reversibility === 'irreversible' ? '*' : ''}
                </label>
                <textarea
                  value={rationale}
                  onChange={(e) => setRationale(e.target.value)}
                  placeholder="Why are you approving this action?"
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
            )}

            <div style={{
              display: 'flex',
              gap: '0.5rem',
              marginTop: '0.5rem',
            }}>
              <button
                onClick={() => handleDecision('approved')}
                disabled={
                  !delayReady ||
                  (governedAction.reversibility === 'irreversible' && !rationale.trim())
                }
                style={{
                  padding: '0.375rem 0.75rem',
                  borderRadius: theme.radius.sm,
                  border: 'none',
                  backgroundColor: theme.colors.danger,
                  color: '#fff',
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  cursor: delayReady ? 'pointer' : 'not-allowed',
                  opacity: delayReady ? 1 : 0.5,
                }}
              >
                {delayReady
                  ? 'Yes, approve'
                  : remaining > 0
                    ? `Wait ${remaining}s…`
                    : 'Wait…'}
              </button>
              <button
                onClick={() => handleDecision('rejected')}
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
                Reject
              </button>
              <button
                onClick={() => { setConfirming(false); setRationale(''); }}
                style={{
                  padding: '0.375rem 0.75rem',
                  borderRadius: theme.radius.sm,
                  border: 'none',
                  backgroundColor: 'transparent',
                  color: theme.colors.textMuted,
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          /* Normal action buttons */
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button
              onClick={() => setConfirming(true)}
              disabled={!preconditionsMet && unknown.length === 0}
              aria-disabled={!preconditionsMet && unknown.length === 0}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: theme.radius.sm,
                border: 'none',
                backgroundColor: action.variant === 'destructive'
                  ? theme.colors.danger
                  : theme.colors.accent,
                color: '#fff',
                fontWeight: 600,
                fontSize: '0.875rem',
                cursor: (!preconditionsMet && unknown.length === 0)
                  ? 'not-allowed'
                  : 'pointer',
                opacity: (!preconditionsMet && unknown.length === 0) ? 0.5 : 1,
              }}
            >
              {action.label}
            </button>
            <button
              onClick={() => handleDecision('deferred')}
              style={{
                padding: '0.5rem 0.75rem',
                borderRadius: theme.radius.sm,
                border: `1px solid ${theme.colors.border}`,
                backgroundColor: theme.colors.surface,
                color: theme.colors.textSecondary,
                fontSize: '0.8rem',
                cursor: 'pointer',
              }}
            >
              Defer
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function sectionLabel(theme: Theme): React.CSSProperties {
  return {
    fontSize: '0.65rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: theme.colors.textMuted,
    marginBottom: '0.25rem',
  };
}
