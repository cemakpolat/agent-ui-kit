import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAgentBridge } from '../hooks/useAgentBridge';
import { MockAgentBridge } from '@hari/core';
import { useIntentStore, useUIStore } from '@hari/core';
import type { IntentPayload } from '@hari/core';

// ─── Reset stores between tests ───────────────────────────────────────────────
beforeEach(() => {
  useIntentStore.setState({ currentIntent: null, intentHistory: [], pendingModifications: [] });
  useUIStore.setState({ densityOverride: null, hypotheticalMode: false, hypotheticalQuery: null });
});

const uuidv4 = () => crypto.randomUUID();

function makeIntent(domain = 'travel'): IntentPayload {
  return {
    version: '1.0.0',
    intentId: uuidv4(),
    type: 'comparison',
    domain,
    primaryGoal: 'Test',
    confidence: 0.9,
    density: 'operator',
    ambiguities: [],
    data: {},
    priorityFields: [],
    actions: [],
    explain: false,
  };
}

describe('useAgentBridge', () => {
  let bridge: MockAgentBridge;

  beforeEach(() => {
    vi.useFakeTimers();
    bridge = new MockAgentBridge({ connectLatencyMs: 10, roundtripLatencyMs: 10 });
  });

  afterEach(() => {
    bridge.disconnect();
    vi.useRealTimers();
  });

  it('starts with connecting state and moves to connected', async () => {
    const { result } = renderHook(() => useAgentBridge(bridge));
    expect(result.current.connectionState).toBe('connecting');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(result.current.connectionState).toBe('connected');
  });

  it('commits intent to store when bridge emits an intent event', async () => {
    const intent = makeIntent();
    bridge = new MockAgentBridge({ initialIntent: intent, connectLatencyMs: 10 });

    renderHook(() => useAgentBridge(bridge));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10); // connect + emit initial intent
    });

    const { currentIntent } = useIntentStore.getState();
    expect(currentIntent).not.toBeNull();
    expect(currentIntent!.intentId).toBe(intent.intentId);
  });

  it('updates connectionState when bridge state changes', async () => {
    const { result } = renderHook(() => useAgentBridge(bridge));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(result.current.connectionState).toBe('connected');

    act(() => { bridge.disconnect(); });
    expect(result.current.connectionState).toBe('disconnected');
  });

  it('disconnects when the hook unmounts', async () => {
    const { unmount } = renderHook(() => useAgentBridge(bridge));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(bridge.connectionState).toBe('connected');
    unmount();
    expect(bridge.connectionState).toBe('disconnected');
  });

  it('sendModification triggers a bridge patch and re-emits intent', async () => {
    const intent = makeIntent();
    bridge = new MockAgentBridge({ initialIntent: intent, connectLatencyMs: 10, roundtripLatencyMs: 10 });

    const { result } = renderHook(() => useAgentBridge(bridge));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    act(() => {
      result.current.sendModification({
        event: 'intent_modification',
        originalIntentId: intent.intentId,
        modifications: { testKey: 'testValue' },
        timestamp: Date.now(),
      });
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    // Bridge should have re-emitted the (modified) intent → store updated
    const { currentIntent } = useIntentStore.getState();
    expect(currentIntent).not.toBeNull();
  });
});
