/**
 * TestHub - Improved test interface for UI kit components
 *
 * Features:
 * - Feature-organized tabs showing all components
 * - Dynamic prompt input with default templates
 * - Real LLM integration (Ollama)
 * - Live rendering of generated components
 * - Individual or batch test execution
 * - Side-by-side prompt vs result view
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Download,
  AlertCircle,
  CheckCircle,
  Clock,
  Zap,
  Settings,
  RefreshCw,
  Bot,
  FlaskConical,
  Repeat,
  Square,
  MessageSquare,
  ListChecks,
} from 'lucide-react';
import { IntentRenderer, IntentErrorBoundary } from '@hari/ui';
import { compileIntent, IntentPayloadSchema } from '@hari/core';
import { registry } from '../registry';
import type { IntentPayloadInput } from '@hari/core';

// ─── Type-specific data templates for LLM prompt guidance ────────────────────
// Each template shows the LLM the exact required structure for the intent type.
const DATA_TEMPLATES: Record<string, { schema: string; example: object }> = {
  form: {
    schema: `{
  "title": "<form title>",
  "sections": [
    {
      "id": "s1",
      "title": "<section title>",
      "fields": [
        { "id": "f1", "type": "text", "label": "<label>", "required": true, "placeholder": "<hint>" },
        { "id": "f2", "type": "select", "label": "<label>", "options": [{ "value": "a", "label": "Option A" }, { "value": "b", "label": "Option B" }] },
        { "id": "f3", "type": "checkbox", "label": "<label>" }
      ],
      "collapsible": false,
      "defaultCollapsed": false,
      "columns": 1
    }
  ]
}
FIELD TYPES allowed: "text" | "number" | "datetime" | "select" | "checkbox" | "radio" | "file" | "slider" | "hidden" | "color" | "date_range" | "autocomplete" | "voice" | "rich_text"
NEVER use "textarea", "email", "password", or any other type — they are invalid.`,
    example: {
      title: 'User Registration',
      sections: [
        {
          id: 's1',
          title: 'Personal Info',
          fields: [
            { id: 'name', type: 'text', label: 'Full Name', required: true },
            { id: 'role', type: 'select', label: 'Role', options: [{ value: 'admin', label: 'Admin' }, { value: 'viewer', label: 'Viewer' }] },
            { id: 'notify', type: 'checkbox', label: 'Enable email notifications' },
          ],
          collapsible: false,
          defaultCollapsed: false,
          columns: 1,
        },
      ],
    },
  },
  document: {
    schema: `{
  "title": "<document title>",
  "sections": [
    {
      "id": "sec1",
      "title": "<section title>",
      "blocks": [
        { "type": "heading", "level": 2, "text": "<heading text>" },
        { "type": "paragraph", "text": "<paragraph content>" },
        { "type": "list", "ordered": false, "items": ["item 1", "item 2", "item 3"] },
        { "type": "callout", "variant": "info", "title": "<callout title>", "text": "<callout text>" }
      ]
    }
  ]
}
BLOCK TYPES allowed: "heading" | "paragraph" | "list" | "code" | "callout" | "metric" | "divider" | "table" | "image" | "quote" | "dataviz"
NEVER use any block type not in that list. Keep total blocks to max 5 per section.`,
    example: {
      title: 'System Runbook',
      sections: [
        {
          id: 's1',
          title: 'Overview',
          blocks: [
            { type: 'heading', level: 2, text: 'Incident Response' },
            { type: 'paragraph', text: 'Follow these steps during an incident.' },
            { type: 'list', ordered: true, items: ['Acknowledge alert', 'Check dashboards', 'Page on-call'] },
            { type: 'callout', variant: 'warning', title: 'Important', text: 'Never skip the acknowledgement step.' },
          ],
        },
      ],
    },
  },
  chat: {
    schema: `{
  "title": "<chat title>",
  "messages": [
    { "id": "m1", "role": "user", "content": "<message>", "timestamp": 1740000000000, "status": "sent", "attachments": [] },
    { "id": "m2", "role": "agent", "content": "<reply>", "timestamp": 1740000060000, "status": "sent", "attachments": [] },
    { "id": "m3", "role": "user", "content": "<follow-up>", "timestamp": 1740000120000, "status": "sent", "attachments": [] }
  ]
}
CRITICAL: "timestamp" MUST be an integer (Unix epoch milliseconds like 1740000000000), NOT an ISO string!
Role values: "user" | "agent" | "system" only. Status values: "sent" | "streaming" | "error" only.`,
    example: {
      title: 'Support Chat',
      messages: [
        { id: 'm1', role: 'user', content: 'My deployment is failing with permission errors.', timestamp: 1740000000000, status: 'sent', attachments: [] },
        { id: 'm2', role: 'agent', content: 'I can help. What error message do you see exactly?', timestamp: 1740000060000, status: 'sent', attachments: [] },
        { id: 'm3', role: 'user', content: 'It says: permission denied on /tmp/deploy-cache', timestamp: 1740000120000, status: 'sent', attachments: [] },
      ],
    },
  },
  workflow: {
    schema: `{
  "title": "<workflow title>",
  "steps": [
    { "id": "s1", "title": "<step name>", "description": "<details>", "status": "completed", "type": "info", "content": "<body text for this step>", "fields": [] },
    { "id": "s2", "title": "<step name>", "description": "<details>", "status": "in_progress", "type": "info", "content": "<current step instructions>", "fields": [] },
    { "id": "s3", "title": "<step name>", "description": "<details>", "status": "pending", "type": "confirmation", "content": "<confirmation question>", "fields": [] },
    { "id": "s4", "title": "<step name>", "description": "<details>", "status": "pending", "type": "review", "content": "<summary text>", "fields": [] }
  ],
  "currentStepIndex": 1
}
CRITICAL RULES:
- "status" MUST be: "pending" | "in_progress" | "completed" | "skipped" | "failed"
- "type" MUST be: "info" | "form" | "confirmation" | "review"
- "fields" MUST always be an empty array [] — NEVER add field objects
- Always include "content" as a string with the step body text`,
    example: {
      title: 'Software Deployment',
      steps: [
        { id: 's1', title: 'Code Review', description: 'Peer review completed', status: 'completed', type: 'info', content: 'Pull request #247 approved by 2 reviewers.', fields: [] },
        { id: 's2', title: 'Staging Deploy', description: 'Deploy to staging environment', status: 'in_progress', type: 'info', content: 'Deploying v2.3.1 to staging. Smoke tests running.', fields: [] },
        { id: 's3', title: 'QA Sign-off', description: 'QA team confirms staging is healthy', status: 'pending', type: 'confirmation', content: 'Has the QA team confirmed all tests pass on staging?', fields: [] },
        { id: 's4', title: 'Production Deploy', description: 'Final production release', status: 'pending', type: 'review', content: 'Ready for production release of v2.3.1.', fields: [] },
      ],
      currentStepIndex: 1,
    },
  },
  kanban: {
    schema: `{
  "title": "<board title>",
  "columns": [
    {
      "id": "col1",
      "title": "To Do",
      "cards": [
        { "id": "c1", "title": "<task>", "description": "<details>", "priority": "high", "tags": ["tag1"] }
      ]
    },
    {
      "id": "col2",
      "title": "In Progress",
      "cards": [
        { "id": "c2", "title": "<task>", "description": "<details>", "priority": "medium", "tags": [] }
      ]
    },
    { "id": "col3", "title": "Done", "cards": [] }
  ]
}
Card "priority" MUST be: "critical" | "high" | "medium" | "low" only. Max 3 cards per column.`,
    example: {
      title: 'Sprint 17',
      columns: [
        { id: 'col1', title: 'To Do', cards: [{ id: 'c1', title: 'Fix auth bug', priority: 'high', tags: ['backend'] }, { id: 'c2', title: 'Add rate limiting', priority: 'medium', tags: ['api'] }] },
        { id: 'col2', title: 'In Progress', cards: [{ id: 'c3', title: 'Update CI pipeline', priority: 'low', tags: ['devops'] }] },
        { id: 'col3', title: 'Done', cards: [{ id: 'c4', title: 'Database migration', priority: 'high', tags: ['backend'] }] },
      ],
    },
  },
  calendar: {
    schema: `{
  "title": "<calendar title>",
  "view": "month",
  "events": [
    {
      "id": "e1",
      "title": "<event title>",
      "start": "2026-03-15T09:00:00Z",
      "end": "2026-03-15T10:00:00Z",
      "allDay": false,
      "status": "confirmed",
      "attendees": [],
      "category": "<category>"
    }
  ]
}
CRITICAL: "start" and "end" MUST be valid ISO 8601 strings like "2026-03-15T09:00:00Z".
"status" MUST be: "confirmed" | "tentative" | "cancelled" only. Max 4 events. All events in 2026.`,
    example: {
      title: 'Engineering Q1 2026',
      view: 'month',
      events: [
        { id: 'e1', title: 'Sprint Planning', start: '2026-03-09T14:00:00Z', end: '2026-03-09T16:00:00Z', allDay: false, status: 'confirmed', attendees: [], category: 'meeting' },
        { id: 'e2', title: 'On-Call: Alice', start: '2026-03-10T00:00:00Z', end: '2026-03-17T00:00:00Z', allDay: true, status: 'confirmed', attendees: [], category: 'oncall' },
        { id: 'e3', title: 'Release v2.3.0', start: '2026-03-15T10:00:00Z', end: '2026-03-15T11:00:00Z', allDay: false, status: 'confirmed', attendees: [], category: 'release' },
      ],
    },
  },
  tree: {
    schema: `{
  "title": "<tree title>",
  "nodes": [
    {
      "id": "root",
      "label": "<root label>",
      "defaultExpanded": true,
      "children": [
        {
          "id": "child1",
          "label": "<child label>",
          "defaultExpanded": false,
          "children": [
            { "id": "leaf1", "label": "<leaf label>", "children": [] }
          ]
        },
        { "id": "child2", "label": "<child label>", "children": [] }
      ]
    }
  ]
}
Max 3 levels deep, max 4 children per node. Each node MUST have a unique "id".`,
    example: {
      title: 'Company Org Chart',
      nodes: [
        {
          id: 'ceo',
          label: 'CEO — Sarah Chen',
          defaultExpanded: true,
          children: [
            { id: 'cto', label: 'CTO — James Park', defaultExpanded: false, children: [{ id: 'eng', label: 'Engineering Lead', children: [] }, { id: 'infra', label: 'Infrastructure Lead', children: [] }] },
            { id: 'cpo', label: 'CPO — Maria Lopez', children: [{ id: 'pm', label: 'Product Manager', children: [] }] },
            { id: 'cmo', label: 'CMO — Tom Wright', children: [] },
          ],
        },
      ],
    },
  },
  timeline: {
    schema: `{
  "title": "<timeline title>",
  "events": [
    {
      "id": "ev1",
      "title": "<event title>",
      "description": "<details>",
      "timestamp": "2026-03-01T10:00:00Z",
      "status": "completed",
      "category": "<category>"
    }
  ]
}
CRITICAL: "timestamp" MUST be a valid ISO 8601 string like "2026-03-01T10:00:00Z".
"status" MUST be: "completed" | "in_progress" | "pending" | "failed" | "skipped" only.
Max 5 events. Order from oldest to newest timestamp.`,
    example: {
      title: 'Production Incident Timeline',
      events: [
        { id: 'ev1', title: 'Alert Triggered', description: 'PagerDuty alert: API latency > 2s', timestamp: '2026-03-02T08:00:00Z', status: 'completed', category: 'alert' },
        { id: 'ev2', title: 'Investigation Started', description: 'On-call engineer begins root cause analysis', timestamp: '2026-03-02T08:15:00Z', status: 'completed', category: 'ops' },
        { id: 'ev3', title: 'Root Cause Found', description: 'Database connection pool exhausted due to slow query', timestamp: '2026-03-02T09:00:00Z', status: 'completed', category: 'ops' },
        { id: 'ev4', title: 'Fix Deployed', description: 'Query optimized and connection pool increased', timestamp: '2026-03-02T09:45:00Z', status: 'completed', category: 'deploy' },
        { id: 'ev5', title: 'Post-Mortem Scheduled', description: 'Team post-mortem scheduled for next week', timestamp: '2026-03-02T10:30:00Z', status: 'pending', category: 'ops' },
      ],
    },
  },
  diagram: {
    schema: `Choose ONE of these three diagram kinds based on the request:

KIND 1 - Mermaid (flowchart, sequence diagram, ER diagram — use real Mermaid.js syntax):
{ "title": "<title>", "diagrams": [{ "kind": "mermaid", "id": "d1", "title": "<title>", "markup": "flowchart LR\\n  A[Start] --> B{Decision}\\n  B -->|Yes| C[Action]\\n  B -->|No| D[End]" }] }

KIND 2 - Graph (node/edge network, architecture, dependency diagram):
{ "title": "<title>", "diagrams": [{ "kind": "graph", "id": "d1", "title": "<title>", "layout": "hierarchy", "nodes": [{ "id": "n1", "label": "<label>", "group": "<group>", "shape": "square" }, { "id": "n2", "label": "<label>", "group": "<group>", "shape": "diamond" }], "edges": [{ "source": "n1", "target": "n2", "label": "<rel>" }] }] }

KIND 3 - Chart (bar/line/pie/area data visualization):
{ "title": "<title>", "diagrams": [{ "kind": "chart", "id": "d1", "title": "<title>", "chartType": "bar", "labels": ["Jan", "Feb", "Mar"], "series": [{ "name": "Revenue", "values": [120, 145, 132] }] }] }

CRITICAL RULES for graph kind:
- Every edge MUST have both "source" and "target" — these are node "id" values from the nodes array above
- "shape" MUST be one of: "circle" | "square" | "diamond" | "hexagon" — use varied shapes, not all "circle"
- "layout" MUST be: "force" | "hierarchy" | "radial"
- Max 6 nodes, max 8 edges`,
    example: {
      title: 'CI/CD Pipeline Architecture',
      diagrams: [
        {
          kind: 'graph',
          id: 'd1',
          title: 'Deployment Pipeline',
          layout: 'hierarchy',
          nodes: [
            { id: 'git', label: 'Git Repository', group: 'source', shape: 'square' },
            { id: 'ci', label: 'CI Runner', group: 'build', shape: 'diamond' },
            { id: 'registry', label: 'Docker Registry', group: 'storage', shape: 'hexagon' },
            { id: 'staging', label: 'Staging', group: 'deploy', shape: 'square' },
            { id: 'prod', label: 'Production', group: 'deploy', shape: 'square' },
          ],
          edges: [
            { source: 'git', target: 'ci', label: 'triggers build' },
            { source: 'ci', target: 'registry', label: 'pushes image' },
            { source: 'registry', target: 'staging', label: 'deploys' },
            { source: 'staging', target: 'prod', label: 'promotes' },
          ],
        },
      ],
    },
  },
  map: {
    schema: `{
  "title": "<map title>",
  "center": { "lat": <latitude -90 to 90>, "lng": <longitude -180 to 180> },
  "zoom": 10,
  "markers": [
    {
      "id": "m1",
      "position": { "lat": <latitude>, "lng": <longitude> },
      "label": "<marker label>",
      "description": "<description>",
      "category": "<category>",
      "color": "#6366f1"
    }
  ]
}
Use real city coordinates. Examples: New York (40.7128, -74.0060) | London (51.5074, -0.1278) | Paris (48.8566, 2.3522) | Tokyo (35.6762, 139.6503) | Berlin (52.5200, 13.4050) | Sydney (-33.8688, 151.2093).
Max 5 markers. "zoom" must be between 1 and 18.`,
    example: {
      title: 'European Office Locations',
      center: { lat: 48.8566, lng: 2.3522 },
      zoom: 5,
      markers: [
        { id: 'm1', position: { lat: 48.8566, lng: 2.3522 }, label: 'Paris HQ', description: 'Headquarters — 250 employees', category: 'office', color: '#6366f1' },
        { id: 'm2', position: { lat: 51.5074, lng: -0.1278 }, label: 'London', description: 'UK Sales Office — 80 employees', category: 'office', color: '#6366f1' },
        { id: 'm3', position: { lat: 52.5200, lng: 13.4050 }, label: 'Berlin', description: 'Engineering Hub — 120 engineers', category: 'engineering', color: '#10b981' },
      ],
    },
  },
  diagnostic_overview: {
    schema: `{
  "metrics": [
    {
      "id": "m1",
      "label": "<metric name>",
      "value": <number>,
      "unit": "<unit e.g. %, ms, GB, req/s>",
      "trend": "up",
      "status": "normal",
      "sparkline": [<8 numbers showing recent trend>]
    }
  ]
}
"trend" MUST be: "up" | "down" | "stable" only.
"status" MUST be: "normal" | "warning" | "critical" only.
"sparkline" MUST be an array of exactly 8 numbers. Max 6 metrics.`,
    example: {
      metrics: [
        { id: 'm1', label: 'CPU Usage', value: 72, unit: '%', trend: 'up', status: 'warning', sparkline: [45, 50, 55, 60, 65, 70, 71, 72] },
        { id: 'm2', label: 'API Latency p95', value: 145, unit: 'ms', trend: 'stable', status: 'normal', sparkline: [140, 142, 145, 141, 143, 145, 144, 145] },
        { id: 'm3', label: 'Error Rate', value: 0.02, unit: '%', trend: 'down', status: 'normal', sparkline: [0.08, 0.06, 0.05, 0.04, 0.03, 0.02, 0.02, 0.02] },
        { id: 'm4', label: 'Memory Usage', value: 61, unit: '%', trend: 'stable', status: 'normal', sparkline: [58, 59, 60, 61, 60, 61, 60, 61] },
        { id: 'm5', label: 'Active Connections', value: 3420, unit: '', trend: 'up', status: 'warning', sparkline: [2100, 2400, 2700, 2900, 3100, 3200, 3350, 3420] },
      ],
    },
  },
  sensor_overview: {
    schema: `{
  "sensors": [
    {
      "id": "s1",
      "name": "<sensor name>",
      "location": "<physical location>",
      "type": "temperature",
      "value": 22.5,
      "unit": "\u00b0C",
      "status": "ok",
      "trend": "stable",
      "lastSeen": "2026-03-02T10:00:00Z",
      "threshold": { "warn": 28, "critical": 35 }
    }
  ]
}
"type" MUST be: "temperature" | "humidity" | "pressure" | "co2" | "motion" | "power" only.
"status" MUST be: "ok" | "warning" | "critical" | "offline" only.
"trend" MUST be: "rising" | "falling" | "stable" only.
"lastSeen" MUST be a valid ISO 8601 string. Max 6 sensors. Use varied types and statuses.`,
    example: {
      sensors: [
        { id: 's1', name: 'Server Room Temp', location: 'Data Center A, Rack 3', type: 'temperature', value: 22.5, unit: '°C', status: 'ok', trend: 'stable', lastSeen: '2026-03-02T10:00:00Z', threshold: { warn: 28, critical: 35 } },
        { id: 's2', name: 'Humidity Monitor', location: 'Data Center A', type: 'humidity', value: 48, unit: '%', status: 'ok', trend: 'rising', lastSeen: '2026-03-02T10:00:00Z', threshold: { warn: 60, critical: 75 } },
        { id: 's3', name: 'CO2 Sensor', location: 'Office Floor 3', type: 'co2', value: 1200, unit: 'ppm', status: 'warning', trend: 'rising', lastSeen: '2026-03-02T09:58:00Z', threshold: { warn: 1000, critical: 2000 } },
        { id: 's4', name: 'Power Meter', location: 'UPS Room', type: 'power', value: 8500, unit: 'W', status: 'ok', trend: 'stable', lastSeen: '2026-03-02T10:00:00Z', threshold: { warn: 9000, critical: 10000 } },
      ],
    },
  },
};

/**
 * Build a type-specific system prompt for intent generation.
 * Tells the LLM exactly what data shape is required for the given feature type.
 */
function buildIntentPrompt(intentId: string, featureType: string, userRequest: string): string {
  const template = DATA_TEMPLATES[featureType];
  const dataSchema = template?.schema ?? `{ "title": "<title>", "description": "<description>" }`;
  const exampleJson = template?.example ? JSON.stringify(template.example, null, 2) : '{}';

  return (
    `You are a HARI (Human-Agent Runtime Interface) intent generator.\n` +
    `Generate a valid HARI intent JSON payload for the following request:\n` +
    `"${userRequest}"\n\n` +
    `The intent MUST have type="${featureType}" and use this EXACT data structure:\n` +
    `${dataSchema}\n\n` +
    `Here is a concrete example for reference:\n` +
    `${exampleJson}\n\n` +
    `Rules:\n` +
    `- Return ONLY valid JSON — no markdown, no code fences, no explanation text\n` +
    `- "primaryGoal" MUST be a plain string (max 100 chars), never an object\n` +
    `- "type" MUST be exactly "${featureType}"\n` +
    `- "data" MUST follow the schema above — include all required fields\n` +
    `- Generate realistic, specific data related to the user request\n` +
    `- Keep arrays SHORT: max 4-5 items each to avoid response truncation\n` +
    `- ISO date strings MUST use format "2026-03-02T10:00:00Z"\n` +
    `- chat "timestamp" fields MUST be integers (epoch ms e.g. 1740000000000), NOT strings\n` +
    `- diagram graph edges MUST include both "source" and "target" (node id values)\n` +
    `- Do NOT truncate the JSON — the response must be complete and valid\n\n` +
    `Return this exact JSON structure (concise, no trailing content):\n` +
    `{"version":"1.0.0","intentId":"${intentId}","type":"${featureType}","domain":"${featureType}","primaryGoal":"<one short sentence>","confidence":0.9,"data":<data matching the schema above>}`
  );
}

// Define UI features with default prompts
// Note: Only features with registered components in the demo registry should be included
const FEATURES = [
  {
    name: 'form',
    description: 'Interactive forms with validation',
    defaultPrompt: 'Create a user registration form with name, email, role selection, and notification preferences',
  },
  {
    name: 'chat',
    description: 'Chat: user ↔ agent message thread',
    defaultPrompt: 'Create a technical support chat showing a conversation about a deployment failure and its resolution steps',
  },
  {
    name: 'document',
    description: 'Rich document with blocks',
    defaultPrompt: 'Create a system runbook document with sections for incident response, escalation procedures, and troubleshooting steps',
  },
  {
    name: 'workflow',
    description: 'Multi-step guided process',
    defaultPrompt: 'Create a software deployment workflow: code review, staging deploy, QA sign-off, and production release steps',
  },
  {
    name: 'kanban',
    description: 'Kanban board for tasks',
    defaultPrompt: 'Create a sprint board for a backend API team with tasks in To Do, In Progress, and Done columns',
  },
  {
    name: 'calendar',
    description: 'Calendar with events',
    defaultPrompt: 'Create a March 2026 engineering team calendar with sprint ceremonies, on-call rotations, and release dates',
  },
  {
    name: 'tree',
    description: 'Hierarchical tree view',
    defaultPrompt: 'Create an organizational tree for an engineering department showing teams, leads, and individual contributors',
  },
  {
    name: 'timeline',
    description: 'Chronological event timeline',
    defaultPrompt: 'Create a production incident timeline for March 2026: alert triggered, investigation, root cause found, fix deployed, post-mortem',
  },
  {
    name: 'diagram',
    description: 'Diagrams and data charts',
    defaultPrompt: 'Create a microservices architecture diagram showing API gateway, auth service, user service, and database with their connections',
  },
  {
    name: 'map',
    description: 'Geographic map with markers',
    defaultPrompt: 'Create a map showing company office locations across Europe with markers for headquarters and regional offices',
  },
  {
    name: 'diagnostic_overview',
    description: 'System metrics dashboard',
    defaultPrompt: 'Create a cloud infrastructure health dashboard showing CPU usage, API latency, error rate, memory, and active connections',
  },
  {
    name: 'sensor_overview',
    description: 'IoT sensor readings',
    defaultPrompt: 'Create an IoT monitoring view for a data center showing temperature, humidity, CO2, and power sensors with their current status and thresholds',
  },
];

interface TestCase {
  id: string;
  feature: string;
  prompt: string;
  isDefault: boolean;
  status: 'idle' | 'running' | 'success' | 'error';
  result?: IntentPayloadInput;
  textAnswer?: string;  // plain-text answer for non-component prompts
  error?: string;
  generationTime?: number;
}

interface Feature {
  name: string;
  description: string;
  defaultPrompt: string;
}

interface AgentRun {
  id: number;
  timestamp: Date;
  seed: string;           // user-provided topic/context seed
  generatedPrompt: string; // LLM-generated prompt for this run
  expected: string;
  resultType: 'text' | 'component' | 'none';
  textAnswer?: string;
  result?: IntentPayloadInput;
  error?: string;
  status: 'success' | 'error' | 'running';
  durationMs?: number;
}

export function TestHub() {
  const [settings, setSettings] = useState({
    ollamaUrl: 'http://localhost:11434',
    model: 'mistral',
    showSettings: false,
  });

  const [testCases, setTestCases] = useState<Map<string, TestCase>>(
    new Map(
      FEATURES.map((f) => [
        f.name,
        {
          id: f.name,
          feature: f.name,
          prompt: f.defaultPrompt,
          isDefault: true,
          status: 'idle' as const,
        },
      ])
    )
  );

  const [customPrompts, setCustomPrompts] = useState<Map<string, TestCase>>(new Map());
  const [selectedFeature, setSelectedFeature] = useState(FEATURES[0].name);
  const [isRunning, setIsRunning] = useState(false);
  const [isBatchRunning, setIsBatchRunning] = useState(false);
  const [modelReady, setModelReady] = useState(false);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);

  // ── Human Agent state ──────────────────────────────────────────────────────
  const [mode, setMode] = useState<'static' | 'agent'>('static');
  const [agentRuns, setAgentRuns] = useState<AgentRun[]>([]);
  const [isAgentRunning, setIsAgentRunning] = useState(false);
  const [latestAgentResult, setLatestAgentResult] = useState<{ result?: IntentPayloadInput; textAnswer?: string; generatedPrompt?: string } | null>(null);
  const agentAbortRef = useRef<AbortController | null>(null);
  const agentRunCountRef = useRef(0);
  const [agentConfig, setAgentConfig] = useState({
    promptContext: 'A microservices platform team managing 12 production services with real-time monitoring',
    expected: 'A dashboard, chart, kanban board, form, or structured component with realistic data',
    featureType: FEATURES[0].name,
    iterations: 5,
    delayMs: 2000,
    infiniteLoop: false,
  });
  const agentConfigRef = useRef(agentConfig);
  useEffect(() => { agentConfigRef.current = agentConfig; }, [agentConfig]);

  // Always-fresh refs — avoids stale closure issues in async callbacks
  const testCasesRef = useRef(testCases);
  const customPromptsRef = useRef(customPrompts);
  const settingsRef = useRef(settings);
  useEffect(() => { testCasesRef.current = testCases; }, [testCases]);
  useEffect(() => { customPromptsRef.current = customPrompts; }, [customPrompts]);
  useEffect(() => { settingsRef.current = settings; }, [settings]);

  // Initialize Ollama and fetch available models
  useEffect(() => {
    const initOllama = async () => {
      try {
        // Fetch available models
        const tagsRes = await fetch(`${settings.ollamaUrl}/api/tags`, { signal: AbortSignal.timeout(3000) });
        if (!tagsRes.ok) {
          console.error('Ollama health check failed:', tagsRes.statusText);
          return;
        }

        const tagsData = await tagsRes.json() as { models?: Array<{ name: string }> };
        const models = tagsData.models?.map((m) => m.name) || [];
        setAvailableModels(models);
        console.log('Available Ollama models:', models);

        // If current model not in available list and we have models, default to first one
        if (models.length > 0 && !models.includes(settings.model)) {
          console.log(`Model ${settings.model} not available, defaulting to ${models[0]}`);
          setSettings((s) => ({ ...s, model: models[0] }));
        }

        if (models.length > 0) {
          setModelReady(true);
        }
      } catch (error) {
        console.error('Ollama initialization error:', error);
        setAvailableModels([]);
      }
    };

    initOllama();
  }, [settings.ollamaUrl]);

  // Get feature by name
  const getFeature = (name: string): Feature | undefined => FEATURES.find((f) => f.name === name);

  // Get current test case (custom or default)
  const getCurrentTestCase = (featureName: string): TestCase | undefined => {
    return customPrompts.get(featureName) || testCases.get(featureName);
  };

  // Update prompt for a feature
  const updatePrompt = (featureName: string, prompt: string) => {
    const existing = customPrompts.get(featureName);
    if (existing) {
      existing.prompt = prompt;
      setCustomPrompts(new Map(customPrompts));
    } else {
      const defaultCase = testCases.get(featureName);
      if (defaultCase) {
        const custom = { ...defaultCase, prompt, isDefault: false };
        setCustomPrompts(new Map(customPrompts).set(featureName, custom));
      }
    }
  };

  // Reset to default prompt
  const resetPrompt = (featureName: string) => {
    customPrompts.delete(featureName);
    setCustomPrompts(new Map(customPrompts));
  };

  // Execute a test — reads from refs so it never has stale closures
  const executeTest = useCallback(async (featureName: string) => {
      const s = settingsRef.current;
      const testCase = customPromptsRef.current.get(featureName) || testCasesRef.current.get(featureName);
      if (!testCase) return;

      setTestCases((prev) => {
        const updated = new Map(prev);
        updated.set(featureName, { ...testCase, status: 'running' });
        return updated;
      });

      try {
        const startTime = performance.now();
        abortControllerRef.current = new AbortController();
        const signal = abortControllerRef.current.signal;

        const ollamaPost = (prompt: string) =>
          fetch(`${s.ollamaUrl}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: s.model, prompt, stream: false }),
            signal,
          });

        // Step 1: Classify — QUESTION or COMPONENT?
        const classifyRes = await ollamaPost(
          `Classify this user input as either "QUESTION" (information/explanation/conversation) or "COMPONENT" (create/generate a UI element, form, chart, dashboard, widget).
User input: "${testCase.prompt}"
Respond with exactly one word: QUESTION or COMPONENT`
        );

        if (!classifyRes.ok) {
          if (classifyRes.status === 404) throw new Error(`Model '${s.model}' not found. Run: ollama pull ${s.model}`);
          throw new Error(`Ollama ${classifyRes.status}: ${classifyRes.statusText}`);
        }

        const { response: classifyText } = await classifyRes.json();
        const isQuestion = classifyText.trim().toUpperCase().includes('QUESTION');

        if (isQuestion) {
          // Plain text answer
          const answerRes = await ollamaPost(testCase.prompt);
          if (!answerRes.ok) throw new Error(`Ollama ${answerRes.status}: ${answerRes.statusText}`);
          const { response: answerText } = await answerRes.json();
          const generationTime = Math.round(performance.now() - startTime);

          setTestCases((prev) => {
            const updated = new Map(prev);
            updated.set(featureName, { ...testCase, status: 'success', textAnswer: answerText || 'No response', result: undefined, generationTime, error: undefined });
            return updated;
          });
        } else {
          // Component intent JSON
          const uuid = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = Math.random() * 16 | 0;
            return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
          });
          const newUuid = uuid();

          const componentRes = await ollamaPost(
            buildIntentPrompt(newUuid, featureName, testCase.prompt)
          );

          if (!componentRes.ok) {
            const errText = await componentRes.text().catch(() => componentRes.statusText);
            throw new Error(`Ollama ${componentRes.status}: ${errText}`);
          }

          const { response: rawJson } = await componentRes.json();
          const generationTime = Math.round(performance.now() - startTime);

          const jsonMatch = rawJson.match(/\{[\s\S]*\}/);
          if (!jsonMatch) throw new Error('No JSON found in response:\n' + rawJson.slice(0, 300));

          const parsed = JSON.parse(jsonMatch[0]);
          const intentPayload: IntentPayloadInput = {
            version: parsed.version || '1.0.0',
            intentId: /^[0-9a-f-]{36}$/.test(parsed.intentId || '') ? parsed.intentId : newUuid,
            type: featureName, // always use featureName, not LLM-generated type
            domain: typeof parsed.domain === 'string' ? parsed.domain : featureName,
            primaryGoal: typeof parsed.primaryGoal === 'string' ? parsed.primaryGoal : (typeof parsed.primaryGoal === 'object' && parsed.primaryGoal ? JSON.stringify(parsed.primaryGoal) : testCase.prompt).slice(0, 200),
            confidence: typeof parsed.confidence === 'number' ? Math.min(1, Math.max(0, parsed.confidence)) : 0.8,
            data: parsed.data && typeof parsed.data === 'object' ? parsed.data : { description: testCase.prompt },
            ...(parsed.ambiguities !== undefined ? { ambiguities: parsed.ambiguities } : {}),
            ...(parsed.priorityFields !== undefined ? { priorityFields: parsed.priorityFields } : {}),
            ...(parsed.actions !== undefined ? { actions: parsed.actions } : {}),
            ...(parsed.density !== undefined ? { density: parsed.density } : {}),
            ...(parsed.layoutHint !== undefined ? { layoutHint: parsed.layoutHint } : {}),
            ...(parsed.explain !== undefined ? { explain: parsed.explain } : {}),
          };

          const result = IntentPayloadSchema.parse(intentPayload);

          setTestCases((prev) => {
            const updated = new Map(prev);
            updated.set(featureName, { ...testCase, status: 'success', result, textAnswer: undefined, generationTime, error: undefined });
            return updated;
          });
        }
      } catch (error) {
        if ((error as Error).name === 'AbortError') return;
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        setTestCases((prev) => {
          const updated = new Map(prev);
          updated.set(featureName, { ...testCase, status: 'error', error: errorMsg });
          return updated;
        });
      }
    },
    [] // no deps — reads everything from refs
  );

  // Export results — reads from ref so it always gets the latest state
  const exportResults = useCallback(() => {
    const currentTestCases = testCasesRef.current;
    const currentSettings = settingsRef.current;
    const results = Array.from(currentTestCases.entries()).map(([name, testCase]) => ({
      feature: name,
      prompt: testCase.prompt,
      status: testCase.status,
      resultType: testCase.textAnswer ? 'text' : testCase.result ? 'component' : 'none',
      generationTime: testCase.generationTime,
      error: testCase.error,
      textAnswer: testCase.textAnswer || null,
      result: testCase.result || null,
      isDefault: testCase.isDefault,
    }));

    const summary = {
      timestamp: new Date().toISOString(),
      settings: { ollamaUrl: currentSettings.ollamaUrl, model: currentSettings.model },
      stats: {
        total: results.length,
        success: results.filter((r) => r.status === 'success').length,
        error: results.filter((r) => r.status === 'error').length,
        idle: results.filter((r) => r.status === 'idle').length,
      },
      results,
    };

    // Create JSON log
    const jsonBlob = new Blob([JSON.stringify(summary, null, 2)], { type: 'application/json' });
    const jsonUrl = URL.createObjectURL(jsonBlob);
    const jsonLink = document.createElement('a');
    jsonLink.href = jsonUrl;
    jsonLink.download = `test-results-${Date.now()}.json`;

    // Create text log for easy reading
    const textLog = [
      `TEST HUB RESULTS LOG`,
      `Timestamp: ${summary.timestamp}`,
      `Ollama URL: ${summary.settings.ollamaUrl}`,
      `Model: ${summary.settings.model}`,
      ``,
      `SUMMARY:`,
      `  Total: ${summary.stats.total}`,
      `  ✓ Success: ${summary.stats.success}`,
      `  ✗ Error: ${summary.stats.error}`,
      `  ◯ Idle (not run): ${summary.stats.idle}`,
      ``,
      `DETAILED RESULTS:`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      ...results.map((r) => [
        `\nFEATURE: ${r.feature.toUpperCase()}`,
        `Status: ${r.status}`,
        `Is Default: ${r.isDefault}`,
        `Generation Time: ${r.generationTime ?? 'N/A'}ms`,
        `Prompt: ${r.prompt}`,
        r.status === 'error'
          ? `Error: ${r.error}`
          : r.status === 'success' && r.textAnswer
            ? `Response Type: TEXT ANSWER\nAnswer: ${r.textAnswer}`
            : r.status === 'success' && r.result
              ? `Response Type: COMPONENT\nResult: ${JSON.stringify(r.result, null, 2)}`
              : `No result`,
        `─────────────────────────────────────────────────────────────────────`,
      ].join('\n')),
    ].join('\n');

    const textBlob = new Blob([textLog], { type: 'text/plain' });
    const textUrl = URL.createObjectURL(textBlob);
    const textLink = document.createElement('a');
    textLink.href = textUrl;
    textLink.download = `test-results-${Date.now()}.log`;

    // Download both files
    document.body.appendChild(jsonLink);
    document.body.appendChild(textLink);
    jsonLink.click();
    setTimeout(() => textLink.click(), 500);
    setTimeout(() => {
      document.body.removeChild(jsonLink);
      document.body.removeChild(textLink);
      URL.revokeObjectURL(jsonUrl);
      URL.revokeObjectURL(textUrl);
    }, 1000);
  }, []); // no deps — reads from refs

  // Run all tests in batch
  const runAllTests = useCallback(async () => {
    setIsBatchRunning(true);
    const startTime = Date.now();
    console.log(`Starting batch run for ${FEATURES.length} features...`);

    for (const feature of FEATURES) {
      if (abortControllerRef.current?.signal.aborted) break;
      console.log(`  → Running: ${feature.name}`);
      await executeTest(feature.name);
      // Brief pause between tests so UI can update
      await new Promise((resolve) => setTimeout(resolve, 800));
    }

    console.log(`✓ Batch complete in ${Date.now() - startTime}ms`);
    setIsBatchRunning(false);

    // Small delay to let React commit the final state updates, then export
    await new Promise((resolve) => setTimeout(resolve, 500));
    exportResults();
  }, [executeTest, exportResults]); // both are stable ([] deps)

  // Stop running tests
  const stopTests = () => {
    abortControllerRef.current?.abort();
    setIsRunning(false);
    setIsBatchRunning(false);
  };

  // ── Human Agent loop ───────────────────────────────────────────────────────
  const runAgentLoop = useCallback(async () => {
    agentRunCountRef.current = 0;
    agentAbortRef.current = new AbortController();
    setIsAgentRunning(true);
    setLatestAgentResult(null);

    const cfg = agentConfigRef.current;
    const maxIterations = cfg.infiniteLoop ? Infinity : cfg.iterations;

    while (!agentAbortRef.current.signal.aborted && agentRunCountRef.current < maxIterations) {
      const runId = ++agentRunCountRef.current;
      const startTime = performance.now();
      const s = settingsRef.current;

      const pendingRun: AgentRun = {
        id: runId,
        timestamp: new Date(),
        seed: cfg.promptContext,
        generatedPrompt: '…generating prompt…',
        expected: cfg.expected,
        resultType: 'none',
        status: 'running',
      };
      setAgentRuns(prev => [pendingRun, ...prev]);

      try {
        const post = (prompt: string) => fetch(`${s.ollamaUrl}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: s.model, prompt, stream: false }),
          signal: agentAbortRef.current!.signal,
        });

        // ── Step 1: LLM generates a rich, unique prompt for this iteration ──
        const promptGenRes = await post(
          `You are a UI prompt engineer. Generate a single, specific, realistic and complex natural-language request for a "${cfg.featureType}" UI component.\n` +
          `Domain / context: ${cfg.promptContext}\n` +
          `Run number: ${runId}\n` +
          `Requirements:\n` +
          `- Reference real-world entities (team names, service names, metrics, dates, KPIs, users, etc.)\n` +
          `- Be specific and detailed — not generic\n` +
          `- Vary the request compared to previous runs (different scenario, different data, different angle)\n` +
          `- The request should be rich enough that an LLM can generate a ${cfg.featureType} with realistic content\n` +
          `Output ONLY the prompt text. No explanations, no quotes, no preamble.`
        );
        const { response: generatedPrompt } = await promptGenRes.json();
        const cleanPrompt = generatedPrompt.trim();

        // Update the run entry with the generated prompt
        setAgentRuns(prev => prev.map(r => r.id === runId ? { ...r, generatedPrompt: cleanPrompt } : r));

        // ── Step 2: Classify the generated prompt ──
        const classifyRes = await post(
          `Classify this request as QUESTION or COMPONENT:\n"${cleanPrompt}"\nRespond with exactly one word: QUESTION or COMPONENT.`
        );
        const { response: classifyText } = await classifyRes.json();
        const isQuestion = classifyText.trim().toUpperCase().includes('QUESTION');

        if (isQuestion) {
          // ── Step 3a: Answer the question ──
          const answerRes = await post(cleanPrompt);
          const { response: textAnswer } = await answerRes.json();
          const durationMs = Math.round(performance.now() - startTime);
          const done: AgentRun = { ...pendingRun, generatedPrompt: cleanPrompt, status: 'success', resultType: 'text', textAnswer, durationMs };
          setAgentRuns(prev => prev.map(r => r.id === runId ? done : r));
          setLatestAgentResult({ textAnswer, generatedPrompt: cleanPrompt });
        } else {
          // ── Step 3b: Generate component intent JSON ──
          const newId = crypto.randomUUID();
          const compRes = await post(buildIntentPrompt(newId, cfg.featureType, cleanPrompt));
          const { response: rawJson } = await compRes.json();
          const durationMs = Math.round(performance.now() - startTime);
          const match = rawJson.match(/\{[\s\S]*\}/);
          if (!match) throw new Error('No JSON in LLM response');
          const parsed = JSON.parse(match[0]);
          const intentPayload: IntentPayloadInput = {
            version: parsed.version || '1.0.0',
            intentId: /^[0-9a-f-]{36}$/.test(parsed.intentId || '') ? parsed.intentId : newId,
            type: cfg.featureType, // always enforce the expected type
            domain: typeof parsed.domain === 'string' ? parsed.domain : cfg.featureType,
            primaryGoal: typeof parsed.primaryGoal === 'string' ? parsed.primaryGoal : (typeof parsed.primaryGoal === 'object' && parsed.primaryGoal ? JSON.stringify(parsed.primaryGoal) : cleanPrompt).slice(0, 200),
            confidence: typeof parsed.confidence === 'number' ? Math.min(1, Math.max(0, parsed.confidence)) : 0.8,
            data: parsed.data || { description: cleanPrompt },
          };
          const result = IntentPayloadSchema.parse(intentPayload);
          const done: AgentRun = { ...pendingRun, generatedPrompt: cleanPrompt, status: 'success', resultType: 'component', result, durationMs };
          setAgentRuns(prev => prev.map(r => r.id === runId ? done : r));
          setLatestAgentResult({ result, generatedPrompt: cleanPrompt });
        }
      } catch (err) {
        if ((err as Error).name === 'AbortError') break;
        const durationMs = Math.round(performance.now() - startTime);
        const failed: AgentRun = { ...pendingRun, status: 'error', error: String(err), durationMs };
        setAgentRuns(prev => prev.map(r => r.id === runId ? failed : r));
      }

      const currentCfg = agentConfigRef.current;
      const currentMax = currentCfg.infiniteLoop ? Infinity : currentCfg.iterations;
      if (!agentAbortRef.current.signal.aborted && agentRunCountRef.current < currentMax) {
        await new Promise(resolve => setTimeout(resolve, currentCfg.delayMs));
      }
    }
    setIsAgentRunning(false);
  }, []); // reads from refs

  const stopAgentLoop = () => {
    agentAbortRef.current?.abort();
    setIsAgentRunning(false);
  };

  // Calculate stats
  const stats = {
    total: testCases.size,
    success: Array.from(testCases.values()).filter((t) => t.status === 'success').length,
    error: Array.from(testCases.values()).filter((t) => t.status === 'error').length,
    pending: Array.from(testCases.values()).filter((t) => t.status === 'idle').length,
  };

  const currentFeature = getFeature(selectedFeature)!;
  const currentTestCase = getCurrentTestCase(selectedFeature)!;

  // ── render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', overflow:'hidden', background:'var(--hari-bg)', fontFamily:'system-ui,sans-serif' }}>

      {/* TOP BAR */}
      <div style={{ flexShrink:0, display:'flex', alignItems:'center', gap:10, padding:'10px 16px', background:'var(--hari-surface)', borderBottom:'1px solid var(--hari-border)', flexWrap:'wrap' }}>
        <Zap size={17} color="#2563eb" style={{ flexShrink:0 }} />
        <span style={{ fontWeight:700, fontSize:16, color:'var(--hari-text)' }}>Test Hub</span>

        {/* Mode toggle */}
        <div style={{ display:'flex', gap:2, background:'var(--hari-surface-alt)', borderRadius:6, padding:2, border:'1px solid var(--hari-border)' }}>
          <button onClick={() => setMode('static')}
            style={{ display:'flex', alignItems:'center', gap:5, padding:'4px 10px', borderRadius:4, border:'none', cursor:'pointer',
              background: mode === 'static' ? '#2563eb' : 'transparent',
              color: mode === 'static' ? '#fff' : 'var(--hari-text-secondary)', fontSize:12, fontWeight:600 }}>
            <FlaskConical size={12}/> Static Tests
          </button>
          <button onClick={() => setMode('agent')}
            style={{ display:'flex', alignItems:'center', gap:5, padding:'4px 10px', borderRadius:4, border:'none', cursor:'pointer',
              background: mode === 'agent' ? '#7c3aed' : 'transparent',
              color: mode === 'agent' ? '#fff' : 'var(--hari-text-secondary)', fontSize:12, fontWeight:600 }}>
            <Bot size={12}/> Human Agent
          </button>
        </div>

        <span style={{ fontSize:12, color:'var(--hari-text-muted)', flex:1, minWidth:60 }}>
          {mode === 'static' ? 'Select feature · edit prompt · Run' : 'LLM loop · log prompt / expected / actual'}
        </span>

        {mode === 'static' && (
          <>
            <StatPill color="#16a34a" label={`✓ ${stats.success}`} />
            <StatPill color="#dc2626" label={`✗ ${stats.error}`} />
            <StatPill color="#94a3b8" label={`○ ${stats.pending}`} />
            {!isBatchRunning ? (
              <>
                <TBtn bg="#2563eb" onClick={() => { setIsRunning(true); executeTest(selectedFeature).finally(() => setIsRunning(false)); }}>
                  <Play size={13}/> Run
                </TBtn>
                <TBtn bg="#16a34a" onClick={runAllTests} disabled={isRunning}>
                  <Zap size={13}/> Run All
                </TBtn>
              </>
            ) : (
              <TBtn bg="#d97706" onClick={stopTests}><Pause size={13}/> Stop</TBtn>
            )}
            <TBtn bg="#64748b" onClick={() => { setTestCases(new Map(FEATURES.map((f) => [f.name, { id:f.name, feature:f.name, prompt:f.defaultPrompt, isDefault:true, status:'idle' as const }]))); setCustomPrompts(new Map()); }}><RotateCcw size={13}/> Reset</TBtn>
            <TBtn bg="#7c3aed" onClick={exportResults} disabled={Array.from(testCases.values()).every(t => t.status === 'idle')}><Download size={13}/> Export</TBtn>
          </>
        )}
        {mode === 'agent' && (
          <>
            <StatPill color="#16a34a" label={`✓ ${agentRuns.filter(r => r.status === 'success').length}`} />
            <StatPill color="#dc2626" label={`✗ ${agentRuns.filter(r => r.status === 'error').length}`} />
            <StatPill color="#94a3b8" label={`${agentRuns.length} runs`} />
            {!isAgentRunning
              ? <TBtn bg="#7c3aed" onClick={runAgentLoop}><Repeat size={13}/> Start Loop</TBtn>
              : <TBtn bg="#d97706" onClick={stopAgentLoop}><Square size={13}/> Stop</TBtn>
            }
            <TBtn bg="#64748b" onClick={() => { setAgentRuns([]); setLatestAgentResult(null); agentRunCountRef.current = 0; }}>
              <RotateCcw size={13}/> Clear
            </TBtn>
          </>
        )}
        <TBtn bg="#94a3b8" onClick={() => setSettings(s => ({...s, showSettings:!s.showSettings}))}><Settings size={13}/></TBtn>
      </div>

      {/* SETTINGS */}
      {settings.showSettings && (
        <div style={{ flexShrink:0, display:'flex', gap:16, padding:'10px 16px', background:'var(--hari-surface-alt)', borderBottom:'1px solid var(--hari-border)', flexWrap:'wrap', alignItems:'flex-end' }}>
          <SettingsField label="Ollama URL" value={settings.ollamaUrl} onChange={v => setSettings(s => ({...s, ollamaUrl:v}))} width={280} />
          <label style={{ display:'flex', flexDirection:'column', gap:4 }}>
            <span style={{ fontSize:11, fontWeight:600, color:'var(--hari-text-secondary)', textTransform:'uppercase' }}>Model</span>
            {availableModels.length === 0 ? (
              <div style={{ padding:'6px 10px', borderRadius:6, border:'1px solid #dc2626', fontSize:13, color:'#dc2626', background:'var(--hari-surface)', width:180 }}>
                No models available
              </div>
            ) : (
              <select
                value={settings.model}
                onChange={(e) => setSettings(s => ({...s, model:e.target.value}))}
                style={{ width:180, padding:'6px 10px', borderRadius:6, border:'1px solid var(--hari-border)', fontSize:13, color:'var(--hari-text)', background:'var(--hari-surface)', outline:'none', cursor:'pointer' }}>
                {availableModels.map((model) => (
                  <option key={model} value={model}>{model}</option>
                ))}
              </select>
            )}
          </label>
        </div>
      )}

      {/* BODY: Static Tests */}
      {mode === 'static' && (
      <div style={{ flex:1, overflow:'hidden', display:'flex' }}>

        {/* SIDEBAR */}
        <div style={{ width:180, flexShrink:0, display:'flex', flexDirection:'column', background:'var(--hari-surface)', borderRight:'1px solid var(--hari-border)', overflow:'hidden' }}>
          <div style={{ padding:'8px 12px', fontSize:11, fontWeight:600, color:'var(--hari-text-muted)', textTransform:'uppercase', letterSpacing:'0.06em', borderBottom:'1px solid var(--hari-border)', flexShrink:0 }}>
            Features
          </div>
          <div style={{ flex:1, overflowY:'auto' }}>
            {FEATURES.map((feature) => {
              const tc = getCurrentTestCase(feature.name);
              const st = tc?.status ?? 'idle';
              const active = feature.name === selectedFeature;
              const dotColor = st==='success'?'#16a34a':st==='error'?'#dc2626':st==='running'?'#2563eb':'#cbd5e1';
              return (
                <button key={feature.name} onClick={() => setSelectedFeature(feature.name)}
                  style={{ display:'flex', alignItems:'center', gap:8, width:'100%', padding:'9px 12px', border:'none', background: active?'#eff6ff':'transparent', borderLeft:`3px solid ${active?'#2563eb':'transparent'}`, cursor:'pointer', textAlign:'left' }}>
                  <span style={{ width:8, height:8, borderRadius:'50%', flexShrink:0, background:dotColor, display:'inline-block' }} />
                  <span style={{ fontSize:13, fontWeight:active?600:400, color:active?'#1d4ed8':'var(--hari-text-secondary)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', textTransform:'capitalize' }}>
                    {feature.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* PROMPT PANEL */}
        <div style={{ flex:1, display:'flex', flexDirection:'column', borderRight:'1px solid var(--hari-border)', background:'var(--hari-bg)', minWidth:0 }}>
          <div style={{ flexShrink:0, padding:'12px 16px', background:'var(--hari-surface)', borderBottom:'1px solid var(--hari-border)' }}>
            <p style={{ margin:0, fontWeight:700, fontSize:15, color:'var(--hari-text)', textTransform:'capitalize' }}>{currentFeature.name}</p>
            <p style={{ margin:'2px 0 0', fontSize:12, color:'var(--hari-text-secondary)' }}>{currentFeature.description}</p>
          </div>
          <div style={{ flex:1, display:'flex', flexDirection:'column', padding:16, gap:10, overflow:'hidden' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontSize:12, fontWeight:600, color:'var(--hari-text-secondary)' }}>Prompt</span>
              <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                {!currentTestCase.isDefault && (
                  <button onClick={() => resetPrompt(selectedFeature)}
                    style={{ fontSize:11, padding:'2px 8px', borderRadius:4, border:'1px solid var(--hari-border)', background:'var(--hari-surface-alt)', color:'var(--hari-text-secondary)', cursor:'pointer' }}>
                    Reset
                  </button>
                )}
                <span style={{ fontSize:11, color:'var(--hari-text-muted)' }}>{currentTestCase.prompt.length} chars</span>
              </div>
            </div>
            <textarea
              value={currentTestCase.prompt}
              onChange={(e) => updatePrompt(selectedFeature, e.target.value)}
              disabled={isRunning || isBatchRunning}
              style={{ flex:1, resize:'none', padding:12, fontSize:13, fontFamily:'monospace', borderRadius:8, border:'1px solid var(--hari-border)', background:'var(--hari-surface)', color:'var(--hari-text)', outline:'none', lineHeight:1.6, opacity: isRunning || isBatchRunning ? 0.5 : 1 }}
              placeholder="Enter your test prompt here…"
            />
            <button
              onClick={async () => { 
                setIsRunning(true); 
                await executeTest(selectedFeature);
                setIsRunning(false); 
              }}
              disabled={isRunning || isBatchRunning}
              style={{ flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', gap:8, padding:'11px 0', borderRadius:8, border:'none', cursor: isRunning || isBatchRunning ? 'not-allowed' : 'pointer', background:'#2563eb', color:'#fff', fontSize:14, fontWeight:600, opacity: isRunning || isBatchRunning ? 0.5 : 1 }}>
              <Play size={15}/> Run Test
            </button>
          </div>
        </div>

        {/* RESULT PANEL */}
        <div style={{ flex:1, display:'flex', flexDirection:'column', background:'var(--hari-surface)', minWidth:0 }}>
          <div style={{ flexShrink:0, padding:'12px 16px', borderBottom:'1px solid var(--hari-border)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <span style={{ fontWeight:700, fontSize:15, color:'var(--hari-text)' }}>
              {currentTestCase.status === 'idle'    && 'Result'}
              {currentTestCase.status === 'running' && 'Classifying & Generating…'}
              {currentTestCase.status === 'success' && currentTestCase.textAnswer && '💬 Answer'}
              {currentTestCase.status === 'success' && currentTestCase.result    && '✓ Component'}
              {currentTestCase.status === 'error'   && '✗ Error'}
            </span>
            {currentTestCase.generationTime != null && currentTestCase.generationTime > 0 && (
              <span style={{ fontSize:11, color:'var(--hari-text-muted)', fontFamily:'monospace' }}>{currentTestCase.generationTime}ms</span>
            )}
          </div>
          <div style={{ flex:1, overflowY:'auto', padding:16 }}>
            {currentTestCase.status === 'idle' && (
              <div style={{ height:'100%', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:12 }}>
                <Clock size={40} color="var(--hari-text-muted)" />
                <p style={{ margin:0, fontSize:14, fontWeight:500, color:'var(--hari-text-secondary)' }}>Ready to test</p>
                <p style={{ margin:0, fontSize:12, color:'var(--hari-text-muted)' }}>Enter any prompt — a question or a component request</p>
              </div>
            )}
            {currentTestCase.status === 'running' && (
              <div style={{ height:'100%', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:12 }}>
                <div style={{ animation:'spin 1s linear infinite', display:'flex' }}><RefreshCw size={40} color="#2563eb" /></div>
                <p style={{ margin:0, fontSize:14, fontWeight:500, color:'#2563eb' }}>Classifying prompt and generating response…</p>
                <p style={{ margin:0, fontSize:12, color:'var(--hari-text-muted)' }}>{settings.ollamaUrl}</p>
              </div>
            )}
            {currentTestCase.status === 'error' && (
              <div style={{ height:'100%', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:12 }}>
                <AlertCircle size={40} color="#dc2626" />
                <p style={{ margin:0, fontSize:14, fontWeight:600, color:'#dc2626' }}>Failed</p>
                <pre style={{ margin:0, fontSize:11, color:'var(--hari-text-secondary)', wordBreak:'break-word', maxWidth:'100%', whiteSpace:'pre-wrap', background:'#fef2f2', padding:12, borderRadius:6, border:'1px solid #fecaca' }}>{currentTestCase.error}</pre>
              </div>
            )}
            {currentTestCase.status === 'success' && currentTestCase.textAnswer && (
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                <div style={{ display:'flex', alignItems:'center', gap:6, color:'#0369a1', fontSize:13, fontWeight:600 }}>
                  <CheckCircle size={16} /> Plain text answer
                </div>
                <div style={{ background:'#f0f9ff', border:'1px solid #bae6fd', borderRadius:8, padding:16, fontSize:14, color:'var(--hari-text)', lineHeight:1.7, whiteSpace:'pre-wrap' }}>
                  {currentTestCase.textAnswer}
                </div>
              </div>
            )}
            {currentTestCase.status === 'success' && currentTestCase.result && (
              <IntentErrorBoundary>
                <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:6, color:'#16a34a', fontSize:13, fontWeight:600 }}>
                    <CheckCircle size={16} /> Component generated successfully
                  </div>
                  <div style={{ borderRadius:8, border:'1px solid var(--hari-border)', padding:16, background:'var(--hari-bg)' }}>
                    <TestComponentRenderer intent={currentTestCase.result!} />
                  </div>
                </div>
              </IntentErrorBoundary>
            )}
          </div>
        </div>

      </div>
      )}

      {/* BODY: Human Agent */}
      {mode === 'agent' && (
      <div style={{ flex:1, overflow:'hidden', display:'flex' }}>

        {/* CONFIG PANEL */}
        <div style={{ width:300, flexShrink:0, display:'flex', flexDirection:'column', background:'var(--hari-surface)', borderRight:'1px solid var(--hari-border)', overflow:'auto' }}>
          <div style={{ padding:'10px 14px', fontSize:11, fontWeight:700, color:'var(--hari-text-muted)', textTransform:'uppercase', letterSpacing:'0.06em', borderBottom:'1px solid var(--hari-border)' }}>
            Agent Configuration
          </div>
          <div style={{ padding:14, display:'flex', flexDirection:'column', gap:12 }}>

            <label style={{ display:'flex', flexDirection:'column', gap:4 }}>
              <span style={{ fontSize:11, fontWeight:600, color:'var(--hari-text-secondary)', textTransform:'uppercase' }}>Feature Type</span>
              <select value={agentConfig.featureType}
                onChange={e => setAgentConfig(c => ({...c, featureType: e.target.value}))}
                disabled={isAgentRunning}
                style={{ padding:'6px 8px', borderRadius:6, border:'1px solid var(--hari-border)', fontSize:13, color:'var(--hari-text)', background:'var(--hari-bg)', outline:'none', cursor:'pointer' }}>
                {FEATURES.map(f => <option key={f.name} value={f.name} style={{ textTransform:'capitalize' }}>{f.name}</option>)}
              </select>
            </label>

            <label style={{ display:'flex', flexDirection:'column', gap:4 }}>
              <span style={{ fontSize:11, fontWeight:600, color:'var(--hari-text-secondary)', textTransform:'uppercase' }}>Topic / Context Seed</span>
              <textarea
                value={agentConfig.promptContext}
                onChange={e => setAgentConfig(c => ({...c, promptContext: e.target.value}))}
                disabled={isAgentRunning}
                rows={4}
                style={{ resize:'vertical', padding:'8px 10px', borderRadius:6, border:'1px solid var(--hari-border)', fontSize:12, fontFamily:'monospace', color:'var(--hari-text)', background:'var(--hari-bg)', outline:'none', lineHeight:1.5, opacity: isAgentRunning ? 0.6 : 1 }}
                placeholder="Describe the domain, team, system, or scenario. The LLM will generate a fresh, unique prompt from this context on every run."
              />
            </label>

            <label style={{ display:'flex', flexDirection:'column', gap:4 }}>
              <span style={{ fontSize:11, fontWeight:600, color:'var(--hari-text-secondary)', textTransform:'uppercase' }}>Expected Output <span style={{ fontWeight:400, textTransform:'none', color:'var(--hari-text-muted)' }}>(for comparison)</span></span>
              <textarea
                value={agentConfig.expected}
                onChange={e => setAgentConfig(c => ({...c, expected: e.target.value}))}
                disabled={isAgentRunning}
                rows={3}
                style={{ resize:'vertical', padding:'8px 10px', borderRadius:6, border:'1px solid var(--hari-border)', fontSize:12, color:'var(--hari-text)', background:'var(--hari-bg)', outline:'none', lineHeight:1.5, opacity: isAgentRunning ? 0.6 : 1 }}
                placeholder="Describe what you expect the LLM to produce…"
              />
            </label>

            <div style={{ display:'flex', gap:8 }}>
              <label style={{ display:'flex', flexDirection:'column', gap:4, flex:1 }}>
                <span style={{ fontSize:11, fontWeight:600, color:'var(--hari-text-secondary)', textTransform:'uppercase' }}>Iterations</span>
                <select value={agentConfig.infiniteLoop ? 0 : agentConfig.iterations}
                  onChange={e => {
                    const v = Number(e.target.value);
                    setAgentConfig(c => ({...c, iterations: v || 5, infiniteLoop: v === 0}));
                  }}
                  disabled={isAgentRunning}
                  style={{ padding:'6px 8px', borderRadius:6, border:'1px solid var(--hari-border)', fontSize:13, color:'var(--hari-text)', background:'var(--hari-bg)', outline:'none' }}>
                  <option value={1}>1×</option>
                  <option value={3}>3×</option>
                  <option value={5}>5×</option>
                  <option value={10}>10×</option>
                  <option value={25}>25×</option>
                  <option value={0}>∞ Loop</option>
                </select>
              </label>
              <label style={{ display:'flex', flexDirection:'column', gap:4, flex:1 }}>
                <span style={{ fontSize:11, fontWeight:600, color:'var(--hari-text-secondary)', textTransform:'uppercase' }}>Delay</span>
                <select value={agentConfig.delayMs}
                  onChange={e => setAgentConfig(c => ({...c, delayMs: Number(e.target.value)}))}
                  disabled={isAgentRunning}
                  style={{ padding:'6px 8px', borderRadius:6, border:'1px solid var(--hari-border)', fontSize:13, color:'var(--hari-text)', background:'var(--hari-bg)', outline:'none' }}>
                  <option value={500}>0.5s</option>
                  <option value={1000}>1s</option>
                  <option value={2000}>2s</option>
                  <option value={5000}>5s</option>
                  <option value={10000}>10s</option>
                </select>
              </label>
            </div>

            {!isAgentRunning
              ? <TBtn bg="#7c3aed" onClick={runAgentLoop}><Repeat size={13}/> Start Loop</TBtn>
              : <TBtn bg="#d97706" onClick={stopAgentLoop}><Square size={13}/> Stop Loop</TBtn>
            }

            <div style={{ padding:'8px 10px', borderRadius:6, background:'var(--hari-surface-alt)', border:'1px solid var(--hari-border)', fontSize:11, color:'var(--hari-text-muted)', lineHeight:1.6 }}>
              <strong style={{ color:'var(--hari-text-secondary)' }}>How it works:</strong> Each run asks the LLM to generate a unique, rich, realistic prompt from your context seed. That generated prompt is then used to produce the component or answer — so every iteration is different and non-trivial.
            </div>
          </div>
        </div>

        {/* LOG PANEL */}
        <div style={{ flex:2, display:'flex', flexDirection:'column', borderRight:'1px solid var(--hari-border)', minWidth:0 }}>
          <div style={{ flexShrink:0, padding:'10px 14px', background:'var(--hari-surface)', borderBottom:'1px solid var(--hari-border)', display:'flex', alignItems:'center', gap:8 }}>
            <ListChecks size={14} color="var(--hari-text-secondary)" />
            <span style={{ fontWeight:600, fontSize:13, color:'var(--hari-text)' }}>Run Log</span>
            <span style={{ fontSize:11, color:'var(--hari-text-muted)', marginLeft:'auto' }}>{agentRuns.length} runs</span>
          </div>
          <div style={{ flex:1, overflowY:'auto' }}>
            {agentRuns.length === 0 && (
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100%', gap:10, color:'var(--hari-text-muted)' }}>
                <MessageSquare size={32} />
                <p style={{ margin:0, fontSize:13 }}>No runs yet. Start the agent loop to see results here.</p>
              </div>
            )}
            {agentRuns.map((run) => (
              <div key={run.id} style={{ borderBottom:'1px solid var(--hari-border)', padding:'10px 14px', background: run.status==='running' ? 'var(--hari-surface-alt)' : 'transparent' }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                  <span style={{ fontSize:11, fontWeight:700, color:'#6366f1', fontFamily:'monospace' }}>#{run.id}</span>
                  <span style={{ fontSize:10, color:'var(--hari-text-muted)' }}>{run.timestamp.toLocaleTimeString()}</span>
                  {run.status === 'running' && <span style={{ fontSize:10, color:'#2563eb', fontWeight:600, animation:'pulse 1s infinite' }}>RUNNING…</span>}
                  {run.status === 'success' && <span style={{ fontSize:10, color:'#16a34a', fontWeight:600 }}>✓ {run.resultType.toUpperCase()} {run.durationMs}ms</span>}
                  {run.status === 'error' && <span style={{ fontSize:10, color:'#dc2626', fontWeight:600 }}>✗ ERROR {run.durationMs}ms</span>}
                </div>
                <div style={{ marginBottom:6 }}>
                  <div style={{ fontSize:10, fontWeight:600, color:'#7c3aed', textTransform:'uppercase', marginBottom:3 }}>Generated Prompt</div>
                  <div style={{ fontSize:11, color:'var(--hari-text)', background:'var(--hari-surface-alt)', border:'1px solid var(--hari-border)', padding:'5px 7px', borderRadius:4, lineHeight:1.5, fontStyle: run.generatedPrompt.startsWith('…') ? 'italic' : 'normal', overflow:'hidden', display:'-webkit-box', WebkitLineClamp:4, WebkitBoxOrient:'vertical' as const }}>
                    {run.generatedPrompt}
                  </div>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                  <div>
                    <div style={{ fontSize:10, fontWeight:600, color:'var(--hari-text-muted)', textTransform:'uppercase', marginBottom:3 }}>Context Seed</div>
                    <div style={{ fontSize:11, color:'var(--hari-text-secondary)', background:'var(--hari-surface-alt)', padding:'4px 6px', borderRadius:4, lineHeight:1.5, overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' as const }}>
                      {run.seed}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize:10, fontWeight:600, color:'var(--hari-text-muted)', textTransform:'uppercase', marginBottom:3 }}>Expected</div>
                    <div style={{ fontSize:11, color:'var(--hari-text-secondary)', background:'var(--hari-surface-alt)', padding:'4px 6px', borderRadius:4, lineHeight:1.5, overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' as const }}>
                      {run.expected}
                    </div>
                  </div>
                </div>
                {run.status === 'success' && run.textAnswer && (
                  <div style={{ marginTop:6 }}>
                    <div style={{ fontSize:10, fontWeight:600, color:'var(--hari-text-muted)', textTransform:'uppercase', marginBottom:3 }}>Actual (Text)</div>
                    <div style={{ fontSize:11, color:'var(--hari-text)', background:'#f0f9ff', border:'1px solid #bae6fd', padding:'4px 6px', borderRadius:4, lineHeight:1.5, overflow:'hidden', display:'-webkit-box', WebkitLineClamp:4, WebkitBoxOrient:'vertical' as const }}>
                      {run.textAnswer}
                    </div>
                  </div>
                )}
                {run.status === 'success' && run.result && (
                  <div style={{ marginTop:6 }}>
                    <div style={{ fontSize:10, fontWeight:600, color:'var(--hari-text-muted)', textTransform:'uppercase', marginBottom:3 }}>Actual (Component Intent)</div>
                    <div style={{ fontSize:10, color:'var(--hari-text-secondary)', background:'var(--hari-surface-alt)', padding:'4px 6px', borderRadius:4, fontFamily:'monospace', lineHeight:1.4, overflow:'hidden', display:'-webkit-box', WebkitLineClamp:3, WebkitBoxOrient:'vertical' as const }}>
                      type: {run.result.type} | goal: {run.result.primaryGoal?.slice(0,60)}
                    </div>
                  </div>
                )}
                {run.status === 'error' && (
                  <div style={{ marginTop:6, fontSize:11, color:'#dc2626', background:'#fef2f2', border:'1px solid #fecaca', padding:'4px 6px', borderRadius:4 }}>
                    {run.error}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* LATEST RESULT PANEL */}
        <div style={{ flex:1.5, display:'flex', flexDirection:'column', background:'var(--hari-surface)', minWidth:0 }}>
          <div style={{ flexShrink:0, padding:'10px 14px', borderBottom:'1px solid var(--hari-border)', display:'flex', alignItems:'center', gap:8 }}>
            <Bot size={14} color="#7c3aed" />
            <span style={{ fontWeight:600, fontSize:13, color:'var(--hari-text)' }}>Latest Result</span>
            {isAgentRunning && <span style={{ fontSize:10, color:'#7c3aed', fontWeight:600, marginLeft:'auto', animation:'pulse 1s infinite' }}>● LIVE</span>}
          </div>
          <div style={{ flex:1, overflowY:'auto', padding:14 }}>
            {!latestAgentResult && (
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100%', gap:10, color:'var(--hari-text-muted)' }}>
                <Bot size={40} />
                <p style={{ margin:0, fontSize:13 }}>Rendered component or answer will appear here</p>
              </div>
            )}
            {latestAgentResult?.generatedPrompt && (
              <div style={{ marginBottom:12, padding:'8px 10px', borderRadius:6, background:'var(--hari-surface-alt)', border:'1px solid #c4b5fd', fontSize:11, color:'#7c3aed', lineHeight:1.5 }}>
                <span style={{ fontWeight:700, fontSize:10, textTransform:'uppercase', display:'block', marginBottom:3, color:'#6d28d9' }}>Generated Prompt</span>
                {latestAgentResult.generatedPrompt}
              </div>
            )}
            {latestAgentResult?.textAnswer && (
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                <div style={{ display:'flex', alignItems:'center', gap:6, color:'#0369a1', fontSize:12, fontWeight:600 }}>
                  <MessageSquare size={14} /> Text Response
                </div>
                <div style={{ background:'#f0f9ff', border:'1px solid #bae6fd', borderRadius:8, padding:14, fontSize:13, color:'var(--hari-text)', lineHeight:1.7, whiteSpace:'pre-wrap' }}>
                  {latestAgentResult.textAnswer}
                </div>
              </div>
            )}
            {latestAgentResult?.result && (
              <IntentErrorBoundary>
                <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:6, color:'#16a34a', fontSize:12, fontWeight:600 }}>
                    <CheckCircle size={14} /> Component
                  </div>
                  <div style={{ borderRadius:8, border:'1px solid var(--hari-border)', padding:14, background:'var(--hari-bg)' }}>
                    <TestComponentRenderer intent={latestAgentResult.result} />
                  </div>
                </div>
              </IntentErrorBoundary>
            )}
          </div>
        </div>

      </div>
      )}

      <style>{`
        @keyframes spin { from { transform:rotate(0deg) } to { transform:rotate(360deg) } }
        @keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:0.4 } }
      `}</style>
    </div>
  );
}

// ─── tiny helpers ─────────────────────────────────────────────────────────────

function StatPill({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ fontSize:12, fontWeight:600, color, background:`${color}1a`, padding:'2px 8px', borderRadius:999 }}>{label}</span>
  );
}

function TBtn({ children, bg, onClick, disabled }: { children: React.ReactNode; bg: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'6px 12px', borderRadius:6, border:'none', cursor: disabled?'not-allowed':'pointer', background:bg, color:'#fff', fontSize:13, fontWeight:500, opacity: disabled?0.5:1 }}>
      {children}
    </button>
  );
}

function SettingsField({ label, value, onChange, width }: { label: string; value: string; onChange: (v: string) => void; width: number }) {
  return (
    <label style={{ display:'flex', flexDirection:'column', gap:4 }}>
      <span style={{ fontSize:11, fontWeight:600, color:'var(--hari-text-secondary)', textTransform:'uppercase' }}>{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)}
        style={{ width, padding:'6px 10px', borderRadius:6, border:'1px solid var(--hari-border)', fontSize:13, color:'var(--hari-text)', background:'var(--hari-surface)', outline:'none' }} />
    </label>
  );
}

function TestComponentRenderer({ intent }: { intent: IntentPayloadInput }) {
  try {
    const validated = IntentPayloadSchema.parse(intent);
    const compiled = compileIntent(validated, registry);
    if (!compiled) return <p style={{ color:'#dc2626', fontSize:13 }}>Failed to compile intent</p>;
    return <IntentRenderer compiledView={compiled} />;
  } catch (error) {
    return <p style={{ color:'#dc2626', fontSize:13 }}>Render error: {String(error)}</p>;
  }
}
