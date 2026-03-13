/**
 * Pagination
 *
 * Accessible pagination control with configurable page range,
 * keyboard navigation, and screen-reader announcements.
 *
 * Usage:
 *   <Pagination
 *     totalPages={20}
 *     currentPage={5}
 *     onPageChange={(page) => setPage(page)}
 *   />
 */
import React from 'react';
import { useTheme } from '../../ThemeContext';

export interface PaginationProps {
  totalPages: number;
  currentPage: number;
  onPageChange: (page: number) => void;
  /** Number of visible page buttons before/after current */
  siblingCount?: number;
  /** Show first/last page buttons */
  showEdges?: boolean;
  /** Compact mode — no page buttons, just prev/next with "Page X of Y" */
  compact?: boolean;
}

export function Pagination({
  totalPages,
  currentPage,
  onPageChange,
  siblingCount = 1,
  showEdges = true,
  compact = false,
}: PaginationProps) {
  const { theme } = useTheme();

  const pageRange = React.useMemo(() => {
    if (compact) return [];
    const range: (number | 'ellipsis')[] = [];
    const left = Math.max(1, currentPage - siblingCount);
    const right = Math.min(totalPages, currentPage + siblingCount);

    if (showEdges && left > 1) {
      range.push(1);
      if (left > 2) range.push('ellipsis');
    }

    for (let i = left; i <= right; i++) {
      range.push(i);
    }

    if (showEdges && right < totalPages) {
      if (right < totalPages - 1) range.push('ellipsis');
      range.push(totalPages);
    }

    return range;
  }, [totalPages, currentPage, siblingCount, showEdges, compact]);

  const buttonStyle = React.useCallback(
    (active?: boolean, disabled?: boolean): React.CSSProperties => ({
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: 36,
      height: 36,
      padding: '0 8px',
      fontSize: 14,
      fontWeight: active ? 600 : 400,
      fontFamily: theme.typography.family,
      color: disabled
        ? theme.colors.textMuted
        : active
          ? theme.colors.accentText
          : theme.colors.text,
      backgroundColor: active ? theme.colors.accent : 'transparent',
      border: active ? 'none' : `1px solid ${theme.colors.border}`,
      borderRadius: theme.radius.sm,
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.5 : 1,
      outline: 'none',
      transition: 'background-color 0.15s, color 0.15s',
    }),
    [theme],
  );

  return (
    <nav role="navigation" aria-label="Pagination" style={{ fontFamily: theme.typography.family }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}
      >
        {/* Previous */}
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          aria-label="Go to previous page"
          style={buttonStyle(false, currentPage <= 1)}
        >
          ‹
        </button>

        {compact ? (
          <span
            style={{
              padding: '0 12px',
              fontSize: 14,
              color: theme.colors.textSecondary,
            }}
            aria-live="polite"
            aria-atomic="true"
          >
            Page {currentPage} of {totalPages}
          </span>
        ) : (
          pageRange.map((item, i) =>
            item === 'ellipsis' ? (
              <span
                key={`ellipsis-${i}`}
                style={{
                  minWidth: 36,
                  textAlign: 'center',
                  color: theme.colors.textMuted,
                  fontSize: 14,
                  userSelect: 'none',
                }}
                aria-hidden="true"
              >
                …
              </span>
            ) : (
              <button
                key={item}
                onClick={() => onPageChange(item)}
                aria-label={`Go to page ${item}`}
                aria-current={item === currentPage ? 'page' : undefined}
                style={buttonStyle(item === currentPage)}
              >
                {item}
              </button>
            ),
          )
        )}

        {/* Next */}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          aria-label="Go to next page"
          style={buttonStyle(false, currentPage >= totalPages)}
        >
          ›
        </button>
      </div>

      {/* Screen reader announcement */}
      <div
        aria-live="polite"
        aria-atomic="true"
        style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)' }}
      >
        Page {currentPage} of {totalPages}
      </div>
    </nav>
  );
}
