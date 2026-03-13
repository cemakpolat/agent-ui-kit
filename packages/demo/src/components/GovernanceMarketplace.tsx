import React from 'react';
import {
  GovernanceMarketplace,
  telemetry,
} from '@hari/core';
import type {
  AuthorityHierarchy,
  PreconditionTemplate,
  GovernancePattern,
} from '@hari/core';
import {
  Store,
  Search,
  Shield,
  CheckSquare,
  Layers,
  Download,
  Star,
  Tag,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  Filter,
  Info,
  AlertTriangle,
  Lock,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Phase 8.1 — Governance Marketplace UI
//
// Browse and import reusable governance artifacts:
//   - Authority hierarchies  (who can do what at each escalation level)
//   - Precondition templates (fill-in-the-blank precondition definitions)
//   - Governance patterns    (bundled hierarchy + preconditions for a domain)
// ─────────────────────────────────────────────────────────────────────────────

type TabType = 'patterns' | 'hierarchies' | 'templates';

type CategoryBadgeColor = {
  bg: string;
  fg: string;
};

const CATEGORY_COLORS: Record<string, CategoryBadgeColor> = {
  deployment:       { bg: '#dbeafe', fg: '#1d4ed8' },
  security:         { bg: '#fce7f3', fg: '#be185d' },
  finance:          { bg: '#dcfce7', fg: '#15803d' },
  'incident-response': { bg: '#fee2e2', fg: '#b91c1c' },
  compliance:       { bg: '#f3e8ff', fg: '#7c3aed' },
  legal:            { bg: '#fef3c7', fg: '#92400e' },
  hr:               { bg: '#e0f2fe', fg: '#0369a1' },
  devops:           { bg: '#f1f5f9', fg: '#475569' },
  iot:              { bg: '#fefce8', fg: '#854d0e' },
  general:          { bg: '#f0fdf4', fg: '#166534' },
};

const CRITICALITY_COLORS: Record<string, { bg: string; fg: string }> = {
  low:      { bg: '#f0fdf4', fg: '#166534' },
  medium:   { bg: '#fefce8', fg: '#854d0e' },
  high:     { bg: '#fff7ed', fg: '#9a3412' },
  critical: { bg: '#fef2f2', fg: '#991b1b' },
};

function CategoryBadge({ category }: { category: string }) {
  const colors = CATEGORY_COLORS[category] ?? { bg: '#f1f5f9', fg: '#475569' };
  return (
    <span style={{
      padding: '0.15rem 0.5rem',
      borderRadius: '999px',
      fontSize: '0.65rem',
      fontWeight: 700,
      letterSpacing: '0.02em',
      backgroundColor: colors.bg,
      color: colors.fg,
      textTransform: 'capitalize',
    }}>
      {category.replace(/-/g, ' ')}
    </span>
  );
}

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = React.useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      onClick={handleCopy}
      title={`Copy ${label ?? 'ID'}`}
      style={{
        border: 'none', background: 'none', cursor: 'pointer',
        color: copied ? '#15803d' : '#94a3b8', display: 'flex', alignItems: 'center', gap: '0.25rem',
        fontSize: '0.7rem', padding: '0.1rem 0.3rem',
      }}
    >
      {copied ? <Check size={11} /> : <Copy size={11} />}
      {copied ? 'Copied!' : label ?? text}
    </button>
  );
}

// ── Pattern Card ──────────────────────────────────────────────────────────────

function PatternCard({
  pattern,
  onImport,
}: {
  pattern: GovernancePattern;
  onImport: (p: GovernancePattern) => void;
}) {
  const [expanded, setExpanded] = React.useState(false);

  return (
    <div style={{
      border: '1px solid var(--hari-border)',
      borderRadius: '0.75rem',
      backgroundColor: 'var(--hari-surface)',
      overflow: 'hidden',
      boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
      transition: 'box-shadow 0.15s',
    }}>
      <div style={{ padding: '1rem 1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <Layers size={14} color="#6d28d9" />
              <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--hari-text)' }}>{pattern.name}</span>
              <CategoryBadge category={pattern.category} />
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--hari-text-secondary)', margin: 0, lineHeight: 1.5 }}>
              {pattern.description}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.375rem', flexShrink: 0 }}>
            <button
              onClick={() => onImport(pattern)}
              style={{
                padding: '0.375rem 0.75rem',
                borderRadius: '0.5rem',
                border: '1px solid #6d28d9',
                backgroundColor: '#6d28d9',
                color: '#fff',
                cursor: 'pointer',
                fontSize: '0.72rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
              }}
            >
              <Download size={11} /> Apply
            </button>
            <button
              onClick={() => setExpanded(!expanded)}
              style={{
                padding: '0.375rem',
                borderRadius: '0.5rem',
                border: '1px solid var(--hari-border)',
                backgroundColor: 'var(--hari-surface-alt)',
                cursor: 'pointer',
                color: 'var(--hari-text-secondary)',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.625rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.67rem', color: 'var(--hari-text-muted)' }}>
            <Shield size={10} style={{ verticalAlign: 'middle', marginRight: '2px' }} />
            hierarchy: <code style={{ color: '#6d28d9' }}>{pattern.authorityHierarchyId}</code>
          </span>
          <span style={{ fontSize: '0.67rem', color: 'var(--hari-text-muted)' }}>
            <CheckSquare size={10} style={{ verticalAlign: 'middle', marginRight: '2px' }} />
            {pattern.preconditionTemplates.length} preconditions
          </span>
          {pattern.complianceFrameworks.length > 0 && (
            <span style={{ fontSize: '0.67rem', color: 'var(--hari-text-muted)' }}>
              <Lock size={10} style={{ verticalAlign: 'middle', marginRight: '2px' }} />
              {pattern.complianceFrameworks.join(', ')}
            </span>
          )}
        </div>

        {pattern.tags.length > 0 && (
          <div style={{ display: 'flex', gap: '0.25rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
            {pattern.tags.map((tag) => (
              <span key={tag} style={{
                padding: '0.1rem 0.4rem',
                borderRadius: '999px',
                fontSize: '0.6rem',
                backgroundColor: 'var(--hari-surface-alt)',
                color: 'var(--hari-text-secondary)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.15rem',
              }}>
                <Tag size={9} /> {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {expanded && (
        <div style={{
          borderTop: '1px solid var(--hari-border)',
          backgroundColor: 'var(--hari-surface-alt)',
          padding: '0.875rem 1.25rem',
        }}>
          {pattern.longDescription && (
            <p style={{ fontSize: '0.78rem', color: 'var(--hari-text-secondary)', marginTop: 0, lineHeight: 1.6 }}>
              {pattern.longDescription}
            </p>
          )}
          {pattern.exampleUseCases.length > 0 && (
            <div style={{ marginBottom: '0.75rem' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--hari-text-muted)', textTransform: 'uppercase', marginBottom: '0.375rem' }}>
                Example Use Cases
              </div>
              <ul style={{ listStyle: 'disc', paddingLeft: '1.25rem', margin: 0 }}>
                {pattern.exampleUseCases.map((uc, i) => (
                  <li key={i} style={{ fontSize: '0.78rem', color: 'var(--hari-text-secondary)', marginBottom: '0.25rem' }}>{uc}</li>
                ))}
              </ul>
            </div>
          )}
          <div>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--hari-text-muted)', textTransform: 'uppercase', marginBottom: '0.375rem' }}>
              Bundled Precondition Templates
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              {pattern.preconditionTemplates.map((ref, i) => {
                const tmpl = GovernanceMarketplace.template(ref.templateId);
                return (
                  <div key={i} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.25rem 0.5rem',
                    borderRadius: '0.375rem',
                    backgroundColor: ref.required ? '#fef2f2' : 'var(--hari-surface-alt)',
                    fontSize: '0.75rem',
                    color: 'var(--hari-text-secondary)',
                  }}>
                    <CheckSquare size={11} color={ref.required ? '#dc2626' : '#94a3b8'} />
                    <span style={{ flex: 1 }}>{tmpl?.name ?? ref.templateId}</span>
                    {ref.required && (
                      <span style={{ fontSize: '0.6rem', color: '#dc2626', fontWeight: 700 }}>required</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.67rem', color: 'var(--hari-text-muted)' }}>ID:</span>
            <CopyButton text={pattern.id} label={pattern.id} />
            <span style={{ fontSize: '0.67rem', color: 'var(--hari-text-muted)', marginLeft: 'auto' }}>
              v{pattern.provenance.version} · {pattern.provenance.licence}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Hierarchy Card ───────────────────────────────────────────────────────────

function HierarchyCard({
  hierarchy,
  onImport,
}: {
  hierarchy: AuthorityHierarchy;
  onImport: (h: AuthorityHierarchy) => void;
}) {
  const [expanded, setExpanded] = React.useState(false);

  const modeColors: Record<string, { bg: string; fg: string }> = {
    observe:   { bg: '#eff6ff', fg: '#1d4ed8' },
    intervene: { bg: '#fef9c3', fg: '#854d0e' },
    approve:   { bg: '#fefce8', fg: '#92400e' },
    override:  { bg: '#fef2f2', fg: '#991b1b' },
  };

  return (
    <div style={{
      border: '1px solid var(--hari-border)', borderRadius: '0.75rem',
      backgroundColor: 'var(--hari-surface)', overflow: 'hidden',
      boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
    }}>
      <div style={{ padding: '1rem 1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <Shield size={14} color="#2563eb" />
              <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--hari-text)' }}>{hierarchy.name}</span>
              <CategoryBadge category={hierarchy.category} />
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--hari-text-secondary)', margin: 0, lineHeight: 1.5 }}>
              {hierarchy.description}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.375rem', flexShrink: 0 }}>
            <button
              onClick={() => onImport(hierarchy)}
              style={{
                padding: '0.375rem 0.75rem', borderRadius: '0.5rem',
                border: '1px solid #2563eb', backgroundColor: '#2563eb',
                color: '#fff', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: '0.25rem',
              }}
            >
              <Download size={11} /> Apply
            </button>
            <button
              onClick={() => setExpanded(!expanded)}
              style={{
                padding: '0.375rem', borderRadius: '0.5rem',
                border: '1px solid var(--hari-border)', backgroundColor: 'var(--hari-surface-alt)',
                cursor: 'pointer', color: 'var(--hari-text-secondary)', display: 'flex', alignItems: 'center',
              }}
            >
              {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
          </div>
        </div>

        {/* Miniature escalation chain */}
        <div style={{ display: 'flex', gap: '0.25rem', marginTop: '0.75rem', alignItems: 'center' }}>
          {hierarchy.levels.map((level, i) => {
            const colors = modeColors[level.mode] ?? { bg: '#f1f5f9', fg: '#475569' };
            return (
              <React.Fragment key={level.mode}>
                <span style={{
                  padding: '0.2rem 0.5rem', borderRadius: '0.375rem', fontSize: '0.67rem', fontWeight: 700,
                  backgroundColor: colors.bg, color: colors.fg,
                }}>
                  {level.label}
                </span>
                {i < hierarchy.levels.length - 1 && (
                  <ChevronRight size={12} color="#cbd5e1" />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {expanded && (
        <div style={{
          borderTop: '1px solid var(--hari-border)',
          backgroundColor: 'var(--hari-surface-alt)',
          padding: '0.875rem 1.25rem',
        }}>
          {hierarchy.rationale && (
            <div style={{ marginBottom: '0.75rem', padding: '0.5rem 0.75rem', backgroundColor: '#eff6ff', borderRadius: '0.375rem', borderLeft: '3px solid #3b82f6' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#1d4ed8', marginBottom: '0.25rem' }}>Design Rationale</div>
              <p style={{ fontSize: '0.75rem', color: 'var(--hari-text-secondary)', margin: 0, lineHeight: 1.5 }}>{hierarchy.rationale}</p>
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {hierarchy.levels.map((level) => {
              const colors = modeColors[level.mode] ?? { bg: '#f1f5f9', fg: '#475569' };
              return (
                <div key={level.mode} style={{
                  padding: '0.625rem 0.875rem', borderRadius: '0.5rem',
                  border: `1px solid ${colors.bg}`, backgroundColor: colors.bg,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.8rem', color: colors.fg }}>{level.label}</span>
                    <code style={{ fontSize: '0.65rem', color: 'var(--hari-text-muted)', backgroundColor: '#ffffff80', padding: '0.1rem 0.3rem', borderRadius: '0.25rem' }}>
                      {level.mode}
                    </code>
                    {level.requiresDualAuthorisation && (
                      <span style={{ fontSize: '0.6rem', color: '#dc2626', fontWeight: 700, backgroundColor: '#fee2e2', padding: '0.1rem 0.35rem', borderRadius: '999px' }}>
                        dual-auth
                      </span>
                    )}
                    {level.requiresJustification && (
                      <span style={{ fontSize: '0.6rem', color: '#92400e', fontWeight: 700, backgroundColor: '#fef3c7', padding: '0.1rem 0.35rem', borderRadius: '999px' }}>
                        justification req.
                      </span>
                    )}
                  </div>
                  {level.allowedRoles.length > 0 && (
                    <div style={{ fontSize: '0.7rem', color: 'var(--hari-text-secondary)' }}>
                      Roles: {level.allowedRoles.join(' · ')}
                    </div>
                  )}
                  {level.maxDuration && (
                    <div style={{ fontSize: '0.7rem', color: 'var(--hari-text-secondary)' }}>
                      Max duration: {level.maxDuration}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {hierarchy.autoDowngrade.enabled && (
            <div style={{ marginTop: '0.5rem', fontSize: '0.72rem', color: 'var(--hari-text-secondary)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <AlertTriangle size={11} color="#f59e0b" />
              Auto-downgrade to <strong>{hierarchy.autoDowngrade.targetMode}</strong> after {hierarchy.autoDowngrade.afterDuration}
            </div>
          )}
          <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <CopyButton text={hierarchy.id} label={hierarchy.id} />
            <span style={{ fontSize: '0.67rem', color: 'var(--hari-text-muted)', marginLeft: 'auto' }}>
              v{hierarchy.provenance.version} · {hierarchy.provenance.licence}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Template Card ─────────────────────────────────────────────────────────────

function TemplateCard({
  template,
  onImport,
}: {
  template: PreconditionTemplate;
  onImport: (t: PreconditionTemplate) => void;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const critColors = CRITICALITY_COLORS[template.criticality] ?? CRITICALITY_COLORS.medium;

  return (
    <div style={{
      border: '1px solid var(--hari-border)', borderRadius: '0.75rem',
      backgroundColor: 'var(--hari-surface)', overflow: 'hidden',
      boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
    }}>
      <div style={{ padding: '1rem 1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <CheckSquare size={14} color="#059669" />
              <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--hari-text)' }}>{template.name}</span>
              <CategoryBadge category={template.category} />
              <span style={{
                padding: '0.15rem 0.5rem', borderRadius: '999px', fontSize: '0.6rem', fontWeight: 700,
                backgroundColor: critColors.bg, color: critColors.fg,
              }}>
                {template.criticality}
              </span>
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--hari-text-secondary)', margin: 0, lineHeight: 1.5 }}>
              {template.description}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.375rem', flexShrink: 0 }}>
            <button
              onClick={() => onImport(template)}
              style={{
                padding: '0.375rem 0.75rem', borderRadius: '0.5rem',
                border: '1px solid #059669', backgroundColor: '#059669',
                color: '#fff', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: '0.25rem',
              }}
            >
              <Download size={11} /> Use
            </button>
            <button
              onClick={() => setExpanded(!expanded)}
              style={{
                padding: '0.375rem', borderRadius: '0.5rem',
                border: '1px solid var(--hari-border)', backgroundColor: 'var(--hari-surface-alt)',
                cursor: 'pointer', color: 'var(--hari-text-secondary)', display: 'flex', alignItems: 'center',
              }}
            >
              {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
          </div>
        </div>

        {template.tags.length > 0 && (
          <div style={{ display: 'flex', gap: '0.25rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
            {template.tags.map((tag) => (
              <span key={tag} style={{
                padding: '0.1rem 0.4rem', borderRadius: '999px', fontSize: '0.6rem',
                backgroundColor: 'var(--hari-surface-alt)', color: 'var(--hari-text-secondary)',
                display: 'flex', alignItems: 'center', gap: '0.15rem',
              }}>
                <Tag size={9} /> {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {expanded && (
        <div style={{
          borderTop: '1px solid var(--hari-border)',
          backgroundColor: 'var(--hari-surface-alt)',
          padding: '0.875rem 1.25rem',
        }}>
          <div style={{ marginBottom: '0.625rem' }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--hari-text-muted)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
              Template String
            </div>
            <div style={{
              fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--hari-text)',
              backgroundColor: 'var(--hari-surface-alt)', padding: '0.5rem 0.75rem', borderRadius: '0.5rem',
              border: '1px solid var(--hari-border)', lineHeight: 1.6,
            }}>
              {template.template.description}
            </div>
          </div>
          {template.template.verificationMethod && (
            <div style={{ marginBottom: '0.5rem' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--hari-text-muted)', textTransform: 'uppercase', marginBottom: '0.2rem' }}>
                Verification
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--hari-text-secondary)' }}>{template.template.verificationMethod}</div>
            </div>
          )}
          {template.template.resolution && (
            <div style={{ marginBottom: '0.5rem' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--hari-text-muted)', textTransform: 'uppercase', marginBottom: '0.2rem' }}>
                Resolution
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--hari-text-secondary)' }}>{template.template.resolution}</div>
            </div>
          )}
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '0.5rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--hari-text-muted)' }}>
              Waiver: <strong>{template.minimumWaiverAuthority}</strong>
            </span>
            {template.applicableActionTypes.length > 0 && (
              <span style={{ fontSize: '0.7rem', color: 'var(--hari-text-muted)' }}>
                Actions: {template.applicableActionTypes.join(', ')}
              </span>
            )}
            <CopyButton text={template.id} label={template.id} />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export interface GovernanceMarketplaceProps {
  onPatternApplied?: (patternId: string) => void;
  onHierarchyApplied?: (hierarchyId: string) => void;
  onTemplateUsed?: (templateId: string) => void;
}

export function GovernanceMarketplacePanel({
  onPatternApplied,
  onHierarchyApplied,
  onTemplateUsed,
}: GovernanceMarketplaceProps) {
  const [activeTab, setActiveTab] = React.useState<TabType>('patterns');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [categoryFilter, setCategoryFilter] = React.useState('');
  const [importedItems, setImportedItems] = React.useState<string[]>([]);
  const [notification, setNotification] = React.useState<string | null>(null);

  const stats = GovernanceMarketplace.stats;

  // Filter data
  const patterns = React.useMemo(
    () => GovernanceMarketplace.allPatterns.filter((p) => {
      const q = searchQuery.toLowerCase();
      const matchQ = !q || p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q) || p.tags.some((t) => t.includes(q));
      const matchC = !categoryFilter || p.category === categoryFilter;
      return matchQ && matchC;
    }),
    [searchQuery, categoryFilter],
  );

  const hierarchies = React.useMemo(
    () => GovernanceMarketplace.allHierarchies.filter((h) => {
      const q = searchQuery.toLowerCase();
      const matchQ = !q || h.name.toLowerCase().includes(q) || h.description.toLowerCase().includes(q);
      const matchC = !categoryFilter || h.category === categoryFilter;
      return matchQ && matchC;
    }),
    [searchQuery, categoryFilter],
  );

  const templates = React.useMemo(
    () => GovernanceMarketplace.allTemplates.filter((t) => {
      const q = searchQuery.toLowerCase();
      const matchQ = !q || t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q) || t.tags.some((tag) => tag.includes(q));
      const matchC = !categoryFilter || t.category === categoryFilter;
      return matchQ && matchC;
    }),
    [searchQuery, categoryFilter],
  );

  const notify = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  const handlePatternImport = (pattern: GovernancePattern) => {
    setImportedItems((prev) => [...new Set([...prev, pattern.id])]);
    telemetry.emit({
      type: 'governance:marketplace_imported',
      itemType: 'pattern',
      itemId: pattern.id,
      itemName: pattern.name,
      timestamp: new Date().toISOString(),
    });
    onPatternApplied?.(pattern.id);
    notify(`Pattern "${pattern.name}" applied`);
  };

  const handleHierarchyImport = (hierarchy: AuthorityHierarchy) => {
    setImportedItems((prev) => [...new Set([...prev, hierarchy.id])]);
    telemetry.emit({
      type: 'governance:marketplace_imported',
      itemType: 'hierarchy',
      itemId: hierarchy.id,
      itemName: hierarchy.name,
      timestamp: new Date().toISOString(),
    });
    onHierarchyApplied?.(hierarchy.id);
    notify(`Hierarchy "${hierarchy.name}" applied`);
  };

  const handleTemplateImport = (template: PreconditionTemplate) => {
    setImportedItems((prev) => [...new Set([...prev, template.id])]);
    telemetry.emit({
      type: 'governance:marketplace_imported',
      itemType: 'template',
      itemId: template.id,
      itemName: template.name,
      timestamp: new Date().toISOString(),
    });
    onTemplateUsed?.(template.id);
    notify(`Template "${template.name}" added`);
  };

  const tabs: { id: TabType; label: string; icon: React.ReactNode; count: number }[] = [
    { id: 'patterns', label: 'Patterns', icon: <Layers size={14} />, count: stats.patterns },
    { id: 'hierarchies', label: 'Hierarchies', icon: <Shield size={14} />, count: stats.hierarchies },
    { id: 'templates', label: 'Templates', icon: <CheckSquare size={14} />, count: stats.templates },
  ];

  const categories = React.useMemo(() => {
    const all = [
      ...GovernanceMarketplace.allPatterns.map((p) => p.category),
      ...GovernanceMarketplace.allHierarchies.map((h) => h.category),
      ...GovernanceMarketplace.allTemplates.map((t) => t.category),
    ];
    return [...new Set(all)].sort();
  }, []);

  return (
    <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif', maxWidth: '900px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
          <Store size={20} color="#6d28d9" />
          <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 800, color: 'var(--hari-text)' }}>
            Governance Marketplace
          </h2>
          <span style={{
            fontSize: '0.67rem', fontWeight: 700, backgroundColor: '#f3e8ff', color: '#7c3aed',
            padding: '0.15rem 0.5rem', borderRadius: '999px',
          }}>
            Phase 8.1
          </span>
        </div>
        <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--hari-text-secondary)', lineHeight: 1.5 }}>
          Reusable governance artifacts — apply authority hierarchies, precondition templates, and
          complete patterns to any governed action. All items are versioned, licensed, and traceable.
        </p>

        {/* Stats bar */}
        <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.75rem' }}>
          {[
            { label: 'Patterns', value: stats.patterns, color: '#6d28d9' },
            { label: 'Hierarchies', value: stats.hierarchies, color: '#2563eb' },
            { label: 'Templates', value: stats.templates, color: '#059669' },
            { label: 'Total Items', value: stats.total, color: 'var(--hari-text)' },
            { label: 'Applied', value: importedItems.length, color: '#dc2626' },
          ].map(({ label, value, color }) => (
            <div key={label}>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color }}>{value}</div>
              <div style={{ fontSize: '0.67rem', color: 'var(--hari-text-muted)' }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Notification toast */}
      {notification && (
        <div style={{
          position: 'fixed', top: '1rem', right: '1rem', zIndex: 1000,
          padding: '0.625rem 1rem',
          backgroundColor: '#1e293b', color: '#fff',
          borderRadius: '0.5rem', fontSize: '0.8rem', fontWeight: 600,
          display: 'flex', alignItems: 'center', gap: '0.375rem',
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
          animation: 'fadeIn 0.2s ease',
        }}>
          <Check size={14} color="#34d399" /> {notification}
        </div>
      )}

      {/* Search + Filter bar */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, border: '1px solid var(--hari-border)', borderRadius: '0.5rem', padding: '0.375rem 0.75rem', backgroundColor: 'var(--hari-surface)' }}>
          <Search size={14} color="#94a3b8" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search patterns, templates, hierarchies…"
            style={{ border: 'none', outline: 'none', flex: 1, fontSize: '0.8rem', color: 'var(--hari-text)', backgroundColor: 'transparent' }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', border: '1px solid var(--hari-border)', borderRadius: '0.5rem', padding: '0.375rem 0.625rem', backgroundColor: 'var(--hari-surface)' }}>
          <Filter size={13} color="#94a3b8" />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            style={{ border: 'none', outline: 'none', fontSize: '0.78rem', color: 'var(--hari-text-secondary)', backgroundColor: 'transparent', cursor: 'pointer' }}
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c.replace(/-/g, ' ')}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1rem', borderBottom: '1px solid var(--hari-border)' }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '0.5rem 1rem',
              border: 'none', background: 'none',
              cursor: 'pointer', fontSize: '0.8rem',
              fontWeight: activeTab === tab.id ? 700 : 500,
              color: activeTab === tab.id ? '#6d28d9' : '#64748b',
              borderBottom: activeTab === tab.id ? '2px solid #6d28d9' : '2px solid transparent',
              display: 'flex', alignItems: 'center', gap: '0.375rem',
              marginBottom: '-1px',
            }}
          >
            {tab.icon}
            {tab.label}
            <span style={{
              padding: '0.1rem 0.4rem', borderRadius: '999px', fontSize: '0.6rem', fontWeight: 700,
              backgroundColor: activeTab === tab.id ? '#f3e8ff' : '#f1f5f9',
              color: activeTab === tab.id ? '#6d28d9' : '#94a3b8',
            }}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Info banner */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: '0.5rem',
        padding: '0.5rem 0.75rem', borderRadius: '0.375rem',
        backgroundColor: '#f0f9ff', border: '1px solid #bae6fd',
        marginBottom: '1rem', fontSize: '0.75rem', color: '#0369a1',
      }}>
        <Info size={13} style={{ marginTop: '1px', flexShrink: 0 }} />
        <span>
          {activeTab === 'patterns' && 'Governance patterns bundle an authority hierarchy with precondition templates for a complete governance stance.'}
          {activeTab === 'hierarchies' && 'Authority hierarchies define who can escalate to which mode, with optional dual-auth and auto-downgrade rules.'}
          {activeTab === 'templates' && 'Precondition templates use {{slots}} that you fill with context-specific values when applying them to an action.'}
        </span>
      </div>

      {/* Content */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {activeTab === 'patterns' && (
          patterns.length === 0
            ? <div style={{ textAlign: 'center', color: 'var(--hari-text-muted)', padding: '2rem', fontSize: '0.8rem' }}>No patterns match your search.</div>
            : patterns.map((p) => (
              <PatternCard key={p.id} pattern={p} onImport={handlePatternImport} />
            ))
        )}
        {activeTab === 'hierarchies' && (
          hierarchies.length === 0
            ? <div style={{ textAlign: 'center', color: 'var(--hari-text-muted)', padding: '2rem', fontSize: '0.8rem' }}>No hierarchies match your search.</div>
            : hierarchies.map((h) => (
              <HierarchyCard key={h.id} hierarchy={h} onImport={handleHierarchyImport} />
            ))
        )}
        {activeTab === 'templates' && (
          templates.length === 0
            ? <div style={{ textAlign: 'center', color: 'var(--hari-text-muted)', padding: '2rem', fontSize: '0.8rem' }}>No templates match your search.</div>
            : templates.map((t) => (
              <TemplateCard key={t.id} template={t} onImport={handleTemplateImport} />
            ))
        )}
      </div>

      {/* Footer */}
      <div style={{
        marginTop: '2rem', padding: '0.75rem 1rem',
        backgroundColor: 'var(--hari-surface-alt)', borderRadius: '0.5rem',
        border: '1px solid var(--hari-border)', fontSize: '0.72rem', color: 'var(--hari-text-muted)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span>
          <Star size={11} style={{ verticalAlign: 'middle' }} /> Built-in library · {stats.total} items · MIT Licensed
        </span>
        <span>
          Community contributions: <code>@hari/marketplace-*</code> npm packages
        </span>
      </div>
    </div>
  );
}
