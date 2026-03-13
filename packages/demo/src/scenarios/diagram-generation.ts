import { v4 as uuid } from 'uuid';
import type { IntentPayloadInput } from '@hari/core';
import {
  generateOrgChart,
  generateFlowchart,
  generateSequenceDiagram,
  type OrgChartNode,
  type FlowchartNode,
  type FlowchartEdge,
  type SequenceActor,
  type SequenceMessage,
} from '@hari/core';

// ─────────────────────────────────────────────────────────────────────────────
// Diagram scenario: "Engineering Organization & Team Structure"
//
// Demonstrates diagram generation utilities:
//   1. Organization Chart (Mermaid generated from nodes)
//   2. Deployment Flowchart (CI/CD process)
//   3. Request Sequence (API interaction flow)
// ─────────────────────────────────────────────────────────────────────────────

// ── 1. Organization Chart ─────────────────────────────────────────────────────

const orgNodes: OrgChartNode[] = [
  {
    id: 'cto',
    label: 'Chief Technology Officer',
    title: 'Strategic Leadership',
    icon: '👔',
    color: '#1e3a8a',
  },
  {
    id: 'vp_eng',
    label: 'VP Engineering',
    title: 'HARI Platform',
    icon: '🏢',
    color: '#075985',
    parent: 'cto',
    team: 'Platform',
  },
  {
    id: 'core_lead',
    label: 'Core Systems Lead',
    title: 'Runtime & Contracts',
    icon: '⚙️',
    color: '#0891b2',
    parent: 'vp_eng',
    team: 'Core',
  },
  {
    id: 'ui_lead',
    label: 'UI/UX Systems Lead',
    title: 'Components & Design',
    icon: '🎨',
    color: '#7c3aed',
    parent: 'vp_eng',
    team: 'UI',
  },
  {
    id: 'devops_lead',
    label: 'DevOps/Infrastructure Lead',
    title: 'Services & Deployment',
    icon: '🚀',
    color: '#059669',
    parent: 'vp_eng',
    team: 'DevOps',
  },
  {
    id: 'core_eng1',
    label: 'Senior TypeScript Engineer',
    title: 'Schema Architecture',
    icon: '💻',
    color: '#0891b2',
    parent: 'core_lead',
    team: 'Core',
  },
  {
    id: 'core_eng2',
    label: 'Engineer',
    title: 'Compiler & Validation',
    icon: '💻',
    color: '#0891b2',
    parent: 'core_lead',
    team: 'Core',
  },
  {
    id: 'core_eng3',
    label: 'Engineer',
    title: 'State Management',
    icon: '💻',
    color: '#0891b2',
    parent: 'core_lead',
    team: 'Core',
  },
  {
    id: 'ui_eng1',
    label: 'Senior React Engineer',
    title: 'Component Library',
    icon: '⚛️',
    color: '#7c3aed',
    parent: 'ui_lead',
    team: 'UI',
  },
  {
    id: 'ui_eng2',
    label: 'Engineer',
    title: 'Theme & Accessibility',
    icon: '⚛️',
    color: '#7c3aed',
    parent: 'ui_lead',
    team: 'UI',
  },
  {
    id: 'ui_eng3',
    label: 'Engineer',
    title: 'Intent-Driven UI',
    icon: '⚛️',
    color: '#7c3aed',
    parent: 'ui_lead',
    team: 'UI',
  },
  {
    id: 'devops_eng1',
    label: 'Senior DevOps Engineer',
    title: 'MCP/SSE/WebSocket',
    icon: '🔧',
    color: '#059669',
    parent: 'devops_lead',
    team: 'DevOps',
  },
  {
    id: 'devops_eng2',
    label: 'Engineer',
    title: 'Containerization',
    icon: '🐳',
    color: '#059669',
    parent: 'devops_eng1',
    team: 'DevOps',
  },
  {
    id: 'devops_eng3',
    label: 'Engineer',
    title: 'Telemetry & Observability',
    icon: '📊',
    color: '#059669',
    parent: 'devops_eng1',
    team: 'DevOps',
  },
];

const orgChartMarkup = generateOrgChart({
  nodes: orgNodes,
  direction: 'TD',
  showTeams: true,
});

// ── 2. Deployment Flowchart ───────────────────────────────────────────────────

const deployNodes: FlowchartNode[] = [
  { id: 'dev', label: 'Developer\nPushes Code', shape: 'circle', color: '#e0e7ff' },
  { id: 'lint', label: 'Lint & Type Check', shape: 'rect', color: '#dbeafe' },
  { id: 'test', label: 'Run Test Suite', shape: 'rect', color: '#dbeafe' },
  { id: 'build', label: 'Build Artifacts', shape: 'rect', color: '#dbeafe' },
  { id: 'decision', label: 'Tests\nPassed?', shape: 'diamond', color: '#fef3c7' },
  { id: 'deploy_dev', label: 'Deploy to Dev', shape: 'rect', color: '#dcfce7' },
  { id: 'smoke', label: 'Smoke Tests', shape: 'rect', color: '#dbeafe' },
  { id: 'deploy_prod', label: 'Deploy to Prod', shape: 'rect', color: '#dcfce7' },
  { id: 'monitor', label: 'Monitor & Alert', shape: 'rect', color: '#dcfce7' },
  { id: 'failed', label: 'Build Failed\nNotify Team', shape: 'parallelogram', color: '#fee2e2' },
  { id: 'success', label: 'Release Complete', shape: 'circle', color: '#dcfce7' },
];

const deployEdges: FlowchartEdge[] = [
  { from: 'dev', to: 'lint' },
  { from: 'lint', to: 'test' },
  { from: 'test', to: 'build' },
  { from: 'build', to: 'decision' },
  { from: 'decision', to: 'deploy_dev', label: 'Yes' },
  { from: 'decision', to: 'failed', label: 'No', style: 'dashed' },
  { from: 'deploy_dev', to: 'smoke' },
  { from: 'smoke', to: 'deploy_prod' },
  { from: 'deploy_prod', to: 'monitor' },
  { from: 'monitor', to: 'success' },
  { from: 'failed', to: 'lint', style: 'dashed', label: 'Fix & Retry' },
];

const deployChartMarkup = generateFlowchart({
  nodes: deployNodes,
  edges: deployEdges,
  direction: 'TD',
});

// ── 3. Request Sequence Diagram ───────────────────────────────────────────────

const seqActors: SequenceActor[] = [
  { id: 'user', label: 'User', type: 'actor' },
  { id: 'browser', label: 'Browser', type: 'participant' },
  { id: 'gw', label: 'API Gateway', type: 'participant' },
  { id: 'auth', label: 'Auth Service', type: 'participant' },
  { id: 'api', label: 'Core API', type: 'participant' },
  { id: 'db', label: 'Database', type: 'participant' },
];

const seqMessages: SequenceMessage[] = [
  { from: 'user', to: 'browser', label: 'Click Action', arrowType: 'sync' },
  { from: 'browser', to: 'gw', label: 'POST /api/action (JWT)', arrowType: 'sync' },
  { from: 'gw', to: 'auth', label: 'Verify Token', arrowType: 'sync' },
  { from: 'auth', to: 'gw', label: 'Token Valid', arrowType: 'return' },
  { from: 'gw', to: 'api', label: 'Forward Request', arrowType: 'sync' },
  { from: 'api', to: 'db', label: 'Execute Query', arrowType: 'sync' },
  { from: 'db', to: 'api', label: 'Result', arrowType: 'return' },
  { from: 'api', to: 'gw', label: 'Response 200 OK', arrowType: 'return' },
  { from: 'gw', to: 'browser', label: 'JSON Response', arrowType: 'return' },
  { from: 'browser', to: 'user', label: 'Render UI', arrowType: 'async' },
];

const seqDiagramMarkup = generateSequenceDiagram({
  title: 'User Request Flow',
  actors: seqActors,
  messages: seqMessages,
});

// ─────────────────────────────────────────────────────────────────────────────
// Intent Payload
// ─────────────────────────────────────────────────────────────────────────────

export const diagramGenerationIntent: IntentPayloadInput = {
  version: '1.0.0',
  intentId: uuid(),
  type: 'diagram',
  domain: 'engineering',
  primaryGoal:
    'Visualise team structure, deployment process, and request flow using programmatically generated diagrams',
  confidence: 0.98,
  density: 'operator',

  data: {
    title: 'Engineering Organization & Team Structure',
    description:
      'Three complementary views generated using the diagram generator: ' +
      'team organizational chart with reporting lines, ' +
      'CI/CD deployment flowchart, ' +
      'and typical user request sequence through the system.',

    diagrams: [
      // ── 1. Org Chart ──────────────────────────────────────────────────────
      {
        id: 'org-chart',
        kind: 'mermaid',
        title: 'Engineering Organization Chart (Generated)',
        markup: orgChartMarkup,
        caption:
          'Reporting structure: VP Engineering oversees three teams (Core Systems, UI/UX, DevOps). ' +
          'Each team has a lead and engineers specializing in different domains.',
      },

      // ── 2. Deployment Flowchart ──────────────────────────────────────────
      {
        id: 'deployment-flow',
        kind: 'mermaid',
        title: 'CI/CD Deployment Pipeline (Generated)',
        markup: deployChartMarkup,
        caption:
          'Automated pipeline: code push → lint → test → build → smoke test → production deploy → monitoring. ' +
          'Failed tests trigger notifications and allow retry.',
      },

      // ── 3. Request Sequence ───────────────────────────────────────────────
      {
        id: 'request-sequence',
        kind: 'mermaid',
        title: 'User Request Sequence (Generated)',
        markup: seqDiagramMarkup,
        caption:
          'End-to-end interaction: user action triggers browser request → gateway → auth verification → ' +
          'core API → database query → response chain back to UI rendering.',
      },
    ],
  },
};
