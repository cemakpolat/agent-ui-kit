import React from 'react';
import { ComponentRegistryManager, GENERIC_DOMAIN, FALLBACK_INTENT } from '@hari/core';
import {
  FlightCardExecutive,
  FlightCardOperator,
  FlightCardExpert,
  MetricCard,
  type FlightOption,
  type MetricData,
} from '@hari/ui';

// ─────────────────────────────────────────────────────────────────────────────
// Application registry
//
// Maps (domain, intentType) pairs to density-aware React components.
// New domains and intent types can be added here without touching the
// compiler or rendering engine.
// ─────────────────────────────────────────────────────────────────────────────

export const registry = new ComponentRegistryManager();

// ── Travel / comparison ───────────────────────────────────────────────────────

interface FlightListProps {
  flights: FlightOption[];
  density: 'executive' | 'operator' | 'expert';
  onExplain?: (id: string) => void;
}

function FlightListExecutive({ flights, onExplain }: FlightListProps) {
  const [selected, setSelected] = React.useState<string | null>(null);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {flights.map((f) => (
        <FlightCardExecutive
          key={f.id}
          flight={f}
          selected={selected === f.id}
          onSelect={setSelected}
          onExplain={onExplain}
        />
      ))}
    </div>
  );
}

function FlightListOperator({ flights, onExplain }: FlightListProps) {
  const [selected, setSelected] = React.useState<string | null>(null);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {flights.map((f) => (
        <FlightCardOperator
          key={f.id}
          flight={f}
          selected={selected === f.id}
          onSelect={setSelected}
          onExplain={onExplain}
        />
      ))}
    </div>
  );
}

function FlightListExpert({ flights, onExplain }: FlightListProps) {
  const [selected, setSelected] = React.useState<string | null>(null);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {flights.map((f) => (
        <FlightCardExpert
          key={f.id}
          flight={f}
          selected={selected === f.id}
          onSelect={setSelected}
          onExplain={onExplain}
        />
      ))}
    </div>
  );
}

registry.register('travel', 'comparison', {
  executive: () => (props: FlightListProps) => <FlightListExecutive {...props} />,
  operator:  () => (props: FlightListProps) => <FlightListOperator {...props} />,
  expert:    () => (props: FlightListProps) => <FlightListExpert {...props} />,
  default:   () => (props: FlightListProps) => <FlightListOperator {...props} />,
});

// ── CloudOps / diagnostic_overview ───────────────────────────────────────────

interface MetricGridProps {
  metrics: MetricData[];
  density: 'executive' | 'operator' | 'expert';
  onExplain?: (id: string) => void;
}

function MetricGrid({ metrics, density, onExplain }: MetricGridProps) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
        gap: '0.75rem',
      }}
    >
      {metrics.map((m) => (
        <MetricCard key={m.id} metric={m} density={density} onExplain={onExplain} />
      ))}
    </div>
  );
}

registry.register('cloudops', 'diagnostic_overview', {
  executive: () => (props: MetricGridProps) => <MetricGrid {...props} density="executive" />,
  operator:  () => (props: MetricGridProps) => <MetricGrid {...props} density="operator" />,
  expert:    () => (props: MetricGridProps) => <MetricGrid {...props} density="expert" />,
  default:   () => (props: MetricGridProps) => <MetricGrid {...props} density="operator" />,
});

// ── Generic fallback (already handled by IntentRenderer, but here for doc purposes) ──

registry.register(GENERIC_DOMAIN, FALLBACK_INTENT, {
  default: () => () => null,
});
