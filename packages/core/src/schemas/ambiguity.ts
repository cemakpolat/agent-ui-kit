import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────────────────
// Ambiguity Controls
//
// When the agent is uncertain about user intent it emits one or more
// AmbiguityControl primitives.  The frontend renders these as lightweight
// inline controls (sliders, toggles, chips) — never as modal dialogs or chat
// messages — so the user can clarify intent without leaving the current view.
// ─────────────────────────────────────────────────────────────────────────────

export const RangeSelectorSchema = z.object({
  type: z.literal('range_selector'),
  id: z.string(),
  label: z.string(),
  description: z.string().optional(),
  min: z.number().default(0),
  max: z.number().default(1),
  step: z.number().default(0.1),
  value: z.number(),
  minLabel: z.string().optional(),
  maxLabel: z.string().optional(),
  /** The key in the intent payload that this control modifies */
  parameterKey: z.string(),
});

export const ToggleSchema = z.object({
  type: z.literal('toggle'),
  id: z.string(),
  label: z.string(),
  description: z.string().optional(),
  value: z.boolean(),
  parameterKey: z.string(),
});

export const SelectOptionSchema = z.object({
  value: z.string(),
  label: z.string(),
  description: z.string().optional(),
});

export const MultiSelectSchema = z.object({
  type: z.literal('multi_select'),
  id: z.string(),
  label: z.string(),
  description: z.string().optional(),
  options: z.array(SelectOptionSchema),
  value: z.array(z.string()),
  parameterKey: z.string(),
});

export const SingleSelectSchema = z.object({
  type: z.literal('single_select'),
  id: z.string(),
  label: z.string(),
  description: z.string().optional(),
  options: z.array(SelectOptionSchema),
  value: z.string(),
  parameterKey: z.string(),
});

export const AmbiguityControlSchema = z.discriminatedUnion('type', [
  RangeSelectorSchema,
  ToggleSchema,
  MultiSelectSchema,
  SingleSelectSchema,
]);

export type AmbiguityControl = z.infer<typeof AmbiguityControlSchema>;
export type RangeSelector = z.infer<typeof RangeSelectorSchema>;
export type Toggle = z.infer<typeof ToggleSchema>;
export type MultiSelect = z.infer<typeof MultiSelectSchema>;
export type SingleSelect = z.infer<typeof SingleSelectSchema>;
export type SelectOption = z.infer<typeof SelectOptionSchema>;
