import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import {
  MapDataSchema,
  type MapMarker,
  type MapPolygon,
  type MapPolyline,
  type MapCircle,
  type HeatmapPoint,
  type MapLayer,
  type LatLng,
} from '@hari/core';
import { useTheme } from '../ThemeContext';

// ─────────────────────────────────────────────────────────────────────────────
// MapRenderer
//
// Renders geographic / spatial data as an interactive SVG map.
// Uses OpenStreetMap tile URLs for the background and overlays markers,
// polygons, polylines, circles, and heatmap data.
//
// Density-aware presentation:
//   executive — simplified pins only, limited markers (executiveCap)
//   operator  — markers with labels and popups, overlays visible
//   expert    — full metadata, layer controls, coordinate display, all overlays
// ─────────────────────────────────────────────────────────────────────────────

export interface MapRendererProps {
  data: unknown;
  density?: 'executive' | 'operator' | 'expert';
  onExplain?: (elementId: string) => void;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const CATEGORY_COLORS = [
  '#6366f1', '#0ea5e9', '#10b981', '#f59e0b',
  '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6',
  '#f97316', '#84cc16',
];

const TILE_SIZE = 256;
const MAP_WIDTH = 800;
const MAP_HEIGHT = 500;

// ── Geo utilities ─────────────────────────────────────────────────────────────

function latLngToPixel(lat: number, lng: number, zoom: number): { x: number; y: number } {
  const scale = Math.pow(2, zoom) * TILE_SIZE;
  const x = ((lng + 180) / 360) * scale;
  const latRad = (lat * Math.PI) / 180;
  const y = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * scale;
  return { x, y };
}

function pixelToLatLng(px: number, py: number, zoom: number): LatLng {
  const scale = Math.pow(2, zoom) * TILE_SIZE;
  const lng = (px / scale) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * py) / scale;
  const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  return { lat, lng };
}

function computeBounds(points: LatLng[]): { min: LatLng; max: LatLng } {
  if (points.length === 0) {
    return { min: { lat: 0, lng: 0 }, max: { lat: 0, lng: 0 } };
  }
  let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
  for (const p of points) {
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lng < minLng) minLng = p.lng;
    if (p.lng > maxLng) maxLng = p.lng;
  }
  return { min: { lat: minLat, lng: minLng }, max: { lat: maxLat, lng: maxLng } };
}

function fitBounds(
  bounds: { min: LatLng; max: LatLng },
  width: number,
  height: number,
): { center: LatLng; zoom: number } {
  const { min, max } = bounds;
  if (min.lat === max.lat && min.lng === max.lng) {
    return { center: { lat: min.lat, lng: min.lng }, zoom: 13 };
  }

  const center: LatLng = {
    lat: (min.lat + max.lat) / 2,
    lng: (min.lng + max.lng) / 2,
  };

  // Binary search for best zoom
  for (let z = 18; z >= 1; z--) {
    const topLeft = latLngToPixel(max.lat, min.lng, z);
    const bottomRight = latLngToPixel(min.lat, max.lng, z);
    const w = bottomRight.x - topLeft.x;
    const h = bottomRight.y - topLeft.y;
    if (w <= width * 0.85 && h <= height * 0.85) {
      return { center, zoom: z };
    }
  }
  return { center, zoom: 1 };
}

function categoryColor(category: string, palette: Map<string, string>): string {
  if (!palette.has(category)) {
    palette.set(category, CATEGORY_COLORS[palette.size % CATEGORY_COLORS.length]);
  }
  return palette.get(category)!;
}

// ── Collect all points for bounds calculation ─────────────────────────────────

function collectAllPoints(
  markers: MapMarker[],
  polygons: MapPolygon[],
  polylines: MapPolyline[],
  circles: MapCircle[],
  heatmap: HeatmapPoint[],
  layers: MapLayer[],
): LatLng[] {
  const points: LatLng[] = [];
  for (const m of markers) points.push(m.position);
  for (const p of polygons) points.push(...p.positions);
  for (const p of polylines) points.push(...p.positions);
  for (const c of circles) points.push(c.center);
  for (const h of heatmap) points.push(h.position);
  for (const layer of layers) {
    for (const m of layer.markers) points.push(m.position);
    for (const p of layer.polygons) points.push(...p.positions);
    for (const p of layer.polylines) points.push(...p.positions);
    for (const c of layer.circles) points.push(c.center);
    for (const h of layer.heatmap) points.push(h.position);
  }
  return points;
}

// ── Tile layer background ─────────────────────────────────────────────────────

interface TileLayerProps {
  center: LatLng;
  zoom: number;
  width: number;
  height: number;
  tileProvider: string;
}

function getTileUrl(x: number, y: number, z: number, provider: string): string {
  switch (provider) {
    case 'dark':
      return `https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/${z}/${x}/${y}.png`;
    case 'terrain':
      return `https://tiles.stadiamaps.com/tiles/stamen_terrain/${z}/${x}/${y}.png`;
    case 'satellite':
      return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;
    case 'osm':
    default:
      return `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
  }
}

function TileLayer({ center, zoom, width, height, tileProvider }: TileLayerProps) {
  const centerPx = latLngToPixel(center.lat, center.lng, zoom);
  const offsetX = centerPx.x - width / 2;
  const offsetY = centerPx.y - height / 2;
  const tileStartX = Math.floor(offsetX / TILE_SIZE);
  const tileStartY = Math.floor(offsetY / TILE_SIZE);
  const tileEndX = Math.ceil((offsetX + width) / TILE_SIZE);
  const tileEndY = Math.ceil((offsetY + height) / TILE_SIZE);
  const maxTile = Math.pow(2, zoom);

  const tiles: React.ReactNode[] = [];
  for (let tx = tileStartX; tx <= tileEndX; tx++) {
    for (let ty = tileStartY; ty <= tileEndY; ty++) {
      const wrappedTx = ((tx % maxTile) + maxTile) % maxTile;
      if (ty < 0 || ty >= maxTile) continue;
      const pixelX = tx * TILE_SIZE - offsetX;
      const pixelY = ty * TILE_SIZE - offsetY;
      tiles.push(
        <image
          key={`${tx}-${ty}`}
          href={getTileUrl(wrappedTx, ty, zoom, tileProvider)}
          x={pixelX}
          y={pixelY}
          width={TILE_SIZE}
          height={TILE_SIZE}
        />
      );
    }
  }
  return <>{tiles}</>;
}

// ── SVG Map Marker ────────────────────────────────────────────────────────────

interface SVGMarkerProps {
  x: number;
  y: number;
  color: string;
  label?: string;
  icon?: string;
  selected: boolean;
  onClick: () => void;
  showLabel: boolean;
}

function SVGMarker({ x, y, color, label, icon, selected, onClick, showLabel }: SVGMarkerProps) {
  const r = selected ? 10 : 7;
  return (
    <g onClick={onClick} style={{ cursor: 'pointer' }}>
      {/* Drop shadow */}
      <circle cx={x} cy={y + 1} r={r + 1} fill="rgba(0,0,0,0.2)" />
      {/* Marker circle */}
      <circle
        cx={x}
        cy={y}
        r={r}
        fill={color}
        stroke="#fff"
        strokeWidth={selected ? 3 : 2}
      />
      {/* Icon or first letter */}
      {icon && (
        <text x={x} y={y + 4} textAnchor="middle" fontSize={10} fill="#fff">
          {icon}
        </text>
      )}
      {/* Label */}
      {showLabel && label && (
        <text
          x={x}
          y={y - r - 5}
          textAnchor="middle"
          fontSize={11}
          fontWeight={600}
          fill="#334155"
          stroke="#fff"
          strokeWidth={2.5}
          paintOrder="stroke"
        >
          {label}
        </text>
      )}
    </g>
  );
}

// ── Popup / info box ──────────────────────────────────────────────────────────

interface MarkerPopupProps {
  marker: MapMarker;
  x: number;
  y: number;
  density: 'executive' | 'operator' | 'expert';
  onClose: () => void;
  onExplain?: (elementId: string) => void;
  theme: ReturnType<typeof useTheme>['theme'];
}

function MarkerPopup({ marker, x, y, density, onClose, onExplain, theme }: MarkerPopupProps) {
  const popupWidth = density === 'expert' ? 280 : 220;
  const popupX = x - popupWidth / 2;
  const popupY = y - 20;

  return (
    <foreignObject x={popupX} y={popupY - 120} width={popupWidth} height={150}>
      <div
        style={{
          background: theme.colors.surface,
          border: `1px solid ${theme.colors.border}`,
          borderRadius: theme.radius.md,
          padding: '0.5rem 0.625rem',
          fontSize: '0.78rem',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          color: theme.colors.text,
          position: 'relative',
        }}
      >
        <div
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '0.25rem',
            right: '0.4rem',
            cursor: 'pointer',
            fontSize: '0.85rem',
            color: theme.colors.textMuted,
          }}
        >
          ✕
        </div>
        <div style={{ fontWeight: 700, marginBottom: '0.25rem' }}>
          {marker.icon && <span style={{ marginRight: '0.35rem' }}>{marker.icon}</span>}
          {marker.label || marker.id}
        </div>
        {marker.description && (
          <div style={{ color: theme.colors.textMuted, marginBottom: '0.25rem' }}>
            {marker.description}
          </div>
        )}
        {density === 'expert' && marker.metadata && (
          <div style={{ marginTop: '0.25rem', fontSize: '0.72rem' }}>
            {Object.entries(marker.metadata).map(([k, v]) => (
              <div key={k}>
                <span style={{ color: theme.colors.textMuted }}>{k}:</span>{' '}
                <span style={{ fontWeight: 500 }}>{String(v)}</span>
              </div>
            ))}
          </div>
        )}
        {density === 'expert' && (
          <div style={{ color: theme.colors.textMuted, fontSize: '0.68rem', marginTop: '0.25rem' }}>
            {marker.position.lat.toFixed(5)}, {marker.position.lng.toFixed(5)}
          </div>
        )}
        {marker.explainElementId && onExplain && (
          <button
            onClick={() => onExplain(marker.explainElementId!)}
            style={{
              marginTop: '0.35rem',
              background: 'none',
              border: 'none',
              color: theme.colors.accent,
              cursor: 'pointer',
              fontSize: '0.72rem',
              padding: 0,
              textDecoration: 'underline',
            }}
          >
            Why?
          </button>
        )}
      </div>
    </foreignObject>
  );
}

// ── Legend ─────────────────────────────────────────────────────────────────────

interface LegendProps {
  categories: Map<string, string>;
  theme: ReturnType<typeof useTheme>['theme'];
}

function Legend({ categories, theme }: LegendProps) {
  if (categories.size === 0) return null;
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '0.5rem 1rem',
        padding: '0.5rem 0.75rem',
        fontSize: '0.75rem',
        background: theme.colors.surfaceAlt,
        borderRadius: theme.radius.md,
        marginTop: '0.5rem',
      }}
    >
      {Array.from(categories.entries()).map(([name, color]) => (
        <div key={name} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: color,
              display: 'inline-block',
              border: '1px solid rgba(0,0,0,0.15)',
            }}
          />
          <span style={{ color: theme.colors.text }}>{name}</span>
        </div>
      ))}
    </div>
  );
}

// ── Layer controls (expert density) ───────────────────────────────────────────

interface LayerControlsProps {
  layers: MapLayer[];
  visibleLayers: Set<string>;
  onToggle: (layerId: string) => void;
  theme: ReturnType<typeof useTheme>['theme'];
}

function LayerControls({ layers, visibleLayers, onToggle, theme }: LayerControlsProps) {
  if (layers.length === 0) return null;
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '0.35rem',
        padding: '0.35rem 0.5rem',
        fontSize: '0.72rem',
        background: theme.colors.surfaceAlt,
        borderRadius: theme.radius.sm,
        marginBottom: '0.5rem',
      }}
    >
      <span style={{ fontWeight: 600, color: theme.colors.textMuted, marginRight: '0.25rem' }}>Layers:</span>
      {layers.map((layer) => (
        <label
          key={layer.id}
          style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', cursor: 'pointer', color: theme.colors.text }}
        >
          <input
            type="checkbox"
            checked={visibleLayers.has(layer.id)}
            onChange={() => onToggle(layer.id)}
            style={{ margin: 0 }}
          />
          {layer.name}
        </label>
      ))}
    </div>
  );
}

// ── Main MapRenderer ──────────────────────────────────────────────────────────

export function MapRenderer({ data, density = 'operator', onExplain }: MapRendererProps) {
  const parsed = useMemo(() => MapDataSchema.safeParse(data), [data]);
  const { theme } = useTheme();

  const [selectedMarker, setSelectedMarker] = useState<string | null>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoomDelta, setZoomDelta] = useState(0);
  const [visibleLayers, setVisibleLayers] = useState<Set<string>>(new Set());
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(null);

  if (!parsed.success) {
    return (
      <div style={{ padding: '1rem', color: theme.colors.danger, fontSize: '0.85rem' }}>
        ⚠ Invalid map data: {parsed.error.issues.map((i) => i.message).join(', ')}
      </div>
    );
  }

  const mapData = parsed.data;
  const palette = useMemo(() => new Map<string, string>(), []);

  // Flatten all data including visible layers
  const { allMarkers, allPolygons, allPolylines, allCircles, allHeatmap } = useMemo(() => {
    const markers = [...mapData.markers];
    const polygons = [...mapData.polygons];
    const polylines = [...mapData.polylines];
    const circles = [...mapData.circles];
    const heatmap = [...mapData.heatmap];

    for (const layer of mapData.layers) {
      if (visibleLayers.size > 0 && !visibleLayers.has(layer.id)) continue;
      markers.push(...layer.markers);
      polygons.push(...layer.polygons);
      polylines.push(...layer.polylines);
      circles.push(...layer.circles);
      heatmap.push(...layer.heatmap);
    }

    // Apply executive cap
    const cappedMarkers =
      density === 'executive'
        ? markers.slice(0, mapData.executiveCap)
        : markers;

    return {
      allMarkers: cappedMarkers,
      allPolygons: density === 'executive' ? [] : polygons,
      allPolylines: density === 'executive' ? [] : polylines,
      allCircles: density === 'executive' ? [] : circles,
      allHeatmap: density === 'executive' ? [] : heatmap,
    };
  }, [mapData, density, visibleLayers]);

  // Compute view
  const allPoints = useMemo(
    () => collectAllPoints(allMarkers, allPolygons, allPolylines, allCircles, allHeatmap, []),
    [allMarkers, allPolygons, allPolylines, allCircles, allHeatmap],
  );

  const { center, zoom } = useMemo(() => {
    if (mapData.center && mapData.zoom) {
      return { center: mapData.center, zoom: mapData.zoom };
    }
    if (allPoints.length === 0) {
      return {
        center: mapData.center || { lat: 48.8566, lng: 2.3522 },
        zoom: mapData.zoom || 10,
      };
    }
    const bounds = computeBounds(allPoints);
    const fit = fitBounds(bounds, MAP_WIDTH, MAP_HEIGHT);
    return {
      center: mapData.center || fit.center,
      zoom: mapData.zoom || fit.zoom,
    };
  }, [mapData.center, mapData.zoom, allPoints]);

  const effectiveZoom = Math.max(1, Math.min(18, zoom + zoomDelta));

  // Initialize visible layers
  useEffect(() => {
    if (mapData.layers.length > 0 && visibleLayers.size === 0) {
      setVisibleLayers(new Set(mapData.layers.filter((l) => l.visible).map((l) => l.id)));
    }
  }, [mapData.layers]);

  // Build category palette
  useMemo(() => {
    for (const m of allMarkers) {
      if (m.category) categoryColor(m.category, palette);
    }
  }, [allMarkers, palette]);

  // Convert geo coords to SVG coords
  const geoToSvg = useCallback(
    (lat: number, lng: number) => {
      const cp = latLngToPixel(center.lat, center.lng, effectiveZoom);
      const p = latLngToPixel(lat, lng, effectiveZoom);
      return {
        x: MAP_WIDTH / 2 + (p.x - cp.x) + pan.x,
        y: MAP_HEIGHT / 2 + (p.y - cp.y) + pan.y,
      };
    },
    [center, effectiveZoom, pan],
  );

  // Mouse cursor position for expert
  const [cursorPos, setCursorPos] = useState<LatLng | null>(null);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (!svgRef.current) return;
      const rect = svgRef.current.getBoundingClientRect();
      const svgX = e.clientX - rect.left;
      const svgY = e.clientY - rect.top;

      // Handle dragging
      if (dragRef.current) {
        const dx = e.clientX - dragRef.current.startX;
        const dy = e.clientY - dragRef.current.startY;
        setPan({ x: dragRef.current.panX + dx, y: dragRef.current.panY + dy });
        return;
      }

      if (density === 'expert') {
        const cp = latLngToPixel(center.lat, center.lng, effectiveZoom);
        const worldX = cp.x + (svgX - MAP_WIDTH / 2 - pan.x);
        const worldY = cp.y + (svgY - MAP_HEIGHT / 2 - pan.y);
        setCursorPos(pixelToLatLng(worldX, worldY, effectiveZoom));
      }
    },
    [density, center, effectiveZoom, pan],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      dragRef.current = { startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y };
    },
    [pan],
  );

  const handleMouseUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    setZoomDelta((prev) => {
      const delta = e.deltaY > 0 ? -1 : 1;
      return Math.max(-zoom + 1, Math.min(18 - zoom, prev + delta));
    });
  }, [zoom]);

  const toggleLayer = useCallback((layerId: string) => {
    setVisibleLayers((prev) => {
      const next = new Set(prev);
      if (next.has(layerId)) next.delete(layerId);
      else next.add(layerId);
      return next;
    });
  }, []);

  return (
    <div>
      {/* Title */}
      {mapData.title && (
        <h3
          style={{
            fontSize: '1rem',
            fontWeight: 700,
            color: theme.colors.text,
            margin: '0 0 0.25rem',
          }}
        >
          {mapData.title}
        </h3>
      )}

      {/* Description */}
      {mapData.description && density !== 'executive' && (
        <p
          style={{
            fontSize: '0.82rem',
            color: theme.colors.textMuted,
            margin: '0 0 0.5rem',
          }}
        >
          {mapData.description}
        </p>
      )}

      {/* Layer controls — expert only */}
      {density === 'expert' && mapData.layers.length > 0 && (
        <LayerControls
          layers={mapData.layers}
          visibleLayers={visibleLayers}
          onToggle={toggleLayer}
          theme={theme}
        />
      )}

      {/* Zoom controls */}
      <div style={{ position: 'relative' }}>
        <svg
          ref={svgRef}
          width="100%"
          viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
          style={{
            border: `1px solid ${theme.colors.border}`,
            borderRadius: theme.radius.md,
            cursor: dragRef.current ? 'grabbing' : 'grab',
            background: theme.colors.surface,
            display: 'block',
          }}
          onMouseMove={handleMouseMove}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
        >
          {/* Tile background */}
          <TileLayer
            center={center}
            zoom={effectiveZoom}
            width={MAP_WIDTH}
            height={MAP_HEIGHT}
            tileProvider={mapData.tileProvider}
          />

          {/* Polygons */}
          {allPolygons.map((poly) => {
            const points = poly.positions
              .map((p) => {
                const { x, y } = geoToSvg(p.lat, p.lng);
                return `${x},${y}`;
              })
              .join(' ');
            return (
              <polygon
                key={poly.id}
                points={points}
                fill={poly.fillColor || '#6366f1'}
                fillOpacity={poly.fillOpacity}
                stroke={poly.strokeColor || '#4f46e5'}
                strokeWidth={poly.strokeWidth}
              />
            );
          })}

          {/* Polylines */}
          {allPolylines.map((line) => {
            const points = line.positions
              .map((p) => {
                const { x, y } = geoToSvg(p.lat, p.lng);
                return `${x},${y}`;
              })
              .join(' ');
            const dashArray =
              line.style === 'dashed' ? '8,4' : line.style === 'dotted' ? '2,4' : undefined;
            return (
              <polyline
                key={line.id}
                points={points}
                fill="none"
                stroke={line.color || '#0ea5e9'}
                strokeWidth={line.width}
                strokeDasharray={dashArray}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            );
          })}

          {/* Circles */}
          {allCircles.map((circle) => {
            const { x: cx, y: cy } = geoToSvg(circle.center.lat, circle.center.lng);
            // Approximate radius in pixels: metres → degrees → pixels
            const metersPerPixel =
              (156543.03392 * Math.cos((circle.center.lat * Math.PI) / 180)) /
              Math.pow(2, effectiveZoom);
            const rPx = circle.radius / metersPerPixel;
            return (
              <circle
                key={circle.id}
                cx={cx}
                cy={cy}
                r={rPx}
                fill={circle.fillColor || '#8b5cf6'}
                fillOpacity={circle.fillOpacity}
                stroke={circle.strokeColor || '#7c3aed'}
                strokeWidth={1.5}
              />
            );
          })}

          {/* Heatmap overlay (simplified: colored circles) */}
          {allHeatmap.map((point, i) => {
            const { x, y } = geoToSvg(point.position.lat, point.position.lng);
            const intensity = Math.min(1, point.intensity);
            const r = 8 + intensity * 16;
            return (
              <circle
                key={`heat-${i}`}
                cx={x}
                cy={y}
                r={r}
                fill={`rgba(239, 68, 68, ${0.15 + intensity * 0.4})`}
                stroke="none"
              />
            );
          })}

          {/* Markers */}
          {allMarkers.map((marker) => {
            const { x, y } = geoToSvg(marker.position.lat, marker.position.lng);
            const color =
              marker.color ||
              (marker.category ? categoryColor(marker.category, palette) : '#6366f1');
            return (
              <SVGMarker
                key={marker.id}
                x={x}
                y={y}
                color={color}
                label={marker.label}
                icon={marker.icon}
                selected={selectedMarker === marker.id}
                onClick={() => setSelectedMarker(selectedMarker === marker.id ? null : marker.id)}
                showLabel={density !== 'executive'}
              />
            );
          })}

          {/* Popup */}
          {selectedMarker && density !== 'executive' && (() => {
            const marker = allMarkers.find((m) => m.id === selectedMarker);
            if (!marker) return null;
            const { x, y } = geoToSvg(marker.position.lat, marker.position.lng);
            return (
              <MarkerPopup
                marker={marker}
                x={x}
                y={y}
                density={density}
                onClose={() => setSelectedMarker(null)}
                onExplain={onExplain}
                theme={theme}
              />
            );
          })()}

          {/* Attribution */}
          <text
            x={MAP_WIDTH - 5}
            y={MAP_HEIGHT - 5}
            textAnchor="end"
            fontSize={9}
            fill="rgba(0,0,0,0.5)"
          >
            © OpenStreetMap contributors
          </text>
        </svg>

        {/* Zoom buttons overlay */}
        <div
          style={{
            position: 'absolute',
            top: '0.5rem',
            right: '0.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.2rem',
          }}
        >
          {[
            { label: '+', delta: 1 },
            { label: '−', delta: -1 },
          ].map(({ label, delta }) => (
            <button
              key={label}
              onClick={() =>
                setZoomDelta((prev) => Math.max(-zoom + 1, Math.min(18 - zoom, prev + delta)))
              }
              style={{
                width: 28,
                height: 28,
                border: `1px solid ${theme.colors.border}`,
                borderRadius: theme.radius.sm,
                background: theme.colors.surface,
                color: theme.colors.text,
                fontSize: '1rem',
                lineHeight: 1,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 1px 4px rgba(0,0,0,0.12)',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Cursor coordinate display — expert only */}
        {density === 'expert' && cursorPos && (
          <div
            style={{
              position: 'absolute',
              bottom: '0.5rem',
              left: '0.5rem',
              padding: '0.2rem 0.5rem',
              background: 'rgba(0,0,0,0.65)',
              color: '#fff',
              fontSize: '0.68rem',
              borderRadius: theme.radius.sm,
              fontFamily: 'monospace',
            }}
          >
            {cursorPos.lat.toFixed(5)}, {cursorPos.lng.toFixed(5)} · z{effectiveZoom}
          </div>
        )}
      </div>

      {/* Legend */}
      {mapData.showLegend && palette.size > 0 && density !== 'executive' && (
        <Legend categories={palette} theme={theme} />
      )}

      {/* Marker count info */}
      {density === 'executive' && allMarkers.length < (mapData.markers.length + mapData.layers.reduce((s, l) => s + l.markers.length, 0)) && (
        <div
          style={{
            fontSize: '0.72rem',
            color: theme.colors.textMuted,
            marginTop: '0.35rem',
            textAlign: 'center',
          }}
        >
          Showing {allMarkers.length} of{' '}
          {mapData.markers.length + mapData.layers.reduce((s, l) => s + l.markers.length, 0)} locations
          · Switch to Operator/Expert for full view
        </div>
      )}
    </div>
  );
}
