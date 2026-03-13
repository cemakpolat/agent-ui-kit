import React, { useState, useRef, useEffect } from 'react';
import { useIntentStore } from '@hari/core';
import { Brain, Send, Loader, CheckCircle2, AlertCircle, Settings } from 'lucide-react';

/**
 * OllamaPanel - Interactive UI for querying Ollama and generating intent modifications
 *
 * Demonstrates:
 * - Text input for user queries
 * - Live intent modification from Ollama
 * - Display of JSON changes
 * - Connection status to agent bridge
 */
export function OllamaPanel() {
  const currentIntent = useIntentStore((state) => state.currentIntent);
  const setIntent = useIntentStore((state) => state.setIntent);

  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [lastModification, setLastModification] = useState<Record<string, unknown> | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [ollamaUrl, setOllamaUrl] = useState('http://localhost:11434');
  const [showUrlInput, setShowUrlInput] = useState(false);
  const logsRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logs
  useEffect(() => {
    if (logsRef.current) {
      logsRef.current.scrollTop = logsRef.current.scrollHeight;
    }
  }, [lastModification]);

  /**
   * Submit a query to Ollama and apply modifications to the current intent
   */
  const handleSubmitQuery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsLoading(true);
    setStatus('loading');
    setErrorMessage('');

    try {
      // Call Ollama via the agent bridge or directly
      const response = await fetch(`${ollamaUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama3.2:latest',
          prompt: `User query: "${query}"\n\nBased on this query, suggest what JSON fields in a project form might change. Respond with only a JSON object (no markdown, no explanation). Example: {"budget": 100000, "timeline": "6 months"}`,
          stream: false,
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama returned ${response.status}`);
      }

      const data = await response.json();
      const responseText = data.response || '';

      // Try to extract JSON from the response
      let modification: Record<string, unknown> = {};
      try {
        // Remove markdown code blocks if present
        const cleanJson = responseText
          .replace(/```json\n?/g, '')
          .replace(/```\n?/g, '')
          .trim();
        modification = JSON.parse(cleanJson);
      } catch {
        // If parsing fails, try to find JSON-like content
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            modification = JSON.parse(jsonMatch[0]);
          } catch {
            setErrorMessage('Could not parse Ollama response as JSON');
            setStatus('error');
            setIsLoading(false);
            return;
          }
        }
      }

      setLastModification(modification);

      // Apply the modification to the intent
      if (currentIntent && Object.keys(modification).length > 0) {
        const updatedIntent = {
          ...currentIntent,
          data: {
            ...currentIntent.data,
            ...modification,
          },
        };
        setIntent(updatedIntent);
        setStatus('success');
      } else {
        setStatus('idle');
      }

      // Clear the input
      setQuery('');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error occurred';
      setErrorMessage(message);
      setStatus('error');
      console.error('Ollama query failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain size={20} className="text-blue-600 dark:text-blue-400" />
          <h3 className="font-semibold text-gray-900 dark:text-white">Ask Ollama to Modify</h3>
        </div>
        <button
          onClick={() => setShowUrlInput(!showUrlInput)}
          className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-800"
          title="Configure Ollama URL"
        >
          <Settings size={16} className="text-gray-600 dark:text-gray-400" />
        </button>
      </div>

      {/* Ollama URL Configuration */}
      {showUrlInput && (
        <div className="flex gap-2 rounded bg-gray-50 p-3 dark:bg-gray-800">
          <input
            type="text"
            value={ollamaUrl}
            onChange={(e) => setOllamaUrl(e.target.value)}
            placeholder="http://localhost:11434"
            className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          />
          <button
            onClick={() => setShowUrlInput(false)}
            className="rounded bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700"
          >
            Set
          </button>
        </div>
      )}

      {/* Ollama URL Display */}
      {!showUrlInput && (
        <div className="text-xs text-gray-500 dark:text-gray-400">
          Ollama URL: <code className="font-mono">{ollamaUrl}</code>
        </div>
      )}

      {/* Query Form */}
      <form onSubmit={handleSubmitQuery} className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder='e.g., "Increase budget to 100k and extend timeline to 6 months"'
          className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={isLoading || !query.trim()}
          className="inline-flex items-center gap-2 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-700 dark:hover:bg-blue-800"
        >
          {isLoading ? (
            <>
              <Loader size={16} className="animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Send size={16} />
              Ask Ollama
            </>
          )}
        </button>
      </form>

      {/* Status Messages */}
      {status === 'success' && (
        <div className="flex items-start gap-2 rounded bg-green-50 p-3 text-sm text-green-800 dark:bg-green-900 dark:text-green-200">
          <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-semibold">Success!</p>
            <p className="mt-1">Form fields have been updated based on Ollama's suggestion.</p>
          </div>
        </div>
      )}

      {status === 'error' && (
        <div className="flex items-start gap-2 rounded bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900 dark:text-red-200">
          <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-semibold">Error</p>
            <p className="mt-1">
              {errorMessage ||
                'Could not connect to Ollama. Make sure Ollama is running at the specified URL.'}
            </p>
          </div>
        </div>
      )}

      {/* Last Modification Display */}
      {lastModification && Object.keys(lastModification).length > 0 && (
        <div className="rounded bg-gray-50 p-3 dark:bg-gray-800">
          <p className="text-xs font-semibold text-gray-600 dark:text-gray-400">Last Modification:</p>
          <pre className="mt-2 max-h-32 overflow-auto rounded bg-white p-2 text-xs text-gray-800 dark:bg-gray-900 dark:text-gray-200">
            {JSON.stringify(lastModification, null, 2)}
          </pre>
        </div>
      )}

      {/* Info Box */}
      <div className="rounded bg-blue-50 p-3 text-xs text-blue-800 dark:bg-blue-900 dark:text-blue-200">
        <p className="font-semibold">💡 How it works:</p>
        <ol className="mt-2 list-inside list-decimal space-y-1">
          <li>Describe what you want to change to the form</li>
          <li>Ollama generates a JSON modification based on your request</li>
          <li>The form updates dynamically with the new values</li>
          <li>The intentId and metadata track all changes</li>
        </ol>
      </div>
    </div>
  );
}
