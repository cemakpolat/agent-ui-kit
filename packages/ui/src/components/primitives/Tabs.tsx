/**
 * Tabs
 *
 * Accessible tabbed interface following WAI-ARIA Tabs pattern.
 * Supports keyboard navigation (Arrow keys, Home, End).
 *
 * Usage:
 *   <Tabs
 *     tabs={[
 *       { id: 'overview', label: 'Overview', content: <Overview /> },
 *       { id: 'details', label: 'Details', content: <Details /> },
 *     ]}
 *   />
 */
import React from 'react';
import { useTheme } from '../../ThemeContext';

export interface TabItem {
  id: string;
  label: string;
  content: React.ReactNode;
  icon?: string;
  disabled?: boolean;
  badge?: string | number;
}

export interface TabsProps {
  tabs: TabItem[];
  defaultTab?: string;
  activeTab?: string;
  onChange?: (tabId: string) => void;
  variant?: 'default' | 'pills' | 'underline';
  /** Full-width tabs (equal width) */
  fullWidth?: boolean;
}

export function Tabs({
  tabs,
  defaultTab,
  activeTab: controlledActive,
  onChange,
  variant = 'default',
  fullWidth = false,
}: TabsProps) {
  const { theme } = useTheme();
  const [internalActive, setInternalActive] = React.useState(defaultTab ?? tabs[0]?.id);
  const tabListRef = React.useRef<HTMLDivElement>(null);

  const activeId = controlledActive ?? internalActive;
  const activeTab = tabs.find((t) => t.id === activeId) ?? tabs[0];

  const handleSelect = React.useCallback(
    (id: string) => {
      if (controlledActive === undefined) setInternalActive(id);
      onChange?.(id);
    },
    [controlledActive, onChange],
  );

  // Keyboard navigation: Arrow Left/Right, Home, End
  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      const enabledTabs = tabs.filter((t) => !t.disabled);
      const currentIndex = enabledTabs.findIndex((t) => t.id === activeId);
      let nextIndex: number | null = null;

      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowDown':
          e.preventDefault();
          nextIndex = (currentIndex + 1) % enabledTabs.length;
          break;
        case 'ArrowLeft':
        case 'ArrowUp':
          e.preventDefault();
          nextIndex = (currentIndex - 1 + enabledTabs.length) % enabledTabs.length;
          break;
        case 'Home':
          e.preventDefault();
          nextIndex = 0;
          break;
        case 'End':
          e.preventDefault();
          nextIndex = enabledTabs.length - 1;
          break;
      }

      if (nextIndex !== null) {
        const nextTab = enabledTabs[nextIndex];
        handleSelect(nextTab.id);
        // Focus the tab button
        const btn = tabListRef.current?.querySelector<HTMLButtonElement>(`[data-tab-id="${nextTab.id}"]`);
        btn?.focus();
      }
    },
    [tabs, activeId, handleSelect],
  );

  const getTabStyle = React.useCallback(
    (tab: TabItem): React.CSSProperties => {
      const isActive = tab.id === activeId;
      const isDisabled = tab.disabled;

      const base: React.CSSProperties = {
        padding: '8px 16px',
        fontSize: 14,
        fontWeight: isActive ? 600 : 400,
        fontFamily: theme.typography.family,
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        border: 'none',
        background: 'transparent',
        color: isDisabled
          ? theme.colors.textMuted
          : isActive
            ? theme.colors.accent
            : theme.colors.textSecondary,
        opacity: isDisabled ? 0.5 : 1,
        transition: 'color 0.15s, background-color 0.15s, border-color 0.15s',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        whiteSpace: 'nowrap',
        flex: fullWidth ? 1 : undefined,
        justifyContent: fullWidth ? 'center' : undefined,
        outline: 'none',
      };

      switch (variant) {
        case 'underline':
          return {
            ...base,
            borderBottom: `2px solid ${isActive ? theme.colors.accent : 'transparent'}`,
            borderRadius: 0,
            paddingBottom: 10,
          };
        case 'pills':
          return {
            ...base,
            backgroundColor: isActive ? theme.colors.accentSubtle : 'transparent',
            borderRadius: theme.radius.md,
            padding: '6px 14px',
          };
        default:
          return {
            ...base,
            borderBottom: `2px solid ${isActive ? theme.colors.accent : 'transparent'}`,
            borderRadius: 0,
          };
      }
    },
    [activeId, theme, variant, fullWidth],
  );

  return (
    <div>
      {/* Tab list */}
      <div
        ref={tabListRef}
        role="tablist"
        aria-label="Tabs"
        onKeyDown={handleKeyDown}
        style={{
          display: 'flex',
          borderBottom: variant === 'pills' ? 'none' : `1px solid ${theme.colors.border}`,
          gap: variant === 'pills' ? 4 : 0,
          padding: variant === 'pills' ? 4 : 0,
          backgroundColor: variant === 'pills' ? theme.colors.surfaceAlt : 'transparent',
          borderRadius: variant === 'pills' ? theme.radius.md : 0,
        }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            data-tab-id={tab.id}
            id={`tab-${tab.id}`}
            aria-selected={tab.id === activeId}
            aria-controls={`tabpanel-${tab.id}`}
            aria-disabled={tab.disabled}
            tabIndex={tab.id === activeId ? 0 : -1}
            onClick={() => !tab.disabled && handleSelect(tab.id)}
            style={getTabStyle(tab)}
          >
            {tab.icon && <span aria-hidden="true">{tab.icon}</span>}
            {tab.label}
            {tab.badge !== undefined && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  padding: '1px 6px',
                  borderRadius: 999,
                  backgroundColor: theme.colors.accentSubtle,
                  color: theme.colors.accent,
                  lineHeight: '16px',
                }}
              >
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab panel */}
      <div
        role="tabpanel"
        id={`tabpanel-${activeTab?.id}`}
        aria-labelledby={`tab-${activeTab?.id}`}
        tabIndex={0}
        style={{ padding: '16px 0' }}
      >
        {activeTab?.content}
      </div>
    </div>
  );
}
