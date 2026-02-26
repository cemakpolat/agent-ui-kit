/// <reference types="vitest/globals" />
/**
 * Tests for:
 *   1. Recharts DataVizBlock — all 6 chart types render correctly via Recharts
 *   2. FormRenderer rate limiting — blocks submit after maxAttempts
 *   3. i18n / RTL — locale prop translates strings and sets dir="rtl"
 */

import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { DocumentRenderer } from '../components/DocumentRenderer';
import { FormRenderer } from '../components/FormRenderer';
import type { FormSection } from '@hari/core';
import { FormRateLimitSchema } from '@hari/core';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeDoc(blocks: unknown[]) {
  return {
    title: 'Test',
    sections: [{ id: 's1', blocks }],
  };
}

const CHART_DATA = [
  { x: 'Jan', y: 10 },
  { x: 'Feb', y: 25 },
  { x: 'Mar', y: 18 },
];

const TEXT_SECTION: FormSection = {
  id: 'sec1',
  title: 'Basic',
  fields: [
    {
      id: 'name',
      type: 'text' as const,
      label: 'Name',
      required: true,
      disabled: false,
      placeholder: '',
      multiline: false,
    } as unknown as FormSection['fields'][number],
  ],
  collapsible: false,
  defaultCollapsed: false,
  columns: 1,
};

// ── 1. Recharts DataVizBlock ─────────────────────────────────────────────────

describe('Recharts DataVizBlock', () => {
  it.each(['bar', 'line', 'area', 'scatter'] as const)(
    'renders %s chart with SVG via Recharts',
    (chartType) => {
      const { container } = render(
        <DocumentRenderer
          data={makeDoc([{ type: 'dataviz', chartType, data: CHART_DATA }])}
        />,
      );
      expect(container.querySelector('svg')).not.toBeNull();
    },
  );

  it('renders pie chart with SVG via Recharts', () => {
    const { container } = render(
      <DocumentRenderer
        data={makeDoc([{
          type: 'dataviz',
          chartType: 'pie',
          title: 'Distribution',
          data: [
            { x: 'A', y: 40, label: 'Alpha' },
            { x: 'B', y: 35, label: 'Beta' },
            { x: 'C', y: 25, label: 'Gamma' },
          ],
        }])}
      />,
    );
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('renders sparkline as inline-flex divs (no Recharts)', () => {
    const { container } = render(
      <DocumentRenderer
        data={makeDoc([{
          type: 'dataviz',
          chartType: 'sparkline',
          data: [{ x: 1, y: 5 }, { x: 2, y: 8 }, { x: 3, y: 3 }],
        }])}
      />,
    );
    // SparklineChart still uses custom divs
    const sparklineWrapper = container.querySelector('[style*="inline-flex"]');
    expect(sparklineWrapper).not.toBeNull();
    expect(sparklineWrapper!.childElementCount).toBe(3);
  });

  it('shows optional chart title', () => {
    render(
      <DocumentRenderer
        data={makeDoc([{
          type: 'dataviz',
          chartType: 'bar',
          title: 'Revenue by Month',
          data: CHART_DATA,
        }])}
      />,
    );
    expect(screen.getByText('Revenue by Month')).toBeTruthy();
  });

  it('respects config.height via ResponsiveContainer', () => {
    const { container } = render(
      <DocumentRenderer
        data={makeDoc([{
          type: 'dataviz',
          chartType: 'line',
          data: CHART_DATA,
          config: { height: 350 },
        }])}
      />,
    );
    // ResponsiveContainer sets its wrapper div height
    const rcWrapper = container.querySelector('[style*="350"]');
    expect(rcWrapper).not.toBeNull();
  });
});

// ── 2. FormRateLimitSchema ────────────────────────────────────────────────────

describe('FormRateLimitSchema', () => {
  it('parses valid rate limit config', () => {
    const result = FormRateLimitSchema.parse({ maxAttempts: 3, windowMs: 60_000 });
    expect(result.maxAttempts).toBe(3);
    expect(result.windowMs).toBe(60_000);
  });

  it('rejects non-positive maxAttempts', () => {
    expect(() => FormRateLimitSchema.parse({ maxAttempts: 0, windowMs: 60_000 })).toThrow();
    expect(() => FormRateLimitSchema.parse({ maxAttempts: -1, windowMs: 60_000 })).toThrow();
  });

  it('rejects non-positive windowMs', () => {
    expect(() => FormRateLimitSchema.parse({ maxAttempts: 3, windowMs: 0 })).toThrow();
  });

  it('rejects non-integer maxAttempts', () => {
    expect(() => FormRateLimitSchema.parse({ maxAttempts: 1.5, windowMs: 1000 })).toThrow();
  });
});

describe('FormRenderer rate limiting', () => {
  const onSubmit = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    onSubmit.mockClear();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('allows submissions up to maxAttempts within window', async () => {
    render(
      <FormRenderer
        sections={[TEXT_SECTION]}
        onSubmit={onSubmit}
        rateLimit={{ maxAttempts: 3, windowMs: 60_000 }}
      />,
    );
    const nameInput = screen.getByLabelText('Name');
    fireEvent.change(nameInput, { target: { value: 'Alice' } });

    const submitBtn = screen.getByRole('button', { name: /submit/i });

    for (let i = 0; i < 3; i++) {
      fireEvent.click(submitBtn);
    }
    expect(onSubmit).toHaveBeenCalledTimes(3);
  });

  it('blocks submit and shows error after maxAttempts exceeded', async () => {
    render(
      <FormRenderer
        sections={[TEXT_SECTION]}
        onSubmit={onSubmit}
        rateLimit={{ maxAttempts: 2, windowMs: 60_000 }}
      />,
    );
    const nameInput = screen.getByLabelText('Name');
    fireEvent.change(nameInput, { target: { value: 'Bob' } });

    const submitBtn = screen.getByRole('button', { name: /submit/i });
    fireEvent.click(submitBtn); // attempt 1
    fireEvent.click(submitBtn); // attempt 2
    fireEvent.click(submitBtn); // attempt 3 — should be blocked

    expect(onSubmit).toHaveBeenCalledTimes(2);
    // Rate limit error message should appear
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByText(/too many attempts/i)).toBeTruthy();
  });

  it('resets after windowMs elapses', () => {
    render(
      <FormRenderer
        sections={[TEXT_SECTION]}
        onSubmit={onSubmit}
        rateLimit={{ maxAttempts: 1, windowMs: 5_000 }}
      />,
    );
    const nameInput = screen.getByLabelText('Name');
    fireEvent.change(nameInput, { target: { value: 'Carol' } });
    const submitBtn = screen.getByRole('button', { name: /submit/i });

    fireEvent.click(submitBtn); // attempt 1 — succeeds
    fireEvent.click(submitBtn); // attempt 2 — blocked

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/too many attempts/i)).toBeTruthy();

    // Advance past the window
    act(() => { vi.advanceTimersByTime(6_000); });

    // Now type something to re-trigger change handler
    fireEvent.change(nameInput, { target: { value: 'Carol2' } });
    fireEvent.click(submitBtn); // attempt 3 — should succeed now
    expect(onSubmit).toHaveBeenCalledTimes(2);
  });
});

// ── 3. i18n / RTL ────────────────────────────────────────────────────────────

describe('i18n — FormRenderer locale prop', () => {
  it('defaults to English (no locale prop)', () => {
    render(<FormRenderer sections={[TEXT_SECTION]} />);
    // Default English submit button — no locale prop → "Submit"
    expect(screen.getByRole('button', { name: /submit/i })).toBeTruthy();
  });

  it('translates submit area to French (no submit in French, button still present)', () => {
    // French locale — section expand/collapse uses French strings
    const collapsibleSection: FormSection = {
      ...TEXT_SECTION,
      collapsible: true,
    };
    render(<FormRenderer sections={[collapsibleSection]} locale="fr" />);
    // Collapse button should say "Réduire ▲" in French
    expect(screen.getByText('Réduire ▲')).toBeTruthy();
  });

  it('translates section expand/collapse to German', () => {
    const collapsibleSection: FormSection = {
      ...TEXT_SECTION,
      collapsible: true,
    };
    render(<FormRenderer sections={[collapsibleSection]} locale="de" />);
    expect(screen.getByText('Einklappen ▲')).toBeTruthy();
  });

  it('sets dir="rtl" for Arabic locale', () => {
    const { container } = render(<FormRenderer sections={[TEXT_SECTION]} locale="ar" />);
    const form = container.querySelector('form');
    expect(form?.getAttribute('dir')).toBe('rtl');
  });

  it('sets dir="rtl" for Hebrew locale', () => {
    const { container } = render(<FormRenderer sections={[TEXT_SECTION]} locale="he" />);
    const form = container.querySelector('form');
    expect(form?.getAttribute('dir')).toBe('rtl');
  });

  it('does not set dir for LTR locales', () => {
    const { container } = render(<FormRenderer sections={[TEXT_SECTION]} locale="fr" />);
    const form = container.querySelector('form');
    expect(form?.getAttribute('dir')).toBeNull();
  });

  it('shows Arabic rate limit error message', () => {
    render(
      <FormRenderer
        sections={[TEXT_SECTION]}
        onSubmit={vi.fn()}
        rateLimit={{ maxAttempts: 0, windowMs: 1 }}
        locale="ar"
      />,
    );
    const nameInput = screen.getByLabelText('Name');
    fireEvent.change(nameInput, { target: { value: 'Test' } });
    fireEvent.click(screen.getByRole('button'));
    // Arabic rate limit error message
    expect(screen.getByText(/محاولات كثيرة/)).toBeTruthy();
  });

  it('shows draft restore banner in French', () => {
    // Seed localStorage with a draft
    const draftKey = 'hari-form-draft-test-i18n-fr';
    localStorage.setItem(draftKey, JSON.stringify({ name: 'draft-value' }));
    render(
      <FormRenderer
        sections={[TEXT_SECTION]}
        formId="test-i18n-fr"
        autoSave
        locale="fr"
      />,
    );
    expect(screen.getByText(/brouillon/i)).toBeTruthy();
    expect(screen.getByText('Restaurer')).toBeTruthy();
    expect(screen.getByText('Ignorer')).toBeTruthy();
    localStorage.removeItem(draftKey);
  });
});

describe('i18n — DocumentRenderer locale prop', () => {
  it('translates export button to French', () => {
    const onExportMarkdown = vi.fn();
    render(
      <DocumentRenderer
        data={makeDoc([{ type: 'paragraph', text: 'Hello' }])}
        onExportMarkdown={onExportMarkdown}
        locale="fr"
      />,
    );
    expect(screen.getByText('↓ Exporter .md')).toBeTruthy();
  });

  it('translates print button to German', () => {
    render(
      <DocumentRenderer
        data={makeDoc([{ type: 'paragraph', text: 'Hello' }])}
        showPdfExport
        locale="de"
      />,
    );
    expect(screen.getByText('⎙ Drucken / PDF')).toBeTruthy();
  });

  it('sets dir="rtl" for Arabic locale', () => {
    const { container } = render(
      <DocumentRenderer
        data={makeDoc([{ type: 'paragraph', text: 'مرحبا' }])}
        locale="ar"
      />,
    );
    // The outer div should have dir="rtl"
    const rtlDiv = container.querySelector('[dir="rtl"]');
    expect(rtlDiv).not.toBeNull();
  });

  it('translates callout labels to Hebrew', () => {
    render(
      <DocumentRenderer
        data={makeDoc([{
          type: 'callout',
          variant: 'warning',
          text: 'Be careful',
        }])}
        locale="he"
      />,
    );
    // Hebrew warning label
    expect(screen.getByText('אזהרה')).toBeTruthy();
  });

  it('uses English by default (no locale prop)', () => {
    render(
      <DocumentRenderer
        data={makeDoc([{
          type: 'callout',
          variant: 'info',
          text: 'FYI',
        }])}
      />,
    );
    expect(screen.getByText('Note')).toBeTruthy();
  });
});
