import React from 'react';
import { useTheme } from '../ThemeContext';

// ── Per-theme icon libraries ─────────────────────────────────────────────────
import {
  Globe, Smartphone, Network, ShieldCheck, User, Package,
  CreditCard, Bell, Database, Settings, Bot, Cpu,
  Rocket, Wrench, FileText, BarChart,
} from 'lucide-react';

import {
  MdPublic, MdSmartphone, MdDeviceHub, MdSecurity, MdPerson, MdInventory,
  MdCreditCard, MdNotifications, MdStorage, MdSettings, MdSmartToy, MdMemory,
  MdRocketLaunch, MdBuild, MdInsertDriveFile, MdBarChart,
} from 'react-icons/md';

import {
  HiGlobeAlt, HiDevicePhoneMobile, HiServerStack, HiShieldCheck, HiUser, HiCube,
  HiCreditCard, HiBell, HiCircleStack, HiCog8Tooth, HiSparkles, HiCpuChip,
  HiRocketLaunch, HiWrenchScrewdriver, HiDocumentText, HiChartBar,
} from 'react-icons/hi2';

import {
  IoGlobeOutline, IoPhonePortraitOutline, IoGitNetworkOutline, IoShieldCheckmarkOutline,
  IoPersonOutline, IoCubeOutline, IoCardOutline, IoNotificationsOutline,
  IoServerOutline, IoSettingsOutline, IoSparklesOutline, IoHardwareChipOutline,
  IoRocketOutline, IoBuildOutline, IoDocumentTextOutline, IoBarChartOutline,
} from 'react-icons/io5';

// ─────────────────────────────────────────────────────────────────────────────

interface IconEntry {
  label: string;
  Lucide: React.ElementType;
  Md: React.ElementType;
  Hi: React.ElementType;
  Io: React.ElementType;
}

const SHOWCASE_ICONS: IconEntry[] = [
  { label: 'Web',          Lucide: Globe,       Md: MdPublic,         Hi: HiGlobeAlt,         Io: IoGlobeOutline },
  { label: 'Mobile',       Lucide: Smartphone,  Md: MdSmartphone,     Hi: HiDevicePhoneMobile, Io: IoPhonePortraitOutline },
  { label: 'Network',      Lucide: Network,     Md: MdDeviceHub,      Hi: HiServerStack,       Io: IoGitNetworkOutline },
  { label: 'Security',     Lucide: ShieldCheck, Md: MdSecurity,       Hi: HiShieldCheck,       Io: IoShieldCheckmarkOutline },
  { label: 'User',         Lucide: User,        Md: MdPerson,         Hi: HiUser,              Io: IoPersonOutline },
  { label: 'Package',      Lucide: Package,     Md: MdInventory,      Hi: HiCube,              Io: IoCubeOutline },
  { label: 'Payments',     Lucide: CreditCard,  Md: MdCreditCard,     Hi: HiCreditCard,        Io: IoCardOutline },
  { label: 'Alerts',       Lucide: Bell,        Md: MdNotifications,  Hi: HiBell,              Io: IoNotificationsOutline },
  { label: 'Database',     Lucide: Database,    Md: MdStorage,        Hi: HiCircleStack,       Io: IoServerOutline },
  { label: 'Settings',     Lucide: Settings,    Md: MdSettings,       Hi: HiCog8Tooth,         Io: IoSettingsOutline },
  { label: 'AI/Bot',       Lucide: Bot,         Md: MdSmartToy,       Hi: HiSparkles,          Io: IoSparklesOutline },
  { label: 'Chip/ML',      Lucide: Cpu,         Md: MdMemory,         Hi: HiCpuChip,           Io: IoHardwareChipOutline },
  { label: 'Deploy',       Lucide: Rocket,      Md: MdRocketLaunch,   Hi: HiRocketLaunch,      Io: IoRocketOutline },
  { label: 'Tools',        Lucide: Wrench,      Md: MdBuild,          Hi: HiWrenchScrewdriver, Io: IoBuildOutline },
  { label: 'Docs',         Lucide: FileText,    Md: MdInsertDriveFile, Hi: HiDocumentText,     Io: IoDocumentTextOutline },
  { label: 'Analytics',    Lucide: BarChart,    Md: MdBarChart,       Hi: HiChartBar,          Io: IoBarChartOutline },
];

function getActiveLibrary(themeId: string): { name: string; key: 'Lucide' | 'Md' | 'Hi' | 'Io'; desc: string } {
  if (themeId === 'google' || themeId === 'angular') {
    return { name: 'Material Design Icons', key: 'Md', desc: "Google's filled icon system — rounded shapes, balanced weight" };
  }
  if (themeId === 'tailwind') {
    return { name: 'Heroicons 2', key: 'Hi', desc: "Tailwind CSS's icon set — sharp outlines, clean strokes" };
  }
  if (themeId === 'uber') {
    return { name: 'Ionicons 5', key: 'Io', desc: 'Uber-style outlined icons — thin lines, geometric precision' };
  }
  return { name: 'Lucide', key: 'Lucide', desc: 'Default icon set — pixel-perfect, consistent stroke width' };
}

// ─────────────────────────────────────────────────────────────────────────────
// ThemeShowcase
// ─────────────────────────────────────────────────────────────────────────────

export function ThemeShowcase() {
  const { theme } = useTheme();
  const lib = getActiveLibrary(theme.id);

  const colorSwatches = [
    { name: 'Accent',  bg: theme.colors.accent,  text: theme.colors.accentText  },
    { name: 'Success', bg: theme.colors.success,  text: '#fff' },
    { name: 'Warning', bg: theme.colors.warning,  text: '#fff' },
    { name: 'Danger',  bg: theme.colors.danger,   text: '#fff' },
    { name: 'Info',    bg: theme.colors.info,      text: '#fff' },
    { name: 'Surface', bg: theme.colors.surfaceAlt, text: theme.colors.text },
  ];

  return (
    <div style={{
      backgroundColor: theme.colors.surface,
      border: `1px solid ${theme.colors.border}`,
      borderRadius: theme.radius.lg,
      padding: '1.5rem',
      fontFamily: theme.typography.family,
      color: theme.colors.text,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <span style={{
              backgroundColor: theme.colors.accent,
              color: theme.colors.accentText,
              fontWeight: 700,
              fontSize: '0.7rem',
              padding: '0.2rem 0.625rem',
              borderRadius: theme.radius.sm,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}>
              {theme.label} Theme
            </span>
            <span style={{ color: theme.colors.textMuted, fontSize: '0.75rem' }}>
              ID: <code style={{ fontFamily: theme.typography.familyMono, color: theme.colors.accent }}>{theme.id}</code>
            </span>
          </div>
          <p style={{ margin: '0.4rem 0 0', fontSize: '0.8rem', color: theme.colors.textSecondary }}>
            <strong style={{ color: theme.colors.text }}>Icon library:</strong> {lib.name} · {lib.desc}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          {colorSwatches.map(s => (
            <div key={s.name} style={{
              backgroundColor: s.bg,
              color: s.text,
              padding: '0.25rem 0.6rem',
              borderRadius: theme.radius.sm,
              fontSize: '0.65rem',
              fontWeight: 600,
              letterSpacing: '0.03em',
              border: `1px solid ${theme.colors.border}`,
            }}>
              {s.name}
            </div>
          ))}
        </div>
      </div>

      {/* Typography sample */}
      <div style={{
        backgroundColor: theme.colors.surfaceAlt,
        borderRadius: theme.radius.md,
        padding: '0.75rem 1rem',
        marginBottom: '1.25rem',
        fontSize: '0.8rem',
        color: theme.colors.textSecondary,
        border: `1px solid ${theme.colors.border}`,
      }}>
        <span style={{ fontWeight: 600, color: theme.colors.text, fontSize: '0.85rem' }}>
          The quick brown fox jumps over the lazy dog
        </span>
        {' '}—{' '}
        <code style={{ fontFamily: theme.typography.familyMono, fontSize: '0.78rem' }}>
          {theme.typography.family.split(',')[0].trim()}
        </code>
        {' '}·{' '}
        <span style={{ fontSize: '0.72rem' }}>Border radius: {theme.radius.md}</span>
      </div>

      {/* Icon grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
        gap: '0.625rem',
      }}>
        {SHOWCASE_ICONS.map(({ label, ...icons }) => {
          const Icon = icons[lib.key];
          return (
            <div key={label} style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.375rem',
              padding: '0.75rem 0.5rem',
              backgroundColor: theme.colors.surfaceAlt,
              borderRadius: theme.radius.md,
              border: `1px solid ${theme.colors.border}`,
              color: theme.colors.accent,
              cursor: 'default',
              transition: 'background 0.15s',
            }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = theme.colors.accentSubtle)}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = theme.colors.surfaceAlt)}
            >
              <Icon size={24} />
              <span style={{ fontSize: '0.62rem', color: theme.colors.textSecondary, textAlign: 'center', lineHeight: 1.2 }}>{label}</span>
            </div>
          );
        })}
      </div>

      <p style={{ margin: '0.875rem 0 0', fontSize: '0.7rem', color: theme.colors.textMuted, textAlign: 'center' }}>
        Switch themes using the <strong style={{ color: theme.colors.text }}>🎨 Theme</strong> picker in the header to see icons & colours update.
        Icons are active in Diagram, Tree, and Timeline views.
      </p>
    </div>
  );
}
