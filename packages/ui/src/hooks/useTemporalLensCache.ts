// ─────────────────────────────────────────────────────────────────────────────
// useTemporalLensCache — Phase 7.2: Temporal Lens Optimization
//
// Provides:
//   - LAZY evaluation: annotations for a lens are only computed once that lens
//     is selected (not upfront for all three).
//   - CACHE: computed annotations are memoized per lens type. If the lens object
//     identity hasn't changed, no recomputation happens.
//   - INCREMENTAL uncertainty: aggregate uncertainty score is recalculated only
//     for the active lens, not across all lenses on every render.
//
// Usage:
//   const {
//     activeLens,
//     setActiveLens,
//     annotations,
//     uncertaintyScore,
//     changeCount,
//   } = useTemporalLensCache(lens, initialLens);
//
// Rule: Don't compute what no one is looking at.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useMemo, useRef, useState } from 'react';
import type { TemporalLens, TemporalLensType, TemporalAnnotation } from '@hari/core';
import { getAnnotationsForLens } from '@hari/core';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface UseTemporalLensCacheResult {
  /** Currently active lens type. */
  activeLens: TemporalLensType;
  /** Change active lens — triggers lazy annotation evaluation for that lens. */
  setActiveLens: (lens: TemporalLensType) => void;

  /** Lazily evaluated annotations for the active lens. */
  annotations: TemporalAnnotation[];

  /**
   * Incremental uncertainty score (0–1) aggregated from annotation confidence
   * values for the active lens only.  Lower = more certain.
   */
  uncertaintyScore: number;

  /** Total change count for the active lens. */
  changeCount: number;

  /** Per-lens cache hit/miss counter — useful for debugging. */
  cacheStats: { hits: number; misses: number };
}

export interface UseTemporalLensCacheOptions {
  /**
   * Identity key: when this changes the entire annotation cache is invalidated.
   * Pass a stable string derived from your lens data (e.g. a view ID + timestamp).
   * If omitted the cache is keyed against the `lens` object reference.
   */
  cacheKey?: string;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useTemporalLensCache(
  lens: TemporalLens,
  initialLens?: TemporalLensType,
  options: UseTemporalLensCacheOptions = {},
): UseTemporalLensCacheResult {
  const { cacheKey } = options;

  // Active lens (controlled externally or internally managed)
  const [activeLens, setActiveLensState] = useState<TemporalLensType>(
    initialLens ?? lens.activeLens,
  );

  // ── Annotation cache ──────────────────────────────────────────────────────
  // Map<TemporalLensType, TemporalAnnotation[]>
  // Invalidated when cacheKey or lens reference changes.

  const cacheRef = useRef<Map<TemporalLensType, TemporalAnnotation[]>>(new Map());
  const prevCacheKeyRef = useRef<string | undefined>(undefined);
  const prevLensRef = useRef<TemporalLens | undefined>(undefined);
  const statsRef = useRef({ hits: 0, misses: 0 });

  // Invalidate cache if the data source changed
  const currentCacheKey = cacheKey ?? 'object';
  const lensChanged   = prevLensRef.current !== lens;
  const keyChanged    = prevCacheKeyRef.current !== currentCacheKey;

  if (lensChanged || keyChanged) {
    cacheRef.current.clear();
    prevLensRef.current = lens;
    prevCacheKeyRef.current = currentCacheKey;
  }

  // ── Lazy annotation evaluation ────────────────────────────────────────────

  const annotations = useMemo<TemporalAnnotation[]>(() => {
    const cache = cacheRef.current;

    if (cache.has(activeLens)) {
      statsRef.current.hits++;
      return cache.get(activeLens)!;
    }

    statsRef.current.misses++;
    const computed = getAnnotationsForLens(lens, activeLens);
    cache.set(activeLens, computed);
    return computed;
  // `lens` in deps ensures we recompute if the lens object reference changed
  // even though the cache was supposed to be cleared above — belt and braces.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLens, lens, lensChanged]);

  // ── Incremental uncertainty score ─────────────────────────────────────────
  // Derived only from the active lens annotations, not all three lenses.

  const uncertaintyScore = useMemo<number>(() => {
    if (annotations.length === 0) return 0;

    // Collect projection confidence values (1 − confidence = uncertainty)
    const uncertainties: number[] = annotations
      .filter((a) => a.projectionConfidence != null)
      .map((a) => 1 - (a.projectionConfidence ?? 1));

    // Also treat 'projected' change type items without explicit confidence
    // as medium uncertainty (0.4) to surface unknown-unknown regions.
    const implicitCount = annotations.filter(
      (a) => a.changeType === 'projected' && a.projectionConfidence == null,
    ).length;

    const allUncertainties = [
      ...uncertainties,
      ...Array<number>(implicitCount).fill(0.4),
    ];

    if (allUncertainties.length === 0) return 0;
    return allUncertainties.reduce((s, u) => s + u, 0) / allUncertainties.length;
  }, [annotations]);

  // ── Change count ─────────────────────────────────────────────────────────
  // Count meaningful (non-unchanged) annotations for the active lens.

  const changeCount = useMemo(() => {
    return annotations.filter((a) => a.changeType !== 'unchanged').length;
  }, [annotations]);

  // ── setActiveLens ─────────────────────────────────────────────────────────

  const setActiveLens = useCallback((newLens: TemporalLensType) => {
    setActiveLensState(newLens);
    // Annotations for this lens will be lazily evaluated above on next render.
  }, []);

  return {
    activeLens,
    setActiveLens,
    annotations,
    uncertaintyScore,
    changeCount,
    cacheStats: statsRef.current,
  };
}
