import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────────────────
// Question Intent — Perception Requests
//
// HARI flips the control direction from passive rendering to active perception:
//
//   Old: Agent → UI → Human  (agent pushes, human receives)
//   New: Human question → Agent reasoning → HARI view → Human judgment
//
// A QuestionIntent captures the human's inquiry (explicit or inferred) and
// forces the agent to declare:
//   - What question it believes it is answering
//   - Why this view is a sufficient answer
//   - What would make it a better answer
//   - What follow-up questions are natural next steps
//
// This turns HARI into a **perception request system**, not a passive renderer.
// ─────────────────────────────────────────────────────────────────────────────

export const QuestionOriginSchema = z.enum([
  'human_explicit',     // Human typed/spoke the question
  'human_implicit',     // Inferred from human behaviour (click, navigation)
  'agent_proactive',    // Agent surfaced this without being asked
  'system_triggered',   // System event (alert, threshold, schedule)
  'follow_up',          // Follow-up to a previous question
]);

export type QuestionOrigin = z.infer<typeof QuestionOriginSchema>;

export const QuestionUrgencySchema = z.enum([
  'background',   // Informational, no time pressure
  'normal',       // Standard priority
  'urgent',       // Needs attention soon
  'critical',     // Requires immediate human attention
]);

export type QuestionUrgency = z.infer<typeof QuestionUrgencySchema>;

export const QuestionIntentSchema = z.object({
  /** Unique identifier for this question */
  questionId: z.string().uuid(),

  /** The question in natural language */
  question: z.string().min(1),

  /** Where this question originated */
  origin: QuestionOriginSchema,

  /** Urgency level — affects how the view is surfaced */
  urgency: QuestionUrgencySchema.default('normal'),

  /** Domain context (e.g., "infrastructure", "finance", "operations") */
  domain: z.string(),

  /** ISO 8601 timestamp when the question was posed */
  askedAt: z.string().datetime(),

  /** If this is a follow-up, the ID of the parent question */
  parentQuestionId: z.string().uuid().optional(),

  /**
   * Agent's declaration of why the resulting view is sufficient.
   * This is mandatory for governance — the agent must justify its answer.
   */
  sufficiencyStatement: z.string().optional(),

  /**
   * What would make the answer better — things the agent knows it's missing.
   * Mandatory transparency: the agent must declare its limitations.
   */
  limitations: z.array(z.string()).default([]),

  /**
   * Pre-seeded follow-up questions the human might naturally ask next.
   * These appear as quick-action chips in the UI.
   */
  suggestedFollowUps: z.array(z.object({
    question: z.string(),
    /** Why the agent thinks this is a natural next question */
    rationale: z.string().optional(),
  })).default([]),

  /**
   * The situational view ID that answers this question.
   * Linked after the view is generated.
   */
  answeredBy: z.string().uuid().optional(),

  /** Human's assessment after seeing the answer */
  humanFeedback: z.object({
    /** Did this answer the question? */
    adequate: z.boolean(),
    /** Optional refinement of the question */
    refinedQuestion: z.string().optional(),
    /** Timestamp of feedback */
    feedbackAt: z.string().datetime(),
  }).optional(),
});

export type QuestionIntent = z.infer<typeof QuestionIntentSchema>;
export type QuestionIntentInput = z.input<typeof QuestionIntentSchema>;

// ── Question Lifecycle ──────────────────────────────────────────────────────

export const QuestionStatusSchema = z.enum([
  'pending',     // Question asked, no answer yet
  'answering',   // Agent is generating a view
  'answered',    // View delivered, awaiting human judgment
  'refined',     // Human refined the question, agent re-processing
  'resolved',    // Human accepted the answer
  'dismissed',   // Human dismissed the question
]);

export type QuestionStatus = z.infer<typeof QuestionStatusSchema>;

/**
 * A QuestionThread groups a question with its follow-ups and refinements,
 * forming a perception conversation.
 */
export const QuestionThreadSchema = z.object({
  /** Root question ID */
  threadId: z.string().uuid(),
  /** Ordered list of question IDs in this thread */
  questions: z.array(z.string().uuid()).min(1),
  /** Current status of the thread */
  status: QuestionStatusSchema,
  /** ISO 8601 timestamp of thread creation */
  startedAt: z.string().datetime(),
  /** ISO 8601 timestamp of last activity */
  lastActivityAt: z.string().datetime(),
});

export type QuestionThread = z.infer<typeof QuestionThreadSchema>;
