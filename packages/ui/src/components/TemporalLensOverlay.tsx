import React from 'react';
import type {
  TemporalLens,
  TemporalLensType,
  TemporalAnnotation,
} from '@hari/core';
import { getAnnotationsForLens, hasTemporalContext, countChanges } from '@hari/core';
import { useTheme } from '../ThemeContext';
import type { Theme } from '../theme';
import { useTemporalLensCache } from '../hooks/useTemporalLensCache';

// ─────────────────────────────────────────────────────────────────────────────
// TemporalLensSelector + TemporalAnnotationOverlay
//
// Provides the UI for switching between temporal lenses (Now / Before / After)
// and rendering change annotations on the current view.
//
// Design:
//   - A segmented control to switch lenses
//   - Change badges showing count of modifications
//   - Annotation cards showing what changed, with previous/projected values
//   - Summary text for the active lens
// ─────────────────────────────────────────────────────────────────────────────

const LENS_META: Record<TemporalLensType, {
  icon: string;
  label: string;
  description: string;
  color: string;
  bgColor: string;
}> = {
  now: {
    icon: '◉',
    label: 'Now',
    description: 'Current state of the system',
    color: '#0369a1',
    bgColor: '#e0f2fe',
  },
  before: {
    icon: '◀',
    label: 'Before',
    description: 'What changed to produce this state',
    color: '#6d28d9',
    bgColor: '#ede9fe',
  },
  after: {
    icon: '▶',
    label: 'After',
    description: 'What will happen if approved',
    color: '#b45309',
    bgColor: '#fef3c7',
  },
};

const CHANGE_TYPE_STYLES: Record<string, { icon: string; color: string; bg: string }> = {
  added:     { icon: '+', color: '#166534', bg: '#dcfce7' },
  removed:   { icon: '−', color: '#991b1b', bg: '#fee2e2' },
  modified:  { icon: '~', color: '#854d0e', bg: '#fef9c3' },
  unchanged: { icon: '=', color: '#64748b', bg: '#f1f5f9' },
  projected: { icon: '→', color: '#6d28d9', bg: '#ede9fe' },
};

export interface TemporalLensSelectorProps {
  lens: TemporalLens;
  onLensChange: (lens: TemporalLensType) => void;
  /** Compact mode: just the segmented control, no annotations */
  compact?: boolean;
}

export function TemporalLensSelector({
  lens,
  onLensChange,
  compact = false,
}: TemporalLensSelectorProps) {
  const { theme } = useTheme();
  const counts = React.useMemo(() => countChanges(lens), [lens]);
  const hasContext = hasTemporalContext(lens);

  if (!hasContext && compact) return null;

  return (
    <div>
      {/* Lens selector */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '2px',
        backgroundColor: theme.colors.surfaceAlt,
        borderRadius: theme.radius.md,
        padding: '2px',
      }}>
        {lens.availableLenses.map((lensType) => {
          const meta = LENS_META[lensType];
          const isActive = lensType === lens.activeLens;
          const lensAnnotations = getAnnotationsForLens(lens, lensType);
          const annotationCount = lensAnnotations.length;

          return (
            <button
              key={lensType}
              onClick={() => onLensChange(lensType)}
              title={meta.description}
              aria-pressed={isActive}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.3rem',
                padding: '0.375rem 0.5rem',
                borderRadius: `calc(${theme.radius.md} - 2px)`,
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.15s',
                backgroundColor: isActive ? meta.bgColor : 'transparent',
                color: isActive ? meta.color : theme.colors.textMuted,
                fontWeight: isActive ? 700 : 400,
                fontSize: '0.8rem',
              }}
            >
              <span>{meta.icon}</span>
              <span>{meta.label}</span>
              {annotationCount > 0 && (
                <span style={{
                  fontSize: '0.6rem',
                  fontWeight: 700,
                  padding: '0.05rem 0.3rem',
                  borderRadius: '8px',
                  backgroundColor: isActive ? meta.color : theme.colors.border,
                  color: isActive ? '#fff' : theme.colors.textMuted,
                  minWidth: '1rem',
                  textAlign: 'center',
                }}>
                  {annotationCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Summary text */}
      {!compact && (
        <div style={{
          marginTop: '0.375rem',
          fontSize: '0.75rem',
          color: theme.colors.textSecondary,
        }}>
          {lens.activeLens === 'before' && lens.changeSummary.whatChanged && (
            <span>📝 {lens.changeSummary.whatChanged}</span>
          )}
          {lens.activeLens === 'after' && lens.changeSummary.whatWillHappen && (
            <span>🔮 {lens.changeSummary.whatWillHappen}</span>
          )}
          {lens.activeLens === 'now' && lens.changeSummary.affectedCount != null && (
            <span>📊 {lens.changeSummary.affectedCount} element(s) tracked</span>
          )}
        </div>
      )}
    </div>
  );
}

// ── Annotation List ─────────────────────────────────────────────────────────

export interface TemporalAnnotationListProps {
  lens: TemporalLens;
  /** Max number of annotations to show before collapsing */
  maxVisible?: number;
  /**
   * Phase 7.2: Pre-computed annotations (from useTemporalLensCache).
   * When provided, skips getAnnotationsForLens() — avoiding double computation.
   */
  precomputedAnnotations?: TemporalAnnotation[];
}

export function TemporalAnnotationList({
  lens,
  maxVisible = 10,
  precomputedAnnotations,
}: TemporalAnnotationListProps) {
  const { theme } = useTheme();
  const [showAll, setShowAll] = React.useState(false);
  // Use pre-computed annotations when available (Phase 7.2 lazy cache path).
  const annotations = precomputedAnnotations ?? getAnnotationsForLens(lens, lens.activeLens);

  if (annotations.length === 0) {
    return (
      <div style={{
        padding: '0.75rem',
        fontSize: '0.8rem',
        color: theme.colors.textMuted,
        textAlign: 'center',
        fontStyle: 'italic',
      }}>
        No changes tracked for this lens.
      </div>
    );
  }

  const visible = showAll ? annotations : annotations.slice(0, maxVisible);
  const remaining = annotations.length - maxVisible;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '0.375rem',
    }}>
      {visible.map((annotation, i) => (
        <AnnotationCard key={`${annotation.elementId}-${i}`} annotation={annotation} theme={theme} />
      ))}

      {remaining > 0 && !showAll && (
        <button
          onClick={() => setShowAll(true)}
          style={{
            background: 'none',
            border: `1px dashed ${theme.colors.border}`,
            borderRadius: theme.radius.sm,
            padding: '0.375rem',
            fontSize: '0.75rem',
            color: theme.colors.textMuted,
            cursor: 'pointer',
          }}
        >
          Show {remaining} more change{remaining > 1 ? 's' : ''}
        </button>
      )}
    </div>
  );
}

function AnnotationCard({ annotation, theme }: { annotation: TemporalAnnotation; theme: Theme }) {
  const changeStyle = CHANGE_TYPE_STYLES[annotation.changeType];

  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: '0.5rem',
      padding: '0.5rem 0.625rem',
      border: `1px solid ${theme.colors.border}`,
      borderRadius: theme.radius.sm,
      backgroundColor: theme.colors.surface,
      fontSize: '0.8rem',
    }}>
      {/* Change type badge */}
      <span style={{
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '1.25rem',
        height: '1.25rem',
        borderRadius: '50%',
        backgroundColor: changeStyle.bg,
        color: changeStyle.color,
        fontSize: '0.7rem',
        fontWeight: 700,
      }}>
        {changeStyle.icon}
      </span>

      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Element ID */}
        <div style={{
          fontWeight: 600,
          color: theme.colors.text,
          fontSize: '0.8rem',
        }}>
          {annotation.elementId}
          <span style={{
            marginLeft: '0.375rem',
            fontSize: '0.65rem',
            color: changeStyle.color,
            fontWeight: 600,
            textTransform: 'uppercase',
          }}>
            {annotation.changeType}
          </span>
        </div>

        {/* Value changes */}
        {(annotation.previousValue !== undefined || annotation.currentValue !== undefined) && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.375rem',
            marginTop: '0.2rem',
            fontSize: '0.75rem',
            fontFamily: theme.typography.familyMono,
          }}>
            {annotation.previousValue !== undefined && (
              <span style={{
                padding: '0.1rem 0.3rem',
                backgroundColor: '#fee2e2',
                borderRadius: '3px',
                color: '#991b1b',
                textDecoration: 'line-through',
              }}>
                {formatValue(annotation.previousValue)}
              </span>
            )}
            {annotation.previousValue !== undefined && annotation.currentValue !== undefined && (
              <span style={{ color: theme.colors.textMuted }}>→</span>
            )}
            {annotation.currentValue !== undefined && (
              <span style={{
                padding: '0.1rem 0.3rem',
                backgroundColor: '#dcfce7',
                borderRadius: '3px',
                color: '#166534',
              }}>
                {formatValue(annotation.currentValue)}
              </span>
            )}
          </div>
        )}

        {/* Projected value */}
        {annotation.projectedValue !== undefined && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.375rem',
            marginTop: '0.2rem',
            fontSize: '0.75rem',
          }}>
            <span style={{ color: theme.colors.textMuted }}>Projected:</span>
            <span style={{
              padding: '0.1rem 0.3rem',
              backgroundColor: '#ede9fe',
              borderRadius: '3px',
              color: '#6d28d9',
              fontFamily: theme.typography.familyMono,
            }}>
              {formatValue(annotation.projectedValue)}
            </span>
            {annotation.projectionConfidence !== undefined && (
              <span style={{
                fontSize: '0.65rem',
                color: theme.colors.textMuted,
              }}>
                ({Math.round(annotation.projectionConfidence * 100)}% conf.)
              </span>
            )}
          </div>
        )}

        {/* Explanation */}
        {annotation.explanation && (
          <div style={{
            marginTop: '0.2rem',
            fontSize: '0.75rem',
            color: theme.colors.textSecondary,
            fontStyle: 'italic',
          }}>
            {annotation.explanation}
          </div>
        )}

        {/* Causal factors */}
        {annotation.causalFactors.length > 0 && (
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.2rem',
            marginTop: '0.25rem',
          }}>
            {annotation.causalFactors.map((factor, i) => (
              <span key={i} style={{
                fontSize: '0.65rem',
                padding: '0.1rem 0.35rem',
                borderRadius: '3px',
                backgroundColor: theme.colors.surfaceAlt,
                color: theme.colors.textMuted,
                border: `1px solid ${theme.colors.border}`,
              }}>
                {factor}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Timestamp */}
      {annotation.timestamp && (
        <span style={{
          flexShrink: 0,
          fontSize: '0.65rem',
          color: theme.colors.textMuted,
          whiteSpace: 'nowrap',
        }}>
          {new Date(annotation.timestamp).toLocaleTimeString()}
        </span>
      )}
    </div>
  );
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

// ── Combined TemporalLensOverlay ────────────────────────────────────────────

export interface TemporalLensOverlayProps {
  lens: TemporalLens;
  onLensChange?: (lens: TemporalLensType) => void;
  compact?: boolean;
  /**
   * Phase 7.2: Stable identity key for the annotation cache.
   * Pass a string derived from your data source (e.g. viewId + updatedAt).
   * When omitted, the cache is keyed against the `lens` object reference.
   */
  cacheKey?: string;
}

/**
 * Combined component rendering the temporal lens selector and annotation list.
 * Use this as the single drop-in for temporal context in a SituationalView.
 *
 * Phase 7.2: Uses useTemporalLensCache for lazy annotation evaluation.
 * Annotations for a lens are only computed once that lens is first selected,
 * and are then cached until `cacheKey` or the `lens` reference changes.
 */
export function TemporalLensOverlay({
  lens,
  onLensChange,
  compact = false,
  cacheKey,
}: TemporalLensOverlayProps) {
  const { theme } = useTheme();

  const {
    activeLens,
    setActiveLens,
    annotations,
    uncertaintyScore,
    changeCount,
  } = useTemporalLensCache(lens, lens.activeLens, { cacheKey });

  const handleLensChange = (newLens: TemporalLensType) => {
    setActiveLens(newLens);
    onLensChange?.(newLens);
  };

  return (
    <div>
      <TemporalLensSelector
        lens={{ ...lens, activeLens }}
        onLensChange={handleLensChange}
        compact={compact}
      />

      {/* Phase 7.2: Incremental uncertainty indicator for active lens */}
      {!compact && uncertaintyScore > 0 && (
        <div style={{
          marginTop: '0.25rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.375rem',
          fontSize: '0.7rem',
          color: theme.colors.textMuted,
        }}>
          <div style={{
            flex: 1,
            height: '3px',
            borderRadius: '2px',
            backgroundColor: theme.colors.border,
            overflow: 'hidden',
          }}>
            <div style={{
              height: '100%',
              width: `${Math.round(uncertaintyScore * 100)}%`,
              backgroundColor: uncertaintyScore > 0.6 ? '#dc2626'
                : uncertaintyScore > 0.3 ? '#f59e0b'
                : '#22c55e',
              borderRadius: '2px',
              transition: 'width 0.3s ease, background-color 0.3s ease',
            }} />
          </div>
          <span style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
            {Math.round(uncertaintyScore * 100)}% uncertain · {changeCount} change{changeCount !== 1 ? 's' : ''}
          </span>
        </div>
      )}

      {!compact && (
        <TemporalAnnotationList
          lens={{ ...lens, activeLens }}
          precomputedAnnotations={annotations}
        />
      )}
    </div>
  );
}
