/**
 * Accordion
 *
 * Accessible expand/collapse sections following WAI-ARIA Accordion pattern.
 * Supports single or multiple expanded, keyboard navigation.
 *
 * Usage:
 *   <Accordion
 *     items={[
 *       { id: 'faq1', title: 'Question', content: <p>Answer</p> },
 *     ]}
 *   />
 */
import React from 'react';
import { useTheme } from '../../ThemeContext';

export interface AccordionItem {
  id: string;
  title: string;
  content: React.ReactNode;
  disabled?: boolean;
  icon?: string;
}

export interface AccordionProps {
  items: AccordionItem[];
  /** Only one section open at a time */
  single?: boolean;
  defaultExpanded?: string[];
  variant?: 'default' | 'bordered' | 'separated';
}

export function Accordion({
  items,
  single = false,
  defaultExpanded = [],
  variant = 'default',
}: AccordionProps) {
  const { theme } = useTheme();
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set(defaultExpanded));

  const toggle = React.useCallback(
    (id: string) => {
      setExpanded((prev) => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
        } else {
          if (single) next.clear();
          next.add(id);
        }
        return next;
      });
    },
    [single],
  );

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent, index: number) => {
      const enabledItems = items.filter((i) => !i.disabled);
      let nextIndex: number | null = null;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          nextIndex = (index + 1) % enabledItems.length;
          break;
        case 'ArrowUp':
          e.preventDefault();
          nextIndex = (index - 1 + enabledItems.length) % enabledItems.length;
          break;
        case 'Home':
          e.preventDefault();
          nextIndex = 0;
          break;
        case 'End':
          e.preventDefault();
          nextIndex = enabledItems.length - 1;
          break;
      }

      if (nextIndex !== null) {
        const btn = document.getElementById(`accordion-btn-${enabledItems[nextIndex].id}`);
        btn?.focus();
      }
    },
    [items],
  );

  const separatorStyle: React.CSSProperties =
    variant === 'separated'
      ? { marginBottom: 8, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.md, overflow: 'hidden' }
      : {};

  return (
    <div
      role="presentation"
      style={{
        border: variant === 'bordered' ? `1px solid ${theme.colors.border}` : 'none',
        borderRadius: variant === 'bordered' ? theme.radius.md : 0,
        overflow: variant === 'bordered' ? 'hidden' : undefined,
        fontFamily: theme.typography.family,
      }}
    >
      {items.map((item, index) => {
        const isOpen = expanded.has(item.id);
        const isDisabled = item.disabled;
        const headerId = `accordion-btn-${item.id}`;
        const panelId = `accordion-panel-${item.id}`;

        return (
          <div key={item.id} style={separatorStyle}>
            {/* Header */}
            <h3 style={{ margin: 0 }}>
              <button
                id={headerId}
                aria-expanded={isOpen}
                aria-controls={panelId}
                aria-disabled={isDisabled}
                onClick={() => !isDisabled && toggle(item.id)}
                onKeyDown={(e) => handleKeyDown(e, index)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  padding: '12px 16px',
                  fontSize: 14,
                  fontWeight: 500,
                  fontFamily: theme.typography.family,
                  color: isDisabled ? theme.colors.textMuted : theme.colors.text,
                  backgroundColor: isOpen ? theme.colors.surfaceAlt : theme.colors.surface,
                  border: 'none',
                  borderBottom:
                    variant !== 'separated' && index < items.length - 1
                      ? `1px solid ${theme.colors.border}`
                      : 'none',
                  cursor: isDisabled ? 'not-allowed' : 'pointer',
                  textAlign: 'left',
                  outline: 'none',
                  transition: 'background-color 0.15s',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {item.icon && <span aria-hidden="true">{item.icon}</span>}
                  {item.title}
                </span>
                <span
                  aria-hidden="true"
                  style={{
                    fontSize: 12,
                    transform: isOpen ? 'rotate(180deg)' : 'rotate(0)',
                    transition: 'transform 0.2s ease',
                    color: theme.colors.textMuted,
                    flexShrink: 0,
                  }}
                >
                  ▼
                </span>
              </button>
            </h3>

            {/* Panel */}
            <div
              id={panelId}
              role="region"
              aria-labelledby={headerId}
              hidden={!isOpen}
              style={{
                padding: isOpen ? '12px 16px' : 0,
                maxHeight: isOpen ? 'none' : 0,
                overflow: 'hidden',
                fontSize: 14,
                color: theme.colors.textSecondary,
                lineHeight: '22px',
                backgroundColor: theme.colors.surface,
              }}
            >
              {isOpen && item.content}
            </div>
          </div>
        );
      })}
    </div>
  );
}
