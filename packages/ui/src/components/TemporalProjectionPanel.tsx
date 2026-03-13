import React from 'react';
import type {
  TemporalProjection,
  WhatIfScenario,
  AlternativeTimeline,
  ProjectionPoint,
} from '@hari/core';
import {
  getRecommendedTimeline,
  getLatestPrediction,
  getLatestActual,
  getProjectedChange,
  sortAlternativesByProbability,
} from '@hari/core';
import { useTheme } from '../ThemeContext';

// ─────────────────────────────────────────────────────────────────────────────
// TemporalProjectionPanel
//
// Visualises forward-looking projections and what-if scenarios for a metric.
//
// Features:
//   - Inline sparkline (text-based, no canvas) for historical + predicted data
//   - Confidence display with level indicator
//   - What-if scenario comparison: alternative timelines ranked by probability
//   - Recommended timeline highlighted
//   - Caveats and limitations clearly surfaced
// ─────────────────────────────────────────────────────────────────────────────

// ── Risk level colours ────────────────────────────────────────────────────────

const RISK_COLOURS = {
  low:      { color: '#166534', bg: '#dcfce7' },
  medium:   { color: '#854d0e', bg: '#fef9c3' },
  high:     { color: '#9a3412', bg: '#ffedd5' },
  critical: { color: '#991b1b', bg: '#fee2e2' },
};

// ── Confidence level -> label ─────────────────────────────────────────────────

function confidenceLabel(c: number): string {
  if (c >= 0.85) return 'High';
  if (c >= 0.6)  return 'Moderate';
  if (c >= 0.35) return 'Low';
  return 'Very Low';
}

function confidenceColor(c: number): string {
  if (c >= 0.85) return '#166534';
  if (c >= 0.6)  return '#854d0e';
  if (c >= 0.35) return '#9a3412';
  return '#991b1b';
}

// ── Sparkline ─────────────────────────────────────────────────────────────────

interface SparklineProps {
  points: ProjectionPoint[];
  height?: number;
  accentColor?: string;
  predictedColor?: string;
}

function Sparkline({ points, height = 32, accentColor = '#3b82f6', predictedColor = '#93c5fd' }: SparklineProps) {
  if (points.length === 0) return null;

  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const barWidth = Math.max(4, Math.floor(120 / points.length));

  return (
    <div
      role="img"
      aria-label="Metric projection sparkline"
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: '1px',
        height: `${height}px`,
        padding: '2px 0',
      }}
    >
      {points.map((p, i) => {
        const normalised = (p.value - min) / range;
        const barH = Math.max(2, Math.round(normalised * (height - 4)));
        const color = p.isActual ? accentColor : predictedColor;
        return (
          <div
            key={i}
            title={`${p.isActual ? 'Actual' : 'Predicted'}: ${p.value}`}
            style={{
              width: `${barWidth}px`,
              height: `${barH}px`,
              backgroundColor: color,
              borderRadius: '1px',
              flexShrink: 0,
              opacity: p.isActual ? 1 : 0.7,
            }}
          />
        );
      })}
    </div>
  );
}

// ── Alternative timeline card ─────────────────────────────────────────────────

interface AlternativeCardProps {
  timeline: AlternativeTimeline;
  isRecommended: boolean;
}

function AlternativeCard({ timeline, isRecommended }: AlternativeCardProps) {
  const { theme } = useTheme();
  const riskColor = timeline.riskLevel ? RISK_COLOURS[timeline.riskLevel] : null;

  return (
    <div
      aria-label={`Alternative: ${timeline.label}`}
      style={{
        padding: '0.5rem 0.625rem',
        borderRadius: theme.radius.sm,
        border: `1.5px solid ${isRecommended ? theme.colors.accent : theme.colors.border}`,
        backgroundColor: isRecommended ? theme.colors.accentSubtle : theme.colors.surface,
        position: 'relative',
      }}
    >
      {isRecommended && (
        <span
          aria-label="Recommended timeline"
          style={{
            position: 'absolute',
            top: '-0.6rem',
            right: '0.5rem',
            fontSize: '0.55rem',
            fontWeight: 700,
            padding: '0.1rem 0.35rem',
            borderRadius: '3px',
            backgroundColor: theme.colors.accent,
            color: '#fff',
            textTransform: 'uppercase',
          }}
        >
          Recommended
        </span>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: theme.colors.text }}>
          {timeline.label}
        </span>
        <div style={{ display: 'flex', gap: '0.375rem', alignItems: 'center' }}>
          {riskColor && (
            <span
              aria-label={`Risk: ${timeline.riskLevel}`}
              style={{
                fontSize: '0.6rem',
                fontWeight: 700,
                padding: '0.1rem 0.3rem',
                borderRadius: '3px',
                backgroundColor: riskColor.bg,
                color: riskColor.color,
                textTransform: 'uppercase',
              }}
            >
              {timeline.riskLevel}
            </span>
          )}
          <span
            aria-label={`Probability: ${Math.round(timeline.probability * 100)}%`}
            style={{
              fontSize: '0.7rem',
              fontWeight: 700,
              color: isRecommended ? theme.colors.accent : theme.colors.textSecondary,
            }}
          >
            {Math.round(timeline.probability * 100)}%
          </span>
        </div>
      </div>

      <div style={{ fontSize: '0.7rem', color: theme.colors.textMuted, marginTop: '0.1rem' }}>
        {timeline.actionDescription}
      </div>

      <div style={{ fontSize: '0.75rem', color: theme.colors.textSecondary, marginTop: '0.25rem', fontStyle: 'italic' }}>
        {timeline.outcomeDescription}
      </div>

      {timeline.points.length > 0 && (
        <div style={{ marginTop: '0.375rem' }}>
          <Sparkline
            points={timeline.points}
            height={20}
            accentColor={isRecommended ? theme.colors.accent : theme.colors.textMuted}
            predictedColor={isRecommended ? '#93c5fd' : '#d1d5db'}
          />
        </div>
      )}
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface TemporalProjectionPanelProps {
  /** A single-metric projection (standalone mode) */
  projection?: TemporalProjection;

  /** A what-if scenario with multiple alternatives */
  scenario?: WhatIfScenario;

  /** Compact rendering mode */
  compact?: boolean;
}

// ── Main component ────────────────────────────────────────────────────────────

export function TemporalProjectionPanel({
  projection,
  scenario,
  compact = false,
}: TemporalProjectionPanelProps) {
  const { theme } = useTheme();

  const [showCaveats, setShowCaveats] = React.useState(false);

  // Derive display data
  const proj = projection ?? scenario?.baseline;
  const latestActual = proj ? getLatestActual(proj) : undefined;
  const latestPredicted = proj ? getLatestPrediction(proj) : undefined;
  const change = proj ? getProjectedChange(proj) : undefined;

  const recommended = scenario ? getRecommendedTimeline(scenario) : undefined;
  const sortedAlternatives = scenario
    ? sortAlternativesByProbability(scenario.alternatives)
    : [];

  const metric = projection?.metric ?? scenario?.metric ?? 'Metric';
  const unit = projection?.unit ?? scenario?.unit ?? '';
  const confidence = projection?.confidence ?? scenario?.analysisConfidence ?? 0;
  const caveats = scenario?.caveats ?? [];

  return (
    <div
      role="region"
      aria-label="Temporal projection"
      style={{
        border: `1px solid ${theme.colors.border}`,
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
        <div>
          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: theme.colors.text }}>
            {scenario ? scenario.question : metric}
          </span>
          {!compact && proj?.method && (
            <div style={{ fontSize: '0.65rem', color: theme.colors.textMuted, marginTop: '0.1rem' }}>
              Method: {proj.method.replace(/_/g, ' ')}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span
            aria-label={`Projection confidence: ${confidenceLabel(confidence)}`}
            style={{
              fontSize: '0.65rem',
              fontWeight: 700,
              padding: '0.1rem 0.35rem',
              borderRadius: '3px',
              backgroundColor: `${confidenceColor(confidence)}20`,
              color: confidenceColor(confidence),
            }}
          >
            {confidenceLabel(confidence)} confidence
          </span>
        </div>
      </div>

      {/* Baseline projection */}
      {proj && (
        <div style={{ padding: compact ? '0.375rem 0.75rem' : '0.5rem 0.875rem' }}>
          <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', marginBottom: '0.375rem' }}>
            {latestActual !== undefined && (
              <div>
                <div style={{ fontSize: '0.6rem', color: theme.colors.textMuted, textTransform: 'uppercase' }}>
                  Current
                </div>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: theme.colors.text }}>
                  {latestActual} <span style={{ fontSize: '0.65rem', fontWeight: 400 }}>{unit}</span>
                </div>
              </div>
            )}
            {latestPredicted !== undefined && (
              <div>
                <div style={{ fontSize: '0.6rem', color: theme.colors.textMuted, textTransform: 'uppercase' }}>
                  Predicted
                </div>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#3b82f6' }}>
                  {latestPredicted} <span style={{ fontSize: '0.65rem', fontWeight: 400 }}>{unit}</span>
                </div>
              </div>
            )}
            {change !== undefined && (
              <div>
                <div style={{ fontSize: '0.6rem', color: theme.colors.textMuted, textTransform: 'uppercase' }}>
                  Change
                </div>
                <div style={{
                  fontSize: '0.9rem',
                  fontWeight: 700,
                  color: change > 0 ? theme.colors.danger : '#166534',
                }}>
                  {change > 0 ? '+' : ''}{change} {unit}
                </div>
              </div>
            )}
          </div>

          <Sparkline points={proj.points} />

          {!compact && proj.summary && (
            <div style={{
              fontSize: '0.75rem',
              color: theme.colors.textSecondary,
              marginTop: '0.375rem',
              fontStyle: 'italic',
            }}>
              {proj.summary}
            </div>
          )}
        </div>
      )}

      {/* What-if alternatives */}
      {scenario && sortedAlternatives.length > 0 && (
        <div style={{
          padding: compact ? '0.375rem 0.625rem' : '0.5rem 0.875rem',
          borderTop: `1px solid ${theme.colors.border}`,
        }}>
          <div style={{
            fontSize: '0.65rem',
            fontWeight: 700,
            color: theme.colors.textSecondary,
            textTransform: 'uppercase',
            marginBottom: '0.375rem',
          }}>
            What-If Scenarios
          </div>
          <div
            role="list"
            aria-label="Alternative scenarios"
            style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}
          >
            {sortedAlternatives.map((alt) => (
              <div key={alt.timelineId} role="listitem">
                <AlternativeCard
                  timeline={alt}
                  isRecommended={alt.timelineId === recommended?.timelineId}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Caveats */}
      {!compact && caveats.length > 0 && (
        <div style={{
          borderTop: `1px solid ${theme.colors.border}`,
          padding: '0.375rem 0.875rem',
        }}>
          <button
            onClick={() => setShowCaveats(!showCaveats)}
            aria-expanded={showCaveats}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.65rem',
              fontWeight: 700,
              color: theme.colors.textMuted,
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
            }}
          >
            <span style={{ transform: showCaveats ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', display: 'inline-block' }}>▼</span>
            {caveats.length} caveat{caveats.length > 1 ? 's' : ''}
          </button>
          {showCaveats && (
            <ul
              role="list"
              aria-label="Analysis caveats"
              style={{ margin: '0.25rem 0 0', padding: '0 0 0 1rem', listStyle: 'disc' }}
            >
              {caveats.map((c, i) => (
                <li key={i} role="listitem" style={{ fontSize: '0.7rem', color: theme.colors.textMuted, padding: '0.1rem 0' }}>
                  {c}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
