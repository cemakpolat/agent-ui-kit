// ─────────────────────────────────────────────────────────────────────────────
// Document intent type schemas.
//
// Agents that return `type: 'document'` populate IntentPayload.data with a
// DocumentData object.  This module provides Zod schemas for validation and
// TypeScript types for authoring renderers.
//
// Block taxonomy (discriminated on `type`):
//   heading   — section titles (h1–h6)
//   paragraph — free text with optional AI-confidence indicator
//   list      — ordered or unordered bullet list
//   code      — syntax-highlighted verbatim block
//   callout   — highlighted box (info / warning / insight / critical)
//   metric    — single KPI with optional trend arrow
//   divider   — visual separator between sections
// ─────────────────────────────────────────────────────────────────────────────

import { z } from 'zod';

// ── Block schemas ─────────────────────────────────────────────────────────────

const HeadingBlockSchema = z.object({
  type: z.literal('heading'),
  level: z.union([
    z.literal(1), z.literal(2), z.literal(3),
    z.literal(4), z.literal(5), z.literal(6),
  ]),
  text: z.string().min(1),
});

const ParagraphBlockSchema = z.object({
  type: z.literal('paragraph'),
  text: z.string().min(1),
  /**
   * Agent's confidence in this specific statement [0–1].
   * When provided, the renderer surfaces a subtle visual indicator.
   */
  confidence: z.number().min(0).max(1).optional(),
});

const ListBlockSchema = z.object({
  type: z.literal('list'),
  items: z.array(z.string().min(1)).min(1),
  ordered: z.boolean().default(false),
});

const CodeBlockSchema = z.object({
  type: z.literal('code'),
  code: z.string(),
  /** Language hint for syntax highlighting (e.g. 'sql', 'bash', 'json'). */
  language: z.string().optional(),
});

const CalloutBlockSchema = z.object({
  type: z.literal('callout'),
  variant: z.enum(['info', 'warning', 'insight', 'critical']),
  /** Optional bold header shown above the text. */
  title: z.string().optional(),
  text: z.string().min(1),
});

const MetricBlockSchema = z.object({
  type: z.literal('metric'),
  label: z.string().min(1),
  value: z.string().min(1),
  trend: z.enum(['up', 'down', 'stable']).optional(),
  /** Human-readable delta string, e.g. '+12%' or '−3 ms'. */
  delta: z.string().optional(),
  unit: z.string().optional(),
});

const DividerBlockSchema = z.object({
  type: z.literal('divider'),
});

export const DocumentBlockSchema = z.discriminatedUnion('type', [
  HeadingBlockSchema,
  ParagraphBlockSchema,
  ListBlockSchema,
  CodeBlockSchema,
  CalloutBlockSchema,
  MetricBlockSchema,
  DividerBlockSchema,
]);

export type DocumentBlock = z.infer<typeof DocumentBlockSchema>;

// ── Section schema ────────────────────────────────────────────────────────────

export const DocumentSectionSchema = z.object({
  /** Stable identifier — used as key and for linking explain panels. */
  id: z.string().min(1),
  title: z.string().optional(),
  /**
   * AI confidence for the entire section [0–1].
   * When below 0.7 the renderer adds a low-confidence badge.
   */
  confidence: z.number().min(0).max(1).optional(),
  blocks: z.array(DocumentBlockSchema).min(0),
  /**
   * Links this section to an ExplainabilityElement id in the parent
   * IntentPayload.explainability map.
   */
  explainElementId: z.string().optional(),
});

export type DocumentSection = z.infer<typeof DocumentSectionSchema>;

// ── Top-level document data ───────────────────────────────────────────────────

export const DocumentDataSchema = z.object({
  title: z.string().min(1),
  sections: z.array(DocumentSectionSchema).min(1),
  /** Name or system that produced this document. */
  author: z.string().optional(),
  /** ISO-8601 timestamp. */
  publishedAt: z.string().optional(),
  /** One-paragraph executive overview shown before sections. */
  summary: z.string().optional(),
  /** Document revision counter — incremented on each agent update. */
  revision: z.number().int().positive().optional(),
});

export type DocumentData = z.infer<typeof DocumentDataSchema>;
