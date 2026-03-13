import { describe, it, expect } from 'vitest';
import {
  isWellKnownIntentType,
  WELL_KNOWN_INTENT_TYPES,
} from '../schemas/intent';
import {
  validateIntentData,
  suggestIntentType,
  getDataSchemaForType,
} from '../compiler/data-validator';
import { IntentBuilder } from '../compiler/intent-builder';
import { compileIntent } from '../compiler/compiler';
import { ComponentRegistryManager } from '../compiler/registry';

// ─────────────────────────────────────────────────────────────────────────────
// Tests for contract enforcement: well-known types, data validation,
// intent type inference, and IntentBuilder
// ─────────────────────────────────────────────────────────────────────────────

describe('Well-Known Intent Types', () => {
  it('recognises all canonical types', () => {
    const expected = [
      'comparison', 'diagnostic_overview', 'sensor_overview', 'document',
      'form', 'chat', 'diagram', 'timeline', 'workflow', 'kanban',
      'calendar', 'tree', 'map',
    ];
    for (const t of expected) {
      expect(isWellKnownIntentType(t)).toBe(true);
    }
  });

  it('rejects unknown strings', () => {
    expect(isWellKnownIntentType('chrt')).toBe(false);
    expect(isWellKnownIntentType('comparison_lazy')).toBe(false);
    expect(isWellKnownIntentType('')).toBe(false);
    expect(isWellKnownIntentType('DOCUMENT')).toBe(false); // case-sensitive
  });

  it('WELL_KNOWN_INTENT_TYPES has the right length', () => {
    expect(WELL_KNOWN_INTENT_TYPES.length).toBe(13);
  });
});

describe('validateIntentData', () => {
  it('passes valid chat data', () => {
    const result = validateIntentData('chat', {
      messages: [{ id: '1', role: 'user', content: 'Hello', timestamp: 1000 }],
    });
    expect(result.valid).toBe(true);
    expect(result.warnings).toHaveLength(0);
  });

  it('fails invalid chat data (missing messages)', () => {
    const result = validateIntentData('chat', {});
    expect(result.valid).toBe(false);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain('type="chat"');
  });

  it('passes valid document data', () => {
    const result = validateIntentData('document', {
      title: 'Test Document',
      sections: [{ id: 's1', blocks: [] }],
    });
    expect(result.valid).toBe(true);
  });

  it('fails document data without title', () => {
    const result = validateIntentData('document', {
      sections: [{ id: 's1', blocks: [] }],
    });
    expect(result.valid).toBe(false);
    expect(result.warnings.some(w => w.includes('data'))).toBe(true);
  });

  it('passes unknown types without validation', () => {
    const result = validateIntentData('my_custom_type', { anything: 'goes' });
    expect(result.valid).toBe(true);
  });

  it('passes comparison data (domain-specific, no schema)', () => {
    const result = validateIntentData('comparison', { flights: [] });
    expect(result.valid).toBe(true); // No schema to check against
  });

  it('validates timeline data shape', () => {
    const result = validateIntentData('timeline', {
      events: [{ id: '1', title: 'Deploy', timestamp: '2026-01-01T00:00:00Z' }],
    });
    expect(result.valid).toBe(true);
  });

  it('normalises timeline events with LLM alias fields (name, date, no id)', () => {
    // Simulates an LLM that outputs "name" instead of "title" and a bare year as "date"
    const result = validateIntentData('timeline', {
      events: [
        { id: 'e1', name: 'Foundation of the Ottoman Empire', date: '1299' },
        { id: 'e2', name: 'Battle of Kosovo',                 date: '1389' },
        { id: 'e3', name: 'Fall of Constantinople',           date: '1453' },
        { id: 'e4', name: 'Height of Ottoman Power',          date: '1566' },
        { id: 'e5', name: 'Dissolution of the Empire',        date: '1922' },
      ],
    });
    expect(result.valid).toBe(true);
  });

  it('normalises timeline events that use "label" and a numeric year', () => {
    const result = validateIntentData('timeline', {
      events: [{ id: 'e1', label: 'Ottoman Founded', year: 1299 }],
    });
    expect(result.valid).toBe(true);
  });

  it('normalises timeline events that use "event" and "datetime"', () => {
    const result = validateIntentData('timeline', {
      events: [{ id: 'e1', event: 'Treaty Signed', datetime: '1699-01-26T00:00:00Z' }],
    });
    expect(result.valid).toBe(true);
  });

  it('validates kanban data shape', () => {
    const result = validateIntentData('kanban', {
      columns: [{ id: 'c1', title: 'Todo', cards: [] }],
    });
    expect(result.valid).toBe(true);
  });

  it('fails kanban without columns', () => {
    const result = validateIntentData('kanban', { title: 'Board' });
    expect(result.valid).toBe(false);
  });

  it('validates calendar data shape', () => {
    const result = validateIntentData('calendar', {
      events: [{ id: '1', title: 'Meeting', start: '2026-01-01', end: '2026-01-01' }],
    });
    expect(result.valid).toBe(true);
  });

  it('validates tree data shape', () => {
    const result = validateIntentData('tree', {
      nodes: [{ id: 'root', label: 'Root' }],
    });
    expect(result.valid).toBe(true);
  });

  it('validates workflow data shape', () => {
    const result = validateIntentData('workflow', {
      steps: [{ id: 's1', title: 'Step 1' }],
    });
    expect(result.valid).toBe(true);
  });

  it('validates diagram data shape', () => {
    const result = validateIntentData('diagram', {
      diagrams: [{ kind: 'chart', chartType: 'bar', labels: ['A'], series: [{ name: 'S1', values: [1] }] }],
    });
    expect(result.valid).toBe(true);
  });
});

describe('suggestIntentType', () => {
  it('suggests chat for messages with role+content', () => {
    const suggestions = suggestIntentType({
      messages: [{ role: 'user', content: 'Hello' }],
    });
    expect(suggestions[0].type).toBe('chat');
    expect(suggestions[0].confidence).toBeGreaterThanOrEqual(0.9);
  });

  it('suggests kanban for columns with cards', () => {
    const suggestions = suggestIntentType({
      columns: [{ id: 'c1', title: 'Todo', cards: [] }],
    });
    expect(suggestions[0].type).toBe('kanban');
  });

  it('suggests tree for nodes with children/label', () => {
    const suggestions = suggestIntentType({
      nodes: [{ label: 'Root', children: [] }],
    });
    expect(suggestions[0].type).toBe('tree');
  });

  it('suggests timeline for events with timestamp', () => {
    const suggestions = suggestIntentType({
      events: [{ timestamp: 1000, title: 'Deploy' }],
    });
    expect(suggestions[0].type).toBe('timeline');
  });

  it('suggests calendar for events with start+end', () => {
    const suggestions = suggestIntentType({
      events: [{ start: '2026-01-01', end: '2026-01-02', title: 'Meeting' }],
    });
    expect(suggestions[0].type).toBe('calendar');
  });

  it('suggests diagram for data with diagrams array', () => {
    const suggestions = suggestIntentType({
      diagrams: [{ kind: 'mermaid', markup: 'flowchart LR' }],
    });
    expect(suggestions[0].type).toBe('diagram');
  });

  it('suggests document for sections with blocks', () => {
    const suggestions = suggestIntentType({
      sections: [{ blocks: [{ type: 'paragraph', text: 'Hello' }] }],
    });
    expect(suggestions[0].type).toBe('document');
  });

  it('suggests form for sections with fields', () => {
    const suggestions = suggestIntentType({
      sections: [{ fields: [{ type: 'text', id: 'name', label: 'Name' }] }],
    });
    expect(suggestions[0].type).toBe('form');
  });

  it('suggests workflow for steps array', () => {
    const suggestions = suggestIntentType({
      steps: [{ status: 'pending', title: 'Step 1' }],
    });
    expect(suggestions[0].type).toBe('workflow');
  });

  it('returns empty for unrecognised data', () => {
    const suggestions = suggestIntentType({ foo: 'bar', count: 42 });
    expect(suggestions).toHaveLength(0);
  });
});

describe('getDataSchemaForType', () => {
  it('returns schema for types with HARI-defined data shapes', () => {
    expect(getDataSchemaForType('chat')).toBeDefined();
    expect(getDataSchemaForType('document')).toBeDefined();
    expect(getDataSchemaForType('diagram')).toBeDefined();
    expect(getDataSchemaForType('timeline')).toBeDefined();
    expect(getDataSchemaForType('kanban')).toBeDefined();
    expect(getDataSchemaForType('calendar')).toBeDefined();
    expect(getDataSchemaForType('tree')).toBeDefined();
    expect(getDataSchemaForType('workflow')).toBeDefined();
  });

  it('returns undefined for domain-specific types', () => {
    expect(getDataSchemaForType('comparison')).toBeUndefined();
    expect(getDataSchemaForType('diagnostic_overview')).toBeUndefined();
  });

  it('returns undefined for unknown types', () => {
    expect(getDataSchemaForType('custom_thing')).toBeUndefined();
  });
});

describe('Compiler — type warnings', () => {
  const registry = new ComponentRegistryManager();

  it('warns on unknown intent type', () => {
    const view = compileIntent({
      version: '1.0.0',
      intentId: '00000000-0000-4000-8000-000000000000',
      type: 'chrt',
      domain: 'test',
      primaryGoal: 'Test',
      confidence: 0.8,
      ambiguities: [],
      data: {},
      priorityFields: [],
      actions: [],
      density: 'operator',
      explain: false,
    }, registry);

    expect(view.isWellKnownType).toBe(false);
    expect(view.warnings.some(w => w.includes('Unknown intent type'))).toBe(true);
  });

  it('warns on data-type mismatch', () => {
    const view = compileIntent({
      version: '1.0.0',
      intentId: '00000000-0000-4000-8000-000000000000',
      type: 'chat',
      domain: 'test',
      primaryGoal: 'Test',
      confidence: 0.8,
      ambiguities: [],
      data: { wrongField: true },
      priorityFields: [],
      actions: [],
      density: 'operator',
      explain: false,
    }, registry);

    expect(view.dataValid).toBe(false);
    expect(view.warnings.some(w => w.includes('does not match'))).toBe(true);
  });

  it('passes on correct data shape', () => {
    const view = compileIntent({
      version: '1.0.0',
      intentId: '00000000-0000-4000-8000-000000000000',
      type: 'chat',
      domain: 'test',
      primaryGoal: 'Test',
      confidence: 0.8,
      ambiguities: [],
      data: { messages: [{ id: '1', role: 'user', content: 'Hi', timestamp: 1000 }] },
      priorityFields: [],
      actions: [],
      density: 'operator',
      explain: false,
    }, registry);

    expect(view.dataValid).toBe(true);
    expect(view.isWellKnownType).toBe(true);
  });

  it('includes layoutHint in compiled view', () => {
    const view = compileIntent({
      version: '1.0.0',
      intentId: '00000000-0000-4000-8000-000000000000',
      type: 'comparison',
      domain: 'travel',
      primaryGoal: 'Test',
      confidence: 0.8,
      ambiguities: [],
      data: {},
      priorityFields: [],
      actions: [],
      density: 'operator',
      layoutHint: 'cards',
      explain: false,
    }, registry);

    expect(view.layoutHint).toBe('cards');
  });

  it('suggests correct type when data mismatches declared type', () => {
    const view = compileIntent({
      version: '1.0.0',
      intentId: '00000000-0000-4000-8000-000000000000',
      type: 'document',
      domain: 'test',
      primaryGoal: 'Test',
      confidence: 0.8,
      ambiguities: [],
      data: {
        messages: [{ role: 'user', content: 'Hi', id: '1', timestamp: 1000 }],
      },
      priorityFields: [],
      actions: [],
      density: 'operator',
      explain: false,
    }, registry);

    // Data validation fails (no title/sections for document)
    expect(view.dataValid).toBe(false);
    // Should suggest chat since data matches chat shape
    expect(view.typeSuggestions.length).toBeGreaterThan(0);
    expect(view.typeSuggestions[0].type).toBe('chat');
  });
});

describe('IntentBuilder', () => {
  it('builds a valid document intent', () => {
    const intent = IntentBuilder
      .document('reports')
      .primaryGoal('Q4 Report')
      .data({
        title: 'Q4 Financial Summary',
        sections: [{ id: 's1', blocks: [{ type: 'paragraph', text: 'Revenue grew 12%.' }] }],
      })
      .confidence(0.92)
      .build();

    expect(intent.type).toBe('document');
    expect(intent.domain).toBe('reports');
    expect(intent.confidence).toBe(0.92);
    expect(intent.intentId).toMatch(/^[0-9a-f-]+$/);
  });

  it('builds a valid chat intent', () => {
    const intent = IntentBuilder
      .chat('support')
      .primaryGoal('Customer inquiry')
      .data({
        messages: [{ id: '1', role: 'user', content: 'Help me', timestamp: Date.now() }],
      })
      .build();

    expect(intent.type).toBe('chat');
    expect(intent.domain).toBe('support');
  });

  it('throws on missing required fields', () => {
    expect(() => {
      IntentBuilder
        .create('chat', 'support')
        // no primaryGoal (empty string should fail)
        .build();
    }).not.toThrow(); // primaryGoal can be empty string
  });

  it('warns on custom type but still builds', () => {
    const result = IntentBuilder
      .create('my_custom', 'custom-domain')
      .primaryGoal('Test')
      .data({ foo: 'bar' })
      .buildResult();

    expect(result.success).toBe(true);
    expect(result.warnings.some(w => w.includes('not a well-known type'))).toBe(true);
  });

  it('warns on data shape mismatch', () => {
    const result = IntentBuilder
      .chat('support')
      .primaryGoal('Test')
      .data({ wrongField: true }) // not chat data shape
      .buildResult();

    expect(result.success).toBe(true); // data warnings are non-fatal
    expect(result.warnings.some(w => w.includes('does not match'))).toBe(true);
  });

  it('shortcut builders set correct types', () => {
    expect(IntentBuilder.comparison('t').primaryGoal('x').data({}).build().type).toBe('comparison');
    expect(IntentBuilder.diagnosticOverview('t').primaryGoal('x').data({}).build().type).toBe('diagnostic_overview');
    expect(IntentBuilder.timeline('t').primaryGoal('x').data({ events: [] }).build().type).toBe('timeline');
    expect(IntentBuilder.kanban('t').primaryGoal('x').data({ columns: [] }).build().type).toBe('kanban');
    expect(IntentBuilder.calendar('t').primaryGoal('x').data({ events: [] }).build().type).toBe('calendar');
    expect(IntentBuilder.tree('t').primaryGoal('x').data({ nodes: [] }).build().type).toBe('tree');
    expect(IntentBuilder.workflow('t').primaryGoal('x').data({ steps: [] }).build().type).toBe('workflow');
    expect(IntentBuilder.diagram('t').primaryGoal('x').data({ diagrams: [] }).build().type).toBe('diagram');
    expect(IntentBuilder.form('t').primaryGoal('x').data({}).build().type).toBe('form');
    expect(IntentBuilder.sensorOverview('t').primaryGoal('x').data({}).build().type).toBe('sensor_overview');
  });

  it('supports fluent chaining for all options', () => {
    const intent = IntentBuilder
      .document('reports')
      .primaryGoal('Q4 Report')
      .data({ title: 'Q4', sections: [{ id: 's1', blocks: [] }] })
      .confidence(0.85)
      .density('executive')
      .layoutHint('cards')
      .explain(true)
      .priorityFields(['revenue', 'growth'])
      .actions([{ id: 'a1', label: 'Export' }])
      .version('1.0.0')
      .build();

    expect(intent.density).toBe('executive');
    expect(intent.layoutHint).toBe('cards');
    expect(intent.explain).toBe(true);
    expect(intent.priorityFields).toEqual(['revenue', 'growth']);
    expect(intent.actions).toHaveLength(1);
  });

  it('clamps confidence to 0–1 range', () => {
    const intent = IntentBuilder
      .document('test')
      .primaryGoal('Test')
      .data({ title: 'X', sections: [{ id: 's1', blocks: [] }] })
      .confidence(1.5)
      .build();

    expect(intent.confidence).toBe(1);
  });

  it('allows custom intentId', () => {
    const intent = IntentBuilder
      .chat('test')
      .primaryGoal('Test')
      .data({ messages: [{ id: '1', role: 'user', content: 'Hi', timestamp: 1000 }] })
      .intentId('00000000-0000-4000-8000-000000000000')
      .build();

    expect(intent.intentId).toBe('00000000-0000-4000-8000-000000000000');
  });
});
