import React from 'react';
import type { ActionSafety } from '@hari/core';

// ─────────────────────────────────────────────────────────────────────────────
// BlastRadiusBadge
//
// Visualises the risk level and downstream impact of an agent action.
// Renders in two modes:
//   compact  — a small coloured chip, expands to full view on click
//   expanded — full dependency summary with scope, systems, and effects
//
// Rule: no irreversible action should be visually indistinguishable from a safe one.
// ─────────────────────────────────────────────────────────────────────────────

const RISK = {
  low:      { bg: '#f0fdf4', text: '#166534', border: '#86efac', icon: '✓' },
  medium:   { bg: '#fefce8', text: '#854d0e', border: '#fde047', icon: '⚠' },
  high:     { bg: '#fee2e2', text: '#991b1b', border: '#fca5a5', icon: '⚠' },
  critical: { bg: '#fdf2f8', text: '#831843', border: '#f0abfc', icon: '⛔' },
};

const SCOPE_LABEL: Record<string, string> = {
  self:   'Self only',
  team:   'Your team',
  org:    'Entire organisation',
  global: 'Global / external',
};

interface Props {
  safety: ActionSafety;
  compact?: boolean;
}

export function BlastRadiusBadge({ safety, compact = false }: Props) {
  const [expanded, setExpanded] = React.useState(!compact);
  const c = RISK[safety.riskLevel];

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        title="Show impact details"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.25rem',
          backgroundColor: c.bg,
          color: c.text,
          border: `1px solid ${c.border}`,
          borderRadius: '0.375rem',
          padding: '0.125rem 0.5rem',
          fontSize: '0.7rem',
          fontWeight: 700,
          cursor: 'pointer',
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
        }}
      >
        {c.icon} {safety.riskLevel}
      </button>
    );
  }

  return (
    <div
      style={{
        backgroundColor: c.bg,
        border: `1px solid ${c.border}`,
        borderRadius: '0.5rem',
        padding: '0.875rem 1rem',
        fontSize: '0.875rem',
        lineHeight: '1.5',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '0.5rem',
        }}
      >
        <span style={{ fontWeight: 700, color: c.text, fontSize: '0.875rem' }}>
          {c.icon}&nbsp;{safety.riskLevel.toUpperCase()} RISK
        </span>
        {compact && (
          <button
            onClick={() => setExpanded(false)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: c.text,
              fontSize: '1rem',
              lineHeight: 1,
            }}
          >
            ×
          </button>
        )}
      </div>

      {/* Irreversible warning */}
      {!safety.reversible && (
        <div style={{ color: c.text, fontWeight: 600, marginBottom: '0.25rem' }}>
          ⛔ Irreversible — cannot be undone
        </div>
      )}

      {/* Cost */}
      {safety.cost != null && (
        <div style={{ color: c.text, marginBottom: '0.25rem' }}>
          💰 Estimated cost: {safety.currency ?? '$'}
          {safety.cost.toLocaleString()}
        </div>
      )}

      {/* Blast radius */}
      {safety.blastRadius && (
        <div style={{ marginTop: '0.375rem' }}>
          <span style={{ color: c.text, fontWeight: 600 }}>
            📡 Scope:&nbsp;
          </span>
          <span style={{ color: c.text }}>
            {SCOPE_LABEL[safety.blastRadius.scope] ?? safety.blastRadius.scope}
          </span>

          {safety.blastRadius.affectedSystems.length > 0 && (
            <div style={{ marginTop: '0.25rem' }}>
              <span style={{ color: c.text, fontWeight: 600 }}>Affects:&nbsp;</span>
              {safety.blastRadius.affectedSystems.map((sys) => (
                <span
                  key={sys}
                  style={{
                    display: 'inline-block',
                    margin: '0 0.25rem 0.25rem 0',
                    padding: '0.1rem 0.375rem',
                    backgroundColor: 'rgba(0,0,0,0.08)',
                    borderRadius: '0.25rem',
                    fontSize: '0.75rem',
                    color: c.text,
                    fontFamily: 'monospace',
                  }}
                >
                  {sys}
                </span>
              ))}
            </div>
          )}

          {safety.blastRadius.downstreamEffects && (
            <div style={{ marginTop: '0.25rem', color: c.text, fontStyle: 'italic' }}>
              "{safety.blastRadius.downstreamEffects}"
            </div>
          )}

          {safety.blastRadius.estimatedImpact && (
            <div style={{ marginTop: '0.25rem', color: c.text }}>
              ⏱ {safety.blastRadius.estimatedImpact}
            </div>
          )}
        </div>
      )}

      {/* Agent explanation */}
      {safety.explanation && (
        <div
          style={{
            marginTop: '0.5rem',
            paddingTop: '0.5rem',
            borderTop: `1px solid ${c.border}`,
            color: c.text,
          }}
        >
          {safety.explanation}
        </div>
      )}
    </div>
  );
}
