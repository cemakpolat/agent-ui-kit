import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────────────────
// Map Schema
//
// The map intent type renders geographic / spatial data on an interactive map.
// Supports markers, polygons, polylines, circles, and heatmap overlays.
//
// Use it for location search results, delivery tracking, fleet management,
// coverage areas, incident maps, sensor locations, or any geo-anchored view.
//
// Density mapping:
//   executive — simplified pins only, no popups or metadata
//   operator  — markers with labels and brief popups
//   expert    — full metadata, polygon overlays, layer controls, coordinates
// ─────────────────────────────────────────────────────────────────────────────

// ── Coordinates ───────────────────────────────────────────────────────────────

export const LatLngSchema = z.object({
  /** Latitude in decimal degrees (-90 to 90) */
  lat: z.number().min(-90).max(90),
  /** Longitude in decimal degrees (-180 to 180) */
  lng: z.number().min(-180).max(180),
});

export type LatLng = z.infer<typeof LatLngSchema>;

// ── Marker ────────────────────────────────────────────────────────────────────

export const MapMarkerSchema = z.object({
  /** Unique marker identifier */
  id: z.string(),
  /** Marker position */
  position: LatLngSchema,
  /** Short label displayed near the marker */
  label: z.string().optional(),
  /** Longer description shown in the popup/tooltip */
  description: z.string().optional(),
  /** Logical category for colour-coding (e.g. "warehouse", "customer", "incident") */
  category: z.string().optional(),
  /** Marker colour override (CSS colour string) */
  color: z.string().optional(),
  /** Icon name or emoji shown inside the marker */
  icon: z.string().optional(),
  /** Extra key-value metadata shown in expert density */
  metadata: z.record(z.string(), z.unknown()).optional(),
  /** Links to an explainability entry in the parent IntentPayload */
  explainElementId: z.string().optional(),
});

export type MapMarker = z.infer<typeof MapMarkerSchema>;

// ── Polygon ───────────────────────────────────────────────────────────────────

export const MapPolygonSchema = z.object({
  /** Unique polygon identifier */
  id: z.string(),
  /** Ordered vertices forming a closed area */
  positions: z.array(LatLngSchema).min(3),
  /** Label displayed on or near the polygon */
  label: z.string().optional(),
  /** Fill colour (CSS colour string) */
  fillColor: z.string().optional(),
  /** Fill opacity (0–1) */
  fillOpacity: z.number().min(0).max(1).default(0.3),
  /** Stroke colour */
  strokeColor: z.string().optional(),
  /** Stroke width in pixels */
  strokeWidth: z.number().min(0).default(2),
  /** Extra key-value metadata */
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type MapPolygon = z.infer<typeof MapPolygonSchema>;

// ── Polyline (route / path) ───────────────────────────────────────────────────

export const MapPolylineSchema = z.object({
  /** Unique polyline identifier */
  id: z.string(),
  /** Ordered waypoints forming the path */
  positions: z.array(LatLngSchema).min(2),
  /** Label displayed along the route */
  label: z.string().optional(),
  /** Line colour (CSS colour string) */
  color: z.string().optional(),
  /** Line width in pixels */
  width: z.number().min(0).default(3),
  /** Line style */
  style: z.enum(['solid', 'dashed', 'dotted']).default('solid'),
  /** Extra key-value metadata */
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type MapPolyline = z.infer<typeof MapPolylineSchema>;

// ── Circle ────────────────────────────────────────────────────────────────────

export const MapCircleSchema = z.object({
  /** Unique circle identifier */
  id: z.string(),
  /** Centre position */
  center: LatLngSchema,
  /** Radius in metres */
  radius: z.number().positive(),
  /** Label displayed at center */
  label: z.string().optional(),
  /** Fill colour */
  fillColor: z.string().optional(),
  /** Fill opacity (0–1) */
  fillOpacity: z.number().min(0).max(1).default(0.2),
  /** Stroke colour */
  strokeColor: z.string().optional(),
  /** Extra key-value metadata */
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type MapCircle = z.infer<typeof MapCircleSchema>;

// ── Heatmap point ─────────────────────────────────────────────────────────────

export const HeatmapPointSchema = z.object({
  /** Position of the data point */
  position: LatLngSchema,
  /** Intensity / weight of this point (higher = hotter) */
  intensity: z.number().min(0).default(1),
});

export type HeatmapPoint = z.infer<typeof HeatmapPointSchema>;

// ── Map Layer ─────────────────────────────────────────────────────────────────

export const MapLayerSchema = z.object({
  /** Unique layer identifier */
  id: z.string(),
  /** Human-readable layer name (shown in layer picker) */
  name: z.string(),
  /** Whether this layer is visible by default */
  visible: z.boolean().default(true),
  /** Markers in this layer */
  markers: z.array(MapMarkerSchema).default([]),
  /** Polygons / regions in this layer */
  polygons: z.array(MapPolygonSchema).default([]),
  /** Routes / paths in this layer */
  polylines: z.array(MapPolylineSchema).default([]),
  /** Circle overlays in this layer */
  circles: z.array(MapCircleSchema).default([]),
  /** Heatmap data points in this layer */
  heatmap: z.array(HeatmapPointSchema).default([]),
});

export type MapLayer = z.infer<typeof MapLayerSchema>;

// ── Top-level MapData ─────────────────────────────────────────────────────────

export const MapDataSchema = z.object({
  /** Optional heading rendered above the map */
  title: z.string().optional(),
  /** Optional description rendered below the title */
  description: z.string().optional(),
  /** Initial map centre (defaults to auto-fit all features) */
  center: LatLngSchema.optional(),
  /** Initial zoom level (1 = world, 18 = building) */
  zoom: z.number().int().min(1).max(20).optional(),
  /**
   * Tile provider.
   * osm       — OpenStreetMap (default, no API key needed)
   * satellite — satellite imagery
   * terrain   — topographic map
   * dark      — dark-themed tiles
   * @default 'osm'
   */
  tileProvider: z.enum(['osm', 'satellite', 'terrain', 'dark']).default('osm'),
  /**
   * Data layers. Each layer can be toggled independently in expert density.
   * If omitted, markers/polygons/polylines/circles/heatmap from the root
   * level are treated as a single unnamed layer.
   */
  layers: z.array(MapLayerSchema).default([]),
  /** Top-level markers (shorthand when layers aren't needed) */
  markers: z.array(MapMarkerSchema).default([]),
  /** Top-level polygons */
  polygons: z.array(MapPolygonSchema).default([]),
  /** Top-level polylines */
  polylines: z.array(MapPolylineSchema).default([]),
  /** Top-level circles */
  circles: z.array(MapCircleSchema).default([]),
  /** Top-level heatmap points */
  heatmap: z.array(HeatmapPointSchema).default([]),
  /**
   * Whether to show a legend / key panel.
   * @default true
   */
  showLegend: z.boolean().default(true),
  /**
   * In executive density, show at most this many markers (rest hidden).
   * @default 10
   */
  executiveCap: z.number().int().positive().default(10),
});

export type MapData = z.infer<typeof MapDataSchema>;
