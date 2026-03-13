/**
 * Breadcrumb
 *
 * Accessible breadcrumb navigation following WAI-ARIA Breadcrumb pattern.
 *
 * Usage:
 *   <Breadcrumb
 *     items={[
 *       { label: 'Home', href: '/' },
 *       { label: 'Products', href: '/products' },
 *       { label: 'Widget' },
 *     ]}
 *   />
 */
import React from 'react';
import { useTheme } from '../../ThemeContext';

export interface BreadcrumbItem {
  label: string;
  href?: string;
  onClick?: () => void;
  icon?: string;
}

export interface BreadcrumbProps {
  items: BreadcrumbItem[];
  separator?: React.ReactNode;
  maxItems?: number;
}

export function Breadcrumb({ items, separator, maxItems }: BreadcrumbProps) {
  const { theme } = useTheme();
  const [expanded, setExpanded] = React.useState(false);

  const sep = separator ?? (
    <span
      aria-hidden="true"
      style={{ color: theme.colors.textMuted, fontSize: 12, margin: '0 6px' }}
    >
      /
    </span>
  );

  let displayItems = items;
  const shouldCollapse = maxItems && items.length > maxItems && !expanded;

  if (shouldCollapse) {
    displayItems = [
      items[0],
      { label: '…', onClick: () => setExpanded(true) },
      ...items.slice(-(maxItems - 1)),
    ];
  }

  return (
    <nav aria-label="Breadcrumb">
      <ol
        style={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          listStyle: 'none',
          margin: 0,
          padding: 0,
          fontFamily: theme.typography.family,
          fontSize: 14,
        }}
      >
        {displayItems.map((item, index) => {
          const isLast = index === displayItems.length - 1;
          const isEllipsis = item.label === '…';

          return (
            <li
              key={index}
              style={{
                display: 'flex',
                alignItems: 'center',
              }}
            >
              {index > 0 && sep}
              {isLast ? (
                <span
                  aria-current="page"
                  style={{
                    color: theme.colors.text,
                    fontWeight: 500,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  {item.icon && <span aria-hidden="true">{item.icon}</span>}
                  {item.label}
                </span>
              ) : isEllipsis ? (
                <button
                  onClick={item.onClick}
                  aria-label="Show all breadcrumb items"
                  style={{
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    color: theme.colors.textMuted,
                    fontSize: 14,
                    padding: '2px 4px',
                    fontFamily: theme.typography.family,
                  }}
                >
                  …
                </button>
              ) : item.href ? (
                <a
                  href={item.href}
                  onClick={
                    item.onClick
                      ? (e) => {
                          e.preventDefault();
                          item.onClick!();
                        }
                      : undefined
                  }
                  style={{
                    color: theme.colors.accent,
                    textDecoration: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  {item.icon && <span aria-hidden="true">{item.icon}</span>}
                  {item.label}
                </a>
              ) : (
                <button
                  onClick={item.onClick}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    cursor: item.onClick ? 'pointer' : 'default',
                    color: theme.colors.accent,
                    fontSize: 14,
                    padding: 0,
                    fontFamily: theme.typography.family,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  {item.icon && <span aria-hidden="true">{item.icon}</span>}
                  {item.label}
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
