/**
 * GovernanceDashboard — Phase 8.3 Observability
 *
 * Real-time dashboard visualising governance metrics collected by the
 * GovernanceMetrics aggregator (packages/core/src/telemetry/governance-metrics.ts).
 *
 * Panels:
 *   - Summary cards   : total decisions, approval rate, avg latency, waivers
 *   - Latency table   : p50/p95/p99 per domain
 *   - Authority matrix: from×to mode heatmap (colour-coded transition counts)
 *   - Approval chart  : approved vs rejected bar chart per domain
 *   - AI stats row    : AI suggestions accepted, justifications generated, latency
 *   - Marketplace row : imports by type
 *   - Export buttons  : Grafana JSON + Prometheus text
 *
 * Uses only SVG + inline CSS — no external chart library required.
 */

import React from 'react';
import { governanceMetrics, type GovernanceSnapshot } from '@hari/core';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface GovernanceDashboardProps {
  /** Polling interval in ms. Default: 5000. */
  refreshIntervalMs?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms.toFixed(0)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

function formatPct(ratio: number): string {
  return `${(ratio * 100).toFixed(1)}%`;
}

// Mini sparkline SVG — plots an array of numbers as a polyline
function Sparkline({ values, width = 120, height = 36, color = '#6366f1' }: {
  values: number[];
  width?: number;
  height?: number;
  color?: string;
}) {
  if (values.length < 2) {
    return (
      <svg width={width} height={height}>
        <text x={width / 2} y={height / 2 + 4} textAnchor="middle" fontSize={10} fill="#94a3b8">no data</text>
      </svg>
    );
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pad = 4;

  const pts = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (width - pad * 2);
    const y = pad + (1 - (v - min) / range) * (height - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  return (
    <svg width={width} height={height} style={{ overflow: 'visible' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
      <circle
        cx={parseFloat(pts.split(' ').at(-1)!.split(',')[0])}
        cy={parseFloat(pts.split(' ').at(-1)!.split(',')[1])}
        r={3}
        fill={color}
      />
    </svg>
  );
}

// 5-shade colour ramp for heatmap cells
function heatColor(value: number, max: number): string {
  if (max === 0) return '#f1f5f9';
  const ratio = value / max;
  if (ratio === 0) return '#f8fafc';
  if (ratio < 0.25) return '#dbeafe';
  if (ratio < 0.5) return '#93c5fd';
  if (ratio < 0.75) return '#3b82f6';
  return '#1d4ed8';
}

function textOnHeat(value: number, max: number): string {
  const ratio = max === 0 ? 0 : value / max;
  return ratio >= 0.5 ? '#ffffff' : '#1e293b';
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

// ── Summary card ───────────────────────────────────────────────────────────
function SummaryCard({ label, value, sub, color = '#6366f1' }: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
}) {
  return (
    <div style={{
      background: 'var(--hari-surface)',
      border: '1px solid var(--hari-border)',
      borderRadius: 12,
      padding: '1rem 1.25rem',
      minWidth: 140,
      flex: '1 1 140px',
    }}>
      <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--hari-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.4rem' }}>
        {label}
      </div>
      <div style={{ fontSize: '1.6rem', fontWeight: 800, color, lineHeight: 1 }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: '0.72rem', color: 'var(--hari-text-muted)', marginTop: '0.25rem' }}>
          {sub}
        </div>
      )}
    </div>
  );
}

// ── Section header ─────────────────────────────────────────────────────────
function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={{ marginBottom: '0.75rem' }}>
      <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--hari-text)' }}>{title}</div>
      {subtitle && <div style={{ fontSize: '0.7rem', color: 'var(--hari-text-muted)', marginTop: '0.1rem' }}>{subtitle}</div>}
    </div>
  );
}

// ── Latency table ──────────────────────────────────────────────────────────
function LatencyTable({ snapshot }: { snapshot: GovernanceSnapshot }) {
  const byDomain = Object.entries(snapshot.latencyByDomain);
  const overall = snapshot.latencyOverall;

  if (byDomain.length === 0 && overall.count === 0) {
    return (
      <div style={{ color: '#94a3b8', fontSize: '0.78rem', padding: '0.5rem 0' }}>
        No decision latency data yet. Approve or reject governed actions to populate this panel.
      </div>
    );
  }

  const allRows: Array<{ domain: string } & typeof overall> = [
    { domain: 'all domains', ...overall },
    ...byDomain.map(([domain, stats]) => ({ domain, ...stats })),
  ];

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
        <thead>
          <tr style={{ background: 'var(--hari-surface-alt)' }}>
            {['Domain', 'Count', 'p50', 'p95', 'p99', 'Max'].map((h) => (
              <th key={h} style={{ padding: '0.5rem 0.75rem', textAlign: 'left', fontWeight: 700, color: 'var(--hari-text-secondary)', borderBottom: '1px solid var(--hari-border)' }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {allRows.map((r, i) => (
            <tr key={r.domain} style={{ background: i === 0 ? '#f0fdf4' : i % 2 === 1 ? 'var(--hari-surface-alt)' : 'var(--hari-surface)' }}>
              <td style={{ padding: '0.4rem 0.75rem', fontWeight: i === 0 ? 700 : 400, color: 'var(--hari-text)' }}>{r.domain}</td>
              <td style={{ padding: '0.4rem 0.75rem', color: 'var(--hari-text-secondary)' }}>{r.count}</td>
              <td style={{ padding: '0.4rem 0.75rem', color: '#6366f1' }}>{r.count > 0 ? formatMs(r.p50) : '—'}</td>
              <td style={{ padding: '0.4rem 0.75rem', color: '#f59e0b' }}>{r.count > 0 ? formatMs(r.p95) : '—'}</td>
              <td style={{ padding: '0.4rem 0.75rem', color: '#ef4444' }}>{r.count > 0 ? formatMs(r.p99) : '—'}</td>
              <td style={{ padding: '0.4rem 0.75rem', color: '#64748b' }}>{r.count > 0 ? formatMs(r.max) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Authority transition heatmap ───────────────────────────────────────────
const MODES = ['observe', 'intervene', 'approve', 'override'] as const;

function AuthorityHeatmap({ snapshot }: { snapshot: GovernanceSnapshot }) {
  // Build a from×to matrix summing all transition counts
  const matrix: Record<string, Record<string, number>> = {};
  for (const t of snapshot.authorityTransitions) {
    if (!matrix[t.from]) matrix[t.from] = {};
    matrix[t.from][t.to] = (matrix[t.from][t.to] ?? 0) + t.count;
  }

  const maxVal = Math.max(
    ...snapshot.authorityTransitions.map((t) => t.count),
    1,
  );

  const hasData = snapshot.authorityTransitions.length > 0;

  return (
    <div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'separate', borderSpacing: 4 }}>
          <thead>
            <tr>
              <th style={{ fontSize: '0.65rem', color: '#64748b', padding: '0.2rem 0.5rem', textAlign: 'right' }}>from ↓ / to →</th>
              {MODES.map((m) => (
                <th key={m} style={{ fontSize: '0.65rem', color: '#64748b', padding: '0.25rem 0.5rem', textAlign: 'center', minWidth: 72 }}>
                  {m}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MODES.map((from) => (
              <tr key={from}>
                <td style={{ fontSize: '0.65rem', color: '#64748b', padding: '0.25rem 0.5rem', textAlign: 'right', fontWeight: 600 }}>
                  {from}
                </td>
                {MODES.map((to) => {
                  const count = matrix[from]?.[to] ?? 0;
                  const bg = from === to ? '#f1f5f9' : heatColor(count, maxVal);
                  const fg = from === to ? '#cbd5e1' : textOnHeat(count, maxVal);
                  return (
                    <td key={to} title={`${from} → ${to}: ${count}`} style={{
                      backgroundColor: bg,
                      color: fg,
                      fontSize: '0.75rem',
                      fontWeight: count > 0 ? 700 : 400,
                      padding: '0.4rem 0.5rem',
                      textAlign: 'center',
                      borderRadius: 6,
                      minWidth: 72,
                      cursor: from === to ? 'default' : 'help',
                    }}>
                      {from === to ? '—' : count > 0 ? count : '·'}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!hasData && (
        <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '0.5rem' }}>
          No authority transitions recorded yet. Change authority modes to populate this heatmap.
        </div>
      )}
    </div>
  );
}

// ── Approval bar chart (SVG) ───────────────────────────────────────────────
function ApprovalChart({ snapshot }: { snapshot: GovernanceSnapshot }) {
  const stats = snapshot.approvalStats;

  if (stats.length === 0) {
    return (
      <div style={{ color: '#94a3b8', fontSize: '0.78rem', padding: '0.5rem 0' }}>
        No approval/rejection data yet.
      </div>
    );
  }

  const maxTotal = Math.max(...stats.map((s) => s.approved + s.rejected), 1);
  const barWidth = 32;
  const gap = 20;
  const chartHeight = 100;
  const labelHeight = 40;
  const svgWidth = stats.length * (barWidth * 2 + gap) + gap;
  const svgHeight = chartHeight + labelHeight;

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg width={svgWidth} height={svgHeight} style={{ fontFamily: 'system-ui, sans-serif' }}>
        {stats.map((s, i) => {
          const x = gap + i * (barWidth * 2 + gap);
          const approvedH = (s.approved / maxTotal) * chartHeight;
          const rejectedH = (s.rejected / maxTotal) * chartHeight;
          const total = s.approved + s.rejected;
          const label = s.domain.length > 9 ? s.domain.slice(0, 8) + '…' : s.domain;

          return (
            <g key={`${s.domain}-${i}`}>
              {/* Approved bar */}
              <rect
                x={x} y={chartHeight - approvedH}
                width={barWidth} height={approvedH}
                fill="#22c55e" rx={3}
                aria-label={`Approved: ${s.approved}`}
              />
              {s.approved > 0 && (
                <text x={x + barWidth / 2} y={chartHeight - approvedH - 3} textAnchor="middle" fontSize={9} fill="#16a34a" fontWeight={700}>
                  {s.approved}
                </text>
              )}
              {/* Rejected bar */}
              <rect
                x={x + barWidth + 2} y={chartHeight - rejectedH}
                width={barWidth} height={rejectedH}
                fill="#ef4444" rx={3}
                aria-label={`Rejected: ${s.rejected}`}
              />
              {s.rejected > 0 && (
                <text x={x + barWidth + 2 + barWidth / 2} y={chartHeight - rejectedH - 3} textAnchor="middle" fontSize={9} fill="#dc2626" fontWeight={700}>
                  {s.rejected}
                </text>
              )}
              {/* Domain label */}
              <text x={x + barWidth + 1} y={chartHeight + 14} textAnchor="middle" fontSize={9} fill="#475569">
                {label}
              </text>
              {total > 0 && (
                <text x={x + barWidth + 1} y={chartHeight + 26} textAnchor="middle" fontSize={8} fill="#94a3b8">
                  {formatPct(s.approved / total)} ok
                </text>
              )}
            </g>
          );
        })}
        {/* Y-axis label */}
        <text x={2} y={chartHeight / 2} textAnchor="middle" fontSize={8} fill="#94a3b8" transform={`rotate(-90, 8, ${chartHeight / 2})`}>
          decisions
        </text>
        {/* Legend */}
        <g transform={`translate(${gap}, ${svgHeight - 10})`}>
          <rect x={0} y={0} width={10} height={8} fill="#22c55e" rx={2} />
          <text x={13} y={8} fontSize={8} fill="#475569">Approved</text>
          <rect x={65} y={0} width={10} height={8} fill="#ef4444" rx={2} />
          <text x={78} y={8} fontSize={8} fill="#475569">Rejected</text>
        </g>
      </svg>
    </div>
  );
}

// ── AI stats ───────────────────────────────────────────────────────────────
function AIStatsPanel({ snapshot }: { snapshot: GovernanceSnapshot }) {
  const stats = snapshot.aiStats;

  if (stats.length === 0) {
    return (
      <div style={{ color: '#94a3b8', fontSize: '0.78rem', padding: '0.5rem 0' }}>
        No AI governance data yet. Use the AI Governance panel to generate suggestions or justifications.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
      {stats.map((s) => (
        <div key={s.provider} style={{
          background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10,
          padding: '0.75rem 1rem', minWidth: 160,
        }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', marginBottom: '0.4rem', textTransform: 'uppercase' }}>
            {s.provider}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.3rem' }}>
            {[
              ['Suggestions', s.suggestions],
              ['Accepted', s.totalAccepted],
              ['Justifications', s.justificationsGenerated],
              ['Avg latency', s.avgLatencyMs > 0 ? formatMs(s.avgLatencyMs) : '—'],
            ].map(([label, val]) => (
              <div key={String(label)}>
                <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>{label}</div>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1e293b' }}>{val}</div>
              </div>
            ))}
          </div>
          {s.suggestions > 0 && (
            <div style={{ marginTop: '0.4rem' }}>
              <Sparkline
                values={[s.totalAccepted / Math.max(s.suggestions, 1)]}
                width={140}
                height={28}
                color="#6366f1"
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Marketplace imports ────────────────────────────────────────────────────
function MarketplaceStatsPanel({ snapshot }: { snapshot: GovernanceSnapshot }) {
  const imports = snapshot.marketplaceImports;
  const total = Object.values(imports).reduce((s, n) => s + n, 0);

  if (total === 0) {
    return (
      <div style={{ color: '#94a3b8', fontSize: '0.78rem', padding: '0.5rem 0' }}>
        No marketplace items imported yet. Use the Governance Marketplace panel to apply patterns.
      </div>
    );
  }

  const colorMap: Record<string, string> = {
    pattern: '#8b5cf6',
    template: '#06b6d4',
    hierarchy: '#f59e0b',
  };

  return (
    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
      {Object.entries(imports).map(([type, count]) => (
        <div key={type} style={{
          background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 10,
          padding: '0.6rem 1rem', minWidth: 110, textAlign: 'center',
        }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: colorMap[type] ?? '#6366f1' }}>{count}</div>
          <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'capitalize' }}>{type}s</div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Dashboard Component
// ─────────────────────────────────────────────────────────────────────────────

export function GovernanceDashboard({ refreshIntervalMs = 5000 }: GovernanceDashboardProps) {
  const [snapshot, setSnapshot] = React.useState<GovernanceSnapshot | null>(null);
  const [isRunning, setIsRunning] = React.useState(false);
  const [lastRefresh, setLastRefresh] = React.useState<Date | null>(null);
  const [exportNotice, setExportNotice] = React.useState<string | null>(null);

  // Polling refresh — also updates isRunning from actual aggregator state
  React.useEffect(() => {
    const take = () => {
      setSnapshot(governanceMetrics.snapshot());
      setLastRefresh(new Date());
      // Reflect actual running state (the private _unsub field)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setIsRunning((governanceMetrics as any)['_unsub'] !== null);
    };
    take(); // immediate first snapshot
    const id = setInterval(take, refreshIntervalMs);
    return () => clearInterval(id);
  }, [refreshIntervalMs]);

  // ── Derived summary stats ──────────────────────────────────────────────
  const totalDecisions = snapshot
    ? snapshot.approvalStats.reduce((s, r) => s + r.approved + r.rejected, 0)
    : 0;

  const totalApproved = snapshot
    ? snapshot.approvalStats.reduce((s, r) => s + r.approved, 0)
    : 0;

  const approvalRate = totalDecisions > 0 ? totalApproved / totalDecisions : null;

  const avgLatency = (snapshot?.latencyOverall.count ?? 0) > 0
    ? snapshot!.latencyOverall.p50
    : null;

  const totalWaivers = snapshot
    ? Object.values(snapshot.waiversByDomain).reduce((s, n) => s + n, 0)
    : 0;

  const totalTransitions = snapshot
    ? snapshot.authorityTransitions.reduce((s, t) => s + t.count, 0)
    : 0;

  // ── Export helpers ─────────────────────────────────────────────────────
  const handleExportGrafana = () => {
    const payload = governanceMetrics.toGrafanaPayload();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `governance-grafana-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setExportNotice('Grafana JSON exported ✓');
    setTimeout(() => setExportNotice(null), 3000);
  };

  const handleExportPrometheus = () => {
    const text = governanceMetrics.toPrometheusText();
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `governance-prometheus-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    setExportNotice('Prometheus metrics exported ✓');
    setTimeout(() => setExportNotice(null), 3000);
  };

  const handleReset = () => {
    governanceMetrics.reset();
    setSnapshot(governanceMetrics.snapshot());
    setExportNotice('Metrics reset ✓');
    setTimeout(() => setExportNotice(null), 2000);
  };

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div style={{
      fontFamily: 'system-ui, -apple-system, sans-serif',
      background: 'var(--hari-bg)',
      minHeight: '100%',
      padding: '1.5rem 2rem',
      boxSizing: 'border-box',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--hari-text)' }}>
            Governance Observatory
          </h2>
          <div style={{ fontSize: '0.72rem', color: 'var(--hari-text-secondary)', marginTop: '0.2rem' }}>
            Phase 8.3 · Real-time decision analytics&nbsp;
            {isRunning && <span style={{ color: '#22c55e', fontWeight: 700 }}>● live</span>}
            {lastRefresh && (
              <span style={{ color: '#94a3b8', marginLeft: '0.5rem' }}>
                · refreshed {lastRefresh.toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {exportNotice && (
            <span style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 600, padding: '0.35rem 0.75rem', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8 }}>
              {exportNotice}
            </span>
          )}
          <button
            onClick={handleExportGrafana}
            style={{
              padding: '0.375rem 0.75rem', borderRadius: 8, border: '1px solid var(--hari-border)',
              background: 'var(--hari-surface)', color: 'var(--hari-text-secondary)', fontSize: '0.75rem', fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Export Grafana JSON
          </button>
          <button
            onClick={handleExportPrometheus}
            style={{
              padding: '0.375rem 0.75rem', borderRadius: 8, border: '1px solid var(--hari-border)',
              background: 'var(--hari-surface)', color: 'var(--hari-text-secondary)', fontSize: '0.75rem', fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Export Prometheus
          </button>
          <button
            onClick={handleReset}
            style={{
              padding: '0.375rem 0.75rem', borderRadius: 8, border: '1px solid #fee2e2',
              background: '#fff5f5', color: '#ef4444', fontSize: '0.75rem', fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Reset Metrics
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        <SummaryCard
          label="Total Decisions"
          value={String(totalDecisions)}
          sub={`${snapshot?.totalEvents ?? 0} telemetry events`}
          color="#6366f1"
        />
        <SummaryCard
          label="Approval Rate"
          value={approvalRate !== null ? formatPct(approvalRate) : '—'}
          sub={`${totalApproved} approved / ${totalDecisions - totalApproved} rejected`}
          color={approvalRate !== null ? (approvalRate >= 0.7 ? '#22c55e' : '#f59e0b') : '#94a3b8'}
        />
        <SummaryCard
          label="Avg Latency (p50)"
          value={avgLatency !== null ? formatMs(avgLatency) : '—'}
          sub="time to decision"
          color="#f59e0b"
        />
        <SummaryCard
          label="Precondition Waivers"
          value={String(totalWaivers)}
          sub="waived across all domains"
          color="#ef4444"
        />
        <SummaryCard
          label="Auth Transitions"
          value={String(totalTransitions)}
          sub="mode changes recorded"
          color="#8b5cf6"
        />
        <SummaryCard
          label="Uptime"
          value={snapshot ? formatMs(snapshot.uptimeMs) : '—'}
          sub="metrics collection"
          color="#06b6d4"
        />
      </div>

      {/* Grid layout for panels */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))', gap: '1rem' }}>

        {/* Decision Latency */}
        <div style={{ background: 'var(--hari-surface)', border: '1px solid var(--hari-border)', borderRadius: 12, padding: '1.25rem' }}>
          <SectionHeader
            title="Decision Latency"
            subtitle="p50 / p95 / p99 per domain — time from action presentation to approval/rejection"
          />
          {snapshot ? <LatencyTable snapshot={snapshot} /> : <div style={{ color: '#94a3b8', fontSize: '0.78rem' }}>Loading…</div>}
        </div>

        {/* Authority Mode Heatmap */}
        <div style={{ background: 'var(--hari-surface)', border: '1px solid var(--hari-border)', borderRadius: 12, padding: '1.25rem' }}>
          <SectionHeader
            title="Authority Mode Transitions"
            subtitle="Heatmap of mode changes (from × to). Darker = more transitions."
          />
          {snapshot ? <AuthorityHeatmap snapshot={snapshot} /> : <div style={{ color: '#94a3b8', fontSize: '0.78rem' }}>Loading…</div>}
        </div>

        {/* Approval Chart */}
        <div style={{ background: 'var(--hari-surface)', border: '1px solid var(--hari-border)', borderRadius: 12, padding: '1.25rem' }}>
          <SectionHeader
            title="Approvals vs Rejections"
            subtitle="Decision outcomes grouped by governance domain"
          />
          {snapshot ? <ApprovalChart snapshot={snapshot} /> : <div style={{ color: '#94a3b8', fontSize: '0.78rem' }}>Loading…</div>}
        </div>

        {/* Waivers */}
        <div style={{ background: 'var(--hari-surface)', border: '1px solid var(--hari-border)', borderRadius: 12, padding: '1.25rem' }}>
          <SectionHeader
            title="Precondition Waivers by Domain"
            subtitle="Indicates where teams are bypassing required safeguards"
          />
          {snapshot && Object.keys(snapshot.waiversByDomain).length > 0 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {Object.entries(snapshot.waiversByDomain).map(([domain, count]) => (
                <div key={domain} style={{
                  background: count > 5 ? '#fef2f2' : '#f8fafc',
                  border: `1px solid ${count > 5 ? '#fca5a5' : '#e2e8f0'}`,
                  borderRadius: 8,
                  padding: '0.4rem 0.75rem',
                  fontSize: '0.78rem',
                }}>
                  <span style={{ fontWeight: 700, color: count > 5 ? '#ef4444' : '#1e293b' }}>{count}</span>
                  <span style={{ color: '#64748b', marginLeft: '0.35rem' }}>{domain}</span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: '#94a3b8', fontSize: '0.78rem', padding: '0.5rem 0' }}>
              No waivers recorded. Waivers appear when preconditions are bypassed via the governance UI.
            </div>
          )}
        </div>

        {/* AI Stats */}
        <div style={{ background: 'var(--hari-surface)', border: '1px solid var(--hari-border)', borderRadius: 12, padding: '1.25rem' }}>
          <SectionHeader
            title="AI Governance Assistance"
            subtitle="Suggestions accepted, justifications generated, provider latency"
          />
          {snapshot ? <AIStatsPanel snapshot={snapshot} /> : <div style={{ color: '#94a3b8', fontSize: '0.78rem' }}>Loading…</div>}
        </div>

        {/* Marketplace */}
        <div style={{ background: 'var(--hari-surface)', border: '1px solid var(--hari-border)', borderRadius: 12, padding: '1.25rem' }}>
          <SectionHeader
            title="Marketplace Adoption"
            subtitle="Governance patterns, templates and hierarchies imported this session"
          />
          {snapshot ? <MarketplaceStatsPanel snapshot={snapshot} /> : <div style={{ color: '#94a3b8', fontSize: '0.78rem' }}>Loading…</div>}
        </div>

      </div>

      {/* Prometheus preview */}
      <details style={{ marginTop: '1.5rem' }}>
        <summary style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--hari-text-secondary)', cursor: 'pointer', userSelect: 'none', padding: '0.5rem 0' }}>
          Prometheus metrics preview (click to expand)
        </summary>
        <pre style={{
          marginTop: '0.5rem',
          background: '#0f172a',
          color: '#e2e8f0',
          borderRadius: 8,
          padding: '1rem',
          fontSize: '0.7rem',
          overflowX: 'auto',
          lineHeight: 1.6,
          maxHeight: 320,
          overflowY: 'auto',
        }}>
          {snapshot ? governanceMetrics.toPrometheusText() : '# loading…'}
        </pre>
      </details>
    </div>
  );
}
