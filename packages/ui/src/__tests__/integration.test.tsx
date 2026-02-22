// ─────────────────────────────────────────────────────────────────────────────
// End-to-end integration test: MockAgentBridge → useAgentBridge → Zustand store
// → compileIntent → React render → DOM update.
//
// This is the canonical proof that HARI renders data dynamically:
// a bridge.pushUpdate() / startLiveUpdates() call propagates all the way through
// the reactive pipeline and causes the rendered output to change without any
// explicit user action.
//
// Pipeline under test:
//   bridge.pushUpdate(fn)
//     → emit('intent', updatedPayload)
//       → useAgentBridge listener → useIntentStore.setIntent(updated)
//         → Zustand subscription → React re-render
//           → compileIntent(updated) in useMemo
//             → DomainComponent renders new data
//               → DOM reflects updated values  ✓
//
// Timer strategy
// ─────────────────────────────────────────────────────────────────────────────
// Most tests run with REAL timers so waitFor() can poll normally.
// Timer-precision tests (startLiveUpdates interval, sendModification delay)
// are isolated in their own describe block with fake timers.
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import {
  MockAgentBridge,
  useIntentStore,
  useUIStore,
  compileIntent,
  ComponentRegistryManager,
  GENERIC_DOMAIN,
  FALLBACK_INTENT,
} from '@hari/core';
import type { IntentPayload } from '@hari/core';
import { useAgentBridge } from '../hooks/useAgentBridge';

// ─── Minimal test registry ────────────────────────────────────────────────────

const testRegistry = new ComponentRegistryManager();

function TestCard({ label, density }: { label?: string; density: string }) {
  return (
    <div>
      <span data-testid="density">{density}</span>
      {label && <span data-testid="label">{label}</span>}
    </div>
  );
}

testRegistry.register('test', 'card', { default: () => TestCard });
testRegistry.register(GENERIC_DOMAIN, FALLBACK_INTENT, { default: () => () => null });

// ─── Harness component ────────────────────────────────────────────────────────
// Wires bridge → store → compiler → renderer in a minimal tree.
// Renders data-testid attributes that make assertions trivial.

function HarnessApp({ bridge }: { bridge: MockAgentBridge }) {
  const { connectionState } = useAgentBridge(bridge);
  const currentIntent = useIntentStore((s) => s.currentIntent);
  const densityOverride = useUIStore((s) => s.densityOverride);

  const compiled = React.useMemo(() => {
    if (!currentIntent) return null;
    return compileIntent(currentIntent, testRegistry, { userDensityOverride: densityOverride });
  }, [currentIntent, densityOverride]);

  if (!compiled) {
    return <div data-testid="state">{connectionState}</div>;
  }

  const DomainComponent = compiled.resolvedComponent?.() as React.ComponentType<Record<string, unknown>> | null;

  return (
    <div>
      <span data-testid="state">{connectionState}</span>
      <span data-testid="domain">{compiled.domain}</span>
      <span data-testid="type">{compiled.type}</span>
      <span data-testid="goal">{compiled.primaryGoal}</span>
      <span data-testid="confidence">{compiled.confidence.toFixed(2)}</span>
      {DomainComponent && (
        <DomainComponent {...compiled.data} density={compiled.density} />
      )}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeIntent(overrides: Partial<IntentPayload> = {}): IntentPayload {
  return {
    version: '1.0.0',
    intentId: crypto.randomUUID(),
    type: 'card',
    domain: 'test',
    primaryGoal: 'Show initial data',
    confidence: 0.9,
    density: 'operator',
    ambiguities: [],
    data: { label: 'initial-value' },
    priorityFields: [],
    actions: [],
    explain: false,
    ...overrides,
  };
}

function resetStores() {
  useIntentStore.setState({ currentIntent: null, intentHistory: [], pendingModifications: [] });
  useUIStore.setState({ densityOverride: null, hypotheticalMode: false, hypotheticalQuery: null });
}

// ─────────────────────────────────────────────────────────────────────────────
// Real-timer tests — waitFor() polls naturally; no fake timer involvement.
// connectLatencyMs:10 keeps tests fast while exercising the full async path.
// ─────────────────────────────────────────────────────────────────────────────

describe('Dynamic rendering pipeline (real timers)', () => {
  beforeEach(resetStores);

  it('renders the initial intent when the bridge connects', async () => {
    const intent = makeIntent({ primaryGoal: 'Find my intent', confidence: 0.85 });
    const bridge = new MockAgentBridge({ initialIntent: intent, connectLatencyMs: 10 });

    render(<HarnessApp bridge={bridge} />);

    await waitFor(() => expect(screen.getByTestId('domain').textContent).toBe('test'));
    expect(screen.getByTestId('type').textContent).toBe('card');
    expect(screen.getByTestId('goal').textContent).toBe('Find my intent');
    expect(screen.getByTestId('confidence').textContent).toBe('0.85');

    bridge.disconnect();
  });

  it('re-renders when bridge.loadScenario() pushes a new intent', async () => {
    const intent1 = makeIntent({ primaryGoal: 'First goal' });
    const bridge = new MockAgentBridge({ initialIntent: intent1, connectLatencyMs: 10 });

    render(<HarnessApp bridge={bridge} />);
    await waitFor(() => expect(screen.getByTestId('goal').textContent).toBe('First goal'));

    const intent2 = makeIntent({ primaryGoal: 'Second goal', confidence: 0.95 });
    act(() => { bridge.loadScenario(intent2); });

    await waitFor(() => expect(screen.getByTestId('goal').textContent).toBe('Second goal'));
    expect(screen.getByTestId('confidence').textContent).toBe('0.95');

    bridge.disconnect();
  });

  it('re-renders when bridge.pushUpdate() mutates a data field', async () => {
    const intent = makeIntent({ data: { label: 'before' } });
    const bridge = new MockAgentBridge({ initialIntent: intent, connectLatencyMs: 10 });

    render(<HarnessApp bridge={bridge} />);
    await waitFor(() => expect(screen.getByTestId('label').textContent).toBe('before'));

    act(() => {
      bridge.pushUpdate((current) => ({
        ...current,
        data: { ...current.data, label: 'after' },
      }));
    });

    await waitFor(() => expect(screen.getByTestId('label').textContent).toBe('after'));
    bridge.disconnect();
  });

  it('handles multiple successive pushUpdate() calls correctly', async () => {
    const intent = makeIntent({ data: { label: 'v0' } });
    const bridge = new MockAgentBridge({ initialIntent: intent, connectLatencyMs: 10 });

    render(<HarnessApp bridge={bridge} />);
    await waitFor(() => expect(screen.getByTestId('label').textContent).toBe('v0'));

    for (const label of ['v1', 'v2', 'v3']) {
      act(() => {
        bridge.pushUpdate((c) => ({ ...c, data: { ...c.data, label } }));
      });
      // eslint-disable-next-line no-await-in-loop
      await waitFor(() => expect(screen.getByTestId('label').textContent).toBe(label));
    }

    bridge.disconnect();
  });

  it('updates domain/type/goal atomically when a full scenario is swapped', async () => {
    const intent1 = makeIntent({ domain: 'test', type: 'card', primaryGoal: 'Scenario A', confidence: 0.70 });
    const bridge = new MockAgentBridge({ initialIntent: intent1, connectLatencyMs: 10 });

    render(<HarnessApp bridge={bridge} />);
    await waitFor(() => expect(screen.getByTestId('goal').textContent).toBe('Scenario A'));

    const intent2 = makeIntent({ domain: 'test', type: 'card', primaryGoal: 'Scenario B', confidence: 0.80 });
    act(() => { bridge.loadScenario(intent2); });

    await waitFor(() => expect(screen.getByTestId('goal').textContent).toBe('Scenario B'));
    expect(screen.getByTestId('confidence').textContent).toBe('0.80');

    bridge.disconnect();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Fake-timer tests — precise interval and delay control; no waitFor().
// ─────────────────────────────────────────────────────────────────────────────

describe('Dynamic rendering pipeline (fake timers)', () => {
  beforeEach(() => {
    resetStores();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('startLiveUpdates() drives repeated DOM changes on each interval tick', async () => {
    const intent = makeIntent({ data: { label: 'tick-0' } });
    const bridge = new MockAgentBridge({ initialIntent: intent, connectLatencyMs: 0 });

    render(<HarnessApp bridge={bridge} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(10); });
    expect(screen.getByTestId('label').textContent).toBe('tick-0');

    let tick = 1;
    bridge.startLiveUpdates(100, (current) => ({
      ...current,
      data: { ...current.data, label: `tick-${tick++}` },
    }));

    // Advance one tick
    await act(async () => { await vi.advanceTimersByTimeAsync(100); });
    expect(screen.getByTestId('label').textContent).toBe('tick-1');

    // Advance a second tick
    await act(async () => { await vi.advanceTimersByTimeAsync(100); });
    expect(screen.getByTestId('label').textContent).toBe('tick-2');

    bridge.stopLiveUpdates();
    bridge.disconnect();
  });

  it('stopLiveUpdates() halts DOM changes after the last tick', async () => {
    const intent = makeIntent({ data: { label: 'start' } });
    const bridge = new MockAgentBridge({ initialIntent: intent, connectLatencyMs: 0 });

    render(<HarnessApp bridge={bridge} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(10); });

    let tick = 1;
    bridge.startLiveUpdates(100, (current) => ({
      ...current,
      data: { ...current.data, label: `tick-${tick++}` },
    }));

    await act(async () => { await vi.advanceTimersByTimeAsync(100); });
    expect(screen.getByTestId('label').textContent).toBe('tick-1');

    // Stop — label must stay at tick-1 even after more time passes
    bridge.stopLiveUpdates();
    await act(async () => { await vi.advanceTimersByTimeAsync(500); });
    expect(screen.getByTestId('label').textContent).toBe('tick-1');

    bridge.disconnect();
  });

  it('sendModification() roundtrip updates the DOM after the configured delay', async () => {
    const intent = makeIntent({ data: { label: 'original' } });
    const bridge = new MockAgentBridge({
      initialIntent: intent,
      connectLatencyMs: 0,
      roundtripLatencyMs: 200,
    });

    render(<HarnessApp bridge={bridge} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(10); });
    expect(screen.getByTestId('label').textContent).toBe('original');

    act(() => {
      bridge.sendModification({
        event: 'intent_modification',
        originalIntentId: intent.intentId,
        modifications: { label: 'patched' },
        timestamp: Date.now(),
      });
    });

    // Before roundtrip delay fires — DOM unchanged
    expect(screen.getByTestId('label').textContent).toBe('original');

    // After the 200 ms roundtrip delay
    await act(async () => { await vi.advanceTimersByTimeAsync(200); });
    expect(screen.getByTestId('label').textContent).toBe('patched');

    bridge.disconnect();
  });
});
