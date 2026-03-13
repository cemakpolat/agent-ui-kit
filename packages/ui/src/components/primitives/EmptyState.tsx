/**
 * EmptyState
 *
 * Reusable placeholder for views with no content.
 * Theme-aware with optional icon, action, and illustration slot.
 *
 * Usage:
 *   <EmptyState
 *     icon="📭"
 *     title="No messages yet"
 *     description="Start a conversation to see messages here."
 *     action={{ label: 'New Message', onClick: () => {} }}
 *   />
 */
import React from 'react';
import { useTheme } from '../../ThemeContext';

export interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: string | React.ReactNode;
  action?: { label: string; onClick: () => void };
  secondaryAction?: { label: string; onClick: () => void };
  /** Custom illustration (e.g. SVG) */
  illustration?: React.ReactNode;
  /** Compact mode — less padding */
  compact?: boolean;
}

export function EmptyState({
  title,
  description,
  icon,
  action,
  secondaryAction,
  illustration,
  compact = false,
}: EmptyStateProps) {
  const { theme } = useTheme();

  return (
    <div
      role="status"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: compact ? '24px 16px' : '48px 24px',
        fontFamily: theme.typography.family,
      }}
    >
      {/* Illustration or Icon */}
      {illustration ? (
        <div style={{ marginBottom: 16 }}>{illustration}</div>
      ) : icon ? (
        <div
          style={{
            fontSize: compact ? 36 : 48,
            marginBottom: compact ? 12 : 16,
            opacity: 0.6,
          }}
          aria-hidden="true"
        >
          {icon}
        </div>
      ) : (
        /* Default empty state illustration */
        <svg
          width={compact ? 80 : 120}
          height={compact ? 60 : 90}
          viewBox="0 0 120 90"
          aria-hidden="true"
          style={{ marginBottom: compact ? 12 : 20, opacity: 0.3 }}
        >
          <rect x="20" y="10" width="80" height="55" rx="4" fill={theme.colors.border} />
          <rect x="30" y="20" width="60" height="6" rx="3" fill={theme.colors.textMuted} opacity="0.4" />
          <rect x="30" y="32" width="45" height="4" rx="2" fill={theme.colors.textMuted} opacity="0.3" />
          <rect x="30" y="42" width="50" height="4" rx="2" fill={theme.colors.textMuted} opacity="0.3" />
          <circle cx="60" cy="78" r="8" fill={theme.colors.border} />
          <line x1="56" y1="78" x2="64" y2="78" stroke={theme.colors.textMuted} strokeWidth="2" opacity="0.4" />
        </svg>
      )}

      {/* Title */}
      <h3
        style={{
          margin: 0,
          fontSize: compact ? 16 : 18,
          fontWeight: 600,
          color: theme.colors.text,
          lineHeight: '24px',
        }}
      >
        {title}
      </h3>

      {/* Description */}
      {description && (
        <p
          style={{
            margin: '8px 0 0',
            fontSize: 14,
            color: theme.colors.textSecondary,
            maxWidth: 360,
            lineHeight: '20px',
          }}
        >
          {description}
        </p>
      )}

      {/* Actions */}
      {(action || secondaryAction) && (
        <div style={{ display: 'flex', gap: 8, marginTop: compact ? 16 : 20 }}>
          {action && (
            <button
              onClick={action.onClick}
              style={{
                padding: '8px 20px',
                fontSize: 14,
                fontWeight: 600,
                color: theme.colors.accentText,
                backgroundColor: theme.colors.accent,
                border: 'none',
                borderRadius: theme.radius.md,
                cursor: 'pointer',
                fontFamily: theme.typography.family,
              }}
            >
              {action.label}
            </button>
          )}
          {secondaryAction && (
            <button
              onClick={secondaryAction.onClick}
              style={{
                padding: '8px 20px',
                fontSize: 14,
                fontWeight: 600,
                color: theme.colors.textSecondary,
                backgroundColor: 'transparent',
                border: `1px solid ${theme.colors.border}`,
                borderRadius: theme.radius.md,
                cursor: 'pointer',
                fontFamily: theme.typography.family,
              }}
            >
              {secondaryAction.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
