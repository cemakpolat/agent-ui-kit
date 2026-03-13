/**
 * Ollama Interactive Demo
 *
 * This scenario demonstrates how the UI Kit generates dynamic user interfaces
 * based on LLM-driven intent modifications using Ollama.
 *
 * Features:
 * - Base form that collects project information
 * - Text input to request changes via Ollama
 * - Live UI updates as Ollama generates modifications
 * - Show the actual intent payload being modified
 */

import type { IntentPayloadInput } from '@hari/core';

export const ollamaInteractiveIntent: IntentPayloadInput = {
  version: '1.0.0',
  intentId: 'ollama-demo-001',
  type: 'form',
  domain: 'deployment',
  primaryGoal: 'Demonstrate dynamic UI generation powered by Ollama',
  confidence: 0.95,
  density: 'operator',
  data: {
    title: 'Project Configuration Form',
    description: 'This form is enhanced with Ollama-powered dynamic modifications. Ask the agent to modify it!',
    sections: [
      {
        id: 'project-basic',
        title: 'Project Details',
        collapsed: false,
        fields: [
          {
            id: 'projectName',
            type: 'text',
            label: 'Project Name',
            placeholder: 'e.g., My AI App',
            value: 'My New Project',
            required: true,
          },
          {
            id: 'description',
            type: 'textarea',
            label: 'Project Description',
            placeholder: 'What does your project do?',
            value: 'A dynamic UI application powered by LLM-driven modifications',
            required: false,
            rows: 4,
          },
          {
            id: 'team',
            type: 'text',
            label: 'Team Name',
            placeholder: 'e.g., Platform Team',
            value: 'AI Platform Team',
            required: true,
          },
        ],
      },
      {
        id: 'project-config',
        title: 'Configuration',
        collapsed: false,
        fields: [
          {
            id: 'budget',
            type: 'number',
            label: 'Budget (USD)',
            placeholder: '50000',
            value: 50000,
            required: true,
          },
          {
            id: 'timeline',
            type: 'text',
            label: 'Timeline',
            placeholder: 'e.g., Q1 2026',
            value: '3 months',
            required: true,
          },
          {
            id: 'targetModel',
            type: 'select',
            label: 'Target Model',
            value: 'llama3.2',
            required: true,
            options: [
              { label: 'Llama 3.2', value: 'llama3.2' },
              { label: 'Llama 2', value: 'llama2' },
              { label: 'Mistral', value: 'mistral' },
              { label: 'Neural Chat', value: 'neural-chat' },
            ],
          },
        ],
      },
      {
        id: 'project-request',
        title: 'Ask Ollama to Modify',
        collapsed: false,
        fields: [
          {
            id: 'ollamaQuery',
            type: 'textarea',
            label: 'Describe what you want to change',
            placeholder: 'e.g., "Increase budget to 100k and extend timeline to 6 months"',
            value: '',
            required: false,
            rows: 3,
            hint: 'Ask Ollama to modify any field above. The UI will update dynamically!',
          },
        ],
      },
    ],
    actions: [
      {
        id: 'submit',
        label: 'Submit Configuration',
        type: 'primary',
        description: 'Save the configuration to your project',
      },
      {
        id: 'ollama-suggest',
        label: '🧠 Ask Ollama',
        type: 'secondary',
        description: 'Generate modifications based on your query above',
      },
      {
        id: 'reset',
        label: 'Reset',
        type: 'tertiary',
        description: 'Clear all fields and start over',
      },
    ],
  },
};
