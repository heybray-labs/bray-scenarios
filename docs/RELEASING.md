# Releasing

## CI (every PR and push to `main`)

[`.github/workflows/ci.yml`](../.github/workflows/ci.yml) runs on every PR into `main` and on every push to `main`:

- `npm run typecheck` — type-checks both `client` and `server`
- `npm run build --workspace=client` — production Vite build
- `npm run db:migrate` — applies committed SQL migrations against a fresh Postgres service
- `npm run test --workspace=server` — API smoke tests (Vitest + Supertest against Postgres)
- a Docker build smoke test (build only, no push) — catches `Dockerfile` breakage

All of these must pass before merging.

## Database migrations

Schema changes use versioned SQL in [`server/drizzle/`](../server/drizzle/). On every app start (Docker or native), pending migrations run automatically before the server accepts traffic.

**When changing `shared/schemas/`:**

1. Run `npm run db:generate` and commit the new files under `server/drizzle/`
2. Review generated SQL in the PR (watch for accidental `DROP COLUMN`)
3. CI applies all migrations on a fresh Postgres database

Operator upgrade flow: [UPGRADING.md](UPGRADING.md).

## Cutting a release

Releases are triggered by pushing a version tag. From an up-to-date `main`:

```bash
git checkout main && git pull
npm version patch   # or: minor / major
git push --follow-tags
```

Use **`npm version minor`** for releases that change operator-visible behavior (e.g. the first migration-based release, new upgrade scripts, or breaking upgrade steps). Use **patch** for bug fixes and **major** for incompatible API or config changes.

`npm version` bumps the root `package.json`, commits, and creates a `vX.Y.Z` tag. Pushing that tag runs [`.github/workflows/release.yml`](../.github/workflows/release.yml), which:

1. Re-runs the typecheck/build gate and API smoke tests as a safety net.
2. Builds and pushes the Docker image to `ghcr.io/heybray-labs/bray-scenarios`, tagged `X.Y.Z`, `X.Y`, `X`, and `latest`.
3. Creates a GitHub Release for the tag with auto-generated notes from merged PRs/commits since the last release.

### Release notes (migrations and upgrades)

When shipping schema or upgrade changes, add to the GitHub Release description:

- Automatic migrations on container start (no manual `db:migrate` for Docker installs)
- Link to [UPGRADING.md](UPGRADING.md)
- For quickstart operators: `./upgrade-backup.sh` before upgrade, re-run quickstart with `BRAY_IMAGE_TAG`, then `./upgrade-verify.sh`

Example operator summary:

> Upgrading from 1.0.x: run `./upgrade-backup.sh`, then re-run quickstart with `BRAY_IMAGE_TAG=<new version>`, then `./upgrade-verify.sh`.

## Pulling the image

The GHCR package must be **public** for the one-line quick start (`curl ... | bash`) to work without authentication.

**One-time org admin step:** GitHub → **heybray-labs** → **Packages** → `bray-scenarios` → **Package settings** → set visibility to **Public**.

Verify anonymous pull:

```bash
docker pull ghcr.io/heybray-labs/bray-scenarios:latest
```

Pull a specific release:

```bash
docker pull ghcr.io/heybray-labs/bray-scenarios:1.2.0
```

If the package is private, authenticate first:

```bash
echo "$GITHUB_TOKEN" | docker login ghcr.io -u <github-username> --password-stdin
docker pull ghcr.io/heybray-labs/bray-scenarios:1.2.0
```

Use a PAT (classic or fine-grained) with `read:packages` scope, or the deploy environment's own GitHub App/token if it authenticates as a collaborator on the repo.

## Token permissions

Both jobs that need write access (`docker-publish`, `github-release`) declare their own permissions at the top of [`release.yml`](../.github/workflows/release.yml):

```yaml
permissions:
  contents: write   # create the GitHub Release
  packages: write   # push the image to GHCR
```

An explicit `permissions:` block overrides the repo/org **default workflow permissions** setting, so releases work even though this repo's default is read-only (locked org-wide by `heybray-labs` — the **Settings → Actions → General → Workflow permissions** radio is intentionally grayed out and does not need changing).

The only scenario that would still block a release is an org-level *maximum* token restriction. If the first tagged release ever fails on `docker-publish` or `github-release` with a `403` / permission-denied error, a `heybray-labs` org owner must adjust **Organization Settings → Actions → General → Workflow permissions**. This can't be changed at the repo level.
