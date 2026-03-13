import React from 'react';
import type { CompiledView, AgentAction } from '@hari/core';
import { useUIStore, useIntentStore } from '@hari/core';
import { BlastRadiusBadge } from './BlastRadiusBadge';
import { ExplainPanel } from './ExplainPanel';
import { AmbiguityControls } from './AmbiguityControls';
import { useTheme } from '../ThemeContext';
import type { Theme } from '../theme';

// ─────────────────────────────────────────────────────────────────────────────
// IntentRenderer
//
// The main orchestration component.  It consumes a CompiledView produced by
// compileIntent() and wires together:
//   - ambiguity controls (intent negotiation)
//   - the domain-specific component resolved by the registry
//   - explainability panels (lazy, per-element)
//   - action buttons with blast-radius badges and two-step confirmation
//   - a FallbackComponent when no registry entry exists
//
// Component resolution uses useMemo (not useEffect) so DomainComponent and
// compiledView.data are ALWAYS in sync within the same render. Using useEffect
// caused a race condition: when the intent switched, data updated synchronously
// but the component updated one render later, so the old component briefly
// received the new domain's data (e.g. FlightList receiving { metrics }).
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  compiledView: CompiledView;
  onActionExecute?: (actionId: string, payload?: Record<string, unknown>) => void;
  onAmbiguityChange?: (controlId: string, value: unknown) => void;
  onWhatIf?: (query: string) => void;
}

export function IntentRenderer({ compiledView, onActionExecute, onAmbiguityChange, onWhatIf }: Props) {
  const {
    densityOverride,
    openExplainPanels,
    pendingConfirmations,
    openExplainPanel,
    closeExplainPanel,
    requestConfirmation,
    resolveConfirmation,
    dismissConfirmation,
  } = useUIStore();

  // Suppress unused warning — modifyAmbiguity is called via AmbiguityControls internally
  useIntentStore((s) => s.currentIntent);

  const density = densityOverride ?? compiledView.density;
  const { theme } = useTheme();

  // Resolve component synchronously so it is always in sync with compiledView.data.
  // Async resolvers (lazy-loaded components) return null here; callers should wrap
  // such resolvers with React.lazy + Suspense at the registry level instead.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const DomainComponent = React.useMemo<React.ComponentType<any> | null>(() => {
    if (!compiledView.resolvedComponent) return null;
    const result = compiledView.resolvedComponent();
    if (result instanceof Promise) return null; // async: use React.lazy externally
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return result as React.ComponentType<any>;
  }, [compiledView.resolvedComponent]);

  return (
    <div style={{ width: '100%' }}>
      {/* ── Compiler warnings (dev aid) ─────────────────────────────────── */}
      {compiledView.warnings.map((w, i) => (
        <div key={i} style={warnBannerStyle(theme)}>⚙ {w}</div>
      ))}

      {/* ── Low-confidence notice ──────────────────────────────────────── */}
      {compiledView.confidence < 0.65 && (
        <div style={infoBannerStyle(theme)}>
          ⚠ Low confidence ({(compiledView.confidence * 100).toFixed(0)}%) — use the
          controls below to clarify your intent.
        </div>
      )}

      {/* ── Ambiguity controls ─────────────────────────────────────────── */}
      {compiledView.ambiguities.length > 0 && (
        <div style={{ marginBottom: '1rem' }}>
          <AmbiguityControls
            controls={compiledView.ambiguities}
            onModify={onAmbiguityChange}
          />
        </div>
      )}

      {/* ── Main content ───────────────────────────────────────────────── */}
      <div style={{ marginBottom: '1rem' }}>
        {DomainComponent ? (
          <React.Suspense
            fallback={
              <div style={{ padding: '1.5rem', color: theme.colors.textMuted, fontSize: '0.875rem', textAlign: 'center' }}>
                Loading component…
              </div>
            }
          >
            <DomainComponent
              {...compiledView.data}
              density={density}
              explain={compiledView.explain}
              onExplain={(elementId: string) => openExplainPanel(elementId)}
            />
          </React.Suspense>
        ) : (
          <FallbackView data={compiledView.data} type={compiledView.type} domain={compiledView.domain} />
        )}
      </div>

      {/* ── Inline explain panels ──────────────────────────────────────── */}
      {openExplainPanels.map((elementId) => {
        const ctx = compiledView.explainability[elementId];
        if (!ctx) return null;
        return (
          <div key={elementId} style={{ marginBottom: '1rem' }}>
            <ExplainPanel
              context={ctx}
              onClose={() => closeExplainPanel(elementId)}
              onWhatIf={onWhatIf}
            />
          </div>
        );
      })}

      {/* ── Actions ────────────────────────────────────────────────────── */}
      {compiledView.actions.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginTop: '0.5rem' }}>
          {compiledView.actions.map((action) => (
            <ActionGroup
              key={action.id}
              action={action}
              density={density}
              pending={pendingConfirmations.find((c) => c.actionId === action.id)}
              onExecute={() => {
                if (action.safety?.requiresConfirmation) {
                  requestConfirmation(
                    action.id,
                    action.label,
                    action.safety.blastRadius?.downstreamEffects,
                  );
                } else {
                  onActionExecute?.(action.id, action.payload as Record<string, unknown>);
                }
              }}
              onConfirm={() =>
                resolveConfirmation(action.id, true, () =>
                  onActionExecute?.(action.id, action.payload as Record<string, unknown>),
                )
              }
              onDismiss={() => dismissConfirmation(action.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── ActionGroup ──────────────────────────────────────────────────────────────

interface ActionGroupProps {
  action: AgentAction;
  density: string;
  pending?: { actionId: string; label: string; blastRadiusSummary?: string };
  onExecute: () => void;
  onConfirm: () => void;
  onDismiss: () => void;
}

function ActionGroup({ action, density, pending, onExecute, onConfirm, onDismiss }: ActionGroupProps) {
  const [delayReady, setDelayReady] = React.useState(false);
  const [remaining, setRemaining] = React.useState(0);
  const delay = action.safety?.confirmationDelay ?? 0;
  const { theme } = useTheme();

  // Focus management: save the trigger element when the confirmation dialog opens;
  // restore it when the dialog closes (WCAG 2.4.3 Focus Order).
  const confirmBtnRef = React.useRef<HTMLButtonElement>(null);
  const triggerRef = React.useRef<Element | null>(null);
  React.useEffect(() => {
    if (pending) {
      triggerRef.current = document.activeElement;
      confirmBtnRef.current?.focus();
    } else if (triggerRef.current) {
      (triggerRef.current as HTMLElement | null)?.focus?.();
      triggerRef.current = null;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!pending]);

  React.useEffect(() => {
    if (!pending) {
      setDelayReady(false);
      setRemaining(0);
      return undefined;
    }
    if (delay <= 0) {
      setDelayReady(true);
      return undefined;
    }

    const secs = Math.ceil(delay / 1000);
    setRemaining(secs);

    const countInterval = setInterval(() => {
      setRemaining((r) => Math.max(0, r - 1));
    }, 1000);

    const readyTimer = setTimeout(() => {
      setDelayReady(true);
      clearInterval(countInterval);
    }, delay);

    return () => {
      clearTimeout(readyTimer);
      clearInterval(countInterval);
    };
  }, [pending, delay]);

  return (
    <div>
      {/* Blast radius badge (hidden at executive density to reduce noise) */}
      {action.safety && density !== 'executive' && (
        <div style={{ marginBottom: '0.5rem' }}>
          <BlastRadiusBadge safety={action.safety} compact />
        </div>
      )}

      {pending ? (
        <div
          role="alertdialog"
          aria-modal="false"
          aria-labelledby={`confirm-label-${action.id}`}
          aria-describedby={pending.blastRadiusSummary ? `confirm-desc-${action.id}` : undefined}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.625rem',
            padding: '0.625rem 0.875rem',
            border: `1.5px solid ${theme.colors.danger}`,
            borderRadius: theme.radius.md,
            backgroundColor: theme.colors.dangerSubtle,
            flexWrap: 'wrap',
          }}
        >
          <span id={`confirm-label-${action.id}`} style={{ fontSize: '0.875rem', color: theme.colors.danger, fontWeight: 600 }}>
            Confirm: {pending.label}?
          </span>
          {pending.blastRadiusSummary && (
            <span id={`confirm-desc-${action.id}`} style={{ fontSize: '0.75rem', color: theme.colors.dangerText }}>
              — {pending.blastRadiusSummary}
            </span>
          )}
          <button
            ref={confirmBtnRef}
            onClick={onConfirm}
            disabled={!delayReady}
            aria-label={delayReady ? `Confirm ${pending.label}` : `Wait ${remaining}s before confirming`}
            style={{
              ...actionButtonStyle('destructive', theme),
              opacity: delayReady ? 1 : 0.4,
              cursor: delayReady ? 'pointer' : 'not-allowed',
            }}
          >
            <span aria-live="polite" aria-atomic="true">
              {delayReady ? 'Yes, proceed' : remaining > 0 ? `${remaining}s…` : 'Wait…'}
            </span>
          </button>
          <button onClick={onDismiss} style={actionButtonStyle('secondary', theme)}>
            Cancel
          </button>
        </div>
      ) : (
        <button
          onClick={onExecute}
          disabled={action.disabled}
          style={{
          ...actionButtonStyle(action.variant, theme),
            opacity: action.disabled ? 0.5 : 1,
            cursor: action.disabled ? 'not-allowed' : 'pointer',
          }}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

// ─── FallbackView ─────────────────────────────────────────────────────────────
// Smart fallback: instead of raw JSON, auto-generates a readable view from
// arbitrary data. Objects become key-value tables, arrays become lists,
// strings become paragraphs, numbers/booleans become labelled values.

function FallbackView({ data, type, domain }: { data: unknown; type: string; domain: string }) {
  const { theme } = useTheme();
  const record = (typeof data === 'object' && data !== null ? data : {}) as Record<string, unknown>;
  const entries = Object.entries(record);

  return (
    <div
      style={{
        backgroundColor: theme.colors.surfaceAlt,
        border: `1px dashed ${theme.colors.border}`,
        borderRadius: theme.radius.md,
        padding: '1rem',
      }}
    >
      <div style={{
        fontSize: '0.75rem',
        color: theme.colors.textMuted,
        marginBottom: '0.75rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
      }}>
        <span style={{
          background: theme.colors.warningSubtle,
          color: theme.colors.warningText,
          padding: '0.15rem 0.5rem',
          borderRadius: theme.radius.sm,
          fontSize: '0.7rem',
          fontWeight: 600,
        }}>
          Auto-generated
        </span>
        No renderer for <code style={{ fontFamily: theme.typography.familyMono }}>{domain}/{type}</code>
      </div>

      {entries.length === 0 ? (
        <div style={{ color: theme.colors.textMuted, fontSize: '0.8rem', fontStyle: 'italic' }}>
          No data provided.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {entries.map(([key, value]) => (
            <FallbackField key={key} label={key} value={value} theme={theme} depth={0} />
          ))}
        </div>
      )}

      {/* Collapsible raw JSON for developers */}
      <details style={{ marginTop: '1rem' }}>
        <summary style={{
          fontSize: '0.7rem',
          color: theme.colors.textMuted,
          cursor: 'pointer',
          userSelect: 'none',
        }}>
          Show raw JSON
        </summary>
        <pre
          style={{
            margin: '0.5rem 0 0',
            fontSize: '0.7rem',
            color: theme.colors.textSecondary,
            fontFamily: theme.typography.familyMono,
            overflowX: 'auto',
            whiteSpace: 'pre-wrap',
            maxHeight: '300px',
            overflowY: 'auto',
            padding: '0.5rem',
            background: theme.colors.surface,
            borderRadius: theme.radius.sm,
          }}
        >
          {JSON.stringify(data, null, 2)}
        </pre>
      </details>
    </div>
  );
}

/** Recursively renders a single field in the fallback view */
function FallbackField({ label, value, theme, depth }: { label: string; value: unknown; theme: Theme; depth: number }) {
  const labelStyle: React.CSSProperties = {
    fontSize: '0.75rem',
    fontWeight: 600,
    color: theme.colors.textSecondary,
    textTransform: 'capitalize',
    marginBottom: '0.2rem',
  };

  const humanLabel = label.replace(/[_-]/g, ' ');

  // Primitives
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'string') {
    // Long strings → paragraph, short strings → inline label
    if (value.length > 100) {
      return (
        <div>
          <div style={labelStyle}>{humanLabel}</div>
          <p style={{ margin: 0, fontSize: '0.85rem', color: theme.colors.text, lineHeight: 1.5 }}>{value}</p>
        </div>
      );
    }
    return (
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline' }}>
        <span style={labelStyle}>{humanLabel}:</span>
        <span style={{ fontSize: '0.85rem', color: theme.colors.text }}>{value}</span>
      </div>
    );
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return (
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline' }}>
        <span style={labelStyle}>{humanLabel}:</span>
        <span style={{
          fontSize: '0.85rem',
          color: theme.colors.text,
          fontFamily: typeof value === 'number' ? theme.typography.familyMono : undefined,
          fontWeight: typeof value === 'number' ? 600 : undefined,
        }}>
          {String(value)}
        </span>
      </div>
    );
  }

  // Arrays → list or table
  if (Array.isArray(value)) {
    if (value.length === 0) return null;

    // Array of objects → table
    if (typeof value[0] === 'object' && value[0] !== null && !Array.isArray(value[0])) {
      const headers = Object.keys(value[0] as Record<string, unknown>).slice(0, 6);
      return (
        <div>
          <div style={labelStyle}>{humanLabel} ({value.length})</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{
              width: '100%',
              fontSize: '0.8rem',
              borderCollapse: 'collapse',
              marginTop: '0.25rem',
            }}>
              <thead>
                <tr>
                  {headers.map((h) => (
                    <th key={h} style={{
                      textAlign: 'left',
                      padding: '0.35rem 0.5rem',
                      borderBottom: `1px solid ${theme.colors.border}`,
                      color: theme.colors.textSecondary,
                      fontWeight: 600,
                      fontSize: '0.7rem',
                      textTransform: 'capitalize',
                    }}>
                      {h.replace(/[_-]/g, ' ')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {value.slice(0, 20).map((row, i) => (
                  <tr key={i}>
                    {headers.map((h) => (
                      <td key={h} style={{
                        padding: '0.3rem 0.5rem',
                        borderBottom: `1px solid ${theme.colors.border}`,
                        color: theme.colors.text,
                        maxWidth: '200px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {formatCellValue((row as Record<string, unknown>)[h])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {value.length > 20 && (
            <div style={{ fontSize: '0.7rem', color: theme.colors.textMuted, marginTop: '0.25rem' }}>
              …and {value.length - 20} more item(s)
            </div>
          )}
        </div>
      );
    }

    // Array of primitives → bullet list
    return (
      <div>
        <div style={labelStyle}>{humanLabel}</div>
        <ul style={{ margin: '0.25rem 0 0', paddingLeft: '1.25rem', fontSize: '0.85rem', color: theme.colors.text }}>
          {value.slice(0, 15).map((item, i) => (
            <li key={i} style={{ marginBottom: '0.15rem' }}>{String(item)}</li>
          ))}
          {value.length > 15 && <li style={{ color: theme.colors.textMuted }}>…{value.length - 15} more</li>}
        </ul>
      </div>
    );
  }

  // Nested objects → recurse (max depth 2)
  if (typeof value === 'object' && depth < 2) {
    const entries = Object.entries(value as Record<string, unknown>);
    return (
      <div style={{ paddingLeft: depth > 0 ? '0.75rem' : 0, borderLeft: depth > 0 ? `2px solid ${theme.colors.border}` : 'none' }}>
        <div style={labelStyle}>{humanLabel}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginTop: '0.2rem' }}>
          {entries.map(([k, v]) => (
            <FallbackField key={k} label={k} value={v} theme={theme} depth={depth + 1} />
          ))}
        </div>
      </div>
    );
  }

  // Deep objects → JSON
  return (
    <div>
      <div style={labelStyle}>{humanLabel}</div>
      <pre style={{
        fontSize: '0.7rem',
        fontFamily: theme.typography.familyMono,
        color: theme.colors.textSecondary,
        margin: 0,
        whiteSpace: 'pre-wrap',
      }}>
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}

function formatCellValue(val: unknown): string {
  if (val === null || val === undefined) return '—';
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
}

// ─── Theme-aware style helpers ────────────────────────────────────────────────

function warnBannerStyle(theme: Theme): React.CSSProperties {
  return {
    backgroundColor: theme.colors.warningSubtle,
    border: `1px solid ${theme.colors.warning}`,
    borderRadius: theme.radius.sm,
    padding: '0.375rem 0.75rem',
    marginBottom: '0.5rem',
    fontSize: '0.75rem',
    color: theme.colors.warningText,
    fontFamily: theme.typography.familyMono,
  };
}

function infoBannerStyle(theme: Theme): React.CSSProperties {
  return {
    backgroundColor: theme.colors.infoSubtle,
    border: `1px solid ${theme.colors.info}`,
    borderRadius: theme.radius.sm,
    padding: '0.5rem 0.75rem',
    marginBottom: '0.75rem',
    fontSize: '0.875rem',
    color: theme.colors.infoText,
  };
}

function actionButtonStyle(variant: string, theme: Theme): React.CSSProperties {
  const base: Record<string, React.CSSProperties> = {
    primary:     { backgroundColor: theme.colors.accent, color: theme.colors.accentText, border: 'none' },
    secondary:   { backgroundColor: theme.colors.surfaceAlt, color: theme.colors.textSecondary, border: `1px solid ${theme.colors.border}` },
    destructive: { backgroundColor: theme.colors.danger, color: '#ffffff', border: 'none' },
    info:        { backgroundColor: theme.colors.info, color: '#ffffff', border: 'none' },
  };
  return {
    ...(base[variant] ?? base['primary']),
    padding: '0.5rem 1rem',
    borderRadius: theme.radius.md,
    fontWeight: 600,
    fontSize: '0.875rem',
    cursor: 'pointer',
    transition: 'opacity 0.15s',
  };
}
