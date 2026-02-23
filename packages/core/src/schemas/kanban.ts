import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────────────────
// Kanban Schema
//
// The kanban intent type renders a task board with columns (lanes) and cards.
// Use it for project status boards, sprint planning, support queues, pipeline
// stages, or any bucketed-list view.
//
// Density mapping:
//   executive — column titles + card counts only (compact summary)
//   operator  — columns with cards (title, priority, assignee, tags)
//   expert    — full cards with description, metadata, due dates, WIP limits
// ─────────────────────────────────────────────────────────────────────────────

export const KanbanPrioritySchema = z.enum(['critical', 'high', 'medium', 'low']);

export type KanbanPriority = z.infer<typeof KanbanPrioritySchema>;

export const KanbanCardSchema = z.object({
  /** Unique card identifier */
  id: z.string(),
  /** Short card title */
  title: z.string(),
  /** Optional longer description */
  description: z.string().optional(),
  /** Priority level for colour-coding */
  priority: KanbanPrioritySchema.optional(),
  /** Assignee name or handle */
  assignee: z.string().optional(),
  /** ISO 8601 due date */
  dueDate: z.string().optional(),
  /** Colour tag chips */
  tags: z.array(z.string()).default([]),
  /** Extra key-value metadata shown in expert density */
  metadata: z.record(z.string(), z.unknown()).optional(),
  /** Links to an explainability entry in the parent IntentPayload */
  explainElementId: z.string().optional(),
});

export type KanbanCard = z.infer<typeof KanbanCardSchema>;

export const KanbanColumnSchema = z.object({
  /** Unique column identifier */
  id: z.string(),
  /** Column heading */
  title: z.string(),
  /** Work-in-progress limit — shown as a warning when exceeded */
  wipLimit: z.number().int().positive().optional(),
  /** Cards in this column */
  cards: z.array(KanbanCardSchema),
  /** Optional CSS colour for the column header accent */
  color: z.string().optional(),
});

export type KanbanColumn = z.infer<typeof KanbanColumnSchema>;

export const KanbanDataSchema = z.object({
  /** Optional board title */
  title: z.string().optional(),
  columns: z.array(KanbanColumnSchema),
  /** Show card count badge in each column header. @default true */
  showCardCount: z.boolean().default(true),
  /** Show WIP limit badges. @default true */
  showWipLimits: z.boolean().default(true),
});

export type KanbanData = z.infer<typeof KanbanDataSchema>;
