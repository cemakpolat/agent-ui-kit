import { describe, it, expect, beforeEach } from 'vitest';
import {
  ComponentRegistryManager,
  FALLBACK_INTENT,
  GENERIC_DOMAIN,
} from '../compiler/registry';

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

const A = () => 'A'; // executive stub
const B = () => 'B'; // operator stub
const C = () => 'C'; // expert stub
const DEFAULT = () => 'DEFAULT';
const FALLBACK_COMP = () => 'FALLBACK';
const GENERIC_COMP = () => 'GENERIC';

// ─────────────────────────────────────────────────────────────────────────────
// Resolution priority chain
// ─────────────────────────────────────────────────────────────────────────────

describe('ComponentRegistryManager — resolve', () => {
  let reg: ComponentRegistryManager;

  beforeEach(() => {
    reg = new ComponentRegistryManager();
  });

  it('returns null when registry is empty', () => {
    expect(reg.resolve('travel', 'comparison', 'operator')).toBeNull();
  });

  it('resolves exact (domain, intentType, density)', () => {
    reg.register('travel', 'comparison', { executive: A, operator: B, expert: C, default: DEFAULT });
    expect(reg.resolve('travel', 'comparison', 'executive')).toBe(A);
    expect(reg.resolve('travel', 'comparison', 'operator')).toBe(B);
    expect(reg.resolve('travel', 'comparison', 'expert')).toBe(C);
  });

  it('falls back to entry.default when specific density is absent', () => {
    reg.register('travel', 'comparison', { default: DEFAULT }); // no per-density variants
    expect(reg.resolve('travel', 'comparison', 'operator')).toBe(DEFAULT);
    expect(reg.resolve('travel', 'comparison', 'expert')).toBe(DEFAULT);
  });

  it('falls back to domain __fallback__ entry when intentType is unknown', () => {
    reg.register('travel', FALLBACK_INTENT, { default: FALLBACK_COMP });
    expect(reg.resolve('travel', 'unknown_type', 'operator')).toBe(FALLBACK_COMP);
  });

  it('domain-specific entry is preferred over domain __fallback__', () => {
    reg
      .register('travel', 'comparison', { default: DEFAULT })
      .register('travel', FALLBACK_INTENT, { default: FALLBACK_COMP });
    expect(reg.resolve('travel', 'comparison', 'operator')).toBe(DEFAULT);
  });

  it('falls back to __generic__ domain entry when domain is unknown', () => {
    reg.register(GENERIC_DOMAIN, FALLBACK_INTENT, { default: GENERIC_COMP });
    expect(reg.resolve('finance', 'comparison', 'operator')).toBe(GENERIC_COMP);
  });

  it('domain-specific entry is preferred over __generic__', () => {
    reg
      .register('travel', 'comparison', { default: DEFAULT })
      .register(GENERIC_DOMAIN, FALLBACK_INTENT, { default: GENERIC_COMP });
    expect(reg.resolve('travel', 'comparison', 'operator')).toBe(DEFAULT);
  });

  it('returns null when nothing matches at all', () => {
    reg.register('travel', 'comparison', { default: DEFAULT });
    expect(reg.resolve('finance', 'comparison', 'operator')).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// hasEntry
// ─────────────────────────────────────────────────────────────────────────────

describe('ComponentRegistryManager — hasEntry', () => {
  it('returns false when not registered', () => {
    const reg = new ComponentRegistryManager();
    expect(reg.hasEntry('travel', 'comparison')).toBe(false);
  });

  it('returns true after registration', () => {
    const reg = new ComponentRegistryManager();
    reg.register('travel', 'comparison', { default: DEFAULT });
    expect(reg.hasEntry('travel', 'comparison')).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// merge
// ─────────────────────────────────────────────────────────────────────────────

describe('ComponentRegistryManager — merge', () => {
  it('merges entries from another registry', () => {
    const base = new ComponentRegistryManager().register('travel', 'comparison', { default: DEFAULT });
    const ext = new ComponentRegistryManager().register('cloudops', 'diagnostic', { default: FALLBACK_COMP });
    base.merge(ext);
    expect(base.resolve('travel', 'comparison', 'operator')).toBe(DEFAULT);
    expect(base.resolve('cloudops', 'diagnostic', 'operator')).toBe(FALLBACK_COMP);
  });

  it('later registration wins on conflict', () => {
    const base = new ComponentRegistryManager().register('travel', 'comparison', { default: DEFAULT });
    const ext = new ComponentRegistryManager().register('travel', 'comparison', { default: GENERIC_COMP });
    base.merge(ext);
    expect(base.resolve('travel', 'comparison', 'operator')).toBe(GENERIC_COMP);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Fluent chaining
// ─────────────────────────────────────────────────────────────────────────────

describe('ComponentRegistryManager — fluent API', () => {
  it('register returns this for chaining', () => {
    const reg = new ComponentRegistryManager();
    const result = reg.register('travel', 'comparison', { default: DEFAULT });
    expect(result).toBe(reg);
  });

  it('can chain multiple registrations', () => {
    const reg = new ComponentRegistryManager()
      .register('travel', 'comparison', { default: DEFAULT })
      .register('cloudops', 'diagnostic', { default: FALLBACK_COMP });
    expect(reg.hasEntry('travel', 'comparison')).toBe(true);
    expect(reg.hasEntry('cloudops', 'diagnostic')).toBe(true);
  });
});
