export type { TelemetryEvent, TelemetryEventType } from './types';
export type { TelemetryHandler } from './emitter';
export { TelemetryEmitter, telemetry } from './emitter';

// Phase 8.3 — Governance Metrics Aggregator
export type { GovernanceSnapshot, LatencyStats, AuthorityTransition, ApprovalStats, AIStats } from './governance-metrics';
export { GovernanceMetrics, governanceMetrics } from './governance-metrics';
