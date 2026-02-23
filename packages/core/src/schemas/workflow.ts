import { z } from 'zod';
import { FormFieldSchema } from './form';

// ─────────────────────────────────────────────────────────────────────────────
// Workflow Schema
//
// The workflow intent type renders a multi-step guided process. Use it for
// onboarding wizards, configuration flows, approval pipelines, setup
// assistants, or any sequence of gated steps.
//
// Step types:
//   info         — descriptive text / instructions, no input required
//   form         — collects structured input via FormField primitives
//   confirmation — binary yes/no decision (e.g. "are you sure?")
//   review       — read-only summary of previously collected values
//
// Density mapping:
//   executive — compact progress bar + current step title only
//   operator  — sidebar step list + current step content panel
//   expert    — full step list with status, content, and metadata
// ─────────────────────────────────────────────────────────────────────────────

export const WorkflowStepStatusSchema = z.enum([
  'pending',
  'in_progress',
  'completed',
  'skipped',
  'failed',
]);

export type WorkflowStepStatus = z.infer<typeof WorkflowStepStatusSchema>;

const ReviewItemSchema = z.object({
  label: z.string(),
  value: z.string(),
  /** Emphasise this item (e.g. a critical config value) */
  highlight: z.boolean().default(false),
});

export const WorkflowStepSchema = z.object({
  /** Unique step identifier */
  id: z.string(),
  /** Step title shown in the stepper */
  title: z.string(),
  /** Optional subtitle / instruction */
  description: z.string().optional(),
  status: WorkflowStepStatusSchema.default('pending'),
  /** Governs which content sub-panel is rendered */
  type: z.enum(['info', 'form', 'confirmation', 'review']).default('info'),
  /** For type='info' and type='confirmation': body text */
  content: z.string().optional(),
  /** For type='form': field definitions */
  fields: z.array(FormFieldSchema).default([]),
  /** For type='review': key-value pairs summarising collected data */
  reviewItems: z.array(ReviewItemSchema).default([]),
  /** Optional icon (emoji or short symbol) beside the step title */
  icon: z.string().optional(),
  /** Whether this step may be skipped */
  skippable: z.boolean().default(false),
});

export type WorkflowStep = z.infer<typeof WorkflowStepSchema>;

export const WorkflowDataSchema = z.object({
  /** Optional heading above the workflow */
  title: z.string().optional(),
  steps: z.array(WorkflowStepSchema),
  /**
   * Zero-based index of the currently active step.
   * @default 0
   */
  currentStepIndex: z.number().int().min(0).default(0),
  /**
   * If true, users may click ahead to any unlocked step.
   * @default false
   */
  allowSkipAhead: z.boolean().default(false),
  /** Label for the final step's submit button. @default 'Finish' */
  finishLabel: z.string().default('Finish'),
});

export type WorkflowData = z.infer<typeof WorkflowDataSchema>;
