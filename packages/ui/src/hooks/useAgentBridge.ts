// ─────────────────────────────────────────────────────────────────────────────
// useAgentBridge — React hook that wires an AgentBridge to HARI stores.
//
// Responsibilities:
//   - Connects on mount (or when bridge instance changes), disconnects on unmount
//   - Subscribes to 'intent' events → commits to useIntentStore
//   - Sends CapabilityManifest on connect
//   - Sends IntentModification patches when called explicitly
//   - Exposes connectionState and a stable sendModification() function
//
// Usage:
//   const bridge = new MockAgentBridge({ initialIntent: travelScenario });
//   const { connectionState, sendModification } = useAgentBridge(bridge, manifest);
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import type { AgentBridge, ConnectionState } from '@hari/core';
import { useIntentStore } from '@hari/core';
import type { CapabilityManifest, IntentModification } from '@hari/core';

export interface UseAgentBridgeResult {
  connectionState: ConnectionState;
  /** Send a modification patch to the agent */
  sendModification: (patch: IntentModification) => void;
  /** Manual reconnect trigger (useful after an 'error' state) */
  reconnect: () => void;
}

export function useAgentBridge(
  bridge: AgentBridge,
  manifest?: CapabilityManifest,
): UseAgentBridgeResult {
  const [connectionState, setConnectionState] =
    React.useState<ConnectionState>(bridge.connectionState);
  const setIntent = useIntentStore((s) => s.setIntent);

  // Keep manifest in a ref so the connect effect doesn't re-run when it changes
  const manifestRef = React.useRef(manifest);
  React.useEffect(() => {
    manifestRef.current = manifest;
  }, [manifest]);

  React.useEffect(() => {
    let alive = true;

    const unsubState = bridge.on('stateChange', (state) => {
      if (alive) setConnectionState(state);
    });

    const unsubIntent = bridge.on('intent', (intent) => {
      if (alive) setIntent(intent);
    });

    // Connect and send capability manifest when ready
    bridge
      .connect()
      .then(() => {
        if (alive && manifestRef.current) {
          bridge.sendCapabilityManifest(manifestRef.current);
        }
      })
      .catch((err: unknown) => {
        console.error('[useAgentBridge] connect failed:', err);
      });

    return () => {
      alive = false;
      unsubState();
      unsubIntent();
      bridge.disconnect();
    };
    // bridge is intentionally the only dependency — it's the stable identity
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bridge]);

  const sendModification = React.useCallback(
    (patch: IntentModification) => {
      bridge.sendModification(patch);
    },
    [bridge],
  );

  const reconnect = React.useCallback(() => {
    bridge.connect().catch((err: unknown) => {
      console.error('[useAgentBridge] reconnect failed:', err);
    });
  }, [bridge]);

  return { connectionState, sendModification, reconnect };
}
