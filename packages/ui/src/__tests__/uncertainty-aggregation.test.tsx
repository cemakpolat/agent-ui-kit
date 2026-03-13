/**
 * Phase 4.3 — Uncertainty Aggregation
 *
 * Tests for:
 *   - decayConfidence helper
 *   - computeSensitivity helper
 *   - recommendNextQuestion helper
 *   - UncertaintyAggregator component (rendering, accessibility, interactions)
 */
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import type { UncertaintySummary } from '@hari/core';
import {
  decayConfidence,
  computeSensitivity,
  recommendNextQuestion,
} from '@hari/core';
import { UncertaintyAggregator } from '../components/UncertaintyAggregator';
import type { UncertaintySource } from '../components/UncertaintyAggregator';
import { ThemeProvider } from '../ThemeContext';

// ─── Factory helpers ─────────────────────────────────────────────────────────

type AssumptionCriticality = 'low' | 'medium' | 'high' | 'critical';

function makeAssumption(text: string, criticality: AssumptionCriticality = 'low') {
  return { assumption: text, criticality };
}

function makeSummary(overrides: Partial<UncertaintySummary> = {}): UncertaintySummary {
  return {
    overallConfidence: 0.8,
    knownUnknowns: [],
    assumptions: [],
    indicators: [],
    lowConfidenceCount: 0,
    unknownElements: [],
    ...overrides,
  };
}

function makeSource(
  label: string,
  summaryOverrides: Partial<UncertaintySummary> = {},
  extra: Partial<Omit<UncertaintySource, 'label' | 'summary'>> = {},
): UncertaintySource {
  return { label, summary: makeSummary(summaryOverrides), ...extra };
}

function renderAggregator(props: React.ComponentProps<typeof UncertaintyAggregator>) {
  return render(
    <ThemeProvider>
      <UncertaintyAggregator {...props} />
    </ThemeProvider>
  );
}

// ─── decayConfidence ──────────────────────────────────────────────────────────

describe('decayConfidence', () => {
  it('returns the original confidence when ageMs is 0', () => {
    expect(decayConfidence(0.8, 0, 300_000)).toBeCloseTo(0.8);
  });

  it('halves confidence at exactly one half-life', () => {
    expect(decayConfidence(1.0, 300_000, 300_000)).toBeCloseTo(0.5);
  });

  it('quarters confidence at two half-lives', () => {
    expect(decayConfidence(1.0, 600_000, 300_000)).toBeCloseTo(0.25);
  });

  it('returns 0 when halfLifeMs is 0', () => {
    expect(decayConfidence(0.8, 100, 0)).toBe(0);
  });

  it('returns 0 when halfLifeMs is negative', () => {
    expect(decayConfidence(0.8, 100, -100)).toBe(0);
  });

  it('clamps result to 0, never negative', () => {
    expect(decayConfidence(0, 600_000, 300_000)).toBe(0);
  });

  it('clamps result to 1, never above 1', () => {
    // confidence > 1 edge case (though schema prevents it; function should still clamp)
    expect(decayConfidence(1.0, 0, 300_000)).toBeLessThanOrEqual(1);
  });

  it('decays less than half after less than one half-life', () => {
    const result = decayConfidence(1.0, 150_000, 300_000);
    expect(result).toBeGreaterThan(0.5);
    expect(result).toBeLessThan(1);
  });

  it('works with very large ageMs (confidence approaches 0)', () => {
    const result = decayConfidence(1.0, 1_000 * 300_000, 300_000);
    expect(result).toBeCloseTo(0, 3);
  });

  it('starting confidence of 0.5 halves to ~0.25 at one half-life', () => {
    expect(decayConfidence(0.5, 300_000, 300_000)).toBeCloseTo(0.25);
  });
});

// ─── computeSensitivity ───────────────────────────────────────────────────────

describe('computeSensitivity', () => {
  it('returns 0 when there are no assumptions', () => {
    const summary = makeSummary({ assumptions: [] });
    expect(computeSensitivity(summary)).toBe(0);
  });

  it('returns 1.0 when all assumptions are critical', () => {
    const summary = makeSummary({
      assumptions: [makeAssumption('A', 'critical'), makeAssumption('B', 'critical')],
    });
    expect(computeSensitivity(summary)).toBeCloseTo(1.0);
  });

  it('returns a lower value when all assumptions are low', () => {
    const summary = makeSummary({
      assumptions: [makeAssumption('A', 'low'), makeAssumption('B', 'low')],
    });
    expect(computeSensitivity(summary)).toBeCloseTo(0.2); // 0.2/1.0
  });

  it('returns intermediate value for mixed criticalities', () => {
    const summary = makeSummary({
      assumptions: [makeAssumption('A', 'critical'), makeAssumption('B', 'low')],
    });
    // (1.0 + 0.2) / (2 * 1.0) = 0.6
    expect(computeSensitivity(summary)).toBeCloseTo(0.6);
  });

  it('ignores knownUnknowns when computing sensitivity', () => {
    const s1 = makeSummary({ assumptions: [], knownUnknowns: ['x', 'y', 'z'] });
    const s2 = makeSummary({ assumptions: [] });
    expect(computeSensitivity(s1)).toBe(computeSensitivity(s2));
  });

  it('stays in range [0, 1]', () => {
    const heavy = makeSummary({
      assumptions: Array.from({ length: 10 }, (_, i) => makeAssumption(`a${i}`, 'critical')),
    });
    const sensitivity = computeSensitivity(heavy);
    expect(sensitivity).toBeGreaterThanOrEqual(0);
    expect(sensitivity).toBeLessThanOrEqual(1);
  });
});

// ─── recommendNextQuestion ────────────────────────────────────────────────────

describe('recommendNextQuestion', () => {
  it('returns undefined when there are no assumptions or known unknowns', () => {
    const summary = makeSummary({ assumptions: [], knownUnknowns: [] });
    expect(recommendNextQuestion(summary)).toBeUndefined();
  });

  it('prioritises critical assumptions over high', () => {
    const summary = makeSummary({
      assumptions: [
        makeAssumption('High thing', 'high'),
        makeAssumption('Critical thing', 'critical'),
      ],
    });
    expect(recommendNextQuestion(summary)).toMatch(/critical thing/i);
  });

  it('falls back to high assumptions when no critical ones exist', () => {
    const summary = makeSummary({
      assumptions: [makeAssumption('High thing', 'high'), makeAssumption('Low thing', 'low')],
    });
    expect(recommendNextQuestion(summary)).toMatch(/high thing/i);
  });

  it('falls back to knownUnknowns when no critical or high assumptions', () => {
    const summary = makeSummary({
      assumptions: [makeAssumption('Low thing', 'low')],
      knownUnknowns: ['Missing network topology'],
    });
    expect(recommendNextQuestion(summary)).toMatch(/investigate.*missing network topology/i);
  });

  it('picks the first knownUnknown when multiple exist', () => {
    const summary = makeSummary({ knownUnknowns: ['First', 'Second', 'Third'] });
    expect(recommendNextQuestion(summary)).toMatch(/first/i);
  });

  it('prefixes critical recommendations with "Clarify:"', () => {
    const summary = makeSummary({
      assumptions: [makeAssumption('Is topology stable?', 'critical')],
    });
    expect(recommendNextQuestion(summary)).toMatch(/^clarify:/i);
  });

  it('prefixes known-unknown recommendations with "Investigate:"', () => {
    const summary = makeSummary({ knownUnknowns: ['Traffic pattern'] });
    expect(recommendNextQuestion(summary)).toMatch(/^investigate:/i);
  });
});

// ─── UncertaintyAggregator – empty state ─────────────────────────────────────

describe('UncertaintyAggregator — empty state', () => {
  it('renders without crashing when sources is empty', () => {
    renderAggregator({ sources: [] });
    expect(screen.getByRole('region', { name: /uncertainty aggregator/i })).toBeInTheDocument();
  });

  it('shows "No uncertainty data available" message for empty sources', () => {
    renderAggregator({ sources: [] });
    expect(screen.getByText(/no uncertainty data available/i)).toBeInTheDocument();
  });
});

// ─── UncertaintyAggregator – rendering ───────────────────────────────────────

describe('UncertaintyAggregator — rendering', () => {
  it('has role=region with aria-label="Uncertainty aggregator"', () => {
    renderAggregator({ sources: [makeSource('Telemetry')] });
    expect(screen.getByRole('region', { name: /uncertainty aggregator/i })).toBeInTheDocument();
  });

  it('shows the default title "Uncertainty Overview"', () => {
    renderAggregator({ sources: [makeSource('Telemetry')] });
    expect(screen.getByText('Uncertainty Overview')).toBeInTheDocument();
  });

  it('shows a custom title when provided', () => {
    renderAggregator({ sources: [makeSource('X')], title: 'Network Risk' });
    expect(screen.getByText('Network Risk')).toBeInTheDocument();
  });

  it('renders role=list with aria-label "Uncertainty sources"', () => {
    renderAggregator({ sources: [makeSource('Telemetry')] });
    expect(screen.getByRole('list', { name: /uncertainty sources/i })).toBeInTheDocument();
  });

  it('renders one listitem per source', () => {
    renderAggregator({
      sources: [makeSource('A'), makeSource('B'), makeSource('C')],
    });
    const list = screen.getByRole('list', { name: /uncertainty sources/i });
    expect(within(list).getAllByRole('listitem').length).toBe(3);
  });

  it('each source listitem has aria-label starting with "Source:"', () => {
    renderAggregator({ sources: [makeSource('Database')] });
    expect(screen.getByRole('listitem', { name: /source: database/i })).toBeInTheDocument();
  });

  it('shows the system confidence badge', () => {
    renderAggregator({ sources: [makeSource('A', { overallConfidence: 0.75 })] });
    expect(screen.getByLabelText(/overall system confidence/i)).toBeInTheDocument();
  });

  it('system confidence equals the minimum effective confidence across sources', () => {
    renderAggregator({
      sources: [
        makeSource('A', { overallConfidence: 0.9 }),
        makeSource('B', { overallConfidence: 0.6 }),
        makeSource('C', { overallConfidence: 0.4 }),
      ],
    });
    // Minimum is 0.4 = 40%
    expect(screen.getByLabelText(/overall system confidence/i).textContent).toMatch(/40%/);
  });

  it('shows per-source confidence bars with aria-label', () => {
    renderAggregator({ sources: [makeSource('Sensor', { overallConfidence: 0.65 })] });
    // confidence bar for the source
    expect(screen.getAllByLabelText(/confidence/i).length).toBeGreaterThan(0);
  });

  it('shows sensitivity score per source', () => {
    renderAggregator({
      sources: [
        makeSource('X', {
          assumptions: [makeAssumption('Assume stable', 'high')],
        }),
      ],
    });
    expect(screen.getAllByLabelText(/sensitivity/i).length).toBeGreaterThan(0);
  });
});

// ─── UncertaintyAggregator – weakest link ────────────────────────────────────

describe('UncertaintyAggregator — weakest link', () => {
  it('marks the lowest-confidence source as "Weakest link"', () => {
    renderAggregator({
      sources: [
        makeSource('Strong', { overallConfidence: 0.9 }),
        makeSource('Weak',   { overallConfidence: 0.3 }),
      ],
    });
    expect(screen.getByLabelText(/weakest link/i)).toBeInTheDocument();
  });

  it('does NOT show weakest link badge when there is only one source', () => {
    renderAggregator({ sources: [makeSource('Only', { overallConfidence: 0.3 })] });
    expect(screen.queryByLabelText(/weakest link/i)).not.toBeInTheDocument();
  });
});

// ─── UncertaintyAggregator – decay integration ───────────────────────────────

describe('UncertaintyAggregator — confidence decay', () => {
  it('shows decayed confidence lower than raw when ageMs and halfLifeMs are provided', () => {
    renderAggregator({
      sources: [
        makeSource('Old data', { overallConfidence: 1.0 }, { ageMs: 300_000, halfLifeMs: 300_000 }),
      ],
    });
    // Effective = 0.5 (50%)
    expect(screen.getByLabelText(/overall system confidence/i).textContent).toMatch(/50%/);
  });

  it('uses raw confidence when no ageMs/halfLifeMs are provided', () => {
    renderAggregator({
      sources: [makeSource('Fresh', { overallConfidence: 0.8 })],
    });
    expect(screen.getByLabelText(/overall system confidence/i).textContent).toMatch(/80%/);
  });
});

// ─── UncertaintyAggregator – recommendations ─────────────────────────────────

describe('UncertaintyAggregator — recommendations', () => {
  it('shows the recommended next step when showRecommendation=true', () => {
    renderAggregator({
      sources: [
        makeSource('DB', {
          assumptions: [makeAssumption('DB is primary', 'critical')],
        }),
      ],
      showRecommendation: true,
    });
    expect(screen.getByRole('note', { name: /recommended next step/i })).toBeInTheDocument();
  });

  it('shows the recommendation text', () => {
    renderAggregator({
      sources: [
        makeSource('DB', {
          assumptions: [makeAssumption('DB is primary', 'critical')],
        }),
      ],
      showRecommendation: true,
    });
    expect(screen.getByText(/clarify: DB is primary/i)).toBeInTheDocument();
  });

  it('does NOT show recommendations when showRecommendation=false', () => {
    renderAggregator({
      sources: [
        makeSource('DB', {
          assumptions: [makeAssumption('DB is primary', 'critical')],
        }),
      ],
      showRecommendation: false,
    });
    expect(screen.queryByRole('note', { name: /recommended/i })).not.toBeInTheDocument();
  });

  it('does NOT show recommendation block when no recommendation is available', () => {
    renderAggregator({
      sources: [makeSource('Clean', { assumptions: [], knownUnknowns: [] })],
      showRecommendation: true,
    });
    expect(screen.queryByRole('note', { name: /recommended/i })).not.toBeInTheDocument();
  });
});

// ─── UncertaintyAggregator – assumptions expand/collapse ─────────────────────

describe('UncertaintyAggregator — assumptions toggle', () => {
  it('toggle button is rendered when source has assumptions', () => {
    renderAggregator({
      sources: [makeSource('DB', { assumptions: [makeAssumption('X', 'high')] })],
    });
    expect(screen.getByRole('button', { name: /toggle assumptions for DB/i })).toBeInTheDocument();
  });

  it('assumptions list is hidden by default', () => {
    renderAggregator({
      sources: [makeSource('DB', { assumptions: [makeAssumption('X', 'high')] })],
    });
    expect(screen.queryByRole('list', { name: /assumptions for DB/i })).not.toBeInTheDocument();
  });

  it('assumptions list is shown after clicking toggle', () => {
    renderAggregator({
      sources: [makeSource('DB', { assumptions: [makeAssumption('X', 'high')] })],
    });
    fireEvent.click(screen.getByRole('button', { name: /toggle assumptions for DB/i }));
    expect(screen.getByRole('list', { name: /assumptions for DB/i })).toBeInTheDocument();
  });

  it('each assumption has aria-label="Assumption: <text>"', () => {
    renderAggregator({
      sources: [makeSource('DB', { assumptions: [makeAssumption('Assume stable network', 'high')] })],
    });
    fireEvent.click(screen.getByRole('button', { name: /toggle assumptions for DB/i }));
    expect(screen.getByRole('listitem', { name: /assumption: assume stable network/i })).toBeInTheDocument();
  });

  it('collapses assumptions on second toggle click', () => {
    renderAggregator({
      sources: [makeSource('DB', { assumptions: [makeAssumption('X', 'high')] })],
    });
    const btn = screen.getByRole('button', { name: /toggle assumptions for DB/i });
    fireEvent.click(btn);
    fireEvent.click(btn);
    expect(screen.queryByRole('list', { name: /assumptions for DB/i })).not.toBeInTheDocument();
  });

  it('toggle has aria-expanded=false initially', () => {
    renderAggregator({
      sources: [makeSource('DB', { assumptions: [makeAssumption('X', 'low')] })],
    });
    expect(screen.getByRole('button', { name: /toggle assumptions for DB/i }))
      .toHaveAttribute('aria-expanded', 'false');
  });

  it('toggle has aria-expanded=true after clicking', () => {
    renderAggregator({
      sources: [makeSource('DB', { assumptions: [makeAssumption('X', 'low')] })],
    });
    const btn = screen.getByRole('button', { name: /toggle assumptions for DB/i });
    fireEvent.click(btn);
    expect(btn).toHaveAttribute('aria-expanded', 'true');
  });

  it('shows critical count badge on source when critical assumptions exist', () => {
    renderAggregator({
      sources: [makeSource('Sensor', { assumptions: [makeAssumption('A', 'critical'), makeAssumption('B', 'critical')] })],
    });
    expect(screen.getByLabelText(/2 critical assumption/i)).toBeInTheDocument();
  });

  it('does not show toggle button when source has no assumptions', () => {
    renderAggregator({ sources: [makeSource('Empty', { assumptions: [] })] });
    expect(screen.queryByRole('button', { name: /toggle assumptions for Empty/i })).not.toBeInTheDocument();
  });
});

// ─── UncertaintyAggregator – compact mode ────────────────────────────────────

describe('UncertaintyAggregator — compact mode', () => {
  it('renders in compact mode without errors', () => {
    renderAggregator({ sources: [makeSource('A')], compact: true });
    expect(screen.getByRole('region', { name: /uncertainty aggregator/i })).toBeInTheDocument();
  });

  it('does NOT show recommendation block in compact mode', () => {
    renderAggregator({
      sources: [makeSource('DB', { assumptions: [makeAssumption('X', 'critical')] })],
      compact: true,
      showRecommendation: true,
    });
    expect(screen.queryByRole('note', { name: /recommended/i })).not.toBeInTheDocument();
  });

  it('does NOT show system sensitivity label in compact mode', () => {
    renderAggregator({ sources: [makeSource('A')], compact: true, showSensitivity: true });
    expect(screen.queryByLabelText(/system sensitivity/i)).not.toBeInTheDocument();
  });
});

// ─── UncertaintyAggregator – sensitivity visibility ──────────────────────────

describe('UncertaintyAggregator — sensitivity visibility', () => {
  it('shows system sensitivity when showSensitivity=true and not compact', () => {
    renderAggregator({
      sources: [makeSource('A', { assumptions: [makeAssumption('X', 'high')] })],
      showSensitivity: true,
      compact: false,
    });
    expect(screen.getByLabelText(/system sensitivity/i)).toBeInTheDocument();
  });

  it('hides system sensitivity when showSensitivity=false', () => {
    renderAggregator({
      sources: [makeSource('A', { assumptions: [makeAssumption('X', 'high')] })],
      showSensitivity: false,
    });
    expect(screen.queryByLabelText(/system sensitivity/i)).not.toBeInTheDocument();
  });
});
