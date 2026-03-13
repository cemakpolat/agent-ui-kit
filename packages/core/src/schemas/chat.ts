import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────────────────
// Chat / Conversation Schema
//
// The chat intent type renders a full-featured conversation thread between the
// user and an agent. Comparable to GitHub Copilot Chat, ChatGPT, or similar
// modern AI chat interfaces.
//
// Capabilities:
//   - Rich markdown rendering (code blocks, lists, tables, links, etc.)
//   - Message actions (copy, feedback, regenerate, edit)
//   - Suggested follow-up prompts
//   - Thinking/reasoning state with collapsible steps
//   - Citations & references inline
//   - Stop generation during streaming
//   - Welcome state with starter prompts
//   - File drag-and-drop attachments
//   - Auto-resize input with keyboard shortcuts
//
// Density mapping:
//   executive — compact message list, no timestamps or metadata
//   operator  — messages with timestamps, role indicators, status, actions
//   expert    — full detail: timestamps, attachments, metadata, citations, Why?
// ─────────────────────────────────────────────────────────────────────────────

export const ChatMessageRoleSchema = z.enum(['user', 'agent', 'system']);
export type ChatMessageRole = z.infer<typeof ChatMessageRoleSchema>;

export const ChatMessageStatusSchema = z.enum([
  'sent',
  'streaming',
  'thinking',
  'error',
]);
export type ChatMessageStatus = z.infer<typeof ChatMessageStatusSchema>;

export const ChatAttachmentSchema = z.object({
  /** Unique attachment identifier */
  id: z.string(),
  /** File name or display title */
  name: z.string(),
  /** MIME type, e.g. "image/png", "application/pdf" */
  type: z.string(),
  /** Human-readable file size, e.g. "1.2 MB" */
  size: z.string().optional(),
  /** URL to view or download the attachment */
  url: z.string().optional(),
});

export type ChatAttachment = z.infer<typeof ChatAttachmentSchema>;

/** A citation / reference that the agent used to generate a message */
export const ChatCitationSchema = z.object({
  /** Unique citation identifier */
  id: z.string(),
  /** Display label, e.g. "docs/api.md" or "Search result #3" */
  label: z.string(),
  /** URL to the source (optional — not all citations are linkable) */
  url: z.string().optional(),
  /** Short excerpt from the source */
  excerpt: z.string().optional(),
  /** Relevance score 0–1 (optional) */
  relevance: z.number().min(0).max(1).optional(),
});
export type ChatCitation = z.infer<typeof ChatCitationSchema>;

/** A reasoning / thinking step shown in a collapsible section */
export const ChatThinkingStepSchema = z.object({
  /** Step label, e.g. "Searching codebase…" */
  label: z.string(),
  /** Whether this step is still in progress */
  inProgress: z.boolean().default(false),
  /** Duration in milliseconds (shown when complete) */
  durationMs: z.number().optional(),
});
export type ChatThinkingStep = z.infer<typeof ChatThinkingStepSchema>;

/** User feedback on a message */
export const ChatFeedbackSchema = z.enum(['positive', 'negative']);
export type ChatFeedback = z.infer<typeof ChatFeedbackSchema>;

export const ChatMessageSchema = z.object({
  /** Unique message identifier */
  id: z.string(),
  /** Who sent this message */
  role: ChatMessageRoleSchema,
  /**
   * Message body — full markdown is supported including fenced code blocks,
   * headers, lists, tables, links, images, blockquotes, and task lists.
   * For streaming messages this may be a partial string.
   */
  content: z.string(),
  /**
   * Unix epoch milliseconds when this message was sent/received.
   * Used to render timestamps and sort messages.
   */
  timestamp: z.number(),
  /**
   * Delivery/rendering status.
   * - sent: message was delivered successfully
   * - streaming: content is still being received character-by-character
   * - thinking: agent is reasoning before generating content
   * - error: message failed to send or generate
   * @default 'sent'
   */
  status: ChatMessageStatusSchema.default('sent'),
  /** Optional file or media attachments */
  attachments: z.array(ChatAttachmentSchema).default([]),
  /** Extra key-value metadata shown in expert density */
  metadata: z.record(z.string(), z.unknown()).optional(),
  /** Links to an explainability entry in the parent IntentPayload */
  explainElementId: z.string().optional(),

  // ── New fields for modern chat UX ───────────────────────────────────────

  /**
   * Inline citations / references used to generate this message.
   * Rendered as expandable source cards below the message content.
   */
  citations: z.array(ChatCitationSchema).default([]),
  /**
   * Thinking / reasoning steps shown in a collapsible "Thinking…" section.
   * Only relevant for agent messages.
   */
  thinkingSteps: z.array(ChatThinkingStepSchema).default([]),
  /**
   * User feedback on this message (thumbs up / down).
   * Rendered in the message action toolbar.
   */
  feedback: ChatFeedbackSchema.optional(),
  /**
   * Whether this message has been edited by the user.
   * If true, an "edited" badge is shown.
   */
  isEdited: z.boolean().default(false),
});

export type ChatMessage = z.infer<typeof ChatMessageSchema>;

/** A suggested follow-up prompt shown as a clickable chip */
export const ChatSuggestionSchema = z.object({
  /** Unique suggestion identifier */
  id: z.string(),
  /** Display label for the chip */
  label: z.string(),
  /** The actual prompt text sent when clicked (defaults to label) */
  prompt: z.string().optional(),
  /** Optional icon name (e.g. "code", "search", "lightbulb") */
  icon: z.string().optional(),
});
export type ChatSuggestion = z.infer<typeof ChatSuggestionSchema>;

/** A starter prompt for the welcome/empty state */
export const ChatStarterPromptSchema = z.object({
  /** Unique identifier */
  id: z.string(),
  /** Short title */
  title: z.string(),
  /** Longer description */
  description: z.string().optional(),
  /** The actual prompt text sent when clicked */
  prompt: z.string(),
  /** Optional icon name */
  icon: z.string().optional(),
});
export type ChatStarterPrompt = z.infer<typeof ChatStarterPromptSchema>;

export const ChatDataSchema = z.object({
  /** Optional conversation heading */
  title: z.string().optional(),
  /** Ordered list of messages (oldest first) */
  messages: z.array(ChatMessageSchema),
  /**
   * ID of the message that is currently streaming.
   * The renderer animates that message differently.
   */
  streamingMessageId: z.string().optional(),
  /**
   * Placeholder text for the user input box.
   * @default 'Type a message…'
   */
  inputPlaceholder: z.string().default('Type a message…'),
  /**
   * Whether the user can attach files to their messages.
   * @default false
   */
  allowAttachments: z.boolean().default(false),
  /**
   * When true the input box is hidden (read-only conversation view).
   * @default false
   */
  readOnly: z.boolean().default(false),

  // ── New fields for modern chat UX ───────────────────────────────────────

  /**
   * Suggested follow-up prompts shown as clickable chips after the last
   * agent message. Cleared when the user sends a new message.
   */
  suggestions: z.array(ChatSuggestionSchema).default([]),
  /**
   * Starter prompts shown in the welcome/empty state when there are no
   * messages. Each is a clickable card that sends the prompt.
   */
  starterPrompts: z.array(ChatStarterPromptSchema).default([]),
  /**
   * Welcome heading shown in the empty state.
   * @default 'How can I help you today?'
   */
  welcomeTitle: z.string().default('How can I help you today?'),
  /**
   * Optional agent avatar URL or initials for the header/avatar.
   */
  agentAvatarUrl: z.string().optional(),
  /**
   * Agent display name shown in the header.
   * @default 'Agent'
   */
  agentName: z.string().default('Agent'),
  /**
   * Whether code blocks should show line numbers.
   * @default false
   */
  showCodeLineNumbers: z.boolean().default(false),
  /**
   * Whether to enable message search (Cmd/Ctrl+F within chat).
   * @default false
   */
  enableSearch: z.boolean().default(false),
});

export type ChatData = z.infer<typeof ChatDataSchema>;
