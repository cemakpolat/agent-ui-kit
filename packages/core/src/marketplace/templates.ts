// ─────────────────────────────────────────────────────────────────────────────
// Built-in Precondition Template Library — Phase 8.1
//
// 30 curated templates covering the most common governance scenarios.
// Community contributions should follow the same schema and be pushed
// as separate @hari/marketplace-* packages.
// ─────────────────────────────────────────────────────────────────────────────

import type { PreconditionTemplate } from './types';

const now = '2026-01-01T00:00:00.000Z';

const BASE_PROVENANCE = {
  author: 'HARI Core Team',
  licence: 'MIT',
  version: '1.0.0',
  publishedAt: now,
  sourceUrl: 'https://github.com/hari/agent-ui-kit',
  stars: 0,
};

export const PRECONDITION_TEMPLATES: PreconditionTemplate[] = [
  // ── Deployment / Infrastructure ──────────────────────────────────────────
  {
    id: 'backup-verified',
    name: 'Backup Verified',
    description: 'Backup must have been completed before any destructive operation',
    provenance: BASE_PROVENANCE,
    category: 'deployment',
    tags: ['backup', 'data-safety', 'pre-deploy'],
    template: {
      description: '{{service}} data backup verified within the last {{window}}',
      defaultSlots: { service: 'the target service', window: '24 hours' },
      verificationMethod: 'Check backup dashboard or run `backup status {{service}}`',
      resolution: 'Trigger a manual backup via the backup service before proceeding',
    },
    criticality: 'critical',
    minimumWaiverAuthority: 'override',
    applicableActionTypes: ['delete', 'migrate', 'deploy', 'upgrade'],
  },
  {
    id: 'rollback-plan-approved',
    name: 'Rollback Plan Approved',
    description: 'A tested rollback procedure must exist and be approved before deployment',
    provenance: BASE_PROVENANCE,
    category: 'deployment',
    tags: ['rollback', 'continuity', 'pre-deploy'],
    template: {
      description: 'Rollback plan for {{service}} v{{targetVersion}} reviewed and approved by {{approver}}',
      defaultSlots: { service: 'service', targetVersion: '?', approver: 'Platform Lead' },
      verificationMethod: 'Confirm rollback runbook link in the release ticket',
      resolution: 'Create and test rollback procedure, then get sign-off from platform lead',
    },
    criticality: 'high',
    minimumWaiverAuthority: 'override',
    applicableActionTypes: ['deploy', 'upgrade'],
  },
  {
    id: 'maintenance-window-open',
    name: 'Maintenance Window Open',
    description: 'Changes must occur within the agreed change window',
    provenance: BASE_PROVENANCE,
    category: 'deployment',
    tags: ['change-management', 'scheduling'],
    template: {
      description: 'Current time is within the approved maintenance window: {{window}} {{timezone}}',
      defaultSlots: { window: 'Saturday 02:00–06:00', timezone: 'UTC' },
      verificationMethod: 'Check change management calendar; window must be pre-approved',
      resolution: 'Reschedule change to the next approved window or request emergency CAB approval',
    },
    criticality: 'high',
    minimumWaiverAuthority: 'override',
    applicableActionTypes: ['deploy', 'config-change', 'restart'],
  },
  {
    id: 'canary-health-confirmed',
    name: 'Canary Deployment Healthy',
    description: 'Canary deployment must pass health checks before full rollout',
    provenance: BASE_PROVENANCE,
    category: 'deployment',
    tags: ['canary', 'progressive-delivery'],
    template: {
      description: 'Canary for {{service}} at {{percentage}}% traffic is healthy (error rate < {{errorThreshold}}, p99 < {{latencyThreshold}})',
      defaultSlots: { service: 'service', percentage: '5', errorThreshold: '0.1%', latencyThreshold: '500ms' },
      verificationMethod: 'Review canary metrics dashboard',
      resolution: 'Wait for canary stabilisation period or rollback canary and investigate',
    },
    criticality: 'high',
    minimumWaiverAuthority: 'override',
    applicableActionTypes: ['deploy'],
  },
  {
    id: 'no-concurrent-changes',
    name: 'No Concurrent Changes',
    description: 'No other change should be in-flight for the same service',
    provenance: BASE_PROVENANCE,
    category: 'deployment',
    tags: ['coordination', 'change-management'],
    template: {
      description: 'No other active changes are in progress for {{service}} or dependent services: {{dependencies}}',
      defaultSlots: { service: 'service', dependencies: 'none listed' },
      verificationMethod: 'Check change management board for open items',
      resolution: 'Wait for concurrent change to complete or coordinate with change owner',
    },
    criticality: 'medium',
    minimumWaiverAuthority: 'approve',
    applicableActionTypes: ['deploy', 'config-change'],
  },

  // ── Security ──────────────────────────────────────────────────────────────
  {
    id: 'sast-scan-passed',
    name: 'SAST Scan Passed',
    description: 'Static analysis must complete with no critical findings',
    provenance: BASE_PROVENANCE,
    category: 'security',
    tags: ['sast', 'security-scanning', 'pre-deploy'],
    template: {
      description: 'SAST scan for {{artifact}} completed with no critical or high findings (run ID: {{scanId}})',
      defaultSlots: { artifact: 'the release artifact', scanId: 'latest' },
      verificationMethod: 'Check CI pipeline SAST stage or security dashboard',
      resolution: 'Remediate critical/high findings or obtain security waiver with documented risk acceptance',
    },
    criticality: 'critical',
    minimumWaiverAuthority: 'override',
    applicableActionTypes: ['deploy', 'release'],
  },
  {
    id: 'dependency-audit-clean',
    name: 'Dependency Audit Clean',
    description: 'Third-party dependencies must have no known critical CVEs',
    provenance: BASE_PROVENANCE,
    category: 'security',
    tags: ['dependencies', 'cve', 'supply-chain'],
    template: {
      description: 'Dependency audit for {{artifact}} shows no critical CVEs (audit date: {{auditDate}})',
      defaultSlots: { artifact: 'artifact', auditDate: 'today' },
      verificationMethod: 'Run `npm audit --audit-level=critical` or check SCA report',
      resolution: 'Update or patch affected dependencies; if not possible, document accepted risk',
    },
    criticality: 'high',
    minimumWaiverAuthority: 'override',
    applicableActionTypes: ['deploy', 'release'],
  },
  {
    id: 'pen-test-cleared',
    name: 'Penetration Test Cleared',
    description: 'Periodic penetration test must have been completed within allowed age',
    provenance: BASE_PROVENANCE,
    category: 'security',
    tags: ['pen-test', 'security-audit'],
    template: {
      description: 'Latest penetration test for {{system}} completed within {{age}} with no critical findings',
      defaultSlots: { system: 'the system', age: '90 days' },
      verificationMethod: 'Review pen-test report in security vault',
      resolution: 'Schedule and complete penetration test before proceeding',
    },
    criticality: 'high',
    minimumWaiverAuthority: 'override',
    applicableActionTypes: ['release', 'launch'],
  },
  {
    id: 'access-review-complete',
    name: 'Access Review Completed',
    description: 'Periodic access review must be current for sensitive operations',
    provenance: BASE_PROVENANCE,
    category: 'security',
    tags: ['iam', 'access-review', 'compliance'],
    template: {
      description: 'Access review for {{resource}} completed within the last {{period}} by {{reviewer}}',
      defaultSlots: { resource: 'the target resource', period: '30 days', reviewer: 'Security Team' },
      verificationMethod: 'Check IAM audit log or access review system',
      resolution: 'Complete access review for this resource before proceeding',
    },
    criticality: 'medium',
    minimumWaiverAuthority: 'approve',
    applicableActionTypes: ['access-grant', 'privilege-escalation'],
  },
  {
    id: 'secrets-rotated',
    name: 'Secrets Rotated',
    description: 'Credentials/secrets must have been rotated within policy period',
    provenance: BASE_PROVENANCE,
    category: 'security',
    tags: ['secrets', 'credentials', 'rotation'],
    template: {
      description: '{{secretType}} for {{service}} rotated within the last {{rotationPeriod}}',
      defaultSlots: { secretType: 'API keys and service credentials', service: 'service', rotationPeriod: '90 days' },
      verificationMethod: 'Check secrets manager for last rotation timestamp',
      resolution: 'Initiate secret rotation via secrets manager before proceeding',
    },
    criticality: 'high',
    minimumWaiverAuthority: 'approve',
    applicableActionTypes: ['deploy', 'release', 'access-grant'],
  },

  // ── Incident Response ──────────────────────────────────────────────────────
  {
    id: 'incident-commander-notified',
    name: 'Incident Commander Notified',
    description: 'Incident commander must be aware before any override action',
    provenance: BASE_PROVENANCE,
    category: 'incident-response',
    tags: ['incident', 'communication', 'escalation'],
    template: {
      description: 'Incident commander {{icName}} notified of intended action via {{channel}}',
      defaultSlots: { icName: 'on-call IC', channel: 'incident Slack channel' },
      verificationMethod: 'Confirm IC acknowledgement message in incident channel',
      resolution: 'Page incident commander and await acknowledgement',
    },
    criticality: 'high',
    minimumWaiverAuthority: 'override',
    applicableActionTypes: ['override', 'emergency-restart', 'traffic-reroute'],
  },
  {
    id: 'blast-radius-assessed',
    name: 'Blast Radius Assessed',
    description: 'Impact scope must be understood before executing high-risk actions',
    provenance: BASE_PROVENANCE,
    category: 'incident-response',
    tags: ['blast-radius', 'risk-assessment'],
    template: {
      description: 'Blast radius of {{action}} assessed: affects {{affectedSystems}}, estimated {{userImpact}} users',
      defaultSlots: { action: 'the proposed action', affectedSystems: 'unknown', userImpact: 'unknown' },
      verificationMethod: 'Run dependency graph analysis or consult architecture diagram',
      resolution: 'Map dependencies and re-assess impact before proceeding',
    },
    criticality: 'critical',
    minimumWaiverAuthority: 'override',
    applicableActionTypes: ['override', 'restart', 'failover'],
  },
  {
    id: 'customer-comms-sent',
    name: 'Customer Communications Sent',
    description: 'Customers must be notified before customer-visible impact',
    provenance: BASE_PROVENANCE,
    category: 'incident-response',
    tags: ['communications', 'status-page', 'customer'],
    template: {
      description: 'Status page updated and customer-facing communications sent for {{incidentType}} impact',
      defaultSlots: { incidentType: 'the incident' },
      verificationMethod: 'Check status page and confirm comms were sent via Customer Success',
      resolution: 'Update status page and notify Customer Success team immediately',
    },
    criticality: 'high',
    minimumWaiverAuthority: 'approve',
    applicableActionTypes: ['service-degradation', 'maintenance', 'failover'],
  },
  {
    id: 'runbook-executed',
    name: 'Runbook Steps Completed',
    description: 'Standard runbook must be followed before escalating to override',
    provenance: BASE_PROVENANCE,
    category: 'incident-response',
    tags: ['runbook', 'sre', 'incident'],
    template: {
      description: 'Runbook {{runbookId}} executed through step {{completedStep}} of {{totalSteps}} with documented results',
      defaultSlots: { runbookId: '?', completedStep: '?', totalSteps: '?' },
      verificationMethod: 'Review incident ticket for runbook checklist',
      resolution: 'Complete runbook steps in order; document any deviations',
    },
    criticality: 'medium',
    minimumWaiverAuthority: 'approve',
    applicableActionTypes: ['override', 'escalate'],
  },

  // ── Finance ───────────────────────────────────────────────────────────────
  {
    id: 'budget-approved',
    name: 'Budget Pre-Approved',
    description: 'Expenditure must have budget pre-approval from authorised signatory',
    provenance: BASE_PROVENANCE,
    category: 'finance',
    tags: ['budget', 'spend', 'approval'],
    template: {
      description: 'Spend of {{amount}} {{currency}} for {{purpose}} pre-approved by {{approver}} (ref: {{approvalRef}})',
      defaultSlots: { amount: '?', currency: 'USD', purpose: 'the proposed spend', approver: 'Finance Lead', approvalRef: 'N/A' },
      verificationMethod: 'Confirm approval in finance management system',
      resolution: 'Submit budget pre-approval request to Finance Lead',
    },
    criticality: 'critical',
    minimumWaiverAuthority: 'override',
    applicableActionTypes: ['spend', 'contract', 'purchase'],
  },
  {
    id: 'dual-control-finance',
    name: 'Dual Control Applied',
    description: 'Two independent approvers required for high-value transactions',
    provenance: BASE_PROVENANCE,
    category: 'finance',
    tags: ['dual-control', 'four-eyes', 'fraud-prevention'],
    template: {
      description: 'Two independent approvals obtained for transaction exceeding {{threshold}} {{currency}}: {{approver1}} + {{approver2}}',
      defaultSlots: { threshold: '10,000', currency: 'USD', approver1: 'First Approver', approver2: 'Second Approver' },
      verificationMethod: 'Review approval chain in financial system',
      resolution: 'Obtain second independent approval from authorised signatory',
    },
    criticality: 'critical',
    minimumWaiverAuthority: 'override',
    applicableActionTypes: ['transfer', 'spend', 'contract'],
  },

  // ── Compliance / Legal ────────────────────────────────────────────────────
  {
    id: 'gdpr-pia-complete',
    name: 'GDPR PIA Completed',
    description: 'Privacy Impact Assessment must be completed for data processing changes',
    provenance: BASE_PROVENANCE,
    category: 'compliance',
    tags: ['gdpr', 'privacy', 'pia'],
    template: {
      description: 'Privacy Impact Assessment for {{dataProcessingActivity}} completed and reviewed by DPO on {{piaDate}}',
      defaultSlots: { dataProcessingActivity: 'the data processing activity', piaDate: '?' },
      verificationMethod: 'Check PIA register for approval record',
      resolution: 'Complete PIA with DPO review before processing personal data',
    },
    criticality: 'critical',
    minimumWaiverAuthority: 'override',
    applicableActionTypes: ['data-processing', 'export', 'share'],
  },
  {
    id: 'legal-review-complete',
    name: 'Legal Review Completed',
    description: 'Legal team must review before any contractual or regulatory action',
    provenance: BASE_PROVENANCE,
    category: 'legal',
    tags: ['legal', 'contract', 'regulatory'],
    template: {
      description: 'Legal review of {{document}} completed by {{reviewer}} on {{reviewDate}} — clearance ref: {{ref}}',
      defaultSlots: { document: 'the document or action', reviewer: 'Legal Team', reviewDate: '?', ref: 'N/A' },
      verificationMethod: 'Confirm legal clearance email/ticket reference',
      resolution: 'Submit for legal review and await written clearance',
    },
    criticality: 'high',
    minimumWaiverAuthority: 'override',
    applicableActionTypes: ['contract', 'publish', 'regulatory-submission'],
  },

  // ── HR / People ────────────────────────────────────────────────────────────
  {
    id: 'hr-signoff-required',
    name: 'HR Sign-Off Required',
    description: 'HR must approve actions that affect people',
    provenance: BASE_PROVENANCE,
    category: 'hr',
    tags: ['hr', 'people', 'employment'],
    template: {
      description: 'HR approval obtained from {{hrContact}} for {{action}} affecting {{employeeCount}} employee(s)',
      defaultSlots: { hrContact: 'HRBP', action: 'the proposed action', employeeCount: '?' },
      verificationMethod: 'Confirm HR approval in HRIS or email trail',
      resolution: 'Submit request to HR Business Partner for review and approval',
    },
    criticality: 'high',
    minimumWaiverAuthority: 'override',
    applicableActionTypes: ['terminate', 'restructure', 'policy-change'],
  },

  // ── General / Universal ────────────────────────────────────────────────────
  {
    id: 'stakeholder-notified',
    name: 'Stakeholders Notified',
    description: 'All relevant stakeholders must be informed before the action',
    provenance: BASE_PROVENANCE,
    category: 'general',
    tags: ['communication', 'stakeholders'],
    template: {
      description: 'Stakeholders {{stakeholders}} notified via {{channel}} at least {{leadTime}} before {{action}}',
      defaultSlots: { stakeholders: 'affected teams', channel: 'email/Slack', leadTime: '30 minutes', action: 'the action' },
      verificationMethod: 'Check notification log or sent messages',
      resolution: 'Send notifications and allow required lead time to pass',
    },
    criticality: 'medium',
    minimumWaiverAuthority: 'approve',
    applicableActionTypes: [],
  },
  {
    id: 'capacity-confirmed',
    name: 'Capacity Confirmed',
    description: 'Target infrastructure must have sufficient capacity',
    provenance: BASE_PROVENANCE,
    category: 'devops',
    tags: ['capacity', 'resources', 'scaling'],
    template: {
      description: '{{environment}} has sufficient capacity for {{action}} — CPU headroom > {{cpuThreshold}}%, memory > {{memThreshold}}% free',
      defaultSlots: { environment: 'the target environment', action: 'the operation', cpuThreshold: '20', memThreshold: '20' },
      verificationMethod: 'Check infrastructure monitoring dashboard',
      resolution: 'Scale up infrastructure or reschedule to a lower-traffic period',
    },
    criticality: 'medium',
    minimumWaiverAuthority: 'approve',
    applicableActionTypes: ['deploy', 'scale', 'migrate'],
  },
  {
    id: 'monitoring-in-place',
    name: 'Monitoring & Alerting Active',
    description: 'Observability must be confirmed before any production change',
    provenance: BASE_PROVENANCE,
    category: 'devops',
    tags: ['monitoring', 'observability', 'alerting'],
    template: {
      description: 'Monitoring and alerting for {{service}} confirmed active — dashboard: {{dashboardUrl}}',
      defaultSlots: { service: 'the target service', dashboardUrl: 'N/A' },
      verificationMethod: 'Verify metrics flowing in monitoring system and alert rules are active',
      resolution: 'Set up monitoring dashboards and alert rules before proceeding',
    },
    criticality: 'high',
    minimumWaiverAuthority: 'approve',
    applicableActionTypes: ['deploy', 'release', 'launch'],
  },
  {
    id: 'change-freeze-cleared',
    name: 'Change Freeze Cleared',
    description: 'Organisation must not be in a change freeze period',
    provenance: BASE_PROVENANCE,
    category: 'deployment',
    tags: ['change-freeze', 'governance', 'calendar'],
    template: {
      description: 'Current date {{currentDate}} is outside change freeze period ({{freezeStart}} — {{freezeEnd}})',
      defaultSlots: { currentDate: 'today', freezeStart: 'N/A', freezeEnd: 'N/A' },
      verificationMethod: 'Check change management calendar for freeze periods',
      resolution: 'Wait until freeze period ends or escalate for emergency change approval',
    },
    criticality: 'high',
    minimumWaiverAuthority: 'override',
    applicableActionTypes: ['deploy', 'config-change', 'release'],
  },
  {
    id: 'on-call-engineer-available',
    name: 'On-Call Engineer Available',
    description: 'On-call engineer must be on standby before any risk-bearing action',
    provenance: BASE_PROVENANCE,
    category: 'devops',
    tags: ['on-call', 'standby', 'support'],
    template: {
      description: 'On-call engineer {{oncallName}} confirmed available and briefed for {{action}}',
      defaultSlots: { oncallName: 'on-call SRE', action: 'the operation' },
      verificationMethod: 'Check PagerDuty/OpsGenie for current on-call and confirm via message',
      resolution: 'Contact on-call engineer and confirm availability before proceeding',
    },
    criticality: 'medium',
    minimumWaiverAuthority: 'approve',
    applicableActionTypes: ['deploy', 'release', 'override'],
  },
  {
    id: 'data-classification-verified',
    name: 'Data Classification Verified',
    description: 'Data classification must be confirmed before cross-boundary operations',
    provenance: BASE_PROVENANCE,
    category: 'compliance',
    tags: ['data-classification', 'privacy', 'governance'],
    template: {
      description: 'Data in {{dataset}} classified as {{classification}} — transfer/processing consistent with policy',
      defaultSlots: { dataset: 'the dataset', classification: '?' },
      verificationMethod: 'Check data catalogue for classification label',
      resolution: 'Classify data in data catalogue and verify processing is permitted',
    },
    criticality: 'high',
    minimumWaiverAuthority: 'override',
    applicableActionTypes: ['export', 'migrate', 'share', 'process'],
  },
  {
    id: 'test-results-attached',
    name: 'Test Results Attached',
    description: 'Test evidence must be attached to the change record',
    provenance: BASE_PROVENANCE,
    category: 'deployment',
    tags: ['testing', 'quality', 'evidence'],
    template: {
      description: '{{testSuite}} results attached to change record — {{passedCount}} passed, {{failedCount}} failed, coverage {{coverage}}%',
      defaultSlots: { testSuite: 'all test suites', passedCount: '?', failedCount: '0', coverage: '?' },
      verificationMethod: 'Review test report links in change ticket',
      resolution: 'Run full test suite and attach results to the change record',
    },
    criticality: 'medium',
    minimumWaiverAuthority: 'approve',
    applicableActionTypes: ['deploy', 'release', 'merge'],
  },
  {
    id: 'peer-review-complete',
    name: 'Peer Review Completed',
    description: 'Change must have been reviewed by at least one peer',
    provenance: BASE_PROVENANCE,
    category: 'general',
    tags: ['peer-review', 'four-eyes', 'quality'],
    template: {
      description: '{{changeType}} reviewed and approved by {{reviewer}} on {{reviewDate}}',
      defaultSlots: { changeType: 'the change', reviewer: 'a qualified peer', reviewDate: '?' },
      verificationMethod: 'Confirm review record in version control or ticketing system',
      resolution: 'Request peer review and await approval before proceeding',
    },
    criticality: 'medium',
    minimumWaiverAuthority: 'approve',
    applicableActionTypes: [],
  },
];

// ── Template Registry ─────────────────────────────────────────────────────────

export function getTemplateById(id: string): PreconditionTemplate | undefined {
  return PRECONDITION_TEMPLATES.find((t) => t.id === id);
}

export function searchTemplates(
  query: string,
  category?: string,
  tags?: string[],
): PreconditionTemplate[] {
  const q = query.toLowerCase();
  return PRECONDITION_TEMPLATES.filter((t) => {
    const matchesQuery =
      !q ||
      t.name.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      t.tags.some((tag) => tag.includes(q));
    const matchesCategory = !category || t.category === category;
    const matchesTags =
      !tags?.length || tags.every((tag) => t.tags.includes(tag));
    return matchesQuery && matchesCategory && matchesTags;
  });
}

/**
 * Resolve a template's slot placeholders with provided values.
 * Unreplaced slots fall back to the template's defaultSlots.
 */
export function resolveTemplate(
  template: PreconditionTemplate,
  slotValues: Record<string, string> = {},
): { description: string; verificationMethod?: string; resolution?: string } {
  const slots = { ...template.template.defaultSlots, ...slotValues };
  const replace = (str: string) =>
    str.replace(/\{\{(\w+)\}\}/g, (_, key) => slots[key] ?? `{{${key}}}`);

  return {
    description: replace(template.template.description),
    verificationMethod: template.template.verificationMethod
      ? replace(template.template.verificationMethod)
      : undefined,
    resolution: template.template.resolution
      ? replace(template.template.resolution)
      : undefined,
  };
}
