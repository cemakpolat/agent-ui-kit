import type { Meta, StoryObj } from '@storybook/react';
import React, { useState } from 'react';
import { FormRenderer } from './FormRenderer';
import { FormSectionSchema } from '@hari/core';

// ── Fixtures (parsed through schema to apply defaults) ─────────────────────────

const DEPLOY_FORM_SECTIONS = [
  FormSectionSchema.parse({
    id: 'env-section',
    title: 'Deployment Target',
    description: 'Choose where to deploy this build.',
    fields: [
      {
        id: 'environment',
        type: 'select',
        label: 'Environment',
        required: true,
        options: [
          { value: 'staging', label: 'Staging' },
          { value: 'production', label: 'Production' },
          { value: 'canary', label: 'Canary (10%)' },
        ],
        defaultValue: 'staging',
        placeholder: 'Select environment',
      },
      {
        id: 'region',
        type: 'select',
        label: 'Region',
        required: true,
        options: [
          { value: 'us-east-1', label: 'US East (N. Virginia)' },
          { value: 'eu-west-1', label: 'Europe (Ireland)' },
          { value: 'ap-southeast-1', label: 'Asia Pacific (Singapore)' },
        ],
        defaultValue: 'us-east-1',
        placeholder: 'Select region',
      },
    ],
  }),
  FormSectionSchema.parse({
    id: 'config-section',
    title: 'Configuration',
    description: 'Set deployment parameters.',
    fields: [
      {
        id: 'replicas',
        type: 'number',
        label: 'Replica Count',
        required: true,
        min: 1,
        max: 10,
        step: 1,
        defaultValue: 2,
        helpText: 'Number of pod replicas to run.',
      },
      {
        id: 'dry_run',
        type: 'checkbox',
        label: 'Dry Run',
        helpText: 'Simulate deployment without making changes.',
        defaultValue: false,
      },
      {
        id: 'release_notes',
        type: 'text',
        label: 'Release Notes',
        required: false,
        placeholder: 'Describe this deployment…',
        multiline: true,
        rows: 3,
      },
    ],
  }),
];

const CONTACT_FORM_SECTIONS = [
  FormSectionSchema.parse({
    id: 'contact',
    title: 'Contact Details',
    fields: [
      {
        id: 'name',
        type: 'text',
        label: 'Full Name',
        required: true,
        placeholder: 'Jane Smith',
      },
      {
        id: 'email',
        type: 'text',
        label: 'Email Address',
        required: true,
        placeholder: 'jane@example.com',
        validation: [{ type: 'email', message: 'Please enter a valid email address' }],
      },
      {
        id: 'message',
        type: 'text',
        label: 'Message',
        required: true,
        multiline: true,
        rows: 4,
      },
    ],
  }),
];

// ── Meta ──────────────────────────────────────────────────────────────────────

const meta: Meta<typeof FormRenderer> = {
  title: 'Renderers/FormRenderer',
  component: FormRenderer,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Renders the "form" intent type with 9 field types, conditional visibility, ' +
          'real-time validation, auto-save, and multi-step wizard support.',
      },
    },
  },
};
export default meta;

type Story = StoryObj<typeof FormRenderer>;

export const DeploymentConfig: Story = {
  args: {
    formId: 'deploy-form',
    sections: DEPLOY_FORM_SECTIONS,
    showSubmitButton: true,
    submitButtonLabel: 'Deploy',
    onSubmit: (values: Record<string, unknown>) => console.log('Submitted:', values),
  },
};

export const ContactForm: Story = {
  args: {
    formId: 'contact-form',
    sections: CONTACT_FORM_SECTIONS,
    showSubmitButton: true,
    submitButtonLabel: 'Send Message',
  },
};

export const Submitting: Story = {
  args: {
    formId: 'deploy-form-loading',
    sections: DEPLOY_FORM_SECTIONS,
    showSubmitButton: true,
    submitButtonLabel: 'Deploying…',
    isSubmitting: true,
  },
};

export const WithServerError: Story = {
  args: {
    formId: 'deploy-form-error',
    sections: DEPLOY_FORM_SECTIONS,
    showSubmitButton: true,
    serverErrors: {
      globalError: 'Deployment failed: insufficient permissions for production environment.',
      fieldErrors: { environment: 'You do not have access to Production.' },
    },
  },
};

export const InteractiveWithLog: Story = {
  render: () => {
    const [log, setLog] = useState<string[]>([]);
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', maxWidth: '900px' }}>
        <FormRenderer
          formId="interactive-form"
          sections={CONTACT_FORM_SECTIONS}
          showSubmitButton
          onSubmit={(values: Record<string, unknown>) =>
            setLog((prev) => [`Submitted: ${JSON.stringify(values)}`, ...prev])
          }
          onChange={(values: Record<string, unknown>) =>
            setLog((prev) => [`Changed: ${JSON.stringify(values)}`, ...prev.slice(0, 9)])
          }
        />
        <div>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '0.5rem' }}>
            Event Log
          </div>
          <div style={{ fontFamily: 'monospace', fontSize: '0.7rem', color: '#475569', lineHeight: 1.6 }}>
            {log.length === 0 ? (
              <span style={{ color: '#94a3b8' }}>Interact with the form…</span>
            ) : (
              log.map((e, i) => <div key={i}>{e}</div>)
            )}
          </div>
        </div>
      </div>
    );
  },
};
