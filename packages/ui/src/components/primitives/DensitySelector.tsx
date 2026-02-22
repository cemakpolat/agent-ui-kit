import React from 'react';
import type { DensityMode } from '@hari/core';
import { useUIStore } from '@hari/core';

// ─────────────────────────────────────────────────────────────────────────────
// DensitySelector
//
// Lets the user override the agent's recommended density at any time.
// User preference is the highest authority in the density hierarchy.
// ─────────────────────────────────────────────────────────────────────────────

const MODES: { value: DensityMode; label: string; description: string }[] = [
  { value: 'executive', label: 'Executive', description: 'Summaries, KPIs, minimal actions' },
  { value: 'operator',  label: 'Operator',  description: 'Tables, filters, workflows' },
  { value: 'expert',    label: 'Expert',    description: 'Raw data, diagnostics, assumptions' },
];

interface Props {
  agentRecommended?: DensityMode;
}

export function DensitySelector({ agentRecommended }: Props) {
  const { densityOverride, setDensityOverride } = useUIStore();

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>
        View:
      </span>
      {MODES.map((mode) => {
        const active = densityOverride === mode.value;
        const isAgentRec = !densityOverride && agentRecommended === mode.value;
        return (
          <button
            key={mode.value}
            title={mode.description}
            onClick={() =>
              setDensityOverride(densityOverride === mode.value ? null : mode.value)
            }
            style={{
              padding: '0.25rem 0.625rem',
              borderRadius: '0.375rem',
              border: `1.5px solid ${active ? '#4f46e5' : isAgentRec ? '#a5b4fc' : '#e2e8f0'}`,
              backgroundColor: active ? '#4f46e5' : isAgentRec ? '#eef2ff' : 'white',
              color: active ? 'white' : isAgentRec ? '#4338ca' : '#64748b',
              fontSize: '0.8rem',
              fontWeight: active || isAgentRec ? 600 : 400,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {mode.label}
            {isAgentRec && !active && (
              <span style={{ fontSize: '0.6rem', marginLeft: '0.25rem', opacity: 0.8 }}>
                ★
              </span>
            )}
          </button>
        );
      })}
      {densityOverride && (
        <button
          onClick={() => setDensityOverride(null)}
          title="Reset to agent recommendation"
          style={{
            background: 'none',
            border: 'none',
            color: '#94a3b8',
            cursor: 'pointer',
            fontSize: '0.75rem',
          }}
        >
          reset
        </button>
      )}
    </div>
  );
}
