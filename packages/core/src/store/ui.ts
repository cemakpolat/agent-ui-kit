import { create } from 'zustand';
import { produce } from 'immer';
import type { DensityMode } from '../schemas/intent';

// ─────────────────────────────────────────────────────────────────────────────
// UI Store  (Store A in the architecture doc)
//
// Owns all ephemeral UI state that does NOT need to be sent back to the agent:
//   - density override (user flips the density selector)
//   - which explain panels are open
//   - hypothetical / what-if overlay state
//   - pending action confirmations
//
// Immer + plain arrays/records (avoids Map/Set serialisation issues).
// ─────────────────────────────────────────────────────────────────────────────

export interface PendingConfirmation {
  actionId: string;
  label: string;
  blastRadiusSummary?: string;
}

export interface UIState {
  densityOverride: DensityMode | null;
  openExplainPanels: string[];
  hypotheticalMode: boolean;
  hypotheticalQuery: string | null;
  pendingConfirmations: PendingConfirmation[];
}

export interface UIActions {
  setDensityOverride: (density: DensityMode | null) => void;
  openExplainPanel: (elementId: string) => void;
  closeExplainPanel: (elementId: string) => void;
  toggleExplainPanel: (elementId: string) => void;
  setHypotheticalMode: (active: boolean, query?: string) => void;
  /** Register an action that needs user confirmation before executing */
  requestConfirmation: (
    actionId: string,
    label: string,
    blastRadiusSummary?: string,
  ) => void;
  resolveConfirmation: (actionId: string, confirmed: boolean, onConfirm: () => void) => void;
  dismissConfirmation: (actionId: string) => void;
}

export type UIStore = UIState & UIActions;

export const useUIStore = create<UIStore>()((set) => ({
  densityOverride: null,
  openExplainPanels: [],
  hypotheticalMode: false,
  hypotheticalQuery: null,
  pendingConfirmations: [],

  setDensityOverride: (density) =>
    set(
      produce((state: UIState) => {
        state.densityOverride = density;
      }),
    ),

  openExplainPanel: (elementId) =>
    set(
      produce((state: UIState) => {
        if (!state.openExplainPanels.includes(elementId)) {
          state.openExplainPanels.push(elementId);
        }
      }),
    ),

  closeExplainPanel: (elementId) =>
    set(
      produce((state: UIState) => {
        state.openExplainPanels = state.openExplainPanels.filter((id) => id !== elementId);
      }),
    ),

  toggleExplainPanel: (elementId) =>
    set(
      produce((state: UIState) => {
        const idx = state.openExplainPanels.indexOf(elementId);
        if (idx >= 0) {
          state.openExplainPanels.splice(idx, 1);
        } else {
          state.openExplainPanels.push(elementId);
        }
      }),
    ),

  setHypotheticalMode: (active, query) =>
    set(
      produce((state: UIState) => {
        state.hypotheticalMode = active;
        state.hypotheticalQuery = query ?? null;
      }),
    ),

  requestConfirmation: (actionId, label, blastRadiusSummary) =>
    set(
      produce((state: UIState) => {
        if (!state.pendingConfirmations.find((c) => c.actionId === actionId)) {
          state.pendingConfirmations.push({ actionId, label, blastRadiusSummary });
        }
      }),
    ),

  resolveConfirmation: (actionId, confirmed, onConfirm) => {
    if (confirmed) onConfirm();
    set(
      produce((state: UIState) => {
        state.pendingConfirmations = state.pendingConfirmations.filter(
          (c) => c.actionId !== actionId,
        );
      }),
    );
  },

  dismissConfirmation: (actionId) =>
    set(
      produce((state: UIState) => {
        state.pendingConfirmations = state.pendingConfirmations.filter(
          (c) => c.actionId !== actionId,
        );
      }),
    ),
}));
