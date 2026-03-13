// ─────────────────────────────────────────────────────────────────────────────
// Live mutation functions for demo scenarios.
//
// Each export is a factory that returns a stateful mutation function for use
// with MockAgentBridge.startLiveUpdates(intervalMs, mutationFn).
//
// The returned function is called on each tick with the current IntentPayload
// and returns the next state.  Factories hold a step counter so the sequence
// advances deterministically without needing external state.
//
// Design:
//   - No external deps — just plain IntentPayload transformations.
//   - Always produce new objects (structuredClone at field level) so React
//     correctly detects changes via reference inequality.
//   - Sequences are circular: they loop back after the last step.
// ─────────────────────────────────────────────────────────────────────────────

import type { IntentPayload } from '@hari/core';

// ── IoT sensor grid — status cycling + value fluctuation ─────────────────────
//
// Simulates a building sensor network responding to an HVAC incident:
//   Steps 0→1  CO2 worsens, temperature rising
//   Steps 1→2  Temperature hits critical, humidity spikes
//   Steps 2→3  Systems respond, values recovering
//   Steps 3→0  Reset to approximate baseline (loop)

export function makeIotMutator(): (intent: IntentPayload) => IntentPayload {
  const SEQUENCE = [
    // Step 0 → 1 : CO₂ spikes, temperature creeping up
    (sensors: unknown[]) =>
      sensors.map((s) => {
        const sensor = s as Record<string, unknown>;
        if (sensor.id === 's2') return { ...sensor, status: 'critical', value: 2140, trend: 'rising' };
        if (sensor.id === 's1') return { ...sensor, value: 33.8, trend: 'rising' };
        return { ...sensor, lastSeen: new Date().toISOString() };
      }),

    // Step 1 → 2 : Temperature critical, humidity spiking
    (sensors: unknown[]) =>
      sensors.map((s) => {
        const sensor = s as Record<string, unknown>;
        if (sensor.id === 's1') return { ...sensor, status: 'critical', value: 36.1, trend: 'rising' };
        if (sensor.id === 's5') return { ...sensor, status: 'critical', value: 76, trend: 'rising' };
        if (sensor.id === 's6') return { ...sensor, status: 'offline', battery: 0 };
        return { ...sensor, lastSeen: new Date().toISOString() };
      }),

    // Step 2 → 3 : HVAC kicks in — values recovering
    (sensors: unknown[]) =>
      sensors.map((s) => {
        const sensor = s as Record<string, unknown>;
        if (sensor.id === 's1') return { ...sensor, status: 'warning', value: 31.2, trend: 'falling' };
        if (sensor.id === 's2') return { ...sensor, status: 'warning', value: 1620, trend: 'falling' };
        if (sensor.id === 's5') return { ...sensor, status: 'warning', value: 70, trend: 'falling' };
        return { ...sensor, lastSeen: new Date().toISOString() };
      }),

    // Step 3 → 0 : Back to approximate initial state
    (sensors: unknown[]) =>
      sensors.map((s) => {
        const sensor = s as Record<string, unknown>;
        if (sensor.id === 's1') return { ...sensor, status: 'critical', value: 32.4, trend: 'rising' };
        if (sensor.id === 's2') return { ...sensor, status: 'warning', value: 1840, trend: 'rising' };
        if (sensor.id === 's5') return { ...sensor, status: 'warning', value: 68, trend: 'rising' };
        if (sensor.id === 's6') return { ...sensor, status: 'offline', battery: 12 };
        return { ...sensor, lastSeen: new Date().toISOString() };
      }),
  ];

  let step = 0;

  return (intent: IntentPayload): IntentPayload => {
    const mutate = SEQUENCE[step % SEQUENCE.length];
    step++;
    const sensors = mutate((intent.data.sensors as unknown[]) ?? []);
    return { ...intent, data: { ...intent.data, sensors } };
  };
}

// ── CloudOps metrics — incident worsening then recovery ───────────────────────
//
// Simulates a database replication lag incident lifecycle:
//   Steps 0→1  Lag worsens, connections spike
//   Steps 1→2  Peak: CPU critical, IOPS saturated
//   Steps 2→3  On-call SRE kills the blocking query; recovery begins
//   Steps 3→0  Metrics normalise (loop)

export function makeCloudopsMutator(): (intent: IntentPayload) => IntentPayload {
  type MetricPatch = { value?: number | string; trend?: string; status?: string; sparkline?: number[] };

  const SEQUENCE: Array<Record<string, MetricPatch>> = [
    // Step 0 → 1 : lag and connections worsen
    {
      'replication-lag':     { value: 5.8,  trend: 'up',     status: 'critical',  sparkline: [0.1, 0.2, 0.5, 0.9, 1.8, 2.6, 4.2, 5.8] },
      'active-connections':  { value: 305,  trend: 'up',     status: 'warning',   sparkline: [120, 145, 167, 189, 213, 241, 287, 305] },
      'cpu-utilisation':     { value: '74', trend: 'up',     status: 'warning',   sparkline: [55, 58, 60, 61, 62, 65, 68, 74] },
    },
    // Step 1 → 2 : peak — CPU critical
    {
      'replication-lag':     { value: 7.1,  trend: 'up',     status: 'critical',  sparkline: [0.5, 0.9, 1.8, 2.6, 4.2, 5.8, 6.4, 7.1] },
      'active-connections':  { value: 341,  trend: 'up',     status: 'critical',  sparkline: [145, 167, 189, 213, 241, 287, 305, 341] },
      'cpu-utilisation':     { value: '88', trend: 'up',     status: 'critical',  sparkline: [58, 60, 62, 65, 68, 74, 80, 88] },
      'disk-iops':           { value: 4380, trend: 'up',     status: 'warning',   sparkline: [2100, 2400, 2800, 3200, 3600, 3840, 4100, 4380] },
    },
    // Step 2 → 3 : SRE kills blocking query — recovery
    {
      'replication-lag':     { value: 2.4,  trend: 'down',   status: 'critical',  sparkline: [4.2, 5.8, 7.1, 6.4, 5.1, 4.0, 3.2, 2.4] },
      'active-connections':  { value: 231,  trend: 'down',   status: 'warning',   sparkline: [305, 341, 330, 310, 285, 260, 247, 231] },
      'cpu-utilisation':     { value: '61', trend: 'down',   status: 'warning',   sparkline: [80, 88, 84, 78, 72, 68, 65, 61] },
      'disk-iops':           { value: 3100, trend: 'down',   status: 'normal',    sparkline: [3840, 4380, 4100, 3800, 3500, 3300, 3200, 3100] },
    },
    // Step 3 → 0 : normalised
    {
      'replication-lag':     { value: 0.3,  trend: 'stable', status: 'normal',    sparkline: [2.4, 1.8, 1.2, 0.8, 0.5, 0.4, 0.3, 0.3] },
      'active-connections':  { value: 156,  trend: 'stable', status: 'normal',    sparkline: [231, 210, 195, 180, 168, 160, 158, 156] },
      'cpu-utilisation':     { value: '41', trend: 'down',   status: 'normal',    sparkline: [61, 56, 52, 48, 45, 43, 42, 41] },
      'disk-iops':           { value: 2200, trend: 'stable', status: 'normal',    sparkline: [3100, 2800, 2600, 2400, 2300, 2250, 2200, 2200] },
    },
  ];

  let step = 0;

  return (intent: IntentPayload): IntentPayload => {
    const patches = SEQUENCE[step % SEQUENCE.length];
    step++;

    const metrics = ((intent.data.metrics as unknown[]) ?? []).map((m) => {
      const metric = m as Record<string, unknown>;
      const patch = patches[metric.id as string];
      if (!patch) return metric;
      return { ...metric, ...patch };
    });

    return { ...intent, data: { ...intent.data, metrics } };
  };
}

// ── Travel — live fare updates ────────────────────────────────────────────────
//
// Simulates a live booking window where fares fluctuate and seats sell out:
//   Steps 0→1  BA177 rises, AA101 nearly sold out
//   Steps 1→2  VS003 drops (promotion), AA101 sold out
//   Steps 2→3  BA177 drops back, AA101 restocked at higher price
//   Steps 3→0  Reset to approximate initial fares (loop)

export function makeTravelMutator(): (intent: IntentPayload) => IntentPayload {
  type FlightPatch = { price?: number; confidence?: number; note?: string };

  const SEQUENCE: Array<Record<string, FlightPatch>> = [
    // Step 0 → 1
    {
      f1: { price: 568, confidence: 0.88, note: 'Price rising — 2 seats left at this fare' },
      f3: { price: 489, confidence: 0.71, note: 'Only 3 seats remaining' },
    },
    // Step 1 → 2
    {
      f1: { price: 589, confidence: 0.85, note: 'Last seat at this fare' },
      f2: { price: 579, confidence: 0.90, note: 'Price dropped — limited-time fare' },
      f3: { price: 489, confidence: 0.55, note: 'Sold out — checking alternatives…' },
    },
    // Step 2 → 3
    {
      f1: { price: 548, confidence: 0.91, note: '18% below route average' },
      f2: { price: 612, confidence: 0.87, note: 'Lower carbon than BA' },
      f3: { price: 519, confidence: 0.82, note: 'New inventory — higher price' },
    },
    // Step 3 → 0
    {
      f1: { price: 548, confidence: 0.91, note: '18% below route average' },
      f2: { price: 612, confidence: 0.87, note: 'Lower carbon than BA' },
      f3: { price: 489, confidence: 0.78, note: undefined },
    },
  ];

  let step = 0;

  return (intent: IntentPayload): IntentPayload => {
    const patches = SEQUENCE[step % SEQUENCE.length];
    step++;

    const flights = ((intent.data.flights as unknown[]) ?? []).map((f) => {
      const flight = f as Record<string, unknown>;
      const patch = patches[flight.id as string];
      if (!patch) return flight;
      const merged: Record<string, unknown> = { ...flight, ...patch };
      if (patch.note === undefined) delete merged.note;
      return merged;
    });

    return { ...intent, data: { ...intent.data, flights } };
  };
}
