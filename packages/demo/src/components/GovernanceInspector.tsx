import React from 'react';
import type { IntentPayload } from '@hari/core';
import type { CompiledView } from '@hari/core';
import { useTheme, ThemeShowcase, type Theme } from '@hari/ui';
import { createCollaborator } from '@hari/core';
import {
  CheckCircle2, AlertTriangle, Undo, Trash2, Plus, X,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// GovernanceInspector — right column of the demo view.
// Panels: Schema, Intent Payload, Negotiation Log, Snapshots, Collaborators,
// Architecture Notes.
// ─────────────────────────────────────────────────────────────────────────────

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  const { theme } = useTheme();
  return (
    <div style={{ backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, border: `1px solid ${theme.colors.border}`, overflow: 'hidden' }}>
      <div style={{ padding: '0.5rem 1rem', backgroundColor: theme.colors.surfaceAlt, borderBottom: `1px solid ${theme.colors.border}`, fontSize: '0.65rem', fontWeight: 700, color: theme.colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        {title}
      </div>
      <div style={{ padding: '0.75rem 1rem', color: theme.colors.text }}>{children}</div>
    </div>
  );
}

export interface GovernanceInspectorProps {
  compiled: CompiledView | null;
  currentIntent: IntentPayload | null;
  densityOverride: string | null;
  log: string[];
  activeTheme: Theme;
  // Snapshots
  snapshots: Record<string, { snapshotId: string; label: string; createdAt: string; changedKeys: string[] }>;
  onCreateSnapshot: (label: string) => void;
  onRestoreSnapshot: (id: string) => void;
  onDeleteSnapshot: (id: string) => void;
  onExportSnapshots: () => string;
  // Collaborators
  collaborators: Array<{ collaboratorId: string; displayName: string; color: string; focusedDataKey?: string; currentAction?: string }>;
  onAddCollaborator: (collab: ReturnType<typeof createCollaborator>) => void;
  onRemoveCollaborator: (id: string) => void;
  // Logging
  addLog: (msg: string) => void;
}

export function GovernanceInspector({
  compiled,
  currentIntent,
  densityOverride,
  log,
  activeTheme,
  snapshots,
  onCreateSnapshot,
  onRestoreSnapshot,
  onDeleteSnapshot,
  onExportSnapshots,
  collaborators,
  onAddCollaborator,
  onRemoveCollaborator,
  addLog,
}: GovernanceInspectorProps) {
  const [snapshotLabel, setSnapshotLabel] = React.useState('');
  const [testCollaboratorName, setTestCollaboratorName] = React.useState('');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Theme & icon showcase */}
      <ThemeShowcase />

      {/* Schema & capability */}
      {compiled && (
        <Panel title="Schema & Capabilities">
          <div style={{ fontSize: '0.75rem', color: 'var(--hari-text-secondary)', lineHeight: '1.7' }}>
            <div><strong>Version:</strong> {currentIntent?.version}</div>
            <div><strong>Domain:</strong> {compiled.domain}</div>
            <div><strong>Density:</strong> {compiled.density}{densityOverride ? ' (user)' : ' (agent)'}</div>
            <div><strong>Component:</strong> {compiled.resolvedComponent ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}><CheckCircle2 size={12} /> resolved</span> : <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}><AlertTriangle size={12} /> fallback</span>}</div>
            <div><strong>Ambiguities:</strong> {compiled.ambiguities.length}</div>
            <div><strong>Actions:</strong> {compiled.actions.length}</div>
            <div><strong>Explain panels:</strong> {Object.keys(compiled.explainability).length}</div>
          </div>
        </Panel>
      )}

      {/* Intent payload */}
      <Panel title="Active Intent Payload">
        <pre style={{ margin: 0, fontSize: '0.62rem', color: 'var(--hari-text-secondary)', fontFamily: 'var(--hari-font-mono)', overflowX: 'auto', overflowY: 'auto', maxHeight: '220px', whiteSpace: 'pre-wrap' }}>
          {currentIntent
            ? JSON.stringify({ ...currentIntent, data: '[omitted]', explainability: '[omitted]' }, null, 2)
            : 'null'}
        </pre>
      </Panel>

      {/* Negotiation log */}
      <Panel title="Negotiation Log">
        <div style={{ fontFamily: 'var(--hari-font-mono)', fontSize: '0.68rem', maxHeight: '220px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
          {log.length === 0 ? (
            <span style={{ color: 'var(--hari-text-muted)' }}>No events yet</span>
          ) : (
            log.map((entry, i) => (
              <div key={i} style={{
                color: entry.startsWith('[error]')   ? '#dc2626'
                     : entry.startsWith('[warn]')    ? '#a16207'
                     : entry.includes('[bridge]')    ? '#0369a1'
                     : entry.includes('[agent]')     ? '#7c3aed'
                     : entry.includes('[user]')      ? '#0f766e'
                     : '#475569',
              }}>
                {entry}
              </div>
            ))
          )}
        </div>
      </Panel>

      {/* Snapshots */}
      <Panel title="Snapshots (v0.5.1)">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="text"
              placeholder="Name this snapshot…"
              value={snapshotLabel}
              onChange={(e) => setSnapshotLabel(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && snapshotLabel.trim()) {
                  onCreateSnapshot(snapshotLabel);
                  addLog(`[snapshot] Created: "${snapshotLabel}"`);
                  setSnapshotLabel('');
                }
              }}
              style={{
                flex: 1, padding: '0.375rem 0.5rem', borderRadius: activeTheme.radius.md,
                border: `1px solid ${activeTheme.colors.border}`, backgroundColor: activeTheme.colors.surface,
                color: activeTheme.colors.text, fontSize: '0.73rem', fontFamily: activeTheme.typography.familyMono,
              }}
            />
            <button onClick={() => {
              if (snapshotLabel.trim()) {
                onCreateSnapshot(snapshotLabel);
                addLog(`[snapshot] Created: "${snapshotLabel}"`);
                setSnapshotLabel('');
              }
            }} style={{
              padding: '0.375rem 0.625rem', borderRadius: activeTheme.radius.md,
              border: `1px solid ${activeTheme.colors.accent}`, backgroundColor: activeTheme.colors.accentSubtle,
              color: activeTheme.colors.accent, fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer',
            }}>
              Save
            </button>
            <button onClick={() => {
              const json = onExportSnapshots();
              const blob = new Blob([json], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url; a.download = `snapshots-${Date.now()}.json`; a.click();
              URL.revokeObjectURL(url);
              addLog('[snapshot] Exported JSON');
            }} style={{
              padding: '0.375rem 0.625rem', borderRadius: activeTheme.radius.md,
              border: `1px solid ${activeTheme.colors.accent}`, backgroundColor: activeTheme.colors.accentSubtle,
              color: activeTheme.colors.accent, fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer',
            }}>
              Export
            </button>
          </div>
          <div style={{ maxHeight: '150px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            {Object.values(snapshots).length === 0 ? (
              <span style={{ fontSize: '0.7rem', color: activeTheme.colors.textMuted }}>No snapshots yet</span>
            ) : (
              Object.values(snapshots)
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .map((snapshot) => (
                  <div key={snapshot.snapshotId} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '0.375rem 0.5rem', backgroundColor: activeTheme.colors.surfaceAlt,
                    borderRadius: activeTheme.radius.md, border: `1px solid ${activeTheme.colors.border}`, fontSize: '0.68rem',
                  }}>
                    <div>
                      <div style={{ fontWeight: 600, color: activeTheme.colors.text }}>{snapshot.label}</div>
                      <div style={{ color: activeTheme.colors.textSecondary, fontSize: '0.65rem' }}>
                        {new Date(snapshot.createdAt).toLocaleTimeString()} ({snapshot.changedKeys.length} changes)
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                      <button onClick={() => { onRestoreSnapshot(snapshot.snapshotId); addLog(`[snapshot] Restored: "${snapshot.label}"`); }} style={{
                        padding: '0.25rem 0.375rem', fontSize: '0.65rem', borderRadius: activeTheme.radius.sm,
                        border: `1px solid ${activeTheme.colors.accent}`, backgroundColor: 'transparent',
                        color: activeTheme.colors.accent, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem',
                      }}>
                        <Undo size={12} /> Restore
                      </button>
                      <button onClick={() => { onDeleteSnapshot(snapshot.snapshotId); addLog(`[snapshot] Deleted: "${snapshot.label}"`); }} style={{
                        padding: '0.25rem 0.375rem', fontSize: '0.65rem', borderRadius: activeTheme.radius.sm,
                        border: `1px solid ${activeTheme.colors.danger}`, backgroundColor: 'transparent',
                        color: activeTheme.colors.danger, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem',
                      }}>
                        <Trash2 size={12} /> Delete
                      </button>
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>
      </Panel>

      {/* Collaborators */}
      <Panel title="Collaborators (v0.5.2)">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="text"
              placeholder="Add test collaborator…"
              value={testCollaboratorName}
              onChange={(e) => setTestCollaboratorName(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && testCollaboratorName.trim()) {
                  const collab = createCollaborator(testCollaboratorName);
                  onAddCollaborator(collab);
                  addLog(`[presence] Added: "${testCollaboratorName}"`);
                  setTestCollaboratorName('');
                }
              }}
              style={{
                flex: 1, padding: '0.375rem 0.5rem', borderRadius: activeTheme.radius.md,
                border: `1px solid ${activeTheme.colors.border}`, backgroundColor: activeTheme.colors.surface,
                color: activeTheme.colors.text, fontSize: '0.73rem', fontFamily: activeTheme.typography.familyMono,
              }}
            />
            <button onClick={() => {
              if (testCollaboratorName.trim()) {
                const collab = createCollaborator(testCollaboratorName);
                onAddCollaborator(collab);
                addLog(`[presence] Added: "${testCollaboratorName}"`);
                setTestCollaboratorName('');
              }
            }} style={{
              padding: '0.375rem 0.625rem', borderRadius: activeTheme.radius.md,
              border: `1px solid ${activeTheme.colors.accent}`, backgroundColor: activeTheme.colors.accentSubtle,
              color: activeTheme.colors.accent, fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '0.25rem',
            }}>
              <Plus size={14} /> Add
            </button>
          </div>
          <div style={{ maxHeight: '150px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            {collaborators.length === 0 ? (
              <span style={{ fontSize: '0.7rem', color: activeTheme.colors.textMuted }}>No collaborators</span>
            ) : (
              collaborators.map((collab) => (
                <div key={collab.collaboratorId} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '0.375rem 0.5rem', backgroundColor: activeTheme.colors.surfaceAlt,
                  borderRadius: activeTheme.radius.md, border: `2px solid ${collab.color}`, fontSize: '0.68rem',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: '12px', height: '12px', borderRadius: '2px', backgroundColor: collab.color }} />
                    <div>
                      <div style={{ fontWeight: 600, color: activeTheme.colors.text }}>{collab.displayName}</div>
                      <div style={{ color: activeTheme.colors.textSecondary, fontSize: '0.65rem' }}>
                        {collab.focusedDataKey ? `on ${collab.focusedDataKey}` : 'no focus'} · {collab.currentAction || 'viewing'}
                      </div>
                    </div>
                  </div>
                  <button onClick={() => { onRemoveCollaborator(collab.collaboratorId); addLog(`[presence] Removed: "${collab.displayName}"`); }} style={{
                    padding: '0.25rem 0.375rem', fontSize: '0.65rem', borderRadius: activeTheme.radius.sm,
                    border: `1px solid ${activeTheme.colors.danger}`, backgroundColor: 'transparent',
                    color: activeTheme.colors.danger, cursor: 'pointer', display: 'flex', alignItems: 'center',
                  }}>
                    <X size={12} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </Panel>

      {/* Architecture notes */}
      <Panel title="Architecture Notes">
        <ul style={{ margin: 0, paddingLeft: '1.125rem', fontSize: '0.73rem', color: activeTheme.colors.textSecondary, lineHeight: '1.8' }}>
          <li>MockAgentBridge → full transport roundtrip</li>
          <li>loadScenario → 'intent' event → useAgentBridge → setIntent</li>
          <li>sendModification → 400 ms → re-emit updated intent</li>
          <li>queryWhatIf → HypotheticalOverlay (bridge or fallback)</li>
          <li>useMemo resolution — component + data always in sync</li>
          <li>Two stores: Intent (committed) + UI (ephemeral)</li>
          <li>12 scenarios: Travel, CloudOps, IoT, Doc, Form, Analysis, Calendar, OrgChart, Timeline, Workflow, Kanban, Chat</li>
          <li>FormWrapper: autoSave (localStorage) + isSubmitting state</li>
          <li>DocumentWrapper: search, TOC, PDF export, markdown export</li>
          <li>TimelineWrapper / WorkflowWrapper / KanbanWrapper registered</li>
          <li>CalendarWrapper: month/week/agenda, density-aware views</li>
          <li>TreeWrapper: expand/collapse, search, breadcrumb, status dots</li>
          <li>ChatWrapper: streaming support, attachments, role-aware bubbles</li>
          <li>IncidentFormWrapper: voice field type</li>
          <li>CollabDocumentWrapper: real-time OT-lite via BroadcastChannel + undo stack</li>
          <li>IoT / Form / Document = new domains, zero compiler changes</li>
          <li>Telemetry: opt-in singleton, events in Negotiation Log</li>
          <li>MCPAgentBridge: JSON-RPC 2.0 over WebSocket (Phase 4)</li>
        </ul>
      </Panel>
    </div>
  );
}
