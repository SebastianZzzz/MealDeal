# Contributing

## Branches and commits

- Start work from current `main`: `git switch main && git pull --ff-only`.
- Use `feature/<area>`, `fix/<area>`, or `docs/<area>` branches.
- Keep commits focused and use prefixes such as `feat(profile):`, `fix(plan):`,
  `docs:`, `test:`, and `chore:`.
- Never commit `.env.local`, API keys, generated `.next` output, or raw user
  uploads.
- Open a pull request into `main`; do not push feature work directly to `main`.

## Before opening a PR

```bash
npm ci
npm run lint
npm run build
```

Call out schema migrations, new environment variables, demo data, and any mocked
behavior in the PR description. Rebase or merge the latest `main` before final
integration and resolve shared-contract conflicts together.
