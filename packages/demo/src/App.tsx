import React from 'react';
import { compileIntent, useIntentStore, useUIStore, buildModificationPatch, IntentPayloadSchema } from '@hari/core';
import type { IntentPayloadInput } from '@hari/core';
import { IntentRenderer, DensitySelector } from '@hari/ui';
import { registry } from './registry';
import { travelIntent } from './scenarios/travel';
import { cloudopsIntent } from './scenarios/cloudops';

// ─────────────────────────────────────────────────────────────────────────────
// Demo Application
//
// Demonstrates two HARI scenarios side-by-side with full negotiation loop:
//   1. Travel — flight comparison with price/comfort slider
//   2. CloudOps — incident dashboard with replica selection
//
// The demo simulates an "agent" by simply loading static scenario intents.
// In production, the agent produces IntentPayloads over a streaming connection.
// ─────────────────────────────────────────────────────────────────────────────

const SCENARIOS: Record<string, { label: string; intent: IntentPayloadInput; emoji: string }> = {
  travel:   { label: 'Travel Comparison', emoji: '✈', intent: travelIntent   },
  cloudops: { label: 'CloudOps Incident', emoji: '🖥', intent: cloudopsIntent },
};

export function App() {
  const [activeScenario, setActiveScenario] = React.useState<keyof typeof SCENARIOS>('travel');
  const [log, setLog] = React.useState<string[]>([]);
  const [whatIfOverlay, setWhatIfOverlay] = React.useState<string | null>(null);

  const { setIntent, currentIntent, commitModifications } = useIntentStore();
  const { densityOverride, setHypotheticalMode } = useUIStore();

  // Load scenario
  React.useEffect(() => {
    const scenario = SCENARIOS[activeScenario];
    // Parse through schema to apply all Zod defaults before storing
    const parsed = IntentPayloadSchema.parse(scenario.intent);
    setIntent(parsed);
    addLog(`[agent] Loaded intent: ${parsed.intentId.slice(0, 8)}… (${parsed.type})`);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeScenario]);

  const addLog = (msg: string) =>
    setLog((prev) => [`${new Date().toLocaleTimeString()} ${msg}`, ...prev].slice(0, 40));

  const compiled = React.useMemo(() => {
    if (!currentIntent) return null;
    return compileIntent(currentIntent, registry, {
      userDensityOverride: densityOverride,
    });
  }, [currentIntent, densityOverride]);

  const handleAmbiguityChange = (controlId: string, value: unknown) => {
    addLog(`[user] Modified control "${controlId}" → ${JSON.stringify(value)}`);
    // Simulate optimistic agent patch (in production: debounce + send to agent)
    setTimeout(() => {
      const patch = commitModifications();
      if (patch) {
        addLog(`[agent] Received patch for intent ${patch.originalIntentId.slice(0, 8)}…`);
        addLog(`[agent] Re-sorted data (no new fetch required)`);
      }
    }, 300);
  };

  const handleActionExecute = (actionId: string, payload?: Record<string, unknown>) => {
    addLog(`[user] Executed action "${actionId}" ${payload ? JSON.stringify(payload) : ''}`);
    addLog(`[agent] Action acknowledged. Updating downstream systems…`);
  };

  const handleWhatIf = (query: string) => {
    addLog(`[user] What-if: "${query}"`);
    setWhatIfOverlay(query);
    setHypotheticalMode(true, query);
    setTimeout(() => {
      addLog(`[agent] Hypothetical: "${query}" → [overlay rendered]`);
    }, 400);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header
        style={{
          backgroundColor: '#0f172a',
          color: 'white',
          padding: '1rem 2rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.75rem',
        }}
      >
        <div>
          <div style={{ fontWeight: 800, fontSize: '1.125rem', letterSpacing: '-0.02em' }}>
            HARI
          </div>
          <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.1rem' }}>
            Human–Agent Runtime Interface · v0.1
          </div>
        </div>

        {/* Scenario picker */}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {Object.entries(SCENARIOS).map(([key, { label, emoji }]) => (
            <button
              key={key}
              onClick={() => setActiveScenario(key)}
              style={{
                padding: '0.375rem 0.875rem',
                borderRadius: '0.375rem',
                border: 'none',
                backgroundColor: activeScenario === key ? '#4f46e5' : '#1e293b',
                color: activeScenario === key ? 'white' : '#94a3b8',
                fontWeight: activeScenario === key ? 700 : 400,
                cursor: 'pointer',
                fontSize: '0.875rem',
              }}
            >
              {emoji} {label}
            </button>
          ))}
        </div>

        {/* Density selector */}
        {compiled && <DensitySelector agentRecommended={compiled.density} />}
      </header>

      {/* ── Main ────────────────────────────────────────────────────────── */}
      <main
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: '1fr 340px',
          gap: '1.5rem',
          padding: '1.5rem 2rem',
          alignItems: 'start',
          maxWidth: '1400px',
          margin: '0 auto',
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        {/* ── Left: Intent view ──────────────────────────────────────────── */}
        <div>
          {/* Intent header */}
          {compiled && (
            <div
              style={{
                backgroundColor: 'white',
                borderRadius: '0.75rem',
                padding: '1rem 1.25rem',
                marginBottom: '1rem',
                border: '1px solid #e2e8f0',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  flexWrap: 'wrap',
                  gap: '0.5rem',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    {compiled.domain} / {compiled.type}
                  </div>
                  <h2 style={{ margin: '0.25rem 0 0', fontSize: '1.125rem', fontWeight: 700, color: '#1e293b' }}>
                    {compiled.primaryGoal}
                  </h2>
                </div>
                <ConfidencePill confidence={compiled.confidence} />
              </div>

              {/* What-if overlay banner */}
              {whatIfOverlay && (
                <div
                  style={{
                    marginTop: '0.75rem',
                    padding: '0.5rem 0.75rem',
                    backgroundColor: '#eef2ff',
                    border: '1px solid #c7d2fe',
                    borderRadius: '0.375rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '0.875rem',
                  }}
                >
                  <span style={{ color: '#3730a3' }}>
                    <strong>Hypothetical:</strong> "{whatIfOverlay}"
                  </span>
                  <button
                    onClick={() => {
                      setWhatIfOverlay(null);
                      setHypotheticalMode(false);
                      addLog('[user] Dismissed hypothetical overlay');
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#6366f1',
                      cursor: 'pointer',
                      fontWeight: 600,
                      fontSize: '0.875rem',
                    }}
                  >
                    Dismiss ×
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Intent renderer */}
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '0.75rem',
              padding: '1.25rem',
              border: '1px solid #e2e8f0',
            }}
          >
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
        </div>

        {/* ── Right: Architecture panel ──────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Active intent JSON */}
          <Panel title="Active Intent Payload">
            <pre
              style={{
                margin: 0,
                fontSize: '0.65rem',
                color: '#475569',
                overflowX: 'auto',
                overflowY: 'auto',
                maxHeight: '300px',
                whiteSpace: 'pre-wrap',
              }}
            >
              {currentIntent
                ? JSON.stringify(
                    { ...currentIntent, data: '[data omitted]', explainability: '[…]' },
                    null,
                    2,
                  )
                : 'null'}
            </pre>
          </Panel>

          {/* Negotiation log */}
          <Panel title="Negotiation Log">
            <div
              style={{
                fontFamily: 'monospace',
                fontSize: '0.7rem',
                color: '#475569',
                maxHeight: '260px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.25rem',
              }}
            >
              {log.length === 0 ? (
                <span style={{ color: '#94a3b8' }}>No events yet</span>
              ) : (
                log.map((entry, i) => (
                  <div
                    key={i}
                    style={{
                      color: entry.includes('[agent]') ? '#7c3aed' : entry.includes('[user]') ? '#0369a1' : '#475569',
                    }}
                  >
                    {entry}
                  </div>
                ))
              )}
            </div>
          </Panel>

          {/* Architecture notes */}
          <Panel title="HARI Architecture Notes">
            <ul style={{ margin: 0, paddingLeft: '1.125rem', fontSize: '0.75rem', color: '#64748b', lineHeight: '1.8' }}>
              <li>Intent compiler resolves density by user → system → agent authority</li>
              <li>Ambiguity controls send patches, not full new intents</li>
              <li>BlastRadiusBadge gates irreversible actions visually</li>
              <li>ExplainPanel is a queryable reasoning surface, not docs</li>
              <li>Component registry: (domain, type, density) → component</li>
              <li>FallbackView ensures the UI never crashes on unknown types</li>
              <li>Two stores: Intent (committed) + UI (ephemeral)</li>
            </ul>
          </Panel>
        </div>
      </main>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function ConfidencePill({ confidence }: { confidence: number }) {
  const pct = (confidence * 100).toFixed(0);
  const color = confidence >= 0.8 ? '#15803d' : confidence >= 0.6 ? '#a16207' : '#dc2626';
  const bg = confidence >= 0.8 ? '#f0fdf4' : confidence >= 0.6 ? '#fefce8' : '#fef2f2';
  const border = confidence >= 0.8 ? '#bbf7d0' : confidence >= 0.6 ? '#fde68a' : '#fecaca';
  return (
    <div
      style={{
        padding: '0.25rem 0.625rem',
        borderRadius: '0.375rem',
        backgroundColor: bg,
        border: `1px solid ${border}`,
        color,
        fontSize: '0.75rem',
        fontWeight: 700,
        whiteSpace: 'nowrap',
      }}
    >
      {pct}% confidence
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        backgroundColor: 'white',
        borderRadius: '0.75rem',
        border: '1px solid #e2e8f0',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '0.625rem 1rem',
          backgroundColor: '#f8fafc',
          borderBottom: '1px solid #e2e8f0',
          fontSize: '0.7rem',
          fontWeight: 700,
          color: '#64748b',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
        }}
      >
        {title}
      </div>
      <div style={{ padding: '0.875rem 1rem' }}>{children}</div>
    </div>
  );
}
