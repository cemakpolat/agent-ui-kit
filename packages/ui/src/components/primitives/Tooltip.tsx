/**
 * Tooltip
 *
 * Accessible tooltip that appears on hover/focus with configurable placement.
 * Uses `role="tooltip"` and `aria-describedby` for screen readers.
 *
 * Usage:
 *   <Tooltip content="More info">
 *     <button>Hover me</button>
 *   </Tooltip>
 */
import React from 'react';
import { useTheme } from '../../ThemeContext';

export type TooltipPlacement = 'top' | 'bottom' | 'left' | 'right';

export interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactElement;
  placement?: TooltipPlacement;
  delay?: number;
  disabled?: boolean;
}

export function Tooltip({
  content,
  children,
  placement = 'top',
  delay = 300,
  disabled = false,
}: TooltipProps) {
  const { theme } = useTheme();
  const [visible, setVisible] = React.useState(false);
  const tooltipId = React.useId();
  const timerRef = React.useRef<ReturnType<typeof setTimeout>>();
  const containerRef = React.useRef<HTMLDivElement>(null);

  const show = React.useCallback(() => {
    if (disabled) return;
    timerRef.current = setTimeout(() => setVisible(true), delay);
  }, [delay, disabled]);

  const hide = React.useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setVisible(false);
  }, []);

  React.useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const placementStyles = React.useMemo((): React.CSSProperties => {
    const arrow = 8;
    switch (placement) {
      case 'top':
        return { bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: arrow };
      case 'bottom':
        return { top: '100%', left: '50%', transform: 'translateX(-50%)', marginTop: arrow };
      case 'left':
        return { right: '100%', top: '50%', transform: 'translateY(-50%)', marginRight: arrow };
      case 'right':
        return { left: '100%', top: '50%', transform: 'translateY(-50%)', marginLeft: arrow };
    }
  }, [placement]);

  return (
    <div
      ref={containerRef}
      style={{ position: 'relative', display: 'inline-flex' }}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {React.cloneElement(children, {
        'aria-describedby': visible ? tooltipId : undefined,
      })}
      {visible && (
        <div
          id={tooltipId}
          role="tooltip"
          style={{
            position: 'absolute',
            ...placementStyles,
            zIndex: 10001,
            padding: '6px 10px',
            fontSize: 12,
            lineHeight: '16px',
            fontFamily: theme.typography.family,
            color: '#fff',
            backgroundColor: theme.colors.text === '#ffffff' ? '#374151' : '#1f2937',
            borderRadius: theme.radius.sm,
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
          }}
        >
          {content}
        </div>
      )}
    </div>
  );
}
