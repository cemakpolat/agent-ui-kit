/**
 * Confidence Score Calibration
 * 
 * Measures how well the agent's confidence scores align with actual outcomes.
 * Lower calibration error = better confidence estimates.
 * 
 * Metrics:
 * - ECE (Expected Calibration Error): measures deviation between confidence and accuracy
 * - Brier Score: mean squared difference between predictions and outcomes
 * - Area Under ROC: discrimination ability
 */

export interface ConfidenceCalibrationRecord {
  testId: string;
  timestamp: number;
  agentConfidence: number; // 0-1
  actualOutcome: boolean; // true = success, false = failure
  domain?: string;
  intentType?: string;
  actionRiskLevel?: string;
}

export interface CalibrationBucket {
  confidenceRange: [number, number]; // e.g. [0.7, 0.8]
  predictedConfidence: number; // midpoint of range
  accuracy: number; // actual success rate in this range
  count: number;
  calibrationError: number; // |predicted - actual|
}

export class ConfidenceScoreCalibrator {
  private records: ConfidenceCalibrationRecord[] = [];
  private sessionId: string;

  constructor(sessionId?: string) {
    this.sessionId = sessionId || `session_${Date.now()}`;
  }

  recordOutcome(record: Omit<ConfidenceCalibrationRecord, 'timestamp'>) {
    const fullRecord: ConfidenceCalibrationRecord = {
      ...record,
      timestamp: Date.now(),
    };
    this.records.push(fullRecord);
    return fullRecord;
  }

  /**
   * Expected Calibration Error (ECE)
   * Measures the gap between predicted confidence and observed accuracy
   * Range: 0 (perfect) to 1 (worst)
   */
  calculateECE(buckets: number = 10): number {
    if (this.records.length === 0) return 0;

    const calibrationBuckets = this.createCalibrationBuckets(buckets);
    const totalCount = this.records.length;

    const ece = calibrationBuckets.reduce((sum, bucket) => {
      return sum + (bucket.count / totalCount) * bucket.calibrationError;
    }, 0);

    return ece;
  }

  /**
   * Brier Score
   * Mean squared error between confidence predictions and binary outcomes
   * Range: 0 (perfect) to 1 (worst)
   */
  calculateBrierScore(): number {
    if (this.records.length === 0) return 0;

    const mse = this.records.reduce((sum, record) => {
      const outcome = record.actualOutcome ? 1 : 0;
      return sum + Math.pow(record.agentConfidence - outcome, 2);
    }, 0);

    return mse / this.records.length;
  }

  /**
   * Accuracy at different confidence thresholds
   * Helps identify where the model is overconfident or underconfident
   */
  getAccuracyByConfidenceThreshold(): Array<{ threshold: number; accuracy: number }> {
    if (this.records.length === 0) return [];

    return [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0].map(threshold => {
      const filtered = this.records.filter(r => r.agentConfidence >= threshold);
      if (filtered.length === 0) {
        return { threshold, accuracy: 0 };
      }
      const correct = filtered.filter(r => r.actualOutcome).length;
      return { threshold, accuracy: correct / filtered.length };
    });
  }

  /**
   * Identify domains/intent types with poorest calibration
   */
  getWorstCalibratedIntentTypes(): Array<{
    domain?: string;
    intentType?: string;
    count: number;
    avgConfidence: number;
    successRate: number;
    calibrationError: number;
  }> {
    const grouped = new Map<string, ConfidenceCalibrationRecord[]>();

    for (const record of this.records) {
      const key = `${record.domain || '?'}::${record.intentType || '?'}`;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(record);
    }

    return Array.from(grouped.entries())
      .map(([key, records]) => {
        const [domain, intentType] = key.split('::');
        const avgConfidence = records.reduce((sum, r) => sum + r.agentConfidence, 0) / records.length;
        const successRate = records.filter(r => r.actualOutcome).length / records.length;
        return {
          domain: domain === '?' ? undefined : domain,
          intentType: intentType === '?' ? undefined : intentType,
          count: records.length,
          avgConfidence,
          successRate,
          calibrationError: Math.abs(avgConfidence - successRate),
        };
      })
      .sort((a, b) => b.calibrationError - a.calibrationError)
      .slice(0, 10);
  }

  private createCalibrationBuckets(numBuckets: number): CalibrationBucket[] {
    const buckets: CalibrationBucket[] = [];
    const bucketSize = 1 / numBuckets;

    for (let i = 0; i < numBuckets; i++) {
      const lower = i * bucketSize;
      const upper = (i + 1) * bucketSize;

      const bucketed = this.records.filter(
        r => r.agentConfidence >= lower && r.agentConfidence < upper
      );

      if (bucketed.length === 0) {
        continue;
      }

      const predictedConfidence = (lower + upper) / 2;
      const successCount = bucketed.filter(r => r.actualOutcome).length;
      const accuracy = successCount / bucketed.length;

      buckets.push({
        confidenceRange: [lower, upper],
        predictedConfidence,
        accuracy,
        count: bucketed.length,
        calibrationError: Math.abs(predictedConfidence - accuracy),
      });
    }

    return buckets;
  }

  getSummary() {
    return {
      sessionId: this.sessionId,
      totalRecords: this.records.length,
      overallSuccessRate: this.records.filter(r => r.actualOutcome).length / (this.records.length || 1),
      averageConfidence: this.records.reduce((sum, r) => sum + r.agentConfidence, 0) / (this.records.length || 1),
      expectedCalibrationError: this.calculateECE(),
      brierScore: this.calculateBrierScore(),
      accuracyByThreshold: this.getAccuracyByConfidenceThreshold(),
      worstCalibratedIntents: this.getWorstCalibratedIntentTypes(),
    };
  }

  getRecords(): ConfidenceCalibrationRecord[] {
    return [...this.records];
  }

  exportJSON(): string {
    return JSON.stringify({
      sessionId: this.sessionId,
      records: this.records,
      summary: this.getSummary(),
    }, null, 2);
  }
}
