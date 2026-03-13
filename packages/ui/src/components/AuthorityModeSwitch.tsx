import React from 'react';
import type {
  AuthorityMode,
  AuthorityContext,
  AuthorityEscalationReason,
} from '@hari/core';
import {
  AUTHORITY_HIERARCHY,
  hasAuthority,
  getAuthorityCapabilities,
  getRecommendedDensity,
} from '@hari/core';
import { useTheme } from '../ThemeContext';
import type { Theme } from '../theme';

// ─────────────────────────────────────────────────────────────────────────────
// Pure helper — computes the human-readable countdown string for an expiry timestamp.
// Returns null when no expiry is set, 'Expired' when past, else e.g. '45m' or '1h 30m'.
// Extracted outside the component so it can be used in the lazy useState initializer.
// ─────────────────────────────────────────────────────────────────────────────
function computeExpiresIn(expiresAt?: string): string | null {
  if (!expiresAt) return null;
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return 'Expired';
  const mins = Math.ceil(ms / 60000);
  return mins > 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;
}

// ─────────────────────────────────────────────────────────────────────────────
// AuthorityModeSwitch
//
// Allows the human to view and change their current authority level.
// Authority escalation requires a reason (and justification for Override).
// The component enforces governance: no accidental escalation.
//
// Visual design:
//   - Four segmented buttons with icons and descriptions
//   - Current mode is highlighted; higher modes show lock icons
//   - Escalation triggers a justification modal
//   - Auto-expiry countdown when applicable
// ─────────────────────────────────────────────────────────────────────────────

const MODE_META: Record<AuthorityMode, {
  icon: string;
  label: string;
  description: string;
  color: string;
  bgColor: string;
}> = {
  observe: {
    icon: '👁',
    label: 'Observe',
    description: 'Read-only perception — see the state, no controls',
    color: '#0369a1',
    bgColor: '#e0f2fe',
  },
  intervene: {
    icon: '🔧',
    label: 'Intervene',
    description: 'Modify constraints — adjust parameters, filters, thresholds',
    color: '#6d28d9',
    bgColor: '#ede9fe',
  },
  approve: {
    icon: '✅',
    label: 'Approve',
    description: 'Authorize actions — confirm proposed agent actions',
    color: '#b45309',
    bgColor: '#fef3c7',
  },
  override: {
    icon: '⚡',
    label: 'Override',
    description: 'Emergency control — full access, mandatory justification',
    color: '#dc2626',
    bgColor: '#fee2e2',
  },
};

const ESCALATION_REASONS: { value: AuthorityEscalationReason; label: string }[] = [
  { value: 'approval_request', label: 'Agent requested approval' },
  { value: 'incident_response', label: 'Incident response' },
  { value: 'scheduled_maintenance', label: 'Scheduled maintenance' },
  { value: 'audit_review', label: 'Audit / review' },
  { value: 'emergency', label: 'Emergency' },
  { value: 'manual', label: 'Manual escalation' },
];

export interface AuthorityModeSwitchProps {
  /** Current authority context */
  authority: AuthorityContext;
  /** Called when the user changes authority mode */
  onModeChange: (
    newMode: AuthorityMode,
    reason: AuthorityEscalationReason,
    justification?: string,
  ) => void;
  /**
   * Called when the current authority mode expires (expiresAt has passed).
   * The caller should downgrade the authority to an appropriate level.
   */
  onExpiry?: () => void;
  /** Whether to show in compact mode (icon + label only) */
  compact?: boolean;
}

export function AuthorityModeSwitch({
  authority,
  onModeChange,
  onExpiry,
  compact = false,
}: AuthorityModeSwitchProps) {
  const { theme } = useTheme();
  const [escalationTarget, setEscalationTarget] = React.useState<AuthorityMode | null>(null);
  const [selectedReason, setSelectedReason] = React.useState<AuthorityEscalationReason>('manual');
  const [justification, setJustification] = React.useState('');

  // Live expiry countdown — updates every 30 s; fires onExpiry when time runs out
  const [expiresIn, setExpiresIn] = React.useState<string | null>(
    () => computeExpiresIn(authority.expiresAt),
  );

  React.useEffect(() => {
    if (!authority.expiresAt) {
      setExpiresIn(null);
      return;
    }

    setExpiresIn(computeExpiresIn(authority.expiresAt));

    const interval = setInterval(() => {
      const label = computeExpiresIn(authority.expiresAt!);
      setExpiresIn(label);

      if (label === 'Expired') {
        clearInterval(interval);
        onExpiry?.();
      }
    }, 30_000); // Re-check every 30 seconds

    return () => clearInterval(interval);
  }, [authority.expiresAt, onExpiry]);

  const current = authority.currentMode;
  const currentLevel = AUTHORITY_HIERARCHY.indexOf(current);
  const capabilities = getAuthorityCapabilities(current);

  const handleModeClick = (mode: AuthorityMode) => {
    const targetLevel = AUTHORITY_HIERARCHY.indexOf(mode);
    if (mode === current) return;

    // Downgrade — no justification needed
    if (targetLevel < currentLevel) {
      onModeChange(mode, 'manual');
      return;
    }

    // Escalation — require reason (and justification for override)
    setEscalationTarget(mode);
    setSelectedReason('manual');
    setJustification('');
  };

  const handleEscalationConfirm = () => {
    if (!escalationTarget) return;
    if (escalationTarget === 'override' && !justification.trim()) return;
    onModeChange(escalationTarget, selectedReason, justification || undefined);
    setEscalationTarget(null);
  };

  return (
    <div>
      {/* Mode selector — radiogroup semantics for mutual-exclusion */}
      <div
        role="radiogroup"
        aria-label="Authority mode"
        style={{
          display: 'flex',
          alignItems: 'stretch',
          gap: '2px',
          background: theme.colors.border,
          borderRadius: theme.radius.md,
          padding: '2px',
        }}>
        {AUTHORITY_HIERARCHY.map((mode) => {
          const meta = MODE_META[mode];
          const isActive = mode === current;
          const isHigher = AUTHORITY_HIERARCHY.indexOf(mode) > currentLevel;

          return (
            <button
              key={mode}
              role="radio"
              aria-checked={isActive}
              onClick={() => handleModeClick(mode)}
              title={meta.description}
              aria-label={`${meta.label}: ${meta.description}`}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: compact ? 'row' : 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: compact ? '0.25rem' : '0.15rem',
                padding: compact ? '0.375rem 0.5rem' : '0.5rem 0.375rem',
                borderRadius: `calc(${theme.radius.md} - 2px)`,
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.15s',
                backgroundColor: isActive ? meta.bgColor : theme.colors.surface,
                color: isActive ? meta.color : theme.colors.textMuted,
                fontWeight: isActive ? 700 : 400,
                fontSize: compact ? '0.75rem' : '0.7rem',
                position: 'relative',
                minWidth: 0,
              }}
            >
              <span style={{ fontSize: compact ? '0.9rem' : '1rem' }}>
                {isHigher && !isActive ? '🔒' : meta.icon}
              </span>
              <span style={{
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                {meta.label}
              </span>
              {isActive && (
                <span style={{
                  position: 'absolute',
                  bottom: '2px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: '16px',
                  height: '2px',
                  borderRadius: '1px',
                  backgroundColor: meta.color,
                }} />
              )}
            </button>
          );
        })}
      </div>

      {/* Status bar */}
      {!compact && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: '0.375rem',
          fontSize: '0.7rem',
          color: theme.colors.textMuted,
        }}>
          <span>
            Density: <strong style={{ color: theme.colors.textSecondary }}>
              {getRecommendedDensity(current)}
            </strong>
          </span>
          {expiresIn && (
            <span
              aria-live="polite"
              aria-atomic="true"
              aria-label={`Authority expires in: ${expiresIn}`}
              style={{
                color: expiresIn === 'Expired' ? theme.colors.danger : theme.colors.warning,
                fontWeight: 600,
              }}>
              ⏱ {expiresIn}
            </span>
          )}
          {authority.reason && (
            <span style={{ fontStyle: 'italic' }}>
              {ESCALATION_REASONS.find(r => r.value === authority.reason)?.label}
            </span>
          )}
        </div>
      )}

      {/* Escalation dialog */}
      {escalationTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Escalate authority to ${MODE_META[escalationTarget].label}`}
          style={{
          marginTop: '0.5rem',
          padding: '0.75rem',
          border: `1.5px solid ${MODE_META[escalationTarget].color}`,
          borderRadius: theme.radius.md,
          backgroundColor: MODE_META[escalationTarget].bgColor,
        }}>
          <div style={{
            fontSize: '0.8rem',
            fontWeight: 700,
            color: MODE_META[escalationTarget].color,
            marginBottom: '0.5rem',
          }}>
            {MODE_META[escalationTarget].icon} Escalate to {MODE_META[escalationTarget].label}
          </div>

          <div style={{ marginBottom: '0.5rem' }}>
            <label style={labelStyle(theme)}>Reason</label>
            <select
              value={selectedReason}
              onChange={(e) => setSelectedReason(e.target.value as AuthorityEscalationReason)}
              style={selectStyle(theme)}
            >
              {ESCALATION_REASONS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>

          {escalationTarget === 'override' && (
            <div style={{ marginBottom: '0.5rem' }}>
              <label style={labelStyle(theme)}>
                Justification <span style={{ color: theme.colors.danger }}>*</span>
              </label>
              <textarea
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                placeholder="Explain why emergency override is needed..."
                rows={2}
                style={{
                  ...selectStyle(theme),
                  resize: 'vertical',
                  minHeight: '3rem',
                }}
              />
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={handleEscalationConfirm}
              disabled={escalationTarget === 'override' && !justification.trim()}
              style={{
                padding: '0.375rem 0.75rem',
                borderRadius: theme.radius.sm,
                border: 'none',
                backgroundColor: MODE_META[escalationTarget].color,
                color: '#fff',
                fontWeight: 600,
                fontSize: '0.8rem',
                cursor: escalationTarget === 'override' && !justification.trim()
                  ? 'not-allowed'
                  : 'pointer',
                opacity: escalationTarget === 'override' && !justification.trim()
                  ? 0.5
                  : 1,
              }}
            >
              Confirm Escalation
            </button>
            <button
              onClick={() => setEscalationTarget(null)}
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
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function labelStyle(theme: Theme): React.CSSProperties {
  return {
    display: 'block',
    fontSize: '0.7rem',
    fontWeight: 600,
    color: theme.colors.textSecondary,
    marginBottom: '0.2rem',
  };
}

function selectStyle(theme: Theme): React.CSSProperties {
  return {
    width: '100%',
    padding: '0.375rem 0.5rem',
    borderRadius: theme.radius.sm,
    border: `1px solid ${theme.colors.border}`,
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    fontSize: '0.8rem',
    fontFamily: theme.typography.family,
  };
}
