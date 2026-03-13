// ─────────────────────────────────────────────────────────────────────────────
// Governance Marketplace — Public API — Phase 8.1
// ─────────────────────────────────────────────────────────────────────────────

export * from './types';
export * from './templates';
export * from './patterns';

import { PRECONDITION_TEMPLATES, getTemplateById, searchTemplates, resolveTemplate } from './templates';
import { AUTHORITY_HIERARCHIES, GOVERNANCE_PATTERNS, getHierarchyById, getPatternById, searchHierarchies, searchPatterns } from './patterns';
import type { GovernancePattern, PreconditionTemplate, AuthorityHierarchy, ResolvedPrecondition } from './types';

// ── Marketplace Registry (in-process) ────────────────────────────────────────

export class GovernanceMarketplace {
  private static _hierarchies = new Map<string, AuthorityHierarchy>(
    AUTHORITY_HIERARCHIES.map((h) => [h.id, h]),
  );
  private static _templates = new Map<string, PreconditionTemplate>(
    PRECONDITION_TEMPLATES.map((t) => [t.id, t]),
  );
  private static _patterns = new Map<string, GovernancePattern>(
    GOVERNANCE_PATTERNS.map((p) => [p.id, p]),
  );

  static get allHierarchies(): AuthorityHierarchy[] {
    return [...this._hierarchies.values()];
  }

  static get allTemplates(): PreconditionTemplate[] {
    return [...this._templates.values()];
  }

  static get allPatterns(): GovernancePattern[] {
    return [...this._patterns.values()];
  }

  // ── CRUD ────────────────────────────────────────────────────────────────

  static registerHierarchy(h: AuthorityHierarchy): void {
    this._hierarchies.set(h.id, h);
  }

  static registerTemplate(t: PreconditionTemplate): void {
    this._templates.set(t.id, t);
  }

  static registerPattern(p: GovernancePattern): void {
    this._patterns.set(p.id, p);
  }

  // ── Lookup ───────────────────────────────────────────────────────────────

  static hierarchy(id: string) {
    return getHierarchyById(id) ?? this._hierarchies.get(id);
  }

  static template(id: string) {
    return getTemplateById(id) ?? this._templates.get(id);
  }

  static pattern(id: string) {
    return getPatternById(id) ?? this._patterns.get(id);
  }

  // ── Search ───────────────────────────────────────────────────────────────

  static search(query: string, type: 'hierarchy' | 'template' | 'pattern' | 'all' = 'all', category?: string) {
    const results: Array<{ type: string; item: AuthorityHierarchy | PreconditionTemplate | GovernancePattern }> = [];

    if (type === 'all' || type === 'hierarchy') {
      searchHierarchies(query, category).forEach((h) =>
        results.push({ type: 'hierarchy', item: h }),
      );
    }
    if (type === 'all' || type === 'template') {
      searchTemplates(query, category).forEach((t) =>
        results.push({ type: 'template', item: t }),
      );
    }
    if (type === 'all' || type === 'pattern') {
      searchPatterns(query, category).forEach((p) =>
        results.push({ type: 'pattern', item: p }),
      );
    }

    return results;
  }

  // ── Pattern Application ───────────────────────────────────────────────────

  /**
   * Apply a governance pattern — returns the resolved hierarchy + preconditions
   * ready to be injected into a GovernedAction.
   */
  static applyPattern(
    patternId: string,
    slotOverrides: Record<string, Record<string, string>> = {},
  ): {
    pattern: GovernancePattern;
    hierarchy: AuthorityHierarchy;
    resolvedPreconditions: ResolvedPrecondition[];
  } | null {
    const pattern = this.pattern(patternId);
    if (!pattern) return null;

    const hierarchy = this.hierarchy(pattern.authorityHierarchyId);
    if (!hierarchy) return null;

    const resolvedPreconditions: ResolvedPrecondition[] = [];

    for (const ref of pattern.preconditionTemplates) {
      const template = this.template(ref.templateId);
      if (!template) continue;

      const userSlots = slotOverrides[ref.templateId] ?? {};
      const mergedSlots = { ...ref.slotOverrides, ...userSlots };
      const resolved = resolveTemplate(template, mergedSlots);

      resolvedPreconditions.push({
        ...resolved,
        status: 'unknown',
        fromTemplate: ref.templateId,
        criticality: template.criticality,
      });
    }

    return { pattern, hierarchy, resolvedPreconditions };
  }

  // ── Stats ────────────────────────────────────────────────────────────────

  static get stats() {
    return {
      hierarchies: this._hierarchies.size,
      templates: this._templates.size,
      patterns: this._patterns.size,
      total: this._hierarchies.size + this._templates.size + this._patterns.size,
    };
  }
}

// Convenience re-exports
export { GovernanceMarketplace as marketplace };
