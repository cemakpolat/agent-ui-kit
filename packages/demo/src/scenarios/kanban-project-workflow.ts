import type { IntentPayloadInput } from '@hari/core';

// ─────────────────────────────────────────────────────────────────────────────
// Kanban scenario: "Project Workflow Board"
//
// Demonstrates a simple two-column project workflow board with To-Do and
// In-Progress columns, WIP limits, priorities, tags, and assignees.
// ─────────────────────────────────────────────────────────────────────────────

export const kanbanProjectWorkflowIntent: IntentPayloadInput = {
  version: '1.0.0',
  intentId: 'b47ac10b-58cc-4372-a567-0e02b2c3d479',
  type: 'kanban',
  domain: 'project',
  primaryGoal: 'Visualize the project workflow and track tasks and progress',
  confidence: 0.9,
  density: 'operator',

  data: {
    title: 'Project Kanban Board',
    showCardCount: true,
    showWipLimits: true,
    columns: [
      {
        id: 'column1',
        title: 'To-Do',
        color: '#4CAF50',
        wipLimit: 5,
        cards: [
          {
            id: 'card1',
            title: 'Task 1',
            description: 'Description of task 1',
            priority: 'low',
            tags: ['tag1', 'tag2'],
            assignee: 'John Doe',
          },
          {
            id: 'card2',
            title: 'Task 2',
            description: 'Description of task 2',
            priority: 'medium',
            tags: ['tag3', 'tag4'],
            assignee: 'Jane Smith',
          },
        ],
      },
      {
        id: 'column2',
        title: 'In Progress',
        color: '#2196F3',
        wipLimit: 3,
        cards: [
          {
            id: 'card3',
            title: 'Task 3',
            description: 'Description of task 3',
            priority: 'high',
            tags: ['tag5', 'tag6'],
            assignee: 'John Doe',
          },
          {
            id: 'card4',
            title: 'Task 4',
            description: 'Description of task 4',
            priority: 'low',
            tags: ['tag7', 'tag8'],
            assignee: 'Jane Smith',
          },
        ],
      },
    ],
  },
};
