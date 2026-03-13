import { BaseAgentBridge } from './base';
import type {
  AgentBridge,
  AgentBridgeEventName,
  AgentBridgeListener,
  TransportOptions,
  WhatIfQuery,
  WhatIfResult,
} from './types';
import type { IntentPayload, IntentModification } from '../schemas/intent';
import type { CapabilityManifest } from '../compiler/version';
import type { AuthorityContext } from '../schemas/authority';
import type { AuthorityMode } from '../schemas/authority';
import {
  type GovernedAction,
  type DecisionRecord,
  getUnmetPreconditions,
} from '../schemas/governed-action';
import { AUTHORITY_HIERARCHY } from '../schemas/authority';
import { GovernanceAuditClient } from '../audit/client';
import { CollaborationClient } from '../collaboration/client';
import type {
  DecisionLock,
  CollaborationClientOptions,
} from '../schemas/collaboration';
import type { SituationalView } from '../schemas/situational-view';
import type { DecisionQueryFilter } from '../audit/client';

// ─────────────────────────────────────────────────────────────────────────────
// GovernanceAgentBridge (Phase 5.1)
//
// A governance-layer bridge that wraps any existing AgentBridge (SSE, WS, Mock)
// and adds:
//
//   Authority enforcement  — agent suggestions are checked against the user's
//                            current authority mode before approval is allowed.
//   Audit recording        — every decision is sent to the governance audit DB.
//   Temporal streaming     — confidence/prediction updates are broadcast as
//                            synthetic intent events.
//   Real-time collaboration— connects to the collaboration hub so multiple
//                            humans viewing the same view stay in sync.
//
// Design: GovernanceAgentBridge uses the *decorator pattern*.  It wraps a
// delegate AgentBridge and forwards all base transport calls, while
// intercepting and enriching the `intent` event stream.
// ─────────────────────────────────────────────────────────────────────────────

export interface GovernanceCheckResult {
  allowed: boolean;
  reason?: string;
  requiredMode?: AuthorityMode;
  currentMode?: AuthorityMode;
}

export interface GovernanceBridgeOptions extends TransportOptions {
  /** The underlying transport bridge (SSE / WS / Mock) */
  delegate: AgentBridge;
  /** Base URL of the governance audit server */
  auditServerUrl: string;
  /** Initial authority context for the current user */
  authorityContext: AuthorityContext;
  /** Situational view this session is focused on (for collaboration) */
  viewId?: string;
  /** Collaboration hub WS URL (if undefined, collaboration is disabled) */
  collaborationUrl?: string;
  /** Participant identity for collaboration */
  participantId?: string;
  participantName?: string;
  /** Whether to auto-persist views to the audit DB (default: true) */
  persistViews?: boolean;
  /** Whether rejected authority checks should throw or just warn (default: warn) */
  strictAuthorityMode?: boolean;
}

// ── Governance-specific events ────────────────────────────────────────────────

export interface GovernanceBridgeEvents {
  /** A governed action was approved and recorded */
  'governance:approved': { decision: DecisionRecord; action: GovernedAction };
  /** A governed action was rejected and recorded */
  'governance:rejected': { decision: DecisionRecord; action: GovernedAction };
  /** Authority check failed — attempted action with insufficient authority */
  'governance:authority-denied': {
    actionId: string;
    required: AuthorityMode;
    current: AuthorityMode;
  };
  /** A decision lock was acquired for this participant */
  'governance:lock-acquired': DecisionLock;
  /** A decision lock was denied (another participant holds it) */
  'governance:lock-denied': { actionId: string; reason: string };
  /** Collaboration authority sync received */
  'governance:authority-sync': import('../schemas/collaboration').AuthoritySyncEvent;
  /** An escalation notification was received from another participant */
  'governance:escalation': import('../schemas/collaboration').EscalationNotification;
  /** A decision conflict was detected between participants */
  'governance:conflict': import('../schemas/collaboration').ConflictRecord;
}

type GovernanceEventName = keyof GovernanceBridgeEvents;
type GovernanceListener<K extends GovernanceEventName> = (
  payload: GovernanceBridgeEvents[K],
) => void;

// ─────────────────────────────────────────────────────────────────────────────
// GovernanceAgentBridge
// ─────────────────────────────────────────────────────────────────────────────

export class GovernanceAgentBridge extends BaseAgentBridge {
  private readonly delegate: AgentBridge;
  readonly audit: GovernanceAuditClient;

  private collaboration: CollaborationClient | null = null;
  private _authorityContext: AuthorityContext;
  private readonly opts: GovernanceBridgeOptions;

  /** Governance-specific event listeners (separate from AgentBridge events) */
  private readonly govListeners = new Map<
    GovernanceEventName,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Set<GovernanceListener<any>>
  >();

  /** Unsub from delegate intent events */
  private _delegateUnsub: (() => void) | null = null;
  /** Unsub from delegate state-change events */
  private _delegateStatUnsub: (() => void) | null = null;

  constructor(opts: GovernanceBridgeOptions) {
    super(opts);
    this.opts = opts;
    this.delegate = opts.delegate;
    this._authorityContext = opts.authorityContext;

    this.audit = new GovernanceAuditClient({
      baseUrl: opts.auditServerUrl,
      onError: (err, ctx) => {
        this.log('error', `[GovernanceAuditClient] ${ctx}`, err);
      },
    });

    // Build collaboration client if configured
    if (opts.collaborationUrl && opts.viewId) {
      const collabOpts: CollaborationClientOptions = {
        serverUrl: opts.collaborationUrl,
        viewId: opts.viewId,
        participantId: opts.participantId ?? opts.authorityContext.holderId,
        participantName: opts.participantName ?? opts.authorityContext.holderName,
        initialAuthorityMode: opts.authorityContext.currentMode,
      };
      this.collaboration = new CollaborationClient(collabOpts);
      this._wireCollaborationEvents();
    }
  }

  // ── AgentBridge abstract implementations ─────────────────────────────────

  async connect(): Promise<void> {
    // Connect the delegate transport
    await this.delegate.connect();

    // Wire delegate events into our event system
    this._delegateUnsub = this.delegate.on('intent', (payload: IntentPayload) => {
      // Persist view automatically if configured
      if (this.opts.persistViews !== false) {
        // Attempt to extract SituationalView if present in payload
        this._maybePersistView(payload);
      }
      // Forward intent to callers
      this.emit('intent', payload);
    });

    this._delegateStatUnsub = this.delegate.on('stateChange', (state) => {
      this.setState(state);
    });

    // Connect the collaboration hub
    if (this.collaboration) {
      try {
        await this.collaboration.connect();
      } catch (err) {
        this.log('warn', '[GovernanceAgentBridge] collaboration connect failed', err);
      }
    }

    this.setState('connected');
  }

  disconnect(): void {
    this._delegateUnsub?.();
    this._delegateStatUnsub?.();
    this.collaboration?.disconnect();
    this.delegate.disconnect();
    this.setState('disconnected');
  }

  sendModification(patch: IntentModification): void {
    this.delegate.sendModification(patch);
  }

  sendCapabilityManifest(manifest: CapabilityManifest): void {
    this.delegate.sendCapabilityManifest(manifest);
  }

  queryWhatIf(query: WhatIfQuery): Promise<WhatIfResult> {
    return this.delegate.queryWhatIf(query);
  }

  // ── Authority Management ──────────────────────────────────────────────────

  get authorityContext(): AuthorityContext {
    return this._authorityContext;
  }

  /**
   * Update the user's authority context.
   * Automatically notifies collaboration participants of the change.
   */
  updateAuthority(
    context: AuthorityContext,
    opts: { justification?: string; reason?: string } = {},
  ): void {
    const from = this._authorityContext.currentMode;
    const to = context.currentMode;
    this._authorityContext = context;

    if (this.collaboration && from !== to) {
      this.collaboration.notifyAuthorityChange(from, to, opts);
    }
  }

  // ── Governance Decision Methods ───────────────────────────────────────────

  /**
   * Check whether the current authority allows acting on a governed action.
   * Does not record or side-effect — pure read.
   */
  checkAuthority(action: GovernedAction): GovernanceCheckResult {
    const required = action.requiredAuthority;
    const current = this._authorityContext.currentMode;
    const reqIdx = AUTHORITY_HIERARCHY.indexOf(required);
    const curIdx = AUTHORITY_HIERARCHY.indexOf(current);

    if (curIdx < reqIdx) {
      return {
        allowed: false,
        reason: `Action requires '${required}' authority. Current mode is '${current}'.`,
        requiredMode: required,
        currentMode: current,
      };
    }

    // Check preconditions
    const unmet = getUnmetPreconditions(action);
    if (unmet.length > 0 && current !== 'override') {
      return {
        allowed: false,
        reason: `${unmet.length} precondition(s) unmet: ${unmet.map(p => p.description).join('; ')}`,
      };
    }

    return { allowed: true };
  }

  /**
   * Approve a governed action.
   *
   * Steps:
   *   1. Check authority level
   *   2. Acquire collaboration lock (if collaboration enabled)
   *   3. Create DecisionRecord with 'approved' outcome
   *   4. Record to audit backend (fire-and-forget)
   *   5. Release lock
   *   6. Emit governance:approved event
   *
   * @returns The DecisionRecord on success, null if authority blocked.
   */
  async approveAction(
    action: GovernedAction,
    opts: {
      rationale?: string;
      modifications?: Record<string, unknown>;
      situationId?: string;
      deliberationTimeMs?: number;
    } = {},
  ): Promise<DecisionRecord | null> {
    const check = this.checkAuthority(action);
    if (!check.allowed) {
      this.log('warn', '[GovernanceAgentBridge] Authority denied for approve', check);
      this.emitGov('governance:authority-denied', {
        actionId: action.action.id,
        required: check.requiredMode ?? 'approve',
        current: check.currentMode ?? this._authorityContext.currentMode,
      });
      if (this.opts.strictAuthorityMode) {
        throw new Error(`Authority denied: ${check.reason}`);
      }
      return null;
    }

    // Acquire decision lock if collaboration is active
    let lock: DecisionLock | null = null;
    if (this.collaboration && action.action.id) {
      lock = await this.collaboration.acquireLock(action.action.id);
      if (!lock) {
        // Lock denied — another participant is acting on this
        this.emitGov('governance:lock-denied', {
          actionId: action.action.id,
          reason: 'Lock held by another participant',
        });
        return null;
      }
    }

    try {
      const record: DecisionRecord = {
        decisionId: crypto.randomUUID(),
        governedActionId: action.action.id,
        situationId: opts.situationId ?? this.opts.viewId,
        outcome: 'approved',
        decidedAt: this._authorityContext.currentMode,
        deciderId: this._authorityContext.holderId,
        timestamp: new Date().toISOString(),
        rationale: opts.rationale,
        modifications: opts.modifications,
        deliberationTimeMs: opts.deliberationTimeMs,
      };

      // Fire & forget audit recording
      this.audit.recordDecision(record).catch((err) => {
        this.log('error', '[GovernanceAgentBridge] audit.recordDecision failed', err);
      });

      this.emitGov('governance:approved', { decision: record, action });
      return record;
    } finally {
      if (lock && this.collaboration) {
        this.collaboration.releaseLock(lock.lockId);
      }
    }
  }

  /**
   * Reject a governed action.
   * Follows the same authority check + audit recording flow as approveAction.
   */
  async rejectAction(
    action: GovernedAction,
    opts: {
      rationale?: string;
      situationId?: string;
      deliberationTimeMs?: number;
    } = {},
  ): Promise<DecisionRecord | null> {
    const check = this.checkAuthority(action);
    if (!check.allowed) {
      this.emitGov('governance:authority-denied', {
        actionId: action.action.id,
        required: check.requiredMode ?? 'approve',
        current: check.currentMode ?? this._authorityContext.currentMode,
      });
      if (this.opts.strictAuthorityMode) {
        throw new Error(`Authority denied: ${check.reason}`);
      }
      return null;
    }

    const record: DecisionRecord = {
      decisionId: crypto.randomUUID(),
      governedActionId: action.action.id,
      situationId: opts.situationId ?? this.opts.viewId,
      outcome: 'rejected',
      decidedAt: this._authorityContext.currentMode,
      deciderId: this._authorityContext.holderId,
      timestamp: new Date().toISOString(),
      rationale: opts.rationale,
      deliberationTimeMs: opts.deliberationTimeMs,
    };

    this.audit.recordDecision(record).catch((err) => {
      this.log('error', '[GovernanceAgentBridge] audit.recordDecision failed', err);
    });

    this.emitGov('governance:rejected', { decision: record, action });
    return record;
  }

  /**
   * Escalate a decision to a higher authority.
   * Records a 'escalated' outcome and notifies collaboration participants.
   */
  async escalateAction(
    action: GovernedAction,
    opts: {
      rationale?: string;
      situationId?: string;
    } = {},
  ): Promise<DecisionRecord> {
    const record: DecisionRecord = {
      decisionId: crypto.randomUUID(),
      governedActionId: action.action.id,
      situationId: opts.situationId ?? this.opts.viewId,
      outcome: 'escalated',
      decidedAt: this._authorityContext.currentMode,
      deciderId: this._authorityContext.holderId,
      timestamp: new Date().toISOString(),
      rationale: opts.rationale,
    };

    this.audit.recordDecision(record).catch((err) => {
      this.log('error', '[GovernanceAgentBridge] audit.escalateAction failed', err);
    });

    return record;
  }

  /**
   * Defer a decision (no action taken, logged as deferred).
   */
  async deferAction(
    action: GovernedAction,
    opts: { rationale?: string; situationId?: string } = {},
  ): Promise<DecisionRecord> {
    const record: DecisionRecord = {
      decisionId: crypto.randomUUID(),
      governedActionId: action.action.id,
      situationId: opts.situationId ?? this.opts.viewId,
      outcome: 'deferred',
      decidedAt: this._authorityContext.currentMode,
      deciderId: this._authorityContext.holderId,
      timestamp: new Date().toISOString(),
      rationale: opts.rationale,
    };

    this.audit.recordDecision(record).catch((err) => {
      this.log('error', '[GovernanceAgentBridge] audit.deferAction failed', err);
    });

    return record;
  }

  // ── Lock utilities ────────────────────────────────────────────────────────

  /**
   * Manually acquire a lock without committing to an approval.
   * Useful when the user opens the approval dialog.
   */
  async acquireLock(actionId: string): Promise<DecisionLock | null> {
    if (!this.collaboration) {
      // Collaboration disabled → local mock lock
      this.log('debug', '[GovernanceAgentBridge] collaboraton disabled, skipping lock');
      return null;
    }
    const lock = await this.collaboration.acquireLock(actionId);
    if (lock) {
      this.emitGov('governance:lock-acquired', lock);
    } else {
      this.emitGov('governance:lock-denied', { actionId, reason: 'Lock held by another participant' });
    }
    return lock;
  }

  /**
   * Release a held lock (e.g., user closed the dialog without deciding).
   */
  releaseLock(lockId: string): void {
    this.collaboration?.releaseLock(lockId);
  }

  // ── Streaming temporal predictions ────────────────────────────────────────

  /**
   * Emit a synthetic "temporal prediction" intent update.
   *
   * Called by agent backends that stream incremental confidence updates
   * (e.g., predicting outcome probabilities over time).  Fires an `intent`
   * event with an annotated payload — downstream components can watch for
   * the `_governanceConfidenceUpdate` flag to update confidence indicators.
   */
  emitConfidenceUpdate(
    basePayload: IntentPayload,
    update: {
      actionId: string;
      newConfidence: number;
      horizon: string;   // ISO 8601 duration, e.g. "PT1H"
      rationale?: string;
    },
  ): void {
    // Annotate the payload data with temporal prediction metadata
    const annotated: IntentPayload = {
      ...basePayload,
      data: {
        ...basePayload.data,
        _governanceConfidenceUpdate: {
          actionId: update.actionId,
          confidence: update.newConfidence,
          horizon: update.horizon,
          rationale: update.rationale,
          updatedAt: new Date().toISOString(),
        },
      },
    };
    this.emit('intent', annotated);
  }

  // ── Governance event subscription ─────────────────────────────────────────

  /**
   * Subscribe to governance-specific events.
   * These are separate from the base AgentBridge `on` method.
   */
  onGovernance<K extends GovernanceEventName>(
    event: K,
    listener: GovernanceListener<K>,
  ): () => void {
    if (!this.govListeners.has(event)) {
      this.govListeners.set(event, new Set());
    }
    this.govListeners.get(event)!.add(listener);
    return () => this.govListeners.get(event)?.delete(listener);
  }

  // ── Audit convenience pass-throughs ──────────────────────────────────────

  /** Query decision history. Delegates to GovernanceAuditClient. */
  async queryDecisions(filter: DecisionQueryFilter = {}) {
    return this.audit.queryDecisions(filter);
  }

  /** Get a compliance report. Delegates to GovernanceAuditClient. */
  async getComplianceReport(from: string, to?: string) {
    return this.audit.getComplianceReport(from, to);
  }

  /** Replay all decisions for a situational view. */
  async replayDecisions(situationId: string) {
    return this.audit.replayDecisions(situationId);
  }

  /** Persist a SituationalView to the audit backend. */
  async storeView(view: SituationalView): Promise<void> {
    return this.audit.storeView(view);
  }

  // ── Collaboration pass-throughs ───────────────────────────────────────────

  /** Live participants in this collaboration session. */
  get collaborationParticipants() {
    return this.collaboration?.participants ?? [];
  }

  /** Active decision locks in this collaboration session. */
  get activeLocks() {
    return this.collaboration?.activeLocks ?? [];
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private emitGov<K extends GovernanceEventName>(
    event: K,
    payload: GovernanceBridgeEvents[K],
  ): void {
    const set = this.govListeners.get(event);
    if (!set) return;
    for (const fn of set) {
      try {
        fn(payload);
      } catch (err) {
        this.log('error', `[GovernanceAgentBridge] governance listener threw for ${event}`, err);
      }
    }
  }

  private _wireCollaborationEvents(): void {
    if (!this.collaboration) return;

    this.collaboration.on('authority-sync', (event) => {
      this.emitGov('governance:authority-sync', event);
    });

    this.collaboration.on('escalation-alert', (notification) => {
      this.emitGov('governance:escalation', notification);
    });

    this.collaboration.on('conflict-detected', (conflict) => {
      this.emitGov('governance:conflict', conflict);
    });

    this.collaboration.on('lock-acquired', (lock) => {
      this.emitGov('governance:lock-acquired', lock);
    });

    this.collaboration.on('lock-denied', (msg) => {
      this.emitGov('governance:lock-denied', {
        actionId: msg.actionId,
        reason: msg.reason,
      });
    });
  }

  private _maybePersistView(payload: IntentPayload): void {
    // If the payload data carries a situationId, we treat it as a
    // SituationalView snapshot and persist it to the audit DB.
    const data = payload.data as Record<string, unknown>;
    const situationId = data?.situationId;
    if (typeof situationId === 'string') {
      // Construct minimal SituationalView wrapper for audit purposes
      const view: SituationalView = {
        situationId,
        question: String(data?.question ?? 'Unspecified'),
        scope: {
          systems: ['hari-ui'],
        },
        confidence: 0.8,
        unknowns: [],
        assumptions: [],
        generatedAt: new Date().toISOString(),
        status: 'active',
        priority: 50,
        tags: [],
        renderContract: payload,
      };
      this.audit.storeView(view).catch((err) => {
        this.log('warn', '[GovernanceAgentBridge] storeView failed', err);
      });
    }
  }
}
