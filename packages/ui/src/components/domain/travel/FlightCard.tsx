import React from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// Flight Cards — density-aware travel domain components
//
// Executive: price + duration + airline chip (decision at a glance)
// Operator:  full row with depart/arrive times, stops, carbon
// Expert:    all of operator + raw fare codes + confidence score
// ─────────────────────────────────────────────────────────────────────────────

export interface FlightOption {
  id: string;
  airline: string;
  flightNumber?: string;
  price: number;
  currency?: string;
  duration: string;
  departTime: string;
  arriveTime: string;
  stops: number;
  carbon?: number; // kg CO₂
  fareClass?: string;
  confidence?: number;
  note?: string; // e.g. "20% below route average"
}

interface FlightCardProps {
  flight: FlightOption;
  selected?: boolean;
  onSelect?: (id: string) => void;
  onExplain?: (id: string) => void;
}

// ── Executive ────────────────────────────────────────────────────────────────

export function FlightCardExecutive({ flight, selected, onSelect, onExplain }: FlightCardProps) {
  return (
    <div
      onClick={() => onSelect?.(flight.id)}
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '0.75rem 1rem',
        border: `2px solid ${selected ? '#4f46e5' : '#e2e8f0'}`,
        borderRadius: '0.5rem',
        backgroundColor: selected ? '#eef2ff' : 'white',
        cursor: onSelect ? 'pointer' : 'default',
        transition: 'all 0.15s',
      }}
    >
      <span style={{ fontWeight: 700, fontSize: '1.25rem', color: '#1e293b' }}>
        {flight.currency ?? '$'}{flight.price.toLocaleString()}
      </span>
      <span style={{ color: '#64748b', fontWeight: 500 }}>{flight.duration}</span>
      <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{flight.airline}</span>
      {onExplain && (
        <button
          onClick={(e) => { e.stopPropagation(); onExplain(flight.id); }}
          style={whyButtonStyle}
          title="Why this flight?"
        >
          Why?
        </button>
      )}
    </div>
  );
}

// ── Operator ─────────────────────────────────────────────────────────────────

export function FlightCardOperator({ flight, selected, onSelect, onExplain }: FlightCardProps) {
  return (
    <div
      onClick={() => onSelect?.(flight.id)}
      style={{
        padding: '1rem 1.25rem',
        border: `2px solid ${selected ? '#4f46e5' : '#e2e8f0'}`,
        borderRadius: '0.75rem',
        backgroundColor: selected ? '#eef2ff' : 'white',
        cursor: onSelect ? 'pointer' : 'default',
        transition: 'all 0.15s',
      }}
    >
      {/* Row 1: price + airline */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.375rem' }}>
        <span style={{ fontWeight: 700, fontSize: '1.375rem', color: '#1e293b' }}>
          {flight.currency ?? '$'}{flight.price.toLocaleString()}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontWeight: 600, color: '#475569' }}>{flight.airline}</span>
          {onExplain && (
            <button
              onClick={(e) => { e.stopPropagation(); onExplain(flight.id); }}
              style={whyButtonStyle}
            >
              Why?
            </button>
          )}
        </div>
      </div>

      {/* Row 2: times + duration + stops */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          color: '#64748b',
          fontSize: '0.875rem',
        }}
      >
        <span style={{ fontWeight: 500 }}>
          {flight.departTime} → {flight.arriveTime}
        </span>
        <span>{flight.duration}</span>
        <span>{flight.stops === 0 ? 'Nonstop' : `${flight.stops} stop${flight.stops > 1 ? 's' : ''}`}</span>
      </div>

      {/* Row 3: carbon + note */}
      <div style={{ display: 'flex', gap: '1rem', marginTop: '0.375rem', fontSize: '0.75rem' }}>
        {flight.carbon != null && (
          <span style={{ color: '#059669' }}>🌿 {flight.carbon} kg CO₂</span>
        )}
        {flight.note && (
          <span style={{ color: '#7c3aed', fontWeight: 600 }}>{flight.note}</span>
        )}
      </div>
    </div>
  );
}

// ── Expert ────────────────────────────────────────────────────────────────────

export function FlightCardExpert({ flight, selected, onSelect, onExplain }: FlightCardProps) {
  return (
    <div
      onClick={() => onSelect?.(flight.id)}
      style={{
        padding: '1rem 1.25rem',
        border: `2px solid ${selected ? '#4f46e5' : '#e2e8f0'}`,
        borderRadius: '0.75rem',
        backgroundColor: selected ? '#eef2ff' : 'white',
        cursor: onSelect ? 'pointer' : 'default',
        fontFamily: 'monospace',
        fontSize: '0.8rem',
      }}
    >
      <FlightCardOperator flight={flight} selected={selected} onSelect={onSelect} onExplain={onExplain} />
      <div
        style={{
          marginTop: '0.5rem',
          paddingTop: '0.5rem',
          borderTop: '1px dashed #e2e8f0',
          color: '#94a3b8',
          display: 'flex',
          gap: '1.5rem',
        }}
      >
        {flight.flightNumber && <span>Flight: {flight.flightNumber}</span>}
        {flight.fareClass && <span>Fare class: {flight.fareClass}</span>}
        {flight.confidence != null && (
          <span>Agent confidence: {(flight.confidence * 100).toFixed(0)}%</span>
        )}
      </div>
    </div>
  );
}

const whyButtonStyle: React.CSSProperties = {
  padding: '0.15rem 0.5rem',
  borderRadius: '0.25rem',
  border: '1px solid #c7d2fe',
  backgroundColor: '#eef2ff',
  color: '#4338ca',
  fontSize: '0.7rem',
  fontWeight: 600,
  cursor: 'pointer',
};
