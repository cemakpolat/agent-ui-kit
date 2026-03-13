/**
 * OllamaTestAgent - Auto-generates test prompts for all UI kit features
 * 
 * This service uses Ollama to:
 * 1. Generate creative test prompts for each UI feature
 * 2. Cover different scenarios (happy path, edge cases, errors)
 * 3. Provide natural language descriptions of expected outputs
 */

import type { IntentPayloadInput } from '@hari/core';

export interface TestPrompt {
  id: string;
  feature: string;
  category: 'basic' | 'advanced' | 'edge-case' | 'error-handling';
  prompt: string;
  expectedFeatures: string[];
  estimatedComplexity: 'simple' | 'medium' | 'complex';
}

export interface TestResult {
  id: string;
  testPrompt: TestPrompt;
  status: 'pending' | 'running' | 'success' | 'failed' | 'skipped';
  generatedIntent?: IntentPayloadInput;
  generationTime: number; // ms
  validationResults: ValidationResult[];
  error?: string;
  screenshot?: string;
  timestamp: number;
}

export interface ValidationResult {
  check: string;
  passed: boolean;
  details?: string;
}

const FEATURE_LIST = [
  'form',
  'chat',
  'document',
  'workflow',
  'kanban',
  'calendar',
  'tree',
  'timeline',
  'diagram',
  'action',
  'ambiguity',
  'presence',
];

const CATEGORIES = ['basic', 'advanced', 'edge-case', 'error-handling'] as const;

/**
 * Prompt template that instructs Ollama to generate test prompts
 */
const TEST_PROMPT_GENERATOR = (feature: string, category: string) => `
You are a QA engineer testing a UI component library called agent-ui-kit.

Generate a test prompt for testing the "${feature}" feature in category "${category}".

Requirements:
1. The prompt should be something a user would say to an AI agent
2. It should exercise various aspects of the ${feature} component
3. For "${category}" category, focus on:
   - basic: core functionality, happy path
   - advanced: complex scenarios with multiple features
   - edge-case: boundary conditions, unusual inputs
   - error-handling: error scenarios, recovery flows

4. Response format (JSON only, no markdown):
{
  "prompt": "The user-facing prompt text here",
  "expectedFeatures": ["feature1", "feature2"],
  "description": "What this test exercises",
  "complexity": "simple|medium|complex"
}
`;

/**
 * Generate a test prompt by querying Ollama
 */
export async function generateTestPrompt(
  feature: string,
  category: 'basic' | 'advanced' | 'edge-case' | 'error-handling',
  ollamaUrl: string = 'http://localhost:11434'
): Promise<TestPrompt> {
  const systemPrompt = TEST_PROMPT_GENERATOR(feature, category);

  try {
    const response = await fetch(`${ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama3.2:latest',
        prompt: systemPrompt,
        stream: false,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API returned ${response.status}`);
    }

    const data = await response.json();
    const responseText = data.response || '';

    // Extract JSON from response
    let generatedData: any;
    try {
      const cleanJson = responseText
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      generatedData = JSON.parse(cleanJson);
    } catch {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        generatedData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Could not extract JSON from Ollama response');
      }
    }

    return {
      id: `${feature}-${category}-${Date.now()}`,
      feature,
      category,
      prompt: generatedData.prompt || 'No prompt generated',
      expectedFeatures: generatedData.expectedFeatures || [],
      estimatedComplexity: generatedData.complexity || 'medium',
    };
  } catch (error) {
    console.error(`Failed to generate test prompt for ${feature}:`, error);
    throw error;
  }
}

/**
 * Generate a suite of test prompts for all features and categories
 */
export async function generateTestSuite(
  ollamaUrl: string = 'http://localhost:11434'
): Promise<TestPrompt[]> {
  const prompts: TestPrompt[] = [];

  for (const feature of FEATURE_LIST) {
    // Generate 2 prompts per feature (basic + one random category)
    const basicPrompt = await generateTestPrompt(feature, 'basic', ollamaUrl);
    prompts.push(basicPrompt);

    // Add one random advanced/edge-case prompt per feature
    const randomCategory = CATEGORIES[Math.floor(Math.random() * (CATEGORIES.length - 1)) + 1];
    const advancedPrompt = await generateTestPrompt(feature, randomCategory as any, ollamaUrl);
    prompts.push(advancedPrompt);
  }

  return prompts;
}

/**
 * Analyze generated intent against expected features
 */
export function validateIntent(
  intent: IntentPayloadInput,
  expectedFeatures: string[]
): ValidationResult[] {
  const results: ValidationResult[] = [];

  // Check 1: Intent has required fields
  results.push({
    check: 'Intent has type field',
    passed: Boolean(intent.type),
    details: `type: ${intent.type}`,
  });

  // Check 2: Has data field
  results.push({
    check: 'Intent has data field',
    passed: Boolean(intent.data),
    details: intent.data ? `${Object.keys(intent.data).length} properties` : 'No data',
  });

  // Check 3: Validate against expected features
  if (expectedFeatures.length > 0) {
    for (const feature of expectedFeatures) {
      const featurePresent = JSON.stringify(intent).toLowerCase().includes(feature.toLowerCase());
      results.push({
        check: `Contains expected feature: ${feature}`,
        passed: featurePresent,
      });
    }
  }

  // Check 4: Schema compliance (basic)
  const validTypes = [
    'form',
    'chat',
    'document',
    'workflow',
    'kanban',
    'calendar',
    'tree',
    'timeline',
    'diagram',
    'action',
    'ambiguity',
    'presence',
  ];
  results.push({
    check: 'Intent type is valid',
    passed: validTypes.includes(String(intent.type)),
    details: `type: ${intent.type}`,
  });

  return results;
}

/**
 * Pass/fail summary for test results
 */
export function summarizeValidation(results: ValidationResult[]): {
  passed: number;
  failed: number;
  total: number;
  passPercentage: number;
} {
  const passed = results.filter((r) => r.passed).length;
  const total = results.length;
  return {
    passed,
    failed: total - passed,
    total,
    passPercentage: total > 0 ? Math.round((passed / total) * 100) : 0,
  };
}

/**
 * Generate a UUID (simple version for testing)
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Simulate intent generation (for offline testing)
 */
export function createMockIntent(feature: string): IntentPayloadInput {
  const mockIntents: Record<string, IntentPayloadInput> = {
    form: {
      version: '1.0.0',
      intentId: generateId(),
      type: 'form',
      domain: 'testing',
      primaryGoal: 'Test form component',
      confidence: 0.9,
      data: {
        title: 'Test Form',
        sections: [
          {
            id: 's1',
            title: 'Basic Information',
            collapsible: false,
            defaultCollapsed: false,
            columns: 1 as const,
            fields: [
              {
                id: 'name',
                label: 'Full Name',
                type: 'text' as const,
                required: true,
              },
              {
                id: 'email',
                label: 'Email Address',
                type: 'text' as const,
                required: true,
              },
            ],
          },
        ],
      },
    },
    chat: {
      version: '1.0.0',
      intentId: generateId(),
      type: 'chat',
      domain: 'testing',
      primaryGoal: 'Test chat component',
      confidence: 0.9,
      data: {
        messages: [
          {
            id: '1',
            role: 'user',
            content: 'Hello agent',
            timestamp: Date.now(),
          },
          {
            id: '2',
            role: 'agent',
            content: 'Hello! How can I help?',
            timestamp: Date.now() + 1000,
          },
        ],
      },
    },
    document: {
      version: '1.0.0',
      intentId: generateId(),
      type: 'document',
      domain: 'testing',
      primaryGoal: 'Test document component',
      confidence: 0.9,
      data: {
        title: 'Test Document',
        sections: [
          {
            id: 's1',
            title: 'Overview',
            blocks: [
              { type: 'heading', level: 1, text: 'Test Document' },
              { type: 'paragraph', text: 'This is a test paragraph.' },
              { type: 'list', ordered: false, items: ['Item one', 'Item two', 'Item three'] },
            ],
          },
        ],
      },
    },
    workflow: {
      version: '1.0.0',
      intentId: generateId(),
      type: 'workflow',
      domain: 'testing',
      primaryGoal: 'Test workflow component',
      confidence: 0.9,
      data: {
        title: 'Test Workflow',
        steps: [
          { id: 's1', title: 'Step 1: Setup', description: 'Initial configuration', status: 'completed', type: 'info' },
          { id: 's2', title: 'Step 2: Configure', description: 'Configure settings', status: 'in_progress', type: 'form', fields: [] },
          { id: 's3', title: 'Step 3: Deploy', description: 'Deploy to production', status: 'pending', type: 'confirmation' },
        ],
        currentStepIndex: 1,
      },
    },
    kanban: {
      version: '1.0.0',
      intentId: generateId(),
      type: 'kanban',
      domain: 'testing',
      primaryGoal: 'Test kanban component',
      confidence: 0.9,
      data: {
        columns: [
          {
            id: 'todo',
            title: 'To Do',
            cards: [
              { id: '1', title: 'Task 1', priority: 'high' },
            ],
          },
        ],
      },
    },
    calendar: {
      version: '1.0.0',
      intentId: generateId(),
      type: 'calendar',
      domain: 'engineering',
      primaryGoal: 'Test calendar component',
      confidence: 0.9,
      data: {
        focusDate: new Date().toISOString().slice(0, 10),
        view: 'month',
        events: [
          {
            id: '1',
            title: 'On-Call Shift: Alice',
            start: new Date().toISOString().slice(0, 10) + 'T09:00:00Z',
            end: new Date().toISOString().slice(0, 10) + 'T17:00:00Z',
            category: 'oncall',
            color: '#6366f1',
          },
        ],
      },
    },
    tree: {
      version: '1.0.0',
      intentId: generateId(),
      type: 'tree',
      domain: 'testing',
      primaryGoal: 'Test tree component',
      confidence: 0.9,
      data: {
        title: 'Organization Chart',
        nodes: [
          {
            id: 'root',
            label: 'CEO',
            defaultExpanded: true,
            children: [
              { id: 'cto', label: 'CTO', children: [{ id: 'eng', label: 'Engineering', children: [] }] },
              { id: 'cmo', label: 'CMO', children: [] },
            ],
          },
        ],
      },
    },
    timeline: {
      version: '1.0.0',
      intentId: generateId(),
      type: 'timeline',
      domain: 'ops',
      primaryGoal: 'Test timeline component',
      confidence: 0.9,
      data: {
        events: [
          {
            id: '1',
            title: 'Deployment v1.2.0',
            timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
            description: 'Production deployment completed successfully',
            status: 'completed',
          },
          {
            id: '2',
            title: 'Rollback initiated',
            timestamp: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
            description: 'Rolled back due to elevated error rate',
            status: 'failed',
          },
        ],
      },
    },
    diagram: {
      version: '1.0.0',
      intentId: generateId(),
      type: 'diagram',
      domain: 'engineering',
      primaryGoal: 'Test diagram component',
      confidence: 0.9,
      data: {
        title: 'Test Diagram',
        description: 'A simple node/edge graph for testing',
        diagrams: [
          {
            kind: 'graph',
            id: 'd1',
            title: 'Service Topology',
            nodes: [
              { id: '1', label: 'Node 1', group: 'backend' },
              { id: '2', label: 'Node 2', group: 'backend' },
            ],
            edges: [
              { source: '1', target: '2', label: 'calls' },
            ],
          },
        ],
      },
    },
    action: {
      version: '1.0.0',
      intentId: generateId(),
      type: 'action',
      domain: 'testing',
      primaryGoal: 'Test action component',
      confidence: 0.9,
      data: {
        actions: [
          { id: '1', label: 'Button 1', type: 'primary' },
        ],
      },
    },
    ambiguity: {
      version: '1.0.0',
      intentId: generateId(),
      type: 'ambiguity',
      domain: 'testing',
      primaryGoal: 'Test ambiguity component',
      confidence: 0.9,
      data: {
        question: 'Please clarify',
        options: [
          { id: '1', text: 'Option 1' },
          { id: '2', text: 'Option 2' },
        ],
      },
    },
    presence: {
      version: '1.0.0',
      intentId: generateId(),
      type: 'presence',
      domain: 'testing',
      primaryGoal: 'Test presence component',
      confidence: 0.9,
      data: {
        users: [
          { id: '1', name: 'User 1', status: 'active' },
        ],
      },
    },
  };

  return mockIntents[feature] || mockIntents.document;
}
