# Security Policy

## Supported Versions

| Version | Supported          |
|---------|--------------------|
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

Only the latest patch release of v1.0.x receives security updates.

---

## Reporting a Vulnerability

**Do NOT open a public GitHub issue for security vulnerabilities.**

If you discover a security vulnerability in HARI, please report it responsibly:

1. **Email:** Send a detailed report to the maintainers via the repository's Security Advisories tab on GitHub (Settings → Security → Advisories → New draft advisory), or contact the repository owner directly.
2. **Include:**
   - A description of the vulnerability and its potential impact.
   - Steps to reproduce the issue.
   - The affected version(s).
   - Any suggested fix or mitigation (optional but appreciated).
3. **Response time:** We aim to acknowledge reports within **48 hours** and provide a fix or mitigation plan within **7 days** for critical issues.

---

## Security Scope

HARI is a **governance runtime**, not an authentication or authorization platform. The following are in scope for security reports:

| In Scope | Out of Scope |
|---|---|
| Schema validation bypass (e.g., rendering without a valid Perception Contract) | Authentication/identity management (delegated to host platform) |
| Authority mode escalation without proper justification | Network-level attacks on transport (SSE/WS) — use TLS in production |
| Audit trail tampering or deletion | Denial-of-service on dev-services (reference implementation only) |
| Decision record manipulation | LLM prompt injection (mitigated by STRICT validation, but LLM security is the provider's responsibility) |
| Governance bridge bypass | Third-party dependency vulnerabilities (report upstream) |

---

## Security Best Practices for HARI Deployments

1. **Always use STRICT validation mode in production.** LENIENT mode is for development only.
2. **Never auto-approve governed actions.** See `ANTI-PATTERNS.md` §4.
3. **Use TLS for all transport connections** (WebSocket, SSE) in production.
4. **Swap SQLite for a production database** (PostgreSQL, etc.) before deploying `@hari/dev-services`.
5. **Pin your dependencies** and audit regularly (`pnpm audit`).
6. **Treat LLM output as untrusted input.** HARI's schema validation is the enforcement layer — do not bypass it.

---

## Disclosure Policy

- Security fixes are released as `PATCH` versions (e.g., 1.0.1).
- The fix is documented in the CHANGELOG after the patch is published.
- Credit is given to the reporter (unless they prefer anonymity).
- We follow [responsible disclosure](https://en.wikipedia.org/wiki/Responsible_disclosure) principles.
