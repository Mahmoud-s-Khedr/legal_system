# 13 — Repository Structure Audit

Audit date: 2026-04-12

## Snapshot

- Canonical tree snapshot: `docs/_inventory/repository-tree.txt`
- Total tracked files scanned (excluding generated directories): 975
- Stale `apps/web` references outside archive scope: 0

## Duplicate / Legacy Areas

- Archived cloud deployment assets are preserved under `archive/cloud/` and should not be used as active runtime paths.
- Desktop runtime resources under `apps/desktop/resources/` are generated/bundled outputs and should remain out of source-truth docs except packaging guides.

## Misplaced Root Artifacts

- None detected.

## Stale Path Reference Classification (`apps/web`)

- None detected outside `archive/cloud/`.

## Top-Level Ownership

- `apps/` — Desktop shell and platform wrappers
- `packages/` — Shippable application code (backend, frontend, shared)
- `docs/` — User/dev/architecture/business documentation
- `scripts/` — Operational, release, and quality tooling scripts
- `tests/` — Cross-package e2e/load tests
- `archive/` — Historical assets not part of active runtime

## Source of Truth

- `docs/_inventory/source-of-truth.md`
- `docs/dev/02-repo-structure.md`
