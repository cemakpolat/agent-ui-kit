import type { Meta, StoryObj } from '@storybook/react';
import { DensitySelector } from './DensitySelector';

const meta: Meta<typeof DensitySelector> = {
  title: 'Primitives/DensitySelector',
  component: DensitySelector,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Lets the user override the agent-recommended density. ' +
          'Executive = summaries/KPIs; Operator = tables/workflows; Expert = raw data/diagnostics.',
      },
    },
    backgrounds: { default: 'dark' },
  },
};
export default meta;

type Story = StoryObj<typeof DensitySelector>;

export const AgentRecommendsOperator: Story = {
  args: { agentRecommended: 'operator' },
};

export const AgentRecommendsExecutive: Story = {
  args: { agentRecommended: 'executive' },
};

export const AgentRecommendsExpert: Story = {
  args: { agentRecommended: 'expert' },
};

export const NoRecommendation: Story = {
  args: {},
};
