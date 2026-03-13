import { v4 as uuid } from 'uuid';
import type { IntentPayloadInput } from '@hari/core';

// ─────────────────────────────────────────────────────────────────────────────
// Map scenario: "Fleet & Warehouse Locations"
//
// Demonstrates the map intent type with markers (warehouses, delivery trucks),
// polygons (coverage zones), polylines (delivery routes), circles (service areas),
// and heatmap data (demand intensity). Uses layers for expert-density toggling.
// ─────────────────────────────────────────────────────────────────────────────

export const mapFleetIntent: IntentPayloadInput = {
  version: '1.0.0',
  intentId: uuid(),
  type: 'map',
  domain: 'logistics',
  primaryGoal: 'Show fleet positions, warehouses, and delivery coverage',
  confidence: 0.95,
  density: 'operator',
  layoutHint: 'dashboard',

  data: {
    title: 'Fleet & Warehouse Overview — Central Europe',
    description: 'Live fleet positions, warehouse locations, coverage zones, and current delivery routes.',
    center: { lat: 50.1109, lng: 8.6821 },  // Frankfurt
    zoom: 7,
    tileProvider: 'osm',
    showLegend: true,
    executiveCap: 8,

    layers: [
      // ── Warehouses layer ────────────────────────────────────────────────
      {
        id: 'warehouses',
        name: 'Warehouses',
        visible: true,
        markers: [
          {
            id: 'wh-frankfurt',
            position: { lat: 50.1109, lng: 8.6821 },
            label: 'Frankfurt Hub',
            description: 'Central European distribution hub. 24/7 operations.',
            category: 'warehouse',
            icon: '🏭',
            color: '#6366f1',
            metadata: { capacity: '45,000 sqm', staff: 320, utilisation: '87%' },
          },
          {
            id: 'wh-munich',
            position: { lat: 48.1351, lng: 11.5820 },
            label: 'Munich Depot',
            description: 'Southern region fulfillment center.',
            category: 'warehouse',
            icon: '🏭',
            color: '#6366f1',
            metadata: { capacity: '28,000 sqm', staff: 185, utilisation: '72%' },
          },
          {
            id: 'wh-hamburg',
            position: { lat: 53.5511, lng: 9.9937 },
            label: 'Hamburg Port',
            description: 'Maritime logistics and cold-chain storage.',
            category: 'warehouse',
            icon: '🏭',
            color: '#6366f1',
            metadata: { capacity: '52,000 sqm', staff: 410, utilisation: '91%' },
          },
          {
            id: 'wh-berlin',
            position: { lat: 52.5200, lng: 13.4050 },
            label: 'Berlin Center',
            description: 'Last-mile fulfillment for Berlin metro.',
            category: 'warehouse',
            icon: '🏭',
            color: '#6366f1',
            metadata: { capacity: '18,000 sqm', staff: 140, utilisation: '65%' },
          },
          {
            id: 'wh-cologne',
            position: { lat: 50.9375, lng: 6.9603 },
            label: 'Cologne West',
            description: 'Rhine corridor logistics center.',
            category: 'warehouse',
            icon: '🏭',
            color: '#6366f1',
            metadata: { capacity: '32,000 sqm', staff: 220, utilisation: '79%' },
          },
        ],
        polygons: [],
        polylines: [],
        circles: [],
        heatmap: [],
      },

      // ── Fleet layer ─────────────────────────────────────────────────────
      {
        id: 'fleet',
        name: 'Active Fleet',
        visible: true,
        markers: [
          {
            id: 'truck-01',
            position: { lat: 49.8728, lng: 8.6512 },
            label: 'Truck DE-4471',
            description: 'En route: Frankfurt → Darmstadt. ETA 14:35.',
            category: 'truck',
            icon: '🚛',
            color: '#10b981',
            metadata: { driver: 'M. Weber', payload: '18.2t', speed: '82 km/h', fuel: '67%' },
          },
          {
            id: 'truck-02',
            position: { lat: 51.2277, lng: 6.7735 },
            label: 'Truck DE-3892',
            description: 'En route: Cologne → Düsseldorf. ETA 13:50.',
            category: 'truck',
            icon: '🚛',
            color: '#10b981',
            metadata: { driver: 'K. Schmidt', payload: '12.8t', speed: '95 km/h', fuel: '45%' },
          },
          {
            id: 'truck-03',
            position: { lat: 52.3759, lng: 9.7320 },
            label: 'Truck DE-5563',
            description: 'En route: Hannover → Hamburg. ETA 15:20.',
            category: 'truck',
            icon: '🚛',
            color: '#10b981',
            metadata: { driver: 'L. Fischer', payload: '22.1t', speed: '88 km/h', fuel: '52%' },
          },
          {
            id: 'truck-04',
            position: { lat: 48.7758, lng: 9.1829 },
            label: 'Truck DE-2210',
            description: 'Delivering in Stuttgart. 3 stops remaining.',
            category: 'truck',
            icon: '🚛',
            color: '#f59e0b',
            metadata: { driver: 'A. Müller', payload: '8.4t', speed: '0 km/h (stopped)', fuel: '81%' },
          },
          {
            id: 'truck-05',
            position: { lat: 51.0504, lng: 13.7373 },
            label: 'Truck DE-1187',
            description: 'En route: Dresden → Berlin. ETA 16:45.',
            category: 'truck',
            icon: '🚛',
            color: '#10b981',
            metadata: { driver: 'P. Becker', payload: '15.6t', speed: '110 km/h', fuel: '38%' },
          },
        ],
        polygons: [],
        polylines: [],
        circles: [],
        heatmap: [],
      },

      // ── Coverage zones layer ────────────────────────────────────────────
      {
        id: 'coverage',
        name: 'Coverage Zones',
        visible: true,
        markers: [],
        polygons: [
          {
            id: 'zone-rhein-main',
            label: 'Rhine-Main Zone',
            positions: [
              { lat: 50.3, lng: 8.2 },
              { lat: 50.3, lng: 9.2 },
              { lat: 49.8, lng: 9.2 },
              { lat: 49.8, lng: 8.2 },
            ],
            fillColor: '#6366f1',
            fillOpacity: 0.12,
            strokeColor: '#6366f1',
            strokeWidth: 2,
            metadata: { region: 'Rhine-Main', customers: 12400 },
          },
          {
            id: 'zone-bavaria',
            label: 'Bavaria Zone',
            positions: [
              { lat: 48.6, lng: 11.0 },
              { lat: 48.6, lng: 12.2 },
              { lat: 47.8, lng: 12.2 },
              { lat: 47.8, lng: 11.0 },
            ],
            fillColor: '#0ea5e9',
            fillOpacity: 0.12,
            strokeColor: '#0ea5e9',
            strokeWidth: 2,
            metadata: { region: 'Bavaria', customers: 8900 },
          },
        ],
        polylines: [],
        circles: [],
        heatmap: [],
      },

      // ── Delivery routes layer ───────────────────────────────────────────
      {
        id: 'routes',
        name: 'Active Routes',
        visible: true,
        markers: [],
        polygons: [],
        polylines: [
          {
            id: 'route-ffm-darmstadt',
            label: 'Frankfurt → Darmstadt',
            positions: [
              { lat: 50.1109, lng: 8.6821 },
              { lat: 50.0000, lng: 8.6500 },
              { lat: 49.8728, lng: 8.6512 },
            ],
            color: '#10b981',
            width: 3,
            style: 'solid',
          },
          {
            id: 'route-cologne-duesseldorf',
            label: 'Cologne → Düsseldorf',
            positions: [
              { lat: 50.9375, lng: 6.9603 },
              { lat: 51.0500, lng: 6.8800 },
              { lat: 51.2277, lng: 6.7735 },
            ],
            color: '#10b981',
            width: 3,
            style: 'dashed',
          },
          {
            id: 'route-hannover-hamburg',
            label: 'Hannover → Hamburg',
            positions: [
              { lat: 52.3759, lng: 9.7320 },
              { lat: 52.8000, lng: 9.8000 },
              { lat: 53.2000, lng: 9.9000 },
              { lat: 53.5511, lng: 9.9937 },
            ],
            color: '#0ea5e9',
            width: 3,
            style: 'solid',
          },
        ],
        circles: [],
        heatmap: [],
      },

      // ── Service radius layer ────────────────────────────────────────────
      {
        id: 'service-radius',
        name: 'Service Radius',
        visible: false,
        markers: [],
        polygons: [],
        polylines: [],
        circles: [
          {
            id: 'radius-frankfurt',
            center: { lat: 50.1109, lng: 8.6821 },
            radius: 50000,
            label: 'Frankfurt 50km',
            fillColor: '#6366f1',
            fillOpacity: 0.08,
            strokeColor: '#6366f1',
          },
          {
            id: 'radius-munich',
            center: { lat: 48.1351, lng: 11.5820 },
            radius: 40000,
            label: 'Munich 40km',
            fillColor: '#0ea5e9',
            fillOpacity: 0.08,
            strokeColor: '#0ea5e9',
          },
          {
            id: 'radius-hamburg',
            center: { lat: 53.5511, lng: 9.9937 },
            radius: 60000,
            label: 'Hamburg 60km',
            fillColor: '#10b981',
            fillOpacity: 0.08,
            strokeColor: '#10b981',
          },
        ],
        heatmap: [],
      },

      // ── Demand heatmap layer ────────────────────────────────────────────
      {
        id: 'demand',
        name: 'Demand Heatmap',
        visible: false,
        markers: [],
        polygons: [],
        polylines: [],
        circles: [],
        heatmap: [
          { position: { lat: 50.1109, lng: 8.6821 }, intensity: 0.95 },
          { position: { lat: 50.0500, lng: 8.7500 }, intensity: 0.7 },
          { position: { lat: 50.2000, lng: 8.5500 }, intensity: 0.6 },
          { position: { lat: 48.1351, lng: 11.5820 }, intensity: 0.85 },
          { position: { lat: 48.2000, lng: 11.6500 }, intensity: 0.5 },
          { position: { lat: 53.5511, lng: 9.9937 }, intensity: 0.9 },
          { position: { lat: 53.6000, lng: 10.0500 }, intensity: 0.65 },
          { position: { lat: 52.5200, lng: 13.4050 }, intensity: 0.8 },
          { position: { lat: 52.4800, lng: 13.3500 }, intensity: 0.55 },
          { position: { lat: 50.9375, lng: 6.9603 }, intensity: 0.75 },
          { position: { lat: 51.5000, lng: 7.0000 }, intensity: 0.4 },
          { position: { lat: 48.7758, lng: 9.1829 }, intensity: 0.7 },
        ],
      },
    ],

    // Top-level (non-layered) items are empty — everything is in layers
    markers: [],
    polygons: [],
    polylines: [],
    circles: [],
    heatmap: [],
  },

  ambiguities: [
    {
      id: 'time-window',
      type: 'single_select',
      label: 'Time window',
      description: 'Filter fleet positions by time range',
      value: 'now',
      parameterKey: 'timeWindow',
      options: [
        { value: '1h-ago', label: '1h ago' },
        { value: '30m-ago', label: '30m ago' },
        { value: 'now', label: 'Now' },
        { value: 'plus-30m', label: '+30m' },
        { value: 'plus-1h', label: '+1h' },
      ],
    },
    {
      id: 'vehicle-type',
      type: 'single_select',
      label: 'Vehicle type',
      value: 'all',
      parameterKey: 'vehicleType',
      options: [
        { value: 'all', label: 'All' },
        { value: 'trucks', label: 'Trucks' },
        { value: 'vans', label: 'Vans' },
        { value: 'couriers', label: 'Couriers' },
      ],
    },
  ],

  actions: [
    {
      id: 'refresh-positions',
      label: 'Refresh Positions',
      description: 'Pull latest GPS data from fleet tracking system',
      variant: 'secondary',
    },
    {
      id: 'dispatch-nearest',
      label: 'Dispatch Nearest',
      description: 'Assign nearest available truck to a selected drop-off',
      variant: 'primary',
      safety: {
        confidence: 0.88,
        reversible: true,
        requiresConfirmation: true,
        riskLevel: 'low',
        blastRadius: {
          scope: 'self',
          affectedSystems: ['dispatch-engine', 'driver-app'],
        },
      },
    },
    {
      id: 'optimize-routes',
      label: 'Optimize Routes',
      description: 'Re-calculate all active routes for minimal fuel + time',
      variant: 'destructive',
      safety: {
        confidence: 0.82,
        reversible: true,
        requiresConfirmation: true,
        riskLevel: 'medium',
        blastRadius: {
          scope: 'team',
          affectedSystems: ['route-optimizer', 'fleet-tracker', 'driver-app'],
          downstreamEffects: 'All active drivers will receive updated route instructions',
        },
      },
    },
  ],

  explainability: {
    'wh-frankfurt': {
      elementId: 'wh-frankfurt',
      summary: 'Frankfurt was selected as the primary hub due to its central location in the Rhine-Main corridor.',
      assumptions: ['Autobahn A5/A3/A66 junction proximity weighted 2x', 'Rail freight terminal access factored in'],
      dataSources: [
        { type: 'api', name: 'fleet-optimizer-v3' },
        { type: 'database', name: 'logistics-db' },
      ],
    },
    'truck-01': {
      elementId: 'truck-01',
      summary: 'Truck DE-4471 was assigned the Frankfurt → Darmstadt route based on load-weight matching.',
      assumptions: ['Payload of 18.2t matches TU-320 chassis max of 24t (>75% utilised)'],
      dataSources: [
        { type: 'api', name: 'dispatch-engine' },
        { type: 'api', name: 'vehicle-telemetry' },
      ],
    },
  },
};
