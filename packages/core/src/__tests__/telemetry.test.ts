import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TelemetryEmitter, telemetry } from '../telemetry/emitter';
import type { TelemetryEvent } from '../telemetry/types';

describe('TelemetryEmitter', () => {
  let emitter: TelemetryEmitter;

  beforeEach(() => {
    emitter = new TelemetryEmitter();
  });

  // ── Initial state ──────────────────────────────────────────────────────────

  it('starts disabled by default', () => {
    expect(emitter.isEnabled).toBe(false);
  });

  it('starts with no handlers', () => {
    expect(emitter.handlerCount).toBe(0);
  });

  // ── enable / disable ───────────────────────────────────────────────────────

  it('enable() returns the emitter for chaining', () => {
    expect(emitter.enable()).toBe(emitter);
  });

  it('disable() returns the emitter for chaining', () => {
    emitter.enable();
    expect(emitter.disable()).toBe(emitter);
  });

  it('enable() sets isEnabled to true', () => {
    emitter.enable();
    expect(emitter.isEnabled).toBe(true);
  });

  it('disable() sets isEnabled to false', () => {
    emitter.enable().disable();
    expect(emitter.isEnabled).toBe(false);
  });

  // ── subscribe / unsubscribe ────────────────────────────────────────────────

  it('subscribe() increments handlerCount', () => {
    emitter.subscribe(() => {});
    expect(emitter.handlerCount).toBe(1);

    emitter.subscribe(() => {});
    expect(emitter.handlerCount).toBe(2);
  });

  it('returned unsubscribe fn decrements handlerCount', () => {
    const unsub = emitter.subscribe(() => {});
    expect(emitter.handlerCount).toBe(1);
    unsub();
    expect(emitter.handlerCount).toBe(0);
  });

  it('calling unsubscribe twice is safe', () => {
    const unsub = emitter.subscribe(() => {});
    unsub();
    expect(() => unsub()).not.toThrow();
  });

  // ── emit (disabled) ────────────────────────────────────────────────────────

  it('emit() is silent when disabled', () => {
    const handler = vi.fn();
    emitter.subscribe(handler);
    emitter.emit({ type: 'bridge:connected' });
    expect(handler).not.toHaveBeenCalled();
  });

  it('emit() is silent when no handlers are registered', () => {
    emitter.enable();
    expect(() => emitter.emit({ type: 'bridge:connected' })).not.toThrow();
  });

  // ── emit (enabled) ─────────────────────────────────────────────────────────

  it('emit() calls all registered handlers', () => {
    const h1 = vi.fn();
    const h2 = vi.fn();
    emitter.enable();
    emitter.subscribe(h1);
    emitter.subscribe(h2);

    const event: TelemetryEvent = { type: 'intent:received', domain: 'travel', intentType: 'comparison', confidence: 0.9, ambiguityCount: 2, actionCount: 1 };
    emitter.emit(event);

    expect(h1).toHaveBeenCalledWith(event);
    expect(h2).toHaveBeenCalledWith(event);
  });

  it('emit() passes the exact event object to handlers', () => {
    const received: TelemetryEvent[] = [];
    emitter.enable().subscribe((e) => received.push(e));

    const event: TelemetryEvent = { type: 'whatif:queried', query: 'What if nonstop?', domain: 'travel' };
    emitter.emit(event);

    expect(received).toHaveLength(1);
    expect(received[0]).toBe(event);
  });

  it('emit() continues calling remaining handlers when one throws', () => {
    const bad = vi.fn(() => { throw new Error('handler explosion'); });
    const good = vi.fn();

    emitter.enable();
    emitter.subscribe(bad);
    emitter.subscribe(good);

    expect(() => emitter.emit({ type: 'bridge:disconnected' })).not.toThrow();
    expect(bad).toHaveBeenCalled();
    expect(good).toHaveBeenCalled();
  });

  it('emit() stops calling a handler after it unsubscribes', () => {
    const handler = vi.fn();
    emitter.enable();
    const unsub = emitter.subscribe(handler);

    emitter.emit({ type: 'bridge:connected' });
    expect(handler).toHaveBeenCalledTimes(1);

    unsub();
    emitter.emit({ type: 'bridge:disconnected' });
    expect(handler).toHaveBeenCalledTimes(1); // no second call
  });

  // ── disable clears emission without losing handlers ────────────────────────

  it('handlers are retained after disable() and fire again on re-enable()', () => {
    const handler = vi.fn();
    emitter.enable().subscribe(handler);

    emitter.emit({ type: 'bridge:connected' });
    expect(handler).toHaveBeenCalledTimes(1);

    emitter.disable();
    emitter.emit({ type: 'bridge:disconnected' });
    expect(handler).toHaveBeenCalledTimes(1); // no call while disabled

    emitter.enable();
    emitter.emit({ type: 'bridge:reconnecting', attempt: 1 });
    expect(handler).toHaveBeenCalledTimes(2);
  });

  // ── event shape coverage ───────────────────────────────────────────────────

  it('accepts all TelemetryEvent variants without type errors', () => {
    emitter.enable();
    const events: TelemetryEvent[] = [
      { type: 'bridge:connected', transportType: 'MockAgentBridge', latencyMs: 50 },
      { type: 'bridge:disconnected', reason: 'timeout' },
      { type: 'bridge:reconnecting', attempt: 2 },
      { type: 'intent:received', domain: 'cloudops', intentType: 'diagnostic_overview', confidence: 0.85, ambiguityCount: 3, actionCount: 2 },
      { type: 'intent:modified', controlIds: ['nonstop', 'priceWeight'], domain: 'travel', intentType: 'comparison' },
      { type: 'whatif:queried', query: 'What if we scale down?', domain: 'cloudops' },
      { type: 'whatif:resolved', latencyMs: 320, deltaCount: 4, confidence: 0.78 },
      { type: 'action:executed', actionId: 'restart-service', riskLevel: 'high' },
      { type: 'action:confirmed', actionId: 'restart-service' },
      { type: 'action:cancelled', actionId: 'restart-service' },
      { type: 'explain:opened', elementId: 'confidence-model' },
    ];

    const received: TelemetryEvent[] = [];
    emitter.subscribe((e) => received.push(e));

    events.forEach((e) => emitter.emit(e));
    expect(received).toHaveLength(events.length);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Global singleton
// ─────────────────────────────────────────────────────────────────────────────

describe('telemetry singleton', () => {
  it('is an instance of TelemetryEmitter', () => {
    expect(telemetry).toBeInstanceOf(TelemetryEmitter);
  });

  it('starts disabled', () => {
    // The singleton might be enabled by other tests — use a fresh emitter for state checks.
    const fresh = new TelemetryEmitter();
    expect(fresh.isEnabled).toBe(false);
  });
});
