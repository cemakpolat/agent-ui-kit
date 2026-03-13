import { v4 as uuid } from 'uuid';
import type { IntentPayloadInput } from '@hari/core';

// ─────────────────────────────────────────────────────────────────────────────
// Tree scenario: "Platform Engineering org chart"
//
// Demonstrates the tree intent type with a multi-level org chart showing
// teams, headcount badges, status indicators, and rich metadata.
// ─────────────────────────────────────────────────────────────────────────────

export const treeOrgChartIntent: IntentPayloadInput = {
  version: '1.0.0',
  intentId: uuid(),
  type: 'tree',
  domain: 'hr',
  primaryGoal: 'Visualise the Platform Engineering organisational hierarchy',
  confidence: 0.98,
  density: 'operator',
  layoutHint: 'dashboard',

  data: {
    title: 'Platform Engineering — Org Chart',
    showLines: true,
    searchable: true,
    defaultExpandAll: false,
    nodes: [
      {
        id: 'vp-eng',
        label: 'VP Engineering',
        description: 'Dr. Elena Vasquez — Strategic direction and executive reporting.',
        icon: 'user', // VP Engineering
        badge: 87,
        status: 'active',
        defaultExpanded: true,
        metadata: { location: 'NYC HQ', tenure: '4 years', budget: '$12M' },
        children: [
          {
            id: 'platform',
            label: 'Platform Engineering',
            description: 'Core infrastructure, developer experience, internal tooling.',
            icon: 'infra', // Platform Engineering
            badge: 24,
            color: '#6366f1',
            status: 'active',
            defaultExpanded: true,
            explainElementId: 'platform-explain',
            metadata: { head_count: 24, open_roles: 3, avg_tenure: '2.1 years' },
            children: [
              {
                id: 'infra',
                label: 'Infrastructure',
                icon: 'server', // Infrastructure
                badge: 9,
                status: 'active',
                metadata: { cloud: 'AWS + GCP', on_call: 'Alice Chen' },
                children: [
                  { id: 'infra-alice', label: 'Alice Chen', description: 'Staff SRE — on-call lead', icon: 'engineer', status: 'active', badge: 'lead' },
                  { id: 'infra-bob',   label: 'Bob Okafor',  description: 'Senior SRE', icon: 'engineer', status: 'active' },
                  { id: 'infra-carol', label: 'Carol Yuen',  description: 'SRE', icon: 'engineer', status: 'active' },
                  { id: 'infra-dave',  label: 'Dave Müller', description: 'SRE — on maternity cover', icon: 'engineer', status: 'inactive' },
                  { id: 'infra-eve',   label: 'Eve Kovaleva', description: 'Senior Network Eng', icon: 'engineer', status: 'active' },
                  {
                    id: 'infra-security',
                    label: 'Security',
                    icon: 'lock', // Security
                    badge: 4,
                    status: 'warning',
                    metadata: { open_incidents: 2 },
                    children: [
                      { id: 'sec-frank',  label: 'Frank Liu',    description: 'Staff Security Eng', icon: 'engineer', status: 'active', badge: 'lead' },
                      { id: 'sec-grace',  label: 'Grace Patel',  description: 'Security Eng', icon: 'engineer', status: 'active' },
                      { id: 'sec-henry',  label: 'Henry Santos', description: 'Pen-tester', icon: 'engineer', status: 'active' },
                      { id: 'sec-role1',  label: '🔍 Open Role', description: 'Security Analyst — hiring in progress', icon: 'task', status: 'inactive' },
                    ],
                  },
                ],
              },
              {
                id: 'dx',
                label: 'Developer Experience',
                icon: 'tools', // Developer Experience
                badge: 7,
                status: 'active',
                metadata: { tools: 'internal CI/CD, dev-env, docs platform' },
                children: [
                  { id: 'dx-ivan',   label: 'Ivan Petrov',  description: 'Staff Eng — DX lead', icon: 'engineer', status: 'active', badge: 'lead' },
                  { id: 'dx-jane',   label: 'Jane Ochoa',   description: 'Senior Eng', icon: 'engineer', status: 'active' },
                  { id: 'dx-kim',    label: 'Kim Nakamura', description: 'Eng II', icon: 'engineer', status: 'active' },
                  { id: 'dx-leo',    label: 'Leo Rahman',   description: 'Technical Writer', icon: 'docs', status: 'active' },
                ],
              },
              {
                id: 'data-plat',
                label: 'Data Platform',
                icon: 'database', // Data Platform
                badge: 8,
                status: 'active',
                metadata: { stack: 'Spark, Kafka, dbt, Snowflake' },
                children: [
                  { id: 'dp-maya',  label: 'Maya Torres',  description: 'Staff Data Eng — lead', icon: 'engineer', status: 'active', badge: 'lead' },
                  { id: 'dp-noah',  label: 'Noah Williams', description: 'Senior Data Eng', icon: 'engineer', status: 'active' },
                  { id: 'dp-omar',  label: 'Omar Hassan',  description: 'Data Eng', icon: 'engineer', status: 'active' },
                  { id: 'dp-priya', label: 'Priya Singh',  description: 'Analytics Eng', icon: 'engineer', status: 'active' },
                  { id: 'dp-role2', label: '🔍 Open Role', description: 'Senior Data Eng — headcount approved', icon: 'task', status: 'inactive' },
                ],
              },
            ],
          },

          {
            id: 'product-eng',
            label: 'Product Engineering',
            description: 'Customer-facing product development.',
            icon: 'deploy', // Product Engineering
            badge: 38,
            color: '#0ea5e9',
            status: 'active',
            metadata: { head_count: 38, open_roles: 5 },
            children: [
              {
                id: 'frontend',
                label: 'Frontend',
                icon: 'design', // Frontend
                badge: 14,
                status: 'active',
                children: [
                  { id: 'fe-quinn', label: 'Quinn Taylor', description: 'Staff Eng — Frontend lead', icon: 'engineer', status: 'active', badge: 'lead' },
                  { id: 'fe-rosa',  label: 'Rosa Kim',     description: 'Senior Eng', icon: 'engineer', status: 'active' },
                  { id: 'fe-sam',   label: 'Sam Johansson', description: 'Eng III', icon: 'engineer', status: 'active' },
                ],
              },
              {
                id: 'backend',
                label: 'Backend',
                icon: 'settings', // Backend
                badge: 16,
                status: 'active',
                children: [
                  { id: 'be-tara', label: 'Tara Adesanya', description: 'Staff Eng — Backend lead', icon: 'engineer', status: 'active', badge: 'lead' },
                  { id: 'be-uri',  label: 'Uri Cohen',     description: 'Senior Eng', icon: 'engineer', status: 'active' },
                  { id: 'be-vera', label: 'Vera Novak',    description: 'Senior Eng', icon: 'engineer', status: 'active' },
                ],
              },
              {
                id: 'mobile',
                label: 'Mobile',
                icon: 'mobile', // Mobile
                badge: 8,
                status: 'warning',
                metadata: { open_roles: 2, risk: 'key person dependency on lead' },
                children: [
                  { id: 'mob-will', label: 'Will Chang',  description: 'Mobile lead — only iOS specialist', icon: 'engineer', status: 'warning', badge: 'lead' },
                  { id: 'mob-xia',  label: 'Xia Peng',   description: 'Android Eng', icon: 'engineer', status: 'active' },
                ],
              },
            ],
          },

          {
            id: 'ai-ml',
            label: 'AI / ML',
            description: 'Model development, MLOps, experimentation platform.',
            icon: 'bot', // AI / ML
            badge: 12,
            color: '#10b981',
            status: 'active',
            metadata: { head_count: 12, open_roles: 2, stack: 'PyTorch, Ray, Kubeflow' },
            children: [
              { id: 'ml-yuki',   label: 'Yuki Tanaka',  description: 'ML Director', icon: 'engineer', status: 'active', badge: 'director' },
              { id: 'ml-zara',   label: 'Zara El-Amin', description: 'Staff ML Eng', icon: 'engineer', status: 'active' },
              { id: 'ml-aaron',  label: 'Aaron Brody',  description: 'ML Eng', icon: 'engineer', status: 'active' },
              { id: 'ml-role3',  label: '🔍 Open Role', description: 'Research Scientist', icon: 'task', status: 'inactive' },
              { id: 'ml-role4',  label: '🔍 Open Role', description: 'MLOps Engineer', icon: 'task', status: 'inactive' },
            ],
          },

          {
            id: 'qa',
            label: 'Quality Engineering',
            icon: 'check', // Quality Engineering
            badge: 13,
            color: '#f59e0b',
            status: 'active',
            metadata: { head_count: 13, test_coverage: '84%' },
            children: [
              { id: 'qa-beth',  label: 'Beth Osei',   description: 'QE lead', icon: 'engineer', status: 'active', badge: 'lead' },
              { id: 'qa-carl',  label: 'Carl Faber',  description: 'Automation Eng', icon: 'engineer', status: 'active' },
              { id: 'qa-diana', label: 'Diana Reyes', description: 'Manual QA', icon: 'engineer', status: 'active' },
            ],
          },
        ],
      },
    ],
  },

  explainability: {
    overview: {
      elementId: 'overview',
      summary: 'The agent retrieved the current organisational structure from the HR system and rendered it as an interactive hierarchy.',
      confidenceRange: { low: 0.95, high: 0.98 },
      dataSources: [],
      assumptions: [],
      alternativesConsidered: [],
      whatIfQueries: [],
    },
    'platform-explain': {
      elementId: 'platform-explain',
      summary: 'Platform Engineering was highlighted because it has 3 open roles, which is above the 10% vacancy threshold that triggers agent attention.',
      dataSources: [{ name: 'HR system', type: 'api' }],
      confidenceRange: { low: 0.92, high: 0.95 },
      assumptions: [],
      alternativesConsidered: [],
      whatIfQueries: [],
    },
  },
};
