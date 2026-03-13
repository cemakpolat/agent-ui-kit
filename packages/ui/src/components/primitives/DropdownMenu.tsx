/**
 * DropdownMenu
 *
 * Accessible dropdown menu with keyboard navigation (Arrow keys, Escape, Enter).
 * Follows WAI-ARIA Menu pattern.
 *
 * Usage:
 *   <DropdownMenu
 *     trigger={<button>Actions</button>}
 *     items={[
 *       { id: 'edit', label: 'Edit', onClick: () => {} },
 *       { id: 'delete', label: 'Delete', variant: 'danger', onClick: () => {} },
 *     ]}
 *   />
 */
import React from 'react';
import { useTheme } from '../../ThemeContext';

export interface DropdownMenuItem {
  id: string;
  label: string;
  icon?: string;
  disabled?: boolean;
  variant?: 'default' | 'danger';
  onClick?: () => void;
}

export interface DropdownMenuDivider {
  id: string;
  type: 'divider';
}

export type DropdownMenuEntry = DropdownMenuItem | DropdownMenuDivider;

export interface DropdownMenuProps {
  trigger: React.ReactElement;
  items: DropdownMenuEntry[];
  /** Align menu to trigger */
  align?: 'left' | 'right';
  /** Width of the menu */
  width?: number | string;
}

function isDivider(entry: DropdownMenuEntry): entry is DropdownMenuDivider {
  return 'type' in entry && entry.type === 'divider';
}

export function DropdownMenu({ trigger, items, align = 'left', width = 200 }: DropdownMenuProps) {
  const { theme } = useTheme();
  const [open, setOpen] = React.useState(false);
  const [focusIndex, setFocusIndex] = React.useState(-1);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLDivElement>(null);
  const menuId = React.useId();

  const actionItems = items.filter((i): i is DropdownMenuItem => !isDivider(i));

  // Close on outside click
  React.useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Focus menu item
  React.useEffect(() => {
    if (!open || focusIndex < 0) return;
    const item = menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]')[focusIndex];
    item?.focus();
  }, [open, focusIndex]);

  const handleTriggerKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setOpen(true);
      setFocusIndex(0);
    }
  };

  const handleMenuKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setFocusIndex((prev) => {
          let next = prev + 1;
          while (next < actionItems.length && actionItems[next]?.disabled) next++;
          return next < actionItems.length ? next : prev;
        });
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusIndex((prev) => {
          let next = prev - 1;
          while (next >= 0 && actionItems[next]?.disabled) next--;
          return next >= 0 ? next : prev;
        });
        break;
      case 'Escape':
        e.preventDefault();
        setOpen(false);
        (triggerRef.current?.firstElementChild as HTMLElement)?.focus();
        break;
      case 'Home':
        e.preventDefault();
        setFocusIndex(0);
        break;
      case 'End':
        e.preventDefault();
        setFocusIndex(actionItems.length - 1);
        break;
    }
  };

  const handleItemClick = (item: DropdownMenuItem) => {
    if (item.disabled) return;
    item.onClick?.();
    setOpen(false);
  };

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      {/* Trigger */}
      <div
        ref={triggerRef}
        onClick={() => {
          setOpen((prev) => !prev);
          if (!open) setFocusIndex(-1);
        }}
        onKeyDown={handleTriggerKeyDown}
      >
        {React.cloneElement(trigger, {
          'aria-haspopup': 'menu',
          'aria-expanded': open,
          'aria-controls': open ? menuId : undefined,
        })}
      </div>

      {/* Menu */}
      {open && (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label="Actions"
          onKeyDown={handleMenuKeyDown}
          style={{
            position: 'absolute',
            top: '100%',
            [align === 'right' ? 'right' : 'left']: 0,
            marginTop: 4,
            width,
            backgroundColor: theme.colors.surface,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: theme.radius.md,
            boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
            zIndex: 9998,
            padding: '4px 0',
            fontFamily: theme.typography.family,
            overflow: 'hidden',
          }}
        >
          {items.map((entry) => {
            if (isDivider(entry)) {
              return (
                <div
                  key={entry.id}
                  role="separator"
                  style={{
                    height: 1,
                    backgroundColor: theme.colors.border,
                    margin: '4px 0',
                  }}
                />
              );
            }

            const item = entry;
            return (
              <button
                key={item.id}
                role="menuitem"
                aria-disabled={item.disabled}
                tabIndex={-1}
                onClick={() => handleItemClick(item)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleItemClick(item);
                  }
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  width: '100%',
                  padding: '8px 12px',
                  fontSize: 14,
                  fontFamily: theme.typography.family,
                  color: item.disabled
                    ? theme.colors.textMuted
                    : item.variant === 'danger'
                      ? theme.colors.danger
                      : theme.colors.text,
                  backgroundColor: 'transparent',
                  border: 'none',
                  cursor: item.disabled ? 'not-allowed' : 'pointer',
                  textAlign: 'left',
                  outline: 'none',
                  opacity: item.disabled ? 0.5 : 1,
                }}
              >
                {item.icon && <span aria-hidden="true">{item.icon}</span>}
                {item.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
