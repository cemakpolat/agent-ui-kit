// ─────────────────────────────────────────────────────────────────────────────
// GovernanceMetrics — Phase 8.3
//
// Subscribes to the HARI telemetry bus and aggregates governance-specific
// events into time-series snapshots and summary statistics.
//
// Designed as a zero-dependency in-process aggregator.  Data can be:
//   1. Consumed directly by the GovernanceDashboard React component
//   2. Exported as Grafana-compatible JSON (via toGrafanaPayload())
//   3. Pushed to a remote metrics endpoint (Prometheus, Datadog, etc.)
//      by wrapping the emitted snapshots in a custom telemetry handler.
//
// Metric categories:
//   - Decision latency   (p50, p95, p99, max) per domain
//   - Authority mode transitions (heatmap: from × to × domain × hour)
//   - Approval rate (approved vs rejected per domain per day)
//   - AI suggestion acceptance rate
//   - Precondition waiver rate
//   - Marketplace adoption (item imports over time)
// ─────────────────────────────────────────────────────────────────────────────

import { telemetry } from './emitter';
import type { TelemetryEvent } from './types';

// ── Time-series bucket helpers ────────────────────────────────────────────────

function hourBucket(ts: string = new Date().toISOString()): string {
  return ts.slice(0, 13); // "YYYY-MM-DDTHH"
}

function dayBucket(ts: string = new Date().toISOString()): string {
  return ts.slice(0, 10); // "YYYY-MM-DD"
}

// ── Metric Types ──────────────────────────────────────────────────────────────

export interface LatencyStats {
  count: number;
  sum: number;
  min: number;
  max: number;
  p50: number;
  p95: number;
  p99: number;
  /** Raw samples (capped at 1000 most recent) */
  samples: number[];
}

export interface AuthorityTransition {
  from: string;
  to: string;
  domain: string;
  hour: string;
  count: number;
}

export interface ApprovalStats {
  domain: string;
  day: string;
  approved: number;
  rejected: number;
  approvalRate: number;
}

export interface AIStats {
  provider: string;
  suggestions: number;
  totalSuggested: number;
  totalAccepted: number;
  acceptanceRate: number;
  avgLatencyMs: number;
  justificationsGenerated: number;
}

export interface GovernanceSnapshot {
  capturedAt: string;
  /** Decision latency by domain */
  latencyByDomain: Record<string, LatencyStats>;
  /** Overall latency (all domains combined) */
  latencyOverall: LatencyStats;
  /** Authority transition counts [from][to][domain][hour] */
  authorityTransitions: AuthorityTransition[];
  /** Approval / rejection statistics by domain and day */
  approvalStats: ApprovalStats[];
  /** AI assistance statistics by provider */
  aiStats: AIStats[];
  /** Precondition waiver count by domain */
  waiversByDomain: Record<string, number>;
  /** Marketplace imports by item type */
  marketplaceImports: Record<string, number>;
  /** Total events processed */
  totalEvents: number;
  /** Uptime since metrics start (ms) */
  uptimeMs: number;
}

// ── Percentile helper ─────────────────────────────────────────────────────────

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(idx, sorted.length - 1))];
}

function buildLatencyStats(samples: number[]): LatencyStats {
  if (samples.length === 0) {
    return { count: 0, sum: 0, min: 0, max: 0, p50: 0, p95: 0, p99: 0, samples: [] };
  }
  const sorted = [...samples].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, v) => acc + v, 0);
  return {
    count: sorted.length,
    sum,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
    samples: sorted.slice(-200), // keep last 200 for sparkline
  };
}

// ── GovernanceMetrics ─────────────────────────────────────────────────────────

export class GovernanceMetrics {
  private _startedAt = Date.now();
  private _totalEvents = 0;
  private _unsub: (() => void) | null = null;

  // Raw collectors
  private _latencySamples = new Map<string, number[]>(); // domain → ms[]
  private _allLatencySamples: number[] = [];

  // authority_mode_changed: [fromMode][toMode][domain][hour] → count
  private _transitionMap = new Map<string, number>();

  // approved/rejected: [domain][day] → { approved, rejected }
  private _approvalMap = new Map<string, { approved: number; rejected: number }>();

  // AI: [provider] → stats
  private _aiMap = new Map<string, { suggestions: number; totalSugg: number; totalAcc: number; latencySum: number; justs: number }>();

  // Precondition waivers: domain → count
  private _waivers = new Map<string, number>();

  // Marketplace imports: type → count
  private _imports = new Map<string, number>();

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  /** Start collecting — subscribes to the global telemetry bus. */
  start(): this {
    if (this._unsub) return this;
    this._unsub = telemetry.subscribe((event: TelemetryEvent) => {
      this._totalEvents++;
      this._handleEvent(event);
    });
    return this;
  }

  /** Stop collecting. */
  stop(): void {
    this._unsub?.();
    this._unsub = null;
  }

  /** Reset all collected data. */
  reset(): void {
    this._latencySamples.clear();
    this._allLatencySamples = [];
    this._transitionMap.clear();
    this._approvalMap.clear();
    this._aiMap.clear();
    this._waivers.clear();
    this._imports.clear();
    this._totalEvents = 0;
    this._startedAt = Date.now();
  }

  // ── Event handler ─────────────────────────────────────────────────────────

  private _handleEvent(event: TelemetryEvent): void {
    switch (event.type) {
      case 'governance:authority_changed': {
        const key = `${event.fromMode}→${event.toMode}|${event.domain ?? 'unknown'}|${hourBucket(event.timestamp)}`;
        this._transitionMap.set(key, (this._transitionMap.get(key) ?? 0) + 1);
        break;
      }

      case 'governance:action_approved': {
        const domain = event.domain ?? 'unknown';
        const day = dayBucket(event.timestamp);
        const mapKey = `${domain}|${day}`;
        const existing = this._approvalMap.get(mapKey) ?? { approved: 0, rejected: 0 };
        this._approvalMap.set(mapKey, { ...existing, approved: existing.approved + 1 });

        // Record deliberation latency
        const samples = this._latencySamples.get(domain) ?? [];
        samples.push(event.deliberationMs);
        if (samples.length > 1000) samples.shift();
        this._latencySamples.set(domain, samples);
        this._allLatencySamples.push(event.deliberationMs);
        if (this._allLatencySamples.length > 5000) this._allLatencySamples.shift();
        break;
      }

      case 'governance:action_rejected': {
        const domain = event.domain ?? 'unknown';
        const day = dayBucket(event.timestamp);
        const mapKey = `${domain}|${day}`;
        const existing = this._approvalMap.get(mapKey) ?? { approved: 0, rejected: 0 };
        this._approvalMap.set(mapKey, { ...existing, rejected: existing.rejected + 1 });

        // Record rejection deliberation latency too
        const samples = this._latencySamples.get(domain) ?? [];
        samples.push(event.deliberationMs);
        if (samples.length > 1000) samples.shift();
        this._latencySamples.set(domain, samples);
        this._allLatencySamples.push(event.deliberationMs);
        if (this._allLatencySamples.length > 5000) this._allLatencySamples.shift();
        break;
      }

      case 'governance:precondition_waived': {
        // Extract domain from context if available; fall back to 'unknown'
        const domain = 'unknown';
        this._waivers.set(domain, (this._waivers.get(domain) ?? 0) + 1);
        break;
      }

      case 'governance:marketplace_imported': {
        this._imports.set(event.itemType, (this._imports.get(event.itemType) ?? 0) + 1);
        break;
      }

      case 'governance:ai_suggestion': {
        const rec = this._aiMap.get(event.provider) ?? {
          suggestions: 0, totalSugg: 0, totalAcc: 0, latencySum: 0, justs: 0,
        };
        this._aiMap.set(event.provider, {
          ...rec,
          suggestions: rec.suggestions + 1,
          totalSugg: rec.totalSugg + event.suggestedCount,
          totalAcc: rec.totalAcc + event.acceptedCount,
          latencySum: rec.latencySum + event.latencyMs,
        });
        break;
      }

      case 'governance:ai_justification': {
        const rec = this._aiMap.get(event.provider) ?? {
          suggestions: 0, totalSugg: 0, totalAcc: 0, latencySum: 0, justs: 0,
        };
        this._aiMap.set(event.provider, { ...rec, justs: rec.justs + 1 });
        break;
      }
    }
  }

  // ── Snapshot ──────────────────────────────────────────────────────────────

  /** Compute and return a full metrics snapshot. */
  snapshot(): GovernanceSnapshot {
    // Latency by domain
    const latencyByDomain: Record<string, LatencyStats> = {};
    for (const [domain, samples] of this._latencySamples) {
      latencyByDomain[domain] = buildLatencyStats(samples);
    }

    // Authority transitions
    const authorityTransitions: AuthorityTransition[] = [];
    for (const [key, count] of this._transitionMap) {
      const [modePart, domain, hour] = key.split('|');
      const [from, to] = modePart.split('→');
      authorityTransitions.push({ from, to, domain, hour, count });
    }

    // Approval stats
    const approvalStats: ApprovalStats[] = [];
    for (const [key, { approved, rejected }] of this._approvalMap) {
      const [domain, day] = key.split('|');
      const total = approved + rejected;
      approvalStats.push({
        domain,
        day,
        approved,
        rejected,
        approvalRate: total > 0 ? approved / total : 0,
      });
    }

    // AI stats
    const aiStats: AIStats[] = [];
    for (const [provider, rec] of this._aiMap) {
      aiStats.push({
        provider,
        suggestions: rec.suggestions,
        totalSuggested: rec.totalSugg,
        totalAccepted: rec.totalAcc,
        acceptanceRate: rec.totalSugg > 0 ? rec.totalAcc / rec.totalSugg : 0,
        avgLatencyMs: rec.suggestions > 0 ? rec.latencySum / rec.suggestions : 0,
        justificationsGenerated: rec.justs,
      });
    }

    // Waivers
    const waiversByDomain: Record<string, number> = {};
    for (const [domain, count] of this._waivers) {
      waiversByDomain[domain] = count;
    }

    // Imports
    const marketplaceImports: Record<string, number> = {};
    for (const [type, count] of this._imports) {
      marketplaceImports[type] = count;
    }

    return {
      capturedAt: new Date().toISOString(),
      latencyByDomain,
      latencyOverall: buildLatencyStats(this._allLatencySamples),
      authorityTransitions,
      approvalStats,
      aiStats,
      waiversByDomain,
      marketplaceImports,
      totalEvents: this._totalEvents,
      uptimeMs: Date.now() - this._startedAt,
    };
  }

  // ── Grafana-compatible export ──────────────────────────────────────────────

  /**
   * Returns a Grafana SimpleJSON / JSON API compatible data structure.
   *
   * Compatible with the `grafana-simple-json-datasource` plugin and
   * the newer `marcusolsson-json-datasource` plugin when served from
   * an HTTP endpoint.
   *
   * Usage:
   *   GET /api/governance/metrics  →  JSON.stringify(metrics.toGrafanaPayload())
   */
  toGrafanaPayload(): object {
    const snap = this.snapshot();

    const series = [
      // Decision latency p50/p95/p99 per domain
      ...Object.entries(snap.latencyByDomain).flatMap(([domain, stats]) => [
        {
          target: `decision_latency_p50_ms{domain="${domain}"}`,
          datapoints: [[stats.p50, Date.now()]],
        },
        {
          target: `decision_latency_p95_ms{domain="${domain}"}`,
          datapoints: [[stats.p95, Date.now()]],
        },
        {
          target: `decision_latency_p99_ms{domain="${domain}"}`,
          datapoints: [[stats.p99, Date.now()]],
        },
      ]),
      // Approval rate per domain
      ...snap.approvalStats.map((s) => ({
        target: `approval_rate{domain="${s.domain}",day="${s.day}"}`,
        datapoints: [[s.approvalRate, Date.now()]],
      })),
      // AI acceptance rate per provider
      ...snap.aiStats.map((s) => ({
        target: `ai_suggestion_acceptance_rate{provider="${s.provider}"}`,
        datapoints: [[s.acceptanceRate, Date.now()]],
      })),
      // Waivers
      ...Object.entries(snap.waiversByDomain).map(([domain, count]) => ({
        target: `precondition_waivers_total{domain="${domain}"}`,
        datapoints: [[count, Date.now()]],
      })),
      // Marketplace imports
      ...Object.entries(snap.marketplaceImports).map(([type, count]) => ({
        target: `marketplace_imports_total{type="${type}"}`,
        datapoints: [[count, Date.now()]],
      })),
    ];

    return { series, meta: { capturedAt: snap.capturedAt, uptimeMs: snap.uptimeMs } };
  }

  /**
   * Prometheus text-format exposition.
   * Can be served at GET /metrics from governance-server.ts.
   */
  toPrometheusText(): string {
    const snap = this.snapshot();
    const lines: string[] = [
      '# HELP hari_governance_decision_latency_ms Human decision deliberation time',
      '# TYPE hari_governance_decision_latency_ms gauge',
    ];

    for (const [domain, stats] of Object.entries(snap.latencyByDomain)) {
      for (const [quantile, value] of [['0.5', stats.p50], ['0.95', stats.p95], ['0.99', stats.p99]] as [string, number][]) {
        lines.push(`hari_governance_decision_latency_ms{domain="${domain}",quantile="${quantile}"} ${value}`);
      }
    }

    lines.push('');
    lines.push('# HELP hari_governance_approval_rate Fraction of governed actions approved (0-1)');
    lines.push('# TYPE hari_governance_approval_rate gauge');
    for (const s of snap.approvalStats) {
      lines.push(`hari_governance_approval_rate{domain="${s.domain}",day="${s.day}"} ${s.approvalRate.toFixed(4)}`);
    }

    lines.push('');
    lines.push('# HELP hari_governance_authority_transitions_total Authority mode transition count');
    lines.push('# TYPE hari_governance_authority_transitions_total counter');
    for (const t of snap.authorityTransitions) {
      lines.push(`hari_governance_authority_transitions_total{from="${t.from}",to="${t.to}",domain="${t.domain}"} ${t.count}`);
    }

    lines.push('');
    lines.push('# HELP hari_governance_ai_suggestion_acceptance_rate AI suggestion acceptance fraction');
    lines.push('# TYPE hari_governance_ai_suggestion_acceptance_rate gauge');
    for (const s of snap.aiStats) {
      lines.push(`hari_governance_ai_suggestion_acceptance_rate{provider="${s.provider}"} ${s.acceptanceRate.toFixed(4)}`);
    }

    lines.push('');
    lines.push('# HELP hari_governance_precondition_waivers_total Total precondition waivers');
    lines.push('# TYPE hari_governance_precondition_waivers_total counter');
    for (const [domain, count] of Object.entries(snap.waiversByDomain)) {
      lines.push(`hari_governance_precondition_waivers_total{domain="${domain}"} ${count}`);
    }

    lines.push('');
    lines.push('# HELP hari_governance_marketplace_imports_total Marketplace item imports');
    lines.push('# TYPE hari_governance_marketplace_imports_total counter');
    for (const [type, count] of Object.entries(snap.marketplaceImports)) {
      lines.push(`hari_governance_marketplace_imports_total{type="${type}"} ${count}`);
    }

    return lines.join('\n') + '\n';
  }
}

/** Singleton governance metrics instance. */
export const governanceMetrics = new GovernanceMetrics();
