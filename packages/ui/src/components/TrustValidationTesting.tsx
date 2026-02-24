/**
 * Trust & Validation Testing UI Component
 * 
 * Interactive component for demonstrating blast radius comprehension testing,
 * A/B testing, and error recovery patterns.
 */

import React, { useState } from 'react';
import {
  BlastRadiusTestingTracker,
  BLAST_RADIUS_TEST_SCENARIOS,
  ConfirmationDelayABTest,
  ConfidenceScoreCalibrator,
  ErrorRecoveryTracker,
  type BlastRadiusTestScenario,
} from '@hari/core';

interface TestState {
  activeTab: 'blast_radius' | 'ab_testing' | 'confidence' | 'error_recovery';
  blastRadiusTracker: BlastRadiusTestingTracker;
  abTestTracker: ConfirmationDelayABTest;
  confidenceCalibrator: ConfidenceScoreCalibrator;
  errorRecoveryTracker: ErrorRecoveryTracker;
}

export const TrustValidationTesting: React.FC = () => {
  const [state, setStateValue] = useState<TestState>({
    activeTab: 'blast_radius',
    blastRadiusTracker: new BlastRadiusTestingTracker(),
    abTestTracker: new ConfirmationDelayABTest(),
    confidenceCalibrator: new ConfidenceScoreCalibrator(),
    errorRecoveryTracker: new ErrorRecoveryTracker(),
  });

  const [selectedScenario, setSelectedScenario] = useState<BlastRadiusTestScenario | null>(
    BLAST_RADIUS_TEST_SCENARIOS[0] || null
  );

  const recordBlastRadiusTest = () => {
    if (!selectedScenario) return;

    state.blastRadiusTracker.recordComprehension({
      testId: `br_test_${Date.now()}`,
      blastRadiusScope: selectedScenario.scope,
      affectedSystemsCount: selectedScenario.affectedSystems.length,
      timeToUnderstandMs: Math.floor(Math.random() * 10000),
      confidenceScore: Math.random(),
      userAskedFollowUp: Math.random() > 0.7,
      correctlyIdentifiedSystems: Math.floor(Math.random() * selectedScenario.affectedSystems.length),
      totalSystemsPresented: selectedScenario.affectedSystems.length,
      actionTaken: Math.random() > 0.3 ? 'confirm' : 'cancel',
    });

    setStateValue({ ...state });
  };

  const recordABTest = () => {
    const variant = state.abTestTracker.assignVariant(`user_${Date.now()}`);

    state.abTestTracker.recordMetric({
      userId: `user_${Date.now()}`,
      testId: `ab_test_${Date.now()}`,
      variant: variant.id,
      confirmationDelayMs: variant.confirmationDelayMs,
      timeToConfirmMs: Math.floor(Math.random() * 5000 + variant.confirmationDelayMs),
      userConfirmed: Math.random() > 0.2,
      actionId: `action_${Date.now()}`,
      blastRadiusScope: 'org',
      riskLevel: 'high',
      abortedDueToTimeout: false,
    });

    setStateValue({ ...state });
  };

  const recordConfidenceTest = () => {
    state.confidenceCalibrator.recordOutcome({
      testId: `conf_test_${Date.now()}`,
      agentConfidence: Math.random(),
      actualOutcome: Math.random() > 0.3,
      intentType: ['deploy', 'provision', 'config'][Math.floor(Math.random() * 3)],
    });

    setStateValue({ ...state });
  };

  const recordErrorRecovery = () => {
    const errorTypes: Array<'validation' | 'network' | 'timeout' | 'execution' | 'permission' | 'other'> = ['validation', 'network', 'timeout'];
    const strategies: Array<'retry' | 'modify_and_retry' | 'ask_for_help' | 'cancel' | 'escalate' | 'fallback_action'> = ['retry', 'modify_and_retry', 'ask_for_help'];
    const errorId = `err_${Date.now()}`;
    state.errorRecoveryTracker.recordError({
      errorId,
      errorType: errorTypes[Math.floor(Math.random() * 3)] as any,
      message: 'Test error',
      severity: 'high',
    });

    state.errorRecoveryTracker.recordRecoveryAttempt({
      errorId,
      strategy: strategies[Math.floor(Math.random() * 3)] as any,
      timeToRecoveryMs: Math.floor(Math.random() * 10000),
      wasSuccessful: Math.random() > 0.3,
      userConfidenceAfter: Math.random(),
    });

    setStateValue({ ...state });
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <h1>Trust & Validation Testing Framework</h1>

      <div style={{ marginBottom: '20px', borderBottom: '1px solid #ccc', paddingBottom: '20px' }}>
        <h2>Blast Radius Comprehension Testing</h2>
        {selectedScenario && (
          <div style={{ marginBottom: '15px', padding: '15px', backgroundColor: '#f5f5f5', borderRadius: '8px' }}>
            <h3>{selectedScenario.title}</h3>
            <p>{selectedScenario.description}</p>
            <p><strong>Scope:</strong> {selectedScenario.scope}</p>
            <p><strong>Systems:</strong> {selectedScenario.affectedSystems.join(', ')}</p>
            <button
              onClick={recordBlastRadiusTest}
              style={{
                padding: '8px 16px',
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              Record Test Result
            </button>
          </div>
        )}
        <select
          value={selectedScenario?.id || ''}
          onChange={(e) => {
            const found = BLAST_RADIUS_TEST_SCENARIOS.find((s) => s.id === e.target.value);
            setSelectedScenario(found || null);
          }}
          style={{ padding: '8px', borderRadius: '4px', marginTop: '10px' }}
        >
          {BLAST_RADIUS_TEST_SCENARIOS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title}
            </option>
          ))}
        </select>

        {state.blastRadiusTracker.getMetrics().length > 0 && (
          <div style={{ marginTop: '15px' }}>
            <h4>Results:</h4>
            <pre style={{ backgroundColor: '#f0f0f0', padding: '10px', borderRadius: '4px', overflow: 'auto' }}>
              {JSON.stringify(state.blastRadiusTracker.getSummary(), null, 2)}
            </pre>
          </div>
        )}
      </div>

      <div style={{ marginBottom: '20px', borderBottom: '1px solid #ccc', paddingBottom: '20px' }}>
        <h2>A/B Testing: Confirmation Delays</h2>
        <button
          onClick={recordABTest}
          style={{
            padding: '8px 16px',
            backgroundColor: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Record A/B Test
        </button>

        {state.abTestTracker.getResults().length > 0 && (
          <div style={{ marginTop: '15px' }}>
            <h4>Results:</h4>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #ddd' }}>
                  <th style={{ padding: '10px', textAlign: 'left' }}>Variant</th>
                  <th style={{ padding: '10px', textAlign: 'left' }}>Count</th>
                  <th style={{ padding: '10px', textAlign: 'left' }}>Confirmation Rate</th>
                  <th style={{ padding: '10px', textAlign: 'left' }}>Avg Time (ms)</th>
                </tr>
              </thead>
              <tbody>
                {state.abTestTracker.getResults().map((r) => (
                  <tr key={r.variant} style={{ borderBottom: '1px solid #ddd' }}>
                    <td style={{ padding: '10px' }}>{r.name}</td>
                    <td style={{ padding: '10px' }}>{r.count}</td>
                    <td style={{ padding: '10px' }}>{(r.confirmationRate * 100).toFixed(1)}%</td>
                    <td style={{ padding: '10px' }}>{r.avgConfirmationTimeMs.toFixed(0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={{ marginBottom: '20px', borderBottom: '1px solid #ccc', paddingBottom: '20px' }}>
        <h2>Confidence Score Calibration</h2>
        <button
          onClick={recordConfidenceTest}
          style={{
            padding: '8px 16px',
            backgroundColor: '#ffc107',
            color: 'black',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Record Calibration Test
        </button>

        {state.confidenceCalibrator.getRecords().length > 0 && (
          <div style={{ marginTop: '15px' }}>
            <h4>Summary:</h4>
            <div style={{ backgroundColor: '#f9f9f9', padding: '10px', borderRadius: '4px' }}>
              <p>
                <strong>Total Records:</strong> {state.confidenceCalibrator.getRecords().length}
              </p>
              <p>
                <strong>ECE:</strong> {state.confidenceCalibrator.calculateECE().toFixed(3)}
              </p>
              <p>
                <strong>Brier Score:</strong> {state.confidenceCalibrator.calculateBrierScore().toFixed(3)}
              </p>
            </div>
          </div>
        )}
      </div>

      <div style={{ marginBottom: '20px' }}>
        <h2>Error Recovery Tracking</h2>
        <button
          onClick={recordErrorRecovery}
          style={{
            padding: '8px 16px',
            backgroundColor: '#dc3545',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Record Error & Recovery
        </button>

        {state.errorRecoveryTracker.getErrors().length > 0 && (
          <div style={{ marginTop: '15px' }}>
            <h4>Summary:</h4>
            <div style={{ backgroundColor: '#fff3cd', padding: '10px', borderRadius: '4px' }}>
              <p>
                <strong>Total Errors:</strong> {state.errorRecoveryTracker.getErrors().length}
              </p>
              <p>
                <strong>Overall Recovery Rate:</strong>{' '}
                {(state.errorRecoveryTracker.getSummary().overallRecoveryRate * 100).toFixed(1)}%
              </p>
              <p>
                <strong>Avg Confidence After Recovery:</strong>{' '}
                {state.errorRecoveryTracker.getSummary().averageConfidenceAfterRecovery.toFixed(2)}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
