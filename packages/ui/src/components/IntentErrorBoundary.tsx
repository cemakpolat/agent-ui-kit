import React from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// IntentErrorBoundary
//
// Wraps the IntentRenderer to catch runtime errors from domain components
// (e.g. a component receiving unexpected data, a misconfigured registry entry).
//
// Shows a recoverable error state rather than a white screen.  Includes:
//   - The error message + stack for debugging
//   - A "Retry" button that resets the boundary
//   - The raw data payload as a fallback view
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  children: React.ReactNode;
  fallbackData?: Record<string, unknown>;
  domain?: string;
  intentType?: string;
}

interface State {
  error: Error | null;
}

export class IntentErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[HARI] IntentRenderer error:', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    const error = this.state.error;
    const { fallbackData, domain, intentType } = this.props;

    return (
      <div
        style={{
          backgroundColor: '#fff1f2',
          border: '1.5px solid #fda4af',
          borderRadius: '0.75rem',
          padding: '1.25rem',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div
              style={{
                fontWeight: 700,
                color: '#be123c',
                fontSize: '0.875rem',
                marginBottom: '0.25rem',
              }}
            >
              ⚠ Render Error
              {domain && intentType && (
                <span style={{ fontWeight: 400, color: '#9f1239', marginLeft: '0.5rem' }}>
                  ({domain}/{intentType})
                </span>
              )}
            </div>
            <div style={{ fontSize: '0.8rem', color: '#be123c', fontFamily: 'monospace' }}>
              {error.message}
            </div>
          </div>
          <button
            onClick={() => this.setState({ error: null })}
            style={{
              padding: '0.375rem 0.875rem',
              borderRadius: '0.375rem',
              border: '1.5px solid #fda4af',
              backgroundColor: 'white',
              color: '#be123c',
              fontWeight: 600,
              fontSize: '0.8rem',
              cursor: 'pointer',
            }}
          >
            Retry
          </button>
        </div>

        {/* Raw data fallback */}
        {fallbackData && (
          <details style={{ marginTop: '0.875rem' }}>
            <summary
              style={{
                cursor: 'pointer',
                fontSize: '0.75rem',
                color: '#9f1239',
                fontWeight: 600,
              }}
            >
              Raw payload (fallback view)
            </summary>
            <pre
              style={{
                marginTop: '0.5rem',
                padding: '0.75rem',
                backgroundColor: '#fff5f7',
                borderRadius: '0.375rem',
                fontSize: '0.7rem',
                color: '#6b0f1a',
                overflowX: 'auto',
                whiteSpace: 'pre-wrap',
              }}
            >
              {JSON.stringify(fallbackData, null, 2)}
            </pre>
          </details>
        )}
      </div>
    );
  }
}
