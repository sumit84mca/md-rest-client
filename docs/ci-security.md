# CI Security Rollout

This repository uses a phased rollout to avoid breaking delivery while security checks are introduced.

## Phase 1 (current): Visibility / warn-only

Workflows added:

1. `.github/workflows/ci.yml` (compile + optional lint/test/typecheck scripts)
2. `.github/workflows/dependency-review.yml` (dependency risk scan)
3. `.github/workflows/codeql.yml` (code scanning)
4. `.github/workflows/secret-scan.yml` (gitleaks scan)
5. `.github/dependabot.yml` (npm + action updates)

Phase 1 behavior:

1. Security jobs run with `continue-on-error: true` so they do not block merges.
2. Findings are visible in PR checks and security dashboards.

## Phase 2: Soft enforcement

1. Remove `continue-on-error` from secret scan and dependency review.
2. Keep CodeQL as advisory for one cycle if false positives exist.
3. Enable branch protection required checks for CI + dependency review + secret scan.

## Phase 3: Full enforcement

1. Require CodeQL pass for merge.
2. Pin third-party actions to full commit SHAs.
3. Scope permissions per job to minimum required.
4. Protect publish workflow with environment approval.

## Operational cadence

1. Weekly triage of scan alerts.
2. Weekly review/merge of Dependabot PRs.
3. Monthly workflow hardening review.
