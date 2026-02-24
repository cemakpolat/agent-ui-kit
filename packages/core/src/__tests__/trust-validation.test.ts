/**
 * Tests for Trust & Validation Framework
 */

import { describe, it, expect } from 'vitest';
import {
  BlastRadiusTestingTracker,
  BLAST_RADIUS_TEST_SCENARIOS,
  ConfirmationDelayABTest,
  ConfidenceScoreCalibrator,
  ErrorRecoveryTracker,
} from '../validation';

// ─────────────────────────────────────────────────────────────────────────────
// Blast Radius Testing
// ─────────────────────────────────────────────────────────────────────────────

describe('BlastRadiusTestingTracker', () => {
  it('should record comprehension metrics', () => {
    const tracker = new BlastRadiusTestingTracker('test_session');

    tracker.recordComprehension({
      testId: 'test_1',
      blastRadiusScope: 'team',
      affectedSystemsCount: 3,
      timeToUnderstandMs: 5000,
      confidenceScore: 0.8,
      userAskedFollowUp: false,
      correctlyIdentifiedSystems: 3,
      totalSystemsPresented: 3,
      actionTaken: 'confirm',
    });

    const metrics = tracker.getMetrics();
    expect(metrics).toHaveLength(1);
    expect(metrics[0].blastRadiusScope).toBe('team');
  });

  it('should calculate average comprehension time by scope', () => {
    const tracker = new BlastRadiusTestingTracker();

    tracker.recordComprehension({
      testId: 'test_1',
      blastRadiusScope: 'self',
      affectedSystemsCount: 1,
      timeToUnderstandMs: 1000,
      confidenceScore: 0.9,
      userAskedFollowUp: false,
      correctlyIdentifiedSystems: 1,
      totalSystemsPresented: 1,
      actionTaken: 'confirm',
    });

    tracker.recordComprehension({
      testId: 'test_2',
      blastRadiusScope: 'self',
      affectedSystemsCount: 1,
      timeToUnderstandMs: 3000,
      confidenceScore: 0.7,
      userAskedFollowUp: false,
      correctlyIdentifiedSystems: 1,
      totalSystemsPresented: 1,
      actionTaken: 'confirm',
    });

    const avgTime = tracker.getAverageComprehensionTime('self');
    expect(avgTime).toBe(2000);
  });

  it('should calculate accuracy rate', () => {
    const tracker = new BlastRadiusTestingTracker();

    tracker.recordComprehension({
      testId: 'test_1',
      blastRadiusScope: 'team',
      affectedSystemsCount: 3,
      timeToUnderstandMs: 5000,
      confidenceScore: 0.8,
      userAskedFollowUp: false,
      correctlyIdentifiedSystems: 3,
      totalSystemsPresented: 3,
      actionTaken: 'confirm',
    });

    tracker.recordComprehension({
      testId: 'test_2',
      blastRadiusScope: 'team',
      affectedSystemsCount: 3,
      timeToUnderstandMs: 4000,
      confidenceScore: 0.6,
      userAskedFollowUp: false,
      correctlyIdentifiedSystems: 2,
      totalSystemsPresented: 3,
      actionTaken: 'confirm',
    });

    const accuracy = tracker.getAccuracyRate('team');
    expect(accuracy).toBe(0.5); // 1 correct out of 2
  });

  it('should calculate follow-up question rate', () => {
    const tracker = new BlastRadiusTestingTracker();

    tracker.recordComprehension({
      testId: 'test_1',
      blastRadiusScope: 'team',
      affectedSystemsCount: 3,
      timeToUnderstandMs: 5000,
      confidenceScore: 0.8,
      userAskedFollowUp: true,
      correctlyIdentifiedSystems: 3,
      totalSystemsPresented: 3,
      actionTaken: 'confirm',
    });

    tracker.recordComprehension({
      testId: 'test_2',
      blastRadiusScope: 'team',
      affectedSystemsCount: 3,
      timeToUnderstandMs: 4000,
      confidenceScore: 0.6,
      userAskedFollowUp: false,
      correctlyIdentifiedSystems: 2,
      totalSystemsPresented: 3,
      actionTaken: 'confirm',
    });

    const rate = tracker.getFollowUpQuestionRate();
    expect(rate).toBe(0.5);
  });

  it('should generate summary', () => {
    const tracker = new BlastRadiusTestingTracker('test_session');

    tracker.recordComprehension({
      testId: 'test_1',
      blastRadiusScope: 'self',
      affectedSystemsCount: 1,
      timeToUnderstandMs: 2000,
      confidenceScore: 0.85,
      userAskedFollowUp: false,
      correctlyIdentifiedSystems: 1,
      totalSystemsPresented: 1,
      actionTaken: 'confirm',
    });

    const summary = tracker.getSummary();
    expect(summary.sessionId).toBe('test_session');
    expect(summary.totalTests).toBe(1);
    expect(summary.overallAccuracy).toBe(1);
  });

  it('should export to JSON', () => {
    const tracker = new BlastRadiusTestingTracker();
    tracker.recordComprehension({
      testId: 'test_1',
      blastRadiusScope: 'self',
      affectedSystemsCount: 1,
      timeToUnderstandMs: 2000,
      confidenceScore: 0.85,
      userAskedFollowUp: false,
      correctlyIdentifiedSystems: 1,
      totalSystemsPresented: 1,
      actionTaken: 'confirm',
    });

    const json = tracker.exportJSON();
    const parsed = JSON.parse(json);
    expect(parsed.metrics).toHaveLength(1);
    expect(parsed.summary).toBeDefined();
  });

  it('should have predefined test scenarios', () => {
    expect(BLAST_RADIUS_TEST_SCENARIOS.length).toBeGreaterThan(0);
    expect(BLAST_RADIUS_TEST_SCENARIOS[0]).toHaveProperty('id');
    expect(BLAST_RADIUS_TEST_SCENARIOS[0]).toHaveProperty('scope');
    expect(BLAST_RADIUS_TEST_SCENARIOS[0]).toHaveProperty('affectedSystems');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// A/B Testing Framework
// ─────────────────────────────────────────────────────────────────────────────

describe('ConfirmationDelayABTest', () => {
  it('should assign variants consistently', () => {
    const test = new ConfirmationDelayABTest();
    const variant1 = test.assignVariant('user_1');
    const variant2 = test.assignVariant('user_1');

    expect(variant1.id).toBe(variant2.id);
  });

  it('should distribute variants across users', () => {
    const test = new ConfirmationDelayABTest();
    const variants = new Map<string, number>();

    for (let i = 0; i < 400; i++) {
      const variant = test.assignVariant(`user_${i}`);
      variants.set(variant.id, (variants.get(variant.id) || 0) + 1);
    }

    // Each variant should get roughly 25% (with some variance)
    for (const count of variants.values()) {
      expect(count).toBeGreaterThan(50);
      expect(count).toBeLessThan(150);
    }
  });

  it('should record metrics', () => {
    const test = new ConfirmationDelayABTest();
    test.recordMetric({
      userId: 'user_1',
      testId: 'test_1',
      variant: 'variant_no_delay',
      confirmationDelayMs: 0,
      timeToConfirmMs: 500,
      userConfirmed: true,
      actionId: 'action_1',
      blastRadiusScope: 'team',
      riskLevel: 'high',
      abortedDueToTimeout: false,
    });

    const results = test.getResults();
    expect(results.length).toBeGreaterThan(0);
  });

  it('should calculate confirmation rates', () => {
    const test = new ConfirmationDelayABTest();

    test.recordMetric({
      userId: 'user_1',
      testId: 'test_1',
      variant: 'variant_short_delay',
      confirmationDelayMs: 500,
      timeToConfirmMs: 600,
      userConfirmed: true,
      actionId: 'action_1',
      blastRadiusScope: 'team',
      riskLevel: 'high',
      abortedDueToTimeout: false,
    });

    test.recordMetric({
      userId: 'user_2',
      testId: 'test_2',
      variant: 'variant_short_delay',
      confirmationDelayMs: 500,
      timeToConfirmMs: 100,
      userConfirmed: false,
      actionId: 'action_2',
      blastRadiusScope: 'team',
      riskLevel: 'high',
      abortedDueToTimeout: false,
    });

    const rate = test.getConfirmationRate('variant_short_delay');
    expect(rate).toBe(0.5);
  });

  it('should identify winning variant', () => {
    const test = new ConfirmationDelayABTest();

    // No delay variant has high confirmation rate
    test.recordMetric({
      userId: 'user_1',
      testId: 'test_1',
      variant: 'variant_no_delay',
      confirmationDelayMs: 0,
      timeToConfirmMs: 200,
      userConfirmed: true,
      actionId: 'action_1',
      blastRadiusScope: 'org',
      riskLevel: 'critical',
      abortedDueToTimeout: false,
    });

    test.recordMetric({
      userId: 'user_2',
      testId: 'test_2',
      variant: 'variant_long_delay',
      confirmationDelayMs: 3000,
      timeToConfirmMs: 3500,
      userConfirmed: false,
      actionId: 'action_2',
      blastRadiusScope: 'org',
      riskLevel: 'critical',
      abortedDueToTimeout: false,
    });

    const winner = test.getWinningVariant();
    expect(winner).toBeDefined();
    expect(winner?.confirmationDelayMs).toBe(0);
  });

  it('should export to JSON', () => {
    const test = new ConfirmationDelayABTest();
    test.recordMetric({
      userId: 'user_1',
      testId: 'test_1',
      variant: 'variant_no_delay',
      confirmationDelayMs: 0,
      timeToConfirmMs: 200,
      userConfirmed: true,
      actionId: 'action_1',
      blastRadiusScope: 'team',
      riskLevel: 'high',
      abortedDueToTimeout: false,
    });

    const json = test.exportJSON();
    const parsed = JSON.parse(json);
    expect(parsed.metrics).toHaveLength(1);
    expect(parsed.results).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Confidence Score Calibration
// ─────────────────────────────────────────────────────────────────────────────

describe('ConfidenceScoreCalibrator', () => {
  it('should record outcomes', () => {
    const calibrator = new ConfidenceScoreCalibrator();
    calibrator.recordOutcome({
      testId: 'test_1',
      agentConfidence: 0.9,
      actualOutcome: true,
    });

    const records = calibrator.getRecords();
    expect(records).toHaveLength(1);
    expect(records[0].agentConfidence).toBe(0.9);
  });

  it('should calculate ECE (Expected Calibration Error)', () => {
    const calibrator = new ConfidenceScoreCalibrator();

    // Perfect calibration: 0.9 confidence with 90% success rate
    for (let i = 0; i < 10; i++) {
      calibrator.recordOutcome({
        testId: `test_${i}`,
        agentConfidence: 0.9,
        actualOutcome: i < 9, // 9 successes, 1 failure
      });
    }

    const ece = calibrator.calculateECE();
    expect(ece).toBeLessThan(0.2); // Should be small for well-calibrated predictions
  });

  it('should calculate Brier Score', () => {
    const calibrator = new ConfidenceScoreCalibrator();

    calibrator.recordOutcome({
      testId: 'test_1',
      agentConfidence: 1.0,
      actualOutcome: true, // Perfect prediction
    });

    const score = calibrator.calculateBrierScore();
    expect(score).toBe(0); // Perfect predictions = 0 Brier score
  });

  it('should calculate accuracy by confidence threshold', () => {
    const calibrator = new ConfidenceScoreCalibrator();

    // High confidence: all successful
    for (let i = 0; i < 5; i++) {
      calibrator.recordOutcome({
        testId: `high_${i}`,
        agentConfidence: 0.95,
        actualOutcome: true,
      });
    }

    // Low confidence: some failures
    calibrator.recordOutcome({
      testId: 'low_1',
      agentConfidence: 0.3,
      actualOutcome: false,
    });

    const thresholds = calibrator.getAccuracyByConfidenceThreshold();
    const high = thresholds.find(t => t.threshold === 0.9);
    const low = thresholds.find(t => t.threshold === 0.3);

    expect(high?.accuracy).toBeGreaterThan(0.8);
  });

  it('should identify poorly calibrated intent types', () => {
    const calibrator = new ConfidenceScoreCalibrator();

    // Deploy intent is overconfident
    calibrator.recordOutcome({
      testId: 'deploy_1',
      agentConfidence: 0.9,
      actualOutcome: false, // Failed
      intentType: 'deploy',
    });

    calibrator.recordOutcome({
      testId: 'deploy_2',
      agentConfidence: 0.9,
      actualOutcome: false, // Failed
      intentType: 'deploy',
    });

    const worst = calibrator.getWorstCalibratedIntentTypes();
    expect(worst.length).toBeGreaterThan(0);
    expect(worst[0].calibrationError).toBeGreaterThan(0);
  });

  it('should generate summary', () => {
    const calibrator = new ConfidenceScoreCalibrator('test_session');
    calibrator.recordOutcome({
      testId: 'test_1',
      agentConfidence: 0.8,
      actualOutcome: true,
    });

    const summary = calibrator.getSummary();
    expect(summary.sessionId).toBe('test_session');
    expect(summary.totalRecords).toBe(1);
    expect(summary.overallSuccessRate).toBe(1);
  });

  it('should export to JSON', () => {
    const calibrator = new ConfidenceScoreCalibrator();
    calibrator.recordOutcome({
      testId: 'test_1',
      agentConfidence: 0.8,
      actualOutcome: true,
    });

    const json = calibrator.exportJSON();
    const parsed = JSON.parse(json);
    expect(parsed.records).toHaveLength(1);
    expect(parsed.summary).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Error Recovery Tracking
// ─────────────────────────────────────────────────────────────────────────────

describe('ErrorRecoveryTracker', () => {
  it('should record errors', () => {
    const tracker = new ErrorRecoveryTracker();
    tracker.recordError({
      errorId: 'err_1',
      errorType: 'validation',
      message: 'Invalid deployment config',
      severity: 'high',
    });

    const errors = tracker.getErrors();
    expect(errors).toHaveLength(1);
    expect(errors[0].errorType).toBe('validation');
  });

  it('should record recovery attempts', () => {
    const tracker = new ErrorRecoveryTracker();
    tracker.recordError({
      errorId: 'err_1',
      errorType: 'validation',
      message: 'Invalid config',
      severity: 'high',
    });

    tracker.recordRecoveryAttempt({
      errorId: 'err_1',
      strategy: 'modify_and_retry',
      timeToRecoveryMs: 5000,
      wasSuccessful: true,
      userConfidenceAfter: 0.75,
    });

    const recoveries = tracker.getRecoveries();
    expect(recoveries).toHaveLength(1);
    expect(recoveries[0].strategy).toBe('modify_and_retry');
  });

  it('should calculate recovery rates by error type', () => {
    const tracker = new ErrorRecoveryTracker();

    tracker.recordError({
      errorId: 'err_1',
      errorType: 'network',
      message: 'Connection failed',
      severity: 'medium',
    });

    tracker.recordRecoveryAttempt({
      errorId: 'err_1',
      strategy: 'retry',
      timeToRecoveryMs: 2000,
      wasSuccessful: true,
      userConfidenceAfter: 0.8,
    });

    const pattern = tracker.getRecoveryPattern('network');
    expect(pattern.overallRecoveryRate).toBe(1.0);
  });

  it('should identify best recovery strategy', () => {
    const tracker = new ErrorRecoveryTracker();

    tracker.recordError({
      errorId: 'err_1',
      errorType: 'timeout',
      message: 'Request timeout',
      severity: 'medium',
    });

    tracker.recordRecoveryAttempt({
      errorId: 'err_1',
      strategy: 'retry',
      timeToRecoveryMs: 3000,
      wasSuccessful: true,
      userConfidenceAfter: 0.85,
    });

    const best = tracker.getBestRecoveryStrategy('timeout');
    expect(best).toBe('retry');
  });

  it('should track confidence after recovery', () => {
    const tracker = new ErrorRecoveryTracker();

    tracker.recordError({
      errorId: 'err_1',
      errorType: 'execution',
      message: 'Execution failed',
      severity: 'high',
    });

    tracker.recordRecoveryAttempt({
      errorId: 'err_1',
      strategy: 'ask_for_help',
      timeToRecoveryMs: 10000,
      wasSuccessful: true,
      userConfidenceAfter: 0.6,
    });

    const summary = tracker.getSummary();
    expect(summary.averageConfidenceAfterRecovery).toBe(0.6);
  });

  it('should generate summary', () => {
    const tracker = new ErrorRecoveryTracker('test_session');
    tracker.recordError({
      errorId: 'err_1',
      errorType: 'validation',
      message: 'Invalid config',
      severity: 'high',
    });

    const summary = tracker.getSummary();
    expect(summary.sessionId).toBe('test_session');
    expect(summary.totalErrors).toBe(1);
  });

  it('should export to JSON', () => {
    const tracker = new ErrorRecoveryTracker();
    tracker.recordError({
      errorId: 'err_1',
      errorType: 'validation',
      message: 'Invalid config',
      severity: 'high',
    });

    const json = tracker.exportJSON();
    const parsed = JSON.parse(json);
    expect(parsed.errors).toHaveLength(1);
    expect(parsed.summary).toBeDefined();
  });
});
