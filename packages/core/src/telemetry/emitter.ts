// ─────────────────────────────────────────────────────────────────────────────
// TelemetryEmitter — Lightweight, opt-in event bus for HARI instrumentation.
//
// Design goals:
//   - Zero external dependencies.
//   - Opt-in: disabled by default so integrators who don't care pay no cost.
//   - Pluggable: consumers bring their own analytics backend.
//   - Safe: handler exceptions are swallowed so telemetry never crashes the app.
//   - Singleton: one global instance importable anywhere in the UI layer.
//
// Usage:
//   import { telemetry } from '@hari/core';
//
//   // Enable once at app startup (e.g. in main.tsx):
//   telemetry.enable();
//
//   // Subscribe (returns an unsubscribe function):
//   const unsub = telemetry.subscribe((event) => {
//     myAnalytics.track(event.type, event);
//   });
//
//   // Cleanup on unmount:
//   unsub();
// ─────────────────────────────────────────────────────────────────────────────

import type { TelemetryEvent } from './types';

export type TelemetryHandler = (event: TelemetryEvent) => void;

export class TelemetryEmitter {
  private _handlers = new Set<TelemetryHandler>();
  private _enabled = false;

  /**
   * Enable telemetry emission.  Call this once at app startup to activate.
   * Returns `this` for chaining: `telemetry.enable().subscribe(handler)`.
   */
  enable(): this {
    this._enabled = true;
    return this;
  }

  /** Disable telemetry emission.  Handlers are retained but never called. */
  disable(): this {
    this._enabled = false;
    return this;
  }

  get isEnabled(): boolean {
    return this._enabled;
  }

  /**
   * Register a telemetry handler.
   *
   * @param handler  Called for every event when telemetry is enabled.
   * @returns        Unsubscribe function — call it to remove the handler.
   *
   * Note: registering a handler does NOT implicitly enable emission.
   * Call `enable()` separately.
   */
  subscribe(handler: TelemetryHandler): () => void {
    this._handlers.add(handler);
    return () => {
      this._handlers.delete(handler);
    };
  }

  /**
   * Emit an event to all registered handlers.
   *
   * - No-ops silently when disabled or when no handlers are registered.
   * - Exceptions thrown by handlers are swallowed; the remaining handlers
   *   still execute.
   */
  emit(event: TelemetryEvent): void {
    if (!this._enabled || this._handlers.size === 0) return;
    for (const handler of this._handlers) {
      try {
        handler(event);
      } catch {
        // Telemetry must never affect host app stability.
      }
    }
  }

  /** Number of currently registered handlers (useful in tests). */
  get handlerCount(): number {
    return this._handlers.size;
  }
}

/**
 * Global singleton — import and use anywhere.
 *
 * @example
 *   import { telemetry } from '@hari/core';
 *   telemetry.enable().subscribe(evt => console.log(evt));
 */
export const telemetry = new TelemetryEmitter();
