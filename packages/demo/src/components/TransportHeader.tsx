import React from 'react';
import type { AgentBridge, IntentPayload } from '@hari/core';
import { DensitySelector, ALL_THEMES, type Theme } from '@hari/ui';
import type { CompiledView } from '@hari/core';
import type { TransportType } from './transport-config';
import {
  MessagesSquare, Puzzle, Wrench, Play, Zap, ShoppingBag, Bot,
  BarChart2, Download, Upload, GitBranch, AlertTriangle, X,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// TransportHeader — top bar with view toggle, transport selector, theme picker,
// export/import, live simulation toggle, and connection badge.
// ─────────────────────────────────────────────────────────────────────────────

export interface TransportHeaderProps {
  activeView: string;
  onViewChange: (view: string) => void;
  activeTheme: Theme;
  onThemeChange: (theme: Theme) => void;
  // Transport
  transportType: TransportType;
  onTransportChange: (t: TransportType) => void;
  // Connection
  connectionState: string;
  // Compiled intent
  compiled: CompiledView | null;
  currentIntent: IntentPayload | null;
  hypotheticalIntent: IntentPayload | null;
  densityOverride: string | null;
  // Live sim
  isLive: boolean;
  hasLiveMutator: boolean;
  onLiveToggle: () => void;
  // Hypothetical branch
  onBranchHypothetical: () => void;
  // Version warning
  versionWarning: string | null;
  onDismissWarning: () => void;
  // Export / Import
  onExportScenario: () => void;
  onImportFile: (file: File) => void;
  // Scenario tabs (rendered as children)
  children?: React.ReactNode;
}

export function TransportHeader({
  activeView,
  onViewChange,
  activeTheme,
  onThemeChange,
  transportType,
  onTransportChange,
  connectionState,
  compiled,
  currentIntent,
  hypotheticalIntent,
  isLive,
  hasLiveMutator,
  onLiveToggle,
  onBranchHypothetical,
  versionWarning,
  onDismissWarning,
  onExportScenario,
  onImportFile,
  children,
}: TransportHeaderProps) {
  const importInputRef = React.useRef<HTMLInputElement>(null);

  const handleImportFileChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onImportFile(file);
    if (importInputRef.current) importInputRef.current.value = '';
  }, [onImportFile]);

  return (
    <>
      <header style={{
        backgroundColor: activeTheme.colors.surfaceAlt, color: activeTheme.colors.text,
        borderBottom: `1px solid ${activeTheme.colors.border}`,
        padding: '0.875rem 2rem',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        flexWrap: 'wrap', gap: '0.75rem',
        fontFamily: activeTheme.typography.family,
      }}>
        {/* Brand */}
        <div>
          <div style={{ fontWeight: 800, fontSize: '1.125rem', letterSpacing: '-0.02em', color: activeTheme.colors.text }}>HARI</div>
          <div style={{ fontSize: '0.65rem', color: activeTheme.colors.textSecondary }}>Human–Agent Runtime Interface · v0.1</div>
        </div>

        {/* View toggle */}
        <div style={{ display: 'flex', gap: '0.375rem', borderRight: `1px solid ${activeTheme.colors.border}`, paddingRight: '0.75rem', marginRight: '0.25rem' }}>
          {(['chat', 'demo', 'playground', 'builder', 'test'] as const).map((view) => (
            <button key={view} onClick={() => onViewChange(view)} style={{
              padding: '0.375rem 0.875rem', borderRadius: activeTheme.radius.md, border: 'none',
              backgroundColor: activeView === view ? activeTheme.colors.accent : activeTheme.colors.surface,
              color: activeView === view ? activeTheme.colors.accentText : activeTheme.colors.textSecondary,
              fontWeight: activeView === view ? 700 : 400,
              cursor: 'pointer', fontSize: '0.8rem', textTransform: 'capitalize',
              display: 'flex', alignItems: 'center', gap: '0.35rem',
            }}>
              {view === 'chat' ? <MessagesSquare size={14} /> : view === 'playground' ? <Puzzle size={14} /> : view === 'builder' ? <Wrench size={14} /> : view === 'test' ? <Zap size={14} /> : <Play size={14} />}
              {view === 'chat' ? 'Ollama Chat' : view === 'test' ? 'Test Hub' : view}
            </button>
          ))}
          {/* Phase 8 views */}
          {([['marketplace', 'Marketplace', <ShoppingBag size={14} key="mp" />], ['ai-gov', 'AI Gov', <Bot size={14} key="ai" />], ['observatory', 'Observatory', <BarChart2 size={14} key="obs" />]] as const).map(([view, label, icon]) => (
            <button key={view} onClick={() => onViewChange(view as string)} style={{
              padding: '0.375rem 0.875rem', borderRadius: activeTheme.radius.md, border: 'none',
              backgroundColor: activeView === view ? activeTheme.colors.accent : activeTheme.colors.surface,
              color: activeView === view ? activeTheme.colors.accentText : activeTheme.colors.textSecondary,
              fontWeight: activeView === view ? 700 : 400,
              cursor: 'pointer', fontSize: '0.8rem',
              display: 'flex', alignItems: 'center', gap: '0.35rem',
            }}>
              {icon} {label}
            </button>
          ))}
        </div>

        {/* Transport selector — only shown in demo view */}
        {activeView === 'demo' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', borderRight: `1px solid ${activeTheme.colors.border}`, paddingRight: '0.75rem', marginRight: '0.25rem' }}>
            <label style={{ fontSize: '0.75rem', color: activeTheme.colors.textSecondary, fontWeight: 600 }}>Transport:</label>
            <select value={transportType} onChange={(e) => onTransportChange(e.target.value as TransportType)} style={{
              padding: '0.375rem 0.5rem', borderRadius: activeTheme.radius.md, border: `1px solid ${activeTheme.colors.border}`,
              backgroundColor: activeTheme.colors.surface, color: activeTheme.colors.text,
              fontSize: '0.75rem', fontWeight: 500, cursor: 'pointer',
            }}>
              <option value="mock">Mock (Local)</option>
              <option value="websocket">WebSocket</option>
              <option value="sse">Server-Sent Events</option>
              <option value="mcp">MCP</option>
            </select>
          </div>
        )}

        {/* Scenario tabs (injected by parent) */}
        {activeView === 'demo' && children}

        {/* Export / Import buttons — shown in demo view */}
        {activeView === 'demo' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', borderLeft: `1px solid ${activeTheme.colors.border}`, paddingLeft: '0.75rem' }}>
            <button onClick={onExportScenario} disabled={!currentIntent} title="Export current scenario as JSON" style={{
              padding: '0.375rem 0.75rem', borderRadius: activeTheme.radius.md,
              border: `1px solid ${activeTheme.colors.border}`, backgroundColor: activeTheme.colors.surface,
              color: currentIntent ? activeTheme.colors.text : activeTheme.colors.textMuted,
              fontSize: '0.75rem', fontWeight: 600, cursor: currentIntent ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', gap: '0.35rem',
            }}>
              <Download size={14} /> Export JSON
            </button>
            <button onClick={() => importInputRef.current?.click()} title="Import a scenario from a JSON file" style={{
              padding: '0.375rem 0.75rem', borderRadius: activeTheme.radius.md,
              border: `1px solid ${activeTheme.colors.border}`, backgroundColor: activeTheme.colors.surface,
              color: activeTheme.colors.text, fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '0.35rem',
            }}>
              <Upload size={14} /> Import JSON
            </button>
            <input ref={importInputRef} type="file" accept=".json,application/json" onChange={handleImportFileChange} style={{ display: 'none' }} aria-label="Import scenario JSON file" />
          </div>
        )}

        {/* Right side: live sim + connection badge + density selector + theme */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {hasLiveMutator && (
            <button onClick={onLiveToggle} title={isLive ? 'Stop live simulation' : 'Start live data simulation — bridge pushes updated intents every 2 s'} style={{
              padding: '0.375rem 0.75rem', borderRadius: activeTheme.radius.md,
              border: `1px solid ${isLive ? activeTheme.colors.success : activeTheme.colors.border}`,
              backgroundColor: isLive ? activeTheme.colors.successSubtle : activeTheme.colors.surface,
              color: isLive ? activeTheme.colors.successText : activeTheme.colors.textSecondary,
              fontWeight: 600, cursor: 'pointer', fontSize: '0.72rem',
              display: 'flex', alignItems: 'center', gap: '0.35rem',
            }}>
              <span style={{
                width: '7px', height: '7px', borderRadius: '50%',
                backgroundColor: isLive ? activeTheme.colors.success : activeTheme.colors.textMuted,
                display: 'inline-block',
                animation: isLive ? 'pulse 1.4s ease-in-out infinite' : 'none',
              }} />
              {isLive ? 'Stop Sim' : 'Simulate'}
            </button>
          )}

          <ConnectionBadge state={connectionState} />

          {compiled && currentIntent && !hypotheticalIntent && (
            <button onClick={onBranchHypothetical} title="Create an isolated what-if branch from the current intent" style={{
              padding: '0.375rem 0.75rem', borderRadius: activeTheme.radius.md,
              border: `1px solid ${activeTheme.colors.accent}`, backgroundColor: activeTheme.colors.surface,
              color: activeTheme.colors.accent, fontWeight: 600, cursor: 'pointer', fontSize: '0.72rem',
              display: 'flex', alignItems: 'center', gap: '0.35rem',
            }}>
              <GitBranch size={14} /> Branch
            </button>
          )}

          {compiled && <DensitySelector agentRecommended={compiled.density} />}

          {/* Theme picker */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', borderLeft: `1px solid ${activeTheme.colors.border}`, paddingLeft: '0.75rem' }}>
            <label style={{ fontSize: '0.72rem', color: activeTheme.colors.textSecondary, fontWeight: 600, whiteSpace: 'nowrap' }}>🎨 Theme:</label>
            <select value={activeTheme.id} onChange={(e) => {
              const found = ALL_THEMES.find((t) => t.id === e.target.value);
              if (found) onThemeChange(found);
            }} style={{
              padding: '0.3rem 0.5rem', borderRadius: activeTheme.radius.md,
              border: `1px solid ${activeTheme.colors.border}`,
              backgroundColor: activeTheme.colors.surface, color: activeTheme.colors.text,
              fontSize: '0.75rem', fontWeight: 500, cursor: 'pointer',
            }}>
              {ALL_THEMES.map((t) => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
          </div>
        </div>
      </header>

      {/* Version warning banner */}
      {versionWarning && (
        <div style={{
          backgroundColor: '#fef9c3', borderBottom: '1px solid #fde047',
          padding: '0.5rem 2rem', fontSize: '0.8rem', color: '#854d0e',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}><AlertTriangle size={14} /> Schema version: {versionWarning}</span>
          <button onClick={onDismissWarning} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#854d0e', fontWeight: 700, display: 'flex', alignItems: 'center' }}><X size={14} /></button>
        </div>
      )}
    </>
  );
}

// ─── Connection badge ─────────────────────────────────────────────────────────

function ConnectionBadge({ state }: { state: string }) {
  const cfg: Record<string, { dot: string; label: string; text: string }> = {
    connected:    { dot: '#22c55e', label: 'Connected',    text: '#86efac' },
    connecting:   { dot: '#f59e0b', label: 'Connecting…',  text: '#fcd34d' },
    reconnecting: { dot: '#f59e0b', label: 'Reconnecting', text: '#fcd34d' },
    disconnected: { dot: '#94a3b8', label: 'Disconnected', text: '#94a3b8' },
    idle:         { dot: '#94a3b8', label: 'Idle',         text: '#94a3b8' },
    error:        { dot: '#ef4444', label: 'Error',        text: '#fca5a5' },
  };
  const { dot, label, text } = cfg[state] ?? cfg.idle;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.7rem', color: text }}>
      <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: dot, display: 'inline-block' }} />
      {label}
    </div>
  );
}
