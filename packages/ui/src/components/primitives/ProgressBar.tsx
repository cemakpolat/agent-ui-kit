/**
 * Progress indicators: ProgressBar and Spinner
 *
 * Accessible loading indicators with theme integration.
 *
 * Usage:
 *   <ProgressBar value={65} label="Uploading..." />
 *   <Spinner size="md" label="Loading..." />
 */
import React from 'react';
import { useTheme } from '../../ThemeContext';

// ─────────────────────────────────────────────────────────────────────────────
// ProgressBar
// ─────────────────────────────────────────────────────────────────────────────

export type ProgressVariant = 'default' | 'success' | 'warning' | 'danger';

export interface ProgressBarProps {
  /** Current value (0–100). undefined = indeterminate */
  value?: number;
  /** Maximum value (default 100) */
  max?: number;
  label?: string;
  /** Show percentage text */
  showValue?: boolean;
  variant?: ProgressVariant;
  /** Height in px */
  height?: number;
  /** Animate transitions */
  animated?: boolean;
  /** Striped style */
  striped?: boolean;
}

export function ProgressBar({
  value,
  max = 100,
  label,
  showValue = false,
  variant = 'default',
  height = 8,
  animated = true,
  striped = false,
}: ProgressBarProps) {
  const { theme } = useTheme();

  const isIndeterminate = value === undefined;
  const percent = isIndeterminate ? 0 : Math.min(100, Math.max(0, (value / max) * 100));

  const variantColor: Record<ProgressVariant, string> = {
    default: theme.colors.accent,
    success: theme.colors.success,
    warning: theme.colors.warning,
    danger: theme.colors.danger,
  };

  const barColor = variantColor[variant];

  const stripedBg = striped
    ? `repeating-linear-gradient(
        45deg,
        transparent,
        transparent 10px,
        rgba(255,255,255,0.15) 10px,
        rgba(255,255,255,0.15) 20px
      )`
    : undefined;

  return (
    <div style={{ fontFamily: theme.typography.family }}>
      {(label || showValue) && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 4,
            fontSize: 13,
          }}
        >
          {label && <span style={{ color: theme.colors.textSecondary }}>{label}</span>}
          {showValue && !isIndeterminate && (
            <span style={{ fontWeight: 600, color: theme.colors.text }}>{Math.round(percent)}%</span>
          )}
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={isIndeterminate ? undefined : Math.round(percent)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? 'Progress'}
        style={{
          width: '100%',
          height,
          backgroundColor: theme.colors.surfaceAlt,
          borderRadius: height / 2,
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {isIndeterminate ? (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: '-40%',
              width: '40%',
              height: '100%',
              backgroundColor: barColor,
              borderRadius: height / 2,
              animation: 'hari-progress-indeterminate 1.5s ease-in-out infinite',
            }}
          />
        ) : (
          <div
            style={{
              width: `${percent}%`,
              height: '100%',
              backgroundColor: barColor,
              backgroundImage: stripedBg,
              backgroundSize: striped ? '28px 28px' : undefined,
              borderRadius: height / 2,
              transition: animated ? 'width 0.3s ease' : 'none',
            }}
          />
        )}
      </div>
      <style>{`
        @keyframes hari-progress-indeterminate {
          0% { left: -40%; }
          100% { left: 100%; }
        }
      `}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Spinner
// ─────────────────────────────────────────────────────────────────────────────

export type SpinnerSize = 'sm' | 'md' | 'lg' | 'xl';

export interface SpinnerProps {
  size?: SpinnerSize;
  label?: string;
  /** Color override (defaults to accent) */
  color?: string;
}

const spinnerSizes: Record<SpinnerSize, number> = {
  sm: 16,
  md: 24,
  lg: 36,
  xl: 48,
};

export function Spinner({ size = 'md', label, color }: SpinnerProps) {
  const { theme } = useTheme();
  const px = spinnerSizes[size];
  const strokeColor = color ?? theme.colors.accent;

  return (
    <span
      role="status"
      aria-label={label ?? 'Loading'}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
    >
      <svg
        width={px}
        height={px}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        style={{ animation: 'hari-spin 0.75s linear infinite' }}
      >
        <circle
          cx="12"
          cy="12"
          r="10"
          stroke={theme.colors.border}
          strokeWidth="3"
          fill="none"
        />
        <path
          d="M12 2 a10 10 0 0 1 10 10"
          stroke={strokeColor}
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
      {label && (
        <span
          style={{
            fontSize: size === 'sm' ? 12 : 14,
            color: theme.colors.textSecondary,
            fontFamily: theme.typography.family,
          }}
        >
          {label}
        </span>
      )}
      <style>{`
        @keyframes hari-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </span>
  );
}
