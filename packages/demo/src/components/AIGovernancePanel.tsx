import React from 'react';
import { telemetry } from '@hari/core';
import {
  aiGovernance,
  AIGovernanceService,
  type SuggestedPrecondition,
  type CriticalityEvaluation,
  type JustificationSummary,
} from '../services/ai-governance';
import {
  Brain,
  Sparkles,
  Shield,
  CheckSquare,
  FileText,
  Loader,
  AlertCircle,
  CheckCircle2,
  Plus,
  Trash2,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Wifi,
  WifiOff,
  Settings,
  Copy,
  Check,
  AlertTriangle,
  Zap,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Phase 8.2 — AI Governance Panel
//
// Three AI-powered governance assistance modes:
//   1. Precondition Suggester  — describe an action, get precondition suggestions
//   2. Criticality Evaluator   — paste preconditions, get AI-ranked criticality
//   3. Justification Generator — generate audit-ready justification summaries
// ─────────────────────────────────────────────────────────────────────────────

type PanelMode = 'suggest' | 'evaluate' | 'justify';

const CRITICALITY_CONFIG = {
  low:      { color: '#166534', bg: '#f0fdf4', border: '#86efac' },
  medium:   { color: '#92400e', bg: '#fffbeb', border: '#fde68a' },
  high:     { color: '#9a3412', bg: '#fff7ed', border: '#fed7aa' },
  critical: { color: '#991b1b', bg: '#fef2f2', border: '#fecaca' },
};

function CriticalityBadge({ criticality }: { criticality: string }) {
  const cfg = CRITICALITY_CONFIG[criticality as keyof typeof CRITICALITY_CONFIG] ?? CRITICALITY_CONFIG.medium;
  return (
    <span style={{
      padding: '0.15rem 0.5rem', borderRadius: '999px', fontSize: '0.65rem', fontWeight: 700,
      backgroundColor: cfg.bg, color: cfg.color,
      border: `1px solid ${cfg.border}`,
    }}>
      {criticality}
    </span>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      style={{ border: 'none', background: 'none', cursor: 'pointer', color: copied ? '#15803d' : '#94a3b8', padding: '0.2rem' }}
      title="Copy to clipboard"
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
    </button>
  );
}

function LoadingSpinner({ message }: { message: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#6366f1', fontSize: '0.8rem', padding: '1rem' }}>
      <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} />
      {message}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function ErrorMessage({ message }: { message: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: '0.5rem',
      padding: '0.625rem 0.875rem', backgroundColor: '#fef2f2',
      border: '1px solid #fecaca', borderRadius: '0.5rem',
      color: '#991b1b', fontSize: '0.78rem',
    }}>
      <AlertCircle size={14} style={{ flexShrink: 0, marginTop: '1px' }} />
      <div>
        <strong>Error: </strong>{message}
        {message.includes('Failed to fetch') && (
          <div style={{ marginTop: '0.25rem', color: '#b91c1c', fontSize: '0.72rem' }}>
            Make sure Ollama is running: <code>ollama serve</code>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Mode 1: Precondition Suggester ────────────────────────────────────────────

function PreconditionSuggester({ service }: { service: AIGovernanceService }) {
  const [actionDesc, setActionDesc] = React.useState('');
  const [domain, setDomain] = React.useState('deployment');
  const [reversibility, setReversibility] = React.useState('partially_reversible');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [suggestions, setSuggestions] = React.useState<SuggestedPrecondition[]>([]);
  const [accepted, setAccepted] = React.useState<Set<number>>(new Set());

  const handleSuggest = async () => {
    if (!actionDesc.trim()) return;
    setLoading(true);
    setError(null);
    setSuggestions([]);
    setAccepted(new Set());

    const result = await service.suggestPreconditions(actionDesc, { domain, reversibility });

    setLoading(false);
    if (result.success && result.data) {
      setSuggestions(result.data);
    } else {
      setError(result.error ?? 'Unknown error');
    }
  };

  const toggleAccept = (i: number) => {
    setAccepted((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  const handleConfirmAccepted = () => {
    if (accepted.size === 0) return;
    telemetry.emit({
      type: 'governance:ai_suggestion',
      actionDescription: actionDesc,
      suggestedCount: suggestions.length,
      acceptedCount: accepted.size,
      provider: service.providerLabel,
      latencyMs: 0,
      timestamp: new Date().toISOString(),
    });
    alert(`${accepted.size} precondition(s) confirmed. In a real integration these would be injected into the GovernedAction.`);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ fontSize: '0.8rem', color: 'var(--hari-text-secondary)', lineHeight: 1.6 }}>
        Describe your action in plain English. The AI will suggest concrete, actionable preconditions
        with criticality ratings and verification methods.
      </div>

      <div>
        <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--hari-text-secondary)', textTransform: 'uppercase', marginBottom: '0.375rem', display: 'block' }}>
          Action Description
        </label>
        <textarea
          value={actionDesc}
          onChange={(e) => setActionDesc(e.target.value)}
          placeholder="e.g. Deploy checkout-service v2.4.0 to production with canary rollout"
          rows={3}
          style={{
            width: '100%', boxSizing: 'border-box', padding: '0.625rem 0.75rem',
            border: '1px solid var(--hari-border)', borderRadius: '0.5rem', fontSize: '0.8rem',
            color: 'var(--hari-text)', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6,
          }}
        />
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '150px' }}>
          <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--hari-text-secondary)', textTransform: 'uppercase', marginBottom: '0.375rem', display: 'block' }}>
            Domain
          </label>
          <select
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--hari-border)', borderRadius: '0.5rem', fontSize: '0.78rem', color: 'var(--hari-text-secondary)', background: 'var(--hari-surface)' }}
          >
            {['deployment', 'security', 'finance', 'incident-response', 'compliance', 'general'].map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
        <div style={{ flex: 1, minWidth: '150px' }}>
          <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--hari-text-secondary)', textTransform: 'uppercase', marginBottom: '0.375rem', display: 'block' }}>
            Reversibility
          </label>
          <select
            value={reversibility}
            onChange={(e) => setReversibility(e.target.value)}
            style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--hari-border)', borderRadius: '0.5rem', fontSize: '0.78rem', color: 'var(--hari-text-secondary)', background: 'var(--hari-surface)' }}
          >
            <option value="fully_reversible">Fully reversible</option>
            <option value="partially_reversible">Partially reversible</option>
            <option value="irreversible">Irreversible</option>
            <option value="time_limited">Time-limited reversal</option>
          </select>
        </div>
      </div>

      <button
        onClick={handleSuggest}
        disabled={loading || !actionDesc.trim()}
        style={{
          padding: '0.625rem 1.25rem', borderRadius: '0.5rem',
          border: 'none', backgroundColor: loading ? '#a78bfa' : '#7c3aed',
          color: '#fff', cursor: loading ? 'not-allowed' : 'pointer',
          fontWeight: 700, fontSize: '0.8rem',
          display: 'flex', alignItems: 'center', gap: '0.375rem',
          alignSelf: 'flex-start',
        }}
      >
        {loading ? <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Sparkles size={14} />}
        {loading ? 'Thinking…' : 'Suggest Preconditions'}
      </button>

      {loading && <LoadingSpinner message="Consulting AI for governance preconditions…" />}
      {error && <ErrorMessage message={error} />}

      {suggestions.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--hari-text-secondary)', textTransform: 'uppercase' }}>
              {suggestions.length} Preconditions Suggested
            </div>
            <button
              onClick={handleConfirmAccepted}
              disabled={accepted.size === 0}
              style={{
                padding: '0.375rem 0.75rem', borderRadius: '0.5rem',
                border: '1px solid #059669', backgroundColor: accepted.size > 0 ? '#059669' : '#f1f5f9',
                color: accepted.size > 0 ? '#fff' : '#94a3b8',
                cursor: accepted.size > 0 ? 'pointer' : 'not-allowed',
                fontWeight: 600, fontSize: '0.72rem',
                display: 'flex', alignItems: 'center', gap: '0.25rem',
              }}
            >
              <CheckCircle2 size={12} /> Confirm {accepted.size > 0 ? `(${accepted.size})` : ''}
            </button>
          </div>

          {suggestions.map((s, i) => {
            const isAccepted = accepted.has(i);
            const cfg = CRITICALITY_CONFIG[s.criticality as keyof typeof CRITICALITY_CONFIG] ?? CRITICALITY_CONFIG.medium;
            return (
              <div
                key={i}
                style={{
                  border: `1px solid ${isAccepted ? '#86efac' : '#e2e8f0'}`,
                  borderRadius: '0.625rem', padding: '0.875rem',
                  backgroundColor: isAccepted ? '#f0fdf4' : '#fff',
                  cursor: 'pointer', transition: 'all 0.15s',
                }}
                onClick={() => toggleAccept(i)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.375rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', flex: 1 }}>
                    <div style={{
                      width: '16px', height: '16px', borderRadius: '4px', flexShrink: 0,
                      border: `2px solid ${isAccepted ? '#16a34a' : '#cbd5e1'}`,
                      backgroundColor: isAccepted ? '#16a34a' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {isAccepted && <Check size={10} color="#fff" />}
                    </div>
                    <span style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--hari-text)' }}>
                      {s.description}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.375rem', flexShrink: 0, alignItems: 'center' }}>
                    <CriticalityBadge criticality={s.criticality} />
                    <CopyButton text={s.description} />
                  </div>
                </div>

                <div style={{
                  padding: '0.375rem 0.625rem', borderRadius: '0.375rem',
                  backgroundColor: cfg.bg, borderLeft: `3px solid ${cfg.border}`,
                  fontSize: '0.72rem', color: cfg.color, marginBottom: '0.375rem',
                }}>
                  <strong>Rationale:</strong> {s.rationale}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.375rem' }}>
                  {s.verificationMethod && (
                    <div style={{ fontSize: '0.72rem', color: 'var(--hari-text-secondary)' }}>
                      <strong>Verify:</strong> {s.verificationMethod}
                    </div>
                  )}
                  {s.resolution && (
                    <div style={{ fontSize: '0.72rem', color: 'var(--hari-text-secondary)' }}>
                      <strong>Resolve:</strong> {s.resolution}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Mode 2: Criticality Evaluator ─────────────────────────────────────────────

function CriticalityEvaluator({ service }: { service: AIGovernanceService }) {
  const [actionType, setActionType] = React.useState('production deployment');
  const [preconditions, setPreconditions] = React.useState<string[]>([
    'All automated tests must pass',
    'Rollback plan approved',
  ]);
  const [newItem, setNewItem] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [evaluations, setEvaluations] = React.useState<CriticalityEvaluation[]>([]);

  const addPrecondition = () => {
    if (!newItem.trim()) return;
    setPreconditions((prev) => [...prev, newItem.trim()]);
    setNewItem('');
  };

  const removePrecondition = (i: number) => {
    setPreconditions((prev) => prev.filter((_, idx) => idx !== i));
  };

  const handleEvaluate = async () => {
    if (preconditions.length === 0) return;
    setLoading(true);
    setError(null);
    setEvaluations([]);

    const result = await service.evaluateCriticality(preconditions, actionType);

    setLoading(false);
    if (result.success && result.data) {
      setEvaluations(result.data);
    } else {
      setError(result.error ?? 'Unknown error');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ fontSize: '0.8rem', color: 'var(--hari-text-secondary)', lineHeight: 1.6 }}>
        Paste your existing preconditions and let the AI evaluate their criticality,
        identify redundancies, and detect critical gaps you may have missed.
      </div>

      <div>
        <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--hari-text-secondary)', textTransform: 'uppercase', marginBottom: '0.375rem', display: 'block' }}>
          Action Type
        </label>
        <input
          value={actionType}
          onChange={(e) => setActionType(e.target.value)}
          placeholder="e.g. production deployment"
          style={{
            width: '100%', boxSizing: 'border-box', padding: '0.5rem 0.75rem',
            border: '1px solid var(--hari-border)', borderRadius: '0.5rem', fontSize: '0.8rem', color: 'var(--hari-text)', background: 'var(--hari-surface)',
          }}
        />
      </div>

      <div>
        <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--hari-text-secondary)', textTransform: 'uppercase', marginBottom: '0.375rem', display: 'block' }}>
          Preconditions ({preconditions.length})
        </label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', marginBottom: '0.5rem' }}>
          {preconditions.map((p, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.375rem 0.625rem', backgroundColor: 'var(--hari-surface-alt)',
              border: '1px solid var(--hari-border)', borderRadius: '0.5rem', fontSize: '0.78rem', color: 'var(--hari-text-secondary)', background: 'var(--hari-surface)',
            }}>
              <CheckSquare size={12} color="#94a3b8" />
              <span style={{ flex: 1 }}>{p}</span>
              <button onClick={() => removePrecondition(i)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#dc2626', padding: '0.1rem' }}>
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '0.375rem' }}>
          <input
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addPrecondition()}
            placeholder="Add a precondition…"
            style={{
              flex: 1, padding: '0.5rem 0.75rem', border: '1px solid var(--hari-border)',
              borderRadius: '0.5rem', fontSize: '0.78rem', color: 'var(--hari-text)',
              background: 'var(--hari-surface)',
            }}
          />
          <button onClick={addPrecondition} style={{
            padding: '0.5rem 0.75rem', borderRadius: '0.5rem',
            border: '1px solid var(--hari-border)', backgroundColor: 'var(--hari-surface-alt)',
            cursor: 'pointer', color: 'var(--hari-text-secondary)',
            display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.78rem',
          }}>
            <Plus size={13} /> Add
          </button>
        </div>
      </div>

      <button
        onClick={handleEvaluate}
        disabled={loading || preconditions.length === 0}
        style={{
          padding: '0.625rem 1.25rem', borderRadius: '0.5rem',
          border: 'none', backgroundColor: loading ? '#6ee7b7' : '#059669',
          color: '#fff', cursor: loading ? 'not-allowed' : 'pointer',
          fontWeight: 700, fontSize: '0.8rem',
          display: 'flex', alignItems: 'center', gap: '0.375rem',
          alignSelf: 'flex-start',
        }}
      >
        {loading ? <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Shield size={14} />}
        {loading ? 'Evaluating…' : 'Evaluate Criticality'}
      </button>

      {loading && <LoadingSpinner message="AI is analysing criticality and detecting gaps…" />}
      {error && <ErrorMessage message={error} />}

      {evaluations.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--hari-text-secondary)', textTransform: 'uppercase' }}>
            Evaluation Results
          </div>
          {evaluations.map((ev, i) => {
            const isGap = ev.isMissing;
            const cfg = CRITICALITY_CONFIG[ev.assignedCriticality as keyof typeof CRITICALITY_CONFIG] ?? CRITICALITY_CONFIG.medium;
            return (
              <div key={i} style={{
                padding: '0.75rem 0.875rem', borderRadius: '0.625rem',
                border: `1px solid ${isGap ? '#fca5a5' : cfg.border}`,
                backgroundColor: isGap ? '#fff5f5' : cfg.bg,
              }}>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', marginBottom: '0.375rem' }}>
                  {isGap ? <AlertTriangle size={14} color="#dc2626" /> : <CheckSquare size={14} color={cfg.color} />}
                  <span style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--hari-text)', flex: 1 }}>
                    {ev.preconditionDescription}
                  </span>
                  <CriticalityBadge criticality={ev.assignedCriticality} />
                  {ev.isRedundant && (
                    <span style={{ fontSize: '0.6rem', color: '#92400e', fontWeight: 700, backgroundColor: '#fef3c7', padding: '0.1rem 0.35rem', borderRadius: '999px' }}>
                      redundant
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '0.72rem', color: cfg.color, paddingLeft: '1.5rem' }}>
                  {ev.rationale}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Mode 3: Justification Generator ───────────────────────────────────────────

function JustificationGenerator({ service }: { service: AIGovernanceService }) {
  const [action, setAction] = React.useState('');
  const [decisionType, setDecisionType] = React.useState<'approved' | 'rejected'>('approved');
  const [decidedBy, setDecidedBy] = React.useState('');
  const [authority, setAuthority] = React.useState('approve');
  const [context, setContext] = React.useState('');
  const [preconditions, setPreconditions] = React.useState<Array<{ description: string; status: string }>>([
    { description: 'All tests passed', status: 'met' },
    { description: 'Rollback plan confirmed', status: 'met' },
    { description: 'Maintenance window open', status: 'unmet' },
  ]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [justification, setJustification] = React.useState<JustificationSummary | null>(null);
  const [copied, setCopied] = React.useState(false);

  const handleGenerate = async () => {
    if (!action.trim()) return;
    setLoading(true);
    setError(null);
    setJustification(null);

    const result = await service.generateJustification({
      actionDescription: action,
      decisionType,
      decidedBy: decidedBy || 'Unknown',
      authority,
      preconditions,
      additionalContext: context,
    });

    setLoading(false);
    if (result.success && result.data) {
      setJustification(result.data);
    } else {
      setError(result.error ?? 'Unknown error');
    }
  };

  const fullText = justification
    ? `${justification.summary}\n\nKey Decision Points:\n${justification.keyDecisionPoints.map((p) => `• ${p}`).join('\n')}\n\nRisk Acknowledgement:\n${justification.riskAcknowledgement}\n\nAudit Trail:\n${justification.auditTrailNote}`
    : '';

  const handleCopy = () => {
    navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const statusColors: Record<string, string> = {
    met: '#16a34a', unmet: '#dc2626', unknown: '#92400e', waived: '#7c3aed',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ fontSize: '0.8rem', color: 'var(--hari-text-secondary)', lineHeight: 1.6 }}>
        Generate a professional, audit-ready justification summary for a governance decision.
        Suitable for compliance reports, stakeholder communications, and audit logs.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--hari-text-secondary)', textTransform: 'uppercase', marginBottom: '0.375rem', display: 'block' }}>
            Action Description
          </label>
          <input
            value={action}
            onChange={(e) => setAction(e.target.value)}
            placeholder="e.g. Deploy checkout-service v2.4.0 to production"
            style={{
              width: '100%', boxSizing: 'border-box', padding: '0.5rem 0.75rem',
              border: '1px solid var(--hari-border)', borderRadius: '0.5rem', fontSize: '0.8rem', color: 'var(--hari-text)', background: 'var(--hari-surface)',
            }}
          />
        </div>
        <div>
          <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--hari-text-secondary)', textTransform: 'uppercase', marginBottom: '0.375rem', display: 'block' }}>
            Decision
          </label>
          <select value={decisionType} onChange={(e) => setDecisionType(e.target.value as 'approved' | 'rejected')}
            style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--hari-border)', borderRadius: '0.5rem', fontSize: '0.78rem', color: 'var(--hari-text-secondary)', background: 'var(--hari-surface)' }}>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
        <div>
          <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--hari-text-secondary)', textTransform: 'uppercase', marginBottom: '0.375rem', display: 'block' }}>
            Authority Level
          </label>
          <select value={authority} onChange={(e) => setAuthority(e.target.value)}
            style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--hari-border)', borderRadius: '0.5rem', fontSize: '0.78rem', color: 'var(--hari-text-secondary)', background: 'var(--hari-surface)' }}>
            <option value="observe">Observe</option>
            <option value="intervene">Intervene</option>
            <option value="approve">Approve</option>
            <option value="override">Override</option>
          </select>
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--hari-text-secondary)', textTransform: 'uppercase', marginBottom: '0.375rem', display: 'block' }}>
            Decided By
          </label>
          <input
            value={decidedBy}
            onChange={(e) => setDecidedBy(e.target.value)}
            placeholder="e.g. alice@company.com (Platform Lead)"
            style={{
              width: '100%', boxSizing: 'border-box', padding: '0.5rem 0.75rem',
              border: '1px solid var(--hari-border)', borderRadius: '0.5rem', fontSize: '0.8rem', color: 'var(--hari-text)', background: 'var(--hari-surface)',
            }}
          />
        </div>
      </div>

      {/* Precondition status table */}
      <div>
        <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--hari-text-secondary)', textTransform: 'uppercase', marginBottom: '0.375rem', display: 'block' }}>
          Precondition Statuses
        </label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          {preconditions.map((p, i) => (
            <div key={i} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span style={{ flex: 1, fontSize: '0.78rem', color: 'var(--hari-text-secondary)' }}>{p.description}</span>
              <select
                value={p.status}
                onChange={(e) => {
                  const updated = [...preconditions];
                  updated[i] = { ...updated[i], status: e.target.value };
                  setPreconditions(updated);
                }}
                style={{
                  padding: '0.25rem 0.5rem', border: '1px solid var(--hari-border)', borderRadius: '0.375rem',
                  fontSize: '0.72rem', color: statusColors[p.status] ?? '#475569', fontWeight: 700,
                }}
              >
                <option value="met">met</option>
                <option value="unmet">unmet</option>
                <option value="unknown">unknown</option>
                <option value="waived">waived</option>
              </select>
            </div>
          ))}
        </div>
      </div>

      <div>
        <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--hari-text-secondary)', textTransform: 'uppercase', marginBottom: '0.375rem', display: 'block' }}>
          Additional Context (optional)
        </label>
        <textarea
          value={context}
          onChange={(e) => setContext(e.target.value)}
          placeholder="Any additional facts the AI should include in the justification…"
          rows={2}
          style={{
            width: '100%', boxSizing: 'border-box', padding: '0.5rem 0.75rem',
            border: '1px solid var(--hari-border)', borderRadius: '0.5rem', fontSize: '0.8rem',
            color: 'var(--hari-text)', resize: 'vertical', fontFamily: 'inherit', background: 'var(--hari-surface)',
          }}
        />
      </div>

      <button
        onClick={handleGenerate}
        disabled={loading || !action.trim()}
        style={{
          padding: '0.625rem 1.25rem', borderRadius: '0.5rem',
          border: 'none', backgroundColor: loading ? '#93c5fd' : '#2563eb',
          color: '#fff', cursor: loading ? 'not-allowed' : 'pointer',
          fontWeight: 700, fontSize: '0.8rem',
          display: 'flex', alignItems: 'center', gap: '0.375rem',
          alignSelf: 'flex-start',
        }}
      >
        {loading ? <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <FileText size={14} />}
        {loading ? 'Generating…' : 'Generate Justification'}
      </button>

      {loading && <LoadingSpinner message="AI is composing your governance justification…" />}
      {error && <ErrorMessage message={error} />}

      {justification && (
        <div style={{
          border: '1px solid var(--hari-border)', borderRadius: '0.75rem',
          overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        }}>
          <div style={{
            padding: '0.625rem 0.875rem',
            backgroundColor: decisionType === 'approved' ? '#f0fdf4' : '#fef2f2',
            borderBottom: '1px solid var(--hari-border)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontWeight: 700, fontSize: '0.8rem', color: decisionType === 'approved' ? '#15803d' : '#b91c1c' }}>
              {decisionType === 'approved' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
              AI-Generated Justification · {decisionType.toUpperCase()}
            </div>
            <button
              onClick={handleCopy}
              style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--hari-text-secondary)', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.72rem' }}
            >
              {copied ? <Check size={12} color="#16a34a" /> : <Copy size={12} />}
              {copied ? 'Copied!' : 'Copy All'}
            </button>
          </div>
          <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--hari-text-muted)', textTransform: 'uppercase', marginBottom: '0.375rem' }}>Summary</div>
              <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--hari-text)', lineHeight: 1.6 }}>{justification.summary}</p>
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--hari-text-muted)', textTransform: 'uppercase', marginBottom: '0.375rem' }}>Key Decision Points</div>
              <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
                {justification.keyDecisionPoints.map((p, i) => (
                  <li key={i} style={{ fontSize: '0.78rem', color: 'var(--hari-text-secondary)', marginBottom: '0.25rem' }}>{p}</li>
                ))}
              </ul>
            </div>
            <div style={{ padding: '0.625rem 0.75rem', backgroundColor: '#fff7ed', borderRadius: '0.375rem', borderLeft: '3px solid #f59e0b' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#92400e', marginBottom: '0.25rem' }}>Risk Acknowledgement</div>
              <p style={{ margin: 0, fontSize: '0.78rem', color: '#78350f', lineHeight: 1.5 }}>{justification.riskAcknowledgement}</p>
            </div>
            <div style={{ padding: '0.625rem 0.75rem', backgroundColor: 'var(--hari-surface-alt)', borderRadius: '0.375rem', border: '1px solid var(--hari-border)' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--hari-text-muted)', marginBottom: '0.25rem', textTransform: 'uppercase' }}>Audit Trail Note</div>
              <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--hari-text-secondary)', lineHeight: 1.5, fontFamily: 'monospace' }}>{justification.auditTrailNote}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export interface AIGovernancePanelProps {
  ollamaUrl?: string;
  model?: string;
}

export function AIGovernancePanel({ ollamaUrl = 'http://localhost:11434', model = 'llama3.2' }: AIGovernancePanelProps) {
  const [mode, setMode] = React.useState<PanelMode>('suggest');
  const [ollamaOnline, setOllamaOnline] = React.useState<boolean | null>(null);
  const [showConfig, setShowConfig] = React.useState(false);
  const [configUrl, setConfigUrl] = React.useState(ollamaUrl);
  const [configModel, setConfigModel] = React.useState(model);

  const service = React.useMemo(
    () => new AIGovernanceService({ ollamaUrl: configUrl, model: configModel }),
    [configUrl, configModel],
  );

  // Check Ollama availability
  React.useEffect(() => {
    service.isAvailable().then(setOllamaOnline);
    const interval = setInterval(() => service.isAvailable().then(setOllamaOnline), 10_000);
    return () => clearInterval(interval);
  }, [service]);

  const modes: { id: PanelMode; label: string; icon: React.ReactNode; description: string }[] = [
    { id: 'suggest', label: 'Suggest Preconditions', icon: <Sparkles size={14} />, description: 'AI suggests preconditions from action description' },
    { id: 'evaluate', label: 'Evaluate Criticality', icon: <Shield size={14} />, description: 'AI ranks existing preconditions and detects gaps' },
    { id: 'justify', label: 'Generate Justification', icon: <FileText size={14} />, description: 'AI writes audit-ready decision justifications' },
  ];

  return (
    <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif', maxWidth: '900px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.25rem' }}>
            <Brain size={20} color="#7c3aed" />
            <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 800, color: 'var(--hari-text)' }}>
              AI-Assisted Governance
            </h2>
            <span style={{
              fontSize: '0.67rem', fontWeight: 700, backgroundColor: '#f3e8ff', color: '#7c3aed',
              padding: '0.15rem 0.5rem', borderRadius: '999px',
            }}>
              Phase 8.2
            </span>
          </div>
          <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--hari-text-secondary)' }}>
            LLM-powered governance assistance via Ollama — runs locally, no data leaves your network
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {/* Ollama status */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.375rem',
            padding: '0.375rem 0.625rem', borderRadius: '0.5rem',
            border: `1px solid ${ollamaOnline === null ? 'var(--hari-border)' : ollamaOnline ? '#86efac' : '#fca5a5'}`,
            backgroundColor: ollamaOnline === null ? 'var(--hari-surface-alt)' : ollamaOnline ? '#f0fdf4' : '#fef2f2',
            fontSize: '0.72rem', fontWeight: 600,
            color: ollamaOnline === null ? '#94a3b8' : ollamaOnline ? '#15803d' : '#b91c1c',
          }}>
            {ollamaOnline === null ? <Loader size={12} /> : ollamaOnline ? <Wifi size={12} /> : <WifiOff size={12} />}
            {ollamaOnline === null ? 'Checking…' : ollamaOnline ? `Online · ${configModel}` : 'Offline'}
          </div>
          <button
            onClick={() => setShowConfig(!showConfig)}
            style={{
              padding: '0.375rem', borderRadius: '0.375rem',
              border: '1px solid var(--hari-border)', backgroundColor: 'var(--hari-surface-alt)',
              cursor: 'pointer', color: 'var(--hari-text-secondary)', display: 'flex', alignItems: 'center',
            }}
            title="Configure AI endpoint"
          >
            <Settings size={14} />
          </button>
        </div>
      </div>

      {/* Config panel */}
      {showConfig && (
        <div style={{
          padding: '0.875rem 1rem', marginBottom: '1rem',
          backgroundColor: 'var(--hari-surface-alt)', border: '1px solid var(--hari-border)',
          borderRadius: '0.5rem',
        }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--hari-text-secondary)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
            AI Endpoint Configuration
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              value={configUrl}
              onChange={(e) => setConfigUrl(e.target.value)}
              placeholder="http://localhost:11434"
              style={{ flex: 1, padding: '0.5rem', border: '1px solid var(--hari-border)', borderRadius: '0.375rem', fontSize: '0.78rem', color: 'var(--hari-text)', background: 'var(--hari-surface)' }}
            />
            <input
              value={configModel}
              onChange={(e) => setConfigModel(e.target.value)}
              placeholder="llama3.2"
              style={{ width: '120px', padding: '0.5rem', border: '1px solid var(--hari-border)', borderRadius: '0.375rem', fontSize: '0.78rem', color: 'var(--hari-text)', background: 'var(--hari-surface)' }}
            />
            <button
              onClick={() => { setShowConfig(false); service.isAvailable().then(setOllamaOnline); }}
              style={{
                padding: '0.5rem 0.75rem', borderRadius: '0.375rem',
                border: '1px solid #2563eb', backgroundColor: '#2563eb',
                color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: '0.78rem',
                display: 'flex', alignItems: 'center', gap: '0.25rem',
              }}
            >
              <RefreshCw size={12} /> Apply
            </button>
          </div>
        </div>
      )}

      {/* Offline warning */}
      {ollamaOnline === false && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          padding: '0.625rem 0.875rem', marginBottom: '1rem',
          backgroundColor: '#fffbeb', border: '1px solid #fde68a',
          borderRadius: '0.5rem', fontSize: '0.78rem', color: '#92400e',
        }}>
          <Zap size={14} />
          <span>
            Ollama is not reachable at <code>{configUrl}</code>. Run <code>ollama serve</code> and ensure
            model <code>{configModel}</code> is pulled: <code>ollama pull {configModel}</code>
          </span>
        </div>
      )}

      {/* Mode selector */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        {modes.map((m) => (
          <button
            key={m.id}
            onClick={() => setMode(m.id)}
            title={m.description}
            style={{
              padding: '0.5rem 0.875rem', borderRadius: '0.5rem',
              border: `2px solid ${mode === m.id ? '#7c3aed' : 'var(--hari-border)'}`,
              backgroundColor: mode === m.id ? '#7c3aed' : 'var(--hari-surface)',
              color: mode === m.id ? '#fff' : 'var(--hari-text-secondary)',
              cursor: 'pointer', fontWeight: mode === m.id ? 700 : 500, fontSize: '0.8rem',
              display: 'flex', alignItems: 'center', gap: '0.375rem',
              transition: 'all 0.15s',
            }}
          >
            {m.icon} {m.label}
          </button>
        ))}
      </div>

      {/* Active mode */}
      <div style={{ padding: '1.25rem', border: '1px solid var(--hari-border)', borderRadius: '0.75rem', backgroundColor: 'var(--hari-surface)' }}>
        {mode === 'suggest' && <PreconditionSuggester service={service} />}
        {mode === 'evaluate' && <CriticalityEvaluator service={service} />}
        {mode === 'justify' && <JustificationGenerator service={service} />}
      </div>
    </div>
  );
}
