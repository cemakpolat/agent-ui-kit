/**
 * Avatar
 *
 * User/collaborator avatar with fallback initials, status indicator,
 * and stacking support for groups.
 *
 * Usage:
 *   <Avatar name="Alice" src="/alice.jpg" size="md" status="online" />
 *   <AvatarGroup max={3}>
 *     <Avatar name="Alice" />
 *     <Avatar name="Bob" />
 *     <Avatar name="Charlie" />
 *     <Avatar name="Dan" />
 *   </AvatarGroup>
 */
import React from 'react';
import { useTheme } from '../../ThemeContext';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type AvatarStatus = 'online' | 'offline' | 'away' | 'busy';

export interface AvatarProps {
  name: string;
  src?: string;
  size?: AvatarSize;
  status?: AvatarStatus;
  /** Custom background color (falls back to deterministic color from name) */
  color?: string;
  /** Optional click handler */
  onClick?: () => void;
}

const avatarSizes: Record<AvatarSize, number> = {
  xs: 24,
  sm: 32,
  md: 40,
  lg: 48,
  xl: 64,
};

const statusColors: Record<AvatarStatus, string> = {
  online: '#22c55e',
  offline: '#9ca3af',
  away: '#f59e0b',
  busy: '#ef4444',
};

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function deterministicColor(name: string): string {
  const palette = [
    '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316',
    '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return palette[Math.abs(hash) % palette.length];
}

export function Avatar({ name, src, size = 'md', status, color, onClick }: AvatarProps) {
  const { theme } = useTheme();
  const [imgError, setImgError] = React.useState(false);
  const px = avatarSizes[size];
  const fontSize = Math.round(px * 0.4);
  const bg = color ?? deterministicColor(name);
  const showInitials = !src || imgError;

  return (
    <span
      role={onClick ? 'button' : 'img'}
      aria-label={name}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: px,
        height: px,
        borderRadius: '50%',
        backgroundColor: showInitials ? bg : 'transparent',
        color: '#fff',
        fontSize,
        fontWeight: 600,
        fontFamily: theme.typography.family,
        overflow: 'hidden',
        cursor: onClick ? 'pointer' : 'default',
        border: `2px solid ${theme.colors.surface}`,
        flexShrink: 0,
        outline: 'none',
        userSelect: 'none',
      }}
    >
      {showInitials ? (
        getInitials(name)
      ) : (
        <img
          src={src}
          alt={name}
          onError={() => setImgError(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      )}

      {/* Status indicator */}
      {status && (
        <span
          aria-label={`Status: ${status}`}
          style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: Math.max(8, px * 0.25),
            height: Math.max(8, px * 0.25),
            borderRadius: '50%',
            backgroundColor: statusColors[status],
            border: `2px solid ${theme.colors.surface}`,
          }}
        />
      )}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Avatar Group
// ─────────────────────────────────────────────────────────────────────────────

export interface AvatarGroupProps {
  children: React.ReactNode;
  /** Max avatars to show before "+N" overflow */
  max?: number;
  size?: AvatarSize;
}

export function AvatarGroup({ children, max = 4, size = 'md' }: AvatarGroupProps) {
  const { theme } = useTheme();
  const items = React.Children.toArray(children);
  const visible = items.slice(0, max);
  const overflow = items.length - max;
  const px = avatarSizes[size];

  return (
    <div
      role="group"
      aria-label="User group"
      style={{ display: 'inline-flex', alignItems: 'center' }}
    >
      {visible.map((child, i) => (
        <div key={i} style={{ marginLeft: i === 0 ? 0 : -(px * 0.25) }}>
          {child}
        </div>
      ))}
      {overflow > 0 && (
        <span
          aria-label={`${overflow} more`}
          style={{
            marginLeft: -(px * 0.25),
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: px,
            height: px,
            borderRadius: '50%',
            backgroundColor: theme.colors.surfaceAlt,
            color: theme.colors.textSecondary,
            fontSize: Math.round(px * 0.35),
            fontWeight: 600,
            fontFamily: theme.typography.family,
            border: `2px solid ${theme.colors.surface}`,
          }}
        >
          +{overflow}
        </span>
      )}
    </div>
  );
}
