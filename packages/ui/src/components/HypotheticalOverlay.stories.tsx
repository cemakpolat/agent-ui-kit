import type { Meta, StoryObj } from '@storybook/react';
import { HypotheticalOverlay } from './HypotheticalOverlay';

const meta: Meta<typeof HypotheticalOverlay> = {
  title: 'Core/HypotheticalOverlay',
  component: HypotheticalOverlay,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Isolated "what-if" analysis panel. Runs agent reasoning in a separate context ' +
          'without mutating the committed intent state.',
      },
    },
  },
};
export default meta;

type Story = StoryObj<typeof HypotheticalOverlay>;

export const PriceIncrease: Story = {
  args: {
    query: 'What if prices increase by 10%?',
    onDismiss: () => {},
  },
};

export const CarbonOptimisation: Story = {
  args: {
    query: 'What if I optimise for carbon instead?',
    onDismiss: () => {},
  },
};

export const LaterDeparture: Story = {
  args: {
    query: 'What if I fly two days later?',
    onDismiss: () => {},
  },
};

export const CloudOpsLag: Story = {
  args: {
    query: 'What if no action is taken for 10 minutes?',
    onDismiss: () => {},
  },
};

export const CustomSimulation: Story = {
  args: {
    query: 'Custom scenario',
    onDismiss: () => {},
    onSimulate: async (query: string) => ({
      summary: `Custom simulation for: "${query}"`,
      deltas: [
        { field: 'Metric A', was: '100', becomes: '150', impact: 'positive' as const },
        { field: 'Metric B', was: '50',  becomes: '35',  impact: 'negative' as const },
      ],
      caveats: ['This is a custom simulation story'],
      confidence: 0.87,
    }),
  },
};
