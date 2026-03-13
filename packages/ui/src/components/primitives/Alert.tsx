/**
 * Alert / Banner
 *
 * Reusable alert banners for inline status messages, warnings, errors.
 * Supports dismiss, actions, and icon customization.
 *
 * Usage:
 *   <Alert variant="warning" title="Rate limited">
 *     Please wait 30 seconds before retrying.
 *   </Alert>
 */
import React from 'react';
import { useTheme } from '../../ThemeContext';

export type AlertVariant = 'info' | 'success' | 'warning' | 'danger';

export interface AlertProps {
  variant?: AlertVariant;
  title?: string;
  children: React.ReactNode;
  dismissible?: boolean;
  onDismiss?: () => void;
  icon?: string;
  action?: { label: string; onClick: () => void };
}

const defaultIcons: Record<AlertVariant, string> = {
  info: 'ℹ',
  success: '✓',
  warning: '⚠',
  danger: '✕',
};

export function Alert({
  variant = 'info',
  title,
  children,
  dismissible = false,
  onDismiss,
  icon,
  action,
}: AlertProps) {
  const { theme } = useTheme();
  const [dismissed, setDismissed] = React.useState(false);

  if (dismissed) return null;

  const variantMap: Record<AlertVariant, { bg: string; border: string; text: string; icon: string }> = {
    info: {
      bg: theme.colors.infoSubtle,
      border: theme.colors.info,
      text: theme.colors.infoText,
      icon: theme.colors.info,
    },
    success: {
      bg: theme.colors.successSubtle,
      border: theme.colors.success,
      text: theme.colors.successText,
      icon: theme.colors.success,
    },
    warning: {
      bg: theme.colors.warningSubtle,
      border: theme.colors.warning,
      text: theme.colors.warningText,
      icon: theme.colors.warning,
    },
    danger: {
      bg: theme.colors.dangerSubtle,
      border: theme.colors.danger,
      text: theme.colors.dangerText,
      icon: theme.colors.danger,
    },
  };

  const colors = variantMap[variant];

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  return (
    <div
      role="alert"
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        padding: '12px 16px',
        backgroundColor: colors.bg,
        borderLeft: `4px solid ${colors.border}`,
        borderRadius: theme.radius.md,
        fontFamily: theme.typography.family,
        fontSize: 14,
        lineHeight: '20px',
      }}
    >
      {/* Icon */}
      <span
        aria-hidden="true"
        style={{
          flexShrink: 0,
          fontSize: 16,
          color: colors.icon,
          marginTop: 1,
        }}
      >
        {icon ?? defaultIcons[variant]}
      </span>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {title && (
          <div
            style={{
              fontWeight: 600,
              color: theme.colors.text,
              marginBottom: 2,
            }}
          >
            {title}
          </div>
        )}
        <div style={{ color: theme.colors.textSecondary }}>{children}</div>
        {action && (
          <button
            onClick={action.onClick}
            style={{
              marginTop: 8,
              padding: '4px 12px',
              fontSize: 12,
              fontWeight: 600,
              color: colors.icon,
              backgroundColor: 'transparent',
              border: `1px solid ${colors.icon}`,
              borderRadius: theme.radius.sm,
              cursor: 'pointer',
              fontFamily: theme.typography.family,
            }}
          >
            {action.label}
          </button>
        )}
      </div>

      {/* Dismiss */}
      {dismissible && (
        <button
          onClick={handleDismiss}
          aria-label="Dismiss alert"
          style={{
            flexShrink: 0,
            width: 24,
            height: 24,
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            fontSize: 16,
            color: theme.colors.textMuted,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
          }}
        >
          ×
        </button>
      )}
    </div>
  );
}
