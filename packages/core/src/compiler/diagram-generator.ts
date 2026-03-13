/**
 * Diagram Generator
 *
 * Utilities to programmatically generate Mermaid diagrams for common visualization patterns:
 *   - Organization charts (team hierarchies)
 *   - Flowcharts (process, decision trees, state machines)
 *   - Sequence diagrams (interaction patterns, message flows)
 *   - Network/dependency graphs
 *
 * Usage:
 *   const markup = generateOrgChart({ ... });
 *   const mermaidDiagram: MermaidDiagram = {
 *     kind: 'mermaid',
 *     markup,
 *     title: 'Engineering Organization',
 *   };
 */

// ─────────────────────────────────────────────────────────────────────────────
// Organization Chart Generator
// ─────────────────────────────────────────────────────────────────────────────

export interface OrgChartNode {
  id: string;
  label: string;
  title?: string;
  team?: string;
  /** CSS colour hex or mermaid colour name (navy, teal, purple, green, orange) */
  color?: string;
  /** Icon or emoji */
  icon?: string;
  /** Parent node ID */
  parent?: string;
}

export interface OrgChartOptions {
  nodes: OrgChartNode[];
  /** Direction: TD (top-down, default) or LR (left-right) */
  direction?: 'TD' | 'LR';
  /** Show team names below role titles */
  showTeams?: boolean;
}

/**
 * Generate Mermaid org chart from node definitions.
 * Creates a hierarchical diagram with styling.
 */
export function generateOrgChart(opts: OrgChartOptions): string {
  const { nodes, direction = 'TD', showTeams = true } = opts;

  // Build node lookup
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const lines: string[] = [];

  lines.push(`graph ${direction}`);
  lines.push('');

  // Generate node definitions with labels and styling
  for (const node of nodes) {
    const fullLabel = showTeams && node.team
      ? `${node.label}<br/>${node.title ? `<i>${node.title}</i><br/>` : ''}<small>${node.team}</small>`
      : node.title ? `${node.label}<br/><i>${node.title}</i>` : node.label;

    const icon = node.icon ? `${node.icon} ` : '';
    const nodeDecl = `${node.id}["${icon}${fullLabel}"]`;

    lines.push(`    ${nodeDecl}`);

    if (node.color) {
      const colourName = node.color.startsWith('#') ? `fill:${node.color}` : node.color;
      lines.push(`    style ${node.id} fill:#${colourName.replace('#', '')},stroke:#333,color:#fff`);
    }
  }

  lines.push('');

  // Generate edges (parent → child relationships)
  const edges = new Set<string>();
  for (const node of nodes) {
    if (node.parent) {
      const parent = nodeMap.get(node.parent);
      if (parent) {
        edges.add(`    ${node.parent} --> ${node.id}`);
      }
    }
  }

  for (const edge of edges) {
    lines.push(edge);
  }

  return lines.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Flowchart Generator
// ─────────────────────────────────────────────────────────────────────────────

export interface FlowchartNode {
  id: string;
  label: string;
  /** Node shape: rect (default), diamond, circle, parallelogram, rhombus */
  shape?: 'rect' | 'diamond' | 'circle' | 'parallelogram' | 'rhombus';
  /** CSS colour hex */
  color?: string;
}

export interface FlowchartEdge {
  from: string;
  to: string;
  label?: string;
  /** Line style: solid (default), dashed, dotted */
  style?: 'solid' | 'dashed' | 'dotted';
}

export interface FlowchartOptions {
  nodes: FlowchartNode[];
  edges: FlowchartEdge[];
  title?: string;
  direction?: 'LR' | 'TD' | 'BT' | 'RL';
}

const shapeMap = {
  rect: (id: string, label: string) => `[${label}]`,
  diamond: (id: string, label: string) => `{${label}}`,
  circle: (id: string, label: string) => `((${label}))`,
  parallelogram: (id: string, label: string) => `[\\${label}/]`,
  rhombus: (id: string, label: string) => `{{${label}}}`,
};

/**
 * Generate Mermaid flowchart from node and edge definitions.
 */
export function generateFlowchart(opts: FlowchartOptions): string {
  const { nodes, edges, direction = 'LR' } = opts;

  const lines: string[] = [];
  lines.push(`flowchart ${direction}`);
  lines.push('');

  // Generate node definitions
  for (const node of nodes) {
    const shape = node.shape ?? 'rect';
    const shaper = shapeMap[shape] || shapeMap.rect;
    const nodeDecl = `    ${node.id}${shaper(node.id, node.label)}`;
    lines.push(nodeDecl);

    if (node.color) {
      lines.push(`    style ${node.id} fill:${node.color},stroke:#333,color:#fff`);
    }
  }

  lines.push('');

  // Generate edges
  for (const edge of edges) {
    let connector = '-->';
    if (edge.style === 'dashed') connector = '-..->';
    if (edge.style === 'dotted') connector = '-.->';

    const label = edge.label ? `|${edge.label}|` : '';
    lines.push(`    ${edge.from} ${connector}${label} ${edge.to}`);
  }

  return lines.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Sequence Diagram Generator
// ─────────────────────────────────────────────────────────────────────────────

export interface SequenceActor {
  id: string;
  label: string;
  type?: 'actor' | 'participant';
}

export interface SequenceMessage {
  from: string;
  to: string;
  label: string;
  /** solid (default), dashed, dotted */
  style?: 'solid' | 'dashed' | 'dotted';
  /** arrow style: sync (default), async, return */
  arrowType?: 'sync' | 'async' | 'return';
}

export interface SequenceDiagramOptions {
  actors: SequenceActor[];
  messages: SequenceMessage[];
  title?: string;
}

/**
 * Generate Mermaid sequence diagram from actor and message definitions.
 */
export function generateSequenceDiagram(opts: SequenceDiagramOptions): string {
  const { actors, messages, title } = opts;

  const lines: string[] = [];
  if (title) {
    lines.push(`---`);
    lines.push(`title: ${title}`);
    lines.push(`---`);
  }

  lines.push('sequenceDiagram');
  lines.push('');

  // Define participants
  for (const actor of actors) {
    const type = actor.type ?? 'participant';
    lines.push(`    ${type} ${actor.id} as ${actor.label}`);
  }

  lines.push('');

  // Define messages
  for (const msg of messages) {
    let arrow = '->';
    if (msg.style === 'dashed') arrow = '-->';
    if (msg.style === 'dotted') arrow = '-..->';

    if (msg.arrowType === 'async') arrow = '-' + (msg.style === 'dashed' ? '-' : '') + '>>';
    if (msg.arrowType === 'return') arrow = '--' + (msg.style === 'dashed' ? '>' : '>');

    lines.push(`    ${msg.from}${arrow}${msg.to}: ${msg.label}`);
  }

  return lines.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// State Machine / State Diagram Generator
// ─────────────────────────────────────────────────────────────────────────────

export interface StateTransition {
  from: string;
  to: string;
  label?: string;
}

export interface StateMachineOptions {
  states: string[];
  transitions: StateTransition[];
  initialState?: string;
  finalStates?: string[];
}

/**
 * Generate Mermaid state diagram from state and transition definitions.
 */
export function generateStateMachine(opts: StateMachineOptions): string {
  const { states, transitions, initialState, finalStates } = opts;

  const lines: string[] = [];
  lines.push('stateDiagram-v2');
  lines.push('');

  if (initialState) {
    lines.push(`    [*] --> ${initialState}`);
  }

  // Define transitions
  const edgeSet = new Set<string>();
  for (const transition of transitions) {
    const label = transition.label ? `: ${transition.label}` : '';
    edgeSet.add(`    ${transition.from} --> ${transition.to}${label}`);
  }

  for (const edge of edgeSet) {
    lines.push(edge);
  }

  lines.push('');

  if (finalStates && finalStates.length > 0) {
    for (const final of finalStates) {
      lines.push(`    ${final} --> [*]`);
    }
  }

  return lines.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Class/Entity Relationship Diagram Generator
// ─────────────────────────────────────────────────────────────────────────────

export interface ClassProperty {
  name: string;
  type: string;
  visibility?: '+' | '-' | '#' | '~';
}

export interface ClassDefinition {
  name: string;
  properties?: ClassProperty[];
  methods?: Array<{ name: string; returnType?: string }>;
  abstract?: boolean;
  interface?: boolean;
}

export interface EntityRelationship {
  from: string;
  to: string;
  relationship: 'inheritance' | 'composition' | 'aggregation' | 'association';
  label?: string;
}

export interface ClassDiagramOptions {
  classes: ClassDefinition[];
  relationships: EntityRelationship[];
}

/**
 * Generate Mermaid class diagram from class and relationship definitions.
 */
export function generateClassDiagram(opts: ClassDiagramOptions): string {
  const { classes, relationships } = opts;

  const lines: string[] = [];
  lines.push('classDiagram');
  lines.push('');

  // Define classes
  for (const cls of classes) {
    const isAbstract = cls.abstract ? '<<abstract>>' : '';
    const isInterface = cls.interface ? '<<interface>>' : '';
    const prefix = isAbstract || isInterface ? `class ${cls.name}${isAbstract}${isInterface}` : `class ${cls.name}`;

    lines.push(`    ${prefix}`);

    if (cls.properties) {
      for (const prop of cls.properties) {
        const vis = prop.visibility ?? '+';
        lines.push(`        ${vis}${prop.name} ${prop.type}`);
      }
    }

    if (cls.methods) {
      for (const method of cls.methods) {
        const returnType = method.returnType ? ` ${method.returnType}` : '';
        lines.push(`        +${method.name}()${returnType}`);
      }
    }
  }

  lines.push('');

  // Define relationships
  for (const rel of relationships) {
    const arrows: Record<string, string> = {
      inheritance: '<|--',
      composition: '*--',
      aggregation: 'o--',
      association: '--',
    };

    const arrow = arrows[rel.relationship] || '--';
    const label = rel.label ? ` : ${rel.label}` : '';
    lines.push(`    ${rel.from} ${arrow} ${rel.to}${label}`);
  }

  return lines.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Gantt Chart Generator
// ─────────────────────────────────────────────────────────────────────────────

export interface GanttTask {
  id: string;
  label: string;
  status: 'done' | 'active' | 'crit' | 'milestone';
  start: string; // 'YYYY-MM-DD' or reference to another task 'after taskId'
  duration?: string; // e.g., '10d', '2w'
  depends?: string[]; // task IDs this depends on
}

export interface GanttChartOptions {
  title?: string;
  tasks: GanttTask[];
  dateFormat?: string;
}

/**
 * Generate Mermaid Gantt chart from task definitions.
 */
export function generateGanttChart(opts: GanttChartOptions): string {
  const { tasks, dateFormat = 'YYYY-MM-DD', title } = opts;

  const lines: string[] = [];
  lines.push('gantt');

  if (title) {
    lines.push(`    title ${title}`);
  }

  lines.push(`    dateFormat ${dateFormat}`);
  lines.push('');

  for (const task of tasks) {
    const deps = task.depends?.length ? `, ${task.depends.join(',')}` : '';
    const duration = task.duration || '';
    lines.push(`    ${task.label} :${task.status} ${task.id}, ${task.start}, ${duration}${deps}`);
  }

  return lines.join('\n');
}
