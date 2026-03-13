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

/**
 * Rich list item — used when items carry extra metadata beyond plain text.
 */
const ListItemObjectSchema = z.object({
  text: z.string().min(1),
  description: z.string().optional(),
  icon: z.string().optional(),
  checked: z.boolean().optional(),
});

/**
 * A single list item: either a plain string or a rich object.
 * Agents may produce either form; renderers should normalise via `normalizeListItem()`.
 */
export const ListItemSchema = z.union([
  z.string().min(1),
  ListItemObjectSchema,
]);

export type ListItem = z.infer<typeof ListItemSchema>;

const ListBlockSchema = z.object({
  type: z.literal('list'),
  items: z.array(ListItemSchema).min(1),
  ordered: z.boolean().default(false),
});

/**
 * Normalise a `ListItem` to its display text.
 * Useful inside renderers and export helpers.
 */
export function normalizeListItemText(item: ListItem): string {
  return typeof item === 'string' ? item : item.text;
}

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

const TableRowActionSchema = z.object({
  /** Human-readable button label */
  label: z.string().min(1),
  /** Opaque action identifier passed to onRowAction callback */
  action: z.string().min(1),
  /** Visual variant controls button color */
  variant: z.enum(['default', 'danger', 'primary']).default('default'),
  /** Optional emoji/text icon shown before label */
  icon: z.string().optional(),
});

export type TableRowAction = z.infer<typeof TableRowActionSchema>;

const TableBlockSchema = z.object({
  type: z.literal('table'),
  /** Table headers with optional alignment */
  headers: z.array(z.object({
    key: z.string(),
    label: z.string(),
    align: z.enum(['left', 'center', 'right']).default('left'),
  })),
  /** Array of row objects, keys must match header keys */
  rows: z.array(z.record(z.string(), z.unknown())),
  caption: z.string().optional(),
  /**
   * Per-row action buttons. When provided, an extra column is appended to each
   * row with buttons for each action. Clicks fire onRowAction in the renderer.
   */
  rowActions: z.array(TableRowActionSchema).optional(),
});

const ImageBlockSchema = z.object({
  type: z.literal('image'),
  src: z.string(), // URL or data URI
  alt: z.string(),
  caption: z.string().optional(),
  width: z.union([z.number(), z.string()]).optional(),
});

const QuoteBlockSchema = z.object({
  type: z.literal('quote'),
  text: z.string().min(1),
  author: z.string().optional(),
  source: z.string().optional(),
});

const DataVizBlockSchema = z.object({
  type: z.literal('dataviz'),
  chartType: z.enum(['line', 'bar', 'pie', 'scatter', 'area', 'sparkline']),
  title: z.string().optional(),
  data: z.array(z.object({
    x: z.union([z.string(), z.number()]),
    y: z.number(),
    label: z.string().optional(),
  })),
  config: z.record(z.string(), z.unknown()).optional(),
});

const EmbedBlockSchema = z.object({
  type: z.literal('embed'),
  url: z.string(),
  fallbackText: z.string().optional(),
  height: z.union([z.number(), z.string()]).optional(),
});

const PDFBlockSchema = z.object({
  type: z.literal('pdf'),
  /** URL or data URI pointing to a PDF file */
  url: z.string(),
  /** Optional title for the PDF viewer */
  title: z.string().optional(),
  /** Height of the PDF viewer in pixels or CSS units */
  height: z.union([z.number(), z.string()]).default('600px'),
  /** Show page numbers and controls */
  showControls: z.boolean().default(true),
  /** Show file download button */
  downloadable: z.boolean().default(true),
});

export type PDFBlock = z.infer<typeof PDFBlockSchema>;

const ExcelBlockSchema = z.object({
  type: z.literal('excel'),
  /** URL to XLSX file or embedded CSV data */
  url: z.string().optional(),
  /** Raw CSV data as string (alternative to url) */
  csvData: z.string().optional(),
  /** Title for the spreadsheet viewer */
  title: z.string().optional(),
  /** List of sheet names if multiple sheets (for preview) */
  sheets: z.array(z.string()).optional(),
  /** Currently active sheet name/index */
  activeSheet: z.string().optional(),
  /** Show filters and sorting controls */
  showControls: z.boolean().default(true),
  /** Show file download button */
  downloadable: z.boolean().default(true),
  /** Height of the spreadsheet viewer */
  height: z.union([z.number(), z.string()]).default('500px'),
});

export type ExcelBlock = z.infer<typeof ExcelBlockSchema>;

export const DocumentBlockSchema = z.discriminatedUnion('type', [
  HeadingBlockSchema,
  ParagraphBlockSchema,
  ListBlockSchema,
  CodeBlockSchema,
  CalloutBlockSchema,
  MetricBlockSchema,
  DividerBlockSchema,
  TableBlockSchema,
  ImageBlockSchema,
  QuoteBlockSchema,
  DataVizBlockSchema,
  EmbedBlockSchema,
  PDFBlockSchema,
  ExcelBlockSchema,
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
  /** Whether this section can be collapsed by the user. */
  collapsible: z.boolean().default(false),
  /** Initial collapsed state when collapsible is true. */
  defaultCollapsed: z.boolean().default(false),
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
  /** Whether this document auto-refreshes (living document) */
  refreshable: z.boolean().default(false),
  /** Refresh interval in seconds (if refreshable) */
  refreshInterval: z.number().optional(),
  /** Data sources used to generate this document */
  sources: z.array(z.string()).optional(),
  /** Tags for categorization and filtering */
  tags: z.array(z.string()).default([]),
});

export type DocumentData = z.infer<typeof DocumentDataSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Collaborative Editing — operation types for real-time document collaboration
//
// Documents can be edited concurrently by multiple users. Operations are
// broadcast over a transport (WebSocket / BroadcastChannel) and applied
// using OT-lite last-write-wins semantics for non-conflicting block edits.
//
// Operation types:
//   block_edit   — replace an existing block's content
//   block_insert — insert a new block after a given index
//   block_delete — remove a block
//   block_move   — move a block to a different position
//   comment_add  — attach an inline comment to a block
// ─────────────────────────────────────────────────────────────────────────────

export const BlockCommentSchema = z.object({
  /** Unique comment ID */
  commentId: z.string(),
  /** Author collaborator ID */
  authorId: z.string(),
  /** Author display name (denormalised for offline access) */
  authorName: z.string(),
  /** Author colour (hex) */
  authorColor: z.string(),
  /** Comment text */
  text: z.string().min(1),
  /** ISO-8601 creation timestamp */
  createdAt: z.string().datetime(),
  /** Whether the comment has been resolved */
  resolved: z.boolean().default(false),
});

export type BlockComment = z.infer<typeof BlockCommentSchema>;

export const BlockEditOpSchema = z.object({
  type: z.literal('block_edit'),
  sectionId: z.string(),
  blockIndex: z.number().int().min(0),
  /** Complete replacement block (whole block is replaced atomically) */
  block: DocumentBlockSchema,
});

export const BlockInsertOpSchema = z.object({
  type: z.literal('block_insert'),
  sectionId: z.string(),
  /** Insert AFTER this index; use -1 to prepend */
  afterIndex: z.number().int().min(-1),
  block: DocumentBlockSchema,
});

export const BlockDeleteOpSchema = z.object({
  type: z.literal('block_delete'),
  sectionId: z.string(),
  blockIndex: z.number().int().min(0),
});

export const BlockMoveOpSchema = z.object({
  type: z.literal('block_move'),
  sectionId: z.string(),
  fromIndex: z.number().int().min(0),
  toIndex: z.number().int().min(0),
});

export const CommentAddOpSchema = z.object({
  type: z.literal('comment_add'),
  sectionId: z.string(),
  blockIndex: z.number().int().min(0),
  comment: BlockCommentSchema,
});

export const CommentResolveOpSchema = z.object({
  type: z.literal('comment_resolve'),
  sectionId: z.string(),
  blockIndex: z.number().int().min(0),
  commentId: z.string(),
});

export const DocumentEditOperationSchema = z.discriminatedUnion('type', [
  BlockEditOpSchema,
  BlockInsertOpSchema,
  BlockDeleteOpSchema,
  BlockMoveOpSchema,
  CommentAddOpSchema,
  CommentResolveOpSchema,
]);

export type DocumentEditOperation = z.infer<typeof DocumentEditOperationSchema>;

/**
 * Stamped operation — wraps a DocumentEditOperation with authorship + lamport clock
 * so remote peers can order and apply operations deterministically.
 */
export const StampedOperationSchema = z.object({
  /** Globally unique operation ID */
  opId: z.string(),
  /** Session ID of the collaborator who issued this op */
  authorId: z.string(),
  /** Author display name */
  authorName: z.string(),
  /** Hex colour for cursors / avatars (e.g. '#6366f1') */
  authorColor: z.string().optional(),
  /** Lamport timestamp for causal ordering */
  lamport: z.number().int().min(0),
  /** Wall-clock ISO-8601 */
  issuedAt: z.string().datetime(),
  op: DocumentEditOperationSchema,
});

export type StampedOperation = z.infer<typeof StampedOperationSchema>;

/** Comment map: sectionId → blockIndex → comments[] */
export type BlockCommentMap = Record<string, Record<number, BlockComment[]>>;

// ─────────────────────────────────────────────────────────────────────────────
// Data normalisation — coerces common LLM output quirks into valid shapes
// before Zod validation.
//
// Common mistakes made by LLMs:
//   1. List items as objects ({ text: "..." }) instead of plain strings
//   2. Table rows as arrays (["a","b"]) instead of keyed objects
//   3. Sections as arrays of blocks (missing the section wrapper)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Best-effort coercion of a value into a plain string.
 * Objects → `text` / `name` / `label` / `value` field, or JSON.stringify.
 */
function coerceToString(v: unknown): string {
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (v && typeof v === 'object') {
    const obj = v as Record<string, unknown>;
    for (const key of ['text', 'name', 'label', 'value', 'title', 'description']) {
      if (typeof obj[key] === 'string' && (obj[key] as string).length > 0) {
        return obj[key] as string;
      }
    }
    return JSON.stringify(v);
  }
  return String(v ?? '');
}

/**
 * Normalise a single block, fixing common LLM output quirks.
 */
function normalizeBlock(block: Record<string, unknown>): Record<string, unknown> {
  if (!block || typeof block !== 'object' || !block.type) return block;

  // Fix list items: objects → strings
  if (block.type === 'list' && Array.isArray(block.items)) {
    block.items = (block.items as unknown[]).map(coerceToString);
  }

  // Fix table headers: plain strings → {key, label, align} objects
  if (block.type === 'table' && Array.isArray(block.headers)) {
    block.headers = (block.headers as unknown[]).map((h, i) => {
      if (typeof h === 'string') {
        return { key: h.toLowerCase().replace(/\s+/g, '_') || `col${i}`, label: h, align: 'left' };
      }
      if (h && typeof h === 'object') {
        const obj = h as Record<string, unknown>;
        if (!obj.key) obj.key = String(obj.label ?? '').toLowerCase().replace(/\s+/g, '_') || `col${i}`;
        if (!obj.label) obj.label = String(obj.key ?? '');
        if (!obj.align) obj.align = 'left';
        return obj;
      }
      return h;
    });
  }

  // Fix table rows: arrays → objects keyed by header keys
  if (block.type === 'table' && Array.isArray(block.rows) && Array.isArray(block.headers)) {
    const headers = block.headers as Array<Record<string, unknown>>;
    block.rows = (block.rows as unknown[]).map((row) => {
      if (Array.isArray(row)) {
        const obj: Record<string, unknown> = {};
        headers.forEach((h, i) => {
          const key = (typeof h === 'string' ? h : (h as Record<string, unknown>).key ?? (h as Record<string, unknown>).label ?? `col${i}`) as string;
          obj[key] = i < row.length ? row[i] : '';
        });
        return obj;
      }
      return row;
    });
  }

  // Fix metric blocks: ensure required label and value fields exist
  if (block.type === 'metric') {
    if (!block.label) block.label = 'Metric';
    if (block.value === undefined || block.value === null) block.value = 'N/A';
    if (typeof block.value === 'number') block.value = String(block.value);
  }

  return block;
}

/**
 * Normalise raw document data so it passes `DocumentDataSchema.safeParse()`.
 *
 * Call this **before** validation when the data originates from an LLM or
 * other untrusted source.  The function mutates nothing — it returns a
 * shallow-cloned structure with fixes applied.
 */
export function normalizeDocumentData(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw;
  const data = { ...(raw as Record<string, unknown>) };

  if (!Array.isArray(data.sections)) return data;

  data.sections = (data.sections as unknown[]).map((section) => {
    if (!section || typeof section !== 'object') return section;
    const sec = { ...(section as Record<string, unknown>) };

    // Ensure section has an id
    if (!sec.id) {
      sec.id = `section-${Math.random().toString(36).slice(2, 9)}`;
    }

    if (Array.isArray(sec.blocks)) {
      sec.blocks = (sec.blocks as Array<Record<string, unknown>>).map((b) =>
        normalizeBlock({ ...b }),
      );
    }

    return sec;
  });

  return data;
}
