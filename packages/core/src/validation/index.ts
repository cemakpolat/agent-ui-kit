/**
 * Trust & Validation Framework
 * 
 * Comprehensive infrastructure for measuring user trust, understanding,
 * and validation of safety mechanisms in HARI.
 */

export * from './blast-radius-testing';
export * from './ab-testing';
export * from './confidence-calibration';
export * from './error-recovery';
export * from './governance';
export * from './dev-warnings';

// Re-export for convenience
export {
  BlastRadiusTestingTracker,
  type BlastRadiusComprehensionMetric,
  type BlastRadiusTestScenario,
  BLAST_RADIUS_TEST_SCENARIOS,
} from './blast-radius-testing';

export {
  ConfirmationDelayABTest,
  type ABTestVariant,
  type ABTestMetric,
  type ConfirmationDelayVariant,
} from './ab-testing';

export {
  ConfidenceScoreCalibrator,
  type ConfidenceCalibrationRecord,
  type CalibrationBucket,
} from './confidence-calibration';

export {
  ErrorRecoveryTracker,
  type ErrorEvent,
  type RecoveryAttempt,
  type RecoveryStrategy,
  type ErrorRecoveryPattern,
} from './error-recovery';
