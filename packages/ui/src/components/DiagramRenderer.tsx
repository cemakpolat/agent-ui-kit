import React, { useEffect, useRef, useMemo, useState, useCallback } from 'react';
import mermaid from 'mermaid';
import { DiagramDataSchema } from '@hari/core';
import { resolveIcon } from '../utils/icon-resolver';
import { useTheme } from '../ThemeContext';
import type {
  DiagramPayload,
  MermaidDiagram,
  GraphDiagram,
  GraphNode,
  ChartDiagram,
  ChartSeries,
} from '@hari/core';

// ─────────────────────────────────────────────────────────────────────────────
// DiagramRenderer
//
// Renders three diagram sub-kinds from DiagramData:
//
//   mermaid — dynamically loads mermaid.js from CDN and renders markup inside
//             a shadow container. Falls back to a syntax-highlighted code block
//             when the CDN load fails or JS is disabled.
//
//   graph   — SVG-based node/edge renderer with automatic circular layout,
//             group colour-coding, and directed arrowhead markers.
//
//   chart   — SVG-based bar, line, area, and pie chart renderer with axis
//             labels, legend, and tooltip-style value annotations.
//
// Density behaviour:
//   executive — first diagram only, no caption/metadata
//   operator  — all diagrams with legends and labels
//   expert    — all diagrams + raw markup toggle (for mermaid) + full metadata
// ─────────────────────────────────────────────────────────────────────────────

export interface DiagramRendererProps {
  data: unknown;
  density?: 'executive' | 'operator' | 'expert';
  onExplain?: (elementId: string) => void;
}

// ── Colour palette ─────────────────────────────────────────────────────────────

const PALETTE = [
  '#6366f1', // indigo
  '#0ea5e9', // sky
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#14b8a6', // teal
  '#f97316', // orange
  '#06b6d4', // cyan
];

function paletteColor(index: number): string {
  return PALETTE[index % PALETTE.length];
}

// ── Shared styles ─────────────────────────────────────────────────────────────

function useCardStyle(): React.CSSProperties {
  const { theme } = useTheme();
  return {
    background: theme.colors.surface,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.lg,
    padding: '1.25rem',
    marginBottom: '1rem',
  };
}

function useTitleStyle(): React.CSSProperties {
  const { theme } = useTheme();
  return {
    fontSize: '0.95rem',
    fontWeight: 600,
    color: theme.colors.text,
    marginBottom: '0.75rem',
  };
}

function useCaptionStyle(): React.CSSProperties {
  const { theme } = useTheme();
  return {
    fontSize: '0.78rem',
    color: theme.colors.textSecondary,
    marginTop: '0.5rem',
    fontStyle: 'italic',
    textAlign: 'center',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Mermaid renderer
// ─────────────────────────────────────────────────────────────────────────────

/** Detect dark mode from the theme background colour luminance. */
function isDarkBackground(hex: string): boolean {
  const c = hex.replace('#', '');
  if (c.length < 6) return false;
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  // Relative luminance (sRGB)
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return lum < 0.4;
}

let _mermaidInitTheme: string | null = null;
let _mermaidRenderCount = 0;

// ── Mermaid markup sanitizer ──────────────────────────────────────────────────
/**
 * Fix common LLM-generated Mermaid syntax errors:
 *
 *   Phase 1 — Normalise ALL single-quoted label brackets to double-quoted:
 *             ['label'] → ["label"],  ('label') → ("label"),  {'label'} → {"label"}
 *
 *   Phase 2 — Remove invalid extra label suffix appended after a closing bracket:
 *             NodeId("rounded")["extra"] → NodeId("rounded")
 *             (Mermaid only supports one label notation per node.)
 *
 *   Phase 3 — Deduplicate reused single-word node IDs (LLMs often emit a
 *             generic ID like "Database" for multiple distinct nodes).
 *             Each occurrence is renamed to a unique camelCase ID derived from
 *             its label text: Database("Product DB") → ProductDB("Product DB").
 *
 *   Phase 4 — Collect multi-word node IDs from declaration lines.
 *             "Order Service["  →  phraseMap: "Order Service" → "OrderService"
 *
 *   Phase 5 — Collect multi-word phrases used bare in edge lines.
 *             "Order Service --> Message Queue"  →  adds both phrases.
 *
 *   Phase 6 — Replace all collected multi-word phrases (longest first) with
 *             their camelCase equivalents everywhere in the markup.
 */
function sanitizeMermaidMarkup(raw: string): string {
  // ── Phase 1: normalise single-quoted labels ──────────────────────────────
  let result = raw
    .replace(/\['/g, '["').replace(/'\]/g, '"]')
    .replace(/\('/g, '("').replace(/'\)/g, '")')
    .replace(/\{'/g, '{"').replace(/'\}/g, '"}');

  // ── Phase 2: strip extra label suffix ────────────────────────────────────
  // e.g. NodeId("rounded")["extra"]  →  NodeId("rounded")
  result = result.replace(/([)\]}])\s*\["[^"]*"\]/g, '$1');

  // ── Phase 3: deduplicate reused single-word node IDs ─────────────────────
  {
    const lines = result.split('\n');
    const escRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Match:  optional-indent  singleWordId  opening-bracket  "label"
    // Groups: 1=indent, 2=nodeId, 3=label-text
    const singleDeclRe = /^([ \t]*)([A-Za-z][A-Za-z0-9_]*)(?:\(|\[(?!\[)|\{)"([^"]*)"/;

    // Collect all single-word declarations keyed by their ID
    const byId = new Map<string, Array<{ lineIdx: number; label: string }>>();
    for (let i = 0; i < lines.length; i++) {
      const m = singleDeclRe.exec(lines[i]);
      if (!m) continue;
      const id = m[2];
      const label = m[3];
      const prev = byId.get(id) ?? [];
      prev.push({ lineIdx: i, label });
      byId.set(id, prev);
    }

    // Rename every occurrence of IDs that appear more than once
    for (const [oldId, uses] of byId) {
      if (uses.length < 2) continue;
      for (const [idx, { lineIdx, label }] of uses.entries()) {
        // Derive a unique ID from the label; fall back to oldId + ordinal
        const newId = label.trim().length > 0
          ? label.trim().split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('')
          : `${oldId}${idx + 1}`;
        lines[lineIdx] = lines[lineIdx].replace(
          new RegExp(`^([ \\t]*)${escRe(oldId)}(?=[([{])`),
          `$1${newId}`,
        );
      }
    }

    result = lines.join('\n');
  }

  // ── Phase 4: collect multi-word node IDs from declaration lines ───────────
  const phraseMap = new Map<string, string>();
  // Declarations that still use multi-word IDs before any bracket/paren/brace:
  //   "  Order Service["  /  "  Payment Gateway("  /  "  Message Queue{"
  const declRe = /^[ \t]*([A-Za-z][A-Za-z0-9]*(?: [A-Za-z][A-Za-z0-9]*)+)\s*[(\[{]/gm;
  let m: RegExpExecArray | null;
  while ((m = declRe.exec(result)) !== null) {
    const phrase = m[1].trim();
    if (!phraseMap.has(phrase)) {
      phraseMap.set(phrase, phrase.replace(/ ([A-Za-z])/g, (_, c: string) => c.toUpperCase()));
    }
  }

  // ── Phase 5: collect multi-word phrases from edge lines ───────────────────
  for (const line of result.split('\n')) {
    const arrowIdx = line.search(/--[>.\-]+/);
    if (arrowIdx === -1) continue;
    const left = line.slice(0, arrowIdx).trim();
    const afterArrow = line.slice(arrowIdx).replace(/^--[>.\-]+(\|[^|]*\|)?\s*/, '').trim();
    const right = afterArrow.split(/\s*--[>.\-]+/)[0].trim();
    for (const candidate of [left, right]) {
      if (candidate.includes(' ') && /^[A-Za-z]/.test(candidate) && !phraseMap.has(candidate)) {
        phraseMap.set(candidate, candidate.replace(/ ([A-Za-z])/g, (_, c: string) => c.toUpperCase()));
      }
    }
  }

  if (phraseMap.size === 0) return result;

  // ── Phase 6: replace multi-word phrases longest-first ────────────────────
  const sorted = [...phraseMap.entries()].sort((a, b) => b[0].length - a[0].length);
  for (const [phrase, id] of sorted) {
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // In node declarations: "Phrase[" / "Phrase(" / "Phrase{" → "id[" etc.
    result = result.replace(new RegExp(`${escaped}\\s*([([{])`, 'gm'), `${id}$1`);
    // Bare phrase in edge lines (not inside a label, not adjacent to a bracket)
    result = result.replace(
      new RegExp(`(?<![\\w"])${escaped.replace(/ /g, '\\s+')}(?![\\w"\\[({])`, 'gm'),
      id,
    );
  }

  return result;
}

function MermaidBlock({
  diagram,
  density,
}: {
  diagram: MermaidDiagram;
  density: 'executive' | 'operator' | 'expert';
}) {
  const { theme } = useTheme();
  const cardStyle = useCardStyle();
  const titleStyle = useTitleStyle();
  const captionStyle = useCaptionStyle();
  const svgWrapRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [showRaw, setShowRaw] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(true);
  const [copied, setCopied] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef<{ mx: number; my: number; px: number; py: number } | null>(null);
  const idRef = useRef(`mermaid-blk-${++_mermaidRenderCount}`);

  const isDark = isDarkBackground(theme.colors.background);
  const mermaidTheme = isDark ? 'dark' : 'default';

  /** Theme variables passed to mermaid to ensure text/node colours are always
   *  legible regardless of whether a custom CSS theme targets the SVG. */
  const themeVariables = isDark
    ? {
        background:          theme.colors.surface,
        mainBkg:             theme.colors.surfaceAlt,
        nodeBorder:          theme.colors.border,
        clusterBkg:          theme.colors.surfaceAlt,
        titleColor:          theme.colors.text,
        edgeLabelBackground: theme.colors.surfaceAlt,
        lineColor:           theme.colors.textSecondary,
        primaryColor:        '#4f46e5',
        primaryTextColor:    theme.colors.text,
        primaryBorderColor:  theme.colors.accent,
        secondaryColor:      theme.colors.surface,
        tertiaryColor:       theme.colors.surfaceAlt,
        labelTextColor:      theme.colors.text,
        nodeTextColor:       theme.colors.text,
        textColor:           theme.colors.text,
        fontSize:            '14px',
      }
    : {
        background:          theme.colors.surface,
        mainBkg:             '#eff6ff',
        nodeBorder:          '#6366f1',
        clusterBkg:          theme.colors.surfaceAlt,
        titleColor:          theme.colors.text,
        edgeLabelBackground: theme.colors.surfaceAlt,
        lineColor:           theme.colors.textSecondary,
        primaryColor:        '#eff6ff',
        primaryTextColor:    '#1e293b',
        primaryBorderColor:  '#6366f1',
        labelTextColor:      '#1e293b',
        nodeTextColor:       '#1e293b',
        textColor:           '#1e293b',
        fontSize:            '14px',
      };

  useEffect(() => {
    // Re-initialise when the theme flavour flips (dark ↔ light).
    if (_mermaidInitTheme !== mermaidTheme) {
      _mermaidInitTheme = mermaidTheme;
      mermaid.initialize({
        startOnLoad:   false,
        theme:         mermaidTheme,
        themeVariables,
        securityLevel: 'loose',
        fontFamily:    theme.typography.family,
      });
    }

    setIsRendering(true);
    setRenderError(null);

    // Sanitise markup before handing it to mermaid (fixes common LLM errors)
    const safeMarkup = sanitizeMermaidMarkup(diagram.markup);

    mermaid
      .render(idRef.current, safeMarkup)
      .then(({ svg }) => {
        if (svgWrapRef.current) {
          svgWrapRef.current.innerHTML = svg;
          const svgEl = svgWrapRef.current.querySelector('svg');
          if (svgEl) {
            // Responsive sizing
            svgEl.style.maxWidth = '100%';
            svgEl.style.height   = 'auto';
            svgEl.style.display  = 'block';
            // Let the renderer container control the background so that
            // both light and dark themes get the correct look. Mermaid's
            // default theme inlines a white background on the SVG root;
            // we override it to transparent so the theme surfaceAlt shows.
            svgEl.style.background = 'transparent';
            // Ensure body text inside the SVG inherits a visible colour.
            // Mermaid injects inline fill/stroke styles; we reinforce them
            // with a <style> block scoped to this SVG.
            const textColor = theme.colors.text;
            const existingStyle = svgEl.querySelector('style');
            const colorOverride = `
              .node text, .label text, .edgeLabel text,
              .actor text, .messageText, .loopText,
              text { fill: ${textColor} !important; color: ${textColor} !important; }
            `;
            if (existingStyle) {
              existingStyle.textContent += colorOverride;
            } else {
              const styleEl = document.createElementNS('http://www.w3.org/2000/svg', 'style');
              styleEl.textContent = colorOverride;
              svgEl.insertBefore(styleEl, svgEl.firstChild);
            }
          }
        }
        setIsRendering(false);
      })
      .catch((err: unknown) => {
        setRenderError(String(err).replace(/^Error:\s*/i, ''));
        setIsRendering(false);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diagram.markup, mermaidTheme]);

  // Reset zoom/pan whenever the diagram changes
  useEffect(() => { setZoom(1); setPan({ x: 0, y: 0 }); }, [diagram.markup]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((z) => Math.min(4, Math.max(0.25, z - e.deltaY * 0.001)));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    dragStart.current = { mx: e.clientX, my: e.clientY, px: pan.x, py: pan.y };
  }, [pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || !dragStart.current) return;
    setPan({
      x: dragStart.current.px + (e.clientX - dragStart.current.mx),
      y: dragStart.current.py + (e.clientY - dragStart.current.my),
    });
  }, [isDragging]);

  const handleMouseUp = useCallback(() => { setIsDragging(false); dragStart.current = null; }, []);

  const downloadSvg = useCallback(() => {
    if (!svgWrapRef.current) return;
    const svg = svgWrapRef.current.querySelector('svg');
    if (!svg) return;
    const blob = new Blob([svg.outerHTML], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${diagram.title ?? 'diagram'}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }, [diagram.title]);

  const copyMarkup = useCallback(() => {
    navigator.clipboard.writeText(diagram.markup).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [diagram.markup]);

  const btnBase: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.3rem',
    fontSize: '0.72rem',
    fontWeight: 500,
    padding: '0.25rem 0.6rem',
    borderRadius: theme.radius.sm,
    border: `1px solid ${theme.colors.border}`,
    background: theme.colors.surface,
    color: theme.colors.text,
    cursor: 'pointer',
    transition: 'background 0.15s',
  };

  return (
    <div style={cardStyle}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', gap: '0.5rem', flexWrap: 'wrap' }}>
        {diagram.title
          ? <div style={titleStyle}>{diagram.title}</div>
          : <div />}

        {/* Toolbar */}
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Zoom controls */}
          {!showRaw && !renderError && (
            <>
              <button style={btnBase} onClick={() => setZoom((z) => Math.min(4, +(z + 0.25).toFixed(2)))} title="Zoom in">＋</button>
              <span style={{ fontSize: '0.72rem', color: theme.colors.textSecondary, minWidth: '3rem', textAlign: 'center' }}>
                {Math.round(zoom * 100)}%
              </span>
              <button style={btnBase} onClick={() => setZoom((z) => Math.max(0.25, +(z - 0.25).toFixed(2)))} title="Zoom out">－</button>
              <button style={btnBase} onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} title="Reset view">⌂</button>
            </>
          )}

          {/* Download SVG — only when diagram rendered */}
          {!showRaw && !renderError && !isRendering && (
            <button style={btnBase} onClick={downloadSvg} title="Download SVG">
              ↓ SVG
            </button>
          )}

          {/* Copy markup */}
          <button style={{ ...btnBase, color: copied ? theme.colors.success : theme.colors.text }} onClick={copyMarkup} title="Copy source">
            {copied ? '✓ Copied' : '⧉ Source'}
          </button>

          {/* Toggle raw */}
          {!renderError && (
            <button
              style={{ ...btnBase, background: showRaw ? theme.colors.accentSubtle : theme.colors.surface, color: showRaw ? theme.colors.accent : theme.colors.text }}
              onClick={() => setShowRaw((v) => !v)}
              title={showRaw ? 'Show diagram' : 'Show source'}
            >
              {showRaw ? '⬡ Diagram' : '</> Raw'}
            </button>
          )}
        </div>
      </div>

      {/* Loading skeleton */}
      {isRendering && !renderError && (
        <div style={{
          height: '180px',
          borderRadius: theme.radius.md,
          background: `linear-gradient(90deg, ${theme.colors.surfaceAlt} 25%, ${theme.colors.border} 50%, ${theme.colors.surfaceAlt} 75%)`,
          backgroundSize: '200% 100%',
          animation: 'hari-shimmer 1.4s infinite',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: theme.colors.textMuted,
          fontSize: '0.82rem',
        }}>
          <style>{`@keyframes hari-shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
          Rendering diagram…
        </div>
      )}

      {/* Error banner */}
      {renderError && (
        <div style={{
          background: theme.colors.dangerSubtle,
          border: `1px solid ${theme.colors.danger}`,
          borderRadius: theme.radius.md,
          padding: '0.75rem 1rem',
          marginBottom: '0.5rem',
        }}>
          <div style={{ color: theme.colors.dangerText, fontWeight: 600, fontSize: '0.82rem', marginBottom: '0.25rem' }}>Render error</div>
          <pre style={{ color: theme.colors.dangerText, fontSize: '0.78rem', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: theme.typography.familyMono }}>
            {renderError}
          </pre>
        </div>
      )}

      {/* Rendered mermaid diagram with zoom/pan */}
      {!showRaw && !renderError && (
        <div
          ref={containerRef}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{
            overflow: 'hidden',
            borderRadius: theme.radius.md,
            background: theme.colors.surfaceAlt,
            padding: '1.25rem',
            cursor: isDragging ? 'grabbing' : 'grab',
            userSelect: 'none',
            minHeight: '120px',
            position: 'relative',
            display: isRendering ? 'none' : 'block',
          }}
        >
          <div
            ref={svgWrapRef}
            style={{
              transformOrigin: 'top left',
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transition: isDragging ? 'none' : 'transform 0.15s ease',
            }}
          />
        </div>
      )}

      {/* Raw markup */}
      {(showRaw || renderError) && (
        <pre
          style={{
            background: theme.colors.text,
            color: theme.colors.surface,
            borderRadius: theme.radius.md,
            padding: '1rem',
            fontSize: '0.8rem',
            fontFamily: theme.typography.familyMono,
            overflowX: 'auto',
            lineHeight: 1.6,
            margin: 0,
            whiteSpace: 'pre',
          }}
        >
          {diagram.markup}
        </pre>
      )}

      {diagram.caption && density !== 'executive' && (
        <div style={captionStyle}>{diagram.caption}</div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Graph renderer (SVG, circular/hierarchical layout)
// ─────────────────────────────────────────────────────────────────────────────

interface Point { x: number; y: number; }

function computeLayout(
  nodes: GraphNode[],
  layout: GraphDiagram['layout'],
  width: number,
  height: number,
): Map<string, Point> {
  const map = new Map<string, Point>();
  const n = nodes.length;
  if (n === 0) return map;

  const cx = width / 2;
  const cy = height / 2;
  const r = Math.min(cx, cy) * 0.75;

  if (layout === 'hierarchy') {
    // Very simple top-down BFS hierarchy
    // Place root(s) at top, children below
    const levels: string[][] = [];
    const visited = new Set<string>();
    // First pass: nodes with no incoming consideration as roots
    const roots = nodes.map((n) => n.id);
    levels.push(roots.slice(0, Math.ceil(Math.sqrt(n))));
    let remaining = roots.filter((id) => !levels[0].includes(id));
    while (remaining.length > 0) {
      const chunk = remaining.splice(0, Math.ceil(Math.sqrt(n)));
      levels.push(chunk);
    }
    levels.forEach((level, li) => {
      const y = 60 + li * (height / (levels.length + 1));
      level.forEach((id, xi) => {
        if (visited.has(id)) return;
        visited.add(id);
        const x = (width / (level.length + 1)) * (xi + 1);
        map.set(id, { x, y });
      });
    });
  } else if (layout === 'radial') {
    // Radial: groups on inner rings, singletons on outer
    const groups = new Map<string, string[]>();
    nodes.forEach((nd) => {
      const g = nd.group ?? '__default';
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g)!.push(nd.id);
    });
    let gi = 0;
    const groupKeys = [...groups.keys()];
    groupKeys.forEach((gk) => {
      const members = groups.get(gk)!;
      const angleBase = (2 * Math.PI * gi) / groupKeys.length;
      const ringR = (gi === 0 && groupKeys.length === 1) ? 0 : r * (0.4 + 0.6 * (gi / groupKeys.length));
      members.forEach((id, mi) => {
        const a = angleBase + (2 * Math.PI * mi) / members.length;
        map.set(id, {
          x: cx + ringR * Math.cos(a),
          y: cy + ringR * Math.sin(a),
        });
      });
      gi++;
    });
  } else {
    // force / default: arrange on a circle for simplicity
    nodes.forEach((nd, i) => {
      const angle = (2 * Math.PI * i) / n - Math.PI / 2;
      map.set(nd.id, {
        x: cx + r * Math.cos(angle),
        y: cy + r * Math.sin(angle),
      });
    });
  }

  return map;
}

function GraphBlock({
  diagram,
  density,
  groupColorMap,
  onExplain,
}: {
  diagram: GraphDiagram;
  density: 'executive' | 'operator' | 'expert';
  groupColorMap: Map<string, string>;
  onExplain?: (id: string) => void;
}) {
  const { theme } = useTheme();
  const cardStyle = useCardStyle();
  const titleStyle = useTitleStyle();
  const captionStyle = useCaptionStyle();
  const W = 560;
  const H = density === 'executive' ? 260 : 380;
  const positions = useMemo(
    () => computeLayout(diagram.nodes, diagram.layout, W, H),
    [diagram.nodes, diagram.layout],
  );

  const [hovered, setHovered] = useState<string | null>(null);

  function nodeColor(nd: GraphNode): string {
    if (nd.color) return nd.color;
    if (nd.group) {
      if (!groupColorMap.has(nd.group)) {
        groupColorMap.set(nd.group, paletteColor(groupColorMap.size));
      }
      return groupColorMap.get(nd.group)!;
    }
    return '#6366f1';
  }

  const MARKER_ID = `arrow-${diagram.id ?? 'graph'}`;

  return (
    <div style={cardStyle}>
      {diagram.title && <div style={titleStyle}>{diagram.title}</div>}
      <div style={{ overflowX: 'auto' }}>
        <svg
          role="img"
          aria-label={diagram.title ?? 'Graph diagram'}
          width="100%"
          viewBox={`0 0 ${W} ${H}`}
          style={{ display: 'block', maxWidth: W }}
        >
          <title>{diagram.title ?? 'Graph diagram'}</title>
          <defs>
            <marker id={MARKER_ID} markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
              <polygon points="0 0, 10 3.5, 0 7" fill="#94a3b8" />
            </marker>
          </defs>

          {/* Edges */}
          {diagram.edges.map((edge, ei) => {
            const src = positions.get(edge.source);
            const tgt = positions.get(edge.target);
            if (!src || !tgt) return null;
            const color = edge.color ?? '#94a3b8';
            const strokeW = edge.weight ?? 1;
            const dashArray =
              edge.style === 'dashed' ? '6 3' : edge.style === 'dotted' ? '2 3' : undefined;

            // Offset so line ends at node boundary (r=20)
            const dx = tgt.x - src.x;
            const dy = tgt.y - src.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const nodeR = 22;
            const x2 = tgt.x - (dx / dist) * nodeR;
            const y2 = tgt.y - (dy / dist) * nodeR;

            const midX = (src.x + x2) / 2;
            const midY = (src.y + y2) / 2;

            return (
              <g key={ei}>
                <line
                  x1={src.x} y1={src.y} x2={x2} y2={y2}
                  stroke={color}
                  strokeWidth={strokeW}
                  strokeDasharray={dashArray}
                  markerEnd={edge.directed ? `url(#${MARKER_ID})` : undefined}
                  strokeLinecap="round"
                />
                {edge.label && density !== 'executive' && (
                  <text
                    x={midX} y={midY - 4}
                    textAnchor="middle"
                    fontSize="10"
                    fill="#64748b"
                    style={{ pointerEvents: 'none' }}
                  >
                    {edge.label}
                  </text>
                )}
              </g>
            );
          })}

          {/* Nodes */}
          {diagram.nodes.map((nd) => {
            const pos = positions.get(nd.id);
            if (!pos) return null;
            const color = nodeColor(nd);
            const isHov = hovered === nd.id;
            const r = 22;
            const ResolvedIcon = nd.icon ? resolveIcon(nd.icon, theme.id) : null;

            return (
              <g
                key={nd.id}
                transform={`translate(${pos.x},${pos.y})`}
                style={{ cursor: nd.explainElementId ? 'pointer' : 'default' }}
                onMouseEnter={() => setHovered(nd.id)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => {
                  if (nd.explainElementId && onExplain) onExplain(nd.explainElementId);
                }}
              >
                <circle
                  r={isHov ? r + 3 : r}
                  fill={color}
                  fillOpacity={0.15}
                  stroke={color}
                  strokeWidth={isHov ? 2.5 : 1.5}
                  style={{ transition: 'all 0.15s' }}
                />

                {/* Render Icon: Lucide if resolved, otherwise text fallback */}
                {nd.icon ? (
                  ResolvedIcon ? (
                     <foreignObject x={-8} y={-8} width={16} height={16} style={{ overflow: 'visible' }}>
                       <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', color: color }}>
                         <ResolvedIcon size={16} strokeWidth={2.5} />
                       </div>
                     </foreignObject>
                   ) : (
                    <text textAnchor="middle" dominantBaseline="central" fontSize="14" style={{ userSelect: 'none' }}>
                      {nd.icon}
                    </text>
                   )
                ) : null}

                <text
                  x={0}
                  y={r + 13}
                  textAnchor="middle"
                  fontSize="10"
                  fill="#1e293b"
                  style={{ pointerEvents: 'none', userSelect: 'none' }}
                >
                  {nd.label.length > 14 ? nd.label.slice(0, 13) + '…' : nd.label}
                </text>

                {/* Expert: metadata tooltip on hover */}
                {density === 'expert' && isHov && nd.metadata && (
                  <g transform={`translate(${r + 5}, ${-r})`} style={{ pointerEvents: 'none' }}>
                    <rect
                      x={0} y={0}
                      width={140} height={Object.keys(nd.metadata).length * 16 + 8}
                      rx={4} fill="#1e293b" fillOpacity={0.9}
                    />
                    {Object.entries(nd.metadata).map(([k, v], mi) => (
                      <text key={k} x={6} y={mi * 16 + 14} fontSize="9" fill="#e2e8f0">
                        {k}: {String(v)}
                      </text>
                    ))}
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      </div>


      {/* Group legend */}
      {density !== 'executive' && groupColorMap.size > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
          {[...groupColorMap.entries()].map(([g, c]) => (
            <span
              key={g}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                fontSize: '0.75rem', color: '#475569',
              }}
            >
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: c, display: 'inline-block' }} />
              {g}
            </span>
          ))}
        </div>
      )}

      {diagram.caption && density !== 'executive' && (
        <div style={captionStyle}>{diagram.caption}</div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Chart renderer (bar, line, area, pie)
// ─────────────────────────────────────────────────────────────────────────────

function resolveColors(series: ChartSeries[]): string[] {
  return series.map((s, i) => s.color ?? paletteColor(i));
}

function BarChart({
  diagram,
  colors,
  density,
}: {
  diagram: ChartDiagram;
  colors: string[];
  density: 'executive' | 'operator' | 'expert';
}) {
  const W = 540;
  const H = density === 'executive' ? 180 : 260;
  const MARGIN = { top: 20, right: 20, bottom: density === 'executive' ? 40 : 60, left: 44 };
  const innerW = W - MARGIN.left - MARGIN.right;
  const innerH = H - MARGIN.top - MARGIN.bottom;

  const allValues = diagram.series.flatMap((s) => s.values);
  const maxVal = Math.max(...allValues, 0) * 1.1 || 1;
  const minVal = diagram.yZeroBased ? 0 : Math.min(...allValues) * 0.9;
  const valueRange = maxVal - minVal;

  const labels = diagram.labels;
  const seriesCount = diagram.series.length;
  const groupW = innerW / Math.max(labels.length, 1);
  const barW = Math.max(4, (groupW / (seriesCount + 1)) - 2);

  function yScale(v: number) {
    return innerH - ((v - minVal) / valueRange) * innerH;
  }

  const yTicks = 4;
  const tickValues = Array.from({ length: yTicks + 1 }, (_, i) =>
    minVal + (valueRange * i) / yTicks,
  );

  return (
    <svg role="img" aria-label={diagram.title ?? 'Bar chart'} width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
      <title>{diagram.title ?? 'Bar chart'}</title>
      <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
        {/* Y-axis ticks */}
        {tickValues.map((tv, i) => (
          <g key={i} transform={`translate(0,${yScale(tv)})`}>
            <line x1={0} x2={innerW} stroke="#e2e8f0" strokeDasharray="4 2" />
            <text x={-6} textAnchor="end" dominantBaseline="middle" fontSize="9" fill="#94a3b8">
              {tv % 1 === 0 ? tv : tv.toFixed(1)}{diagram.unit ?? ''}
            </text>
          </g>
        ))}

        {/* Bars */}
        {labels.map((lbl, li) => {
          const groupX = li * groupW + groupW / 2;
          return (
            <g key={li}>
              {diagram.series.map((ser, si) => {
                const val = ser.values[li] ?? 0;
                const color = colors[si];
                const x = groupX - (seriesCount * barW) / 2 + si * barW;
                const y = yScale(Math.max(val, minVal));
                const barH = Math.max(1, innerH - yScale(Math.max(val, minVal)));
                return (
                  <g key={si}>
                    <rect x={x} y={y} width={barW - 1} height={barH} fill={color} fillOpacity={0.85} rx={2} />
                    {density === 'expert' && (
                      <text
                        x={x + (barW - 1) / 2} y={y - 3}
                        textAnchor="middle" fontSize="8" fill={color}
                      >
                        {val}{diagram.unit ?? ''}
                      </text>
                    )}
                  </g>
                );
              })}
              {density !== 'executive' && (
                <text
                  x={groupX} y={innerH + 14}
                  textAnchor="middle" fontSize="9" fill="#64748b"
                >
                  {lbl.length > 8 ? lbl.slice(0, 7) + '…' : lbl}
                </text>
              )}
            </g>
          );
        })}

        {/* Axes */}
        <line x1={0} y1={0} x2={0} y2={innerH} stroke="#cbd5e1" />
        <line x1={0} y1={innerH} x2={innerW} y2={innerH} stroke="#cbd5e1" />
      </g>
    </svg>
  );
}

function LineAreaChart({
  diagram,
  colors,
  density,
  area,
}: {
  diagram: ChartDiagram;
  colors: string[];
  density: 'executive' | 'operator' | 'expert';
  area: boolean;
}) {
  const W = 540;
  const H = density === 'executive' ? 180 : 260;
  const MARGIN = { top: 20, right: 20, bottom: density === 'executive' ? 36 : 56, left: 44 };
  const innerW = W - MARGIN.left - MARGIN.right;
  const innerH = H - MARGIN.top - MARGIN.bottom;

  const allValues = diagram.series.flatMap((s) => s.values);
  const maxVal = Math.max(...allValues, 0) * 1.1 || 1;
  const minVal = diagram.yZeroBased ? 0 : Math.min(...allValues) * 0.9;
  const vRange = maxVal - minVal;

  const labels = diagram.labels;
  const n = Math.max(labels.length - 1, 1);

  function xScale(i: number) { return (i / n) * innerW; }
  function yScale(v: number) { return innerH - ((v - minVal) / vRange) * innerH; }

  const yTicks = 4;
  const tickVals = Array.from({ length: yTicks + 1 }, (_, i) =>
    minVal + (vRange * i) / yTicks,
  );

  return (
    <svg role="img" aria-label={diagram.title ?? 'Line chart'} width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
      <title>{diagram.title ?? 'Line chart'}</title>
      <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
        {/* Grid */}
        {tickVals.map((tv, i) => (
          <g key={i} transform={`translate(0,${yScale(tv)})`}>
            <line x1={0} x2={innerW} stroke="#e2e8f0" strokeDasharray="4 2" />
            <text x={-6} textAnchor="end" dominantBaseline="middle" fontSize="9" fill="#94a3b8">
              {tv % 1 === 0 ? tv : tv.toFixed(1)}{diagram.unit ?? ''}
            </text>
          </g>
        ))}

        {/* Area fills */}
        {area && diagram.series.map((ser, si) => {
          const pts = ser.values.map((v, i) => `${xScale(i)},${yScale(v)}`).join(' ');
          const first = ser.values[0] ?? 0;
          const last = ser.values[ser.values.length - 1] ?? 0;
          const path = `M${xScale(0)},${innerH} L${xScale(0)},${yScale(first)} ${ser.values.map((v, i) => `L${xScale(i)},${yScale(v)}`).join(' ')} L${xScale(ser.values.length - 1)},${innerH} Z`;
          void pts;
          return (
            <path key={si} d={path} fill={colors[si]} fillOpacity={0.12} />
          );
          void last;
        })}

        {/* Lines */}
        {diagram.series.map((ser, si) => {
          const d = ser.values
            .map((v, i) => `${i === 0 ? 'M' : 'L'}${xScale(i)},${yScale(v)}`)
            .join(' ');
          return (
            <g key={si}>
              <path d={d} fill="none" stroke={colors[si]} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              {/* Dots */}
              {ser.values.map((v, i) => (
                <circle key={i} cx={xScale(i)} cy={yScale(v)} r={3} fill={colors[si]} />
              ))}
            </g>
          );
        })}

        {/* X labels */}
        {density !== 'executive' && labels.map((lbl, i) => (
          <text key={i} x={xScale(i)} y={innerH + 14} textAnchor="middle" fontSize="9" fill="#64748b">
            {lbl.length > 8 ? lbl.slice(0, 7) + '…' : lbl}
          </text>
        ))}

        {/* Axes */}
        <line x1={0} y1={0} x2={0} y2={innerH} stroke="#cbd5e1" />
        <line x1={0} y1={innerH} x2={innerW} y2={innerH} stroke="#cbd5e1" />
      </g>
    </svg>
  );
}

function PieChart({
  diagram,
  colors,
  density,
}: {
  diagram: ChartDiagram;
  colors: string[];
  density: 'executive' | 'operator' | 'expert';
}) {
  const SIZE = density === 'executive' ? 160 : 220;
  const cx = SIZE / 2;
  const cy = SIZE / 2;
  const r = SIZE / 2 - 16;

  // Use first series only for pie; multiple series → stacked donut not supported
  const series = diagram.series[0];
  if (!series) return null;
  const total = series.values.reduce((a, b) => a + b, 0) || 1;

  let cumAngle = -Math.PI / 2;

  function slice(value: number, color: string, label: string, i: number) {
    const angle = (value / total) * 2 * Math.PI;
    const x1 = cx + r * Math.cos(cumAngle);
    const y1 = cy + r * Math.sin(cumAngle);
    cumAngle += angle;
    const x2 = cx + r * Math.cos(cumAngle);
    const y2 = cy + r * Math.sin(cumAngle);
    const large = angle > Math.PI ? 1 : 0;

    const midAngle = cumAngle - angle / 2;
    const lx = cx + (r + 16) * Math.cos(midAngle);
    const ly = cy + (r + 16) * Math.sin(midAngle);

    const pct = ((value / total) * 100).toFixed(1);

    return (
      <g key={i}>
        <path
          d={`M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${large},1 ${x2},${y2} Z`}
          fill={color}
          fillOpacity={0.85}
          stroke="#fff"
          strokeWidth={1.5}
        />
        {density !== 'executive' && angle > 0.25 && (
          <text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" fontSize="9" fill="#1e293b">
            {density === 'expert' ? `${label}: ${pct}%` : `${pct}%`}
          </text>
        )}
      </g>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
      <svg role="img" aria-label={diagram.title ?? 'Pie chart'} width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} style={{ display: 'block', flexShrink: 0 }}>
        <title>{diagram.title ?? 'Pie chart'}</title>
        {series.values.map((v, i) =>
          slice(v, colors[i] ?? paletteColor(i), diagram.labels[i] ?? `#${i + 1}`, i),
        )}
      </svg>
      {density !== 'executive' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          {series.values.map((v, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', color: '#475569' }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: colors[i] ?? paletteColor(i), display: 'inline-block', flexShrink: 0 }} />
              <span>{diagram.labels[i] ?? `Series ${i + 1}`}</span>
              <span style={{ color: '#94a3b8' }}>
                {v}{diagram.unit ?? ''} ({((v / total) * 100).toFixed(1)}%)
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ChartBlock({
  diagram,
  density,
}: {
  diagram: ChartDiagram;
  density: 'executive' | 'operator' | 'expert';
}) {
  const colors = useMemo(() => resolveColors(diagram.series), [diagram.series]);
  const cardStyle = useCardStyle();
  const titleStyle = useTitleStyle();
  const captionStyle = useCaptionStyle();
  const { theme } = useTheme();

  return (
    <div style={cardStyle}>
      {diagram.title && <div style={titleStyle}>{diagram.title}</div>}
      <div style={{ overflowX: 'auto' }}>
        {diagram.chartType === 'bar' && (
          <BarChart diagram={diagram} colors={colors} density={density} />
        )}
        {diagram.chartType === 'line' && (
          <LineAreaChart diagram={diagram} colors={colors} density={density} area={false} />
        )}
        {diagram.chartType === 'area' && (
          <LineAreaChart diagram={diagram} colors={colors} density={density} area={true} />
        )}
        {diagram.chartType === 'pie' && (
          <PieChart diagram={diagram} colors={colors} density={density} />
        )}
      </div>

      {/* Legend for bar/line/area with multiple series */}
      {diagram.chartType !== 'pie' && diagram.series.length > 1 && density !== 'executive' && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginTop: '0.5rem' }}>
          {diagram.series.map((s, si) => (
            <span key={si} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.78rem', color: '#475569' }}>
              <span style={{ width: 12, height: 4, borderRadius: 2, background: colors[si], display: 'inline-block' }} />
              {s.name}
            </span>
          ))}
        </div>
      )}

      {diagram.caption && density !== 'executive' && (
        <div style={captionStyle}>{diagram.caption}</div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DiagramBlock dispatcher
// ─────────────────────────────────────────────────────────────────────────────

function DiagramBlock({
  payload,
  density,
  onExplain,
  groupColorMap,
}: {
  payload: DiagramPayload;
  density: 'executive' | 'operator' | 'expert';
  onExplain?: (id: string) => void;
  groupColorMap: Map<string, string>;
}) {
  if (payload.kind === 'mermaid') {
    return <MermaidBlock diagram={payload} density={density} />;
  }
  if (payload.kind === 'graph') {
    return <GraphBlock diagram={payload} density={density} groupColorMap={groupColorMap} onExplain={onExplain} />;
  }
  if (payload.kind === 'chart') {
    return <ChartBlock diagram={payload} density={density} />;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main DiagramRenderer
// ─────────────────────────────────────────────────────────────────────────────

export function DiagramRenderer({ data, density = 'operator', onExplain }: DiagramRendererProps) {
  const parsed = DiagramDataSchema.safeParse(data);

  if (!parsed.success) {
    return (
      <div style={{ padding: '1rem', color: '#dc2626', fontSize: '0.85rem', background: '#fef2f2', borderRadius: '0.5rem' }}>
        <strong>DiagramRenderer:</strong> Invalid data — {parsed.error.issues[0]?.message ?? 'unknown error'}
      </div>
    );
  }

  const diagramData = parsed.data;
  // In executive density, only the first diagram is shown
  const diagrams = density === 'executive' ? diagramData.diagrams.slice(0, 1) : diagramData.diagrams;

  // Shared group→colour map across all graph diagrams in this panel
  const groupColorMap = useMemo(() => new Map<string, string>(), []);

  return (
    <div style={{ width: '100%' }}>
      {/* Section heading */}
      {diagramData.title && (
        <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.5rem' }}>
          {diagramData.title}
        </div>
      )}
      {diagramData.description && density !== 'executive' && (
        <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1rem', lineHeight: 1.5 }}>
          {diagramData.description}
        </div>
      )}

      {diagrams.map((payload, i) => (
        <DiagramBlock
          key={(payload as { id?: string }).id ?? i}
          payload={payload}
          density={density}
          onExplain={onExplain}
          groupColorMap={groupColorMap}
        />
      ))}
    </div>
  );
}
