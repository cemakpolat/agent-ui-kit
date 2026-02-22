import { v4 as uuid } from 'uuid';
import type { IntentPayloadInput } from '@hari/core';
// ─────────────────────────────────────────────────────────────────────────────
// Travel scenario: "Find me the cheapest London → New York flight"
//
// The agent has 72% confidence — unsure whether the user prioritises price
// or comfort, and whether carbon impact matters.  It surfaces two ambiguity
// controls so the user can clarify inline.
// ─────────────────────────────────────────────────────────────────────────────

export const travelIntent: IntentPayloadInput = {
  version: '1.0.0',
  intentId: uuid(),
  type: 'comparison',
  domain: 'travel',
  primaryGoal: 'Find cheapest London → New York flight within constraints',
  confidence: 0.72,
  density: 'operator',
  explain: true,
  layoutHint: 'cards',
  priorityFields: ['price', 'duration', 'carbon'],

  ambiguities: [
    {
      type: 'range_selector',
      id: 'price_comfort_slider',
      label: 'Price vs Comfort',
      description: 'Should we optimise for the lowest fare or a more comfortable journey?',
      min: 0,
      max: 1,
      step: 0.1,
      value: 0.5,
      minLabel: 'Cheapest',
      maxLabel: 'Comfort',
      parameterKey: 'priorities.priceComfort',
    },
    {
      type: 'toggle',
      id: 'carbon_toggle',
      label: 'Show carbon impact',
      description: 'Display CO₂ emissions alongside price and duration.',
      value: true,
      parameterKey: 'priorityFields.carbon',
    },
    {
      type: 'single_select',
      id: 'stops_filter',
      label: 'Stops',
      options: [
        { value: 'any',      label: 'Any' },
        { value: 'nonstop',  label: 'Nonstop only' },
        { value: 'one_stop', label: 'Max 1 stop' },
      ],
      value: 'any',
      parameterKey: 'filters.stops',
    },
  ],

  data: {
    flights: [
      {
        id: 'f1',
        airline: 'British Airways',
        flightNumber: 'BA177',
        price: 548,
        currency: '$',
        duration: '7h 30m',
        departTime: '09:15',
        arriveTime: '12:45',
        stops: 0,
        carbon: 312,
        fareClass: 'Y',
        confidence: 0.91,
        note: '18% below route average',
      },
      {
        id: 'f2',
        airline: 'Virgin Atlantic',
        flightNumber: 'VS003',
        price: 612,
        currency: '$',
        duration: '7h 45m',
        departTime: '11:00',
        arriveTime: '14:45',
        stops: 0,
        carbon: 298,
        fareClass: 'W',
        confidence: 0.87,
        note: 'Lower carbon than BA',
      },
      {
        id: 'f3',
        airline: 'American Airlines',
        flightNumber: 'AA101',
        price: 489,
        currency: '$',
        duration: '9h 15m',
        departTime: '07:00',
        arriveTime: '16:15',
        stops: 1,
        carbon: 401,
        fareClass: 'L',
        confidence: 0.78,
      },
    ],
  },

  actions: [
    {
      id: 'book',
      label: 'Book Selected Flight',
      variant: 'primary',
      safety: {
        confidence: 0.91,
        reversible: false,
        cost: 548,
        currency: '$',
        riskLevel: 'high',
        requiresConfirmation: true,
        confirmationDelay: 1500,
        explanation: 'This fare expires in 14 minutes. Price is 18% below the 30-day average for this route.',
        blastRadius: {
          scope: 'self',
          affectedSystems: ['payments', 'calendar', 'hotel-booking'],
          downstreamEffects: 'Hotel check-in date will be locked to this flight arrival.',
          estimatedImpact: 'Card charged immediately; no free cancellation after booking.',
        },
      },
    },
    {
      id: 'save',
      label: 'Save to Wishlist',
      variant: 'secondary',
      safety: {
        confidence: 0.99,
        reversible: true,
        riskLevel: 'low',
        requiresConfirmation: false,
      },
    },
    {
      id: 'alert',
      label: 'Set Price Alert',
      variant: 'info',
      safety: {
        confidence: 0.99,
        reversible: true,
        riskLevel: 'low',
        requiresConfirmation: false,
      },
    },
  ],

  explainability: {
    overview: {
      elementId: 'overview',
      summary:
        'Results ranked by price by default, using live fare data from three airline APIs and a 30-day historical baseline. Carbon estimates sourced from ICAO emission factors.',
      dataSources: [
        { name: 'British Airways API',   type: 'api',      freshness: new Date().toISOString(), reliability: 0.98 },
        { name: 'Virgin Atlantic API',   type: 'api',      freshness: new Date().toISOString(), reliability: 0.97 },
        { name: 'Skyscanner MCP',        type: 'mcp',      freshness: new Date().toISOString(), reliability: 0.94 },
        { name: 'ICAO Carbon Factors',   type: 'database', freshness: '2024-01-01T00:00:00Z',  reliability: 0.99 },
      ],
      assumptions: [
        'Economy class, 1 adult passenger',
        'Flexible ±1 day either side of preferred date',
        'No checked baggage included in prices shown',
      ],
      confidenceRange: { low: 0.61, high: 0.84 },
      alternativesConsidered: [
        {
          description: 'Eurostar + transatlantic from Paris CDG',
          reason: 'Total journey time exceeded user constraint of 12 h.',
        },
        {
          description: 'Budget carrier via Iceland',
          reason: 'Layover exceeded 4 hours; comfort score below threshold.',
        },
      ],
      whatIfQueries: [
        'What if I fly 2 days later?',
        'Show greener alternatives',
        'What if price increases 20%?',
      ],
    },
  },
};
