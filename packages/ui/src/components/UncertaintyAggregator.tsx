import React from 'react';
import type { UncertaintySummary } from '@hari/core';
import {
  decayConfidence,
  computeSensitivity,
  recommendNextQuestion,
  getUncertaintyLevel,
  hasCriticalUncertainty,
  getAssumptionsByCriticality,
} from '@hari/core';
import { useTheme } from '../ThemeContext';

// ─────────────────────────────────────────────────────────────────────────────
// UncertaintyAggregator
//
// Combines multiple uncertainty summaries from different data sources into a
// single actionable view.
//
// Features:
//   - Per-source confidence display with optional time-decay applied
//   - Sensitivity score per source (how much assumption risk exists)
//   - System-wide sensitivity gauge
//   - Recommended next question to reduce uncertainty
//   - Weakest-link callout — which source is dragging down overall confidence
// ─────────────────────────────────────────────────────────────────────────────

const CRITICALITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };

// ── Confidence bar ─────────────────────────────────────────────────────────────

interface ConfidenceBarProps {
  value: number;   // 0–1
  decayed?: number; // optional decayed value for comparison
  label?: string;
}

function ConfidenceBar({ value, decayed, label }: ConfidenceBarProps) {
  const { theme } = useTheme();
  const level = getUncertaintyLevel(decayed ?? value);

  const barColor: Record<string, string> = {
    confident: '#166534',
    moderate:  '#854d0e',
    low:       '#9a3412',
    unknown:   '#6b7280',
  };

  const displayValue = decayed ?? value;
  const pct = Math.round(displayValue * 100);

  return (
    <div aria-label={label ?? `Confidence: ${pct}%`} style={{ flex: 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
        <span style={{ fontSize: '0.6rem', color: theme.colors.textMuted, textTransform: 'uppercase' }}>
          {label ?? 'Confidence'}
        </span>
        <span style={{ fontSize: '0.65rem', fontWeight: 700, color: barColor[level] }}>
          {pct}%
        </span>
      </div>
      <div style={{
        height: '5px',
        borderRadius: '3px',
        backgroundColor: theme.colors.border,
        overflow: 'hidden',
        position: 'relative',
      }}>
        {/* raw (pre-decay) background track */}
        {decayed !== undefined && (
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              left: 0, top: 0, bottom: 0,
              width: `${Math.round(value * 100)}%`,
              backgroundColor: `${barColor[getUncertaintyLevel(value)]}40`,
              transition: 'width 0.3s',
            }}
          />
        )}
        {/* actual (decayed) fill */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: 0, top: 0, bottom: 0,
            width: `${pct}%`,
            backgroundColor: barColor[level],
            transition: 'width 0.3s',
          }}
        />
      </div>
    </div>
  );
}

// ── Source row ────────────────────────────────────────────────────────────────

interface SourceRowProps {
  label: string;
  summary: UncertaintySummary;
  ageMs?: number;
  halfLifeMs?: number;
  isWeakest?: boolean;
}

function SourceRow({ label, summary, ageMs, halfLifeMs, isWeakest }: SourceRowProps) {
  const { theme } = useTheme();
  const [expanded, setExpanded] = React.useState(false);

  const effective = halfLifeMs !== undefined && ageMs !== undefined
    ? decayConfidence(summary.overallConfidence, ageMs, halfLifeMs)
    : undefined;

  const sensitivity = computeSensitivity(summary);
  const criticalCount = summary.assumptions.filter((a) => a.criticality === 'critical').length;
  const topAssumptions = getAssumptionsByCriticality(summary).slice(0, 3);

  return (
    <li
      role="listitem"
      aria-label={`Source: ${label}`}
      style={{
        padding: '0.5rem 0.625rem',
        borderRadius: theme.radius.sm,
        border: `1px solid ${isWeakest ? theme.colors.danger : theme.colors.border}`,
        backgroundColor: isWeakest ? theme.colors.dangerSubtle : theme.colors.surface,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.25rem' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: theme.colors.text }}>
              {label}
            </span>
            {isWeakest && (
              <span
                aria-label="Weakest link"
                style={{
                  fontSize: '0.55rem',
                  fontWeight: 700,
                  padding: '0.1rem 0.3rem',
                  borderRadius: '3px',
                  backgroundColor: theme.colors.danger,
                  color: '#fff',
                  textTransform: 'uppercase',
                }}
              >
                Weakest link
              </span>
            )}
            {criticalCount > 0 && (
              <span
                aria-label={`${criticalCount} critical assumption${criticalCount > 1 ? 's' : ''}`}
                style={{
                  fontSize: '0.55rem',
                  fontWeight: 700,
                  padding: '0.1rem 0.3rem',
                  borderRadius: '3px',
                  backgroundColor: '#fee2e2',
                  color: '#991b1b',
                }}
              >
                {criticalCount} critical
              </span>
            )}
          </div>

          <div style={{ display: 'flex', gap: '0.625rem', alignItems: 'center' }}>
            <ConfidenceBar
              value={summary.overallConfidence}
              decayed={effective}
              label={effective !== undefined ? 'Effective confidence' : 'Confidence'}
            />
            <div style={{ flexShrink: 0 }}>
              <div style={{ fontSize: '0.55rem', color: theme.colors.textMuted, textTransform: 'uppercase', marginBottom: '2px' }}>Sensitivity</div>
              <span
                aria-label={`Sensitivity: ${Math.round(sensitivity * 100)}%`}
                style={{
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  color: sensitivity > 0.7 ? theme.colors.danger : sensitivity > 0.4 ? theme.colors.warning : theme.colors.text,
                }}
              >
                {Math.round(sensitivity * 100)}%
              </span>
            </div>
          </div>
        </div>

        {topAssumptions.length > 0 && (
          <button
            aria-expanded={expanded}
            aria-label={`Toggle assumptions for ${label}`}
            onClick={() => setExpanded(!expanded)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.65rem',
              color: theme.colors.textMuted,
              padding: '0.1rem 0.25rem',
              flexShrink: 0,
            }}
          >
            {expanded ? '▲' : '▼'}
          </button>
        )}
      </div>

      {expanded && topAssumptions.length > 0 && (
        <ul
          role="list"
          aria-label={`Assumptions for ${label}`}
          style={{ margin: '0.375rem 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}
        >
          {topAssumptions.map((a, i) => (
            <li
              key={i}
              role="listitem"
              aria-label={`Assumption: ${a.assumption}`}
              style={{
                fontSize: '0.68rem',
                color: theme.colors.textSecondary,
                paddingLeft: '0.5rem',
                borderLeft: `2px solid ${
                  a.criticality === 'critical' ? theme.colors.danger :
                  a.criticality === 'high' ? theme.colors.warning : theme.colors.border
                }`,
              }}
            >
              <span style={{
                fontWeight: 600,
                marginRight: '0.25rem',
                textTransform: 'uppercase',
                fontSize: '0.55rem',
                color: a.criticality === 'critical' ? theme.colors.danger : theme.colors.textMuted,
              }}>
                {a.criticality}
              </span>
              {a.assumption}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface UncertaintySource {
  label: string;
  summary: UncertaintySummary;
  /** How old this source's data is, in milliseconds */
  ageMs?: number;
  /** Confidence half-life (ms). Default: 5 minutes (300_000) */
  halfLifeMs?: number;
}

export interface UncertaintyAggregatorProps {
  sources: UncertaintySource[];
  title?: string;
  showSensitivity?: boolean;
  showRecommendation?: boolean;
  compact?: boolean;
}

// ── Main component ────────────────────────────────────────────────────────────

export function UncertaintyAggregator({
  sources,
  title = 'Uncertainty Overview',
  showSensitivity = true,
  showRecommendation = true,
  compact = false,
}: UncertaintyAggregatorProps) {
  const { theme } = useTheme();

  if (sources.length === 0) {
    return (
      <div
        role="region"
        aria-label="Uncertainty aggregator"
        style={{
          padding: '1rem',
          border: `1px solid ${theme.colors.border}`,
          borderRadius: theme.radius.md,
          backgroundColor: theme.colors.surface,
          fontSize: '0.75rem',
          color: theme.colors.textMuted,
          textAlign: 'center',
        }}
      >
        No uncertainty data available.
      </div>
    );
  }

  // Compute effective confidence per source (with decay if configured)
  const effectiveConfs = sources.map((s) => {
    const base = s.summary.overallConfidence;
    if (s.halfLifeMs !== undefined && s.ageMs !== undefined) {
      return decayConfidence(base, s.ageMs, s.halfLifeMs);
    }
    return base;
  });

  // Overall system confidence = min of all effective confidences (weakest link)
  const systemConfidence = Math.min(...effectiveConfs);
  const systemLevel = getUncertaintyLevel(systemConfidence);

  // Weakest source index
  const weakestIdx = effectiveConfs.indexOf(systemConfidence);

  // System sensitivity = average of all source sensitivities
  const sensitivities = sources.map((s) => computeSensitivity(s.summary));
  const avgSensitivity = sensitivities.reduce((a, b) => a + b, 0) / sensitivities.length;

  // Recommendation: use the weakest source's summary
  const recommendation = showRecommendation
    ? recommendNextQuestion(sources[weakestIdx].summary)
    : undefined;

  const hasCritical = sources.some((s) => hasCriticalUncertainty(s.summary));

  const levelColor: Record<string, string> = {
    confident: '#166534',
    moderate:  '#854d0e',
    low:       '#9a3412',
    unknown:   '#6b7280',
  };

  return (
    <div
      role="region"
      aria-label="Uncertainty aggregator"
      style={{
        border: `1px solid ${hasCritical ? theme.colors.danger : theme.colors.border}`,
        borderRadius: theme.radius.md,
        backgroundColor: theme.colors.surface,
        overflow: 'hidden',
        fontFamily: theme.typography.family,
      }}
    >
      {/* Header */}
      <div style={{
        padding: compact ? '0.5rem 0.75rem' : '0.625rem 0.875rem',
        borderBottom: `1px solid ${theme.colors.border}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: theme.colors.text }}>
          {title}
        </span>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {showSensitivity && !compact && (
            <span
              aria-label={`System sensitivity: ${Math.round(avgSensitivity * 100)}%`}
              style={{
                fontSize: '0.65rem',
                fontWeight: 600,
                color: theme.colors.textMuted,
              }}
            >
              Sensitivity: {Math.round(avgSensitivity * 100)}%
            </span>
          )}
          <span
            aria-label={`Overall system confidence: ${Math.round(systemConfidence * 100)}%`}
            style={{
              fontSize: '0.65rem',
              fontWeight: 700,
              padding: '0.1rem 0.35rem',
              borderRadius: '3px',
              backgroundColor: `${levelColor[systemLevel]}20`,
              color: levelColor[systemLevel],
            }}
          >
            {Math.round(systemConfidence * 100)}% system confidence
          </span>
        </div>
      </div>

      {/* Sources list */}
      <div style={{ padding: compact ? '0.375rem 0.625rem' : '0.5rem 0.875rem' }}>
        <ul
          role="list"
          aria-label="Uncertainty sources"
          style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}
        >
          {sources.map((src, i) => (
            <SourceRow
              key={src.label}
              label={src.label}
              summary={src.summary}
              ageMs={src.ageMs}
              halfLifeMs={src.halfLifeMs}
              isWeakest={i === weakestIdx && sources.length > 1}
            />
          ))}
        </ul>
      </div>

      {/* Recommendation CTA */}
      {recommendation && !compact && (
        <div
          role="note"
          aria-label="Recommended next step"
          style={{
            borderTop: `1px solid ${theme.colors.border}`,
            padding: '0.5rem 0.875rem',
            backgroundColor: theme.colors.accentSubtle,
            fontSize: '0.72rem',
            color: theme.colors.text,
          }}
        >
          <span style={{ fontWeight: 700, marginRight: '0.375rem', color: theme.colors.accent }}>
            ↗ Next:
          </span>
          {recommendation}
        </div>
      )}
    </div>
  );
}
