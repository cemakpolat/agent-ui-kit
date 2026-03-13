import React from 'react';
import type {
  AuthorityMode,
  AuthorityContext,
  ViewStatus,
} from '@hari/core';
import { useTheme } from '../ThemeContext';
import type { Theme } from '../theme';

// ─────────────────────────────────────────────────────────────────────────────
// TrustSurface
//
// A compact, always-visible trust indicator bar that lets humans instantly
// judge the legitimacy and safety of the current perception.
//
// The human must be able to answer these four questions at a glance:
//   1. What authority mode am I in right now?
//   2. How confident is the agent in this view?
//   3. Is this perception still valid (not expired)?
//   4. What is the current approval state?
//
// Rule: TrustSurface is mandatory for all SituationalView renders.
//       No view should ever be rendered without it.
//
// ── Rendering invariants ──────────────────────────────────────────────────────
//   - Confidence < 0.5   → danger color (red)
//   - Confidence 0.5–0.8 → warning color (amber)
//   - Confidence > 0.8   → success color (green)
//   - status='expired'   → entire surface rendered in danger style + block
//   - status='stale'     → warning color + "STALE" badge
//   - approvalState='blocked' → prominent "APPROVAL BLOCKED" indicator
// ─────────────────────────────────────────────────────────────────────────────

// ── Authority mode metadata ───────────────────────────────────────────────────

const AUTHORITY_META: Record<AuthorityMode, { icon: string; label: string; color: string; bg: string }> = {
  observe:   { icon: '👁',  label: 'Observe',   color: '#0369a1', bg: '#e0f2fe' },
  intervene: { icon: '🔧', label: 'Intervene', color: '#854d0e', bg: '#fef9c3' },
  approve:   { icon: '✓',  label: 'Approve',   color: '#166534', bg: '#dcfce7' },
  override:  { icon: '⚡', label: 'Override',  color: '#991b1b', bg: '#fee2e2' },
};

// ── Approval state ────────────────────────────────────────────────────────────

export type ApprovalState =
  | 'none'       // No actions pending approval
  | 'pending'    // One or more actions waiting for human approval
  | 'approved'   // All actions approved
  | 'rejected'   // One or more actions rejected
  | 'blocked'    // Approvals blocked (expired perception, missing authority, etc.)
  | 'escalated'; // Escalated to higher authority

const APPROVAL_META: Record<ApprovalState, { icon: string; label: string; color: string; bg: string }> = {
  none:      { icon: '—',  label: 'No actions',  color: '#6b7280', bg: '#f3f4f6' },
  pending:   { icon: '⏳', label: 'Pending',      color: '#854d0e', bg: '#fef9c3' },
  approved:  { icon: '✓',  label: 'Approved',    color: '#166534', bg: '#dcfce7' },
  rejected:  { icon: '✗',  label: 'Rejected',    color: '#991b1b', bg: '#fee2e2' },
  blocked:   { icon: '⛔', label: 'BLOCKED',     color: '#991b1b', bg: '#fee2e2' },
  escalated: { icon: '↑',  label: 'Escalated',   color: '#6d28d9', bg: '#ede9fe' },
};

// ── Confidence color resolve ──────────────────────────────────────────────────

function resolveConfidenceColors(
  confidence: number,
  theme: Theme,
): { color: string; bg: string; label: string } {
  if (confidence >= 0.8) return { color: theme.colors.success, bg: theme.colors.successSubtle, label: 'High' };
  if (confidence >= 0.5) return { color: theme.colors.warning, bg: theme.colors.warningSubtle, label: 'Medium' };
  return { color: theme.colors.danger, bg: theme.colors.dangerSubtle, label: 'Low' };
}

// ── Temporal validity ─────────────────────────────────────────────────────────

function formatTimeRemaining(expiresAt?: string | null): { text: string; isExpired: boolean } {
  if (!expiresAt) return { text: 'No expiry set', isExpired: false };
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return { text: 'Expired', isExpired: true };
  const mins = Math.ceil(ms / 60000);
  if (mins > 60) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return { text: m > 0 ? `${h}h ${m}m` : `${h}h`, isExpired: false };
  }
  return { text: `${mins}m`, isExpired: false };
}

const STATUS_META: Record<ViewStatus, { icon: string; label: string; color: string; bg: string }> = {
  active:       { icon: '●', label: 'Active',       color: '#166534', bg: '#dcfce7' },
  stale:        { icon: '◐', label: 'Stale',        color: '#854d0e', bg: '#fef9c3' },
  expired:      { icon: '○', label: 'Expired',      color: '#991b1b', bg: '#fee2e2' },
  superseded:   { icon: '←', label: 'Superseded',   color: '#6b7280', bg: '#f3f4f6' },
  hypothetical: { icon: '◇', label: 'Hypothetical', color: '#6d28d9', bg: '#ede9fe' },
};

// ── Component ─────────────────────────────────────────────────────────────────

export interface TrustSurfaceProps {
  /** Current human authority context */
  authority: AuthorityContext | AuthorityMode;

  /** Agent confidence in the current view (0–1) */
  confidence: number;

  /** Current temporal validity of the perception */
  viewStatus: ViewStatus;

  /** ISO 8601 expiry timestamp — surfaced as a countdown */
  expiresAt?: string | null;

  /** Human-readable invalidation condition (alternative to expiresAt) */
  invalidationCondition?: string;

  /** Current approval state of governed actions in this view */
  approvalState?: ApprovalState;

  /** If true, render in a horizontal compact strip (default: false = full row) */
  compact?: boolean;

  /** Called when the human clicks the authority indicator to switch modes */
  onAuthorityClick?: () => void;
}

const styles = {
  bar: (theme: Theme): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '8px 12px',
    backgroundColor: theme.colors.surface,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.md,
    fontSize: '0.7rem',
    flexWrap: 'wrap',
  }),

  chip: (color: string, bg: string): React.CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '2px 8px',
    borderRadius: 4,
    color,
    backgroundColor: bg,
    fontWeight: 600,
    fontSize: '0.72rem',
    whiteSpace: 'nowrap',
    cursor: 'default',
  }),

  label: (theme: Theme): React.CSSProperties => ({
    color: theme.colors.textMuted,
    fontSize: '0.68rem',
    fontWeight: 500,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  }),

  divider: (theme: Theme): React.CSSProperties => ({
    width: 1,
    height: 16,
    backgroundColor: theme.colors.border,
    flexShrink: 0,
  }),

  expiredBanner: (theme: Theme): React.CSSProperties => ({
    width: '100%',
    padding: '4px 12px',
    backgroundColor: theme.colors.dangerSubtle,
    border: `1px solid ${theme.colors.danger}`,
    borderRadius: theme.radius.sm,
    color: theme.colors.danger,
    fontSize: '0.75rem',
    fontWeight: 700,
    textAlign: 'center' as const,
    marginBottom: 4,
  }),

  invalidationNote: (theme: Theme): React.CSSProperties => ({
    color: theme.colors.textMuted,
    fontSize: '0.68rem',
    fontStyle: 'italic',
    maxWidth: 280,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }),
};

export function TrustSurface({
  authority,
  confidence,
  viewStatus,
  expiresAt,
  invalidationCondition,
  approvalState = 'none',
  compact = false,
  onAuthorityClick,
}: TrustSurfaceProps) {
  const { theme } = useTheme();

  // Resolve authority mode from either a full context or a bare mode string
  const authorityMode: AuthorityMode =
    typeof authority === 'string' ? authority : authority.currentMode;
  const authMeta = AUTHORITY_META[authorityMode];
  const confidenceMeta = resolveConfidenceColors(confidence, theme);
  const statusMeta = STATUS_META[viewStatus];
  const approvalMeta = APPROVAL_META[approvalState];
  const temporal = formatTimeRemaining(expiresAt);
  const isExpired = viewStatus === 'expired' || temporal.isExpired;
  const isStale = viewStatus === 'stale';

  return (
    <div
      role="region"
      aria-label="Trust Surface — perception legitimacy indicators"
      style={{ display: 'flex', flexDirection: 'column', gap: 4 }}
    >
      {/* ── Expired banner — blocks the view visually ── */}
      {isExpired && (
        <div style={styles.expiredBanner(theme)}>
          ⛔ PERCEPTION EXPIRED — This view reflects outdated state. Do not approve actions based on expired perception.
        </div>
      )}

      {/* ── Trust strip ─────────────────────────────── */}
      <div style={styles.bar(theme)}>

        {/* Authority mode */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={styles.label(theme)}>Authority</span>
          <button
            style={{
              ...styles.chip(authMeta.color, authMeta.bg),
              cursor: onAuthorityClick ? 'pointer' : 'default',
              border: 'none',
            }}
            onClick={onAuthorityClick}
            title={`Current authority mode: ${authMeta.label}. ${onAuthorityClick ? 'Click to change.' : ''}`}
          >
            {authMeta.icon} {authMeta.label}
          </button>
        </div>

        <div style={styles.divider(theme)} />

        {/* Confidence */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={styles.label(theme)}>Confidence</span>
          <span
            style={styles.chip(confidenceMeta.color, confidenceMeta.bg)}
            title={`Agent confidence: ${Math.round(confidence * 100)}% — ${confidenceMeta.label}`}
          >
            {Math.round(confidence * 100)}% {confidenceMeta.label}
          </span>
        </div>

        <div style={styles.divider(theme)} />

        {/* Temporal validity */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={styles.label(theme)}>Validity</span>
          <span
            style={styles.chip(statusMeta.color, statusMeta.bg)}
            title={expiresAt ? `Expires at ${expiresAt}` : invalidationCondition ?? 'No expiry set'}
          >
            {statusMeta.icon} {isExpired ? 'Expired' : isStale ? 'Stale' : temporal.text !== 'No expiry set' ? `${statusMeta.label} · ${temporal.text}` : statusMeta.label}
          </span>
          {invalidationCondition && !compact && (
            <span
              style={styles.invalidationNote(theme)}
              title={`Invalidated when: ${invalidationCondition}`}
            >
              Invalidated when: {invalidationCondition}
            </span>
          )}
        </div>

        <div style={styles.divider(theme)} />

        {/* Approval state */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={styles.label(theme)}>Approval</span>
          <span
            style={styles.chip(approvalMeta.color, approvalMeta.bg)}
            title={`Approval state: ${approvalMeta.label}`}
          >
            {approvalMeta.icon} {approvalMeta.label}
          </span>
        </div>

        {/* Confidence < 0.5 warning */}
        {confidence < 0.5 && !compact && (
          <>
            <div style={styles.divider(theme)} />
            <span
              style={{
                color: theme.colors.danger,
                fontSize: '0.68rem',
                fontWeight: 600,
              }}
              title="Confidence below 50% — this perception has significant uncertainty. Review unknowns before acting."
            >
              ⚠ Low confidence — do not approve without reviewing unknowns
            </span>
          </>
        )}
      </div>
    </div>
  );
}
