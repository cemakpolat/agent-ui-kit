// ─────────────────────────────────────────────────────────────────────────────
// MockAgentBridge — Deterministic in-process adapter for demos and tests.
//
// Behaviour:
//   - connect() resolves after a configurable latency (default 200 ms)
//   - Fires an initial intent immediately after connection if one is provided
//   - Applies IntentModification patches locally (deep-merge) and re-emits
//     a new intent after a configurable roundtrip latency (default 400 ms)
//   - Responds to what-if queries with a domain-aware simulation
//   - Supports scenario switching via .loadScenario()
// ─────────────────────────────────────────────────────────────────────────────

import { BaseAgentBridge } from './base';
import type { TransportOptions, WhatIfQuery, WhatIfResult } from './types';
import type { IntentPayload, IntentModification } from '../schemas/intent';
import type { CapabilityManifest } from '../compiler/version';

export interface MockTransportOptions extends TransportOptions {
  /** Initial intent payload to emit on connect */
  initialIntent?: IntentPayload;
  /** Simulated network latency for connect (ms). Default: 200 */
  connectLatencyMs?: number;
  /** Simulated agent roundtrip after a patch (ms). Default: 400 */
  roundtripLatencyMs?: number;
}

export class MockAgentBridge extends BaseAgentBridge {
  private _currentIntent: IntentPayload | null;
  private readonly _connectLatency: number;
  private readonly _roundtripLatency: number;
  private _pendingTimers = new Set<ReturnType<typeof setTimeout>>();
  private _liveUpdateTimer: ReturnType<typeof setInterval> | null = null;

  constructor(opts: MockTransportOptions = {}) {
    super(opts);
    this._currentIntent = opts.initialIntent ?? null;
    this._connectLatency = opts.connectLatencyMs ?? 200;
    this._roundtripLatency = opts.roundtripLatencyMs ?? 400;
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  async connect(): Promise<void> {
    if (
      this.connectionState === 'connected' ||
      this.connectionState === 'connecting'
    ) return;

    this.setState('connecting');
    await this._delay(this._connectLatency);
    this.setState('connected');

    if (this._currentIntent) {
      this.emit('intent', this._currentIntent);
    }
  }

  disconnect(): void {
    this.stopLiveUpdates();
    this._pendingTimers.forEach(clearTimeout);
    this._pendingTimers.clear();
    this.cancelReconnect();
    this.setState('disconnected');
  }

  // ── Public helpers ──────────────────────────────────────────────────────────

  /**
   * Replace the active intent and immediately re-emit it.
   * Use this to switch scenarios in a demo without reconnecting.
   */
  loadScenario(intent: IntentPayload): void {
    this._currentIntent = intent;
    if (this.connectionState === 'connected') {
      this.emit('intent', intent);
    }
  }

  // ── Live update helpers ─────────────────────────────────────────────────────

  /**
   * Immediately push a mutated intent through the bridge without a roundtrip
   * delay.  The mutation function receives the current intent and returns the
   * new one; the bridge state is updated accordingly.
   *
   * Useful for simulating proactive agent pushes from outside tests or demos.
   */
  pushUpdate(mutationFn: (current: IntentPayload) => IntentPayload): void {
    if (!this._currentIntent) return;
    const updated = mutationFn(this._currentIntent);
    this._currentIntent = updated;
    if (this.connectionState === 'connected') {
      this.emit('intent', updated);
    }
  }

  /**
   * Start periodic live updates that simulate an agent continuously pushing
   * fresh data (e.g. streaming sensor readings, live pricing, metric polling).
   *
   * The mutation function is called on each tick with the current intent and
   * should return the next intent state.  Calling startLiveUpdates() again
   * replaces the previous interval.
   *
   * @param intervalMs  How often to push an update (ms).
   * @param mutationFn  Pure function: currentIntent → nextIntent.
   */
  startLiveUpdates(
    intervalMs: number,
    mutationFn: (current: IntentPayload) => IntentPayload,
  ): void {
    this.stopLiveUpdates();
    this._liveUpdateTimer = setInterval(() => {
      this.pushUpdate(mutationFn);
    }, intervalMs);
  }

  /** Stop any running live update interval started by startLiveUpdates(). */
  stopLiveUpdates(): void {
    if (this._liveUpdateTimer !== null) {
      clearInterval(this._liveUpdateTimer);
      this._liveUpdateTimer = null;
    }
  }

  // ── AgentBridge implementation ──────────────────────────────────────────────

  sendModification(patch: IntentModification): void {
    if (this.connectionState !== 'connected' || !this._currentIntent) return;

    this.log('debug', '[MockBridge] patch received', patch);

    // Simulate agent processing: apply the patch and re-emit
    const timer = setTimeout(() => {
      this._pendingTimers.delete(timer);
      if (!this._currentIntent) return;

      const updated = applyModificationPatch(this._currentIntent, patch);
      this._currentIntent = updated;
      this.emit('intent', updated);
    }, this._roundtripLatency);
    this._pendingTimers.add(timer);
  }

  sendCapabilityManifest(manifest: CapabilityManifest): void {
    this.log('debug', '[MockBridge] capability manifest received', manifest);
    // In a real bridge this would be sent over the wire; mock just logs it
  }

  async queryWhatIf(query: WhatIfQuery): Promise<WhatIfResult> {
    await this._delay(this._roundtripLatency * 2);
    return simulateWhatIf(query);
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  private _delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this._pendingTimers.delete(timer);
        resolve();
      }, ms);
      this._pendingTimers.add(timer);
    });
  }
}

// ── Patch application ─────────────────────────────────────────────────────────
//
// `patch.modifications` is a flat Record<string, unknown> keyed by controlId
// (set via `modifyParameter(controlId, value)` in the intent store).
// For each key we attempt to match an ambiguity control by id or parameterKey,
// then fall through to a best-effort data field update.

function applyModificationPatch(
  intent: IntentPayload,
  patch: IntentModification,
): IntentPayload {
  const updated = structuredClone(intent);

  for (const [key, value] of Object.entries(patch.modifications)) {
    // Match ambiguity control by id or parameterKey
    const ctrl = updated.ambiguities.find(
      (a) => a.id === key || a.parameterKey === key,
    );
    if (ctrl) {
      (ctrl as Record<string, unknown>)['value'] = value;
      continue;
    }

    // Fall through: treat as a data field key
    if (updated.data && typeof updated.data === 'object') {
      (updated.data as Record<string, unknown>)[key] = value;
    }
  }

  return updated;
}

// ── What-if simulation ────────────────────────────────────────────────────────

function simulateWhatIf(query: WhatIfQuery): WhatIfResult {
  const domain = query.intentSnapshot.domain;
  const q = query.question.toLowerCase();

  // Domain-aware simulation responses
  if (domain === 'travel') {
    if (q.includes('nonstop') || q.includes('direct')) {
      return {
        reasoning:
          'Filtering to nonstop flights reduces the available pool from 3 to 1 option. ' +
          'The remaining flight (BA177) is 18% more expensive than the current cheapest.',
        deltas: [
          { field: 'flights.length', was: 3, becomes: 1, impact: 'negative' },
          { field: 'cheapest_price', was: 548, becomes: 649, impact: 'negative' },
          { field: 'carbon_kg', was: 312, becomes: 290, impact: 'positive' },
          { field: 'travel_time_h', was: 9.5, becomes: 7.5, impact: 'positive' },
        ],
        caveats: [
          'Availability is limited — only 4 seats remain on BA177.',
          'Price is live-quoted; may change before booking.',
        ],
        confidence: 0.87,
      };
    }
    if (q.includes('carbon') || q.includes('eco') || q.includes('green')) {
      return {
        reasoning:
          'Prioritising carbon efficiency re-ranks VS003 to first place. ' +
          'It emits 22% less CO₂ per passenger than the current cheapest option.',
        deltas: [
          { field: 'top_result', was: 'BA177 (£548)', becomes: 'VS003 (£612)', impact: 'neutral' },
          { field: 'carbon_kg', was: 312, becomes: 243, impact: 'positive' },
          { field: 'price_diff', was: 0, becomes: 64, impact: 'negative' },
        ],
        caveats: [
          'Carbon estimates use ICAO methodology and may vary ±15%.',
          'VS003 has a 45-min layover in Dublin.',
        ],
        confidence: 0.79,
      };
    }
  }

  if (domain === 'cloudops') {
    if (q.includes('restart') || q.includes('replica')) {
      return {
        reasoning:
          'Restarting the replica immediately clears the replication lag but causes ' +
          'a brief read outage (~90 seconds) affecting the analytics service.',
        deltas: [
          { field: 'replication_lag_ms', was: 4200, becomes: 0, impact: 'positive' },
          { field: 'read_api_downtime_s', was: 0, becomes: 90, impact: 'negative' },
          { field: 'analytics_errors', was: 0, becomes: 12, impact: 'negative' },
        ],
        caveats: [
          'Restart does not address the root cause (long-running query on primary).',
          'Consider killing the blocking query first for zero-downtime resolution.',
        ],
        confidence: 0.82,
      };
    }
  }

  if (domain === 'iot') {
    if (q.includes('threshold') || q.includes('alert')) {
      return {
        reasoning:
          'Adjusting alert thresholds to ±2σ from the 7-day baseline would reduce ' +
          'false-positive alerts by ~40% while maintaining detection of genuine anomalies.',
        deltas: [
          { field: 'active_alerts', was: 3, becomes: 1, impact: 'positive' },
          { field: 'detection_latency_s', was: 15, becomes: 45, impact: 'negative' },
        ],
        caveats: [
          'Wider thresholds may miss brief spikes lasting < 30 seconds.',
          'Recommended for steady-state environments only.',
        ],
        confidence: 0.74,
      };
    }
  }

  // Generic fallback
  return {
    reasoning:
      `Based on current intent parameters, modifying "${query.question}" would likely ` +
      'shift the result set but the agent needs more context to quantify the change precisely.',
    deltas: [],
    caveats: [
      'This is a simulated response — connect to a live agent for precise what-if analysis.',
    ],
    confidence: 0.5,
  };
}
