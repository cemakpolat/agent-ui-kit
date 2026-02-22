import { describe, it, expect } from 'vitest';
import {
  DocumentBlockSchema,
  DocumentSectionSchema,
  DocumentDataSchema,
} from '../schemas/document';

// ── DocumentBlockSchema ───────────────────────────────────────────────────────

describe('DocumentBlockSchema', () => {
  it('parses a heading block', () => {
    const block = { type: 'heading', level: 2, text: 'Root Cause' };
    const result = DocumentBlockSchema.parse(block);
    expect(result.type).toBe('heading');
    if (result.type === 'heading') {
      expect(result.level).toBe(2);
      expect(result.text).toBe('Root Cause');
    }
  });

  it('rejects a heading with an invalid level', () => {
    expect(() =>
      DocumentBlockSchema.parse({ type: 'heading', level: 7, text: 'Too deep' }),
    ).toThrow();
  });

  it('parses a paragraph block with optional confidence', () => {
    const block = { type: 'paragraph', text: 'The root cause was...', confidence: 0.88 };
    const result = DocumentBlockSchema.parse(block);
    expect(result.type).toBe('paragraph');
    if (result.type === 'paragraph') {
      expect(result.confidence).toBe(0.88);
    }
  });

  it('parses a paragraph block without confidence', () => {
    const result = DocumentBlockSchema.parse({ type: 'paragraph', text: 'Some text.' });
    expect(result.type).toBe('paragraph');
    if (result.type === 'paragraph') {
      expect(result.confidence).toBeUndefined();
    }
  });

  it('rejects a paragraph with empty text', () => {
    expect(() =>
      DocumentBlockSchema.parse({ type: 'paragraph', text: '' }),
    ).toThrow();
  });

  it('parses an ordered list block', () => {
    const block = { type: 'list', items: ['Step 1', 'Step 2'], ordered: true };
    const result = DocumentBlockSchema.parse(block);
    if (result.type === 'list') {
      expect(result.ordered).toBe(true);
      expect(result.items).toHaveLength(2);
    }
  });

  it('defaults ordered to false for list blocks', () => {
    const result = DocumentBlockSchema.parse({ type: 'list', items: ['A', 'B'] });
    if (result.type === 'list') {
      expect(result.ordered).toBe(false);
    }
  });

  it('rejects a list with no items', () => {
    expect(() =>
      DocumentBlockSchema.parse({ type: 'list', items: [] }),
    ).toThrow();
  });

  it('parses a code block', () => {
    const block = { type: 'code', code: 'SELECT * FROM events', language: 'sql' };
    const result = DocumentBlockSchema.parse(block);
    if (result.type === 'code') {
      expect(result.language).toBe('sql');
      expect(result.code).toContain('SELECT');
    }
  });

  it('parses a code block without language', () => {
    const result = DocumentBlockSchema.parse({ type: 'code', code: 'echo hello' });
    if (result.type === 'code') {
      expect(result.language).toBeUndefined();
    }
  });

  it.each(['info', 'warning', 'insight', 'critical'] as const)(
    'parses a %s callout block',
    (variant) => {
      const result = DocumentBlockSchema.parse({
        type: 'callout',
        variant,
        text: 'Something important.',
      });
      if (result.type === 'callout') {
        expect(result.variant).toBe(variant);
      }
    },
  );

  it('rejects a callout with an unknown variant', () => {
    expect(() =>
      DocumentBlockSchema.parse({ type: 'callout', variant: 'success', text: 'Done' }),
    ).toThrow();
  });

  it('parses a metric block with trend and delta', () => {
    const block = { type: 'metric', label: 'Error rate', value: '0.3%', trend: 'down', delta: '−0.2%' };
    const result = DocumentBlockSchema.parse(block);
    if (result.type === 'metric') {
      expect(result.trend).toBe('down');
      expect(result.delta).toBe('−0.2%');
    }
  });

  it('parses a divider block', () => {
    const result = DocumentBlockSchema.parse({ type: 'divider' });
    expect(result.type).toBe('divider');
  });

  it('rejects an unknown block type', () => {
    expect(() =>
      DocumentBlockSchema.parse({ type: 'video', src: 'https://example.com' }),
    ).toThrow();
  });
});

// ── DocumentSectionSchema ─────────────────────────────────────────────────────

describe('DocumentSectionSchema', () => {
  it('parses a minimal section', () => {
    const result = DocumentSectionSchema.parse({ id: 'sec-1', blocks: [] });
    expect(result.id).toBe('sec-1');
    expect(result.blocks).toHaveLength(0);
  });

  it('parses a full section with all optional fields', () => {
    const result = DocumentSectionSchema.parse({
      id: 'sec-2',
      title: 'Root Cause',
      confidence: 0.92,
      blocks: [{ type: 'paragraph', text: 'Connection pool exhausted.' }],
      explainElementId: 'explain-root-cause',
    });
    expect(result.title).toBe('Root Cause');
    expect(result.confidence).toBe(0.92);
    expect(result.explainElementId).toBe('explain-root-cause');
  });

  it('rejects a section with an empty id', () => {
    expect(() =>
      DocumentSectionSchema.parse({ id: '', blocks: [] }),
    ).toThrow();
  });

  it('rejects confidence out of [0, 1]', () => {
    expect(() =>
      DocumentSectionSchema.parse({ id: 's', blocks: [], confidence: 1.5 }),
    ).toThrow();
  });
});

// ── DocumentDataSchema ────────────────────────────────────────────────────────

describe('DocumentDataSchema', () => {
  const MINIMAL = {
    title: 'Incident Post-Mortem',
    sections: [{ id: 'exec', blocks: [{ type: 'paragraph', text: 'All clear.' }] }],
  };

  it('parses a minimal document', () => {
    const result = DocumentDataSchema.parse(MINIMAL);
    expect(result.title).toBe('Incident Post-Mortem');
    expect(result.sections).toHaveLength(1);
  });

  it('parses a full document', () => {
    const result = DocumentDataSchema.parse({
      ...MINIMAL,
      author: 'AI SRE Assistant',
      publishedAt: '2026-02-22T09:00:00Z',
      summary: 'Brief overview.',
      revision: 3,
    });
    expect(result.author).toBe('AI SRE Assistant');
    expect(result.revision).toBe(3);
  });

  it('rejects a document with an empty title', () => {
    expect(() =>
      DocumentDataSchema.parse({ title: '', sections: [{ id: 's', blocks: [] }] }),
    ).toThrow();
  });

  it('rejects a document with no sections', () => {
    expect(() =>
      DocumentDataSchema.parse({ title: 'Empty', sections: [] }),
    ).toThrow();
  });

  it('rejects a non-positive revision number', () => {
    expect(() =>
      DocumentDataSchema.parse({ ...MINIMAL, revision: 0 }),
    ).toThrow();
  });
});
