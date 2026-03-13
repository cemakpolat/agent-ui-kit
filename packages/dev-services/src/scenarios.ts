/**
 * Fixture scenarios for dev-services.
 * These are minimal valid HARI intent payloads that demonstrate different intent types.
 */

export type ScenarioId =
  | 'travel'
  | 'cloudops'
  | 'iot'
  | 'document-sre'
  | 'form-deployment'
  | 'product-analysis'
  | 'calendar-oncall'
  | 'chat-support'
  | 'timeline-deployments'
  | 'workflow-onboarding'
  | 'kanban-sprint'
  | 'tree-org-chart'
  | 'map-fleet';

export interface Scenario {
  id: ScenarioId;
  name: string;
  description: string;
  intent: Record<string, unknown>;
}

/**
 * Simple UUID-like string generator
 */
function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Create a minimal valid HARI intent
 * The actual payload structure will be compiled by the frontend
 */
function createIntent(
  type: string,
  domain: string,
  title: string,
  extras: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    version: '1.0.0',
    intentId: generateId(),
    type,
    domain,
    title,
    primaryGoal: title,
    confidence: 0.85,
    ambiguities: [],
    actions: [],
    explainability: null,
    metadata: {
      source: 'dev-service',
      timestamp: Date.now(),
    },
    ...extras,
  };
}

export const SCENARIOS: Record<ScenarioId, Scenario> = {
  travel: {
    id: 'travel',
    name: 'Travel Comparison',
    description: 'Multi-leg flight comparison',
    intent: createIntent('comparison', 'travel', 'Flight Options: NYC → SFO'),
  },

  cloudops: {
    id: 'cloudops',
    name: 'CloudOps Diagnostics',
    description: 'Production incident triage',
    intent: createIntent('diagnostic', 'cloudops', 'Prod Incident: High API Latency'),
  },

  iot: {
    id: 'iot',
    name: 'IoT Sensor Diagnostics',
    description: 'Edge device sensor health',
    intent: createIntent('diagnostic', 'iot', 'Warehouse Sensor Array Health'),
  },

  'document-sre': {
    id: 'document-sre',
    name: 'SRE Documentation',
    description: 'Incident response runbook',
    intent: createIntent('document', 'sre', 'Incident Response Runbook: High Memory'),
  },

  'form-deployment': {
    id: 'form-deployment',
    name: 'Deployment Form',
    description: 'Service deployment config',
    intent: createIntent('form', 'devops', 'Deploy Service v2.1.0'),
  },

  'product-analysis': {
    id: 'product-analysis',
    name: 'Product Analysis',
    description: 'Feature adoption metrics',
    intent: createIntent('document', 'product', 'Feature: Dark Mode Adoption'),
  },

  'calendar-oncall': {
    id: 'calendar-oncall',
    name: 'On-Call Calendar',
    description: 'Team on-call rotation',
    intent: createIntent('calendar', 'engineering', 'On-Call Rotation - Q1 2026'),
  },

  'chat-support': {
    id: 'chat-support',
    name: 'Support Chat',
    description: 'Customer support thread',
    intent: createIntent('chat', 'support', 'Chat: Billing Question'),
  },

  'timeline-deployments': {
    id: 'timeline-deployments',
    name: 'Deployment Timeline',
    description: 'Service deployment history',
    intent: createIntent('timeline', 'engineering', 'API Gateway Deployment History'),
  },

  'workflow-onboarding': {
    id: 'workflow-onboarding',
    name: 'Onboarding Workflow',
    description: 'New hire onboarding',
    intent: createIntent('workflow', 'hr', 'Onboarding: Alice Chen'),
  },

  'kanban-sprint': {
    id: 'kanban-sprint',
    name: 'Sprint Board',
    description: 'Kanban sprint board',
    intent: createIntent('kanban', 'engineering', 'Sprint 17 - Q1 Planning'),
  },

  'tree-org-chart': {
    id: 'tree-org-chart',
    name: 'Org Chart',
    description: 'Organizational structure',
    intent: createIntent('tree', 'hr', 'Company Org Chart'),
  },

  'map-fleet': {
    id: 'map-fleet',
    name: 'Fleet Map',
    description: 'Fleet & warehouse locations',
    intent: createIntent('map', 'logistics', 'Fleet & Warehouse Overview'),
  },
};

/**
 * Get a scenario by ID
 */
export function getScenario(id: ScenarioId | string): Scenario {
  const scenario = SCENARIOS[id as ScenarioId];
  return scenario || SCENARIOS.travel;
}

/**
 * List all available scenario IDs
 */
export function listScenarios(): ScenarioId[] {
  return Object.keys(SCENARIOS) as ScenarioId[];
}

