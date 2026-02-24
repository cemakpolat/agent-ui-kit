import type { Meta, StoryObj } from '@storybook/react';
import React, { useEffect } from 'react';
import { HypotheticalCompare } from './HypotheticalCompare';
import { useIntentStore, ComponentRegistryManager } from '@hari/core';
import type { IntentPayload } from '@hari/core';

// ── Empty registry for stories ─────────────────────────────────────────────────
const emptyRegistry = new ComponentRegistryManager();

function makeIntent(): IntentPayload {
  return {
    version: '1.0.0',
    intentId: '00000000-0000-0000-0000-000000000001',
    type: 'comparison',
    domain: 'travel',
    primaryGoal: 'Choose a flight',
    confidence: 0.9,
    density: 'operator',
    ambiguities: [],
    data: { price: 100, origin: 'LHR', destination: 'JFK' },
    priorityFields: ['price'],
    actions: [],
    explain: false,
  };
}

// ── Decorator: seeds IntentStore with a branch ─────────────────────────────────
function WithBranch({ children, modKey, modValue }: {
  children: React.ReactNode;
  modKey?: string;
  modValue?: unknown;
}) {
  useEffect(() => {
    useIntentStore.setState({
      currentIntent: null,
      intentHistory: [],
      pendingModifications: [],
      hypotheticalIntent: null,
      hypotheticalDiff: {},
    });
    const store = useIntentStore.getState();
    store.setIntent(makeIntent());
    store.branchHypothetical();
    if (modKey !== undefined) {
      store.modifyHypotheticalParameter(modKey, modValue);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <>{children}</>;
}

// ── Meta ──────────────────────────────────────────────────────────────────────

const meta: Meta<typeof HypotheticalCompare> = {
  title: 'Core/HypotheticalCompare',
  component: HypotheticalCompare,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Side-by-side comparison of the committed intent and the isolated hypothetical branch. ' +
          'Provides Commit (apply branch) and Rollback (discard branch) controls.',
      },
    },
  },
};
export default meta;

type Story = StoryObj<typeof HypotheticalCompare>;

// ── Stories ───────────────────────────────────────────────────────────────────

export const NoBranchActive: Story = {
  render: () => (
    <div style={{ padding: '1rem' }}>
      <HypotheticalCompare registry={emptyRegistry} />
      <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginTop: '1rem' }}>
        (No branch active — component renders nothing)
      </p>
    </div>
  ),
};

export const BranchWithModification: Story = {
  render: () => (
    <WithBranch modKey="price" modValue={250}>
      <div style={{ padding: '1rem' }}>
        <HypotheticalCompare
          registry={emptyRegistry}
          onCommit={() => alert('Committed!')}
          onRollback={() => alert('Rolled back!')}
        />
      </div>
    </WithBranch>
  ),
};

export const BranchNoChanges: Story = {
  render: () => (
    <WithBranch>
      <div style={{ padding: '1rem' }}>
        <HypotheticalCompare registry={emptyRegistry} />
      </div>
    </WithBranch>
  ),
};
