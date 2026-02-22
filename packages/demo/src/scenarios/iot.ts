import { v4 as uuid } from 'uuid';
import type { IntentPayloadInput } from '@hari/core';

// ─────────────────────────────────────────────────────────────────────────────
// IoT scenario: "Show me the building sensors with anomalies"
//
// Demonstrates HARI registry extensibility: this is a brand new domain
// ('iot') with a brand new intent type ('sensor_overview') and a custom
// component (SensorCard).  The compiler and renderer are unchanged.
//
// The agent has 88% confidence — it knows the user wants anomalies surfaced
// but isn't sure whether they care about offline sensors or just threshold
// violations.  It surfaces a toggle to disambiguate.
// ─────────────────────────────────────────────────────────────────────────────

const now = new Date().toISOString();
const minAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();

export const iotIntent: IntentPayloadInput = {
  version: '1.0.0',
  intentId: uuid(),
  type: 'sensor_overview',
  domain: 'iot',
  primaryGoal: 'Surface anomalous readings across Building A sensor network',
  confidence: 0.88,
  density: 'operator',
  explain: true,
  layoutHint: 'dashboard',
  priorityFields: ['status', 'value', 'trend'],

  ambiguities: [
    {
      type: 'toggle',
      id: 'show_offline',
      label: 'Include offline sensors',
      description: 'Show sensors that have not reported in the last 5 minutes.',
      value: false,
      parameterKey: 'filters.includeOffline',
    },
    {
      type: 'single_select',
      id: 'sort_by',
      label: 'Sort sensors by',
      options: [
        { value: 'status',   label: 'Severity' },
        { value: 'location', label: 'Location' },
        { value: 'type',     label: 'Type' },
      ],
      value: 'status',
      parameterKey: 'sort.field',
    },
    {
      type: 'multi_select',
      id: 'sensor_types',
      label: 'Sensor types to show',
      options: [
        { value: 'temperature', label: 'Temperature' },
        { value: 'humidity',    label: 'Humidity' },
        { value: 'co2',         label: 'CO₂' },
        { value: 'power',       label: 'Power' },
      ],
      value: ['temperature', 'co2', 'power'],
      parameterKey: 'filters.types',
    },
  ],

  data: {
    sensors: [
      {
        id: 's1',
        name: 'Server Room Temp',
        location: 'Basement B1',
        type: 'temperature',
        value: 32.4,
        unit: '°C',
        status: 'critical',
        threshold: { warn: 28, critical: 30 },
        trend: 'rising',
        lastSeen: minAgo(1),
        battery: null,
        firmwareVersion: '2.1.4',
        samplingRateHz: 0.1,
        rawPayload: { rssi: -72, seq: 4821, checksum: 'a9f3' },
      },
      {
        id: 's2',
        name: 'Meeting Room CO₂',
        location: 'Floor 3, Room 3B',
        type: 'co2',
        value: 1840,
        unit: 'ppm',
        status: 'warning',
        threshold: { warn: 1000, critical: 2000 },
        trend: 'rising',
        lastSeen: minAgo(2),
        battery: 76,
        firmwareVersion: '1.9.2',
        samplingRateHz: 0.017,
        rawPayload: { rssi: -65, seq: 1203, checksum: 'c14e' },
      },
      {
        id: 's3',
        name: 'UPS Power Draw',
        location: 'Basement B1',
        type: 'power',
        value: 4.7,
        unit: 'kW',
        status: 'ok',
        threshold: { warn: 6, critical: 8 },
        trend: 'stable',
        lastSeen: now,
        battery: null,
        firmwareVersion: '3.0.1',
        samplingRateHz: 1,
        rawPayload: { rssi: -58, seq: 98201, checksum: 'ff01' },
      },
      {
        id: 's4',
        name: 'Lobby Temperature',
        location: 'Floor 1, Lobby',
        type: 'temperature',
        value: 21.8,
        unit: '°C',
        status: 'ok',
        threshold: { warn: 26, critical: 30 },
        trend: 'stable',
        lastSeen: minAgo(3),
        battery: 92,
        firmwareVersion: '2.1.4',
        samplingRateHz: 0.1,
        rawPayload: { rssi: -61, seq: 5012, checksum: 'b7a2' },
      },
      {
        id: 's5',
        name: 'Archive Humidity',
        location: 'Floor 2, Archive',
        type: 'humidity',
        value: 68,
        unit: '%RH',
        status: 'warning',
        threshold: { warn: 60, critical: 75 },
        trend: 'rising',
        lastSeen: minAgo(5),
        battery: 34,
        firmwareVersion: '1.8.0',
        samplingRateHz: 0.033,
        rawPayload: { rssi: -79, seq: 2109, checksum: 'd8c1' },
      },
      {
        id: 's6',
        name: 'Roof Weather Sensor',
        location: 'Roof Level',
        type: 'temperature',
        value: 0,
        unit: '°C',
        status: 'offline',
        lastSeen: minAgo(47),
        battery: 12,
        firmwareVersion: '2.0.9',
        samplingRateHz: 0.033,
        rawPayload: null,
      },
    ],
  },

  actions: [
    {
      id: 'acknowledge_alerts',
      label: 'Acknowledge Alerts',
      variant: 'primary',
      safety: {
        confidence: 0.97,
        reversible: true,
        riskLevel: 'low',
        requiresConfirmation: false,
        explanation: 'Marks all current threshold violations as acknowledged. You will still receive new alerts.',
      },
    },
    {
      id: 'dispatch_technician',
      label: 'Dispatch Technician',
      variant: 'secondary',
      safety: {
        confidence: 0.84,
        reversible: true,
        riskLevel: 'medium',
        requiresConfirmation: true,
        explanation: 'Creates a work order for the facilities team to inspect the server room and archive room.',
        blastRadius: {
          scope: 'team',
          affectedSystems: ['facilities-management', 'scheduling'],
          downstreamEffects: 'Technician will be paged immediately.',
        },
      },
    },
    {
      id: 'export_report',
      label: 'Export Sensor Report',
      variant: 'info',
      safety: {
        confidence: 0.99,
        reversible: true,
        riskLevel: 'low',
        requiresConfirmation: false,
        explanation: 'Generates a PDF snapshot of current sensor state as a living document.',
      },
    },
  ],

  explainability: {
    overview: {
      elementId: 'overview',
      summary:
        'Building A has 6 active sensor nodes. 2 threshold violations detected (server room temperature at 32.4°C, meeting room CO₂ at 1840 ppm). Roof sensor is offline — battery critically low.',
      dataSources: [
        { name: 'Building BMS MCP',     type: 'mcp', freshness: now,        reliability: 0.96 },
        { name: 'InfluxDB Telemetry',   type: 'database', freshness: now,   reliability: 0.99 },
        { name: 'Sensor Baseline DB',   type: 'database', freshness: '2025-06-01T00:00:00Z', reliability: 0.95 },
      ],
      assumptions: [
        'Thresholds sourced from building spec BMS-2024-A',
        'Offline threshold: no ping for > 5 minutes',
        'Battery < 20% classified as critically low',
      ],
      confidenceRange: { low: 0.82, high: 0.94 },
      alternativesConsidered: [
        { description: 'Sort by location', reason: 'Severity-first is more actionable for ops staff.' },
        { description: 'Show all sensor types', reason: 'Motion sensors had no anomalies; omitted to reduce noise.' },
      ],
      whatIfQueries: [
        'What if server room temp hits 35°C?',
        'When will the roof sensor battery die?',
        'Which alerts can wait until morning?',
      ],
    },
  },
};
