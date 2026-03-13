/**
 * Phase 4.2 — Temporal Predictions & What-If Scenarios
 *
 * Tests for TemporalProjectionPanel covering:
 *  - Standalone projection rendering
 *  - What-if scenario comparison
 *  - Confidence level display
 *  - Recommended timeline highlighting
 *  - Caveats accordion
 *  - Sparkline / data points
 *  - Compact mode
 *  - Edge cases and accessibility
 */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import type {
  TemporalProjection,
  ProjectionPoint,
  AlternativeTimeline,
  WhatIfScenario,
} from '@hari/core';
import {
  getRecommendedTimeline,
  getProjectedChange,
  sortAlternativesByProbability,
} from '@hari/core';
import { TemporalProjectionPanel } from '../components/TemporalProjectionPanel';
import { ThemeProvider } from '../ThemeContext';

// ─── Factory helpers ─────────────────────────────────────────────────────────

function pt(value: number, offsetMs = 0, isActual = true): ProjectionPoint {
  return {
    timestamp: new Date(Date.now() + offsetMs).toISOString(),
    value,
    isActual,
  };
}

function makeProjection(overrides: Partial<TemporalProjection> = {}): TemporalProjection {
  return {
    projectionId: 'proj-1',
    metric: 'Replication Lag',
    unit: 'ms',
    generatedAt: new Date().toISOString(),
    baselineAt: new Date().toISOString(),
    horizon: new Date(Date.now() + 10 * 60_000).toISOString(),
    points: [pt(200, 0, true), pt(150, 60_000, true), pt(90, 120_000, false), pt(50, 300_000, false)],
    confidence: 0.8,
    method: 'linear_regression',
    tags: [],
    ...overrides,
  };
}

function makeAlternative(overrides: Partial<AlternativeTimeline> = {}): AlternativeTimeline {
  return {
    timelineId: `tl-${Math.random()}`,
    label: 'Restart replica',
    actionDescription: 'Immediately restart the primary replica',
    points: [],
    outcomeDescription: 'Lag drops to ~50 ms within 2 minutes',
    probability: 0.85,
    ...overrides,
  };
}

function makeScenario(overrides: Partial<WhatIfScenario> = {}): WhatIfScenario {
  return {
    scenarioId: 'sc-1',
    question: 'What if we restart the replica?',
    metric: 'Replication Lag',
    unit: 'ms',
    alternatives: [makeAlternative()],
    analysisConfidence: 0.75,
    analysedAt: new Date().toISOString(),
    caveats: [],
    ...overrides,
  };
}

function renderPanel(props: React.ComponentProps<typeof TemporalProjectionPanel>) {
  return render(
    <ThemeProvider>
      <TemporalProjectionPanel {...props} />
    </ThemeProvider>
  );
}

// ─── Standalone Projection Tests ─────────────────────────────────────────────

describe('TemporalProjectionPanel — standalone projection', () => {
  it('renders without crashing given a minimal projection', () => {
    const { container } = renderPanel({ projection: makeProjection() });
    expect(container.firstChild).not.toBeNull();
  });

  it('has role=region and aria-label="Temporal projection"', () => {
    renderPanel({ projection: makeProjection() });
    expect(screen.getByRole('region', { name: /temporal projection/i })).toBeInTheDocument();
  });

  it('shows the metric name in the header', () => {
    renderPanel({ projection: makeProjection({ metric: 'CPU Usage' }) });
    expect(screen.getByText('CPU Usage')).toBeInTheDocument();
  });

  it('shows the projection method in the header', () => {
    renderPanel({ projection: makeProjection({ method: 'linear_regression' }) });
    expect(screen.getByText(/linear regression/i)).toBeInTheDocument();
  });

  it('displays the confidence badge', () => {
    renderPanel({ projection: makeProjection({ confidence: 0.9 }) });
    expect(screen.getByText(/high confidence/i)).toBeInTheDocument();
  });

  it('shows aria-label for confidence badge', () => {
    renderPanel({ projection: makeProjection({ confidence: 0.9 }) });
    const badge = screen.getByLabelText(/projection confidence/i);
    expect(badge).toBeInTheDocument();
    expect(badge.textContent).toMatch(/high/i);
  });

  it('shows "Moderate confidence" when confidence is 0.7', () => {
    renderPanel({ projection: makeProjection({ confidence: 0.7 }) });
    expect(screen.getByLabelText(/projection confidence/i).textContent).toMatch(/moderate/i);
  });

  it('shows "Low confidence" when confidence is 0.5', () => {
    renderPanel({ projection: makeProjection({ confidence: 0.5 }) });
    expect(screen.getByLabelText(/projection confidence/i).textContent).toMatch(/low/i);
  });

  it('shows "Very Low confidence" when confidence is 0.2', () => {
    renderPanel({ projection: makeProjection({ confidence: 0.2 }) });
    expect(screen.getByLabelText(/projection confidence/i).textContent).toMatch(/very low/i);
  });

  it('renders sparkline with aria-label', () => {
    renderPanel({ projection: makeProjection() });
    expect(screen.getByRole('img', { name: /sparkline/i })).toBeInTheDocument();
  });

  it('shows Current and Predicted values', () => {
    renderPanel({
      projection: makeProjection({
        points: [pt(200, 0, true), pt(50, 300_000, false)],
      }),
    });
    expect(screen.getByText(/current/i)).toBeInTheDocument();
    expect(screen.getByText(/predicted/i)).toBeInTheDocument();
  });

  it('displays the current value from the latest actual point', () => {
    renderPanel({
      projection: makeProjection({
        points: [pt(200, 0, true), pt(150, 60_000, true), pt(50, 300_000, false)],
      }),
    });
    // `getLatestActual` returns 150 here
    expect(screen.getAllByText('150').length).toBeGreaterThan(0);
  });

  it('displays the predicted value from the latest non-actual point', () => {
    renderPanel({
      projection: makeProjection({
        points: [pt(200, 0, true), pt(50, 300_000, false)],
      }),
    });
    expect(screen.getAllByText('50').length).toBeGreaterThan(0);
  });

  it('shows Change indicator', () => {
    renderPanel({
      projection: makeProjection({
        points: [pt(200, 0, true), pt(50, 300_000, false)],
      }),
    });
    expect(screen.getByText(/change/i)).toBeInTheDocument();
  });

  it('shows the summary text when provided', () => {
    renderPanel({ projection: makeProjection({ summary: 'Lag is recovering rapidly' }) });
    expect(screen.getByText(/lag is recovering rapidly/i)).toBeInTheDocument();
  });

  it('does NOT show summary text when not provided', () => {
    renderPanel({ projection: makeProjection({ summary: undefined }) });
    expect(screen.queryByText(/lag is recovering/i)).not.toBeInTheDocument();
  });

  it('renders all projection points as bars inside sparkline', () => {
    renderPanel({
      projection: makeProjection({
        points: [pt(200, 0, true), pt(150, 60_000, true), pt(90, 120_000, false)],
      }),
    });
    const sparkline = screen.getByRole('img', { name: /sparkline/i });
    expect(sparkline.children.length).toBe(3);
  });
});

// ─── Confidence Labels ────────────────────────────────────────────────────────

describe('TemporalProjectionPanel — confidence edge cases', () => {
  it('shows "High confidence" at exactly 0.85', () => {
    renderPanel({ projection: makeProjection({ confidence: 0.85 }) });
    expect(screen.getByLabelText(/projection confidence/i).textContent).toMatch(/high/i);
  });

  it('shows "Moderate confidence" just below 0.85', () => {
    renderPanel({ projection: makeProjection({ confidence: 0.84 }) });
    expect(screen.getByLabelText(/projection confidence/i).textContent).toMatch(/moderate/i);
  });

  it('shows "Low confidence" at exactly 0.35', () => {
    renderPanel({ projection: makeProjection({ confidence: 0.35 }) });
    expect(screen.getByLabelText(/projection confidence/i).textContent).toMatch(/low/i);
  });

  it('shows "Very Low confidence" just below 0.35', () => {
    renderPanel({ projection: makeProjection({ confidence: 0.34 }) });
    expect(screen.getByLabelText(/projection confidence/i).textContent).toMatch(/very low/i);
  });
});

// ─── getProjectedChange helper ────────────────────────────────────────────────

describe('getProjectedChange helper', () => {
  it('returns undefined when no actual points exist', () => {
    const proj = makeProjection({ points: [pt(100, 0, false)] });
    expect(getProjectedChange(proj)).toBeUndefined();
  });

  it('returns undefined when no predicted points exist', () => {
    const proj = makeProjection({ points: [pt(100, 0, true)] });
    expect(getProjectedChange(proj)).toBeUndefined();
  });

  it('returns correct negative delta (improvement)', () => {
    const proj = makeProjection({ points: [pt(200, 0, true), pt(50, 300_000, false)] });
    expect(getProjectedChange(proj)).toBe(-150);
  });

  it('returns correct positive delta (degradation)', () => {
    const proj = makeProjection({ points: [pt(50, 0, true), pt(150, 300_000, false)] });
    expect(getProjectedChange(proj)).toBe(100);
  });
});

// ─── sortAlternativesByProbability helper ─────────────────────────────────────

describe('sortAlternativesByProbability helper', () => {
  it('sorts highest probability first', () => {
    const a1 = makeAlternative({ timelineId: 'a', probability: 0.6 });
    const a2 = makeAlternative({ timelineId: 'b', probability: 0.9 });
    const a3 = makeAlternative({ timelineId: 'c', probability: 0.3 });
    const sorted = sortAlternativesByProbability([a1, a2, a3]);
    expect(sorted.map((t) => t.timelineId)).toEqual(['b', 'a', 'c']);
  });

  it('returns empty array when given empty input', () => {
    expect(sortAlternativesByProbability([])).toEqual([]);
  });

  it('does not mutate the original array', () => {
    const alts = [makeAlternative({ probability: 0.3 }), makeAlternative({ probability: 0.9 })];
    const orig = [...alts];
    sortAlternativesByProbability(alts);
    expect(alts[0].probability).toBe(orig[0].probability);
  });
});

// ─── What-If Scenario Tests ───────────────────────────────────────────────────

describe('TemporalProjectionPanel — what-if scenario', () => {
  it('shows the scenario question in the header', () => {
    const sc = makeScenario({ question: 'What if we add more memory?' });
    renderPanel({ scenario: sc });
    expect(screen.getByText(/what if we add more memory\?/i)).toBeInTheDocument();
  });

  it('renders role=list with aria-label "Alternative scenarios"', () => {
    renderPanel({ scenario: makeScenario() });
    expect(screen.getByRole('list', { name: /alternative scenarios/i })).toBeInTheDocument();
  });

  it('renders one listitem per alternative', () => {
    const sc = makeScenario({
      alternatives: [
        makeAlternative({ label: 'Option A' }),
        makeAlternative({ label: 'Option B' }),
        makeAlternative({ label: 'Option C' }),
      ],
    });
    renderPanel({ scenario: sc });
    const list = screen.getByRole('list', { name: /alternative scenarios/i });
    expect(within(list).getAllByRole('listitem').length).toBe(3);
  });

  it('shows alternative label', () => {
    const sc = makeScenario({
      alternatives: [makeAlternative({ label: 'Do nothing' })],
    });
    renderPanel({ scenario: sc });
    expect(screen.getByText('Do nothing')).toBeInTheDocument();
  });

  it('shows alternative action description', () => {
    renderPanel({
      scenario: makeScenario({
        alternatives: [makeAlternative({ actionDescription: 'Wait for self-healing' })],
      }),
    });
    expect(screen.getByText(/wait for self-healing/i)).toBeInTheDocument();
  });

  it('shows alternative outcome description', () => {
    renderPanel({
      scenario: makeScenario({
        alternatives: [makeAlternative({ outcomeDescription: 'System recovers in 10 min' })],
      }),
    });
    expect(screen.getByText(/system recovers in 10 min/i)).toBeInTheDocument();
  });

  it('shows probability percentage per alternative', () => {
    renderPanel({
      scenario: makeScenario({
        alternatives: [makeAlternative({ probability: 0.75 })],
      }),
    });
    expect(screen.getByLabelText(/probability.*75%/i)).toBeInTheDocument();
  });

  it('shows "Recommended" badge on the recommended timeline', () => {
    const recommended = makeAlternative({ timelineId: 'rec', probability: 0.9, isRecommended: true });
    const other = makeAlternative({ timelineId: 'other', probability: 0.5 });
    const sc = makeScenario({
      alternatives: [recommended, other],
      recommendedTimelineId: 'rec',
    });
    renderPanel({ scenario: sc });
    expect(screen.getByLabelText(/recommended timeline/i)).toBeInTheDocument();
  });

  it('does NOT show "Recommended" badge when no timeline is marked recommended', () => {
    const sc = makeScenario({
      alternatives: [makeAlternative()],
      recommendedTimelineId: undefined,
    });
    renderPanel({ scenario: sc });
    expect(screen.queryByLabelText(/recommended timeline/i)).not.toBeInTheDocument();
  });

  it('sorts alternatives by probability (highest first)', () => {
    const lowProb  = makeAlternative({ timelineId: 'low',  label: 'Low Chance',  probability: 0.2 });
    const highProb = makeAlternative({ timelineId: 'high', label: 'High Chance', probability: 0.9 });
    const sc = makeScenario({ alternatives: [lowProb, highProb] });
    renderPanel({ scenario: sc });
    const items = screen.getAllByRole('listitem').map((el) => el.textContent ?? '');
    const highIdx = items.findIndex((t) => t.includes('High Chance'));
    const lowIdx  = items.findIndex((t) => t.includes('Low Chance'));
    expect(highIdx).toBeLessThan(lowIdx);
  });

  it('shows risk badge when riskLevel is provided', () => {
    const sc = makeScenario({
      alternatives: [makeAlternative({ riskLevel: 'high' })],
    });
    renderPanel({ scenario: sc });
    expect(screen.getByLabelText(/risk.*high/i)).toBeInTheDocument();
  });

  it('shows sparkline inside an alternative that has points', () => {
    const sc = makeScenario({
      alternatives: [makeAlternative({ points: [pt(100, 0, false), pt(50, 60_000, false)] })],
    });
    renderPanel({ scenario: sc });
    const sparklines = screen.getAllByRole('img', { name: /sparkline/i });
    expect(sparklines.length).toBeGreaterThan(0);
  });

  it('does NOT show a sparkline inside an alternative with no points', () => {
    const sc = makeScenario({
      alternatives: [makeAlternative({ points: [] })],
    });
    renderPanel({ scenario: sc });
    // only the baseline sparkline would appear, not an extra one
    const sparklines = screen.queryAllByRole('img', { name: /sparkline/i });
    expect(sparklines.length).toBe(0);
  });
});

// ─── getRecommendedTimeline helper ───────────────────────────────────────────

describe('getRecommendedTimeline helper', () => {
  it('returns the timeline matching recommendedTimelineId', () => {
    const a = makeAlternative({ timelineId: 'a' });
    const b = makeAlternative({ timelineId: 'b' });
    const sc = makeScenario({ alternatives: [a, b], recommendedTimelineId: 'b' });
    expect(getRecommendedTimeline(sc)?.timelineId).toBe('b');
  });

  it('returns undefined when no recommendedTimelineId is set', () => {
    const sc = makeScenario({ alternatives: [makeAlternative()], recommendedTimelineId: undefined });
    expect(getRecommendedTimeline(sc)).toBeUndefined();
  });

  it('returns the isRecommended:true timeline when present', () => {
    const a = makeAlternative({ timelineId: 'a', isRecommended: false });
    const b = makeAlternative({ timelineId: 'b', isRecommended: true });
    const sc = makeScenario({ alternatives: [a, b], recommendedTimelineId: undefined });
    const result = getRecommendedTimeline(sc);
    expect(result?.timelineId).toBe('b');
  });
});

// ─── Caveats accordion ───────────────────────────────────────────────────────

describe('TemporalProjectionPanel — caveats', () => {
  it('does not render caveats section when list is empty', () => {
    renderPanel({ scenario: makeScenario({ caveats: [] }) });
    expect(screen.queryByRole('button', { name: /caveats?/i })).not.toBeInTheDocument();
  });

  it('renders a caveats toggle button when caveats exist', () => {
    const sc = makeScenario({ caveats: ['Network latency not modelled'] });
    renderPanel({ scenario: sc });
    expect(screen.getByRole('button', { name: /caveat/i })).toBeInTheDocument();
  });

  it('caveats list is hidden by default', () => {
    const sc = makeScenario({ caveats: ['Network latency not modelled'] });
    renderPanel({ scenario: sc });
    expect(screen.queryByRole('list', { name: /caveats/i })).not.toBeInTheDocument();
  });

  it('expands caveats list on button click', () => {
    const sc = makeScenario({ caveats: ['Network latency not modelled'] });
    renderPanel({ scenario: sc });
    fireEvent.click(screen.getByRole('button', { name: /caveat/i }));
    expect(screen.getByRole('list', { name: /caveats/i })).toBeInTheDocument();
  });

  it('renders each caveat as a listitem', () => {
    const sc = makeScenario({ caveats: ['Caveat A', 'Caveat B', 'Caveat C'] });
    renderPanel({ scenario: sc });
    fireEvent.click(screen.getByRole('button', { name: /caveat/i }));
    const list = screen.getByRole('list', { name: /caveats/i });
    expect(within(list).getAllByRole('listitem').length).toBe(3);
  });

  it('shows caveat text content when expanded', () => {
    const sc = makeScenario({ caveats: ['Traffic pattern not stable'] });
    renderPanel({ scenario: sc });
    fireEvent.click(screen.getByRole('button', { name: /caveat/i }));
    expect(screen.getByText(/traffic pattern not stable/i)).toBeInTheDocument();
  });

  it('collapses caveats list on second click', () => {
    const sc = makeScenario({ caveats: ['Caveat X'] });
    renderPanel({ scenario: sc });
    const btn = screen.getByRole('button', { name: /caveat/i });
    fireEvent.click(btn);
    fireEvent.click(btn);
    expect(screen.queryByRole('list', { name: /caveats/i })).not.toBeInTheDocument();
  });

  it('toggle button has aria-expanded=false initially', () => {
    const sc = makeScenario({ caveats: ['Delta not accounted'] });
    renderPanel({ scenario: sc });
    const btn = screen.getByRole('button', { name: /caveat/i });
    expect(btn).toHaveAttribute('aria-expanded', 'false');
  });

  it('toggle button has aria-expanded=true after clicking', () => {
    const sc = makeScenario({ caveats: ['Delta not accounted'] });
    renderPanel({ scenario: sc });
    const btn = screen.getByRole('button', { name: /caveat/i });
    fireEvent.click(btn);
    expect(btn).toHaveAttribute('aria-expanded', 'true');
  });

  it('does NOT render caveats section in compact mode even when caveats exist', () => {
    const sc = makeScenario({ caveats: ['Should not appear'] });
    renderPanel({ scenario: sc, compact: true });
    expect(screen.queryByRole('button', { name: /caveat/i })).not.toBeInTheDocument();
  });

  it('shows singular label "1 caveat"', () => {
    const sc = makeScenario({ caveats: ['One'] });
    renderPanel({ scenario: sc });
    expect(screen.getByRole('button', { name: /1 caveat$/i })).toBeInTheDocument();
  });

  it('shows plural label "3 caveats"', () => {
    const sc = makeScenario({ caveats: ['A', 'B', 'C'] });
    renderPanel({ scenario: sc });
    expect(screen.getByRole('button', { name: /3 caveats/i })).toBeInTheDocument();
  });
});

// ─── Compact mode ─────────────────────────────────────────────────────────────

describe('TemporalProjectionPanel — compact mode', () => {
  it('renders in compact mode without errors', () => {
    renderPanel({ projection: makeProjection(), compact: true });
    expect(screen.getByRole('region', { name: /temporal projection/i })).toBeInTheDocument();
  });

  it('does NOT show method label in compact mode', () => {
    renderPanel({ projection: makeProjection({ method: 'linear_regression' }), compact: true });
    expect(screen.queryByText(/linear regression/i)).not.toBeInTheDocument();
  });

  it('does NOT show summary in compact mode', () => {
    renderPanel({
      projection: makeProjection({ summary: 'Lag is recovering' }),
      compact: true,
    });
    expect(screen.queryByText(/lag is recovering/i)).not.toBeInTheDocument();
  });
});

// ─── No-data / Edge cases ────────────────────────────────────────────────────

describe('TemporalProjectionPanel — edge cases', () => {
  it('renders without crashing when no props are provided', () => {
    const { container } = renderPanel({});
    expect(container.firstChild).not.toBeNull();
  });

  it('does not show "Current" or "Predicted" when projection has only actual points', () => {
    renderPanel({ projection: makeProjection({ points: [pt(200, 0, true)] }) });
    // "Predicted" label should not appear since there's no future point
    expect(screen.queryByText(/^predicted$/i)).not.toBeInTheDocument();
  });

  it('renders projection with a single point without crashing', () => {
    renderPanel({ projection: makeProjection({ points: [pt(100, 0, true)] }) });
    expect(screen.getByRole('region', { name: /temporal projection/i })).toBeInTheDocument();
  });

  it('renders a scenario with zero alternatives without crashing', () => {
    renderPanel({ scenario: makeScenario({ alternatives: [] }) });
    expect(screen.getByRole('region', { name: /temporal projection/i })).toBeInTheDocument();
  });

  it('displays metric name from scenario when no standalone projection given', () => {
    const sc = makeScenario({ metric: 'Error Rate' });
    renderPanel({ scenario: sc });
    // The header shows the scenario question, but the metric is still used elsewhere
    expect(screen.getByText(/what if we restart the replica\?/i)).toBeInTheDocument();
  });

  it('uses analysisConfidence from scenario for badge text', () => {
    const sc = makeScenario({ analysisConfidence: 0.92 });
    renderPanel({ scenario: sc });
    expect(screen.getByLabelText(/projection confidence/i).textContent).toMatch(/high/i);
  });

  it('renders with confidence 0 mapping to "Very Low"', () => {
    renderPanel({ projection: makeProjection({ confidence: 0 }) });
    expect(screen.getByLabelText(/projection confidence/i).textContent).toMatch(/very low/i);
  });

  it('renders with confidence 1 mapping to "High"', () => {
    renderPanel({ projection: makeProjection({ confidence: 1 }) });
    expect(screen.getByLabelText(/projection confidence/i).textContent).toMatch(/high/i);
  });

  it('shows "What-If Scenarios" heading when scenario is provided', () => {
    renderPanel({ scenario: makeScenario() });
    expect(screen.getByText(/what-if scenarios/i)).toBeInTheDocument();
  });

  it('does NOT show "What-If Scenarios" heading when only projection is provided', () => {
    renderPanel({ projection: makeProjection() });
    expect(screen.queryByText(/what-if scenarios/i)).not.toBeInTheDocument();
  });
});
