import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { v4 as uuid } from 'uuid';
import {
  compileIntent,
  IntentPayloadSchema,
} from '@hari/core';
import type { IntentPayloadInput } from '@hari/core';
import {
  IntentRenderer,
  IntentErrorBoundary,
} from '@hari/ui';
import { registry } from '../registry';
import {
  Send,
  Loader,
  Bot,
  User,
  Settings,
  Sparkles,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// OllamaChatView — Conversational UI that generates HARI widgets inline
//
// The user chats with Ollama. Each agent response can include:
//   1. A text explanation
//   2. A structured HARI intent payload
//
// When an intent payload is present, it gets compiled and rendered as an
// interactive widget inline in the chat — forms, tables, charts, kanban
// boards, calendars, documents, diagrams, etc.
//
// This demonstrates the core HARI value proposition: agents dynamically
// generate rich, interactive UI components through conversation.
// ─────────────────────────────────────────────────────────────────────────────

/** A single chat message in the conversation */
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  /** If the assistant generated a HARI intent, it's stored here */
  intent?: IntentPayloadInput;
  /** Whether the intent was successfully parsed/rendered */
  intentError?: string;
  /** Raw Ollama response text for debugging */
  rawResponse?: string;
  /** Loading state for streaming */
  isLoading?: boolean;
}

// ── System prompt: instructs Ollama to generate HARI intents ─────────────────

// Current date injected at startup so the LLM generates correct dates
const NOW_ISO = new Date().toISOString().slice(0, 10); // e.g. "2026-02-28"
const NOW_YEAR_MONTH = NOW_ISO.slice(0, 7); // e.g. "2026-02"

const SYSTEM_PROMPT = `You are HARI Agent, an AI assistant that generates dynamic user interfaces through conversation.

Today's date is ${NOW_ISO}.

🎯 CRITICAL INSTRUCTION: WHEN TO USE ---INTENT_JSON---

Use ---INTENT_JSON--- ONLY when the user explicitly asks to:
- SEE, SHOW, DISPLAY, CREATE, or RENDER something visual (dashboards, tables, forms, boards, charts, documents, diagrams, etc.)
- SEARCH for items with specific parameters (flights, hotels, products)
- COMPARE multiple options with structured data
- VIEW a specific type of widget or visualization

Examples that REQUIRE ---INTENT_JSON---:
✓ "Show me flights from Berlin to Tokyo"
✓ "Create a kanban board for my tasks"
✓ "Generate an incident post-mortem report"
✓ "Display CPU and memory metrics"
✓ "Draw a system architecture diagram"

Examples that DO NOT use ---INTENT_JSON--- (just respond with text):
✗ "What is machine learning?" → plain text explanation
✗ "Why did the database fail?" → plain text explanation
✗ "How do I use Linux?" → code examples in markdown
✗ "Tell me about cloud computing" → educational prose

When the user asks a simple conversational question, requests an explanation, asks "what is", "how does", "why", "tell me about", or anything better answered in prose — respond with ONLY text, NO ---INTENT_JSON--- marker at all. The text will be rendered as markdown so you MAY use **bold**, \\\`inline code\\\`, bullet lists, and headings freely.

───────────────────────────────────────────────────────────────

RESPONSE FORMAT FOR INTENT PAYLOADS:

When you MUST generate an intent, always follow this exact format:

1. FIRST: A brief text explanation (1-3 sentences, plain text)
2. THEN: The marker "---INTENT_JSON---" on its own line (NO extra spaces or formatting)
3. THEN: A valid JSON intent payload

ATTENTION: Make sure the JSON is VALID. Check for:
✓ All field names are double-quoted
✓ All string values are double-quoted
✓ No trailing commas
✓ All braces and brackets are properly balanced
✓ All special characters in strings are properly escaped

The JSON intent payload must follow this exact structure:
{
  "version": "1.0.0",
  "intentId": "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx",  // Must be a valid UUID v4
  "type": "one of: form, document, comparison, diagnostic_overview, sensor_overview, timeline, workflow, kanban, calendar, tree, diagram, chat",
  "domain": "one of: travel, cloudops, iot, reports, deployment, product-analytics, engineering, hr, support, incident, project, ops, onboarding, collab",
  "primaryGoal": "descriptive goal of this widget",
  "confidence": 0.85,  // number between 0.0 and 1.0
  "density": "operator",
  "data": { /* type-specific data object */ }
}

Here are the supported types and their data shapes:

### type: "form"
domain: "deployment" or "incident"
data: {
  "formId": "string",
  "sections": [{ "id": "string", "title": "string", "fields": [{ "id": "string", "type": "text|number|select|textarea|checkbox|date|email|password|url", "label": "string", "placeholder": "string", "value": <default>, "required": boolean, "options": [{"label":"string","value":"string"}] }] }]
}

### type: "document"
domain: "reports" or "product-analytics" or "collab" or "engineering"

CRITICAL: For incident post-mortem reports, use domain="reports" and follow this structure:
---INTENT_JSON---
{
  "version": "1.0.0",
  "intentId": "550e8400-e29b-41d4-a716-446655440001",
  "type": "document",
  "domain": "reports",
  "primaryGoal": "Provide detailed incident analysis and remediation steps",
  "confidence": 0.95,
  "density": "operator",
  "data": {
    "title": "Incident Post-Mortem: Database Outage - February 27, 2026",
    "author": "HARI Agent",
    "summary": "A critical database outage occurred on February 27, 2026, lasting 30 minutes and affecting all production services. Root cause was identified as a configuration error in replication settings during a maintenance window.",
    "tags": ["database", "outage", "production", "resolved"],
    "sections": [
      {
        "id": "incident-overview",
        "title": "Incident Overview",
        "collapsible": false,
        "blocks": [
          {"type": "callout", "variant": "critical", "title": "Impact Summary", "text": "Total user impact: 487,234 affected services. Complete service unavailability for 30 minutes (10:45 AM to 11:15 AM UTC). Estimated revenue impact: $24,500. Recovery was successful with no data loss."},
          {"type": "paragraph", "text": "On February 27, 2026, at 10:45 AM UTC, our primary database instance became unresponsive, cascading to all dependent microservices. Monitoring systems immediately triggered alerts, and the on-call engineering team was notified within 2 minutes. The incident lasted until 11:15 AM UTC when the database recovered after initiating a rollback of replication settings."},
          {"type": "table", "headers": [{"key":"metric","label":"Metric"},{"key":"value","label":"Value"}], "rows": [{"metric":"Incident Duration","value":"30 minutes"},{"metric":"Services Affected","value":"247 microservices"},{"metric":"Users Impacted","value":"487,234"},{"metric":"MTTR (Mean Time To Restore)","value":"30 minutes"},{"metric":"Data Loss","value":"None"}], "caption": "Key incident metrics"}
        ]
      },
      {
        "id": "root-cause",
        "title": "Root Cause Analysis",
        "collapsible": false,
        "blocks": [
          {"type": "heading", "level": 3, "text": "Primary Root Cause"},
          {"type": "paragraph", "text": "A misconfigured replication parameter in the database master node was introduced during a routine maintenance window at 10:30 AM UTC. The parameter change disabled streaming replication, causing all replica connections to drop and the primary database to reject write requests after running out of connection pool capacity. The misconfiguration was a typo: 'max_wal_senders = 0' instead of the production value of 16."},
          {"type": "divider"},
          {"type": "heading", "level": 3, "text": "Contributing Factors"},
          {"type": "list", "ordered": true, "items": ["No pre-deployment validation of configuration changes against schema definitions", "Missing read-replica health check in the deployment pipeline that would catch connection failures", "Incident response runbook was outdated and directed engineers to wrong troubleshooting steps initially", "Database metrics dashboard did not prominently display replication status", "Maintenance required manual SSH access rather than infrastructure-as-code deployment"]}
        ]
      },
      {
        "id": "timeline",
        "title": "Incident Timeline",
        "collapsible": false,
        "blocks": [
          {"type": "table", "headers": [{"key":"time","label":"Time (UTC)"},{"key":"event","label":"Event"},{"key":"actor","label":"Responsible Team"}], "rows": [{"time":"10:30 AM","event":"Maintenance window begins; engineer deploys replication config change","actor":"Database Team"},{"time":"10:32 AM","event":"Replication parameter applied; read replicas lose connection","actor":"Database Automation"},{"time":"10:45 AM","event":"Primary database reaches max connection limit; begins rejecting writes","actor":"System"},{"time":"10:47 AM","event":"Monitoring alerts fire; on-call engineer notified","actor":"Observability"},{"time":"10:49 AM","event":"Engineer connects to database; identifies parameter error in logs","actor":"On-Call Engineer"},{"time":"11:00 AM","event":"Attempted rollback initiated","actor":"Database Team"},{"time":"11:15 AM","event":"Replication restored; database accepting connections again","actor":"System"}]}
        ]
      },
      {
        "id": "remediation",
        "title": "Immediate Actions & Remediation",
        "collapsible": false,
        "blocks": [
          {"type": "paragraph", "text": "Immediately following incident detection, the on-call team initiated the database recovery runbook. Connection monitoring showed replica lag exceeding 5 minutes, indicating replication was stalled. Parameter inspection revealed the misconfiguration, and a rollback was executed within 18 minutes of initial incident detection, restoring replication stream and connection pool availability."},
          {"type": "metric", "label": "MTTR Achievement", "value": "30", "unit": "minutes", "trend": "stable", "delta": "Within SLO (45-min target)"},
          {"type": "metric", "label": "Rollback Time", "value": "18", "unit": "minutes", "trend": "down", "delta": "-5 min vs avg"}
        ]
      },
      {
        "id": "preventive-measures",
        "title": "Preventive Measures & Follow-up",
        "collapsible": false,
        "blocks": [
          {"type": "heading", "level": 3, "text": "Implemented (Within 24 hours)"},
          {"type": "list", "ordered": false, "items": ["Added automated replica health check to CI/CD pipeline that validates replication parameters before deployment", "Updated incident response runbook with troubleshooting decision tree and database-specific diagnostics", "Enabled real-time replication lag alerting with threshold of 60 seconds", "Deployed centralized config validation schema to prevent parameter range violations"]},
          {"type": "divider"},
          {"type": "heading", "level": 3, "text": "Planned (Next 30 days)"},
          {"type": "list", "ordered": false, "items": ["Migrate database configuration to infrastructure-as-code (Terraform); eliminate manual SSH-based changes", "Implement canary deployment for database config changes with replica-only rollout before primary", "Add database state verification test to production pre-deployment checklist", "Conduct database incident response drill with all on-call rotation members"]}
        ]
      }
    ]
  }
}

Standard structure:
data: {
  "title": "string — descriptive title for the document",
  "author": "AI Assistant",
  "summary": "A 2-3 sentence executive summary of the whole document. This appears as a highlighted box at the top — make it informative.",
  "tags": ["tag1", "tag2"],
  "sections": [<array of section objects, each with multiple blocks>]
}

Each section:
{ "id": "unique-id", "title": "Section Title", "confidence": 0.9, "collapsible": true, "defaultCollapsed": false, "blocks": [<array of block objects>] }

Block types (use a MIX of these — never just paragraphs):
- paragraph: { "type": "paragraph", "text": "2-4 detailed sentences with specific facts, numbers, and analysis. Never one-liners.", "confidence": 0.9 }
- heading: { "type": "heading", "level": 1 to 6, "text": "Section heading text" }
- list: { "type": "list", "ordered": true/false, "items": ["Detailed item 1 with specifics", "Item 2 with data points", "Item 3"] }
- code: { "type": "code", "language": "python|sql|bash|yaml|json", "code": "actual useful code relevant to the topic" }
- table: { "type": "table", "headers": [{"key":"col1","label":"Column 1"},{"key":"col2","label":"Column 2"}], "rows": [{"col1":"value","col2":"value"}], "caption": "Optional table caption" }
- callout: { "type": "callout", "variant": "info|warning|insight|critical", "title": "Short title", "text": "Detailed callout text with specific information" }
- metric: { "type": "metric", "label": "Metric Name", "value": "42.5M", "trend": "up|down|stable", "delta": "+12% YoY", "unit": "optional unit" }
- quote: { "type": "quote", "text": "Notable quote or testimonial",  "author": "Person name (optional)", "source": "Source reference (optional)" }
- image: { "type": "image", "src": "https://url-to-image.png or data: URI", "alt": "alt text describing the image", "caption": "Optional caption shown below image", "width": "optional width in pixels or percentage" }
- dataviz: { "type": "dataviz", "chartType": "line|bar|pie|scatter|area|sparkline", "title": "Chart title", "data": [{"x": "Jan", "y": 120, "label": "optional label"}, {"x": "Feb", "y": 150}] }
- embed: { "type": "embed", "url": "https://embed-url.com", "fallbackText": "Text shown if embed fails", "height": "optional height in pixels" }
- divider: { "type": "divider" }

DOCUMENT QUALITY RULES — CRITICAL — you MUST follow ALL of these:
1. Create at LEAST 4-6 sections, each with 3-6 diverse blocks
2. Every paragraph MUST be 3-5 DETAILED sentences with real facts, statistics, specific names, dates, and numbers — NEVER write single-sentence paragraphs
3. Use DIVERSE block types in EVERY section — each section must have at least 2 different block types (e.g. paragraph + callout, paragraph + list, paragraph + table)
4. The FIRST section must start with a callout block (variant "insight" or "critical") summarizing the key takeaway
5. Include at least ONE table with 4+ rows of realistic data with 3+ columns
6. Include 3-5 metric blocks distributed across sections with realistic numeric values, trends ("up"/"down"/"stable"), and delta values
7. Lists should have 4-8 items, each item being a full phrase or sentence — not single words
8. NEVER generate shallow one-line paragraphs — each paragraph must be a substantive multi-sentence block
9. Code blocks (if relevant) must contain actual useful code, not placeholder snippets
10. Add a divider block between major topic transitions within a section
11. Use heading blocks (level 2–4) to create sub-structure within longer sections — use h3/h4 for sub-headings under section titles
12. Write with the depth and authority of a professional analyst producing a thorough production report
13. Each section's title should be descriptive (not "Section 1" — use topical titles like "Market Analysis" or "Historical Context")
14. The summary field must be a genuine 2-3 sentence overview of the entire document, not a repeat of the title
15. Use quote blocks for notable testimonials, expert opinions, or direct citations that add credibility
16. Use image blocks only when displaying actual visual assets (charts, diagrams, photos) — always provide a real public URL or data URI
17. Use dataviz blocks to embed line/bar/pie charts when showing time-series trends or distributions (NOT tables)
18. Embed blocks are for external content (videos, maps, etc.) — use sparingly and only when embedding adds significant value

### type: "comparison"
Use "comparison" when the user explicitly asks to "show", "find", "compare", or "search for" items with specific criteria already provided.
For travel: when the user gives departure city, arrival city, and dates, immediately generate a comparison with realistic flight data.
DO NOT ask for clarification — always respond with comparison type and actual flight options.
DO NOT use form for travel searches when parameters are already specified — always respond with comparison type and actual flight options.
domain: "travel"

CRITICAL RULE FOR FLIGHTS:
When user says "Find me flights from X to Y on/next DATE", you MUST:
1. Do NOT ask clarifying questions
2. Immediately generate 3-5 realistic flight options
3. Return type="comparison" with flights array
4. Structure: ---INTENT_JSON--- with flights array (NOT a form)

Example response for "Find flights from Berlin to Tokyo next week":
---INTENT_JSON---
{
  "version": "1.0.0",
  "intentId": "550e8400-e29b-41d4-a716-446655440000",
  "type": "comparison",
  "domain": "travel",
  "primaryGoal": "Compare flight options from Berlin to Tokyo",
  "confidence": 0.92,
  "density": "operator",
  "data": {
    "flights": [
      {"id":"f1","airline":"Lufthansa","flightNumber":"LH740","price":1250,"currency":"$","duration":"11h 45m","departTime":"09:00","arriveTime":"00:30+1","stops":0,"carbon":245,"fareClass":"Y","confidence":0.95,"note":"Direct flight, competitive pricing"},
      {"id":"f2","airline":"Turkish Airlines","flightNumber":"TK052","price":890,"currency":"$","duration":"13h 20m","departTime":"14:30","arriveTime":"08:15+1","stops":1,"carbon":198,"fareClass":"Y","confidence":0.93,"note":"18% below route average"},
      {"id":"f3","airline":"All Nippon Airways","flightNumber":"NH209","price":1480,"currency":"$","duration":"11h 30m","departTime":"21:00","arriveTime":"18:45+1","stops":0,"carbon":242,"fareClass":"J","confidence":0.94,"note":"Business class, premium service"}
    ],
    "fromCity": "Berlin",
    "toCity": "Tokyo",
    "departureDate": "2026-03-10",
    "returnDate": "2026-03-17"
  }
}

data: {
  "flights": [{ "id": "string", "airline": "string", "flightNumber": "string", "price": number, "currency": "$", "duration": "string", "departTime": "string", "arriveTime": "string", "stops": number, "carbon": number, "fareClass": "Y|W|J", "confidence": 0.9, "note": "string" }],
  "fromCity": "City Name",
  "toCity": "City Name",
  "departureDate": "YYYY-MM-DD",
  "returnDate": "YYYY-MM-DD (optional)"
}

### type: "diagnostic_overview"
Use ONLY for live operational metric dashboards (CPU, memory, latency, error rates, etc.).
DO NOT use for incident reports or post-mortems — use type: "document" for those.
domain: "cloudops"
data: {
  "metrics": [{ "id": "string", "label": "string", "value": number, "unit": "string", "status": "normal|warning|critical", "trend": "up|down|stable", "sparkline": [number] }]
}

### type: "sensor_overview"
domain: "iot"
data: {
  "sensors": [{ "id": "string", "name": "string", "location": "string", "type": "temperature|humidity|co2|power", "value": number, "unit": "string", "status": "ok|warning|critical|offline", "threshold": {"warn": number, "critical": number}, "trend": "rising|falling|stable", "lastSeen": "MUST be a full ISO 8601 timestamp e.g. \"${new Date().toISOString()}\" — NEVER a relative string like '2 minutes ago'", "battery": number_or_null }]
}

### type: "kanban"
domain: "project"
data: {
  "title": "string",
  "showCardCount": true,
  "showWipLimits": true,
  "columns": [{ "id": "string", "title": "string", "color": "#hex", "wipLimit": <positive integer, OMIT if no limit — do NOT use null or 0>, "cards": [{ "id": "string", "title": "string", "description": "string", "priority": "low|medium|high|critical", "tags": ["string"], "assignee": "string" }] }]
}

### type: "calendar"
domain: "engineering"
data: {
  "title": "string",
  "view": "month",
  "focusDate": "${NOW_ISO}",
  "events": [{ "id": "string", "title": "string", "start": "${NOW_YEAR_MONTH}-10T09:00:00Z", "end": "${NOW_YEAR_MONTH}-10T17:00:00Z", "category": "string", "color": "#hex", "description": "string" }]
}

### type: "timeline"
domain: "ops"
data: {
  "title": "string",
  "direction": "vertical",
  "showTimestamps": true,
  "events": [{ "id": "string", "title": "string", "timestamp": "ISO 8601 string e.g. 2026-02-28T10:00:00Z", "description": "string", "status": "completed|in_progress|pending|cancelled|failed", "icon": "string" }]
}

### type: "diagram"
CRITICAL: For diagrams, ALWAYS structure the response as:
---INTENT_JSON---
{
  "version": "1.0.0",
  "intentId": "UUID-HERE",
  "type": "diagram",
  "domain": "engineering",
  "primaryGoal": "descriptive goal",
  "confidence": 0.95,
  "density": "operator",
  "data": {
    "title": "Diagram Title",
    "description": "Optional description",
    "diagrams": [ <diagram objects> ]
  }
}

Diagram sub-kinds — CRITICAL: use the field "kind" NOT "type":

1. Mermaid flowchart:
{ "kind": "mermaid", "id": "d1", "title": "string", "markup": "flowchart LR\n  A[\"Node with spaces\"]\n  B[\"Another Node\"]\n  C[\"Third Node\"]\n  A --> B --> C" }
MERMAID SYNTAX RULES FOR PROPER RENDERING:
- Always put node IDs on the LEFT of the arrow and node labels/text in square brackets []: A["Label Here"]
- Node IDs must be single words (no spaces): use A, B, C, DB, Cache, Queue, etc.
- Node LABELS (in square brackets) can have spaces and punctuation: ["Database Server"], ["Message Queue"], ["User Service"]
- Connect nodes with -->: A["Source"] --> B["Target"]
- For multiple nodes in sequence, chain them: A["First"] --> B["Second"] --> C["Third"]
- NEVER put spaces directly in an arrow flow without node definitions first
- ALWAYS structure as: nodeID["Label"] --> nodeID2["Label2"] --> nodeID3["Label3"]
- If a node name has multiple words like "Message Queues" or "User Service", MUST wrap it: Q["Message Queues"]

2. Chart (bar, line, pie, area):
{ "kind": "chart", "id": "d2", "title": "string", "chartType": "bar", "labels": ["Jan","Feb","Mar"], "series": [{"name": "Goals", "values": [12, 15, 10]}] }
NOTE: use "values" (NOT "data") in each series object. "chartType" must be one of: bar, line, pie, area.

3. Graph (nodes + edges):
{ "kind": "graph", "id": "d3", "title": "System Architecture", "nodes": [{"id":"n1","label":"Database","group":"storage"},{"id":"n2","label":"API Server","group":"backend"},{"id":"n3","label":"Frontend","group":"frontend"}], "edges": [{"source":"n1","target":"n2","label":"queries"},{"source":"n2","target":"n3","label":"responses"}] }

For football/sports trends use kind=chart with chartType=line or bar.
Example for football trends:
{ "kind": "chart", "id": "goals", "title": "Goals Per Match", "chartType": "bar", "labels": ["Gameweek 1","Gameweek 2","Gameweek 3"], "series": [{"name": "Premier League", "values": [2.8, 3.1, 2.5]}, {"name": "La Liga", "values": [2.4, 2.9, 3.2]}] }

4. Mermaid timeline (for historical timelines, chronologies, project milestones):
{ "kind": "mermaid", "id": "d4", "title": "string", "markup": "timeline\n    title My Timeline\n    section Era 1\n        1900 : Event A\n            : Event B\n    section Era 2\n        1950 : Event C" }
IMPORTANT: When a user asks for a history, chronology, or timeline rendered as a diagram, ALWAYS use kind=mermaid with Mermaid's timeline syntax (starting with 'timeline'). Use sections to group eras. Each entry is 'YEAR : Event description'.

### type: "tree"
domain: "hr"
data: {
  "title": "string",
  "searchable": true,
  "showLines": true,
  "nodes": [{ "id": "string", "label": "string", "description": "string", "children": [<nested nodes>] }]
}

IMPORTANT RULES:
- Always generate a unique intentId — use any 8-4-4-4-12 hex UUID like "f47ac10b-58cc-4372-a567-0e02b2c3d479"
- Vary the intentId each response — never reuse the same value
- The JSON must be valid — no trailing commas, no comments
- NEVER embed units inside a numeric value: WRONG: "value": 2.5GHz — RIGHT: "value": 2.5, "unit": "GHz"
- ALL string values MUST be wrapped in double quotes; ALL numeric values must be plain numbers with no letters or symbols
- Use realistic, detailed, factually accurate data that matches the user's request
- If the user asks a simple conversational question, requests an explanation, asks "what is", "how does", "why", "tell me about", or anything better answered in prose — respond with ONLY text, NO ---INTENT_JSON--- marker at all. The text will be rendered as markdown so you MAY use **bold**, \\\`inline code\\\`, bullet lists, and headings freely.
- Only generate an intent JSON when the user explicitly wants to SEE data displayed as a widget (dashboard, table, form, board, chart, calendar, etc.).
- ⚠️ CRITICAL TABLE RULE: if your answer would include ANY markdown table (lines starting with \\\`|\\\`), you MUST ALWAYS use ---INTENT_JSON--- with type="document" (table blocks inside sections) or type="diagnostic_overview" or type="sensor_overview" or the appropriate intent type. NEVER emit raw markdown pipe-tables — they cannot be parsed by the UI. Instead, put that tabular data inside the JSON \\\`data\\\` field as a \\\`table\\\` block with \\\`headers\\\` and \\\`rows\\\` arrays. Markdown tables WILL NOT RENDER — always use structured JSON tables.
- For sensor/metric/diagnostic queries that would produce tables: use type="sensor_overview" for IoT sensors, type="diagnostic_overview" for system metrics, or type="document" with table blocks for custom tabular data.
- Make the data rich and realistic with at least 3-5 items where applicable
- Always include all required fields
- QUALITY IS CRITICAL: generate detailed, informative content — not placeholder or skeleton data
- Every text field should contain substantial, specific information — never one-word or one-line fillers
- For documents: aim for the depth and quality of a professional analyst report
- For tables: include at least 3-5 rows with realistic data points
- For lists: include 4-8 substantive items with specific details
- For metrics: always include realistic numeric values with trends and deltas
- Think about what a user would actually want to see and make the content genuinely useful
`;

// ── Suggested prompt chips ──────────────────────────────────────────────────

const SUGGESTION_CHIPS = [
  { label: '📊 Dashboard', prompt: 'Show me a dashboard with CPU, memory, disk, and network metrics for our production servers' },
  { label: '✈️ Flights', prompt: 'Find me flights from Berlin to Tokyo next week, show price comparison' },
  { label: '📋 Sprint Board', prompt: 'Create a kanban board for our current sprint with tasks in backlog, in-progress, and done' },
  { label: '📄 Report', prompt: 'Generate an incident post-mortem report for a database outage that happened yesterday' },
  { label: '🌡️ Sensors', prompt: 'Show me all IoT sensor readings from the building, highlight any anomalies' },
  { label: '📅 Calendar', prompt: 'Show me the team on-call schedule for this month' },
  { label: '📝 Form', prompt: 'Create a deployment configuration form with service name, environment, replicas, and resource limits' },
  { label: '🔀 Diagram', prompt: 'Draw a system architecture diagram showing microservices, databases, and message queues' },
  { label: '🌳 Org Chart', prompt: 'Show the engineering organization tree with teams and managers' },
  { label: '📈 Timeline', prompt: 'Show deployment history for the last week with status and rollback info' },
];

// ─────────────────────────────────────────────────────────────────────────────
// OllamaChatView Component
// ─────────────────────────────────────────────────────────────────────────────

export function OllamaChatView() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'system-welcome',
      role: 'system',
      content: 'Connected to HARI Agent. Ask me to generate any UI component — dashboards, forms, kanban boards, charts, documents, and more. I\'ll create interactive widgets right here in the chat!',
      timestamp: Date.now(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [ollamaUrl, setOllamaUrl] = useState('http://localhost:11434');
  const [ollamaModel, setOllamaModel] = useState('qwen3-vl:8b');
  const [devServiceUrl, setDevServiceUrl] = useState('http://localhost:3002');
  const [showSettings, setShowSettings] = useState(false);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [useCustomModel, setUseCustomModel] = useState(false);
  const [expandedIntents, setExpandedIntents] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Fetch available models from Ollama whenever the URL changes
  useEffect(() => {
    let cancelled = false;
    async function fetchModels() {
      try {
        const res = await fetch(`${ollamaUrl}/api/tags`);
        if (!res.ok) return;
        const data = await res.json() as { models?: Array<{ name: string }> };
        const names = data.models?.map((m) => m.name) ?? [];
        if (!cancelled) {
          setAvailableModels(names);
          if (names.length > 0) {
            // If current model is in the list, switch to select mode
            if (names.includes(ollamaModel)) {
              setUseCustomModel(false);
            } else {
              // Current value not in list — keep it but stay in custom-text mode
              setUseCustomModel(true);
            }
          }
        }
      } catch {
        if (!cancelled) setAvailableModels([]);
      }
    }
    void fetchModels();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ollamaUrl]);

  // Build conversation history for context
  const buildConversationHistory = useCallback((): Array<{ role: string; content: string }> => {
    return messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.content,
      }));
  }, [messages]);

  // Normalize common LLM mistakes in the parsed intent before Zod validation
  const normalizeIntent = useCallback((parsed: Record<string, unknown>): Record<string, unknown> => {
    // ── UUID validation: replace missing OR placeholder intentIds ─────────────
    // LLMs often copy the template verbatim (e.g. "xxxxxxxxx-xxxx-4xxx-...") or
    // emit a non-UUID string. Zod enforces strict UUID format so we must replace.
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!parsed.intentId || typeof parsed.intentId !== 'string' || !UUID_RE.test(parsed.intentId)) {
      parsed.intentId = uuid();
    }

    // Ensure other required top-level fields
    if (!parsed.version) parsed.version = '1.0.0';
    if (!parsed.confidence) parsed.confidence = 0.85;
    if (!parsed.density) parsed.density = 'operator';
    // LLMs sometimes emit data as an array instead of an object.
    // Wrap it so Zod's z.record() validator doesn't reject the payload.
    if (Array.isArray(parsed.data)) {
      parsed.data = { items: parsed.data };
    } else if (!parsed.data || typeof parsed.data !== 'object') {
      parsed.data = {};
    }

    // ── Sanitize domain ───────────────────────────────────────────────────────
    // LLMs sometimes emit compound domains like "football/sports", "sports/analytics",
    // or entirely made-up domains. Map these to registered domains.
    const KNOWN_DOMAINS = [
      'travel', 'cloudops', 'iot', 'reports', 'deployment', 'product-analytics',
      'engineering', 'hr', 'support', 'incident', 'project', 'ops', 'onboarding',
      'collab', '__generic__',
    ];
    if (parsed.domain && typeof parsed.domain === 'string') {
      const d = parsed.domain as string;
      if (!KNOWN_DOMAINS.includes(d)) {
        // Try to salvage a known domain from a compound string like "football/sports"
        const found = KNOWN_DOMAINS.find((k) => d.toLowerCase().includes(k));
        parsed.domain = found ?? 'engineering';
      }
    }
    if (!parsed.domain) parsed.domain = 'engineering';

    // ── Ensure primaryGoal is a non-empty string ────────────────────────────────
    // LLMs sometimes omit primaryGoal or set it to null. Provide a sensible default.
    if (!parsed.primaryGoal || typeof parsed.primaryGoal !== 'string') {
      const t = parsed.type as string ?? 'widget';
      const d = parsed.domain as string ?? 'default';
      parsed.primaryGoal = `Show ${d} ${t}`;
    }

    // ── Coerce wrong top-level types ─────────────────────────────────────────
    // LLMs sometimes emit type="chart", type="visualization", or type="bar"
    // at the TOP level instead of wrapping in type="diagram" with a diagrams array.
    const CHART_TYPES = ['bar', 'line', 'pie', 'area'];
    const DIAGRAM_ALIASES = ['chart', 'visualization', 'graph', 'mermaid', ...CHART_TYPES];
    if (parsed.type && DIAGRAM_ALIASES.includes(parsed.type as string)) {
      const origType = parsed.type as string;
      parsed.type = 'diagram';
      if (!parsed.domain || !KNOWN_DOMAINS.includes(parsed.domain as string)) parsed.domain = 'engineering';
      // Build a diagrams array from the top-level payload
      const data = parsed.data as Record<string, unknown>;
      if (!Array.isArray(data.diagrams) || data.diagrams.length === 0) {
        let subKind: Record<string, unknown>;
        if (origType === 'mermaid') {
          subKind = {
            kind: 'mermaid',
            id: 'd1',
            markup: (data.markup ?? data.source ?? 'flowchart LR\n  A --> B') as string,
            title: data.title as string | undefined,
          };
          delete data.markup; delete data.source;
        } else if (origType === 'graph') {
          subKind = {
            kind: 'graph',
            id: 'd1',
            title: data.title as string | undefined,
            nodes: (data.nodes ?? []) as unknown[],
            edges: (data.edges ?? []) as unknown[],
          };
          delete data.nodes; delete data.edges;
        } else {
          // chart / bar / line / area / pie / visualization
          // Also respect data.kind = "chart" / data.chartType hint when origType = "chart"
          const resolvedChartType: string =
            CHART_TYPES.includes(origType) ? origType
            : CHART_TYPES.includes(data.chartType as string) ? (data.chartType as string)
            : 'bar';
          // Normalize series so each entry has "values" not "data"
          const rawSeries = ((data.series ?? []) as Record<string, unknown>[]).map((s) => {
            if (!s.values && s.data) { s.values = s.data; delete s.data; }
            if (!s.values) s.values = [];
            return s;
          });
          subKind = {
            kind: 'chart',
            id: (data.id ?? 'd1') as string,
            chartType: resolvedChartType,
            title: data.title as string | undefined,
            labels: (data.labels ?? data.categories ?? []) as string[],
            series: rawSeries,
          };
          delete data.chartType; delete data.categories; delete data.id;
        }
        data.diagrams = [subKind];
        delete data.title; delete data.kind;
      }
    }

    // Ensure diagram type has a proper domain
    if (parsed.type === 'diagram' && !parsed.domain) {
      parsed.domain = 'engineering';
    }

    // ── Synthesise missing `data.diagrams` array for type="diagram" ───────────
    // The most common LLM failure: type is correctly "diagram" but the LLM
    // puts diagram content (nodes, edges, markup, series, kind, chartType …)
    // directly inside `data` instead of wrapping it in `data.diagrams: [...]`.
    // We detect this and construct the wrapper automatically.
    if (parsed.type === 'diagram' && parsed.data && typeof parsed.data === 'object') {
      const data = parsed.data as Record<string, unknown>;
      if (!Array.isArray(data.diagrams) || data.diagrams.length === 0) {
        // Determine what sub-kind the LLM intended
        const kind = data.kind as string | undefined;
        const hasMarkup = !!(data.markup || data.source || data.content || data.code);
        const hasNodes  = Array.isArray(data.nodes);
        const hasSeries = Array.isArray(data.series);
        const hasChartType = !!data.chartType;

        let subKind: Record<string, unknown> | null = null;

        if (kind === 'mermaid' || hasMarkup) {
          // ── Mermaid sub-kind ────────────────────────────────────────────
          subKind = {
            kind: 'mermaid',
            id: (data.id ?? 'd1') as string,
            title: data.title as string | undefined,
            markup: (data.markup ?? data.source ?? data.content ?? data.code ?? 'flowchart LR\n  A --> B') as string,
            caption: data.caption as string | undefined,
          };
          delete data.markup; delete data.source; delete data.content; delete data.code;
        } else if (kind === 'graph' || (hasNodes && !hasSeries && !hasChartType)) {
          // ── Graph sub-kind ─────────────────────────────────────────────
          subKind = {
            kind: 'graph',
            id: (data.id ?? 'd1') as string,
            title: data.title as string | undefined,
            caption: data.caption as string | undefined,
            layout: (data.layout ?? 'force') as string,
            nodes: data.nodes ?? [],
            edges: data.edges ?? data.links ?? data.connections ?? [],
          };
          delete data.nodes; delete data.edges; delete data.links; delete data.connections; delete data.layout;
        } else if (kind === 'chart' || hasChartType || hasSeries) {
          // ── Chart sub-kind ─────────────────────────────────────────────
          const resolvedChartType =
            CHART_TYPES.includes(data.chartType as string) ? (data.chartType as string) : 'bar';
          const rawSeries = ((data.series ?? []) as Record<string, unknown>[]).map((s) => {
            if (!s.values && s.data) { s.values = s.data; delete s.data; }
            if (!s.values && s.dataPoints) { s.values = s.dataPoints; delete s.dataPoints; }
            if (!s.values) s.values = [];
            return s;
          });
          subKind = {
            kind: 'chart',
            id: (data.id ?? 'd1') as string,
            chartType: resolvedChartType,
            title: data.title as string | undefined,
            caption: data.caption as string | undefined,
            labels: (data.labels ?? data.categories ?? data.xAxis ?? []) as string[],
            series: rawSeries,
            unit: data.unit as string | undefined,
          };
          delete data.chartType; delete data.series; delete data.labels;
          delete data.categories; delete data.xAxis; delete data.unit;
        } else {
          // ── Fallback: try to build *something* from whatever is in data ─
          // Last resort — wrap everything non-meta as a single mermaid placeholder
          // or a graph if there's any hint of structure.
          if (typeof data.markup === 'string' || typeof data.source === 'string') {
            subKind = {
              kind: 'mermaid',
              id: 'd1',
              title: data.title as string | undefined,
              markup: (data.markup ?? data.source ?? 'flowchart LR\n  A --> B') as string,
            };
          } else {
            // Absolute fallback — create a simple placeholder so rendering doesn't crash
            subKind = {
              kind: 'mermaid',
              id: 'd1',
              title: (data.title as string) ?? 'Diagram',
              markup: 'flowchart LR\n  A[Start] --> B[End]',
            };
          }
        }

        if (subKind) {
          // Preserve top-level title/description as DiagramData fields
          const diagramTitle = data.title as string | undefined;
          const diagramDesc  = data.description as string | undefined;
          data.diagrams = [subKind];
          // Restore meta fields that DiagramDataSchema expects at the top of data
          if (diagramTitle) data.title = diagramTitle;
          if (diagramDesc) data.description = diagramDesc;
          // Clean up fields that now live inside the sub-kind
          delete data.kind; delete data.id; delete data.caption;
        }
      }
    }

    // ── Coerce unknown intent types to 'document' ─────────────────────────────
    // LLMs sometimes invent types like "report", "article", "info", etc.
    // Fall back to 'document' which is the most versatile type.
    const KNOWN_TYPES = [
      'form', 'document', 'comparison', 'diagnostic_overview', 'sensor_overview',
      'timeline', 'workflow', 'kanban', 'calendar', 'tree', 'diagram', 'chat',
    ];
    if (parsed.type && !KNOWN_TYPES.includes(parsed.type as string)) {
      // Map some common LLM aliases to correct types
      const TYPE_MAP: Record<string, string> = {
        report: 'document', article: 'document', info: 'document', summary: 'document',
        overview: 'document', analysis: 'document', guide: 'document', tutorial: 'document',
        dashboard: 'diagnostic_overview', metrics: 'diagnostic_overview',
        board: 'kanban', sprint: 'kanban', tasks: 'kanban',
        schedule: 'calendar', events: 'calendar',
        history: 'timeline', log: 'timeline',
        org: 'tree', hierarchy: 'tree',
        conversation: 'chat',
      };
      parsed.type = TYPE_MAP[parsed.type as string] ?? 'document';
      // If coerced to 'document', ensure domain is 'reports' for best rendering
      if (parsed.type === 'document' && !KNOWN_DOMAINS.includes(parsed.domain as string)) {
        parsed.domain = 'reports';
      }
    }

    // Fix diagram sub-kind objects
    if (parsed.type === 'diagram' && parsed.data && typeof parsed.data === 'object') {
      const data = parsed.data as Record<string, unknown>;

      // LLM sometimes puts a single diagram object instead of an array
      if (data.diagrams && !Array.isArray(data.diagrams) && typeof data.diagrams === 'object') {
        data.diagrams = [data.diagrams];
      }

      if (Array.isArray(data.diagrams)) {
        data.diagrams = data.diagrams.map((d: Record<string, unknown>) => {
          // If LLM used "type" instead of "kind", convert it
          if (d.type && !d.kind) {
            const t = d.type as string;
            if (t === 'mermaid') {
              d.kind = 'mermaid';
              // LLM may use "source" instead of "markup"
              if (!d.markup && d.source) d.markup = d.source;
            } else if (['bar', 'line', 'pie', 'area'].includes(t)) {
              d.kind = 'chart';
              d.chartType = t;
            } else if (t === 'chart') {
              d.kind = 'chart';
              // chartType may be nested or missing
              if (!d.chartType) d.chartType = 'bar';
            } else if (t === 'graph') {
              d.kind = 'graph';
            }
            delete d.type;
          }
          // Fix chart-specific issues
          if (d.kind === 'chart') {
            if (!d.chartType) d.chartType = 'bar';
            if (!d.labels && (d.categories as unknown[])) {
              d.labels = d.categories;
              delete d.categories;
            }
            if (!d.labels) d.labels = [];
            if (Array.isArray(d.series)) {
              d.series = (d.series as Record<string, unknown>[]).map((s) => {
                // LLM often uses "data" instead of "values"
                if (!s.values && s.data) { s.values = s.data; delete s.data; }
                if (!s.values) s.values = [];
                return s;
              });
            }
            if (!d.series) d.series = [];
          }
          // Fix mermaid-specific issues
          if (d.kind === 'mermaid') {
            if (!d.markup && d.source) { d.markup = d.source; delete d.source; }
            if (!d.markup && d.content) { d.markup = d.content; delete d.content; }
            if (!d.markup) d.markup = 'flowchart LR\n  A --> B';
          }
          // Fix graph-specific issues
          if (d.kind === 'graph') {
            if (!d.nodes) d.nodes = [];
            if (!d.edges) d.edges = [];
            if (Array.isArray(d.nodes)) {
              d.nodes = (d.nodes as Record<string, unknown>[]).map((n) => ({
                id: n.id ?? uuid(),
                label: n.label ?? n.name ?? 'Node',
                ...n,
              }));
            }
          }
          return d;
        });
      }
    }

    // ── Kanban normalization ───────────────────────────────────────────────────
    // LLM often sends wipLimit: null or wipLimit: 0 — schema requires positive int or omitted
    if (parsed.type === 'kanban' && parsed.data && typeof parsed.data === 'object') {
      const kData = parsed.data as Record<string, unknown>;
      if (Array.isArray(kData.columns)) {
        kData.columns = (kData.columns as Record<string, unknown>[]).map((col) => {
          // Remove wipLimit if null, 0, or negative
          if (col.wipLimit == null || (typeof col.wipLimit === 'number' && col.wipLimit <= 0)) {
            const { wipLimit: _wip, ...rest } = col;
            col = rest;
          }
          // Ensure cards array exists and each card has tags array
          if (!Array.isArray(col.cards)) col.cards = [];
          col.cards = (col.cards as Record<string, unknown>[]).map((card) => ({
            ...card,
            tags: Array.isArray(card.tags) ? card.tags : [],
          }));
          return col;
        });
      }
    }

    // ── Document normalization ─────────────────────────────────────────────────
    // Normalize callout variants, metric trends, and ensure sections/blocks are well-formed
    if (parsed.type === 'document' && parsed.data && typeof parsed.data === 'object') {
      const docData = parsed.data as Record<string, unknown>;
      // Ensure sections array exists
      if (!Array.isArray(docData.sections)) docData.sections = [];
      // Schema requires at least 1 section — add a fallback if the LLM left it empty
      if ((docData.sections as unknown[]).length === 0) {
        docData.sections = [{
          id: uuid(),
          title: typeof docData.title === 'string' ? docData.title : 'Content',
          confidence: 0.9,
          collapsible: false,
          defaultCollapsed: false,
          blocks: [
            {
              type: 'callout',
              variant: 'info',
              title: 'No content generated',
              text: 'The AI did not generate section content. Try rephrasing your request.',
            },
          ],
        }];
      }
      // Ensure tags array exists
      if (!Array.isArray(docData.tags)) docData.tags = [];
      // Ensure summary exists — synthesize from first paragraph if missing
      if (!docData.summary && Array.isArray(docData.sections) && (docData.sections as Record<string, unknown>[]).length > 0) {
        const firstSection = (docData.sections as Record<string, unknown>[])[0];
        if (Array.isArray(firstSection.blocks)) {
          const firstPara = (firstSection.blocks as Record<string, unknown>[]).find((b) => b.type === 'paragraph');
          if (firstPara && typeof firstPara.text === 'string') {
            docData.summary = firstPara.text.length > 200 ? firstPara.text.slice(0, 200) + '…' : firstPara.text;
          }
        }
      }
      // Normalize callout variants and metric trends inside document blocks
      const CALLOUT_MAP: Record<string, string> = {
        success: 'insight', error: 'critical', danger: 'critical',
        note: 'info', tip: 'insight', important: 'warning', caution: 'warning',
      };
      const TREND_MAP: Record<string, string> = {
        flat: 'stable', neutral: 'stable', unchanged: 'stable',
        rising: 'up', falling: 'down', increasing: 'up', decreasing: 'down',
      };
      (docData.sections as Record<string, unknown>[]).forEach((section) => {
        if (!section.id) section.id = uuid();
        if (!Array.isArray(section.blocks)) section.blocks = [];
        // Ensure section has collapsible/defaultCollapsed defaults
        if (section.collapsible === undefined) section.collapsible = true;
        if (section.defaultCollapsed === undefined) section.defaultCollapsed = false;
        // Ensure each section has a confidence score
        if (section.confidence === undefined) section.confidence = 0.9;
        (section.blocks as Record<string, unknown>[]).forEach((block) => {
          // Fix callout variants
          if (block.type === 'callout' && block.variant) {
            block.variant = CALLOUT_MAP[block.variant as string] ?? block.variant;
          }
          // Fix metric trends and ensure required label/value
          if (block.type === 'metric') {
            if (block.trend) block.trend = TREND_MAP[block.trend as string] ?? block.trend;
            if (!block.label) block.label = 'Metric';
            if (block.value === undefined || block.value === null) block.value = 'N/A';
            // Coerce numeric value to string — MetricBlockSchema expects z.string()
            if (typeof block.value === 'number') block.value = String(block.value);
          }
          // Ensure list items is an array
          if (block.type === 'list' && !Array.isArray(block.items)) {
            block.items = [];
          }
          // Ensure table has properly-shaped headers and rows
          if (block.type === 'table') {
            if (!Array.isArray(block.headers)) block.headers = [];
            // LLMs often emit headers as plain strings — coerce to {key, label, align}
            block.headers = (block.headers as unknown[]).map((h) => {
              if (typeof h === 'string') {
                return { key: h.toLowerCase().replace(/\s+/g, '_'), label: h, align: 'left' };
              }
              // Ensure key and label exist even if partial object was provided
              if (h && typeof h === 'object') {
                const obj = h as Record<string, unknown>;
                if (!obj.key) obj.key = String(obj.label ?? '').toLowerCase().replace(/\s+/g, '_');
                if (!obj.label) obj.label = String(obj.key ?? '');
                if (!obj.align) obj.align = 'left';
                return obj;
              }
              return h;
            });
            if (!Array.isArray(block.rows)) block.rows = [];
          }
          // Ensure paragraph confidence exists for proper rendering
          if (block.type === 'paragraph' && block.confidence === undefined) {
            block.confidence = section.confidence ?? 0.9;
          }
        });
      });

      // ── Enrich shallow documents ──────────────────────────────────────────
      // If the LLM generated very shallow sections (only paragraphs, few blocks),
      // add dividers between sections and ensure minimum structure
      const sections = docData.sections as Record<string, unknown>[];
      const allBlockTypes = new Set<string>();
      let totalBlocks = 0;
      sections.forEach((sec) => {
        const blocks = sec.blocks as Record<string, unknown>[];
        totalBlocks += blocks.length;
        blocks.forEach((b) => allBlockTypes.add(b.type as string));
      });

      // If document is shallow (few blocks or only paragraphs), insert dividers between sections
      if (totalBlocks < 8 || (allBlockTypes.size === 1 && allBlockTypes.has('paragraph'))) {
        // Add dividers between sections for visual separation
        const enrichedSections: Record<string, unknown>[] = [];
        sections.forEach((sec, idx) => {
          enrichedSections.push(sec);
          if (idx < sections.length - 1) {
            // Ensure each section has at least a heading if it has a title
            const blocks = sec.blocks as Record<string, unknown>[];
            const hasHeading = blocks.some((b) => b.type === 'heading');
            if (!hasHeading && sec.title && blocks.length > 0) {
              // The section title already renders as a header, but add a divider at the end
              blocks.push({ type: 'divider' });
            }
          }
        });
        docData.sections = enrichedSections;
      }
    }

    // ── Diagnostic_overview metric normalization ───────────────────────────────
    // LLM uses "ok" for status and "flat" for trend — map to what MetricCard expects
    if (parsed.type === 'diagnostic_overview' && parsed.data && typeof parsed.data === 'object') {
      const dData = parsed.data as Record<string, unknown>;
      // If LLM put a document-like payload here, switch to document type
      if (Array.isArray(dData.sections) && !Array.isArray(dData.metrics)) {
        parsed.type = 'document';
      } else if (Array.isArray(dData.metrics)) {
        const STATUS_MAP: Record<string, string> = { ok: 'normal', healthy: 'normal', good: 'normal', error: 'critical', danger: 'critical' };
        const TREND_MAP: Record<string, string> = { flat: 'stable', neutral: 'stable', unchanged: 'stable', rising: 'up', falling: 'down', increasing: 'up', decreasing: 'down' };
        dData.metrics = (dData.metrics as Record<string, unknown>[]).map((m) => ({
          ...m,
          status: STATUS_MAP[m.status as string] ?? m.status ?? 'normal',
          trend: m.trend ? (TREND_MAP[m.trend as string] ?? m.trend) : m.trend,
          // Ensure sparkline is an array of numbers
          sparkline: Array.isArray(m.sparkline)
            ? (m.sparkline as unknown[]).map(Number).filter((n) => !isNaN(n))
            : undefined,
        }));
      }
    }

    // ── Sensor_overview normalization ─────────────────────────────────────────
    // LLMs often use wrong sensor types, statuses, trends, or relative lastSeen
    // strings. Map them into the values SensorCard actually accepts.
    if (parsed.type === 'sensor_overview' && parsed.data && typeof parsed.data === 'object') {
      const sData = parsed.data as Record<string, unknown>;
      // If LLM put diagnostic-style metrics rather than IoT sensors, switch type
      if (Array.isArray(sData.metrics) && !Array.isArray(sData.sensors)) {
        parsed.type = 'diagnostic_overview';
      } else {
        // Ensure sensors array exists
        if (!Array.isArray(sData.sensors)) sData.sensors = [];
        const VALID_TYPES = new Set(['temperature', 'humidity', 'co2', 'power', 'pressure', 'motion']);
        const TYPE_MAP: Record<string, string> = {
          cpu: 'power', memory: 'power', network: 'power', disk: 'power',
          error_rate: 'power', latency: 'power', throughput: 'power',
          gas: 'co2', air: 'co2', moisture: 'humidity', water: 'humidity',
          voltage: 'power', current: 'power', energy: 'power',
        };
        const SENSOR_STATUS_MAP: Record<string, string> = {
          ok: 'ok', healthy: 'ok', good: 'ok', normal: 'ok', active: 'ok', running: 'ok',
          warning: 'warning', warn: 'warning', alert: 'warning', caution: 'warning',
          critical: 'critical', error: 'critical', danger: 'critical', high: 'warning',
          offline: 'offline', dead: 'offline', disconnected: 'offline', down: 'offline', unknown: 'offline',
        };
        const SENSOR_TREND_MAP: Record<string, string> = {
          rising: 'rising', up: 'rising', increasing: 'rising', growing: 'rising',
          falling: 'falling', down: 'falling', decreasing: 'falling',
          stable: 'stable', flat: 'stable', neutral: 'stable', unchanged: 'stable',
        };
        sData.sensors = (sData.sensors as Record<string, unknown>[]).map((sensor, idx) => {
          const s = { ...sensor };
          // Ensure id
          if (!s.id) s.id = `sensor-${idx + 1}`;
          // Normalize type — unknown types fall back to 'power' (generic icon)
          const rawType = String(s.type ?? '').toLowerCase().replace(/[^a-z0-9_]/g, '_');
          s.type = VALID_TYPES.has(rawType) ? rawType : (TYPE_MAP[rawType] ?? 'power');
          // Normalize status
          const rawStatus = String(s.status ?? '').toLowerCase();
          s.status = SENSOR_STATUS_MAP[rawStatus] ?? 'ok';
          // Normalize trend
          if (s.trend) {
            const rawTrend = String(s.trend).toLowerCase();
            s.trend = SENSOR_TREND_MAP[rawTrend] ?? 'stable';
          }
          // Normalize lastSeen — convert relative strings to ISO
          if (
            !s.lastSeen ||
            typeof s.lastSeen !== 'string' ||
            /\bago\b|\bminute|\bhour|\bsecond|\bday|\bweek|just now/i.test(s.lastSeen as string)
          ) {
            s.lastSeen = new Date().toISOString();
          }
          // Remove null battery — undefined is fine, null fails type checks
          if (s.battery === null) delete s.battery;
          // Coerce string value to number when possible
          if (typeof s.value === 'string') {
            const num = parseFloat((s.value as string).replace(/[^0-9.-]/g, ''));
            if (!isNaN(num)) s.value = num;
          }
          // Fill required fields
          if (!s.name) s.name = `Sensor ${idx + 1}`;
          if (!s.location) s.location = 'Unknown';
          if (s.unit === undefined || s.unit === null) s.unit = '';
          return s;
        });
      }
    }

    // ── Timeline event normalization ───────────────────────────────────────────
    // LLM uses success/error/warning/info — map to completed/failed/cancelled/pending
    if (parsed.type === 'timeline' && parsed.data && typeof parsed.data === 'object') {
      const tData = parsed.data as Record<string, unknown>;
      // Valid TimelineEventStatus values
      const VALID_STATUSES = new Set(['completed', 'in_progress', 'pending', 'cancelled', 'failed']);
      const STATUS_MAP: Record<string, string> = {
        success: 'completed', done: 'completed', complete: 'completed',
        historical: 'completed', ancient: 'completed', modern: 'completed',
        established: 'completed', founded: 'completed', built: 'completed',
        error: 'failed', failure: 'failed', fail: 'failed',
        warning: 'cancelled', warn: 'cancelled',
        info: 'pending', queued: 'pending', upcoming: 'pending', future: 'pending',
        'in-progress': 'in_progress', running: 'in_progress', active: 'in_progress', ongoing: 'in_progress',
      };
      if (Array.isArray(tData.events)) {
        tData.events = (tData.events as Record<string, unknown>[]).map((ev) => {
          // Convert numeric timestamps to ISO strings
          const ts = typeof ev.timestamp === 'number'
            ? new Date(ev.timestamp).toISOString()
            : typeof ev.timestamp === 'string' ? ev.timestamp : new Date().toISOString();
          // Map or strip any unknown status values — the schema enum is strict
          let status: string | undefined = ev.status as string | undefined;
          if (status) {
            status = STATUS_MAP[status.toLowerCase()] ?? (VALID_STATUSES.has(status) ? status : 'completed');
          }
          return {
            ...ev,
            timestamp: ts,
            endTimestamp: typeof ev.endTimestamp === 'number'
              ? new Date(ev.endTimestamp).toISOString()
              : ev.endTimestamp,
            status,
            // Ensure id always exists
            id: ev.id ?? uuid(),
          };
        });
      }
    }

    // ── Calendar event normalization ───────────────────────────────────────────
    // LLM sometimes uses "date" instead of "start"/"end"; also fix template focusDates
    if (parsed.type === 'calendar' && parsed.data && typeof parsed.data === 'object') {
      const cData = parsed.data as Record<string, unknown>;
      // If focusDate looks like a template placeholder or is missing, use today
      if (!cData.focusDate || /YYYY|MM|DD/.test(cData.focusDate as string)) {
        cData.focusDate = new Date().toISOString().slice(0, 10);
      }
      if (Array.isArray(cData.events)) {
        cData.events = (cData.events as Record<string, unknown>[]).map((ev) => {
          const e = { ...ev };
          // Handle "date" field instead of start/end
          if (!e.start && e.date) {
            e.start = e.date as string;
            e.end = e.date as string;
            delete e.date;
          }
          // Handle "startDate"/"endDate" aliases
          if (!e.start && e.startDate) { e.start = e.startDate; delete e.startDate; }
          if (!e.end && e.endDate) { e.end = e.endDate; delete e.endDate; }
          // Handle "startTime"/"endTime" aliases
          if (!e.start && e.startTime) { e.start = e.startTime; delete e.startTime; }
          if (!e.end && e.endTime) { e.end = e.endTime; delete e.endTime; }
          // Ensure start/end exist — default to today
          if (!e.start) e.start = new Date().toISOString().slice(0, 10);
          if (!e.end) e.end = e.start;
          // Ensure id exists
          if (!e.id) e.id = uuid();
          // Ensure attendees array
          if (!Array.isArray(e.attendees)) e.attendees = [];
          return e;
        });
      }
      // Ensure events array exists
      if (!Array.isArray(cData.events)) cData.events = [];
    }

    // ── Mermaid markup validation ──────────────────────────────────────────────
    // If mermaid markup doesn't begin with a Mermaid keyword, replace with generic diagram
    const MERMAID_KEYWORDS = ['flowchart', 'graph', 'sequenceDiagram', 'classDiagram',
      'stateDiagram', 'erDiagram', 'gantt', 'pie', 'gitGraph', 'mindmap', 'journey',
      'timeline', 'quadrantChart', 'sankey', 'xychart', 'block'];
    if (parsed.type === 'diagram' && parsed.data && typeof parsed.data === 'object') {
      const dData = parsed.data as Record<string, unknown>;
      if (Array.isArray(dData.diagrams)) {
        dData.diagrams = (dData.diagrams as Record<string, unknown>[]).map((d) => {
          if (d.kind === 'mermaid' && typeof d.markup === 'string') {
            if (!MERMAID_KEYWORDS.some((kw) => d.markup!.toString().trimStart().startsWith(kw))) {
              // Markup is not valid Mermaid — replace with a sensible generic flowchart
              d.markup = 'flowchart LR\n  A[Client] --> B[API Gateway]\n  B --> C[Service A]\n  B --> D[Service B]\n  C --> E[(Database)]\n  D --> E';
            } else {
              // ── Fix common mermaid timeline syntax issues ──────────────
              // LLMs often produce timeline entries with decimals or suffixes
              // like "3.0M", "200k", "40k" which mermaid cannot parse.
              // Also fix entries that use ":" without a space after the date.
              let markup = d.markup as string;
              if (markup.trimStart().startsWith('timeline')) {
                // Replace decimal-suffixed dates (e.g. 3.0M → 3000000) with
                // simple labels that mermaid's timeline renderer can handle.
                // Mermaid timeline entries look like:
                //   YEAR : Description
                // where YEAR must be a simple string token — no special chars.
                // Replace "3.0M" with "3M", "200k" with "200K" etc. to avoid
                // the decimal confusing the parser.
                markup = markup.replace(
                  /(^\s+)(\d+\.\d+)([MmKkBb]?)\s*:/gm,
                  (_match, indent, num, suffix) => {
                    // Convert to integer-style label: 3.0M → 3M, 2.5K → 2500
                    const n = parseFloat(num);
                    const label = Number.isInteger(n)
                      ? `${n}${suffix.toUpperCase()}`
                      : `${Math.round(n * (suffix.toLowerCase() === 'm' ? 1000000 : suffix.toLowerCase() === 'k' ? 1000 : 1))}`;
                    return `${indent}${label} :`;
                  },
                );
                d.markup = markup;
              }
            }
          }
          return d;
        });
      }
    }

    return parsed;
  }, []);

  // Parse Ollama response to extract text and intent JSON
  const parseResponse = useCallback((response: string): { text: string; intent?: IntentPayloadInput; intentError?: string; rawResponse: string } => {
    const marker = '---INTENT_JSON---';
    const markerIndex = response.indexOf(marker);

    if (markerIndex === -1) {
      // Fallback 1: markdown tables → document intent
      const markdownIntent = markdownToDocumentIntent(response.trim());
      if (markdownIntent) {
        return { text: '', intent: markdownIntent, rawResponse: response };
      }

      // Fallback 2: LLM emitted raw JSON without the marker.
      // Find the outermost JSON object in the response and try parsing it as an intent.
      const braceIdx = response.indexOf('{');
      if (braceIdx !== -1) {
        try {
          // Extract from first '{' to its matching '}'
          let depth = 0, endIdx = -1, inStr = false;
          for (let i = braceIdx; i < response.length; i++) {
            const ch = response[i];
            if (inStr) { if (ch === '\\') { i++; continue; } if (ch === '"') inStr = false; continue; }
            if (ch === '"') { inStr = true; continue; }
            if (ch === '{') depth++;
            if (ch === '}') { depth--; if (depth === 0) { endIdx = i; break; } }
          }
          if (endIdx !== -1) {
            const jsonCandidate = response.substring(braceIdx, endIdx + 1);
            const parsed = JSON.parse(jsonCandidate);
            // Only treat as intent if it has recognisable intent-like fields
            if (parsed && typeof parsed === 'object' && (parsed.type || parsed.data || parsed.diagrams || parsed.nodes || parsed.edges || parsed.metrics || parsed.sensors || parsed.flights || parsed.columns || parsed.events || parsed.sections)) {
              const textBefore = response.substring(0, braceIdx).trim();
              const normalized = normalizeIntent(parsed as Record<string, unknown>);
              const validated = IntentPayloadSchema.parse(normalized);
              return { text: textBefore, intent: validated as IntentPayloadInput, rawResponse: response };
            }
          }
        } catch {
          // Not valid JSON or not an intent — fall through to plain text
        }
      }

      return { text: response.trim(), rawResponse: response };
    }

    const text = response.substring(0, markerIndex).trim();
    const jsonPart = response.substring(markerIndex + marker.length).trim();

    try {
      // Clean up common LLM JSON issues
      let cleanJson = jsonPart
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();

      // Try to find a complete JSON object
      const braceStart = cleanJson.indexOf('{');
      if (braceStart === -1) {
        return { text, intentError: 'No JSON object found in response', rawResponse: response };
      }

      // Find matching closing brace (skip characters inside string literals
      // so that braces inside strings don't confuse the depth counter).
      let depth = 0;
      let braceEnd = -1;
      let inString = false;
      for (let i = braceStart; i < cleanJson.length; i++) {
        const ch = cleanJson[i];
        if (inString) {
          if (ch === '\\') { i++; continue; } // skip escaped char
          if (ch === '"') { inString = false; }
          continue;
        }
        if (ch === '"') { inString = true; continue; }
        if (ch === '{') depth++;
        if (ch === '}') depth--;
        if (depth === 0) { braceEnd = i; break; }
      }
      if (braceEnd === -1) {
        // ── Attempt to repair incomplete JSON ────────────────────────────
        // LLMs often emit raw newlines inside string values (especially
        // mermaid markup) without ever closing the quote, which causes the
        // brace-matcher above to think we're still inside a string and
        // never find the closing '}'.  We attempt a repair:
        //   1. Close any unclosed string literal
        //   2. Close any unclosed array brackets
        //   3. Close any unclosed object braces
        let repaired = cleanJson.substring(braceStart);

        // Determine if we're inside an unclosed string
        let inStr = false;
        for (let i = 0; i < repaired.length; i++) {
          const ch = repaired[i];
          if (inStr) {
            if (ch === '\\') { i++; continue; }
            if (ch === '"') { inStr = false; }
            continue;
          }
          if (ch === '"') { inStr = true; }
        }
        if (inStr) repaired += '"';

        // Count unclosed braces / brackets (re-scan with strings handled)
        let openBraces = 0;
        let openBrackets = 0;
        inStr = false;
        for (let i = 0; i < repaired.length; i++) {
          const ch = repaired[i];
          if (inStr) {
            if (ch === '\\') { i++; continue; }
            if (ch === '"') { inStr = false; }
            continue;
          }
          if (ch === '"') { inStr = true; continue; }
          if (ch === '{') openBraces++;
          if (ch === '}') openBraces--;
          if (ch === '[') openBrackets++;
          if (ch === ']') openBrackets--;
        }
        while (openBrackets > 0) { repaired += ']'; openBrackets--; }
        while (openBraces > 0) { repaired += '}'; openBraces--; }

        cleanJson = repaired;
        // Log the repair so developers can see what was fixed
        console.warn('[parseResponse] Repaired incomplete JSON — closed', inStr ? 'string + ' : '', 'braces/brackets');
      } else {
        cleanJson = cleanJson.substring(braceStart, braceEnd + 1);
      }

      // ── Fix control characters AND invalid escape sequences in JSON string values ──
      // LLMs (especially smaller ones) often emit:
      //   • Raw newlines/tabs inside string values (→ "bad control character")
      //   • Invalid backslash escapes like \p, \a, \s (→ "bad escaped character")
      //   • Malformed \uXXXX sequences
      // We fix all of these by walking the raw JSON character-by-character and
      // sanitising anything that would make JSON.parse() reject the input.
      {
        let fixed = '';
        let insideStr = false;
        for (let i = 0; i < cleanJson.length; i++) {
          const c = cleanJson[i];
          if (insideStr) {
            if (c === '\\') {
              const next = cleanJson[i + 1] ?? '';
              const validEscapeChars = new Set(['"', '\\', '/', 'b', 'f', 'n', 'r', 't', 'u']);
              if (validEscapeChars.has(next)) {
                if (next === 'u') {
                  // Validate \uXXXX — must be followed by exactly 4 hex digits
                  const hex = cleanJson.substring(i + 2, i + 6);
                  if (/^[0-9a-fA-F]{4}$/.test(hex)) {
                    fixed += '\\u' + hex;
                    i += 5;
                  } else {
                    // Invalid \u sequence — escape the backslash so JSON.parse doesn't choke
                    fixed += '\\\\';
                    // leave 'next' to be re-processed
                  }
                } else {
                  // Valid escape sequence — keep as-is
                  fixed += c + next;
                  i++;
                }
              } else {
                // Invalid escape like \p, \a, \s — escape the backslash to make it \\
                fixed += '\\\\';
                // Do NOT advance i; 'next' will be processed in the next iteration
              }
              continue;
            }
            if (c === '"') { insideStr = false; fixed += c; continue; }
            const code = c.charCodeAt(0);
            if (code < 0x20) {
              // Replace raw control chars with their JSON escape
              if (c === '\n') { fixed += '\\n'; }
              else if (c === '\r') { fixed += '\\r'; }
              else if (c === '\t') { fixed += '\\t'; }
              else { fixed += '\\u' + code.toString(16).padStart(4, '0'); }
              continue;
            }
            fixed += c;
          } else {
            if (c === '"') { insideStr = true; }
            fixed += c;
          }
        }
        cleanJson = fixed;
      }

      // ── Repair additional LLM JSON syntax errors ──────────────────────────
      // 1. Remove trailing commas before } or ]  (e.g. {"a":1,})
      cleanJson = cleanJson.replace(/,(?=\s*[}\]])/g, '');

      // 2. Quote unquoted bare values that start with a digit but contain
      //    letters — e.g. 2.5GHz → "2.5GHz", 10ms → "10ms", 99.9% → "99.9%".
      //    These appear after : or [ or , and before , } or ].
      //    We use a lookahead so the delimiter character is not consumed.
      cleanJson = cleanJson.replace(
        /(?<=[:[,]\s*)(\d[a-zA-Z0-9_.+\-%]*[a-zA-Z%][a-zA-Z0-9_.+\-%]*)(?=\s*[,}\]])/g,
        '"$1"'
      );

      let raw = JSON.parse(cleanJson);

      // Detect double-serialized JSON: LLMs occasionally emit a string
      // like "\"maryGoal\":\"Generate...\"" — the whole payload is a
      // JSON-encoded string.  Parse it a second time to recover the object.
      if (typeof raw === 'string') {
        try { raw = JSON.parse(raw); } catch { /* leave as-is, Zod will reject */ }
      }

      // Normalize LLM quirks before Zod validation
      const normalized = normalizeIntent(raw as Record<string, unknown>);

      // Validate with Zod
      const validated = IntentPayloadSchema.parse(normalized);
      return { text, intent: validated as IntentPayloadInput, rawResponse: response };
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.warn('Failed to parse intent JSON:', errMsg, '\nRaw:', jsonPart);
      return { text, intentError: `JSON parse error: ${errMsg}`, rawResponse: response };
    }
  }, [normalizeIntent]);

  // Detect whether the user is asking about running processes / app consumption.
  const isProcessQuery = useCallback((msg: string): boolean => {
    const lower = msg.toLowerCase();
    const hasProcessKeyword =
      lower.includes('running') ||
      lower.includes('process') ||
      lower.includes('top process') ||
      lower.includes('system resource') ||
      lower.includes('what is running') ||
      lower.includes('what\'s running');
    const hasResourceKeyword =
      lower.includes('consumption') ||
      lower.includes('usage') ||
      lower.includes('cpu') ||
      lower.includes('memory') ||
      lower.includes('ram');
    // Match "running apps", "running processes", or "apps + consumption"
    return hasProcessKeyword || (lower.includes('app') && hasResourceKeyword);
  }, []);

  // Detect if the user message is clearly requesting a visual/widget output.
  // Used to decide whether to attempt a second-pass intent generation call when
  // the first LLM response comes back as plain text without ---INTENT_JSON---.
  const requiresIntent = useCallback((msg: string): boolean => {
    const lower = msg.toLowerCase();
    const VISUAL_TRIGGERS = [
      'show', 'display', 'create', 'generate', 'render', 'build', 'draw', 'find',
      'visualize', 'give me', 'make me', 'make a', 'create a', 'build a', 'show me',
      'search for', 'search flights', 'find flights', 'find me',
    ];
    const WIDGET_KEYWORDS = [
      'dashboard', 'kanban', 'chart', 'graph', 'diagram', 'table', 'form',
      'calendar', 'schedule', 'timeline', 'report', 'document', 'flights', 'flight',
      'metrics', 'sensors', 'iot', 'sensor', 'monitor', 'monitoring', 'overview',
      'org chart', 'organization', 'architecture', 'microservice', 'infrastructure',
      'comparison', 'compare', 'sprint', 'backlog', 'roadmap', 'board',
    ];
    const hasTrigger = VISUAL_TRIGGERS.some((t) => lower.includes(t));
    const hasWidget = WIDGET_KEYWORDS.some((k) => lower.includes(k));
    return hasTrigger || hasWidget;
  }, []);

  // Semantic intent classification: Use LLM to determine widget type from user message.
  // More robust than regex matching for natural language variation.
  const classifyUserIntent = useCallback(async (userMessage: string): Promise<string> => {
    try {
      const res = await fetch(`${ollamaUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: ollamaModel,
          messages: [
            {
              role: 'system',
              content: 'You are a widget type classifier. Output ONLY one word from this list: diagram, comparison, document, kanban, calendar, timeline, tree, form, sensor_overview, diagnostic_overview. Choose the type that best matches the user\'s request.',
            },
            { role: 'user', content: userMessage },
          ],
          stream: false,
          options: { temperature: 0.0, num_predict: 20 },
        }),
      });
      if (!res.ok) return 'document';
      const data = await res.json();
      const response = ((data.message?.content ?? data.response) || 'document').trim().toLowerCase();
      const KNOWN_TYPES = ['diagram', 'comparison', 'document', 'kanban', 'calendar', 'timeline', 'tree', 'form', 'sensor_overview', 'diagnostic_overview'];
      return KNOWN_TYPES.includes(response) ? response : 'document';
    } catch {
      return 'document';
    }
  }, [ollamaUrl, ollamaModel]);

  // Type to domain + data hint mapping for second-pass prompt injection
  const TYPE_TO_DOMAIN_HINT = useMemo(() => ({
    diagram: {
      domain: 'engineering',
      dataHint: `"data": { "title": "...", "diagrams": [{ "kind": "mermaid", "id": "d1", "title": "...", "markup": "flowchart LR\\n  A[\\"...\\"]--> B[\\"...\\"]]" }] }`,
    },
    comparison: {
      domain: 'travel',
      dataHint: `"data": { "flights": [{ "id":"f1","airline":"...","flightNumber":"...","price":800,"currency":"$","duration":"11h","departTime":"09:00","arriveTime":"20:00","stops":0,"carbon":200,"fareClass":"Y","confidence":0.9,"note":"..." }], "fromCity":"...","toCity":"...","departureDate":"2026-03-10" }`,
    },
    diagnostic_overview: {
      domain: 'cloudops',
      dataHint: `"data": { "metrics": [{ "id":"m1","label":"CPU Usage","value":72,"unit":"%","status":"warning","trend":"up","sparkline":[55,60,65,68,72] }] }`,
    },
    sensor_overview: {
      domain: 'iot',
      dataHint: `"data": { "sensors": [{ "id":"s1","name":"Temp-1","location":"Room A","type":"temperature","value":23.5,"unit":"°C","status":"ok","threshold":{"warn":28,"critical":35},"trend":"stable","lastSeen":"${new Date().toISOString()}","battery":87 }] }`,
    },
    kanban: {
      domain: 'project',
      dataHint: `"data": { "title":"Sprint Board","showCardCount":true,"showWipLimits":true,"columns":[{ "id":"c1","title":"Backlog","color":"#6b7280","cards":[{ "id":"k1","title":"...","description":"...","priority":"medium","tags":[],"assignee":"..." }] }] }`,
    },
    calendar: {
      domain: 'engineering',
      dataHint: `"data": { "title":"...","view":"month","focusDate":"${new Date().toISOString().slice(0,10)}","events":[{ "id":"e1","title":"...","start":"2026-03-10T09:00:00Z","end":"2026-03-10T17:00:00Z","category":"...","color":"#3b82f6","description":"..." }] }`,
    },
    timeline: {
      domain: 'ops',
      dataHint: `"data": { "title":"...","direction":"vertical","showTimestamps":true,"events":[{ "id":"ev1","title":"...","timestamp":"${new Date().toISOString()}","description":"...","status":"completed","icon":"check" }] }`,
    },
    tree: {
      domain: 'hr',
      dataHint: `"data": { "title":"...","searchable":true,"showLines":true,"nodes":[{ "id":"n1","label":"CEO","description":"...","children":[{ "id":"n2","label":"CTO","description":"...","children":[] }] }] }`,
    },
    form: {
      domain: 'deployment',
      dataHint: `"data": { "formId":"f1","sections":[{ "id":"s1","title":"...","fields":[{ "id":"f1","type":"text","label":"...","placeholder":"...","required":true }] }] }`,
    },
    document: {
      domain: 'reports',
      dataHint: `"data": { "title":"...","author":"AI Assistant","summary":"2-3 sentence summary","tags":["tag1"],"sections":[{ "id":"s1","title":"...","confidence":0.9,"collapsible":false,"defaultCollapsed":false,"blocks":[{ "type":"paragraph","text":"..." }] }] }`,
    },
  }), []);

  // Second-pass intent generation: when the first LLM response lacked
  // ---INTENT_JSON--- but the user message clearly calls for a widget, make a
  // short focused follow-up call with a minimal prompt that forces JSON output.
  // Detect the best intent type + domain from the user message keywords.
  // Returns a { type, domain, dataHint } tuple used to hard-wire the second-pass prompt.

  const generateIntentSecondPass = useCallback(async (
    userMessage: string,
    llmText: string,
  ): Promise<{ intent: IntentPayloadInput | null; intentError?: string }> => {
    // Classify the widget type using LLM (semantically aware)
    const classifiedType = await classifyUserIntent(userMessage);
    const { domain, dataHint } = TYPE_TO_DOMAIN_HINT[classifiedType as keyof typeof TYPE_TO_DOMAIN_HINT] || TYPE_TO_DOMAIN_HINT.document;

    // Type-specific data shape instructions to inject into the prompt
    const diagramExtra = classifiedType === 'diagram' ? `
MERMAID SYNTAX RULES (MUST follow exactly):
- Use flowchart LR or flowchart TD as the first line
- Node format: ID["Label with spaces"] — node IDs must be single words
- Edge format: A["Source"] --> B["Target"]
- Example: flowchart LR\\n  UI["User Interface"] --> GW["API Gateway"]\\n  GW --> SvcA["Service A"]\\n  SvcA --> DBA[("DB A")]\\n  GW --> MQ[/"Message Queue"/]\\n  MQ --> SvcB["Service B"]
- Use [("label")] for databases, [/"label"/] or [(label)] for queues
- Generate at least 8 nodes with realistic service names from the user request
- Put the full mermaid markup in the "markup" field — newlines as \\n` : '';

    const SECOND_PASS_PROMPT = `You are a JSON generator for a UI framework. Output ONLY a single valid JSON object — absolutely no text before or after it, no markdown code fences, no explanation.

The JSON MUST have exactly this structure (fill in meaningful data from the user request):
{
  "version": "1.0.0",
  "intentId": "${uuid()}",
  "type": "${classifiedType}",
  "domain": "${domain}",
  "primaryGoal": "<describe what this widget shows in one sentence>",
  "confidence": 0.92,
  "density": "operator",
  ${dataHint}
}

RULES:
- type MUST be "${classifiedType}" — do NOT change it
- domain MUST be "${domain}" — do NOT change it
- Fill "data" with real, detailed content based on the user request
- No trailing commas, all strings double-quoted, all JSON valid
${diagramExtra}
Reference context (use this for content, ignore the format — generate structured JSON instead):
${llmText.slice(0, 600)}

OUTPUT ONLY THE JSON OBJECT:`;

    try {
      const res = await fetch(`${ollamaUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: ollamaModel,
          messages: [
            { role: 'system', content: 'You are a JSON generator. Output only valid JSON. No text, no markdown, no explanation. Only the JSON object.' },
            { role: 'user', content: SECOND_PASS_PROMPT },
          ],
          stream: false,
          options: { temperature: 0.0, num_predict: 3000 },
        }),
      });
      if (!res.ok) return { intent: null };
      const data = await res.json();
      const raw = ((data.message?.content ?? data.response) || '') as string;
      // Wrap the raw JSON in the marker so parseResponse can handle it
      const { intent, intentError } = parseResponse(`---INTENT_JSON---\n${raw.trim()}`);
      return { intent: intent ?? null, intentError };
    } catch {
      return { intent: null };
    }
  }, [ollamaUrl, ollamaModel, parseResponse, classifyUserIntent, TYPE_TO_DOMAIN_HINT]);

  // Fetch real process data from the dev-services SSE server.
  const fetchRealProcessData = useCallback(async (): Promise<Array<Record<string, unknown>>> => {
    try {
      const res = await fetch(`${devServiceUrl}/api/processes?top=20`, {
        signal: AbortSignal.timeout(4000),
      });
      if (!res.ok) return [];
      const data = await res.json() as { processes?: Array<Record<string, unknown>> };
      return data.processes ?? [];
    } catch {
      return [];
    }
  }, [devServiceUrl]);

  // Send message to Ollama
  const sendMessage = useCallback(async (userMessage: string) => {
    if (!userMessage.trim() || isStreaming) return;

    const userMsg: ChatMessage = {
      id: uuid(),
      role: 'user',
      content: userMessage.trim(),
      timestamp: Date.now(),
    };

    const assistantId = uuid();
    const loadingMsg: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      isLoading: true,
    };

    setMessages((prev) => [...prev, userMsg, loadingMsg]);
    setInput('');
    setIsStreaming(true);

    // Declared outside try so the catch block can still render the process table
    // even when Ollama is unreachable.
    let prefabProcessIntent: IntentPayloadInput | null = null;

    try {
      const conversationMessages = buildConversationHistory();

      // If user is asking about running apps/processes, fetch real OS data and build
      // the intent directly in the frontend — bypassing Ollama's JSON generation
      // entirely to avoid empty-sections / wrong-shape issues.
      let realDataContext = '';

      if (isProcessQuery(userMessage)) {
        const processes = await fetchRealProcessData();
        if (processes.length > 0) {
          // Sort by CPU desc, keep top 5
          const top5 = (processes as Array<Record<string, unknown>>)
            .sort((a, b) => (b.cpu as number) - (a.cpu as number))
            .slice(0, 5);

          // Build a valid document intent directly — no LLM involved for structure
          prefabProcessIntent = {
            version: '1.0.0',
            intentId: uuid(),
            type: 'document' as any,
            domain: 'engineering',
            primaryGoal: 'Top running processes by CPU usage',
            confidence: 0.99,
            ambiguities: [],
            actions: [],
            data: {
              title: 'Running Processes — CPU & Memory',
              summary: `Live process snapshot from this machine. Showing the top ${top5.length} processes sorted by CPU consumption as of ${new Date().toLocaleTimeString()}.`,
              tags: ['processes', 'system', 'cpu', 'memory', 'live'],
              sections: [
                {
                  id: 's1',
                  title: 'Top Processes by CPU',
                  confidence: 0.99,
                  collapsible: false,
                  defaultCollapsed: false,
                  blocks: [
                    {
                      type: 'table',
                      headers: [
                        { key: 'pid',     label: 'PID'          },
                        { key: 'command', label: 'Command / App' },
                        { key: 'cpu',     label: 'CPU %'        },
                        { key: 'mem',     label: 'Mem %'        },
                        { key: 'user',    label: 'User'         },
                      ],
                      rows: top5.map((p) => {
                        // Show just the executable name, not the full path
                        const fullCmd = String(p.command ?? '');
                        const shortCmd = fullCmd.split('/').pop()?.split(' ')[0] ?? fullCmd;
                        return {
                          pid:     String(p.pid ?? ''),
                          command: shortCmd,
                          cpu:     `${Number(p.cpu ?? 0).toFixed(1)}%`,
                          mem:     `${Number(p.mem ?? 0).toFixed(1)}%`,
                          user:    String(p.user ?? ''),
                        };
                      }),
                      caption: `Live snapshot · ${new Date().toLocaleString()}`,
                    },
                  ],
                },
              ],
            } as any,
          } as IntentPayloadInput;

          // Ask Ollama for a text explanation only — we supply the intent ourselves
          realDataContext =
            '\n\nNOTE: The UI will render a live process table automatically using real OS data. ' +
            'Your job is to respond with ONLY a 1-2 sentence plain-text explanation describing ' +
            'what\'s being shown. Do NOT include ---INTENT_JSON--- or any JSON.\n\n' +
            '--- REAL PROCESS DATA (top 5 by CPU) ---\n' +
            JSON.stringify(top5, null, 2);
        }
      }

      // Build the messages array for /api/chat — system message gets its own role
      // so smaller models (llama3.2 etc.) follow instructions far more reliably.
      const userContent = userMessage + (realDataContext ? realDataContext : '');
      const chatMessages = [
        { role: 'system', content: SYSTEM_PROMPT },
        ...conversationMessages,
        { role: 'user', content: userContent },
      ];

      const response = await fetch(`${ollamaUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: ollamaModel,
          messages: chatMessages,
          stream: false,
          options: {
            temperature: 0.3,
            num_predict: 4096,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama returned ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const rawResponse = (data.message?.content ?? data.response) || '';
      const { text, intent, intentError, rawResponse: parsedRaw } = parseResponse(rawResponse);

      // If we pre-built the intent from real OS process data, use that instead of
      // whatever the LLM generated (which may have empty sections or wrong shape).
      let finalIntent = prefabProcessIntent ?? intent;
      let finalIntentError = prefabProcessIntent ? undefined : intentError;

      // ── Second-pass recovery ─────────────────────────────────────────────────
      // When the LLM produced only plain text but the user's request clearly
      // warrants a UI widget, make a short targeted call that forces JSON output.
      if (!finalIntent && !prefabProcessIntent && requiresIntent(userMessage)) {
        const { intent: secondIntent, intentError: secondError } = await generateIntentSecondPass(userMessage, text);
        if (secondIntent) {
          finalIntent = secondIntent;
          finalIntentError = secondError;
        }
      }

      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: text, intent: finalIntent, intentError: finalIntentError, rawResponse: parsedRaw, isLoading: false }
            : m,
        ),
      );
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Unknown error';
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? {
                ...m,
                // If we pre-built the process table, show it even when Ollama is down
                content: prefabProcessIntent
                  ? `Showing live process data from this machine (Ollama unavailable: ${errMsg}).`
                  : `Failed to reach Ollama: ${errMsg}. Make sure Ollama is running at ${ollamaUrl}`,
                intent: prefabProcessIntent ?? undefined,
                isLoading: false,
              }
            : m,
        ),
      );
    } finally {
      setIsStreaming(false);
    }
  }, [isStreaming, ollamaUrl, ollamaModel, buildConversationHistory, parseResponse, isProcessQuery, fetchRealProcessData, requiresIntent, generateIntentSecondPass]);

  // Handle form submit
  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  }, [input, sendMessage]);

  // Handle Enter key (Shift+Enter for newline)
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }, [input, sendMessage]);

  // Toggle intent JSON visibility
  const toggleIntentExpanded = useCallback((messageId: string) => {
    setExpandedIntents((prev) => {
      const next = new Set(prev);
      if (next.has(messageId)) next.delete(messageId);
      else next.add(messageId);
      return next;
    });
  }, []);

  // Copy intent JSON
  const copyIntentJson = useCallback((messageId: string, intent: IntentPayloadInput) => {
    navigator.clipboard.writeText(JSON.stringify(intent, null, 2));
    setCopiedId(messageId);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  // Compile an intent for inline rendering — returns {view, error}
  const compileForRender = useCallback((intent: IntentPayloadInput): { view: ReturnType<typeof compileIntent> | null; error: string | null } => {
    try {
      const parsed = IntentPayloadSchema.parse(intent);
      const view = compileIntent(parsed, registry, { userDensityOverride: 'operator' });
      return { view, error: null };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn('[HARI] compileForRender failed:', msg);
      return { view: null, error: msg };
    }
  }, []);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      maxHeight: 'calc(100vh - 120px)',
      backgroundColor: 'var(--hari-bg)',
      borderRadius: '12px',
      overflow: 'hidden',
      border: '1px solid var(--hari-border)',
    }}>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 20px',
        borderBottom: '1px solid var(--hari-border)',
        backgroundColor: 'var(--hari-surface)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: 36, height: 36, borderRadius: '10px',
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Sparkles size={20} color="#fff" />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--hari-text)' }}>
              HARI Agent Chat
            </h2>
            <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--hari-text-muted)' }}>
              Powered by Ollama · {ollamaModel}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            backgroundColor: isStreaming ? '#f59e0b' : '#22c55e',
          }} />
          <span style={{ fontSize: '0.7rem', color: 'var(--hari-text-secondary)' }}>
            {isStreaming ? 'Generating...' : 'Ready'}
          </span>
          <button
            onClick={() => setShowSettings(!showSettings)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '4px', borderRadius: '6px', display: 'flex',
              color: 'var(--hari-text-secondary)',
            }}
            className="hover:bg-gray-100"
            title="Settings"
          >
            <Settings size={18} />
          </button>
        </div>
      </div>

      {/* ── Settings panel ─────────────────────────────────────────────── */}
      {showSettings && (
        <div style={{
          padding: '12px 20px',
          borderBottom: '1px solid var(--hari-border)',
          backgroundColor: 'var(--hari-surface-alt)',
          display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap',
          fontSize: '0.78rem',
        }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--hari-text-secondary)' }}>
            URL:
            <input
              type="text"
              value={ollamaUrl}
              onChange={(e) => setOllamaUrl(e.target.value)}
              style={{
                padding: '4px 8px', borderRadius: '6px',
                border: '1px solid var(--hari-border)', fontSize: '0.75rem',
                width: '200px', fontFamily: 'monospace',
                background: 'var(--hari-surface)', color: 'var(--hari-text)',
              }}
            />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--hari-text-secondary)' }} title="Dev-services SSE server URL (used for real system data)">
            Dev Service:
            <input
              type="text"
              value={devServiceUrl}
              onChange={(e) => setDevServiceUrl(e.target.value)}
              style={{
                padding: '4px 8px', borderRadius: '6px',
                border: '1px solid var(--hari-border)', fontSize: '0.75rem',
                width: '200px', fontFamily: 'monospace',
                background: 'var(--hari-surface)', color: 'var(--hari-text)',
              }}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', color: 'var(--hari-text-secondary)' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Model</span>
            {availableModels.length > 0 && !useCustomModel ? (
              <div style={{ display: 'flex', gap: '4px' }}>
                <select
                  value={ollamaModel}
                  onChange={(e) => setOllamaModel(e.target.value)}
                  style={{
                    padding: '4px 8px', borderRadius: '6px',
                    border: '1px solid var(--hari-border)', fontSize: '0.75rem',
                    width: '180px', fontFamily: 'monospace',
                    background: 'var(--hari-surface)', cursor: 'pointer', color: 'var(--hari-text)',
                  }}
                >
                  {availableModels.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
                <button
                  onClick={() => setUseCustomModel(true)}
                  title="Type a custom model name"
                  style={{
                    padding: '4px 6px', borderRadius: '6px',
                    border: '1px solid var(--hari-border)', background: 'var(--hari-surface)',
                    fontSize: '0.7rem', cursor: 'pointer', color: 'var(--hari-text-secondary)',
                  }}
                >✎</button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '4px' }}>
                <input
                  type="text"
                  value={ollamaModel}
                  onChange={(e) => setOllamaModel(e.target.value)}
                  placeholder="e.g. llama3.2:latest"
                  style={{
                    padding: '4px 8px', borderRadius: '6px',
                    border: '1px solid var(--hari-border)', fontSize: '0.75rem',
                    width: '180px', fontFamily: 'monospace',
                    background: 'var(--hari-surface)', color: 'var(--hari-text)',
                  }}
                />
                {availableModels.length > 0 && (
                  <button
                    onClick={() => {
                      if (availableModels.length > 0) {
                        if (!availableModels.includes(ollamaModel)) setOllamaModel(availableModels[0]);
                        setUseCustomModel(false);
                      }
                    }}
                    title="Pick from available models"
                    style={{
                      padding: '4px 6px', borderRadius: '6px',
                      border: '1px solid var(--hari-border)', background: 'var(--hari-surface)',
                      fontSize: '0.7rem', cursor: 'pointer', color: 'var(--hari-text-secondary)',
                    }}
                  >☰</button>
                )}
              </div>
            )}
          </label>
          <button
            onClick={() => {
              setMessages([{
                id: 'system-welcome',
                role: 'system',
                content: 'Chat cleared. Start a new conversation!',
                timestamp: Date.now(),
              }]);
            }}
            style={{
              padding: '4px 12px', borderRadius: '6px',
              border: '1px solid var(--hari-border)', background: 'var(--hari-surface)',
              fontSize: '0.75rem', cursor: 'pointer', color: 'var(--hari-text-secondary)',
            }}
          >
            Clear Chat
          </button>
        </div>
      )}

      {/* ── Messages ───────────────────────────────────────────────────── */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '16px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
      }}>
        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            isExpanded={expandedIntents.has(msg.id)}
            isCopied={copiedId === msg.id}
            onToggleExpand={() => toggleIntentExpanded(msg.id)}
            onCopyIntent={() => msg.intent && copyIntentJson(msg.id, msg.intent)}
            compileForRender={compileForRender}
          />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* ── Suggestion chips (only show when few messages) ─────────────── */}
      {messages.length <= 2 && (
        <div style={{
          padding: '8px 20px 4px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '6px',
        }}>
          {SUGGESTION_CHIPS.map((chip) => (
            <button
              key={chip.label}
              onClick={() => sendMessage(chip.prompt)}
              disabled={isStreaming}
              style={{
                padding: '6px 12px',
                borderRadius: '18px',
                border: '1px solid var(--hari-border)',
                backgroundColor: 'var(--hari-surface)',
                fontSize: '0.73rem',
                color: 'var(--hari-text-secondary)',
                cursor: isStreaming ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s',
                whiteSpace: 'nowrap',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--hari-surface-alt)';
                e.currentTarget.style.borderColor = '#6366f1';
                e.currentTarget.style.color = '#4338ca';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--hari-surface)';
                e.currentTarget.style.borderColor = 'var(--hari-border)';
                e.currentTarget.style.color = 'var(--hari-text-secondary)';
              }}
            >
              {chip.label}
            </button>
          ))}
        </div>
      )}

      {/* ── Input area ─────────────────────────────────────────────────── */}
      <form
        onSubmit={handleSubmit}
        style={{
          padding: '12px 20px 16px',
          borderTop: '1px solid var(--hari-border)',
          backgroundColor: 'var(--hari-surface)',
          display: 'flex',
          gap: '10px',
          alignItems: 'flex-end',
        }}
      >
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask me to create a dashboard, form, kanban board, report, diagram..."
          disabled={isStreaming}
          rows={1}
          style={{
            flex: 1,
            padding: '10px 14px',
            borderRadius: '10px',
            border: '1px solid var(--hari-border)',
            fontSize: '0.85rem',
            resize: 'none',
            minHeight: '42px',
            maxHeight: '120px',
            fontFamily: 'inherit',
            outline: 'none',
            background: 'var(--hari-surface)',
            color: 'var(--hari-text)',
            transition: 'border-color 0.15s',
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = '#6366f1'; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--hari-border)'; }}
          onInput={(e) => {
            const ta = e.currentTarget;
            ta.style.height = 'auto';
            ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
          }}
        />
        <button
          type="submit"
          disabled={isStreaming || !input.trim()}
          style={{
            width: 42, height: 42,
            borderRadius: '10px',
            border: 'none',
            background: isStreaming || !input.trim() ? '#e2e8f0' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            color: isStreaming || !input.trim() ? '#94a3b8' : '#fff',
            cursor: isStreaming || !input.trim() ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
            transition: 'all 0.15s',
          }}
        >
          {isStreaming ? <Loader size={18} className="animate-spin" /> : <Send size={18} />}
        </button>
      </form>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// markdownToDocumentIntent — fallback converter
//
// When the LLM forgets ---INTENT_JSON--- but its response contains markdown
// tables (lines starting with `|`), this converts the whole markdown text into
// a `document` intent with proper table blocks so the UI can render it nicely.
// Returns null when no markdown tables are detected.
// ─────────────────────────────────────────────────────────────────────────────

function markdownToDocumentIntent(rawText: string): IntentPayloadInput | null {
  const lines = rawText.split('\n');
  // Quick check: must have at least one markdown table row
  if (!lines.some((l) => l.trim().startsWith('|') && l.includes('|', 1))) return null;

  type DocBlock = Record<string, unknown>;
  type DocSection = { id: string; title?: string; blocks: DocBlock[]; confidence: number; collapsible: boolean; defaultCollapsed: boolean };

  const sections: DocSection[] = [];
  let currentSection: DocSection = {
    id: `section-1`,
    blocks: [],
    confidence: 0.85,
    collapsible: true,
    defaultCollapsed: false,
  };

  const parseRow = (l: string): string[] =>
    l.split('|').slice(1, -1).map((c) => c.trim().replace(/\*\*/g, ''));

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Heading → new section
    const hMatch = trimmed.match(/^(#{1,4})\s+(.+)/);
    if (hMatch) {
      if (currentSection.blocks.length > 0 || currentSection.title) {
        sections.push(currentSection);
      }
      currentSection = {
        id: `section-${sections.length + 2}`,
        title: hMatch[2].replace(/\*\*/g, ''),
        blocks: [],
        confidence: 0.85,
        collapsible: true,
        defaultCollapsed: false,
      };
      i++; continue;
    }

    // Bold-only line → new section heading
    const boldHeading = trimmed.match(/^\*\*([^*]+)\*\*\s*$/);
    if (boldHeading) {
      if (currentSection.blocks.length > 0 || currentSection.title) {
        sections.push(currentSection);
      }
      currentSection = {
        id: `section-${sections.length + 2}`,
        title: boldHeading[1],
        blocks: [],
        confidence: 0.85,
        collapsible: true,
        defaultCollapsed: false,
      };
      i++; continue;
    }

    // Markdown table
    if (trimmed.startsWith('|')) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        tableLines.push(lines[i]); i++;
      }
      if (tableLines.length >= 2) {
        const headerCells = parseRow(tableLines[0]);
        const dataRows = tableLines.slice(2).map(parseRow); // skip separator row
        const headers = headerCells.map((h, j) => ({
          key: h.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/, '') || `col${j}`,
          label: h || `Column ${j + 1}`,
          align: 'left' as const,
        }));
        const rows = dataRows.map((cells) => {
          const obj: Record<string, unknown> = {};
          headers.forEach((h, j) => { obj[h.key] = cells[j] ?? ''; });
          return obj;
        });
        currentSection.blocks.push({ type: 'table', headers, rows });
      }
      continue;
    }

    // Non-empty text line → paragraph (accumulate consecutive lines)
    if (trimmed && !/^[-*]{3,}$/.test(trimmed)) {
      const paraLines: string[] = [trimmed];
      i++;
      while (
        i < lines.length &&
        lines[i].trim() &&
        !lines[i].trim().startsWith('|') &&
        !lines[i].trim().match(/^#{1,4}\s/) &&
        !lines[i].trim().match(/^\*\*[^*]+\*\*\s*$/)
      ) {
        paraLines.push(lines[i].trim()); i++;
      }
      const fullText = paraLines.join(' ').replace(/\*\*/g, '').trim();
      if (fullText.length > 10) {
        currentSection.blocks.push({ type: 'paragraph', text: fullText });
      }
      continue;
    }

    i++;
  }

  if (currentSection.blocks.length > 0 || currentSection.title) sections.push(currentSection);

  // Only proceed if at least one table block was extracted
  const hasTable = sections.some((s) => s.blocks.some((b) => b.type === 'table'));
  if (!hasTable || sections.length === 0) return null;

  // Give the first section a sensible default id / blocks
  sections.forEach((s, idx) => { if (!s.id) s.id = `section-${idx + 1}`; if (s.blocks.length === 0) s.blocks = [{ type: 'paragraph', text: 'See table above.' }]; });

  return {
    version: '1.0.0',
    intentId: uuid(),
    type: 'document',
    domain: 'reports',
    primaryGoal: 'Display structured data from AI response',
    confidence: 0.85,
    data: {
      title: 'AI Response',
      sections,
      tags: ['auto-converted'],
      refreshable: false,
    },
  } as unknown as IntentPayloadInput;
}

// MarkdownText — lightweight markdown renderer, zero dependencies
//
// Supports: # headings, **bold**, *italic*, `inline code`, ```code blocks```,
// - / * unordered lists, 1. ordered lists, > blockquotes, --- rules, \n\n paras,
// | markdown tables |
// ─────────────────────────────────────────────────────────────────────────────

function MarkdownText({ text, color = '#1e293b' }: { text: string; color?: string }) {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;

  // Inline formatting: bold, italic, inline-code, links
  function inlineFormat(raw: string, key: string | number): React.ReactNode {
    const parts: React.ReactNode[] = [];
    const RE = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[([^\]]+)\]\(([^)]+)\))/g;
    let last = 0, m: RegExpExecArray | null;
    let idx = 0;
    while ((m = RE.exec(raw)) !== null) {
      if (m.index > last) parts.push(<span key={`t${key}-${idx++}`}>{raw.slice(last, m.index)}</span>);
      const tok = m[0];
      if (tok.startsWith('`')) {
        parts.push(<code key={`c${key}-${idx++}`} style={{ fontFamily: 'monospace', fontSize: '0.82em', background: 'var(--hari-surface-alt)', color: 'var(--hari-text)', padding: '1px 4px', borderRadius: '3px' }}>{tok.slice(1, -1)}</code>);
      } else if (tok.startsWith('**')) {
        parts.push(<strong key={`b${key}-${idx++}`}>{tok.slice(2, -2)}</strong>);
      } else if (tok.startsWith('*')) {
        parts.push(<em key={`i${key}-${idx++}`}>{tok.slice(1, -1)}</em>);
      } else if (m[2] && m[3]) {
        parts.push(<a key={`a${key}-${idx++}`} href={m[3]} target="_blank" rel="noreferrer" style={{ color: '#6366f1', textDecoration: 'underline' }}>{m[2]}</a>);
      }
      last = m.index + tok.length;
    }
    if (last < raw.length) parts.push(<span key={`t${key}-end`}>{raw.slice(last)}</span>);
    return parts.length ? parts : raw;
  }

  while (i < lines.length) {
    const line = lines[i];
    const key = i;

    // Fenced code block
    if (line.trimStart().startsWith('```')) {
      const lang = line.trim().slice(3);
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trimStart().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      elements.push(
        <pre key={key} style={{
          margin: '0.5rem 0', padding: '10px 12px',
          background: '#0f172a', color: '#e2e8f0',
          borderRadius: '8px', fontSize: '0.78rem',
          fontFamily: 'monospace', overflowX: 'auto',
          whiteSpace: 'pre', lineHeight: 1.55,
        }}>
          {lang && <span style={{ display: 'block', color: 'var(--hari-text-muted)', fontSize: '0.68rem', marginBottom: '4px' }}>{lang}</span>}
          {codeLines.join('\n')}
        </pre>
      );
      i++; // skip closing ```
      continue;
    }

    // Headings
    const hMatch = line.match(/^(#{1,4})\s+(.+)/);
    if (hMatch) {
      const level = hMatch[1].length;
      const sizes = ['1.1rem','1rem','0.9rem','0.85rem'];
      elements.push(
        <div key={key} style={{ fontWeight: 700, fontSize: sizes[level-1], color, margin: '0.6rem 0 0.2rem', lineHeight: 1.3 }}>
          {inlineFormat(hMatch[2], key)}
        </div>
      );
      i++; continue;
    }

    // Horizontal rule
    if (/^(---+|\*\*\*+)$/.test(line.trim())) {
      elements.push(<hr key={key} style={{ border: 'none', borderTop: '1px solid var(--hari-border)', margin: '0.75rem 0' }} />);
      i++; continue;
    }

    // Markdown table — collect consecutive |…| lines and render as <table>
    if (line.trim().startsWith('|') && line.includes('|', 1)) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        tableLines.push(lines[i]); i++;
      }
      if (tableLines.length >= 2) {
        const parseRow = (l: string): string[] =>
          l.split('|').slice(1, -1).map((c) => c.trim());
        const headerCells = parseRow(tableLines[0]);
        // tableLines[1] is the separator row — skip it
        const dataRows = tableLines.slice(2).map(parseRow);
        elements.push(
          <div key={key} style={{ overflowX: 'auto', margin: '0.5rem 0' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.8rem' }}>
              <thead>
                <tr>
                  {headerCells.map((h, j) => (
                    <th key={j} style={{
                      border: '1px solid var(--hari-border)', padding: '6px 10px',
                      background: 'var(--hari-surface-alt, #f1f5f9)',
                      fontWeight: 600, textAlign: 'left', color, whiteSpace: 'nowrap',
                    }}>
                      {inlineFormat(h, `${key}-h${j}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dataRows.map((row, r) => (
                  <tr key={r} style={{ backgroundColor: r % 2 === 1 ? 'var(--hari-surface-alt, #f8fafc)' : 'transparent' }}>
                    {row.map((cell, j) => (
                      <td key={j} style={{
                        border: '1px solid var(--hari-border)', padding: '5px 10px', color,
                      }}>
                        {inlineFormat(cell, `${key}-r${r}c${j}`)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
      continue;
    }

    // Blockquote
    if (line.startsWith('> ')) {
      elements.push(
        <div key={key} style={{
          borderLeft: '3px solid #6366f1', paddingLeft: '10px',
          color: 'var(--hari-text-secondary)', fontStyle: 'italic',
          margin: '0.25rem 0', fontSize: '0.85rem',
        }}>
          {inlineFormat(line.slice(2), key)}
        </div>
      );
      i++; continue;
    }

    // Unordered list
    if (/^[\-\*\+]\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[\-\*\+]\s/.test(lines[i])) {
        items.push(lines[i].replace(/^[\-\*\+]\s/, ''));
        i++;
      }
      elements.push(
        <ul key={key} style={{ margin: '0.25rem 0 0.25rem 1.25rem', padding: 0, fontSize: '0.84rem', lineHeight: 1.6 }}>
          {items.map((it, j) => <li key={j} style={{ marginBottom: '1px' }}>{inlineFormat(it, `${key}-${j}`)}</li>)}
        </ul>
      );
      continue;
    }

    // Ordered list
    if (/^\d+\.\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s/, ''));
        i++;
      }
      elements.push(
        <ol key={key} style={{ margin: '0.25rem 0 0.25rem 1.25rem', padding: 0, fontSize: '0.84rem', lineHeight: 1.6 }}>
          {items.map((it, j) => <li key={j} style={{ marginBottom: '1px' }}>{inlineFormat(it, `${key}-${j}`)}</li>)}
        </ol>
      );
      continue;
    }

    // Blank line → paragraph spacing
    if (line.trim() === '') {
      elements.push(<div key={key} style={{ height: '0.4rem' }} />);
      i++; continue;
    }

    // Plain paragraph line
    elements.push(
      <div key={key} style={{ fontSize: '0.84rem', lineHeight: 1.6, color }}>
        {inlineFormat(line, key)}
      </div>
    );
    i++;
  }

  return <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>{elements}</div>;
}

// ─────────────────────────────────────────────────────────────────────────────
// MessageBubble — Renders a single message with optional inline HARI widget
// ─────────────────────────────────────────────────────────────────────────────

interface MessageBubbleProps {
  message: ChatMessage;
  isExpanded: boolean;
  isCopied: boolean;
  onToggleExpand: () => void;
  onCopyIntent: () => void;
  compileForRender: (intent: IntentPayloadInput) => { view: ReturnType<typeof compileIntent> | null; error: string | null };
}

function MessageBubble({ message, isExpanded, isCopied, onToggleExpand, onCopyIntent, compileForRender }: MessageBubbleProps) {
  const { view: compiled, error: compileError } = useMemo(
    () => message.intent ? compileForRender(message.intent) : { view: null, error: null },
    [message.intent, compileForRender],
  );

  // System message
  if (message.role === 'system') {
    return (
      <div style={{
        textAlign: 'center',
        padding: '8px 16px',
        fontSize: '0.75rem',
        color: 'var(--hari-text-muted)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '6px',
      }}>
        <Sparkles size={12} />
        {message.content}
      </div>
    );
  }

  const isUser = message.role === 'user';

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: isUser ? 'flex-end' : 'flex-start',
      gap: '6px',
    }}>
      {/* Avatar + name row */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        flexDirection: isUser ? 'row-reverse' : 'row',
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: '8px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backgroundColor: isUser ? '#e0e7ff' : '#f3e8ff',
          color: isUser ? '#4338ca' : '#7c3aed',
          flexShrink: 0,
        }}>
          {isUser ? <User size={14} /> : <Bot size={14} />}
        </div>
        <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--hari-text-secondary)' }}>
          {isUser ? 'You' : 'HARI Agent'}
        </span>
        <span style={{ fontSize: '0.62rem', color: 'var(--hari-text-muted)' }}>
          {new Date(message.timestamp).toLocaleTimeString()}
        </span>
      </div>

      {/* Message content bubble */}
      <div style={{
        maxWidth: isUser ? '75%' : '95%',
        width: isUser ? undefined : '95%',
      }}>
        {/* Text content */}
        {message.isLoading ? (
          <div style={{
            padding: '12px 16px',
            borderRadius: '12px',
            backgroundColor: 'var(--hari-surface)',
            border: '1px solid var(--hari-border)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.82rem',
            color: 'var(--hari-text-secondary)',
          }}>
            <Loader size={14} className="animate-spin" />
            Thinking...
          </div>
        ) : (
          <>
            {message.content && (
              <div style={{
                padding: '10px 14px',
                borderRadius: isUser ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
                backgroundColor: isUser ? '#6366f1' : 'var(--hari-surface)',
                color: isUser ? '#fff' : 'var(--hari-text)',
                border: isUser ? 'none' : '1px solid var(--hari-border)',
                wordBreak: 'break-word',
              }}>
                {/* User messages: plain text. Assistant: markdown-rendered */}
                {isUser
                  ? <span style={{ fontSize: '0.84rem', lineHeight: '1.55', whiteSpace: 'pre-wrap' }}>{message.content}</span>
                  : <MarkdownText text={message.content} color="var(--hari-text)" />
                }
              </div>
            )}

            {/* Intent error */}
            {message.intentError && (
              <div style={{
                marginTop: '8px',
                padding: '8px 12px',
                borderRadius: '8px',
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                fontSize: '0.73rem',
                color: '#991b1b',
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', marginBottom: message.rawResponse ? '6px' : 0 }}>
                  <AlertCircle size={14} style={{ marginTop: 2, flexShrink: 0 }} />
                  <span>Widget generation failed: {message.intentError}</span>
                </div>
                {message.rawResponse && (
                  <details style={{ marginTop: '6px' }}>
                    <summary style={{ cursor: 'pointer', fontSize: '0.68rem', color: '#dc2626', fontWeight: 600 }}>
                      Show raw Ollama response
                    </summary>
                    <pre style={{
                      margin: '6px 0 0',
                      fontSize: '0.6rem', fontFamily: 'monospace',
                      color: '#7f1d1d', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                      maxHeight: '180px', overflowY: 'auto',
                      background: '#fff5f5', borderRadius: '4px', padding: '6px',
                    }}>
                      {message.rawResponse}
                    </pre>
                  </details>
                )}
              </div>
            )}

            {/* ── Inline HARI Widget ────────────────────────────────────── */}
            {compiled && (
              <div style={{ marginTop: '10px' }}>
                {/* Widget container */}
                <div style={{
                  borderRadius: '10px',
                  border: '1px solid #c7d2fe',
                  backgroundColor: 'var(--hari-surface)',
                  overflow: 'hidden',
                }}>
                  {/* Widget header */}
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 14px',
                    borderBottom: '1px solid var(--hari-border)',
                    backgroundColor: '#eef2ff',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Sparkles size={12} color="#6366f1" />
                      <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#4338ca' }}>
                        {compiled.type.replace(/_/g, ' ')} · {compiled.domain}
                      </span>
                      <span style={{
                        fontSize: '0.62rem', color: '#818cf8',
                        backgroundColor: '#e0e7ff', padding: '1px 6px', borderRadius: '4px',
                      }}>
                        {(compiled.confidence * 100).toFixed(0)}% confidence
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button
                        onClick={onCopyIntent}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          padding: '2px', color: '#818cf8', display: 'flex',
                        }}
                        title="Copy intent JSON"
                      >
                        {isCopied ? <Check size={13} /> : <Copy size={13} />}
                      </button>
                      <button
                        onClick={onToggleExpand}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          padding: '2px', color: '#818cf8', display: 'flex',
                        }}
                        title={isExpanded ? 'Hide JSON' : 'Show JSON'}
                      >
                        {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                      </button>
                    </div>
                  </div>

                  {/* Raw JSON (collapsed by default) */}
                  {isExpanded && (
                    <div style={{
                      maxHeight: '200px', overflowY: 'auto',
                      padding: '8px 14px',
                      borderBottom: '1px solid var(--hari-border)',
                      backgroundColor: 'var(--hari-surface-alt)',
                    }}>
                      <pre style={{
                        margin: 0, fontSize: '0.62rem', fontFamily: 'monospace',
                        color: 'var(--hari-text-secondary)', whiteSpace: 'pre-wrap',
                      }}>
                        {JSON.stringify(message.intent, null, 2)}
                      </pre>
                    </div>
                  )}

                  {/* Rendered widget */}
                  <div style={{ padding: '16px' }}>
                    <IntentErrorBoundary
                      fallbackData={compiled.data}
                      domain={compiled.domain}
                      intentType={compiled.type}
                    >
                      <IntentRenderer compiledView={compiled} />
                    </IntentErrorBoundary>
                  </div>
                </div>
              </div>
            )}

            {/* Compile failed or no registered component */}
            {!compiled && message.intent && !message.intentError && (
              <div style={{
                marginTop: '8px',
                padding: '8px 12px',
                borderRadius: '8px',
                backgroundColor: '#fffbeb',
                border: '1px solid #fde68a',
                fontSize: '0.73rem',
                color: '#92400e',
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', marginBottom: '4px' }}>
                  <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                  <span>
                    {compileError
                      ? <><strong>Widget compile error:</strong> {compileError}</>
                      : <strong>Intent type "{(message.intent as Record<string,unknown>).type as string}" / domain "{(message.intent as Record<string,unknown>).domain as string}" has no registered component.</strong>
                    }
                  </span>
                </div>
                <details>
                  <summary style={{ cursor: 'pointer', fontSize: '0.68rem', fontWeight: 600 }}>Show intent JSON</summary>
                  <pre style={{
                    margin: '6px 0 0', fontSize: '0.6rem', fontFamily: 'monospace',
                    color: '#78350f', whiteSpace: 'pre-wrap',
                    maxHeight: '160px', overflowY: 'auto',
                    background: '#fef9c3', borderRadius: '4px', padding: '6px',
                  }}>
                    {JSON.stringify(message.intent, null, 2)}
                  </pre>
                </details>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
