import React from 'react';
import type {
  QuestionIntent,
  QuestionStatus,
  QuestionUrgency,
} from '@hari/core';
import { useTheme } from '../ThemeContext';
import type { Theme } from '../theme';

// ─────────────────────────────────────────────────────────────────────────────
// QuestionIntentBar
//
// Renders the active question that a SituationalView answers.  Includes:
//   - The question itself with urgency indicator
//   - Origin badge (who/what asked?)
//   - Sufficiency statement (agent's justification)
//   - Limitations (what the agent knows it's missing)
//   - Follow-up question chips (quick next questions)
//   - Human feedback controls (adequate ✓ / refine ✎)
//
// Rule: Every view answers a question. If the question isn't visible, the
//       human has no anchor for judgment.
// ─────────────────────────────────────────────────────────────────────────────

const URGENCY_META: Record<QuestionUrgency, { icon: string; color: string; label: string }> = {
  background: { icon: 'ℹ', color: '#6b7280', label: 'Background' },
  normal:     { icon: '●', color: '#3b82f6', label: 'Normal' },
  urgent:     { icon: '!', color: '#f59e0b', label: 'Urgent' },
  critical:   { icon: '‼', color: '#ef4444', label: 'Critical' },
};

const ORIGIN_LABELS: Record<string, string> = {
  human_explicit:   'You asked',
  human_implicit:   'Inferred from your actions',
  agent_proactive:  'Agent surfaced',
  system_triggered: 'System alert',
  follow_up:        'Follow-up',
};

export interface QuestionIntentBarProps {
  question: QuestionIntent;
  /** Current lifecycle status of the question */
  status: QuestionStatus;
  /** Called when the human selects a follow-up question */
  onFollowUp?: (followUpQuestion: string) => void;
  /** Called when the human marks the answer as adequate */
  onMarkAdequate?: () => void;
  /** Called when the human wants to refine the question */
  onRefine?: (refinedQuestion: string) => void;
  /** Compact mode: hide follow-ups and limitations */
  compact?: boolean;
}

export function QuestionIntentBar({
  question,
  status,
  onFollowUp,
  onMarkAdequate,
  onRefine,
  compact = false,
}: QuestionIntentBarProps) {
  const { theme } = useTheme();
  const [refining, setRefining] = React.useState(false);
  const [refinedText, setRefinedText] = React.useState('');
  const urgency = URGENCY_META[question.urgency];

  const handleRefineSubmit = () => {
    if (refinedText.trim() && onRefine) {
      onRefine(refinedText.trim());
      setRefining(false);
      setRefinedText('');
    }
  };

  return (
    <div
      style={{
        border: `1px solid ${theme.colors.border}`,
        borderRadius: theme.radius.md,
        backgroundColor: theme.colors.surface,
        overflow: 'hidden',
        ...(question.urgency === 'critical' ? {
          borderColor: '#ef4444',
          boxShadow: '0 0 0 1px rgba(239, 68, 68, 0.15)',
        } : {}),
      }}
      role="region"
      aria-label="Active question"
    >
      {/* Question header */}
      <div style={{
        padding: '0.625rem 0.75rem',
        backgroundColor: theme.colors.surfaceAlt,
        borderBottom: `1px solid ${theme.colors.border}`,
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.375rem',
        }}>
          {/* Urgency dot */}
          <span
            style={{
              fontSize: '0.75rem',
              color: urgency.color,
              marginTop: '0.1rem',
              flexShrink: 0,
            }}
            title={urgency.label}
            aria-label={`Urgency: ${urgency.label}`}
          >
            {urgency.icon}
          </span>

          {/* Question text */}
          <div style={{ flex: 1 }}>
            <div style={{
              fontSize: '0.9rem',
              fontWeight: 600,
              color: theme.colors.text,
              lineHeight: 1.35,
            }}>
              {question.question}
            </div>

            {/* Meta row */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginTop: '0.25rem',
              flexWrap: 'wrap',
            }}>
              <span style={chipStyle(theme, '#e0e7ff', '#3730a3')}>
                {ORIGIN_LABELS[question.origin] ?? question.origin}
              </span>
              <span style={chipStyle(theme, '#f0fdf4', '#166534')}>
                {question.domain}
              </span>
              <StatusBadge status={status} theme={theme} />
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: '0.625rem 0.75rem' }}>
        {/* Sufficiency statement */}
        {question.sufficiencyStatement && (
          <div style={{
            marginBottom: '0.5rem',
            padding: '0.375rem 0.5rem',
            borderRadius: theme.radius.sm,
            backgroundColor: '#f0fdf4',
            border: '1px solid #bbf7d0',
            fontSize: '0.8rem',
            color: '#166534',
            lineHeight: 1.4,
          }}>
            <span style={{ fontWeight: 700, marginRight: '0.25rem' }}>Agent:</span>
            {question.sufficiencyStatement}
          </div>
        )}

        {/* Limitations */}
        {!compact && question.limitations.length > 0 && (
          <div style={{ marginBottom: '0.5rem' }}>
            <div style={sectionLabel(theme)}>Known Limitations</div>
            {question.limitations.map((lim, i) => (
              <div key={i} style={{
                fontSize: '0.8rem',
                color: theme.colors.textSecondary,
                padding: '0.1rem 0',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.3rem',
              }}>
                <span style={{ color: '#f59e0b', flexShrink: 0 }}>⚠</span>
                <span>{lim}</span>
              </div>
            ))}
          </div>
        )}

        {/* Follow-up questions */}
        {!compact && question.suggestedFollowUps.length > 0 && (
          <div style={{ marginBottom: '0.5rem' }}>
            <div style={sectionLabel(theme)}>Follow-up Questions</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
              {question.suggestedFollowUps.map((fu, i) => (
                <button
                  key={i}
                  onClick={() => onFollowUp?.(fu.question)}
                  title={fu.rationale}
                  style={{
                    padding: '0.3rem 0.6rem',
                    borderRadius: '999px',
                    border: `1px solid ${theme.colors.border}`,
                    backgroundColor: theme.colors.surface,
                    color: theme.colors.accent,
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'background-color 0.15s',
                  }}
                  onMouseOver={(e) => (e.currentTarget.style.backgroundColor = theme.colors.accentSubtle)}
                  onMouseOut={(e) => (e.currentTarget.style.backgroundColor = theme.colors.surface)}
                >
                  {fu.question}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Human feedback */}
        {question.humanFeedback && (
          <div style={{
            padding: '0.375rem 0.5rem',
            borderRadius: theme.radius.sm,
            backgroundColor: theme.colors.surfaceAlt,
            fontSize: '0.75rem',
            color: theme.colors.textSecondary,
            border: `1px solid ${theme.colors.border}`,
            marginBottom: '0.5rem',
          }}>
            {question.humanFeedback.adequate
              ? '✓ Marked as adequate'
              : `✎ Refined: "${question.humanFeedback.refinedQuestion ?? '—'}"`}
          </div>
        )}

        {/* Feedback buttons (if not already given) */}
        {!question.humanFeedback && status === 'answered' && (
          <div>
            {refining ? (
              <div style={{ display: 'flex', gap: '0.375rem' }}>
                <input
                  type="text"
                  value={refinedText}
                  onChange={(e) => setRefinedText(e.target.value)}
                  placeholder="Refine your question…"
                  autoFocus
                  style={{
                    flex: 1,
                    padding: '0.375rem',
                    borderRadius: theme.radius.sm,
                    border: `1px solid ${theme.colors.border}`,
                    fontSize: '0.8rem',
                    fontFamily: theme.typography.family,
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleRefineSubmit();
                    if (e.key === 'Escape') setRefining(false);
                  }}
                />
                <button
                  onClick={handleRefineSubmit}
                  disabled={!refinedText.trim()}
                  style={smallBtn(theme, theme.colors.accent)}
                >
                  Send
                </button>
                <button
                  onClick={() => setRefining(false)}
                  style={smallBtn(theme, theme.colors.textMuted)}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={onMarkAdequate}
                  style={smallBtn(theme, '#166534', '#dcfce7')}
                >
                  ✓ Adequate
                </button>
                <button
                  onClick={() => setRefining(true)}
                  style={smallBtn(theme, theme.colors.accent, theme.colors.accentSubtle)}
                >
                  ✎ Refine question
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function StatusBadge({ status, theme }: { status: QuestionStatus; theme: Theme }) {
  const meta: Record<QuestionStatus, { label: string; color: string; bg: string }> = {
    pending:   { label: 'Pending',   color: '#854d0e', bg: '#fef9c3' },
    answering: { label: 'Thinking…', color: '#1d4ed8', bg: '#dbeafe' },
    answered:  { label: 'Answered',  color: '#166534', bg: '#dcfce7' },
    refined:   { label: 'Refined',   color: '#6d28d9', bg: '#ede9fe' },
    resolved:  { label: 'Resolved',  color: '#065f46', bg: '#d1fae5' },
    dismissed: { label: 'Dismissed', color: '#6b7280', bg: '#f3f4f6' },
  };
  const m = meta[status];
  return (
    <span style={{
      fontSize: '0.6rem',
      fontWeight: 700,
      padding: '0.1rem 0.35rem',
      borderRadius: '3px',
      backgroundColor: m.bg,
      color: m.color,
      textTransform: 'uppercase',
    }}>
      {m.label}
    </span>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────

function chipStyle(theme: Theme, bg: string, color: string): React.CSSProperties {
  return {
    fontSize: '0.6rem',
    fontWeight: 600,
    padding: '0.1rem 0.35rem',
    borderRadius: '3px',
    backgroundColor: bg,
    color,
  };
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

function smallBtn(
  theme: Theme,
  color: string,
  bg = 'transparent',
): React.CSSProperties {
  return {
    padding: '0.3rem 0.625rem',
    borderRadius: theme.radius.sm,
    border: `1px solid ${color}`,
    backgroundColor: bg,
    color,
    fontSize: '0.75rem',
    fontWeight: 600,
    cursor: 'pointer',
  };
}
