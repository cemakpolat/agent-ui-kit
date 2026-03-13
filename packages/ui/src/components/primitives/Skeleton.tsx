/**
 * Skeleton
 *
 * Placeholder shimmer component for loading states.
 * Theme-aware with multiple shape variants.
 *
 * Usage:
 *   <Skeleton width={200} height={20} />
 *   <Skeleton variant="circle" width={40} height={40} />
 *   <Skeleton variant="text" lines={3} />
 */
import React from 'react';
import { useTheme } from '../../ThemeContext';

export type SkeletonVariant = 'rect' | 'circle' | 'text';

export interface SkeletonProps {
  variant?: SkeletonVariant;
  width?: number | string;
  height?: number | string;
  /** Number of lines for 'text' variant */
  lines?: number;
  /** Border radius override */
  borderRadius?: string | number;
  /** Speed of animation in seconds */
  speed?: number;
}

export function Skeleton({
  variant = 'rect',
  width,
  height,
  lines = 1,
  borderRadius,
  speed = 1.5,
}: SkeletonProps) {
  const { theme } = useTheme();

  const baseStyle: React.CSSProperties = {
    background: `linear-gradient(
      90deg,
      ${theme.colors.surfaceAlt} 25%,
      ${theme.colors.border} 50%,
      ${theme.colors.surfaceAlt} 75%
    )`,
    backgroundSize: '200% 100%',
    animation: `hari-skeleton-shimmer ${speed}s ease-in-out infinite`,
  };

  if (variant === 'text') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: width ?? '100%' }}>
        {Array.from({ length: lines }, (_, i) => (
          <div
            key={i}
            aria-hidden="true"
            style={{
              ...baseStyle,
              height: height ?? 14,
              borderRadius: borderRadius ?? theme.radius.sm,
              // Last line shorter for natural look
              width: i === lines - 1 && lines > 1 ? '75%' : '100%',
            }}
          />
        ))}
        <style>{skeletonKeyframes}</style>
      </div>
    );
  }

  if (variant === 'circle') {
    const size = width ?? height ?? 40;
    return (
      <>
        <div
          aria-hidden="true"
          style={{
            ...baseStyle,
            width: size,
            height: size,
            borderRadius: '50%',
          }}
        />
        <style>{skeletonKeyframes}</style>
      </>
    );
  }

  // rect
  return (
    <>
      <div
        aria-hidden="true"
        style={{
          ...baseStyle,
          width: width ?? '100%',
          height: height ?? 20,
          borderRadius: borderRadius ?? theme.radius.md,
        }}
      />
      <style>{skeletonKeyframes}</style>
    </>
  );
}

const skeletonKeyframes = `
  @keyframes hari-skeleton-shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }
`;

// ─────────────────────────────────────────────────────────────────────────────
// SkeletonGroup — common loading patterns
// ─────────────────────────────────────────────────────────────────────────────

export type SkeletonGroupPattern = 'card' | 'list' | 'table' | 'form' | 'article';

export interface SkeletonGroupProps {
  pattern: SkeletonGroupPattern;
  count?: number;
}

export function SkeletonGroup({ pattern, count = 1 }: SkeletonGroupProps) {
  const { theme } = useTheme();

  const renderPattern = () => {
    switch (pattern) {
      case 'card':
        return (
          <div style={{ padding: 16, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.md }}>
            <Skeleton height={120} />
            <div style={{ marginTop: 12 }}>
              <Skeleton width="60%" height={18} />
            </div>
            <div style={{ marginTop: 8 }}>
              <Skeleton variant="text" lines={2} />
            </div>
          </div>
        );
      case 'list':
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0' }}>
            <Skeleton variant="circle" width={36} height={36} />
            <div style={{ flex: 1 }}>
              <Skeleton width="40%" height={14} />
              <div style={{ marginTop: 4 }}>
                <Skeleton width="70%" height={12} />
              </div>
            </div>
          </div>
        );
      case 'table':
        return (
          <div style={{ display: 'flex', gap: 16, padding: '10px 0', borderBottom: `1px solid ${theme.colors.border}` }}>
            <Skeleton width="25%" height={14} />
            <Skeleton width="25%" height={14} />
            <Skeleton width="25%" height={14} />
            <Skeleton width="15%" height={14} />
          </div>
        );
      case 'form':
        return (
          <div style={{ marginBottom: 16 }}>
            <Skeleton width="30%" height={12} />
            <div style={{ marginTop: 6 }}>
              <Skeleton height={36} borderRadius={theme.radius.sm} />
            </div>
          </div>
        );
      case 'article':
        return (
          <div>
            <Skeleton width="80%" height={24} />
            <div style={{ marginTop: 12 }}>
              <Skeleton variant="text" lines={4} />
            </div>
            <div style={{ marginTop: 16 }}>
              <Skeleton height={200} />
            </div>
          </div>
        );
    }
  };

  return (
    <div role="status" aria-label="Loading content">
      {Array.from({ length: count }, (_, i) => (
        <div key={i}>{renderPattern()}</div>
      ))}
      <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)' }}>
        Loading…
      </span>
    </div>
  );
}
