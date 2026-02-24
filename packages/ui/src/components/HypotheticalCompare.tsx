import React from 'react';
import { useIntentStore, compileIntent, ComponentRegistryManager } from '@hari/core';
import { IntentRenderer } from './IntentRenderer';

// ─────────────────────────────────────────────────────────────────────────────
// HypotheticalCompare
//
// Side-by-side comparison panel: renders the real (committed) intent view on
// the left and the isolated hypothetical branch on the right. Shows a diff
// summary of changed data keys. Provides Commit and Rollback controls.
//
// Architecture: reads from IntentStore only — no mutation of UIStore so the
// overlay flag stays independent from the branch lifecycle.
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  registry: ComponentRegistryManager;
  onCommit?: () => void;
  onRollback?: () => void;
}

export function HypotheticalCompare({ registry, onCommit, onRollback }: Props) {
  const {
    currentIntent,
    hypotheticalIntent,
    hypotheticalDiff,
    commitHypothetical,
    rollbackHypothetical,
  } = useIntentStore();

  const dismissRef = React.useRef<HTMLButtonElement>(null);
  const triggerRef = React.useRef<Element | null>(null);

  React.useEffect(() => {
    triggerRef.current = document.activeElement;
    dismissRef.current?.focus();
    return () => {
      (triggerRef.current as HTMLElement | null)?.focus?.();
    };
  }, []);

  if (!currentIntent || !hypotheticalIntent) return null;

  const compiledActual = compileIntent(currentIntent, registry, {});
  const compiledHypothetical = compileIntent(hypotheticalIntent, registry, {});

  const diffEntries = Object.entries(hypotheticalDiff);

  const handleCommit = () => {
    commitHypothetical();
    onCommit?.();
  };

  const handleRollback = () => {
    rollbackHypothetical();
    onRollback?.();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Hypothetical vs actual comparison"
      style={{
        border: '2px solid #a78bfa',
        borderRadius: '0.75rem',
        overflow: 'hidden',
        backgroundColor: '#faf5ff',
      }}
    >
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div
        style={{
          backgroundColor: '#7c3aed',
          color: 'white',
          padding: '0.75rem 1.25rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <span style={{ fontWeight: 800, fontSize: '0.8rem', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            ⎇ Hypothetical Branch
          </span>
          <span style={{ fontSize: '0.72rem', opacity: 0.8 }}>
            — no changes committed to actual state
          </span>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={handleCommit}
            style={{
              padding: '0.3rem 0.875rem',
              borderRadius: '0.375rem',
              border: 'none',
              backgroundColor: '#22c55e',
              color: 'white',
              fontWeight: 700,
              cursor: 'pointer',
              fontSize: '0.78rem',
            }}
            aria-label="Commit hypothetical state as current"
          >
            Commit
          </button>
          <button
            ref={dismissRef}
            onClick={handleRollback}
            style={{
              padding: '0.3rem 0.875rem',
              borderRadius: '0.375rem',
              border: 'none',
              backgroundColor: '#dc2626',
              color: 'white',
              fontWeight: 700,
              cursor: 'pointer',
              fontSize: '0.78rem',
            }}
            aria-label="Rollback hypothetical state"
          >
            Rollback
          </button>
        </div>
      </div>

      {/* ── Diff summary ────────────────────────────────────────────────── */}
      {diffEntries.length > 0 && (
        <div
          style={{
            padding: '0.625rem 1.25rem',
            backgroundColor: '#ede9fe',
            borderBottom: '1px solid #c4b5fd',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.5rem',
            alignItems: 'center',
          }}
        >
          <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Changes ({diffEntries.length}):
          </span>
          {diffEntries.map(([key, { was, becomes }]) => (
            <span
              key={key}
              style={{
                backgroundColor: 'white',
                border: '1px solid #ddd6fe',
                borderRadius: '0.25rem',
                padding: '0.15rem 0.5rem',
                fontSize: '0.72rem',
                color: '#4c1d95',
              }}
            >
              <strong>{key}</strong>:{' '}
              <span style={{ color: '#6b7280', textDecoration: 'line-through' }}>
                {JSON.stringify(was)}
              </span>{' '}
              →{' '}
              <span style={{ color: '#15803d', fontWeight: 600 }}>
                {JSON.stringify(becomes)}
              </span>
            </span>
          ))}
        </div>
      )}

      {/* ── Side-by-side renders ─────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
        {/* Actual */}
        <div style={{ borderRight: '1px dashed #c4b5fd' }}>
          <div
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#f8fafc',
              borderBottom: '1px solid #e2e8f0',
              fontSize: '0.65rem',
              fontWeight: 700,
              color: '#64748b',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}
          >
            Actual (committed)
          </div>
          <div style={{ padding: '1rem', opacity: 0.85 }}>
            <IntentRenderer compiledView={compiledActual} />
          </div>
        </div>

        {/* Hypothetical */}
        <div>
          <div
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#f5f3ff',
              borderBottom: '1px solid #ddd6fe',
              fontSize: '0.65rem',
              fontWeight: 700,
              color: '#7c3aed',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}
          >
            ⎇ Hypothetical (uncommitted)
          </div>
          <div style={{ padding: '1rem' }}>
            <IntentRenderer compiledView={compiledHypothetical} />
          </div>
        </div>
      </div>
    </div>
  );
}
