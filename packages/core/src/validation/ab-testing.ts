/**
 * A/B Testing Framework for Confirmation Delays
 * 
 * Tests effectiveness of different confirmation delay times on:
 * - User confirmation rates
 * - Accidental cancellations
 * - Decision confidence
 * - Error recovery success
 */

export type ConfirmationDelayVariant = 0 | 500 | 1500 | 3000;

export interface ABTestVariant {
  id: string;
  name: string;
  description: string;
  confirmationDelayMs: ConfirmationDelayVariant;
  weight: number; // 0-1 for traffic split
}

export interface ABTestMetric {
  userId?: string;
  testId: string;
  timestamp: number;
  variant: string;
  confirmationDelayMs: ConfirmationDelayVariant;
  timeToConfirmMs: number;
  userConfirmed: boolean;
  actionId: string;
  blastRadiusScope: string;
  riskLevel: string;
  abortedDueToTimeout: boolean;
}

export class ConfirmationDelayABTest {
  private variants: ABTestVariant[];
  private metrics: ABTestMetric[] = [];
  private variantAssignments: Map<string, string> = new Map();
  private sessionId: string;

  constructor(sessionId?: string) {
    this.sessionId = sessionId || `session_${Date.now()}`;
    this.variants = this.createDefaultVariants();
  }

  private createDefaultVariants(): ABTestVariant[] {
    return [
      {
        id: 'variant_no_delay',
        name: 'No Delay',
        description: 'Confirm button activates immediately',
        confirmationDelayMs: 0,
        weight: 0.25,
      },
      {
        id: 'variant_short_delay',
        name: 'Short Delay (500ms)',
        description: 'Half-second confirmation delay',
        confirmationDelayMs: 500,
        weight: 0.25,
      },
      {
        id: 'variant_medium_delay',
        name: 'Medium Delay (1.5s)',
        description: 'Default confirmation delay',
        confirmationDelayMs: 1500,
        weight: 0.25,
      },
      {
        id: 'variant_long_delay',
        name: 'Long Delay (3s)',
        description: 'Extended confirmation delay for high-risk actions',
        confirmationDelayMs: 3000,
        weight: 0.25,
      },
    ];
  }

  assignVariant(userId: string): ABTestVariant {
    const cached = this.variantAssignments.get(userId);
    if (cached) {
      return this.variants.find(v => v.id === cached) || this.variants[0];
    }

    const rand = Math.random();
    let cumulative = 0;
    for (const variant of this.variants) {
      cumulative += variant.weight;
      if (rand <= cumulative) {
        this.variantAssignments.set(userId, variant.id);
        return variant;
      }
    }

    return this.variants[0];
  }

  recordMetric(metric: Omit<ABTestMetric, 'timestamp'>) {
    const fullMetric: ABTestMetric = {
      ...metric,
      timestamp: Date.now(),
    };
    this.metrics.push(fullMetric);
    return fullMetric;
  }

  getConfirmationRate(variantId?: string): number {
    const filtered = variantId
      ? this.metrics.filter(m => m.variant === variantId)
      : this.metrics;

    if (filtered.length === 0) return 0;
    const confirmed = filtered.filter(m => m.userConfirmed).length;
    return confirmed / filtered.length;
  }

  getAbortionRate(variantId?: string): number {
    const filtered = variantId
      ? this.metrics.filter(m => m.variant === variantId)
      : this.metrics;

    if (filtered.length === 0) return 0;
    const aborted = filtered.filter(m => m.abortedDueToTimeout).length;
    return aborted / filtered.length;
  }

  getAverageConfirmationTime(variantId?: string): number {
    const filtered = variantId
      ? this.metrics.filter(m => m.variant === variantId)
      : this.metrics;

    if (filtered.length === 0) return 0;
    const total = filtered.reduce((sum, m) => sum + m.timeToConfirmMs, 0);
    return total / filtered.length;
  }

  getResults() {
    return this.variants.map(variant => ({
      variant: variant.id,
      name: variant.name,
      delayMs: variant.confirmationDelayMs,
      count: this.metrics.filter(m => m.variant === variant.id).length,
      confirmationRate: this.getConfirmationRate(variant.id),
      abortionRate: this.getAbortionRate(variant.id),
      avgConfirmationTimeMs: this.getAverageConfirmationTime(variant.id),
      highRiskConfirmationRate: this.getHighRiskConfirmationRate(variant.id),
    }));
  }

  private getHighRiskConfirmationRate(variantId: string): number {
    const filtered = this.metrics.filter(
      m => m.variant === variantId && (m.riskLevel === 'high' || m.riskLevel === 'critical')
    );

    if (filtered.length === 0) return 0;
    const confirmed = filtered.filter(m => m.userConfirmed).length;
    return confirmed / filtered.length;
  }

  getWinningVariant(): ABTestVariant | null {
    const results = this.getResults();
    if (results.length === 0) return null;

    // Winner is variant with highest confirmation rate for high-risk actions
    const sorted = results.sort((a, b) => b.highRiskConfirmationRate - a.highRiskConfirmationRate);
    const winner = sorted[0];

    return this.variants.find(v => v.id === winner.variant) || null;
  }

  exportJSON(): string {
    return JSON.stringify({
      sessionId: this.sessionId,
      metrics: this.metrics,
      results: this.getResults(),
      winningVariant: this.getWinningVariant(),
    }, null, 2);
  }
}
