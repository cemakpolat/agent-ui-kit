import type { Meta, StoryObj } from '@storybook/react';
import { DocumentRenderer } from './DocumentRenderer';
import { DocumentDataSchema } from '@hari/core';

// ── Fixtures (parsed through schema to apply defaults) ────────────────────────

const SIMPLE_DOC = DocumentDataSchema.parse({
  title: 'SRE Post-Mortem: API Gateway Outage',
  sections: [
    {
      id: 's1', title: 'Summary', confidence: 0.95, collapsible: false, defaultCollapsed: false,
      blocks: [
        { type: 'paragraph', text: 'On 2024-01-15, the API Gateway experienced a 23-minute outage affecting 12% of production traffic.', confidence: 0.95 },
        { type: 'metric', label: 'Duration',         value: '23 min', trend: 'stable' },
        { type: 'metric', label: 'Traffic affected',  value: '12%',   trend: 'down'   },
        { type: 'metric', label: 'MTTR',              value: '23 min', trend: 'stable' },
      ],
    },
    {
      id: 's2', title: 'Root Cause', confidence: 0.88, collapsible: true, defaultCollapsed: false,
      blocks: [
        { type: 'paragraph', text: 'A misconfigured TLS certificate rotation triggered connection timeouts.', confidence: 0.88 },
        { type: 'code', language: 'bash', code: '# certbot renew --force-renewal --cert-name api.example.com\n# Error: DNS challenge timeout after 120s' },
      ],
    },
    {
      id: 's3', title: 'Action Items', confidence: 0.92, collapsible: true, defaultCollapsed: false,
      blocks: [{ type: 'list', items: ['Automate certificate rotation with 30-day lead time', 'Add TLS health check to pre-deployment checklist'], ordered: false }],
    },
  ],
});

const DOC_WITH_TABLE = DocumentDataSchema.parse({
  title: 'Product Performance Analysis',
  sections: [
    {
      id: 's1', title: 'Metrics Overview', confidence: 0.91, collapsible: false, defaultCollapsed: false,
      blocks: [
        {
          type: 'table',
          headers: [
            { key: 'product', label: 'Product', align: 'left' },
            { key: 'revenue', label: 'Revenue', align: 'right' },
            { key: 'growth',  label: 'Growth',  align: 'right' },
            { key: 'margin',  label: 'Margin',  align: 'right' },
          ],
          rows: [
            { product: 'Widget Pro',  revenue: '$1.2M', growth: '+18%', margin: '42%' },
            { product: 'Widget Lite', revenue: '$640K', growth: '+7%',  margin: '31%' },
            { product: 'Widget Max',  revenue: '$890K', growth: '+24%', margin: '47%' },
          ],
          caption: 'Click column headers to sort.',
        },
        { type: 'callout', variant: 'insight', title: 'Key Finding', text: 'Widget Max shows the highest growth and margin.' },
      ],
    },
  ],
});

// ── Meta ──────────────────────────────────────────────────────────────────────

const meta: Meta<typeof DocumentRenderer> = {
  title: 'Renderers/DocumentRenderer',
  component: DocumentRenderer,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Renders the "document" intent type with rich structured content: ' +
          'headings, paragraphs, code, tables, callouts, metrics, and more.',
      },
    },
  },
};
export default meta;

type Story = StoryObj<typeof DocumentRenderer>;

export const SREPostMortem: Story = {
  args: {
    data: SIMPLE_DOC,
    showConfidence: true,
    density: 'operator',
  },
};

export const WithTable: Story = {
  args: {
    data: DOC_WITH_TABLE,
    showConfidence: true,
    density: 'operator',
  },
};

export const ExecutiveDensity: Story = {
  args: {
    data: SIMPLE_DOC,
    showConfidence: false,
    density: 'executive',
  },
};


export const WithSearch: Story = {
  args: {
    data: SIMPLE_DOC,
    showConfidence: true,
    density: 'operator',
    showSearch: true,
  },
};

export const WithPDFAndExcel: Story = {
  args: {
    data: DocumentDataSchema.parse({
      title: 'Report with Media & Data',
      sections: [
        {
          id: 's1',
          title: 'document Overview',
          collapsible: false,
          defaultCollapsed: false,
          blocks: [
            { type: 'paragraph', text: 'This document includes a PDF report and an Excel spreadsheet for detailed analysis.' },
            {
              type: 'pdf',
              url: 'https://www.w3.org/WAI/WCAG21/Techniques/pdf/img/table.pdf',
              title: 'Sample Annual Report (PDF)',
              height: '600px',
              showControls: true,
              downloadable: true,
            },
          ],
        },
        {
          id: 's2',
          title: 'Sales Data',
          collapsible: false,
          defaultCollapsed: false,
          blocks: [
            { type: 'paragraph', text: 'Interactive spreadsheet with filtering and sorting capabilities.' },
            {
              type: 'excel',
              csvData: `Product,Q1,Q2,Q3,Q4,Total
Widget Pro,120000,135000,142000,158000,555000
Widget Lite,65000,70000,72000,80000,287000
Widget Max,89000,102000,115000,132000,438000
Widget Enterprise,45000,52000,61000,75000,233000`,
              title: 'Sales by Quarter',
              height: '400px',
              showControls: true,
              downloadable: false,
            },
          ],
        },
      ],
    }),
    showConfidence: true,
    density: 'operator',
  },
};
