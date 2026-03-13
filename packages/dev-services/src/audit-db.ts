/**
 * In-memory Governance Audit Database
 *
 * Phase 5.2 — Persistence & Audit (dev/demo implementation)
 *
 * In production, replace with a real database (Postgres, SQLite, DynamoDB, etc.).
 * This module exposes a typed, synchronous in-memory store that the governance
 * HTTP server uses to store and query:
 *
 *   - DecisionRecords  — every approve/reject/defer/escalate action
 *   - SituationalViews — stored view snapshots for replay
 *   - ConflictRecords  — collaboration conflicts
 *
 * All writes are appended; reads are filtered/sorted in-memory.
 * Thread-safety: Node.js is single-threaded, so no locks are needed.
 */

// ── Types (inline to avoid circular dep issues in dev-services) ───────────────

export interface StoredDecisionRecord {
  decisionId: string;
  governedActionId: string;
  situationId?: string;
  outcome: 'approved' | 'rejected' | 'deferred' | 'modified' | 'escalated' | 'expired';
  decidedAt: 'observe' | 'intervene' | 'approve' | 'override';
  deciderId: string;
  timestamp: string;
  rationale?: string;
  modifications?: Record<string, unknown>;
  deliberationTimeMs?: number;
}

export interface StoredSituationalView {
  situationId: string;
  question: string;
  answerSummary?: string;
  scope: {
    systems: string[];
    timeWindow?: string;
    riskLevel?: string;
  };
  confidence: number;
  generatedAt: string;
  expiresAt?: string;
  status: string;
  tags: string[];
  renderContract: unknown;
}

export interface StoredConflictRecord {
  conflictId: string;
  viewId: string;
  actionId: string;
  timestamp: string;
  firstDecision: {
    participantId: string;
    participantName?: string;
    outcome: 'approved' | 'rejected';
    authorityMode: string;
    timestamp: string;
    rationale?: string;
  };
  secondDecision: {
    participantId: string;
    participantName?: string;
    outcome: 'approved' | 'rejected';
    authorityMode: string;
    timestamp: string;
    rationale?: string;
  };
  resolution?: {
    strategy: string;
    winningDecision: 'first' | 'second' | 'neither';
    resolvedBy?: string;
    resolvedAt?: string;
    notes?: string;
  };
  status: 'pending' | 'resolved' | 'escalated';
}

// ── Query Filter ──────────────────────────────────────────────────────────────

export interface DecisionQueryFilter {
  deciderId?: string;
  outcome?: StoredDecisionRecord['outcome'];
  authorityMode?: StoredDecisionRecord['decidedAt'];
  situationId?: string;
  governedActionId?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

// ── AuditDB ───────────────────────────────────────────────────────────────────

export class AuditDB {
  private decisions: StoredDecisionRecord[] = [];
  private views = new Map<string, StoredSituationalView>();
  private conflicts: StoredConflictRecord[] = [];

  // ── Decision Records ────────────────────────────────────────────────────────

  insertDecision(record: StoredDecisionRecord): void {
    // Prevent duplicate decisionIds
    if (this.decisions.some((d) => d.decisionId === record.decisionId)) return;
    this.decisions.push(record);
  }

  queryDecisions(filter: DecisionQueryFilter = {}): StoredDecisionRecord[] {
    let results = this.decisions.slice();

    if (filter.deciderId) {
      results = results.filter((d) => d.deciderId === filter.deciderId);
    }
    if (filter.outcome) {
      results = results.filter((d) => d.outcome === filter.outcome);
    }
    if (filter.authorityMode) {
      results = results.filter((d) => d.decidedAt === filter.authorityMode);
    }
    if (filter.situationId) {
      results = results.filter((d) => d.situationId === filter.situationId);
    }
    if (filter.governedActionId) {
      results = results.filter((d) => d.governedActionId === filter.governedActionId);
    }
    if (filter.from) {
      const fromMs = Date.parse(filter.from);
      results = results.filter((d) => Date.parse(d.timestamp) >= fromMs);
    }
    if (filter.to) {
      const toMs = Date.parse(filter.to);
      results = results.filter((d) => Date.parse(d.timestamp) <= toMs);
    }

    // Sort newest first
    results.sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));

    // Pagination
    const offset = filter.offset ?? 0;
    const limit = filter.limit ?? 100;
    return results.slice(offset, offset + limit);
  }

  getDecision(decisionId: string): StoredDecisionRecord | null {
    return this.decisions.find((d) => d.decisionId === decisionId) ?? null;
  }

  deleteDecision(decisionId: string): boolean {
    const idx = this.decisions.findIndex((d) => d.decisionId === decisionId);
    if (idx === -1) return false;
    this.decisions.splice(idx, 1);
    return true;
  }

  countDecisions(): number {
    return this.decisions.length;
  }

  // ── Situational Views ───────────────────────────────────────────────────────

  upsertView(view: StoredSituationalView): void {
    this.views.set(view.situationId, view);
  }

  getView(situationId: string): StoredSituationalView | null {
    return this.views.get(situationId) ?? null;
  }

  listViews(opts: { limit?: number; offset?: number } = {}): StoredSituationalView[] {
    const all = Array.from(this.views.values()).sort(
      (a, b) => Date.parse(b.generatedAt) - Date.parse(a.generatedAt),
    );
    const offset = opts.offset ?? 0;
    const limit = opts.limit ?? 100;
    return all.slice(offset, offset + limit);
  }

  // ── Conflicts ───────────────────────────────────────────────────────────────

  insertConflict(conflict: StoredConflictRecord): void {
    if (this.conflicts.some((c) => c.conflictId === conflict.conflictId)) return;
    this.conflicts.push(conflict);
  }

  getConflict(conflictId: string): StoredConflictRecord | null {
    return this.conflicts.find((c) => c.conflictId === conflictId) ?? null;
  }

  resolveConflict(
    conflictId: string,
    resolution: NonNullable<StoredConflictRecord['resolution']>,
  ): boolean {
    const conflict = this.conflicts.find((c) => c.conflictId === conflictId);
    if (!conflict) return false;
    conflict.resolution = resolution;
    conflict.status = 'resolved';
    return true;
  }

  listConflicts(viewId?: string): StoredConflictRecord[] {
    if (viewId) return this.conflicts.filter((c) => c.viewId === viewId);
    return this.conflicts.slice();
  }

  countConflicts(): number {
    return this.conflicts.length;
  }

  // ── Compliance Report ───────────────────────────────────────────────────────

  generateComplianceReport(from: string, to: string) {
    const fromMs = Date.parse(from);
    const toMs = Date.parse(to);

    const periodDecisions = this.decisions.filter((d) => {
      const ts = Date.parse(d.timestamp);
      return ts >= fromMs && ts <= toMs;
    });

    // Override decisions (highest scrutiny)
    const overrideDecisions = periodDecisions.filter(
      (d) => d.decidedAt === 'override',
    );

    // Out-of-authority decisions: requiredAuthority > decidedAt
    // We check this by seeing if a governed action with a higher required
    // authority was approved by a lower authority mode.
    // For simplicity here, we flag all 'approved' decisions at 'observe' level.
    const AUTHORITY_ORDER = ['observe', 'intervene', 'approve', 'override'] as const;
    const outOfAuthorityDecisions = periodDecisions
      .filter((d) => d.outcome === 'approved' && d.decidedAt === 'observe')
      .map((d) => ({
        decisionId: d.decisionId,
        governedActionId: d.governedActionId,
        deciderId: d.deciderId,
        requiredAuthority: 'approve',
        usedAuthority: d.decidedAt,
        timestamp: d.timestamp,
        outcome: d.outcome,
      }));

    // Outcomes by authority
    const outcomesByAuthority: Record<string, Record<string, number>> = {};
    for (const d of periodDecisions) {
      if (!outcomesByAuthority[d.decidedAt]) outcomesByAuthority[d.decidedAt] = {};
      const entry = outcomesByAuthority[d.decidedAt];
      entry[d.outcome] = (entry[d.outcome] ?? 0) + 1;
    }

    // Avg deliberation time by outcome
    const deliberationBuckets: Record<string, { sum: number; count: number }> = {};
    for (const d of periodDecisions) {
      if (d.deliberationTimeMs !== undefined) {
        if (!deliberationBuckets[d.outcome]) {
          deliberationBuckets[d.outcome] = { sum: 0, count: 0 };
        }
        deliberationBuckets[d.outcome].sum += d.deliberationTimeMs;
        deliberationBuckets[d.outcome].count += 1;
      }
    }
    const avgDeliberationMsByOutcome: Record<string, number> = {};
    for (const [outcome, bucket] of Object.entries(deliberationBuckets)) {
      avgDeliberationMsByOutcome[outcome] =
        bucket.count > 0 ? Math.round(bucket.sum / bucket.count) : 0;
    }

    // Top deciders
    const deciderCounts: Record<string, number> = {};
    for (const d of periodDecisions) {
      deciderCounts[d.deciderId] = (deciderCounts[d.deciderId] ?? 0) + 1;
    }
    const topDeciders = Object.entries(deciderCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([deciderId, count]) => ({ deciderId, count }));

    const escalations = periodDecisions.filter((d) => d.outcome === 'escalated').length;
    const conflicts = this.conflicts.filter((c) => {
      const ts = Date.parse(c.timestamp);
      return ts >= fromMs && ts <= toMs;
    }).length;

    return {
      generatedAt: new Date().toISOString(),
      periodFrom: from,
      periodTo: to,
      totalDecisions: periodDecisions.length,
      overrideDecisions: overrideDecisions.length,
      outOfAuthorityDecisions,
      outcomesByAuthority,
      avgDeliberationMsByOutcome,
      topDeciders,
      escalations,
      conflicts,
    };
  }

  // ── Decision Replay ─────────────────────────────────────────────────────────

  buildReplay(situationId: string) {
    const view = this.getView(situationId);
    const decisions = this.decisions
      .filter((d) => d.situationId === situationId)
      .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));

    const timeline = decisions.map((d, idx) => ({
      sequenceNumber: idx + 1,
      timestamp: d.timestamp,
      event: `Decision: ${d.outcome} by ${d.deciderId}`,
      participantId: d.deciderId,
      authorityMode: d.decidedAt,
      outcome: d.outcome,
      deliberationTimeMs: d.deliberationTimeMs,
      rationale: d.rationale,
    }));

    return { situationId, view: view ?? null, decisions, timeline };
  }

  // ── Stats ────────────────────────────────────────────────────────────────────

  stats() {
    return {
      decisions: this.decisions.length,
      views: this.views.size,
      conflicts: this.conflicts.length,
    };
  }

  /** Clear all data (useful for tests) */
  clear(): void {
    this.decisions = [];
    this.views.clear();
    this.conflicts = [];
  }
}

// Singleton instance for the governance server process
export const auditDB = new AuditDB();
