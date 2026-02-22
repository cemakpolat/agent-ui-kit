import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MockAgentBridge } from '../transport/mock';
import type { IntentPayload } from '../schemas/intent';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const uuidv4 = () => crypto.randomUUID();

function makeIntent(domain = 'travel', type = 'comparison'): IntentPayload {
  return {
    version: '1.0.0',
    intentId: uuidv4(),
    type,
    domain,
    primaryGoal: 'Test goal',
    confidence: 0.9,
    density: 'operator',
    ambiguities: [
      { type: 'toggle', id: 'nonstop', label: 'Nonstop only', value: false, parameterKey: 'nonstopOnly' },
      { type: 'range_selector', id: 'price', label: 'Price weight', min: 0, max: 1, step: 0.1, value: 0.5, parameterKey: 'priceWeight' },
    ],
    data: { flights: [] },
    priorityFields: [],
    actions: [],
    explain: false,
  };
}

// Helper: start an async operation then drain all fake timers
async function run<T>(start: () => Promise<T>): Promise<T> {
  const p = start();
  await vi.runAllTimersAsync();
  return p;
}

// ─────────────────────────────────────────────────────────────────────────────
// MockAgentBridge tests
// ─────────────────────────────────────────────────────────────────────────────

describe('MockAgentBridge', () => {
  let bridge: MockAgentBridge;

  beforeEach(() => {
    vi.useFakeTimers();
    bridge = new MockAgentBridge({ connectLatencyMs: 100, roundtripLatencyMs: 200 });
  });

  afterEach(() => {
    bridge.disconnect();
    vi.useRealTimers();
  });

  it('starts in idle state', () => {
    expect(bridge.connectionState).toBe('idle');
  });

  it('transitions idle → connecting → connected', async () => {
    const states: string[] = [];
    bridge.on('stateChange', (s) => states.push(s));
    const p = bridge.connect();
    expect(bridge.connectionState).toBe('connecting');
    await vi.advanceTimersByTimeAsync(100);
    await p;
    expect(bridge.connectionState).toBe('connected');
    expect(states).toEqual(['connecting', 'connected']);
  });

  it('is a no-op to call connect() when already connecting', async () => {
    const p1 = bridge.connect();
    expect(bridge.connectionState).toBe('connecting');
    // second call while still connecting
    bridge.connect(); // should not throw
    await vi.advanceTimersByTimeAsync(100);
    await p1;
    expect(bridge.connectionState).toBe('connected');
  });

  it('emits initial intent on connect when one is provided', async () => {
    const intent = makeIntent();
    bridge = new MockAgentBridge({ initialIntent: intent, connectLatencyMs: 50 });
    const received: IntentPayload[] = [];
    bridge.on('intent', (i) => received.push(i));
    await run(() => bridge.connect());
    expect(received).toHaveLength(1);
    expect(received[0].intentId).toBe(intent.intentId);
  });

  it('loadScenario emits intent immediately when connected', async () => {
    await run(() => bridge.connect());
    const received: IntentPayload[] = [];
    bridge.on('intent', (i) => received.push(i));
    const newIntent = makeIntent('cloudops', 'diagnostic');
    bridge.loadScenario(newIntent);
    expect(received).toHaveLength(1);
    expect(received[0].domain).toBe('cloudops');
  });

  it('sendModification re-emits an updated intent after roundtrip delay', async () => {
    const intent = makeIntent();
    bridge = new MockAgentBridge({ initialIntent: intent, connectLatencyMs: 10, roundtripLatencyMs: 200 });
    const received: IntentPayload[] = [];
    bridge.on('intent', (i) => received.push(i));

    await run(() => bridge.connect()); // fires connect + initial intent emit

    bridge.sendModification({
      event: 'intent_modification',
      originalIntentId: intent.intentId,
      modifications: { nonstop: true },
      timestamp: Date.now(),
    });

    // Before roundtrip completes — only the initial intent
    expect(received).toHaveLength(1);
    // Advance past the roundtrip delay
    await vi.advanceTimersByTimeAsync(200);
    expect(received).toHaveLength(2);
  });

  it('applies modifications to ambiguity controls by id', async () => {
    const intent = makeIntent();
    bridge = new MockAgentBridge({ initialIntent: intent, connectLatencyMs: 10, roundtripLatencyMs: 10 });
    const received: IntentPayload[] = [];
    bridge.on('intent', (i) => received.push(i));
    await run(() => bridge.connect());

    bridge.sendModification({
      event: 'intent_modification',
      originalIntentId: intent.intentId,
      modifications: { nonstop: true, price: 0.8 },
      timestamp: Date.now(),
    });
    await vi.advanceTimersByTimeAsync(10);

    const updated = received[received.length - 1];
    const toggle = updated.ambiguities.find((a) => a.id === 'nonstop');
    const range  = updated.ambiguities.find((a) => a.id === 'price');
    expect((toggle as { value: boolean }).value).toBe(true);
    expect((range  as { value: number }).value).toBe(0.8);
  });

  it('queryWhatIf resolves with a WhatIfResult', async () => {
    bridge = new MockAgentBridge({ connectLatencyMs: 10, roundtripLatencyMs: 10 });
    await run(() => bridge.connect());
    const resultPromise = bridge.queryWhatIf({
      question: 'What if I filter to nonstop flights?',
      intentSnapshot: makeIntent('travel'),
    });
    await vi.advanceTimersByTimeAsync(20); // roundtrip * 2
    const result = await resultPromise;
    expect(typeof result.reasoning).toBe('string');
    expect(Array.isArray(result.deltas)).toBe(true);
    expect(Array.isArray(result.caveats)).toBe(true);
    expect(typeof result.confidence).toBe('number');
  });

  it('domain-aware what-if: travel + nonstop returns flight-specific deltas', async () => {
    bridge = new MockAgentBridge({ connectLatencyMs: 10, roundtripLatencyMs: 10 });
    await run(() => bridge.connect());
    const resultPromise = bridge.queryWhatIf({
      question: 'What if nonstop only?',
      intentSnapshot: makeIntent('travel'),
    });
    await vi.advanceTimersByTimeAsync(20);
    const result = await resultPromise;
    expect(result.deltas.length).toBeGreaterThan(0);
  });

  it('disconnect transitions to disconnected and cancels pending timers', async () => {
    const intent = makeIntent();
    bridge = new MockAgentBridge({ initialIntent: intent, connectLatencyMs: 10, roundtripLatencyMs: 500 });
    const received: IntentPayload[] = [];
    bridge.on('intent', (i) => received.push(i));
    await run(() => bridge.connect()); // fires initial intent → received[0]

    bridge.sendModification({
      event: 'intent_modification',
      originalIntentId: intent.intentId,
      modifications: {},
      timestamp: Date.now(),
    });

    bridge.disconnect();
    await vi.advanceTimersByTimeAsync(1000); // would have triggered roundtrip
    expect(received).toHaveLength(1);        // no re-emit after disconnect
    expect(bridge.connectionState).toBe('disconnected');
  });

  it('on() returns an unsubscribe function', async () => {
    const intent = makeIntent();
    bridge = new MockAgentBridge({ initialIntent: intent, connectLatencyMs: 10 });
    const received: IntentPayload[] = [];
    const unsub = bridge.on('intent', (i) => received.push(i));
    await run(() => bridge.connect());
    expect(received).toHaveLength(1);
    unsub();
    bridge.loadScenario(makeIntent('cloudops'));
    expect(received).toHaveLength(1); // unsubscribed — no further events
  });

  it('once() fires only one time', async () => {
    bridge = new MockAgentBridge({ connectLatencyMs: 10 });
    await run(() => bridge.connect());
    const received: string[] = [];
    bridge.once('stateChange', (s) => received.push(s));
    // Force two disconnects+reconnects → two stateChange events
    bridge.disconnect();
    const p = bridge.connect();
    await vi.advanceTimersByTimeAsync(100);
    await p;
    // once() should have fired only once (on the first stateChange)
    expect(received).toHaveLength(1);
  });
});
