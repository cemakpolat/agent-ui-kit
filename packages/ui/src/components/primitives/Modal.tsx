/**
 * Modal / Dialog
 *
 * A general-purpose accessible modal with focus trap, Escape-to-close,
 * backdrop click, and proper ARIA attributes.
 *
 * Usage:
 *   <Modal open={isOpen} onClose={() => setIsOpen(false)} title="Confirm">
 *     <p>Are you sure?</p>
 *   </Modal>
 */
import React from 'react';
import { useTheme } from '../../ThemeContext';

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: ModalSize;
  /** Hide the close (×) button */
  hideCloseButton?: boolean;
  /** Prevent closing on backdrop click */
  preventBackdropClose?: boolean;
  /** Footer content (e.g. action buttons) */
  footer?: React.ReactNode;
  /** Extra ARIA description */
  ariaDescription?: string;
}

const sizeWidths: Record<ModalSize, string> = {
  sm: '400px',
  md: '560px',
  lg: '720px',
  xl: '960px',
  full: '95vw',
};

export function Modal({
  open,
  onClose,
  title,
  children,
  size = 'md',
  hideCloseButton = false,
  preventBackdropClose = false,
  footer,
  ariaDescription,
}: ModalProps) {
  const { theme } = useTheme();
  const dialogRef = React.useRef<HTMLDivElement>(null);
  const previousActiveElement = React.useRef<Element | null>(null);
  const titleId = React.useId();
  const descId = React.useId();

  // Focus management: save previous focus, restore on close
  React.useEffect(() => {
    if (open) {
      previousActiveElement.current = document.activeElement;
      // Focus the dialog after a tick (to allow render)
      requestAnimationFrame(() => {
        dialogRef.current?.focus();
      });
    } else if (previousActiveElement.current instanceof HTMLElement) {
      previousActiveElement.current.focus();
    }
  }, [open]);

  // Escape key handler
  React.useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // Focus trap
  React.useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const focusable = dialog.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    dialog.addEventListener('keydown', handleTab);
    return () => dialog.removeEventListener('keydown', handleTab);
  }, [open]);

  // Prevent body scroll when open
  React.useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(2px)',
      }}
      onClick={preventBackdropClose ? undefined : onClose}
      aria-hidden="true"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={ariaDescription ? descId : undefined}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: sizeWidths[size],
          maxWidth: '95vw',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: theme.colors.surface,
          border: `1px solid ${theme.colors.border}`,
          borderRadius: theme.radius.lg,
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          fontFamily: theme.typography.family,
          color: theme.colors.text,
          outline: 'none',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        {(title || !hideCloseButton) && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 20px',
              borderBottom: `1px solid ${theme.colors.border}`,
              flexShrink: 0,
            }}
          >
            {title && (
              <h2
                id={titleId}
                style={{
                  margin: 0,
                  fontSize: 18,
                  fontWeight: 600,
                  color: theme.colors.text,
                  lineHeight: '24px',
                }}
              >
                {title}
              </h2>
            )}
            {!hideCloseButton && (
              <button
                onClick={onClose}
                aria-label="Close dialog"
                style={{
                  width: 32,
                  height: 32,
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  fontSize: 20,
                  color: theme.colors.textMuted,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: theme.radius.sm,
                  marginLeft: 'auto',
                  padding: 0,
                  flexShrink: 0,
                }}
              >
                ×
              </button>
            )}
          </div>
        )}

        {/* Body */}
        <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
          {ariaDescription && (
            <div id={descId} style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)' }}>
              {ariaDescription}
            </div>
          )}
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: 8,
              padding: '12px 20px',
              borderTop: `1px solid ${theme.colors.border}`,
              flexShrink: 0,
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
