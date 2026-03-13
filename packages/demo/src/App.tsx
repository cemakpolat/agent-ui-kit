import React from 'react';
import { compileIntent, useIntentStore, useUIStore, IntentPayloadSchema, checkSchemaVersion, telemetry, governanceMetrics } from '@hari/core';
import { useAgentBridge, ThemeProvider, lightTheme } from '@hari/ui';
import type { Theme } from '@hari/ui';
import { registry } from './registry';
import { SCENARIOS, ScenarioSidebar } from './components/ScenarioSidebar';
import { TransportHeader } from './components/TransportHeader';
import { MainStage } from './components/MainStage';
import { GovernanceInspector } from './components/GovernanceInspector';
import { PayloadPlayground } from './components/PayloadPlayground';
import { IntentPayloadBuilder } from './components/IntentPayloadBuilder';
import { OllamaChatView } from './components/OllamaChatView';
import { TestHub } from './components/TestHub';
import { GovernanceMarketplacePanel } from './components/GovernanceMarketplace';
import { AIGovernancePanel } from './components/AIGovernancePanel';
import { GovernanceDashboard } from './components/GovernanceDashboard';
import { createBridge, getDefaultTransport, capabilityManifest, LIVE_MUTATORS, LIVE_UPDATE_INTERVAL_MS, type TransportType } from './components/transport-config';
export type { TransportType } from './components/transport-config';

telemetry.enable();

export function App() {
  const [activeView, setActiveView] = React.useState<string>('chat');
  const [activeScenario, setActiveScenario] = React.useState('travel');
  const [log, setLog] = React.useState<string[]>([]);
  const [hypotheticalQuery, setHypotheticalQuery] = React.useState<string | null>(null);
  const [versionWarning, setVersionWarning] = React.useState<string | null>(null);
  const [isLive, setIsLive] = React.useState(false);
  const [transportType, setTransportType] = React.useState<TransportType>(getDefaultTransport());
  const [activeTheme, setActiveTheme] = React.useState<Theme>(lightTheme);

  const { currentIntent, commitModifications, modifyParameter, hypotheticalIntent, branchHypothetical, snapshots, createSnapshot, restoreSnapshot, deleteSnapshot, exportSnapshots, addCollaborator, removeCollaborator, getCollaborators } = useIntentStore();
  const { densityOverride, setHypotheticalMode } = useUIStore();

  const addLog = React.useCallback((msg: string) => setLog((prev) => [`${new Date().toLocaleTimeString()} ${msg}`, ...prev].slice(0, 50)), []);

  // Telemetry + governance metrics
  React.useEffect(() => { governanceMetrics.start(); const u = telemetry.subscribe((e) => addLog(`[telemetry] ${e.type}`)); return () => { u(); governanceMetrics.stop(); }; }, [addLog]);

  // Transport bridge
  const bridge = React.useMemo(() => createBridge(transportType), [transportType]);
  const { connectionState, sendModification } = useAgentBridge(bridge, capabilityManifest);
  const prevStateRef = React.useRef(connectionState);
  React.useEffect(() => { if (connectionState !== prevStateRef.current) { addLog(`[bridge] ${prevStateRef.current} → ${connectionState}`); prevStateRef.current = connectionState; } }, [connectionState, addLog]);

  // Live updates — stop on scenario change
  React.useEffect(() => { if ('stopLiveUpdates' in bridge && typeof bridge.stopLiveUpdates === 'function') { (bridge as unknown as { stopLiveUpdates: () => void }).stopLiveUpdates(); } setIsLive(false); }, [activeScenario, bridge]);

  const handleLiveToggle = React.useCallback(() => {
    if (isLive) { if ('stopLiveUpdates' in bridge && typeof bridge.stopLiveUpdates === 'function') (bridge as unknown as { stopLiveUpdates: () => void }).stopLiveUpdates(); setIsLive(false); addLog('[simulate] Live updates stopped'); }
    else { const f = LIVE_MUTATORS[activeScenario]; if (!f) return; if ('startLiveUpdates' in bridge && typeof bridge.startLiveUpdates === 'function') (bridge as unknown as { startLiveUpdates: (i: number, m: unknown) => void }).startLiveUpdates(LIVE_UPDATE_INTERVAL_MS, f()); setIsLive(true); addLog(`[simulate] Live updates started (${LIVE_UPDATE_INTERVAL_MS} ms interval)`); }
  }, [isLive, activeScenario, bridge, addLog]);

  // Scenario loading
  React.useEffect(() => {
    const scenario = SCENARIOS[activeScenario]; if (!scenario) return;
    const compat = checkSchemaVersion(scenario.intent.version ?? '1.0.0');
    if (compat.status === 'incompatible') { setVersionWarning(compat.reason); addLog(`[error] ${compat.reason}`); } else if (compat.status === 'degraded') { setVersionWarning(compat.reason); addLog(`[warn] ${compat.reason}`); } else { setVersionWarning(null); }
    const parsed = IntentPayloadSchema.parse(scenario.intent);
    if ('loadScenario' in bridge && typeof bridge.loadScenario === 'function') (bridge as unknown as { loadScenario: (i: unknown) => void }).loadScenario(parsed);
    else useIntentStore.getState().setIntent(parsed);
    addLog(`[agent] Scenario loaded: ${parsed.intentId.slice(0, 8)}… domain=${parsed.domain} type=${parsed.type} confidence=${(parsed.confidence * 100).toFixed(0)}%`);
    setHypotheticalQuery(null); setHypotheticalMode(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeScenario]);

  // Compiled view
  const compiled = React.useMemo(() => currentIntent ? compileIntent(currentIntent, registry, { userDensityOverride: densityOverride }) : null, [currentIntent, densityOverride]);

  // Handlers
  const handleAmbiguityChange = React.useCallback((controlId: string, value: unknown) => { addLog(`[user] Control "${controlId}" → ${JSON.stringify(value)}`); modifyParameter(controlId, value); const p = commitModifications(); if (p) { sendModification(p); addLog(`[bridge] Patch dispatched (${Object.keys(p.modifications).join(', ')}) → awaiting roundtrip…`); } }, [addLog, modifyParameter, commitModifications, sendModification]);
  const handleActionExecute = React.useCallback((id: string) => { addLog(`[user] Action executed: "${id}"`); addLog(`[agent] Acknowledged — propagating to downstream systems…`); }, [addLog]);
  const handleWhatIf = React.useCallback((q: string) => { addLog(`[user] What-if: "${q}"`); setHypotheticalQuery(q); setHypotheticalMode(true, q); addLog(`[bridge] queryWhatIf dispatched — running in isolated context…`); }, [addLog, setHypotheticalMode]);
  const dismissHypothetical = React.useCallback(() => { setHypotheticalQuery(null); setHypotheticalMode(false); addLog('[user] Dismissed hypothetical overlay'); }, [addLog, setHypotheticalMode]);

  const handleExportScenario = React.useCallback(() => {
    if (!currentIntent) return;
    const json = JSON.stringify(currentIntent, null, 2);
    const blob = new Blob([json], { type: 'application/json' }); const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `hari-scenario-${currentIntent.domain}-${currentIntent.type}.json`; a.click(); URL.revokeObjectURL(url);
    addLog(`[user] Exported scenario as JSON (${(json.length / 1024).toFixed(1)} KB)`);
  }, [currentIntent, addLog]);

  const handleImportFile = React.useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => { try { const parsed = IntentPayloadSchema.parse(JSON.parse(e.target?.result as string)); useIntentStore.getState().setIntent(parsed); setActiveScenario('__imported__'); addLog(`[user] Imported scenario: ${parsed.intentId.slice(0, 8)}…`); } catch (err) { addLog(`[error] Import failed: ${err instanceof Error ? err.message : String(err)}`); } };
    reader.readAsText(file);
  }, [addLog]);

  return (
    <ThemeProvider theme={activeTheme}>
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: activeTheme.colors.background }}>
        <TransportHeader
          activeView={activeView} onViewChange={setActiveView}
          activeTheme={activeTheme} onThemeChange={setActiveTheme}
          transportType={transportType} onTransportChange={setTransportType}
          connectionState={connectionState}
          compiled={compiled} currentIntent={currentIntent} hypotheticalIntent={hypotheticalIntent} densityOverride={densityOverride}
          isLive={isLive} hasLiveMutator={!!LIVE_MUTATORS[activeScenario]} onLiveToggle={handleLiveToggle}
          onBranchHypothetical={() => { branchHypothetical(); addLog('[hypothetical] Branch created from currentIntent'); }}
          versionWarning={versionWarning} onDismissWarning={() => setVersionWarning(null)}
          onExportScenario={handleExportScenario} onImportFile={handleImportFile}
        >
          <ScenarioSidebar activeScenario={activeScenario} onSelectScenario={setActiveScenario} theme={activeTheme} />
        </TransportHeader>

        {activeView === 'chat' && <main style={{ flex: 1, padding: '1rem 2rem', maxWidth: '1200px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}><OllamaChatView /></main>}
        {activeView === 'playground' && <main style={{ flex: 1 }}><PayloadPlayground /></main>}
        {activeView === 'builder' && <main style={{ flex: 1 }}><IntentPayloadBuilder /></main>}
        {activeView === 'test' && <main style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}><TestHub /></main>}
        {activeView === 'marketplace' && <main style={{ flex: 1, overflow: 'auto' }}><GovernanceMarketplacePanel onPatternApplied={(id) => addLog(`[marketplace] Pattern applied: ${id}`)} onHierarchyApplied={(id) => addLog(`[marketplace] Hierarchy applied: ${id}`)} onTemplateUsed={(id) => addLog(`[marketplace] Template used: ${id}`)} /></main>}
        {activeView === 'ai-gov' && <main style={{ flex: 1, overflow: 'auto' }}><AIGovernancePanel /></main>}
        {activeView === 'observatory' && <main style={{ flex: 1, overflow: 'auto' }}><GovernanceDashboard refreshIntervalMs={5000} /></main>}

        {activeView === 'demo' && (
          <main style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 340px', gap: '1.25rem', padding: '1.25rem 2rem', alignItems: 'start', maxWidth: '1400px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
            <MainStage
              activeScenario={activeScenario} compiled={compiled} currentIntent={currentIntent}
              hypotheticalIntent={hypotheticalIntent} connectionState={connectionState}
              bridge={bridge} activeTheme={activeTheme} hypotheticalQuery={hypotheticalQuery}
              onDismissHypothetical={dismissHypothetical} onActionExecute={handleActionExecute}
              onAmbiguityChange={handleAmbiguityChange} onWhatIf={handleWhatIf} addLog={addLog}
            />
            <GovernanceInspector
              compiled={compiled} currentIntent={currentIntent} densityOverride={densityOverride}
              log={log} activeTheme={activeTheme}
              snapshots={snapshots} onCreateSnapshot={createSnapshot} onRestoreSnapshot={restoreSnapshot}
              onDeleteSnapshot={deleteSnapshot} onExportSnapshots={exportSnapshots}
              collaborators={getCollaborators()} onAddCollaborator={addCollaborator}
              onRemoveCollaborator={removeCollaborator} addLog={addLog}
            />
          </main>
        )}
      </div>
    </ThemeProvider>
  );
}

// Inject pulse keyframe for the live-sim indicator
if (typeof document !== 'undefined') {
  const id = 'hari-pulse-style';
  if (!document.getElementById(id)) {
    const style = document.createElement('style');
    style.id = id;
    style.textContent = `@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.35} }`;
    document.head.appendChild(style);
  }
}
