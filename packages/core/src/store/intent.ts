import { create } from 'zustand';
import { produce } from 'immer';
import type { IntentPayload } from '../schemas/intent';
import type { IntentModification } from '../schemas/intent';
import type { AmbiguityControl } from '../schemas/ambiguity';

// ─────────────────────────────────────────────────────────────────────────────
// Intent Store  (Store B in the architecture doc)
//
// Owns the current IntentPayload from the agent plus any pending modifications
// the user has made via ambiguity controls.  Modifications are committed as
// patches and sent back to the agent.
//
// History is capped at 20 entries to prevent unbounded memory growth.
// ─────────────────────────────────────────────────────────────────────────────

const MAX_HISTORY = 20;

export interface PendingModification {
  intentId: string;
  modifications: Record<string, unknown>;
  timestamp: number;
}

export interface IntentState {
  currentIntent: IntentPayload | null;
  intentHistory: IntentPayload[];
  pendingModifications: PendingModification[];
}

export interface IntentActions {
  /** Replace the current intent (old one moves to history) */
  setIntent: (intent: IntentPayload) => void;
  /** Stage a generic key-value modification */
  modifyParameter: (key: string, value: unknown) => void;
  /** Update an ambiguity control's value in the current intent */
  modifyAmbiguity: (controlId: string, value: AmbiguityControl['value']) => void;
  /**
   * Return the current staged modifications as a patch.
   * Returns null if there is no current intent or no modifications.
   */
  commitModifications: () => IntentModification | null;
  clearModifications: () => void;
  undo: () => void;
}

export type IntentStore = IntentState & IntentActions;

export const useIntentStore = create<IntentStore>()((set, get) => ({
  currentIntent: null,
  intentHistory: [],
  pendingModifications: [],

  setIntent: (intent) =>
    set(
      produce((state: IntentState) => {
        if (state.currentIntent) {
          state.intentHistory.unshift(state.currentIntent);
          if (state.intentHistory.length > MAX_HISTORY) {
            state.intentHistory.length = MAX_HISTORY;
          }
        }
        state.currentIntent = intent;
        state.pendingModifications = [];
      }),
    ),

  modifyParameter: (key, value) =>
    set(
      produce((state: IntentState) => {
        if (!state.currentIntent) return;
        const existing = state.pendingModifications.find(
          (m) => m.intentId === state.currentIntent!.intentId,
        );
        if (existing) {
          existing.modifications[key] = value;
          existing.timestamp = Date.now();
        } else {
          state.pendingModifications.push({
            intentId: state.currentIntent.intentId,
            modifications: { [key]: value },
            timestamp: Date.now(),
          });
        }
      }),
    ),

  modifyAmbiguity: (controlId, value) =>
    set(
      produce((state: IntentState) => {
        if (!state.currentIntent) return;
        const control = state.currentIntent.ambiguities.find((a) => a.id === controlId);
        if (control) {
          // Type-safe: value shape matches the discriminated union's value field
          (control as Record<string, unknown>)['value'] = value;
        }
      }),
    ),

  commitModifications: () => {
    const { pendingModifications, currentIntent } = get();
    if (!currentIntent) return null;
    const mod = pendingModifications.find((m) => m.intentId === currentIntent.intentId);
    if (!mod || Object.keys(mod.modifications).length === 0) return null;
    return {
      event: 'intent_modification' as const,
      originalIntentId: mod.intentId,
      modifications: { ...mod.modifications },
      timestamp: mod.timestamp,
    };
  },

  clearModifications: () =>
    set(
      produce((state: IntentState) => {
        state.pendingModifications = [];
      }),
    ),

  undo: () =>
    set(
      produce((state: IntentState) => {
        const prev = state.intentHistory.shift();
        if (prev) {
          state.currentIntent = prev;
          state.pendingModifications = [];
        }
      }),
    ),
}));
