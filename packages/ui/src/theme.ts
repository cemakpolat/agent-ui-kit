// ─────────────────────────────────────────────────────────────────────────────
// HARI Theming System
//
// Define a Theme as a set of design tokens. Pass a Theme to <ThemeProvider>
// and all HARI components will adapt their inline styles to it.
//
// Built-in themes:
//   lightTheme        — default, indigo accent on white
//   darkTheme         — dark slate background, light text
//   highContrastTheme — WCAG AAA, pure black/white with vivid accent
//   minimalTheme      — greyscale, no colour distractions
// ─────────────────────────────────────────────────────────────────────────────

export interface ThemeColors {
  /** Page / app background */
  background: string;
  /** Cards, panels, modals */
  surface: string;
  /** Alternating-row tables, lower-priority surfaces */
  surfaceAlt: string;
  /** Default border */
  border: string;
  /** Focused / selected element border */
  borderFocus: string;
  /** Primary text */
  text: string;
  /** Secondary / supporting text */
  textSecondary: string;
  /** Placeholder, very-muted labels */
  textMuted: string;

  // ── Semantic ───────────────────────────────────────────────────────────────
  /** Primary accent — buttons, links, active state */
  accent: string;
  /** Foreground text on accent backgrounds */
  accentText: string;
  /** Subtle accent tint — selected card bg, hover */
  accentSubtle: string;

  danger: string;
  dangerSubtle: string;
  dangerText: string;

  warning: string;
  warningSubtle: string;
  warningText: string;

  info: string;
  infoSubtle: string;
  infoText: string;

  success: string;
  successSubtle: string;
  successText: string;
}

export interface ThemeTypography {
  /** Base font family */
  family: string;
  /** Monospace font family (code blocks, raw payloads) */
  familyMono: string;
}

export interface ThemeBorderRadius {
  sm: string;
  md: string;
  lg: string;
}

export interface Theme {
  /** Unique identifier used as the CSS class / data attribute */
  id: string;
  /** Display label shown in theme pickers */
  label: string;
  colors: ThemeColors;
  typography: ThemeTypography;
  radius: ThemeBorderRadius;
}

// ─────────────────────────────────────────────────────────────────────────────
// Built-in themes
// ─────────────────────────────────────────────────────────────────────────────

export const lightTheme: Theme = {
  id: 'light',
  label: 'Light',
  colors: {
    background:    '#f8fafc',
    surface:       '#ffffff',
    surfaceAlt:    '#f1f5f9',
    border:        '#e2e8f0',
    borderFocus:   '#4f46e5',
    text:          '#1e293b',
    textSecondary: '#475569',
    textMuted:     '#94a3b8',

    accent:        '#4f46e5',
    accentText:    '#ffffff',
    accentSubtle:  '#eef2ff',

    danger:        '#dc2626',
    dangerSubtle:  '#fef2f2',
    dangerText:    '#b91c1c',

    warning:       '#d97706',
    warningSubtle: '#fffbeb',
    warningText:   '#854d0e',

    info:          '#0ea5e9',
    infoSubtle:    '#f0f9ff',
    infoText:      '#075985',

    success:       '#16a34a',
    successSubtle: '#f0fdf4',
    successText:   '#166534',
  },
  typography: {
    family:     'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    familyMono: '"Fira Code", "Cascadia Code", "JetBrains Mono", Menlo, Consolas, monospace',
  },
  radius: {
    sm: '0.25rem',
    md: '0.5rem',
    lg: '0.75rem',
  },
};

export const darkTheme: Theme = {
  id: 'dark',
  label: 'Dark',
  colors: {
    background:    '#0f172a',
    surface:       '#1e293b',
    surfaceAlt:    '#273549',
    border:        '#334155',
    borderFocus:   '#818cf8',
    text:          '#f1f5f9',
    textSecondary: '#94a3b8',
    textMuted:     '#64748b',

    accent:        '#818cf8',
    accentText:    '#0f172a',
    accentSubtle:  '#1e1b4b',

    danger:        '#f87171',
    dangerSubtle:  '#450a0a',
    dangerText:    '#fca5a5',

    warning:       '#fbbf24',
    warningSubtle: '#451a03',
    warningText:   '#fde68a',

    info:          '#38bdf8',
    infoSubtle:    '#0c2a3c',
    infoText:      '#bae6fd',

    success:       '#4ade80',
    successSubtle: '#052e16',
    successText:   '#bbf7d0',
  },
  typography: {
    family:     'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    familyMono: '"Fira Code", "Cascadia Code", "JetBrains Mono", Menlo, Consolas, monospace',
  },
  radius: {
    sm: '0.25rem',
    md: '0.5rem',
    lg: '0.75rem',
  },
};

export const highContrastTheme: Theme = {
  id: 'high-contrast',
  label: 'High Contrast',
  colors: {
    background:    '#000000',
    surface:       '#0d0d0d',
    surfaceAlt:    '#1a1a1a',
    border:        '#ffffff',
    borderFocus:   '#ffff00',
    text:          '#ffffff',
    textSecondary: '#e0e0e0',
    textMuted:     '#b0b0b0',

    accent:        '#ffff00',
    accentText:    '#000000',
    accentSubtle:  '#2a2a00',

    danger:        '#ff4444',
    dangerSubtle:  '#2a0000',
    dangerText:    '#ff8888',

    warning:       '#ffaa00',
    warningSubtle: '#2a1a00',
    warningText:   '#ffcc66',

    info:          '#44aaff',
    infoSubtle:    '#00162a',
    infoText:      '#88ccff',

    success:       '#44ff88',
    successSubtle: '#002a16',
    successText:   '#88ffbb',
  },
  typography: {
    family:     'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    familyMono: '"Fira Code", "Cascadia Code", "JetBrains Mono", Menlo, Consolas, monospace',
  },
  radius: {
    sm: '0.125rem',
    md: '0.25rem',
    lg: '0.375rem',
  },
};

export const minimalTheme: Theme = {
  id: 'minimal',
  label: 'Minimal',
  colors: {
    background:    '#fafafa',
    surface:       '#ffffff',
    surfaceAlt:    '#f4f4f5',
    border:        '#d4d4d8',
    borderFocus:   '#18181b',
    text:          '#18181b',
    textSecondary: '#52525b',
    textMuted:     '#a1a1aa',

    accent:        '#18181b',
    accentText:    '#ffffff',
    accentSubtle:  '#f4f4f5',

    danger:        '#e11d48',
    dangerSubtle:  '#fff1f2',
    dangerText:    '#9f1239',

    warning:       '#b45309',
    warningSubtle: '#fffbeb',
    warningText:   '#78350f',

    info:          '#0369a1',
    infoSubtle:    '#f0f9ff',
    infoText:      '#0c4a6e',

    success:       '#15803d',
    successSubtle: '#f0fdf4',
    successText:   '#14532d',
  },
  typography: {
    family:     '"Inter", system-ui, -apple-system, sans-serif',
    familyMono: 'ui-monospace, "SF Mono", Menlo, monospace',
  },
  radius: {
    sm: '0.125rem',
    md: '0.25rem',
    lg: '0.375rem',
  },
};

export const googleTheme: Theme = {
  id: 'google',
  label: 'Google',
  colors: {
    background:    '#ffffff',
    surface:       '#ffffff',
    surfaceAlt:    '#f1f3f4',
    border:        '#dadce0',
    borderFocus:   '#1a73e8',
    text:          '#202124',
    textSecondary: '#5f6368',
    textMuted:     '#80868b',

    accent:        '#1a73e8',
    accentText:    '#ffffff',
    accentSubtle:  '#e8f0fe',

    danger:        '#d93025',
    dangerSubtle:  '#fce8e6',
    dangerText:    '#c5221f',

    warning:       '#f29900',
    warningSubtle:  '#fef7e0',
    warningText:   '#ea8600',

    info:          '#1967d2',
    infoSubtle:    '#e8f0fe',
    infoText:      '#174ea6',

    success:       '#1e8e3e',
    successSubtle: '#e6f4ea',
    successText:   '#137333',
  },
  typography: {
    family:     '"Google Sans", Roboto, Arial, sans-serif',
    familyMono: '"Roboto Mono", monospace',
  },
  radius: {
    sm: '0.25rem',
    md: '0.5rem',
    lg: '1rem',
  },
};

export const angularTheme: Theme = {
  id: 'angular',
  label: 'Angular',
  colors: {
    background:    '#fafafa',
    surface:       '#ffffff',
    surfaceAlt:    '#f5f5f5',
    border:        '#e0e0e0',
    borderFocus:   '#dd0031',
    text:          '#000000',
    textSecondary: '#757575',
    textMuted:     '#9e9e9e',

    accent:        '#dd0031',
    accentText:    '#ffffff',
    accentSubtle:  '#fce4e4',

    danger:        '#f44336',
    dangerSubtle:  '#ffebee',
    dangerText:    '#d32f2f',

    warning:       '#ff9800',
    warningSubtle: '#fff3e0',
    warningText:   '#f57c00',

    info:          '#1976d2',
    infoSubtle:    '#e3f2fd',
    infoText:      '#1565c0',

    success:       '#4caf50',
    successSubtle: '#e8f5e9',
    successText:   '#388e3c',
  },
  typography: {
    family:     'Roboto, "Helvetica Neue", sans-serif',
    familyMono: 'monospace',
  },
  radius: {
    sm: '0.25rem',
    md: '0.25rem',
    lg: '0.25rem',
  },
};

export const reactTheme: Theme = {
  id: 'react',
  label: 'React',
  colors: {
    background:    '#282c34',
    surface:       '#20232a',
    surfaceAlt:    '#33373e',
    border:        '#444c56',
    borderFocus:   '#61dafb',
    text:          '#ffffff',
    textSecondary: '#a6b2c0',
    textMuted:     '#6b7280',

    accent:        '#61dafb',
    accentText:    '#282c34',
    accentSubtle:  '#283644',

    danger:        '#ff6b6b',
    dangerSubtle:  '#4a2323',
    dangerText:    '#ff8787',

    warning:       '#f5c06f',
    warningSubtle: '#4a3a23',
    warningText:   '#f7d08a',

    info:          '#61dafb',
    infoSubtle:    '#283644',
    infoText:      '#a0e8fc',

    success:       '#8ce99a',
    successSubtle: '#234a2a',
    successText:   '#b2f2bb',
  },
  typography: {
    family:     '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif',
    familyMono: 'source-code-pro, Menlo, Monaco, Consolas, "Courier New", monospace',
  },
  radius: {
    sm: '0.25rem',
    md: '0.375rem',
    lg: '0.5rem',
  },
};

export const tailwindTheme: Theme = {
  id: 'tailwind',
  label: 'Tailwind',
  colors: {
    background:    '#0f172a',
    surface:       '#1e293b',
    surfaceAlt:    '#334155',
    border:        '#475569',
    borderFocus:   '#38bdf8',
    text:          '#f8fafc',
    textSecondary: '#cbd5e1',
    textMuted:     '#94a3b8',

    accent:        '#38bdf8',
    accentText:    '#0f172a',
    accentSubtle:  '#0c4a6e',

    danger:        '#ef4444',
    dangerSubtle:  '#7f1d1d',
    dangerText:    '#fca5a5',

    warning:       '#f59e0b',
    warningSubtle: '#78350f',
    warningText:   '#fcd34d',

    info:          '#0ea5e9',
    infoSubtle:    '#082f49',
    infoText:      '#7dd3fc',

    success:       '#10b981',
    successSubtle: '#064e3b',
    successText:   '#6ee7b7',
  },
  typography: {
    family:     'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif',
    familyMono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
  },
  radius: {
    sm: '0.375rem',
    md: '0.5rem',
    lg: '0.75rem',
  },
};

export const spotifyTheme: Theme = {
  id: 'spotify',
  label: 'Spotify',
  colors: {
    background:    '#121212',
    surface:       '#181818',
    surfaceAlt:    '#282828',
    border:        '#333333',
    borderFocus:   '#1db954',
    text:          '#ffffff',
    textSecondary: '#b3b3b3',
    textMuted:     '#535353',

    accent:        '#1db954',
    accentText:    '#000000',
    accentSubtle:  '#1ed76033',

    danger:        '#e22134',
    dangerSubtle:  '#4a0b11',
    dangerText:    '#f4717e',

    warning:       '#ffa42b',
    warningSubtle: '#4a2f0c',
    warningText:   '#ffc875',

    info:          '#2e77d0',
    infoSubtle:    '#0d223b',
    infoText:      '#7ab4f5',

    success:       '#1db954',
    successSubtle: '#083618',
    successText:   '#1ed760',
  },
  typography: {
    family:     'Circular, "Helvetica Neue", Helvetica, Arial, sans-serif',
    familyMono: 'monospace',
  },
  radius: {
    sm: '0.25rem',
    md: '0.5rem',
    lg: '2rem',
  },
};

export const uberTheme: Theme = {
  id: 'uber',
  label: 'Uber',
  colors: {
    background:    '#ffffff',
    surface:       '#ffffff',
    surfaceAlt:    '#f6f6f6',
    border:        '#e2e2e2',
    borderFocus:   '#000000',
    text:          '#000000',
    textSecondary: '#545454',
    textMuted:     '#a6a6a6',

    accent:        '#000000',
    accentText:    '#ffffff',
    accentSubtle:  '#eeeeee',

    danger:        '#e11900',
    dangerSubtle:  '#fbeae8',
    dangerText:    '#b31400',

    warning:       '#ffc043',
    warningSubtle: '#fff8e8',
    warningText:   '#cc9a36',

    info:          '#276ef1',
    infoSubtle:    '#eef3fe',
    infoText:      '#1f58c1',

    success:       '#05a357',
    successSubtle:  '#e6f6ed',
    successText:   '#048246',
  },
  typography: {
    family:     '"Uber Move Text", system-ui, "Helvetica Neue", Helvetica, Arial, sans-serif',
    familyMono: 'monospace',
  },
  radius: {
    sm: '0',
    md: '0.25rem',
    lg: '0.5rem',
  },
};

/** All built-in themes keyed by id for easy lookup */
export const BUILT_IN_THEMES: Readonly<Record<string, Theme>> = {
  light:         lightTheme,
  dark:          darkTheme,
  'high-contrast': highContrastTheme,
  minimal:       minimalTheme,
  google:        googleTheme,
  angular:       angularTheme,
  react:         reactTheme,
  tailwind:      tailwindTheme,
  spotify:       spotifyTheme,
  uber:          uberTheme,
};

export const ALL_THEMES: Theme[] = [
  lightTheme, 
  darkTheme, 
  highContrastTheme, 
  minimalTheme,
  googleTheme,
  angularTheme,
  reactTheme,
  tailwindTheme,
  spotifyTheme,
  uberTheme
];

// ─────────────────────────────────────────────────────────────────────────────
// CSS custom property helpers
//
// Calling themeToCSSVars(theme) produces a Record<string, string> that can be
// spread into a React element's style prop:
//
//   <div style={themeToCSSVars(theme) as React.CSSProperties}>
// ─────────────────────────────────────────────────────────────────────────────

export function themeToCSSVars(theme: Theme): Record<string, string> {
  const c = theme.colors;
  const t = theme.typography;
  const r = theme.radius;
  return {
    '--hari-bg':             c.background,
    '--hari-surface':        c.surface,
    '--hari-surface-alt':    c.surfaceAlt,
    '--hari-border':         c.border,
    '--hari-border-focus':   c.borderFocus,
    '--hari-text':           c.text,
    '--hari-text-secondary': c.textSecondary,
    '--hari-text-muted':     c.textMuted,

    '--hari-accent':         c.accent,
    '--hari-accent-text':    c.accentText,
    '--hari-accent-subtle':  c.accentSubtle,

    '--hari-danger':         c.danger,
    '--hari-danger-subtle':  c.dangerSubtle,
    '--hari-danger-text':    c.dangerText,

    '--hari-warning':        c.warning,
    '--hari-warning-subtle': c.warningSubtle,
    '--hari-warning-text':   c.warningText,

    '--hari-info':           c.info,
    '--hari-info-subtle':    c.infoSubtle,
    '--hari-info-text':      c.infoText,

    '--hari-success':        c.success,
    '--hari-success-subtle': c.successSubtle,
    '--hari-success-text':   c.successText,

    '--hari-font':           t.family,
    '--hari-font-mono':      t.familyMono,

    '--hari-radius-sm':      r.sm,
    '--hari-radius-md':      r.md,
    '--hari-radius-lg':      r.lg,
  };
}
