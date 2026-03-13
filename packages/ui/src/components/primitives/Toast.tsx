/**
 * Toast / Notification System
 *
 * Provides a lightweight, accessible notification system for transient messages.
 * Supports stacking, auto-dismiss, different variants, and ARIA live regions.
 *
 * Usage:
 *   const { addToast, ToastContainer } = useToast();
 *   addToast({ title: 'Saved!', variant: 'success' });
 *   // Render <ToastContainer /> at the root of your app
 */
import React from 'react';
import { useTheme } from '../../ThemeContext';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type ToastVariant = 'info' | 'success' | 'warning' | 'danger';
export type ToastPosition =
  | 'top-right'
  | 'top-left'
  | 'top-center'
  | 'bottom-right'
  | 'bottom-left'
  | 'bottom-center';

export interface ToastItem {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
  duration?: number; // ms, 0 = persistent
  dismissible?: boolean;
  action?: { label: string; onClick: () => void };
}

export interface ToastContainerProps {
  position?: ToastPosition;
  maxVisible?: number;
}

export interface UseToastReturn {
  addToast: (toast: Omit<ToastItem, 'id'>) => string;
  removeToast: (id: string) => void;
  clearAll: () => void;
  toasts: ToastItem[];
  ToastContainer: React.FC<ToastContainerProps>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Icons
// ─────────────────────────────────────────────────────────────────────────────

const variantIcons: Record<ToastVariant, string> = {
  info: 'ℹ️',
  success: '✓',
  warning: '⚠',
  danger: '✕',
};

// ─────────────────────────────────────────────────────────────────────────────
// Toast Component
// ─────────────────────────────────────────────────────────────────────────────

interface SingleToastProps {
  toast: ToastItem;
  onDismiss: (id: string) => void;
}

function SingleToast({ toast, onDismiss }: SingleToastProps) {
  const { theme } = useTheme();
  const [exiting, setExiting] = React.useState(false);
  const timerRef = React.useRef<ReturnType<typeof setTimeout>>();

  const variantColors: Record<ToastVariant, { bg: string; border: string; text: string; icon: string }> = {
    info: { bg: theme.colors.infoSubtle, border: theme.colors.info, text: theme.colors.infoText, icon: theme.colors.info },
    success: { bg: theme.colors.successSubtle, border: theme.colors.success, text: theme.colors.successText, icon: theme.colors.success },
    warning: { bg: theme.colors.warningSubtle, border: theme.colors.warning, text: theme.colors.warningText, icon: theme.colors.warning },
    danger: { bg: theme.colors.dangerSubtle, border: theme.colors.danger, text: theme.colors.dangerText, icon: theme.colors.danger },
  };

  const colors = variantColors[toast.variant];
  const duration = toast.duration ?? 5000;

  React.useEffect(() => {
    if (duration > 0) {
      timerRef.current = setTimeout(() => {
        setExiting(true);
        setTimeout(() => onDismiss(toast.id), 300);
      }, duration);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [duration, toast.id, onDismiss]);

  const handleDismiss = React.useCallback(() => {
    setExiting(true);
    setTimeout(() => onDismiss(toast.id), 300);
  }, [onDismiss, toast.id]);

  return (
    <div
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        padding: '12px 16px',
        backgroundColor: colors.bg,
        border: `1px solid ${colors.border}`,
        borderRadius: theme.radius.md,
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        fontFamily: theme.typography.family,
        minWidth: 300,
        maxWidth: 420,
        opacity: exiting ? 0 : 1,
        transform: exiting ? 'translateX(100%)' : 'translateX(0)',
        transition: 'opacity 0.3s ease, transform 0.3s ease',
        pointerEvents: 'auto',
      }}
    >
      {/* Icon */}
      <span
        style={{
          flexShrink: 0,
          width: 24,
          height: 24,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.icon,
          color: '#fff',
          fontSize: 12,
          fontWeight: 700,
        }}
        aria-hidden="true"
      >
        {variantIcons[toast.variant]}
      </span>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 14, color: theme.colors.text, lineHeight: '20px' }}>
          {toast.title}
        </div>
        {toast.description && (
          <div style={{ fontSize: 13, color: theme.colors.textSecondary, marginTop: 2, lineHeight: '18px' }}>
            {toast.description}
          </div>
        )}
        {toast.action && (
          <button
            onClick={toast.action.onClick}
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
            {toast.action.label}
          </button>
        )}
      </div>

      {/* Dismiss button */}
      {(toast.dismissible !== false) && (
        <button
          onClick={handleDismiss}
          aria-label="Dismiss notification"
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
            borderRadius: theme.radius.sm,
            padding: 0,
          }}
        >
          ×
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

let idCounter = 0;

export function useToast(): UseToastReturn {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);

  const addToast = React.useCallback((toast: Omit<ToastItem, 'id'>): string => {
    const id = `toast-${++idCounter}-${Date.now()}`;
    const item: ToastItem = { ...toast, id };
    setToasts((prev) => [...prev, item]);
    return id;
  }, []);

  const removeToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const clearAll = React.useCallback(() => setToasts([]), []);

  const ToastContainer: React.FC<ToastContainerProps> = React.useCallback(
    ({ position = 'top-right', maxVisible = 5 }: ToastContainerProps) => {
      const positionStyles = getPositionStyles(position);
      const visible = toasts.slice(-maxVisible);

      return (
        <div
          aria-label="Notifications"
          role="region"
          style={{
            position: 'fixed',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            pointerEvents: 'none',
            ...positionStyles,
          }}
        >
          {visible.map((t) => (
            <SingleToast key={t.id} toast={t} onDismiss={removeToast} />
          ))}
        </div>
      );
    },
    [toasts, removeToast],
  );

  return { addToast, removeToast, clearAll, toasts, ToastContainer };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function getPositionStyles(position: ToastPosition): React.CSSProperties {
  const base: React.CSSProperties = { margin: 16 };
  switch (position) {
    case 'top-right':
      return { ...base, top: 0, right: 0 };
    case 'top-left':
      return { ...base, top: 0, left: 0 };
    case 'top-center':
      return { ...base, top: 0, left: '50%', transform: 'translateX(-50%)' };
    case 'bottom-right':
      return { ...base, bottom: 0, right: 0 };
    case 'bottom-left':
      return { ...base, bottom: 0, left: 0 };
    case 'bottom-center':
      return { ...base, bottom: 0, left: '50%', transform: 'translateX(-50%)' };
  }
}
