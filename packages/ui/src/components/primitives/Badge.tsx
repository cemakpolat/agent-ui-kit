/**
 * Badge
 *
 * Inline badge/chip for status labels, counts, tags.
 * Theme-aware with multiple variants.
 *
 * Usage:
 *   <Badge>New</Badge>
 *   <Badge variant="success" dot>Active</Badge>
 *   <Badge variant="danger" size="sm">3</Badge>
 */
import React from 'react';
import { useTheme } from '../../ThemeContext';

export type BadgeVariant = 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'outline';
export type BadgeSize = 'sm' | 'md' | 'lg';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: BadgeSize;
  /** Show a status dot before the label */
  dot?: boolean;
  /** Make it pill-shaped (fully rounded) */
  pill?: boolean;
  /** Remove handler — shows an × */
  onRemove?: () => void;
}

export function Badge({
  children,
  variant = 'default',
  size = 'md',
  dot = false,
  pill = true,
  onRemove,
}: BadgeProps) {
  const { theme } = useTheme();

  const sizeStyles: Record<BadgeSize, React.CSSProperties> = {
    sm: { fontSize: 10, padding: '1px 6px', lineHeight: '16px' },
    md: { fontSize: 12, padding: '2px 8px', lineHeight: '18px' },
    lg: { fontSize: 14, padding: '3px 10px', lineHeight: '20px' },
  };

  const variantStyles: Record<BadgeVariant, { bg: string; color: string; border: string; dotColor: string }> = {
    default: {
      bg: theme.colors.surfaceAlt,
      color: theme.colors.textSecondary,
      border: theme.colors.border,
      dotColor: theme.colors.textMuted,
    },
    primary: {
      bg: theme.colors.accentSubtle,
      color: theme.colors.accent,
      border: theme.colors.accent,
      dotColor: theme.colors.accent,
    },
    success: {
      bg: theme.colors.successSubtle,
      color: theme.colors.successText,
      border: theme.colors.success,
      dotColor: theme.colors.success,
    },
    warning: {
      bg: theme.colors.warningSubtle,
      color: theme.colors.warningText,
      border: theme.colors.warning,
      dotColor: theme.colors.warning,
    },
    danger: {
      bg: theme.colors.dangerSubtle,
      color: theme.colors.dangerText,
      border: theme.colors.danger,
      dotColor: theme.colors.danger,
    },
    info: {
      bg: theme.colors.infoSubtle,
      color: theme.colors.infoText,
      border: theme.colors.info,
      dotColor: theme.colors.info,
    },
    outline: {
      bg: 'transparent',
      color: theme.colors.text,
      border: theme.colors.border,
      dotColor: theme.colors.textMuted,
    },
  };

  const v = variantStyles[variant];
  const s = sizeStyles[size];

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        ...s,
        fontWeight: 600,
        fontFamily: theme.typography.family,
        backgroundColor: v.bg,
        color: v.color,
        border: variant === 'outline' ? `1px solid ${v.border}` : 'none',
        borderRadius: pill ? 999 : theme.radius.sm,
        whiteSpace: 'nowrap',
        verticalAlign: 'middle',
      }}
    >
      {dot && (
        <span
          aria-hidden="true"
          style={{
            width: size === 'sm' ? 5 : 6,
            height: size === 'sm' ? 5 : 6,
            borderRadius: '50%',
            backgroundColor: v.dotColor,
            flexShrink: 0,
          }}
        />
      )}
      {children}
      {onRemove && (
        <button
          onClick={onRemove}
          aria-label="Remove"
          style={{
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            fontSize: size === 'sm' ? 10 : 12,
            color: v.color,
            padding: 0,
            marginLeft: 2,
            display: 'flex',
            alignItems: 'center',
            opacity: 0.7,
          }}
        >
          ×
        </button>
      )}
    </span>
  );
}
