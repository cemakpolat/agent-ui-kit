import type { Meta, StoryObj } from '@storybook/react';
import { ChatRenderer } from './ChatRenderer';
import { ChatDataSchema } from '@hari/core';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const now = Date.now();

const SUPPORT_CHAT = ChatDataSchema.parse({
  title: 'Support Chat',
  messages: [
    { id: 'm1', role: 'system', content: 'Support session started. You are connected to HARI AI Support.', timestamp: now - 300000 },
    { id: 'm2', role: 'agent', content: "Hello! I'm your AI support assistant. How can I help you today?", timestamp: now - 240000 },
    { id: 'm3', role: 'user', content: "I'm having trouble with my deployment pipeline. It keeps failing at the build step.", timestamp: now - 180000 },
    { id: 'm4', role: 'agent', content: "I can help with that. Could you share the error message you're seeing?", timestamp: now - 120000 },
    { id: 'm5', role: 'user', content: 'Error: ENOENT: no such file or directory, open ./dist/index.js', timestamp: now - 60000 },
    { id: 'm6', role: 'agent', content: "This error means the build step hasn't run before the deploy step. Check your pipeline order: build → test → deploy.", timestamp: now },
  ],
  allowAttachments: true,
});

// ── Meta ──────────────────────────────────────────────────────────────────────

const meta: Meta<typeof ChatRenderer> = {
  title: 'Renderers/ChatRenderer',
  component: ChatRenderer,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Renders the "chat" intent type with role-aware message bubbles, ' +
          'streaming support, attachments, and density-aware layouts.',
      },
    },
  },
};
export default meta;

type Story = StoryObj<typeof ChatRenderer>;

export const SupportConversation: Story = {
  args: {
    data: SUPPORT_CHAT,
    density: 'operator',
    onSendMessage: (m: string) => console.log('Send:', m),
  },
};

export const ExecutiveDensity: Story = {
  args: {
    data: SUPPORT_CHAT,
    density: 'executive',
  },
};

export const ExpertDensity: Story = {
  args: {
    data: SUPPORT_CHAT,
    density: 'expert',
  },
};
