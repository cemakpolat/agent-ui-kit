/**
 * TestDashboard - Visual testing interface for observing Ollama-generated UI kit tests
 *
 * Features:
 * - Dashboard view showing all test suites
 * - Real-time status updates (pending → running → success/failed)
 * - Side-by-side prompt vs generated output comparison
 * - Pass/fail metrics and visualization
 * - Hybrid mode: manual trigger + auto-run
 * - Results logging to JSON file
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  generateTestPrompt,
  generateTestSuite,
  validateIntent,
  summarizeValidation,
  createMockIntent,
  TestPrompt,
  TestResult,
} from '../services/OllamaTestAgent';
import {
  compileIntent,
  IntentPayloadSchema,
} from '@hari/core';
import {
  Play,
  Pause,
  RotateCcw,
  Download,
  AlertCircle,
  CheckCircle,
  Clock,
  Zap,
  ChevronDown,
  ChevronUp,
  Monitor,
} from 'lucide-react';
import type { IntentPayloadInput } from '@hari/core';
import { IntentRenderer, IntentErrorBoundary } from '@hari/ui';
import { registry } from '../registry';

// List of UI components to test
const FEATURE_LIST = [
  'form',
  'chat',
  'document',
  'workflow',
  'kanban',
  'calendar',
  'tree',
  'timeline',
  'diagram',
  'action',
  'ambiguity',
  'presence',
];

interface TestRunState {
  isRunning: boolean;
  isAutoRun: boolean;
  progress: { completed: number; total: number };
  testResults: TestResult[];
  generatedPrompts: TestPrompt[];
  ollamaUrl: string;
}

export function TestDashboard() {
  const [state, setState] = useState<TestRunState>({
    isRunning: false,
    isAutoRun: false,
    progress: { completed: 0, total: 0 },
    testResults: [],
    generatedPrompts: [],
    ollamaUrl: 'http://localhost:11434',
  });

  const [expandedTestId, setExpandedTestId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const resultsContainerRef = useRef<HTMLDivElement>(null);
  const autoRunIntervalRef = useRef<ReturnType<typeof setTimeout> | undefined>();

  /**
   * Load initial test suite
   */
  useEffect(() => {
    // Create mock test suite immediately (without calling Ollama)
    const basicPrompts: TestPrompt[] = FEATURE_LIST.map((feature, idx) => ({
      id: `${feature}-basic-${idx}`,
      feature,
      category: 'basic' as const,
      prompt: `Create a test ${feature} component with basic functionality`,
      expectedFeatures: [feature],
      estimatedComplexity: 'simple' as const,
    }));

    const advancedPrompts: TestPrompt[] = FEATURE_LIST.map((feature, idx) => ({
      id: `${feature}-advanced-${idx + FEATURE_LIST.length}`,
      feature,
      category: 'advanced' as const,
      prompt: `Create an advanced ${feature} component with complex scenarios`,
      expectedFeatures: [feature, 'advanced'],
      estimatedComplexity: 'complex' as const,
    }));

    const mockPrompts = [...basicPrompts, ...advancedPrompts];

    setState((prev) => ({
      ...prev,
      generatedPrompts: mockPrompts,
      progress: { completed: 0, total: mockPrompts.length },
    }));
  }, []);

  /**
   * Auto-run mode: continuously run next pending test
   */
  useEffect(() => {
    if (state.isAutoRun && state.isRunning) {
      const nextTest = state.generatedPrompts.find(
        (p) => !state.testResults.some((r) => r.testPrompt.id === p.id)
      );

      if (nextTest) {
        const timer = setTimeout(() => {
          // Execute test inline to avoid closure issues
          const startTime = performance.now();
          const testResult: TestResult = {
            id: nextTest.id,
            testPrompt: nextTest,
            status: 'running',
            generationTime: 0,
            validationResults: [],
            timestamp: Date.now(),
          };

          setState((prev) => ({
            ...prev,
            testResults: [...prev.testResults, testResult],
          }));

          // Scroll to latest result
          setTimeout(() => {
            if (resultsContainerRef.current) {
              resultsContainerRef.current.scrollTop = resultsContainerRef.current.scrollHeight;
            }
          }, 100);

          try {
            const generatedIntent = createMockIntent(nextTest.feature);
            const validationResults = validateIntent(generatedIntent, nextTest.expectedFeatures);
            const summary = summarizeValidation(validationResults);
            const endTime = performance.now();
            const finalResult: TestResult = {
              id: nextTest.id,
              testPrompt: nextTest,
              status: summary.passPercentage >= 80 ? 'success' : 'failed',
              generatedIntent,
              generationTime: Math.round(endTime - startTime),
              validationResults,
              timestamp: Date.now(),
            };

            setState((prev) => ({
              ...prev,
              testResults: prev.testResults.map((r) => (r.id === nextTest.id ? finalResult : r)),
              progress: { ...prev.progress, completed: prev.progress.completed + 1 },
            }));
          } catch (error) {
            const endTime = performance.now();
            const errorResult: TestResult = {
              id: nextTest.id,
              testPrompt: nextTest,
              status: 'failed',
              generationTime: Math.round(endTime - startTime),
              validationResults: [],
              error: String(error),
              timestamp: Date.now(),
            };

            setState((prev) => ({
              ...prev,
              testResults: prev.testResults.map((r) => (r.id === nextTest.id ? errorResult : r)),
              progress: { ...prev.progress, completed: prev.progress.completed + 1 },
            }));
          }
        }, 500); // Shorter delay between tests

        return () => clearTimeout(timer);
      } else {
        // All tests completed
        setState((prev) => ({ ...prev, isRunning: false, isAutoRun: false }));
      }
    }
    return undefined;
  }, [state.isAutoRun, state.isRunning, state.generatedPrompts, state.testResults]);

  /**
   * Execute a single test
   */
  const executeTest = (testPrompt: TestPrompt) => {
    const startTime = performance.now();
    const testResult: TestResult = {
      id: testPrompt.id,
      testPrompt,
      status: 'running',
      generationTime: 0,
      validationResults: [],
      timestamp: Date.now(),
    };

    setState((prev) => ({
      ...prev,
      testResults: [...prev.testResults, testResult],
    }));

    // Scroll to latest test
    setTimeout(() => {
      if (resultsContainerRef.current) {
        resultsContainerRef.current.scrollTop = resultsContainerRef.current.scrollHeight;
      }
    }, 50);

    try {
      // Simulate intent generation (in real scenario, would call Ollama or your agent API)
      // For now, using mock intent to avoid rate limiting
      const generatedIntent = createMockIntent(testPrompt.feature);

      // Validate the intent
      const validationResults = validateIntent(generatedIntent, testPrompt.expectedFeatures);
      const summary = summarizeValidation(validationResults);

      const endTime = performance.now();
      const finalResult: TestResult = {
        id: testPrompt.id,
        testPrompt,
        status: summary.passPercentage >= 80 ? 'success' : 'failed',
        generatedIntent,
        generationTime: Math.round(endTime - startTime),
        validationResults,
        timestamp: Date.now(),
      };

      setState((prev) => ({
        ...prev,
        testResults: prev.testResults.map((r) => (r.id === testPrompt.id ? finalResult : r)),
        progress: { ...prev.progress, completed: prev.progress.completed + 1 },
      }));
    } catch (error) {
      const endTime = performance.now();
      const errorResult: TestResult = {
        id: testPrompt.id,
        testPrompt,
        status: 'failed',
        generationTime: Math.round(endTime - startTime),
        validationResults: [],
        error: String(error),
        timestamp: Date.now(),
      };

      setState((prev) => ({
        ...prev,
        testResults: prev.testResults.map((r) => (r.id === testPrompt.id ? errorResult : r)),
        progress: { ...prev.progress, completed: prev.progress.completed + 1 },
      }));
    }
  };

  /**
   * Start testing (single mode: run first pending test)
   */
  const handleStartTest = () => {
    const nextTest = state.generatedPrompts.find(
      (p) => !state.testResults.some((r) => r.testPrompt.id === p.id)
    );

    if (nextTest) {
      setState((prev) => ({ ...prev, isRunning: true }));
      // Execute test synchronously
      executeTest(nextTest);
      setState((prev) => ({ ...prev, isRunning: false }));
    }
  };

  /**
   * Start auto-run mode
   */
  const handleAutoRun = () => {
    setState((prev) => ({ ...prev, isRunning: true, isAutoRun: true }));
  };

  /**
   * Pause testing
   */
  const handlePause = () => {
    setState((prev) => ({ ...prev, isRunning: false, isAutoRun: false }));
  };

  /**
   * Reset all tests
   */
  const handleReset = async () => {
    setState((prev) => ({
      ...prev,
      isRunning: false,
      isAutoRun: false,
      testResults: [],
      progress: { completed: 0, total: prev.generatedPrompts.length },
    }));
  };

  /**
   * Export results to JSON
   */
  const handleExportResults = () => {
    const exportData = {
      timestamp: new Date().toISOString(),
      summary: {
        totalTests: state.progress.total,
        completed: state.progress.completed,
        passedCount: state.testResults.filter((r) => r.status === 'success').length,
        failedCount: state.testResults.filter((r) => r.status === 'failed').length,
      },
      results: state.testResults.map((r) => ({
        testId: r.id,
        feature: r.testPrompt.feature,
        category: r.testPrompt.category,
        status: r.status,
        prompt: r.testPrompt.prompt,
        generationTimeMs: r.generationTime,
        validationPassRate:
          r.validationResults.length > 0
            ? Math.round((r.validationResults.filter((v) => v.passed).length / r.validationResults.length) * 100)
            : 0,
        error: r.error,
      })),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `test-results-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Calculate statistics
  const stats = {
    passed: state.testResults.filter((r) => r.status === 'success').length,
    failed: state.testResults.filter((r) => r.status === 'failed').length,
    pending: state.progress.total - state.progress.completed,
    successRate:
      state.progress.completed > 0
        ? Math.round(
            (state.testResults.filter((r) => r.status === 'success').length /
              state.progress.completed) *
              100
          )
        : 0,
    avgTime:
      state.testResults.length > 0
        ? Math.round(
            state.testResults.reduce((sum, r) => sum + r.generationTime, 0) /
              state.testResults.length
          )
        : 0,
  };

  return (
    <div className="h-full w-full bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 overflow-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="w-full px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <Monitor className="w-6 h-6 text-blue-600" />
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                Test Dashboard
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {!state.isRunning ? (
                <>
                  <button
                    onClick={handleStartTest}
                    disabled={state.progress.completed >= state.progress.total}
                    className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    <Play className="w-4 h-4" />
                    <span className="hidden sm:inline">Run Next Test</span>
                    <span className="sm:hidden">Run</span>
                  </button>
                  <button
                    onClick={handleAutoRun}
                    disabled={state.progress.completed >= state.progress.total}
                    className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    <Zap className="w-4 h-4" />
                    <span className="hidden sm:inline">Auto Run All</span>
                    <span className="sm:hidden">Auto</span>
                  </button>
                </>
              ) : (
                <button
                  onClick={handlePause}
                  className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition"
                >
                  <Pause className="w-4 h-4" />
                  <span className="hidden sm:inline">Pause</span>
                </button>
              )}

              <button
                onClick={handleReset}
                className="inline-flex items-center gap-2 px-2 py-2 text-sm bg-slate-300 dark:bg-slate-700 text-slate-900 dark:text-white rounded-lg hover:bg-slate-400 dark:hover:bg-slate-600 transition"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              <button
                onClick={handleExportResults}
                disabled={state.testResults.length === 0}
                className="inline-flex items-center gap-2 px-2 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                <Download className="w-4 h-4" />
              </button>

              <button
                onClick={() => setShowSettings(!showSettings)}
                className="inline-flex items-center gap-2 px-2 py-2 text-sm bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg hover:bg-slate-300 dark:hover:bg-slate-700 transition"
              >
                ⚙️
              </button>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Progress: {state.progress.completed}/{state.progress.total}
              </span>
              <span className="text-sm text-slate-600 dark:text-slate-400">
                {Math.round((state.progress.completed / Math.max(state.progress.total, 1)) * 100)}%
              </span>
            </div>
            <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-300"
                style={{
                  width: `${(state.progress.completed / Math.max(state.progress.total, 1)) * 100}%`,
                }}
              />
            </div>
          </div>

          {/* Stats Row */}
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-2 sm:p-3">
              <div className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">Passed</div>
              <div className="text-xl sm:text-2xl font-bold text-green-600 dark:text-green-400">{stats.passed}</div>
            </div>
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-2 sm:p-3">
              <div className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">Failed</div>
              <div className="text-xl sm:text-2xl font-bold text-red-600 dark:text-red-400">{stats.failed}</div>
            </div>
            <div className="bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg p-2 sm:p-3">
              <div className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">Pending</div>
              <div className="text-xl sm:text-2xl font-bold text-slate-600 dark:text-slate-400">{stats.pending}</div>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-2 sm:p-3">
              <div className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">Success%</div>
              <div className="text-xl sm:text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.successRate}%</div>
            </div>
            <div className="hidden lg:block bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-2 sm:p-3">
              <div className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">Avg Time</div>
              <div className="text-xl sm:text-2xl font-bold text-purple-600 dark:text-purple-400">{stats.avgTime}ms</div>
            </div>
          </div>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-4 sm:px-6 lg:px-8 py-4">
          <h3 className="font-semibold text-slate-900 dark:text-white mb-3">Settings</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Ollama URL
              </label>
              <input
                type="text"
                value={state.ollamaUrl}
                onChange={(e) => {
                  setState((prev) => ({ ...prev, ollamaUrl: e.target.value }));
                }}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                placeholder="http://localhost:11434"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Total Tests
              </label>
              <input
                type="number"
                value={state.progress.total}
                disabled
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>
          </div>
        </div>
      )}

      {/* Results Grid */}
      <div ref={resultsContainerRef} className="w-full px-4 sm:px-6 lg:px-8 py-8 space-y-4">
        {state.testResults.length === 0 ? (
          <div className="text-center py-12">
            <Clock className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-slate-600 dark:text-slate-400">
              {state.generatedPrompts.length > 0
                ? 'Click "Run Next Test" or "Auto Run All" to begin testing'
                : 'Loading test prompts...'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {state.testResults.map((result) => (
              <TestResultCard
                key={result.id}
                result={result}
                isExpanded={expandedTestId === result.id}
                onToggle={() =>
                  setExpandedTestId(expandedTestId === result.id ? null : result.id)
                }
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Individual test result card
 */
function TestResultCard({
  result,
  isExpanded,
  onToggle,
}: {
  result: TestResult;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const validationSummary = result.validationResults.length > 0 ? {
    passed: result.validationResults.filter((v) => v.passed).length,
    total: result.validationResults.length,
  } : null;

  const passPercentage = validationSummary 
    ? Math.round((validationSummary.passed / validationSummary.total) * 100)
    : 0;

  const statusColors = {
    pending: 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700',
    running: 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700 animate-pulse',
    success: 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700',
    failed: 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700',
    skipped: 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700',
  };

  const statusIcons = {
    pending: <Clock className="w-5 h-5 text-slate-400" />,
    running: <Zap className="w-5 h-5 text-blue-500 animate-spin" />,
    success: <CheckCircle className="w-5 h-5 text-green-600" />,
    failed: <AlertCircle className="w-5 h-5 text-red-600" />,
    skipped: <Clock className="w-5 h-5 text-slate-400" />,
  };

  return (
    <div
      className={`border rounded-lg transition-all ${statusColors[result.status]}`}
    >
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between hover:opacity-75 transition gap-3"
      >
        <div className="flex items-center gap-3 sm:gap-4 text-left flex-1 min-w-0">
          {statusIcons[result.status]}
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-slate-900 dark:text-white capitalize text-sm sm:text-base">
              test_{result.testPrompt.feature}_{result.testPrompt.category}
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 line-clamp-2">
              {result.testPrompt.prompt}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4 justify-between sm:justify-end flex-shrink-0">
          {validationSummary && (
            <div className="flex items-center gap-2">
              <div className="text-right hidden sm:block">
                <div className="font-semibold text-slate-900 dark:text-white text-sm">
                  {validationSummary.passed}/{validationSummary.total}
                </div>
                <div className="text-xs text-slate-600 dark:text-slate-400">
                  {passPercentage}%
                </div>
              </div>
              <div className="w-12 sm:w-16 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className={`h-full ${
                    passPercentage >= 80 ? 'bg-green-500' : 'bg-yellow-500'
                  }`}
                  style={{ width: `${passPercentage}%` }}
                />
              </div>
            </div>
          )}

          <span className="text-xs text-slate-500 dark:text-slate-500 whitespace-nowrap">
            {result.generationTime}ms
          </span>

          {isExpanded ? (
            <ChevronUp className="w-4 h-4 sm:w-5 sm:h-5 text-slate-600 dark:text-slate-400 flex-shrink-0" />
          ) : (
            <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5 text-slate-600 dark:text-slate-400 flex-shrink-0" />
          )}
        </div>
      </button>

      {/* Expanded View */}
      {isExpanded && (
        <div className="border-t border-slate-200 dark:border-slate-700 px-4 sm:px-6 py-4 space-y-4">
          {/* Prompt */}
          <div>
            <h4 className="font-semibold text-slate-900 dark:text-white text-xs sm:text-sm mb-2">
              Test Prompt
            </h4>
            <div className="bg-white dark:bg-slate-800 rounded p-3 text-xs sm:text-sm text-slate-700 dark:text-slate-300 italic break-words">
              "{result.testPrompt.prompt}"
            </div>
          </div>

          {/* Expected Features */}
          {result.testPrompt.expectedFeatures.length > 0 && (
            <div>
              <h4 className="font-semibold text-slate-900 dark:text-white text-xs sm:text-sm mb-2">
                Expected Features
              </h4>
              <div className="flex flex-wrap gap-2">
                {result.testPrompt.expectedFeatures.map((feature) => (
                  <span
                    key={feature}
                    className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-xs"
                  >
                    {feature}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Generated Output Preview */}
          {result.generatedIntent && (
            <div>
              <h4 className="font-semibold text-slate-900 dark:text-white text-xs sm:text-sm mb-2">
                Generated Component
              </h4>
              <IntentErrorBoundary>
                <div className="bg-white dark:bg-slate-800 rounded p-4 border border-slate-200 dark:border-slate-700 overflow-auto max-h-96">
                  <TestComponentRenderer intent={result.generatedIntent} />
                </div>
              </IntentErrorBoundary>
            </div>
          )}

          {/* Validation Results */}
          {result.validationResults.length > 0 && (
            <div>
              <h4 className="font-semibold text-slate-900 dark:text-white text-xs sm:text-sm mb-2">
                Validation Results
              </h4>
              <div className="space-y-2">
                {result.validationResults.map((validation, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-3 text-xs sm:text-sm"
                  >
                    {validation.passed ? (
                      <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 min-w-0">
                      <span className="text-slate-700 dark:text-slate-300 block break-words">
                        {validation.check}
                      </span>
                      {validation.details && (
                        <span className="text-slate-500 dark:text-slate-500 text-xs block break-words">
                          {validation.details}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Error Display */}
          {result.error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-3">
              <p className="text-xs sm:text-sm font-semibold text-red-700 dark:text-red-300 mb-1">
                Error
              </p>
              <p className="text-xs sm:text-sm text-red-600 dark:text-red-400 font-mono break-words">
                {result.error}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Helper component to render a test intent with compilation
 */
function TestComponentRenderer({ intent }: { intent: IntentPayloadInput }) {
  try {
    // Validate and normalize the intent
    const validated = IntentPayloadSchema.parse(intent);
    const compiled = compileIntent(validated, registry);
    if (!compiled) {
      return <div className="text-red-600 text-sm">Failed to compile intent</div>;
    }
    return <IntentRenderer compiledView={compiled} />;
  } catch (error) {
    return <div className="text-red-600 text-sm">Error: {String(error)}</div>;
  }
}
