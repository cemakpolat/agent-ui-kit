import { describe, it, expect, beforeEach } from 'vitest';
import { useIntentStore } from '../store/intent';
import type { IntentPayload } from '../schemas/intent';

// ─────────────────────────────────────────────────────────────────────────────
// Hypothetical Branch — unit tests
// ─────────────────────────────────────────────────────────────────────────────

function makeIntent(overrides: Partial<IntentPayload> = {}): IntentPayload {
  return {
    version: '1.0.0',
    intentId: '00000000-0000-0000-0000-000000000001',
    type: 'comparison',
    domain: 'travel',
    primaryGoal: 'Choose a flight',
    confidence: 0.9,
    density: 'operator',
    ambiguities: [],
    data: { price: 100, origin: 'LHR' },
    priorityFields: [],
    actions: [],
    explain: false,
    ...overrides,
  };
}

describe('IntentStore — hypothetical branch', () => {
  beforeEach(() => {
    // Reset store to pristine state
    useIntentStore.setState({
      currentIntent: null,
      intentHistory: [],
      pendingModifications: [],
      hypotheticalIntent: null,
      hypotheticalDiff: {},
    });
  });

  it('initialises with no hypothetical branch', () => {
    const { hypotheticalIntent, hypotheticalDiff } = useIntentStore.getState();
    expect(hypotheticalIntent).toBeNull();
    expect(hypotheticalDiff).toEqual({});
  });

  it('branchHypothetical() deep-copies currentIntent', () => {
    const intent = makeIntent();
    useIntentStore.getState().setIntent(intent);
    useIntentStore.getState().branchHypothetical();

    const { hypotheticalIntent, currentIntent } = useIntentStore.getState();
    expect(hypotheticalIntent).not.toBeNull();
    expect(hypotheticalIntent).not.toBe(currentIntent); // different reference
    expect(hypotheticalIntent?.intentId).toBe(intent.intentId);
    expect(hypotheticalIntent?.data).toEqual(intent.data);
  });

  it('branchHypothetical() does nothing when there is no current intent', () => {
    useIntentStore.getState().branchHypothetical();
    expect(useIntentStore.getState().hypotheticalIntent).toBeNull();
  });

  it('modifyHypotheticalParameter() mutates only the hypothetical branch', () => {
    const intent = makeIntent({ data: { price: 100, origin: 'LHR' } });
    useIntentStore.getState().setIntent(intent);
    useIntentStore.getState().branchHypothetical();
    useIntentStore.getState().modifyHypotheticalParameter('price', 200);

    const { currentIntent, hypotheticalIntent, hypotheticalDiff } = useIntentStore.getState();
    expect((currentIntent!.data as Record<string, unknown>)['price']).toBe(100); // unchanged
    expect((hypotheticalIntent!.data as Record<string, unknown>)['price']).toBe(200); // mutated
    expect(hypotheticalDiff['price']).toEqual({ was: 100, becomes: 200 });
  });

  it('modifyHypotheticalParameter() accumulates diffs for multiple keys', () => {
    const intent = makeIntent({ data: { price: 100, origin: 'LHR' } });
    useIntentStore.getState().setIntent(intent);
    useIntentStore.getState().branchHypothetical();
    useIntentStore.getState().modifyHypotheticalParameter('price', 200);
    useIntentStore.getState().modifyHypotheticalParameter('origin', 'CDG');

    const { hypotheticalDiff } = useIntentStore.getState();
    expect(Object.keys(hypotheticalDiff)).toHaveLength(2);
    expect(hypotheticalDiff['origin']).toEqual({ was: 'LHR', becomes: 'CDG' });
  });

  it('rollbackHypothetical() discards the branch without touching currentIntent', () => {
    const intent = makeIntent();
    useIntentStore.getState().setIntent(intent);
    useIntentStore.getState().branchHypothetical();
    useIntentStore.getState().modifyHypotheticalParameter('price', 999);
    useIntentStore.getState().rollbackHypothetical();

    const { currentIntent, hypotheticalIntent, hypotheticalDiff } = useIntentStore.getState();
    expect(hypotheticalIntent).toBeNull();
    expect(hypotheticalDiff).toEqual({});
    expect((currentIntent!.data as Record<string, unknown>)['price']).toBe(100);
  });

  it('commitHypothetical() promotes the branch to currentIntent and pushes old to history', () => {
    const intent = makeIntent();
    useIntentStore.getState().setIntent(intent);
    useIntentStore.getState().branchHypothetical();
    useIntentStore.getState().modifyHypotheticalParameter('price', 250);
    useIntentStore.getState().commitHypothetical();

    const { currentIntent, hypotheticalIntent, intentHistory } = useIntentStore.getState();
    expect(hypotheticalIntent).toBeNull();
    expect((currentIntent!.data as Record<string, unknown>)['price']).toBe(250);
    // original intent moved to history
    expect(intentHistory).toHaveLength(1);
    expect((intentHistory[0].data as Record<string, unknown>)['price']).toBe(100);
  });

  it('commitHypothetical() clears pending modifications', () => {
    const intent = makeIntent();
    useIntentStore.getState().setIntent(intent);
    useIntentStore.getState().modifyParameter('someKey', 'staged');
    useIntentStore.getState().branchHypothetical();
    useIntentStore.getState().commitHypothetical();

    expect(useIntentStore.getState().pendingModifications).toHaveLength(0);
  });

  it('commitHypothetical() is a no-op when there is no branch', () => {
    const intent = makeIntent();
    useIntentStore.getState().setIntent(intent);
    useIntentStore.getState().commitHypothetical(); // nothing to commit

    const { currentIntent, intentHistory } = useIntentStore.getState();
    expect((currentIntent!.data as Record<string, unknown>)['price']).toBe(100);
    expect(intentHistory).toHaveLength(0);
  });

  it('setIntent() clears any active hypothetical branch', () => {
    const intent = makeIntent();
    useIntentStore.getState().setIntent(intent);
    useIntentStore.getState().branchHypothetical();
    useIntentStore.getState().modifyHypotheticalParameter('price', 999);

    const newIntent = makeIntent({ intentId: '00000000-0000-0000-0000-000000000002' });
    useIntentStore.getState().setIntent(newIntent);

    const { hypotheticalIntent, hypotheticalDiff } = useIntentStore.getState();
    expect(hypotheticalIntent).toBeNull();
    expect(hypotheticalDiff).toEqual({});
  });
});
