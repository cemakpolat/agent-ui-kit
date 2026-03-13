import React from 'react';
import type {
  SituationalView,
  QuestionIntent,
  QuestionStatus,
  AuthorityMode,
  AuthorityContext,
  AuthorityEscalationReason,
  GovernedAction,
  DecisionOutcome,
  DecisionRecord,
  TemporalLens,
  UncertaintySummary,
  CompiledView,
} from '@hari/core';
import {
  computeViewStatus,
  isViewExpired,
  isViewStale,
} from '@hari/core';
import { useTheme } from '../ThemeContext';
import type { Theme } from '../theme';
import { QuestionIntentBar } from './QuestionIntentBar';
import { TrustSurface } from './TrustSurface';
import type { ApprovalState } from './TrustSurface';
import { UncertaintyIndicators } from './UncertaintyIndicators';
import { TemporalLensOverlay } from './TemporalLensOverlay';
import { AuthorityModeSwitch } from './AuthorityModeSwitch';
import { GovernedActionPanel } from './GovernedActionPanel';
import { DecisionRecordViewer } from './DecisionRecordViewer';
import { IntentRenderer } from './IntentRenderer';

// ─────────────────────────────────────────────────────────────────────────────
// SituationalViewRenderer
//
// The top-level orchestrator for HARI v0.3+ governance-aware rendering.
// It composes every governance layer around the actual domain content:
//
//   ┌─────────────────────────────────────────────────────────┐
//   │ QuestionIntentBar  (what question does this answer?)    │
//   ├─────────────────────────────────────────────────────────┤
//   │ ViewScope / Status / Confidence                        │
//   ├─────────────────────────────────────────────────────────┤
//   │ UncertaintyIndicators  (what's unknown, assumed)        │
//   ├─────────────────────────────────────────────────────────┤
//   │ TemporalLensSelector  (now / before / after)           │
//   ├─────────────────────────────────────────────────────────┤
//   │ ┌─────────────────────────────────────────────────────┐ │
//   │ │              IntentRenderer                         │ │
//   │ │     (existing domain component rendering)           │ │
//   │ └─────────────────────────────────────────────────────┘ │
//   ├─────────────────────────────────────────────────────────┤
//   │ GovernedActions  (if any)                              │
//   ├─────────────────────────────────────────────────────────┤
//   │ AuthorityModeSwitch                                    │
//   ├─────────────────────────────────────────────────────────┤
//   │ DecisionRecordViewer (audit trail)                     │
//   └─────────────────────────────────────────────────────────┘
//
// Rule: No view without context. Context is not decoration — it IS governance.
// ─────────────────────────────────────────────────────────────────────────────

const VIEW_STATUS_META: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  active:       { label: 'Active',       color: '#166534', bg: '#dcfce7', icon: '●' },
  stale:        { label: 'Stale',        color: '#854d0e', bg: '#fef9c3', icon: '◐' },
  expired:      { label: 'Expired',      color: '#991b1b', bg: '#fee2e2', icon: '○' },
  superseded:   { label: 'Superseded',   color: '#6b7280', bg: '#f3f4f6', icon: '←' },
  hypothetical: { label: 'Hypothetical', color: '#6d28d9', bg: '#ede9fe', icon: '◇' },
};

export interface SituationalViewRendererProps {
  /** The situational view to render */
  view: SituationalView;

  /** Compiled view from compileIntent(view.renderContract) */
  compiledView: CompiledView;

  /** Optional question that this view answers */
  question?: QuestionIntent;
  /** Question lifecycle status */
  questionStatus?: QuestionStatus;

  /** Current authority context */
  authority?: AuthorityContext;

  /** Governed actions associated with this view */
  governedActions?: GovernedAction[];

  /** Decision records (audit trail) */
  decisionRecords?: DecisionRecord[];

  /** Temporal lens data */
  temporalLens?: TemporalLens;

  /** Uncertainty summary for this view */
  uncertainty?: UncertaintySummary;

  /**
   * Approval state for the TrustSurface.
   * Defaults to 'blocked' when view is expired, 'none' when no actions pending.
   */
  approvalState?: ApprovalState;

  // ── Callbacks ─────────────────────────────────────────────────────────

  /** Intent renderer action callback */
  onActionExecute?: (actionId: string, payload?: Record<string, unknown>) => void;
  /** Ambiguity control change */
  onAmbiguityChange?: (controlId: string, value: unknown) => void;
  /** What-if query */
  onWhatIf?: (query: string) => void;

  /** Authority mode change */
  onAuthorityChange?: (mode: AuthorityMode, reason: AuthorityEscalationReason, justification?: string) => void;

  /** Governed action decision */
  onGovernedDecision?: (
    actionId: string,
    outcome: DecisionOutcome,
    rationale?: string,
  ) => void;
  /** Escalation request */
  onEscalate?: () => void;

  /** Follow-up question selected */
  onFollowUp?: (question: string) => void;
  /** Mark answer adequate */
  onMarkAdequate?: () => void;
  /** Refine question */
  onRefine?: (refined: string) => void;

  /** Temporal lens change */
  onLensChange?: (lens: 'now' | 'before' | 'after') => void;

  /** Compact mode */
  compact?: boolean;
}

export function SituationalViewRenderer({
  view,
  compiledView,
  question,
  questionStatus = 'answered',
  authority,
  governedActions = [],
  decisionRecords = [],
  temporalLens,
  uncertainty,
  approvalState: approvalStateProp,
  onActionExecute,
  onAmbiguityChange,
  onWhatIf,
  onAuthorityChange,
  onGovernedDecision,
  onEscalate,
  onFollowUp,
  onMarkAdequate,
  onRefine,
  onLensChange,
  compact = false,
}: SituationalViewRendererProps) {
  const { theme } = useTheme();
  const effectiveStatus = computeViewStatus(view);
  const statusMeta = VIEW_STATUS_META[effectiveStatus];

  // Derive approval state from context when not explicitly provided
  const approvalState: ApprovalState =
    approvalStateProp ??
    (effectiveStatus === 'expired' ? 'blocked'
      : governedActions.length > 0 ? 'pending'
      : 'none');

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
        ...(effectiveStatus === 'expired' || effectiveStatus === 'stale' ? {
          opacity: effectiveStatus === 'expired' ? 0.5 : 0.75,
        } : {}),
        ...(effectiveStatus === 'hypothetical' ? {
          borderLeft: `3px solid #8b5cf6`,
          paddingLeft: '0.5rem',
        } : {}),
      }}
      role="article"
      aria-label={`Situational view: ${view.question}`}
    >
      {/* ── Question ──────────────────────────────────────────────────── */}
      {question ? (
        <QuestionIntentBar
          question={question}
          status={questionStatus}
          onFollowUp={onFollowUp}
          onMarkAdequate={onMarkAdequate}
          onRefine={onRefine}
          compact={compact}
        />
      ) : (
        /* Fallback: show the view's built-in question */
        <div style={{
          padding: '0.5rem 0.75rem',
          borderRadius: theme.radius.md,
          backgroundColor: theme.colors.surfaceAlt,
          border: `1px solid ${theme.colors.border}`,
        }}>
          <div style={{
            fontSize: '0.9rem',
            fontWeight: 600,
            color: theme.colors.text,
          }}>
            {view.question}
          </div>
          {view.answerSummary && (
            <div style={{
              fontSize: '0.8rem',
              color: theme.colors.textSecondary,
              marginTop: '0.2rem',
            }}>
              {view.answerSummary}
            </div>
          )}
        </div>
      )}

      {/* ── Trust Surface — mandatory legitimacy indicator ───────────── */}
      {authority && (
        <TrustSurface
          authority={authority}
          confidence={view.confidence}
          viewStatus={effectiveStatus}
          expiresAt={view.expiresAt}
          invalidationCondition={(view as { invalidationCondition?: string }).invalidationCondition}
          approvalState={approvalState}
          compact={compact}
          onAuthorityClick={onAuthorityChange ? () => {/* handled by AuthorityModeSwitch below */} : undefined}
        />
      )}

      {/* ── View metadata bar ─────────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        flexWrap: 'wrap',
        padding: '0.25rem 0',
      }}>
        {/* Status badge */}
        <span style={{
          fontSize: '0.6rem',
          fontWeight: 700,
          padding: '0.1rem 0.35rem',
          borderRadius: '3px',
          backgroundColor: statusMeta.bg,
          color: statusMeta.color,
          textTransform: 'uppercase',
        }}>
          {statusMeta.icon} {statusMeta.label}
        </span>

        {/* Confidence */}
        <span style={{
          fontSize: '0.65rem',
          fontWeight: 600,
          color: view.confidence >= 0.8 ? '#166534'
            : view.confidence >= 0.5 ? '#854d0e'
            : '#991b1b',
        }}>
          {Math.round(view.confidence * 100)}% confident
        </span>

        {/* Scope chips */}
        {view.scope.systems.map((sys) => (
          <span key={sys} style={{
            fontSize: '0.6rem',
            padding: '0.1rem 0.3rem',
            borderRadius: '3px',
            backgroundColor: theme.colors.surfaceAlt,
            color: theme.colors.textSecondary,
            border: `1px solid ${theme.colors.border}`,
          }}>
            {sys}
          </span>
        ))}

        {view.scope.riskLevel && (
          <span style={{
            fontSize: '0.6rem',
            fontWeight: 700,
            padding: '0.1rem 0.3rem',
            borderRadius: '3px',
            backgroundColor: view.scope.riskLevel === 'critical' ? '#fee2e2'
              : view.scope.riskLevel === 'high' ? '#fef9c3'
              : '#f0fdf4',
            color: view.scope.riskLevel === 'critical' ? '#991b1b'
              : view.scope.riskLevel === 'high' ? '#854d0e'
              : '#166534',
            textTransform: 'uppercase',
          }}>
            {view.scope.riskLevel} risk
          </span>
        )}

        {/* Stale / Expired warning */}
        {(effectiveStatus === 'stale' || effectiveStatus === 'expired') && (
          <span style={{
            fontSize: '0.65rem',
            color: '#991b1b',
            fontWeight: 600,
          }}>
            ⚠ {effectiveStatus === 'stale' ? 'Data may be stale' : 'View expired'}
          </span>
        )}
      </div>

      {/* ── Unknowns & assumptions (inline if no full uncertainty) ───── */}
      {!uncertainty && (view.unknowns.length > 0 || view.assumptions.length > 0) && !compact && (
        <div style={{
          fontSize: '0.75rem',
          color: theme.colors.textSecondary,
          padding: '0.25rem 0.5rem',
          borderRadius: theme.radius.sm,
          backgroundColor: '#fffbeb',
          border: '1px solid #fde68a',
        }}>
          {view.unknowns.length > 0 && (
            <div>
              <span style={{ fontWeight: 600 }}>Unknown: </span>
              {view.unknowns.join('; ')}
            </div>
          )}
          {view.assumptions.length > 0 && (
            <div>
              <span style={{ fontWeight: 600 }}>Assuming: </span>
              {view.assumptions.join('; ')}
            </div>
          )}
        </div>
      )}

      {/* ── Uncertainty (full) ────────────────────────────────────────── */}
      {uncertainty && (
        <UncertaintyIndicators summary={uncertainty} compact={compact} />
      )}

      {/* ── Temporal lens ─────────────────────────────────────────────── */}
      {temporalLens && (
        <TemporalLensOverlay
          lens={temporalLens}
          onLensChange={onLensChange}
          compact={compact}
        />
      )}

      {/* ── Authority mode ────────────────────────────────────────────── */}
      {authority && onAuthorityChange && (
        <AuthorityModeSwitch
          authority={authority}
          onModeChange={onAuthorityChange}
          compact={compact}
        />
      )}

      {/* ── Main content (IntentRenderer) ─────────────────────────────── */}
      <div style={{
        border: `1px solid ${theme.colors.border}`,
        borderRadius: theme.radius.md,
        overflow: 'hidden',
      }}>
        <IntentRenderer
          compiledView={compiledView}
          onActionExecute={onActionExecute}
          onAmbiguityChange={onAmbiguityChange}
          onWhatIf={onWhatIf}
        />
      </div>

      {/* ── Governed actions ──────────────────────────────────────────── */}
      {governedActions.length > 0 && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.375rem',
        }}>
          <div style={{
            fontSize: '0.65rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: theme.colors.textMuted,
          }}>
            Governed Actions ({governedActions.length})
          </div>
          {governedActions.map((ga) => (
            <GovernedActionPanel
              key={ga.action.id ?? ga.intent}
              governedAction={ga}
              currentAuthority={authority?.currentMode ?? 'observe'}
              onDecision={(outcome, rationale) =>
                onGovernedDecision?.(ga.action.id ?? ga.intent, outcome, rationale)
              }
              onEscalate={onEscalate}
              compact={compact}
            />
          ))}
        </div>
      )}

      {/* ── Decision audit trail ──────────────────────────────────────── */}
      {decisionRecords.length > 0 && !compact && (
        <DecisionRecordViewer records={decisionRecords} compact={compact} />
      )}
    </div>
  );
}
