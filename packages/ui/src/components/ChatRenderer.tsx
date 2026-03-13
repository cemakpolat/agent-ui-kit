import React, { useMemo, useRef, useEffect, useState } from 'react';
import { ChatDataSchema, type ChatMessage, type ChatAttachment } from '@hari/core';
import { User, Bot, Info } from 'lucide-react';
import { useTheme } from '../ThemeContext';
import { useMessages } from '../i18n';

// ─────────────────────────────────────────────────────────────────────────────
// ChatRenderer
//
// Renders a conversation thread between a user and an agent.
// Supports density-aware presentation:
//   executive — compact list of messages, no timestamps
//   operator  — messages with role icons, timestamps, and status
//   expert    — full detail: timestamps, attachments, metadata, Why? buttons
//
// Streaming support: when a message's status is 'streaming', a blinking
// cursor is appended to indicate live generation.
// ─────────────────────────────────────────────────────────────────────────────

export interface ChatRendererProps {
  data: unknown;
  density?: 'executive' | 'operator' | 'expert';
  onExplain?: (elementId: string) => void;
  onSendMessage?: (message: string, attachments?: File[]) => void;
}

// ── Role styling (theme-aware) ─────────────────────────────────────────────────

const ROLE_META = {
  user: { label: 'You', icon: User, align: 'flex-end' as const },
  agent: { label: 'Agent', icon: Bot, align: 'flex-start' as const },
  system: { label: 'System', icon: Info, align: 'center' as const },
};

function useRoleConfig() {
  const { theme } = useTheme();
  return useMemo(() => ({
    user: {
      ...ROLE_META.user,
      bubbleBg: theme.colors.accentSubtle,
      bubbleBorder: theme.colors.borderFocus,
      labelColor: theme.colors.accent,
    },
    agent: {
      ...ROLE_META.agent,
      bubbleBg: theme.colors.surfaceAlt,
      bubbleBorder: theme.colors.border,
      labelColor: theme.colors.textSecondary,
    },
    system: {
      ...ROLE_META.system,
      bubbleBg: theme.colors.warningSubtle,
      bubbleBorder: theme.colors.warning,
      labelColor: theme.colors.warningText,
    },
  }), [theme]);
}

// ── Status indicator ───────────────────────────────────────────────────────────

function useStatusBadge(): Record<string, { label: string; style: React.CSSProperties }> {
  const { theme } = useTheme();
  const m = useMessages();
  return useMemo(() => ({
    streaming: {
      label: m.chatTyping,
      style: { background: theme.colors.infoSubtle, color: theme.colors.info },
    },
    error: {
      label: m.chatError,
      style: { background: theme.colors.dangerSubtle, color: theme.colors.danger },
    },
  }), [theme, m]);
}

// ── Utilities ──────────────────────────────────────────────────────────────────

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Simple markdown-to-inline-HTML: bold, italic, code spans, and newlines. */
function renderMarkdownInline(content: string): React.ReactNode {
  const parts = content.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*|\n)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={i} style={{ background: 'rgba(0,0,0,0.06)', borderRadius: '3px', padding: '0 3px', fontSize: '0.85em', fontFamily: 'monospace' }}>
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={i}>{part.slice(1, -1)}</em>;
    }
    if (part === '\n') {
      return <br key={i} />;
    }
    return part;
  });
}

// ── Attachment pill ────────────────────────────────────────────────────────────

function AttachmentPill({ attachment }: { attachment: ChatAttachment }) {
  const { theme } = useTheme();
  const isImage = attachment.type.startsWith('image/');
  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.3rem',
      background: theme.colors.surfaceAlt,
      border: `1px solid ${theme.colors.border}`,
      borderRadius: theme.radius.sm,
      padding: '0.2rem 0.5rem',
      fontSize: '0.75rem',
      color: theme.colors.textSecondary,
      marginTop: '0.25rem',
      marginRight: '0.25rem',
    }}>
      <span>{isImage ? '🖼' : '📎'}</span>
      <span>{attachment.name}</span>
      {attachment.size && <span style={{ color: '#94a3b8' }}>({attachment.size})</span>}
    </div>
  );
}

// ── Date separator ─────────────────────────────────────────────────────────────

function DateSeparator({ ts }: { ts: number }) {
  const { theme } = useTheme();
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem',
      margin: '0.75rem 0',
    }}>
      <div style={{ flex: 1, height: '1px', background: theme.colors.border }} />
      <span style={{ fontSize: '0.7rem', color: theme.colors.textMuted, whiteSpace: 'nowrap' }}>
        {formatDate(ts)}
      </span>
      <div style={{ flex: 1, height: '1px', background: theme.colors.border }} />
    </div>
  );
}

// ── Single message bubble ──────────────────────────────────────────────────────

interface MessageBubbleProps {
  message: ChatMessage;
  density: 'executive' | 'operator' | 'expert';
  isStreaming: boolean;
  onExplain?: (id: string) => void;
}

function MessageBubble({ message, density, isStreaming, onExplain }: MessageBubbleProps) {
  const { theme } = useTheme();
  const m = useMessages();
  const ROLE_CONFIG = useRoleConfig();
  const STATUS_BADGE = useStatusBadge();
  const config = ROLE_CONFIG[message.role] ?? ROLE_CONFIG.agent;
  const isSystem = message.role === 'system';
  const statusBadge = message.status && message.status !== 'sent' ? STATUS_BADGE[message.status] : null;
  const RoleIcon = config.icon;

  if (isSystem) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', margin: '0.5rem 0' }}>
        <div style={{
          background: config.bubbleBg,
          border: `1px solid ${config.bubbleBorder}`,
          borderRadius: '99px',
          padding: '0.2rem 0.9rem',
          fontSize: '0.75rem',
          color: config.labelColor,
          maxWidth: '70%',
          textAlign: 'center',
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
        }}>
          <RoleIcon size={12} />
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: config.align,
      marginBottom: '0.75rem',
    }}>
      {/* Role + timestamp header */}
      {density !== 'executive' && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.35rem',
          marginBottom: '0.2rem',
          flexDirection: message.role === 'user' ? 'row-reverse' : 'row',
        }}>
          <span style={{ fontSize: '0.9rem', color: config.labelColor }}>
            <RoleIcon size={14} />
          </span>
          <span style={{ fontSize: '0.7rem', fontWeight: 600, color: config.labelColor }}>{config.label}</span>
          {density === 'operator' || density === 'expert' ? (
            <span style={{ fontSize: '0.65rem', color: theme.colors.textMuted }}>{formatTime(message.timestamp)}</span>
          ) : null}
          {statusBadge && (
            <span style={{ fontSize: '0.65rem', borderRadius: '3px', padding: '0 4px', ...statusBadge.style }}>
              {statusBadge.label}
            </span>
          )}
        </div>
      )}

      {/* Bubble */}
      <div style={{
        background: config.bubbleBg,
        border: `1px solid ${config.bubbleBorder}`,
        borderRadius: '0.75rem',
        borderTopLeftRadius: message.role === 'user' ? '0.75rem' : '0.2rem',
        borderTopRightRadius: message.role === 'user' ? '0.2rem' : '0.75rem',
        padding: '0.55rem 0.75rem',
        maxWidth: '75%',
        wordBreak: 'break-word',
        opacity: message.status === 'error' ? 0.7 : 1,
      }}>
        <div style={{ fontSize: '0.875rem', color: theme.colors.text, lineHeight: 1.5 }}>
          {renderMarkdownInline(message.content)}
          {isStreaming && (
            <span
              className="chat-cursor"
              style={{
                display: 'inline-block',
                width: '2px',
                height: '1em',
                background: theme.colors.accent,
                verticalAlign: 'text-bottom',
                marginLeft: '2px',
                animation: 'blink 1s step-end infinite',
              }}
              aria-hidden="true"
            />
          )}
        </div>

        {/* Attachments */}
        {density === 'expert' && message.attachments.length > 0 && (
          <div style={{ marginTop: '0.35rem' }}>
            {message.attachments.map((a) => (
              <AttachmentPill key={a.id} attachment={a} />
            ))}
          </div>
        )}

        {/* Metadata (expert only) */}
        {density === 'expert' && message.metadata && Object.keys(message.metadata).length > 0 && (
          <div style={{ marginTop: '0.35rem', display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
            {Object.entries(message.metadata).map(([k, v]) => (
              <span key={k} style={{ fontSize: '0.65rem', background: theme.colors.surfaceAlt, color: theme.colors.textSecondary, borderRadius: '3px', padding: '1px 5px' }}>
                {k}: {String(v)}
              </span>
            ))}
          </div>
        )}

        {/* Why? button */}
        {density === 'expert' && message.explainElementId && (
          <button
            onClick={() => onExplain?.(message.explainElementId!)}
            aria-label={m.explain}
            style={{ marginTop: '0.3rem', fontSize: '0.7rem', background: 'none', border: `1px solid ${theme.colors.border}`, borderRadius: '3px', padding: '1px 6px', cursor: 'pointer', color: theme.colors.textMuted }}
          >
            {m.explain}
          </button>
        )}
      </div>

      {/* Error notice */}
      {message.status === 'error' && (
        <div style={{ fontSize: '0.65rem', color: theme.colors.danger, marginTop: '0.15rem' }}>
          {m.chatError}
        </div>
      )}
    </div>
  );
}

// ── Input box ──────────────────────────────────────────────────────────────────

interface InputBarProps {
  placeholder: string;
  allowAttachments: boolean;
  onSend: (message: string) => void;
}

function InputBar({ placeholder, allowAttachments, onSend }: InputBarProps) {
  const { theme } = useTheme();
  const m = useMessages();
  const [value, setValue] = useState('');

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (value.trim()) {
        onSend(value.trim());
        setValue('');
      }
    }
  };

  const handleSendClick = () => {
    if (value.trim()) {
      onSend(value.trim());
      setValue('');
    }
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-end',
      gap: '0.5rem',
      padding: '0.75rem',
      borderTop: `1px solid ${theme.colors.border}`,
      background: theme.colors.surface,
    }}>
      {allowAttachments && (
        <button
          title="Attach file"
          aria-label="Attach file"
          style={{ background: 'none', border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.sm, padding: '0.4rem 0.5rem', cursor: 'pointer', fontSize: '1rem', color: theme.colors.textMuted, flexShrink: 0 }}
        >
          📎
        </button>
      )}
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={1}
        style={{
          flex: 1,
          resize: 'none',
          border: `1px solid ${theme.colors.border}`,
          borderRadius: theme.radius.md,
          padding: '0.5rem 0.75rem',
          fontSize: '0.875rem',
          fontFamily: theme.typography.family,
          color: theme.colors.text,
          backgroundColor: theme.colors.surface,
          lineHeight: 1.5,
          outline: 'none',
          maxHeight: '120px',
          overflowY: 'auto',
        }}
        aria-label="Message input"
      />
      <button
        onClick={handleSendClick}
        disabled={!value.trim()}
        style={{
          background: value.trim() ? theme.colors.accent : theme.colors.surfaceAlt,
          color: value.trim() ? theme.colors.accentText : theme.colors.textMuted,
          border: 'none',
          borderRadius: theme.radius.md,
          padding: '0.5rem 0.75rem',
          cursor: value.trim() ? 'pointer' : 'default',
          fontSize: '1rem',
          flexShrink: 0,
          transition: 'background 0.15s',
        }}
        aria-label={m.chatSend}
      >
        ↑
      </button>
    </div>
  );
}

// ── Main renderer ──────────────────────────────────────────────────────────────

export function ChatRenderer({ data, density = 'operator', onExplain, onSendMessage }: ChatRendererProps) {
  const { theme } = useTheme();
  const m = useMessages();
  const parsed = useMemo(() => {
    const result = ChatDataSchema.safeParse(data);
    return result.success ? result.data : null;
  }, [data]);

  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (bottomRef.current && typeof bottomRef.current.scrollIntoView === 'function') {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [parsed?.messages.length]);

  if (!parsed) {
    return (
      <div style={{ padding: '1rem', color: theme.colors.danger, fontSize: '0.875rem' }}>
        {m.chatInvalidData}
      </div>
    );
  }

  const { title, messages, streamingMessageId, inputPlaceholder, allowAttachments, readOnly } = parsed;

  // Group messages by date for date separators
  const groups: { date: string; ts: number; messages: ChatMessage[] }[] = [];
  for (const msg of messages) {
    const date = new Date(msg.timestamp).toDateString();
    const last = groups[groups.length - 1];
    if (!last || last.date !== date) {
      groups.push({ date, ts: msg.timestamp, messages: [msg] });
    } else {
      last.messages.push(msg);
    }
  }

  return (
    <div style={{ fontFamily: theme.typography.family, display: 'flex', flexDirection: 'column', maxWidth: '100%', minHeight: '300px', maxHeight: '600px', border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.lg, overflow: 'hidden', background: theme.colors.surface }}>
      {/* Header */}
      {title && (
        <div style={{ padding: '0.75rem 1rem', borderBottom: `1px solid ${theme.colors.border}`, background: theme.colors.surfaceAlt }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: theme.colors.text, margin: 0 }}>{title}</h2>
        </div>
      )}

      {/* Inline blink animation style — respects prefers-reduced-motion */}
      <style>{`
        @keyframes blink { 50% { opacity: 0; } }
        @media (prefers-reduced-motion: reduce) { .chat-cursor { animation: none !important; } }
      `}</style>

      {/* Visually-hidden live region: announces "Agent is typing" during streaming */}
      <span
        aria-live="assertive"
        aria-atomic="true"
        style={{
          position: 'absolute',
          width: '1px',
          height: '1px',
          padding: 0,
          margin: '-1px',
          overflow: 'hidden',
          clip: 'rect(0, 0, 0, 0)',
          whiteSpace: 'nowrap',
          borderWidth: 0,
        }}
      >
        {streamingMessageId ? m.chatTyping : ''}
      </span>

      {/* Message list — aria-live so new messages are announced to screen readers */}
      <div
        aria-live="polite"
        aria-atomic="false"
        aria-label="Conversation messages"
        style={{ flex: 1, overflowY: 'auto', padding: '0.75rem 1rem' }}
      >
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', color: theme.colors.textMuted, padding: '2rem', fontSize: '0.875rem' }}>
            {m.noData}
          </div>
        )}

        {groups.map((group) => (
          <div key={group.date}>
            {density !== 'executive' && <DateSeparator ts={group.ts} />}
            {group.messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                density={density}
                isStreaming={msg.id === streamingMessageId}
                onExplain={onExplain}
              />
            ))}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input bar (hidden in read-only or executive mode) */}
      {!readOnly && density !== 'executive' && (
        <InputBar
          placeholder={inputPlaceholder}
          allowAttachments={allowAttachments}
          onSend={(msg) => onSendMessage?.(msg)}
        />
      )}
    </div>
  );
}
