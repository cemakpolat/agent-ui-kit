import React from 'react';
import type { IntentPayloadInput } from '@hari/core';
import {
  Plane, Server, Radio, FileText, Settings, BarChart2,
  Calendar, Network, Clock, Compass, Kanban, MessageSquare,
  PenTool, Mic, Edit3, Brain, GitBranch, CheckCircle2,
  AlertTriangle, Zap, MapPin,
} from 'lucide-react';

import { travelIntent } from '../scenarios/travel';
import { cloudopsIntent } from '../scenarios/cloudops';
import { iotIntent } from '../scenarios/iot';
import { documentIntent } from '../scenarios/document';
import { formDeploymentIntent } from '../scenarios/form-deployment';
import { documentProductAnalysisIntent } from '../scenarios/document-product-analysis';
import { calendarOnCallIntent } from '../scenarios/calendar-oncall';
import { treeOrgChartIntent } from '../scenarios/tree-org-chart';
import { timelineDeploymentsIntent } from '../scenarios/timeline-deployments';
import { workflowOnboardingIntent } from '../scenarios/workflow-onboarding';
import { kanbanSprintIntent } from '../scenarios/kanban-sprint';
import { kanbanProjectWorkflowIntent } from '../scenarios/kanban-project-workflow';
import { chatSupportIntent } from '../scenarios/chat-support';
import { diagramArchitectureIntent } from '../scenarios/diagram-architecture';
import { diagramGenerationIntent } from '../scenarios/diagram-generation';
import { mapFleetIntent } from '../scenarios/map-fleet';
import { formVoiceReportIntent } from '../scenarios/form-voice-report';
import { documentCollaborativeIntent } from '../scenarios/document-collaborative';
import { ollamaInteractiveIntent } from '../scenarios/ollama-interactive';
import {
  governanceRenderContract,
} from '../scenarios/governance-incident';
import {
  deploymentRenderContract,
} from '../scenarios/governance-deployment';
import {
  financeRenderContract,
} from '../scenarios/governance-finance';
import {
  securityRenderContract,
} from '../scenarios/governance-security';

// ─────────────────────────────────────────────────────────────────────────────
// Scenario registry — all demo scenarios in one place
// ─────────────────────────────────────────────────────────────────────────────

export const SCENARIOS: Record<string, { label: string; intent: IntentPayloadInput; icon: React.ReactNode }> = {
  travel:       { label: 'Travel',        icon: <Plane size={14} />,           intent: travelIntent },
  cloudops:     { label: 'CloudOps',      icon: <Server size={14} />,          intent: cloudopsIntent },
  iot:          { label: 'IoT',           icon: <Radio size={14} />,           intent: iotIntent },
  document:     { label: 'SRE Post-Mortem', icon: <FileText size={14} />,      intent: documentIntent },
  form:         { label: 'Deploy Config', icon: <Settings size={14} />,        intent: formDeploymentIntent },
  analysis:     { label: 'Product Analysis', icon: <BarChart2 size={14} />,    intent: documentProductAnalysisIntent },
  calendar:     { label: 'On-Call Schedule', icon: <Calendar size={14} />,     intent: calendarOnCallIntent },
  tree:         { label: 'Org Chart',     icon: <Network size={14} />,         intent: treeOrgChartIntent },
  timeline:     { label: 'Deploy History', icon: <Clock size={14} />,          intent: timelineDeploymentsIntent },
  workflow:     { label: 'Onboarding',    icon: <Compass size={14} />,         intent: workflowOnboardingIntent },
  kanban:       { label: 'Sprint Board',  icon: <Kanban size={14} />,          intent: kanbanSprintIntent },
  kanbanwf:     { label: 'Project Workflow', icon: <Kanban size={14} />,       intent: kanbanProjectWorkflowIntent },
  chat:         { label: 'Support Chat',  icon: <MessageSquare size={14} />,   intent: chatSupportIntent },
  diagram:      { label: 'Architecture',  icon: <PenTool size={14} />,        intent: diagramArchitectureIntent },
  diagrams:     { label: 'Team Structure (Generated)', icon: <Network size={14} />, intent: diagramGenerationIntent },
  map:          { label: 'Fleet Map',     icon: <MapPin size={14} />,          intent: mapFleetIntent },
  voice:        { label: 'Voice Report',  icon: <Mic size={14} />,            intent: formVoiceReportIntent },
  collab:       { label: 'Live Edit (ADR)', icon: <Edit3 size={14} />,        intent: documentCollaborativeIntent },
  ollama:       { label: 'Ollama Interactive', icon: <Brain size={14} />,      intent: ollamaInteractiveIntent },
  governance:   { label: 'Governance Demo', icon: <Zap size={14} />,           intent: governanceRenderContract as IntentPayloadInput },
  govdeploy:    { label: 'Deploy Approval', icon: <GitBranch size={14} />,     intent: deploymentRenderContract as IntentPayloadInput },
  govfinance:   { label: 'Finance Escalation', icon: <AlertTriangle size={14} />, intent: financeRenderContract as IntentPayloadInput },
  govsecurity:  { label: 'Security Emergency', icon: <CheckCircle2 size={14} />,  intent: securityRenderContract as IntentPayloadInput },
};

export interface ScenarioSidebarProps {
  activeScenario: string;
  onSelectScenario: (key: string) => void;
  theme: import('@hari/ui').Theme;
}

export function ScenarioSidebar({ activeScenario, onSelectScenario, theme }: ScenarioSidebarProps) {
  return (
    <div style={{ display: 'flex', gap: '0.375rem' }}>
      {Object.entries(SCENARIOS).map(([key, { label, icon }]) => (
        <button key={key} onClick={() => onSelectScenario(key)} style={{
          padding: '0.375rem 0.875rem', borderRadius: theme.radius.md, border: 'none',
          backgroundColor: activeScenario === key ? theme.colors.accent : theme.colors.surface,
          color: activeScenario === key ? theme.colors.accentText : theme.colors.textSecondary,
          fontWeight: activeScenario === key ? 700 : 400,
          cursor: 'pointer', fontSize: '0.8rem',
          display: 'flex', alignItems: 'center', gap: '0.35rem',
        }}>
          {icon} {label}
        </button>
      ))}
    </div>
  );
}
