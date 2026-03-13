import { z } from 'zod';
import { AuthorityModeSchema } from './authority';

// ─────────────────────────────────────────────────────────────────────────────
// Real-Time Collaboration Schemas
//
// These schemas govern what happens when multiple humans share the same
// SituationalView simultaneously.  Key problems solved:
//
//   Decision locking   — exactly one human can approve a governed action
//   Authority sync     — all viewers see each other's authority state
//   Escalation alerts  — notified when someone overrides a decision
//   Conflict detection — catches simultaneous conflicting approvals
//
// All messages flow through the GovernanceCollaborationHub (WebSocket server)
// and are broadcast to all participants in the same collaboration session.
// ─────────────────────────────────────────────────────────────────────────────

// ── Participant ───────────────────────────────────────────────────────────────

export const CollaborationParticipantSchema = z.object({
  /** Unique user/session identifier */
  participantId: z.string(),
  /** Display name */
  participantName: z.string().optional(),
  /** Current authority mode of this participant */
  authorityMode: AuthorityModeSchema,
  /** Which situational view they are viewing (collaboration session key) */
  viewId: z.string().uuid(),
  /** ISO 8601 timestamp when they joined */
  joinedAt: z.string().datetime(),
  /** ISO 8601 timestamp of last activity */
  lastSeen: z.string().datetime(),
  /** Connection status */
  status: z.enum(['active', 'idle', 'disconnected']).default('active'),
});

export type CollaborationParticipant = z.infer<typeof CollaborationParticipantSchema>;

// ── Decision Lock ─────────────────────────────────────────────────────────────

/**
 * A DecisionLock ensures only one participant can approve a GovernedAction
 * at a time, preventing double-approvals and race conditions.
 *
 * Lock protocol:
 *   1. Participant calls acquireLock(actionId)
 *   2. If no lock exists → lock granted, broadcast to all viewers
 *   3. If lock held by another → lock denied, UI disables approve button
 *   4. On approval/rejection/timeout → lock released, broadcast to all
 */
export const DecisionLockSchema = z.object({
  lockId: z.string().uuid(),
  /** The governed action being locked */
  actionId: z.string(),
  /** The collaboration session (situational view) */
  viewId: z.string().uuid(),
  /** Who holds the lock */
  holderId: z.string(),
  holderName: z.string().optional(),
  /** ISO 8601 timestamp when the lock was acquired */
  acquiredAt: z.string().datetime(),
  /** ISO 8601 timestamp when the lock expires automatically */
  expiresAt: z.string().datetime(),
  /** Lock status */
  status: z.enum(['active', 'released', 'expired', 'contested']).default('active'),
});

export type DecisionLock = z.infer<typeof DecisionLockSchema>;
export type DecisionLockInput = z.input<typeof DecisionLockSchema>;

// ── Escalation Notification ───────────────────────────────────────────────────

/**
 * Broadcast when a participant escalates their authority mode.
 * Other participants should be made aware of authority changes in the room.
 */
export const EscalationNotificationSchema = z.object({
  notificationId: z.string().uuid(),
  viewId: z.string().uuid(),
  participantId: z.string(),
  participantName: z.string().optional(),
  /** Authority mode before escalation */
  fromMode: AuthorityModeSchema,
  /** Authority mode after escalation */
  toMode: AuthorityModeSchema,
  /** Human-readable justification */
  justification: z.string().optional(),
  reason: z.string().optional(),
  timestamp: z.string().datetime(),
  /** Whether this is an override (highest severity) */
  isOverride: z.boolean().default(false),
});

export type EscalationNotification = z.infer<typeof EscalationNotificationSchema>;

// ── Conflict Record ───────────────────────────────────────────────────────────

/**
 * A ConflictRecord is created when two participants simultaneously approve
 * different (mutually exclusive) actions, or approve and reject the same action.
 *
 * Conflict resolution strategies:
 *   'higher-authority' — the decision from the higher authority mode wins
 *   'first-approved'   — the first timestamp wins (default)
 *   'manual'           — escalated to a third party for resolution
 */
export const ConflictResolutionStrategySchema = z.enum([
  'higher-authority',
  'first-approved',
  'manual',
]);

export const ConflictStatusSchema = z.enum([
  'pending',   // Awaiting resolution
  'resolved',  // Conflict resolved
  'escalated', // Sent to higher authority
]);

export const ConflictRecordSchema = z.object({
  conflictId: z.string().uuid(),
  viewId: z.string().uuid(),
  /** The governed action the conflict is about */
  actionId: z.string(),
  timestamp: z.string().datetime(),
  /** First decision (earlier timestamp) */
  firstDecision: z.object({
    participantId: z.string(),
    participantName: z.string().optional(),
    outcome: z.enum(['approved', 'rejected']),
    authorityMode: AuthorityModeSchema,
    timestamp: z.string().datetime(),
    rationale: z.string().optional(),
  }),
  /** Conflicting second decision */
  secondDecision: z.object({
    participantId: z.string(),
    participantName: z.string().optional(),
    outcome: z.enum(['approved', 'rejected']),
    authorityMode: AuthorityModeSchema,
    timestamp: z.string().datetime(),
    rationale: z.string().optional(),
  }),
  resolution: z.object({
    strategy: ConflictResolutionStrategySchema,
    winningDecision: z.enum(['first', 'second', 'neither']),
    resolvedBy: z.string().optional(),
    resolvedAt: z.string().datetime().optional(),
    notes: z.string().optional(),
  }).optional(),
  status: ConflictStatusSchema.default('pending'),
});

export type ConflictRecord = z.infer<typeof ConflictRecordSchema>;

// ── Authority Sync Event ──────────────────────────────────────────────────────

/**
 * Broadcast to all viewers in a session whenever any participant's
 * authority mode changes.  Enables the "who's in the room" sidebar.
 */
export const AuthoritySyncEventSchema = z.object({
  viewId: z.string().uuid(),
  /** Full list of participants and their current authority modes */
  participants: z.array(CollaborationParticipantSchema),
  /** The participant whose state changed (if any) */
  changedParticipantId: z.string().optional(),
  timestamp: z.string().datetime(),
});

export type AuthoritySyncEvent = z.infer<typeof AuthoritySyncEventSchema>;

// ── WebSocket Message Protocol ────────────────────────────────────────────────
//
// Messages sent FROM client TO server (ClientMessage)
// Messages sent FROM server TO clients (ServerMessage)

export const ClientMessageTypeSchema = z.enum([
  'join',             // Join a collaboration session for a view
  'leave',            // Leave the session
  'acquire-lock',     // Request a decision lock
  'release-lock',     // Release a held lock
  'authority-change', // Notify authority mode changed
  'heartbeat',        // Keep connection alive
]);

export const ServerMessageTypeSchema = z.enum([
  'session-state',         // Full session state on join
  'participant-joined',    // New participant arrived
  'participant-left',      // Participant disconnected
  'lock-acquired',         // Lock granted
  'lock-denied',           // Lock request rejected
  'lock-released',         // A lock was freed
  'lock-expired',          // A lock timed out
  'authority-sync',        // Authority state changed for a participant
  'escalation-alert',      // Someone escalated to override
  'conflict-detected',     // Two conflicting decisions detected
  'conflict-resolved',     // A conflict was resolved
  'error',                 // Error from server
]);

// ── Client → Server Messages ──────────────────────────────────────────────────

export const JoinMessageSchema = z.object({
  type: z.literal('join'),
  viewId: z.string().uuid(),
  participantId: z.string(),
  participantName: z.string().optional(),
  authorityMode: AuthorityModeSchema,
});

export const LeaveMessageSchema = z.object({
  type: z.literal('leave'),
  viewId: z.string().uuid(),
  participantId: z.string(),
});

export const AcquireLockMessageSchema = z.object({
  type: z.literal('acquire-lock'),
  viewId: z.string().uuid(),
  actionId: z.string(),
  participantId: z.string(),
  participantName: z.string().optional(),
  /** Lock TTL in ms — defaults to 60 000 (1 min) */
  ttlMs: z.number().int().min(5_000).max(300_000).default(60_000),
});

export const ReleaseLockMessageSchema = z.object({
  type: z.literal('release-lock'),
  lockId: z.string().uuid(),
  participantId: z.string(),
});

export const AuthorityChangeMessageSchema = z.object({
  type: z.literal('authority-change'),
  viewId: z.string().uuid(),
  participantId: z.string(),
  participantName: z.string().optional(),
  fromMode: AuthorityModeSchema,
  toMode: AuthorityModeSchema,
  justification: z.string().optional(),
  reason: z.string().optional(),
});

export const HeartbeatMessageSchema = z.object({
  type: z.literal('heartbeat'),
  participantId: z.string(),
});

export const ClientMessageSchema = z.discriminatedUnion('type', [
  JoinMessageSchema,
  LeaveMessageSchema,
  AcquireLockMessageSchema,
  ReleaseLockMessageSchema,
  AuthorityChangeMessageSchema,
  HeartbeatMessageSchema,
]);

export type ClientMessage = z.infer<typeof ClientMessageSchema>;

// ── Server → Client Messages ──────────────────────────────────────────────────

export const SessionStateMessageSchema = z.object({
  type: z.literal('session-state'),
  viewId: z.string().uuid(),
  participants: z.array(CollaborationParticipantSchema),
  activeLocks: z.array(DecisionLockSchema),
});

export const ParticipantJoinedMessageSchema = z.object({
  type: z.literal('participant-joined'),
  participant: CollaborationParticipantSchema,
});

export const ParticipantLeftMessageSchema = z.object({
  type: z.literal('participant-left'),
  participantId: z.string(),
  viewId: z.string().uuid(),
  timestamp: z.string().datetime(),
});

export const LockAcquiredMessageSchema = z.object({
  type: z.literal('lock-acquired'),
  lock: DecisionLockSchema,
});

export const LockDeniedMessageSchema = z.object({
  type: z.literal('lock-denied'),
  actionId: z.string(),
  reason: z.string(),
  /** Who currently holds the lock */
  currentHolder: z.object({
    holderId: z.string(),
    holderName: z.string().optional(),
    expiresAt: z.string().datetime(),
  }).optional(),
});

export const LockReleasedMessageSchema = z.object({
  type: z.literal('lock-released'),
  lockId: z.string().uuid(),
  actionId: z.string(),
  releasedBy: z.string(),
});

export const LockExpiredMessageSchema = z.object({
  type: z.literal('lock-expired'),
  lockId: z.string().uuid(),
  actionId: z.string(),
});

export const AuthoritySyncMessageSchema = z.object({
  type: z.literal('authority-sync'),
  event: AuthoritySyncEventSchema,
});

export const EscalationAlertMessageSchema = z.object({
  type: z.literal('escalation-alert'),
  notification: EscalationNotificationSchema,
});

export const ConflictDetectedMessageSchema = z.object({
  type: z.literal('conflict-detected'),
  conflict: ConflictRecordSchema,
});

export const ConflictResolvedMessageSchema = z.object({
  type: z.literal('conflict-resolved'),
  conflict: ConflictRecordSchema,
});

export const ServerErrorMessageSchema = z.object({
  type: z.literal('error'),
  code: z.string(),
  message: z.string(),
});

export const ServerMessageSchema = z.discriminatedUnion('type', [
  SessionStateMessageSchema,
  ParticipantJoinedMessageSchema,
  ParticipantLeftMessageSchema,
  LockAcquiredMessageSchema,
  LockDeniedMessageSchema,
  LockReleasedMessageSchema,
  LockExpiredMessageSchema,
  AuthoritySyncMessageSchema,
  EscalationAlertMessageSchema,
  ConflictDetectedMessageSchema,
  ConflictResolvedMessageSchema,
  ServerErrorMessageSchema,
]);

export type ServerMessage = z.infer<typeof ServerMessageSchema>;

// ── Collaboration Options ─────────────────────────────────────────────────────

export interface CollaborationClientOptions {
  /** WebSocket URL of the governance collaboration hub */
  serverUrl: string;
  /** View being collaborated on */
  viewId: string;
  /** Current user */
  participantId: string;
  participantName?: string;
  /** Initial authority mode */
  initialAuthorityMode: import('./authority').AuthorityMode;
  /** Called on unrecoverable error */
  onError?: (err: Error) => void;
  /** Lock TTL in ms — default 60 000 */
  lockTtlMs?: number;
  /** Heartbeat interval in ms — default 30 000 */
  heartbeatIntervalMs?: number;
}
