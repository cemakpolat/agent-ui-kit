import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────────────────
// Timeline Schema
//
// The timeline intent type renders a chronological sequence of events.
// Use it for audit logs, deployment histories, incident timelines, project
// milestones, git histories, or any ordered sequence of dated events.
//
// Density mapping:
//   executive — shows only the most recent N events, no metadata
//   operator  — shows all events with timestamps and status badges
//   expert    — shows full metadata, duration, and category grouping
// ─────────────────────────────────────────────────────────────────────────────

export const TimelineEventStatusSchema = z.enum([
  'completed',
  'in_progress',
  'pending',
  'cancelled',
  'failed',
]);

export type TimelineEventStatus = z.infer<typeof TimelineEventStatusSchema>;

export const TimelineEventSchema = z.object({
  /** Unique event identifier */
  id: z.string(),
  /** Short title displayed prominently */
  title: z.string(),
  /** Optional longer description */
  description: z.string().optional(),
  /** ISO 8601 timestamp for the event start */
  timestamp: z.string(),
  /** ISO 8601 timestamp for events that have duration (e.g. a deployment window) */
  endTimestamp: z.string().optional(),
  /**
   * Logical category for color-coding and optional grouping.
   * Examples: "deploy", "incident", "config", "release"
   */
  category: z.string().optional(),
  /** Lifecycle status of the event */
  status: TimelineEventStatusSchema.optional(),
  /** Emoji or 1-2 character symbol shown in the event dot */
  icon: z.string().optional(),
  /** Extra key-value metadata shown in expert density */
  metadata: z.record(z.string(), z.unknown()).optional(),
  /** Links to an explainability entry in the parent IntentPayload */
  explainElementId: z.string().optional(),
});

export type TimelineEvent = z.infer<typeof TimelineEventSchema>;

export const TimelineDataSchema = z.object({
  /** Optional heading rendered above the timeline */
  title: z.string().optional(),
  events: z.array(TimelineEventSchema),
  /**
   * Visual orientation of the timeline.
   * @default 'vertical'
   */
  direction: z.enum(['vertical', 'horizontal']).default('vertical'),
  /**
   * Whether to show formatted timestamps next to events.
   * @default true
   */
  showTimestamps: z.boolean().default(true),
  /**
   * Group events by a time bucket or by category.
   * When set, a divider/heading is inserted between groups.
   */
  groupBy: z.enum(['day', 'week', 'month', 'year', 'category']).optional(),
  /**
   * In executive density, cap the number of visible events to this limit.
   * The most recent events are shown.
   * @default 5
   */
  executiveCap: z.number().int().positive().default(5),
});

export type TimelineData = z.infer<typeof TimelineDataSchema>;
