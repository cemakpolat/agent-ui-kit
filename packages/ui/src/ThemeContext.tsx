import React from 'react';
import { lightTheme, themeToCSSVars } from './theme';
import type { Theme } from './theme';

// ─────────────────────────────────────────────────────────────────────────────
// ThemeContext
//
// Usage:
//
//   import { ThemeProvider, useTheme, darkTheme } from '@hari/ui';
//
//   // Wrap your app (or any sub-tree) in a ThemeProvider:
//   <ThemeProvider theme={darkTheme}>
//     <App />
//   </ThemeProvider>
//
//   // Inside any component:
//   const { theme } = useTheme();
//   <div style={{ color: theme.colors.text }}>…</div>
//
// ThemeProvider also injects CSS custom properties (--hari-*) on the root
// wrapper element, so components can optionally use var(--hari-accent) etc.
// in their inline styles without calling useTheme().
// ─────────────────────────────────────────────────────────────────────────────

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = React.createContext<ThemeContextValue>({
  theme: lightTheme,
  setTheme: () => undefined,
});

// ─────────────────────────────────────────────────────────────────────────────
// ThemeProvider
// ─────────────────────────────────────────────────────────────────────────────

interface ThemeProviderProps {
  /** Initial theme. Defaults to lightTheme. */
  theme?: Theme;
  /** Called whenever the theme changes (useful for persisting the choice). */
  onThemeChange?: (theme: Theme) => void;
  children: React.ReactNode;
}

export function ThemeProvider({ theme: initialTheme, onThemeChange, children }: ThemeProviderProps) {
  const [theme, setThemeState] = React.useState<Theme>(initialTheme ?? lightTheme);

  // Sync when the prop changes externally (controlled usage).
  React.useEffect(() => {
    if (initialTheme) setThemeState(initialTheme);
  }, [initialTheme]);

  const setTheme = React.useCallback(
    (next: Theme) => {
      setThemeState(next);
      onThemeChange?.(next);
    },
    [onThemeChange],
  );

  // Derive CSS custom properties once per theme change.
  const cssVars = React.useMemo(() => themeToCSSVars(theme), [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      <div
        data-hari-theme={theme.id}
        style={{
          ...(cssVars as React.CSSProperties),
          backgroundColor: theme.colors.background,
          color: theme.colors.text,
          fontFamily: theme.typography.family,
        }}
      >
        {children}
      </div>
    </ThemeContext.Provider>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// useTheme hook
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Access the current theme and a setter from any component inside a ThemeProvider.
 *
 * @example
 * const { theme, setTheme } = useTheme();
 * <button onClick={() => setTheme(darkTheme)}>Switch to dark</button>
 */
export function useTheme(): ThemeContextValue {
  return React.useContext(ThemeContext);
}
