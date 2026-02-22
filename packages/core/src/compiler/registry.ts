import type { DensityMode } from '../schemas/intent';

// ─────────────────────────────────────────────────────────────────────────────
// Component Registry
//
// Maps (domain, intentType, density) → a component resolver function.
// Resolvers can be synchronous or async (for lazy-loading).
//
// Registration is done by the consuming application so the core package stays
// framework-agnostic.  The renderer in @hari/ui provides a default registry
// pre-populated with built-in components, which apps extend at startup.
// ─────────────────────────────────────────────────────────────────────────────

// A component type is anything callable that returns a renderable node.
// Kept generic so the core package stays framework-agnostic.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyComponent<TProps = any> = (props: TProps) => unknown;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ComponentResolver<TProps = any> =
  | (() => Promise<AnyComponent<TProps>>)
  | (() => AnyComponent<TProps>);

export interface RegistryEntry {
  /** Component to use at executive density */
  executive?: ComponentResolver;
  /** Component to use at operator density */
  operator?: ComponentResolver;
  /** Component to use at expert density */
  expert?: ComponentResolver;
  /** Fallback when the requested density has no entry */
  default: ComponentResolver;
}

/** Well-known key for domain-level fallback entries */
export const GENERIC_DOMAIN = '__generic__';
/** Well-known key for intent-level fallback entries within a domain */
export const FALLBACK_INTENT = '__fallback__';

// ─────────────────────────────────────────────────────────────────────────────
// Registry Manager
// ─────────────────────────────────────────────────────────────────────────────

interface RegistryStore {
  [domain: string]: {
    [intentType: string]: RegistryEntry;
  };
}

export class ComponentRegistryManager {
  private store: RegistryStore = {};

  /**
   * Register a component entry for a (domain, intentType) pair.
   * Returns `this` for fluent chaining.
   */
  register(domain: string, intentType: string, entry: RegistryEntry): this {
    if (!this.store[domain]) {
      this.store[domain] = {};
    }
    this.store[domain][intentType] = entry;
    return this;
  }

  /**
   * Resolve a component resolver for a (domain, intentType, density) triple.
   *
   * Resolution order:
   *   1. (domain, intentType, density)
   *   2. (domain, intentType, default)
   *   3. (domain, __fallback__, density)
   *   4. (domain, __fallback__, default)
   *   5. (__generic__, intentType, density)
   *   6. (__generic__, __fallback__, default)
   *   7. null  ← caller must render a FallbackComponent
   */
  resolve(
    domain: string,
    intentType: string,
    density: DensityMode,
  ): ComponentResolver | null {
    const candidates = [
      this.store[domain]?.[intentType],
      this.store[domain]?.[FALLBACK_INTENT],
      this.store[GENERIC_DOMAIN]?.[intentType],
      this.store[GENERIC_DOMAIN]?.[FALLBACK_INTENT],
    ];

    for (const entry of candidates) {
      if (!entry) continue;
      const resolver = entry[density] ?? entry.default;
      if (resolver) return resolver;
    }

    return null;
  }

  hasEntry(domain: string, intentType: string): boolean {
    return Boolean(this.store[domain]?.[intentType]);
  }

  /** Merge another registry into this one (later registrations win) */
  merge(other: ComponentRegistryManager): this {
    for (const [domain, intents] of Object.entries(other['store'])) {
      for (const [intentType, entry] of Object.entries(intents)) {
        this.register(domain, intentType, entry);
      }
    }
    return this;
  }
}
