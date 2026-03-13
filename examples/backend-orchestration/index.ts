/**
 * HARI × Backend Orchestration — Reference Integration
 *
 * This file is the canonical example of multi-agent backend orchestration
 * feeding a single human decision surface. It demonstrates:
 *
 *   1. Multiple specialized agents each issuing SituationalPerceptions
 *   2. A coordinator that ranks and merges them into one human-facing view
 *   3. Authority mode gates which perceptions are surfaced and at what density
 *   4. Governed actions — proposals that require explicit human approval
 *   5. Decision records that auto-generate from the approval event
 *
 * Architecture:
 *
 *   [MetricsAgent] ──┐
 *   [LogsAgent]    ──┼──► [Coordinator] ──► [Ranked Perceptions] ──► Human
 *   [AuditAgent]   ──┘
 *
 * Each agent is responsible for one domain. The coordinator does NOT merge
 * their outputs into one combined blob — it ranks them and lets the human
 * decide which to act on. This preserves provenance.
 *
 * Rules this integration follows (CONFORMANCE.md):
 *   - Each agent issues its own SituationalPerception with its own question
 *   - Coordinator never fabricates confidence — it uses the agent's value
 *   - Governed actions require authority mode >= 'approve' to execute
 *   - Expired perceptions are filtered BEFORE reaching the human
 *   - Decision records are immutable (append-only in this example)
 *
 * To run:
 *   npx tsx examples/backend-orchestration/index.ts
 *
 * No external dependencies — all agents produce synthetic data for illustration.
 */

import { randomUUID } from 'crypto';
import {
  SituationalPerceptionSchema,
  assertPerceptionNotExpired,
  checkPerceptionMisuse,
  ComponentRegistryManager,
  compileIntent,
} from '@hari/core';
import type {
  SituationalPerception,
  AuthorityMode,
} from '@hari/core';

// Local proposal type — in production, use GovernedActionSchema.parse() from @hari/core
// to build a fully-validated GovernedAction with blast radius, reversibility, and preconditions.
interface ActionProposal {
  label: string;
  description: string;
  requiredAuthority: AuthorityMode;
  reversible: boolean;
  perceptionId: string;
}

// ── Shared types ──────────────────────────────────────────────────────────────

interface AgentResult {
  agentId: string;
  perception: SituationalPerception | null;
  error?: string;
}

interface RankedPerception {
  rank: number;
  perception: SituationalPerception;
  agentId: string;
}

interface DecisionRecord {
  id: string;
  timestamp: string;
  question: string;
  perceptionId: string;
  authorityMode: AuthorityMode;
  holderId: string;
  decision: 'approved' | 'rejected' | 'deferred';
  justification: string;
}

// ── Shared perception builder ─────────────────────────────────────────────────
// Each agent uses this to construct a HARI-compliant perception.
// The schema validates on parse — if it fails, the agent returns null.

function buildPerception(opts: {
  agentId: string;
  question: string;
  systems: string[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  unknowns: string[];
  assumptions: string[];
  expiresInMs: number;
  answerContent: string;
  evidenceSource: string;
  evidenceExcerpt: string;
  priority?: number;
  justification?: string;
}): SituationalPerception | null {
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + opts.expiresInMs).toISOString();

  const raw = {
    perceptionId: randomUUID(),
    schemaVersion: '1.0.0',
    originatingQuestion: opts.question,
    generatedAt: now,
    agentId: opts.agentId,
    view: {
      situationId: randomUUID(),
      question: opts.question,
      scope: {
        systems: opts.systems,
        timeWindow: 'PT5M',
        riskLevel: opts.riskLevel,
      },
      confidence: opts.confidence,
      unknowns: opts.unknowns,
      assumptions: opts.assumptions,
      generatedAt: now,
      expiresAt,
      status: 'active' as const,
      priority: opts.priority ?? 50,
      renderContract: {
        id: randomUUID(),
        version: '1.0.0',
        domain: 'operations',
        type: 'chat',
        confidence: opts.confidence,
        density: 'operator' as const,
        primaryGoal: opts.question,
        data: {
          messages: [
            {
              id: randomUUID(),
              role: 'agent',
              content: opts.answerContent,
              timestamp: now,
            },
          ],
        },
      },
    },
    evidence: [
      {
        source: opts.evidenceSource,
        excerpt: opts.evidenceExcerpt,
        timestamp: now,
        confidence: opts.confidence,
      },
    ],
    recommendations: [],
  };

  try {
    return SituationalPerceptionSchema.parse(raw);
  } catch (err) {
    console.error(`[${opts.agentId}] Schema validation failed:`, (err as Error).message.split('\n')[0]);
    return null;
  }
}

// ── Agent 1: Metrics Agent ────────────────────────────────────────────────────
// Monitors system metrics (CPU, latency, error rate).
// Returns perception only when anomaly threshold is crossed.

async function metricsAgent(question: string): Promise<AgentResult> {
  const agentId = 'metrics-agent';

  // Simulate metric collection
  await new Promise(r => setTimeout(r, 50)); // Simulate async I/O
  const errorRate = 0.023;  // 2.3% error rate
  const p99Latency = 847;   // ms
  const cpuUsage = 0.78;    // 78%

  // Agent decides its own confidence based on data freshness
  const confidence = 0.72; // Real data, but 2-min-old samples → not 0.99

  const perception = buildPerception({
    agentId,
    question,
    systems: ['api-gateway', 'metrics-pipeline'],
    riskLevel: errorRate > 0.02 ? 'high' : 'medium',
    confidence,
    unknowns: [
      'Root cause of elevated error rate not yet identified',
      'Whether the spike is sustained or transient (only 2 data points)',
    ],
    assumptions: [
      'Metrics are representative of the last 5-minute window',
      'No scrape failures in the metrics pipeline',
    ],
    expiresInMs: 5 * 60 * 1000, // 5 min
    answerContent:
      `API gateway shows elevated error rate: ${(errorRate * 100).toFixed(1)}% ` +
      `(threshold: 2.0%). P99 latency is ${p99Latency}ms. CPU at ${(cpuUsage * 100).toFixed(0)}%. ` +
      `This exceeds normal operating parameters. Human review recommended before resuming batch processing.`,
    evidenceSource: 'prometheus:api-gateway',
    evidenceExcerpt: `error_rate=0.023, p99_latency_ms=847, cpu_usage=0.78 (window: 5m, samples: 2)`,
    priority: 75, // High priority due to threshold breach
  });

  return { agentId, perception };
}

// ── Agent 2: Logs Agent ───────────────────────────────────────────────────────
// Scans structured logs for error patterns and anomalies.

async function logsAgent(question: string): Promise<AgentResult> {
  const agentId = 'logs-agent';

  await new Promise(r => setTimeout(r, 80)); // Simulate async log scan

  const errorCount = 142;
  const distinctErrors = ['CONN_TIMEOUT', 'DB_POOL_EXHAUSTED'];

  const perception = buildPerception({
    agentId,
    question,
    systems: ['log-aggregator', 'api-gateway', 'postgres-primary'],
    riskLevel: 'high',
    confidence: 0.68, // Pattern-matching is less reliable than direct metrics
    unknowns: [
      'Whether DB_POOL_EXHAUSTED is the primary cause or a downstream effect',
      'Log coverage of all gateway instances (only 3 of 5 confirmed)',
    ],
    assumptions: [
      'Log aggregator is not buffering or dropping under high load',
    ],
    expiresInMs: 3 * 60 * 1000, // 3 min — log patterns stale quickly
    answerContent:
      `${errorCount} errors in last 5 minutes. Distinct error types: ${distinctErrors.join(', ')}. ` +
      `DB_POOL_EXHAUSTED pattern suggests connection pool saturation on postgres-primary. ` +
      `CONN_TIMEOUT errors are consistent with a upstream or pool-saturation failure mode.`,
    evidenceSource: 'datadog:log-stream',
    evidenceExcerpt: `last_5m_errors=${errorCount}, types=[${distinctErrors.join(',')}], ` +
      `DB_POOL_EXHAUSTED_count=89, CONN_TIMEOUT_count=53`,
    priority: 80, // Highest priority — root cause signal
  });

  return { agentId, perception };
}

// ── Agent 3: Audit Agent ──────────────────────────────────────────────────────
// Reviews recent governance actions for context.

async function auditAgent(question: string): Promise<AgentResult> {
  const agentId = 'audit-agent';

  await new Promise(r => setTimeout(r, 30));

  const lastApproval = new Date(Date.now() - 47 * 60 * 1000).toISOString(); // 47 min ago
  const lastOverride = null;

  const perception = buildPerception({
    agentId,
    question,
    systems: ['audit-log'],
    riskLevel: 'low',
    confidence: 0.95, // Audit log is authoritative — high confidence is justified
    unknowns: [
      'Whether any out-of-band changes occurred (not logged in this system)',
    ],
    assumptions: [
      'Audit log write completeness is guaranteed (append-only DB)',
    ],
    expiresInMs: 15 * 60 * 1000, // 15 min — audit context stays valid longer
    answerContent:
      `Last approval event: 47 minutes ago (deployments:resume-batch-v2). ` +
      `No override events in the last 24 hours. ` +
      `Current session authority: observe. Escalation to approve mode is available.`,
    evidenceSource: 'audit-log:governance-events',
    evidenceExcerpt: `last_approval=${lastApproval}, last_override=${lastOverride ?? 'none'}, ` +
      `session_authority=observe`,
    priority: 30, // Context — lower priority than anomaly signals
  });

  return { agentId, perception };
}

// ── Coordinator ───────────────────────────────────────────────────────────────
// Runs all agents in parallel, filters expired/invalid results,
// ranks by priority, and returns a surface-ready list.

async function coordinate(question: string): Promise<RankedPerception[]> {
  console.log('[Coordinator] Dispatching to agents in parallel...');

  // All agents receive the SAME question — coordinator does not rephrase
  const results = await Promise.allSettled([
    metricsAgent(question),
    logsAgent(question),
    auditAgent(question),
  ]);

  const valid: RankedPerception[] = [];
  let rank = 1;

  for (const result of results) {
    if (result.status === 'rejected') {
      console.error('[Coordinator] Agent threw:', result.reason);
      continue;
    }

    const { agentId, perception, error } = result.value;

    if (error) {
      console.warn(`[Coordinator] ${agentId} error: ${error}`);
      continue;
    }

    if (!perception) {
      console.warn(`[Coordinator] ${agentId} returned null perception — skipped.`);
      continue;
    }

    // Filter expired perceptions before they reach the human
    try {
      assertPerceptionNotExpired(perception.view);
    } catch {
      console.warn(`[Coordinator] ${agentId} perception is expired — filtered.`);
      continue;
    }

    // Dev-mode misuse check
    checkPerceptionMisuse(
      {
        originatingQuestion: perception.originatingQuestion,
        confidence: perception.view.confidence,
        view: { expiresAt: perception.view.expiresAt ?? null },
        evidence: perception.evidence,
        recommendations: perception.recommendations,
      },
      `coordinator:${agentId}`,
    );

    valid.push({ rank: rank++, perception, agentId });
  }

  // Sort by view priority (descending) — highest priority surfaces first
  valid.sort((a, b) =>
    (b.perception.view.priority ?? 50) - (a.perception.view.priority ?? 50)
  );

  // Re-rank after sort
  valid.forEach((p, i) => { p.rank = i + 1; });

  return valid;
}

// ── Authority gate ────────────────────────────────────────────────────────────
// In 'observe' mode: read-only — no actions available.
// In 'approve' mode: governed actions are surfaced and require explicit confirmation.
// In 'override' mode: emergency controls available (always audited).

function applyAuthorityGate(
  perceptions: RankedPerception[],
  authorityMode: AuthorityMode,
): RankedPerception[] {
  // All perceptions are visible in all modes (read always works)
  // But in observe mode, we suppress the 'recommendations' block (no actions)
  if (authorityMode === 'observe') {
    return perceptions.map(p => ({
      ...p,
      perception: {
        ...p.perception,
        recommendations: [], // Suppress in observe mode — no controls surfaced
      },
    }));
  }
  return perceptions;
}

// ── Governed action proposal ──────────────────────────────────────────────────
// When the coordinator detects a high-risk situation, it proposes a governed
// action. This requires authority mode >= 'approve' to execute.

// ── Governed action proposal ──────────────────────────────────────────────────
// The coordinator proposes an action when risk is high and authority is sufficient.
// In production: use GovernedActionSchema.parse() from @hari/core to build the full
// structure including blast radius, reversibility window, and preconditions.

function buildGovernedAction(
  perception: SituationalPerception,
  authorityMode: AuthorityMode,
): ActionProposal | null {
  if (perception.view.scope.riskLevel !== 'high' && perception.view.scope.riskLevel !== 'critical') {
    return null; // Only propose actions for high/critical risk
  }

  if (authorityMode === 'observe' || authorityMode === 'intervene') {
    console.log('[Coordinator] Governed action available — escalate to approve mode to review.');
    return null; // Not surfaced until authority is sufficient
  }

  return {
    label: 'Reduce DB connection pool size by 50% (postgres-primary)',
    description:
      'Reduce max_connections from 200 to 100 to relieve pool saturation. ' +
      'This will impact throughput but may restore service stability.',
    requiredAuthority: 'approve',
    reversible: true,
    perceptionId: perception.perceptionId,
  };
}

// ── Decision record ───────────────────────────────────────────────────────────
// Immutable record created when a human acts on a governed action.
// In production: persist to append-only audit log.

const DECISION_LOG: DecisionRecord[] = [];

function recordDecision(opts: {
  question: string;
  perceptionId: string;
  authorityMode: AuthorityMode;
  holderId: string;
  decision: DecisionRecord['decision'];
  justification: string;
}): DecisionRecord {
  const record: DecisionRecord = {
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    ...opts,
  };
  DECISION_LOG.push(record); // Append-only in production
  return record;
}

// ── Surface: print ranking ────────────────────────────────────────────────────

function surfacePerceptions(
  ranked: RankedPerception[],
  authorityMode: AuthorityMode,
): void {
  console.log('\n══════════════════════════════════════════════════════');
  console.log(`AUTHORITY MODE: ${authorityMode.toUpperCase()}`);
  console.log(`PERCEPTIONS   : ${ranked.length} from ${ranked.length} agents`);
  console.log('══════════════════════════════════════════════════════');

  const registry = new ComponentRegistryManager();

  for (const { rank, agentId, perception } of ranked) {
    const view = perception.view;
    console.log(`\n[${rank}] ${agentId.toUpperCase()}`);
    console.log(`    Question   : ${perception.originatingQuestion}`);
    console.log(`    Risk       : ${view.scope.riskLevel?.toUpperCase()}`);
    console.log(`    Confidence : ${(view.confidence * 100).toFixed(0)}%`);
    console.log(`    Expires    : ${view.expiresAt ?? `on: ${view.invalidationCondition}`}`);
    console.log(`    Unknowns   : ${view.unknowns[0] ?? 'none'}`);

    try {
      const compiled = compileIntent(view.renderContract, registry, { validationMode: 'STRICT' });
      console.log(`    Compiled   : ${compiled.domain}/${compiled.type}`);
    } catch {
      console.log(`    Compiled   : (compilation failed — STRICT rejected output)`);
    }

    // Action proposal for high-risk perceptions (requires approve mode)
    const proposal = buildGovernedAction(perception, authorityMode);
    if (proposal) {
      console.log(`    \u26a0  GOVERNED ACTION AVAILABLE:`);
      console.log(`       ${proposal.label}`);
      console.log(`       Required authority: ${proposal.requiredAuthority}`);
      console.log(`       Reversible: ${proposal.reversible}`);
    }
  }

  console.log('\n══════════════════════════════════════════════════════\n');
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const question =
    process.argv[2] ??
    'Is the payment service healthy enough to resume processing orders?';

  const authorityMode: AuthorityMode =
    (process.argv[3] as AuthorityMode | undefined) ?? 'observe';

  console.log(`\n[HARI Orchestrator] Question: "${question}"`);
  console.log(`[HARI Orchestrator] Authority: ${authorityMode}\n`);

  // 1. Coordinate agents
  const ranked = await coordinate(question);

  if (ranked.length === 0) {
    console.log('[HARI] No valid perceptions returned. Insufficient information.');
    return;
  }

  // 2. Apply authority gate
  const gated = applyAuthorityGate(ranked, authorityMode);

  // 3. Surface to human
  surfacePerceptions(gated, authorityMode);

  // 4. Simulate a human decision (if approve mode)
  if (authorityMode === 'approve') {
    const highestRisk = gated.find(p => p.perception.view.scope.riskLevel === 'high');
    if (highestRisk) {
      const record = recordDecision({
        question,
        perceptionId: highestRisk.perception.perceptionId,
        authorityMode,
        holderId: 'human-operator-001',
        decision: 'deferred',
        justification: 'Waiting for DB connection pool metrics to stabilize before acting.',
      });
      console.log('[HARI] Decision recorded:', record.id);
      console.log('       Decision:', record.decision);
      console.log('       Justification:', record.justification);
    }
  }
}

main().catch((err) => {
  console.error('[HARI] Fatal error:', (err as Error).message);
  process.exit(1);
});
