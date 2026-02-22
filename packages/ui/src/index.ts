// Core UI components
export { IntentRenderer } from './components/IntentRenderer';
export { BlastRadiusBadge } from './components/BlastRadiusBadge';
export { ExplainPanel } from './components/ExplainPanel';
export { AmbiguityControls } from './components/AmbiguityControls';
export { DensitySelector } from './components/primitives/DensitySelector';

// Domain components — travel
export {
  FlightCardExecutive,
  FlightCardOperator,
  FlightCardExpert,
} from './components/domain/travel/FlightCard';
export type { FlightOption } from './components/domain/travel/FlightCard';

// Domain components — cloudops
export { MetricCard } from './components/domain/cloudops/MetricCard';
export type { MetricData } from './components/domain/cloudops/MetricCard';
