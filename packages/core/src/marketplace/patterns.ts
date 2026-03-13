// ─────────────────────────────────────────────────────────────────────────────
// Built-in Authority Hierarchy Library + Governance Patterns — Phase 8.1
// ─────────────────────────────────────────────────────────────────────────────

import type { AuthorityHierarchy, GovernancePattern } from './types';

const now = '2026-01-01T00:00:00.000Z';

const BASE_PROVENANCE = {
  author: 'HARI Core Team',
  licence: 'MIT',
  version: '1.0.0',
  publishedAt: now,
  sourceUrl: 'https://github.com/hari/agent-ui-kit',
  stars: 0,
};

// ─────────────────────────────────────────────────────────────────────────────
// Authority Hierarchies
// ─────────────────────────────────────────────────────────────────────────────

export const AUTHORITY_HIERARCHIES: AuthorityHierarchy[] = [
  // ── Standard 4-Level (HARI Default) ───────────────────────────────────────
  {
    id: 'hari-standard',
    name: 'HARI Standard 4-Level',
    description: 'The default HARI observe→intervene→approve→override escalation chain',
    provenance: BASE_PROVENANCE,
    category: 'general',
    rationale:
      'Balances read-only oversight with explicit escalation gates. Each level requires a deliberate action to enter, creating natural audit checkpoints.',
    levels: [
      {
        mode: 'observe',
        label: 'Observer',
        allowedRoles: ['viewer', 'auditor', 'stakeholder'],
        requiresJustification: false,
        requiresDualAuthorisation: false,
        auditLogged: true,
      },
      {
        mode: 'intervene',
        label: 'Operator',
        allowedRoles: ['operator', 'engineer', 'sre-l1'],
        requiresJustification: false,
        requiresDualAuthorisation: false,
        auditLogged: true,
      },
      {
        mode: 'approve',
        label: 'Approver',
        allowedRoles: ['tech-lead', 'platform-lead', 'sre-l2', 'manager'],
        maxDuration: 'PT8H',
        requiresJustification: true,
        requiresDualAuthorisation: false,
        auditLogged: true,
      },
      {
        mode: 'override',
        label: 'Override',
        allowedRoles: ['on-call-lead', 'vp-engineering', 'cto', 'sre-lead'],
        maxDuration: 'PT2H',
        requiresJustification: true,
        requiresDualAuthorisation: false,
        auditLogged: true,
      },
    ],
    autoDowngrade: { enabled: true, afterDuration: 'PT2H', targetMode: 'approve' },
  },

  // ── ITIL-Aligned CAB ─────────────────────────────────────────────────────
  {
    id: 'itil-cab',
    name: 'ITIL Change Advisory Board',
    description:
      'ITIL-aligned change authority chain mapping to Emergency CAB escalation path',
    provenance: { ...BASE_PROVENANCE, version: '1.0.0' },
    category: 'deployment',
    rationale:
      'Mirrors the ITIL Emergency Change process: normal changes go through standard CAB (approve); emergency changes escalate to ECAB (override) with mandatory retrospective review.',
    levels: [
      {
        mode: 'observe',
        label: 'Change Observer',
        allowedRoles: ['developer', 'release-engineer'],
        requiresJustification: false,
        requiresDualAuthorisation: false,
        auditLogged: true,
      },
      {
        mode: 'intervene',
        label: 'Change Owner',
        allowedRoles: ['change-owner', 'release-manager'],
        requiresJustification: true,
        requiresDualAuthorisation: false,
        auditLogged: true,
      },
      {
        mode: 'approve',
        label: 'CAB Approver',
        allowedRoles: ['cab-member', 'change-manager'],
        maxDuration: 'PT24H',
        requiresJustification: true,
        requiresDualAuthorisation: true,
        auditLogged: true,
      },
      {
        mode: 'override',
        label: 'ECAB (Emergency CAB)',
        allowedRoles: ['ecab-chair', 'cto', 'vp-operations'],
        maxDuration: 'PT4H',
        requiresJustification: true,
        requiresDualAuthorisation: true,
        auditLogged: true,
      },
    ],
    autoDowngrade: { enabled: true, afterDuration: 'PT4H', targetMode: 'approve' },
  },

  // ── Financial Dual-Control ────────────────────────────────────────────────
  {
    id: 'financial-dual-control',
    name: 'Financial Dual-Control Authority',
    description:
      'Four-eyes principle for financial transactions — two independent approvers at every elevated level',
    provenance: BASE_PROVENANCE,
    category: 'finance',
    rationale:
      'Regulatory requirement in most financial institutions. No single person can approve high-value transactions. Both the initiation (intervene) and approval stages require independent authorisation.',
    levels: [
      {
        mode: 'observe',
        label: 'Finance Monitor',
        allowedRoles: ['finance-analyst', 'auditor'],
        requiresJustification: false,
        requiresDualAuthorisation: false,
        auditLogged: true,
      },
      {
        mode: 'intervene',
        label: 'Transaction Initiator',
        allowedRoles: ['finance-officer', 'treasury-analyst'],
        requiresJustification: true,
        requiresDualAuthorisation: false,
        auditLogged: true,
      },
      {
        mode: 'approve',
        label: 'Dual Authoriser',
        allowedRoles: ['cfo', 'finance-director', 'treasury-manager'],
        maxDuration: 'PT48H',
        requiresJustification: true,
        requiresDualAuthorisation: true,
        auditLogged: true,
      },
      {
        mode: 'override',
        label: 'Board-Level Override',
        allowedRoles: ['board-member', 'ceo', 'group-cfo'],
        maxDuration: 'PT1H',
        requiresJustification: true,
        requiresDualAuthorisation: true,
        auditLogged: true,
      },
    ],
    autoDowngrade: { enabled: true, afterDuration: 'PT1H', targetMode: 'approve' },
  },

  // ── Incident Response Command ─────────────────────────────────────────────
  {
    id: 'incident-command',
    name: 'Incident Command Structure',
    description:
      'Modelled after the Incident Command System (ICS) used in emergency management',
    provenance: BASE_PROVENANCE,
    category: 'incident-response',
    rationale:
      'In a major incident, clear command authority prevents conflicting actions. The IC has override authority while the situation is active; authority automatically returns to normal when incident is closed.',
    levels: [
      {
        mode: 'observe',
        label: 'Incident Responder',
        allowedRoles: ['sre', 'developer', 'support'],
        requiresJustification: false,
        requiresDualAuthorisation: false,
        auditLogged: true,
      },
      {
        mode: 'intervene',
        label: 'Technical Lead',
        allowedRoles: ['tech-lead', 'sre-lead'],
        requiresJustification: true,
        requiresDualAuthorisation: false,
        auditLogged: true,
      },
      {
        mode: 'approve',
        label: 'Incident Coordinator',
        allowedRoles: ['incident-coordinator', 'ops-manager'],
        maxDuration: 'PT12H',
        requiresJustification: true,
        requiresDualAuthorisation: false,
        auditLogged: true,
      },
      {
        mode: 'override',
        label: 'Incident Commander',
        allowedRoles: ['incident-commander', 'vp-engineering', 'cto'],
        maxDuration: 'PT4H',
        requiresJustification: true,
        requiresDualAuthorisation: false,
        auditLogged: true,
      },
    ],
    autoDowngrade: { enabled: true, afterDuration: 'PT4H', targetMode: 'observe' },
  },

  // ── Security Operations ───────────────────────────────────────────────────
  {
    id: 'security-ops',
    name: 'Security Operations Authority',
    description:
      'Security-specific escalation chain from monitoring through incident response to emergency authority',
    provenance: BASE_PROVENANCE,
    category: 'security',
    rationale:
      'Security operations require rapid escalation paths but with strong justification requirements at each level to prevent misuse of elevated access.',
    levels: [
      {
        mode: 'observe',
        label: 'Security Analyst',
        allowedRoles: ['security-analyst', 'soc-analyst'],
        requiresJustification: false,
        requiresDualAuthorisation: false,
        auditLogged: true,
      },
      {
        mode: 'intervene',
        label: 'Security Engineer',
        allowedRoles: ['security-engineer', 'detection-engineer'],
        requiresJustification: true,
        requiresDualAuthorisation: false,
        auditLogged: true,
      },
      {
        mode: 'approve',
        label: 'Security Manager',
        allowedRoles: ['security-manager', 'ciso-delegate'],
        maxDuration: 'PT8H',
        requiresJustification: true,
        requiresDualAuthorisation: false,
        auditLogged: true,
      },
      {
        mode: 'override',
        label: 'CISO / Emergency Authority',
        allowedRoles: ['ciso', 'vp-security'],
        maxDuration: 'PT2H',
        requiresJustification: true,
        requiresDualAuthorisation: true,
        auditLogged: true,
      },
    ],
    autoDowngrade: { enabled: true, afterDuration: 'PT2H', targetMode: 'approve' },
  },

  // ── Minimal (Lean Startups / Internal Tools) ──────────────────────────────
  {
    id: 'minimal-two-level',
    name: 'Minimal Two-Level (Lean)',
    description:
      'Lightweight observe→approve authority for small teams without complex governance needs',
    provenance: BASE_PROVENANCE,
    category: 'general',
    rationale:
      'Not every team needs four levels. This minimal hierarchy keeps governance overhead low while ensuring a human approves meaningful actions.',
    levels: [
      {
        mode: 'observe',
        label: 'Team Member',
        allowedRoles: [],
        requiresJustification: false,
        requiresDualAuthorisation: false,
        auditLogged: false,
      },
      {
        mode: 'approve',
        label: 'Team Lead / Approver',
        allowedRoles: ['team-lead', 'owner'],
        requiresJustification: true,
        requiresDualAuthorisation: false,
        auditLogged: true,
      },
    ],
    autoDowngrade: { enabled: false },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Governance Patterns
// ─────────────────────────────────────────────────────────────────────────────

export const GOVERNANCE_PATTERNS: GovernancePattern[] = [
  // ── Production Deployment ──────────────────────────────────────────────────
  {
    id: 'production-deployment',
    name: 'ITIL Production Deployment',
    description:
      'Complete change management pattern for production service deployments, aligned to ITIL v4 and SOC 2',
    provenance: BASE_PROVENANCE,
    category: 'deployment',
    tags: ['production', 'deployment', 'itil', 'soc2', 'change-management'],
    longDescription:
      'Covers the full lifecycle of a production change: pre-deployment verification (backup, tests, rollback plan, change window), canary progression, and post-deployment monitoring gate. Uses ITIL CAB authority hierarchy.',
    exampleUseCases: [
      'Deploying a new microservice version to production',
      'Database schema migration in a live environment',
      'Infrastructure change requiring CAB approval',
    ],
    authorityHierarchyId: 'itil-cab',
    preconditionTemplates: [
      { templateId: 'backup-verified', slotOverrides: {}, required: true },
      { templateId: 'test-results-attached', slotOverrides: {}, required: true },
      { templateId: 'rollback-plan-approved', slotOverrides: {}, required: true },
      { templateId: 'maintenance-window-open', slotOverrides: {}, required: false },
      { templateId: 'change-freeze-cleared', slotOverrides: {}, required: true },
      { templateId: 'canary-health-confirmed', slotOverrides: {}, required: false },
      { templateId: 'monitoring-in-place', slotOverrides: {}, required: true },
      { templateId: 'on-call-engineer-available', slotOverrides: {}, required: true },
    ],
    recommendedDeliberationDelay: 'PT5M',
    complianceFrameworks: ['SOC 2 Type II', 'ITIL v4', 'ISO 27001'],
  },

  // ── Incident Response ─────────────────────────────────────────────────────
  {
    id: 'major-incident-response',
    name: 'Major Incident Response',
    description:
      'Governance pattern for responding to Severity 1/P1 incidents with emergency authority',
    provenance: BASE_PROVENANCE,
    category: 'incident-response',
    tags: ['incident', 'p1', 'emergency', 'sre', 'on-call'],
    longDescription:
      'Designed for the first 30 minutes of a major incident where speed matters but governance must not be abandoned. Pre-authorises the IC for override actions while requiring a rapid blast-radius assessment and communications.',
    exampleUseCases: [
      'Database failover during production outage',
      'Emergency traffic rerouting to backup region',
      'Stopping a runaway process causing data corruption',
    ],
    authorityHierarchyId: 'incident-command',
    preconditionTemplates: [
      { templateId: 'incident-commander-notified', slotOverrides: {}, required: true },
      { templateId: 'blast-radius-assessed', slotOverrides: {}, required: true },
      { templateId: 'runbook-executed', slotOverrides: {}, required: false },
      { templateId: 'customer-comms-sent', slotOverrides: {}, required: false },
    ],
    recommendedDeliberationDelay: 'PT1M',
    complianceFrameworks: ['NIST SP 800-61', 'ISO 27035'],
  },

  // ── Financial Transaction ──────────────────────────────────────────────────
  {
    id: 'high-value-transaction',
    name: 'High-Value Financial Transaction',
    description:
      'Dual-control pattern for financial transactions above materiality threshold',
    provenance: BASE_PROVENANCE,
    category: 'finance',
    tags: ['finance', 'dual-control', 'four-eyes', 'sox', 'pci-dss'],
    longDescription:
      'Enforces four-eyes separation of duties for high-value payments, transfers, and contracts. Requires independent verification of budget authorisation, dual approver signatures, and audit-ready evidence.',
    exampleUseCases: [
      'Wire transfer above $10,000',
      'Vendor contract signature above materiality threshold',
      'Emergency fund release requiring board approval',
    ],
    authorityHierarchyId: 'financial-dual-control',
    preconditionTemplates: [
      { templateId: 'budget-approved', slotOverrides: {}, required: true },
      { templateId: 'dual-control-finance', slotOverrides: {}, required: true },
      { templateId: 'peer-review-complete', slotOverrides: { changeType: 'financial transaction' }, required: true },
    ],
    recommendedDeliberationDelay: 'PT30M',
    complianceFrameworks: ['SOX', 'PCI DSS', 'COSO'],
  },

  // ── Security Emergency ────────────────────────────────────────────────────
  {
    id: 'security-emergency-response',
    name: 'Security Emergency Response',
    description:
      'Governance pattern for active security incident response — breach, ransomware, or insider threat',
    provenance: BASE_PROVENANCE,
    category: 'security',
    tags: ['security', 'breach', 'ciso', 'incident'],
    longDescription:
      'Provides CISO-level override authority with mandatory dual-control for any containment action that isolates systems or revokes access. All actions are immutably audit-logged.',
    exampleUseCases: [
      'Isolating a compromised server during an active breach',
      'Mass-revoking credentials after credential stuffing attack',
      'Blocking a malicious IP range at the network edge',
    ],
    authorityHierarchyId: 'security-ops',
    preconditionTemplates: [
      { templateId: 'incident-commander-notified', slotOverrides: { icName: 'CISO or delegate', channel: 'secure incident channel' }, required: true },
      { templateId: 'blast-radius-assessed', slotOverrides: {}, required: true },
      { templateId: 'access-review-complete', slotOverrides: {}, required: false },
    ],
    recommendedDeliberationDelay: 'PT2M',
    complianceFrameworks: ['NIST CSF', 'ISO 27001', 'GDPR Art.33'],
  },

  // ── Data Processing (GDPR) ────────────────────────────────────────────────
  {
    id: 'gdpr-data-processing',
    name: 'GDPR-Compliant Data Processing Change',
    description:
      'Pattern for changes to personal data processing activities requiring DPO oversight',
    provenance: BASE_PROVENANCE,
    category: 'compliance',
    tags: ['gdpr', 'privacy', 'dpo', 'data-processing'],
    longDescription:
      'Required when modifying how personal data is collected, processed, or shared. Mandates a Privacy Impact Assessment, legal review, and data classification verification before the change proceeds.',
    exampleUseCases: [
      'Adding a new analytics provider that receives personal data',
      'Exporting EU customer data to a third country',
      'Changing retention policies for user data',
    ],
    authorityHierarchyId: 'hari-standard',
    preconditionTemplates: [
      { templateId: 'gdpr-pia-complete', slotOverrides: {}, required: true },
      { templateId: 'legal-review-complete', slotOverrides: {}, required: true },
      { templateId: 'data-classification-verified', slotOverrides: {}, required: true },
      { templateId: 'stakeholder-notified', slotOverrides: { stakeholders: 'DPO and Legal' }, required: true },
    ],
    recommendedDeliberationDelay: 'PT24H',
    complianceFrameworks: ['GDPR', 'CCPA', 'LGPD'],
  },
];

// ── Pattern Registry ──────────────────────────────────────────────────────────

export function getHierarchyById(id: string): AuthorityHierarchy | undefined {
  return AUTHORITY_HIERARCHIES.find((h) => h.id === id);
}

export function getPatternById(id: string): GovernancePattern | undefined {
  return GOVERNANCE_PATTERNS.find((p) => p.id === id);
}

export function searchHierarchies(
  query: string,
  category?: string,
): AuthorityHierarchy[] {
  const q = query.toLowerCase();
  return AUTHORITY_HIERARCHIES.filter((h) => {
    const matchesQuery =
      !q ||
      h.name.toLowerCase().includes(q) ||
      h.description.toLowerCase().includes(q);
    const matchesCategory = !category || h.category === category;
    return matchesQuery && matchesCategory;
  });
}

export function searchPatterns(
  query: string,
  category?: string,
): GovernancePattern[] {
  const q = query.toLowerCase();
  return GOVERNANCE_PATTERNS.filter((p) => {
    const matchesQuery =
      !q ||
      p.name.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q) ||
      p.tags.some((t) => t.includes(q));
    const matchesCategory = !category || p.category === category;
    return matchesQuery && matchesCategory;
  });
}
