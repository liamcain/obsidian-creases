# Build & Test

Creases is a single-file Obsidian plugin bundled by [esbuild](esbuild.config.mjs). There is no automated test suite; verification is a combination of linting, a clean production build, and manual smoke testing inside Obsidian.

## Prerequisites

- Node.js 18+ (the GitHub Actions release workflow pins Node 18; any recent LTS works locally).
- pnpm. The lockfile is `pnpm-lock.yaml`; do not use `npm` or `yarn` (they will produce a different lockfile and may resolve different versions).

Install dependencies once:

```bash
pnpm install
```

For local-vault development, also copy `.env.example` to `.env` and set `OBSIDIAN_VAULT_PATH` to the absolute path of an Obsidian vault you want to install the plugin into:

```bash
cp .env.example .env
# then edit .env
```

## Build commands

Defined in [package.json](package.json):

| Command              | What it does                                                                                                  |
| -------------------- | ------------------------------------------------------------------------------------------------------------- |
| `pnpm run lint`      | Runs ESLint over `**/*.ts`. Must pass before a release.                                                       |
| `pnpm run dev`       | esbuild watch mode. Writes `main.js` + `styles.css` directly into `$OBSIDIAN_VAULT_PATH/.obsidian/plugins/creases/`. Includes inline sourcemaps. Errors out if `OBSIDIAN_VAULT_PATH` is unset. |
| `pnpm run build`     | Runs `lint`, then a minified production esbuild. Output: `main.js` + `styles.css` at the repo root.           |
| `pnpm run build:ci`  | Same as `build` but skips lint. Used by [`publish.yml`](.github/workflows/publish.yml) on tag pushes.         |
| `pnpm run build:local` | Runs `pnpm run build` then copies `main.js`, `manifest.json`, and `styles.css` into `$OBSIDIAN_VAULT_PATH/.obsidian/plugins/creases/`. Use to test the *production* (minified) bundle in a real vault. |

`dev` and `build:local` overlap in destination but differ in purpose:

- **`dev`** — watch mode, sourcemapped, fast incremental rebuilds. Use during normal iteration. Requires you to reload the plugin in Obsidian (Settings → Community plugins → toggle off/on, or use the *Hot Reload* community plugin) to pick up each rebuild.
- **`build:local`** — one-shot, minified, no sourcemap. Use to verify the artifact you would actually ship.

`manifest.json` and `styles.css` are checked in. `main.js` is gitignored (it's a build artifact).

## What "build tested" means for this plugin

There are no unit tests. Before merging or releasing, verify:

1. **Lint is clean** — `pnpm run lint` exits 0. CI ([`.github/workflows/main.yml`](.github/workflows/main.yml)) enforces this on push and PRs to `main`.
2. **Production build succeeds** — `pnpm run build` produces `main.js` + `styles.css` at the repo root with no errors or warnings.
3. **Manual smoke test in Obsidian** — install with `pnpm run build:local`, reload the plugin, and confirm:
   - The "Toggle Crease" command folds and unfolds the section under the cursor.
   - "Iron out creases" removes the `%% fold %%` markers without eating surrounding newlines (regression: [`08fff95`](https://github.com/liamcain/obsidian-creases/commit/08fff95)).
   - "Toggle Crease" respects block-IDs — a crease on a heading with a `^block-id` should round-trip correctly (regression: [`3f5fde3`](https://github.com/liamcain/obsidian-creases/commit/3f5fde3), [`f854847`](https://github.com/liamcain/obsidian-creases/commit/f854847), [`ce3c85b`](https://github.com/liamcain/obsidian-creases/commit/ce3c85b)).
   - Increase / Decrease fold level commands fold and unfold by one heading level at a time.
   - Opening a file does not cause a split view to appear (regression: [`8d556cb`](https://github.com/liamcain/obsidian-creases/commit/8d556cb)).
   - No "ghost panes" appear when toggling creases on Obsidian 0.15+ (regression: [`5e26f92`](https://github.com/liamcain/obsidian-creases/commit/5e26f92)).
   - Refocusing an already-open file does not refold creases (regression: [`ced7ab1`](https://github.com/liamcain/obsidian-creases/commit/ced7ab1)).

If you add behavior that is not covered above, extend this checklist in the same PR.

## Continuous integration

[`main.yml`](.github/workflows/main.yml) runs on every push and PR to `main` and executes `pnpm run lint`. It does *not* run a production build today; if you change `esbuild.config.mjs` or external dependencies, run `pnpm run build` locally before pushing.

[`publish.yml`](.github/workflows/publish.yml) runs on tag pushes (any tag) and uses `pnpm run build:ci` to skip lint, since `standard-version` will already have run on a clean tree before the tag was pushed.
