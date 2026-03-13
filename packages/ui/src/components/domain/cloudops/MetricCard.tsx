import React from 'react';
import { TrendingUp, TrendingDown, Minus, type LucideIcon } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// MetricCard — density-aware CloudOps domain component
//
// Renders a single operational metric with status colouring, trend indicator,
// and optional mini sparkline (represented as SVG bar chart for simplicity).
//
// Executive: value + status chip (high signal, minimal chrome)
// Operator:  + trend arrow + sparkline
// Expert:    + raw timestamp + percentile rank
// ─────────────────────────────────────────────────────────────────────────────

export interface MetricData {
  id: string;
  label: string;
  value: number | string;
  unit?: string;
  trend?: 'up' | 'down' | 'stable';
  /** Status drives colour palette */
  status?: 'normal' | 'warning' | 'critical';
  /** Last 8 data points for sparkline */
  sparkline?: number[];
  /** ISO timestamp of most recent reading */
  sampledAt?: string;
  /** 0–100 percentile ranking vs. baseline */
  percentileRank?: number;
}

const STATUS: Record<string, { bg: string; text: string; border: string; chip: string }> = {
  normal:   { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0', chip: '#dcfce7' },
  ok:       { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0', chip: '#dcfce7' }, // LLM alias
  warning:  { bg: '#fefce8', text: '#a16207', border: '#fde68a', chip: '#fef9c3' },
  critical: { bg: '#fef2f2', text: '#dc2626', border: '#fecaca', chip: '#fee2e2' },
  error:    { bg: '#fef2f2', text: '#dc2626', border: '#fecaca', chip: '#fee2e2' }, // LLM alias
};

const TREND_LABEL: Record<string, { Icon: LucideIcon; color: string }> = {
  up:      { Icon: TrendingUp,   color: '#dc2626' },
  down:    { Icon: TrendingDown, color: '#16a34a' },
  stable:  { Icon: Minus,        color: '#64748b' },
  // LLM aliases
  flat:    { Icon: Minus,        color: '#64748b' },
  neutral: { Icon: Minus,        color: '#64748b' },
};

interface Props {
  metric: MetricData;
  density?: 'executive' | 'operator' | 'expert';
  onExplain?: (id: string) => void;
}

export function MetricCard({ metric, density = 'operator', onExplain }: Props) {
  const s = STATUS[metric.status ?? 'normal'] ?? STATUS['normal'];
  const isCompact = density === 'executive';

  return (
    <div
      style={{
        backgroundColor: s.bg,
        border: `1px solid ${s.border}`,
        borderRadius: '0.75rem',
        padding: isCompact ? '0.75rem 1rem' : '1rem 1.25rem',
        position: 'relative',
      }}
    >
      {/* Why button */}
      {onExplain && (
        <button
          onClick={() => onExplain(metric.id)}
          style={{
            position: 'absolute',
            top: '0.5rem',
            right: '0.5rem',
            padding: '0.1rem 0.4rem',
            borderRadius: '0.25rem',
            border: `1px solid ${s.border}`,
            backgroundColor: s.chip,
            color: s.text,
            fontSize: '0.65rem',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Why?
        </button>
      )}

      {/* Label */}
      <div
        style={{
          fontSize: '0.7rem',
          fontWeight: 700,
          color: '#64748b',
          textTransform: 'uppercase',
          letterSpacing: '0.07em',
          marginBottom: '0.25rem',
        }}
      >
        {metric.label}
      </div>

      {/* Value */}
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: '0.25rem',
        }}
      >
        <span
          style={{
            fontSize: isCompact ? '1.5rem' : '2rem',
            fontWeight: 700,
            color: s.text,
            lineHeight: 1,
          }}
        >
          {metric.value}
        </span>
        {metric.unit && (
          <span style={{ fontSize: '0.875rem', color: '#64748b' }}>{metric.unit}</span>
        )}
      </div>

      {/* Trend (operator + expert) */}
      {metric.trend && !isCompact && TREND_LABEL[metric.trend] && (
        <div
          style={{
            fontSize: '0.8rem',
            color: TREND_LABEL[metric.trend]!.color,
            marginTop: '0.25rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem',
          }}
        >
          {React.createElement(TREND_LABEL[metric.trend]!.Icon, { size: 14 })} {metric.trend}
        </div>
      )}

      {/* Sparkline (operator + expert) */}
      {metric.sparkline && !isCompact && (
        <Sparkline data={metric.sparkline} color={s.text} />
      )}

      {/* Expert-only metadata */}
      {density === 'expert' && (
        <div
          style={{
            marginTop: '0.5rem',
            paddingTop: '0.375rem',
            borderTop: `1px dashed ${s.border}`,
            fontSize: '0.7rem',
            color: '#94a3b8',
            display: 'flex',
            gap: '1rem',
            fontFamily: 'monospace',
          }}
        >
          {metric.sampledAt && (
            <span>sampled {new Date(metric.sampledAt).toLocaleTimeString()}</span>
          )}
          {metric.percentileRank != null && (
            <span>p{metric.percentileRank} baseline</span>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Sparkline ────────────────────────────────────────────────────────────────

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data, 1);
  const W = 80;
  const H = 28;
  const barW = Math.floor((W - (data.length - 1) * 2) / data.length);

  return (
    <svg
      width={W}
      height={H}
      style={{ marginTop: '0.5rem', display: 'block', opacity: 0.7 }}
    >
      {data.map((v, i) => {
        const barH = Math.max(2, (v / max) * H);
        return (
          <rect
            key={i}
            x={i * (barW + 2)}
            y={H - barH}
            width={barW}
            height={barH}
            rx={1}
            fill={color}
          />
        );
      })}
    </svg>
  );
}
