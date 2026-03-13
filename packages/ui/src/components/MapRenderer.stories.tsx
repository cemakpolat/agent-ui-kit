import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { MapRenderer } from './MapRenderer';
import { MapDataSchema } from '@hari/core';

// ─────────────────────────────────────────────────────────────────────────────
// Shared decorators for HARI time-bounding & uncertainty states
// ─────────────────────────────────────────────────────────────────────────────

function UncertaintyBanner({ confidence, unknowns }: { confidence: number; unknowns: string[] }) {
  const pct   = Math.round(confidence * 100);
  const isLow = confidence < 0.5;
  const bg    = isLow ? '#fee2e2' : '#fef9c3';
  const color = isLow ? '#991b1b' : '#854d0e';
  const icon  = isLow ? '⚠' : '~';
  const label = isLow ? 'Low Confidence' : 'Moderate Confidence';
  return (
    <div style={{ border: `2px solid ${color}`, borderRadius: 8, overflow: 'hidden', marginBottom: 12 }}>
      <div style={{ background: bg, color, padding: '8px 12px', fontSize: '0.8rem', fontWeight: 600, display: 'flex', gap: 12, alignItems: 'baseline' }}>
        <span>{icon} {label} — {pct}%</span>
        <span style={{ fontWeight: 400, fontSize: '0.75rem' }}>{unknowns.join(' · ')}</span>
      </div>
    </div>
  );
}

function ExpiredBanner() {
  return (
    <div style={{ border: '2px solid #991b1b', borderRadius: 8, overflow: 'hidden', marginBottom: 12 }}>
      <div style={{ background: '#fee2e2', color: '#991b1b', padding: '8px 12px', fontSize: '0.8rem', fontWeight: 600 }}>
        ○ View Expired — geospatial data has passed its validity window. Re-task the agent to refresh locations.
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

const DATACENTER_MAP = MapDataSchema.parse({
  title: 'Global Infrastructure — Data Centre Locations',
  center: { lat: 20, lng: 0 },
  zoom: 2,
  markers: [
    {
      id: 'us-east-1',
      position: { lat: 38.9, lng: -77.0 },
      label: 'us-east-1',
      description: 'Primary region. 6 availability zones. Status: healthy.',
      category: 'primary',
      icon: '✅',
      metadata: { provider: 'AWS', az_count: 6, status: 'healthy' },
    },
    {
      id: 'eu-west-1',
      position: { lat: 53.3, lng: -6.3 },
      label: 'eu-west-1',
      description: 'EU primary. GDPR compliant. Status: healthy.',
      category: 'primary',
      icon: '✅',
      metadata: { provider: 'AWS', az_count: 3, status: 'healthy' },
    },
    {
      id: 'ap-southeast-1',
      position: { lat: 1.35, lng: 103.8 },
      label: 'ap-southeast-1',
      description: 'APAC primary. Status: healthy.',
      category: 'primary',
      icon: '✅',
      metadata: { provider: 'AWS', az_count: 3, status: 'healthy' },
    },
    {
      id: 'us-west-2',
      position: { lat: 45.5, lng: -122.7 },
      label: 'us-west-2',
      description: 'DR region. Failover target from us-east-1.',
      category: 'dr',
      icon: '🔄',
      color: '#6366f1',
      metadata: { provider: 'AWS', role: 'disaster-recovery' },
    },
  ],
  polygons: [
    {
      id: 'eu-boundary',
      coordinates: [
        { lat: 71, lng: -25 }, { lat: 71, lng: 45 },
        { lat: 35, lng: 45 },  { lat: 35, lng: -25 },
      ],
      label: 'EU GDPR Zone',
      color: '#6366f1',
      fillColor: '#6366f120',
    },
  ],
  layers: [
    { id: 'markers', label: 'Data Centres', visible: true },
    { id: 'polygons', label: 'Compliance Zones', visible: true },
  ],
});

// High-uncertainty: agent doesn't know real-time location of field assets
const INCIDENT_MAP = MapDataSchema.parse({
  title: 'Incident Blast Radius — Estimated (Unverified)',
  center: { lat: 38.9, lng: -77.0 },
  zoom: 6,
  markers: [
    {
      id: 'origin',
      position: { lat: 38.9, lng: -77.0 },
      label: 'us-east-1 (origin)',
      description: 'Incident origin. Confirmed by CloudWatch alert.',
      category: 'incident',
      icon: '🔴',
      color: '#ef4444',
    },
    {
      id: 'customer-ny',
      position: { lat: 40.7, lng: -74.0 },
      label: 'New York customer cluster',
      description: 'Impact: ESTIMATED. No direct customer telemetry available.',
      category: 'affected',
      icon: '⚠',
      color: '#f59e0b',
      metadata: { status: 'estimated-impact', confidence: 0.35 },
    },
    {
      id: 'customer-dc',
      position: { lat: 38.9, lng: -77.0 },
      label: 'DC/VA customer cluster',
      description: 'Impact: INFERRED from request latency spike. Not confirmed.',
      category: 'affected',
      icon: '⚠',
      color: '#f59e0b',
      metadata: { status: 'inferred-impact', confidence: 0.28 },
    },
    {
      id: 'failover-target',
      position: { lat: 45.5, lng: -122.7 },
      label: 'us-west-2 (failover)',
      description: 'Failover target. Traffic rerouting status: unverified.',
      category: 'dr',
      icon: '🔄',
      color: '#6b7280',
    },
  ],
  polylines: [
    {
      id: 'failover-route',
      coordinates: [
        { lat: 38.9, lng: -77.0 },
        { lat: 45.5, lng: -122.7 },
      ],
      label: 'Failover traffic route (assumed)',
      color: '#6b7280',
    },
  ],
  layers: [
    { id: 'markers', label: 'Locations', visible: true },
    { id: 'polylines', label: 'Traffic Routes', visible: true },
  ],
});

// ─────────────────────────────────────────────────────────────────────────────
// Meta
// ─────────────────────────────────────────────────────────────────────────────

const meta: Meta<typeof MapRenderer> = {
  title: 'Renderers/MapRenderer',
  component: MapRenderer,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Renders geographic/spatial data as an interactive SVG map with OpenStreetMap tile background. ' +
          'Supports markers, polygons, polylines, circles, and heatmap overlays. ' +
          'Executive: simplified pins. Operator: labels and popups. Expert: coordinates, layer controls.',
      },
    },
  },
};
export default meta;

type Story = StoryObj<typeof MapRenderer>;

// ── Default ───────────────────────────────────────────────────────────────────

export const Default: Story = {
  name: 'Default',
  args: {
    data: DATACENTER_MAP,
    density: 'operator',
  },
  parameters: {
    docs: {
      description: {
        story: 'Global data centre map at operator density. Markers colour-coded by role (primary vs DR).',
      },
    },
  },
};

// ── High Uncertainty ──────────────────────────────────────────────────────────

export const HighUncertainty: Story = {
  name: 'High Uncertainty',
  render: (args) => (
    <div>
      <UncertaintyBanner
        confidence={0.33}
        unknowns={[
          'Customer cluster impact is estimated — no live telemetry',
          'Failover traffic reroute status unverified',
          'Exact blast radius boundary not measurable without CDN data',
        ]}
      />
      <MapRenderer {...args} />
    </div>
  ),
  args: {
    data: INCIDENT_MAP,
    density: 'operator',
  },
  parameters: {
    docs: {
      description: {
        story:
          'Confidence 33% — incident blast radius estimated from partial signals. ' +
          '⚠ markers (amber) indicate estimated/inferred impact zones. ' +
          'Grey items (failover route) have unknown status. ' +
          'HARI requires the uncertainty banner when confidence < 50%.',
      },
    },
  },
};

// ── Expired ───────────────────────────────────────────────────────────────────

export const Expired: Story = {
  name: 'Expired',
  render: (args) => (
    <div style={{ opacity: 0.55, filter: 'grayscale(0.5)' }}>
      <ExpiredBanner />
      <MapRenderer {...args} />
    </div>
  ),
  args: {
    data: DATACENTER_MAP,
    density: 'operator',
  },
  parameters: {
    docs: {
      description: {
        story:
          'Expired geospatial view. Data centre health statuses captured at generatedAt may be out of date. ' +
          'HARI time-bounding prevents operators from acting on stale location data.',
      },
    },
  },
};

// ── Density variants ──────────────────────────────────────────────────────────

export const ExecutiveDensity: Story = {
  args: { data: DATACENTER_MAP, density: 'executive' },
};

export const ExpertDensity: Story = {
  args: { data: DATACENTER_MAP, density: 'expert' },
};
