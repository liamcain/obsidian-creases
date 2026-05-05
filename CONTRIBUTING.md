# Contributing & Releasing

This document describes how releases are cut for the **Creases** plugin (`id: creases`). For commit conventions see [AGENTS.md](AGENTS.md); for build/test expectations see [BUILD.md](BUILD.md).

## Release model

Releases are **tag-driven**, but the tag itself is produced by `standard-version` rather than created by hand. The flow:

1. You merge a series of well-formed Conventional Commits into `main` (`feat:`, `fix:`, `perf:`, etc.).
2. You run `pnpm run release`. `standard-version` walks the commits since the last tag, decides the next version, bumps `manifest.json` + `package.json`, regenerates `CHANGELOG.md`, makes a single `chore(release): X.Y.Z` commit, and tags it.
3. You push the branch and the tag.
4. The tag triggers [`.github/workflows/publish.yml`](.github/workflows/publish.yml), which builds the plugin and creates a GitHub Release with the artifacts attached.

Tags are unprefixed (`0.7.0`, not `v0.7.0`) per the `"standard-version": { "t": "" }` config in [`package.json`](package.json).

Existing tags, newest first: `0.7.0`, `0.6.6`, `0.6.5`, `0.6.4`, `0.6.3`, `0.6.2`, `0.6.1`, `0.6.0`, `0.5.1`, `0.5.0`.

## Versioning

Creases follows [Semantic Versioning](https://semver.org/). The version is mirrored in:

| File            | Field                            | Updated by                  |
| --------------- | -------------------------------- | --------------------------- |
| `manifest.json` | `version`                        | `pnpm run release` (auto)   |
| `package.json`  | `version`                        | `pnpm run release` (auto)   |
| `versions.json` | newest key (when `minAppVersion` of `manifest.json` changes) | **manually**, before `release` |

`versions.json` maps each plugin version that bumped the minimum Obsidian version to the required Obsidian version. You do **not** need to list every plugin release here — only add an entry when `manifest.json`'s `minAppVersion` changes. It is normal and expected for `versions.json` to lag many releases behind the current plugin version. `standard-version` does not touch this file.

## Cutting a release

1. **Confirm the build is healthy.** From a clean tree on `main`:

   ```bash
   pnpm install
   pnpm run build
   ```

   See [BUILD.md](BUILD.md) for the full pre-release checklist (lint, build, manual smoke test in Obsidian).

2. **If `minAppVersion` changed**, update [`versions.json`](versions.json) by hand (mapping the upcoming plugin version to the new minimum Obsidian version) and stage it:

   ```bash
   git add versions.json
   ```

   Don't commit yet — `standard-version` will pick it up.

3. **Run the release script.**

   ```bash
   pnpm run release
   ```

   `standard-version` will:
   - Walk commits since the last tag.
   - Decide the next version: `BREAKING CHANGE:` footer or `!` shorthand → major; any `feat:` → minor; otherwise patch.
   - Bump `version` in `manifest.json` and `package.json`.
   - Regenerate `CHANGELOG.md` with grouped entries (Bug Fixes, Features, ⚠ BREAKING CHANGES).
   - Stage everything, create a `chore(release): X.Y.Z` commit, and create a tag `X.Y.Z`.

   To override the version explicitly:

   ```bash
   pnpm run release -- --release-as major   # force 0.7.0 → 1.0.0
   pnpm run release -- --release-as 1.2.3   # exact version
   ```

   To preview without committing:

   ```bash
   pnpm run release -- --dry-run
   ```

4. **Push the branch and the tag.**

   ```bash
   git push --follow-tags origin main
   ```

   `--follow-tags` pushes both the commit and the new tag in one go.

5. **Watch the workflow.** [`publish.yml`](.github/workflows/publish.yml) will:
   - Check out the tag.
   - Install dependencies (`pnpm install --frozen-lockfile`) and run `pnpm run build:ci` (skips lint since `standard-version` ran on a clean tree).
   - Zip up `main.js`, `manifest.json`, and `styles.css`.
   - Create a GitHub Release named after the tag.
   - Upload the zip plus loose `main.js`, `manifest.json`, and `styles.css` as release assets.

6. **Verify the GitHub Release.** Confirm all four assets are attached. The Obsidian community plugins directory pulls `main.js`, `manifest.json`, and `styles.css` directly from the release by tag, so missing assets will break installations.

## Known issues with the publish workflow

A couple of things in [`publish.yml`](.github/workflows/publish.yml) are worth fixing the next time someone touches it:

- **`actions/create-release@v1` and `actions/upload-release-asset@v1`** are archived and use the deprecated `::set-output` syntax. They still run, but plan to migrate to `softprops/action-gh-release` next time you edit this file.

## Hotfixes

If you need to ship a fix without including unreleased work on `main`:

1. Branch from the last release tag: `git checkout -b hotfix/0.7.1 0.7.0`.
2. Land the fix as a normal `fix:` commit.
3. Run `pnpm run release` on the hotfix branch — it will produce `0.7.1` since the only commit since `0.7.0` is a `fix:`.
4. Push with `--follow-tags`.

If `main` already has the fix you can release directly from `main` instead.

## Pre-releases

`standard-version` supports pre-release tags via `--prerelease`:

```bash
pnpm run release -- --prerelease beta   # 0.7.0 → 0.8.0-beta.0
pnpm run release -- --prerelease beta   # → 0.8.0-beta.1, etc.
```

`publish.yml` currently sets `prerelease: false` unconditionally on the GitHub Release, so flip that flag in the GitHub UI after the workflow runs (or update the workflow first).
