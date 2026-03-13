import type { SituationalView } from '../schemas/situational-view';
import type { DecisionRecord } from '../schemas/governed-action';

// ─────────────────────────────────────────────────────────────────────────────
// GovernanceAuditClient
//
// Thin REST client for the governance audit server (Phase 5.2).
// Handles:
//   - Recording DecisionRecords to the backend audit database
//   - Storing SituationalViews for later query / replay
//   - Querying historical decisions with filters
//   - Generating compliance reports
//   - Replaying decision chains from audit trail
//
// In production, swap the `baseUrl` with your actual governance API.
// The server contract is defined in dev-services/src/governance-server.ts.
// ─────────────────────────────────────────────────────────────────────────────

// ── Query / Report Types ──────────────────────────────────────────────────────

export interface DecisionQueryFilter {
  /** Filter by deciderId (user ID) */
  deciderId?: string;
  /** Filter by outcome */
  outcome?: DecisionRecord['outcome'];
  /** Filter by authority mode used */
  authorityMode?: DecisionRecord['decidedAt'];
  /** Filter by situational view ID */
  situationId?: string;
  /** Filter by governed action ID */
  governedActionId?: string;
  /** ISO 8601 start timestamp */
  from?: string;
  /** ISO 8601 end timestamp */
  to?: string;
  /** Maximum results to return (default: 100) */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
}

export interface ComplianceReport {
  generatedAt: string;
  periodFrom: string;
  periodTo: string;
  totalDecisions: number;
  /** Decisions made with 'override' authority — high scrutiny */
  overrideDecisions: number;
  /** Decisions made outside normal authority ranges */
  outOfAuthorityDecisions: OutOfAuthorityDecision[];
  /** Decision outcomes broken down by authority level */
  outcomesByAuthority: Record<string, Record<string, number>>;
  /** Average deliberation time by outcome */
  avgDeliberationMsByOutcome: Record<string, number>;
  /** Top deciders by volume */
  topDeciders: Array<{ deciderId: string; count: number }>;
  /** Actions that were escalated */
  escalations: number;
  /** Actions with conflicts */
  conflicts: number;
}

export interface OutOfAuthorityDecision {
  decisionId: string;
  governedActionId: string;
  deciderId: string;
  requiredAuthority: string;
  usedAuthority: string;
  timestamp: string;
  outcome: string;
}

export interface DecisionReplay {
  situationId: string;
  view: SituationalView | null;
  decisions: DecisionRecord[];
  timeline: ReplayStep[];
}

export interface ReplayStep {
  sequenceNumber: number;
  timestamp: string;
  event: string;
  participantId?: string;
  authorityMode?: string;
  outcome?: string;
  deliberationTimeMs?: number;
  rationale?: string;
}

// ── Client ────────────────────────────────────────────────────────────────────

export interface GovernanceAuditClientOptions {
  /** Base URL of the governance audit server (e.g. http://localhost:3005) */
  baseUrl: string;
  /** Optional auth token if the server requires authentication */
  authToken?: string;
  /** Request timeout in ms (default: 10 000) */
  timeoutMs?: number;
  /** Called when a network request fails */
  onError?: (err: Error, context: string) => void;
}

/**
 * GovernanceAuditClient
 *
 * REST client for the governance audit backend.
 * All methods are fire-and-forget friendly — failures are logged but do not
 * throw unless `throwOnError` option is set.
 */
export class GovernanceAuditClient {
  private baseUrl: string;
  private headers: Record<string, string>;
  private timeoutMs: number;
  private onError?: (err: Error, context: string) => void;

  constructor(opts: GovernanceAuditClientOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/$/, '');
    this.timeoutMs = opts.timeoutMs ?? 10_000;
    this.onError = opts.onError;
    this.headers = {
      'Content-Type': 'application/json',
      ...(opts.authToken ? { Authorization: `Bearer ${opts.authToken}` } : {}),
    };
  }

  // ── Decision Records ────────────────────────────────────────────────────────

  /**
   * Record a governance decision to the audit database.
   * Safe to call fire-and-forget — non-blocking in normal usage.
   */
  async recordDecision(record: DecisionRecord): Promise<void> {
    await this.post('/api/decisions', record, 'recordDecision');
  }

  /**
   * Query the audit log with optional filters.
   */
  async queryDecisions(filter: DecisionQueryFilter = {}): Promise<DecisionRecord[]> {
    const params = this.buildQueryString(filter as Record<string, unknown>);
    const result = await this.get<{ decisions: DecisionRecord[] }>(
      `/api/decisions${params}`,
      'queryDecisions',
    );
    return result?.decisions ?? [];
  }

  /**
   * Get a single decision record by ID.
   */
  async getDecision(decisionId: string): Promise<DecisionRecord | null> {
    const result = await this.get<{ decision: DecisionRecord }>(
      `/api/decisions/${encodeURIComponent(decisionId)}`,
      'getDecision',
    );
    return result?.decision ?? null;
  }

  // ── Situational Views ───────────────────────────────────────────────────────

  /**
   * Persist a SituationalView snapshot to the backend for future audit/replay.
   */
  async storeView(view: SituationalView): Promise<void> {
    await this.post('/api/views', view, 'storeView');
  }

  /**
   * Retrieve a stored SituationalView by its situationId.
   */
  async getView(situationId: string): Promise<SituationalView | null> {
    const result = await this.get<{ view: SituationalView }>(
      `/api/views/${encodeURIComponent(situationId)}`,
      'getView',
    );
    return result?.view ?? null;
  }

  /**
   * List all stored SituationalViews (paginated).
   */
  async listViews(opts: { limit?: number; offset?: number } = {}): Promise<SituationalView[]> {
    const params = this.buildQueryString(opts);
    const result = await this.get<{ views: SituationalView[] }>(
      `/api/views${params}`,
      'listViews',
    );
    return result?.views ?? [];
  }

  // ── Compliance Reports ──────────────────────────────────────────────────────

  /**
   * Generate a compliance report for a given time window.
   *
   * @param from ISO 8601 start (inclusive)
   * @param to   ISO 8601 end (inclusive) — defaults to now
   */
  async getComplianceReport(from: string, to?: string): Promise<ComplianceReport | null> {
    const params = this.buildQueryString({ from, to: to ?? new Date().toISOString() });
    return this.get<ComplianceReport>(`/api/compliance/report${params}`, 'getComplianceReport');
  }

  // ── Decision Replay ─────────────────────────────────────────────────────────

  /**
   * Reconstruct the decision chain for a SituationalView.
   * Returns the view, all decisions made in context, and an ordered timeline.
   */
  async replayDecisions(situationId: string): Promise<DecisionReplay | null> {
    return this.get<DecisionReplay>(
      `/api/decisions/replay/${encodeURIComponent(situationId)}`,
      'replayDecisions',
    );
  }

  // ── Health ──────────────────────────────────────────────────────────────────

  async isHealthy(): Promise<boolean> {
    try {
      const result = await this.get<{ status: string }>('/health', 'healthCheck');
      return result?.status === 'ok';
    } catch {
      return false;
    }
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private async post(path: string, body: unknown, context: string): Promise<void> {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
      try {
        const res = await fetch(`${this.baseUrl}${path}`, {
          method: 'POST',
          headers: this.headers,
          body: JSON.stringify(body),
          signal: ctrl.signal,
        });
        if (!res.ok) {
          throw new Error(`${context}: HTTP ${res.status} ${res.statusText}`);
        }
      } finally {
        clearTimeout(timer);
      }
    } catch (err) {
      this.handleError(err, context);
    }
  }

  private async get<T>(path: string, context: string): Promise<T | null> {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
      try {
        const res = await fetch(`${this.baseUrl}${path}`, {
          method: 'GET',
          headers: this.headers,
          signal: ctrl.signal,
        });
        if (!res.ok) {
          throw new Error(`${context}: HTTP ${res.status} ${res.statusText}`);
        }
        return (await res.json()) as T;
      } finally {
        clearTimeout(timer);
      }
    } catch (err) {
      this.handleError(err, context);
      return null;
    }
  }

  private buildQueryString(params: Record<string, unknown>): string {
    const entries = Object.entries(params).filter(
      ([, v]) => v !== undefined && v !== null,
    );
    if (entries.length === 0) return '';
    const qs = entries
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      .join('&');
    return `?${qs}`;
  }

  private handleError(err: unknown, context: string): void {
    const error = err instanceof Error ? err : new Error(String(err));
    if (this.onError) {
      this.onError(error, context);
    } else {
      console.warn(`[GovernanceAuditClient] ${context} failed:`, error.message);
    }
  }
}
