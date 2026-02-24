/**
 * Error Recovery Patterns
 * 
 * Tracks and analyzes error recovery strategies:
 * - What recovery options users choose
 * - Success rates of different recovery approaches
 * - Time to recovery
 * - Confidence after recovery
 */

export interface ErrorEvent {
  errorId: string;
  timestamp: number;
  domain?: string;
  intentType?: string;
  errorType: 'validation' | 'execution' | 'network' | 'permission' | 'timeout' | 'other';
  message: string;
  actionId?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export type RecoveryStrategy = 
  | 'retry'
  | 'modify_and_retry'
  | 'ask_for_help'
  | 'cancel'
  | 'escalate'
  | 'fallback_action';

export interface RecoveryAttempt {
  errorId: string;
  timestamp: number;
  strategy: RecoveryStrategy;
  timeToRecoveryMs: number;
  wasSuccessful: boolean;
  userConfidenceAfter: number; // 0-1
  suggestedBy?: 'agent' | 'user' | 'system';
}

export interface ErrorRecoveryPattern {
  errorType: string;
  totalErrors: number;
  recoveryStrategies: Map<RecoveryStrategy, {
    count: number;
    successRate: number;
    avgTimeMs: number;
  }>;
  avgRecoveryTime: number;
  overallRecoveryRate: number;
}

export class ErrorRecoveryTracker {
  private errors: ErrorEvent[] = [];
  private recoveries: RecoveryAttempt[] = [];
  private sessionId: string;

  constructor(sessionId?: string) {
    this.sessionId = sessionId || `session_${Date.now()}`;
  }

  recordError(error: Omit<ErrorEvent, 'timestamp'>) {
    const fullError: ErrorEvent = {
      ...error,
      timestamp: Date.now(),
    };
    this.errors.push(fullError);
    return fullError;
  }

  recordRecoveryAttempt(recovery: Omit<RecoveryAttempt, 'timestamp'>) {
    const fullRecovery: RecoveryAttempt = {
      ...recovery,
      timestamp: Date.now(),
    };
    this.recoveries.push(fullRecovery);
    return fullRecovery;
  }

  getErrorsByType(): Map<string, ErrorEvent[]> {
    const grouped = new Map<string, ErrorEvent[]>();

    for (const error of this.errors) {
      if (!grouped.has(error.errorType)) {
        grouped.set(error.errorType, []);
      }
      grouped.get(error.errorType)!.push(error);
    }

    return grouped;
  }

  getRecoveryPattern(errorType: string): ErrorRecoveryPattern {
    const errors = this.errors.filter(e => e.errorType === errorType);
    const recoveries = this.recoveries.filter(r => {
      const error = this.errors.find(e => e.errorId === r.errorId);
      return error && error.errorType === errorType;
    });

    const strategyCounts = new Map<RecoveryStrategy, {
      count: number;
      successful: number;
      timeMs: number[];
    }>();

    for (const recovery of recoveries) {
      if (!strategyCounts.has(recovery.strategy)) {
        strategyCounts.set(recovery.strategy, { count: 0, successful: 0, timeMs: [] });
      }

      const stats = strategyCounts.get(recovery.strategy)!;
      stats.count += 1;
      if (recovery.wasSuccessful) stats.successful += 1;
      stats.timeMs.push(recovery.timeToRecoveryMs);
    }

    const strategies = new Map<RecoveryStrategy, {
      count: number;
      successRate: number;
      avgTimeMs: number;
    }>();

    for (const [strategy, stats] of strategyCounts) {
      strategies.set(strategy, {
        count: stats.count,
        successRate: stats.count === 0 ? 0 : stats.successful / stats.count,
        avgTimeMs: stats.timeMs.length === 0 ? 0 : stats.timeMs.reduce((a, b) => a + b) / stats.timeMs.length,
      });
    }

    const totalRecoveryTime = recoveries.reduce((sum, r) => sum + r.timeToRecoveryMs, 0);
    const avgRecoveryTime = recoveries.length === 0 ? 0 : totalRecoveryTime / recoveries.length;

    return {
      errorType,
      totalErrors: errors.length,
      recoveryStrategies: strategies,
      avgRecoveryTime,
      overallRecoveryRate: recoveries.length === 0 ? 0 : recoveries.filter(r => r.wasSuccessful).length / recoveries.length,
    };
  }

  getBestRecoveryStrategy(errorType: string): RecoveryStrategy | null {
    const pattern = this.getRecoveryPattern(errorType);
    if (pattern.recoveryStrategies.size === 0) return null;

    let best: [RecoveryStrategy, { count: number; successRate: number; avgTimeMs: number }] | null = null;

    for (const [strategy, stats] of pattern.recoveryStrategies) {
      if (!best || stats.successRate > best[1].successRate) {
        best = [strategy, stats];
      }
    }

    return best ? best[0] : null;
  }

  getUserConfidenceTrajectory(errorId: string): number[] {
    const error = this.errors.find(e => e.errorId === errorId);
    if (!error) return [];

    const recovery = this.recoveries.find(r => r.errorId === errorId);
    if (!recovery) return [];

    return [recovery.userConfidenceAfter];
  }

  getSummary() {
    const errorsByType = this.getErrorsByType();
    const patterns = Array.from(errorsByType.keys()).map(errorType => this.getRecoveryPattern(errorType));

    return {
      sessionId: this.sessionId,
      totalErrors: this.errors.length,
      totalRecoveryAttempts: this.recoveries.length,
      overallRecoveryRate: this.recoveries.length === 0
        ? 0
        : this.recoveries.filter(r => r.wasSuccessful).length / this.recoveries.length,
      errorsByType: Array.from(errorsByType.keys()).map(type => ({
        type,
        count: errorsByType.get(type)!.length,
      })),
      recoveryPatterns: patterns.map(p => ({
        errorType: p.errorType,
        totalErrors: p.totalErrors,
        avgRecoveryTime: p.avgRecoveryTime,
        overallRecoveryRate: p.overallRecoveryRate,
        bestStrategy: this.getBestRecoveryStrategy(p.errorType),
      })),
      averageConfidenceAfterRecovery: this.recoveries.length === 0
        ? 0
        : this.recoveries.reduce((sum, r) => sum + r.userConfidenceAfter, 0) / this.recoveries.length,
    };
  }

  getErrors(): ErrorEvent[] {
    return [...this.errors];
  }

  getRecoveries(): RecoveryAttempt[] {
    return [...this.recoveries];
  }

  exportJSON(): string {
    return JSON.stringify({
      sessionId: this.sessionId,
      errors: this.errors,
      recoveries: this.recoveries,
      summary: this.getSummary(),
    }, null, 2);
  }
}
