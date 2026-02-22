import React from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// SensorCard — density-aware IoT domain component
//
// Demonstrates adding a completely new domain to HARI by registering new
// components in the ComponentRegistry without touching the compiler or renderer.
//
// Executive: status chip + single value (wall-level glance)
// Operator:  last reading + trend + alert threshold
// Expert:    raw telemetry, firmware version, sampling rate
// ─────────────────────────────────────────────────────────────────────────────

export interface SensorReading {
  id: string;
  name: string;
  location: string;
  type: 'temperature' | 'humidity' | 'pressure' | 'co2' | 'motion' | 'power';
  value: number;
  unit: string;
  status: 'ok' | 'warning' | 'critical' | 'offline';
  threshold?: { warn: number; critical: number };
  trend?: 'rising' | 'falling' | 'stable';
  lastSeen: string; // ISO
  battery?: number; // 0-100
  // Expert-only fields
  firmwareVersion?: string;
  samplingRateHz?: number;
  rawPayload?: Record<string, unknown>;
}

const STATUS = {
  ok:       { bg: '#f0fdf4', text: '#15803d', border: '#86efac', dot: '#22c55e' },
  warning:  { bg: '#fefce8', text: '#a16207', border: '#fde68a', dot: '#eab308' },
  critical: { bg: '#fef2f2', text: '#dc2626', border: '#fecaca', dot: '#ef4444' },
  offline:  { bg: '#f8fafc', text: '#64748b', border: '#e2e8f0', dot: '#94a3b8' },
};

const TYPE_ICON: Record<SensorReading['type'], string> = {
  temperature: '🌡',
  humidity:    '💧',
  pressure:    '🌬',
  co2:         '🫁',
  motion:      '🏃',
  power:       '⚡',
};

const TREND_ICON: Record<string, string> = { rising: '↑', falling: '↓', stable: '→' };

interface Props {
  sensor: SensorReading;
  density?: 'executive' | 'operator' | 'expert';
  onExplain?: (id: string) => void;
}

export function SensorCard({ sensor, density = 'operator', onExplain }: Props) {
  const s = STATUS[sensor.status];
  const isCompact = density === 'executive';

  return (
    <div
      style={{
        backgroundColor: s.bg,
        border: `1px solid ${s.border}`,
        borderRadius: '0.75rem',
        padding: isCompact ? '0.625rem 0.875rem' : '1rem 1.125rem',
        position: 'relative',
      }}
    >
      {/* Why button */}
      {onExplain && (
        <button
          onClick={() => onExplain(sensor.id)}
          style={{
            position: 'absolute', top: '0.5rem', right: '0.5rem',
            padding: '0.1rem 0.375rem',
            borderRadius: '0.25rem',
            border: `1px solid ${s.border}`,
            backgroundColor: 'rgba(255,255,255,0.7)',
            color: s.text,
            fontSize: '0.6rem', fontWeight: 700, cursor: 'pointer',
          }}
        >
          Why?
        </button>
      )}

      {/* Status dot + name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: isCompact ? '0.25rem' : '0.375rem' }}>
        <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: s.dot, display: 'inline-block', flexShrink: 0 }} />
        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {TYPE_ICON[sensor.type]} {sensor.name}
        </span>
      </div>

      {/* Value */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.25rem' }}>
        <span style={{ fontSize: isCompact ? '1.375rem' : '1.875rem', fontWeight: 700, color: s.text, lineHeight: 1 }}>
          {sensor.status === 'offline' ? '—' : sensor.value}
        </span>
        <span style={{ fontSize: '0.8rem', color: '#64748b' }}>{sensor.unit}</span>
        {sensor.trend && !isCompact && (
          <span style={{ fontSize: '0.875rem', color: sensor.trend === 'rising' ? '#dc2626' : sensor.trend === 'falling' ? '#16a34a' : '#94a3b8', marginLeft: '0.25rem', fontWeight: 600 }}>
            {TREND_ICON[sensor.trend]}
          </span>
        )}
      </div>

      {/* Operator: threshold bar + location + battery */}
      {!isCompact && (
        <div style={{ marginTop: '0.5rem' }}>
          {sensor.threshold && (
            <ThresholdBar value={sensor.value} threshold={sensor.threshold} status={sensor.status} />
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.375rem', fontSize: '0.7rem', color: '#94a3b8' }}>
            <span>📍 {sensor.location}</span>
            <span>{timeAgo(sensor.lastSeen)}</span>
            {sensor.battery != null && (
              <span>{sensor.battery > 20 ? '🔋' : '🪫'} {sensor.battery}%</span>
            )}
          </div>
        </div>
      )}

      {/* Expert: firmware + sampling rate + raw payload */}
      {density === 'expert' && (
        <div
          style={{
            marginTop: '0.625rem',
            paddingTop: '0.5rem',
            borderTop: `1px dashed ${s.border}`,
            fontSize: '0.7rem',
            color: '#94a3b8',
            fontFamily: 'monospace',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.75rem',
          }}
        >
          {sensor.firmwareVersion && <span>fw {sensor.firmwareVersion}</span>}
          {sensor.samplingRateHz && <span>{sensor.samplingRateHz} Hz</span>}
          {sensor.rawPayload && (
            <details style={{ width: '100%' }}>
              <summary style={{ cursor: 'pointer', color: '#64748b' }}>raw payload</summary>
              <pre style={{ margin: '0.25rem 0 0', whiteSpace: 'pre-wrap', fontSize: '0.65rem' }}>
                {JSON.stringify(sensor.rawPayload, null, 2)}
              </pre>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ThresholdBar({ value, threshold, status }: { value: number; threshold: { warn: number; critical: number }; status: string }) {
  const max = threshold.critical * 1.2;
  const pct = Math.min(100, (value / max) * 100);
  const barColor = status === 'critical' ? '#ef4444' : status === 'warning' ? '#eab308' : '#22c55e';

  return (
    <div style={{ position: 'relative', height: '6px', backgroundColor: '#e2e8f0', borderRadius: '3px', overflow: 'visible' }}>
      <div style={{ position: 'absolute', left: 0, top: 0, width: `${pct}%`, height: '100%', backgroundColor: barColor, borderRadius: '3px', transition: 'width 0.3s' }} />
      {/* Warn marker */}
      <div style={{ position: 'absolute', left: `${(threshold.warn / max) * 100}%`, top: '-2px', width: '2px', height: '10px', backgroundColor: '#eab308' }} />
      {/* Critical marker */}
      <div style={{ position: 'absolute', left: `${(threshold.critical / max) * 100}%`, top: '-2px', width: '2px', height: '10px', backgroundColor: '#ef4444' }} />
    </div>
  );
}

function timeAgo(iso: string): string {
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  return `${Math.floor(sec / 3600)}h ago`;
}
