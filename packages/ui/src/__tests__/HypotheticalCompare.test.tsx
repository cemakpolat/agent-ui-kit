// ─────────────────────────────────────────────────────────────────────────────
// HypotheticalCompare — unit tests
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { useIntentStore, ComponentRegistryManager } from '@hari/core';
import type { IntentPayload } from '@hari/core';
import { HypotheticalCompare } from '../components/HypotheticalCompare';

// ── Minimal registry (no resolved component — uses fallback) ─────────────────
const emptyRegistry = new ComponentRegistryManager();

// ── Fixture intent ────────────────────────────────────────────────────────────
function makeIntent(overrides: Partial<IntentPayload> = {}): IntentPayload {
  return {
    version: '1.0.0',
    intentId: '00000000-0000-0000-0000-000000000001',
    type: 'comparison',
    domain: 'travel',
    primaryGoal: 'Choose a flight',
    confidence: 0.9,
    density: 'operator',
    ambiguities: [],
    data: { price: 100, origin: 'LHR' },
    priorityFields: [],
    actions: [],
    explain: false,
    ...overrides,
  };
}

describe('HypotheticalCompare', () => {
  beforeEach(() => {
    useIntentStore.setState({
      currentIntent: null,
      intentHistory: [],
      pendingModifications: [],
      hypotheticalIntent: null,
      hypotheticalDiff: {},
    });
  });

  it('renders nothing when there is no branch', () => {
    const { container } = render(
      <HypotheticalCompare registry={emptyRegistry} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders the compare panel when a branch exists', () => {
    const intent = makeIntent();
    useIntentStore.getState().setIntent(intent);
    useIntentStore.getState().branchHypothetical();

    render(<HypotheticalCompare registry={emptyRegistry} />);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/Hypothetical Branch/i)).toBeInTheDocument();
    expect(screen.getByText(/Actual \(committed\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Hypothetical \(uncommitted\)/i)).toBeInTheDocument();
  });

  it('shows diff summary when branch has modifications', () => {
    const intent = makeIntent();
    useIntentStore.getState().setIntent(intent);
    useIntentStore.getState().branchHypothetical();
    useIntentStore.getState().modifyHypotheticalParameter('price', 250);

    render(<HypotheticalCompare registry={emptyRegistry} />);

    expect(screen.getByText(/Changes \(1\)/i)).toBeInTheDocument();
    expect(screen.getByText('price')).toBeInTheDocument();
  });

  it('Rollback button calls rollbackHypothetical() and onRollback callback', () => {
    const onRollback = vi.fn();
    const intent = makeIntent();
    useIntentStore.getState().setIntent(intent);
    useIntentStore.getState().branchHypothetical();

    render(<HypotheticalCompare registry={emptyRegistry} onRollback={onRollback} />);

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /rollback/i }));
    });

    expect(useIntentStore.getState().hypotheticalIntent).toBeNull();
    expect(onRollback).toHaveBeenCalledTimes(1);
  });

  it('Commit button calls commitHypothetical() and onCommit callback', () => {
    const onCommit = vi.fn();
    const intent = makeIntent();
    useIntentStore.getState().setIntent(intent);
    useIntentStore.getState().branchHypothetical();
    useIntentStore.getState().modifyHypotheticalParameter('price', 999);

    render(<HypotheticalCompare registry={emptyRegistry} onCommit={onCommit} />);

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /commit/i }));
    });

    const { currentIntent, hypotheticalIntent } = useIntentStore.getState();
    expect(hypotheticalIntent).toBeNull();
    expect((currentIntent!.data as Record<string, unknown>)['price']).toBe(999);
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it('has a11y role="dialog" and aria-modal="true"', () => {
    const intent = makeIntent();
    useIntentStore.getState().setIntent(intent);
    useIntentStore.getState().branchHypothetical();

    render(<HypotheticalCompare registry={emptyRegistry} />);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-label');
  });

  it('Rollback button receives focus on mount', () => {
    const intent = makeIntent();
    useIntentStore.getState().setIntent(intent);
    useIntentStore.getState().branchHypothetical();

    render(<HypotheticalCompare registry={emptyRegistry} />);

    const rollbackBtn = screen.getByRole('button', { name: /rollback/i });
    expect(document.activeElement).toBe(rollbackBtn);
  });
});
