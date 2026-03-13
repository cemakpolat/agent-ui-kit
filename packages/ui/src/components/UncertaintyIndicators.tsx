import React from 'react';
import type {
  UncertaintySummary,
  UncertaintyIndicator,
} from '@hari/core';
import {
  getUncertaintyLevel,
  hasCriticalUncertainty,
  getAssumptionsByCriticality,
} from '@hari/core';
import { useTheme } from '../ThemeContext';
import type { Theme } from '../theme';

// ─────────────────────────────────────────────────────────────────────────────
// UncertaintyIndicators
//
// Renders uncertainty information at the view level.  Displays:
//   - Overall confidence gauge
//   - Known unknowns list
//   - Assumptions with criticality badges
//   - Critical uncertainty warnings
//
// Design: uncertainty is never hidden. If confidence is low, the indicators
// are prominent. If confidence is high, they're subtle but accessible.
// ─────────────────────────────────────────────────────────────────────────────

const LEVEL_STYLES: Record<string, {
  color: string;
  bgColor: string;
  icon: string;
  label: string;
}> = {
  confident: { color: '#166534', bgColor: '#f0fdf4', icon: '✓', label: 'High Confidence' },
  moderate:  { color: '#854d0e', bgColor: '#fefce8', icon: '~', label: 'Moderate Confidence' },
  low:       { color: '#991b1b', bgColor: '#fee2e2', icon: '⚠', label: 'Low Confidence' },
  unknown:   { color: '#831843', bgColor: '#fdf2f8', icon: '?', label: 'Unknown' },
};

const CRITICALITY_COLORS: Record<string, { color: string; bg: string }> = {
  low:      { color: '#166534', bg: '#dcfce7' },
  medium:   { color: '#854d0e', bg: '#fef9c3' },
  high:     { color: '#9a3412', bg: '#ffedd5' },
  critical: { color: '#991b1b', bg: '#fee2e2' },
};

export interface UncertaintyIndicatorsProps {
  summary: UncertaintySummary;
  /** Whether to show in compact mode (gauge + critical warnings only) */
  compact?: boolean;
}

export function UncertaintyIndicators({
  summary,
  compact = false,
}: UncertaintyIndicatorsProps) {
  const { theme } = useTheme();
  const [expanded, setExpanded] = React.useState(false);
  const level = getUncertaintyLevel(summary.overallConfidence);
  const style = LEVEL_STYLES[level];
  const isCritical = hasCriticalUncertainty(summary);
  const sortedAssumptions = React.useMemo(
    () => getAssumptionsByCriticality(summary),
    [summary],
  );

  if (compact) {
    return (
      <button
        onClick={() => setExpanded(!expanded)}
        title="View uncertainty details"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.25rem',
          backgroundColor: style.bgColor,
          color: style.color,
          border: `1px solid ${style.color}20`,
          borderRadius: theme.radius.sm,
          padding: '0.15rem 0.5rem',
          fontSize: '0.7rem',
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        {style.icon} {Math.round(summary.overallConfidence * 100)}%
        {isCritical && <span style={{ color: '#dc2626' }}>⚠</span>}
      </button>
    );
  }

  return (
    <div
      role="region"
      aria-label="Confidence and uncertainty"
      style={{
        border: `1px solid ${isCritical ? style.color + '40' : theme.colors.border}`,
        borderRadius: theme.radius.md,
        backgroundColor: isCritical ? style.bgColor : theme.colors.surface,
        overflow: 'hidden',
      }}>
      {/* Confidence gauge header */}
      <div
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        aria-controls="uncertainty-details"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.5rem 0.75rem',
          cursor: 'pointer',
        }}
        onClick={() => setExpanded(!expanded)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setExpanded(!expanded);
          }
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <ConfidenceGauge confidence={summary.overallConfidence} theme={theme} />
          <div>
            <div style={{
              fontSize: '0.8rem',
              fontWeight: 600,
              color: style.color,
            }}>
              {style.icon} {style.label}
            </div>
            <div style={{ fontSize: '0.7rem', color: theme.colors.textMuted }}>
              {Math.round(summary.overallConfidence * 100)}% confidence
              {summary.knownUnknowns.length > 0 &&
                ` · ${summary.knownUnknowns.length} unknown${summary.knownUnknowns.length > 1 ? 's' : ''}`}
              {sortedAssumptions.length > 0 &&
                ` · ${sortedAssumptions.length} assumption${sortedAssumptions.length > 1 ? 's' : ''}`}
            </div>
          </div>
        </div>

        <span style={{
          fontSize: '0.7rem',
          color: theme.colors.textMuted,
          transform: expanded ? 'rotate(180deg)' : 'none',
          transition: 'transform 0.15s',
        }}>
          ▼
        </span>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div
          id="uncertainty-details"
          style={{
            padding: '0 0.75rem 0.75rem',
            borderTop: `1px solid ${theme.colors.border}`,
          }}>
          {/* Known unknowns */}
          {summary.knownUnknowns.length > 0 && (
            <div style={{ marginTop: '0.5rem' }}>
              <div style={sectionLabel(theme)}>
                Known Unknowns
              </div>
              <ul role="list" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {summary.knownUnknowns.map((u, i) => (
                  <li key={i} role="listitem" style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.375rem',
                    fontSize: '0.8rem',
                    color: theme.colors.text,
                    padding: '0.2rem 0',
                  }}>
                    <span style={{ color: '#dc2626', flexShrink: 0 }}>?</span>
                    <span>{u}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Assumptions */}
          {sortedAssumptions.length > 0 && (
            <div style={{ marginTop: '0.5rem' }}>
              <div style={sectionLabel(theme)}>
                Assumptions
              </div>
              <ul role="list" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {sortedAssumptions.map((a, i) => {
                  const critStyle = CRITICALITY_COLORS[a.criticality];
                  return (
                    <li key={i} role="listitem" style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '0.375rem',
                      fontSize: '0.8rem',
                      color: theme.colors.text,
                      padding: '0.25rem 0',
                    }}>
                      <span style={{
                        flexShrink: 0,
                        fontSize: '0.6rem',
                        fontWeight: 700,
                        padding: '0.1rem 0.35rem',
                        borderRadius: '3px',
                        backgroundColor: critStyle.bg,
                        color: critStyle.color,
                        textTransform: 'uppercase',
                      }}>
                        {a.criticality}
                      </span>
                      <div>
                        <div>{a.assumption}</div>
                        {a.impactIfWrong && (
                          <div style={{
                            fontSize: '0.7rem',
                            color: theme.colors.textMuted,
                            fontStyle: 'italic',
                            marginTop: '0.1rem',
                          }}>
                            If wrong: {a.impactIfWrong}
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* Low-confidence elements */}
          {summary.unknownElements.length > 0 && (
            <div style={{ marginTop: '0.5rem' }}>
              <div style={sectionLabel(theme)}>
                Unknown / Assumed Values
              </div>
              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '0.25rem',
              }}>
                {summary.unknownElements.map((el, i) => (
                  <span key={i} style={{
                    fontSize: '0.7rem',
                    padding: '0.15rem 0.4rem',
                    borderRadius: '3px',
                    backgroundColor: '#fdf2f8',
                    color: '#831843',
                    border: '1px solid #f9a8d420',
                  }}>
                    {el}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Confidence Gauge (mini arc) ──────────────────────────────────────────────

function ConfidenceGauge({ confidence, theme }: { confidence: number; theme: Theme }) {
  const level = getUncertaintyLevel(confidence);
  const style = LEVEL_STYLES[level];
  const pct = Math.round(confidence * 100);
  const size = 32;
  const strokeWidth = 3;
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const dashOffset = circumference * (1 - confidence);

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={theme.colors.border}
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={style.color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
        />
      </svg>
      <div style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '0.55rem',
        fontWeight: 700,
        color: style.color,
      }}>
        {pct}
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
