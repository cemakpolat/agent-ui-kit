import React from 'react';
import type { IntentPayload, CompiledView } from '@hari/core';
import {
  IntentRenderer,
  IntentErrorBoundary,
  HypotheticalOverlay,
  HypotheticalCompare,
  SituationalViewRenderer,
  type Theme,
} from '@hari/ui';
import type { AgentBridge } from '@hari/core';
import {
  governanceSituationalView,
  governanceQuestion,
  governanceAuthority,
  governanceActions,
  governanceDecisionRecords,
  governanceTemporalLens,
  governanceUncertainty,
} from '../scenarios/governance-incident';
import {
  deploymentSituationalView,
  deploymentQuestion,
  deploymentAuthority,
  deploymentActions,
  deploymentDecisionRecords,
  deploymentTemporalLens,
  deploymentUncertainty,
} from '../scenarios/governance-deployment';
import {
  financeSituationalView,
  financeQuestion,
  financeAuthority,
  financeActions,
  financeDecisionRecords,
  financeTemporalLens,
  financeUncertainty,
} from '../scenarios/governance-finance';
import {
  securitySituationalView,
  securityQuestion,
  securityAuthority,
  securityActions,
  securityDecisionRecords,
  securityTemporalLens,
  securityUncertainty,
} from '../scenarios/governance-security';
import { OllamaPanel } from './OllamaPanel';
import { registry } from '../registry';

// ─────────────────────────────────────────────────────────────────────────────
// MainStage — left column of the demo view.
// Renders the compiled intent via IntentRenderer or SituationalViewRenderer,
// plus hypothetical overlays and the Ollama panel.
// ─────────────────────────────────────────────────────────────────────────────

const GOVERNANCE_SCENARIOS = new Set(['governance', 'govdeploy', 'govfinance', 'govsecurity']);

export interface MainStageProps {
  activeScenario: string;
  compiled: CompiledView | null;
  currentIntent: IntentPayload | null;
  hypotheticalIntent: IntentPayload | null;
  connectionState: string;
  bridge: AgentBridge;
  activeTheme: Theme;
  // Hypothetical
  hypotheticalQuery: string | null;
  onDismissHypothetical: () => void;
  // Callbacks
  onActionExecute: (actionId: string) => void;
  onAmbiguityChange: (controlId: string, value: unknown) => void;
  onWhatIf: (query: string) => void;
  addLog: (msg: string) => void;
}

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

export function MainStage({
  activeScenario,
  compiled,
  currentIntent,
  hypotheticalIntent,
  connectionState,
  bridge,
  activeTheme,
  hypotheticalQuery,
  onDismissHypothetical,
  onActionExecute,
  onAmbiguityChange,
  onWhatIf,
  addLog,
}: MainStageProps) {
  const isGovernance = GOVERNANCE_SCENARIOS.has(activeScenario);

  const getGovernanceProps = () => {
    switch (activeScenario) {
      case 'govdeploy':
        return { view: deploymentSituationalView, question: deploymentQuestion, authority: deploymentAuthority, actions: deploymentActions, records: deploymentDecisionRecords, temporal: deploymentTemporalLens, uncertainty: deploymentUncertainty };
      case 'govfinance':
        return { view: financeSituationalView, question: financeQuestion, authority: financeAuthority, actions: financeActions, records: financeDecisionRecords, temporal: financeTemporalLens, uncertainty: financeUncertainty };
      case 'govsecurity':
        return { view: securitySituationalView, question: securityQuestion, authority: securityAuthority, actions: securityActions, records: securityDecisionRecords, temporal: securityTemporalLens, uncertainty: securityUncertainty };
      default:
        return { view: governanceSituationalView, question: governanceQuestion, authority: governanceAuthority, actions: governanceActions, records: governanceDecisionRecords, temporal: governanceTemporalLens, uncertainty: governanceUncertainty };
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Intent header */}
      {compiled && (
        <div style={{ backgroundColor: activeTheme.colors.surface, borderRadius: activeTheme.radius.lg, padding: '1rem 1.25rem', border: `1px solid ${activeTheme.colors.border}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <div style={{ fontSize: '0.65rem', color: activeTheme.colors.textMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {compiled.domain} / {compiled.type}
              </div>
              <h2 style={{ margin: '0.25rem 0 0', fontSize: '1.0625rem', fontWeight: 700, color: activeTheme.colors.text }}>
                {compiled.primaryGoal}
              </h2>
            </div>
            <ConfidencePill confidence={compiled.confidence} />
          </div>
        </div>
      )}

      {/* Main content — error-bounded */}
      <IntentErrorBoundary fallbackData={compiled?.data} domain={compiled?.domain} intentType={compiled?.type}>
        <div style={{ backgroundColor: activeTheme.colors.surface, borderRadius: activeTheme.radius.lg, padding: '1.25rem', border: `1px solid ${activeTheme.colors.border}` }}>
          {compiled && isGovernance ? (() => {
            const g = getGovernanceProps();
            return (
              <SituationalViewRenderer
                view={g.view}
                compiledView={compiled}
                question={g.question}
                questionStatus="answered"
                authority={g.authority}
                governedActions={g.actions}
                decisionRecords={g.records}
                temporalLens={g.temporal}
                uncertainty={g.uncertainty}
                onActionExecute={onActionExecute}
                onAmbiguityChange={onAmbiguityChange}
                onWhatIf={onWhatIf}
                onAuthorityChange={(mode, reason, justification) => addLog(`[${activeScenario}] Authority → ${mode} (${reason})${justification ? ': ' + justification : ''}`)}
                onGovernedDecision={(actionId, outcome, rationale) => addLog(`[${activeScenario}] ${actionId} → ${outcome}${rationale ? ': ' + rationale : ''}`)}
                onEscalate={() => addLog(`[${activeScenario}] Escalation requested`)}
                onFollowUp={(q) => addLog(`[${activeScenario}] Follow-up: ${q}`)}
                onMarkAdequate={() => addLog(`[${activeScenario}] Answer marked adequate`)}
                onRefine={(q) => addLog(`[${activeScenario}] Refined question: ${q}`)}
                onLensChange={(lens) => addLog(`[${activeScenario}] Temporal lens → ${lens}`)}
              />
            );
          })() : compiled ? (
            <IntentRenderer
              compiledView={compiled}
              onActionExecute={onActionExecute}
              onAmbiguityChange={onAmbiguityChange}
              onWhatIf={onWhatIf}
            />
          ) : (
            <div style={{ color: activeTheme.colors.textMuted, textAlign: 'center', padding: '2rem' }}>
              {connectionState === 'connecting' ? 'Connecting to agent…' : 'Loading intent…'}
            </div>
          )}
        </div>
      </IntentErrorBoundary>

      {/* Ollama Interactive Panel */}
      {activeScenario === 'ollama' && <OllamaPanel />}

      {/* Hypothetical overlay */}
      {hypotheticalQuery && !hypotheticalIntent && (
        <HypotheticalOverlay
          query={hypotheticalQuery}
          onDismiss={onDismissHypothetical}
          bridge={connectionState === 'connected' ? bridge : undefined}
          intentSnapshot={currentIntent ?? undefined}
        />
      )}

      {/* Hypothetical branch compare */}
      {hypotheticalIntent && (
        <HypotheticalCompare
          registry={registry}
          onCommit={() => addLog('[hypothetical] Branch committed → became currentIntent')}
          onRollback={() => addLog('[hypothetical] Branch rolled back → discarded')}
        />
      )}
    </div>
  );
}
