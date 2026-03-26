## Summary

- Describe the change briefly.

## Validation

- [ ] `pnpm lint`
- [ ] `pnpm typecheck`
- [ ] `pnpm test`

## Windows-First Blocker Audit (Required for `apps/desktop/**` or `packages/backend/**` changes)

- [ ] No hardcoded POSIX-only paths or assumptions in runtime code paths
- [ ] No shell-specific runtime invocation that breaks on Windows (`sh`, `bash`, POSIX wrappers)
- [ ] Executable resolution is Windows-safe (`node.exe`, PostgreSQL `*.exe`, platform-aware fallbacks)
- [ ] Packaging/resource path handling works on Windows path semantics
- [ ] I expect `build-windows` CI (including runtime smoke + installer payload verification) to pass

## Checklist

- [ ] No secrets or private keys committed
- [ ] Migrations included for schema changes
- [ ] i18n updates included where relevant (`en`, `ar`, `fr`)
