/**
 * Blast Radius Testing Infrastructure
 * 
 * Measures user comprehension of blast radius impact indicators.
 * Tracks metrics like:
 * - Time to understand impact
 * - Correct identification of affected systems
 * - Confidence in decision-making
 * - Follow-up questions asked
 */

export interface BlastRadiusComprehensionMetric {
  userId?: string;
  testId: string;
  timestamp: number;
  blastRadiusScope: 'self' | 'team' | 'org' | 'global';
  affectedSystemsCount: number;
  timeToUnderstandMs: number;
  confidenceScore: number; // 0-1
  userAskedFollowUp: boolean;
  correctlyIdentifiedSystems: number;
  totalSystemsPresented: number;
  actionTaken: 'confirm' | 'cancel' | 'timeout';
}

export interface BlastRadiusTestScenario {
  id: string;
  title: string;
  description: string;
  scope: 'self' | 'team' | 'org' | 'global';
  affectedSystems: string[];
  downstreamEffects: string;
  estimatedImpact: string;
  expectedDifficultyLevel: 'easy' | 'medium' | 'hard';
  correctAnswers: string[]; // Systems user should identify
}

export class BlastRadiusTestingTracker {
  private metrics: BlastRadiusComprehensionMetric[] = [];
  private sessionId: string;

  constructor(sessionId?: string) {
    this.sessionId = sessionId || `session_${Date.now()}`;
  }

  recordComprehension(metric: Omit<BlastRadiusComprehensionMetric, 'timestamp'>) {
    const fullMetric: BlastRadiusComprehensionMetric = {
      ...metric,
      timestamp: Date.now(),
    };
    this.metrics.push(fullMetric);
    return fullMetric;
  }

  getAverageComprehensionTime(scope?: string): number {
    const filtered = scope
      ? this.metrics.filter(m => m.blastRadiusScope === scope)
      : this.metrics;

    if (filtered.length === 0) return 0;
    const total = filtered.reduce((sum, m) => sum + m.timeToUnderstandMs, 0);
    return total / filtered.length;
  }

  getAccuracyRate(scope?: string): number {
    const filtered = scope
      ? this.metrics.filter(m => m.blastRadiusScope === scope)
      : this.metrics;

    if (filtered.length === 0) return 0;
    const correct = filtered.filter(m => m.correctlyIdentifiedSystems === m.totalSystemsPresented);
    return correct.length / filtered.length;
  }

  getAverageConfidence(scope?: string): number {
    const filtered = scope
      ? this.metrics.filter(m => m.blastRadiusScope === scope)
      : this.metrics;

    if (filtered.length === 0) return 0;
    const total = filtered.reduce((sum, m) => sum + m.confidenceScore, 0);
    return total / filtered.length;
  }

  getFollowUpQuestionRate(): number {
    if (this.metrics.length === 0) return 0;
    const withFollowUp = this.metrics.filter(m => m.userAskedFollowUp).length;
    return withFollowUp / this.metrics.length;
  }

  getSummary() {
    const byScope = {
      self: this.metrics.filter(m => m.blastRadiusScope === 'self'),
      team: this.metrics.filter(m => m.blastRadiusScope === 'team'),
      org: this.metrics.filter(m => m.blastRadiusScope === 'org'),
      global: this.metrics.filter(m => m.blastRadiusScope === 'global'),
    };

    return {
      sessionId: this.sessionId,
      totalTests: this.metrics.length,
      byScope: {
        self: {
          count: byScope.self.length,
          avgTime: this.getAverageComprehensionTime('self'),
          accuracy: this.getAccuracyRate('self'),
          avgConfidence: this.getAverageConfidence('self'),
        },
        team: {
          count: byScope.team.length,
          avgTime: this.getAverageComprehensionTime('team'),
          accuracy: this.getAccuracyRate('team'),
          avgConfidence: this.getAverageConfidence('team'),
        },
        org: {
          count: byScope.org.length,
          avgTime: this.getAverageComprehensionTime('org'),
          accuracy: this.getAccuracyRate('org'),
          avgConfidence: this.getAverageConfidence('org'),
        },
        global: {
          count: byScope.global.length,
          avgTime: this.getAverageComprehensionTime('global'),
          accuracy: this.getAccuracyRate('global'),
          avgConfidence: this.getAverageConfidence('global'),
        },
      },
      overallAccuracy: this.getAccuracyRate(),
      overallAvgTime: this.getAverageComprehensionTime(),
      overallAvgConfidence: this.getAverageConfidence(),
      followUpQuestionRate: this.getFollowUpQuestionRate(),
    };
  }

  getMetrics(): BlastRadiusComprehensionMetric[] {
    return [...this.metrics];
  }

  exportJSON(): string {
    return JSON.stringify({
      sessionId: this.sessionId,
      metrics: this.metrics,
      summary: this.getSummary(),
    }, null, 2);
  }
}

export const BLAST_RADIUS_TEST_SCENARIOS: BlastRadiusTestScenario[] = [
  {
    id: 'br_easy_1',
    title: 'Self-only: Config update',
    description: 'Deploy configuration change to your instance only',
    scope: 'self',
    affectedSystems: ['user-service-1', 'config-cache'],
    downstreamEffects: 'Cache will be refreshed, no other users affected',
    estimatedImpact: '< 1 second latency spike',
    expectedDifficultyLevel: 'easy',
    correctAnswers: ['user-service-1', 'config-cache'],
  },
  {
    id: 'br_medium_1',
    title: 'Team: Database schema migration',
    description: 'Backfill a new column across team services',
    scope: 'team',
    affectedSystems: ['user-db', 'user-service-1', 'user-service-2', 'reporting-cache'],
    downstreamEffects: 'Read queries may take longer during migration; team dashboards affected',
    estimatedImpact: '~200ms extra latency for 30 minutes',
    expectedDifficultyLevel: 'medium',
    correctAnswers: ['user-db', 'user-service-1', 'user-service-2', 'reporting-cache'],
  },
  {
    id: 'br_hard_1',
    title: 'Org: API contract change',
    description: 'Deprecate /v1 endpoint; migrate to /v2',
    scope: 'org',
    affectedSystems: ['api-gateway', 'user-service', 'auth-service', 'partner-integrations', 'mobile-app', 'web-dashboard', 'docs-site'],
    downstreamEffects: 'All clients must upgrade. Partner integrations may break. Support tickets expected.',
    estimatedImpact: '~2 hours of elevated error rates',
    expectedDifficultyLevel: 'hard',
    correctAnswers: ['api-gateway', 'user-service', 'auth-service', 'partner-integrations', 'mobile-app', 'web-dashboard'],
  },
];
