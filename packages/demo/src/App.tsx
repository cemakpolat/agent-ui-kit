import React from 'react';
import {
  compileIntent,
  useIntentStore,
  useUIStore,
  IntentPayloadSchema,
  checkSchemaVersion,
} from '@hari/core';
import type { IntentPayloadInput } from '@hari/core';
import {
  IntentRenderer,
  DensitySelector,
  IntentErrorBoundary,
  HypotheticalOverlay,
} from '@hari/ui';
import { registry } from './registry';
import { travelIntent } from './scenarios/travel';
import { cloudopsIntent } from './scenarios/cloudops';
import { iotIntent } from './scenarios/iot';

// ─────────────────────────────────────────────────────────────────────────────
// Demo Application — HARI v0.1
//
// Three complete scenarios demonstrating the full HARI architecture:
//   1. Travel     — flight comparison, price/comfort negotiation
//   2. CloudOps   — incident dashboard, blast-radius confirm
//   3. IoT        — sensor grid, new domain (extensibility demo)
// ─────────────────────────────────────────────────────────────────────────────

const SCENARIOS: Record<string, { label: string; intent: IntentPayloadInput; emoji: string }> = {
  travel:   { label: 'Travel',   emoji: '✈', intent: travelIntent   },
  cloudops: { label: 'CloudOps', emoji: '🖥', intent: cloudopsIntent },
  iot:      { label: 'IoT',      emoji: '📡', intent: iotIntent      },
};

export function App() {
  const [activeScenario, setActiveScenario] = React.useState<string>('travel');
  const [log, setLog] = React.useState<string[]>([]);
  const [hypotheticalQuery, setHypotheticalQuery] = React.useState<string | null>(null);
  const [versionWarning, setVersionWarning] = React.useState<string | null>(null);

  const { setIntent, currentIntent, commitModifications } = useIntentStore();
  const { densityOverride, setHypotheticalMode } = useUIStore();

  const addLog = (msg: string) =>
    setLog((prev) => [`${new Date().toLocaleTimeString()} ${msg}`, ...prev].slice(0, 50));

  // Load scenario + schema version check
  React.useEffect(() => {
    const scenario = SCENARIOS[activeScenario];
    const raw = scenario.intent;

    // Schema version guard
    const compat = checkSchemaVersion(raw.version ?? '1.0.0');
    if (compat.status === 'incompatible') {
      setVersionWarning(compat.reason);
      addLog(`[error] ${compat.reason}`);
    } else if (compat.status === 'degraded') {
      setVersionWarning(compat.reason);
      addLog(`[warn] ${compat.reason}`);
    } else {
      setVersionWarning(null);
    }

    const parsed = IntentPayloadSchema.parse(raw);
    setIntent(parsed);
    addLog(`[agent] Intent loaded: ${parsed.intentId.slice(0, 8)}… domain=${parsed.domain} type=${parsed.type} confidence=${(parsed.confidence * 100).toFixed(0)}%`);

    // Reset hypothetical when switching scenarios
    setHypotheticalQuery(null);
    setHypotheticalMode(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeScenario]);

  const compiled = React.useMemo(() => {
    if (!currentIntent) return null;
    return compileIntent(currentIntent, registry, { userDensityOverride: densityOverride });
  }, [currentIntent, densityOverride]);

  const handleAmbiguityChange = (controlId: string, value: unknown) => {
    addLog(`[user] Control "${controlId}" → ${JSON.stringify(value)}`);
    setTimeout(() => {
      const patch = commitModifications();
      if (patch) {
        addLog(`[agent] Patch received (${Object.keys(patch.modifications).join(', ')}) → optimistic re-sort`);
      }
    }, 300);
  };

  const handleActionExecute = (actionId: string) => {
    addLog(`[user] Action executed: "${actionId}"`);
    addLog(`[agent] Acknowledged — propagating to downstream systems…`);
  };

  const handleWhatIf = (query: string) => {
    addLog(`[user] What-if query: "${query}"`);
    setHypotheticalQuery(query);
    setHypotheticalMode(true, query);
    addLog(`[agent] Running hypothetical analysis in isolated context…`);
  };

  const dismissHypothetical = () => {
    setHypotheticalQuery(null);
    setHypotheticalMode(false);
    addLog('[user] Dismissed hypothetical overlay');
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header style={{
        backgroundColor: '#0f172a', color: 'white',
        padding: '0.875rem 2rem',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        flexWrap: 'wrap', gap: '0.75rem',
      }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: '1.125rem', letterSpacing: '-0.02em' }}>HARI</div>
          <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>Human–Agent Runtime Interface · v0.1</div>
        </div>

        {/* Scenario tabs */}
        <div style={{ display: 'flex', gap: '0.375rem' }}>
          {Object.entries(SCENARIOS).map(([key, { label, emoji }]) => (
            <button key={key} onClick={() => setActiveScenario(key)} style={{
              padding: '0.375rem 0.875rem', borderRadius: '0.375rem', border: 'none',
              backgroundColor: activeScenario === key ? '#4f46e5' : '#1e293b',
              color: activeScenario === key ? 'white' : '#94a3b8',
              fontWeight: activeScenario === key ? 700 : 400,
              cursor: 'pointer', fontSize: '0.8rem',
            }}>
              {emoji} {label}
            </button>
          ))}
        </div>

        {compiled && <DensitySelector agentRecommended={compiled.density} />}
      </header>

      {/* ── Schema version warning ────────────────────────────────────── */}
      {versionWarning && (
        <div style={{
          backgroundColor: '#fef9c3', borderBottom: '1px solid #fde047',
          padding: '0.5rem 2rem', fontSize: '0.8rem', color: '#854d0e',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span>⚠ Schema version: {versionWarning}</span>
          <button onClick={() => setVersionWarning(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#854d0e', fontWeight: 700 }}>✕</button>
        </div>
      )}

      {/* ── Main grid ────────────────────────────────────────────────── */}
      <main style={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns: '1fr 340px',
        gap: '1.25rem',
        padding: '1.25rem 2rem',
        alignItems: 'start',
        maxWidth: '1400px',
        margin: '0 auto',
        width: '100%',
        boxSizing: 'border-box',
      }}>

        {/* ── Left column: intent + hypothetical ──────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {/* Intent header */}
          {compiled && (
            <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', padding: '1rem 1.25rem', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  <div style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    {compiled.domain} / {compiled.type}
                  </div>
                  <h2 style={{ margin: '0.25rem 0 0', fontSize: '1.0625rem', fontWeight: 700, color: '#1e293b' }}>
                    {compiled.primaryGoal}
                  </h2>
                </div>
                <ConfidencePill confidence={compiled.confidence} />
              </div>
            </div>
          )}

          {/* Main content — error-bounded */}
          <IntentErrorBoundary
            fallbackData={compiled?.data}
            domain={compiled?.domain}
            intentType={compiled?.type}
          >
            <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', padding: '1.25rem', border: '1px solid #e2e8f0' }}>
              {compiled ? (
                <IntentRenderer
                  compiledView={compiled}
                  onActionExecute={handleActionExecute}
                  onAmbiguityChange={handleAmbiguityChange}
                  onWhatIf={handleWhatIf}
                />
              ) : (
                <div style={{ color: '#94a3b8', textAlign: 'center', padding: '2rem' }}>
                  Loading intent…
                </div>
              )}
            </div>
          </IntentErrorBoundary>

          {/* Hypothetical overlay — isolated, does NOT mutate intent state */}
          {hypotheticalQuery && (
            <HypotheticalOverlay
              query={hypotheticalQuery}
              onDismiss={dismissHypothetical}
            />
          )}
        </div>

        {/* ── Right column: architecture panels ────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {/* Schema + capability */}
          {compiled && (
            <Panel title="Schema & Capabilities">
              <div style={{ fontSize: '0.75rem', color: '#475569', lineHeight: '1.7' }}>
                <div><strong>Version:</strong> {currentIntent?.version}</div>
                <div><strong>Domain:</strong> {compiled.domain}</div>
                <div><strong>Density:</strong> {compiled.density}{densityOverride ? ' (user override)' : ' (agent rec.)'}</div>
                <div><strong>Component:</strong> {compiled.resolvedComponent ? '✓ resolved' : '⚠ fallback'}</div>
                <div><strong>Ambiguities:</strong> {compiled.ambiguities.length}</div>
                <div><strong>Actions:</strong> {compiled.actions.length}</div>
                <div><strong>Explain panels:</strong> {Object.keys(compiled.explainability).length} registered</div>
              </div>
            </Panel>
          )}

          {/* Intent payload */}
          <Panel title="Active Intent Payload">
            <pre style={{ margin: 0, fontSize: '0.62rem', color: '#475569', overflowX: 'auto', overflowY: 'auto', maxHeight: '220px', whiteSpace: 'pre-wrap' }}>
              {currentIntent
                ? JSON.stringify({ ...currentIntent, data: '[omitted]', explainability: '[omitted]' }, null, 2)
                : 'null'}
            </pre>
          </Panel>

          {/* Negotiation log */}
          <Panel title="Negotiation Log">
            <div style={{ fontFamily: 'monospace', fontSize: '0.68rem', maxHeight: '220px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
              {log.length === 0 ? (
                <span style={{ color: '#94a3b8' }}>No events yet</span>
              ) : (
                log.map((entry, i) => (
                  <div key={i} style={{
                    color: entry.startsWith('[error]') ? '#dc2626'
                         : entry.startsWith('[warn]')  ? '#a16207'
                         : entry.includes('[agent]')   ? '#7c3aed'
                         : entry.includes('[user]')    ? '#0369a1'
                         : '#475569',
                  }}>
                    {entry}
                  </div>
                ))
              )}
            </div>
          </Panel>

          {/* Architecture notes */}
          <Panel title="Architecture Notes">
            <ul style={{ margin: 0, paddingLeft: '1.125rem', fontSize: '0.73rem', color: '#64748b', lineHeight: '1.8' }}>
              <li>useMemo resolution — component + data always in sync</li>
              <li>Stable component refs — no unmount/remount on re-render</li>
              <li>IntentErrorBoundary — graceful domain component errors</li>
              <li>Hypothetical overlay — isolated, never mutates intent</li>
              <li>Schema version guard — compat check before render</li>
              <li>IoT = new domain with zero compiler changes</li>
              <li>Two stores: Intent (committed) + UI (ephemeral)</li>
            </ul>
          </Panel>
        </div>
      </main>
    </div>
  );
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function ConfidencePill({ confidence }: { confidence: number }) {
  const pct = (confidence * 100).toFixed(0);
  const c = confidence >= 0.8 ? { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0' }
          : confidence >= 0.6 ? { bg: '#fefce8', text: '#a16207', border: '#fde68a' }
          : { bg: '#fef2f2', text: '#dc2626', border: '#fecaca' };
  return (
    <div style={{ padding: '0.25rem 0.625rem', borderRadius: '0.375rem', backgroundColor: c.bg, border: `1px solid ${c.border}`, color: c.text, fontSize: '0.75rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
      {pct}% confidence
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
      <div style={{ padding: '0.5rem 1rem', backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontSize: '0.65rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        {title}
      </div>
      <div style={{ padding: '0.75rem 1rem' }}>{children}</div>
    </div>
  );
}
